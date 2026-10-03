// Tier list document model (pure functions, no DOM).
import { slug } from "./algorithms.js";

export const TIER_PRESETS = {
  classic: [["S", "#ff7f7f"], ["A", "#ffbf7f"], ["B", "#ffdf7f"], ["C", "#ffff7f"], ["D", "#bfff7f"], ["F", "#7fbfff"]],
  short: [["S", "#ff7f7f"], ["A", "#ffbf7f"], ["B", "#ffdf7f"], ["C", "#bfff7f"], ["D", "#7fbfff"]],
  vibes: [["🐐", "#ff7f7f"], ["🔥", "#ffbf7f"], ["👍", "#ffdf7f"], ["😐", "#bfff7f"], ["🗑️", "#a0a0b8"]],
  stars: [["★★★★★", "#ff7f7f"], ["★★★★", "#ffbf7f"], ["★★★", "#ffdf7f"], ["★★", "#bfff7f"], ["★", "#7fbfff"]],
};

let counter = 0;
export const uid = (p = "x") => `${p}${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function makeTiers(preset = "classic") {
  return (TIER_PRESETS[preset] || TIER_PRESETS.classic).map(([label, color], i) => ({ id: `t${i}`, label, color, items: [] }));
}

/** Build a fresh document from a topic definition. */
export function docFromTopic(topic, lang = "en") {
  const items = {};
  const pool = [];
  for (const raw of topic.items) {
    const id = slug(raw.name);
    items[id] = {
      id,
      name: raw.name,
      en: raw.en,
      wiki: raw.wiki,
      note: raw.note,
      img: raw.img,
      stats: raw.stats,
    };
    pool.push(id);
  }
  return {
    v: 1,
    topicId: topic.id,
    title: topic.title[lang] || topic.title.en,
    tiers: makeTiers(topic.tiers || "classic"),
    pool,
    items,
  };
}

/** "Name | https://image.url" per line. */
export function docFromLines(title, text, preset = "classic") {
  const items = {};
  const pool = [];
  for (const line of String(text).split(/\r?\n/)) {
    const [namePart, imgPart] = line.split("|").map((s) => s && s.trim());
    if (!namePart) continue;
    let id = slug(namePart);
    while (items[id]) id += "-2";
    items[id] = { id, name: namePart, img: /^https?:\/\//.test(imgPart || "") ? imgPart : undefined };
    pool.push(id);
  }
  return { v: 1, topicId: null, title: title || "My tier list", tiers: makeTiers(preset), pool, items };
}

export const clone = (o) => JSON.parse(JSON.stringify(o));

/** Where is the item? {tierIndex: -1 for pool, index} */
export function locate(doc, id) {
  const p = doc.pool.indexOf(id);
  if (p >= 0) return { tier: -1, index: p };
  for (let t = 0; t < doc.tiers.length; t++) {
    const i = doc.tiers[t].items.indexOf(id);
    if (i >= 0) return { tier: t, index: i };
  }
  return null;
}

const listOf = (doc, tier) => (tier === -1 ? doc.pool : doc.tiers[tier].items);

/** Move item to tier (-1 = pool) at index (default end). Returns new doc. */
export function moveItem(doc, id, tier, index) {
  const d = clone(doc);
  const from = locate(d, id);
  if (!from) return d;
  listOf(d, from.tier).splice(from.index, 1);
  const target = listOf(d, tier);
  let at = index == null ? target.length : index;
  if (from.tier === tier && from.index < at) at--;
  target.splice(Math.max(0, Math.min(at, target.length)), 0, id);
  return d;
}

/** Map of id -> tier index for every placed item (pool items excluded). */
export function placements(doc) {
  const m = new Map();
  doc.tiers.forEach((t, i) => t.items.forEach((id) => m.set(id, i)));
  return m;
}

/** Re-place items from a Map(id -> tier index | null). Unmapped/null go to the pool, keeping `order`. */
export function applyTierMap(doc, map, order) {
  const d = clone(doc);
  d.tiers.forEach((t) => (t.items = []));
  d.pool = [];
  const ids = order || Object.keys(d.items);
  for (const id of ids) {
    if (!d.items[id]) continue;
    const t = map.get(id);
    if (t == null || t < 0) d.pool.push(id);
    else d.tiers[Math.min(t, d.tiers.length - 1)].items.push(id);
  }
  for (const id of Object.keys(d.items)) if (!ids.includes(id)) d.pool.push(id);
  return d;
}

/** Topic reference (list of name arrays, best first) -> Map(id -> tier index) */
export function referenceMap(topic, tierCount) {
  const m = new Map();
  (topic.reference || []).forEach((names, t) => names.forEach((n) => m.set(slug(n), Math.min(t, tierCount - 1))));
  return m;
}

export function addItem(doc, name, img) {
  const d = clone(doc);
  let id = slug(name);
  while (d.items[id]) id += "-2";
  d.items[id] = { id, name, img: img || undefined, custom: !!d.topicId || undefined };
  d.pool.push(id);
  return d;
}

export function removeItem(doc, id) {
  const d = clone(doc);
  const at = locate(d, id);
  if (at) listOf(d, at.tier).splice(at.index, 1);
  delete d.items[id];
  return d;
}

export function displayName(item, lang) {
  return (lang === "en" && item.en) || item.name;
}

/** Compact, name-based payload for share links (drops uploaded data: images). */
export function toShare(doc) {
  const ids = Object.keys(doc.items);
  const index = new Map(ids.map((id, i) => [id, i]));
  return {
    v: 1,
    k: doc.topicId || undefined,
    t: doc.title,
    it: ids.map((id) => {
      const it = doc.items[id];
      const keepImg = it.img && !it.img.startsWith("data:");
      // topic items can be rebuilt from the topic, so only the name is needed
      return doc.topicId && !it.custom ? [it.name] : keepImg ? [it.name, it.img] : [it.name];
    }),
    r: doc.tiers.map((t) => [t.label, t.color, t.items.map((id) => index.get(id))]),
    p: doc.pool.map((id) => index.get(id)),
  };
}

export function fromShare(payload, topics) {
  const topic = payload.k ? topics.find((t) => t.id === payload.k) : null;
  const byName = new Map((topic?.items || []).map((i) => [i.name, i]));
  const items = {};
  const ids = payload.it.map(([name, img]) => {
    const base = byName.get(name);
    let id = slug(name);
    while (items[id]) id += "-2";
    items[id] = base
      ? { id, name, en: base.en, wiki: base.wiki, note: base.note, stats: base.stats, img: base.img }
      : { id, name, img, custom: !!topic };
    return id;
  });
  const placed = new Set();
  const take = (i) => { const id = ids[i]; if (id == null || placed.has(id)) return null; placed.add(id); return id; };
  const tiers = payload.r.map(([label, color, list], i) => ({
    id: `t${i}`, label: String(label), color: /^#[0-9a-f]{3,8}$/i.test(color) ? color : "#cccccc",
    items: list.map(take).filter(Boolean),
  }));
  const pool = payload.p.map(take).filter(Boolean);
  ids.forEach((id) => { if (!placed.has(id)) pool.push(id); });
  return { v: 1, topicId: topic ? topic.id : null, title: String(payload.t || "Tier list"), tiers, pool, items };
}
