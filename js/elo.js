// Elo voting mode — pure, DOM-free (unit-tested in tests/elo.test.js).
// Instead of one strict ranking (PairRanker), Elo lets you vote on random-but-smart duels for as long
// as you like; every vote nudges ratings, and the ranking stabilises as more duels are played.
import { scoresToTiers } from "./algorithms.js";

export const START_RATING = 1500;

/** Probability that A beats B. */
export const expected = (ra, rb) => 1 / (1 + 10 ** ((rb - ra) / 400));

/** K-factor: big moves while an item is new (provisional), smaller once it has a few games. */
export const kFactor = (games) => (games < 5 ? 48 : games < 15 ? 32 : 20);

/** Update two ratings. score = 1 (A wins), 0 (B wins), 0.5 (tie). Returns [newA, newB]. */
export function updateRatings(ra, rb, score, ka = 32, kb = ka) {
  const ea = expected(ra, rb);
  return [ra + ka * (score - ea), rb + kb * ((1 - score) - (1 - ea))];
}

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export class EloArena {
  /** ids: item ids. rand: injectable RNG (tests). */
  constructor(ids, { rand = Math.random } = {}) {
    this.rand = rand;
    this.s = {
      ids: ids.slice(),
      r: Object.fromEntries(ids.map((id) => [id, START_RATING])),
      g: Object.fromEntries(ids.map((id) => [id, 0])),     // games played
      w: Object.fromEntries(ids.map((id) => [id, 0])),     // wins (ties = 0.5)
      seen: {},                                            // pairKey -> times played
      votes: 0,
      last: [],                                            // recently shown ids (avoid immediate repeats)
    };
    this.history = [];
  }

  get votes() { return this.s.votes; }
  rating(id) { return this.s.r[id]; }

  /** Next duel {a, b}: the least-played item vs. a close-rated opponent it hasn't faced (much). */
  nextPair() {
    const { ids, g, r, seen, last } = this.s;
    if (ids.length < 2) return null;
    const jitter = () => this.rand() * 0.5;
    const fresh = ids.filter((id) => !last.includes(id));
    const pool = fresh.length >= 2 ? fresh : ids;
    const a = pool.slice().sort((x, y) => g[x] + jitter() - (g[y] + jitter()))[0];
    const cost = (b) =>
      (seen[pairKey(a, b)] || 0) * 400 +          // strongly prefer new match-ups
      Math.abs(r[a] - r[b]) +                      // close ratings = informative duel
      g[b] * 15 +                                  // give under-played items a chance
      (last.includes(b) ? 300 : 0) +
      this.rand() * 60;                            // a bit of variety
    const b = ids.filter((id) => id !== a).sort((x, y) => cost(x) - cost(y))[0];
    return this.rand() < 0.5 ? { a, b } : { a: b, b: a };   // random left/right
  }

  /** winner: "a" | "b" | "tie" */
  vote(a, b, winner) {
    const s = this.s;
    if (!(a in s.r) || !(b in s.r) || a === b) throw new Error("bad pair");
    this.history.push(JSON.stringify(s));
    const score = winner === "a" ? 1 : winner === "b" ? 0 : 0.5;
    const [na, nb] = updateRatings(s.r[a], s.r[b], score, kFactor(s.g[a]), kFactor(s.g[b]));
    s.r[a] = na; s.r[b] = nb;
    s.g[a]++; s.g[b]++;
    s.w[a] += score; s.w[b] += 1 - score;
    s.seen[pairKey(a, b)] = (s.seen[pairKey(a, b)] || 0) + 1;
    s.votes++;
    s.last = [a, b, ...s.last].slice(0, Math.min(4, Math.max(0, s.ids.length - 2)));
  }

  undo() {
    if (!this.history.length) return false;
    this.s = JSON.parse(this.history.pop());
    return true;
  }

  /** Best first: [{id, rating, games, wins, winPct}] */
  leaderboard() {
    const { ids, r, g, w } = this.s;
    return ids
      .map((id) => ({ id, rating: Math.round(r[id]), games: g[id], wins: w[id], winPct: g[id] ? Math.round((100 * w[id]) / g[id]) : null }))
      .sort((x, y) => y.rating - x.rating || y.games - x.games);
  }

  /** 0..1 — how settled the ranking is (every item ~8 games = 100%). */
  confidence(target = 8) {
    const { ids, g } = this.s;
    if (!ids.length) return 0;
    return Math.min(1, ids.reduce((sum, id) => sum + Math.min(g[id], target), 0) / (ids.length * target));
  }

  /** Map(id -> tier index, 0 = best) using Jenks natural breaks on the ratings. Unplayed items -> null. */
  toTiers(tierCount) {
    const scores = this.s.ids.map((id) => ({ id, score: this.s.g[id] ? this.s.r[id] : null }));
    return scoresToTiers(scores, tierCount, "jenks");
  }

  toJSON() { return this.s; }

  /** Restore saved state; items added/removed since then are reconciled. */
  static fromJSON(state, ids, opts) {
    const arena = new EloArena(ids, opts);
    if (!state || !state.r) return arena;
    for (const id of ids) {
      if (id in state.r) {
        arena.s.r[id] = state.r[id];
        arena.s.g[id] = state.g?.[id] || 0;
        arena.s.w[id] = state.w?.[id] || 0;
      }
    }
    const keep = new Set(ids);
    for (const [k, v] of Object.entries(state.seen || {})) {
      const [x, y] = k.split("|");
      if (keep.has(x) && keep.has(y)) arena.s.seen[k] = v;
    }
    arena.s.votes = state.votes || 0;
    return arena;
  }
}
