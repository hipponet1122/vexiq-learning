/* 無障礙補強：自動補欄位標籤、星星與圖示的文字說明、「跳到主要內容」連結。
   畫面是用 JavaScript 動態產生的，所以用 MutationObserver 在每次畫面更新後補一次。 */
(function () {
  'use strict';
  const LABEL = { impch: '選擇挑戰', impkind: '程式種類' };
  function fix(root) {
    root.querySelectorAll('input,select,textarea').forEach((e) => {
      if (e.type === 'hidden' || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.title) return;
      if (e.id && root.querySelector('label[for="' + e.id + '"]')) return;
      if (e.closest('label')) return;
      const t = e.placeholder || LABEL[e.id] || (e.type === 'file' ? '選擇 VEXcode 存檔（.iqblocks）' : e.type === 'checkbox' ? (e.parentElement && e.parentElement.textContent.trim()) : '');
      if (t) e.setAttribute('aria-label', t);
    });
    root.querySelectorAll('.stars').forEach((e) => {
      if (e.getAttribute('role')) return;
      const txt = e.textContent;
      if (/[★☆]/.test(txt)) { const n = (txt.match(/★/g) || []).length; e.setAttribute('role', 'img'); e.setAttribute('aria-label', '熟練度 ' + n + ' 顆星（滿分 3 顆）'); }
    });
    root.querySelectorAll('button:not([aria-label]),a[href]:not([aria-label])').forEach((e) => {
      if (!e.textContent.trim() && e.title) e.setAttribute('aria-label', e.title);
    });
    root.querySelectorAll('svg.radar').forEach((e) => { if (!e.getAttribute('role')) { e.setAttribute('role', 'img'); e.setAttribute('aria-label', '各領域熟練度雷達圖'); } });
  }
  function skip() {
    if (document.getElementById('skiplink')) return;
    const a = document.createElement('a');
    a.id = 'skiplink'; a.className = 'skiplink'; a.href = '#'; a.textContent = '跳到主要內容';
    a.addEventListener('click', (ev) => { ev.preventDefault(); const m = document.querySelector('main,.wrap,.fullwrap'); if (m) { m.setAttribute('tabindex', '-1'); m.focus(); } });
    document.body.prepend(a);
  }
  function start() {
    const app = document.getElementById('app'); if (!app) return;
    skip(); fix(app);
    let busy = false;
    new MutationObserver(() => { if (busy) return; busy = true; requestAnimationFrame(() => { fix(app); busy = false; }); }).observe(app, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
