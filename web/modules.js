/* 第二階段模組：挑戰題庫、工程筆記、組裝教學、比賽專區，以及家長頁的筆記區。依賴 app.js 的 window.VX 與 content.js。 */
(function () {
  'use strict';
  const VX = window.VX;
  const { h, api, shell, blocksEl, toast } = VX;
  const $ = () => VX.app;
  const fmt = (ts) => { const d = new Date(ts * 1000); return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate(); };
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
  const paint = (c, title, icon) => $().replaceChildren(shell(c, { title, icon }));
  VX.paint = paint;
  const html = (s) => h('div', { html: s });
  // 零件／按鍵的「程式怎麼用」一行：整句翻譯後顯示（元素本身標 data-notrans，避免逐字翻壞積木名稱）
  const trCode = (s) => (window.VXI18N && window.VXI18N.tr ? window.VXI18N.tr(s) : s);

  /* ============ 挑戰題庫 ============ */
  function fieldSvg(ch, showPath) {
    const S = 56, W = ch.cols * S, H = ch.rows * S, ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W + 2} ${H + 2}`); svg.setAttribute('class', 'fieldmap'); svg.style.width = Math.min(W + 2, 520) + 'px';
    const add = (t, a, txt) => { const e = document.createElementNS(ns, t); for (const k in a) e.setAttribute(k, a[k]); if (txt) e.textContent = txt; svg.append(e); return e; };
    for (let c = 0; c <= ch.cols; c++) add('line', { x1: c * S + 1, y1: 1, x2: c * S + 1, y2: H + 1, stroke: '#dde4ee' });
    for (let r = 0; r <= ch.rows; r++) add('line', { x1: 1, y1: r * S + 1, x2: W + 1, y2: r * S + 1, stroke: '#dde4ee' });
    const CH = { red: '#ff9b9b', green: '#8fe0a3', blue: '#9bbcff', yellow: '#ffe680' };
    (ch.colors || []).forEach((z) => add('rect', { x: z.c * S + 2, y: z.r * S + 2, width: S - 2, height: S - 2, fill: CH[z.color] || '#ccc' }));
    ch.walls.forEach((w) => add('rect', { x: w.c * S + 2, y: w.r * S + 2, width: S - 2, height: S - 2, fill: '#8a94a6', rx: 4 }));
    if (showPath) {
      add('polyline', { points: ch.path.map(([c, r]) => `${c * S + 1},${r * S + 1}`).join(' '), fill: 'none', stroke: '#1f9d55', 'stroke-width': 4, 'stroke-dasharray': '8 6', 'stroke-linejoin': 'round' });
    }
    add('text', { x: ch.goal.c * S + 1, y: ch.goal.r * S + 10, 'font-size': 28, 'text-anchor': 'middle' }, '🚩');
    const rot = { E: 90, S: 180, W: 270, N: 0 }[ch.start.dir];
    const g = add('g', { transform: `translate(${ch.start.c * S + 1},${ch.start.r * S + 1}) rotate(${rot})` });
    const tri = document.createElementNS(ns, 'polygon'); tri.setAttribute('points', '0,-17 13,14 -13,14'); tri.setAttribute('fill', '#0875e2'); tri.setAttribute('stroke', '#fff'); tri.setAttribute('stroke-width', 2); g.append(tri);
    add('text', { x: W - 4, y: H - 6, 'font-size': 11, 'text-anchor': 'end', fill: '#5d6b7e' }, '每格 200 mm');
    return svg;
  }

  function viewChallenge(id) {
    const st = VX.st; st.ch = st.ch || {};
    const chStatus = (c) => {
      const rec = st.ch[c.id] || {};
      if (rec.done || rec.sim) return 'ok';
      const sv = st.sim && st.sim[c.id];
      const hasBlocks = !!(sv && ((sv.main && sv.main.length) || (sv.defs && sv.defs.length)));
      if ((rec.runs || 0) > 0 || (rec.hints || 0) > 0 || hasBlocks) return 'try';
      return 'idle';
    };
    if (!id) {
      const okN = CHALLENGES.filter((c) => chStatus(c) === 'ok').length;
      const tryN = CHALLENGES.filter((c) => chStatus(c) === 'try').length;
      const idleN = CHALLENGES.length - okN - tryN;
      const customList = Array.isArray(st.customCh) ? st.customCh : [];
      const card = (c) => {
        const rec = st.ch[c.id] || {};
        const d = rec.done;
        const stt = chStatus(c);
        const cls = 'card' + (stt === 'ok' ? ' card-lit-ok' : stt === 'try' ? ' card-lit-try' : '');
        const lampTitle = stt === 'ok' ? '已通過' : stt === 'try' ? '練習中' : '尚未練習';
        return h('a', { class: cls, href: '#/challenge/' + c.id },
          h('h3', null, h('span', { class: 'lamp ' + stt, title: lampTitle }), c.title,
            d ? h('span', { class: 'tag done' }, ' ✓ 完成') : null,
            stt === 'try' ? h('span', { class: 'tag try' }, '練習中') : null),
          h('div', { class: 'stars' }, stars(c.lv)), h('p', { class: 'sub' }, c.goal_t),
          rec.sim ? h('span', { class: 'tag done' }, '🖥 模擬通過' + (rec.stars ? ' ' + '⭐'.repeat(rec.stars) : '')) : null,
          c.skills.map((s) => h('span', { class: 'tag' }, VX.SK[s].name)));
      };
      const customCard = (c) => h('div', { class: 'card' },
        h('h3', null, '🎨 ', h('span', { 'data-notrans': '1' }, c.title)),
        h('p', { class: 'sub' }, c.goal_t || '自訂場地（' + c.cols + '×' + c.rows + ' 格，' + (c.walls ? c.walls.length : 0) + ' 塊牆）'),
        h('div', { class: 'row gap' },
          h('a', { class: 'btn primary sm', href: '#/sim/' + c.id }, '▶ 挑戰這關'),
          h('button', { class: 'btn ghost sm', onclick: () => { if (!confirm('刪掉自訂關卡「' + c.title + '」？')) return; st.customCh = customList.filter((x) => x.id !== c.id); delete st.ch[c.id]; if (st.sim) delete st.sim[c.id]; VX.saveState(); viewChallenge(); } }, '刪除')));
      return paint(h('div', null,
        h('p', { class: 'sub' }, '把程式真的下載到機器人上跑跑看！每題完成後，記得寫一頁「測試紀錄」。'),
        h('div', { class: 'lamp-legend' },
          h('span', null, h('span', { class: 'lamp ok' }), '已通過 ' + okN + ' / ' + CHALLENGES.length),
          h('span', null, h('span', { class: 'lamp try' }), '練習中 ' + tryN),
          h('span', null, h('span', { class: 'lamp idle' }), '尚未練習 ' + idleN)),
        h('h2', null, '🐛 除錯偵探（修好壞掉的程式）'), h('p', { class: 'sub' }, '不用從零開始！系統已經放好一段藏了 bug 的程式，進模擬器抓出兇手並修好它。'),
        h('div', { class: 'grid2' }, CHALLENGES.filter((c) => c.debug).map(card)),
        h('h2', null, '基礎挑戰'), h('div', { class: 'grid2' }, CHALLENGES.filter((c) => !c.lu && !c.debug).map(card)),
        h('h2', null, '🎯 Level Up 練習'), h('p', { class: 'sub' }, '用當季遊戲的情境練路線與時間。場地是示意的，請自己量；秒數要用碼錶實測，拿去「得分規劃器」。'),
        h('div', { class: 'grid2' }, CHALLENGES.filter((c) => c.lu).map(card)),
        h('h2', null, '🎨 我的自訂關卡（出題考爸媽／隊友）'),
        customList.length ? h('div', { class: 'grid2' }, customList.map(customCard)) : h('p', { class: 'sub' }, '還沒有自訂關卡。到模擬器自由練習點「🎨 設計關卡」，就能自己擺牆壁和旗子出題！'),
        h('div', { class: 'row gap', style: 'margin-top:12px' }, h('a', { class: 'btn primary', href: '#/sim' }, '🎨 去設計我的關卡'), h('a', { class: 'btn', href: '#/compete/plan' }, '🧮 得分規劃器'), h('a', { class: 'btn', href: '#/practice/F1' }, '當季計分練習題'))), '挑戰題庫', '🏁');
    }
    const ch = CHALLENGES.find((c) => c.id === id); if (!ch) { location.hash = '#/challenge'; return; }
    const rec = st.ch[id] || (st.ch[id] = { done: false, hints: 0 });
    let reveal = false;
    const fieldBox = h('div'); const hintBox = h('div'); const solBox = h('div'); const doneBox = h('div');
    const drawField = () => fieldBox.replaceChildren(fieldSvg(ch, reveal));
    const drawHints = () => {
      hintBox.replaceChildren(...ch.hints.slice(0, rec.hints).map((t, i) => h('div', { class: 'callout' }, h('b', null, '提示 ' + (i + 1) + '：'), t)),
        rec.hints < ch.hints.length ? h('button', { class: 'btn sm', onclick: () => { rec.hints++; VX.saveState(); drawHints(); } }, '給我提示（' + rec.hints + '/' + ch.hints.length + '）') : null);
    };
    const drawSol = () => {
      solBox.replaceChildren(reveal ? h('div', null, h('h3', null, '參考解答'), blocksEl(ch.code), ch.note ? h('p', { class: 'sub' }, ch.note) : null, h('p', { class: 'sub' }, '綠色虛線是參考路線。你的做法不一定要一模一樣，能達成目標就好；比較兩種做法也很棒！')) :
        h('button', { class: 'btn ghost', onclick: () => { if (confirm('先想過、也試過了嗎？確定要看參考解答？')) { reveal = true; drawField(); drawSol(); } } }, '我真的卡住了，看參考解答'));
    };
    const drawDone = () => {
      doneBox.replaceChildren(rec.done ? h('div', { class: 'callout' }, '✅ 你已經完成這個挑戰！', h('div', { class: 'row gap' }, h('a', { class: 'btn primary', href: '#/notebook/new/test/' + id }, '📓 寫一頁測試紀錄'), h('a', { class: 'btn', href: '#/challenge' }, '下一個挑戰'))) :
        h('button', { class: 'btn green', onclick: () => { rec.done = true; rec.t = Date.now(); if (VX.act) VX.act('challenge'); VX.saveState(); drawDone(); toast('太棒了，完成一個挑戰！'); } }, '✔ 我在機器人上跑成功了'));
    };
    drawField(); drawHints(); drawSol(); drawDone();
    paint(h('div', null, h('a', { class: 'back', href: '#/challenge' }, '‹ 回挑戰列表'),
      h('div', { class: 'panel' }, h('h1', null, ch.title), h('div', { class: 'stars' }, '難度 ' + stars(ch.lv)),
        h('p', null, h('b', null, '目標：'), ch.goal_t), h('p', null, ch.task), fieldBox,
        h('p', { class: 'sub' }, '先在紙上或地板上把場地畫出來（每格 200 mm），再寫程式。這不是紙上談兵——要真的跑跑看並量誤差。'),
        h('div', { class: 'row gap' }, h('a', { class: 'btn', href: '#/sim/' + ch.id }, '🖥 在模擬器試跑'), h('a', { class: 'btn', href: '#/import/' + ch.id }, '📤 上傳我的 VEXcode 存檔')), hintBox, solBox, doneBox)), ch.title, '🏁');
  }

  /* ============ 工程筆記 ============ */
  function checkScore(n) { const c = (n.data && n.data.c) || []; const total = (NB_KINDS[n.kind] ? NB_KINDS[n.kind].check.length : 0); const ok = c.filter(Boolean).length; return total ? Math.round((ok / total) * 100) : null; }
  const KIND_NAME = (k) => (NB_KINDS[k] ? NB_KINDS[k].icon + ' ' + NB_KINDS[k].name : k === 'skills' ? '🏆 技能賽練習' : k === 'interview' ? '🎤 面談練習' : k);

  async function viewNotebook(a, b, c) {
    if (a === 'new' && NB_KINDS[b]) return editor(null, b, c);
    if (a === 'edit') { try { const { notes } = await api('/api/notes'); const n = notes.find((x) => x.id === parseInt(b, 10)); if (n) return editor(n, n.kind); } catch (e) { toast(e.message); } location.hash = '#/notebook'; return; }
    paint(h('p', { class: 'sub' }, '載入中…'), '工程筆記', '📓');
    let notes = [];
    try { notes = (await api('/api/notes')).notes; } catch (e) { toast(e.message); }
    const unseen = notes.filter((n) => n.fb && !n.fb_seen).length;
    paint(h('div', null,
      unseen ? h('div', { class: 'callout warn' }, '💬 家長有 ' + unseen + ' 則新的留言，點下面有「新留言」標記的筆記來看。') : null,
      h('h2', null, '📖 先學：怎麼寫工程筆記'),
      NB_LESSONS.map((l, i) => h('details', { class: 'lessonbox', open: i === 0 }, h('summary', null, l.title), h('div', { class: 'body', html: l.html }))),
      h('div', { class: 'row gap' }, h('a', { class: 'btn', href: '#/portfolio' }, '🎓 整理成作品集（可列印）')),
      h('h2', null, '✍️ 開始寫一頁'),
      h('div', { class: 'tiles' }, Object.entries(NB_KINDS).map(([k, v]) => h('a', { class: 'tile', href: '#/notebook/new/' + k, style: 'background:#f2cd16;border-color:#b4982e' }, h('span', { class: 'ti' }, v.icon), v.name))),
      h('h2', null, '我的筆記（' + notes.length + '）'),
      notes.length ? notes.map((n) => { const sc = checkScore(n); return h('a', { class: 'card', href: '#/notebook/edit/' + n.id, style: 'margin:8px 0;display:block' },
        h('b', { 'data-notrans': '1' }, n.title), h('div', { class: 'sub' }, KIND_NAME(n.kind) + '　·　' + fmt(n.updated), sc != null ? '　·　自評 ' + sc + '%' : '', n.fb ? (n.fb_seen ? '　💬 有留言' : '　🔔 新留言') : '')); }) : h('p', { class: 'sub' }, '還沒有筆記。選一種開始寫第一頁吧！')), '工程筆記', '📓');
  }

  function editor(note, kind, chid) {
    const K = NB_KINDS[kind];
    const data = note ? JSON.parse(JSON.stringify(note.data || {})) : { f: {}, c: [] };
    data.f = data.f || {}; data.c = data.c || [];
    const ch = chid && CHALLENGES.find((x) => x.id === chid);
    const title = h('input', { type: 'text', value: note ? note.title : (ch ? K.name + '：' + ch.title : ''), placeholder: '標題（例如：手臂太晃的測試）' });
    const date = h('input', { type: 'text', value: data.f.date || VX.todayStr() });
    const author = h('input', { type: 'text', value: data.f.author || VX.user.display || '' });
    const body = h('div');
    const inputs = {};
    (K.fields || []).forEach((f) => {
      const el = f.big ? h('textarea', { placeholder: f.h || '' }) : h('input', { type: 'text', placeholder: f.h || '' });
      el.value = data.f[f.k] || ''; if (!f.big && f.k === 'goal' && ch && !el.value) el.value = '確認「' + ch.title + '」的程式在真機上走得準不準';
      inputs[f.k] = el;
    });
    let custom = null;
    if (K.custom === 'matrix') custom = matrixEditor(data); if (K.custom === 'sketch') custom = sketchEditor(data); if (K.custom === 'test') custom = testEditor(data);
    body.append(h('div', { class: 'row gap' }, h('div', { style: 'flex:1;min-width:140px' }, h('label', null, '日期'), date), h('div', { style: 'flex:1;min-width:140px' }, h('label', null, '姓名'), author)));
    if (K.custom === 'test' || K.custom === 'matrix' || K.custom === 'sketch') { /* 自訂區在欄位前 */ }
    (K.fields || []).filter((f) => f.k !== 'conclusion' && f.k !== 'reason' && f.k !== 'label').forEach((f) => body.append(h('div', { class: 'field' }, h('label', null, f.l), f.h ? h('div', { class: 'help' }, f.h) : null, inputs[f.k])));
    if (custom) body.append(custom.el);
    (K.fields || []).filter((f) => f.k === 'conclusion' || f.k === 'reason' || f.k === 'label').forEach((f) => body.append(h('div', { class: 'field' }, h('label', null, f.l), f.h ? h('div', { class: 'help' }, f.h) : null, inputs[f.k])));
    const meter = h('div', { class: 'meter' }, h('div', { style: 'width:0%' }));
    const meterT = h('div', { class: 'sub' });
    const checks = K.check.map((t, i) => { const cb = h('input', { type: 'checkbox' }); cb.checked = !!data.c[i]; cb.addEventListener('change', upd); return h('label', { class: 'check' }, cb, t); });
    function upd() { const ok = checks.filter((l) => l.querySelector('input').checked).length; const pct = Math.round((ok / checks.length) * 100); meter.firstChild.style.width = pct + '%'; meterT.textContent = '自我檢查 ' + ok + ' / ' + checks.length + (pct === 100 ? '　🎉 這頁很完整！' : ''); }
    upd();
    const msg = h('div', { class: 'errmsg' });
    const save = async () => {
      const out = { f: { date: date.value, author: author.value }, c: checks.map((l) => l.querySelector('input').checked) };
      Object.entries(inputs).forEach(([k, el]) => (out.f[k] = el.value));
      if (data.iq) out.iq = data.iq; // 保留附上的 VEXcode 存檔
      if (custom) Object.assign(out, custom.get());
      msg.textContent = '';
      try { const r = await api('/api/notes', { id: note ? note.id : undefined, kind, title: title.value, data: out }); toast('已儲存 ✔'); if (!note && VX.act) VX.act('note'); VX.saveState(); location.hash = '#/notebook'; } catch (e) { msg.textContent = e.message; }
    };
    const fbBox = note && note.fb ? h('div', { class: 'fb-box' }, h('b', null, '💬 家長留言（' + fmt(note.fb_ts) + '）'), h('div', null, note.fb)) : null;
    if (note && note.fb && !note.fb_seen) api('/api/notes/' + note.id + '/seen', {}).catch(() => {});
    paint(h('div', null, h('a', { class: 'back', href: '#/notebook' }, '‹ 回筆記'),
      h('div', { class: 'panel' }, h('h2', null, K.icon + ' ' + K.name), fbBox, h('div', { class: 'field' }, h('label', null, '標題'), title), body,
        h('h3', null, '✅ 自我檢查'), h('p', { class: 'sub' }, '寫完對照一下，每一項都做到了嗎？'), checks, meter, meterT, msg,
        h('div', { class: 'row gap' }, h('button', { class: 'btn primary', onclick: save }, '儲存'),
          note ? h('button', { class: 'btn danger', onclick: async () => { if (!confirm('確定要刪掉這頁筆記嗎？')) return; try { await api('/api/notes/' + note.id + '/delete', {}); location.hash = '#/notebook'; } catch (e) { toast(e.message); } } }, '刪除') : null))), '工程筆記', '📓');
  }

  function matrixEditor(data) {
    const m = data.matrix || { opts: ['方案 A', '方案 B', '方案 C'], rows: [{ n: '', w: 1, s: [0, 0, 0] }, { n: '', w: 1, s: [0, 0, 0] }, { n: '', w: 1, s: [0, 0, 0] }] };
    const el = h('div', { class: 'field' }, h('label', null, '決策矩陣'), h('div', { class: 'help' }, '標準寫在左邊；權重越大越重要；分數 1～5。總分 = 分數 × 權重。'));
    const tbl = h('table', { class: 'tbl' }); el.append(h('div', { style: 'overflow-x:auto' }, tbl));
    const draw = () => {
      const tot = m.opts.map((_, j) => m.rows.reduce((a, r) => a + (parseFloat(r.s[j]) || 0) * (parseFloat(r.w) || 0), 0));
      tbl.replaceChildren(
        h('tr', null, h('th', null, '標準'), h('th', null, '權重'), ...m.opts.map((o, j) => h('th', null, h('input', { type: 'text', value: o, oninput: (e) => (m.opts[j] = e.target.value) })))),
        ...m.rows.map((r) => h('tr', null, h('td', null, h('input', { type: 'text', value: r.n, placeholder: '例如：抓得穩', oninput: (e) => (r.n = e.target.value) })), h('td', null, h('input', { type: 'number', value: r.w, min: 0, max: 9, oninput: (e) => { r.w = e.target.value; refresh(); } })),
          ...m.opts.map((_, j) => h('td', null, h('input', { type: 'number', value: r.s[j], min: 0, max: 5, oninput: (e) => { r.s[j] = e.target.value; refresh(); } }))))),
        h('tr', { id: 'mtot' }, h('th', { colspan: 2 }, '總分'), ...tot.map((t) => h('th', null, String(t)))));
    };
    const refresh = () => { const tot = m.opts.map((_, j) => m.rows.reduce((a, r) => a + (parseFloat(r.s[j]) || 0) * (parseFloat(r.w) || 0), 0)); const row = tbl.querySelector('#mtot'); [...row.querySelectorAll('th')].slice(1).forEach((th, j) => (th.textContent = String(tot[j]))); };
    draw();
    el.append(h('button', { class: 'btn sm', onclick: () => { m.rows.push({ n: '', w: 1, s: m.opts.map(() => 0) }); draw(); } }, '＋ 加一個標準'));
    return { el, get: () => ({ matrix: m }) };
  }

  function sketchEditor(data) {
    const el = h('div', { class: 'field' }, h('label', null, '畫草圖'), h('div', { class: 'help' }, '用手指或滑鼠畫。畫完在下面標註尺寸和零件名稱。'));
    const cv = h('canvas', { class: 'sketch', width: 520, height: 320 }); const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 520, 320);
    if (typeof data.sketch === 'string' && data.sketch.startsWith('data:image/')) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = data.sketch; }
    let down = false, color = '#14202e', size = 3;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 520, ((e.clientY - r.top) / r.height) * 320]; };
    cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); });
    cv.addEventListener('pointermove', (e) => { if (!down) return; const [x, y] = pos(e); ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineTo(x, y); ctx.stroke(); });
    const up = () => { down = false; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    el.append(cv, h('div', { class: 'row gap' },
      ['#14202e', '#d33a3a', '#0875e2', '#1f9d55'].map((c) => h('button', { class: 'btn sm', style: 'background:' + c + ';color:#fff;border-color:' + c, onclick: () => { color = c; size = 3; } }, '筆')),
      h('button', { class: 'btn sm', onclick: () => { color = '#fff'; size = 16; } }, '橡皮擦'),
      h('button', { class: 'btn sm', onclick: () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 520, 320); } }, '全部清掉')));
    return { el, get: () => ({ sketch: cv.toDataURL('image/jpeg', 0.7) }) };
  }

  function testEditor(data) {
    const t = data.trials || [{ a: '', b: '', c: '', d: '' }, { a: '', b: '', c: '', d: '' }, { a: '', b: '', c: '', d: '' }];
    const el = h('div', { class: 'field' }, h('label', null, '測試數據'), h('div', { class: 'help' }, '一次只改一個變數，至少測 3 次。「實際結果」請填數字。'));
    const tbl = h('table', { class: 'tbl' }); const avg = h('div', { class: 'sub' });
    const calc = () => { const v = t.map((r) => parseFloat(r.c)).filter((x) => !isNaN(x)); avg.textContent = v.length ? '實際結果平均：' + (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) + '（共 ' + v.length + ' 筆）' : ''; };
    const draw = () => { tbl.replaceChildren(h('tr', null, ['第幾次', '我改變的設定', '目標', '實際結果', '備註'].map((x) => h('th', null, x))),
      ...t.map((r, i) => h('tr', null, h('td', null, String(i + 1)), ...['a', 'b', 'c', 'd'].map((k, ci) => h('td', null, h('input', { type: 'text', value: r[k], oninput: (e) => { r[k] = e.target.value; if (k === 'c') calc(); } }))))));
    };
    // 欄位：a=設定 b=目標 c=實際 d=備註
    draw(); calc();
    el.append(h('div', { style: 'overflow-x:auto' }, tbl), avg, h('button', { class: 'btn sm', onclick: () => { t.push({ a: '', b: '', c: '', d: '' }); draw(); } }, '＋ 再加一次測試'));
    return { el, get: () => ({ trials: t }) };
  }

  /* ============ 組裝教學與實體組裝挑戰 ============ */
  function labDiagramSvg(id) {
    const beam = (x1, y1, x2, y2, n, col = '#94a3b8') => {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      let holes = '';
      for (let i = 0; i < n; i++) {
        const px = n === 1 ? len / 2 : 9 + (i * (len - 18)) / (n - 1);
        holes += `<circle cx="${px.toFixed(1)}" cy="0" r="3.2" fill="#fff" stroke="#475569" stroke-width="1"/>`;
      }
      return `<g transform="translate(${x1},${y1}) rotate(${ang.toFixed(1)})"><rect x="0" y="-8" width="${len.toFixed(1)}" height="16" rx="7" fill="${col}" stroke="#334155" stroke-width="1.5"/>${holes}</g>`;
    };
    const pin = (x, y, col = '#2563eb') => `<circle cx="${x}" cy="${y}" r="4.5" fill="${col}" stroke="#fff" stroke-width="1.5"/>`;
    const gear = (cx, cy, r, t, col, lbl) => {
      let s = '';
      for (let i = 0; i < t; i++) {
        const a = (i * 2 * Math.PI) / t;
        const tx = cx + (r + 2.5) * Math.cos(a), ty = cy + (r + 2.5) * Math.sin(a);
        s += `<rect x="${(tx - 2.2).toFixed(1)}" y="${(ty - 2.2).toFixed(1)}" width="4.4" height="4.4" fill="${col}" transform="rotate(${((a * 180) / Math.PI).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)})"/>`;
      }
      return `${s}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" opacity=".85" stroke="#334155" stroke-width="1.4"/><rect x="${cx - 4}" y="${cy - 4}" width="8" height="8" rx="1" fill="#fff" stroke="#334155" stroke-width="1.2"/>${lbl ? `<text x="${cx}" y="${cy + r + 15}" text-anchor="middle" font-size="11" fill="#334155" font-weight="700">${lbl}</text>` : ''}`;
    };
    const box = (x, y, w, h2, col, lbl, tc = '#1e293b') => `<rect x="${x}" y="${y}" width="${w}" height="${h2}" rx="6" fill="${col}" stroke="#334155" stroke-width="1.5"/><text x="${x + w / 2}" y="${y + h2 / 2 + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${tc}">${lbl}</text>`;
    const txt = (x, y, s, col = '#475569', sz = 11) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${sz}" font-weight="700" fill="${col}">${s}</text>`;
    const dim = (x1, y1, x2, y2, s, col = '#0284c7') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="1.8" stroke-dasharray="4 3"/>${txt((x1 + x2) / 2, (y1 + y2) / 2 - 5, s, col, 11)}`;
    const M = {
      bl1: beam(45, 36, 175, 36, 7) + beam(45, 116, 175, 116, 7) + beam(45, 36, 45, 116, 5) + beam(175, 36, 175, 116, 5) + beam(45, 36, 175, 116, 8, '#f59e0b') + pin(45, 36) + pin(175, 36) + pin(45, 116) + pin(175, 116) + txt(265, 68, '對角斜撐梁', '#b45309', 12) + txt(265, 88, '切成兩個三角形', '#475569', 11) + txt(265, 108, '雙銷鎖固不變形', '#15803d', 11),
      bl2: beam(30, 128, 30, 76, 3, '#64748b') + beam(310, 128, 310, 76, 3, '#64748b') + beam(24, 76, 316, 76, 14) + beam(30, 76, 105, 124, 5, '#f59e0b') + beam(105, 124, 170, 76, 5, '#f59e0b') + beam(170, 76, 235, 124, 5, '#f59e0b') + beam(235, 124, 310, 76, 5, '#f59e0b') + box(125, 32, 90, 34, '#60a5fa', 'Brain＋電池', '#fff') + dim(30, 146, 310, 146, '跨距 ≥ 20 cm · 下陷 ≤ 5 mm'),
      bl3: box(32, 42, 110, 68, '#fecaca', '高重心：易翻', '#991b1b') + box(64, 24, 46, 22, '#ef4444', 'Brain', '#fff') + box(198, 72, 116, 56, '#bbf7d0', '低重心底盤', '#166534') + box(228, 86, 56, 26, '#22c55e', 'Brain+電', '#fff') + txt(256, 148, '側傾 > 25° 仍不翻倒', '#15803d', 11),
      bl4: `<circle cx="72" cy="82" r="38" fill="none" stroke="#334155" stroke-width="10"/><circle cx="72" cy="82" r="14" fill="#60a5fa"/>` + pin(72, 44, '#ef4444') + `<line x1="120" y1="120" x2="320" y2="120" stroke="#16a34a" stroke-width="4"/>` + dim(120, 104, 320, 104, '轉 3 圈 ≈ 600 mm') + txt(72, 144, '輪胎貼記號', '#dc2626', 11),
      bl5: box(36, 52, 76, 52, '#93c5fd', '雙馬達底盤') + `<line x1="120" y1="78" x2="316" y2="78" stroke="#0284c7" stroke-width="3" stroke-dasharray="6 4"/>` + `<line x1="316" y1="54" x2="316" y2="102" stroke="#22c55e" stroke-width="3"/>` + txt(215, 66, '直線前進 1000 mm', '#0284c7', 12) + txt(280, 124, '終點偏移 ≤ 50 mm', '#15803d', 11),
      bl6: box(105, 38, 130, 84, '#e2e8f0', '底盤骨架') + box(88, 44, 18, 30, '#1e293b', '', '#fff') + box(234, 44, 18, 30, '#1e293b', '', '#fff') + box(88, 88, 18, 28, '#f59e0b', '', '#fff') + box(234, 88, 18, 28, '#f59e0b', '', '#fff') + txt(52, 62, '前驅動輪', '#1e293b', 11) + txt(52, 104, '後全向輪', '#b45309', 11) + txt(170, 146, '原地轉 360° 誤差 ≤ 15°', '#0284c7', 11),
      bl7: beam(72, 34, 72, 126, 6, '#64748b') + beam(226, 34, 226, 126, 6, '#64748b') + `<line x1="56" y1="80" x2="246" y2="80" stroke="#0f172a" stroke-width="5"/>` + box(122, 48, 54, 64, '#334155', '驅動輪', '#fff') + pin(106, 80, '#f59e0b') + pin(192, 80, '#f59e0b') + txt(72, 146, '內側馬達梁', '#334155', 10) + txt(226, 146, '外側護梁雙支撐', '#15803d', 10),
      bl8: beam(55, 76, 265, 76, 10, '#cbd5e1') + gear(108, 76, 18, 12, '#f97316', '12T 主動') + gear(184, 76, 44, 36, '#3b82f6', '36T 從動') + dim(108, 24, 184, 24, '孔距 2 格（空 1 孔）') + txt(288, 74, '3:1 減速', '#15803d', 12) + txt(288, 94, '轉向相反', '#dc2626', 11),
      bl9: beam(28, 78, 312, 78, 13, '#cbd5e1') + gear(74, 78, 16, 12, '#f97316', '12T') + gear(144, 78, 28, 24, '#22c55e', '24T 惰輪') + gear(236, 78, 42, 36, '#3b82f6', '36T') + txt(170, 22, '頭尾同向轉動 · 仍是 3:1 減速', '#0284c7', 11),
      bl10: gear(68, 76, 16, 12, '#f97316', '輸入 12T') + gear(148, 76, 42, 36, '#3b82f6', '同軸 36T+12T') + gear(148, 76, 16, 12, '#f59e0b', '') + gear(238, 76, 42, 36, '#8b5cf6', '輸出 36T') + txt(170, 20, '兩級 3×3 = 9:1 複合減速（輸入 9 圈 → 輸出 1 圈）', '#6d28d9', 11),
      bl11: box(36, 86, 56, 44, '#60a5fa', '馬達+減速', '#fff') + beam(76, 106, 264, 52, 10, '#f59e0b') + pin(76, 106, '#ef4444') + box(246, 34, 44, 30, '#22c55e', '重物', '#fff') + txt(170, 146, '力臂適中＋減速齒輪＋馬達設 hold 撐 5 秒', '#15803d', 11),
      bl12: gear(140, 106, 20, 16, '#3b82f6', '') + gear(184, 106, 20, 16, '#3b82f6', '') + beam(140, 106, 104, 42, 5, '#64748b') + beam(184, 106, 220, 42, 5, '#64748b') + box(142, 32, 40, 32, '#eab308', '沙包', '#fff') + txt(162, 148, '對齒同步開合＋內側加橡膠防滑', '#b45309', 11),
      bl13: box(36, 94, 54, 40, '#64748b', '立柱', '#fff') + beam(70, 106, 256, 62, 10, '#94a3b8') + `<line x1="70" y1="42" x2="178" y2="80" stroke="#ef4444" stroke-width="3.5" stroke-dasharray="5 3"/>` + pin(70, 42, '#ef4444') + pin(178, 80, '#ef4444') + txt(165, 34, '橡皮筋向上拉（重力補償）', '#dc2626', 11) + txt(170, 148, '降下儲能、升舉省力、斷電不猛墜', '#15803d', 11),
      bl14: box(40, 44, 150, 74, '#cbd5e1', '機器人車頭') + box(168, 52, 32, 26, '#3b82f6', '距離', '#fff') + box(190, 84, 34, 24, '#ef4444', '碰撞', '#fff') + `<line x1="258" y1="24" x2="258" y2="136" stroke="#475569" stroke-width="6"/>` + txt(294, 80, '牆壁', '#475569', 12) + txt(150, 146, '碰撞開關最突出，距離感測器退縮受保護', '#dc2626', 11),
      bl15: beam(48, 56, 292, 56, 12, '#94a3b8') + box(136, 64, 68, 32, '#8b5cf6', '顏色感測器', '#fff') + `<line x1="30" y1="128" x2="310" y2="128" stroke="#334155" stroke-width="4"/>` + `<rect x="130" y="124" width="80" height="8" fill="#ef4444"/>` + dim(222, 96, 222, 126, '離地 10~35 mm') + txt(170, 148, '紅／藍／白色塊讀值穩定不磨地', '#6d28d9', 11),
      bl16: `<rect x="52" y="24" width="236" height="106" rx="8" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-dasharray="7 4"/>` + box(88, 48, 164, 68, '#bbf7d0', '起始姿態全車（馬達 ≤ 6）', '#166534') + txt(170, 18, '11" × 20" × 15"（27.9 × 50.8 × 38.1 cm）', '#0284c7', 11) + txt(170, 148, '全車放入檢錄框內 · 僅官方零件 · 線材整齊', '#15803d', 11),
    };
    const body = M[id];
    return body ? `<svg class="svgfig" viewBox="0 0 340 160" xmlns="http://www.w3.org/2000/svg" role="img" style="width:100%;max-width:460px">${body}</svg>` : '';
  }

  function compressPhoto(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1024;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h2 = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h2;
        cv.getContext('2d').drawImage(img, 0, 0, w, h2);
        resolve(cv.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('無法讀取這張照片')); };
      img.src = url;
    });
  }

  const LAB_SIM_PRESET = {
    bl1: { simCh: 'ch1', cfg: { label: '強化框架車', wheel: 'std', gear: '1:1', arm: false, sensors: [] } },
    bl2: { simCh: 'ch1', cfg: { label: '抗壓桁架車', wheel: 'std', gear: '1:1', arm: false, sensors: [] } },
    bl3: { simCh: 'ch4', cfg: { label: '低重心穩定車', wheel: 'std', gear: '1:1', arm: false, sensors: [] } },
    bl4: { simCh: 'ch1', cfg: { label: '200mm 輪測試車', wheel: 'std', gear: '1:1', arm: false, sensors: [] } },
    bl5: { simCh: 'ch1', cfg: { label: '雙馬達直線底盤', wheel: 'std', gear: '1:1', arm: false, sensors: [] } },
    bl6: { simCh: 'ch12', cfg: { label: '全向輪靈活底盤', wheel: 'omni', gear: '1:1', arm: false, sensors: [] } },
    bl7: { simCh: 'ch4', cfg: { label: '雙側支撐比賽底盤', wheel: 'omni', gear: '1:1', arm: false, sensors: [] } },
    bl8: { simCh: 'ch2', cfg: { label: '3:1 減速齒輪車', wheel: 'std', gear: '3:1', arm: false, sensors: [] } },
    bl9: { simCh: 'ch2', cfg: { label: '3:1 惰輪同向車', wheel: 'std', gear: '3:1', arm: false, sensors: [] } },
    bl10: { simCh: 'ch2', cfg: { label: '9:1 複合減速車', wheel: 'std', gear: '9:1', arm: false, sensors: [] } },
    bl11: { simCh: 'lu2', cfg: { label: '舉重手臂車', wheel: 'std', gear: '1:1', arm: true, sensors: [] } },
    bl12: { simCh: 'lu2', cfg: { label: '防滑夾爪得分車', wheel: 'omni', gear: '1:1', arm: true, sensors: [] } },
    bl13: { simCh: 'lu2', cfg: { label: '橡皮筋升舉比賽車', wheel: 'omni', gear: '1:1', arm: true, sensors: [] } },
    bl14: { simCh: 'ch10', cfg: { label: '防撞＋距離感測車', wheel: 'std', gear: '1:1', arm: false, sensors: ['bumper', 'dist'] } },
    bl15: { simCh: 'ch9', cfg: { label: '顏色感測底盤車', wheel: 'std', gear: '1:1', arm: false, sensors: ['color'] } },
    bl16: { simCh: 'lu3', cfg: { label: 'Level Up 全配比賽車', wheel: 'omni', gear: '1:1', arm: true, sensors: ['bumper', 'dist', 'color'] } },
  };

  let buildCat = 'all', buildLv = 0;
  function viewBuild(a, b) {
    const st = VX.st; st.build = st.build || {};
    const labStatus = (lab) => {
      const rec = st.build[lab.id] || {};
      if (rec.done) return 'ok';
      const hasM = rec.m && Object.values(rec.m).some((v) => v !== '' && v != null);
      const hasC = Array.isArray(rec.c) && rec.c.some(Boolean);
      const hasP = Array.isArray(rec.photos) && rec.photos.length > 0;
      return (hasM || hasC || hasP || (rec.note && rec.note.trim())) ? 'try' : 'idle';
    };
    const nav = h('div', { class: 'row gap', style: 'margin:0 0 12px;flex-wrap:wrap' },
      [['', '🛠️ 動手組裝挑戰（' + BUILD_LABS.length + ' 關）'], ['parts', '🧩 零件與套件百科'], ['lessons', '📘 機構原理圖解']].filter(([k]) => k !== '' || (VX.user && VX.user.role === 'learner')).map(([k, n]) =>
        h('a', { class: 'btn sm' + (((a || '') === k || (a === 'lab' && k === '')) ? ' primary' : ''), href: '#/build' + (k ? '/' + k : '') }, n)));

    if (a === 'lessons') {
      return paint(h('div', null, nav,
        h('p', { class: 'sub' }, '先搞懂原理，再動手挑戰實作！每一課都對應到動手組裝關卡與觀念題。'),
        BUILD.map((x) => h('div', { class: 'panel' }, h('h2', null, x.title), html(x.svg), html(x.html), h('div', { class: 'callout warn' }, x.lab),
          h('div', { class: 'row gap' }, h('a', { class: 'btn primary', href: '#/practice/' + x.skill }, '練習題：' + VX.SK[x.skill].name), h('a', { class: 'btn', href: '#/build' }, '🛠️ 去挑戰實體組裝'))))), '機構原理圖解', '📘');
    }
    if (a === 'parts') {
      const CTRL_HOTSPOTS = [
        { k: 'ab', name: '左搖桿（軸 A 上下／軸 B 左右）', desc: '最常用的駕駛控制：在 Split Arcade 模式裡，推軸 A 控制前進與後退；在 Tank 模式裡控制左輪。', code: '(Controller A position)' },
        { k: 'cd', name: '右搖桿（軸 D 上下／軸 C 左右）', desc: '在 Split Arcade 模式裡，推軸 C 控制左右轉彎，直線最穩！在 Tank 模式裡控制右輪。', code: '(Controller C position)' },
        { k: 'lr', name: '肩部按鍵（L Up／L Down、R Up／R Down）', desc: '食指最容易按到的四顆鍵！比賽時通常用來控制「手臂升降」與「夾爪開合」，雙手不用離開搖桿。', code: 'when Controller button [L Up] [pressed]' },
        { k: 'ef', name: '正面按鍵（E Up／E Down、F Up／F Down）', desc: '大拇指按鍵，適合放「慢速精準模式」、「自動歸位」或「氣動開關」等進階功能。', code: 'if <Controller E Up pressed?> then' },
        { k: 'pwr', name: '電源鍵與配對狀態燈', desc: '長按開關機；綠燈穩定代表已連上 Brain。若一直閃紅燈表示電量不足，請用 USB-C 充電。', code: '先開 Brain 再開遙控器，確認兩邊都出現連線圖示。' },
      ];
      const BRAIN_HOTSPOTS = [
        { k: 'ports', name: '12 個 Smart Ports（埠 1～12）', desc: '左右兩側各有 6 個插孔，馬達與感測器都可以任意插，但 VEXcode 裡的埠號必須跟實際插的孔完全一致！', code: '建議：左輪接 Port 1、右輪接 Port 6，線材好整理不易打結。' },
        { k: 'screen', name: '彩色螢幕與 4 顆操作鍵', desc: '左／右鍵選程式 Slot，勾選鍵（✓）執行程式，取消鍵（✕）停止程式或返回上一層。', code: 'print (Distance object distance in mm)' },
        { k: 'imu', name: '內建慣性感測器（IMU 陀螺儀）', desc: '第 2 代主機直接內建在機身裡，不用多佔一個埠！能精準測量轉彎角度與車頭方向。', code: 'calibrate BrainInertial（校準時車子要完全不動）' },
        { k: 'usbc', name: 'USB-C 下載埠與電池槽', desc: 'USB-C 接電腦下載程式；電池從側邊推入直到聽到「喀」聲鎖緊。下載程式時主機需有電。', code: '若電腦讀不到 Brain，先換一條具資料傳輸功能的 USB-C 線。' },
      ];

      // 按鈕上的短名稱（獨立字串，英文介面才翻得到）
      const HOTSPOT_SHORT = { ab: '左搖桿', cd: '右搖桿', lr: '肩部按鍵', ef: '正面按鍵', ports: '12 個 Smart Ports', imu: '內建慣性感測器' };
      let devTab = 'ctrl';
      let pickedKey = 'ab';
      const devBox = h('div', { class: 'panel hw-explorer' });
      const drawDev = () => {
        const list = devTab === 'ctrl' ? CTRL_HOTSPOTS : BRAIN_HOTSPOTS;
        const cur = list.find((x) => x.k === pickedKey) || list[0];
        devBox.replaceChildren(
          h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px' },
            h('h2', { style: 'margin:0' }, '🔍 互動按鍵與埠位說明（同步切換上方原廠 3D 模型）'),
            h('div', { class: 'row gap', style: 'margin:0' },
              h('button', { type: 'button', class: 'btn sm' + (devTab === 'ctrl' ? ' primary' : ''), onclick: () => { devTab = 'ctrl'; pickedKey = 'ab'; drawDev(); select3dPart('controller', false); } }, '🎮 遙控器按鍵'),
              h('button', { type: 'button', class: 'btn sm' + (devTab === 'brain' ? ' primary' : ''), onclick: () => { devTab = 'brain'; pickedKey = 'ports'; drawDev(); select3dPart('brain', false); } }, '🧠 Brain 主機'))),
          h('div', { class: 'row gap', style: 'flex-wrap:wrap;margin:0 0 10px' }, list.map((it) =>
            h('button', { type: 'button', class: 'btn sm' + (it.k === cur.k ? ' primary' : ''), onclick: () => { pickedKey = it.k; drawDev(); select3dPart(devTab === 'ctrl' ? 'controller' : 'brain', false); } }, HOTSPOT_SHORT[it.k] || it.name))),
          h('div', { class: 'callout', style: 'margin:0' },
            h('b', null, cur.name),
            h('p', { style: 'margin:6px 0' }, cur.desc),
            h('div', { class: 'sub' }, '💻 ', h('code', { 'data-notrans': '1' }, trCode(cur.code)))));
      };
      drawDev();

      const PART_CATS = [
        ['all', '🧰 全部零件'],
        ['core', '🧠 核心電控'],
        ['sensor', '📡 感測器'],
        ['cable', '🔌 線材與連接'],
        ['elastic', '🌀 橡皮筋與氣動'],
        ['mech', '🧱 結構與傳動'],
        ['kit', '📦 基礎／進階套件'],
      ];
      let pCat = 'all', pKit = 'all', pQuery = '';
      let active3dId = 'brain';
      const stageHost = h('div', { class: 'part3d-host' });
      const stageTitle = h('h3', { style: 'margin:0' });
      const stageDesc = h('p', { class: 'sub', style: 'margin:6px 0 8px' });
      const stageSel = h('select', { 'aria-label': '選擇要 3D 檢視的零件' },
        PARTS.map((p) => h('option', { value: p.id }, p.ic + ' ' + p.n)));
      let viewer3d = null;
      const autoBtn = h('button', { type: 'button', class: 'btn sm', onclick: () => {
        if (!viewer3d) return;
        const on = viewer3d.toggleAuto();
        autoBtn.textContent = on ? '⏸ 暫停旋轉' : '▶ 自動旋轉';
      } }, '⏸ 暫停旋轉');
      const bgBtn = h('button', { type: 'button', class: 'btn sm', onclick: () => {
        if (!viewer3d) return;
        const m = viewer3d.cycleBg();
        bgBtn.textContent = m === 'auto' ? '🌗 背景：自動對比' : m === 'light' ? '☀️ 背景：淺色棚' : '🌙 背景：深色棚';
      } }, '🌗 背景：自動對比');
      const select3dPart = (id, scroll) => {
        const p = PARTS.find((x) => x.id === id) || PARTS[0];
        active3dId = p.id;
        stageSel.value = p.id;
        stageTitle.textContent = p.ic + ' ' + p.n;
        stageDesc.textContent = p.z;
        if (viewer3d) viewer3d.setPart(p.id);
        if (scroll) stagePanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      stageSel.addEventListener('change', () => select3dPart(stageSel.value, false));
      const stagePanel = h('div', { class: 'panel part3d-panel' },
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px' },
          h('h2', { style: 'margin:0' }, '🧊 VEX IQ 原廠 3D CAD 零件檢視器'),
          stageSel),
        h('div', { class: 'part3d-layout' },
          stageHost,
          h('div', { class: 'part3d-info' },
            stageTitle, stageDesc,
            h('div', { class: 'row gap', style: 'flex-wrap:wrap;margin-top:8px' },
              h('button', { type: 'button', class: 'btn sm', onclick: () => viewer3d && viewer3d.zoomIn() }, '＋ 放大'),
              h('button', { type: 'button', class: 'btn sm', onclick: () => viewer3d && viewer3d.zoomOut() }, '－ 縮小'),
              autoBtn,
              bgBtn,
              h('button', { type: 'button', class: 'btn ghost sm', onclick: () => viewer3d && viewer3d.reset() }, '↺ 重置視角')),
            h('div', { class: 'sub', style: 'margin-top:8px' }, '👆 手指或滑鼠拖曳可 360° 旋轉原廠 CAD 3D 模型；背景會依元件深淺自動切換高對比色。'))));

      const listBox = h('div', { class: 'parts-grid' });
      const countEl = h('div', { class: 'sub', style: 'margin:6px 0 10px' });
      const catBar = h('div', { class: 'row gap', style: 'flex-wrap:wrap;margin:0 0 8px' });
      const kitBar = h('div', { class: 'row gap', style: 'flex-wrap:wrap;margin:0 0 8px' });
      const qInp = h('input', { type: 'text', placeholder: '搜尋零件、線材、橡皮筋、套件…', 'aria-label': '搜尋零件與套件' });

      const drawParts = () => {
        catBar.replaceChildren(...PART_CATS.map(([id, label]) =>
          h('button', { type: 'button', class: 'btn sm' + (pCat === id ? ' primary' : ''), onclick: () => { pCat = id; drawParts(); } }, label)));
        kitBar.replaceChildren(...[['all', '全部套件'], ['basic', '📦 基礎套件'], ['adv', '🏆 進階／競賽']].map(([id, label]) =>
          h('button', { type: 'button', class: 'btn sm' + (pKit === id ? ' primary' : ' ghost'), onclick: () => { pKit = id; drawParts(); } }, label)));
        const kw = pQuery.trim().toLowerCase();
        const filtered = PARTS.filter((p) => {
          if (pCat !== 'all' && p.cat !== pCat) return false;
          if (pKit !== 'all' && p.kit !== pKit) return false;
          if (kw && !(p.n + ' ' + p.z + ' ' + (p.tip || '') + ' ' + (p.code || '')).toLowerCase().includes(kw)) return false;
          return true;
        });
        countEl.textContent = '顯示 ' + filtered.length + ' / ' + PARTS.length + ' 項硬體與套件說明';
        listBox.replaceChildren(...(filtered.length
          ? filtered.map((p) => h('div', { class: 'card part-card' },
            h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start;gap:6px' },
              h('h3', { style: 'margin:0' }, p.ic + ' ' + p.n),
              p.kit ? h('span', { class: 'tag ' + (p.kit === 'adv' ? 'try' : 'done') }, p.kit === 'adv' ? '進階／競賽' : '基礎套件') : null),
            h('p', { class: 'part-desc' }, p.z),
            p.tip ? h('div', { class: 'part-tip' }, '💡 ', p.tip) : null,
            p.code ? h('div', { class: 'part-code' }, '💻 ', h('code', { 'data-notrans': '1' }, trCode(p.code))) : null,
            h('div', { class: 'row', style: 'margin-top:auto;padding-top:6px' },
              h('button', { type: 'button', class: 'btn primary sm', onclick: () => select3dPart(p.id, true) }, '🧊 原廠 3D 模型檢視'))))
          : [h('div', { class: 'panel center' }, '找不到符合條件的零件，試試換個關鍵字或點「全部零件」。')]));
      };
      qInp.addEventListener('input', () => { pQuery = qInp.value; drawParts(); });
      drawParts();

      const genCompare = h('div', { class: 'panel' },
        h('h3', { style: 'margin-top:0' }, '🔄 VEX IQ 第 1 代 vs 第 2 代硬體差異對照'),
        h('p', { class: 'sub' }, '補習班或學校可能同時有第 1 代與第 2 代零件——大部分梁、銷、齒輪與智慧馬達兩代完全通用，主要差別在主機與感測器：'),
        h('table', { class: 'tbl' },
          h('tr', null, h('th', null, '項目'), h('th', null, '第 1 代（1st Gen）'), h('th', null, '第 2 代（2nd Gen）')),
          h('tr', null, h('td', null, h('b', null, 'Brain 主機螢幕')), h('td', null, '單色灰綠液晶面板'), h('td', null, '彩色高對比液晶面板（支援圖示選單）')),
          h('tr', null, h('td', null, h('b', null, '陀螺儀（IMU）')), h('td', null, '需外接獨立 Gyro 感測器（佔 1 個埠）'), h('td', null, '主機直接內建慣性感測器（不佔埠）')),
          h('tr', null, h('td', null, h('b', null, '無線電與下載埠')), h('td', null, '側邊外插藍色 Smart Radio 模組、Micro-USB'), h('td', null, '主機內建雙頻無線、USB-C 埠＋microSD 槽')),
          h('tr', null, h('td', null, h('b', null, '電池')), h('td', null, '鎳氫電池（NiMH，專用座充）'), h('td', null, '鋰離子電池（Li-Ion，USB-C 充電）')),
          h('tr', null, h('td', null, h('b', null, '距離／顏色感測')), h('td', null, '超音波 Distance、第 1 代 Color'), h('td', null, '雷射 Distance（更準）、Optical（含補光燈）'))),
        h('div', { class: 'sub', style: 'margin-top:8px' }, '官方參考：',
          h('a', { href: 'https://kb.vex.com/hc/zh-tw/articles/7267344764308-%E4%BA%86%E8%A7%A3%E6%99%BA%E5%95%86-%E7%AC%AC%E4%B8%80%E4%BB%A3-%E8%88%87-%E7%AC%AC%E4%BA%8C%E4%BB%A3', target: '_blank', rel: 'noopener noreferrer' }, '了解 VEX IQ 第 1 代與第 2 代 ↗'), '　·　',
          h('a', { href: 'https://kb.vex.com/hc/zh-tw/articles/360055332931-VEXos-IQ-%E7%AC%AC%E4%B8%80%E4%BB%A3-%E9%9F%8C%E9%AB%94%E6%9B%B4%E6%96%B0%E6%97%A5%E8%AA%8C', target: '_blank', rel: 'noopener noreferrer' }, 'VEXos 韌體更新日誌 ↗')));

      paint(h('div', null, nav,
        h('p', { class: 'sub' }, '從主機、遙控器、感測器、智慧線材、橡皮筋，到基礎與進階學習套件完整圖解，幫助你認識手邊每一個零件怎麼用、怎麼保養！'),
        stagePanel,
        devBox,
        genCompare,
        h('div', { class: 'panel' },
          h('h3', { style: 'margin-top:0' }, '📚 完整零件、線材與套件一覽'),
          catBar, kitBar, qInp, countEl, h('div', { class: 'parts-wrap' }, listBox))), '零件與套件百科', '🧩');
      if (VX.part3d && VX.part3d.mount) {
        viewer3d = VX.part3d.mount(stageHost, active3dId);
        select3dPart(active3dId, false);
      }
      return;
    }

    if (a === 'lab' && b) {
      const lab = BUILD_LABS.find((x) => x.id === b);
      if (!lab) { location.hash = '#/build'; return; }
      const rec = st.build[lab.id] || (st.build[lab.id] = { done: false, m: {}, c: [], photos: [], note: '' });
      rec.m = rec.m || {}; rec.c = rec.c || []; rec.photos = rec.photos || [];
      const catObj = BUILD_LAB_CATS.find((x) => x.id === lab.cat);
      const parseNum = (s) => {
        const norm = String(s == null ? '' : s).replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).replace(/[．。]/g, '.').replace(/[－—–]/g, '-').replace(/[,，\s]/g, '');
        return norm === '' ? NaN : parseFloat(norm);
      };

      const statusBox = h('div');
      const mRows = [];
      const evalAll = (celebrate) => {
        let allMOk = true;
        lab.measures.forEach((ms, idx) => {
          const val = parseNum(rec.m[ms.k]);
          const row = mRows[idx];
          const filled = !isNaN(val);
          const ok = filled && val >= ms.min - 1e-9 && val <= ms.max + 1e-9;
          if (!ok) allMOk = false;
          if (row) {
            row.el.className = 'm-row' + (!filled ? '' : ok ? ' m-ok' : ' m-bad');
            row.tip.className = 'm-tip' + (ok ? ' ok' : '');
            row.tip.textContent = !filled ? ('請實測後填入數字（合格範圍：' + ms.min + ' ～ ' + ms.max + ' ' + ms.unit + '）')
              : ok ? ('✅ 實測 ' + val + ' ' + ms.unit + '，符合合格標準！')
              : ('❌ ' + ms.failTip);
          }
        });
        const allCOk = lab.checks.every((_, i) => !!rec.c[i]);
        const passed = allMOk && allCOk;
        const firstPass = passed && !rec.done;
        rec.done = passed;
        if (passed && !rec.t) rec.t = Date.now();
        VX.saveState();
        if (firstPass && celebrate) {
          if (VX.act) VX.act('challenge');
          toast('🎉 實體組裝驗證通過！');
          if (window.VXFX) setTimeout(() => window.VXFX.confetti(), 120);
        }
        const idx = BUILD_LABS.findIndex((x) => x.id === lab.id);
        const nextLab = idx >= 0 && idx + 1 < BUILD_LABS.length ? BUILD_LABS[idx + 1] : null;
        statusBox.replaceChildren(passed
          ? h('div', { class: 'callout' },
            h('b', null, '🟢 實體驗證通過！'), ' 這個機構已經達標囉，記得拍照存證並存進工程筆記。',
            h('div', { class: 'row gap', style: 'margin-top:8px' },
              nextLab ? h('a', { class: 'btn primary sm', href: '#/build/lab/' + nextLab.id }, '下一個組裝挑戰：' + nextLab.title + ' ›') : null,
              h('a', { class: 'btn sm', href: '#/build' }, '回組裝挑戰列表')))
          : h('div', { class: 'callout warn' },
            h('b', null, '🟡 尚未全部通過：'),
            !allMOk ? '請完成並讓所有「實測數據」落在合格範圍內。' : '',
            !allCOk ? '請逐項確認並勾選所有「實體檢核表」項目。' : ''));
      };

      const measuresBox = lab.measures.length ? h('div', null,
        h('h3', null, '📏 實測數據自動驗算'),
        lab.measures.map((ms) => {
          const inp = h('input', { type: 'text', inputmode: 'decimal', placeholder: ms.min + '～' + ms.max });
          inp.value = rec.m[ms.k] == null ? '' : String(rec.m[ms.k]);
          const tip = h('div', { class: 'm-tip' });
          const el = h('div', { class: 'm-row' },
            h('b', null, ms.label),
            h('div', { class: 'm-in' }, inp, h('span', null, ms.unit), h('span', { class: 'sub' }, '（標準：' + ms.min + ' ～ ' + ms.max + ' ' + ms.unit + '）')),
            tip);
          inp.addEventListener('input', () => { rec.m[ms.k] = inp.value; evalAll(true); });
          mRows.push({ el, tip });
          return el;
        })) : null;

      const checksBox = h('div', null,
        h('h3', null, '✅ 實體動手檢核表'),
        lab.checks.map((txt, i) => {
          const cb = h('input', { type: 'checkbox' }); cb.checked = !!rec.c[i];
          cb.addEventListener('change', () => { rec.c[i] = cb.checked; evalAll(true); });
          return h('label', { class: 'check' }, cb, h('span', null, txt));
        }));

      const photoBox = h('div');
      const drawPhotos = () => {
        photoBox.replaceChildren(
          rec.photos.length ? h('div', { class: 'photo-grid' }, rec.photos.map((url, idx) =>
            h('div', { class: 'photo-item' },
              h('img', { src: url, alt: lab.title, onclick: () => window.open(url, '_blank') }),
              h('button', { type: 'button', class: 'pdel', title: '刪除照片', onclick: async () => {
                if (!confirm('刪除這張作品照片？')) return;
                const fname = url.split('/').pop();
                rec.photos.splice(idx, 1); VX.saveState(); drawPhotos();
                try { await api('/api/photos/' + fname + '/delete', {}); } catch (e) {}
              } }, '×'))))
          : h('p', { class: 'sub' }, '還沒拍照。用 iPad 或手機拍下你的實體作品，之後可一鍵存進工程筆記！'));
      };
      const fileIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none' });
      const uploadBtn = h('button', { type: 'button', class: 'btn', onclick: () => fileIn.click() }, '📷 拍下我的作品／選擇照片');
      fileIn.addEventListener('change', async () => {
        const f = fileIn.files && fileIn.files[0]; fileIn.value = '';
        if (!f) return;
        if (rec.photos.length >= 4) return toast('這關最多存 4 張照片，先刪掉一張再拍喔');
        uploadBtn.disabled = true; uploadBtn.textContent = '上傳中…';
        try {
          const dataUrl = await compressPhoto(f);
          const res = await api('/api/photos', { data: dataUrl });
          rec.photos.push(res.url);
          VX.saveState(); drawPhotos();
          toast('照片已上傳 ✔');
        } catch (e) { toast(e.message || '照片上傳失敗'); }
        uploadBtn.disabled = false; uploadBtn.textContent = '📷 拍下我的作品／選擇照片';
      });
      drawPhotos();

      const noteTa = h('textarea', { placeholder: '記錄你的設計想法、卡關的地方或改良點（選填）', style: 'min-height:70px' });
      noteTa.value = rec.note || '';
      noteTa.addEventListener('input', () => { rec.note = noteTa.value; VX.saveState(); });

      const saveToNotebook = async () => {
        const summary = [];
        lab.measures.forEach((ms) => { if (rec.m[ms.k] !== '' && rec.m[ms.k] != null) summary.push(ms.label + '：' + rec.m[ms.k] + ' ' + ms.unit); });
        const chkDone = lab.checks.filter((_, i) => rec.c[i]).length;
        summary.push('實體檢核：' + chkDone + ' / ' + lab.checks.length + ' 項');
        try {
          await api('/api/notes', {
            kind: 'test',
            title: '🔧 組裝實測：' + lab.title,
            data: {
              f: {
                date: VX.todayStr(),
                author: (VX.user && (VX.user.display || VX.user.name)) || '',
                what: lab.title + '（' + lab.goal + '）',
                setup: lab.parts,
                find: summary.join('\n') + (rec.note ? '\n心得：' + rec.note : ''),
                next: rec.done ? '已通過實體驗證，準備挑戰下一個機構！' : '繼續微調機構直到全部檢核通過。',
              },
              c: lab.checks.map((_, i) => !!rec.c[i]),
              photos: rec.photos.slice(),
            },
          });
          if (VX.act) VX.act('note');
          VX.saveState();
          toast('已存成一頁工程筆記 ✔');
        } catch (e) { toast(e.message || '存入失敗'); }
      };

      evalAll(false);
      return paint(h('div', null,
        h('a', { class: 'back', href: '#/build' }, '‹ 回實體組裝挑戰列表'),
        h('div', { class: 'panel' },
          h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px' },
            h('span', { class: 'tag' }, (catObj ? catObj.ic + ' ' + catObj.name : '')),
            h('span', { class: 'stars' }, '難度 ' + stars(lab.lv))),
          h('h1', { style: 'margin-top:6px' }, lab.title),
          h('p', null, h('b', null, '🎯 任務目標：'), lab.goal),
          h('div', { class: 'callout' }, h('b', null, '🔩 建議零件：'), lab.parts),
          h('h3', null, '📐 機構示意圖與組裝要點'),
          html(labDiagramSvg(lab.id)),
          h('ol', null, lab.steps.map((s) => h('li', null, s))),
          measuresBox,
          checksBox,
          h('h3', null, '📷 作品拍照存證（最多 4 張）'),
          fileIn, uploadBtn, photoBox,
          h('h3', null, '📝 改良心得（選填）'),
          noteTa,
          statusBox,
          h('div', { class: 'row gap', style: 'margin-top:12px' },
            h('button', { type: 'button', class: 'btn green', onclick: () => {
              const pr = LAB_SIM_PRESET[lab.id] || { simCh: '', cfg: { label: lab.title, wheel: 'std', gear: '1:1', arm: false, sensors: [] } };
              st.robotCfg = Object.assign({}, pr.cfg, { fromLab: lab.id });
              VX.saveState();
              toast('已載入「' + pr.cfg.label + '」，帶你進模擬練習場試開！');
              location.hash = pr.simCh ? '#/sim/' + pr.simCh : '#/sim';
            } }, '🖥️ 丟到 2D 模擬場試開'),
            h('button', { type: 'button', class: 'btn primary', onclick: () => {
              const pr = LAB_SIM_PRESET[lab.id] || { simCh: '', cfg: { label: lab.title, wheel: 'std', gear: '1:1', arm: false, sensors: [] } };
              st.robotCfg = Object.assign({}, pr.cfg, { fromLab: lab.id });
              VX.saveState();
              toast('已載入「' + pr.cfg.label + '」，進入 3D Level Up 練習場！');
              location.hash = '#/arena3d';
            } }, '🏟️ 丟到 3D 場地試開'),
            h('button', { type: 'button', class: 'btn primary', onclick: saveToNotebook }, '📓 一鍵存入工程筆記'),
            h('a', { class: 'btn', href: '#/practice/' + lab.skill }, '✏️ 相關觀念題：' + VX.SK[lab.skill].name)))), lab.title, '🔧');
    }

    // 預設主頁：16 關實體組裝挑戰列表（可依主題／難度挑選）
    const okN = BUILD_LABS.filter((x) => labStatus(x) === 'ok').length;
    const tryN = BUILD_LABS.filter((x) => labStatus(x) === 'try').length;
    const idleN = BUILD_LABS.length - okN - tryN;
    const filtered = BUILD_LABS.filter((x) => (buildCat === 'all' || x.cat === buildCat) && (!buildLv || x.lv === buildLv));
    const card = (lab) => {
      const rec = st.build[lab.id] || {};
      const stt = labStatus(lab);
      const cls = 'card' + (stt === 'ok' ? ' card-lit-ok' : stt === 'try' ? ' card-lit-try' : '');
      const lampTitle = stt === 'ok' ? '已通過' : stt === 'try' ? '練習中' : '尚未練習';
      const catObj = BUILD_LAB_CATS.find((x) => x.id === lab.cat);
      const pCnt = Array.isArray(rec.photos) ? rec.photos.length : 0;
      return h('a', { class: cls, href: '#/build/lab/' + lab.id },
        h('h3', null, h('span', { class: 'lamp ' + stt, title: lampTitle }), lab.title,
          stt === 'ok' ? h('span', { class: 'tag done' }, ' ✓ 驗證通過') : null,
          stt === 'try' ? h('span', { class: 'tag try' }, '組裝測試中') : null),
        h('div', { class: 'stars' }, stars(lab.lv)),
        h('p', { class: 'sub' }, lab.goal),
        catObj ? h('span', { class: 'tag' }, catObj.ic + ' ' + catObj.name) : null,
        lab.measures.length ? h('span', { class: 'tag' }, '📏 含實測驗算') : null,
        pCnt ? h('span', { class: 'tag done' }, '📷 ' + pCnt + ' 張') : null);
    };

    paint(h('div', null, nav,
      h('p', { class: 'sub' }, '挑一個你感興趣的機構題目，拿出 VEX IQ 零件動手設計、組裝、量測驗證，還能直接拍照存入工程筆記！'),
      h('div', { class: 'lamp-legend' },
        h('span', null, h('span', { class: 'lamp ok' }), '已通過 ' + okN + ' / ' + BUILD_LABS.length),
        h('span', null, h('span', { class: 'lamp try' }), '組裝測試中 ' + tryN),
        h('span', null, h('span', { class: 'lamp idle' }), '尚未練習 ' + idleN)),
      h('div', { class: 'row gap', style: 'margin-bottom:8px' },
        BUILD_LAB_CATS.map((c) => h('button', { type: 'button', class: 'btn sm' + (buildCat === c.id ? ' primary' : ''), onclick: () => { buildCat = c.id; viewBuild(); } }, c.ic + ' ' + c.name))),
      h('div', { class: 'row gap', style: 'margin-bottom:14px' },
        [[0, '全部難度'], [1, '★ Lv1'], [2, '★★ Lv2'], [3, '★★★ Lv3'], [4, '★★★★ Lv4']].map(([lv, lb]) =>
          h('button', { type: 'button', class: 'btn sm' + (buildLv === lv ? ' primary' : ''), onclick: () => { buildLv = lv; viewBuild(); } }, lb))),
      filtered.length ? h('div', { class: 'grid2' }, filtered.map(card)) : h('p', { class: 'sub' }, '這個篩選條件下沒有題目，換個主題或難度看看！')), '實體組裝挑戰', '🔧');
  }

  /* ============ 比賽專區 ============ */
  async function viewCompete(a, b) {
    const nav = h('div', { class: 'row gap', style: 'margin:10px 0' }, [['', '總覽'], ['timer', '⏱️ 場地計時記分'], ['prep', '🎒 賽前準備與分工'], ['season', '當季 Level Up'], ['plan', '得分規劃器'], ['taiwan', '🇹🇼 台灣賽事路線'], ['skills', '技能賽練習'], ['vocab', '英中術語卡'], ['interview', '面談練習']].map(([k, n]) => h('a', { class: 'btn sm' + ((a || '') === k ? ' primary' : ''), href: '#/compete' + (k ? '/' + k : '') }, n)));
    if (a === 'timer') return matchTimer(nav);
    if (a === 'prep') return prep(nav);
    if (a === 'season') return season(nav);
    if (a === 'plan') return planner(nav);
    if (a === 'taiwan') return VX.taiwanPage(nav);
    if (a === 'vocab') return vocab(nav);
    if (a === 'interview') return interview(nav);
    if (a === 'skills') return skills(nav);
    paint(h('div', null, nav,
      h('div', { class: 'panel' }, h('h2', null, '🏆 比賽專區'), h('p', null, '長期目標是參加區域賽、國際賽。這裡幫你把「機器人能力」和「表達能力」一起練起來。'),
        h('div', { class: 'tiles' },
          h('a', { class: 'tile', href: '#/arena3d', style: 'background:#0ea5e9;border-color:#0369a1;color:#fff' }, h('span', { class: 'ti' }, '🏟️'), '3D 練習場', h('small', { style: 'color:rgba(255,255,255,.9)' }, '3D 投球得分＋音效')),
          h('a', { class: 'tile', href: '#/pathplan', style: 'background:#10b981;border-color:#047857;color:#fff' }, h('span', { class: 'ti' }, '🗺️'), '自動路徑規劃器', h('small', { style: 'color:rgba(255,255,255,.9)' }, '點路線轉積木／Python')),
          h('a', { class: 'tile', href: '#/compete/timer', style: 'background:#ef4444;border-color:#b91c1c;color:#fff' }, h('span', { class: 'ti' }, '🚨'), '場地計時與記分', h('small', { style: 'color:rgba(255,255,255,.9)' }, '60秒倒數＋官方音效')),
          h('a', { class: 'tile', href: '#/compete/prep', style: 'background:#8b5cf6;border-color:#6d28d9;color:#fff' }, h('span', { class: 'ti' }, '🎒'), '賽前準備與分工', h('small', { style: 'color:rgba(255,255,255,.9)' }, '組隊、駕駛模式、清單')),
          h('a', { class: 'tile', href: '#/compete/season', style: 'background:#f1ae34;border-color:#b38136' }, h('span', { class: 'ti' }, '🎯'), '當季 Level Up', h('small', null, '規則、計分、策略')),
          h('a', { class: 'tile', href: '#/control', style: 'background:#14b8a6;border-color:#0f766e;color:#fff' }, h('span', { class: 'ti' }, '🧪'), '控制實驗室', h('small', { style: 'color:rgba(255,255,255,.9)' }, '走直線、PID、里程計')),
          h('a', { class: 'tile', href: '#/compete/taiwan', style: 'background:#f97316;border-color:#c2410c;color:#fff' }, h('span', { class: 'ti' }, '🇹🇼'), '台灣賽事路線', h('small', { style: 'color:rgba(255,255,255,.9)' }, '邀請賽→預賽→冠軍賽')),
          h('a', { class: 'tile', href: '#/compete/skills', style: 'background:#77b2ff;border-color:#5a85bb' }, h('span', { class: 'ti' }, '⏱️'), '技能賽練習', h('small', null, '記錄分數、看進步')),
          h('a', { class: 'tile', href: '#/compete/vocab', style: 'background:#bf9dee;border-color:#8d76ae' }, h('span', { class: 'ti' }, '🔤'), '英中術語卡', h('small', null, '比賽英文單字')),
          h('a', { class: 'tile', href: '#/compete/interview', style: 'background:#5ecd98;border-color:#4a9873' }, h('span', { class: 'ti' }, '🎤'), '面談練習', h('small', null, '練習跟評審說明')),
          h('a', { class: 'tile', href: '#/notebook', style: 'background:#f2cd16;border-color:#b4982e' }, h('span', { class: 'ti' }, '📓'), '工程筆記', h('small', null, '設計獎的關鍵')),
          h('a', { class: 'tile', href: '#/resources', style: 'background:#a5d8ff;border-color:#5a85bb' }, h('span', { class: 'ti' }, '🔗'), '學習資源', h('small', null, 'VEX 官方與開源專案')))),
      h('div', { class: 'panel' }, h('h3', null, '比賽都在比什麼？（概念）'),
        h('ul', null, h('li', null, h('b', null, 'Robot Skills（技能賽）'), '：單一機器人在限定時間內盡量得分，分「手動駕駛」和「自動程式」兩種，一個人也可以練。'),
          h('li', null, h('b', null, 'Teamwork（團隊合作賽）'), '：兩支隊伍組成聯盟一起得分，要溝通、互相配合。'),
          h('li', null, h('b', null, '評審獎項'), '：看工程筆記、評審面談和機器人設計。這是你的筆記和英文表達派上用場的地方。')),
        h('div', { class: 'callout warn' }, '當季是 VEX IQ 2026–2027「Level Up」，規則整理在「當季 Level Up」頁。規則每年不同、手冊也會更新，一切以官方 Game Manual 為準。'))), '比賽專區', '🏆');
  }

  /* ============ 官方比賽場地計時器與即時記分板（含場地音效）============ */
  let tmInterval = 0, tmAudio = null;
  function matchTimer(nav) {
    clearInterval(tmInterval); tmInterval = 0;
    let mode = 'teamwork', state = 'idle', preSec = 0, leftMs = 60000, endAt = 0, soundOn = true;
    let firedSwitchStart = false, firedSwitchEnd = false, lastTickSec = 61;
    const counts = SEASON.scoring.map(() => 0);

    const tone = (freq, dur, type = 'square', vol = 0.16, delay = 0) => {
      if (!soundOn) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        tmAudio = tmAudio || new AC();
        if (tmAudio.state === 'suspended') tmAudio.resume();
        const t0 = tmAudio.currentTime + delay;
        const osc = tmAudio.createOscillator(), g = tmAudio.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g); g.connect(tmAudio.destination);
        osc.start(t0); osc.stop(t0 + dur + 0.03);
      } catch (e) {}
    };
    const sfx = {
      count: () => tone(880, 0.14, 'sine', 0.2),
      start: () => { tone(523, 0.14, 'sawtooth', 0.16, 0); tone(659, 0.14, 'sawtooth', 0.16, 0.13); tone(784, 0.14, 'sawtooth', 0.16, 0.26); tone(1046, 0.45, 'sawtooth', 0.2, 0.39); },
      switchStart: () => { tone(988, 0.18, 'triangle', 0.24, 0); tone(1318, 0.28, 'triangle', 0.24, 0.2); },
      switchEnd: () => { tone(1318, 0.16, 'triangle', 0.22, 0); tone(988, 0.24, 'triangle', 0.22, 0.18); },
      tick: () => tone(740, 0.08, 'square', 0.12),
      end: () => { tone(196, 1.05, 'sawtooth', 0.22, 0); tone(247, 1.05, 'sawtooth', 0.18, 0); },
      abort: () => { tone(440, 0.16, 'sawtooth', 0.16, 0); tone(294, 0.25, 'sawtooth', 0.16, 0.18); },
    };

    const screen = h('div', { class: 'tm-screen' });
    const clockEl = h('div', { class: 'tm-clock' }, '01:00');
    const phaseEl = h('div', { class: 'tm-phase' }, '準備就緒 — 按下「開始比賽」啟動 3-2-1 倒數與場地音效');
    const barFill = h('div', { style: 'width:100%' });
    screen.append(clockEl, phaseEl, h('div', { class: 'tm-bar' }, barFill));

    const fmtClock = (ms) => {
      const s = Math.max(0, Math.ceil(ms / 1000));
      return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    };
    const updateDisplay = () => {
      if (!document.body.contains(screen)) { clearInterval(tmInterval); tmInterval = 0; return; }
      if (state === 'pre') {
        screen.className = 'tm-screen switch';
        clockEl.textContent = '00:0' + preSec;
        phaseEl.textContent = '準備出發… ' + preSec;
        barFill.style.width = '100%'; barFill.style.background = '#f59e0b';
        return;
      }
      const sec = Math.max(0, Math.ceil(leftMs / 1000));
      clockEl.textContent = fmtClock(leftMs);
      barFill.style.width = Math.max(0, Math.min(100, (leftMs / 60000) * 100)) + '%';
      if (state === 'idle') {
        screen.className = 'tm-screen';
        phaseEl.textContent = '準備就緒 — 按下「開始比賽」啟動 3-2-1 倒數與場地音效';
        barFill.style.background = '#22c55e';
      } else if (state === 'done') {
        screen.className = 'tm-screen warn';
        phaseEl.textContent = '🏁 時間到！請立刻放下遙控器，開始計算本場得分';
        barFill.style.background = '#ef4444';
      } else if (sec <= 10) {
        screen.className = 'tm-screen warn';
        phaseEl.textContent = '🔥 最後 ' + sec + ' 秒衝刺！';
        barFill.style.background = '#ef4444';
      } else if (mode === 'teamwork' && sec <= 35 && sec >= 25) {
        screen.className = 'tm-screen switch';
        phaseEl.textContent = '🔄 換手時間（35 秒～25 秒）！請交接遙控器';
        barFill.style.background = '#f59e0b';
      } else {
        screen.className = 'tm-screen run';
        phaseEl.textContent = mode === 'teamwork' ? '🤝 團隊合作賽進行中！' : mode === 'driver' ? '🎮 手動駕駛技能賽進行中！' : '🤖 自動程式技能賽進行中（請勿碰遙控器）！';
        barFill.style.background = '#22c55e';
      }
    };

    const startMatch = () => {
      clearInterval(tmInterval);
      state = 'pre'; preSec = 3; leftMs = 60000;
      firedSwitchStart = false; firedSwitchEnd = false; lastTickSec = 61;
      sfx.count(); updateDisplay(); drawCtrl();
      tmInterval = setInterval(() => {
        if (!document.body.contains(screen)) { clearInterval(tmInterval); tmInterval = 0; return; }
        if (state === 'pre') {
          preSec--;
          if (preSec > 0) { sfx.count(); updateDisplay(); }
          else {
            state = 'run'; endAt = Date.now() + 60000;
            sfx.start(); updateDisplay(); drawCtrl();
          }
          return;
        }
        if (state === 'run') {
          leftMs = Math.max(0, endAt - Date.now());
          const sec = Math.ceil(leftMs / 1000);
          if (mode === 'teamwork' && sec <= 35 && !firedSwitchStart) { firedSwitchStart = true; sfx.switchStart(); }
          if (mode === 'teamwork' && sec <= 25 && !firedSwitchEnd) { firedSwitchEnd = true; sfx.switchEnd(); }
          if (sec <= 10 && sec >= 1 && sec < lastTickSec) { lastTickSec = sec; sfx.tick(); }
          if (leftMs <= 0) {
            clearInterval(tmInterval); tmInterval = 0; state = 'done';
            sfx.end(); updateDisplay(); drawCtrl();
            if (window.VXFX) window.VXFX.confetti();
            return;
          }
          updateDisplay();
        }
      }, 100);
    };
    const abortMatch = () => { clearInterval(tmInterval); tmInterval = 0; state = 'idle'; leftMs = 60000; sfx.abort(); updateDisplay(); drawCtrl(); };
    const resetMatch = () => { clearInterval(tmInterval); tmInterval = 0; state = 'idle'; leftMs = 60000; updateDisplay(); drawCtrl(); };

    const ctrlBox = h('div', { class: 'row gap', style: 'justify-content:center;margin:10px 0' });
    const drawCtrl = () => {
      ctrlBox.replaceChildren(
        state === 'idle' || state === 'done'
          ? h('button', { type: 'button', class: 'btn green', style: 'font-size:1.1rem;padding:10px 24px', onclick: startMatch }, '▶ 開始比賽（3-2-1 倒數）')
          : h('button', { type: 'button', class: 'btn danger', style: 'font-size:1.05rem;padding:10px 22px', onclick: abortMatch }, '⏹ 緊急中止'),
        h('button', { type: 'button', class: 'btn', onclick: resetMatch }, '↺ 重設 01:00'),
        h('button', { type: 'button', class: 'btn sm', onclick: () => { soundOn = !soundOn; drawCtrl(); } }, soundOn ? '🔊 場地音效：開' : '🔇 場地音效：關'),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { sfx.start(); toast('已播放開場喇叭聲！'); } }, '📣 測試音效'),
        document.fullscreenEnabled ? h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { if (document.fullscreenElement) document.exitFullscreen(); else screen.requestFullscreen && screen.requestFullscreen().catch(() => {}); } }, '🖥️ 全螢幕') : null);
    };

    const modeBox = h('div', { class: 'row gap', style: 'justify-content:center;margin-bottom:8px' });
    const drawModes = () => {
      modeBox.replaceChildren(
        [['teamwork', '🤝 團隊合作賽（含 35s～25s 換手鈴）'], ['driver', '🎮 手動駕駛技能賽'], ['auto', '🤖 自動程式技能賽']].map(([k, lb]) =>
          h('button', { type: 'button', class: 'btn sm' + (mode === k ? ' primary' : ''), disabled: state === 'run' || state === 'pre', onclick: () => { mode = k; drawModes(); updateDisplay(); } }, lb)));
    };

    // 即時 Level Up 比賽記分板
    const scoreTotalEl = h('div', { style: 'font-size:2rem;font-weight:900;color:var(--accent)' }, '0 分');
    const scoreGrid = h('div', { class: 'tm-score-grid' });
    const totalScore = () => SEASON.scoring.reduce((a, r, i) => a + counts[i] * r.p, 0);
    const drawScoreboard = () => {
      scoreTotalEl.textContent = totalScore() + ' 分';
      scoreGrid.replaceChildren(...SEASON.scoring.map((r, i) =>
        h('div', { class: 'tm-scard' },
          h('div', { style: 'font-weight:700;font-size:.92rem' }, r.n),
          h('div', { class: 'sub' }, r.p + ' 分 / 個'),
          h('div', { class: 'row', style: 'justify-content:center;align-items:center;gap:8px;margin-top:6px' },
            h('button', { type: 'button', class: 'btn sm', onclick: () => { counts[i] = Math.max(0, counts[i] - 1); drawScoreboard(); } }, '－'),
            h('span', { class: 'num' }, String(counts[i])),
            h('button', { type: 'button', class: 'btn primary sm', onclick: () => { counts[i]++; drawScoreboard(); } }, '＋')),
          h('div', { class: 'sub', style: 'margin-top:4px' }, '小計 ' + (counts[i] * r.p) + ' 分'))));
    };

    const saveMatchScore = async () => {
      const sc = totalScore();
      const tName = mode === 'auto' ? '自動程式' : mode === 'driver' ? '手動駕駛' : '團隊合作賽';
      const detail = SEASON.scoring.map((r, i) => (counts[i] ? r.n + ' × ' + counts[i] + '（' + (counts[i] * r.p) + '分）' : '')).filter(Boolean).join('、') || '無得分明細';
      try {
        await api('/api/notes', {
          kind: 'skills',
          title: tName + ' ' + sc + ' 分',
          data: { f: { type: tName, score: String(sc), note: '場地計時實戰：' + detail, date: VX.todayStr() }, c: [] },
        });
        if (VX.act) VX.act('note');
        VX.saveState();
        toast('已將本場 ' + sc + ' 分存進技能賽紀錄 ✔');
      } catch (e) { toast(e.message || '儲存失敗'); }
    };

    drawModes(); drawCtrl(); drawScoreboard(); updateDisplay();
    paint(h('div', null, nav,
      h('div', { class: 'panel' },
        h('h2', null, '🚨 VEX IQ 場地計時與記分裝置'),
        h('p', { class: 'sub' }, '仿原廠筆電比賽計時器：內建 3-2-1 倒數、開場喇叭、團隊賽 35 秒／25 秒換手鈴、最後 10 秒倒數與結束蜂鳴器！'),
        modeBox, screen, ctrlBox),
      h('div', { class: 'panel' },
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px' },
          h('h3', { style: 'margin:0' }, '🏆 Level Up 即時記分板'),
          scoreTotalEl),
        scoreGrid,
        h('div', { class: 'row gap', style: 'margin-top:10px' },
          h('button', { type: 'button', class: 'btn primary', onclick: saveMatchScore }, '💾 存入技能賽紀錄'),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => { counts.fill(0); drawScoreboard(); } }, '🧹 歸零分數'),
          h('a', { class: 'btn', href: '#/compete/skills' }, '📊 查看歷史分數曲線')))), '場地計時記分', '🚨');
  }

  /* ============ 賽前準備包（補齊官方 7 堂課：組隊分工、駕駛模式、比賽日清單）============ */
  function prep(nav) {
    const st = VX.st;
    const pr = st.prep || (st.prep = { roles: {}, driveMode: 'split', pack: [] });
    pr.roles = pr.roles || {}; pr.pack = pr.pack || [];
    const ROLES = [
      ['builder', '🔧 機構組裝長', '負責底盤、手臂、齒輪補強與賽場即時維修'],
      ['coder', '💻 程式工程師', '負責自動程式、感測器調校與遙控按鍵設定'],
      ['driver1', '🎮 第一駕駛員（前 30 秒）', '負責開局搶分，並在 35s～25s 順暢交棒'],
      ['driver2', '🎮 第二駕駛員（後 30 秒）', '負責後半段衝刺得分與最後 10 秒收尾'],
      ['notebook', '📓 工程筆記長', '負責拍照、記測試數據與準備評審面談'],
    ];
    const DRIVE_MODES = [
      ['tank', 'Tank（雙搖桿戰車模式）', '左搖桿控左輪、右搖桿控右輪。直覺好做原地旋轉，但需要雙手協調同步往前推。'],
      ['arcade', 'Arcade（單搖桿街機模式）', '一隻搖桿同時控前後與左右轉彎，空出另一隻手專心按手臂與夾爪按鈕！'],
      ['split', 'Split Arcade（分離雙搖桿，比賽最常用）', '左搖桿控前後進退、右搖桿控左右轉彎。直線最穩、不容易不小心轉歪，強隊最常用！'],
    ];
    const PACK = [
      '機器人電池充飽 100%（含備用電池與充電器）',
      '遙控器（Controller）充飽電並已與 Brain 配對成功',
      'VEXcode 最新版程式已下載到 Brain 的正確 Slot（並貼標籤記住編號）',
      '已用「實體組裝挑戰 bl16」量過 11" × 20" × 15" 尺寸與馬達 ≤ 6 顆',
      '備用零件盒：常用連接銷、軸、軸套、橡皮筋、備用感測器線與拆銷器',
      '安全護目鏡（每位上場隊員各一副）',
      '工程筆記本（含照片、實測數據表、改良紀錄與隊伍編號）',
    ];
    const packProg = h('span', { class: 'sub' });
    const updPack = () => {
      const n = PACK.filter((_, i) => pr.pack[i]).length;
      packProg.textContent = (n === PACK.length ? '🟢 全部準備就緒！' : '🟡 已完成 ') + n + ' / ' + PACK.length + ' 項';
    };
    updPack();

    paint(h('div', null, nav,
      h('div', { class: 'panel' },
        h('h2', null, '🤝 第 1 堂補齊：組隊角色分工表'),
        h('p', { class: 'sub' }, '官方課程建議每位隊員都要輪流體驗不同角色！填上目前負責的名字，隨時可調整：'),
        h('table', { class: 'tbl' },
          h('tr', null, h('th', null, '角色'), h('th', null, '負責內容'), h('th', null, '目前負責隊員')),
          ...ROLES.map(([k, title, desc]) => {
            const inp = h('input', { type: 'text', placeholder: '輸入名字', style: 'width:120px' });
            inp.value = pr.roles[k] || '';
            inp.addEventListener('input', () => { pr.roles[k] = inp.value; VX.saveState(); });
            return h('tr', null, h('td', null, h('b', null, title)), h('td', null, desc), h('td', null, inp));
          }))),
      h('div', { class: 'panel' },
        h('h2', null, '🎮 第 3 堂補齊：遙控駕駛模式比較與換手練習'),
        h('p', { class: 'sub' }, '不知道遙控器要設哪一種？三種模式都開過 2 分鐘，選出最適合你們隊伍的手感：'),
        DRIVE_MODES.map(([k, title, desc]) => {
          const picked = pr.driveMode === k;
          return h('div', { class: 'card' + (picked ? ' card-lit-ok' : ''), style: 'margin:8px 0;cursor:pointer', onclick: () => { pr.driveMode = k; VX.saveState(); prep(nav); } },
            h('h3', null, h('span', { class: 'lamp ' + (picked ? 'ok' : 'idle') }), title, picked ? h('span', { class: 'tag done' }, ' ✓ 目前選用') : null),
            h('p', { class: 'sub', style: 'margin:0' }, desc));
        }),
        h('div', { class: 'row gap', style: 'margin-top:10px' },
          h('a', { class: 'btn primary sm', href: '#/compete/timer' }, '🚨 去練 35s～25s 團隊換手計時'),
          h('a', { class: 'btn sm', href: '#/import' }, '📤 上傳遙控存檔產生按鍵對照表'))),
      h('div', { class: 'panel' },
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px' },
          h('h2', { style: 'margin:0' }, '🎒 第 6 堂補齊：比賽日打包與現場檢核清單'),
          packProg),
        h('p', { class: 'sub' }, '出發去比賽前逐項打勾，確保不會少帶電池、線材或工程筆記！'),
        PACK.map((txt, i) => {
          const cb = h('input', { type: 'checkbox' }); cb.checked = !!pr.pack[i];
          cb.addEventListener('change', () => { pr.pack[i] = cb.checked; VX.saveState(); updPack(); });
          return h('label', { class: 'check' }, cb, h('span', null, txt));
        }),
        h('div', { class: 'row gap', style: 'margin-top:10px' },
          h('a', { class: 'btn primary sm', href: '#/build/lab/bl16' }, '📏 去跑 Level Up 全車尺寸檢錄'),
          h('a', { class: 'btn sm', href: '#/compete/interview' }, '🎤 練評審面談')))), '賽前準備與分工', '🎒');
  }

  /* ============ 當季 Level Up ============ */
  const md = (t) => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  function scoringDrillPanel() {
    const st = VX.st;
    const rec = st.scoreDrill || (st.scoreDrill = { ok: 0, total: 0, streak: 0 });
    const GOALS = [
      { k: 'floor', name: '地板球門', pts: 1, col: 'blue', colZh: '藍', x: 18, y: 126, w: 72, h: 42 },
      { k: 'l1', name: 'L1 球門', pts: 3, col: 'red', colZh: '紅', x: 102, y: 106, w: 72, h: 62 },
      { k: 'l2', name: 'L2 球門', pts: 6, col: 'blue', colZh: '藍', x: 186, y: 84, w: 72, h: 84 },
      { k: 'l3', name: 'L3 球門', pts: 12, col: 'red', colZh: '紅', x: 270, y: 60, w: 72, h: 108 },
      { k: 'l4', name: 'L4 球門', pts: 16, col: 'yellow', colZh: '黃', x: 354, y: 34, w: 78, h: 134 },
    ];
    const COL_HEX = { blue: '#3b82f6', red: '#ef4444', yellow: '#eab308' };
    const COL_BG = { blue: 'rgba(59,130,246,.14)', red: 'rgba(239,68,68,.14)', yellow: 'rgba(234,179,8,.18)' };
    const COL_ZH = { blue: '藍', red: '紅', yellow: '黃' };
    const DOT = { blue: '🔵', red: '🔴', yellow: '🟡' };
    const PTS_EACH = { 1: '1 分／個', 3: '3 分／個', 6: '6 分／個', 12: '12 分／個', 16: '16 分／個' }; // 整句固定字串，英文才不會把「分」當成分鐘
    const rnd = (n) => Math.floor(Math.random() * n);
    let diff = 'easy', cur = null, solved = false, byGoal = false;

    const gen = () => {
      const bags = GOALS.map((g, idx) => {
        if (diff === 'easy' && idx > 2) return [];
        if (diff === 'med' && idx > 3) return [];
        const cnt = diff === 'easy' ? rnd(3) + (idx === 0 ? 1 : 0) : rnd(3);
        const arr = [];
        for (let i = 0; i < cnt; i++) {
          if (diff === 'easy') arr.push(g.col);
          else if (diff === 'med') arr.push(rnd(5) === 0 ? (g.col === 'blue' ? 'red' : 'blue') : (rnd(3) === 0 ? 'yellow' : g.col));
          else arr.push(rnd(4) === 0 ? (g.col === 'yellow' ? (rnd(2) ? 'red' : 'blue') : (g.col === 'blue' ? 'red' : 'blue')) : (rnd(3) === 0 ? 'yellow' : g.col));
        }
        return arr;
      });
      if (bags.every((a) => !a.length)) bags[0].push('blue', 'blue');
      // 沙包還碰著機器人就不算分（手冊 SC3～SC5）；簡單題不出現
      const touch = bags.map((arr) => arr.map(() => diff !== 'easy' && rnd(diff === 'hard' ? 5 : 7) === 0));
      let ans = 0;
      const lines = [], valids = GOALS.map(() => 0);
      GOALS.forEach((g, i) => {
        const arr = bags[i];
        if (!arr.length) return;
        const colorOk = (c) => (g.col === 'yellow' ? c === 'yellow' : (c === g.col || c === 'yellow'));
        const valid = arr.filter((c, bi) => colorOk(c) && !touch[i][bi]);
        const invalid = arr.filter((c) => !colorOk(c)).length;               // 顏色不對
        const touching = arr.filter((c, bi) => colorOk(c) && touch[i][bi]).length; // 顏色對，但碰到機器人
        const sub = valid.length * g.pts;
        valids[i] = valid.length;
        ans += sub;
        lines.push(g.name + '（' + DOT[g.col] + '／' + g.pts + '分）：' + valid.length + ' 個有效 = ' + sub + ' 分' + (invalid ? '（另有 ' + invalid + ' 個錯色不計分）' : '') + (touching ? '（另有 ' + touching + ' 個碰到機器人不計分）' : ''));
      });
      cur = { bags, touch, ans, lines, valids };
      solved = false;
      render();
    };

    const drawSvg = () => {
      let inner = '<rect x="6" y="168" width="438" height="6" rx="3" fill="#cbd5e1"/>';
      GOALS.forEach((g, i) => {
        const stroke = COL_HEX[g.col], fill = COL_BG[g.col];
        inner += `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`;
        inner += `<text x="${g.x + g.w / 2}" y="${g.y - 14}" text-anchor="middle" font-size="11" font-weight="700" fill="${stroke}">${g.name} ${DOT[g.col]}</text>`;
        inner += `<text x="${g.x + g.w / 2}" y="${g.y - 3}" text-anchor="middle" font-size="10" fill="#64748b">${PTS_EACH[g.pts]}</text>`;
        cur.bags[i].forEach((c, bi) => {
          const cx = g.x + 18 + (bi % 2) * 34;
          const cy = g.y + g.h - 16 - Math.floor(bi / 2) * 26;
          inner += `<circle cx="${cx}" cy="${cy}" r="11" fill="${COL_HEX[c]}" stroke="#fff" stroke-width="2"/>`;
          if (cur.touch && cur.touch[i][bi]) inner += `<circle cx="${cx}" cy="${cy}" r="13.5" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="3 2"/><text x="${cx + 10}" y="${cy - 9}" font-size="11">🤖</text>`;
          inner += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${COL_ZH[c]}</text>`;
        });
      });
      return `<svg class="svgfig" viewBox="0 0 450 184" xmlns="http://www.w3.org/2000/svg" role="img" style="width:100%;max-width:560px">${inner}</svg>`;
    };

    const wrap = h('div', { class: 'panel' });
    const render = () => {
      const inp = h('input', { type: 'text', inputmode: 'numeric', placeholder: '輸入總分', style: 'width:120px;margin:0' });
      const fb = h('div');
      const toInt = (v) => parseInt(String(v).replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[^\d-]/g, ''), 10);
      const goalInputs = GOALS.map((g) => h('input', { type: 'text', inputmode: 'numeric', placeholder: '0', style: 'width:64px;margin:0', 'aria-label': g.name + '有效沙包數' }));
      const checkByGoal = () => {
        if (solved) return;
        const mine = goalInputs.map((i) => (i.value.trim() === '' ? 0 : toInt(i.value)));
        if (mine.some((v) => isNaN(v))) { const bad = goalInputs.find((i, k) => isNaN(mine[k])); if (bad) bad.focus(); return; }
        solved = true;
        const okEach = GOALS.map((g, i) => mine[i] === cur.valids[i]);
        const ok = okEach.every(Boolean);
        const total = mine.reduce((a, v, i) => a + v * GOALS[i].pts, 0);
        rec.total++;
        if (ok) { rec.ok++; rec.streak++; if (window.VXFX && rec.streak % 3 === 0) window.VXFX.confetti(); } else rec.streak = 0;
        VX.saveState();
        fb.replaceChildren(
          h('div', { class: 'callout' + (ok ? '' : ' warn') },
            h('b', null, ok ? '✅ 每一層都對！總分是 ' + cur.ans + ' 分！' : '❌ 有幾層數錯了（你的總分是 ' + total + ' 分，正確是 ' + cur.ans + ' 分）'),
            h('ul', { style: 'margin:6px 0 0 18px' }, GOALS.map((g, i) => h('li', null, (okEach[i] ? '✔ ' : '✘ ') + g.name + '：你填 ' + mine[i] + ' 個，正確是 ' + cur.valids[i] + ' 個有效（' + (g.col === 'yellow' ? '只收 🟡 黃色' : DOT[g.col] + ' 或 🟡 才算') + '）')))),
          h('button', { type: 'button', class: 'btn primary sm', onclick: gen }, '下一題 ▶'));
        statEl.textContent = '累計答對 ' + rec.ok + ' / ' + rec.total + ' 題　·　連勝 ' + rec.streak + ' 題';
      };
      const check = () => {
        if (byGoal) return checkByGoal();
        if (solved) return;
        const norm = inp.value.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[^\d-]/g, '');
        const v = parseInt(norm, 10);
        if (isNaN(v)) { inp.focus(); return; }
        solved = true;
        const ok = v === cur.ans;
        rec.total++;
        if (ok) { rec.ok++; rec.streak++; if (window.VXFX && rec.streak % 3 === 0) window.VXFX.confetti(); }
        else rec.streak = 0;
        VX.saveState();
        fb.replaceChildren(
          h('div', { class: 'callout' + (ok ? '' : ' warn') },
            h('b', null, ok ? '✅ 完全正確！總分是 ' + cur.ans + ' 分！' : '❌ 差一點，正確總分是 ' + cur.ans + ' 分（你填 ' + v + ' 分）'),
            h('ul', { style: 'margin:6px 0 0 18px' }, cur.lines.map((ln) => h('li', null, ln)))),
          h('button', { type: 'button', class: 'btn primary sm', onclick: gen }, '下一題 ▶'));
        statEl.textContent = '累計答對 ' + rec.ok + ' / ' + rec.total + ' 題　·　連勝 ' + rec.streak + ' 題';
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
      goalInputs.forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); }));
      const statEl = h('span', { class: 'sub' }, '累計答對 ' + rec.ok + ' / ' + rec.total + ' 題　·　連勝 ' + rec.streak + ' 題');
      wrap.replaceChildren(
        h('h3', null, '🎮 互動視覺化 Level Up 計分練習'),
        h('p', { class: 'sub' }, '看圖算出這個場地的總分！規則：同色或黃色沙包才算分，L4 只收黃色；有 🤖 紅色虛線圈的沙包還碰著機器人，不算分。'),
        h('div', { class: 'row gap', style: 'margin-bottom:8px;align-items:center' },
          [['easy', '簡單'], ['med', '中等（含錯色與黃色）'], ['hard', '困難（全 5 層＋陷阱）']].map(([k, lb]) =>
            h('button', { type: 'button', class: 'btn sm' + (diff === k ? ' primary' : ''), onclick: () => { diff = k; gen(); } }, lb)),
          h('button', { type: 'button', class: 'btn sm', onclick: gen }, '🔄 換一題')),
        h('div', { style: 'margin:8px 0' }, html(drawSvg())),
        h('div', { class: 'row gap', style: 'margin-bottom:8px;align-items:center' },
          h('button', { type: 'button', class: 'btn sm' + (byGoal ? '' : ' primary'), onclick: () => { byGoal = false; render(); } }, '只填總分'),
          h('button', { type: 'button', class: 'btn sm' + (byGoal ? ' primary' : ''), onclick: () => { byGoal = true; render(); } }, '分項填寫（每層各填有效沙包數）')),
        byGoal ? h('div', { class: 'ctlrows' }, GOALS.map((g, i) => h('div', { class: 'row gap', style: 'align-items:center' }, h('span', { style: 'min-width:120px' }, g.name + '（' + DOT[g.col] + '／' + g.pts + ' 分）有效'), goalInputs[i], h('span', null, '個')))) : null,
        h('div', { class: 'row gap', style: 'align-items:center;margin-top:8px' },
          byGoal ? null : inp, h('button', { type: 'button', class: 'btn primary sm', onclick: check }, '批改'), statEl),
        fb);
    };
    gen();
    return wrap;
  }

  function season(nav) {
    const S = SEASON;
    const inputs = S.scoring.map(() => h('input', { type: 'number', min: 0, value: 0, style: 'width:80px' }));
    const total = h('div', { style: 'font-size:1.6rem;font-weight:800' }, '0 分');
    const calc = () => { total.textContent = S.scoring.reduce((a, r, i) => a + (parseInt(inputs[i].value, 10) || 0) * r.p, 0) + ' 分'; };
    inputs.forEach((i) => i.addEventListener('input', calc));
    const quiz = [
      { q: '機器人把 2 個沙包投進 L2、1 個投進 L3（顏色都對）。總共幾分？', a: '24', opts: ['18', '24', '30', '21'], why: '2 × 6 + 12 = 24。' },
      { q: '3 個沙包在地板球門、1 個黃色沙包在 L4。總共幾分？', a: '19', opts: ['16', '19', '20', '48'], why: '3 × 1 + 16 = 19。' },
      { q: '一個紅色沙包可以放進哪個球門得分？', a: '紅色的地板球門', opts: ['藍色的地板球門', '紅色的地板球門', 'L4 球門', '都不行'], why: '紅色沙包只能進「紅色」球門；L4 只收黃色。' },
      { q: '只收黃色沙包的是哪個球門？', a: 'L4 球門', opts: ['L1 球門', 'L2 球門', 'L3 球門', 'L4 球門'], why: 'L4（16 分）只收黃色，而黃色可以放進任何顏色的 L1～L3 和地板球門。' },
      { q: '團隊合作賽有自動階段嗎？', a: '沒有，全程手動駕駛', opts: ['有，15 秒', '沒有，全程手動駕駛', '有，30 秒', '只有決賽有'], why: '團隊賽沒有自動階段；自動程式要在「自動程式技能賽」練。' },
    ];
    const qbox = quiz.map((q) => { const fb = h('div', { class: 'sub' }); return h('div', { class: 'wrongitem' }, h('div', { class: 'wq' }, q.q), h('div', { class: 'row gap' }, VX.shuffle(q.opts).map((o) => h('button', { class: 'btn sm', onclick: (e) => { const ok = o === q.a; e.target.style.borderColor = ok ? 'var(--ok)' : 'var(--bad)'; fb.textContent = (ok ? '✅ ' : '❌ 正解：' + q.a + '。') + q.why; } }, o))), fb); });
    const tbl = (rows) => h('table', { class: 'tbl' }, ...rows.map((r) => h('tr', null, h('th', { style: 'width:34%' }, r[0]), h('td', { html: md(r[1]) }))));
    paint(h('div', null, nav,
      h('div', { class: 'panel' }, h('h2', null, '🎯 VEX IQ ' + S.season + '「' + S.name + '」'),
        h('p', null, S.objective),
        h('div', { class: 'callout warn' }, '📌 整理自官方 Game Manual ' + S.version + '。我只放有讀到的章節；場地精確尺寸、違規處罰、活動規則、評審獎項細則請看原文。手冊會更新，比賽前請再確認最新版：', h('a', { href: S.manual, target: '_blank', rel: 'noopener' }, S.manual))),
      h('div', { class: 'panel' }, h('h3', null, '比賽有哪些項目'), tbl(S.formats), h('p', { class: 'sub' }, S.skillsNote)),
      h('div', { class: 'panel' }, h('h3', null, '場地與得分物'), tbl(S.elements), h('p', { class: 'sub' }, '場地約 6 ft × 8 ft（官方手冊）。')),
      h('div', { class: 'panel' }, h('h3', null, '計分表'),
        h('table', { class: 'tbl' }, h('tr', null, h('th', null, '投進哪裡'), h('th', null, '每個沙包'), h('th', null, '你的個數'), h('th', null, '小計')), ...S.scoring.map((r, i) => h('tr', null, h('td', null, r.n), h('td', null, r.p + ' 分'), h('td', null, inputs[i]), h('td', { id: 'sub' + i }, '')))),
        h('div', { class: 'row gap' }, h('b', null, '試算總分：'), total),
        h('ul', null, S.colorRules.map((t) => h('li', null, t)))),
      h('div', { class: 'panel' }, h('h3', null, '機器人規定（重點）'), tbl(S.robot)),
      h('div', { class: 'panel' }, h('h3', null, '常犯的規則'), tbl(S.rules)),
      h('div', { class: 'panel' }, h('h3', null, '💡 策略想法'), h('div', { class: 'callout warn' }, '這是我根據計分表推出來的想法，不是官方說法，也還沒實測過。真正的好策略要靠你們量時間、測試，再寫進工程筆記。'),
        h('ul', null, S.strategy.map((t) => h('li', null, t))),
        h('div', { class: 'row gap' }, h('a', { class: 'btn primary', href: '#/notebook/new/brainstorm' }, '📓 把想法寫成「腦力激盪」'), h('a', { class: 'btn', href: '#/compete/skills' }, '⏱️ 去記錄技能賽練習'))),
      scoringDrillPanel(),
      h('div', { class: 'panel' }, h('h3', null, '🧠 計分小測驗'), qbox)), '當季 Level Up', '🎯');
    calc();
    S.scoring.forEach((r, i) => inputs[i].addEventListener('input', () => { const c = document.getElementById('sub' + i); if (c) c.textContent = ((parseInt(inputs[i].value, 10) || 0) * r.p) + ' 分'; }));
  }

  /* ============ 得分規劃器 ============ */
  function planner(nav) {
    const S = SEASON;
    const rowsEl = S.scoring.map((r) => ({ r, secs: h('input', { type: 'number', min: 1, placeholder: '秒', style: 'width:80px' }), trips: h('input', { type: 'number', min: 0, value: 0, style: 'width:80px' }), eff: h('td', null, ''), sub: h('td', null, '') }));
    const sum = h('div', { class: 'callout' });
    const calc = () => {
      let time = 0, pts = 0, best = null;
      rowsEl.forEach((x) => {
        const sc = parseFloat(x.secs.value), tr = parseInt(x.trips.value, 10) || 0;
        if (sc > 0) { const e = x.r.p / sc; x.eff.textContent = e.toFixed(2) + ' 分/秒'; if (!best || e > best.e) best = { e, n: x.r.n }; time += tr * sc; } else x.eff.textContent = '';
        pts += tr * x.r.p; x.sub.textContent = tr ? tr * x.r.p + ' 分' : '';
      });
      const over = time > 60;
      sum.replaceChildren(h('div', { style: 'font-size:1.3rem;font-weight:800' }, '預估得分：' + pts + ' 分　用掉時間：' + Math.round(time * 10) / 10 + ' / 60 秒' + (over ? '　⚠ 超過 60 秒了！' : '')),
        best ? h('div', { class: 'sub' }, '每秒得分最高的是「' + best.n + '」（' + best.e.toFixed(2) + ' 分/秒）。但別忘了：機構難不難做、穩不穩，也要一起考慮。') : null);
      sum.style.borderColor = over ? 'var(--bad)' : 'var(--accent)';
    };
    rowsEl.forEach((x) => { x.secs.addEventListener('input', calc); x.trips.addEventListener('input', calc); });
    const example = () => { const ex = [6, 10, 15, 20, 24]; rowsEl.forEach((x, i) => { x.secs.value = ex[i]; x.trips.value = 0; }); calc(); toast('已填入範例秒數（假設值，不是真的）'); };
    const save = async () => {
      const lines = rowsEl.filter((x) => (parseInt(x.trips.value, 10) || 0) > 0).map((x) => x.r.n + '：每趟 ' + (x.secs.value || '?') + ' 秒 × ' + x.trips.value + ' 趟 = ' + (x.trips.value * x.r.p) + ' 分');
      if (!lines.length) return toast('先填幾個趟數');
      try { await api('/api/notes', { kind: 'brainstorm', title: 'Level Up 得分規劃', data: { f: { ideas: lines.join('\n') + '\n\n' + sum.innerText, pros: '', cons: '', date: VX.todayStr() }, c: [] } }); toast('已存成筆記 ✔'); } catch (e) { toast(e.message); }
    };
    paint(h('div', null, nav, h('div', { class: 'panel' }, h('h2', null, '🧮 Level Up 得分規劃器'),
      h('p', null, '把 60 秒當成預算：每個目標「一趟要幾秒」（請用碼錶實測）、你打算跑幾趟，算算預估得分。這是做策略和「決策矩陣」最好的數據。'),
      h('div', { class: 'callout warn' }, '秒數請填「你的機器人」實測的數字。按下「填入範例」的秒數只是假設，用來看看怎麼用。'),
      h('div', { style: 'overflow-x:auto' }, h('table', { class: 'tbl' }, h('tr', null, ['目標', '每個沙包', '每趟幾秒', '打算跑幾趟', '每秒得分', '小計'].map((x) => h('th', null, x))),
        ...rowsEl.map((x) => h('tr', null, h('td', null, x.r.n), h('td', null, x.r.p + ' 分'), h('td', null, x.secs), h('td', null, x.trips), x.eff, x.sub)))),
      sum, h('div', { class: 'row gap' }, h('button', { class: 'btn', onclick: example }, '填入範例'), h('button', { class: 'btn primary', onclick: save }, '📓 存成筆記'))),
      h('p', { class: 'sub' }, '提醒：L4 只收黃色沙包，而黃色沙包數量很少；實際能做幾趟，要看場上有哪些沙包可拿，請對照官方手冊。')), '得分規劃器', '🧮');
    calc();
  }

  async function skills(nav) {
    let notes = []; try { notes = (await api('/api/notes')).notes.filter((n) => n.kind === 'skills'); } catch (e) { /* ignore */ }
    const type = h('select', null, h('option', { value: '手動駕駛' }, '手動駕駛'), h('option', { value: '自動程式' }, '自動程式'));
    const score = h('input', { type: 'number', placeholder: '分數' }); const note = h('textarea', { placeholder: '這次發生什麼事？失誤在哪？下次想改什麼？' });
    const rows = notes.slice().reverse().map((n) => { const f = (n.data && n.data.f) || {}; return { t: f.type || '', s: parseFloat(f.score) || 0, d: f.date || '' }; });
    const max = Math.max(10, ...rows.map((r) => r.s));
    paint(h('div', null, nav, h('div', { class: 'panel' }, h('h2', null, '⏱️ 技能賽練習記錄'), h('p', { class: 'sub' }, '每次練習完記下分數和想法，一眼看出有沒有進步。（分數規則依當季 Game Manual）'),
      type, score, note, h('button', { class: 'btn primary', onclick: async () => { if (score.value === '') return toast('請填分數'); try { await api('/api/notes', { kind: 'skills', title: type.value + ' ' + score.value + ' 分', data: { f: { type: type.value, score: score.value, note: note.value, date: VX.todayStr() }, c: [] } }); toast('已記錄 ✔'); if (VX.act) VX.act('note'); VX.saveState(); viewCompete('skills'); } catch (e) { toast(e.message); } } }, '記錄這次')),
      rows.length ? h('div', { class: 'panel' }, h('h3', null, '分數變化'), h('div', { class: 'bars' }, rows.slice(-20).map((r) => h('div', { class: 'bcol', title: r.d + ' ' + r.t + ' ' + r.s }, h('div', { class: 'bfill', style: 'height:' + Math.round((r.s / max) * 100) + '%;background:' + (r.t === '自動程式' ? '#5ecd98' : '#0875e2') }), h('small', null, String(r.s))))), h('p', { class: 'sub' }, '藍＝手動駕駛　綠＝自動程式')) : null,
      notes.length ? h('div', { class: 'panel' }, h('h3', null, '紀錄'), notes.map((n) => { const f = (n.data && n.data.f) || {}; return h('div', { class: 'wrongitem' }, h('b', null, (f.date || '') + '　' + (f.type || '') + '　' + (f.score || 0) + ' 分'), h('div', { class: 'sub' }, f.note || ''), h('button', { class: 'btn sm ghost', onclick: async () => { if (!confirm('刪掉這筆紀錄？')) return; try { await api('/api/notes/' + n.id + '/delete', {}); viewCompete('skills'); } catch (e) { toast(e.message); } } }, '刪除')); })) : null), '技能賽練習', '⏱️');
  }

  function vocab(nav) {
    const st = VX.st; st.vocab = st.vocab || {};
    let idx = -1, flipped = false;
    const card = h('div', { class: 'card flip' }); const info = h('div', { class: 'sub' });
    const pick = () => { const w = GLOSSARY.map((g, i) => ({ i, k: (st.vocab[g[0]] || 0) })).sort((a, b) => a.k - b.k + (Math.random() - 0.5)); idx = w[0].i; flipped = false; draw(); };
    const draw = () => { const g = GLOSSARY[idx]; card.replaceChildren(flipped ? h('div', null, g[1], h('small', null, g[2])) : h('div', null, g[0], h('small', null, '點一下看中文')));
      const known = GLOSSARY.filter((x) => (st.vocab[x[0]] || 0) >= 2).length; info.textContent = '已記住 ' + known + ' / ' + GLOSSARY.length + ' 個詞'; };
    card.addEventListener('click', () => { flipped = !flipped; draw(); });
    const grade = (ok) => { const g = GLOSSARY[idx][0]; st.vocab[g] = ok ? (st.vocab[g] || 0) + 1 : 0; VX.saveState(); pick(); };
    pick();
    paint(h('div', null, nav, h('div', { class: 'panel' }, h('h2', null, '🔤 英中術語卡'), h('p', { class: 'sub' }, '先想想這個英文是什麼意思，再點卡片看答案。記得就按「記得」，不記得會更常出現。'), card,
      h('div', { class: 'row gap' }, h('button', { class: 'btn green', onclick: () => grade(true) }, '✔ 我記得'), h('button', { class: 'btn danger', onclick: () => grade(false) }, '✘ 還不熟')), info),
      h('div', { class: 'panel' }, h('h3', null, '全部術語'), h('table', { class: 'tbl' }, h('tr', null, ['English', '中文', '說明'].map((x) => h('th', null, x))), ...GLOSSARY.map((g) => h('tr', null, g.map((x) => h('td', null, x))))))), '英中術語卡', '🔤');
  }

  async function interview(nav) {
    let notes = []; try { notes = (await api('/api/notes')).notes.filter((n) => n.kind === 'interview'); } catch (e) { /* ignore */ }
    const sel = h('select', null, INTERVIEW.map((q, i) => h('option', { value: i }, q.q)));
    const frame = h('div', { class: 'callout' }); const ans = h('textarea', { placeholder: '先寫中文也可以，再慢慢改成英文。', style: 'min-height:130px' });
    const upd = () => { const q = INTERVIEW[+sel.value]; frame.replaceChildren(h('b', null, q.z), h('div', { class: 'sub' }, '句型提示：' + q.frame)); };
    sel.addEventListener('change', upd); upd();
    paint(h('div', null, nav, h('div', { class: 'panel' }, h('h2', null, '🎤 面談練習'), h('p', { class: 'sub' }, '評審會問你們的設計與想法。選一題，寫下你的回答，再大聲唸出來練習。'), sel, frame, ans,
      h('button', { class: 'btn primary', onclick: async () => { if (!ans.value.trim()) return toast('先寫點內容'); try { await api('/api/notes', { kind: 'interview', title: INTERVIEW[+sel.value].q, data: { f: { q: INTERVIEW[+sel.value].q, answer: ans.value, date: VX.todayStr() }, c: [] } }); toast('已儲存 ✔'); if (VX.act) VX.act('note'); VX.saveState(); viewCompete('interview'); } catch (e) { toast(e.message); } } }, '儲存我的回答')),
      notes.length ? h('div', { class: 'panel' }, h('h3', null, '我的回答（' + notes.length + '）'), notes.map((n) => { const f = (n.data && n.data.f) || {}; return h('div', { class: 'wrongitem' }, h('b', null, n.title), h('div', { style: 'white-space:pre-wrap', 'data-notrans': '1' }, f.answer || ''), n.fb ? h('div', { class: 'fb-box' }, '💬 ', h('span', { 'data-notrans': '1' }, n.fb)) : null,
        h('button', { class: 'btn sm ghost', onclick: async () => { if (!confirm('刪掉這個回答？')) return; try { await api('/api/notes/' + n.id + '/delete', {}); viewCompete('interview'); } catch (e) { toast(e.message); } } }, '刪除')); })) : null), '面談練習', '🎤');
  }

  /* ============ 家長頁：筆記與留言 ============ */
  function noteReadonly(n) {
    const K = NB_KINDS[n.kind]; const d = n.data || {}; const f = d.f || {};
    const parts = [];
    Object.entries(f).forEach(([k, v]) => { if (!v || k === 'date' || k === 'author') return; const fld = K && (K.fields || []).find((x) => x.k === k); parts.push(h('div', null, h('b', null, (fld ? fld.l : (k === 'answer' ? '回答' : k === 'score' ? '分數' : k === 'type' ? '類型' : k === 'note' ? '想法' : k === 'q' ? '問題' : k)) + '：'), h('span', { style: 'white-space:pre-wrap', 'data-notrans': '1' }, String(v)))); });
    if (d.iq) parts.push(h('div', null, h('button', { class: 'btn sm', onclick: () => { const a = h('a', { href: URL.createObjectURL(new Blob([d.iq], { type: 'application/json' })), download: (n.title || 'project').replace(/[^\w\u4e00-\u9fa5-]+/g, '_') + '.iqblocks' }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); } }, '⬇ 下載他的 VEXcode 存檔')));
    if (typeof d.sketch === 'string' && d.sketch.startsWith('data:image/')) parts.push(h('img', { src: d.sketch, style: 'max-width:100%;border:1px solid var(--line);border-radius:8px' }));
    if (Array.isArray(d.photos) && d.photos.length) parts.push(h('div', { class: 'photo-grid' }, d.photos.filter((u) => typeof u === 'string' && u.startsWith('/api/photos/')).map((u) => h('div', { class: 'photo-item' }, h('img', { src: u, onclick: () => window.open(u, '_blank') })))));
    if (d.matrix) parts.push(h('table', { class: 'tbl' }, h('tr', null, h('th', null, '標準'), h('th', null, '權重'), ...d.matrix.opts.map((o) => h('th', { 'data-notrans': '1' }, o))), ...d.matrix.rows.map((r) => h('tr', null, h('td', { 'data-notrans': '1' }, r.n), h('td', null, String(r.w)), ...r.s.map((x) => h('td', null, String(x)))))));
    if (d.trials) parts.push(h('table', { class: 'tbl' }, h('tr', null, ['次', '設定', '目標', '實際', '備註'].map((x) => h('th', null, x))), ...d.trials.map((r, i) => h('tr', null, h('td', null, String(i + 1)), h('td', { 'data-notrans': '1' }, r.a), h('td', { 'data-notrans': '1' }, r.b), h('td', { 'data-notrans': '1' }, r.c), h('td', { 'data-notrans': '1' }, r.d)))));
    return parts;
  }
  VX.parentNotes = async function (uid, readonly) {
    const box = document.getElementById('pnotes'); if (!box) return;
    let notes = []; try { notes = (await api('/api/parent/learner/' + uid + '/notes')).notes; } catch (e) { box.textContent = e.message; return; }
    box.replaceChildren(h('div', { class: 'panel' }, h('h3', null, '📓 工程筆記與練習（' + notes.length + '）'), notes.length ? notes.map((n) => {
      const sc = checkScore(n); const ta = h('textarea', { placeholder: '給他一句鼓勵，或問一個問題（例如：這個結論的數據在哪裡？）', style: 'min-height:60px' }); ta.value = n.fb || '';
      return h('details', { class: 'lessonbox' }, h('summary', null, h('span', { 'data-notrans': '1' }, n.title), '　', h('small', null, KIND_NAME(n.kind) + ' · ' + fmt(n.updated) + (sc != null ? ' · 自評 ' + sc + '%' : '') + (n.fb ? ' · 已留言' : ''))),
        h('div', { class: 'body' }, noteReadonly(n), readonly ? (n.fb ? h('div', { class: 'fb-box' }, '💬 家長留言：', h('span', { 'data-notrans': '1' }, n.fb)) : null) : ta, readonly ? null : h('button', { class: 'btn sm primary', onclick: async () => { try { await api('/api/parent/notes/' + n.id + '/feedback', { text: ta.value }); toast('留言已送出'); } catch (e) { toast(e.message); } } }, '送出留言')));
    }) : h('p', { class: 'sub' }, '還沒有筆記')));
  };


  /* ============ 學習資源 ============ */
  const RES = [
    ['🎯 當季官方課程（免費，7 堂）', [
      ['Competition 101：VEX IQ Level Up（官方 STEM Lab）', 'https://education.vex.com/stemlabs/iq/competition-101-vex-iq-level-up', '官方為 2026–27 當季設計的入門課程，英文版。第 2 堂「Building Your First Robot」會一步一步組出當季的 Hero Bot「Flop」。建議照順序做，我們的網站負責「練習、模擬、檢查、寫筆記」。'],
    ]],
    ['官方課程 × 本站怎麼搭配', [
      ['第 1 堂 組隊與認識遊戲', '#/compete/season', '對照：本站「比賽專區 → 當季 Level Up」＋ 計分小測驗。'],
      ['第 2 堂 組裝 Flop（第一台機器人）', '#/start', '對照：本站「起步任務」的組裝步驟；組好後做「模擬器第一個程式」。'],
      ['第 3 堂 駕駛機器人', '#/import', '對照：把遙控程式存檔上傳，本站會做「控制對照表」與檢查。'],
      ['第 4 堂 第一個策略', '#/compete/plan', '對照：本站「得分規劃器」，用實測秒數算預估得分。'],
      ['第 5 堂 改良機器人', '#/notebook', '對照：本站「工程筆記」的決策矩陣與測試紀錄（一次只改一個變數）。'],
      ['第 6 堂 準備第一場比賽', '#/compete/interview', '對照：本站「面談練習」與「技能賽練習」。'],
      ['第 7 堂 賽後反思', '#/notebook/new/reflect', '對照：本站「練習心得」筆記頁。'],
    ]],
    ['官方（VEX）', [
      ['VEXcode IQ（網頁版）', 'https://codeiq.vex.com/', '他寫積木程式的地方，瀏覽器就能用（可選正體中文或英文）。'],
      ['VEXcode VR（虛擬機器人）', 'https://vr.vex.com/', '沒有實體機器人也能用積木或 Python 控制 3D 虛擬機器人解任務，很適合練程式邏輯。'],
      ['VEX IQ STEM Labs（正體中文）', 'https://education.vex.com/stemlabs/zh-hant/iq', '官方的單元式課程：組裝、馬達與感測器、競賽。⚠ 中文是機器翻譯，有些句子不通順，可對照英文版。'],
      ['VEX 知識庫（正體中文）', 'https://kb.vex.com/hc/zh-tw', '像「VEX IQ 百科全書」：Brain 韌體更新、遙控器配對、感測器原理、故障排除。'],
      ['當季 Game Manual（Level Up）', 'https://link.vex.com/docs/26-27/viqrc/game-manual', '比賽規則的唯一依據，會更新，比賽前再看一次。'],
      ['RobotEvents（賽事報名與查詢）', 'https://www.robotevents.com/', '找比賽、報名、查隊伍。'],
    ]],
    ['社群開源專案（第三方，內容與正確性請自行判斷）', [
      ['Level Up 計分練習（3D 網頁）', 'https://vex-iq-scoring.jerryio.com', '在 3D 場地上練習算分，有簡單／中等／困難。作者：Jerrylum（GPL-3.0 開源）。可以當作我們「計分小測驗」的延伸練習。'],
      ['iqdraw（組裝說明書產生器）', 'https://github.com/elijahcroft/iqdraw', '用文字描述零件位置，產生可列印的步驟式組裝說明書。適合以後做自己機器人的組裝教學。'],
      ['VEX-Robotics-AI / VEX-Robotics', 'https://github.com/VEX-Robotics-AI/VEX-Robotics', '彙整 VEX IQ 入門課程與範例（2023 年後沒更新，內容偏舊）。'],
      ['vextutorials', 'https://github.com/anyaiyer21/vextutorials', '積木與 Python 語法對照的教學網站原始碼。'],
      ['VexIQ-Drag-Race（Python）', 'https://github.com/CodeByEx/VexIQ-Drag-Race', '一個用 Python 讓機器人在直線競速中盡量走直的範例，想法就是「一直修正偏移」。想先用玩的了解，請看本站「控制實驗室」。授權：GPL-3.0。'],
      ['Team2420C / autonomous（C++）', 'https://github.com/Team2420C/autonomous', '參賽隊伍公開的自動階段程式，用到里程計（odometry）與 PID，屬於進階。先看本站「控制實驗室」再來讀會比較容易。授權：GPL-2.0。'],
      ['GitHub：vex-iq 主題', 'https://github.com/topics/vex-iq', '全球開發者標記 vex-iq 的開源專案清單，可以定期逛逛。第三方內容，品質不一。'],
    ]],
    ['台灣賽事與在地資源', [
      ['台灣賽事路線（本站整理）', '#/compete/taiwan', '邀請賽 → 預賽 → 冠軍賽 → 世界賽的大致流程與參賽準備清單。'],
      ['VEX Taiwan Open（VTO）官網', 'https://vto.cacet.org/', '台灣 VEX 賽事的官方網站：日程、報名簡章、賽前通知、得獎名單。主辦：國立臺北教育大學、中華資訊與科技教育學會。'],
      ['庫樂思機器人 Curious Blog', 'https://curious-edu.com/blog/', '台灣教育機構的部落格，會分享賽季車型與策略心得。第三方內容，請自行判斷。'],
    ]],
    ['問問題與給教練、家長', [
      ['VEX Forum：VEX IQ 一般討論', 'https://www.vexforum.com/c/vex-iq-general-discussion/', '全球選手與教練的英文討論區（機構、齒輪比、規則疑問都有人問）。公開網站：請家長陪同，不要透露真實姓名、學校或聯絡方式；規則的最終解釋以官方手冊與官方 Q&A 為準。'],
      ['VEX STEM Labs：教師資源', 'https://education.vex.com/stemlabs/zh-hant/iq/teacher-resources', '官方整理給老師的資源：進度節奏指南、材料清單、建構說明總表、評分細則、檢查表、給家長的信等（中文是機器翻譯）。教練與家長也很適合參考。'],
      ['VEX 知識庫：IQ 課程類型指南', 'https://kb.vex.com/hc/zh-tw/articles/5835932140948-VEX-IQ-%E5%8F%AF%E7%94%A8%E8%AA%B2%E7%A8%8B%E9%A1%9E%E5%9E%8B%E6%8C%87%E5%8D%97', '說明 STEM Labs、活動、活動系列有什麼不同，以及該從哪裡開始。'],
    ]],
    ['看別人的程式，要注意「授權」', [
      ['為什麼不能直接複製貼上？', '#/control', '上面幾個開源專案多半是 GPL 授權：可以讀、可以學概念；但把它們的程式碼放進自己的專案，自己的專案也得用同樣的授權公開。本站程式是 MIT 授權，所以我們沒有複製它們的程式，「控制實驗室」是自己從頭寫的。以後你寫作品集時，也要寫清楚參考了什麼、授權是什麼。'],
    ]],
  ];
  function viewResources() {
    paint(h('div', null,
      h('p', { class: 'sub' }, '這些是外部網站，會在新分頁開啟。官方網站以英文為主；正體中文頁面有些是機器翻譯。'),
      RES.map(([t, items]) => h('div', { class: 'panel' }, h('h2', null, t),
        items.map(([name, url, d]) => h('div', { class: 'wrongitem' }, url[0] === '#' ? h('a', { href: url }, h('b', null, name + ' ›')) : h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, h('b', null, name + ' ↗')), h('div', { class: 'sub' }, d)))))), '學習資源', '🔗');
  }

  VX.noteReadonly = noteReadonly; VX.kindName = KIND_NAME;
  VX.routes.challenge = (id) => viewChallenge(id);
  VX.routes.resources = () => viewResources();
  VX.routes.notebook = (a, b, c) => viewNotebook(a, b, c);
  VX.routes.build = (a, b) => viewBuild(a, b);
  VX.routes.compete = (a, b) => viewCompete(a, b);
})();
