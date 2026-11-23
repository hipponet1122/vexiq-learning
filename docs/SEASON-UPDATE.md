# 每年換季更新流程

VEX IQ 每年（約 4～5 月）公布新的比賽主題與 Game Manual，規則也會在賽季中發布更新版（例如 v2.1）。
本站的「當季」內容要跟著更新。這份清單說明要改哪些檔案、怎麼驗證。

> **原則**
> 1. 以**官方最新版 Game Manual** 為準，用**自己的話**整理，**不要貼原文、不要放官方圖片**。
> 2. 每一個數字（分數、尺寸、數量、時間）都要能回到手冊的章節；題目的「解釋」欄寫出算式。
> 3. 整理不到的部分（場地精確尺寸、違規處罰、活動細則）**不要猜**，放連結請讀者看原文。
> 4. 換季的修改請走 Pull Request，並請有經驗的教練或老師審題（見 `MAINTAINERS.md`）。

## 一、準備（約 30 分鐘）
1. 取得官方最新版 Game Manual（本站 `SEASON.manual` 連結的位置）與版本日期。
2. 讀完：比賽形式（團隊賽／技能賽）、計分、得分物、機器人規定（尺寸、馬達數）、關鍵規則。
3. 開一個 Issue「換季：20XX–20YY 〈主題名〉」，列出下面各項的負責人。

## 二、要更新的檔案
| 檔案 | 要改什麼 |
|---|---|
| `web/content.js` → `SEASON` | 主題名 `name`、賽季 `season`、手冊版本 `version`、連結 `manual`、`objective`、`elements`（場地與得分物）、`formats`、`scoring`（分數表）、`colorRules`、`robot`、`rules`、`strategy` |
| `web/data.js` → 領域 F 的技能與題目 | 技能 `F1`（計分）、`F2`（得分規劃）、`F3`（規則與機器人規定）的 `name`／`lesson`，以及所有 `id` 以 `F` 開頭的題目：數字、答案、解釋都要重算 |
| `web/content.js` → `CHALLENGES` 中 `lu1`～`lu3` | 當季練習挑戰：場地示意、得分動作、參考解答 `code`、提示。**場地是示意，不是官方尺寸**，若手冊有附錄尺寸，可在確認後再改成實際比例 |
| `web/modules.js` 比賽專區 | 計分規劃器的得分項目（讀自 `SEASON.scoring`，通常不必改）、說明文字、官方資源連結（Competition 101 等） |
| `web/guide.js` | 「當季」相關的導覽與步驟文字 |
| `web/data.js` 檔頭註解、`README.md`／`README.zh-TW.md`、`ROADMAP.md`／`ROADMAP.zh-TW.md`、`NOTICE.md`／`NOTICE.zh-TW.md`、`web/about.js` | 季別與主題名稱字樣 |
| `tests/run.js` | 「當季計分」群組：分數表與算術題的期望值（這是防止改錯的保險） |
| `CHANGELOG.md`、`VERSION` | 新增一版，例如 `1.2.0 — 換季：…` |

> 找出所有地方的快速方法：`git grep -n "Level Up\|2026–2027\|26-27"`（換成舊賽季的名稱）。

## 三、驗證（全部要通過才合併）
```bash
python3 tools/check.py        # 簡體字、機密
node tests/run.js             # 題庫、計分算術、挑戰參考解答、模擬引擎
node tools/export_questions.js F   # 匯出領域 F 的審題清單，請教練逐題核對
```
並且：
- 本機開網站，走一遍：比賽專區 → 當季頁、得分規劃器、領域 F 練習、`lu1`～`lu3` 挑戰（用「看參考解答」確認能通過）。
- 請至少一位有經驗的教練或老師看過審題清單。
- 舊賽季的題目**不要直接刪掉**：若想保留，可移到 `web/archive/`（之後可做成「往年賽季」），或在 CHANGELOG 註明已移除。

## 四、發版
1. 更新 `CHANGELOG.md`、`VERSION`。
2. PR 合併後，由主維護者部署（見 `MAINTAINERS.md`）。
3. 部署後確認：關於頁版本、當季頁的手冊版本與日期、`/healthz`。

## 五、常見錯誤
- 只改了 `SEASON`，忘了改題庫裡的數字 → 測試會抓到計分算術不一致。
- 把手冊整段貼進來 → 違反版權，請改寫並附連結。
- 場地尺寸沒有依據就寫成「官方尺寸」→ 一律標「示意」。
- 賽季中手冊出新版（v2.1 → v2.2）→ 比對差異章節，只更新有變的部分，並更新 `SEASON.version`。
