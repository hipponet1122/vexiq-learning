**正體中文** · [English](../../README.md)

# VEX IQ 自學網站

給國小高年級到國中學生自學 **VEX IQ（第二代、VEXcode IQ Blocks）** 的網站：先用測驗找出程度，再依程度出題、
教組裝、教積木程式、教工程筆記，並提供網頁模擬器與比賽（目前季：Level Up 2026–2027）練習。
家長與教練可以看到孩子的練習狀況。

> 非官方專案，與 VEX Robotics／Innovation First／REC Foundation 無關。見 [`NOTICE.md`](NOTICE.md)。
> 介面有正體中文（台灣）與英文。歡迎老師、教練、家長一起改進 → [`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 功能
- **自適應出題**：6 個領域、29 個技能點、173 題（選擇／數值／排序／找錯）；定位測驗＋依熟練度練習、錯題回補。
- **防鬼打牆**：答錯先給提示再試一次、連錯跳出 30 秒重點小抄、回合結束專練類似題；模擬器連敗時逐層給提示並推薦過關後的小考。
- **網頁模擬器**：參照 VEXcode IQ Blocks（英文積木＋停留顯示中文、拖曳、感測器、我的積木、復原重做、
  Python／C++ 程式碼檢視、Brain 螢幕）。
- **上傳 VEXcode 存檔**（`.iqblocks`）：自動／遙控程式的模擬、逐步對照、提示與工程筆記草稿。
- **工程筆記**：7 課教學、7 種頁面、自我檢查清單、家長留言、可列印作品集。
- **挑戰、組裝教學與零件圖鑑、比賽專區**（當季規則整理、得分規劃器、可分項作答的計分練習、3D 算分挑戰、技能賽記錄、英中術語卡、面談練習）。
- **控制實驗室**（進階）：用互動小實驗看懂「走直線（P 控制）」「PID 轉向」「里程計與誤差累積」「角度繞回」「走到指定座標」「遙控方向鎖定」，全部自己從頭寫（授權說明見「學習資源」）。另有「台灣賽事路線」頁（VEX Taiwan Open 流程範例與參賽準備清單）。
- **引導與今日自動學習課表**：學員每次登入自動依已學會與待加強技能排定專屬課表（`#/plan`，可切換 15／30／45／60 分鐘與跨頁導引條）、5 大學習支柱自適應導覽、起步路徑、徽章與連續天數、家長說明與每週報告。
- **硬體零件與套件百科（`#/build/parts`）**：完整介紹 25 項 VEX IQ 核心電控、感測器、智慧線材、橡皮筋、氣動、結構傳動與基礎／進階競賽套件（含第 1 代 vs 第 2 代對照表），並支援 Three.js 互動 3D CAD 零件檢視器（`web/part3d.js`，自動高對比背景）。
- **三種角色**：學員、家長（管理）、教練（**唯讀**，只看被指派的學員）。
- **中英文介面**：右上角「中／EN」切換；題目、課文、挑戰與訊息都有英文版。
- **手機／平板友善**：手機底部分頁列、模擬器「積木／場地」分頁、iPad 直放與橫放的版面、輕巧的動畫（開啟「減少動態效果」時會關閉）。
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
web/about.js     關於頁與頁尾            web/blocktext.js 題目積木中文→英文            tools/build_info.py 產生 web/version.json
```

## 本機執行
```bash
pip install -r requirements.txt
python3 tools/make_seed.py               # 產生初始帳號（學員／家長）與一次性密碼檔
python3 tools/build_info.py              # 產生版本資訊（可略過）
DATA_DIR=./data python3 -m uvicorn server:app --port 8599
```
開 http://localhost:8599/ 。初始密碼在 `local/secrets/初始帳密.txt`（登入後請改掉並刪除該檔）。

## 自架（Docker）
```bash
python3 tools/make_seed.py && python3 tools/build_info.py
docker compose up -d --build            # 預設只綁 127.0.0.1:8518，資料放 ./data
```
請用反向代理（Nginx／Caddy／Cloudflare Tunnel）加上 **HTTPS** 再對外；並備份 `data/`（`vexiq.sqlite`）。
環境變數：`VEXIQ_PORT`、`VEXIQ_DATA`（資料夾）、`TRUST_CF_IP`（走 Cloudflare Tunnel 時設 `1`，才會用 `CF-Connecting-IP` 做登入限流）。容器啟動時會降權成 `/data` 資料夾的擁有者（`docker-entrypoint.sh`），不以 root 執行。家長登入後可在「家長頁」新增學員與教練。

## 給參與者
- 想幫忙：看 [`CONTRIBUTING.md`](CONTRIBUTING.md)、[`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md)、[`ROADMAP.md`](ROADMAP.md)、[`MAINTAINERS.md`](MAINTAINERS.md)，或找標籤 `good first issue` 的任務。
- 改題庫：`web/data.js`（積木寫法 `[下拉]` `(數字)` `<條件>`，行首兩格空白＝縮排）。
- 換季：更新 `web/content.js` 的 `SEASON` 與 `web/data.js` 的當季題，**用自己的話整理並附官方連結**。
- 發版：改 `VERSION` 與 `CHANGELOG.md`。

## 授權
程式碼 MIT（[`LICENSE`](../../LICENSE)）；教學與題庫內容 CC BY-SA 4.0（[`LICENSE-CONTENT.md`](LICENSE-CONTENT.md)）。
資安回報請看 [`SECURITY.md`](SECURITY.md)。作者：Elvis Huang <elvis@mingchhun.com>
