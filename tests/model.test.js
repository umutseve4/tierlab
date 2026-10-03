import { test } from "node:test";
import assert from "node:assert/strict";
import {
  docFromTopic, docFromLines, moveItem, placements, applyTierMap, referenceMap, addItem, removeItem, toShare, fromShare, locate,
} from "../js/model.js";
import { TOPICS, findTopic } from "../js/topics.js";
import { slug, compositeScores, scoresToTiers } from "../js/algorithms.js";
import { encodePayload, decodePayload } from "../js/share.js";

test("every topic is valid: unique ids, references point to real items, stats complete", () => {
  const ids = new Set();
  for (const tp of TOPICS) {
    assert.ok(!ids.has(tp.id), tp.id);
    ids.add(tp.id);
    assert.ok(tp.title.tr && tp.title.en && tp.desc.tr && tp.desc.en, tp.id);
    const itemIds = tp.items.map((i) => slug(i.name));
    assert.equal(new Set(itemIds).size, itemIds.length, `duplicate item in ${tp.id}`);
    const inRef = new Set();
    for (const tier of tp.reference || []) {
      for (const n of tier) {
        assert.ok(itemIds.includes(slug(n)), `${tp.id}: reference "${n}" missing`);
        assert.ok(!inRef.has(n), `${tp.id}: "${n}" twice in reference`);
        inRef.add(n);
      }
    }
    if (tp.reference) assert.equal(inRef.size, itemIds.length, `${tp.id}: every item should be in the reference`);
    for (const s of tp.stats || []) for (const it of tp.items) assert.equal(typeof it.stats?.[s.key], "number", `${tp.id}/${it.name}/${s.key}`);
  }
});

test("docFromTopic puts everything in the pool", () => {
  const d = docFromTopic(findTopic("planets"), "tr");
  assert.equal(d.pool.length, 9);
  assert.equal(d.title, "Güneş Sistemi Gezegenleri");
  assert.ok(d.tiers.every((t) => t.items.length === 0));
});

test("moveItem between pool / tiers and within a tier", () => {
  let d = docFromLines("x", "A\nB\nC\n\nD | https://img/d.png\nE | not-a-url");
  assert.equal(d.items.d.img, "https://img/d.png");
  assert.equal(d.items.e.img, undefined);
  d = moveItem(d, "a", 0);
  d = moveItem(d, "b", 0);
  d = moveItem(d, "c", 0, 0);
  assert.deepEqual(d.tiers[0].items, ["c", "a", "b"]);
  d = moveItem(d, "c", 0, 3); // to the end of its own tier
  assert.deepEqual(d.tiers[0].items, ["a", "b", "c"]);
  d = moveItem(d, "a", -1, 0);
  assert.deepEqual(d.pool.slice(0, 1), ["a"]);
  assert.deepEqual(locate(d, "b"), { tier: 0, index: 0 });
  assert.equal(placements(d).get("b"), 0);
});

test("duplicate names get unique ids", () => {
  const d = docFromLines("x", "Simit\nSimit");
  assert.deepEqual(Object.keys(d.items), ["simit", "simit-2"]);
  const d2 = addItem(d, "Simit");
  assert.ok(d2.items["simit-2-2"]);
  assert.equal(removeItem(d2, "simit").pool.includes("simit"), false);
});

test("applyTierMap + auto-tier on NBA puts Jordan at the top and Dončić not above B", () => {
  const tp = findTopic("nba-goats");
  const d = docFromTopic(tp, "en");
  const spec = tp.stats.map((s) => ({ key: s.key, weight: 5, higherIsBetter: s.higherIsBetter }));
  const scores = compositeScores(Object.values(d.items), spec);
  const tiers = scoresToTiers(scores, d.tiers.length);
  const placed = applyTierMap(d, tiers);
  assert.equal(placed.pool.length, 0);
  assert.ok(placed.tiers[0].items.includes("michael-jordan"));
  const luka = placements(placed).get("luka-doncic");
  assert.ok(luka >= 2, `luka tier ${luka}`);
});

test("referenceMap clamps to tier count", () => {
  const m = referenceMap(findTopic("data-engineering-tools"), 3);
  assert.equal(m.get("excel"), 2);
  assert.equal(m.get("postgresql"), 0);
});

test("share round-trip (topic & custom) through the URL encoder", async () => {
  let d = docFromTopic(findTopic("turkish-breakfast"), "tr");
  d = moveItem(d, "menemen", 0);
  d = moveItem(d, "nutella", 5);
  d = addItem(d, "Kendi reçelim", "data:image/png;base64,AAAA");
  d.tiers[0].label = "GOAT";
  const enc = await encodePayload(toShare(d));
  assert.match(enc, /^[zj][\w-]+$/);
  const back = fromShare(await decodePayload(enc), TOPICS);
  assert.equal(back.topicId, "turkish-breakfast");
  assert.equal(back.tiers[0].label, "GOAT");
  assert.deepEqual(back.tiers[0].items, ["menemen"]);
  assert.deepEqual(back.tiers[5].items, ["nutella"]);
  assert.ok(back.items.menemen.wiki === undefined || typeof back.items.menemen.wiki === "string");
  assert.equal(back.items["kendi-recelim"].img, undefined, "data: images are not put in links");
  assert.equal(back.pool.length, d.pool.length);

  const c = moveItem(docFromLines("Pizza", "Pepperoni | https://x.y/p.jpg\nAnanas"), "ananas", 5);
  const back2 = fromShare(await decodePayload(await encodePayload(toShare(c))), TOPICS);
  assert.equal(back2.items.pepperoni.img, "https://x.y/p.jpg");
  assert.deepEqual(back2.tiers[5].items, ["ananas"]);
});

test("fromShare is defensive against bad input", () => {
  const d = fromShare({ t: "x", it: [["A"], ["B"]], r: [["S", "javascript:alert(1)", [0, 0, 9]]], p: [] }, TOPICS);
  assert.equal(d.tiers[0].color, "#cccccc");
  assert.deepEqual(d.tiers[0].items, ["a"]);
  assert.deepEqual(d.pool, ["b"]);
});

test("compressed share links are much shorter than plain JSON", async () => {
  let d = docFromTopic(findTopic("nba-goats"), "en");
  Object.keys(d.items).forEach((id, i) => (d = moveItem(d, id, i % 6)));
  const payload = toShare(d);
  const enc = await encodePayload(payload);
  const plainB64Len = Math.ceil((new TextEncoder().encode(JSON.stringify(payload)).length * 4) / 3);
  // exact size depends on the zlib build, so compare relatively instead of a hard byte limit
  if (enc[0] === "z") assert.ok(enc.length < plainB64Len * 0.8, `compressed ${enc.length} vs plain ${plainB64Len}`);
  assert.ok(enc.length < 4000, `URL-safe length (got ${enc.length})`);
});
