[正體中文](zh-TW/CONTRIBUTING.md) · **English**

# Contributing

Coaches, teachers, parents and students are all welcome! You do not need to write code — **a wrong question, a confusing explanation, or an outdated rule**: opening an Issue is a big help.

## Ways to help
| Type | Description |
|---|---|
| 🧪 Question review | Check the questions, answers and explanations in `web/data.js` for correctness and clarity for kids (most needed!) |
| 📅 Season update | Update `SEASON` in `web/content.js` and the season questions in `web/data.js` from the latest official Game Manual |
| 🐛 Bug fixes | Simulator, `.iqblocks` import, UI |
| 🌏 Content | New challenges, build lessons, term cards, judge-interview questions |
| ♿ Experience | Tablet/phone layout, accessibility, wording |

## Workflow
1. Open an Issue describing what you want to do (small fixes can go straight to a PR).
2. Fork → new branch → change → test locally (see "Run locally" in `README.md`).
3. Open a Pull Request explaining what changed and why. **Question changes need a source** (a link to the official document, or the calculation).
4. A maintainer reviews and merges. Only maintainers merge and deploy `main`.

## Rules
- **Traditional Chinese (Taiwan wording)** for the interface; no Simplified Chinese. VEXcode block names stay in official English.
- Do not paste text from the official manual or STEM Labs; write in your own words and link to it.
- The front end is plain JavaScript with no framework and no build step. Please keep it that way and do not add bundlers.
- Never commit `seed_users.json`, `data/`, `.env`, passwords or any personal data.
- Contributions are licensed under CC BY-SA 4.0 (content) and MIT (code); see `LICENSE-CONTENT.md`.

## Translating the interface
The code keeps Chinese strings; English comes from a dictionary. To add or fix a translation: run `node tools/i18n_extract.js` (lists every Chinese string), find the string with `python3 tools/i18n_todo.py <area>`, add `hash|English` to `i18n/en/<area>.tsv`, then run `python3 tools/i18n_build.py` to regenerate `web/i18n-en.js`. `node tests/run.js` checks that nothing is missing.

## Self-check before submitting
```bash
python3 tools/check.py     # Simplified Chinese, files that must not be committed, suspected keys (CI runs this too)
node tests/run.js          # question bank, challenge solutions, simulator engine, .iqblocks import (no packages needed)
for f in web/*.js; do node --check "$f"; done
```

For reviewing questions: `node tools/export_questions.js D F` produces a phone-friendly review list. Season updates: see [`docs/SEASON-UPDATE.md`](SEASON-UPDATE.md).

Direction and roles: [`ROADMAP.md`](ROADMAP.md), [`MAINTAINERS.md`](MAINTAINERS.md). Looking for a task? Check the `good first issue` label.

Please read [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) first.
