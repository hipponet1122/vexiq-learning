# 如何參與

歡迎教練、老師、家長、學生一起改進！你不一定要會寫程式——**題目有錯、說明看不懂、規則過時**，開一個 Issue 就是很大的幫助。

## 可以幫忙的事
| 類型 | 說明 |
|---|---|
| 🧪 審題 | 檢查 `web/data.js` 的題目、答案、解釋是否正確、孩子看得懂（最需要！） |
| 📅 換季更新 | 依官方最新 Game Manual 更新 `web/content.js` 的 `SEASON` 與 `web/data.js` 當季題 |
| 🐛 修 bug | 模擬器、`.iqblocks` 匯入、介面 |
| 🌏 內容 | 新的挑戰、組裝課、術語卡、評審面談題 |
| ♿ 體驗 | 平板／手機版型、無障礙、用字 |

## 流程
1. 先開 Issue 說明想做什麼（小修正可直接 PR）。
2. Fork → 新分支 → 修改 → 本機測試（`README.md` 的「本機執行」）。
3. 發 Pull Request，說明「改了什麼、為什麼」。**題目的修改請附依據**（官方文件連結或計算）。
4. 維護者審查後合併。`main` 分支只由維護者合併與部署。

## 規範
- **繁體中文（台灣用語）**，不要混入簡體字。英文專有名詞（VEXcode 積木名稱）照官方英文。
- 不貼官方手冊／STEM Labs 的原文，請用自己的話並附連結。
- 前端是無框架、無 build step 的純 JavaScript，請維持這個風格，不要引入打包工具。
- 不要提交 `seed_users.json`、`data/`、`.env`、密碼或任何個資。
- 內容貢獻視同以 CC BY-SA 4.0、程式碼視同以 MIT 授權（見 `LICENSE-CONTENT.md`）。

## 提交前先自我檢查
```bash
python3 tools/check.py     # 簡體字、不該入庫的檔案、疑似金鑰（CI 也會跑）
for f in web/*.js; do node --check "$f"; done
```

方向與分工見 [`ROADMAP.md`](ROADMAP.md)、[`MAINTAINERS.md`](MAINTAINERS.md)；想找任務請看標籤 `good first issue`。

請先讀 [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)。
