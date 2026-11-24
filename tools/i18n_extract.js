#!/usr/bin/env node
/* 擷取全站要翻譯的中文字串 → i18n/src/*.tsv（id<TAB>中文）。
   A. 資料檔（data.js／content.js）：用跟瀏覽器相同的載入流程，走訪所有字串（鍵是「執行時」的字串）。
   B. 介面程式：取出 JS 字串字面量（拆成片段，翻譯器會逐段比對）。 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ZH = /[一-鿿]/;
const out = {};
const add = (area, s) => {
  if (!ZH.test(s)) return;
  // SVG 插圖：只擷取裡面的文字標籤（逐段翻譯），不把整段 SVG 當鍵
  if (/^\s*<svg/.test(s)) { for (const m of s.matchAll(/>([^<>]*[\u4e00-\u9fff][^<>]*)</g)) add(area, m[1]); return; }
  (out[area] = out[area] || new Set()).add(s);
};

/* ---- A. 資料 ---- */
const { load } = require('../tests/harness');
function loadData() {
  const noop = () => {};
  const VX = { h: noop, shell: noop, blocksEl: noop, oneBlock: noop, toast: noop, api: async () => ({}), routes: {}, user: null };
  const win = { VX, innerWidth: 1000, innerHeight: 800, addEventListener: noop, location: { hash: '' } };
  const sandbox = { window: win, console, document: { addEventListener: noop, body: {} }, setTimeout, clearTimeout, performance, Math, JSON };
  win.window = win; sandbox.globalThis = sandbox; vm.createContext(sandbox);
  const names = {};
  for (const f of ['data.js', 'content.js']) {
    const src = fs.readFileSync(path.join(ROOT, 'web', f), 'utf8');
    names[f] = [...src.matchAll(/^(?:const|let|var) ([A-Za-z_]\w*)\s*=/gm)].map((m) => m[1]);
  }
  const run = (f, tail) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'web', f), 'utf8') + (tail || ''), sandbox, { filename: f });
  run('data.js', ';window.__d={' + names['data.js'].join(',') + '};');
  run('content.js', ';window.__c={' + names['content.js'].join(',') + '};');
  run('blocktext.js');
  return { d: win.__d, c: win.__c, win };
}
const { d, c, win } = loadData();
// 跟 app.js 一樣先把題目／課文／挑戰裡的積木字樣改成 VEXcode 英文，字典的鍵才會跟執行時的字串一致
win.VXEN.localize(d.QS); win.VXEN.localizeDeep(d.SKILLS); win.VXEN.localizeDeep(c.CHALLENGES);
const SKIP = new Set(['code', 'starter', 'path']);
const DSL = /^\s*(何時開始|重複|永遠|而|如果|別的|否則|驅動|旋轉|等待|停止|將|在螢幕|播放|校準|重設|設定|等到|休息|我的積木)/;
function walk(area, o, key) {
  if (typeof o === 'string') { if (!(key && SKIP.has(key) && !(area === 'content-PARTS' && key === 'code'))) add(area, o); return; }
  if (Array.isArray(o)) { o.forEach((v) => walk(area, v, key)); return; }
  if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (SKIP.has(k) && !(area === 'content-PARTS' && k === 'code')) continue; walk(area, o[k], k); } // 零件的 code 欄位是說明文字，不是積木
}
for (const [k, v] of Object.entries(d)) walk('data-' + k, v);
for (const [k, v] of Object.entries(c)) walk('content-' + k, v);

/* ---- B. 介面程式（字串字面量） ---- */
function literals(src) {
  const res = []; let i = 0; const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (ch === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); if (i < 0) break; i += 2; continue; }
    if (ch === "'" || ch === '"') {
      let j = i + 1, s = '';
      while (j < n && src[j] !== ch && src[j] !== '\n') { if (src[j] === '\\') { const e = src[j + 1]; s += e === 'n' ? '\n' : e; j += 2; } else s += src[j++]; }
      res.push(s); i = j + 1; continue;
    }
    if (ch === '`') {
      let j = i + 1, s = '';
      while (j < n && src[j] !== '`') { if (src[j] === '\\') { s += src[j + 1]; j += 2; } else if (src[j] === '$' && src[j + 1] === '{') { let dp = 1; j += 2; while (j < n && dp) { if (src[j] === '{') dp++; else if (src[j] === '}') dp--; j++; } res.push(s); s = ''; } else s += src[j++]; }
      res.push(s); i = j + 1; continue;
    }
    if (ch === '/' ) { // 可能是正規表示式：用前一個非空白字元猜
      let k = i - 1; while (k >= 0 && /\s/.test(src[k])) k--;
      if (k < 0 || /[(,=:[!&|?{};]/.test(src[k]) || /(return|typeof)$/.test(src.slice(Math.max(0, k - 6), k + 1))) {
        let j = i + 1, cls = false; while (j < n && (src[j] !== '/' || cls) && src[j] !== '\n') { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; j++; }
        i = j + 1; continue;
      }
    }
    i++;
  }
  return res;
}
const UI = ['app.js', 'modules.js', 'guide.js', 'extras.js', 'sim.js', 'arena3d.js', 'pathplan.js', 'control.js', 'taiwan.js', 'iqimport.js', 'about.js', 'a11y.js'];
for (const f of UI) {
  const src = fs.readFileSync(path.join(ROOT, 'web', f), 'utf8');
  for (const s of literals(src)) { const t = s.trim(); if (t && ZH.test(t) && !(DSL.test(t) && /[\[(<（]/.test(t))) add('ui-' + f.replace('.js', ''), t.length === s.length ? s : s); }
}
// 後端訊息與頁面
const py = fs.readFileSync(path.join(ROOT, 'server.py'), 'utf8');
for (const m of py.matchAll(/(?:err|return err)\(\s*f?"([^"]*[一-鿿][^"]*)"/g)) add('server', m[1]);
const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
for (const m of html.matchAll(/>([^<>]*[一-鿿][^<>]*)<|content="([^"]*[一-鿿][^"]*)"/g)) add('page', (m[1] || m[2]).trim());

fs.mkdirSync(path.join(ROOT, 'i18n/src'), { recursive: true });
let total = 0;
for (const [area, set] of Object.entries(out)) {
  const arr = [...set];
  fs.writeFileSync(path.join(ROOT, 'i18n/src', area + '.json'), JSON.stringify(arr, null, 0));
  console.log(area.padEnd(22), String(arr.length).padStart(5), String(arr.reduce((a, s) => a + s.length, 0)).padStart(8));
  total += arr.length;
}
console.log('total', total);
