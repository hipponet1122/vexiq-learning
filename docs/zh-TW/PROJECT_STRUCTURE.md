# 專案目錄結構與檔案整理規範

> English version: [`docs/PROJECT_STRUCTURE.md`](../PROJECT_STRUCTURE.md)

本文件規範 VEX IQ 自學網站各類檔案的擺放位置，讓專案隨著功能持續擴充依然保持乾淨、好找、好維護。

## 一、根目錄整理原則

根目錄只保留**專案標準設定檔、啟動／容器入口檔與頂層資料夾**，避免零散檔案堆積：

| 檔案／資料夾 | 用途 | 是否進 Git |
| :--- | :--- | :--- |
| `README.md`、`CHANGELOG.md`、`LICENSE`、`VERSION` | 專案說明、更新紀錄、授權與版號 | 是 |
| `server.py`、`requirements.txt` | FastAPI 後端主程式與 Python 相依套件 | 是 |
| `Dockerfile`、`docker-compose.yml`、`docker-entrypoint.sh`、`.dockerignore` | Docker 建置與啟動設定 | 是 |
| `.gitignore` | Git 忽略規則 | 是 |
| `web/` | 前端網站程式（純 HTML／CSS／JS，無 build step） | 是 |
| `docs/` | 公開文件（英文在 `docs/`，正體中文在 `docs/zh-TW/`） | 是 |
| `i18n/` | 多語系擷取清單（`i18n/src/`）與英文對照檔（`i18n/en/`） | 是 |
| `tests/` | 自動化測試框架與單元測試 | 是 |
| `tools/` | 開發、建置、翻譯、匯出與檢查用的指令列工具 | 是 |
| `.github/` | GitHub Actions CI 流程與 Issue 範本 | 是 |
| `data/` | 本機 SQLite 資料庫與學員照片 | **否**（`.gitignore`） |
| `local/` | 本機私用營運腳本、筆記、匯出報表與一次性密碼 | **否**（`.gitignore` 與 `.dockerignore`） |
| `seed_users.json` | 初始帳號雜湊檔（由 `tools/make_seed.py` 產生） | **否**（`.gitignore`） |

> **原則**：不要把臨時 `.md` 筆記、`.csv`／`.html` 匯出檔、`.txt` 密碼檔或零散腳本直接放在根目錄。

## 二、各資料夾分工規則

### `web/` — 前端應用
- 核心檔：`index.html`、`style.css`、`polish.css`、`app.js`、`data.js`、`content.js`
- 功能模組：每個主要功能獨立一個 JS 檔（如 `guide.js`、`sim.js`、`arena3d.js`、`pathplan.js`、`control.js`、`taiwan.js`、`iqimport.js`、`modules.js`、`extras.js`、`about.js`）
- 第三方函式庫：統一放 `web/vendor/`，並在 `docs/NOTICE.md` 註明來源與授權
- 自動產物：`web/i18n-en.js`（由 `python3 tools/i18n_build.py` 產生）、`web/version.json`（由 `python3 tools/build_info.py` 產生，不進版控）

### `tools/` — 開發與維護工具
所有獨立可執行的工具腳本統一放這裡：
- `tools/build_info.py`：讀取 `VERSION` 與 `CHANGELOG.md` 產生 `web/version.json`
- `tools/make_seed.py`：產生 `seed_users.json` 與 `local/secrets/初始帳密.txt`
- `tools/check.py`：提交前／CI 檢查（簡體字、不該入庫的檔案、疑似金鑰或內網 IP）
- `tools/i18n_extract.js`、`tools/i18n_todo.py`、`tools/i18n_build.py`：中英文翻譯管線
- `tools/export_questions.js`：匯出審題清單至 `local/exports/`

### `docs/` — 公開文件
- 英文公開文件放 `docs/`（如 `CONTRIBUTING.md`、`ROADMAP.md`、`SECURITY.md`、`PROJECT_STRUCTURE.md`）。
- 正體中文公開文件放 `docs/zh-TW/`。
- **絕不**將內網 IP、NAS 路徑、密碼或個資寫進 `docs/`。

### `local/` — 本機私用工作區（不進 Git、不進 Docker）
所有與個人電腦或公司環境綁定的檔案一律收納在 `local/`：
- `local/ops/`：本機一鍵部署與設定腳本（如 `.command`；開頭用 `cd "$(dirname "$0")/../.."` 切回專案根目錄）
- `local/notes/`：私用架構草稿、營運紀錄與測試筆記
- `local/exports/`：工具匯出的審題清單（HTML／CSV）等產物
- `local/secrets/`：一次性初始密碼等敏感文字檔（改完密碼即可刪除）

## 三、未來持續開發的延伸規則
1. **新增前端功能**：併入現有模組或新增 `web/<功能>.js`，同步加入 `web/index.html`、`tools/i18n_extract.js`、補齊 `i18n/en/` 英文翻譯並重建 `web/i18n-en.js`，同時在 `tests/run.js` 補測試。
2. **新增腳本工具**：公開工具放 `tools/`；與特定 NAS／個人環境相關的腳本放 `local/ops/`。
3. **新增公開文件**：放 `docs/`，面向使用者的文件同步維護 `docs/zh-TW/` 正體中文版。
4. **Docker 建置注意**：`.dockerignore` **只能使用純 ASCII 規則**（不可含中文檔名），以免部分 NAS Docker 建置失敗。
5. **每次提交前必跑驗證**：
   ```zsh
   for f in web/*.js; do node --check "$f"; done
   python3 -m py_compile server.py tools/build_info.py tools/make_seed.py tools/check.py
   node tests/run.js
   python3 tools/check.py
   ```
