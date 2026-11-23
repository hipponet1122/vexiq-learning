/* 動畫與互動回饋：換頁淡入、按鈕波紋、彩帶、數字跳動。沒有它網站照常運作；「減少動態效果」時只做必要的事。 */
(function () {
  'use strict';
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $app = document.getElementById('app');
  const fx = {};

  /* 換頁：只讓頁面主內容淡入，絕不動到 .topbar 與手機底部固定選單列（避免閃爍與位移） */
  if ($app && !reduce) {
    let last = null;
    new MutationObserver(() => {
      const root = $app.firstElementChild;
      if (!root || root === last) return;
      last = root;
      const target = root.querySelector('.wrap, .layout, .fullwrap') || root;
      if (target === root && root.querySelector('.topbar')) return;
      target.classList.remove('page-in'); void target.offsetWidth; target.classList.add('page-in');
    }).observe($app, { childList: true });
  }

  /* 按鈕波紋 */
  if (!reduce) document.addEventListener('pointerdown', (e) => {
    const t = e.target.closest && e.target.closest('.btn, .lg-go, .opt, .tab');
    if (!t || t.disabled) return;
    const r = t.getBoundingClientRect(), d = Math.max(r.width, r.height);
    const s = document.createElement('span'); s.className = 'ripple';
    s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    if (getComputedStyle(t).position === 'static') t.style.position = 'relative';
    t.style.overflow = 'hidden'; t.append(s); setTimeout(() => s.remove(), 600);
  }, { passive: true });

  /* 彩帶：fx.confetti() 從畫面上方撒下；fx.confetti(x, y) 從指定位置噴出 */
  const COLORS = ['#f2cd16', '#0875e2', '#1f9d55', '#f2a579', '#bf9dee', '#73c7ca', '#d33a3a'];
  fx.confetti = function (x, y, n) {
    if (reduce || !document.body.animate) return;
    n = n || 46;
    const W = window.innerWidth, H = window.innerHeight, fromTop = x == null;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i'); p.className = 'confetti-piece';
      p.style.background = COLORS[i % COLORS.length];
      const sx = fromTop ? Math.random() * W : x, sy = fromTop ? -20 : y;
      p.style.left = sx + 'px'; p.style.top = sy + 'px';
      document.body.append(p);
      const dx = fromTop ? (Math.random() - .5) * 160 : (Math.random() - .5) * 420;
      const dy = fromTop ? H * (.6 + Math.random() * .5) : -(120 + Math.random() * 220);
      const a = p.animate([
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: 'translate(' + dx * .6 + 'px,' + (fromTop ? dy * .5 : dy) + 'px) rotate(' + (200 + Math.random() * 300) + 'deg)', opacity: 1, offset: fromTop ? .5 : .45 },
        { transform: 'translate(' + dx + 'px,' + (fromTop ? dy : dy + H * .5) + 'px) rotate(' + (500 + Math.random() * 400) + 'deg)', opacity: 0 },
      ], { duration: 1500 + Math.random() * 1100, easing: 'cubic-bezier(.2,.6,.3,1)', delay: Math.random() * 250 });
      a.onfinish = () => p.remove();
    }
  };

  /* 數字跳動：fx.countUp(el, 0→目標) */
  fx.countUp = function (el, to, ms) {
    if (!el) return;
    if (reduce) { el.textContent = String(to); return; }
    const t0 = performance.now(); ms = ms || 700;
    const step = (t) => { const k = Math.min(1, (t - t0) / ms); el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };

  /* 輕微震動回饋（支援的裝置才有） */
  fx.buzz = function (ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 18); } catch (e) { /* ignore */ } };

  window.VXFX = fx;
})();
