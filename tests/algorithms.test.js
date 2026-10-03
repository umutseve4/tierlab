import { test } from "node:test";
import assert from "node:assert/strict";
import {
  jenksClassify, normalize, compositeScores, scoresToTiers, rankToTiers, spearman, agreement, PairRanker, slug, shuffle,
} from "../js/algorithms.js";

test("jenks finds the obvious gaps", () => {
  const v = [1, 2, 3, 50, 51, 52, 100, 101];
  assert.deepEqual(jenksClassify(v, 3), [0, 0, 0, 1, 1, 1, 2, 2]);
});

test("jenks keeps input order and groups equal values", () => {
  const v = [10, 1, 10, 1, 5];
  const c = jenksClassify(v, 2);
  assert.equal(c[0], c[2]);
  assert.equal(c[1], c[3]);
  assert.ok(c[0] > c[1]);
});

test("jenks with fewer unique values than classes", () => {
  assert.deepEqual(jenksClassify([3, 3, 7], 5), [0, 0, 1]);
  assert.deepEqual(jenksClassify([], 3), []);
});

test("normalize methods", () => {
  assert.deepEqual(normalize([0, 5, 10]), [0, 0.5, 1]);
  assert.deepEqual(normalize([1, null, 3]), [0, null, 1]);
  assert.deepEqual(normalize([4, 4]), [1, 1]);
  assert.deepEqual(normalize([10, 20, 30], "rank"), [0, 0.5, 1]);
  const log = normalize([0, 9, 99], "log");
  assert.ok(Math.abs(log[1] - 0.5) < 1e-9);
});

test("composite score respects weights and direction", () => {
  const items = [
    { id: "a", stats: { good: 10, bad: 0 } },
    { id: "b", stats: { good: 0, bad: 10 } },
  ];
  const s = compositeScores(items, [{ key: "good", weight: 1, higherIsBetter: true }, { key: "bad", weight: 1, higherIsBetter: false }]);
  assert.deepEqual(s, [{ id: "a", score: 100 }, { id: "b", score: 0 }]);
  const zero = compositeScores(items, [{ key: "good", weight: 0 }]);
  assert.deepEqual(zero.map((x) => x.score), [null, null]);
});

test("scoresToTiers: best score -> tier 0", () => {
  const scores = [{ id: "x", score: 95 }, { id: "y", score: 10 }, { id: "z", score: 50 }, { id: "n", score: null }];
  const m = scoresToTiers(scores, 3);
  assert.equal(m.get("x"), 0);
  assert.equal(m.get("z"), 1);
  assert.equal(m.get("y"), 2);
  assert.equal(m.get("n"), null);
  const eq = scoresToTiers(scores, 3, "equal");
  assert.equal(eq.get("x"), 0);
});

test("rankToTiers shapes cover all items, non-decreasing, every tier used", () => {
  for (const shape of ["pyramid", "balanced", "bell"]) {
    for (const [n, k] of [[24, 6], [9, 5], [5, 5], [3, 6], [100, 6]]) {
      const r = rankToTiers(n, k, shape);
      assert.equal(r.length, n, `${shape} ${n}/${k}`);
      for (let i = 1; i < n; i++) assert.ok(r[i] >= r[i - 1]);
      assert.equal(new Set(r).size, Math.min(n, k));
    }
  }
  const p = rankToTiers(21, 6, "pyramid");
  assert.ok(p.filter((x) => x === 0).length < p.filter((x) => x === 5).length);
});

test("spearman", () => {
  assert.equal(spearman([1, 2, 3], [1, 2, 3]), 1);
  assert.equal(spearman([1, 2, 3], [3, 2, 1]), -1);
  assert.equal(spearman([1], [1]), null);
});

test("agreement score and hot-take direction", () => {
  const mine = new Map([["a", 0], ["b", 1], ["c", 2]]);
  assert.equal(agreement(mine, mine, 3).score, 100);
  const ref = new Map([["a", 2], ["b", 1], ["c", 2]]);
  const r = agreement(mine, ref, 3);
  assert.equal(r.diffs[0].id, "a");
  assert.ok(r.diffs[0].delta > 0, "I rate 'a' higher than the reference");
  assert.equal(r.score, Math.round(100 * (1 - 2 / 3 / 2)));
  assert.equal(agreement({}, {}, 3).score, null);
});

function runRanker(ids, truth) {
  const pr = new PairRanker(ids);
  let guard = 0;
  while (!pr.done && guard++ < 10000) {
    const { a, b } = pr.question();
    pr.answer(truth.indexOf(a) < truth.indexOf(b) ? "a" : "b");
  }
  return pr;
}

test("PairRanker sorts correctly within n·log2(n) questions", () => {
  const truth = Array.from({ length: 30 }, (_, i) => `i${i}`);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pr = runRanker(shuffle(truth, rand), truth);
  assert.deepEqual(pr.ranking, truth);
  assert.ok(pr.asked <= Math.ceil(30 * Math.log2(30)), `asked ${pr.asked}`);
  assert.equal(pr.remaining(), 0);
});

test("PairRanker undo, ties, partial results", () => {
  const pr = new PairRanker(["a", "b", "c"]);
  const q1 = pr.question();
  pr.answer("a");
  assert.ok(pr.undo());
  assert.deepEqual(pr.question(), q1);
  assert.equal(pr.undo(), false);
  pr.answer("tie");
  assert.equal(pr.ranking.length, 2);
  assert.deepEqual(pr.unranked, ["c"]);
  assert.ok(pr.remaining() >= 1);
  assert.deepEqual(new PairRanker([]).ranking, []);
  assert.deepEqual(new PairRanker(["solo"]).ranking, ["solo"]);
});

test("slug handles Turkish and accents", () => {
  assert.equal(slug("Šarūnas Jasikevičius"), "sarunas-jasikevicius");
  assert.equal(slug("Kaymak & bal"), "kaymak-bal");
  assert.equal(slug("Islak hamburger"), "islak-hamburger");
  assert.equal(slug("İçli köfte"), "icli-kofte");
  assert.equal(slug("!!!"), "item");
  assert.deepEqual(["C", "C++", "C#"].map(slug), ["c", "c-plus-plus", "c-sharp"]);
});
