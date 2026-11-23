/* 介面語言（繁體中文／English）。要放在所有其他 script 之前。
   做法：程式裡的文字維持中文；選英文時載入字典 i18n-en.js，在 DOM 出現文字時自動換成英文
   （精準比對整句，找不到就逐段比對）。字典由 tools/i18n_build.py 從 i18n/ 產生。 */
(function () {
  'use strict';
  const KEY = 'vexiq_lang';
  const ZH = /[一-鿿]/;
  let lang = 'zh';
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'zh') localStorage.setItem(KEY, q);
    const saved = localStorage.getItem(KEY);
    lang = saved === 'en' || saved === 'zh' ? saved : (/^zh/i.test(navigator.language || '') ? 'zh' : 'en');
  } catch (e) { lang = /^zh/i.test(navigator.language || '') ? 'zh' : 'en'; }
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';

  const api = window.VXI18N = {
    lang,
    setLang(l) {
      try { localStorage.setItem(KEY, l); } catch (e) { /* ignore */ }
      try {
        const u = new URL(location.href);
        if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); location.replace(u.toString()); return; }
      } catch (e) { /* ignore */ }
      location.reload();
    },
    tr: (s) => s, trHtml: (s) => s, rawPrompt: (m, d) => window.prompt(m, d),
  };
  /* 翻譯器：字典 D（中文→英文）。整句精準比對，不行就逐段比對。 */
  function makeTr(D) {
    const exact = D;
    // 逐段比對用：依第一個字分組，長的優先
    const idx = new Map();
    Object.keys(D).forEach((k) => { if (!k.trim()) return; const c = k[0]; (idx.get(c) || idx.set(c, []).get(c)).push(k); });
    idx.forEach((arr) => arr.sort((a, b) => b.length - a.length));
    // 單字片段（例如「分」「次」「秒」）只在前面是數字／空白、後面不是中文字時才換，避免把「分鐘」拆壞
    const okHit = (s, i, k) => {
      if (k.trim().length !== 1) return true;
      const prev = s[i - 1], next = s[i + k.length];
      return !!(prev && /[\d\s]/.test(prev)) && !(next && /[一-鿿]/.test(next));
    };
    // 逐段翻譯：用動態規劃找「換掉最多字」的切法，而不是從左到右搶最長的（否則「0 分」會搶走比它長的「 分　用掉時間：」）
    const frag = (s) => {
      const n = s.length;
      if (n > 1200) return fragGreedy(s);
      const best = new Array(n + 1).fill(-1), prev = new Array(n + 1);
      best[0] = 0;
      for (let i = 0; i < n; i++) {
        if (best[i] < 0) continue;
        if (best[i] > best[i + 1]) { best[i + 1] = best[i]; prev[i + 1] = [i, null]; }
        const arr = idx.get(s[i]); if (!arr) continue;
        for (const k of arr) {
          if (!s.startsWith(k, i) || !okHit(s, i, k)) continue;
          const j = i + k.length, v = best[i] + k.length;
          if (v > best[j]) { best[j] = v; prev[j] = [i, k]; }
        }
      }
      const parts = []; let j = n;
      while (j > 0) { const [i, k] = prev[j]; parts.push(k === null ? s[i] : D[k]); j = i; }
      return parts.reverse().join('');
    };
    const fragGreedy = (s) => {
      let out = '', i = 0; const n = s.length;
      while (i < n) {
        const arr = idx.get(s[i]); let hit = null;
        if (arr) for (const k of arr) { if (s.startsWith(k, i) && okHit(s, i, k)) { hit = k; break; } }
        if (hit) { out += D[hit]; i += hit.length; } else out += s[i++];
      }
      return out;
    };
    const tr = (s) => {
      if (typeof s !== 'string' || !ZH.test(s)) return s;
      if (exact[s] !== undefined) return exact[s];
      const t = s.trim();
      if (t !== s && exact[t] !== undefined) return s.slice(0, s.indexOf(t)) + exact[t] + s.slice(s.indexOf(t) + t.length);
      return frag(s);
    };
    const trHtml = (s) => (typeof s === 'string' && exact[s] !== undefined ? exact[s] : s);
    return { tr, trHtml, exact };
  }

  api.makeTr = makeTr;
  // app.js 等這個 Promise 再第一次畫面：英文字典與 innerHTML 攔截都就緒後才開始畫，課文才不會被當成零碎文字翻、也不會先閃一下中文
  let resolveReady = () => {};
  api.ready = new Promise((r) => { resolveReady = r; });
  if (lang !== 'en') { resolveReady(); return; }

  // 不用 document.write（慢速網路會被 Chrome 攔截）；動態載入字典並等 DOM 就緒再啟動
  let dictReady = !!window.VX_EN, domReady = document.readyState !== 'loading', started = false;
  const maybeStart = () => { if (!started && dictReady && domReady) { started = true; try { start(); } finally { resolveReady(); } } };
  if (!dictReady && typeof document.createElement === 'function') {
    const sc = document.createElement('script');
    const curSrc = (document.currentScript && document.currentScript.src) || '';
    const qv = (curSrc.match(/\?[^#]+/) || [''])[0];
    sc.src = 'i18n-en.js' + qv;
    sc.onload = sc.onerror = () => { dictReady = true; maybeStart(); };
    setTimeout(() => { if (!started) { dictReady = true; maybeStart(); } }, 4000); // 字典太久沒載到就先用空字典，網站照常可用
    (document.head || document.documentElement).appendChild(sc);
  }
  if (!domReady) document.addEventListener('DOMContentLoaded', () => { domReady = true; maybeStart(); });
  maybeStart();

  function start() {
    const D = window.VX_EN || {};
    const { tr, trHtml, exact } = makeTr(D);
    api.tr = tr;
    const exactDone = new WeakSet();
    // innerHTML：整段 HTML（課文）有字典就整段換並標記不再二次翻譯；尊重 data-notrans
    const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (desc && desc.set) Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: true, enumerable: desc.enumerable, get: desc.get,
      set(v) {
        if (!skipAttrEl(this) && typeof v === 'string' && exact[v] !== undefined) {
          const r = desc.set.call(this, exact[v]);
          this.childNodes.forEach((c) => exactDone.add(c)); // 只標記「這次換進去的」節點，之後容器裡加別的東西仍會正常翻譯
          return r;
        }
        return desc.set.call(this, v);
      },
    });
    api.trHtml = trHtml;

    const ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'value'];
    const isExactAnc = (n) => { for (let p = n; p; p = p.parentNode) if (exactDone.has(p)) return true; return false; };
    const skipEl = (el) => !el || (el.closest && el.closest('[data-notrans],textarea,script,style')) || isExactAnc(el); // 文字節點用
    const skipAttrEl = (el) => !el || (el.closest && el.closest('[data-notrans],script,style')); // 屬性（placeholder 等）用
    const doText = (node) => {
      const v = node.nodeValue; if (!v || !ZH.test(v)) return;
      if (skipEl(node.parentElement) || exactDone.has(node)) return;
      const r = tr(v); if (r !== v) node.nodeValue = r;
    };
    const doAttrs = (el) => {
      if (el.nodeType !== 1) return;
      for (const a of ATTRS) {
        if (a === 'value' && !(el.tagName === 'INPUT' && /^(button|submit)$/.test(el.type))) continue;
        const v = el.getAttribute(a); if (v && ZH.test(v) && !skipAttrEl(el)) { const r = tr(v); if (r !== v) el.setAttribute(a, r); }
      }
    };
    const walk = (root) => {
      if (root.nodeType === 3) return doText(root);
      if (root.nodeType !== 1) return;
      if (skipAttrEl(root) || exactDone.has(root)) return;
      doAttrs(root);
      const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let n; while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else if (!skipAttrEl(n)) doAttrs(n); }
    };
    const fixTitle = () => { if (ZH.test(document.title)) { const r = tr(document.title); if (r !== document.title) document.title = r; } };
    const mo = new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'childList') m.addedNodes.forEach(walk);
        else if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
      }
      fixTitle();
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    walk(document.body); fixTitle();
    const tm = document.querySelector('head > title'); if (tm) new MutationObserver(fixTitle).observe(tm, { childList: true, characterData: true, subtree: true });
    const meta = document.querySelector('meta[name=description]'); if (meta) { const r = tr(meta.content); if (r !== meta.content) meta.content = r; }
    // 瀏覽器內建對話框（保留原始 prompt 供含使用者帳號的確認框使用）
    const origPrompt = window.prompt;
    api.rawPrompt = (m, d) => origPrompt.call(window, m, d);
    const wrap = (name) => { const f = window[name]; if (typeof f === 'function') window[name] = (m, ...r) => f.call(window, tr(String(m)), ...r); };
    ['alert', 'confirm', 'prompt'].forEach(wrap);
    resolveReady();
  }
})();
