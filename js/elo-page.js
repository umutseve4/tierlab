// Elo voting page (elo.html). DOM glue only — the logic lives in elo.js.
import { EloArena } from "./elo.js";
import { TOPICS } from "./topics.js";
import { hashHue, slug } from "./algorithms.js";

const T = {
  tr: {
    title: "Elo Oylama", sub: "İki seçenekten birini seç. Her oy reytingleri günceller, sıralama zamanla netleşir.",
    topic: "Konu", tie: "Berabere", skip: "Geç", undo: "Geri al", reset: "Sıfırla", votes: "oy",
    conf: "netlik", board: "Canlı sıralama", tiers: "Tier listesi (Jenks doğal kırılımları)",
    keys: "Klavye: ← sol · → sağ · ↓ berabere · S geç · Z geri al", games: "maç", win: "galibiyet",
    confirm: "Bu konudaki tüm oylar silinsin mi?", back: "← TierLab'a dön", none: "Henüz oy yok.",
  },
  en: {
    title: "Elo Voting", sub: "Pick one of two. Every vote updates the ratings; the ranking settles over time.",
    topic: "Topic", tie: "Tie", skip: "Skip", undo: "Undo", reset: "Reset", votes: "votes",
    conf: "settled", board: "Live ranking", tiers: "Tier list (Jenks natural breaks)",
    keys: "Keys: ← left · → right · ↓ tie · S skip · Z undo", games: "games", win: "win",
    confirm: "Delete all votes for this topic?", back: "← Back to TierLab", none: "No votes yet.",
  },
};
const TIERS = [["S", "#ff7f7f"], ["A", "#ffbf7f"], ["B", "#ffdf7f"], ["C", "#ffff7f"], ["D", "#bfff7f"], ["F", "#7fbfff"]];

let lang = localStorage.getItem("tierlab-lang") || ((navigator.language || "en").startsWith("tr") ? "tr" : "en");
const params = new URLSearchParams(location.search);
let topic = TOPICS.find((t) => t.id === params.get("topic")) || TOPICS[0];
let arena, pair, names;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const key = () => `tierlab-elo-${topic.id}`;
const label = (id) => names[id];

function load() {
  names = {};
  for (const it of topic.items) names[slug(it.name)] = (lang === "en" && it.en) || it.name;
  const ids = Object.keys(names);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(key())); } catch { /* corrupt -> fresh */ }
  arena = EloArena.fromJSON(saved, ids);
  pair = arena.nextPair();
  render();
}

const save = () => localStorage.setItem(key(), JSON.stringify(arena.toJSON()));

function tile(id, side) {
  const item = topic.items.find((i) => slug(i.name) === id) || {};
  const hue = hashHue(id);
  return `<button class="card" data-side="${side}" style="--h:${hue}">
    <span class="ini">${esc(label(id).slice(0, 2))}</span>
    <span class="nm">${esc(label(id))}</span>
    ${item.note ? `<span class="note">${esc(item.note)}</span>` : ""}
    <span class="rt">${arena.rating(id) | 0}</span></button>`;
}

function render() {
  const t = T[lang];
  document.documentElement.lang = lang;
  $("#h1").textContent = `⚔️ ${t.title}`;
  $("#sub").textContent = t.sub;
  $("#back").textContent = t.back;
  $("#lang").textContent = lang === "tr" ? "EN" : "TR";
  $("#topic").innerHTML = TOPICS.map((x) =>
    `<option value="${x.id}" ${x.id === topic.id ? "selected" : ""}>${x.emoji} ${esc(x.title[lang] || x.title.en)}</option>`).join("");
  $("#topicLbl").textContent = t.topic;
  $("#tie").textContent = t.tie; $("#skip").textContent = t.skip; $("#undo").textContent = t.undo; $("#reset").textContent = t.reset;
  $("#keys").textContent = t.keys;
  const conf = Math.round(arena.confidence() * 100);
  $("#stats").innerHTML = `<b>${arena.votes}</b> ${t.votes} · <b>${conf}%</b> ${t.conf}<span class="bar"><i style="width:${conf}%"></i></span>`;
  $("#duel").innerHTML = pair ? `${tile(pair.a, "a")}<span class="vs">VS</span>${tile(pair.b, "b")}` : "";

  const lb = arena.leaderboard();
  $("#boardH").textContent = t.board;
  $("#board").innerHTML = arena.votes ? lb.map((r, i) => `<li><span class="pos">${i + 1}</span>
      <span class="n">${esc(label(r.id))}</span><span class="r">${r.rating}</span>
      <span class="m">${r.games} ${t.games}${r.winPct != null ? ` · ${r.winPct}% ${t.win}` : ""}</span></li>`).join("")
    : `<p class="muted">${t.none}</p>`;

  $("#tiersH").textContent = t.tiers;
  const map = arena.toTiers(5);
  $("#tiers").innerHTML = arena.votes ? TIERS.slice(0, 5).map(([l, c], ti) => {
    const ids = lb.filter((r) => map.get(r.id) === ti).map((r) => r.id);
    return `<div class="tier"><span class="tl" style="background:${c}">${l}</span><span class="ti">${ids
      .map((id) => `<em style="--h:${hashHue(id)}">${esc(label(id))}</em>`).join("")}</span></div>`;
  }).join("") : "";
}

function vote(w) {
  if (!pair) return;
  arena.vote(pair.a, pair.b, w);
  save();
  pair = arena.nextPair();
  render();
}

document.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) vote(card.dataset.side);
});
$("#tie").onclick = () => vote("tie");
$("#skip").onclick = () => { pair = arena.nextPair(); render(); };
$("#undo").onclick = () => { if (arena.undo()) { save(); pair = arena.nextPair(); render(); } };
$("#reset").onclick = () => { if (confirm(T[lang].confirm)) { localStorage.removeItem(key()); load(); } };
$("#topic").onchange = (e) => {
  topic = TOPICS.find((t) => t.id === e.target.value);
  history.replaceState(null, "", `?topic=${topic.id}`);
  load();
};
$("#lang").onclick = () => { lang = lang === "tr" ? "en" : "tr"; localStorage.setItem("tierlab-lang", lang); load(); };
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "SELECT") return;
  if (e.key === "ArrowLeft") vote("a");
  else if (e.key === "ArrowRight") vote("b");
  else if (e.key === "ArrowDown") vote("tie");
  else if (e.key.toLowerCase() === "s") $("#skip").click();
  else if (e.key.toLowerCase() === "z") $("#undo").click();
});

load();
