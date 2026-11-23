/* 擴充功能：每週學習報告（家長頁）、作品集（孩子，可列印）、題庫審閱與回報（家長／老師）。 */
(function () {
  'use strict';
  const VX = window.VX;
  const { h, api, toast, shell } = VX;
  const DAY = 86400000;
  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (t) => { const x = new Date(t); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
  const md = (t) => { const x = new Date(t); return (x.getMonth() + 1) + '/' + x.getDate(); };
  const fmtDate = (ts) => { const x = new Date(ts); return x.getFullYear() + '/' + (x.getMonth() + 1) + '/' + x.getDate(); };
  const SKN = Object.fromEntries(SKILLS.map((s) => [s.id, s.name]));
  const QBY = Object.fromEntries(QS.map((q) => [q.id, q]));
  const trend = (a, b, unit) => (b === 0 && a === 0 ? '—' : a > b ? '▲ ' + (a - b) + unit : a < b ? '▼ ' + (b - a) + unit : '持平');

  /* ================= 一、每週學習報告 ================= */
  VX.weekly = async function (box, state, d) {
    if (!box) return;
    const now = Date.now();
    const keys = (a, b) => { const s = new Set(); for (let i = a; i <= b; i++) s.add(keyOf(now - i * DAY)); return s; };
    const thisK = keys(0, 6), lastK = keys(7, 13);
    const sum = (K) => (d.daily || []).filter((x) => K.has(x.d)).reduce((a, x) => ({ n: a.n + x.n, ok: a.ok + (x.ok || 0), min: a.min + (x.ms || 0) / 60000, days: a.days + 1 }), { n: 0, ok: 0, min: 0, days: 0 });
    const T = sum(thisK), Lw = sum(lastK);
    const acc = (x) => (x.n ? Math.round((x.ok / x.n) * 100) : 0);
    const recent = (d.recent || []).filter((r) => r.ts * 1000 >= now - 7 * DAY);
    const bySkill = {};
    recent.forEach((r) => { const o = bySkill[r.skill] || (bySkill[r.skill] = { n: 0, ok: 0 }); o.n++; o.ok += r.correct ? 1 : 0; });
    const topSkills = Object.entries(bySkill).sort((a, b) => b[1].n - a[1].n).slice(0, 3).map(([id, o]) => (SKN[id] || id) + '（' + o.n + ' 題，' + Math.round((o.ok / o.n) * 100) + '%）');
    const tags = {};
    recent.filter((r) => !r.correct && r.tag).forEach((r) => { tags[r.tag] = (tags[r.tag] || 0) + 1; });
    const topTag = Object.entries(tags).sort((a, b) => b[1] - a[1])[0];
    const chDone = Object.entries(state.ch || {}).filter(([, r]) => r.done && r.t && r.t >= now - 7 * DAY).map(([id]) => (CHALLENGES.find((c) => c.id === id) || {}).title || id);
    const simOk = Object.entries(state.ch || {}).filter(([, r]) => r.sim).length;
    const gritHighlights = Object.entries(state.ch || {})
      .filter(([id, r]) => r.sim && r.gritT && r.gritT >= now - 7 * DAY && CHALLENGES.some((c) => c.id === id))
      .slice(0, 3)
      .map(([id, r]) => {
        const title = (CHALLENGES.find((c) => c.id === id) || {}).title || id;
        const parts = [];
        if ((r.fails || 0) >= 2) parts.push('試錯 ' + r.fails + ' 次後破關');
        if ((r.stars || 0) >= 3) parts.push('拿到 ⭐⭐⭐');
        return '「' + title + '」' + parts.join('、');
      });
    let notes = [];
    try { notes = (await api('/api/parent/learner/' + d.id + '/notes')).notes.filter((n) => n.updated * 1000 >= now - 7 * DAY); } catch (e) { /* ignore */ }
    const mastered = SKILLS.filter((s) => pOf(state, s.id) >= 0.8).length;
    const newBadges = (VX.badges ? VX.badges.list : []).filter((b) => state.badges && state.badges[b.id] && state.badges[b.id] >= now - 7 * DAY);
    const range = md(now - 6 * DAY) + '～' + md(now);
    const lines = [
      '【VEX IQ 學習週報】' + d.display + '（' + range + '）',
      '📚 練習 ' + T.days + ' 天、約 ' + Math.round(T.min) + ' 分鐘、' + T.n + ' 題，正確率 ' + (T.n ? acc(T) + '%' : '—'),
      '📈 比上週：時間 ' + trend(Math.round(T.min), Math.round(Lw.min), ' 分鐘') + '、題數 ' + trend(T.n, Lw.n, ' 題'),
      topSkills.length ? '💪 練得最多：' + topSkills.join('、') : '',
      topTag ? '⚠️ 常見錯誤：' + (TAGS[topTag[0]] || topTag[0]) + '（' + topTag[1] + ' 次）' : '',
      chDone.length ? '🏁 完成挑戰：' + chDone.join('、') : '',
      gritHighlights.length ? '🌟 克服卡關亮點：' + gritHighlights.join('；') : '',
      notes.length ? '📓 工程筆記 ' + notes.length + ' 頁：' + notes.slice(0, 3).map((n) => n.title).join('、') : '📓 這週還沒寫工程筆記',
      newBadges.length ? '🏅 新徽章：' + newBadges.map((b) => b.icon + b.name).join('、') : '',
      '🎯 已精通 ' + mastered + ' / ' + SKILLS.length + ' 個技能',
    ].filter(Boolean);
    const trI = (window.VXI18N && window.VXI18N.tr) || ((x) => x);
    const textOut = trI(lines.join('\n')); // 英文介面時，複製出去的文字也是英文
    const item = (label, val, sub) => h('div', null, h('b', null, val), h('small', null, label + (sub ? '　' + sub : '')));
    box.replaceChildren(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, '📊 每週學習報告　', h('small', null, range)),
      h('div', { class: 'stats' }, item('練習天數', T.days + ' 天', trend(T.days, Lw.days, ' 天')), item('練習時間', Math.round(T.min) + ' 分', trend(Math.round(T.min), Math.round(Lw.min), ' 分')), item('答題數', T.n + ' 題', trend(T.n, Lw.n, ' 題')), item('正確率', T.n ? acc(T) + '%' : '—', Lw.n ? '上週 ' + acc(Lw) + '%' : '')),
      h('ul', null,
        topSkills.length ? h('li', null, h('b', null, '練得最多：'), topSkills.join('、')) : h('li', null, '這週還沒有練習紀錄。'),
        topTag ? h('li', null, h('b', null, '最常見的錯誤：'), (TAGS[topTag[0]] || topTag[0]) + '（' + topTag[1] + ' 次）——可以問他：「這一類題目你是怎麼想的？」') : null,
        h('li', null, h('b', null, '挑戰：'), chDone.length ? '本週完成 ' + chDone.join('、') : '本週沒有新完成的挑戰', '（累計模擬通過 ' + simOk + ' 個）'),
        gritHighlights.length ? h('li', null, h('b', null, '🌟 克服卡關亮點：'), gritHighlights.join('；'), '——非常適合稱讚他願意反覆試錯的精神！') : null,
        newBadges.length ? h('li', null, h('b', null, '新徽章：'), newBadges.map((b) => b.icon + ' ' + b.name).join('、')) : null,
        h('li', null, h('b', null, '工程筆記：'), notes.length ? '本週寫了 ' + notes.length + ' 頁' : '本週還沒寫，提醒他每次練習後寫一小頁')),
      h('details', { class: 'lessonbox' }, h('summary', null, '可貼到 LINE 的文字版'), h('div', { class: 'body' }, h('pre', { style: 'white-space:pre-wrap;font:inherit;margin:0 0 8px' }, textOut), h('button', { class: 'btn sm primary', onclick: async () => { try { await navigator.clipboard.writeText(textOut); toast('已複製，可以貼到 LINE'); } catch (e) { toast('這個瀏覽器不能自動複製，請手動選取文字'); } } }, '複製文字')))));
  };
  const pOf = (state, id) => (state && state.m && state.m[id] && state.m[id].p) || 0;

  /* ================= 二、作品集（可列印）================= */
  async function viewPortfolio() {
    const st = VX.st, user = VX.user;
    VX.app.replaceChildren(shell(h('p', { class: 'sub' }, '整理中…'), { title: '作品集', icon: '🎓' }));
    let notes = []; try { notes = (await api('/api/notes')).notes.slice().sort((a, b) => a.created - b.created); } catch (e) { toast(e.message); }
    const mastered = SKILLS.filter((s) => pOf(st, s.id) >= 0.8);
    const chDone = CHALLENGES.filter((c) => st.ch && st.ch[c.id] && (st.ch[c.id].done || st.ch[c.id].sim));
    const days = Object.keys(st.days || {}).length;
    const skills = notes.filter((n) => n.kind === 'skills');
    const rest = notes.filter((n) => n.kind !== 'skills' && n.kind !== 'interview');
    const byKind = {};
    rest.forEach((n) => { (byKind[n.kind] = byKind[n.kind] || []).push(n); });
    const sections = Object.entries(byKind).map(([k, list]) => h('section', { class: 'pfsec' }, h('h2', null, VX.kindName ? VX.kindName(k) : k),
      list.map((n) => h('div', { class: 'pfnote' }, h('h3', null, h('span', { 'data-notrans': '1' }, n.title), h('small', null, '　' + fmtDate(n.created * 1000))), VX.noteReadonly ? VX.noteReadonly(n) : null))));
    VX.app.replaceChildren(shell(h('div', { class: 'portfolio' },
      h('div', { class: 'row gap noprint' }, h('button', { class: 'btn primary', onclick: () => window.print() }, '🖨 列印／存成 PDF'), h('a', { class: 'btn', href: '#/notebook' }, '回筆記')),
      h('p', { class: 'sub noprint' }, '這份作品集會把你寫過的工程筆記整理在一起。按「列印」後，在列印視窗選「存成 PDF」就可以存檔。'),
      h('div', { class: 'panel pfhead' }, h('h1', { style: 'margin-top:0' }, h('span', { 'data-notrans': '1' }, user.display || user.name), '的 VEX IQ 作品集'), h('div', { class: 'sub' }, '整理日期：' + fmtDate(Date.now())),
        h('div', { class: 'stats' }, h('div', null, h('b', null, mastered.length + ' / ' + SKILLS.length), h('small', null, '精通的技能')), h('div', null, h('b', null, chDone.length), h('small', null, '完成的挑戰')), h('div', null, h('b', null, days), h('small', null, '練習天數')), h('div', null, h('b', null, notes.length), h('small', null, '筆記頁數'))),
        (VX.badges && st.badges && Object.keys(st.badges).length) ? h('p', null, h('b', null, '成就徽章：'), VX.badges.list.filter((b) => st.badges[b.id]).map((b) => b.icon + ' ' + b.name).join('　')) : null,
        mastered.length ? h('p', null, h('b', null, '已精通：'), mastered.map((s) => s.name).join('、')) : null,
        chDone.length ? h('p', null, h('b', null, '挑戰：'), chDone.map((c) => c.title).join('、')) : null),
      sections.length ? sections : h('div', { class: 'panel' }, '還沒有筆記。先到「筆記」寫第一頁，作品集就會出現在這裡。'),
      skills.length ? h('section', { class: 'pfsec' }, h('h2', null, '🏆 技能賽練習紀錄'), h('table', { class: 'tbl' }, h('tr', null, ['日期', '類型', '分數', '想法'].map((x) => h('th', null, x))), ...skills.map((n) => h('tr', null, ['date', 'type', 'score', 'note'].map((k) => h('td', null, String((n.data.f || {})[k] || '')))))) ) : null), { title: '作品集', icon: '🎓' }));
  }

  /* ================= 三、題庫審閱與回報 ================= */
  async function viewReview() {
    if (VX.user.role !== 'parent' && VX.user.role !== 'coach') { location.hash = '#/'; return; }
    VX.app.replaceChildren(shell(h('p', { class: 'sub' }, '載入中…'), { title: '題庫審閱', icon: '📝' }));
    let flags = []; try { flags = (await api('/api/parent/qflags')).flags; } catch (e) { toast(e.message); }
    const filt = h('select', { onchange: () => draw() }, h('option', { value: '' }, '全部技能（' + QS.length + ' 題）'), SKILLS.map((s) => h('option', { value: s.id }, s.name + '（' + QS.filter((q) => q.s === s.id).length + '）')), h('option', { value: '!flag' }, '只看有回報的'));
    const list = h('div');
    const openFlags = () => flags.filter((f) => f.status === 'open');
    const head = h('div', { class: 'panel' });
    function qHtml(q) {
      const flagsOfQ = flags.filter((f) => f.qid === q.id);
      const body = [h('div', { style: 'font-weight:700' }, q.q)];
      if (q.code) body.push(VX.blocksEl(q.code));
      if (q.t === 'mc') body.push(h('ol', { type: 'A' }, q.opts.map((o, i) => h('li', { style: i === q.a ? 'color:var(--ok);font-weight:700' : '' }, o + (i === q.a ? '　✔ 正解' : '')))));
      else if (q.t === 'num') body.push(h('div', { style: 'color:var(--ok);font-weight:700' }, '答案：' + q.a + (q.unit ? ' ' + q.unit : '')));
      else if (q.t === 'ord') body.push(h('ol', null, q.items.map((o) => h('li', null, o.trim()))));
      else if (q.t === 'bug') body.push(h('div', { style: 'color:var(--ok);font-weight:700' }, '有問題的是第 ' + (q.a + 1) + ' 行：' + q.code[q.a].trim()));
      body.push(h('div', { class: 'sub' }, '解釋：' + q.why));
      flagsOfQ.forEach((f) => body.push(h('div', { class: 'callout warn' }, (f.status === 'done' ? '✅ 已處理：' : '🚩 ') + f.comment, ' ', h('button', { class: 'btn sm ghost', onclick: async () => { try { await api('/api/parent/qflag/' + f.id + '/status', { status: f.status === 'done' ? 'open' : 'done' }); flags = (await api('/api/parent/qflags')).flags; draw(); } catch (e) { toast(e.message); } } }, f.status === 'done' ? '重新開啟' : '標記已處理'))));
      body.push(h('button', { class: 'btn sm', onclick: async () => { const c = prompt('這題有什麼問題？（答案不對、說法不清楚、太難、錯字…）'); if (!c || !c.trim()) return; try { await api('/api/parent/qflag', { qid: q.id, comment: c }); flags = (await api('/api/parent/qflags')).flags; draw(); toast('已回報'); } catch (e) { toast(e.message); } } }, '🚩 回報問題'));
      return h('div', { class: 'wrongitem vxscope' }, h('div', { class: 'row', style: 'gap:8px' }, h('span', { class: 'tag' }, q.id), h('span', { class: 'tag' }, '難度 ' + q.l), h('span', { class: 'tag' }, q.t)), ...body);
    }
    function draw() {
      const f = filt.value; let qs = QS;
      if (f === '!flag') qs = QS.filter((q) => flags.some((x) => x.qid === q.id)); else if (f) qs = QS.filter((q) => q.s === f);
      head.replaceChildren(...[h('h3', { style: 'margin-top:0' }, '待處理的回報：' + openFlags().length + ' 則'),
        openFlags().length ? h('button', { class: 'btn sm', onclick: async () => { const t = openFlags().map((x) => x.qid + '：' + x.comment).join('\n'); try { await navigator.clipboard.writeText(t); toast('已複製回報清單'); } catch (e) { toast('請手動選取'); } } }, '複製回報清單（貼給我修正）') : null].filter(Boolean));
      list.replaceChildren(...qs.map(qHtml));
    }
    VX.app.replaceChildren(shell(h('div', null,
      h('p', { class: 'sub' }, '這裡列出所有題目和答案，請你或補習班老師幫忙看看：答案對不對、說法清不清楚、難度合不合適。有疑問就按「回報問題」，我會依回報清單修正。'),
      head, h('div', { class: 'panel' }, h('div', { class: 'field' }, h('label', null, '篩選'), filt), list)), { title: '題庫審閱', icon: '📝' }));
    draw();
  }

  VX.routes.portfolio = () => viewPortfolio();
  VX.routes.review = () => viewReview();
})();
