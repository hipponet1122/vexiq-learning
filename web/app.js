/* VEX IQ 自學網站前端（無框架）。資料與題庫在 data.js。 */
(function () {
  'use strict';

  const $app = document.getElementById('app');
  const SK = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
  const QBY = Object.fromEntries(QS.map((q) => [q.id, q]));
  const DOM = Object.fromEntries(DOMAINS.map((d) => [d.id, d]));

  let user = null; // {id,name,display,role}
  let st = null; // 學習狀態 {done, m:{skill:{p,n,t}}, seen:{qid:{c,w,t}}, days:{date:n}}
  let session = null; // 目前進行中的測驗/練習

  /* ---------- 小工具 ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
    return el;
  }
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  async function api(path, body) {
    const opt = { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) { opt.method = 'POST'; opt.body = JSON.stringify(body); }
    let r;
    try { r = await fetch(path, opt); } catch (e) { throw new Error('連不上網站，請檢查網路'); }
    let d = {};
    try { d = await r.json(); } catch (e) { /* ignore */ }
    if (!r.ok) { const er = new Error(d.error || '發生錯誤'); er.status = r.status; throw er; }
    return d;
  }

  function toast(msg) {
    const t = h('div', { class: 'toast' }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 3200);
  }

  /* ---------- 積木外觀（VEXcode IQ 風格）----------
     語法：[下拉選單]  (數字或文字欄位)  <條件>；行首空白兩格代表縮排（積木裡面）。 */
  const CONTAINER = /^(重複|永遠|而|如果|別的|否則)/;
  function blockClass(line) {
    const s = line.trim().replace(/^<|>$/g, '');
    if (/^(when|何時|當)/i.test(s)) return 'b-event hat';
    if (/^broadcast/i.test(s)) return 'b-event';
    if (/^(set drive|set turn|drive|turn|stop driving|spin|stop \[|驅動|旋轉|轉|停止駕駛|將驅動|將轉彎)/i.test(s)) return 'b-motion';
    if (/^(print|set cursor|clear all rows|play sound|在螢幕)/i.test(s)) return /^play sound/i.test(s) ? 'b-sound' : 'b-looks';
    if (/^(wait|repeat|forever|while|if |else|break|等待|等到|重複|永遠|而|如果|別的|否則|休息|停止項目)/i.test(s)) return 'b-control';
    if (/^set \[?\w+\]? (velocity|stopping|max torque|position|timeout)/i.test(s)) return 'b-motion';
    if (/^(set |change |將 ?\[)/.test(s) && !/^set (cursor)/i.test(s)) return 'b-var';
    if (/^(define|Make a Block|forward_then_turn|我的積木)/i.test(s)) return 'b-my';
    if (/(Bumper|Distance|Gyro|BrainInertial|Brain timer|reset timer|calibrate|Controller|Color|Optical|距離|碰撞|顏色|慣性|航向|感測|觸碰)/i.test(s)) return 'b-sense';
    if (/^[(]|^A (and|or) B|^not A|^\( \)/i.test(s)) return 'b-op';
    return 'b-other';
  }
  function blockInner(text) {
    const parts = text.split(/(\[[^\]]*\]|\([^)]*\)|<[^>]*>)/).filter((x) => x !== '');
    return parts.map((x) => {
      if (x[0] === '[' && x.endsWith(']')) return h('span', { class: 'fd dd' }, x.slice(1, -1));
      if (x[0] === '(' && x.endsWith(')')) return h('span', { class: 'fd num' }, x.slice(1, -1));
      if (x[0] === '<' && x.endsWith('>')) return h('span', { class: 'fd bool' }, x.slice(1, -1));
      return document.createTextNode(x.trim() ? x.trim() : '');
    });
  }
  const toEn = window.VXEN.toEn;
  window.VXEN.localize(QS); // 題目裡的積木字樣改成 VEXcode 英文
  function oneBlock(text) {
    const zh = text.trim();
    const en = st && st.simLang === 'zh' ? zh : toEn(zh);
    return h('div', { class: 'blk ' + blockClass(zh), title: en !== zh ? zh : null }, blockInner(en));
  }
  function blocksEl(lines) {
    // 依縮排組成巢狀（C 形積木）
    const items = lines.map((ln) => ({ ind: (ln.match(/^ */)[0].length / 2) | 0, t: ln.trim() }));
    let i = 0;
    function build(level) {
      const out = [];
      while (i < items.length && items[i].ind >= level) {
        const it = items[i++];
        const head = oneBlock(it.t);
        if (CONTAINER.test(it.t) && i < items.length && items[i].ind > it.ind) {
          const inner = build(it.ind + 1);
          const cls = blockClass(it.t).split(' ')[0];
          const col = getComputedStyle(document.documentElement).getPropertyValue('--m-control-s');
          out.push(h('div', { class: 'cblk' }, head, h('div', { class: 'cin ' + cls, style: 'background:none;border-left-color:' + col }, inner)));
        } else out.push(head);
      }
      return out;
    }
    return h('div', { class: 'blocks' }, build(0));
  }
  function plainOrBlock(text) {
    return /^(驅動|旋轉|等待|等到|重複|永遠|而|如果|別的|否則|停止駕駛|將|何時|當)/.test(text.trim()) || /[\[(<]/.test(text) ? blocksEl([text]) : h('span', null, text);
  }
  function doLogout() { return api('/api/logout', {}).then(() => { user = null; st = null; session = null; location.hash = '#/login'; render(); }); }

  /* ---------- 學習狀態與出題引擎 ---------- */
  function newState() { return { done: false, m: {}, seen: {}, days: {} }; }
  function pOf(id) { return (st.m[id] && st.m[id].p) || 0; }
  const CEIL = [0.5, 0.8, 1.0];
  const WRONG = [0.6, 0.8, 0.92];
  function levelFor(p) { return p < 0.35 ? 1 : p < 0.7 ? 2 : 3; }
  const mastered = (id) => pOf(id) >= 0.8;
  const stars = (p) => (p < 0.25 ? 0 : p < 0.5 ? 1 : p < 0.8 ? 2 : 3);

  function applyResult(q, correct) {
    const m = st.m[q.s] || (st.m[q.s] = { p: 0, n: 0, t: 0 });
    const L = q.l - 1;
    if (correct) m.p += Math.max(0, CEIL[L] - m.p) * 0.45; else m.p *= WRONG[L];
    m.p = clamp(m.p, 0, 1);
    m.n += 1; m.t = Date.now();
    if (window.VX && VX.act) VX.act('practice', q.s);
    const sn = st.seen[q.id] || (st.seen[q.id] = { c: 0, w: 0, t: 0 });
    if (correct) sn.c++; else sn.w++;
    sn.t = Date.now();
    const d = todayStr();
    st.days[d] = (st.days[d] || 0) + 1;
    const keys = Object.keys(st.days).sort();
    while (keys.length > 90) delete st.days[keys.shift()];
  }

  function unlocked(id) { return SK[id].pre.every((p) => pOf(p) >= 0.45); }

  function pickSkill(recent) {
    let cands = SKILLS.filter((s) => unlocked(s.id));
    if (!cands.length) cands = SKILLS;
    const last2 = recent.slice(-2);
    if (last2.length === 2 && last2[0] === last2[1]) { const f = cands.filter((s) => s.id !== last2[1]); if (f.length) cands = f; }
    const now = Date.now();
    const w = cands.map((s) => {
      const p = pOf(s.id);
      const m = st.m[s.id];
      const days = m && m.t ? (now - m.t) / 86400000 : 7;
      const stale = p > 0.5 ? Math.min(1, days / 7) * 0.5 : 0;
      return Math.pow(1 - p, 1.5) + 0.08 + stale;
    });
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) return cands[i].id; }
    return cands[cands.length - 1].id;
  }

  function pickQuestion(skillId, level, used) {
    const pool = QS.filter((q) => q.s === skillId && !used.has(q.id));
    const pool2 = pool.length ? pool : QS.filter((q) => q.s === skillId);
    const score = (q) => {
      const sn = st.seen[q.id];
      const unseen = sn ? 0 : 1;
      const wrongBias = sn && sn.w > sn.c ? 0.5 : 0; // 以前答錯的，比較早再出現
      const age = sn ? (Date.now() - sn.t) / 86400000 : 30;
      return -Math.abs(q.l - level) * 3 + unseen * 2 + wrongBias + Math.min(age, 10) * 0.05 + Math.random() * 0.3;
    };
    return pool2.slice().sort((a, b) => score(b) - score(a))[0];
  }

  async function save(q, res, mode) {
    try {
      await api('/api/answer', {
        qid: q.id, skill: q.s, level: q.l, correct: res.correct, choice: res.choice,
        tag: res.correct ? '' : res.tag || '', ms: res.ms, mode, state: st,
      });
    } catch (e) {
      toast('這題的紀錄沒有存到（' + e.message + '）');
    }
  }
  async function saveState() {
    try { await api('/api/answer', { state: st }); } catch (e) { toast('進度沒有存到：' + e.message); }
  }

  /* ---------- 題目畫面 ---------- */
  function renderQuestion(q, { onDone, allowSkip = true }) {
    const t0 = Date.now();
    const card = h('div', { class: 'qcard' });
    const sk = SK[q.s];
    card.append(h('div', { class: 'qmeta' }, h('span', { class: 'chip', style: 'background:' + DOM[sk.d].color + ';border-color:' + DOM[sk.d].stroke }, sk.name), h('span', { class: 'lv' }, '難度 ' + '★'.repeat(q.l) + '☆'.repeat(3 - q.l))));
    card.append(h('div', { class: 'qtext' }, q.q));
    if (q.code && q.t !== 'bug') card.append(blocksEl(q.code));
    const area = h('div', { class: 'qarea' });
    card.append(area);
    const fb = h('div', { class: 'feedback hidden' });
    card.append(fb);
    let finished = false;

    function finish(correct, choice, tag, correctText) {
      if (finished) return;
      finished = true;
      const ms = Date.now() - t0;
      card.classList.add('answered');
      fb.classList.remove('hidden');
      fb.classList.add(correct ? 'ok' : 'bad');
      fb.append(
        h('div', { class: 'fb-title' }, correct ? '✅ 答對了！' : '❌ 這題沒答對'),
        !correct && correctText ? h('div', { class: 'fb-ans' }, '正確答案：', correctText) : null,
        h('div', { class: 'fb-why' }, q.why),
        h('button', { class: 'btn primary', id: 'nextBtn', onclick: () => onDone({ correct, choice, tag, ms }) }, '下一題 ➜')
      );
      const nb = fb.querySelector('#nextBtn'); if (nb) nb.focus();
    }
    function addSkip(correctText) {
      if (!allowSkip) return;
      area.append(h('button', { class: 'btn ghost skip', onclick: () => { lock(); finish(false, '(還不會)', 'unknown', correctText); } }, '我還不會'));
    }
    function lock() { area.querySelectorAll('button,input').forEach((b) => (b.disabled = true)); }

    if (q.t === 'mc') {
      const idx = shuffle(q.opts.map((_, i) => i));
      const list = h('div', { class: 'opts' });
      idx.forEach((oi, pos) => {
        const b = h('button', { class: 'opt', onclick: () => {
          lock();
          const ok = oi === q.a;
          b.classList.add(ok ? 'right' : 'wrong');
          if (!ok) list.children[idx.indexOf(q.a)].classList.add('right');
          finish(ok, q.opts[oi], ok ? '' : (q.tags && q.tags[oi]) || 'concept', q.opts[q.a]);
        } }, h('span', { class: 'ol' }, String.fromCharCode(65 + pos)), h('span', { class: 'ot' }, q.opts[oi]));
        list.append(b);
      });
      area.append(list);
      addSkip(q.opts[q.a]);
    } else if (q.t === 'num') {
      const inp = h('input', { type: 'text', inputmode: 'decimal', class: 'numin', placeholder: '輸入數字', autocomplete: 'off' });
      const go = () => {
        const v = parseFloat(inp.value.replace(/[,，\s]/g, ''));
        if (isNaN(v)) { inp.focus(); return; }
        lock();
        const ok = Math.abs(v - q.a) <= q.tol + 1e-9;
        finish(ok, String(v), ok ? '' : q.tag, q.a + (q.unit ? ' ' + q.unit : ''));
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      area.append(h('div', { class: 'numrow' }, inp, q.unit ? h('span', { class: 'unit' }, q.unit) : null, h('button', { class: 'btn primary', onclick: go }, '送出')));
      addSkip(q.a + (q.unit ? ' ' + q.unit : ''));
      setTimeout(() => inp.focus(), 50);
    } else if (q.t === 'ord') {
      const items = q.items.map((text, i) => ({ text, i }));
      const pool = shuffle(items);
      let chosen = [];
      const ansBox = h('div', { class: 'ordans' });
      const poolBox = h('div', { class: 'ordpool' });
      const goBtn = h('button', { class: 'btn primary', disabled: true, onclick: () => {
        lock();
        const norm = (s) => s.trim();
        const ok = chosen.every((it, k) => norm(it.text) === norm(q.items[k]));
        finish(ok, chosen.map((c) => c.text.trim()).join(' → '), ok ? '' : 'order', q.items.map((s, k) => (k + 1) + '. ' + s.trim()).join('　'));
      } }, '送出順序');
      function draw() {
        ansBox.replaceChildren(...(chosen.length ? chosen.map((it, k) => h('button', { class: 'chip-item', onclick: () => { chosen = chosen.filter((c) => c !== it); draw(); } }, h('b', null, k + 1 + '. '), plainOrBlock(it.text))) : [h('span', { class: 'hint' }, '依序點選下面的項目，放進這裡')]));
        poolBox.replaceChildren(...pool.filter((it) => !chosen.includes(it)).map((it) => h('button', { class: 'chip-item', onclick: () => { chosen.push(it); draw(); } }, plainOrBlock(it.text))));
        goBtn.disabled = chosen.length !== items.length;
      }
      draw();
      area.append(ansBox, poolBox, goBtn);
      addSkip(q.items.map((s, k) => (k + 1) + '. ' + s.trim()).join('　'));
    } else if (q.t === 'bug') {
      const list = h('div', { class: 'buglist' });
      q.code.forEach((ln, idx) => {
        const ind = (ln.match(/^ */)[0].length / 2) | 0;
        const b = h('button', { class: 'bugline', style: 'padding-left:' + (2 + ind * 22) + 'px', onclick: () => {
          lock();
          const ok = idx === q.a;
          b.classList.add(ok ? 'right' : 'wrong');
          if (!ok) list.children[q.a].classList.add('right');
          finish(ok, ln.trim(), ok ? '' : q.tag || 'debug', q.code[q.a].trim());
        } }, blocksEl([ln.trim()]));
        list.append(b);
      });
      area.append(list);
      addSkip(q.code[q.a].trim());
    }
    return card;
  }

  /* ---------- 定位測驗 ---------- */
  function startPlacement() {
    const plan = DOMAINS.filter((d) => !d.noPlace).map((d) => {
      const sk = SKILLS.filter((s) => s.d === d.id);
      return { d: d.id, sk, lo: 0, hi: sk.length, cap: sk.length <= 4 ? 2 : 3, probes: 0, res: {} };
    });
    session = { type: 'placement', plan, di: 0, count: 0, total: plan.reduce((a, p) => a + p.cap, 0) };
    nextPlacement();
  }
  function nextPlacement() {
    const S = session;
    while (S.di < S.plan.length && (S.plan[S.di].lo >= S.plan[S.di].hi || S.plan[S.di].probes >= S.plan[S.di].cap)) S.di++;
    if (S.di >= S.plan.length) return finishPlacement();
    const p = S.plan[S.di];
    const mid = Math.floor((p.lo + p.hi) / 2);
    const skill = p.sk[Math.min(mid, p.sk.length - 1)];
    const q = QS.filter((x) => x.s === skill.id && x.l === 2).sort(() => Math.random() - 0.5)[0];
    S.count++;
    drawQuiz({
      title: '定位測驗', sub: '先看看你現在會到哪裡。不會的可以按「我還不會」，沒有關係！',
      progress: S.count / S.total, q,
      onDone: async (res) => {
        p.probes++;
        p.res[skill.id] = res.correct;
        if (res.correct) p.lo = mid + 1; else p.hi = mid;
        await save(q, res, 'placement');
        nextPlacement();
      },
    });
  }
  function finishPlacement() {
    const S = session;
    st = newState();
    S.plan.forEach((p) => {
      const k = p.lo; // 保守估計：只認「確定答對」的範圍
      p.sk.forEach((s, i) => {
        const prior = i < k ? 0.6 : i === k ? 0.3 : 0.05;
        let pv = prior;
        if (p.res[s.id] === true) pv = Math.max(pv, 0.75);
        if (p.res[s.id] === false) pv = Math.min(pv, 0.2);
        st.m[s.id] = { p: pv, n: p.res[s.id] === undefined ? 0 : 1, t: Date.now() };
      });
    });
    st.done = true;
    session = null;
    saveState();
    location.hash = '#/result';
  }

  /* ---------- 練習 ---------- */
  function startPractice(skillId) {
    session = { type: 'practice', skill: skillId || null, n: skillId ? Math.min(5, QS.filter((q) => q.s === skillId).length) : 10, idx: 0, used: new Set(), recent: [], rescue: null, right: 0, before: JSON.parse(JSON.stringify(st.m)) };
    nextPractice();
  }
  function nextPractice() {
    const S = session;
    if (S.idx >= S.n) return finishPractice();
    let sid, level;
    if (S.rescue) { sid = S.rescue.skill; level = Math.max(1, S.rescue.level - 1); S.rescue = null; }
    else { sid = S.skill || pickSkill(S.recent); level = levelFor(pOf(sid)); }
    const q = pickQuestion(sid, level, S.used);
    S.used.add(q.id); S.recent.push(sid); S.idx++;
    drawQuiz({
      title: S.skill ? '練習：' + SK[S.skill].name : '今日練習', sub: '',
      progress: S.idx / S.n, q, qnum: S.idx + ' / ' + S.n,
      onDone: async (res) => {
        applyResult(q, res.correct);
        if (res.correct) S.right++; else S.rescue = { skill: q.s, level: q.l };
        await save(q, res, 'practice');
        nextPractice();
      },
    });
  }
  function finishPractice() {
    const S = session; session = null;
    const rows = Object.keys(st.m).filter((id) => Math.abs((st.m[id].p || 0) - ((S.before[id] && S.before[id].p) || 0)) > 0.005).map((id) => ({ id, a: (S.before[id] && S.before[id].p) || 0, b: st.m[id].p }));
    $app.replaceChildren(shell(h('div', { class: 'panel center' },
      h('div', { class: 'big' }, S.right === S.n ? '🎉' : S.right >= S.n / 2 ? '👍' : '💪'),
      h('h2', null, '這回合答對 ' + S.right + ' / ' + S.n + ' 題'),
      rows.length ? h('div', { class: 'changes' }, rows.map((r) => h('div', { class: 'chg' }, h('span', null, SK[r.id].name), h('span', { class: r.b >= r.a ? 'up' : 'down' }, (r.b >= r.a ? '▲ ' : '▼ ') + Math.round(r.a * 100) + '% → ' + Math.round(r.b * 100) + '%')))) : null,
      h('div', { class: 'row gap' }, h('button', { class: 'btn primary', onclick: () => startPractice(S.skill) }, '再練一回合'), h('a', { class: 'btn', href: '#/' }, '回首頁'))
    )));
  }

  function drawQuiz({ title, sub, progress, q, qnum, onDone }) {
    const bar = h('div', { class: 'pbar' }, h('div', { style: 'width:' + Math.round(clamp(progress, 0, 1) * 100) + '%' }));
    $app.replaceChildren(shell(h('div', null,
      h('div', { class: 'quizhead' }, h('h2', null, title), qnum ? h('span', { class: 'qnum' }, qnum) : null, h('a', { class: 'quit', href: '#/', onclick: () => { session = null; } }, '離開')),
      sub ? h('p', { class: 'sub' }, sub) : null, bar,
      renderQuestion(q, { onDone })
    )));
    window.scrollTo(0, 0);
  }

  /* ---------- 畫面骨架 ---------- */
  const TABS = [['#/', '🏠', '首頁', ''], ['#/practice', '✏️', '練習', 'practice'], ['#/challenge', '🏁', '挑戰', 'challenge'], ['#/sim', '🖥️', '模擬器', 'sim'], ['#/import', '📤', '上傳存檔', 'import'], ['#/notebook', '📓', '筆記', 'notebook'], ['#/build', '🔧', '組裝', 'build'], ['#/compete', '🏆', '比賽', 'compete'], ['#/cheat', '📋', '速查表', 'cheat'], ['#/resources', '🔗', '資源', 'resources'], ['#/guide', '🧭', '怎麼用', 'guide']];
  function shell(content, opts) {
    opts = opts || {};
    if (opts.bare) return h('div', null, content);
    const cur = (location.hash.replace(/^#\/?/, '').split('/')[0]) || '';
    const tabs = [];
    if (user && user.role === 'learner') TABS.forEach(([href, ic, name, key]) => tabs.push(h('a', { class: 'tab' + (key === cur || (key === '' && (cur === '' || cur === 'skill' || cur === 'result')) ? ' on' : ''), href }, h('span', { class: 'ti' }, ic), name)));
    if (user && user.role === 'coach') tabs.push(h('a', { class: 'tab' + (cur === 'parent' ? ' on' : ''), href: '#/parent' }, h('span', { class: 'ti' }, '👥'), '學員狀況'), h('a', { class: 'tab' + (cur === 'review' ? ' on' : ''), href: '#/review' }, h('span', { class: 'ti' }, '📝'), '題庫審閱'), h('a', { class: 'tab' + (cur === 'resources' ? ' on' : ''), href: '#/resources' }, h('span', { class: 'ti' }, '🔗'), '資源'));
    if (user && user.role === 'parent') tabs.push(h('a', { class: 'tab' + (cur === 'parent' ? ' on' : ''), href: '#/parent' }, h('span', { class: 'ti' }, '👪'), '家長頁'), h('a', { class: 'tab' + (cur === 'guide' ? ' on' : ''), href: '#/guide' }, h('span', { class: 'ti' }, '🧭'), '怎麼用'), h('a', { class: 'tab' + (cur === 'review' ? ' on' : ''), href: '#/review' }, h('span', { class: 'ti' }, '📝'), '題庫審閱'), h('a', { class: 'tab' + (cur === 'resources' ? ' on' : ''), href: '#/resources' }, h('span', { class: 'ti' }, '🔗'), '資源'));
    const bar = h('header', { class: 'topbar' },
      h('a', { class: 'logo', href: '#/' }, h('b', null, 'IQ'), h('span', null, '自學')),
      h('div', { class: 'tabs' }, tabs),
      user ? h('a', { class: 'tab', href: '#/me' }, h('span', { class: 'ti' }, '👤'), user.display || user.name) : null,
      user ? h('button', { class: 'tab', style: 'background:none;border:0;border-bottom:3px solid transparent;font:inherit;font-size:.72rem;cursor:pointer', onclick: doLogout }, h('span', { class: 'ti' }, '🚪'), '登出') : null);
    const parts = [bar];
    let hidePw = false; try { hidePw = sessionStorage.getItem('vx_pwtip') === '1'; } catch (e) { /* ignore */ }
    if (user && user.pw_initial && cur !== 'me' && !hidePw) {
      const bn = h('div', { class: 'pwbanner' }, h('span', null, '🔑 你現在用的是初始密碼，可以改成自己習慣的密碼（不限格式）。'), h('a', { href: '#/me' }, '修改密碼'),
        h('button', { class: 'pwx', title: '先不要', onclick: () => { try { sessionStorage.setItem('vx_pwtip', '1'); } catch (e) { /* ignore */ } bn.remove(); } }, '✕'));
      parts.push(bn);
    }
    if (opts.title) parts.push(h('div', { class: 'subbar' }, opts.icon ? h('span', { class: 'ic' }, opts.icon) : null, opts.title));
    let main = h('main', { class: 'content' }, content);
    if (opts.rail) {
      const rail = h('nav', { class: 'rail' }, DOMAINS.map((dm) => h('a', { href: '#', onclick: (e) => { e.preventDefault(); const el = document.getElementById('dom-' + dm.id); if (el) el.scrollIntoView({ behavior: 'smooth' }); } }, h('span', { class: 'dot', style: 'background:' + dm.color + ';border-color:' + dm.stroke }), dm.short)));
      parts.push(h('div', { class: 'layout' }, rail, main));
    } else if (opts.full) parts.push(h('div', { class: 'fullwrap' }, content));
    else parts.push(h('div', { class: 'wrap' }, main));
    if (!opts.full && VX.footer) parts.push(VX.footer());
    return h('div', null, parts);
  }

  function radarSvg(vals, labels, colors) {
    const n = vals.length, R = 80, cx = 140, cy = 105;
    const pt = (i, r) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 280 215'); svg.setAttribute('class', 'radar');
    const add = (tag, attrs, text) => { const e = document.createElementNS(ns, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text) e.textContent = text; svg.append(e); return e; };
    [0.25, 0.5, 0.75, 1].forEach((f) => add('polygon', { points: vals.map((_, i) => pt(i, R * f).join(',')).join(' '), class: 'rgrid' }));
    vals.forEach((_, i) => { const [x, y] = pt(i, R); add('line', { x1: cx, y1: cy, x2: x, y2: y, class: 'rgrid' }); });
    add('polygon', { points: vals.map((v, i) => pt(i, R * clamp(v, 0.03, 1)).join(',')).join(' '), class: 'rarea' });
    vals.forEach((v, i) => { const [x, y] = pt(i, R * clamp(v, 0.03, 1)); add('circle', { cx: x, cy: y, r: 3.5, fill: colors[i] }); });
    labels.forEach((l, i) => { const [x, y] = pt(i, R + 16); add('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'rlab' }, l); });
    return svg;
  }
  function domainAvg(state) {
    return DOMAINS.map((d) => { const sk = SKILLS.filter((s) => s.d === d.id); return sk.reduce((a, s) => a + ((state.m[s.id] && state.m[s.id].p) || 0), 0) / sk.length; });
  }

  /* ---------- 各頁面 ---------- */
  function viewLogin() {
    const nm = h('input', { type: 'text', placeholder: '名字', autocomplete: 'username', autocapitalize: 'none' });
    const pw = h('input', { type: 'password', placeholder: '密碼', autocomplete: 'current-password' });
    const msg = h('div', { class: 'errmsg' });
    const go = async () => {
      msg.textContent = '';
      try {
        user = await api('/api/login', { name: nm.value.trim(), pw: pw.value });
        await loadMe(); location.hash = (user.role === 'parent' || user.role === 'coach') ? '#/parent' : '#/'; render();
      } catch (e) { msg.textContent = e.message; }
    };
    pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    $app.replaceChildren(h('div', { class: 'wrap narrow' }, h('div', { class: 'panel login' },
      h('div', { class: 'big' }, '🤖'), h('h1', null, 'VEX IQ 自學'), h('p', { class: 'sub' }, '登入後，網站會依你的程度出題'),
      nm, pw, msg, h('button', { class: 'btn primary wide', onclick: go }, '登入')), VX.footer ? VX.footer() : null));
    nm.focus();
  }

  function viewHome() {
    if (user.role === 'parent' || user.role === 'coach') { location.hash = '#/parent'; return; }
    const days = Object.keys(st.days);
    let streak = 0; const d = new Date();
    for (let i = 0; i < 60; i++) { const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); if (st.days[key]) streak++; else if (i > 0) break; d.setDate(d.getDate() - 1); }
    const doneN = SKILLS.filter((s) => mastered(s.id)).length;
    const top = st.done
      ? h('div', { class: 'hero' }, h('div', null, h('h2', null, '嗨，' + (user.display || user.name) + ' 👋'), h('p', null, '已精通 ' + doneN + ' / ' + SKILLS.length + ' 個技能　·　連續練習 ' + streak + ' 天')), h('a', { class: 'btn primary big', href: '#/practice' }, '開始今日練習 ▶'))
      : h('div', { class: 'hero start' }, h('div', null, h('h2', null, '歡迎！先來做定位測驗'), h('p', null, '大約 12 題，網站會知道你現在會到哪裡，再幫你安排適合的題目。不會的可以直接說「我還不會」。')), h('a', { class: 'btn primary big', href: '#/placement' }, '開始定位測驗 ▶'));
    const maps = DOMAINS.map((dm) => h('section', { class: 'domain', id: 'dom-' + dm.id },
      h('h3', null, h('span', { class: 'dot', style: 'background:' + dm.color + ';border-color:' + dm.stroke }), dm.icon + ' ' + dm.name, h('small', null, ' ' + dm.en)),
      h('div', { class: 'skills' }, SKILLS.filter((s) => s.d === dm.id).map((s) => {
        const p = pOf(s.id), lock = st.done && !unlocked(s.id);
        return h('a', { class: 'skill' + (lock ? ' lock' : '') + (mastered(s.id) ? ' mastered' : ''), href: '#/skill/' + s.id, style: 'background:' + dm.color + ';border-color:' + dm.stroke },
          h('div', { class: 'sn' }, (lock ? '🔒 ' : '') + s.name),
          h('div', { class: 'stars' }, '★'.repeat(stars(p)) + '☆'.repeat(3 - stars(p))),
          h('div', { class: 'mbar' }, h('div', { style: 'width:' + Math.round(p * 100) + '%' })));
      }))));
    const tile = (href, ic, name, desc, c, sc) => h('a', { class: 'tile', href, style: 'background:' + c + ';border-color:' + sc }, h('span', { class: 'ti' }, ic), name, h('small', null, desc));
    const tiles = h('div', { class: 'tiles' },
      tile('#/sim', '🖥️', '模擬器', '不用機器人也能試跑程式', '#77b2ff', '#5a85bb'),
      tile('#/challenge', '🏁', '挑戰題庫', '把程式實際跑在機器人上', '#f1ae34', '#b38136'),
      tile('#/notebook', '📓', '工程筆記', '學會寫、也真的寫', '#f2cd16', '#b4982e'),
      tile('#/build', '🔧', '組裝教學', '機構原理與零件圖鑑', '#f2a579', '#b37b5e'),
      tile('#/compete', '🏆', '比賽專區', 'Robot Skills、英文術語、面談', '#5ecd98', '#4a9873'));
    const guideEl = (VX.guide && VX.guide.homeCard) ? VX.guide.homeCard() : null;
    $app.replaceChildren(shell(h('div', null, guideEl || top, tiles, st.done ? h('div', { class: 'radarbox' }, radarSvg(domainAvg(st), DOMAINS.map((x) => x.short), DOMAINS.map((x) => x.stroke))) : null, maps), { rail: st.done || true, title: '首頁', icon: '🏠' }));
    if (VX.guide && VX.guide.maybeTour) VX.guide.maybeTour();
  }

  function viewSkill(id) {
    const s = SK[id]; if (!s) { location.hash = '#/'; return; }
    const dm = DOM[s.d], p = pOf(id);
    const pre = s.pre.map((x) => h('a', { href: '#/skill/' + x, class: 'pre' }, SK[x].name + (pOf(x) >= 0.45 ? ' ✓' : ' …')));
    $app.replaceChildren(shell(h('div', null,
      h('a', { class: 'back', href: '#/' }, '‹ 回地圖'),
      h('div', { class: 'panel' },
        h('div', { class: 'chip', style: 'background:' + dm.color + ';border-color:' + dm.stroke }, dm.icon + ' ' + dm.name),
        h('h1', null, s.name),
        h('div', { class: 'row' }, h('span', { class: 'stars' }, '★'.repeat(stars(p)) + '☆'.repeat(3 - stars(p))), h('span', null, ' 熟練度 ' + Math.round(p * 100) + '%')),
        h('div', { class: 'mbar big' }, h('div', { style: 'width:' + Math.round(p * 100) + '%;background:' + dm.stroke })),
        pre.length ? h('p', { class: 'sub' }, '先備技能：', pre) : null,
        h('div', { class: 'lesson', html: s.lesson }),
        h('div', { class: 'row gap' }, h('a', { class: 'btn primary', href: '#/practice/' + id }, '練習這個技能（5 題）')))
    )));
  }

  const CHEAT = [
    ['Drivetrain 傳動系統（機器人移動）', [
      ['drive [forward] for (200) [mm]', '前進 200 毫米；走完才做下一個積木。方向選 reverse 就是後退。'],
      ['drive [forward]', '開始一直往前，不會自己停——要用「stop driving」才會停。'],
      ['turn [right] for (90) [degrees]', '原地轉 90 度。right ＝ 向右，left ＝ 向左。'],
      ['turn [right]', '開始一直轉彎，不會自己停（常搭配陀螺儀，轉到角度再停）。'],
      ['stop driving', '停止移動。'],
      ['set drive velocity to (50) [%]', '設定直走速度。只影響快慢，不改變走多遠。'],
      ['set turn velocity to (50) [%]', '設定轉彎速度。'],
      ['set drive stopping to [brake]', '停下來的方式：brake（煞車）、coast（滑行）、hold（鎖住）。'],
    ]],
    ['Control 控制', [
      ['wait (1) seconds', '暫停程式 1 秒。'],
      ['wait until <condition>', '暫停，直到條件成立才繼續往下。'],
      ['repeat (10)', '裡面的積木重複 10 次。'],
      ['forever', '裡面的積木一直重複，不會結束。'],
      ['repeat until <condition>', '一直重複，直到條件成立為止。'],
      ['while <condition>', '條件成立的期間，一直重複。'],
      ['if <condition> then', '條件成立才做裡面的積木。'],
      ['else', '搭配 if：條件不成立時做這裡。'],
      ['break', '馬上跳出目前的迴圈。'],
    ]],
    ['Events 事件', [
      ['when started', '程式的起點。沒有接在它下面的積木，不會自動執行。'],
      ['when Controller button [E Up] [pressed]', '遙控器的按鈕被按下（或放開）時，執行下面的積木。'],
      ['broadcast [message]', '發出一個訊息，給其他程式（when I receive）接收。'],
    ]],
    ['Variables 變數 ／ My Blocks 我的積木', [
      ['set [myVariable] to (0)', '把變數直接設成 0。'],
      ['change [myVariable] by (1)', '在變數原本的數字上加 1（不是改成 1）。'],
      ['Make a Block', '自己做一個積木：把常用的一組積木包起來，之後重複使用，還可以加參數。'],
    ]],
    ['Sensing 感測', [
      ['<Bumper pressed?>', '碰撞開關有沒有被按下（機器人撞到東西）。'],
      ['<Distance found an object?>', '距離感測器有沒有看到前方的物體。'],
      ['(Distance object distance in mm)', '前方物體到感測器的距離（毫米）。常和 < > 比較積木一起用。'],
      ['(Gyro heading in degrees)', '機器人現在面向的角度（0～360 度）。'],
      ['calibrate Gyro', '校準陀螺儀。校準時機器人要靜止不動。'],
      ['(Brain timer in seconds)', '計時器現在經過幾秒。'],
      ['reset timer', '把計時器歸零。'],
      ['<Controller E Up pressed?>', '遙控器的某個按鈕有沒有被按住。'],
    ]],
    ['Operators 運算', [
      ['<( ) < (50)>', '比較兩個數字：小於。也有 >（大於）和 =（等於）。'],
      ['<A and B>', '「且」：A、B 兩邊都成立才成立。'],
      ['<A or B>', '「或」：A、B 只要有一邊成立就成立。'],
      ['<not A>', '「非」：成立變不成立，不成立變成立。'],
    ]],
    ['Looks 外觀（Brain 螢幕）／ Sound 聲音', [
      ['print (Hello)', '把文字或變數的值印在 Brain 的螢幕上。'],
      ['set cursor to row (1) column (1)', '決定下一次 print 印在第幾行、第幾列。'],
      ['clear all rows', '清掉螢幕上所有文字。'],
      ['play sound [siren]', '讓 Brain 發出聲音。'],
    ]],
    ['Motor 馬達（單顆馬達控制，例如手臂、爪子）', [
      ['spin [motor] [forward]', '讓這顆馬達一直轉。要用 stop 才會停。'],
      ['spin [motor] [forward] for (90) [degrees]', '馬達轉 90 度後才繼續。'],
      ['stop [motor]', '讓這顆馬達停止。'],
      ['set [motor] velocity to (50) [%]', '設定這顆馬達的速度。'],
      ['set [motor] stopping to [hold]', '停止時的方式：hold 會把手臂或爪子鎖住，不會掉下來。'],
    ]],
  ];
  const CHEAT_ZH = [['drive', '驅動'], ['turn', '旋轉（或「轉」）'], ['stop driving', '停止駕駛'], ['set drive velocity', '將驅動速度設定為'], ['wait', '等待'], ['repeat', '重複'], ['forever', '永遠'], ['repeat until', '重複直到'], ['while', '而'], ['if / else', '如果 ／ 別的'], ['break', '休息'], ['when started', '何時開始'], ['right', '正確的（⚠ 中文介面的翻譯，意思是「右」）'], ['left', '左邊']];
  function viewCheat() {
    $app.replaceChildren(shell(h('div', { class: 'vxscope' },
      h('p', { class: 'sub' }, '積木用 VEXcode 的英文原版字樣，說明用中文。方括號 [ ] 是下拉選單，圓括號 ( ) 是可以填數字的格子，< > 是條件。'),
      CHEAT.map(([t, rows]) => h('div', { class: 'panel' }, h('h3', null, t), rows.map(([b, d]) => h('div', { class: 'crow' }, blocksEl([b]), h('div', { class: 'cd' }, d))))),
      h('div', { class: 'panel' }, h('h3', null, '如果你的 VEXcode 是「中文介面」：英文 ↔ 中文對照'), h('table', { class: 'tbl' }, h('tr', null, h('th', null, 'English'), h('th', null, '中文介面的字樣')), ...CHEAT_ZH.map((r) => h('tr', null, h('td', null, r[0]), h('td', null, r[1])))),
        h('p', { class: 'sub' }, '英文是 VEXcode 的原版；中文是它的翻譯。比賽、評審、上網查資料都用英文，所以建議習慣看英文。')))
      , { title: '積木速查表', icon: '📋' }));
  }

  function viewResult() {
    const vals = domainAvg(st);
    const weak = SKILLS.filter((s) => unlocked(s.id)).sort((a, b) => pOf(a.id) - pOf(b.id)).slice(0, 3);
    $app.replaceChildren(shell(h('div', { class: 'panel center' },
      h('div', { class: 'big' }, '📊'), h('h2', null, '定位測驗完成！'),
      h('p', { class: 'sub' }, '這是你目前各領域的程度。接下來的題目會從你最需要練的地方開始。'),
      radarSvg(vals, DOMAINS.map((x) => x.short), DOMAINS.map((x) => x.stroke)),
      h('div', { class: 'changes' }, DOMAINS.map((d, i) => h('div', { class: 'chg' }, h('span', null, d.icon + ' ' + d.name), h('span', null, Math.round(vals[i] * 100) + '%')))),
      h('p', null, '先從這些開始：', weak.map((w) => h('a', { class: 'pre', href: '#/skill/' + w.id }, w.name))),
      h('a', { class: 'btn primary big', href: '#/practice' }, '開始第一回練習 ▶'))));
  }

  function viewMe() {
    const old = h('input', { type: 'password', placeholder: '舊密碼', autocomplete: 'current-password' });
    const nw = h('input', { type: 'password', placeholder: '新密碼（自己習慣的都可以）', autocomplete: 'new-password' });
    const msg = h('div', { class: 'errmsg' });
    $app.replaceChildren(shell(h('div', { class: 'panel' },
      h('h2', null, (user.display || user.name) + '（' + (user.role === 'parent' ? '家長' : user.role === 'coach' ? '教練（唯讀）' : '學員') + '）'),
      h('h3', null, '修改密碼'), old, nw, msg,
      h('div', { class: 'row gap' },
        h('button', { class: 'btn primary', onclick: async () => { msg.className = 'errmsg'; try { await api('/api/password', { old: old.value, new: nw.value }); msg.className = 'okmsg'; msg.textContent = '密碼已更新，下次請用新密碼登入'; user.pw_initial = false; old.value = nw.value = ''; } catch (e) { msg.textContent = e.message; } } }, '更新密碼'),
        h('button', { class: 'btn', onclick: doLogout }, '登出')))));
  }

  /* ---------- 家長頁 ---------- */
  const fmtDate = (ts) => { if (!ts) return '還沒有'; const d = new Date(ts * 1000); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  async function viewParent(uid) {
    $app.replaceChildren(shell(h('p', { class: 'sub' }, '載入中…')));
    try {
      if (uid) return await parentDetail(uid);
      const { learners } = await api('/api/parent/overview');
      const nm = h('input', { type: 'text', placeholder: '登入名字' });
      const dp = h('input', { type: 'text', placeholder: '顯示名稱（選填）' });
      const pw = h('input', { type: 'text', placeholder: '初始密碼（至少 4 個字）' });
      const msg = h('div', { class: 'errmsg' });
      $app.replaceChildren(shell(h('div', null,
        h('h1', null, user.role === 'coach' ? '學員狀況' : '家長頁', user.role === 'coach' ? h('small', null, '　教練檢視（唯讀）') : null),
        learners.length ? learners.map((l) => {
          const acc = l.total ? Math.round((l.correct / l.total) * 100) : 0;
          return h('a', { class: 'panel lcard', href: '#/parent/' + l.id },
            h('div', null, h('h2', null, l.display), h('p', { class: 'sub' }, '最近練習：' + fmtDate(l.last)),
              h('div', { class: 'stats' }, h('div', null, h('b', null, l.week_min), ' 分鐘', h('small', null, '本週')), h('div', null, h('b', null, l.week_n), ' 題', h('small', null, '本週')), h('div', null, h('b', null, acc + '%'), h('small', null, '累計正確率（' + l.total + ' 題）')))),
            l.state && l.state.done ? radarSvg(domainAvg(l.state), DOMAINS.map((x) => x.short), DOMAINS.map((x) => x.stroke)) : h('p', { class: 'sub' }, '還沒做定位測驗'));
        }) : h('p', null, user.role === 'coach' ? '還沒有指派學員給你，請聯絡家長。' : '還沒有學員'),
        user.role === 'coach' ? null : h('div', { class: 'panel' }, h('h3', null, '新增學員'), nm, dp, pw, msg,
          h('button', { class: 'btn primary', onclick: async () => { msg.className = 'errmsg'; try { await api('/api/parent/learner', { name: nm.value, display: dp.value, pw: pw.value }); viewParent(); } catch (e) { msg.textContent = e.message; } } }, '新增')),
        user.role === 'parent' ? h('div', { id: 'coachbox' }) : null)));
      if (user.role === 'parent') renderCoaches(document.getElementById('coachbox'), learners);
    } catch (e) { $app.replaceChildren(shell(h('p', { class: 'errmsg' }, e.message))); }
  }

  /* ---------- 教練帳號管理（只有家長）---------- */
  async function renderCoaches(box, learners) {
    if (!box) return;
    let coaches = [];
    try { coaches = (await api('/api/parent/coaches')).coaches; } catch (e) { box.textContent = e.message; return; }
    const checks = (sel) => learners.map((l) => { const cb = h('input', { type: 'checkbox', value: l.id }); cb.checked = sel.includes(l.id); return h('label', { class: 'check' }, cb, l.display); });
    const picked = (boxes) => boxes.map((lb) => lb.querySelector('input')).filter((i) => i.checked).map((i) => parseInt(i.value, 10));
    const nm = h('input', { type: 'text', placeholder: '教練的登入名字' }), dp = h('input', { type: 'text', placeholder: '顯示名稱（選填）' }), pw = h('input', { type: 'text', placeholder: '密碼（至少 4 個字）' });
    const newChecks = checks([]); const msg = h('div', { class: 'errmsg' });
    box.replaceChildren(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, '🧑‍🏫 教練帳號（唯讀）'),
      h('p', { class: 'sub' }, '教練可以登入看被指派學員的練習狀況、筆記、題庫，但不能修改任何資料。'),
      coaches.length ? coaches.map((c) => { const cks = checks(c.learner_ids); const m2 = h('div', { class: 'okmsg' }); const pwi = h('input', { type: 'text', placeholder: '新密碼' });
        return h('details', { class: 'lessonbox' }, h('summary', null, c.display + '　', h('small', null, '登入名字：' + c.name + '　· 可看 ' + c.learner_ids.length + ' 位學員')),
          h('div', { class: 'body' }, h('b', null, '可以看哪些學員：'), cks,
            h('div', { class: 'row gap' }, h('button', { class: 'btn sm primary', onclick: async () => { try { await api('/api/parent/coach/' + c.id + '/links', { learner_ids: picked(cks) }); m2.textContent = '已更新'; } catch (e) { m2.className = 'errmsg'; m2.textContent = e.message; } } }, '儲存指派')),
            pwi, h('div', { class: 'row gap' }, h('button', { class: 'btn sm', onclick: async () => { try { await api('/api/parent/coach/' + c.id + '/reset', { pw: pwi.value }); m2.className = 'okmsg'; m2.textContent = '密碼已重設'; pwi.value = ''; } catch (e) { m2.className = 'errmsg'; m2.textContent = e.message; } } }, '重設密碼'),
              h('button', { class: 'btn sm danger', onclick: async () => { if (confirm('確定刪除教練帳號「' + c.name + '」？')) { await api('/api/parent/coach/' + c.id + '/delete', {}); renderCoaches(box, learners); } } }, '刪除帳號')), m2)); }) : h('p', { class: 'sub' }, '還沒有教練帳號。'),
      h('h4', null, '新增教練'), nm, dp, pw, h('b', null, '可以看哪些學員：'), newChecks, msg,
      h('button', { class: 'btn primary', onclick: async () => { msg.className = 'errmsg'; try { await api('/api/parent/coach', { name: nm.value, display: dp.value, pw: pw.value, learner_ids: picked(newChecks) }); renderCoaches(box, learners); } catch (e) { msg.textContent = e.message; } } }, '新增教練')));
  }

  async function parentDetail(uid) {
    const d = await api('/api/parent/learner/' + uid);
    const ps = d.state || newState();
    const domBlocks = DOMAINS.map((dm) => h('div', { class: 'panel' },
      h('h3', { style: 'color:' + dm.stroke }, dm.icon + ' ' + dm.name),
      SKILLS.filter((s) => s.d === dm.id).map((s) => { const p = (ps.m && ps.m[s.id] && ps.m[s.id].p) || 0; return h('div', { class: 'prow' }, h('span', { class: 'pn' }, s.name), h('div', { class: 'mbar' }, h('div', { style: 'width:' + Math.round(p * 100) + '%;background:' + dm.color })), h('span', { class: 'pv' }, Math.round(p * 100) + '%')); })));
    const daily = d.daily.slice(-14);
    const maxMs = Math.max(60000, ...daily.map((x) => x.ms));
    const wrongs = d.recent.filter((r) => !r.correct && QBY[r.qid]).slice(0, 12);
    const pwi = h('input', { type: 'text', placeholder: '新密碼（至少 4 個字）' });
    const dpi = h('input', { type: 'text', placeholder: '顯示名稱', value: d.display });
    const msg = h('div', { class: 'errmsg' });
    $app.replaceChildren(shell(h('div', null,
      h('a', { class: 'back', href: '#/parent' }, user.role === 'coach' ? '‹ 學員狀況' : '‹ 家長頁'),
      user.role === 'coach' ? h('div', { class: 'callout' }, '👀 教練檢視（唯讀）：你可以看到他的練習狀況，不能修改任何資料。') : null,
      h('h1', null, d.display, h('small', null, '　登入名字：' + d.name)),
      h('div', { class: 'panel' }, h('div', { class: 'stats' }, h('div', null, h('b', null, d.week_min), ' 分鐘', h('small', null, '本週練習')), h('div', null, h('b', null, d.week_n), ' 題', h('small', null, '本週')), h('div', null, h('b', null, d.total ? Math.round((d.correct / d.total) * 100) + '%' : '-'), h('small', null, '累計正確率')), h('div', null, h('b', null, fmtDate(d.last)), h('small', null, '最近練習'))),
        ps.done ? radarSvg(domainAvg(ps), DOMAINS.map((x) => x.short), DOMAINS.map((x) => x.stroke)) : h('p', { class: 'sub' }, '還沒做定位測驗')),
      h('div', { class: 'panel' }, h('h3', null, '最近 14 天練習時間'),
        daily.length ? h('div', { class: 'bars' }, daily.map((x) => h('div', { class: 'bcol', title: x.d + '：' + Math.round(x.ms / 60000) + ' 分鐘、' + x.n + ' 題' }, h('div', { class: 'bfill', style: 'height:' + Math.round((x.ms / maxMs) * 100) + '%' }), h('small', null, x.d.slice(5))))) : h('p', { class: 'sub' }, '還沒有紀錄')),
      h('div', { class: 'panel' }, h('h3', null, '常見錯誤類型（近 60 天）'),
        d.tags.length ? d.tags.map((t) => h('div', { class: 'chg' }, h('span', null, TAGS[t.tag] || t.tag), h('span', null, t.n + ' 次'))) : h('p', { class: 'sub' }, '還沒有資料')),
      h('div', { class: 'panel' }, h('h3', null, '最近答錯的題目'),
        wrongs.length ? wrongs.map((r) => { const q = QBY[r.qid]; return h('div', { class: 'wrongitem' }, h('div', { class: 'wq' }, '【' + SK[q.s].name + '】' + q.q), q.code ? blocksEl(q.code) : null, h('div', { class: 'wc' }, '他的答案：' + (r.choice || '-')), h('div', { class: 'wa' }, '解釋：' + q.why)); }) : h('p', { class: 'sub' }, '沒有錯題')),
      user.role === 'coach' ? null : h('div', { id: 'pguide' }),
      h('div', { id: 'pweekly' }),
      h('div', { id: 'pnotes' }),
      domBlocks,
      user.role === 'coach' ? null : h('div', { class: 'panel' }, h('h3', null, '管理'), dpi, h('div', { class: 'row gap' }, h('button', { class: 'btn', onclick: async () => { try { await api('/api/parent/learner/' + uid + '/display', { display: dpi.value }); viewParent(uid); } catch (e) { msg.textContent = e.message; } } }, '改顯示名稱')),
        pwi, h('div', { class: 'row gap' }, h('button', { class: 'btn', onclick: async () => { try { await api('/api/parent/learner/' + uid + '/reset', { pw: pwi.value }); msg.className = 'okmsg'; msg.textContent = '密碼已重設（他的登入會被登出）'; pwi.value = ''; } catch (e) { msg.className = 'errmsg'; msg.textContent = e.message; } } }, '重設密碼')),
        msg,
        h('div', { class: 'row gap' }, h('button', { class: 'btn danger', onclick: async () => { if (confirm('確定要清掉學習進度嗎？他會重新做定位測驗（作答紀錄會保留）。')) { await api('/api/parent/learner/' + uid + '/clear', {}); viewParent(uid); } } }, '清掉學習進度，重新定位')),
        h('div', { class: 'row gap' }, h('button', { class: 'btn danger', onclick: async () => {
          if (!confirm('⚠ 確定要「永久刪除」學員「' + d.display + '」嗎？\n他的帳號、所有作答紀錄和工程筆記都會被刪除，無法復原。')) return;
          const again = prompt('再確認一次：請輸入他的登入名字「' + d.name + '」才會刪除');
          if (again === null) return;
          if (again.trim() !== d.name) { toast('名字不一樣，沒有刪除'); return; }
          try { await api('/api/parent/learner/' + uid + '/delete', {}); toast('已刪除學員'); location.hash = '#/parent'; viewParent(); } catch (e) { msg.className = 'errmsg'; msg.textContent = e.message; }
        } }, '🗑 永久刪除這位學員')))
    )));
    if (VX.parentNotes) VX.parentNotes(uid, user.role === 'coach');
    if (VX.guide && VX.guide.parentCard && user.role !== 'coach') VX.guide.parentCard(document.getElementById('pguide'), ps, d);
    if (VX.weekly) VX.weekly(document.getElementById('pweekly'), ps, d);
  }

  /* ---------- 路由 ---------- */
  async function loadMe() {
    try {
      const me = await api('/api/me');
      user = { id: me.id, name: me.name, display: me.display, role: me.role, pw_initial: !!me.pw_initial };
      st = Object.assign(newState(), me.state || {});
    } catch (e) { user = null; st = null; }
  }

  function render() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const [, a, b] = hash.split('/');
    if (a === 'about') return VX.routes.about();
    if (!user) { if (hash !== '/login') history.replaceState(null, '', '#/login'); return viewLogin(); }
    if (hash === '/login') { location.hash = '#/'; return; }
    if (session && !(a === 'practice' || a === 'placement')) session = null;
    if (a === 'parent') { if (user.role !== 'parent' && user.role !== 'coach') { location.hash = '#/'; return; } return viewParent(b ? parseInt(b, 10) : 0); }
    if (user.role === 'coach' && a !== 'me' && a !== 'resources' && a !== 'review' && a !== 'about') { location.hash = '#/parent'; return; }
    if (user.role === 'parent' && a !== 'me' && a !== 'guide' && a !== 'resources' && a !== 'review' && a !== 'about') { location.hash = '#/parent'; return; }
    if (a === 'placement') { if (!session) startPlacement(); return; }
    if (a === 'practice') { if (!st.done) { location.hash = '#/placement'; return; } if (!session) startPractice(b || null); return; }
    if (VX.routes[a]) return VX.routes[a](...hash.split('/').slice(2));
    if (a === 'skill') return viewSkill(b);
    if (a === 'cheat') return viewCheat();
    if (a === 'result') return viewResult();
    if (a === 'me') return viewMe();
    return viewHome();
  }

  const VX = window.VX = {
    routes: {}, h, api, shell, toEn, blocksEl, oneBlock, toast, DOM, SK, DOMAINS, SKILLS, QS, TAGS, radarSvg, domainAvg, pOf, newState, clamp, shuffle, startPractice,
    get user() { return user; }, get st() { return st; }, saveState, render, app: $app, plainOrBlock, todayStr,
  };
  window.addEventListener('hashchange', render);
  // 等所有功能檔（modules／guide／extras／sim／iqimport…）都載入、註冊完路由，再開始第一次繪製；
  // 否則直接開 #/sim 這類網址時，可能因為路由還沒註冊而退回首頁。
  async function init() { await loadMe(); render(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
