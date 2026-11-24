/* 讓瀏覽器用的 JS 檔（無 build step）能在 Node 載入測試：用最小的假 window／DOMParser。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

// 最小 XML 解析（只夠讀 Blockly XML：標籤、屬性、文字）
function parseXml(text) {
  const root = { localName: '#doc', attrs: {}, children: [], textContent: '', parent: null };
  const mk = (name, parent) => ({
    localName: name, attrs: {}, children: [], textContent: '', parent,
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    get attributes() { return Object.keys(this.attrs).map((k) => ({ name: k, value: this.attrs[k] })); },
  });
  const re = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
  let cur = root, m;
  const dec = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  while ((m = re.exec(text))) {
    if (m[5] !== undefined) { cur.textContent += dec(m[5]); continue; }
    if (m[1]) { const done = cur; cur = cur.parent || root; cur.textContent += done.textContent; continue; }
    const el = mk(m[2], cur);
    for (const a of m[3].matchAll(/([\w:.-]+)="([^"]*)"/g)) el.attrs[a[1]] = dec(a[2]);
    cur.children.push(el);
    if (!m[4]) cur = el;
  }
  return { documentElement: root.children[0], querySelector: () => null };
}

function load() {
  const noop = () => {};
  const VX = { h: noop, shell: noop, blocksEl: noop, oneBlock: noop, toast: noop, api: async () => ({}), routes: {}, user: null, todayStr: () => '2026-11-24' };
  const win = { VX, innerWidth: 1000, innerHeight: 800, addEventListener: noop, location: { hash: '' } };
  const sandbox = { window: win, console, DOMParser: function () { this.parseFromString = parseXml; }, document: { addEventListener: noop, body: {} }, setTimeout, clearTimeout, performance, Math, JSON };
  win.window = win; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const run = (f, tail) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'web', f), 'utf8') + (tail || ''), sandbox, { filename: f });
  run('data.js', ';window.__data={QS,SKILLS,DOMAINS};');
  run('content.js', ';window.__content={CHALLENGES,SEASON,BUILD_LAB_CATS,BUILD_LABS,PARTS};');
  run('blocktext.js');
  run('sim.js');
  run('iqimport.js');
  run('control.js');
  run('guide.js');
  return { VX, VXEN: win.VXEN, data: win.__data, content: win.__content };
}
module.exports = { load, ROOT };
