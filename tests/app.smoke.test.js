// Boots js/app.js against a tiny fake DOM and drives it through every mode.
// Not a browser test — it catches runtime errors (typos, undefined vars, bad state) in the UI wiring.
import { test } from "node:test";
import assert from "node:assert/strict";

function fakeEl(data = {}, extra = {}) {
  return {
    dataset: data, classList: { add() {}, remove() {}, contains: (c) => (extra.classes || []).includes(c) },
    innerHTML: "", textContent: "", value: extra.value, files: [], form: extra.form,
    addEventListener() {}, append() {}, remove() {}, focus() {}, scrollIntoView() {}, showModal() {},
    querySelector: () => null, querySelectorAll: () => [], getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, width: 0 }),
    closest(sel) { return extra.closest ? extra.closest(sel, this) : null; },
    ...extra.props,
  };
}

const listeners = {};
const appEl = fakeEl();
appEl.addEventListener = (type, fn) => ((listeners["app:" + type] ||= []).push(fn));
const langBtn = fakeEl();
langBtn.addEventListener = (type, fn) => ((listeners["lang:" + type] ||= []).push(fn));
const storage = new Map();

globalThis.document = {
  documentElement: {}, title: "", body: fakeEl(), activeElement: null,
  querySelector: (s) => (s === "#app" ? appEl : s === "#lang" ? langBtn : null),
  querySelectorAll: () => [],
  createElement: () => fakeEl({}, { props: { getContext: () => null, toBlob() {}, click() {} } }),
  addEventListener: (type, fn) => ((listeners["doc:" + type] ||= []).push(fn)),
};
globalThis.window = { addEventListener: (type, fn) => ((listeners["win:" + type] ||= []).push(fn)), scrollTo() {} };
globalThis.location = { hash: "", origin: "https://umutseve4.github.io", pathname: "/tierlab/" };
globalThis.history = { replaceState: (_a, _b, h) => (location.hash = h) };
globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
Object.defineProperty(globalThis, "navigator", { value: { language: "tr-TR", clipboard: { writeText: async () => {} } }, configurable: true });
globalThis.CSS = { escape: (s) => s };
globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
globalThis.confirm = () => true;
globalThis.matchMedia = () => ({ matches: false });

const tick = () => new Promise((r) => setTimeout(r, 5));
async function go(hash) {
  location.hash = hash;
  for (const fn of listeners["win:hashchange"]) await fn();
  await tick();
}
function click(data, opts = {}) {
  const actEl = data ? fakeEl(data, opts) : null;
  const target = fakeEl({}, {
    closest: (sel) => (sel === "[data-act]" ? actEl : opts.fallback && sel.includes(".tile") ? opts.fallback : null),
  });
  for (const fn of listeners["app:click"]) fn({ target, stopPropagation() {}, clientX: 0, clientY: 0 });
}
function key(k) {
  for (const fn of listeners["doc:keydown"]) fn({ key: k, target: fakeEl(), preventDefault() {} });
}

test("app boots, routes and survives every mode", async () => {
  await import("../js/app.js");
  await tick();
  assert.match(appEl.innerHTML, /Kendi listeni yap/, "Turkish home page from navigator.language");

  click({ act: "cat", cat: "food" });
  assert.ok(appEl.innerHTML.includes("turkish-breakfast") && !appEl.innerHTML.includes("#/t/planets"));

  await go("#/t/nba-goats");
  assert.match(appEl.innerHTML, /data-id="michael-jordan"/);

  // tap-to-place: select a tile, then tap tier 0
  const tile = fakeEl({ id: "michael-jordan" }, { classes: ["tile"] });
  click(null, { fallback: tile });
  assert.match(appEl.innerHTML, /tile [^"]*sel/);
  const drop = fakeEl({ tier: "0" }, { classes: ["drop"] });
  click(null, { fallback: drop });
  const saved = JSON.parse(storage.get("tierlab:doc:topic:nba-goats"));
  assert.deepEqual(saved.tiers[0].items, ["michael-jordan"]);

  // keyboard placement + undo
  click(null, { fallback: fakeEl({ id: "luka-doncic" }, { classes: ["tile"] }) });
  key("1");
  assert.ok(JSON.parse(storage.get("tierlab:doc:topic:nba-goats")).tiers[0].items.includes("luka-doncic"));
  click({ act: "undo" });
  assert.ok(!JSON.parse(storage.get("tierlab:doc:topic:nba-goats")).tiers[0].items.includes("luka-doncic"));

  // duel: answer until done, then apply
  click({ act: "mode", mode: "duel" });
  click({ act: "duel-start" });
  assert.match(appEl.innerHTML, /data-win="a"/);
  key("ArrowLeft");
  key("Backspace");
  for (let i = 0; i < 400 && /data-win="a"/.test(appEl.innerHTML); i++) click({ act: "duel-answer", win: i % 3 ? "a" : "b" });
  assert.match(appEl.innerHTML, /data-act="duel-apply"/);
  click({ act: "duel-apply" });
  const afterDuel = JSON.parse(storage.get("tierlab:doc:topic:nba-goats"));
  assert.equal(afterDuel.pool.length, 0);
  assert.equal(afterDuel.tiers.reduce((n, t) => n + t.items.length, 0), 24);

  // auto-tier
  click({ act: "mode", mode: "auto" });
  assert.match(appEl.innerHTML, /Jenks/);
  for (const fn of listeners["app:change"]) fn({ target: fakeEl({ act: "method" }, { value: "rank" }) });
  click({ act: "auto-apply" });
  const afterAuto = JSON.parse(storage.get("tierlab:doc:topic:nba-goats"));
  assert.ok(afterAuto.tiers[0].items.includes("michael-jordan"));

  // compare against the reference
  click({ act: "mode", mode: "compare" });
  assert.match(appEl.innerHTML, /class="gauge"/);

  // share link -> open it as a shared view
  let copied = "";
  navigator.clipboard.writeText = async (u) => { copied = u; };
  click({ act: "share" });
  await tick();
  assert.match(copied, /#\/s\/[zj]/);
  await go(copied.slice(copied.indexOf("#")));
  assert.match(appEl.innerHTML, /shared view/);

  // custom list + add item + reset + language toggle
  await go("#/t/planets");
  click({ act: "mode", mode: "auto" });
  assert.match(appEl.innerHTML, /AU/);
  for (const fn of listeners["lang:click"]) fn();
  assert.match(appEl.innerHTML, /Auto-tier/);
  const form = { title: { value: "Pizza" }, lines: { value: "Pepperoni\nAnanas" }, preset: { value: "vibes" } };
  await go("#");
  click({ act: "create-custom" }, { form });
  await go(location.hash);
  assert.match(appEl.innerHTML, /data-id="ananas"/);
  for (const fn of listeners["app:submit"]) fn({ target: { dataset: { act: "add-item" }, name: { value: "Mantar" } }, preventDefault() {} });
  assert.match(appEl.innerHTML, /data-id="mantar"/);
  click({ act: "reset" });
});
