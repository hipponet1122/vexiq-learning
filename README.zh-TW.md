**繁體中文** · [English](README.md)

# VEX IQ 自學網站

給國小高年級到國中學生自學 **VEX IQ（第二代、VEXcode IQ Blocks）** 的網站：先用測驗找出程度，再依程度出題、
教組裝、教積木程式、教工程筆記，並提供網頁模擬器與比賽（目前季：Level Up 2026–2027）練習。
家長與教練可以看到孩子的練習狀況。

> 非官方專案，與 VEX Robotics／Innovation First／REC Foundation 無關。見 [`NOTICE.zh-TW.md`](NOTICE.zh-TW.md)。
> 繁體中文（台灣）為主。歡迎老師、教練、家長一起改進 → [`CONTRIBUTING.zh-TW.md`](CONTRIBUTING.zh-TW.md)。

## 功能
- **自適應出題**：6 個領域、26 個技能點、138 題（選擇／數值／排序／找錯）；定位測驗＋依熟練度練習、錯題回補。
- **防鬼打牆**：答錯先給提示再試一次、連錯跳出 30 秒重點小抄、回合結束專練類似題；模擬器連敗時逐層給提示並推薦過關後的小考。
- **網頁模擬器**：參照 VEXcode IQ Blocks（英文積木＋停留顯示中文、拖曳、感測器、我的積木、復原重做、
  Python／C++ 程式碼檢視、Brain 螢幕）。
- **上傳 VEXcode 存檔**（`.iqblocks`）：自動／遙控程式的模擬、逐步對照、提示與工程筆記草稿。
- **工程筆記**：7 課教學、7 種頁面、自我檢查清單、家長留言、可列印作品集。
- **挑戰、組裝教學與零件圖鑑、比賽專區**（當季規則整理、得分規劃器、技能賽記錄、英中術語卡、面談練習）。
- **引導**：今日任務、起步路徑、徽章與連續天數、家長使用說明與每週學習報告。
- **三種角色**：學員、家長（管理）、教練（**唯讀**，只看被指派的學員）。
- **版本資訊**：頁尾與 `#/about` 顯示版本、Git 提交代號、更新時間、作者聯絡；`/healthz` 健康檢查。

## 技術
FastAPI + SQLite（單一 worker）＋ 無框架、無 build step 的純 JavaScript（`web/`）。密碼 PBKDF2、登入失敗限流、
不使用第三方追蹤；不被搜尋引擎收錄（`robots.txt`、`X-Robots-Tag`）。

```
server.py        後端 API 與靜態檔
web/data.js      技能地圖與題庫          web/content.js  課程、挑戰、當季規則
web/app.js       路由、登入、練習、家長頁   web/sim.js      模擬器
web/iqimport.js  .iqblocks 匯入          web/guide.js    引導、徽章
web/modules.js   筆記、挑戰、組裝、比賽、資源   web/extras.js   週報、作品集、題庫審閱
web/about.js     關於頁與頁尾            web/blocktext.js 題目積木中文→英文            build_info.py   產生 web/version.json
```

## 本機執行
```bash
pip install -r requirements.txt
python3 make_seed.py                     # 產生初始帳號（學員／家長）與一次性密碼檔
python3 build_info.py                    # 產生版本資訊（可略過）
DATA_DIR=./data python3 -m uvicorn server:app --port 8599
```
開 http://localhost:8599/ 。初始密碼在 `初始帳密.txt`（登入後請改掉並刪除該檔）。

## 自架（Docker）
```bash
python3 make_seed.py && python3 build_info.py
docker compose up -d --build            # 預設只綁 127.0.0.1:8518，資料放 ./data
```
請用反向代理（Nginx／Caddy／Cloudflare Tunnel）加上 **HTTPS** 再對外；並備份 `data/`（`vexiq.sqlite`）。
環境變數：`VEXIQ_PORT`、`VEXIQ_DATA`（資料夾）、`TRUST_CF_IP`（走 Cloudflare Tunnel 時設 `1`，才會用 `CF-Connecting-IP` 做登入限流）。容器啟動時會降權成 `/data` 資料夾的擁有者（`docker-entrypoint.sh`），不以 root 執行。家長登入後可在「家長頁」新增學員與教練。

## 給參與者
- 想幫忙：看 [`CONTRIBUTING.zh-TW.md`](CONTRIBUTING.zh-TW.md)、[`ROADMAP.zh-TW.md`](ROADMAP.zh-TW.md)、[`MAINTAINERS.zh-TW.md`](MAINTAINERS.zh-TW.md)，或找標籤 `good first issue` 的任務。
- 改題庫：`web/data.js`（積木寫法 `[下拉]` `(數字)` `<條件>`，行首兩格空白＝縮排）。
- 換季：更新 `web/content.js` 的 `SEASON` 與 `web/data.js` 的當季題，**用自己的話整理並附官方連結**。
- 發版：改 `VERSION` 與 `CHANGELOG.md`。

## 授權
程式碼 MIT（[`LICENSE`](LICENSE)）；教學與題庫內容 CC BY-SA 4.0（[`LICENSE-CONTENT.zh-TW.md`](LICENSE-CONTENT.zh-TW.md)）。
資安回報請看 [`SECURITY.zh-TW.md`](SECURITY.zh-TW.md)。作者：Elvis Huang <elvis@mingchhun.com>
