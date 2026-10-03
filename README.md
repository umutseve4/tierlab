# 🏆 TierLab — tier lists that think back

[![CI](https://github.com/umutseve4/tierlab/actions/workflows/ci.yml/badge.svg)](https://github.com/umutseve4/tierlab/actions/workflows/ci.yml)

**Live:** https://umutseve4.github.io/tierlab/

Most tier-list sites are just drag & drop. TierLab adds four ways to rank, plus the math to back them up:

| Mode | What it does | How it works |
|---|---|---|
| 🖐️ **Board** | Classic drag & drop, tap-to-place on mobile, keys `1`–`9` / `0` | Undo history, editable tiers & colours, autosave to `localStorage` |
| ⚔️ **This or That** | Answer head-to-head questions, get a full ranking | **Binary insertion sort**: ~n·log₂n questions instead of n(n−1)/2 (24 items: ~90 instead of 276). Ties & undo supported. Ranking → tiers as *pyramid*, *balanced* or *bell curve* |
| 📊 **Auto-tier** | Rank from real stats (NBA titles/MVPs, planet size/moons…) | Weight sliders → min-max / percentile / log normalisation → weighted 0–100 score → **Jenks natural breaks**, so tier borders fall where the real gaps are, not at arbitrary cut-offs |
| 🎯 **Compare** | How mainstream are you? | **Agreement %** (mean tier distance) + **Spearman ρ** vs. TierLab's reference or a friend's link, your **hottest takes**, and a personality verdict |

Also: share links that contain the **whole list in the URL** (deflate + base64url, no server, no database), PNG export drawn on `<canvas>`, JSON import/export, auto images from Wikipedia, TR/EN interface, custom lists (`Name | image-url` per line).

## Topics
NBA All-Time Greats (with stats) · EuroLeague Legends · Planets (with NASA stats) · Programming Languages · Data Engineering Tools · Turkish Breakfast · Turkish Street Food · Turkish Desserts · Legendary Video Games · Social Media Apps — or create your own.

## Tech
- **Zero dependencies, zero build step**: plain ES modules, HTML and CSS. Opens straight from GitHub Pages.
- Logic is split into pure, DOM-free modules (`algorithms.js`, `model.js`, `views.js`), so it is tested in Node.
- **28 tests** with Node's built-in runner, including a fake-DOM smoke test that drives the whole app through every mode.
- GitHub Actions: run tests on every push → deploy to GitHub Pages if they pass.

```
js/
├── algorithms.js   Jenks, normalisation, composite score, rank→tiers, Spearman, agreement, PairRanker
├── model.js        tier-list document: move/add/remove, share payload
├── share.js        URL encoding (CompressionStream deflate-raw + base64url)
├── topics.js       curated topics, stats and reference lists
├── views.js        pure HTML-string renderers (escaped)
├── i18n.js         TR / EN
└── app.js          DOM wiring: routing, drag & drop, keyboard, images, PNG export
```

## Run locally
```bash
python -m http.server 8000      # then open http://localhost:8000
node --test tests/*.test.js     # Node 20+
```

## Add a topic
Add an object to `TOPICS` in `js/topics.js`: `id`, `cat`, `emoji`, `title`/`desc` (tr + en), `items` (`name`, optional `en`, `wiki`, `note`, `stats`), optional `stats` spec and `reference` (best tier first). The tests check that every reference name exists and every stat is filled in.

## Roadmap
- [ ] Community average per topic (needs a tiny backend — e.g. Supabase)
- [ ] Head-to-head "Elo" mode with many voters
- [ ] More data topics: EuroLeague stats via the euroleague-api, Steam player counts from steam-oyuncu-takip

*Images come from Wikipedia / Wikimedia Commons. Stats are approximate; reference lists are opinions — that is the point.*
