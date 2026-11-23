[繁體中文](README.zh-TW.md) · **English**

# VEX IQ Self-Study Site

A website for upper-elementary to middle-school students to teach themselves **VEX IQ (2nd generation, VEXcode IQ Blocks)**. A placement quiz finds the learner's level, then the site adapts: practice questions, build lessons, block programming, engineering notebook coaching, a web simulator, and competition practice (current season: Level Up 2026–2027). Parents and coaches can see how the child is doing.

> Unofficial project. Not affiliated with VEX Robotics, Innovation First or the REC Foundation. See [`NOTICE.md`](NOTICE.md).
> The interface is in Traditional Chinese (Taiwan). Teachers, coaches and parents are welcome to help → [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Features
- **Adaptive practice**: 6 domains, 26 skills, 138 questions (multiple choice / numeric / ordering / find-the-bug); placement quiz, mastery-based practice, and re-practice of missed questions.
- **Anti-frustration loop**: on a wrong answer the learner gets a hint and a second try; two misses in a skill pop up a 30-second cheat sheet; each round ends with a "practice similar questions" option. In the simulator, repeated failures reveal challenge hints step by step and suggest a follow-up quiz after a pass.
- **Web simulator** modeled on VEXcode IQ Blocks (English blocks with Chinese tooltips, drag and drop, sensors, My Blocks, undo/redo, Python/C++ code view, Brain screen).
- **Upload VEXcode files** (`.iqblocks`): simulate autonomous/driver-control programs, step-by-step comparison, hints and engineering notebook drafts.
- **Engineering notebook**: 7 lessons, 7 page types, self-check lists, parent comments, printable portfolio.
- **Challenges, build lessons with a parts catalog, competition zone** (season rules summary, score planner, skills-run log, English–Chinese term cards, interview practice).
- **Guidance**: daily task, starter path, badges and streaks, parent guide and weekly report.
- **Three roles**: learner, parent (admin), coach (**read-only**, sees only assigned learners).
- **Version info**: version, Git commit, update time and author contact in the footer and `#/about`; `/healthz` health check.

## Tech
FastAPI + SQLite (single worker) and plain JavaScript with no framework and no build step (`web/`). PBKDF2 passwords, login rate limiting, no third-party tracking, and not indexed by search engines (`robots.txt`, `X-Robots-Tag`).

```
server.py        backend API and static files
web/data.js      skill map and question bank     web/content.js  lessons, challenges, season rules
web/app.js       routing, login, practice, parent pages   web/sim.js  simulator
web/iqimport.js  .iqblocks import                web/guide.js    guidance, badges
web/modules.js   notebook, challenges, build, competition, resources   web/extras.js  weekly report, portfolio, question review
web/about.js     about page and footer           web/blocktext.js  block text zh→en            build_info.py  writes web/version.json
```

## Run locally
```bash
pip install -r requirements.txt
python3 make_seed.py                     # creates the starter accounts (learner / parent) and a one-time password file
python3 build_info.py                    # writes version info (optional)
DATA_DIR=./data python3 -m uvicorn server:app --port 8599
```
Open http://localhost:8599/. The starter passwords are in `初始帳密.txt` (change them after logging in and delete that file).

## Self-host (Docker)
```bash
python3 make_seed.py && python3 build_info.py
docker compose up -d --build            # binds 127.0.0.1:8518 by default, data in ./data
```
Put it behind a reverse proxy (Nginx / Caddy / Cloudflare Tunnel) with **HTTPS** before exposing it, and back up `data/` (`vexiq.sqlite`).
Environment variables: `VEXIQ_PORT`, `VEXIQ_DATA` (data folder), and `TRUST_CF_IP` (set to `1` behind a Cloudflare Tunnel so `CF-Connecting-IP` is used for login rate limiting). The container drops privileges to the owner of `/data` (`docker-entrypoint.sh`) and does not run as root. After logging in, parents can add learners and coaches on the parent page.

## For contributors
- Want to help? See [`CONTRIBUTING.md`](CONTRIBUTING.md), [`ROADMAP.md`](ROADMAP.md), [`MAINTAINERS.md`](MAINTAINERS.md), or look for issues labeled `good first issue`.
- Editing questions: `web/data.js` (block syntax: `[dropdown]` `(number)` `<condition>`; two leading spaces = one indent level).
- New season: update `SEASON` in `web/content.js` and the season questions in `web/data.js`. **Write in your own words and link to the official source.**
- Releasing: update `VERSION` and `CHANGELOG.md`.

## License
Code: MIT ([`LICENSE`](LICENSE)). Teaching content and question bank: CC BY-SA 4.0 ([`LICENSE-CONTENT.md`](LICENSE-CONTENT.md)).
Security reports: see [`SECURITY.md`](SECURITY.md). Author: Elvis Huang <elvis@mingchhun.com>
