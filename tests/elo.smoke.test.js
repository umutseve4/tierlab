// Boots js/elo-page.js against a tiny fake DOM: catches wiring errors (typos, bad ids, state bugs).
import { test } from "node:test";
import assert from "node:assert/strict";

const els = new Map();
const docListeners = {};
function el(id) {
  if (!els.has(id)) {
    els.set(id, { id, innerHTML: "", textContent: "", value: "", onclick: null, onchange: null, click() { this.onclick?.(); } });
  }
  return els.get(id);
}
const storage = new Map();
globalThis.document = {
  documentElement: {},
  querySelector: (s) => el(s.replace(/^#/, "")),
  addEventListener: (type, fn) => ((docListeners[type] ||= []).push(fn)),
};
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k),
};
Object.defineProperty(globalThis, "navigator", { value: { language: "tr-TR" }, configurable: true, writable: true });
globalThis.location = { search: "" };
globalThis.history = { replaceState() {} };
globalThis.confirm = () => true;

const sideOf = (side) => ({ target: { closest: (sel) => (sel === ".card" ? { dataset: { side } } : null) } });
const click = (side) => docListeners.click.forEach((fn) => fn(sideOf(side)));
const key = (k) => docListeners.keydown.forEach((fn) => fn({ key: k, target: { tagName: "BODY" } }));
const saved = (topicId) => JSON.parse(storage.get(`tierlab-elo-${topicId}`) || "null");

test("elo page boots, votes, undoes, switches topic/lang and resets", async () => {
  const { TOPICS } = await import("../js/topics.js");
  await import("../js/elo-page.js");
  const first = TOPICS[0].id;

  assert.match(el("h1").textContent, /Elo Oylama/);
  assert.match(el("duel").innerHTML, /data-side="a"[\s\S]*VS[\s\S]*data-side="b"/);
  assert.match(el("topic").innerHTML, new RegExp(`value="${first}" selected`));

  click("a");
  key("ArrowRight");
  key("ArrowDown");
  el("tie").click();
  assert.equal(saved(first).votes, 4);
  assert.match(el("stats").innerHTML, /<b>4<\/b> oy/);
  assert.match(el("board").innerHTML, /<li>/);
  assert.match(el("tiers").innerHTML, /class="tier"/);

  key("z");
  assert.equal(saved(first).votes, 3);
  el("skip").click();
  assert.equal(saved(first).votes, 3);

  // vote a lot — must never throw and confidence must grow
  for (let i = 0; i < 150; i++) click(i % 2 ? "a" : "b");
  assert.equal(saved(first).votes, 153);
  assert.match(el("stats").innerHTML, /width:\d+%/);

  // topic switch keeps votes per topic
  const second = TOPICS[1].id;
  el("topic").onchange({ target: { value: second } });
  assert.match(el("topic").innerHTML, new RegExp(`value="${second}" selected`));
  assert.equal(saved(second), null);
  click("a");
  assert.equal(saved(second).votes, 1);
  assert.equal(saved(first).votes, 153);

  // language toggle
  el("lang").click();
  assert.match(el("h1").textContent, /Elo Voting/);
  assert.equal(storage.get("tierlab-lang"), "en");

  // reset
  el("reset").click();
  assert.equal(saved(second), null);
  assert.match(el("board").innerHTML, /No votes yet/);
});
