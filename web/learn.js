/* 技能教學流程：先猜猜看 → 看懂它 → 試試看 → 小檢查 → 動手做 → （再去）練習。
   每個技能的教學內容放在 lessons-*.js（window.VX_LESSONS）；這裡只放流程與互動小工具。
   學習進度存在 state.lrn[技能id] = { s: 走到第幾步, d: 完成日期, c: 小檢查答對數, w: 答錯數 }，很小，不會撐爆進度資料。 */
(function () {
  'use strict';
  const VX = window.VX;
  const { h } = VX;
  const tr = (s) => (window.VXI18N && window.VXI18N.tr) ? window.VXI18N.tr(s) : s;
  const T = (str, o) => { let r = tr(str); if (o) Object.keys(o).forEach((k) => { r = r.split('{' + k + '}').join(o[k]); }); return r; };
  const LS = () => window.VX_LESSONS || {};
  const STEPS = [
    ['guess', '🤔', '先猜猜看'],
    ['read', '📖', '看懂它'],
    ['lab', '🔬', '試試看'],
    ['check', '✅', '小檢查'],
    ['do', '🛠️', '動手做'],
  ];
  // append 會把 null 變成文字 "null"，所以自己過濾
  const put = (el, ...kids) => { kids.flat().forEach((k) => { if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k))); }); return el; };
  // 程式積木文字：跟積木畫面一樣顯示 VEXcode 英文（使用者選了「積木顯示中文」就保留中文）
  const disp = (ln) => { const st = VX.st; if (st && st.simLang === 'zh') return ln; const e = VX.toEn ? VX.toEn(ln) : ln; if (e !== ln) return e; const ind = (ln.match(/^ */) || [''])[0]; return ind + tr(ln.slice(ind.length)); };
  const fill = (el, ...kids) => { el.replaceChildren(); return put(el, ...kids); };
  const r1 = (x) => Math.round(x * 10) / 10;
  const r0 = (x) => Math.round(x);

  /* ---------- 進度 ---------- */
  function rec(id, create) {
    const st = VX.st; if (!st) return null;
    if (!st.lrn) { if (!create) return null; st.lrn = {}; }
    if (!st.lrn[id]) { if (!create) return null; st.lrn[id] = { s: 0, c: 0, w: 0 }; }
    return st.lrn[id];
  }
  const learnedIn = (state, id) => !!(state && state.lrn && state.lrn[id] && state.lrn[id].d);
  const has = (id) => !!LS()[id];
  const learned = (id) => learnedIn(VX.st, id);
  // 還沒學過、也還沒練過的技能，先學再練
  function needLesson(id) {
    const st = VX.st; if (!st || !has(id) || learned(id)) return false;
    const m = st.m && st.m[id];
    return !(m && (m.p >= 0.2 || m.n >= 3));
  }
  const minutes = (id) => { const l = LS()[id]; return l ? (l.min || 8) : 0; };

  /* ---------- 互動小工具 ---------- */
  const WID = {};

  // 滑桿 → 即時算出結果（公式、齒輪比、輪子距離…）
  WID.calc = (sp) => {
    const v = {};
    sp.params.forEach((p) => { v[p.k] = p.v; });
    const outEl = h('div', { class: 'lab-outs' });
    const vizEl = h('div', { class: 'lab-viz' });
    const upd = () => {
      outEl.replaceChildren(...sp.outs.map((o) => h('div', { class: 'lab-out' }, h('span', null, o.l), h('b', null, String(o.f(v)) + (o.u || '')))));
      if (sp.viz) vizEl.innerHTML = sp.viz(v);
    };
    const ctrls = sp.params.map((p) => {
      if (p.opts) {
        const sel = h('select', { 'aria-label': p.l, onchange: (e) => { v[p.k] = p.opts[e.target.selectedIndex][0]; upd(); } },
          p.opts.map(([x, l]) => h('option', x === p.v ? { selected: '' } : null, l)));
        return h('label', { class: 'lab-ctl' }, h('span', null, p.l), sel);
      }
      const val = h('b', { class: 'lab-val' }, p.v + (p.u || ''));
      const inp = h('input', { type: 'range', min: p.min, max: p.max, step: p.step || 1, value: p.v, 'aria-label': p.l,
        oninput: (e) => { v[p.k] = +e.target.value; val.textContent = e.target.value + (p.u || ''); upd(); } });
      return h('label', { class: 'lab-ctl' }, h('span', null, p.l), inp, val);
    });
    upd();
    return h('div', { class: 'lab' }, h('div', { class: 'lab-ctls' }, ctrls), vizEl, outEl);
  };

  // 機器人走路徑：自己排積木，看機器人在地上走出什麼形狀
  WID.walk = (sp) => {
    let ops = (sp.start || []).map((o) => ({ t: o[0], n: o[1] }));
    let rep = sp.rep || 1;
    const view = h('div', { class: 'lab-viz' });
    const blocks = h('div', { class: 'lab-blocks' });
    const info = h('div', { class: 'lab-outs' });
    const TXT = { f: (n) => '驅動 [向前] 為 (N) [毫米]'.replace('N', n), b: (n) => '驅動 [向後] 為 (N) [毫米]'.replace('N', n), l: (n) => '旋轉 [左邊] 度 (N) 度'.replace('N', n), r: (n) => '旋轉 [正確的] 度 (N) 度'.replace('N', n) };
    function run() {
      let x = 0, y = 0, a = 0; const pts = [[0, 0]];
      for (let k = 0; k < rep; k++) for (const o of ops) {
        if (o.t === 'f' || o.t === 'b') { const d = o.t === 'f' ? o.n : -o.n; x += d * Math.sin(a * Math.PI / 180); y += d * Math.cos(a * Math.PI / 180); pts.push([x, y]); }
        else a += o.t === 'r' ? o.n : -o.n;
      }
      return { pts, x, y, a };
    }
    function draw() {
      const R = run(); const xs = R.pts.map((p) => p[0]), ys = R.pts.map((p) => p[1]);
      const minx = Math.min(...xs, -100), maxx = Math.max(...xs, 100), miny = Math.min(...ys, -100), maxy = Math.max(...ys, 100);
      const sc = Math.min(260 / (maxx - minx), 180 / (maxy - miny));
      const ox = (300 - (maxx - minx) * sc) / 2, oy = (220 - (maxy - miny) * sc) / 2;
      const X = (px) => ox + (px - minx) * sc, Y = (py) => 220 - oy - (py - miny) * sc;
      const path = R.pts.map((p, i) => (i ? 'L' : 'M') + r1(X(p[0])) + ' ' + r1(Y(p[1]))).join(' ');
      const ang = ((R.a % 360) + 360) % 360;
      const ex = X(R.x), ey = Y(R.y);
      view.innerHTML = '<svg viewBox="0 0 300 220" role="img" aria-label="機器人走過的路線"><rect x="0" y="0" width="300" height="220" fill="var(--card)" stroke="var(--line)" rx="10"/>'
        + '<path d="' + path + '" fill="none" stroke="var(--accent,#2563eb)" stroke-width="3" stroke-linejoin="round" stroke-dasharray="1 0"/>'
        + '<circle cx="' + r1(X(0)) + '" cy="' + r1(Y(0)) + '" r="6" fill="#16a34a"/><text x="' + r1(X(0) + 9) + '" y="' + r1(Y(0) + 4) + '" font-size="11" fill="currentColor">' + '起點' + '</text>'
        + '<g transform="translate(' + r1(ex) + ' ' + r1(ey) + ') rotate(' + r0(ang) + ')"><polygon points="0,-11 8,8 -8,8" fill="#dc2626"/></g></svg>';
      const dist = Math.sqrt(R.x * R.x + R.y * R.y);
      info.replaceChildren(
        h('div', { class: 'lab-out' }, h('span', null, '離起點'), h('b', null, r0(dist) + ' mm')),
        h('div', { class: 'lab-out' }, h('span', null, '車頭朝向（0°＝一開始的方向）'), h('b', null, r0(ang) + '°')));
      blocks.replaceChildren();
      const lines = [];
      if (rep > 1) lines.push('重複 (' + rep + ')');
      ops.forEach((o) => lines.push((rep > 1 ? '  ' : '') + TXT[o.t](o.n)));
      if (lines.length) put(blocks, VX.blocksEl(lines)); else put(blocks, h('p', { class: 'sub' }, '還沒有積木，按下面的按鈕加進來。'));
    }
    const add = (t, n) => { if (ops.length >= 14) return; ops.push({ t, n }); draw(); };
    const dsel = h('select', { 'aria-label': '距離' }, [100, 200, 300].map((n) => h('option', n === 200 ? { value: n, selected: '' } : { value: n }, n + ' mm')));
    const asel = h('select', { 'aria-label': '角度' }, [45, 90, 120, 135, 180].map((n) => h('option', n === 90 ? { value: n, selected: '' } : { value: n }, n + ' 度')));
    const repIn = h('select', { 'aria-label': '整段重複次數', onchange: (e) => { rep = +e.target.value; draw(); } }, [1, 2, 3, 4, 5, 6, 8].map((n) => h('option', n === rep ? { value: n, selected: '' } : { value: n }, n + ' 次')));
    const bar = h('div', { class: 'lab-bar' },
      h('div', { class: 'row gap' }, dsel, h('button', { class: 'btn sm', type: 'button', onclick: () => add('f', +dsel.value) }, '＋前進'), h('button', { class: 'btn sm', type: 'button', onclick: () => add('b', +dsel.value) }, '＋後退')),
      h('div', { class: 'row gap' }, asel, h('button', { class: 'btn sm', type: 'button', onclick: () => add('l', +asel.value) }, '＋左轉'), h('button', { class: 'btn sm', type: 'button', onclick: () => add('r', +asel.value) }, '＋右轉')),
      sp.noRep ? null : h('div', { class: 'row gap' }, h('span', null, '整段重複'), repIn),
      h('div', { class: 'row gap' }, h('button', { class: 'btn sm', type: 'button', onclick: () => { ops.pop(); draw(); } }, '↩ 復原'), h('button', { class: 'btn sm', type: 'button', onclick: () => { ops = []; rep = 1; repIn.value = '1'; draw(); } }, '🗑 清空')));
    draw();
    return h('div', { class: 'lab' }, bar, h('div', { class: 'lab-two' }, blocks, h('div', null, view, info)));
  };

  // 一步一步執行：看程式跑到哪一行、變數變成多少
  WID.trace = (sp) => {
    let i = 0;
    const code = h('div', { class: 'lab-code' });
    const vars = h('div', { class: 'lab-vars' });
    const note = h('div', { class: 'lab-note' });
    const cnt = h('span', { class: 'sub' });
    const prev = h('button', { class: 'btn sm', type: 'button', onclick: () => { i = Math.max(0, i - 1); draw(); } }, '‹ 上一步');
    const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { i = Math.min(sp.steps.length - 1, i + 1); draw(); } }, '下一步 ›');
    function draw() {
      const s = sp.steps[i];
      code.replaceChildren(...sp.code.map((ln, k) => h('div', { class: 'lab-ln' + (k === s.line ? ' on' : '') }, h('span', { class: 'lab-no' }, k + 1), h('code', { 'data-notrans': '1' }, disp(ln)))));
      vars.replaceChildren(...Object.entries(s.vars || {}).map(([k, val]) => h('div', { class: 'lab-var' }, h('span', null, k), h('b', null, String(val)))));
      if (!Object.keys(s.vars || {}).length) vars.replaceChildren();
      note.textContent = s.note || '';
      cnt.textContent = (i + 1) + ' / ' + sp.steps.length;
      prev.disabled = i === 0; next.disabled = i === sp.steps.length - 1;
    }
    draw();
    return h('div', { class: 'lab' }, h('div', { class: 'lab-two' }, code, h('div', null, vars, h('div', { class: 'lab-viz' }, sp.viz ? h('div', { html: '' }) : null))), note, h('div', { class: 'row gap' }, prev, next, cnt));
  };

  // 連連看：左邊的名詞配右邊的說明
  WID.match = (sp) => {
    let pick = null; const done = new Set(); let wrong = 0;
    const right = VX.shuffle(sp.pairs.map((p, k) => ({ k, t: p[1] })));
    const msg = h('div', { class: 'lab-note' }, '先點左邊一個，再點右邊對應的說明。');
    const lbtn = [], rbtn = [];
    function refresh() {
      lbtn.forEach((b, k) => { b.className = 'lab-pick' + (done.has(k) ? ' ok' : pick === k ? ' on' : ''); b.disabled = done.has(k); });
      rbtn.forEach((b) => { b.className = 'lab-pick' + (done.has(+b.dataset.k) ? ' ok' : ''); b.disabled = done.has(+b.dataset.k); });
    }
    sp.pairs.forEach((p, k) => lbtn.push(h('button', { type: 'button', class: 'lab-pick', onclick: () => { pick = k; refresh(); } }, p[0])));
    right.forEach((r) => rbtn.push(h('button', { type: 'button', class: 'lab-pick', 'data-k': r.k, onclick: () => {
      if (pick == null) { msg.textContent = '先點左邊的名詞。'; return; }
      if (pick === r.k) { done.add(r.k); msg.textContent = done.size === sp.pairs.length ? '🎉 全部配對成功！' + (wrong ? '（猜錯 ' + wrong + ' 次）' : '一次就全對！') : '✓ 配對正確'; }
      else { wrong++; msg.textContent = '再想想，不是這個。'; }
      pick = null; refresh();
    } }, r.t)));
    refresh();
    return h('div', { class: 'lab' }, h('div', { class: 'lab-two' }, h('div', { class: 'lab-col' }, lbtn), h('div', { class: 'lab-col' }, rbtn)), msg);
  };

  // 排順序：照正確順序依序點
  WID.order = (sp) => {
    const items = VX.shuffle(sp.steps.map((t, k) => ({ k, t })));
    let n = 0; const chosen = []; let wrong = 0;
    const msg = h('div', { class: 'lab-note' }, sp.ask || '照正確的順序，一個一個點。');
    const list = h('ol', { class: 'lab-ord' });
    const btns = items.map((it) => h('button', { type: 'button', class: 'lab-pick', onclick: (e) => {
      if (it.k === n) { n++; chosen.push(it); e.target.className = 'lab-pick ok'; e.target.disabled = true; put(list, h('li', null, it.t)); msg.textContent = n === sp.steps.length ? '🎉 順序正確！' + (wrong ? '（猜錯 ' + wrong + ' 次）' : '') : '✓ 對，接下來呢？'; }
      else { wrong++; msg.textContent = '還不是這一步，再想想。'; }
    } }, it.t));
    return h('div', { class: 'lab' }, h('div', { class: 'lab-col' }, btns), h('div', null, h('b', null, '你排的順序：'), list), msg);
  };

  /* ---------- 教學頁 ---------- */
  function view(s, p) {
    const L = LS()[s.id];
    if (!L) return null;
    const st = VX.st;
    const curRec = () => rec(s.id, false) || { s: 0, c: 0, w: 0 };
    const isDone = () => !!curRec().d;
    const level = p < 0.35 ? 1 : p < 0.7 ? 2 : 3;
    const steps = STEPS.filter((x) => (x[0] !== 'guess' || L.guess) && (x[0] !== 'lab' || L.lab) && (x[0] !== 'do' || L.doit));
    const wrap = h('div', { class: 'learn' });
    const bar = h('div', { class: 'lstepbar', role: 'tablist' });
    const body = h('div', { class: 'lbody' });
    const cta = h('div', { class: 'lcta' });
    let cur = 0;
    function go(i) { cur = Math.max(0, Math.min(steps.length - 1, i)); draw(); }
    function reach(key) {
      const idx = STEPS.findIndex((x) => x[0] === key) + 1;
      const rr = rec(s.id, true); if (rr && rr.s < idx) { rr.s = idx; VX.saveState(); }
    }
    function paintBar() {
      const done = isDone();
      bar.replaceChildren(...steps.map((x, i) => h('button', { type: 'button', role: 'tab', 'aria-selected': i === cur ? 'true' : 'false', class: 'lstep' + (i === cur ? ' on' : '') + (i < cur || (done && x[0] !== 'do') ? ' past' : ''), onclick: () => go(i) },
        h('span', { 'aria-hidden': 'true' }, x[1]), h('small', null, x[2]))));
    }
    const nextBtn = (label) => h('div', { class: 'row gap lnext' }, cur > 0 ? h('button', { class: 'btn', type: 'button', onclick: () => go(cur - 1) }, '‹ 上一步') : null, h('button', { class: 'btn primary', type: 'button', onclick: () => go(cur + 1) }, label || '下一步 ›'));

    function stepGuess() {
      const g = L.guess; const box = h('div', { class: 'lpanel' });
      put(box, h('h3', null, '🤔 先猜猜看'), h('p', null, '還沒學也沒關係，憑直覺猜一個。猜錯是正常的，這就是接下來要學的。'), h('p', { class: 'lq' }, g.q), g.code ? VX.blocksEl(g.code) : null);
      const fb = h('div', { class: 'lfb' });
      const opts = g.opts.map((o, k) => h('button', { class: 'lopt', type: 'button', onclick: () => {
        opts.forEach((b, j) => { b.disabled = true; if (j === g.a) b.classList.add('ok'); });
        if (k !== g.a) opts[k].classList.add('no');
        fb.className = 'lfb show ' + (k === g.a ? 'ok' : 'soft');
        fb.textContent = (k === g.a ? '👍 猜對了！' : '沒關係，答案是「' + g.opts[g.a] + '」。') + (g.why ? ' ' + g.why : '') + '　下一步看看為什麼。';
      } }, o));
      put(box, h('div', { class: 'lopts' }, opts), fb, nextBtn('開始學 ›'));
      return box;
    }

    function stepRead() {
      const cards = L.cards; let ci = 0;
      const box = h('div', { class: 'lpanel' });
      const card = h('div', { class: 'lcard' });
      const nav = h('div', { class: 'row gap lnext' });
      function paint() {
        const c = cards[ci];
        fill(card, h('div', { class: 'lcount' }, (ci + 1) + ' / ' + cards.length), h('h3', null, c.t), h('div', { class: 'lesson', html: c.b }), c.svg ? h('div', { class: 'lsvg', html: c.svg }) : null,
          c.tip ? h('div', { class: 'callout' }, '💡 ' + c.tip) : null, c.warn ? h('div', { class: 'callout warn' }, '⚠️ 常見錯誤：' + c.warn) : null);
        nav.replaceChildren(
          h('button', { class: 'btn', type: 'button', onclick: () => { if (ci > 0) { ci--; paint(); } else if (cur > 0) go(cur - 1); } }, '‹ 上一步'),
          ci < cards.length - 1 ? h('button', { class: 'btn primary', type: 'button', onclick: () => { ci++; paint(); } }, '下一張 ›')
            : h('button', { class: 'btn primary', type: 'button', onclick: () => { reach('read'); go(cur + 1); } }, L.lab ? '去試試看 ›' : '去小檢查 ›'));
      }
      paint();
      put(box, h('h3', null, '📖 看懂它'), card, nav);
      if (level >= 2 && L.extra) put(box, h('details', { class: 'lessonbox', open: level === 3 }, h('summary', null, '🚀 進階補充（你已經有基礎了，可以看這個）'), h('div', { class: 'body', html: L.extra })));
      return box;
    }

    function stepLab() {
      const labs = Array.isArray(L.lab) ? L.lab : [L.lab];
      const box = h('div', { class: 'lpanel' });
      put(box, h('h3', null, '🔬 試試看'));
      labs.forEach((lb) => {
        if (lb.title) put(box, h('h4', null, lb.title));
        if (lb.ask) put(box, h('p', { class: 'lq' }, '👉 ' + lb.ask));
        const w = WID[lb.type]; if (w) put(box, w(lb));
        if (lb.see) put(box, h('div', { class: 'callout' }, '🔎 觀察重點：' + lb.see));
      });
      const nb = nextBtn('去小檢查 ›'); nb.lastChild.addEventListener('click', () => reach('lab'));
      put(box, nb);
      return box;
    }

    function stepCheck() {
      const qs = L.check; const box = h('div', { class: 'lpanel' });
      let qi = 0, right = 0, wrong = 0;
      const area = h('div');
      function ask() {
        if (qi >= qs.length) return fin();
        const q = qs[qi]; const order = VX.shuffle(q.opts.map((_, k) => k));
        const fb = h('div', { class: 'lfb' }); const nx = h('button', { class: 'btn primary', type: 'button', style: 'display:none', onclick: () => { qi++; ask(); } }, qi === qs.length - 1 ? '看結果 ›' : '下一題 ›');
        const btns = order.map((k) => h('button', { class: 'lopt', type: 'button', onclick: () => {
          btns.forEach((b, j) => { b.disabled = true; if (order[j] === q.a) b.classList.add('ok'); });
          const okk = k === q.a; if (!okk) btns[order.indexOf(k)].classList.add('no');
          if (okk) right++; else wrong++;
          fb.className = 'lfb show ' + (okk ? 'ok' : 'bad'); fb.textContent = (okk ? '✅ 答對了！' : '❌ 再想想。') + ' ' + q.why;
          nx.style.display = '';
        } }, q.opts[k]));
        fill(area, h('div', { class: 'lcount' }, T('第 {a} / {b} 題', { a: qi + 1, b: qs.length })), h('p', { class: 'lq' }, q.q), q.code ? VX.blocksEl(q.code) : null, h('div', { class: 'lopts' }, btns), fb, nx);
      }
      function fin() {
        const pass = right >= Math.ceil(qs.length * 0.6);
        const rr = rec(s.id, true);
        rr.c = Math.max(rr.c || 0, right); rr.w = (rr.w || 0) + wrong; if (rr.s < 4) rr.s = 4;
        if (pass && !rr.d) { rr.d = VX.todayStr(); if (VX.act) VX.act('learn', s.id); }
        VX.saveState();
        paintBar(); paintCta();
        fill(area, h('div', { class: 'lresult ' + (pass ? 'ok' : 'soft') },
          h('h3', null, pass ? '🎉 學會了！（' + right + ' / ' + qs.length + '）' : '差一點點（' + right + ' / ' + qs.length + '）'),
          h('p', null, pass ? '觀念通過了！可以去動手做，或直接去練習題把它練熟。' : '沒關係，回去再看一遍「看懂它」，再來試一次，通常第二次就過了。'),
          h('div', { class: 'row gap' },
            pass ? h('button', { class: 'btn primary', type: 'button', onclick: () => go(cur + 1) }, L.doit ? '去動手做 ›' : '完成') : h('button', { class: 'btn primary', type: 'button', onclick: () => go(steps.findIndex((x) => x[0] === 'read')) }, '📖 回去看一遍'),
            h('button', { class: 'btn', type: 'button', onclick: () => { qi = 0; right = 0; wrong = 0; ask(); } }, '🔁 再做一次小檢查'),
            pass ? h('a', { class: 'btn', href: '#/practice/' + s.id }, '✏️ 直接去練習') : null)));
      }
      put(box, h('h3', null, '✅ 小檢查'), h('p', { class: 'sub' }, isDone() ? '你已經通過了，想複習可以再做一次。' : '答對大部分就算學會。已經會的人，可以直接從這裡開始！'), area);
      ask();
      return box;
    }

    function stepDo() {
      const d = L.doit; const box = h('div', { class: 'lpanel' });
      put(box, h('h3', null, '🛠️ 動手做：' + d.t));
      if (d.why) put(box, h('p', null, d.why));
      if (d.steps) put(box, h('ol', null, d.steps.map((x) => h('li', null, x))));
      if (d.note) put(box, h('div', { class: 'callout' }, '📓 寫進工程筆記：' + d.note));
      const links = (d.links || []).map(([lb, hr]) => h('a', { class: 'btn', href: hr }, lb));
      put(box, h('div', { class: 'row gap' }, links, h('a', { class: 'btn', href: '#/notebook' }, '📓 去寫工程筆記')));
      const fin = h('button', { class: 'btn primary', type: 'button', onclick: () => { const rr = rec(s.id, true); rr.s = 5; VX.saveState(); fin.textContent = '✓ 已完成，再去練習題吧'; } }, '我做完了 ✓');
      put(box, h('div', { class: 'row gap lnext' }, h('button', { class: 'btn', type: 'button', onclick: () => go(cur - 1) }, '‹ 上一步'), fin, h('a', { class: 'btn primary', href: '#/practice/' + s.id }, '✏️ 去練習這個技能（5 題）')));
      return box;
    }

    function paintCta() {
      const lock = needLesson(s.id);
      const rNow = curRec();
      const done = !!rNow.d;
      fill(cta,
        done ? h('div', { class: 'lbadge' }, '✅ 已學會（' + rNow.d + '）') : h('div', { class: 'lbadge soft' }, '還沒通過小檢查：先學完上面幾步，練習題會更順。'),
        h('a', { class: 'btn ' + (lock ? '' : 'primary'), href: '#/practice/' + s.id, onclick: (e) => { if (lock) { e.preventDefault(); VX.toast('先把上面的教學看完、通過小檢查，再來練習會更輕鬆'); go(steps.findIndex((x) => x[0] === 'check')); } } }, '✏️ 練習這個技能（5 題）'));
    }

    function draw() {
      paintBar(); paintCta();
      const key = steps[cur][0];
      fill(body, key === 'guess' ? stepGuess() : key === 'read' ? stepRead() : key === 'lab' ? stepLab() : key === 'check' ? stepCheck() : stepDo());
    }
    // 起點：做過就接著走；已熟練的人直接從小檢查開始
    const r0_ = curRec();
    const startKey = r0_.d ? 'check' : level === 3 && !r0_.s ? 'check' : r0_.s >= 4 ? 'check' : r0_.s >= 2 ? 'lab' : r0_.s >= 1 ? 'read' : (L.guess ? 'guess' : 'read');
    cur = Math.max(0, steps.findIndex((x) => x[0] === (steps.some((y) => y[0] === startKey) ? startKey : 'read')));
    const intro = h('div', { class: 'lintro' },
      h('div', null, h('b', null, '這個技能的學習路線'), h('div', { class: 'sub' }, T('約 {n} 分鐘：先猜 → 看懂 → 試試看 → 小檢查 → 動手做，然後才練習題。', { n: minutes(s.id) }))),
      level === 3 ? h('div', { class: 'sub' }, '你的熟練度已經很高，可以直接做小檢查或練習。') : null);
    put(wrap, intro, bar, body, cta);
    draw();
    return wrap;
  }


  // 家長／教練看的「學習進度」：學了哪些、卡在哪一步、學過但練習還弱
  function parentPanel(box, state) {
    if (!box) return;
    const lrn = (state && state.lrn) || {};
    const ids = Object.keys(LS());
    const done = ids.filter((id) => lrn[id] && lrn[id].d);
    const going = ids.filter((id) => lrn[id] && !lrn[id].d && lrn[id].s > 0);
    const weak = done.filter((id) => { const m = state.m && state.m[id]; return m && m.n >= 5 && m.p < 0.35; });
    const nm = (id) => (VX.SK[id] ? VX.SK[id].name : id);
    const stepName = (n) => (STEPS[Math.max(0, Math.min(STEPS.length, n) - 1)] || ['', '', '還沒開始'])[2];
    const rows = [];
    if (going.length) rows.push(h('div', { class: 'wrongitem' }, h('b', null, '學到一半：'), going.map((id) => h('div', { class: 'wa' }, nm(id) + '（走到「' + stepName(lrn[id].s) + '」' + (lrn[id].w >= 2 ? '，小檢查答錯 ' + lrn[id].w + ' 題' : '') + '）'))));
    if (weak.length) rows.push(h('div', { class: 'wrongitem' }, h('b', null, '學過、但練習還弱（可以一起回頭看教學）：'), weak.map((id) => h('div', { class: 'wa' }, nm(id) + '（熟練度 ' + Math.round(state.m[id].p * 100) + '%）'))));
    box.replaceChildren(h('div', { class: 'panel' }, h('h3', null, '📖 教學進度'),
      h('p', { class: 'sub' }, '已學會 ' + done.length + ' / ' + ids.length + ' 個技能的教學（看懂 → 試試看 → 小檢查）。'),
      h('div', { class: 'mbar big' }, h('div', { style: 'width:' + Math.round(done.length / Math.max(1, ids.length) * 100) + '%;background:var(--ok)' })),
      rows.length ? rows : h('p', { class: 'sub' }, '還沒有卡關的地方。')));
  }

  VX.learn = { view, has, learned, learnedIn, needLesson, minutes, parentPanel, WID, STEPS };
})();
