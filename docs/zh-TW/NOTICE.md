**正體中文** · [English](../NOTICE.md)

# 聲明

- 本專案是**非官方**的個人學習工具，與 Innovation First International, Inc.、VEX Robotics、REC Foundation 無隸屬、贊助或背書關係。
- VEX、VEX IQ、VEXcode、Level Up 為其商標；僅用於說明本工具的對象，不代表官方。
- 當季規則、計分、機器人規定是依官方 Game Manual 用自己的話整理，**可能過時或有誤**；比賽請一律以官方最新版為準。
- 本專案**不包含**官方手冊原文、圖片、字型或 VEXcode 程式碼。介面是參考 VEXcode IQ 的風格重新實作。
- 模擬器是教學用的簡化物理，與實體機器人有差異；不保證跑得過的程式在真機一定成功。
- 請勿用本專案收集孩子的全名、學校、聯絡方式等個資。

## 第三方軟體

| 元件 | 版本 | 授權 | 位置 | 來源 |
| :--- | :--- | :--- | :--- | :--- |
| Three.js（3D 練習場與 3D 零件檢視器使用的 3D 引擎） | r147 | MIT（檔頭保留授權聲明） | `web/vendor/three.min.js` | https://threejs.org ／ https://github.com/mrdoob/three.js |
| Three.js GLTFLoader（選配本機 `.glb` 3D 模型載入器） | r147 | MIT | `web/vendor/GLTFLoader.js` | https://github.com/mrdoob/three.js |

本公開專案**不包含**任何 VEX 原廠 CAD 檔案；自架者可選擇於本機執行 `tools/convert_vex_cad.py` 將官方公開 `.STEP` 轉入 `web/models/`（已設 `.gitignore` 不進版控）。3D 練習場的場地與機器人為程式產生的**示意造型，非原廠 CAD**。
