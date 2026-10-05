import { test } from "node:test";
import assert from "node:assert/strict";
import { EloArena, expected, kFactor, START_RATING, updateRatings } from "../js/elo.js";

// deterministic RNG (mulberry32)
const rng = (seed = 7) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

test("expected score is symmetric and 50% for equal ratings", () => {
  assert.equal(expected(1500, 1500), 0.5);
  assert.ok(Math.abs(expected(1600, 1400) + expected(1400, 1600) - 1) < 1e-12);
  assert.ok(expected(1900, 1500) > 0.9);
});

test("updateRatings is zero-sum with equal K and rewards upsets more", () => {
  const [a, b] = updateRatings(1500, 1500, 1, 32);
  assert.equal(a + b, 3000);
  assert.equal(a, 1516);
  const [upset] = updateRatings(1300, 1700, 1, 32);
  const [favourite] = updateRatings(1700, 1300, 1, 32);
  assert.ok(upset - 1300 > favourite - 1700);
  const [t1, t2] = updateRatings(1500, 1500, 0.5, 32);
  assert.deepEqual([t1, t2], [1500, 1500]);
});

test("K-factor shrinks as items play more", () => {
  assert.ok(kFactor(0) > kFactor(10) && kFactor(10) > kFactor(50));
});

test("pairs are valid, distinct and avoid immediate repeats", () => {
  const ids = ["a", "b", "c", "d", "e", "f"];
  const arena = new EloArena(ids, { rand: rng(1) });
  let prev = null;
  for (let i = 0; i < 40; i++) {
    const p = arena.nextPair();
    assert.ok(ids.includes(p.a) && ids.includes(p.b) && p.a !== p.b);
    if (prev) assert.notDeepEqual(new Set([p.a, p.b]), new Set([prev.a, prev.b]));
    arena.vote(p.a, p.b, "a");
    prev = p;
  }
  // every item got played, nobody starved
  const games = arena.leaderboard().map((r) => r.games);
  assert.ok(Math.min(...games) >= 8, `games ${games}`);
});

test("a consistent voter recovers the true order", () => {
  const truth = ["s1", "s2", "a1", "a2", "b1", "b2", "c1", "c2", "d1", "d2"]; // best first
  const strength = Object.fromEntries(truth.map((id, i) => [id, truth.length - i]));
  const arena = new EloArena(truth.slice().reverse(), { rand: rng(3) });
  for (let i = 0; i < 120; i++) {
    const { a, b } = arena.nextPair();
    arena.vote(a, b, strength[a] > strength[b] ? "a" : "b");
  }
  const order = arena.leaderboard().map((r) => r.id);
  assert.deepEqual(order.slice(0, 2).sort(), ["s1", "s2"]);
  assert.deepEqual(order.slice(-2).sort(), ["d1", "d2"]);
  assert.equal(arena.confidence(), 1);
  const tiers = arena.toTiers(5);
  assert.ok(tiers.get("s1") <= tiers.get("b1") && tiers.get("b1") <= tiers.get("d2"));
  assert.equal(tiers.get("s1"), 0);
});

test("undo restores the previous state exactly", () => {
  const arena = new EloArena(["x", "y", "z"], { rand: rng(5) });
  arena.vote("x", "y", "a");
  const snap = JSON.stringify(arena.toJSON());
  arena.vote("y", "z", "tie");
  assert.ok(arena.undo());
  assert.equal(JSON.stringify(arena.toJSON()), snap);
  assert.ok(arena.undo());
  assert.equal(arena.rating("x"), START_RATING);
  assert.equal(arena.undo(), false);
  assert.throws(() => arena.vote("x", "x", "a"));
});

test("save/restore reconciles added and removed items; unplayed items get no tier", () => {
  const arena = new EloArena(["x", "y", "z"], { rand: rng(9) });
  arena.vote("x", "y", "a");
  arena.vote("x", "z", "a");
  const restored = EloArena.fromJSON(JSON.parse(JSON.stringify(arena.toJSON())), ["x", "y", "new"]);
  assert.equal(restored.rating("x"), arena.rating("x"));
  assert.equal(restored.rating("new"), START_RATING);
  assert.equal(restored.rating("z"), undefined);
  assert.equal(restored.votes, 2);
  assert.equal(restored.toTiers(3).get("new"), null);
  assert.equal(EloArena.fromJSON(null, ["p", "q"]).votes, 0);
  assert.equal(new EloArena(["solo"]).nextPair(), null);
});
