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
    const t = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }, msg);
    document.body.append(t);
    setTimeout(() => t.classList.add('out'), 2900);
    setTimeout(() => t.remove(), 3250);
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
  window.VXEN.localizeDeep(SKILLS); window.VXEN.localizeDeep(CHALLENGES); // 課文與挑戰提示也一樣
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

  function applyResult(q, correct, assisted) {
    const m = st.m[q.s] || (st.m[q.s] = { p: 0, n: 0, t: 0 });
    const L = q.l - 1;
    if (correct) m.p += Math.max(0, CEIL[L] - m.p) * (assisted ? 0.25 : 0.45); else m.p *= WRONG[L];
    m.p = clamp(m.p, 0, 1);
    m.n += 1; m.t = Date.now();
    if (window.VX && VX.act) VX.act('practice', q.s);
    const sn = st.seen[q.id] || (st.seen[q.id] = { c: 0, w: 0, t: 0 });
    if (correct && !assisted) sn.c++; else sn.w++; // 靠提示或重試才答對，不算「獨立答對」
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

  function pickQuestion(skillId, level, used, avoid) {
    const base = QS.filter((q) => q.s === skillId);
    let pool = base.filter((q) => !used.has(q.id) && !(avoid && avoid.has(q.id)));
    if (!pool.length) pool = base.filter((q) => !used.has(q.id));
    const pool2 = pool.length ? pool : base;
    const now = Date.now();
    const scored = pool2.map((q) => {
      const sn = st.seen[q.id];
      const unseen = sn ? 0 : 1;
      const wrongBias = sn && sn.w > sn.c ? 0.5 : 0; // 以前答錯的，比較早再出現
      const age = sn ? (now - sn.t) / 86400000 : 30;
      return { q, s: -Math.abs(q.l - level) * 3 + unseen * 2 + wrongBias + Math.min(age, 10) * 0.05 + Math.random() * 0.3 };
    });
    scored.sort((a, b) => b.s - a.s);
    return scored[0].q;
  }

  async function save(q, res, mode) {
    // 家長頁的正確率與迷思統計看的是「第一次、不靠提示」的結果；靠提示／重試才答對的記成未獨立答對，並保留第一次選錯的類型
    const indep = !!res.correct && !res.assisted;
    try {
      await api('/api/answer', {
        qid: q.id, skill: q.s, level: q.l, correct: indep, choice: res.assisted && res.firstChoice ? res.firstChoice : res.choice,
        tag: indep ? '' : res.tag || res.firstTag || '', ms: res.ms, mode, state: st,
      });
    } catch (e) {
      toast('這題的紀錄沒有存到（' + e.message + '）');
    }
  }
  let sizeWarned = false;
  function checkStateSize() { try { if (!sizeWarned && JSON.stringify(st).length > 90000) { sizeWarned = true; toast('進度資料快滿了，請到「挑戰」刪掉用不到的自訂關卡，或請家長協助整理'); } } catch (e) { /* ignore */ } }
  async function saveState() {
    checkStateSize();
    try { await api('/api/answer', { state: st }); } catch (e) { toast('進度沒有存到：' + e.message); }
  }

  const TAG_HINTS = {
    'angle-dist': '注意題目問的是「角度（度）」還是「距離（mm）」。',
    direction: '想像自己坐在機器人上面：左轉（left）和右轉（right）是以車頭朝向來看。',
    order: '程式是由上到下依序執行的，順著步驟一步一步走一遍。',
    'loop-count': '數數看重複積木裡面有幾個動作、總共重複幾次。',
    'cond-logic': '檢查條件是 < 還是 >，and 要兩邊都成立，or 只要一邊成立。',
    'sensor-choice': '想想這題需要量「距離、顏色、角度、還是有沒有撞到」？',
    unit: '檢查單位有沒有統一：1 公分 = 10 毫米（mm）。',
    gear: '小齒輪帶大齒輪會變慢但有力；大帶小會變快但力量小。',
    calc: '把題目給的數字列出來再驗算一次。',
    var: 'set 是直接改成新數字；change 是在原本的數字上加減。',
    debug: '從最前面開始，一行一行模擬機器人會做什麼。',
  };

  /* ---------- 題目畫面 ---------- */
  function renderQuestion(q, { onDone, allowSkip = true, allowHint = false, banner = '' }) {
    const t0 = Date.now();
    const card = h('div', { class: 'qcard' });
    const sk = SK[q.s];
    if (banner) card.append(h('div', { class: 'qbanner' }, banner));
    const seenRec = st && st.seen && st.seen[q.id];
    const seenBadge = seenRec
      ? (seenRec.c > 0
        ? h('span', { class: 'tag done', style: 'margin-left:6px' }, h('span', { class: 'lamp ok', style: 'width:8px;height:8px;margin-right:5px' }), '曾答對')
        : h('span', { class: 'tag try', style: 'margin-left:6px' }, h('span', { class: 'lamp try', style: 'width:8px;height:8px;margin-right:5px' }), '曾練習'))
      : null;
    card.append(h('div', { class: 'qmeta' }, h('span', { class: 'chip', style: 'background:' + DOM[sk.d].color + ';border-color:' + DOM[sk.d].stroke }, sk.name), h('span', { class: 'lv' }, '難度 ' + '★'.repeat(q.l) + '☆'.repeat(Math.max(0, 3 - q.l)), seenBadge)));
    card.append(h('div', { class: 'qtext' }, q.q));
    if (q.code && q.t !== 'bug') card.append(blocksEl(q.code));
    const area = h('div', { class: 'qarea' });
    card.append(area);
    const hintBox = h('div', { class: 'qhint hidden' });
    card.append(hintBox);
    const fb = h('div', { class: 'feedback hidden' });
    card.append(fb);
    let finished = false, tries = 0, usedHint = false, hintBtn = null, firstTag = '', firstChoice = '';

    function showHint(lead) {
      usedHint = true;
      if (hintBtn) hintBtn.disabled = true;
      hintBox.classList.remove('hidden');
      hintBox.replaceChildren(
        h('div', { class: 'qhint-title' }, '💡 ' + lead),
        sk && sk.lesson ? h('div', { class: 'qhint-body', html: sk.lesson }) : null
      );
    }

    function finish(correct, choice, tag, correctText) {
      if (finished) return;
      finished = true;
      const ms = Date.now() - t0;
      const assisted = usedHint || tries > 0;
      card.classList.add('answered');
      fb.classList.remove('hidden');
      fb.classList.add(correct ? 'ok' : 'bad');
      const title = correct ? (assisted ? '✅ 想通了，答對了！（提示後完成）' : '✅ 答對了！') : '❌ 這題沒答對';
      fb.append(
        h('div', { class: 'fb-title' }, title),
        !correct && correctText ? h('div', { class: 'fb-ans' }, '正確答案：', correctText) : null,
        h('div', { class: 'fb-why' }, q.why),
        h('button', { class: 'btn primary', id: 'nextBtn', onclick: () => onDone({ correct, choice, tag, ms, assisted, firstTag, firstChoice }) }, '下一題 ➜')
      );
      const nb = fb.querySelector('#nextBtn'); if (nb) nb.focus();
    }
    function addActions(correctText, onHint) {
      const row = h('div', { class: 'qactions' });
      if (allowHint) {
        hintBtn = h('button', { class: 'btn sm', onclick: () => onHint() }, '💡 給我一點提示');
        row.append(hintBtn);
      }
      if (allowSkip) {
        row.append(h('button', { class: 'btn ghost skip', onclick: () => { lock(); finish(false, '(還不會)', 'unknown', correctText); } }, '我還不會'));
      }
      if (row.childNodes.length) area.append(row);
    }
    function lock() { area.querySelectorAll('button,input').forEach((b) => (b.disabled = true)); }

    if (q.t === 'mc') {
      const idx = shuffle(q.opts.map((_, i) => i));
      const list = h('div', { class: 'opts' });
      idx.forEach((oi, pos) => {
        const b = h('button', { class: 'opt', onclick: () => {
          const ok = oi === q.a;
          if (!ok && allowHint && tries === 0) {
            tries++;
            b.classList.add('wrong'); b.disabled = true;
            const wtag = (q.tags && q.tags[oi]) || 'concept';
            firstTag = wtag; firstChoice = q.opts[oi];
            showHint('再試一次！先幫你刪掉這個選項。' + (TAG_HINTS[wtag] || '看看下面的重點再選一次：'));
            return;
          }
          lock();
          b.classList.add(ok ? 'right' : 'wrong');
          if (!ok) list.children[idx.indexOf(q.a)].classList.add('right');
          finish(ok, q.opts[oi], ok ? '' : (q.tags && q.tags[oi]) || 'concept', q.opts[q.a]);
        } }, h('span', { class: 'ol' }, String.fromCharCode(65 + pos)), h('span', { class: 'ot' }, q.opts[oi]));
        list.append(b);
      });
      area.append(list);
      addActions(q.opts[q.a], () => {
        const aliveWrong = idx.map((oi, pos) => ({ oi, btn: list.children[pos] })).filter((x) => x.oi !== q.a && !x.btn.disabled);
        if (aliveWrong.length >= 2) {
          const pick = aliveWrong[Math.floor(Math.random() * aliveWrong.length)];
          pick.btn.disabled = true; pick.btn.classList.add('elim');
          showHint('先幫你刪掉一個錯的選項，再看看重點提示：');
        } else {
          showHint('看看這個重點提示，再選選看：');
        }
      });
    } else if (q.t === 'num') {
      const inp = h('input', { type: 'text', inputmode: 'decimal', class: 'numin', placeholder: '輸入數字', autocomplete: 'off' });
      const go = () => {
        const norm = inp.value.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[．。]/g, '.').replace(/[－—–]/g, '-').replace(/[,，\s]/g, '');
        const v = parseFloat(norm);
        if (isNaN(v)) { inp.focus(); return; }
        const ok = Math.abs(v - q.a) <= q.tol + 1e-9;
        if (!ok && allowHint && tries === 0) {
          tries++;
          firstTag = q.tag || ''; firstChoice = String(v);
          const dir = v > q.a ? '你算的數字偏大了一點' : '你算的數字偏小了一點';
          showHint('再試一次！' + dir + '。' + (TAG_HINTS[q.tag] || '看看重點公式再算一次：'));
          inp.focus(); inp.select();
          return;
        }
        lock();
        finish(ok, String(v), ok ? '' : q.tag, q.a + (q.unit ? ' ' + q.unit : ''));
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      area.append(h('div', { class: 'numrow' }, inp, q.unit ? h('span', { class: 'unit' }, q.unit) : null, h('button', { class: 'btn primary', onclick: go }, '送出')));
      addActions(q.a + (q.unit ? ' ' + q.unit : ''), () => showHint('先看清楚單位與公式，再算算看：' + (TAG_HINTS[q.tag] || '')));
      setTimeout(() => inp.focus(), 50);
    } else if (q.t === 'ord') {
      const items = q.items.map((text, i) => ({ text, i }));
      const pool = shuffle(items);
      let chosen = [];
      const ansBox = h('div', { class: 'ordans' });
      const poolBox = h('div', { class: 'ordpool' });
      const goBtn = h('button', { class: 'btn primary', disabled: true, onclick: () => {
        const norm = (s) => s.trim();
        const ok = chosen.every((it, k) => norm(it.text) === norm(q.items[k]));
        if (!ok && allowHint && tries === 0) {
          tries++;
          const rightN = chosen.filter((it, k) => norm(it.text) === norm(q.items[k])).length;
          firstTag = 'order'; firstChoice = chosen.map((c) => c.text.trim()).join(' → ');
          const firstBad = chosen.findIndex((it, k) => norm(it.text) !== norm(q.items[k]));
          showHint('再試一次！目前有 ' + rightN + ' 個位置排對了，先檢查看看第 ' + (firstBad + 1) + ' 步（點上方項目可以拿掉重排）：');
          return;
        }
        lock();
        finish(ok, chosen.map((c) => c.text.trim()).join(' → '), ok ? '' : 'order', q.items.map((s, k) => (k + 1) + '. ' + s.trim()).join('　'));
      } }, '送出順序');
      function draw() {
        ansBox.replaceChildren(...(chosen.length ? chosen.map((it, k) => h('button', { class: 'chip-item', onclick: () => { chosen = chosen.filter((c) => c !== it); draw(); } }, h('b', null, k + 1 + '. '), plainOrBlock(it.text))) : [h('span', { class: 'hint' }, '依序點選下面的項目，放進這裡')]));
        poolBox.replaceChildren(...pool.filter((it) => !chosen.includes(it)).map((it) => h('button', { class: 'chip-item', onclick: () => { chosen.push(it); draw(); } }, plainOrBlock(it.text))));
        goBtn.disabled = chosen.length !== items.length;
      }
      draw();
      area.append(ansBox, poolBox, goBtn);
      addActions(q.items.map((s, k) => (k + 1) + '. ' + s.trim()).join('　'), () => showHint('想想機器人最先要做的動作是什麼，依序往下排：'));
    } else if (q.t === 'bug') {
      const list = h('div', { class: 'buglist' });
      q.code.forEach((ln, idx) => {
        const ind = (ln.match(/^ */)[0].length / 2) | 0;
        const b = h('button', { class: 'bugline', style: 'padding-left:' + (2 + ind * 22) + 'px', onclick: () => {
          const ok = idx === q.a;
          if (!ok && allowHint && tries === 0) {
            tries++;
            b.classList.add('wrong'); b.disabled = true;
            firstTag = q.tag || 'debug'; firstChoice = ln.trim();
            showHint('再試一次！這一行沒有錯喔，順著程式再看看其他積木：');
            return;
          }
          lock();
          b.classList.add(ok ? 'right' : 'wrong');
          if (!ok) list.children[q.a].classList.add('right');
          finish(ok, ln.trim(), ok ? '' : q.tag || 'debug', q.code[q.a].trim());
        } }, blocksEl([ln.trim()]));
        list.append(b);
      });
      area.append(list);
      addActions(q.code[q.a].trim(), () => showHint('從最上面開始，一步一步想像機器人怎麼動，找出哪一行會讓結果不對：'));
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
    const l2 = QS.filter((x) => x.s === skill.id && x.l === 2);
    const cand = l2.length ? l2 : QS.filter((x) => x.s === skill.id);
    const q = shuffle(cand)[0];
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
    st = Object.assign(newState(), st || {});
    st.m = {};
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
  function startPractice(skillId, count, opts) {
    opts = opts || {};
    const validSkill = skillId && SK[skillId] ? skillId : null;
    const drillSkills = opts.drillSkills && opts.drillSkills.length ? opts.drillSkills.filter((id) => SK[id]) : null;
    const poolN = drillSkills
      ? drillSkills.reduce((sum, id) => sum + QS.filter((q) => q.s === id).length, 0)
      : validSkill ? QS.filter((q) => q.s === validSkill).length : 10;
    const defaultN = drillSkills ? Math.min(4, Math.max(2, drillSkills.length * 2)) : validSkill ? Math.min(5, poolN) : 10;
    const n = count > 0 ? Math.min(count, Math.max(1, poolN)) : defaultN;
    session = {
      type: 'practice',
      skill: validSkill,
      drillSkills,
      title: opts.title || (drillSkills ? '🎯 類似題加強練習' : validSkill ? '練習：' + SK[validSkill].name : '今日練習'),
      n, idx: 0, used: new Set(), avoid: new Set(opts.avoidUsed || []),
      recent: [], rescue: null, right: 0, assistedRight: 0,
      streakWrong: 0, skillWrong: {}, coached: new Set(), weakSkills: new Set(),
      before: JSON.parse(JSON.stringify(st.m)),
    };
    nextPractice();
  }
  function startDrill(skillIds, avoidUsed) {
    startPractice(null, Math.min(4, Math.max(2, skillIds.length * 2)), {
      drillSkills: skillIds,
      avoidUsed: avoidUsed ? [...avoidUsed] : [],
      title: '🎯 卡關觀念類似題練習',
    });
  }
  function showCoachCard(skillId, onContinue) {
    const S = session, sk = SK[skillId];
    if (!S || !sk) return onContinue();
    const bar = h('div', { class: 'pbar' }, h('div', { style: 'width:' + Math.round(clamp(S.idx / S.n, 0, 1) * 100) + '%' }));
    $app.replaceChildren(shell(h('div', null,
      h('div', { class: 'quizhead' }, h('h2', null, S.title), h('span', { class: 'qnum' }, S.idx + ' / ' + S.n), h('a', { class: 'quit', href: '#/', onclick: () => { session = null; } }, '離開')),
      bar,
      h('div', { class: 'qcard coachcard' },
        h('div', { class: 'qmeta' }, h('span', { class: 'chip', style: 'background:' + DOM[sk.d].color + ';border-color:' + DOM[sk.d].stroke }, sk.name), h('span', { class: 'tag' }, '🧭 30 秒重點小抄')),
        h('h3', { style: 'margin:4px 0 8px' }, '先停一下，這塊很容易搞混！我們一起看重點再繼續：'),
        h('div', { class: 'lesson', html: sk.lesson }),
        h('p', { class: 'sub' }, '看完之後，系統會先出一題比較簡單的類似題讓你暖身，不用緊張！'),
        h('div', { class: 'row gap' },
          h('button', { class: 'btn primary', id: 'coachNextBtn', onclick: onContinue }, '我看懂了，來一題簡單的試試看 ▶'),
          h('a', { class: 'btn ghost', href: '#/skill/' + sk.id, onclick: () => { session = null; } }, '去這個技能的完整課文')
        )
      )
    )));
    const nb = document.getElementById('coachNextBtn'); if (nb) nb.focus();
    window.scrollTo(0, 0);
  }
  function nextPractice() {
    const S = session;
    if (S.idx >= S.n) return finishPractice();
    let sid, level, banner = '';
    if (S.rescue) {
      sid = S.rescue.skill; level = S.rescue.level; banner = S.rescue.banner || '';
      S.rescue = null;
    } else if (S.drillSkills && S.drillSkills.length) {
      sid = S.drillSkills[S.idx % S.drillSkills.length];
      level = Math.max(1, levelFor(pOf(sid)));
      banner = S.idx === 0 ? '🎯 針對剛才卡關的觀念，挑了不一樣的類似題來試試看！' : '';
    } else {
      sid = S.skill || pickSkill(S.recent);
      level = levelFor(pOf(sid));
    }
    const q = pickQuestion(sid, level, S.used, S.avoid);
    S.used.add(q.id); S.recent.push(sid); S.idx++;
    drawQuiz({
      title: S.title, sub: '',
      progress: S.idx / S.n, q, qnum: S.idx + ' / ' + S.n,
      allowHint: true, banner,
      onDone: async (res) => {
        applyResult(q, res.correct, res.assisted);
        if (res.correct) {
          S.right++;
          S.streakWrong = 0;
          if (res.assisted) { S.assistedRight++; S.weakSkills.add(q.s); }
        } else {
          S.streakWrong++;
          S.skillWrong[q.s] = (S.skillWrong[q.s] || 0) + 1;
          S.weakSkills.add(q.s);
          S.rescue = { skill: q.s, level: Math.max(1, q.l - 1), banner: '💡 換一題比較簡單的類似題，再試試看！' };
        }
        await save(q, res, 'practice');
        if (!res.correct && S.idx < S.n && (S.skillWrong[q.s] >= 2 || S.streakWrong >= 2) && !S.coached.has(q.s)) {
          S.coached.add(q.s);
          S.rescue = { skill: q.s, level: 1, banner: '💡 暖身類似題：用剛剛看的小抄試試看！' };
          showCoachCard(q.s, () => nextPractice());
          return;
        }
        nextPractice();
      },
    });
  }
  function finishPractice() {
    const S = session; session = null;
    if (S.drillSkills && S.right > 0) {
      st.flags = st.flags || {}; st.flags.drillOk = true;
      if (VX.badges) VX.badges.check(false);
      saveState();
    }
    if (window.VXFX && S.right >= Math.ceil(S.n * 0.7)) setTimeout(() => window.VXFX.confetti(), 250);
    const rows = Object.keys(st.m).filter((id) => Math.abs((st.m[id].p || 0) - ((S.before[id] && S.before[id].p) || 0)) > 0.005).map((id) => ({ id, a: (S.before[id] && S.before[id].p) || 0, b: st.m[id].p }));
    const weakArr = [...S.weakSkills].filter((id) => SK[id]);
    const drillN = Math.min(4, Math.max(2, weakArr.length * 2));
    const drillBox = weakArr.length ? h('div', { class: 'callout', style: 'text-align:left;max-width:520px;margin:14px auto' },
      h('b', null, '🎯 趁剛想通，鞏固一下！'),
      h('div', { style: 'margin:4px 0 10px' }, '剛才在「' + weakArr.map((id) => SK[id].name).join('、') + '」有用到提示或答錯，要不要馬上做 ' + drillN + ' 題類似題確認自己會了？'),
      h('button', { class: 'btn primary', onclick: () => startDrill(weakArr, S.used) }, '🎯 專練類似題（' + drillN + ' 題）')
    ) : null;
    $app.replaceChildren(shell(h('div', { class: 'panel center' },
      h('div', { class: 'big' }, S.right === S.n ? '🎉' : S.right >= S.n / 2 ? '👍' : '💪'),
      h('h2', null, '這回合答對 ' + S.right + ' / ' + S.n + ' 題' + (S.assistedRight ? '（其中 ' + S.assistedRight + ' 題看提示後想通）' : '')),
      drillBox,
      rows.length ? h('div', { class: 'changes' }, rows.map((r) => h('div', { class: 'chg' }, h('span', null, SK[r.id].name), h('span', { class: r.b >= r.a ? 'up' : 'down' }, (r.b >= r.a ? '▲ ' : '▼ ') + Math.round(r.a * 100) + '% → ' + Math.round(r.b * 100) + '%')))) : null,
      h('div', { class: 'row gap', style: 'justify-content:center;margin-top:12px;flex-wrap:wrap' },
        st && st.done ? h('a', { class: 'btn primary', href: '#/plan' }, '📅 回今日課表（看下一站）') : null,
        h('button', { class: 'btn' + (weakArr.length || (st && st.done) ? '' : ' primary'), onclick: () => startPractice(S.skill) }, '再練一回合'),
        h('a', { class: 'btn', href: '#/' }, '回首頁'))
    )));
  }

  function drawQuiz({ title, sub, progress, q, qnum, onDone, allowHint = false, banner = '' }) {
    const bar = h('div', { class: 'pbar' }, h('div', { style: 'width:' + Math.round(clamp(progress, 0, 1) * 100) + '%' }));
    $app.replaceChildren(shell(h('div', null,
      h('div', { class: 'quizhead' }, h('h2', null, title), qnum ? h('span', { class: 'qnum' }, qnum) : null, h('a', { class: 'quit', href: '#/', onclick: () => { session = null; } }, '離開')),
      sub ? h('p', { class: 'sub' }, sub) : null, bar,
      renderQuestion(q, { onDone, allowHint, banner })
    )));
    window.scrollTo(0, 0);
  }

  /* ---------- 畫面骨架（5 大學習支柱 + 情境子導覽 + 原生 Popover 全站導覽）---------- */
  const NAV_GROUPS = [
    {
      id: 'learn', href: '#/', ic: '🏠', name: '學習',
      routes: ['', 'plan', 'practice', 'start', 'skill', 'result'],
      items: [
        ['#/', '🏠', '首頁', ''],
        ['#/plan', '📅', '今日課表', 'plan'],
        ['#/practice', '✏️', '練習題', 'practice'],
        ['#/start', '🚀', '起步任務', 'start'],
      ],
    },
    {
      id: 'code', href: '#/sim', ic: '🖥️', name: '程式',
      routes: ['sim', 'challenge', 'pathplan', 'control', 'import'],
      items: [
        ['#/sim', '🖥️', '模擬器', 'sim'],
        ['#/challenge', '🏁', '挑戰題庫', 'challenge'],
        ['#/pathplan', '🗺️', '路徑規劃', 'pathplan'],
        ['#/control', '🎛️', '控制實驗室', 'control'],
        ['#/import', '📤', '上傳存檔', 'import'],
      ],
    },
    {
      id: 'hw', href: '#/build/parts', ic: '🔧', name: '硬體',
      routes: ['build'],
      items: [
        ['#/build/parts', '🧩', '零件與套件百科', 'build/parts'],
        ['#/build', '🛠️', '實體組裝挑戰', 'build'],
        ['#/build/lessons', '📘', '機構原理圖解', 'build/lessons'],
      ],
    },
    {
      id: 'comp', href: '#/compete', ic: '🏆', name: '比賽',
      routes: ['compete', 'arena3d', 'notebook'],
      items: [
        ['#/compete', '🏆', '比賽專區', 'compete'],
        ['#/arena3d', '🏟️', '3D 練習場', 'arena3d'],
        ['#/notebook', '📓', '工程筆記', 'notebook'],
        ['#/compete/taiwan', '🇹🇼', '台灣賽事', 'compete/taiwan'],
      ],
    },
    {
      id: 'tools', href: '#/cheat', ic: '📚', name: '工具',
      routes: ['cheat', 'resources', 'guide'],
      items: [
        ['#/cheat', '📋', '積木速查', 'cheat'],
        ['#/resources', '🔗', '學習資源', 'resources'],
        ['#/guide', '🧭', '怎麼用', 'guide'],
      ],
    },
  ];
  /* 語言切換（中／EN）；選擇存在這台裝置的 localStorage，重新載入後生效 */
  function langBtn(cls) {
    const cur = window.VXI18N ? window.VXI18N.lang : 'zh';
    return h('button', { class: 'langsw ' + (cls || ''), type: 'button', title: 'Language / 語言', 'aria-label': 'Language / 語言', 'data-notrans': '1', onclick: () => window.VXI18N && window.VXI18N.setLang(cur === 'en' ? 'zh' : 'en') },
      h('span', { class: cur === 'zh' ? 'on' : '' }, '中'), h('span', { class: cur === 'en' ? 'on' : '' }, 'EN'));
  }
  function shell(content, opts) {
    opts = opts || {};
    if (opts.bare) return h('div', null, content);
    const segs = location.hash.replace(/^#\/?/, '').split('/');
    const cur = segs[0] || '';
    const curSub = segs[1] || '';
    const fullKey = (cur === 'build' && (curSub === 'parts' || curSub === 'lessons')) ? 'build/' + curSub : (cur === 'compete' && curSub === 'taiwan') ? 'compete/taiwan' : cur;
    const isLearner = !!(user && user.role === 'learner');
    const activeGroup = isLearner ? (NAV_GROUPS.find((g) => g.routes.includes(cur)) || NAV_GROUPS[0]) : null;
    const tabs = [];
    if (isLearner) {
      NAV_GROUPS.forEach((g) => {
        const on = activeGroup && activeGroup.id === g.id;
        tabs.push(h('a', { class: 'tab' + (on ? ' on' : ''), href: g.href, 'aria-current': on ? 'page' : null }, h('span', { class: 'ti', 'aria-hidden': 'true' }, g.ic), g.name));
      });
    }
    if (user && user.role === 'coach') tabs.push(h('a', { class: 'tab' + (cur === 'parent' ? ' on' : ''), href: '#/parent', 'aria-current': cur === 'parent' ? 'page' : null }, h('span', { class: 'ti', 'aria-hidden': 'true' }, '👥'), '學員狀況'), h('a', { class: 'tab' + (cur === 'review' ? ' on' : ''), href: '#/review', 'aria-current': cur === 'review' ? 'page' : null }, h('span', { class: 'ti', 'aria-hidden': 'true' }, '📝'), '題庫審閱'), h('a', { class: 'tab' + (cur === 'resources' ? ' on' : ''), href: '#/resources', 'aria-current': cur === 'resources' ? 'page' : null }, h('span', { class: 'ti', 'aria-hidden': 'true' }, '🔗'), '資源'));
    if (user && user.role === 'parent') tabs.push(h('a', { class: 'tab' + (cur === 'parent' ? ' on' : ''), href: '#/parent', 'aria-current': cur === 'parent' ? 'page' : null }, h('span', { class: 'ti', 'aria-hidden': 'true' }, '👪'), '家長頁'), h('a', { class: 'tab' + (cur === 'build' ? ' on' : ''), href: '#/build/parts', 'aria-current': cur === 'build' ? 'page' : null }, h('span', { class: 'ti', 'aria-hidden': 'true' }, '🔧'), '硬體'), h('a', { class: 'tab' + (cur === 'guide' ? ' on' : ''), href: '#/guide', 'aria-current': cur === 'guide' ? 'page' : null }, h('span', { class: 'ti', 'aria-hidden': 'true' }, '🧭'), '怎麼用'), h('a', { class: 'tab' + (cur === 'review' ? ' on' : ''), href: '#/review', 'aria-current': cur === 'review' ? 'page' : null }, h('span', { class: 'ti', 'aria-hidden': 'true' }, '📝'), '題庫審閱'), h('a', { class: 'tab' + (cur === 'resources' ? ' on' : ''), href: '#/resources', 'aria-current': cur === 'resources' ? 'page' : null }, h('span', { class: 'ti', 'aria-hidden': 'true' }, '🔗'), '資源'));
    const tabsEl = h('nav', { class: 'tabs', 'aria-label': '主要導覽' }, tabs);
    const tabsWrap = h('div', { class: 'tabs-wrap' }, tabsEl);

    // 全站快速選單（使用原生 Popover API，舊瀏覽器自動退回 class 切換）
    let menuBtn = null, sitemapPop = null;
    if (isLearner) {
      const hasPop = Object.hasOwn(HTMLElement.prototype, 'popover');
      sitemapPop = h('nav', { id: 'vx-sitemap', class: 'vx-sitemap', 'aria-label': '全部功能選單' },
        h('div', { class: 'vx-sm-head' },
          h('b', null, '🧭 全站功能總覽'),
          h('button', { type: 'button', class: 'btn ghost sm', 'aria-label': '關閉選單', onclick: () => { if (hasPop && sitemapPop.hidePopover) sitemapPop.hidePopover(); else sitemapPop.classList.remove('open'); } }, '✕')),
        h('div', { class: 'vx-sm-grid' }, NAV_GROUPS.map((g) =>
          h('div', { class: 'vx-sm-col' },
            h('div', { class: 'vx-sm-title' }, g.ic + ' ' + g.name),
            g.items.map(([href, ic, label, key]) => {
              const on = fullKey === key || (key === '' && (cur === '' || cur === 'skill' || cur === 'result'));
              return h('a', {
                class: 'vx-sm-link' + (on ? ' on' : ''), href, 'aria-current': on ? 'page' : null,
                onclick: () => { if (hasPop && sitemapPop.hidePopover) sitemapPop.hidePopover(); else sitemapPop.classList.remove('open'); },
              }, h('span', { 'aria-hidden': 'true' }, ic), label);
            })))));
      if (hasPop) sitemapPop.setAttribute('popover', 'auto');
      menuBtn = h('button', {
        type: 'button', class: 'tab vx-menubtn', 'aria-label': '全部功能選單', 'aria-controls': 'vx-sitemap',
        popovertarget: hasPop ? 'vx-sitemap' : null,
        onclick: hasPop ? null : () => sitemapPop.classList.toggle('open'),
      }, h('span', { class: 'ti', 'aria-hidden': 'true' }, '☰'), '選單');
    }

    // 帳號與登出整合選單（原生 Popover API，舊瀏覽器自動退回 class 切換）
    let acctBtn = null, acctPop = null;
    if (user) {
      const hasPop = Object.hasOwn(HTMLElement.prototype, 'popover');
      const closeAcct = () => { if (hasPop && acctPop.hidePopover) acctPop.hidePopover(); else acctPop.classList.remove('open'); };
      const roleLabel = user.role === 'parent' ? '家長' : user.role === 'coach' ? '教練（唯讀）' : '學員';
      acctPop = h('div', { id: 'vx-acctmenu', class: 'vx-acctmenu' },
        h('div', { class: 'vx-acct-head' },
          h('b', { 'data-notrans': '1' }, user.display || user.name),
          h('span', { class: 'tag' }, roleLabel)),
        h('a', { class: 'vx-sm-link', href: '#/me', onclick: closeAcct }, h('span', { 'aria-hidden': 'true' }, '🔑'), '帳號與修改密碼'),
        h('button', { type: 'button', class: 'vx-sm-link vx-acct-out', onclick: () => { closeAcct(); doLogout(); } }, h('span', { 'aria-hidden': 'true' }, '🚪'), '登出'));
      if (hasPop) acctPop.setAttribute('popover', 'auto');
      acctBtn = h('button', {
        type: 'button', class: 'tab vx-menubtn' + (cur === 'me' ? ' on' : ''),
        'aria-label': '帳號選單', 'aria-controls': 'vx-acctmenu',
        popovertarget: hasPop ? 'vx-acctmenu' : null,
        onclick: hasPop ? null : () => acctPop.classList.toggle('open'),
      }, h('span', { class: 'ti', 'aria-hidden': 'true' }, '👤'), h('span', { class: 'vx-acct-name' }, h('span', { 'data-notrans': '1' }, user.display || user.name), ' ▾'));
    }

    const bar = h('header', { class: 'topbar' },
      h('a', { class: 'logo', href: '#/' }, h('b', null, 'IQ'), h('span', null, '自學')),
      tabsWrap,
      menuBtn,
      sitemapPop,
      langBtn('top'),
      acctBtn,
      acctPop);
    const parts = [bar];
    // 情境子導覽列（讓同支柱下的 3~5 個功能一鍵切換；全螢幕模擬器隱藏以最大化畫布）
    if (activeGroup && activeGroup.items.length > 1 && !opts.full) {
      parts.push(h('nav', { class: 'subnav', 'aria-label': activeGroup.name + '子選單' },
        activeGroup.items.map(([href, ic, label, key]) => {
          const on = fullKey === key || (key === '' && (cur === '' || cur === 'skill' || cur === 'result'));
          return h('a', { class: 'subnav-item' + (on ? ' on' : ''), href, 'aria-current': on ? 'page' : null },
            h('span', { 'aria-hidden': 'true' }, ic), ' ', label);
        })));
    }
    let hidePw = false; try { hidePw = sessionStorage.getItem('vx_pwtip') === '1'; } catch (e) { /* ignore */ }
    if (user && user.pw_initial && cur !== 'me' && !hidePw) {
      const bn = h('div', { class: 'pwbanner' }, h('span', null, '🔑 你現在用的是初始密碼，可以改成自己習慣的密碼（不限格式）。'), h('a', { href: '#/me' }, '修改密碼'),
        h('button', { class: 'pwx', title: '先不要', onclick: () => { try { sessionStorage.setItem('vx_pwtip', '1'); } catch (e) { /* ignore */ } bn.remove(); } }, '✕'));
      parts.push(bn);
    }
    const pb = !opts.full && VX.guide && VX.guide.planBar ? VX.guide.planBar(cur) : null;
    if (pb) parts.push(pb);
    if (opts.title) parts.push(h('div', { class: 'subbar' }, opts.icon ? h('span', { class: 'ic' }, opts.icon) : null, opts.title));
    let main = h('main', { class: 'content' }, content);
    if (opts.rail) {
      const rail = h('nav', { class: 'rail' }, DOMAINS.map((dm) => h('a', { href: '#', onclick: (e) => { e.preventDefault(); const el = document.getElementById('dom-' + dm.id); if (el) el.scrollIntoView({ behavior: 'smooth' }); } }, h('span', { class: 'dot', style: 'background:' + dm.color + ';border-color:' + dm.stroke }), dm.short)));
      parts.push(h('div', { class: 'layout' }, rail, main));
    } else if (opts.full) parts.push(h('div', { class: 'fullwrap' }, content));
    else parts.push(h('div', { class: 'wrap' }, main));
    if (!opts.full && VX.footer) parts.push(VX.footer());
    return h('div', opts.full ? { class: 'simpage' } : null, parts);
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
    let saved = ''; try { saved = localStorage.getItem('vexiq_name') || ''; } catch (e) { /* ignore */ }
    const robot = h('div', { class: 'lg-robot', 'aria-hidden': 'true' });
    robot.innerHTML = '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
      + '<line x1="60" y1="8" x2="60" y2="26" stroke="#0875e2" stroke-width="3" stroke-linecap="round"/><circle class="ant" cx="60" cy="8" r="5" fill="#f2cd16" stroke="#b4982e" stroke-width="2"/>'
      + '<rect x="14" y="44" width="8" height="20" rx="4" fill="#86bef1"/><rect x="98" y="44" width="8" height="20" rx="4" fill="#86bef1"/>'
      + '<rect x="20" y="26" width="80" height="62" rx="18" fill="#fff" stroke="#0875e2" stroke-width="3.5"/>'
      + '<rect x="29" y="35" width="62" height="38" rx="12" fill="#0b3d75"/>'
      + '<g class="eye"><ellipse cx="46" cy="52" rx="8" ry="9" fill="#cfe8ff"/><circle class="pupil" id="lgpl" cx="46" cy="53" r="4.2" fill="#0b3d75"/></g>'
      + '<g class="eye"><ellipse cx="74" cy="52" rx="8" ry="9" fill="#cfe8ff"/><circle class="pupil" id="lgpr" cx="74" cy="53" r="4.2" fill="#0b3d75"/></g>'
      + '<path d="M50 64 Q60 71 70 64" fill="none" stroke="#73c7ca" stroke-width="3" stroke-linecap="round"/>'
      + '<g class="hand"><rect x="32" y="40" width="26" height="22" rx="9" fill="#f2a579" stroke="#b37b5e" stroke-width="2.5"/><rect x="62" y="40" width="26" height="22" rx="9" fill="#f2a579" stroke="#b37b5e" stroke-width="2.5"/></g>'
      + '<rect x="36" y="90" width="48" height="14" rx="6" fill="#77b2ff" stroke="#5a85bb" stroke-width="2.5"/>'
      + '<g class="wheel"><circle cx="44" cy="110" r="8" fill="#5d6b7e"/><circle cx="44" cy="110" r="3" fill="#fff"/></g><g class="wheel"><circle cx="76" cy="110" r="8" fill="#5d6b7e"/><circle cx="76" cy="110" r="3" fill="#fff"/></g></svg>';
    const look = (v) => { const dx = Math.max(-3, Math.min(3, (v.length - 6) * 0.45)); ['lgpl', 'lgpr'].forEach((id) => { const e = robot.querySelector('#' + id); if (e) e.style.transform = 'translate(' + dx + 'px, 0)'; }); };

    const nm = h('input', { type: 'text', id: 'lgname', placeholder: ' ', autocomplete: 'username', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'next', value: saved });
    const pw = h('input', { type: 'password', id: 'lgpw', placeholder: ' ', autocomplete: 'current-password', enterkeyhint: 'go' });
    const eye = h('button', { type: 'button', class: 'eyebtn', 'aria-label': '顯示密碼', title: '顯示密碼', onclick: () => {
      const show = pw.type === 'password'; pw.type = show ? 'text' : 'password'; eye.textContent = show ? '🙈' : '👁'; eye.title = eye.ariaLabel = show ? '隱藏密碼' : '顯示密碼'; eye.setAttribute('aria-label', eye.title);
      robot.classList.toggle('shy', !show && document.activeElement === pw);
    } }, '👁');
    const rem = h('input', { type: 'checkbox', id: 'lgrem', checked: !!saved });
    const msg = h('div', { class: 'errmsg', role: 'alert', 'aria-live': 'assertive' });
    const btn = h('button', { type: 'submit', class: 'lg-go' }, '登入');
    const card = h('form', { class: 'lg-card', novalidate: 'novalidate' },
      langBtn('lg'), robot,
      h('h1', null, 'VEX IQ 自學'), h('p', { class: 'sub' }, '登入後，網站會依你的程度出題'),
      h('div', { class: 'lg-field' }, nm, h('label', { for: 'lgname' }, '名字')),
      h('div', { class: 'lg-field pwf' }, pw, h('label', { for: 'lgpw' }, '密碼'), eye),
      h('div', { class: 'lg-row' }, h('label', null, rem, '記住我的名字')),
      msg, btn,
      h('div', { class: 'lg-foot' }, '忘記密碼？請家長在「家長頁」幫你重設。'));

    nm.addEventListener('input', () => look(nm.value)); nm.addEventListener('focus', () => { robot.classList.remove('shy'); look(nm.value); });
    pw.addEventListener('focus', () => { if (pw.type === 'password') robot.classList.add('shy'); });
    pw.addEventListener('blur', () => robot.classList.remove('shy'));
    nm.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); pw.focus(); } });
    const fail = (text) => {
      msg.textContent = text; msg.classList.remove('shake'); card.style.animation = 'none'; void card.offsetWidth; msg.classList.add('shake');
      card.style.animation = 'vx-shake .42s ease'; if (window.VXFX) window.VXFX.buzz(30);
    };
    let busy = false;
    card.addEventListener('submit', async (e) => {
      e.preventDefault(); if (busy) return;
      msg.textContent = '';
      if (!nm.value.trim() || !pw.value) { fail('請輸入名字和密碼'); (nm.value.trim() ? pw : nm).focus(); return; }
      busy = true; btn.disabled = true; btn.replaceChildren(h('span', { class: 'spin' }), '登入中…'); robot.classList.remove('shy'); robot.classList.add('busy');
      try {
        user = await api('/api/login', { name: nm.value.trim(), pw: pw.value });
        try { if (rem.checked) localStorage.setItem('vexiq_name', nm.value.trim()); else localStorage.removeItem('vexiq_name'); } catch (e2) { /* ignore */ }
        await loadMe();
        robot.classList.remove('busy'); robot.classList.add('ok'); btn.classList.add('done'); btn.replaceChildren('✓');
        card.classList.add('leaving'); if (window.VXFX) window.VXFX.buzz(15);
        setTimeout(() => { const next = (user.role === 'parent' || user.role === 'coach') ? '#/parent' : (st && st.done ? '#/plan' : '#/'); if (location.hash === next) render(); else location.hash = next; }, 380);
      } catch (err) {
        busy = false; btn.disabled = false; btn.replaceChildren('登入'); robot.classList.remove('busy'); fail(err.message); pw.select();
      }
    });
    $app.replaceChildren(h('div', { class: 'loginpage' },
      h('div', { class: 'lg-bg', 'aria-hidden': 'true' }, h('i', { class: 'g1' }), h('i', { class: 'g2' }), h('i', { class: 'g3' }), h('i', { class: 'g4' }), h('i', { class: 'g5' })),
      card, VX.footer ? VX.footer() : null));
    (saved ? pw : nm).focus(); look(nm.value);
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
        const sqs = QS.filter((q) => q.s === s.id);
        const seenN = sqs.filter((q) => st.seen && st.seen[q.id]).length;
        const skSt = mastered(s.id) ? 'ok' : (seenN > 0 || (st.m[s.id] && st.m[s.id].n > 0)) ? 'try' : 'idle';
        const skTitle = skSt === 'ok' ? '已精通' : skSt === 'try' ? '已練習' : '尚未練習';
        return h('a', { class: 'skill' + (lock ? ' lock' : '') + (mastered(s.id) ? ' mastered' : ''), href: '#/skill/' + s.id, style: 'background:' + dm.color + ';border-color:' + dm.stroke },
          h('div', { class: 'sn' }, h('span', { class: 'lamp ' + skSt, title: skTitle }), (lock ? '🔒 ' : '') + s.name),
          h('div', { class: 'stars' }, '★'.repeat(stars(p)) + '☆'.repeat(3 - stars(p))),
          h('div', { class: 'scnt' }, '已練 ' + seenN + '/' + sqs.length + ' 題'),
          h('div', { class: 'mbar' }, h('div', { style: 'width:' + Math.round(p * 100) + '%' })));
      }))));
    const tile = (href, ic, name, desc, c, sc) => h('a', { class: 'tile', href, style: 'background:' + c + ';border-color:' + sc }, h('span', { class: 'ti' }, ic), name, h('small', null, desc));
    const tiles = h('div', { class: 'tiles' },
      tile('#/sim', '🖥️', '模擬器', '不用機器人也能試跑程式', '#77b2ff', '#5a85bb'),
      tile('#/arena3d', '🏟️', '3D 練習場', '3D 撿沙包投球＋計分音效', '#0ea5e9', '#0369a1'),
      tile('#/pathplan', '🗺️', '路徑規劃器', '點路線自動生積木與 Python', '#10b981', '#047857'),
      tile('#/control', '🎛️', '控制實驗室', 'PID、里程計、走直線互動調參', '#6366f1', '#4338ca'),
      tile('#/challenge', '🏁', '挑戰題庫', '把程式實際跑在機器人上', '#f1ae34', '#b38136'),
      tile('#/build/parts', '🧩', '零件與套件百科', '主機、遙控器、線材、橡皮筋圖解', '#ec4899', '#be185d'),
      tile('#/build', '🔧', '實體組裝挑戰', '16 關動手實作＋拍照驗證', '#f2a579', '#b37b5e'),
      tile('#/notebook', '📓', '工程筆記', '學會寫、也真的寫', '#f2cd16', '#b4982e'),
      tile('#/compete', '🏆', '比賽專區', 'Robot Skills、英文術語、面談', '#5ecd98', '#4a9873'));
    const dailyPuzzle = () => {
      const today = todayStr();
      if (st.dailyDone === today) {
        return h('div', { class: 'callout', style: 'margin:12px 0' }, h('b', null, '⚡ 今日 1 分鐘小謎題已完成！'), ' 今天的連續練習已打卡，明天會換新題目。');
      }
      let hash = 0; for (let i = 0; i < today.length; i++) hash = (hash * 31 + today.charCodeAt(i)) >>> 0;
      const pool = QS.filter((q) => q.l <= 2);
      const q = (pool.length ? pool : QS)[hash % (pool.length ? pool.length : QS.length)];
      const wrap = h('div', { class: 'panel dailycard' });
      const openBtn = h('button', { class: 'btn primary sm', onclick: () => {
        wrap.replaceChildren(
          h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:8px' }, h('b', null, '⚡ 今日 1 分鐘小謎題'), h('span', { class: 'tag' }, '做完就打卡')),
          renderQuestion(q, {
            allowHint: true,
            onDone: async (res) => {
              applyResult(q, res.correct, res.assisted);
              st.dailyDone = today;
              await save(q, res, 'daily');
              if (VX.badges) VX.badges.check(false);
              toast('⚡ 今日 1 分鐘打卡完成！');
              viewHome();
            },
          })
        );
      } }, '⚡ 馬上挑戰（1 題）');
      wrap.append(
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap' },
          h('div', null, h('b', null, '⚡ 今日 1 分鐘小謎題'), h('div', { class: 'sub' }, '每天換 1 題輕鬆暖身，答完就能維持連續天數！')),
          openBtn)
      );
      return wrap;
    };
    const guideEl = (VX.guide && VX.guide.homeCard) ? VX.guide.homeCard() : null;
    $app.replaceChildren(shell(h('div', null, guideEl || top, st.done ? dailyPuzzle() : null, tiles, st.done ? h('div', { class: 'radarbox' }, radarSvg(domainAvg(st), DOMAINS.map((x) => x.short), DOMAINS.map((x) => x.stroke))) : null, maps), { rail: true, title: '首頁', icon: '🏠' }));
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
  const PY_PAIRS = [
    ['移動與轉彎（Drivetrain）', [
      ['drive [forward] for (400) [mm]', 'drivetrain.drive_for(FORWARD, 400, MM)', '往前走 400 mm；倒退把 FORWARD 改成 REVERSE。'],
      ['turn [right] for (90) [degrees]', 'drivetrain.turn_for(RIGHT, 90, DEGREES)', '原地右轉 90°；左轉把 RIGHT 改成 LEFT。'],
      ['drive [forward]', 'drivetrain.drive(FORWARD)', '一直往前開，必須搭配 drivetrain.stop() 才會停。'],
      ['stop driving', 'drivetrain.stop()', '讓底盤馬達立刻停下來。'],
      ['set drive velocity to (50) [%]', 'drivetrain.set_drive_velocity(50, PERCENT)', '調整移動速度百分比（0～100）。'],
    ]],
    ['控制與迴圈（Control）', [
      ['repeat (4)', 'for i in range(4):\n    ...', 'Python 用縮排（4 格空白）代表包在迴圈裡面的積木！'],
      ['wait (1.5) seconds', 'wait(1.5, SECONDS)', '暫停 1.5 秒再繼續執行下一行。'],
      ['while <Distance > 150 mm>', 'while distance.object_distance(MM) > 150:\n    ...', '條件成立就一直重複，記得冒號 : 與縮排。'],
      ['repeat until <Bumper pressed?>', 'while not bumper.pressing():\n    wait(5, MSEC)', 'Python 沒有 repeat until，改寫成「while not 條件」！'],
      ['if <sees red?> then', 'if optical.color() == Color.RED:\n    ...', 'Python 判斷「等於」要用兩個等號 ==（一個 = 是設定變數）。'],
    ]],
    ['變數與自訂積木（Variables / Functions）', [
      ['set [len] to (200)', 'len = 200', '建立或重設變數的值。'],
      ['change [len] by (200)', 'len = len + 200  # 或 len += 200', '在原本的數值上累加 200。'],
      ['define square (size)', 'def square(size):\n    for i in range(4):\n        drivetrain.drive_for(FORWARD, size, MM)\n        drivetrain.turn_for(RIGHT, 90, DEGREES)', 'def 就是「建立我的積木（My Block）」，括號裡放參數名稱。'],
    ]],
  ];
  const PY_QUIZ = [
    { q: '積木「drive [reverse] for (300) [mm]」對應哪一行 Python？', opts: ['drivetrain.drive_for(REVERSE, 300, MM)', 'drivetrain.drive(REVERSE, 300)', 'drivetrain.turn_for(REVERSE, 300, MM)', 'drivetrain.stop(300)'], a: 0, why: '走指定距離用 drive_for(方向, 距離, 單位)，倒退方向是 REVERSE。' },
    { q: '在 Python 裡，「重複 3 次」要怎麼寫？', opts: ['for i in range(3):', 'repeat(3)', 'while 3:', 'if range(3):'], a: 0, why: 'Python 用 for i in range(次數):，裡面要重複的程式都要往右縮排。' },
    { q: 'Python 沒有 repeat until 積木。要寫「重複直到碰撞開關被按下」，應該用哪一句？', opts: ['while not bumper.pressing():', 'if bumper.pressing():', 'for i in bumper:', 'while bumper.pressing():'], a: 0, why: '「直到成立」＝「趁還沒成立的時候一直做」，也就是 while not 條件:。' },
    { q: '在 Python 的 if 條件裡，判斷變數 score 是否「等於 10」，要用哪個符號？', opts: ['score == 10', 'score = 10', 'score += 10', 'score != 10'], a: 0, why: '兩個等號 == 是「比較是否相等」；一個等號 = 是「把變數設定為」。' },
    { q: '「len += 200」跟哪一塊積木意思一樣？', opts: ['change [len] by (200)', 'set [len] to (200)', 'repeat (200)', 'wait (200) seconds'], a: 0, why: 'len += 200 就是 len = len + 200，對應「將 len 改為 200（累加）」。' },
    { q: 'Python 裡「def polygon(sides, size):」對應 VEXcode 的什麼功能？', opts: ['My Blocks（自訂積木）', 'Drivetrain（傳動系統）', 'Sensing（感測器）', 'Sound（音效）'], a: 0, why: 'def 用來定義函式，就跟 VEXcode 裡建立帶參數的 My Block 一樣！' },
  ];

  function viewCheat(tab) {
    const isPy = tab === 'py';
    const nav = h('div', { class: 'row gap', style: 'margin:0 0 12px' },
      h('a', { class: 'btn sm' + (!isPy ? ' primary' : ''), href: '#/cheat' }, '📋 積木速查表'),
      h('a', { class: 'btn sm' + (isPy ? ' primary' : ''), href: '#/cheat/py' }, '🐍 積木 ↔ Python 對照教室'));
    if (isPy) {
      const done = (st && st.pyQuiz) || {};
      const okN = PY_QUIZ.filter((_, i) => done[i]).length;
      const quizBox = h('div', { class: 'panel' },
        h('h3', null, '🧪 積木 → Python 過渡小測驗（已答對 ' + okN + ' / ' + PY_QUIZ.length + '）'),
        h('p', { class: 'sub' }, '試著把熟悉的積木翻譯成 VEXcode Python，全部答對就亮滿綠燈！'),
        PY_QUIZ.map((q, qi) => {
          const fb = h('div', { class: 'sub', style: 'margin-top:6px' });
          const lamp = h('span', { class: 'lamp ' + (done[qi] ? 'ok' : 'idle') });
          return h('div', { class: 'wrongitem' },
            h('div', { class: 'wq' }, lamp, (qi + 1) + '. ' + q.q),
            h('div', { class: 'row gap', style: 'margin-top:6px' }, VX.shuffle(q.opts.map((o, oi) => [o, oi])).map(([o, oi]) =>
              h('button', { type: 'button', class: 'btn sm', style: 'font-family:ui-monospace,monospace', onclick: (e) => {
                const ok = oi === q.a;
                e.target.style.borderColor = ok ? 'var(--ok)' : 'var(--bad)';
                fb.textContent = (ok ? '✅ 答對！' : '❌ 正解是 ' + q.opts[q.a] + '。') + q.why;
                if (ok && st) {
                  st.pyQuiz = st.pyQuiz || {};
                  const was = !!st.pyQuiz[qi];
                  st.pyQuiz[qi] = true;
                  lamp.className = 'lamp ok';
                  saveState();
                  if (!was && PY_QUIZ.every((_, k) => st.pyQuiz[k]) && window.VXFX) window.VXFX.confetti();
                }
              } }, o))),
            fb);
        }));
      $app.replaceChildren(shell(h('div', { class: 'vxscope' }, nav,
        h('p', { class: 'sub' }, '左邊是熟悉的 VEXcode 積木，右邊是等價的 VEXcode Python 寫法。在模擬器點右上角「Code」也能即時看到自己積木轉成的 Python！'),
        PY_PAIRS.map(([t, rows]) => h('div', { class: 'panel' }, h('h3', null, t),
          rows.map(([b, py, d]) => h('div', { class: 'crow', style: 'align-items:flex-start' },
            blocksEl([b]),
            h('div', { class: 'cd', style: 'flex:1' },
              h('pre', { style: 'margin:0 0 4px;padding:6px 10px;border-radius:8px;background:var(--bg);border:1px solid var(--line);font-size:.86rem;overflow-x:auto', 'data-notrans': '1' }, py),
              h('div', { class: 'sub' }, d)))))),
        quizBox), { title: '積木 ↔ Python 對照教室', icon: '🐍' }));
      return;
    }
    $app.replaceChildren(shell(h('div', { class: 'vxscope' }, nav,
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
      h('div', { class: 'row gap', style: 'justify-content:center;flex-wrap:wrap;margin-top:12px' },
        h('a', { class: 'btn primary big', href: '#/plan' }, '📅 查看為你排好的今日課表 ▶'),
        h('a', { class: 'btn', href: '#/practice' }, '直接開始練習')))));
  }

  function viewMe() {
    const old = h('input', { type: 'password', placeholder: '舊密碼', autocomplete: 'current-password' });
    const nw = h('input', { type: 'password', placeholder: '新密碼（自己習慣的都可以）', autocomplete: 'new-password' });
    const msg = h('div', { class: 'errmsg' });
    $app.replaceChildren(shell(h('div', { class: 'panel' },
      h('h2', null, h('span', { 'data-notrans': '1' }, user.display || user.name), '（' + (user.role === 'parent' ? '家長' : user.role === 'coach' ? '教練（唯讀）' : '學員') + '）'),
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
            h('div', null, h('h2', { 'data-notrans': '1' }, l.display), h('p', { class: 'sub' }, '最近練習：' + fmtDate(l.last)),
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
    const checks = (sel) => learners.map((l) => { const cb = h('input', { type: 'checkbox', value: l.id }); cb.checked = sel.includes(l.id); return h('label', { class: 'check' }, cb, h('span', { 'data-notrans': '1' }, l.display)); });
    const picked = (boxes) => boxes.map((lb) => lb.querySelector('input')).filter((i) => i.checked).map((i) => parseInt(i.value, 10));
    const nm = h('input', { type: 'text', placeholder: '教練的登入名字' }), dp = h('input', { type: 'text', placeholder: '顯示名稱（選填）' }), pw = h('input', { type: 'text', placeholder: '密碼（至少 4 個字）' });
    const newChecks = checks([]); const msg = h('div', { class: 'errmsg' });
    box.replaceChildren(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, '🧑‍🏫 教練帳號（唯讀）'),
      h('p', { class: 'sub' }, '教練可以登入看被指派學員的練習狀況、筆記、題庫，但不能修改任何資料。'),
      coaches.length ? coaches.map((c) => { const cks = checks(c.learner_ids); const m2 = h('div', { class: 'okmsg' }); const pwi = h('input', { type: 'text', placeholder: '新密碼' });
        return h('details', { class: 'lessonbox' }, h('summary', null, h('span', { 'data-notrans': '1' }, c.display), '　', h('small', null, '登入名字：', h('span', { 'data-notrans': '1' }, c.name), '　· 可看 ' + c.learner_ids.length + ' 位學員')),
          h('div', { class: 'body' }, h('b', null, '可以看哪些學員：'), cks,
            h('div', { class: 'row gap' }, h('button', { class: 'btn sm primary', onclick: async () => { try { await api('/api/parent/coach/' + c.id + '/links', { learner_ids: picked(cks) }); m2.className = 'okmsg'; m2.textContent = '已更新'; } catch (e) { m2.className = 'errmsg'; m2.textContent = e.message; } } }, '儲存指派')),
            pwi, h('div', { class: 'row gap' }, h('button', { class: 'btn sm', onclick: async () => { try { await api('/api/parent/coach/' + c.id + '/reset', { pw: pwi.value }); m2.className = 'okmsg'; m2.textContent = '密碼已重設'; pwi.value = ''; } catch (e) { m2.className = 'errmsg'; m2.textContent = e.message; } } }, '重設密碼'),
              h('button', { class: 'btn sm danger', onclick: async () => { if (!confirm('確定刪除教練帳號「' + c.name + '」？')) return; try { await api('/api/parent/coach/' + c.id + '/delete', {}); renderCoaches(box, learners); } catch (e) { m2.className = 'errmsg'; m2.textContent = e.message; } } }, '刪除帳號')), m2)); }) : h('p', { class: 'sub' }, '還沒有教練帳號。'),
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
      h('h1', null, h('span', { 'data-notrans': '1' }, d.display), h('small', null, '　登入名字：', h('span', { 'data-notrans': '1' }, d.name))),
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
      user.role === 'coach' ? null : h('div', { class: 'panel' }, h('h3', null, '管理'), dpi, h('div', { class: 'row gap' }, h('button', { class: 'btn', onclick: async () => { try { await api('/api/parent/learner/' + uid + '/display', { display: dpi.value }); viewParent(uid); } catch (e) { msg.className = 'errmsg'; msg.textContent = e.message; } } }, '改顯示名稱')),
        pwi, h('div', { class: 'row gap' }, h('button', { class: 'btn', onclick: async () => { try { await api('/api/parent/learner/' + uid + '/reset', { pw: pwi.value }); msg.className = 'okmsg'; msg.textContent = '密碼已重設（他的登入會被登出）'; pwi.value = ''; } catch (e) { msg.className = 'errmsg'; msg.textContent = e.message; } } }, '重設密碼')),
        msg,
        h('div', { class: 'row gap' }, h('button', { class: 'btn danger', onclick: async () => { if (!confirm('確定要清掉學習進度嗎？他會重新做定位測驗（作答紀錄會保留）。')) return; try { await api('/api/parent/learner/' + uid + '/clear', {}); viewParent(uid); } catch (e) { msg.className = 'errmsg'; msg.textContent = e.message; } } }, '清掉學習進度，重新定位')),
        h('div', { class: 'row gap' }, h('button', { class: 'btn danger', onclick: async () => {
          if (!confirm('⚠ 確定要「永久刪除」學員「' + d.display + '」嗎？\n他的帳號、所有作答紀錄和工程筆記都會被刪除，無法復原。')) return;
          const tr = (s) => (window.VXI18N ? window.VXI18N.tr(s) : s);
          const rawP = (window.VXI18N && window.VXI18N.rawPrompt) || window.prompt;
          const again = rawP(tr('再確認一次：請輸入他的登入名字「') + d.name + tr('」才會刪除'));
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
    const [, a, b, c] = hash.split('/');
    if (a === 'about') return VX.routes.about();
    if (a === 'taiwan') { location.replace('#/compete/taiwan'); return; }
    if (!user) { if (hash !== '/login') history.replaceState(null, '', '#/login'); return viewLogin(); }
    if (hash === '/login') { location.hash = '#/'; return; }
    if (session && !(a === 'practice' || a === 'placement')) session = null;
    if (a === 'parent') { if (user.role !== 'parent' && user.role !== 'coach') { location.hash = '#/'; return; } return viewParent(b ? parseInt(b, 10) : 0); }
    if (user.role === 'coach' && a !== 'me' && a !== 'resources' && a !== 'review' && a !== 'about') { location.hash = '#/parent'; return; }
    if (user.role === 'parent' && a !== 'me' && a !== 'guide' && a !== 'start' && a !== 'resources' && a !== 'review' && a !== 'about' && !(a === 'build' && (b === 'parts' || b === 'lessons'))) { location.hash = '#/parent'; return; }
    if (a === 'placement') { if (!session) startPlacement(); return; }
    if (a === 'practice') {
      const cnt = c ? parseInt(c, 10) : 0;
      if (!st.done && !(b && SK[b])) { location.hash = '#/placement'; return; }
      if (!session) startPractice(b || null, cnt > 0 ? cnt : 0);
      return;
    }
    if (VX.routes[a]) return VX.routes[a](...hash.split('/').slice(2));
    if (a === 'skill') return viewSkill(b);
    if (a === 'cheat') return viewCheat(b);
    if (a === 'result') return viewResult();
    if (a === 'me') return viewMe();
    return viewHome();
  }

  const VX = window.VX = {
    routes: {}, h, api, shell, langBtn, toEn, blocksEl, oneBlock, toast, DOM, SK, DOMAINS, SKILLS, QS, TAGS, TAG_HINTS, radarSvg, domainAvg, pOf, newState, clamp, shuffle, startPractice, startDrill, pickQuestion,
    get user() { return user; }, get st() { return st; }, saveState, render, app: $app, plainOrBlock, todayStr,
  };
  window.addEventListener('hashchange', render);
  // 等所有功能檔（modules／guide／extras／sim／iqimport…）都載入、註冊完路由，再開始第一次繪製；
  // 否則直接開 #/sim 這類網址時，可能因為路由還沒註冊而退回首頁。
  async function init() { if (window.VXI18N && window.VXI18N.ready) await window.VXI18N.ready; await loadMe(); render(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
