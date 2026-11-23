/* 學習引導：今天要做的事、起步任務、學習階段、家長說明。
   依孩子目前的熟練度、做過的事，決定「接下來做什麼、為什麼」。依賴 window.VX、data.js、content.js。 */
(function () {
  'use strict';
  const VX = window.VX;
  const { h } = VX;
  const todayStr = () => VX.todayStr();

  /* ---------- 紀錄「今天做了什麼」 ---------- */
  VX.act = function (kind, skill) {
    const st = VX.st; if (!st) return;
    st.act = st.act || {}; st.flags = st.flags || {};
    const d = todayStr(); const a = st.act[d] = st.act[d] || {};
    a[kind] = (a[kind] || 0) + 1;
    if (skill) { a.skills = a.skills || []; if (!a.skills.includes(skill)) a.skills.push(skill); }
    st.flags[kind] = true;
    const keys = Object.keys(st.act).sort(); while (keys.length > 21) delete st.act[keys.shift()];
    if (VX.badges) VX.badges.check(false);
  };

  /* ---------- 能力判讀（可用在孩子自己的狀態，也可用在家長看到的孩子狀態）---------- */
  const SKID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
  const pOf = (state, id) => (state && state.m && state.m[id] && state.m[id].p) || 0;
  const unlocked = (state, id) => SKID[id].pre.every((p) => pOf(state, p) >= 0.45);
  const STAGES = [
    { id: 'basic', name: '第 1 階段：基礎——讓機器人照你的話做', skills: ['A1', 'A2', 'A3', 'A4', 'C1', 'C2', 'C3', 'C4', 'C5'], goal: '認識零件，會用積木讓機器人前進、轉彎、重複。' },
    { id: 'sense', name: '第 2 階段：機構與感測器', skills: ['B1', 'B2', 'B3', 'B4', 'B5', 'D1', 'D2', 'D3', 'D4', 'D5', 'E1', 'E2', 'E3'], goal: '懂機構原理，會用感測器和條件判斷，會用變數和自訂積木。' },
    { id: 'comp', name: '第 3 階段：策略與比賽', skills: ['E4', 'F1', 'F2', 'F3'], goal: '會除錯、會算分、會規劃一場比賽的 60 秒。' },
  ];
  const stageAvg = (state, s) => s.skills.reduce((a, id) => a + pOf(state, id), 0) / s.skills.length;
  function currentStage(state) { for (const s of STAGES) if (stageAvg(state, s) < 0.65) return s; return STAGES[STAGES.length - 1]; }

  function daysSince(state, id) { const m = state.m && state.m[id]; return m && m.t ? (Date.now() - m.t) / 86400000 : 99; }
  function recommendSkills(state, n) {
    const cands = SKILLS.filter((s) => unlocked(state, s.id) && pOf(state, s.id) < 0.8);
    const scored = cands.map((s) => {
      const p = pOf(state, s.id), m = (state.m && state.m[s.id]) || { n: 0 };
      const stage = STAGES.findIndex((x) => x.skills.includes(s.id));
      const cur = STAGES.indexOf(currentStage(state));
      const score = (1 - p) * 2 + (stage === cur ? 1.2 : 0) - (stage > cur ? 0.8 : 0) + (daysSince(state, s.id) > 7 && p > 0.4 ? 0.4 : 0);
      let why;
      if (!m.n) why = '還沒練過，從這裡開始最適合。';
      else if (p < 0.35) why = '目前熟練度 ' + Math.round(p * 100) + '%，是現在最需要加強的地方。';
      else if (daysSince(state, s.id) > 7) why = '已經 ' + Math.round(daysSince(state, s.id)) + ' 天沒練了，再練一下才不會忘。';
      else why = '熟練度 ' + Math.round(p * 100) + '%，再練幾題就能精通。';
      return { id: s.id, name: s.name, p, why, score };
    }).sort((a, b) => b.score - a.score);
    return scored.slice(0, n || 2);
  }
  function recommendChallenge(state) {
    const ch = state.ch || {};
    const list = CHALLENGES.slice().sort((a, b) => (a.lu ? 1 : 0) - (b.lu ? 1 : 0) || a.lv - b.lv);
    for (const c of list) {
      const r = ch[c.id] || {};
      if (r.done || r.sim) continue;
      const need = c.lv <= 1 ? [] : c.skills.filter((s) => pOf(state, s) < 0.3); // 第 1 級挑戰是新手入口，不設前置條件
      if (!need.length) return { c, ready: true };
      return { c, ready: false, need: need.map((s) => SKID[s].name) };
    }
    return null;
  }
  function needsRealTest(state) {
    const ch = state.ch || {};
    return CHALLENGES.find((c) => ch[c.id] && ch[c.id].sim && !ch[c.id].done) || null;
  }

  /* ---------- 起步任務 ---------- */
  const START = [
    { id: 'placement', t: '做定位測驗', time: '約 10 分鐘', why: '讓網站知道你現在會到哪裡，之後的題目才不會太難或太簡單。', how: ['按「開始定位測驗」。', '每題盡量自己想；不會就按「我還不會」，不會被扣分。'], auto: (s) => !!s.done, go: ['#/placement', '開始定位測驗'] },
    { id: 'parts', t: '認識你的零件', time: '約 10 分鐘', why: '知道 Brain（大腦）、馬達、感測器各做什麼，後面才看得懂題目。', how: ['打開「組裝」頁，看最下面的「零件圖鑑」。', '拿出你的套件，找找看每個零件長什麼樣子。'], manual: 'parts', go: ['#/build', '去看零件圖鑑'] },
    { id: 'build', t: '把機器人組起來', time: '30～60 分鐘', why: '有一台真的機器人，才能把程式拿去實測。', how: ['打開 VEX 官方免費課程「Competition 101: VEX IQ Level Up」，做第 2 堂「Building Your First Robot」，會一步一步組出當季的 Hero Bot「Flop」（英文頁面，圖片很清楚）。', '先確認你的套件零件夠不夠（看官方頁面的說明）；不確定就問補習班老師。', '可以請補習班老師或爸媽一起組。還沒有機器人也沒關係，先按「略過」，用網頁模擬器練習。'], manual: 'build', skippable: true, go: ['https://education.vex.com/stemlabs/iq/competition-101-vex-iq-level-up', '打開官方課程（第 2 堂：組裝）', true] },
    { id: 'vexcode', t: '打開 VEXcode，設定機器人', time: '約 10 分鐘', why: 'VEXcode 是寫積木程式的軟體；要先告訴它機器人有哪些零件。', how: ['用瀏覽器打開 VEXcode IQ 網頁版，或打開電腦上的 VEXcode IQ。', '點右上角的「Devices（裝置）」，按「Add a device（新增設備）」。', '選 Drivetrain 2-motor，依序選擇左、右馬達接在 Brain 的第幾個埠，按完成。', '埠號要和 Brain 上實際接的一樣。'], manual: 'vexcode', skippable: true, go: ['https://codeiq.vex.com/', '打開 VEXcode IQ', true] },
    { id: 'firstsim', t: '在模擬器寫第一個程式', time: '約 10 分鐘', why: '先在電腦上練習，不怕撞到東西，也不用等機器人。', how: ['進入「模擬器」，場地選「直線衝刺」。', '把左邊的「drive forward for 200 mm」拖到「when started」下面，把數字改成 1000。', '按 RUN，看機器人是否走到旗子。'], auto: (s) => !!(s.ch && s.ch.ch1 && (s.ch.ch1.sim || s.ch.ch1.done)), go: ['#/sim/ch1', '開始（直線衝刺）'] },
    { id: 'real', t: '把同一個程式放到真的機器人', time: '約 15 分鐘', why: '模擬器是理想的，真機會有誤差，這個差距就是學到最多的地方。', how: ['在 VEXcode 寫一樣的程式（drive forward for 1000 mm）。', '用 USB 連接 Brain，按 Download（下載），再按 RUN。', '用尺量一量機器人實際走了多遠。'], auto: (s) => !!(s.ch && s.ch.ch1 && s.ch.ch1.done), skippable: true, go: ['#/challenge/ch1', '回到挑戰，按「我在機器人上跑成功了」'] },
    { id: 'note', t: '寫第一頁工程筆記', time: '約 10 分鐘', why: '評審看重「你怎麼想、怎麼測」，不只看機器人。', how: ['進入「筆記」，先看第 1 課「為什麼要寫工程筆記」。', '選「測試紀錄」，寫下模擬和真機各走了多遠。'], auto: (s) => !!(s.flags && s.flags.note), go: ['#/notebook/new/test/ch1', '寫測試紀錄'] },
  ];
  const stepState = (state, stp) => {
    const sk = state.start || {};
    if (stp.auto && stp.auto(state)) return 'done';
    if (stp.manual && sk[stp.manual]) return 'done';
    if (sk[stp.id + '_skip']) return 'skipped';
    return 'todo';
  };
  const startProgress = (state) => { const sts = START.map((s) => stepState(state, s)); return { done: sts.filter((x) => x === 'done' || x === 'skipped').length, total: START.length, next: START.find((s, i) => sts[i] === 'todo') || null }; };

  /* ---------- 今天的任務 ---------- */
  function todayPlan(state) {
    const a = ((state.act || {})[todayStr()]) || {};
    const practiced = (state.days && state.days[todayStr()]) || 0;
    const rec = recommendSkills(state, 2);
    const chal = recommendChallenge(state);
    const realTest = needsRealTest(state);
    const tasks = [];
    tasks.push({ id: 't1', icon: '✏️', t: '做練習題', time: '約 8 分鐘', detail: '網站會從你最需要練的地方出題（約 10 題）。', done: practiced >= 8, go: ['#/practice', '開始練習'] });
    if (rec.length) tasks.push({ id: 't2', icon: '🎯', t: '重點加強：' + rec[0].name, time: '約 5 分鐘', detail: rec[0].why, done: !!(a.skills && a.skills.includes(rec[0].id)), go: ['#/practice/' + rec[0].id, '練這個技能（5 題）'] });
    if (realTest) tasks.push({ id: 't3', icon: '🤖', t: '用真的機器人驗證「' + realTest.title + '」', time: '約 15 分鐘', detail: '你已經在模擬器通過了，現在放到機器人上跑跑看，再寫一頁測試紀錄。', done: !!(a.challenge || a.note), go: ['#/challenge/' + realTest.id, '去挑戰頁'] });
    else if (chal) tasks.push({ id: 't3', icon: '🏁', t: chal.ready ? '挑戰：' + chal.c.title : '先補強再挑戰：' + chal.need[0], time: '約 10 分鐘', detail: chal.ready ? chal.c.goal_t : '「' + chal.c.title + '」需要先會「' + chal.need.join('、') + '」，先把它練起來。', done: !!(a.sim || a.challenge), go: chal.ready ? ['#/sim/' + chal.c.id, '到模擬器試試看'] : ['#/practice/' + SKILLS.find((s) => s.name === chal.need[0]).id, '先練這個技能'] });
    else tasks.push({ id: 't3', icon: '📓', t: '寫一頁工程筆記', time: '約 10 分鐘', detail: '把今天學到的、遇到的困難寫下來。', done: !!a.note, go: ['#/notebook', '去寫筆記'] });
    return { tasks, doneN: tasks.filter((t) => t.done).length };
  }

  /* ---------- 成就徽章與連續天數 ---------- */
  const keyDay = (t) => { const x = new Date(t); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  function streakOf(state) {
    const days = state.days || {}; let n = 0; const t = Date.now();
    for (let i = 0; i < 90; i++) { if (days[keyDay(t - i * 86400000)]) n++; else if (i > 0) break; }
    return n;
  }
  const totalAnswers = (st) => Object.values(st.days || {}).reduce((a, b) => a + b, 0);
  const nMastered = (st) => SKILLS.filter((s) => pOf(st, s.id) >= 0.8).length;
  const doneCh = (st) => CHALLENGES.filter((c) => st.ch && st.ch[c.id] && (st.ch[c.id].sim || st.ch[c.id].done)).length;
  const domAvg = (st, d) => { const l = SKILLS.filter((s) => s.d === d); return l.reduce((a, s) => a + pOf(st, s.id), 0) / l.length; };
  const BADGES = [
    { id: 'start', icon: '🚀', name: '出發！', desc: '完成定位測驗', test: (st) => !!st.done },
    { id: 'a10', icon: '✏️', name: '練習 10 題', desc: '累計答 10 題', test: (st) => totalAnswers(st) >= 10 },
    { id: 'a100', icon: '💯', name: '百題達人', desc: '累計答 100 題', test: (st) => totalAnswers(st) >= 100 },
    { id: 's3', icon: '🔥', name: '連續 3 天', desc: '連續 3 天都有練習', test: (st) => streakOf(st) >= 3 },
    { id: 's7', icon: '🌋', name: '連續 7 天', desc: '連續 7 天都有練習', test: (st) => streakOf(st) >= 7 },
    { id: 'sim1', icon: '🖥️', name: '第一次模擬通過', desc: '在模擬器完成一個挑戰', test: (st) => Object.values(st.ch || {}).some((r) => r.sim || r.done) },
    { id: 'ch5', icon: '🏁', name: '挑戰 5 個', desc: '完成 5 個挑戰', test: (st) => doneCh(st) >= 5 },
    { id: 'real1', icon: '🤖', name: '真機成功', desc: '在真的機器人上完成一個挑戰', test: (st) => Object.values(st.ch || {}).some((r) => r.done) },
    { id: 'note1', icon: '📓', name: '第一頁筆記', desc: '寫下第一頁工程筆記', test: (st) => !!(st.flags && st.flags.note) },
    { id: 'imp1', icon: '📤', name: '交出存檔', desc: '上傳第一個 VEXcode 存檔檢查', test: (st) => !!(st.flags && st.flags.import) },
    { id: 'm1', icon: '⭐', name: '精通 1 個技能', desc: '一個技能熟練度到 80%', test: (st) => nMastered(st) >= 1 },
    { id: 'm5', icon: '🌟', name: '精通 5 個技能', desc: '五個技能熟練度到 80%', test: (st) => nMastered(st) >= 5 },
    { id: 'sense', icon: '📡', name: '感測器高手', desc: '「條件與感測器」領域平均 60%', test: (st) => domAvg(st, 'D') >= 0.6 },
    { id: 'lu', icon: '🎯', name: 'Level Up 專家', desc: '當季計分、規劃、規則都到 60%', test: (st) => ['F1', 'F2', 'F3'].every((id) => pOf(st, id) >= 0.6) },
    { id: 'vocab', icon: '🔤', name: '英文術語 10 個', desc: '術語卡記住 10 個詞', test: (st) => Object.values(st.vocab || {}).filter((v) => v >= 2).length >= 10 },
  ];
  VX.badges = {
    list: BADGES, streak: streakOf,
    // 檢查有沒有新徽章；有的話記錄時間，並（非 silent 時）跳出提示
    check(silent) {
      const st = VX.st; if (!st || !VX.user || VX.user.role !== 'learner') return [];
      st.badges = st.badges || {}; const fresh = [];
      BADGES.forEach((b) => { if (!st.badges[b.id] && b.test(st)) { st.badges[b.id] = Date.now(); fresh.push(b); } });
      if (fresh.length && !silent) fresh.forEach((b, i) => setTimeout(() => VX.toast('🏅 獲得徽章：' + b.icon + ' ' + b.name), i * 1600));
      if (fresh.length) VX.saveState();
      return fresh;
    },
  };

  /* ---------- 小元件 ---------- */
  const bar = (p, c) => h('div', { class: 'mbar' }, h('div', { style: 'width:' + Math.round(p * 100) + '%' + (c ? ';background:' + c : '') }));
  const goBtn = (g, cls) => (g[2] ? h('a', { class: cls || 'btn primary', href: g[0], target: '_blank', rel: 'noopener noreferrer' }, g[1] + ' ↗') : h('a', { class: cls || 'btn primary', href: g[0] }, g[1]));

  /* ---------- 首頁卡片 ---------- */
  VX.guide = {};
  VX.guide.plan = (state) => ({ stage: currentStage(state), start: startProgress(state), today: todayPlan(state), skills: recommendSkills(state, 3), challenge: recommendChallenge(state) });
  VX.guide.homeCard = function () {
    const st = VX.st, user = VX.user;
    const wrap = h('div');
    if (!st.done) {
      wrap.append(h('div', { class: 'hero start' }, h('div', null, h('h2', null, '歡迎，' + (user.display || user.name) + '！先從這裡開始'), h('p', null, '第一步：定位測驗（約 10 分鐘）。網站會知道你現在會到哪裡，再幫你安排適合的題目。不會的可以直接說「我還不會」，不會被扣分。')), h('a', { class: 'btn primary big', href: '#/placement' }, '開始定位測驗 ▶')),
        h('div', { class: 'panel' }, h('b', null, '還不確定怎麼用？'), h('p', { class: 'sub' }, '先看「起步任務」：一共 7 個小步驟，每一步都告訴你做什麼、為什麼、怎麼做。'), h('a', { class: 'btn', href: '#/start' }, '看起步任務'), ' ', h('a', { class: 'btn', href: '#/guide' }, '網站怎麼用')));
      return wrap;
    }
    const p = VX.guide.plan(st), t = p.today;
    // 今天要做的事
    wrap.append(h('div', { class: 'panel todaycard' },
      h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start;gap:8px' }, h('div', null, h('h2', { style: 'margin:0' }, '📅 今天要做的事', streakOf(st) ? h('span', { class: 'tag', style: 'margin-left:8px;background:#ffe9d6;color:#c2410c' }, '🔥 連續 ' + streakOf(st) + ' 天') : null), h('div', { class: 'sub' }, '嗨，' + (user.display || user.name) + '！照順序做，大約 20 分鐘就夠了。每週 3～4 次，比一次練很久有效。')), h('div', { class: 'big2' }, t.doneN + ' / ' + t.tasks.length)),
      t.tasks.map((k, i) => h('div', { class: 'task' + (k.done ? ' done' : '') }, h('div', { class: 'tn' }, k.done ? '✅' : k.icon), h('div', { class: 'tb' }, h('b', null, (i + 1) + '. ' + k.t), h('span', { class: 'tag' }, k.time), h('div', { class: 'sub', style: 'margin:2px 0 6px' }, k.detail)), h('div', null, k.done ? h('span', { class: 'tag done' }, '今天完成了') : goBtn(k.go, 'btn primary sm')))),
      t.doneN === t.tasks.length ? h('div', { class: 'callout' }, '🎉 今天的任務都完成了！休息一下，明天再來。想多練的話可以去「挑戰」或「模擬器」自由玩。') : h('div', { class: 'sub' }, '只有 10 分鐘？只做第 1 項就好。')));
    // 起步任務
    if (p.start.next) {
      const nx = p.start.next;
      wrap.append(h('div', { class: 'panel' }, h('div', { class: 'row', style: 'justify-content:space-between;gap:8px' }, h('h3', { style: 'margin:0' }, '🚀 起步任務 ' + p.start.done + ' / ' + p.start.total), h('a', { href: '#/start' }, '看全部步驟 ›')), bar(p.start.done / p.start.total),
        h('div', { class: 'sub', style: 'margin-top:8px' }, '下一步：', h('b', null, nx.t), '（' + nx.time + '）　' + nx.why), goBtn(nx.go, 'btn sm')));
    }
    // 成就徽章
    const earned = VX.badges ? (VX.badges.check(true), BADGES.filter((b) => st.badges && st.badges[b.id])) : [];
    wrap.append(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, '🏅 我的徽章 ' + earned.length + ' / ' + BADGES.length),
      h('div', { class: 'badges' }, BADGES.map((b) => { const got = !!(st.badges && st.badges[b.id]); return h('div', { class: 'badge' + (got ? ' got' : ''), title: b.desc }, h('div', { class: 'bi' }, got ? b.icon : '🔒'), h('div', { class: 'bn' }, b.name), h('div', { class: 'bd' }, b.desc)); }))));
    // 我在哪個階段
    wrap.append(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, '🧭 我現在在哪裡'),
      STAGES.map((s) => { const a = stageAvg(st, s), cur = s === p.stage; return h('div', { class: 'stagerow' + (cur ? ' cur' : '') }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', null, (cur ? '👉 ' : '') + s.name), h('span', { class: 'sub' }, Math.round(a * 100) + '%')), bar(a), cur ? h('div', { class: 'sub' }, '目標：' + s.goal) : null); }),
      p.skills.length ? h('div', { class: 'sub', style: 'margin-top:8px' }, '接下來最值得練：', p.skills.map((x) => h('a', { class: 'pre', href: '#/practice/' + x.id }, x.name + '（' + Math.round(x.p * 100) + '%）'))) : null,
      h('div', { class: 'row gap' }, h('a', { class: 'btn sm', href: '#/guide' }, '網站怎麼用'))));
    return wrap;
  };

  /* ---------- 新手導覽（第一次進首頁）---------- */
  VX.guide.maybeTour = function () {
    const st = VX.st; if (!st || st.tour || VX.user.role !== 'learner') return;
    const done = () => { st.tour = true; VX.saveState(); ov.remove(); };
    const ov = h('div', { class: 'tourov' }, h('div', { class: 'tourbox' },
      h('h2', null, '歡迎來到 VEX IQ 自學！'), h('p', { class: 'sub' }, '這個網站會陪你一步一步學。只要記得三件事：'),
      h('div', { class: 'tourstep' }, h('b', null, '① 先做定位測驗'), h('div', { class: 'sub' }, '約 10 分鐘。網站會知道你現在會到哪裡。')),
      h('div', { class: 'tourstep' }, h('b', null, '② 每次來都看「今天要做的事」'), h('div', { class: 'sub' }, '在首頁最上面，大約 20 分鐘，照順序做就好。')),
      h('div', { class: 'tourstep' }, h('b', null, '③ 用真的機器人試試看，再寫進筆記'), h('div', { class: 'sub' }, '在模擬器練熟後，放到機器人上測；工程筆記是比賽評審最看重的。')),
      h('div', { class: 'row gap' }, h('a', { class: 'btn primary', href: st.done ? '#/' : '#/placement', onclick: done }, st.done ? '知道了，開始吧' : '開始定位測驗 ▶'), h('button', { class: 'btn', onclick: done }, '我先看看網站'))));
    document.body.append(ov);
  };

  /* ---------- 起步任務頁 ---------- */
  function viewStart() {
    const st = VX.st, pr = startProgress(st);
    const mark = (k, v) => { st.start = st.start || {}; st.start[k] = v; VX.saveState(); viewStart(); };
    VX.app.replaceChildren(VX.shell(h('div', null,
      h('p', { class: 'sub' }, '第一次用的話，照這 7 步做就會了。不用一次做完，一次做一步就好。沒有機器人的步驟可以先略過，用模擬器練習。'),
      h('div', { class: 'panel' }, h('b', null, '進度 ' + pr.done + ' / ' + pr.total), bar(pr.done / pr.total)),
      START.map((s, i) => {
        const state = stepState(st, s), isNext = pr.next === s;
        return h('div', { class: 'panel step ' + state + (isNext ? ' next' : '') },
          h('div', { class: 'row', style: 'justify-content:space-between;gap:8px;align-items:flex-start' },
            h('h3', { style: 'margin:0' }, (state === 'done' ? '✅ ' : state === 'skipped' ? '⏭ ' : isNext ? '👉 ' : '') + '步驟 ' + (i + 1) + '：' + s.t), h('span', { class: 'tag' }, s.time)),
          h('p', { class: 'sub' }, h('b', null, '為什麼：'), s.why),
          h('ol', null, s.how.map((x) => h('li', null, x))),
          h('div', { class: 'row gap' }, goBtn(s.go, 'btn ' + (isNext ? 'primary' : '') + ' sm'),
            s.manual && state !== 'done' ? h('button', { class: 'btn green sm', onclick: () => mark(s.manual, true) }, '✔ 我做完了') : null,
            s.skippable && state === 'todo' ? h('button', { class: 'btn ghost sm', onclick: () => mark(s.id + '_skip', true) }, '先略過') : null,
            state === 'skipped' ? h('button', { class: 'btn ghost sm', onclick: () => mark(s.id + '_skip', false) }, '取消略過') : null,
            state === 'done' && s.manual ? h('button', { class: 'btn ghost sm', onclick: () => mark(s.manual, false) }, '取消完成') : null));
      }),
      pr.done === pr.total ? h('div', { class: 'callout' }, '🎉 起步任務全部完成！之後每天看首頁的「今天要做的事」就好。') : null), { title: '起步任務', icon: '🚀' }));
  }

  /* ---------- 網站怎麼用 ---------- */
  const SECT = (title, kids) => h('div', { class: 'panel' }, h('h2', null, title), kids);
  const Q = (q, a) => h('details', { class: 'lessonbox' }, h('summary', null, q), h('div', { class: 'body' }, a));
  function viewGuide(tab) {
    const kid = tab === 'kid';
    const nav = h('div', { class: 'row gap', style: 'margin:10px 0' }, h('a', { class: 'btn sm' + (kid ? '' : ' primary'), href: '#/guide' }, '給家長'), h('a', { class: 'btn sm' + (kid ? ' primary' : ''), href: '#/guide/kid' }, '給孩子'));
    const parent = [
      SECT('這個網站是什麼？', [h('p', null, '幫孩子在補習班以外自己學 VEX IQ 機器人。網站會：'), h('ul', null, h('li', null, '先測他的程度，再出適合的題目（太難、太簡單都不會）。'), h('li', null, '教他寫「工程筆記」——比賽評審最看重的東西。'), h('li', null, '提供網頁模擬器，沒有機器人也能練程式；有機器人就拿去實測。'), h('li', null, '讓你在「家長頁」看到他學到哪、卡在哪。'))]),
      SECT('你不需要會 VEX IQ', [h('p', null, '你的角色很簡單，每週大約 10 分鐘：'), h('ol', null, h('li', null, h('b', null, '確認他有排時間'), '：每週 3～4 次，每次 20 分鐘就夠。短而固定，比一次練很久有效。'), h('li', null, h('b', null, '看一次家長頁'), '（約 3 分鐘）：看他本週練了多久、哪裡進步、哪裡常錯。'), h('li', null, h('b', null, '在他的筆記上留一句話'), '：鼓勵，或問一個問題（例如「這個結論的數據在哪裡？」）。')), h('div', { class: 'callout' }, '不需要你教他寫程式。你只要陪他、問他問題，他自己講得出來，就代表真的懂了。')]),
      SECT('第一週怎麼開始', [h('table', { class: 'tbl' }, h('tr', null, h('th', null, '哪一天'), h('th', null, '做什麼'), h('th', null, '大約時間')),
        ...[['第 1 天', '登入、做「定位測驗」。', '15 分鐘'], ['第 2 天', '看「組裝 → 零件圖鑑」，認識自己的套件；開始「起步任務」。', '20 分鐘'], ['第 3 天', '練習題＋在模擬器完成第一個挑戰「直線衝刺」。', '20 分鐘'], ['第 4 天', '把同一個程式放到真的機器人，量一量誤差，寫第一頁工程筆記。', '30 分鐘'], ['週末', '你看家長頁、在他的筆記留言，聊聊他學到什麼。', '10 分鐘']].map((r) => h('tr', null, r.map((x) => h('td', null, x))))), h('p', { class: 'sub' }, '還沒有機器人也可以，先用模擬器；機器人到了再補「起步任務」裡的步驟。'), h('a', { class: 'btn primary', href: '#/start' }, '看起步任務')]),
      SECT('怎麼看家長頁', [h('ul', null, h('li', null, h('b', null, '雷達圖'), '：六個領域的熟練度，越外圈越熟。'), h('li', null, h('b', null, '常見錯誤類型'), '：例如「角度與距離搞混」，代表他需要加強哪一種觀念。'), h('li', null, h('b', null, '最近答錯的題目'), '：看他的答案和解釋，可以直接問他「你當時怎麼想？」。'), h('li', null, h('b', null, '工程筆記'), '：點開可以看他寫的內容並留言。'), h('li', null, h('b', null, '這週陪他做什麼'), '：家長頁最上面，依他的進度給你具體建議。'))]),
      SECT('幾個詞，聽到不用慌', [h('table', { class: 'tbl' }, h('tr', null, h('th', null, '詞'), h('th', null, '白話意思')), ...[['Brain（主機）', '機器人的大腦，程式放在裡面執行。'], ['Motor（馬達）', '讓輪子、手臂轉動的零件。'], ['Sensor（感測器）', '讓機器人「知道」周圍的零件，例如量距離、偵測碰撞。'], ['VEXcode', '他寫積木程式的軟體，用拖拉積木的方式。'], ['Autonomous（自動階段）', '機器人只靠事先寫好的程式自己跑，不能用遙控器。'], ['Engineering Notebook（工程筆記）', '記錄設計與測試過程的筆記，比賽評審很看重。'], ['Skills（技能賽）', '一台機器人在限定時間內盡量得分。']].map((r) => h('tr', null, r.map((x) => h('td', null, x)))))]),
      SECT('常見問題', [
        Q('他說不想做、沒興趣怎麼辦？', h('p', null, '先降低門檻：只做「今天要做的事」的第 1 項（約 8 分鐘）。也可以讓他先玩「模擬器」，看到機器人動起來通常比較有成就感。')),
        Q('題目太難，他一直答不出來？', h('p', null, '網站會自動降低難度，並在答錯後給解釋。如果他連續卡在同一個技能，家長頁會顯示；你可以把那個技能拿去問補習班老師。')),
        Q('還沒有機器人，可以先開始嗎？', h('p', null, '可以。「起步任務」裡和機器人有關的步驟可以先略過，先用模擬器練習。')),
        Q('他忘記密碼？', h('p', null, '在家長頁點他的名字，往下找「管理」，可以重設他的密碼。')),
        Q('需要多久才會看到進步？', h('p', null, '通常練習 1～2 週，家長頁的雷達圖就會有明顯變化。真正的重點是持續。')),
      ]),
    ];
    const kidG = [
      SECT('三件事就好', [h('ol', null, h('li', null, h('b', null, '先做定位測驗'), '（約 10 分鐘）。不會的就按「我還不會」，沒關係！'), h('li', null, h('b', null, '每次來，先看首頁的「今天要做的事」'), '，照順序做，大約 20 分鐘。'), h('li', null, h('b', null, '用真的機器人試試看'), '，再把你發現的寫進「筆記」。'))]),
      SECT('每個按鈕在哪裡？', [h('table', { class: 'tbl' }, h('tr', null, h('th', null, '想做什麼'), h('th', null, '點哪裡')), ...[['看今天要做什麼', '上面的「首頁」'], ['做題目、被考', '「練習」'], ['挑戰一個任務', '「挑戰」'], ['不用機器人，在電腦上試程式', '「模擬器」'], ['寫工程筆記', '「筆記」'], ['把 VEXcode 寫好的程式交給網站檢查', '「上傳存檔」'], ['學組裝、認識零件', '「組裝」'], ['查積木怎麼用', '「速查表」'], ['看比賽規則和練習', '「比賽」']].map((r) => h('tr', null, r.map((x) => h('td', null, x)))))]),
      SECT('用真的機器人練習之後', [h('ol', null, h('li', null, '在 VEXcode 按 File → Save as，把程式存成檔案（.iqblocks）。'), h('li', null, '到網站的「上傳存檔」，選挑戰、選檔案。'), h('li', null, '網站會檢查；不對的話，會一步一步告訴你哪裡要改。'), h('li', null, '改好再存檔、再上傳一次，直到沒問題；最後存成工程筆記。'))]),
      SECT('卡住的時候', [h('ol', null, h('li', null, '先看題目的「解釋」。'), h('li', null, '挑戰有「提示」，一個一個點開，先想再看。'), h('li', null, '真的卡住再看「參考解答」，看完自己重做一次。'), h('li', null, '還是不懂，記下來，問補習班老師或爸媽。'))]),
      SECT('在模擬器寫程式', [h('ol', null, h('li', null, '從左邊把積木拖到「when started」下面。'), h('li', null, '改數字，按上面的 RUN。'), h('li', null, '手指或滑鼠停在積木上 1 秒，會跳出中文意思。'), h('li', null, '成功了，記得去真的機器人上試一次！'))]),
    ];
    VX.app.replaceChildren(VX.shell(h('div', null, nav, kid ? kidG : parent), { title: '網站怎麼用', icon: '🧭' }));
  }

  VX.routes.start = () => viewStart();
  VX.routes.guide = (tab) => viewGuide(tab);

  /* ---------- 家長頁：這週陪他做什麼 ---------- */
  VX.guide.parentCard = function (box, state, learner) {
    if (!box) return;
    const st = state || {}; const done = !!st.done;
    const pr = startProgress(st), stage = currentStage(st), rec = recommendSkills(st, 2), chal = recommendChallenge(st);
    const last = learner && learner.last ? Math.round((Date.now() / 1000 - learner.last) / 86400) : null;
    const items = [];
    if (!done) items.push(h('li', null, h('b', null, '請他先做「定位測驗」'), '（約 10 分鐘）。這是所有建議的基礎。'));
    else {
      if (last !== null && last >= 3) items.push(h('li', null, h('b', null, '他已經 ' + last + ' 天沒練了'), '：問問他最近有沒有遇到困難，先約好固定的練習時間。'));
      if (pr.next) items.push(h('li', null, h('b', null, '陪他完成起步任務的下一步：「' + pr.next.t + '」'), '（' + pr.next.time + '）。'));
      if (rec[0]) items.push(h('li', null, h('b', null, '請他加強「' + rec[0].name + '」'), '：' + rec[0].why));
      if (chal) items.push(h('li', null, chal.ready ? h('b', null, '可以挑戰「' + chal.c.title + '」') : h('b', null, '先補強再挑戰「' + chal.c.title + '」'), chal.ready ? '：' + chal.c.goal_t : '：需要先會「' + chal.need.join('、') + '」。'));
      items.push(h('li', null, h('b', null, '看他的工程筆記並留一句話'), '，鼓勵或問一個問題。'));
    }
    const asks = [];
    if (rec[0]) asks.push('「' + rec[0].name + '」是在學什麼？你可以講給我聽嗎？');
    asks.push('這週你寫的程式，機器人做了什麼？', '哪一題讓你想最久？你後來怎麼想通的？', '如果要改進你的機器人，你會先改哪裡？為什麼？');
    box.replaceChildren(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, '🧭 這週陪他做什麼'),
      h('div', { class: 'stats' }, h('div', null, h('b', null, done ? stage.name.split('：')[0] : '尚未開始'), h('small', null, '目前階段')), h('div', null, h('b', null, pr.done + ' / ' + pr.total), h('small', null, '起步任務')), h('div', null, h('b', null, last === null ? '還沒有' : last === 0 ? '今天' : last + ' 天前'), h('small', null, '最近練習'))),
      h('ol', null, items),
      h('details', { class: 'lessonbox' }, h('summary', null, '可以這樣問他（不用懂 VEX）'), h('div', { class: 'body' }, h('ul', null, asks.map((a) => h('li', null, a))), h('p', { class: 'sub' }, '他講得出來，就代表真的懂了；講不出來，就是下次要加強的地方。'))),
      h('a', { class: 'btn sm', href: '#/guide' }, '網站怎麼用（家長版）')));
  };
})();
