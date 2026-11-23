/* 第二階段模組：挑戰題庫、工程筆記、組裝教學、比賽專區，以及家長頁的筆記區。依賴 app.js 的 window.VX 與 content.js。 */
(function () {
  'use strict';
  const VX = window.VX;
  const { h, api, shell, blocksEl, toast } = VX;
  const $ = () => VX.app;
  const fmt = (ts) => { const d = new Date(ts * 1000); return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate(); };
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
  const paint = (c, title, icon) => $().replaceChildren(shell(c, { title, icon }));
  const html = (s) => h('div', { html: s });

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
    if (!id) {
      const done = CHALLENGES.filter((c) => st.ch[c.id] && st.ch[c.id].done).length;
      const customList = Array.isArray(st.customCh) ? st.customCh : [];
      const card = (c) => {
        const rec = st.ch[c.id] || {};
        const d = rec.done;
        return h('a', { class: 'card', href: '#/challenge/' + c.id }, h('h3', null, c.title, d ? h('span', { class: 'tag done' }, ' ✓ 完成') : null), h('div', { class: 'stars' }, stars(c.lv)), h('p', { class: 'sub' }, c.goal_t),
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
        h('p', { class: 'sub' }, '把程式真的下載到機器人上跑跑看！每題完成後，記得寫一頁「測試紀錄」。已完成 ' + done + ' / ' + CHALLENGES.length),
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

  /* ============ 組裝教學 ============ */
  function viewBuild() {
    const st = VX.st;
    paint(h('div', null,
      h('p', { class: 'sub' }, '先搞懂原理，再動手做。每一課都有「動手做」小實驗，記得把結果寫進工程筆記。'),
      BUILD.map((b) => h('div', { class: 'panel' }, h('h2', null, b.title), html(b.svg), html(b.html), h('div', { class: 'callout warn' }, b.lab),
        h('div', { class: 'row gap' }, h('a', { class: 'btn primary', href: '#/practice/' + b.skill }, '練習題：' + VX.SK[b.skill].name), h('a', { class: 'btn', href: '#/notebook/new/test' }, '📓 寫測試紀錄')))),
      h('h2', null, '🔩 零件圖鑑'),
      h('p', { class: 'sub' }, '零件清單對照 VEXcode 裡「新增裝置」看到的項目。之後會加上你自己機器人的照片。'),
      h('div', { class: 'grid2' }, PARTS.map((p) => h('div', { class: 'card' }, h('h3', null, p.ic + ' ' + p.n), h('p', { class: 'sub' }, p.z))))), '組裝教學', '🔧');
  }

  /* ============ 比賽專區 ============ */
  async function viewCompete(a, b) {
    const nav = h('div', { class: 'row gap', style: 'margin:10px 0' }, [['', '總覽'], ['season', '當季 Level Up'], ['plan', '得分規劃器'], ['skills', '技能賽練習'], ['vocab', '英中術語卡'], ['interview', '面談練習']].map(([k, n]) => h('a', { class: 'btn sm' + ((a || '') === k ? ' primary' : ''), href: '#/compete' + (k ? '/' + k : '') }, n)));
    if (a === 'season') return season(nav);
    if (a === 'plan') return planner(nav);
    if (a === 'vocab') return vocab(nav);
    if (a === 'interview') return interview(nav);
    if (a === 'skills') return skills(nav);
    paint(h('div', null, nav,
      h('div', { class: 'panel' }, h('h2', null, '🏆 比賽專區'), h('p', null, '長期目標是參加區域賽、國際賽。這裡幫你把「機器人能力」和「表達能力」一起練起來。'),
        h('div', { class: 'tiles' },
          h('a', { class: 'tile', href: '#/compete/season', style: 'background:#f1ae34;border-color:#b38136' }, h('span', { class: 'ti' }, '🎯'), '當季 Level Up', h('small', null, '規則、計分、策略')),
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

  /* ============ 當季 Level Up ============ */
  const md = (t) => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
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
  VX.routes.build = () => viewBuild();
  VX.routes.compete = (a, b) => viewCompete(a, b);
})();
