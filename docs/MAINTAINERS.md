[正體中文](zh-TW/MAINTAINERS.md) · **English**

# Maintainers and Governance

## Roles
| Role | Can do | How to become one |
|---|---|---|
| **Contributor** | Open Issues, send Pull Requests, join discussions | Anyone |
| **Question reviewer** | Review PRs to the question bank and season rules (`web/data.js`, `web/content.js`); needs VEX IQ teaching or competition experience | Invited by the lead maintainer |
| **Maintainer** | Review and merge PRs, triage Issues and labels | Sustained contributions and review (about 5+ merged PRs), invited by the lead maintainer |
| **Lead maintainer** | All of the above, plus **deploying to production**, repository settings and licensing | Elvis Huang (@hipponet1122) |

## Principles
1. **Only the lead maintainer can deploy.** Production holds children's learning data; maintainers and contributors do not touch the production site, database or accounts.
2. **Questions need sources.** Question changes include a link to the official document or the calculation; no source, no merge.
3. **Every PR needs at least one approving reviewer**, and question/rule changes also need a question reviewer (see `.github/CODEOWNERS`). The automated check (`tools/check.py`) must pass.
4. **No personal data.** Never post a child's name, photo, school or contact details anywhere.
5. **Be kind.** Follow `CODE_OF_CONDUCT.md`; be patient with beginners.
6. For major decisions (license, scope of data collection, architecture), open an Issue first and wait at least 7 days.

## Inviting maintainers
The lead maintainer invites via Issue or message → the person agrees to follow this document and the code of conduct → first **Triage** permission (Issue management), then **Write** once familiar. Admin permission is not granted.

## Stepping down
Maintainers may leave at any time; after 6 months of inactivity we will ask first and then adjust permissions. This is not a penalty.

Contact: elvis@mingchhun.com
