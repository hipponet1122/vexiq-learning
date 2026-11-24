[正體中文](zh-TW/LESSONS.md) · **English**

# Writing and reviewing skill lessons

Each of the 29 skills has a lesson in `web/lessons-a.js` (A, B), `web/lessons-b.js` (C, D) and `web/lessons-c.js` (E, F). The engine is `web/learn.js`. The flow is **guess → understand → try it → quick check → hands-on**, then the practice questions.

## Shape of a lesson
```js
W.B3 = {
  min: 10,                                   // minutes (5–15)
  guess: { q, opts, a, why },                // optional warm-up guess (a = index of the right option)
  cards: [{ t, b, tip?, warn?, svg? }],      // 3–4 "understand it" cards; b is trusted HTML
  lab: { type, ask, ... } | [ ... ],         // interactive widget(s), see below
  check: [ Q(q, opts, a, why, code?) ×3 ],   // quick check; pass = at least 2 of 3 right
  doit: { t, why?, steps, note, links },     // hands-on task and what to write in the notebook
  extra: '<p>…</p>',                         // optional "going further" (shown at mid/high mastery)
};
```

## Widgets (`lab.type`)
| type | What the learner does | Key fields |
|---|---|---|
| `calc` | Moves sliders/selects and sees live results | `params`, `outs` (functions), optional `viz` (returns SVG text) |
| `walk` | Builds a forward/turn program and sees the robot's path | `start`, `rep`, `noRep` |
| `trace` | Steps through code and watches variables | `code` (lines), `steps` (`line`, `vars`, `note`) |
| `match` | Matches terms to descriptions | `pairs` |
| `order` | Clicks steps in the right order | `steps` |

## Rules for authors
- Plain, kid-friendly Traditional Chinese (Taiwan wording); one idea per card; a real-life example before the rule.
- Put every number a question needs in the question itself; never depend on a specific part's real spec (use "illustrative" in the label when a number is made up).
- Block text follows the site style, for example `驅動 [向前] 為 (200) [毫米]`. Do not start ordinary sentences with a block word (such as 設定, 重複, 等待, 將) while also containing brackets — the translation extractor treats those as code and skips them.
- In SVG text and other concatenated strings, keep each Chinese phrase as its own string literal so it can be translated.
- Facts need a source (the official manual or the VEX knowledge base). Rules for the current season must match `SEASON` in `web/content.js`.
- After changing text run `node tools/i18n_extract.js`, translate what `python3 tools/i18n_todo.py <area>` lists into `i18n/en/<area>.tsv`, then `python3 tools/i18n_build.py` and `node tests/run.js`.

## How progress is stored
`state.lrn[skillId] = { s, d, c, w }`: furthest step reached (1–5), date passed, best quick-check score, total wrong answers. It is small on purpose (the server keeps a 100 KB limit on a learner's state).
