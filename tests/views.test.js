import { test } from "node:test";
import assert from "node:assert/strict";
import * as V from "../js/views.js";
import { setLang, t, DICTIONARY, detectLang } from "../js/i18n.js";
import { TOPICS, findTopic } from "../js/topics.js";
import { docFromTopic, docFromLines, moveItem, placements, referenceMap } from "../js/model.js";
import { agreement, PairRanker } from "../js/algorithms.js";

test("both languages have exactly the same keys", () => {
  assert.deepEqual(Object.keys(DICTIONARY.tr).sort(), Object.keys(DICTIONARY.en).sort());
  assert.equal(detectLang(null, "tr-TR"), "tr");
  assert.equal(detectLang("en", "tr-TR"), "en");
  assert.equal(detectLang(null, "de"), "en");
});

test("home view lists every topic and filters by category", () => {
  setLang("tr");
  const html = V.homeView(TOPICS);
  for (const tp of TOPICS) assert.ok(html.includes(`#/t/${tp.id}`), tp.id);
  const food = V.homeView(TOPICS, "food");
  assert.ok(food.includes("#/t/turkish-breakfast") && !food.includes("#/t/planets"));
  assert.ok(html.includes("Kendi listeni yap"));
});

test("HTML is escaped everywhere user text appears", () => {
  setLang("en");
  let d = docFromLines(`<img src=x onerror=alert(1)>`, `<script>alert(1)</script>\nOk | https://a.b/"onload="x.png`);
  d = moveItem(d, Object.keys(d.items)[0], 0);
  const html = V.boardView(d, {});
  assert.ok(!html.includes("<script>alert"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!/"onload="/.test(html));
});

test("board view renders tiers, pool and selection", () => {
  let d = docFromTopic(findTopic("planets"), "en");
  d = moveItem(d, "dunya", 0);
  const html = V.boardView(d, { selected: "dunya" });
  assert.equal((html.match(/class="tier"/g) || []).length, 6);
  assert.ok(html.includes('data-id="dunya"'));
  assert.ok(html.includes("Earth"), "English names are shown in EN");
  assert.ok(/tile [^"]*sel/.test(html));
});

test("duel, auto and compare views render", () => {
  setLang("en");
  const tp = findTopic("nba-goats");
  const d = docFromTopic(tp, "en");
  assert.ok(V.duelIntroView(24).includes("276"));
  const pr = new PairRanker(Object.keys(d.items));
  assert.ok(V.duelQuestionView(d, pr.question(), 0, pr.remaining()).includes('data-win="a"'));
  assert.ok(V.duelDoneView(d, ["michael-jordan"], [0], "pyramid").includes("Michael Jordan"));
  const cfg = { method: "minmax", mode: "jenks", weights: { rings: 5, mvp: 5, fmvp: 5, ppg: 5, allnba: 5 } };
  assert.ok(V.autoView(tp, cfg, [{ name: "X", score: 50, label: "S", color: "#f00", stats: { rings: 1 } }]).includes("Jenks"));
  assert.ok(V.autoView(null).includes(t("noStats")));

  let mine = d;
  ["michael-jordan", "lebron-james", "kareem-abdul-jabbar"].forEach((id) => (mine = moveItem(mine, id, 0)));
  mine = moveItem(mine, "luka-doncic", 0); // hot take
  const r = agreement(placements(mine), referenceMap(tp, 6), 6);
  const html = V.compareView(mine, r, {});
  assert.ok(html.includes("Luka"));
  assert.ok(html.includes("You rate it higher"));
  assert.ok(V.compareView(mine, { n: 1 }, {}).includes(t("placeMore")));
});

test("personality buckets", () => {
  setLang("en");
  assert.match(V.personality(95), /NPC/);
  assert.match(V.personality(10), /Chaos/);
  assert.equal(V.personality(null), "");
});
