// Pure, DOM-free algorithms. Everything here is unit-tested in tests/.

/** Fisher–Jenks natural breaks. Returns class index (0 = lowest) for every input value. */
export function jenksClassify(values, k) {
  const n = values.length;
  if (!n) return [];
  const uniq = [...new Set(values)].sort((a, b) => a - b);
  if (uniq.length <= k) {
    const rank = new Map(uniq.map((v, i) => [v, i]));
    return values.map((v) => rank.get(v));
  }
  const data = values.slice().sort((a, b) => a - b);
  const lower = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0));
  const cost = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0));
  for (let j = 1; j <= k; j++) {
    lower[1][j] = 1;
    for (let i = 2; i <= n; i++) cost[i][j] = Infinity;
  }
  for (let l = 2; l <= n; l++) {
    let sum = 0, sumSq = 0, w = 0, variance = 0;
    for (let m = 1; m <= l; m++) {
      const lcl = l - m + 1;
      const val = data[lcl - 1];
      w++; sum += val; sumSq += val * val;
      variance = sumSq - (sum * sum) / w;
      const i4 = lcl - 1;
      if (i4 !== 0) {
        for (let j = 2; j <= k; j++) {
          if (cost[l][j] >= variance + cost[i4][j - 1]) {
            lower[l][j] = lcl;
            cost[l][j] = variance + cost[i4][j - 1];
          }
        }
      }
    }
    lower[l][1] = 1;
    cost[l][1] = variance;
  }
  // walk back to find the first sorted index of every class
  const starts = new Array(k).fill(0);
  let end = n;
  for (let j = k; j >= 1; j--) {
    const s = lower[end][j] - 1;
    starts[j - 1] = s;
    end = s;
  }
  const classOfSorted = new Array(n);
  for (let j = 0; j < k; j++) {
    const to = j + 1 < k ? starts[j + 1] : n;
    for (let i = starts[j]; i < to; i++) classOfSorted[i] = j;
  }
  // equal values must share a class
  const classOfValue = new Map();
  data.forEach((v, i) => { if (!classOfValue.has(v)) classOfValue.set(v, classOfSorted[i]); });
  const raw = values.map((v) => classOfValue.get(v));
  // re-number so classes are consecutive 0..m-1
  const used = [...new Set(raw)].sort((a, b) => a - b);
  const remap = new Map(used.map((c, i) => [c, i]));
  return raw.map((c) => remap.get(c));
}

/** Normalize numbers to 0..1. method: "minmax" | "rank" | "log". Missing values stay null. */
export function normalize(values, method = "minmax") {
  const ok = (v) => typeof v === "number" && Number.isFinite(v);
  const present = values.filter(ok);
  if (!present.length) return values.map(() => null);
  if (method === "rank") {
    const sorted = present.slice().sort((a, b) => a - b);
    const pct = (v) => {
      if (sorted.length === 1) return 1;
      const first = sorted.indexOf(v), last = sorted.lastIndexOf(v);
      return (first + last) / 2 / (sorted.length - 1);
    };
    return values.map((v) => (ok(v) ? pct(v) : null));
  }
  const tf = method === "log" ? (v) => Math.log10(Math.max(v, 0) + 1) : (v) => v;
  const t = present.map(tf);
  const min = Math.min(...t), max = Math.max(...t);
  return values.map((v) => {
    if (!ok(v)) return null;
    return max === min ? 1 : (tf(v) - min) / (max - min);
  });
}

/**
 * Weighted composite score 0..100 per item.
 * items: [{id, stats:{key:number}}]; spec: [{key, weight, higherIsBetter}]
 */
export function compositeScores(items, spec, method = "minmax") {
  const active = spec.filter((s) => s.weight > 0);
  const norm = {};
  for (const s of active) {
    const col = normalize(items.map((it) => it.stats?.[s.key] ?? null), method);
    norm[s.key] = col.map((x) => (x == null ? null : s.higherIsBetter === false ? 1 - x : x));
  }
  return items.map((it, i) => {
    let num = 0, den = 0;
    for (const s of active) {
      const x = norm[s.key][i];
      if (x == null) continue;
      num += s.weight * x;
      den += s.weight;
    }
    return { id: it.id, score: den ? Math.round((num / den) * 1000) / 10 : null };
  });
}

/** Turn scores into tier indexes (0 = best). mode: "jenks" | "equal". Items with null score -> null. */
export function scoresToTiers(scores, tierCount, mode = "jenks") {
  const withScore = scores.filter((s) => s.score != null);
  const out = new Map(scores.map((s) => [s.id, null]));
  if (!withScore.length) return out;
  if (mode === "equal") {
    const sorted = withScore.slice().sort((a, b) => b.score - a.score);
    const tiers = rankToTiers(sorted.length, tierCount, "balanced");
    sorted.forEach((s, i) => out.set(s.id, tiers[i]));
    return out;
  }
  const classes = jenksClassify(withScore.map((s) => s.score), tierCount);
  const used = Math.max(...classes) + 1;
  withScore.forEach((s, i) => out.set(s.id, used - 1 - classes[i]));
  return out;
}

/** Split a best-first ranking of n items into k tiers. shape: "pyramid" | "balanced" | "bell". */
export function rankToTiers(n, k, shape = "pyramid") {
  if (n <= 0) return [];
  k = Math.max(1, Math.min(k, n));
  const weights = Array.from({ length: k }, (_, t) => {
    if (shape === "balanced") return 1;
    if (shape === "bell") {
      const mid = (k - 1) / 2;
      return Math.exp(-((t - mid) ** 2) / Math.max(1, k / 2));
    }
    return t + 1; // pyramid: elite top, crowded bottom
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / total) * n);
  const sizes = raw.map((r) => Math.max(1, Math.floor(r)));
  let diff = n - sizes.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let i = 0; diff > 0; i = (i + 1) % k, diff--) sizes[order[i][1]]++;
  for (let i = k - 1; diff < 0; i = (i - 1 + k) % k) if (sizes[i] > 1) { sizes[i]--; diff++; }
  const out = [];
  sizes.forEach((size, t) => { for (let i = 0; i < size; i++) out.push(t); });
  return out;
}

function averageRanks(xs) {
  const idx = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(xs.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let m = i; m <= j; m++) ranks[idx[m][1]] = (i + j) / 2;
    i = j + 1;
  }
  return ranks;
}

/** Spearman rank correlation (tie-aware). null when undefined. */
export function spearman(xs, ys) {
  if (xs.length < 2) return null;
  const rx = averageRanks(xs), ry = averageRanks(ys);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(rx), my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
}

/**
 * Compare two tier placements. a/b: Map|object id -> tier index (0 = best). k = number of tiers.
 * Returns { score 0..100, rho, n, diffs:[{id, a, b, delta}] }; delta > 0 means "a rates it higher than b".
 */
export function agreement(a, b, k) {
  const A = a instanceof Map ? a : new Map(Object.entries(a));
  const B = b instanceof Map ? b : new Map(Object.entries(b));
  const ids = [...A.keys()].filter((id) => A.get(id) != null && B.get(id) != null);
  if (!ids.length) return { score: null, rho: null, n: 0, diffs: [] };
  const span = Math.max(1, k - 1);
  let total = 0;
  const diffs = ids.map((id) => {
    const delta = B.get(id) - A.get(id);
    total += Math.min(Math.abs(delta), span);
    return { id, a: A.get(id), b: B.get(id), delta };
  });
  diffs.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta) || y.delta - x.delta);
  return {
    score: Math.round(100 * (1 - total / ids.length / span)),
    rho: spearman(ids.map((id) => A.get(id)), ids.map((id) => B.get(id))),
    n: ids.length,
    diffs,
  };
}

/**
 * "This or That" ranking: binary insertion sort driven by the user's answers.
 * Needs ~n·log2(n) questions instead of n². State is plain JSON so it can be undone.
 */
export class PairRanker {
  constructor(ids) {
    this.s = { sorted: [], queue: ids.slice(), cur: null, lo: 0, hi: 0, asked: 0 };
    this.history = [];
    this.next();
  }

  next() {
    const s = this.s;
    if (!s.sorted.length && s.queue.length) s.sorted.push(s.queue.shift());
    s.cur = s.queue.length ? s.queue.shift() : null;
    s.lo = 0;
    s.hi = s.sorted.length;
  }

  get done() { return this.s.cur == null; }
  get ranking() { return this.s.sorted.slice(); }
  get unranked() { return this.s.cur == null ? this.s.queue.slice() : [this.s.cur, ...this.s.queue]; }
  get asked() { return this.s.asked; }

  /** {a: candidate, b: already-ranked opponent} or null when finished. */
  question() {
    if (this.done) return null;
    return { a: this.s.cur, b: this.s.sorted[(this.s.lo + this.s.hi) >> 1] };
  }

  /** winner: "a" | "b" | "tie" */
  answer(winner) {
    if (this.done) return;
    this.history.push(JSON.stringify(this.s));
    const s = this.s;
    const mid = (s.lo + s.hi) >> 1;
    if (winner === "a") s.hi = mid;
    else if (winner === "b") s.lo = mid + 1;
    else s.lo = s.hi = mid + 1;
    s.asked++;
    if (s.lo >= s.hi) {
      s.sorted.splice(s.lo, 0, s.cur);
      this.next();
    }
  }

  undo() {
    if (!this.history.length) return false;
    this.s = JSON.parse(this.history.pop());
    return true;
  }

  /** Upper-bound estimate of questions still to come. */
  remaining() {
    const s = this.s;
    if (this.done) return 0;
    let r = Math.ceil(Math.log2(s.hi - s.lo + 1));
    let size = s.sorted.length + 1;
    for (let i = 0; i < s.queue.length; i++, size++) r += Math.ceil(Math.log2(size + 1));
    return r;
  }
}

export function slug(text) {
  return String(text)
    .replace(/ı/g, "i").replace(/İ/g, "I")
    .replace(/\+/g, "-plus").replace(/#/g, "-sharp") // C, C++ and C# must stay different
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

/** Deterministic hue for text tiles. */
export function hashHue(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 360;
}

export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
