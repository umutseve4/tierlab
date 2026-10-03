// Pure HTML-string views (no DOM access) — easy to test in Node.
import { t, getLang } from "./i18n.js";
import { CATEGORIES } from "./topics.js";
import { hashHue } from "./algorithms.js";
import { displayName, TIER_PRESETS } from "./model.js";

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const L = (o) => (o && (o[getLang()] || o.en)) || "";

export function homeView(topics, cat = "all") {
  const cats = Object.entries(CATEGORIES).filter(([k]) => topics.some((tp) => tp.cat === k));
  const chips = [["all", { emoji: "✨", tr: t("all"), en: t("all") }], ...cats]
    .map(([k, c]) => `<button class="chip ${k === cat ? "on" : ""}" data-act="cat" data-cat="${k}">${c.emoji} ${esc(L(c))}</button>`)
    .join("");
  const cards = topics
    .filter((tp) => cat === "all" || tp.cat === cat)
    .map((tp) => `
      <a class="topic" href="#/t/${tp.id}" data-cat="${tp.cat}">
        <div class="topic-emoji">${tp.emoji}</div>
        <div class="topic-body">
          <h3>${esc(L(tp.title))}</h3>
          <p>${esc(L(tp.desc))}</p>
          <div class="badges">
            <span>${tp.items.length} ${t("items")}</span>
            ${tp.stats ? `<span class="b-data">📊 ${t("auto")}</span>` : ""}
            ${tp.reference ? `<span class="b-ref">🎯 ${t("compare")}</span>` : ""}
          </div>
        </div>
      </a>`)
    .join("");
  return `
    <section class="hero">
      <h1>${esc(t("heroTitle"))}</h1>
      <p>${esc(t("heroSub"))}</p>
      <div class="hero-cta">
        <a class="btn primary" href="#topics">${t("explore")}</a>
        <button class="btn" data-act="open-custom">${t("newList")}</button>
      </div>
      <div class="features">
        <div>🖐️ <b>${t("board")}</b></div><div>⚔️ <b>${t("duel")}</b></div>
        <div>📊 <b>${t("auto")}</b></div><div>🎯 <b>${t("compare")}</b></div>
      </div>
    </section>
    <section id="topics">
      <div class="chips">${chips}</div>
      <div class="grid">${cards}</div>
    </section>
    ${customDialog()}`;
}

export function customDialog() {
  const presets = Object.keys(TIER_PRESETS)
    .map((p) => `<option value="${p}">${TIER_PRESETS[p].map((x) => x[0]).join(" ")}</option>`)
    .join("");
  return `
    <dialog id="custom-dlg">
      <form method="dialog" class="dlg">
        <h2>${t("customTitle")}</h2>
        <input name="title" placeholder="${esc(t("titlePh"))}" maxlength="80">
        <textarea name="lines" rows="9" placeholder="${esc(t("linesPh"))}" required></textarea>
        <label>${t("preset")} <select name="preset">${presets}</select></label>
        <div class="row-end">
          <button value="cancel" class="btn">${t("cancel")}</button>
          <button value="ok" class="btn primary" data-act="create-custom">${t("create")}</button>
        </div>
      </form>
    </dialog>`;
}

export function tileHtml(item, { selected = false, score = null, img = null } = {}) {
  const name = displayName(item, getLang());
  const hue = hashHue(item.name);
  const src = img || item.img;
  const inner = src
    ? `<img src="${esc(src)}" alt="" loading="lazy" draggable="false" referrerpolicy="no-referrer"><span class="cap">${esc(name)}</span>`
    : `<span class="txt">${esc(name)}</span>`;
  return `<div class="tile ${src ? "has-img" : ""} ${selected ? "sel" : ""}" draggable="true" tabindex="0"
      data-id="${esc(item.id)}" title="${esc(name + (item.note ? " — " + item.note : ""))}"
      style="--h:${hue}">${inner}${score != null ? `<span class="score">${score}</span>` : ""}</div>`;
}

export function boardView(doc, { selected, images = {}, editable = true } = {}) {
  const rows = doc.tiers
    .map((tier, i) => `
      <div class="tier" data-tier="${i}">
        <div class="tier-label" style="background:${esc(tier.color)}" ${editable ? `data-act="edit-tier" data-tier="${i}"` : ""}
             title="${i + 1}">${esc(tier.label)}</div>
        <div class="tier-items drop" data-tier="${i}">
          ${tier.items.map((id) => tileHtml(doc.items[id], { selected: id === selected, img: images[id] })).join("")}
        </div>
      </div>`)
    .join("");
  return `
    <div class="board" id="board">
      <div class="board-title">${esc(doc.title)}</div>
      ${rows}
    </div>
    ${editable ? `<button class="btn ghost small" data-act="add-tier">${t("addTier")}</button>` : ""}
    <div class="pool-wrap">
      <div class="pool-head"><b>${t("pool")}</b> <span class="muted">(${doc.pool.length})</span>
        <span class="muted small">${t("poolHint")}</span></div>
      <div class="pool drop" data-tier="-1">
        ${doc.pool.map((id) => tileHtml(doc.items[id], { selected: id === selected, img: images[id] })).join("")}
      </div>
      <form class="add-item" data-act="add-item">
        <input name="name" placeholder="${esc(t("addItemPh"))}" maxlength="200">
        <button class="btn small">${t("addItem")}</button>
      </form>
    </div>`;
}

export function toolbar(mode, hasStats, hasRef) {
  const tab = (m, label, icon) => `<button class="tab ${mode === m ? "on" : ""}" data-act="mode" data-mode="${m}">${icon} ${label}</button>`;
  return `
    <div class="tabs">
      ${tab("board", t("board"), "🖐️")}${tab("duel", t("duel"), "⚔️")}
      ${tab("auto", t("auto"), "📊")}${tab("compare", t("compare"), "🎯")}
    </div>
    <div class="actions">
      <button class="btn small" data-act="undo" title="Ctrl+Z">↶ ${t("undo")}</button>
      <button class="btn small" data-act="reset">${t("reset")}</button>
      <button class="btn small" data-act="share">🔗 ${t("share")}</button>
      <button class="btn small" data-act="png">🖼️ ${t("png")}</button>
      <button class="btn small" data-act="export">⬇ ${t("exportJson")}</button>
      <label class="btn small file">⬆ ${t("importJson")}<input type="file" accept="application/json" data-act="import" hidden></label>
    </div>`;
}

export function duelIntroView(n) {
  const q = Math.max(0, Math.ceil(n * Math.log2(Math.max(n, 2)) - n + 1));
  return `
    <div class="panel center">
      <h2>⚔️ ${t("duel")}</h2>
      <p>${esc(t("duelIntro", { n, q, all: (n * (n - 1)) / 2 }))}</p>
      ${shapeSelect()}
      <button class="btn primary big" data-act="duel-start">${t("duelStart")}</button>
    </div>`;
}

export function shapeSelect(value = "pyramid") {
  return `<label>${t("shape")}
    <select data-act="shape">
      ${["pyramid", "balanced", "bell"].map((s) => `<option value="${s}" ${s === value ? "selected" : ""}>${t(s)}</option>`).join("")}
    </select></label>`;
}

export function duelQuestionView(doc, q, asked, remaining, images = {}) {
  const card = (id, side, key) => `
    <button class="duel-card" data-act="duel-answer" data-win="${side}">
      ${tileHtml(doc.items[id], { img: images[id] })}
      <span class="duel-name">${esc(displayName(doc.items[id], getLang()))}</span>
      ${doc.items[id].note ? `<span class="muted small">${esc(doc.items[id].note)}</span>` : ""}
      <kbd>${key}</kbd>
    </button>`;
  const total = asked + remaining;
  const pct = total ? Math.round((100 * asked) / total) : 100;
  return `
    <div class="panel center">
      <h2>${t("which")}</h2>
      <div class="progress"><div style="width:${pct}%"></div></div>
      <div class="muted small">${t("asked", { a: asked, r: remaining })}</div>
      <div class="duel">
        ${card(q.a, "a", "←")}
        <div class="vs">VS</div>
        ${card(q.b, "b", "→")}
      </div>
      <div class="row-center">
        <button class="btn" data-act="duel-undo">↶ ${t("undo")}</button>
        <button class="btn" data-act="duel-answer" data-win="tie">${t("tie")} <kbd>↓</kbd></button>
        <button class="btn ghost" data-act="duel-stop">${t("skip")}</button>
      </div>
    </div>`;
}

export function duelDoneView(doc, ranking, tiers, shape) {
  const list = ranking
    .map((id, i) => `<li><span class="pill" style="background:${esc(doc.tiers[tiers[i]]?.color)}">${esc(doc.tiers[tiers[i]]?.label)}</span>
      ${esc(displayName(doc.items[id], getLang()))}</li>`)
    .join("");
  return `
    <div class="panel">
      <h2>🏁 ${t("duelDone")}</h2>
      ${shapeSelect(shape)}
      <ol class="ranking">${list}</ol>
      <div class="row-center">
        <button class="btn primary" data-act="duel-apply">${t("applyBoard")}</button>
        <button class="btn" data-act="duel-restart">${t("restart")}</button>
      </div>
    </div>`;
}

export function autoView(topic, cfg, preview) {
  if (!topic?.stats) return `<div class="panel center"><p>${t("noStats")}</p></div>`;
  const sliders = topic.stats
    .map((s) => `
      <label class="slider">
        <span>${esc(L(s))} ${s.higherIsBetter === false ? "↓" : "↑"}</span>
        <input type="range" min="0" max="10" step="1" value="${cfg.weights[s.key]}" data-act="weight" data-key="${s.key}">
        <output>${cfg.weights[s.key]}</output>
      </label>`)
    .join("");
  const opt = (name, values) => `
    <select data-act="${name}">
      ${values.map((v) => `<option value="${v}" ${cfg[name] === v ? "selected" : ""}>${t(v)}</option>`).join("")}
    </select>`;
  const rows = preview
    .map((p) => `<tr><td><span class="pill" style="background:${esc(p.color)}">${esc(p.label)}</span></td>
      <td>${esc(p.name)}</td><td class="num">${p.score ?? "–"}</td>
      ${topic.stats.map((s) => `<td class="num muted">${p.stats?.[s.key] ?? "–"}</td>`).join("")}</tr>`)
    .join("");
  return `
    <div class="panel">
      <h2>📊 ${t("auto")}</h2>
      <p class="muted">${esc(t("autoIntro"))}</p>
      <div class="sliders">${sliders}</div>
      <div class="row-wrap">
        <label>${t("normalize")} ${opt("method", ["minmax", "rank", "log"])}</label>
        <label>${t("breaks")} ${opt("mode", ["jenks", "equal"])}</label>
        <button class="btn primary" data-act="auto-apply">${t("applyBoard")}</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Tier</th><th></th><th>${t("score")}</th>${topic.stats.map((s) => `<th>${esc(L(s))}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      ${topic.source ? `<p class="muted small">${t("source")}: ${esc(topic.source)}</p>` : ""}
    </div>`;
}

export function personality(score) {
  if (score == null) return "";
  if (score >= 90) return t("p0");
  if (score >= 75) return t("p1");
  if (score >= 60) return t("p2");
  if (score >= 45) return t("p3");
  return t("p4");
}

export function compareView(doc, result, { against = "ref", hasRef = true, linkValue = "", theirTiers = null } = {}) {
  const other = theirTiers || doc.tiers;
  const head = `
    <div class="row-wrap">
      <button class="chip ${against === "ref" ? "on" : ""}" data-act="cmp-ref" ${hasRef ? "" : "disabled"}>${t("vsRef")}</button>
      <form class="row-wrap grow" data-act="cmp-link">
        <input name="link" class="grow" placeholder="${esc(t("pastePh"))}" value="${esc(linkValue)}">
        <button class="btn small">${t("vsLink")}</button>
      </form>
    </div>`;
  let body;
  if (!result) body = `<p class="muted">${hasRef ? "" : t("noRef")}</p>`;
  else if (result.n < 3) body = `<p class="muted">${t("placeMore")}</p>`;
  else {
    const hot = result.diffs
      .filter((d) => d.delta !== 0)
      .slice(0, 8)
      .map((d) => {
        const item = doc.items[d.id];
        const me = doc.tiers[d.a], them = other[d.b];
        return `<li class="${d.delta > 0 ? "hi" : "lo"}">
          <b>${esc(displayName(item, getLang()))}</b>
          <span class="pill" style="background:${esc(me?.color)}">${esc(me?.label)}</span> vs
          <span class="pill" style="background:${esc(them?.color)}">${esc(them?.label)}</span>
          <span class="muted small">${d.delta > 0 ? "▲ " + t("youHigher") : "▼ " + t("youLower")}</span></li>`;
      })
      .join("");
    body = `
      <div class="gauge" style="--p:${result.score}"><span>${result.score}%</span></div>
      <p class="center big-txt">${esc(personality(result.score))}</p>
      <p class="center muted">${t("agreement")}: <b>${result.score}%</b> · ${t("spearman")}: <b>${result.rho == null ? "–" : result.rho.toFixed(2)}</b> · n=${result.n}</p>
      ${hot ? `<h3>🌶️ ${t("hotTakes")}</h3><ul class="hot">${hot}</ul>` : `<p class="center">${t("same")} ✔</p>`}`;
  }
  return `<div class="panel"><h2>🎯 ${t("compare")}</h2><p class="muted">${t("compareIntro")}</p>${head}${body}</div>`;
}
