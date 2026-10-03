// TierLab — UI wiring. Pure logic lives in algorithms.js / model.js / views.js.
import { TOPICS, findTopic } from "./topics.js";
import { t, setLang, getLang, detectLang } from "./i18n.js";
import {
  PairRanker, rankToTiers, compositeScores, scoresToTiers, agreement, shuffle, hashHue,
} from "./algorithms.js";
import {
  docFromTopic, docFromLines, moveItem, placements, applyTierMap, referenceMap, addItem, removeItem,
  toShare, fromShare, displayName, clone, uid, makeTiers,
} from "./model.js";
import { encodePayload, decodePayload } from "./share.js";
import * as V from "./views.js";

const $ = (sel, root = document) => root.querySelector(sel);
const app = $("#app");
const store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota / private mode */ } },
};

const S = {
  view: "home", cat: "all", key: null, topic: null, doc: null, mode: "board", selected: null,
  history: [], images: {}, duel: null, shape: "pyramid", duelStopped: false,
  auto: null, cmp: { against: "ref", other: null, otherTiers: null, link: "" },
};

/* ------------------------------------------------------------------ helpers */
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 2400);
}

function commit(newDoc, { record = true } = {}) {
  if (record) S.history.push(S.doc);
  if (S.history.length > 100) S.history.shift();
  S.doc = newDoc;
  if (S.key) store.set(`tierlab:doc:${S.key}`, S.doc);
  render();
}

function undo() {
  if (!S.history.length) return;
  S.doc = S.history.pop();
  if (S.key) store.set(`tierlab:doc:${S.key}`, S.doc);
  render();
}

function download(name, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const fileName = (ext) => `${(S.doc?.title || "tierlist").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.${ext}`;

/* ------------------------------------------------------------------ images (Wikipedia, cached) */
const imgCache = store.get("tierlab:img") || {};
let imgQueue = [];
let imgActive = 0;

async function wikiThumb(lang, title, suffix = "") {
  const ck = `${lang}:${title}`;
  if (ck in imgCache) return imgCache[ck];
  let src = null;
  try {
    const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
    if (r.ok) {
      const j = await r.json();
      if (j.type !== "disambiguation") src = j.thumbnail?.source || null;
    }
    if (!src) {
      const q = new URLSearchParams({
        action: "query", generator: "search", gsrsearch: title + suffix, gsrlimit: "1", prop: "pageimages",
        piprop: "thumbnail", pithumbsize: "240", format: "json", origin: "*",
      });
      const r2 = await fetch(`https://${lang}.wikipedia.org/w/api.php?${q}`);
      const pages = (await r2.json())?.query?.pages;
      src = pages ? Object.values(pages)[0]?.thumbnail?.source || null : null;
    }
  } catch { return null; } // offline: don't cache, retry next time
  imgCache[ck] = src;
  store.set("tierlab:img", imgCache);
  return src;
}

function requestImages() {
  if (!S.doc) return;
  const topic = S.topic;
  const lang = topic?.wikiLang || "en";
  for (const it of Object.values(S.doc.items)) {
    if (it.img || it.id in S.images || it.custom || (!S.doc.topicId && !it.wiki)) continue;
    S.images[it.id] = null;
    imgQueue.push(async () => {
      let src = await wikiThumb(lang, it.wiki || it.name, topic?.wikiSuffix || "");
      if (!src && lang !== "en") src = await wikiThumb("en", it.en || it.name, topic?.wikiSuffix || "");
      if (src) {
        S.images[it.id] = src;
        document.querySelectorAll(`.tile[data-id="${CSS.escape(it.id)}"]`).forEach((el) => {
          if (el.querySelector("img")) return;
          el.classList.add("has-img");
          const name = el.textContent.trim();
          el.innerHTML = `<img src="${V.esc(src)}" alt="" loading="lazy" draggable="false" referrerpolicy="no-referrer"><span class="cap">${V.esc(name)}</span>`;
        });
      }
    });
  }
  pumpImages();
}

function pumpImages() {
  while (imgActive < 4 && imgQueue.length) {
    const job = imgQueue.shift();
    imgActive++;
    job().finally(() => { imgActive--; pumpImages(); });
  }
}

/* ------------------------------------------------------------------ routing */
async function route() {
  const h = location.hash;
  S.mode = "board"; S.selected = null; S.duel = null; S.duelStopped = false; S.auto = null;
  S.cmp = { against: "ref", other: null, otherTiers: null, link: "" };
  if (h.startsWith("#/t/")) {
    const topic = findTopic(decodeURIComponent(h.slice(4)));
    if (!topic) { location.hash = ""; return; }
    openDoc(topic, `topic:${topic.id}`, store.get(`tierlab:doc:topic:${topic.id}`) || docFromTopic(topic, getLang()));
  } else if (h.startsWith("#/c/")) {
    const key = `custom:${h.slice(4)}`;
    const doc = store.get(`tierlab:doc:${key}`);
    if (!doc) { location.hash = ""; return; }
    openDoc(findTopic(doc.topicId), key, doc);
  } else if (h.startsWith("#/s/")) {
    try {
      const doc = fromShare(await decodePayload(h.slice(4)), TOPICS);
      openDoc(findTopic(doc.topicId), null, doc); // shared view: not autosaved until edited
    } catch { toast(t("loadFail")); location.hash = ""; }
  } else {
    S.view = "home"; S.doc = null; S.topic = null; S.key = null;
    render();
    if (h === "#topics") $("#topics")?.scrollIntoView();
  }
}

function openDoc(topic, key, doc) {
  S.view = "list"; S.topic = topic; S.key = key; S.doc = doc; S.history = []; S.images = {};
  imgQueue = [];
  render();
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------------ render */
function render() {
  document.documentElement.lang = getLang();
  $("#lang").textContent = getLang() === "tr" ? "EN" : "TR";
  if (S.view === "home") {
    document.title = `TierLab — ${t("tagline")}`;
    app.innerHTML = V.homeView(TOPICS, S.cat);
    return;
  }
  document.title = `${S.doc.title} · TierLab`;
  let main;
  if (S.mode === "duel") main = renderDuel();
  else if (S.mode === "auto") main = renderAuto();
  else if (S.mode === "compare") main = renderCompare();
  else main = V.boardView(S.doc, { selected: S.selected, images: S.images });
  const shared = !S.key ? `<span class="muted small">🔗 shared view — edits save as your copy</span>` : "";
  app.innerHTML = `
    <div class="crumbs"><a href="#">← ${t("home")}</a> ${shared}</div>
    ${V.toolbar(S.mode, !!S.topic?.stats, !!S.topic?.reference)}
    <div class="mode-${S.mode}">${main}</div>`;
  requestImages();
}

function ensureOwnCopy() {
  if (S.key) return;
  S.key = S.doc.topicId && !store.get(`tierlab:doc:topic:${S.doc.topicId}`) ? `topic:${S.doc.topicId}` : `custom:${uid("c")}`;
  history.replaceState(null, "", S.key.startsWith("topic:") ? `#/t/${S.doc.topicId}` : `#/c/${S.key.slice(7)}`);
}

function edit(newDoc) { ensureOwnCopy(); commit(newDoc); }

/* ---- duel */
function allIds() { return [...S.doc.tiers.flatMap((x) => x.items), ...S.doc.pool]; }

function renderDuel() {
  if (!S.duel) return V.duelIntroView(Object.keys(S.doc.items).length);
  if (S.duel.done || S.duelStopped) {
    const ranking = S.duel.ranking;
    return V.duelDoneView(S.doc, ranking, rankToTiers(ranking.length, S.doc.tiers.length, S.shape), S.shape);
  }
  return V.duelQuestionView(S.doc, S.duel.question(), S.duel.asked, S.duel.remaining(), S.images);
}

function duelAnswer(win) {
  if (!S.duel || S.duel.done) return;
  S.duel.answer(win);
  render();
}

/* ---- auto-tier */
function autoCfg() {
  if (!S.auto) {
    S.auto = { method: "minmax", mode: "jenks", weights: {} };
    for (const s of S.topic?.stats || []) S.auto.weights[s.key] = 5;
  }
  return S.auto;
}

function autoResult() {
  const cfg = autoCfg();
  const items = Object.values(S.doc.items);
  const spec = S.topic.stats.map((s) => ({ key: s.key, weight: cfg.weights[s.key], higherIsBetter: s.higherIsBetter }));
  const scores = compositeScores(items, spec, cfg.method);
  const tiers = scoresToTiers(scores, S.doc.tiers.length, cfg.mode);
  const order = scores.slice().sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return { scores, tiers, order };
}

function renderAuto() {
  if (!S.topic?.stats) return V.autoView(null);
  const { tiers, order } = autoResult();
  const preview = order.map(({ id, score }) => {
    const ti = tiers.get(id);
    const tier = ti == null ? { label: "–", color: "#555" } : S.doc.tiers[ti];
    const it = S.doc.items[id];
    return { name: displayName(it, getLang()), score, label: tier.label, color: tier.color, stats: it.stats };
  });
  return V.autoView(S.topic, autoCfg(), preview);
}

/* ---- compare */
function renderCompare() {
  const hasRef = !!S.topic?.reference;
  const mine = placements(S.doc);
  let result = null, theirTiers = null;
  if (S.cmp.against === "link" && S.cmp.other) {
    result = agreement(mine, placements(S.cmp.other), Math.max(S.doc.tiers.length, S.cmp.other.tiers.length));
    theirTiers = S.cmp.other.tiers;
  } else if (hasRef) {
    result = agreement(mine, referenceMap(S.topic, S.doc.tiers.length), S.doc.tiers.length);
  }
  return V.compareView(S.doc, result, { against: S.cmp.against, hasRef, linkValue: S.cmp.link, theirTiers });
}

/* ------------------------------------------------------------------ share & export */
async function shareLink() {
  const url = `${location.origin}${location.pathname}#/s/${await encodePayload(toShare(S.doc))}`;
  try {
    if (navigator.share && matchMedia("(pointer:coarse)").matches) await navigator.share({ title: S.doc.title, url });
    else { await navigator.clipboard.writeText(url); toast(t("copied")); }
  } catch { prompt(t("copyFail"), url); }
}

function loadImage(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.referrerPolicy = "no-referrer";
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

async function exportPng() {
  const doc = S.doc;
  const W = 1200, LBL = 120, TILE = 96, GAP = 6, PAD = 16, HEAD = 70;
  const perRow = Math.floor((W - LBL - PAD * 2 - GAP) / (TILE + GAP));
  const rowsH = doc.tiers.map((tr) => Math.max(1, Math.ceil(tr.items.length / perRow)) * (TILE + GAP) + GAP);
  const H = HEAD + rowsH.reduce((a, b) => a + b, 0) + doc.tiers.length * 2 + 40;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#14161f"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#fff"; g.font = "bold 30px system-ui, sans-serif"; g.textBaseline = "middle";
  g.fillText(doc.title, PAD, HEAD / 2);

  const ids = doc.tiers.flatMap((x) => x.items);
  const imgs = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await loadImage(S.images[id] || doc.items[id].img)])));

  let y = HEAD;
  doc.tiers.forEach((tier, i) => {
    const h = rowsH[i];
    g.fillStyle = tier.color; g.fillRect(PAD, y, LBL, h);
    g.fillStyle = "#1a1a1a"; g.font = "bold 28px system-ui, sans-serif"; g.textAlign = "center";
    g.fillText(tier.label, PAD + LBL / 2, y + h / 2, LBL - 10);
    g.fillStyle = "#1e2130"; g.fillRect(PAD + LBL, y, W - PAD * 2 - LBL, h);
    tier.items.forEach((id, j) => {
      const x = PAD + LBL + GAP + (j % perRow) * (TILE + GAP);
      const ty = y + GAP + Math.floor(j / perRow) * (TILE + GAP);
      const im = imgs[id];
      const name = displayName(doc.items[id], getLang());
      if (im) {
        const s = Math.min(im.width, im.height);
        g.drawImage(im, (im.width - s) / 2, (im.height - s) / 4, s, s, x, ty, TILE, TILE);
        g.fillStyle = "rgba(0,0,0,.65)"; g.fillRect(x, ty + TILE - 22, TILE, 22);
        g.fillStyle = "#fff"; g.font = "12px system-ui, sans-serif";
        g.fillText(name, x + TILE / 2, ty + TILE - 11, TILE - 6);
      } else {
        g.fillStyle = `hsl(${hashHue(doc.items[id].name)} 55% 42%)`; g.fillRect(x, ty, TILE, TILE);
        g.fillStyle = "#fff"; g.font = "bold 13px system-ui, sans-serif";
        wrapText(g, name, x + TILE / 2, ty + TILE / 2, TILE - 10, 15);
      }
    });
    y += h + 2;
  });
  g.textAlign = "right"; g.fillStyle = "#8b8fa3"; g.font = "14px system-ui, sans-serif";
  g.fillText("made with TierLab", W - PAD, H - 18);
  c.toBlob((b) => b && download(fileName("png"), b), "image/png");
}

function wrapText(g, text, cx, cy, maxW, lh) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (g.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 4);
  shown.forEach((ln, i) => g.fillText(ln, cx, cy + (i - (shown.length - 1) / 2) * lh, maxW));
}

function importJson(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d.items || !Array.isArray(d.tiers) || !Array.isArray(d.pool)) throw new Error("bad");
      ensureOwnCopy();
      commit(d);
    } catch { toast(t("loadFail")); }
  };
  r.readAsText(file);
}

/* ------------------------------------------------------------------ tier editor */
function editTier(i) {
  const tier = S.doc.tiers[i];
  const dlg = document.createElement("dialog");
  dlg.innerHTML = `
    <form method="dialog" class="dlg">
      <label>${t("tierLabel")} <input name="label" value="${V.esc(tier.label)}" maxlength="20" autofocus></label>
      <label>🎨 <input type="color" name="color" value="${V.esc(tier.color.length === 7 ? tier.color : "#cccccc")}"></label>
      <div class="row-end">
        <button value="del" class="btn danger" ${S.doc.tiers.length <= 1 ? "disabled" : ""}>${t("del")}</button>
        <button value="cancel" class="btn">${t("cancel")}</button>
        <button value="ok" class="btn primary">OK</button>
      </div>
    </form>`;
  document.body.append(dlg);
  dlg.addEventListener("close", () => {
    const f = dlg.querySelector("form");
    const d = clone(S.doc);
    if (dlg.returnValue === "ok") {
      d.tiers[i].label = f.label.value.trim() || tier.label;
      d.tiers[i].color = f.color.value;
      edit(d);
    } else if (dlg.returnValue === "del") {
      d.pool.push(...d.tiers[i].items);
      d.tiers.splice(i, 1);
      edit(d);
    }
    dlg.remove();
  });
  dlg.showModal();
}

/* ------------------------------------------------------------------ drag & drop + tap */
function dropIndex(container, x, y) {
  const tiles = [...container.querySelectorAll(".tile:not(.dragging)")];
  for (let i = 0; i < tiles.length; i++) {
    const r = tiles[i].getBoundingClientRect();
    if (y < r.top) return i;
    if (y <= r.bottom && x < r.left + r.width / 2) return i;
  }
  return tiles.length;
}

let dragId = null;
app.addEventListener("dragstart", (e) => {
  const tile = e.target.closest?.(".tile");
  if (!tile || S.mode !== "board") return;
  dragId = tile.dataset.id;
  tile.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", dragId);
});
app.addEventListener("dragend", (e) => {
  e.target.closest?.(".tile")?.classList.remove("dragging");
  document.querySelectorAll(".over").forEach((el) => el.classList.remove("over"));
  dragId = null;
});
app.addEventListener("dragover", (e) => {
  const zone = e.target.closest?.(".drop");
  if (!zone || !dragId) return;
  e.preventDefault();
  document.querySelectorAll(".over").forEach((el) => el !== zone && el.classList.remove("over"));
  zone.classList.add("over");
});
app.addEventListener("drop", (e) => {
  const zone = e.target.closest?.(".drop");
  if (!zone || !dragId) return;
  e.preventDefault();
  const id = dragId;
  dragId = null;
  edit(moveItem(S.doc, id, +zone.dataset.tier, dropIndex(zone, e.clientX, e.clientY)));
});

/* ------------------------------------------------------------------ clicks */
app.addEventListener("click", async (e) => {
  const actEl = e.target.closest("[data-act]");
  const el = actEl || e.target.closest(".tile, .drop");
  if (!el) return;
  const act = actEl ? actEl.dataset.act : undefined;

  if (!act && S.view === "list" && S.mode === "board") {
    if (el.classList.contains("tile")) {
      e.stopPropagation();
      S.selected = S.selected === el.dataset.id ? null : el.dataset.id;
      render();
    } else if (el.classList.contains("drop") && S.selected) {
      const id = S.selected;
      S.selected = null;
      edit(moveItem(S.doc, id, +el.dataset.tier, dropIndex(el, e.clientX, e.clientY)));
    }
    return;
  }

  switch (act) {
    case "cat": S.cat = el.dataset.cat; render(); break;
    case "open-custom": $("#custom-dlg")?.showModal(); break;
    case "create-custom": {
      const f = el.form;
      if (!f.lines.value.trim()) return;
      const doc = docFromLines(f.title.value.trim(), f.lines.value, f.preset.value);
      const key = uid("c");
      store.set(`tierlab:doc:custom:${key}`, doc);
      location.hash = `#/c/${key}`;
      break;
    }
    case "mode": S.mode = el.dataset.mode; S.selected = null; render(); break;
    case "undo": undo(); break;
    case "reset":
      if (confirm(t("resetConfirm"))) edit(applyTierMap(S.doc, new Map(), allIds()));
      break;
    case "share": shareLink(); break;
    case "png": exportPng(); break;
    case "export": download(fileName("json"), new Blob([JSON.stringify(S.doc, null, 2)], { type: "application/json" })); break;
    case "add-tier": {
      const d = clone(S.doc);
      const palette = makeTiers("classic");
      d.tiers.push({ id: uid("t"), label: "?", color: palette[d.tiers.length % palette.length].color, items: [] });
      edit(d);
      break;
    }
    case "edit-tier": editTier(+el.dataset.tier); break;
    case "duel-start":
      S.duel = new PairRanker(shuffle(Object.keys(S.doc.items)));
      S.duelStopped = false;
      render();
      break;
    case "duel-answer": duelAnswer(el.dataset.win); break;
    case "duel-undo": S.duel?.undo(); render(); break;
    case "duel-stop": S.duelStopped = true; render(); break;
    case "duel-restart": S.duel = null; S.duelStopped = false; render(); break;
    case "duel-apply": {
      const ranking = S.duel.ranking;
      const tiers = rankToTiers(ranking.length, S.doc.tiers.length, S.shape);
      const m = new Map(ranking.map((id, i) => [id, tiers[i]]));
      S.mode = "board";
      edit(applyTierMap(S.doc, m, [...ranking, ...S.duel.unranked]));
      break;
    }
    case "auto-apply": {
      const { tiers, order } = autoResult();
      S.mode = "board";
      edit(applyTierMap(S.doc, tiers, order.map((o) => o.id)));
      break;
    }
    case "cmp-ref": S.cmp.against = "ref"; render(); break;
    default: break;
  }
});

/* ------------------------------------------------------------------ inputs & forms */
app.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.act === "weight") {
    autoCfg().weights[el.dataset.key] = +el.value;
    el.nextElementSibling.textContent = el.value; // full re-render happens on "change" (slider released)
  }
});

app.addEventListener("change", (e) => {
  const el = e.target;
  const act = el.dataset.act;
  if (act === "weight") render();
  else if (act === "shape") { S.shape = el.value; render(); }
  else if (act === "method" || act === "mode") { autoCfg()[act] = el.value; render(); }
  else if (act === "import" && el.files[0]) importJson(el.files[0]);
});

app.addEventListener("submit", async (e) => {
  const f = e.target;
  if (f.dataset.act === "add-item") {
    e.preventDefault();
    const [name, img] = f.name.value.split("|").map((s) => s.trim());
    if (!name) return;
    edit(addItem(S.doc, name, /^https?:\/\//.test(img || "") ? img : undefined));
    $(".add-item input")?.focus();
  } else if (f.dataset.act === "cmp-link") {
    e.preventDefault();
    const link = f.link.value.trim();
    const m = link.match(/#\/s\/([\w-]+)/);
    try {
      if (!m) throw new Error("no payload");
      S.cmp = { against: "link", other: fromShare(await decodePayload(m[1]), TOPICS), link };
      // compare by item name so ids line up across lists
      const byName = new Map(Object.values(S.doc.items).map((it) => [it.name, it.id]));
      const o = S.cmp.other;
      const remapped = clone(o);
      remapped.tiers.forEach((tier) => (tier.items = tier.items.map((id) => byName.get(o.items[id].name)).filter(Boolean)));
      S.cmp.other = remapped;
      render();
    } catch { toast(t("loadFail")); }
  }
});

/* ------------------------------------------------------------------ keyboard */
document.addEventListener("keydown", (e) => {
  if (S.view !== "list" || e.target.closest?.("input, textarea, select, dialog")) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
  if (S.mode === "duel" && S.duel && !S.duel.done && !S.duelStopped) {
    if (e.key === "ArrowLeft") duelAnswer("a");
    else if (e.key === "ArrowRight") duelAnswer("b");
    else if (e.key === "ArrowDown") duelAnswer("tie");
    else if (e.key === "Backspace") { S.duel.undo(); render(); }
    return;
  }
  if (S.mode === "board") {
    const focusId = document.activeElement?.closest?.(".tile")?.dataset.id;
    const id = S.selected || focusId;
    if (!id) return;
    if (/^[0-9]$/.test(e.key)) {
      const n = +e.key;
      if (n > S.doc.tiers.length) return;
      S.selected = null;
      edit(moveItem(S.doc, id, n - 1 < 0 ? -1 : n - 1));
    } else if (e.key === "Delete") {
      S.selected = null;
      edit(removeItem(S.doc, id));
    } else if (e.key === "Escape") { S.selected = null; render(); }
  }
});

/* ------------------------------------------------------------------ boot */
$("#lang").addEventListener("click", () => {
  setLang(getLang() === "tr" ? "en" : "tr");
  store.set("tierlab:lang", getLang());
  render();
});
setLang(detectLang(store.get("tierlab:lang"), navigator.language));
window.addEventListener("hashchange", route);
route();
