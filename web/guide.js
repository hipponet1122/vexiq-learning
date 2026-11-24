/* 學習引導：今天要做的事、起步任務、學習階段、家長說明。
   依孩子目前的熟練度、做過的事，決定「接下來做什麼、為什麼」。依賴 window.VX、data.js、content.js。 */
(function () {
  'use strict';
  const VX = window.VX;
  const { h } = VX;
  const todayStr = () => VX.todayStr();
  // 帶數字的句子：先整句翻譯（模板字串），再把 {n} 換成數字，英文介面才不會殘留中文片段
  const T = (s, o) => { let r = (window.VXI18N && window.VXI18N.tr) ? window.VXI18N.tr(s) : s; if (o) Object.keys(o).forEach((k) => { r = r.split('{' + k + '}').join(o[k]); }); return r; };

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
    { id: 'comp', name: '第 3 階段：策略、進階控制與比賽', skills: ['E4', 'E5', 'E6', 'E7', 'F1', 'F2', 'F3'], goal: '會除錯、懂進階控制與算分，能規劃一場比賽的 60 秒。' },
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

  function recommendBuildLab(state) {
    if (typeof BUILD_LABS === 'undefined' || !Array.isArray(BUILD_LABS)) return null;
    const done = state.buildLabs || {};
    return BUILD_LABS.find((b) => !(done[b.id] && done[b.id].done)) || null;
  }

  /* ---------- 自動學習課表引擎（依已學與已完成動態排課）---------- */
  const PLAN_PRESETS = [
    { min: 15, label: '15 分鐘', tag: '輕鬆', tip: '平日功課多時用：快速暖身＋1 個核心課題，維持連續練習手感。' },
    { min: 30, label: '30 分鐘', tag: '推薦', tip: '最符合單次黃金專注力：複習暖身 → 學新觀念 → 動手實作 → 整理回顧。' },
    { min: 45, label: '45 分鐘', tag: '進階', tip: '多練一個技能加上完整動手實作，每週 3 次進步最有感。' },
    { min: 60, label: '60 分鐘', tag: '週末特訓', tip: '適合週末或賽前集訓，含中途 3～5 分鐘喝水休息提醒。' },
  ];

  // 新技能先「學」再「練」：還沒通過小檢查、熟練度又低的技能，課表先排一個教學步驟
  const lrnDone = (state, id) => !!(state.lrn && state.lrn[id] && state.lrn[id].d);
  const needLearn = (state, id) => !!(window.VX_LESSONS && window.VX_LESSONS[id]) && !lrnDone(state, id) && pOf(state, id) < 0.45;
  function learnStep(sk, sid) {
    const L = window.VX_LESSONS[sk.id];
    return {
      id: sid(), kind: 'learn', icon: '📖', title: '先學觀念：' + sk.name, mins: Math.min(10, L.min || 8),
      why: '這是新的技能。先猜一猜、看懂、動手試，再通過小檢查，接下來的練習題就會順很多。',
      gain: [sk.id], go: ['#/skill/' + sk.id, '開始學習'],
      check: { type: 'learn', id: sk.id },
    };
  }

  function buildScheduleSteps(state, mins, opts) {
    opts = opts || {};
    const m = PLAN_PRESETS.some((p) => p.min === mins) ? mins : 30;
    const rec = recommendSkills(state, 4);
    const staleMastered = SKILLS.filter((s) => pOf(state, s.id) >= 0.8 && daysSince(state, s.id) > 7)
      .sort((a, b) => daysSince(state, b.id) - daysSince(state, a.id));
    const fallbackSkills = SKILLS.slice().sort((a, b) => pOf(state, a.id) - pOf(state, b.id) || daysSince(state, b.id) - daysSince(state, a.id));
    const chal = recommendChallenge(state);
    const realTest = needsRealTest(state);
    const lab = recommendBuildLab(state);
    const aToday = ((state.act || {})[todayStr()]) || {};
    const baseN = opts.basePracticed != null ? opts.basePracticed : 0;
    const steps = [];
    let seq = 1;
    const sid = () => 's' + (seq++);

    // 新技能要先學：短課表（15 分鐘）直接用「學＋練」取代暖身，才排得進時間
    const firstSk = rec[0] || fallbackSkills[0];
    const learnFirst = !!(firstSk && needLearn(state, firstSk.id));
    // 1. 暖身複習（優先挑超過 7 天沒練的已精通技能；否則自適應綜合暖身）
    if (m <= 15 && learnFirst) {
      // 15 分鐘：先學觀念 → 練 5 題，不另外暖身
    } else if (staleMastered.length && !opts.extra) {
      const stSk = staleMastered[0];
      const dAgo = Math.round(daysSince(state, stSk.id));
      steps.push({
        id: sid(), kind: 'warmup', icon: '🔥', title: '暖身複習：' + stSk.name, mins: 5,
        why: '這個技能已經 ' + dAgo + ' 天沒複習了，做 5 題保持記憶不生鏽。',
        gain: [stSk.id], go: ['#/practice/' + stSk.id + '/5', '開始複習（5 題）'],
        check: { type: 'skill', id: stSk.id },
      });
    } else {
      const qn = m >= 60 ? 8 : 5;
      steps.push({
        id: sid(), kind: 'warmup', icon: '✏️', title: '暖身練習：綜合題 ' + qn + ' 題', mins: m >= 60 ? 8 : 5,
        why: '網站會從你目前最適合的範圍出題，先喚醒手感。',
        gain: rec.slice(0, 2).map((x) => x.id),
        go: ['#/practice/all/' + qn, '開始暖身（' + qn + ' 題）'],
        check: { type: 'practiced', need: baseN + qn },
      });
    }

    // 2. 核心課題 A（最優先未精通技能：看重點課文＋5 題實戰）
    const s1 = rec[0] || fallbackSkills[0];
    if (s1 && needLearn(state, s1.id)) steps.push(learnStep(s1, sid));
    if (s1) {
      const p1 = Math.round(pOf(state, s1.id) * 100);
      steps.push({
        id: sid(), kind: 'skill', icon: '🎯', title: '核心學習：' + s1.name, mins: learnFirst ? 6 : 10,
        why: rec[0] ? rec[0].why : '你已經精通全部技能！複習一下維持 100% 實力。',
        gain: [s1.id], lesson: '#/skill/' + s1.id,
        go: ['#/practice/' + s1.id + '/5', '練習這個技能（5 題）'],
        subNote: '目前熟練度 ' + p1 + '%，建議先花 2 分鐘看重點課文再寫題目。',
        check: { type: 'skill', id: s1.id },
      });
    }

    // 3. 動手實作挑戰（30 分鐘以上加入）
    if (m >= 30) {
      if (realTest) {
        steps.push({
          id: sid(), kind: 'real', icon: '🤖', title: '真機驗證：' + realTest.title, mins: m >= 60 ? 12 : 10,
          why: '你已經在模擬器通過了，現在放到真的機器人上跑跑看，觀察實測誤差。',
          gain: realTest.skills || [], go: ['#/challenge/' + realTest.id, '打開挑戰頁'],
          check: { type: 'realCh', id: realTest.id },
        });
      } else if (chal && chal.ready) {
        steps.push({
          id: sid(), kind: 'challenge', icon: '🖥️', title: '動手寫程式：' + chal.c.title, mins: m >= 60 ? 12 : 10,
          why: chal.c.goal_t + '（把剛剛學的觀念實際跑在模擬器上！）',
          gain: chal.c.skills || [], go: ['#/sim/' + chal.c.id, '打開模擬器挑戰'],
          check: { type: 'simCh', id: chal.c.id },
        });
      } else if (chal && !chal.ready) {
        const needSk = SKILLS.find((x) => x.name === chal.need[0]);
        if (needSk) {
          steps.push({
            id: sid(), kind: 'skill', icon: '🧩', title: '前置補強：' + needSk.name, mins: 10,
            why: '要挑戰「' + chal.c.title + '」需要先會「' + chal.need.join('、') + '」，先把它打穩！',
            gain: [needSk.id], lesson: '#/skill/' + needSk.id,
            go: ['#/practice/' + needSk.id + '/5', '先練這個技能（5 題）'],
            check: { type: 'skill', id: needSk.id },
          });
        }
      } else if (lab) {
        steps.push({
          id: sid(), kind: 'build', icon: '🔧', title: '實體組裝：' + lab.title, mins: 10,
          why: '親手組裝機構並記錄量測結果，把課本原理變成真實手感。',
          gain: lab.skill ? [lab.skill] : [], go: ['#/build', '去實體組裝挑戰'],
          check: { type: 'buildLab', id: lab.id },
        });
      } else {
        steps.push({
          id: sid(), kind: 'arena', icon: '🏟️', title: '3D 場地實戰與算分', mins: 10,
          why: '在 3D Level Up 練習場練習 60 秒節奏或做幾題 3D 算分挑戰。',
          gain: ['F1', 'F2'], go: ['#/arena3d', '打開 3D 練習場'],
          check: { type: 'manual' },
        });
      }
    }

    // 4. 第二個核心技能（45 分鐘以上加入）
    if (m >= 45) {
      const s2 = rec.find((x) => !s1 || x.id !== s1.id) || fallbackSkills.find((x) => !s1 || x.id !== s1.id);
      if (s2 && needLearn(state, s2.id)) steps.push(learnStep(s2, sid));
      if (s2) {
        const p2 = Math.round(pOf(state, s2.id) * 100);
        steps.push({
          id: sid(), kind: 'skill', icon: '🚀', title: '進階練習：' + s2.name, mins: 10,
          why: s2.why || '趁專注力正好，再推進一個新技能（目前 ' + p2 + '%）。',
          gain: [s2.id], lesson: '#/skill/' + s2.id,
          go: ['#/practice/' + s2.id + '/5', '練習這個技能（5 題）'],
          breakBefore: m >= 60,
          check: { type: 'skill', id: s2.id },
        });
      }
    }

    // 5. 專題實作（60 分鐘特訓加入：控制實驗室 / 實體組裝 / 3D 場地）
    if (m >= 60) {
      const stg = currentStage(state);
      const hasAdv = ['E5', 'E6', 'E7'].some((id) => SKID[id] && unlocked(state, id));
      if (stg.id === 'comp' || hasAdv) {
        steps.push({
          id: sid(), kind: 'control', icon: '🎛️', title: '控制實驗室：動手調參實驗', mins: 10,
          why: '用互動圖表實際調整 PID、里程計或方向鎖定，親眼看機器人路線怎麼變！',
          gain: ['E5', 'E6', 'E7'].filter((id) => SKID[id]),
          go: ['#/control', '打開控制實驗室'],
          check: { type: 'manual' },
        });
      } else if (lab) {
        steps.push({
          id: sid(), kind: 'build', icon: '🔧', title: '實體組裝：' + lab.title, mins: 10,
          why: '換個方式動手做機構實驗，休息一下眼睛也能加深印象。',
          gain: lab.skill ? [lab.skill] : [], go: ['#/build', '去實體組裝挑戰'],
          check: { type: 'buildLab', id: lab.id },
        });
      } else {
        steps.push({
          id: sid(), kind: 'arena', icon: '🏟️', title: '3D 場地算分挑戰', mins: 10,
          why: '練習從不同視角快速判斷球門與沙包得分，為比賽暖身。',
          gain: ['F1', 'F2'], go: ['#/arena3d', '打開 3D 練習場'],
          check: { type: 'manual' },
        });
      }
    }

    // 6. 整理輸出／比賽準備（30 分鐘以上加入）
    if (m >= 30) {
      if (!aToday.note) {
        steps.push({
          id: sid(), kind: 'note', icon: '📓', title: '整理收尾：寫一頁工程筆記', mins: m >= 60 ? 10 : 5,
          why: '把今天學到的觀念、寫的程式或卡關原因記下來，比賽評審最重視這個！',
          gain: [], gainText: '工程筆記與問題分析',
          go: ['#/notebook', '去寫工程筆記'],
          check: { type: 'note' },
        });
      } else {
        steps.push({
          id: sid(), kind: 'compete', icon: '🏆', title: '比賽暖身：計分與英文術語', mins: m >= 60 ? 10 : 5,
          why: '今天已經寫過筆記了！來練幾張比賽英文術語卡或 Level Up 算分。',
          gain: ['F1', 'F3'], go: ['#/compete', '打開比賽專區'],
          check: { type: 'manual' },
        });
      }
    }

    return steps;
  }

  function getDailyPlan(state, forceMin, forceNew, extra) {
    const today = todayStr();
    const cur = state.dailyPlan;
    const wantMin = forceMin || state.planMin || (cur && cur.min) || 30;
    if (!forceNew && cur && cur.date === today && Array.isArray(cur.steps) && cur.steps.length && (!forceMin || cur.min === forceMin)) {
      return cur;
    }
    const practiced = (state.days && state.days[today]) || 0;
    const round = extra && cur && cur.date === today ? (cur.round || 1) + 1 : 1;
    const steps = buildScheduleSteps(state, wantMin, { basePracticed: extra ? practiced : 0, extra: !!extra });
    const plan = { date: today, min: wantMin, round, done: {}, skip: {}, steps };
    state.planMin = wantMin;
    state.dailyPlan = plan;
    return plan;
  }

  function isStepDone(state, step, plan) {
    if (plan && plan.done && plan.done[step.id]) return true;
    const a = ((state.act || {})[todayStr()]) || {};
    const practiced = (state.days && state.days[todayStr()]) || 0;
    const c = step.check || {};
    if (c.type === 'practiced') return practiced >= (c.need || 5);
    if (c.type === 'skill') return !!(a.skills && a.skills.includes(c.id));
    if (c.type === 'simCh') return !!(state.ch && state.ch[c.id] && (state.ch[c.id].sim || state.ch[c.id].done)) || !!a.simok;
    if (c.type === 'realCh') return !!(state.ch && state.ch[c.id] && state.ch[c.id].done) || !!a.challenge;
    if (c.type === 'buildLab') return !!(state.buildLabs && state.buildLabs[c.id] && state.buildLabs[c.id].done);
    if (c.type === 'learn') return lrnDone(state, c.id);
    if (c.type === 'note') return !!a.note;
    return false;
  }

  function summarizePlan(state, plan) {
    const steps = plan.steps || [];
    const items = steps.map((s) => {
      const done = isStepDone(state, s, plan);
      const skipped = !done && !!(plan.skip && plan.skip[s.id]);
      return Object.assign({}, s, { done, skipped });
    });
    const doneN = items.filter((x) => x.done || x.skipped).length;
    const totalMin = items.reduce((sum, x) => sum + (x.mins || 0), 0);
    const remainMin = items.filter((x) => !x.done && !x.skipped).reduce((sum, x) => sum + (x.mins || 0), 0);
    const nextIdx = items.findIndex((x) => !x.done && !x.skipped);
    const gainIds = [];
    const gainExtras = [];
    items.forEach((x) => {
      (x.gain || []).forEach((id) => { if (SKID[id] && !gainIds.includes(id)) gainIds.push(id); });
      if (x.gainText && !gainExtras.includes(x.gainText)) gainExtras.push(x.gainText);
    });
    return {
      plan, items, doneN, totalN: items.length,
      allDone: items.length > 0 && doneN >= items.length,
      totalMin, remainMin,
      nextIdx, nextStep: nextIdx >= 0 ? items[nextIdx] : null,
      gainSkills: gainIds.map((id) => SKID[id]),
      gainExtras,
    };
  }

  /* ---------- 今天的任務（向下相容舊介面） ---------- */
  function todayPlan(state) {
    const plan = getDailyPlan(state);
    const sum = summarizePlan(state, plan);
    const tasks = sum.items.map((x) => ({
      id: x.id, icon: x.icon, t: x.title, time: T('約 {n} 分鐘', { n: x.mins }),
      detail: x.why, done: x.done || x.skipped, go: x.go,
    }));
    return { tasks, doneN: sum.doneN, summary: sum };
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
    { id: 'grit', icon: '🐛', name: '抓蟲偵探', desc: '同一關試錯 3 次以上最後模擬通過', test: (st) => Object.entries(st.ch || {}).some(([id, r]) => r.sim && (r.fails || 0) >= 3 && CHALLENGES.some((c) => c.id === id)) },
    { id: 'apply', icon: '💡', name: '現學現賣', desc: '看完提示／小抄後完成類似題練習', test: (st) => !!(st.flags && st.flags.drillOk) },
    { id: 'star3', icon: '🏆', name: '三星工程師', desc: '任一挑戰拿到 3 顆星（精簡又精準）', test: (st) => Object.entries(st.ch || {}).some(([id, r]) => (r.stars || 0) >= 3 && CHALLENGES.some((c) => c.id === id)) },
    { id: 'maker', icon: '🎨', name: '關卡設計師', desc: '設計第一個自己的自訂關卡', test: (st) => Array.isArray(st.customCh) && st.customCh.length >= 1 },
  ];
  VX.badges = {
    list: BADGES, streak: streakOf,
    // 檢查有沒有新徽章；有的話記錄時間，並（非 silent 時）跳出提示
    check(silent) {
      const st = VX.st; if (!st || !VX.user || VX.user.role !== 'learner') return [];
      st.badges = st.badges || {}; const fresh = [];
      BADGES.forEach((b) => { if (!st.badges[b.id] && b.test(st)) { st.badges[b.id] = Date.now(); fresh.push(b); } });
      if (fresh.length && !silent) fresh.forEach((b, i) => setTimeout(() => VX.toast('🏅 獲得徽章：' + b.icon + ' ' + b.name), i * 1600));
      if (fresh.length && !silent && window.VXFX) setTimeout(() => window.VXFX.confetti(), 200);
      if (fresh.length) VX.saveState();
      return fresh;
    },
  };

  /* ---------- 小元件 ---------- */
  const bar = (p, c) => h('div', { class: 'mbar' }, h('div', { style: 'width:' + Math.round(p * 100) + '%' + (c ? ';background:' + c : '') }));
  const goBtn = (g, cls) => (g[2] ? h('a', { class: cls || 'btn primary', href: g[0], target: '_blank', rel: 'noopener noreferrer' }, g[1] + ' ↗') : h('a', { class: cls || 'btn primary', href: g[0] }, g[1]));

  /* ---------- 首頁卡片 ---------- */
  VX.guide = {};
  VX.guide.planPresets = PLAN_PRESETS;
  VX.guide.buildSchedule = buildScheduleSteps;
  VX.guide.getDailyPlan = getDailyPlan;
  VX.guide.summarizePlan = summarizePlan;
  VX.guide.plan = (state) => ({ stage: currentStage(state), start: startProgress(state), today: todayPlan(state), skills: recommendSkills(state, 3), challenge: recommendChallenge(state) });

  function skillGainChips(sum, st) {
    const DOM = VX.DOM || {};
    const chips = sum.gainSkills.map((sk) => {
      const dm = DOM[sk.d] || {};
      const pct = Math.round(pOf(st, sk.id) * 100);
      return h('a', {
        class: 'plan-chip',
        href: '#/skill/' + sk.id,
        style: dm.color ? 'background:' + dm.color + ';border-color:' + dm.stroke : null,
      }, sk.name + '（' + pct + '%）');
    });
    sum.gainExtras.forEach((txt) => chips.push(h('span', { class: 'plan-chip extra' }, '✨ ' + txt)));
    return chips;
  }

  /* ---------- 今日學習課表專頁（#/plan）---------- */
  function viewPlan() {
    const st = VX.st, user = VX.user;
    if (!st || !user) { location.hash = '#/login'; return; }
    if (!st.done) {
      VX.app.replaceChildren(VX.shell(h('div', { class: 'panel center' },
        h('div', { class: 'big' }, '🧭'),
        h('h2', null, '先做定位測驗，才能為你量身排課！'),
        h('p', { class: 'sub' }, '大約 10 分鐘。系統知道你已經學會哪些技能後，每次登入都會自動幫你排好專屬的今日學習課表。'),
        h('a', { class: 'btn primary big', href: '#/placement' }, '開始定位測驗 ▶')
      ), { title: '今日課表', icon: '📅' }));
      return;
    }

    const plan = getDailyPlan(st);
    const sum = summarizePlan(st, plan);
    const preset = PLAN_PRESETS.find((x) => x.min === plan.min) || PLAN_PRESETS[1];
    const masteredN = nMastered(st);
    const stage = currentStage(st);

    const setMins = (mins) => {
      getDailyPlan(st, mins, true, false);
      VX.saveState();
      viewPlan();
    };
    const markStep = (stepId, val) => {
      plan.done = plan.done || {};
      if (val) { plan.done[stepId] = true; if (plan.skip) delete plan.skip[stepId]; }
      else delete plan.done[stepId];
      VX.saveState();
      const after = summarizePlan(st, plan);
      if (val && after.allDone && window.VXFX) setTimeout(() => window.VXFX.confetti(), 200);
      viewPlan();
    };
    const skipStep = (stepId, val) => {
      plan.skip = plan.skip || {};
      if (val) plan.skip[stepId] = true; else delete plan.skip[stepId];
      VX.saveState();
      viewPlan();
    };
    const addBonusRound = () => {
      getDailyPlan(st, 15, true, true);
      VX.saveState();
      VX.toast('✨ 已為你安排加碼 15 分鐘課表！');
      viewPlan();
    };

    // 1. 時間選擇器
    const durBtns = PLAN_PRESETS.map((pr) => h('button', {
      type: 'button',
      class: 'plan-dur' + (pr.min === plan.min ? ' on' : ''),
      onclick: () => { if (pr.min !== plan.min) setMins(pr.min); },
    }, h('b', null, pr.label), h('span', { class: 'plan-dtag' }, pr.tag)));

    const timeCard = h('div', { class: 'panel plan-time' },
      h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap' },
        h('div', null,
          h('h2', { style: 'margin:0' }, '📅 ' + (user.display || user.name) + ' 的今日學習課表',
            plan.round > 1 ? h('span', { class: 'tag', style: 'margin-left:8px;background:#e0f2fe;color:#0369a1' }, '加碼第 ' + plan.round + ' 輪') : null,
            streakOf(st) ? h('span', { class: 'tag', style: 'margin-left:8px;background:#ffe9d6;color:#c2410c' }, '🔥 連續 ' + streakOf(st) + ' 天') : null),
          h('div', { class: 'sub', style: 'margin-top:4px' }, '今天想花多少時間學習？點一下就能即時調整課表：')),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { getDailyPlan(st, plan.min, true, false); VX.saveState(); VX.toast('已依最新進度重新排課'); viewPlan(); } }, '🔄 重新排課')),
      h('div', { class: 'plan-durs' }, durBtns),
      h('div', { class: 'sub', style: 'margin-top:6px' }, '💡 ', preset.tip));

    // 2. 今日總表與說明（時間、學習內容、可獲得技能）
    const overview = h('div', { class: 'panel plan-overview' },
      h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;gap:8px' },
        h('h3', { style: 'margin:0' }, '📋 今日課表總覽'),
        h('div', { class: 'big2' }, sum.doneN + ' / ' + sum.totalN + ' 站')),
      bar(sum.totalN ? sum.doneN / sum.totalN : 0),
      h('div', { class: 'plan-meta-grid' },
        h('div', { class: 'plan-meta-box' },
          h('small', null, '⏱️ 預計學習時間'),
          h('b', null, T('約 {n} 分鐘', { n: sum.totalMin })),
          h('div', { class: 'sub' }, sum.allDone ? '今天排定的進度已完成！' : T('剩餘約 {n} 分鐘', { n: sum.remainMin }))),
        h('div', { class: 'plan-meta-box' },
          h('small', null, '🧭 目前程度依據'),
          h('b', null, '已精通 ' + masteredN + ' / ' + SKILLS.length + ' 技能'),
          h('div', { class: 'sub' }, T(stage.name).split(/[：:]/)[0] + T('・自動避開已熟練內容'))),
        h('div', { class: 'plan-meta-box' },
          h('small', null, '📚 今日學習內容'),
          h('b', null, sum.items.map((x) => x.icon).join(' ') + ' ' + T('共 {n} 個步驟', { n: sum.totalN })),
          h('div', { class: 'sub' }, '照順序一步一步完成，不用自己煩惱順序'))),
      h('div', { class: 'plan-gains' },
        h('div', { class: 'sub', style: 'margin-bottom:6px;font-weight:700' }, '🏆 完成今日課表可以獲得／提升的技能：'),
        h('div', { class: 'plan-chips' }, skillGainChips(sum, st))));

    // 3. 焦點步驟（進行中）或 完成慶祝卡
    let focusBox;
    if (sum.allDone) {
      focusBox = h('div', { class: 'panel plan-donebox center' },
        h('div', { class: 'big' }, '🎉'),
        h('h2', { style: 'margin:6px 0' }, '太棒了！今天的學習課表全部完成！'),
        h('p', { class: 'sub' }, T('你完成了 {a} 個學習步驟（約 {b} 分鐘）。可以先休息一下，如果還想多練，下面隨時可以繼續！', { a: sum.totalN, b: sum.totalMin })),
        h('div', { class: 'row gap', style: 'justify-content:center;flex-wrap:wrap;margin-top:12px' },
          h('button', { type: 'button', class: 'btn primary', onclick: addBonusRound }, '➕ 再加練 15 分鐘'),
          h('a', { class: 'btn', href: '#/practice' }, '✏️ 自由練習題'),
          h('a', { class: 'btn', href: '#/sim' }, '🖥️ 模擬器自由玩'),
          h('a', { class: 'btn', href: '#/arena3d' }, '🏟️ 3D 練習場'),
          h('a', { class: 'btn ghost', href: '#/' }, '🏠 回首頁')));
    } else {
      const nx = sum.nextStep;
      const stepNo = sum.nextIdx + 1;
      focusBox = h('div', { class: 'panel plan-focus' },
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;gap:8px' },
          h('span', { class: 'tag', style: 'background:var(--accent);color:#fff' }, '👉 現在進行：第 ' + stepNo + ' / ' + sum.totalN + ' 站'),
          h('span', { class: 'tag' }, T('⏱️ 約 {n} 分鐘', { n: nx.mins }))),
        h('h2', { style: 'margin:8px 0 4px' }, nx.icon + ' ' + nx.title),
        h('p', { style: 'margin:4px 0 8px' }, nx.why),
        nx.subNote ? h('div', { class: 'sub', style: 'margin-bottom:8px' }, '💡 ' + nx.subNote) : null,
        h('div', { class: 'row gap', style: 'flex-wrap:wrap;margin-top:10px' },
          goBtn(nx.go, 'btn primary'),
          nx.lesson ? h('a', { class: 'btn', href: nx.lesson }, '📖 先看重點課文') : null,
          h('button', { type: 'button', class: 'btn green', onclick: () => markStep(nx.id, true) }, '✔ 我完成了，換下一步'),
          h('button', { type: 'button', class: 'btn ghost sm', onclick: () => skipStep(nx.id, true) }, '先略過這站')));
    }

    // 4. 完整步驟流程表
    const stepNodes = [];
    sum.items.forEach((it, idx) => {
      if (it.breakBefore) {
        stepNodes.push(h('div', { class: 'plan-break' }, '☕ 中途休息提醒：已經完成前半段了！站起來喝口水、看遠方 3～5 分鐘再繼續後半段。'));
      }
      const isCur = idx === sum.nextIdx;
      const stCls = it.done ? 'done' : it.skipped ? 'skip' : isCur ? 'cur' : 'todo';
      const stBadge = it.done
        ? h('span', { class: 'tag done' }, '已完成')
        : it.skipped
          ? h('span', { class: 'tag' }, '已略過')
          : isCur
            ? h('span', { class: 'tag', style: 'background:var(--accent);color:#fff' }, '進行中')
            : h('span', { class: 'tag' }, '待進行');
      stepNodes.push(h('div', { class: 'plan-step ' + stCls },
        h('div', { class: 'plan-num' }, it.done ? '✅' : it.skipped ? '⏭' : String(idx + 1)),
        h('div', { class: 'plan-body' },
          h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap' },
            h('b', null, it.icon + ' ' + it.title),
            h('div', { class: 'row', style: 'gap:6px;margin:0' }, h('span', { class: 'tag' }, T('約 {n} 分鐘', { n: it.mins })), stBadge)),
          h('div', { class: 'sub', style: 'margin:4px 0 6px' }, it.why),
          h('div', { class: 'row gap', style: 'margin:4px 0 0;flex-wrap:wrap' },
            !it.done && !it.skipped ? goBtn(it.go, 'btn ' + (isCur ? 'primary ' : '') + 'sm') : null,
            !it.done && !it.skipped && it.lesson ? h('a', { class: 'btn sm', href: it.lesson }, '📖 看課文') : null,
            !it.done && !it.skipped ? h('button', { type: 'button', class: 'btn ghost sm', onclick: () => markStep(it.id, true) }, '✔ 標記完成') : null,
            it.done && plan.done && plan.done[it.id] ? h('button', { type: 'button', class: 'btn ghost sm', onclick: () => markStep(it.id, false) }, '取消完成') : null,
            it.skipped ? h('button', { type: 'button', class: 'btn ghost sm', onclick: () => skipStep(it.id, false) }, '恢復這站') : null))));
    });

    const listCard = h('div', { class: 'panel' },
      h('h3', { style: 'margin-top:0' }, '🗺️ 一步一步學習流程'),
      h('div', { class: 'plan-steps' }, stepNodes));

    VX.app.replaceChildren(VX.shell(h('div', { class: 'plan-page' }, timeCard, overview, focusBox, listCard), { title: '今日學習課表', icon: '📅' }));
  }

  /* ---------- 跨頁浮動課表導引條（讓孩子照流程走不迷路）---------- */
  VX.guide.planBar = function (curRoute) {
    const st = VX.st, user = VX.user;
    if (!st || !user || user.role !== 'learner' || !st.done) return null;
    if (!curRoute || curRoute === 'plan' || curRoute === 'login' || curRoute === 'placement' || curRoute === 'about' || curRoute === 'me') return null;
    let hidden = false;
    try { hidden = sessionStorage.getItem('vx_planbar_hide') === todayStr(); } catch (e) { /* ignore */ }
    if (hidden) return null;
    const plan = getDailyPlan(st);
    const sum = summarizePlan(st, plan);
    if (sum.allDone) return null;
    const nx = sum.nextStep;
    const stepNo = sum.nextIdx + 1;
    const barEl = h('div', { class: 'planbar' },
      h('div', { class: 'planbar-txt' },
        h('b', null, '📅 今日課表 第 ' + stepNo + '/' + sum.totalN + ' 站：'),
        h('span', null, nx.icon + ' ' + nx.title + T('（約 {n} 分鐘）', { n: nx.mins }))),
      h('div', { class: 'planbar-act' },
        h('button', { type: 'button', class: 'btn green sm', onclick: () => {
          plan.done = plan.done || {}; plan.done[nx.id] = true; VX.saveState();
          const after = summarizePlan(st, plan);
          if (after.allDone) { VX.toast('🎉 今日課表全部完成！'); location.hash = '#/plan'; }
          else { VX.toast('✅ 完成第 ' + stepNo + ' 站！前往下一站'); location.hash = '#/plan'; }
        } }, '✔ 完成這站'),
        h('a', { class: 'btn sm', href: '#/plan' }, '回課表總表'),
        h('button', { type: 'button', class: 'pwx', title: '今天先隱藏導引條', onclick: () => { try { sessionStorage.setItem('vx_planbar_hide', todayStr()); } catch (e) { /* ignore */ } barEl.remove(); } }, '✕')));
    return barEl;
  };

  VX.guide.homeCard = function () {
    const st = VX.st, user = VX.user;
    const wrap = h('div');
    if (!st.done) {
      wrap.append(h('div', { class: 'hero start' }, h('div', null, h('h2', null, '歡迎，' + (user.display || user.name) + '！先從這裡開始'), h('p', null, '第一步：定位測驗（約 10 分鐘）。網站會知道你現在會到哪裡，再幫你安排適合的題目。不會的可以直接說「我還不會」，不會被扣分。')), h('a', { class: 'btn primary big', href: '#/placement' }, '開始定位測驗 ▶')),
        h('div', { class: 'panel' }, h('b', null, '還不確定怎麼用？'), h('p', { class: 'sub' }, '先看「起步任務」：一共 7 個小步驟，每一步都告訴你做什麼、為什麼、怎麼做。'), h('a', { class: 'btn', href: '#/start' }, '看起步任務'), ' ', h('a', { class: 'btn', href: '#/guide' }, '網站怎麼用')));
      return wrap;
    }
    const p = VX.guide.plan(st), t = p.today, sum = t.summary;
    // 今日自動學習課表摘要卡
    wrap.append(h('div', { class: 'panel todaycard' },
      h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap' },
        h('div', null,
          h('h2', { style: 'margin:0' }, T('📅 今日學習課表（約 {n} 分鐘）', { n: sum.totalMin }), streakOf(st) ? h('span', { class: 'tag', style: 'margin-left:8px;background:#ffe9d6;color:#c2410c' }, '🔥 連續 ' + streakOf(st) + ' 天') : null),
          h('div', { class: 'sub' }, '嗨，' + (user.display || user.name) + '！系統已依你的進度自動排好今日步驟，也能自由切換 15／30／45／60 分鐘。')),
        h('div', { class: 'big2' }, t.doneN + ' / ' + t.tasks.length)),
      bar(sum.totalN ? sum.doneN / sum.totalN : 0),
      sum.gainSkills.length ? h('div', { class: 'plan-chips', style: 'margin:8px 0' }, skillGainChips(sum, st)) : null,
      t.tasks.map((k, i) => h('div', { class: 'task' + (k.done ? ' done' : '') }, h('div', { class: 'tn' }, k.done ? '✅' : k.icon), h('div', { class: 'tb' }, h('b', null, (i + 1) + '. ' + k.t), h('span', { class: 'tag' }, k.time), h('div', { class: 'sub', style: 'margin:2px 0 6px' }, k.detail)), h('div', null, k.done ? h('span', { class: 'tag done' }, '今天完成了') : goBtn(k.go, 'btn primary sm')))),
      h('div', { class: 'row gap', style: 'margin-top:10px;flex-wrap:wrap' },
        h('a', { class: 'btn primary', href: '#/plan' }, sum.allDone ? '🎉 看今日成果／加練 15 分鐘' : '📅 開啟課表一步步學習 ▶'),
        h('span', { class: 'sub', style: 'align-self:center' }, sum.allDone ? '今天的課表都完成了！想多練隨時可以加碼。' : '想換 15／30／45／60 分鐘課表，點左邊就能調整。'))));
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

  /* ---------- 新手導覽（第一次進首頁）：4 張可左右翻的小卡 ---------- */
  VX.guide.maybeTour = function () {
    const st = VX.st; if (!st || st.tour || VX.user.role !== 'learner') return;
    const slides = [
      { ic: '🤖', t: '歡迎來到 VEX IQ 自學！', d: '這個網站會陪你一步一步學機器人。只要記得三件事，我們馬上開始！' },
      { ic: '🧭', t: '① 先做定位測驗', d: '約 10 分鐘。網站會知道你現在會到哪裡，再幫你挑適合的題目。不會的按「我還不會」就好。' },
      { ic: '📅', t: '② 每次來先看「今天要做的事」', d: '在首頁最上面，大約 20 分鐘，照順序做。沒時間？做「今日 1 分鐘小謎題」也算有練習！' },
      { ic: '💡', t: '卡住了？網站會幫你', d: '答錯先給提示再試一次；模擬器裡拖曳時間軸，看每一步發光的積木，教練也會一步一步幫你。' },
      { ic: '🏁', t: '③ 用真的機器人試試看', d: '在模擬器練熟後放到機器人上測，再把發現寫進工程筆記。過關還能拿 ⭐ 和徽章！' },
    ];
    let i = 0;
    const finish = (go) => { st.tour = true; VX.saveState(); ov.classList.add('closing'); setTimeout(() => ov.remove(), 250); if (go) location.hash = go; };
    const box = h('div', { class: 'tourbox', role: 'dialog', 'aria-modal': 'true' });
    const ov = h('div', { class: 'tourov' }, box);
    const draw = () => {
      const sl = slides[i], last = i === slides.length - 1;
      box.replaceChildren(
        h('div', { class: 'tourslide' }, h('div', { class: 'tourem' }, sl.ic), h('h2', null, sl.t), h('p', { class: 'sub' }, sl.d)),
        h('div', { class: 'tourdots' }, slides.map((_, k) => h('button', { type: 'button', class: k === i ? 'on' : '', 'aria-label': (k + 1) + ' / ' + slides.length, onclick: () => { i = k; draw(); } }))),
        h('div', { class: 'row gap', style: 'justify-content:space-between' },
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => finish() }, '跳過'),
          h('div', { class: 'row gap', style: 'margin:0' },
            i ? h('button', { class: 'btn sm', type: 'button', onclick: () => { i--; draw(); } }, '‹ 上一步') : null,
            last ? h('button', { class: 'btn primary', type: 'button', onclick: () => finish(st.done ? '' : '#/placement') }, st.done ? '知道了，開始吧' : '開始定位測驗 ▶')
              : h('button', { class: 'btn primary', type: 'button', onclick: () => { i++; draw(); } }, '下一步 ›'))));
      const nb = box.querySelector('.btn.primary'); if (nb) nb.focus();
    };
    ov.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' && i < slides.length - 1) { i++; draw(); } else if (e.key === 'ArrowLeft' && i > 0) { i--; draw(); } else if (e.key === 'Escape') finish(); });
    draw(); document.body.append(ov);
  };

  /* ---------- 起步任務頁 ---------- */
  function viewStart() {
    const st = VX.st, isLearner = VX.user && VX.user.role === 'learner', pr = startProgress(st);
    const mark = (k, v) => { st.start = st.start || {}; st.start[k] = v; VX.saveState(); viewStart(); };
    VX.app.replaceChildren(VX.shell(h('div', null,
      isLearner
        ? h('p', { class: 'sub' }, '第一次用的話，照這 7 步做就會了。不用一次做完，一次做一步就好。沒有機器人的步驟可以先略過，用模擬器練習。')
        : h('div', { class: 'callout' }, '👀 家長檢視（預覽）：這是孩子看到的 7 個起步步驟，方便你陪他一步一步做。實際進度請到「家長頁」查看。'),
      isLearner ? h('div', { class: 'panel' }, h('b', null, '進度 ' + pr.done + ' / ' + pr.total), bar(pr.done / pr.total)) : null,
      START.map((s, i) => {
        const state = isLearner ? stepState(st, s) : 'todo', isNext = isLearner && pr.next === s;
        return h('div', { class: 'panel step ' + state + (isNext ? ' next' : '') },
          h('div', { class: 'row', style: 'justify-content:space-between;gap:8px;align-items:flex-start' },
            h('h3', { style: 'margin:0' }, (state === 'done' ? '✅ ' : state === 'skipped' ? '⏭ ' : isNext ? '👉 ' : '') + '步驟 ' + (i + 1) + '：' + s.t), h('span', { class: 'tag' }, s.time)),
          h('p', { class: 'sub' }, h('b', null, '為什麼：'), s.why),
          h('ol', null, s.how.map((x) => h('li', null, x))),
          isLearner ? h('div', { class: 'row gap' }, goBtn(s.go, 'btn ' + (isNext ? 'primary' : '') + ' sm'),
            s.manual && state !== 'done' ? h('button', { class: 'btn green sm', onclick: () => mark(s.manual, true) }, '✔ 我做完了') : null,
            s.skippable && state === 'todo' ? h('button', { class: 'btn ghost sm', onclick: () => mark(s.id + '_skip', true) }, '先略過') : null,
            state === 'skipped' ? h('button', { class: 'btn ghost sm', onclick: () => mark(s.id + '_skip', false) }, '取消略過') : null,
            state === 'done' && s.manual ? h('button', { class: 'btn ghost sm', onclick: () => mark(s.manual, false) }, '取消完成') : null)
            : (s.go[2] ? h('div', { class: 'row gap' }, goBtn(s.go, 'btn sm')) : null));
      }),
      isLearner && pr.done === pr.total ? h('div', { class: 'callout' }, '🎉 起步任務全部完成！之後每天看首頁的「今天要做的事」就好。') : null), { title: '起步任務', icon: '🚀' }));
  }

  /* ---------- 網站怎麼用（分頁、孩子版／家長版）---------- */
  const Q = (q, a) => h('details', null, h('summary', null, q), h('div', { class: 'body' }, a));
  const P = (...k) => h('p', null, ...k);
  const STEPS = (arr) => h('ol', { class: 'gd-steps' }, arr.map((x) => h('li', null, x)));
  const TIP = (...k) => h('div', { class: 'gd-tip' }, ...k);
  const CARDS = (arr, linked) => h('div', { class: 'gd-feat' }, arr.map(([ic, t, d, href, go]) => h('div', { class: 'gd-card' }, h('div', { class: 'gi' }, ic), h('h4', null, t), h('p', null, d), linked && href ? h('a', { class: 'btn sm', href }, go) : null)));

  const GUIDE_KID = [
    { id: 'quick', icon: '🚀', t: '快速開始', body: () => [
      P('第一次來？只要記得三件事：'),
      STEPS([[h('b', null, '先做定位測驗'), '（約 10 分鐘）。不會的就按「我還不會」，不會被扣分，沒關係！'],
        [h('b', null, '每次來，先看首頁的「今天要做的事」'), '：照順序做，大約 20 分鐘就夠。'],
        [h('b', null, '用真的機器人試試看，再寫進筆記'), '：在模擬器練熟後放到機器人上測，工程筆記是比賽評審最看重的。']]),
      TIP('💡 每週練 3～4 次、每次 20 分鐘，比一次練很久有效。只有 10 分鐘？只做「今天要做的事」第 1 項就好。'),
      h('div', { class: 'row gap' }, h('a', { class: 'btn primary', href: '#/start' }, '🚀 看起步任務（7 步）'), h('a', { class: 'btn', href: '#/' }, '回首頁')),
    ] },
    { id: 'pages', icon: '🧭', t: '每個功能', body: () => [
      P('上面（手機在下面）的分頁列可以到每個地方：'),
      CARDS([
        ['✏️', '練習', '依你的程度出題。答錯先給提示再試一次；連錯會有 30 秒重點小抄；回合結束還能「專練類似題」。', '#/practice', '開始練習'],
        ['⚡', '今日 1 分鐘小謎題', '首頁每天換 1 題輕鬆暖身，答完就算今天有練習，連續天數不中斷。', '#/', '回首頁'],
        ['🏁', '挑戰', '一個個機器人任務。提示一步一步看，過關拿 ⭐：積木精簡、終點準，可以拿到 3 顆星。', '#/challenge', '看挑戰'],
        ['🐛', '除錯偵探', '給你一段藏著 bug 的程式，用發光的積木和時間軸抓出兇手、修好它。', '#/challenge', '去抓蟲'],
        ['🖥️', '模擬器', '不用機器人也能試程式。可以拖曳時間軸看每一步，失敗時教練會幫你診斷。', '#/sim', '打開模擬器'],
        ['🎨', '自訂關卡', '在模擬器自由練習裡放牆壁和旗子，設計自己的關卡，出題考爸媽或隊友。', '#/sim', '去設計'],
        ['📤', '上傳存檔', '把 VEXcode 存的 .iqblocks 交給網站檢查，不對會一步一步教你改。', '#/import', '上傳存檔'],
        ['📓', '筆記', '工程筆記有教學、檢查清單，還能整理成可以列印的作品集。', '#/notebook', '寫筆記'],
        ['🔧', '組裝', '機構原理與零件圖鑑，每一課有動手做小實驗。', '#/build', '看組裝'],
        ['🏆', '比賽', '當季規則整理、得分規劃器、技能賽記錄、英中術語卡、面談練習。', '#/compete', '比賽專區'],
        ['📋', '速查表', '積木怎麼用，VEXcode 英文原版字樣一看就懂。', '#/cheat', '看速查表'],
        ['🏅', '徽章與連續天數', '做到特定的事就拿徽章；每天練習，連續天數會越來越長。', '#/', '看我的徽章'],
      ], true),
    ] },
    { id: 'stuck', icon: '🆘', t: '卡住了怎麼辦', body: () => [
      P('卡關是學習的一部分！網站會一步一步幫你，不會直接把答案丟給你。'),
      h('h3', null, '練習題卡住'),
      STEPS(['按「💡 給我一點提示」：會劃掉一個錯的選項，並顯示這個技能的重點。', '答錯一次不會馬上公布答案，你可以再試一次。', '同一個技能連錯 2 題，會跳出「🧭 30 秒重點小抄」，再出一題簡單的暖身題。', '回合結束按「🎯 專練類似題」，確認自己真的會了。']),
      h('h3', null, '模擬器／挑戰卡住'),
      STEPS(['按 RUN 之後，拖曳上面的時間軸：每一步對應的積木會亮起來，看看哪一步開始不對。', '失敗結果下面有白話診斷（撞牆？走反了？停不下來？）。', '連續失敗 2 次，「🧭 教練小幫手」出現，可以一個一個打開提示。', '第 3 次可以顯示參考路線；第 4 次才可以載入參考解答（用了參考解答只能拿 1 星）。', '距離旗子比上次近，會出現「🔥 新紀錄」，代表你在進步！']),
      TIP('🐛 除錯偵探：不用從零開始。先 RUN 看發光的積木，找出哪一塊怪怪的，只改那一塊就好。'),
      P('還是不懂？記下來，問補習班老師或爸媽。把問題寫進工程筆記也很棒。'),
    ] },
    { id: 'sim', icon: '🖥️', t: '模擬器', body: () => [
      STEPS(['從左邊的積木庫把積木「拖」或「點」到「when started」下面。', '改數字，按上面的 RUN；也可以用 ▶／⏸ 暫停，用時間軸拉到任何一步。', '手指或滑鼠停在積木上 1 秒，會跳出說明。', '成功了，記得拿同一個程式去真的機器人上測一次，再把差距寫進筆記。']),
      TIP('📱 手機畫面小，模擬器建議用 iPad 或電腦；iPad 橫放最好用。'),
      h('h3', null, '設計自己的關卡'),
      STEPS(['進模擬器，場地選「自由練習／設計關卡」。', '按「🎨 設計自己的關卡」，用 🧱 牆壁、🚩 旗子、🟥 紅區 點格子擺放。', '按「💾 存成關卡出題」取名字，就會出現在挑戰頁的「我的自訂關卡」。']),
    ] },
    { id: 'tips', icon: '📱', t: 'iPad／手機小技巧', body: () => [
      STEPS(['用 Safari 打開網站，按「分享」→「加入主畫面」，下次像 App 一樣全螢幕打開。', '模擬器請把 iPad 橫放；手機直放時，分頁列在畫面下方，方便用拇指點。', '右上角的「中／EN」可以切換中文與英文介面。', '想看更大的畫面，可以用兩指放大圖片或場地。']),
      TIP('⌨️ 用電腦的話：在輸入框按 Enter 就能送出，不用去點按鈕。'),
    ] },
    { id: 'faq', icon: '❓', t: '常見問題', body: () => [
      h('div', { class: 'gd-faq' },
        Q('答錯會被扣分嗎？', P('不會。答錯只是讓網站知道你還需要練什麼；「我還不會」也不會被扣分。')),
        Q('靠提示答對，算不算答對？', P('算！熟練度會加分，只是加得比較少；也會提醒你回合結束再驗收一次。')),
        Q('我的進度會不見嗎？', P('進度存在網站上，換裝置登入同一個帳號就在。')),
        Q('我忘記密碼了？', P('請家長在「家長頁」點你的名字，往下找「管理」重設密碼。')),
        Q('沒有機器人可以學嗎？', P('可以。先用模擬器練習；起步任務裡和機器人有關的步驟可以先略過。'))),
    ] },
  ];

  const GUIDE_PARENT = [
    { id: 'what', icon: '🏠', t: '這是什麼', body: () => [
      P('幫孩子在補習班以外自己學 VEX IQ 機器人。網站會：'),
      h('ul', null, h('li', null, '先測他的程度，再出適合的題目（太難、太簡單都不會）；卡住時給提示、小抄與類似題，不讓他一直鬼打牆。'), h('li', null, '教他寫「工程筆記」——比賽評審最看重的東西。'), h('li', null, '提供網頁模擬器，沒有機器人也能練程式；有機器人就拿去實測。'), h('li', null, '讓你在「家長頁」看到他學到哪、卡在哪。')),
      TIP('你不需要會 VEX IQ。你的角色很簡單：陪他、問他問題，他自己講得出來，就代表真的懂了。'),
      h('div', { class: 'row gap' }, h('a', { class: 'btn primary', href: '#/start' }, '🚀 看孩子的起步任務'), h('a', { class: 'btn', href: '#/parent' }, '去家長頁')),
    ] },
    { id: 'week', icon: '📅', t: '每週怎麼陪', body: () => [
      P('每週大約 10 分鐘：'),
      STEPS([[h('b', null, '確認他有排時間'), '：每週 3～4 次，每次 20 分鐘就夠。短而固定，比一次練很久有效。'], [h('b', null, '看一次家長頁'), '（約 3 分鐘）：看他本週練了多久、哪裡進步、哪裡常錯。'], [h('b', null, '在他的筆記上留一句話'), '：鼓勵，或問一個問題（例如「這個結論的數據在哪裡？」）。']]),
      h('h3', null, '第一週怎麼開始'),
      h('table', { class: 'tbl' }, h('tr', null, h('th', null, '哪一天'), h('th', null, '做什麼'), h('th', null, '大約時間')),
        ...[['第 1 天', '登入、做「定位測驗」。', '15 分鐘'], ['第 2 天', '看「組裝 → 零件圖鑑」，認識自己的套件；開始「起步任務」。', '20 分鐘'], ['第 3 天', '練習題＋在模擬器完成第一個挑戰「直線衝刺」。', '20 分鐘'], ['第 4 天', '把同一個程式放到真的機器人，量一量誤差，寫第一頁工程筆記。', '30 分鐘'], ['週末', '你看家長頁、在他的筆記留言，聊聊他學到什麼。', '10 分鐘']].map((r) => h('tr', null, r.map((c) => h('td', null, c))))),
      P('還沒有機器人也可以，先用模擬器；機器人到了再補「起步任務」裡的步驟。'),
      h('h3', null, '可以這樣問他（不用懂 VEX）'),
      h('ul', null, h('li', null, '這週你寫的程式，機器人做了什麼？'), h('li', null, '哪一題讓你想最久？你後來怎麼想通的？'), h('li', null, '如果要改進你的機器人，你會先改哪裡？為什麼？'), h('li', null, '你抓到哪個 bug？是怎麼發現的？')),
    ] },
    { id: 'page', icon: '📊', t: '看懂家長頁', body: () => [
      h('ul', null,
        h('li', null, h('b', null, '雷達圖'), '：六個領域的熟練度，越外圈越熟。'),
        h('li', null, h('b', null, '累計正確率'), '：只算「第一次、沒看提示」就答對的題目。看提示或重試後才答對，會記成「未獨立答對」，所以這個數字會比較誠實，也可能比以前低一些。'),
        h('li', null, h('b', null, '常見錯誤類型'), '：例如「角度與距離搞混」，代表他需要加強哪一種觀念；就算靠提示後答對，第一次選錯的類型也會記下來。'),
        h('li', null, h('b', null, '最近答錯的題目'), '：看他的答案和解釋，可以直接問他「你當時怎麼想？」。'),
        h('li', null, h('b', null, '工程筆記'), '：點開可以看他寫的內容並留言。'),
        h('li', null, h('b', null, '每週學習報告'), '：練習時間、題數、完成的挑戰，還有「🌟 克服卡關亮點」，很適合稱讚他願意反覆試錯；也有可以貼到 LINE 的文字版。'),
        h('li', null, h('b', null, '這週陪他做什麼'), '：家長頁最上面，依他的進度給你具體建議。')),
    ] },
    { id: 'admin', icon: '⚙️', t: '帳號管理', body: () => [
      STEPS(['新增學員：家長頁最下面「新增學員」，輸入登入名字和初始密碼。', '重設密碼：點孩子的名字，往下找「管理」。他的登入會被登出。', '教練帳號：可以幫孩子新增「教練（唯讀）」帳號，只能看被指派學員的練習、筆記和題庫，不能修改任何資料。', '刪除學員：會永久刪除他的帳號、作答紀錄和筆記，要輸入名字再確認一次。']),
      TIP('🔒 資料只存在這個網站自己的伺服器，不使用第三方追蹤或廣告。請不要在筆記裡寫真實全名、學校或聯絡方式。'),
      TIP('🌐 右上角的「中／EN」可以切換介面語言，選擇會記在這台裝置上。'),
    ] },
    { id: 'words', icon: '🔤', t: '幾個詞', body: () => [
      h('table', { class: 'tbl' }, h('tr', null, h('th', null, '詞'), h('th', null, '白話意思')),
        ...[['Brain（主機）', '機器人的大腦，程式放在裡面執行。'], ['Motor（馬達）', '讓輪子、手臂轉動的零件。'], ['Sensor（感測器）', '讓機器人「知道」周圍的零件，例如量距離、偵測碰撞。'], ['VEXcode', '他寫積木程式的軟體，用拖拉積木的方式。'], ['Autonomous（自動階段）', '機器人只靠事先寫好的程式自己跑，不能用遙控器。'], ['Engineering Notebook（工程筆記）', '記錄設計與測試過程的筆記，比賽評審很看重。'], ['Skills（技能賽）', '一台機器人在限定時間內盡量得分。']].map((r) => h('tr', null, r.map((c) => h('td', null, c))))),
    ] },
    { id: 'faq', icon: '❓', t: '常見問題', body: () => [
      h('div', { class: 'gd-faq' },
        Q('他說不想做、沒興趣怎麼辦？', P('先降低門檻：只做「今天要做的事」的第 1 項，或首頁的「今日 1 分鐘小謎題」。也可以讓他先玩「模擬器」，看到機器人動起來通常比較有成就感。')),
        Q('題目太難，他一直答不出來？', P('網站會自動降低難度，答錯會先給提示、再給小抄與類似題。如果他連續卡在同一個技能，家長頁會顯示；你可以把那個技能拿去問補習班老師。')),
        Q('還沒有機器人，可以先開始嗎？', P('可以。「起步任務」裡和機器人有關的步驟可以先略過，先用模擬器練習。')),
        Q('他忘記密碼？', P('在家長頁點他的名字，往下找「管理」，可以重設他的密碼。')),
        Q('需要多久才會看到進步？', P('通常練習 1～2 週，家長頁的雷達圖就會有明顯變化。真正的重點是持續。'))),
    ] },
  ];

  function viewGuide(who, sec) {
    const role = VX.user && VX.user.role;
    const aud = who === 'kid' || who === 'parent' ? who : (role === 'learner' ? 'kid' : 'parent');
    const list = aud === 'kid' ? GUIDE_KID : GUIDE_PARENT;
    const cur = list.find((x) => x.id === sec) || list[0];
    const sections = list.map((x) => h('section', { class: 'gd-sec' + (x === cur ? ' on' : ''), id: 'gd-' + x.id }, h('h2', null, x.icon + ' ' + x.t), x.body()));
    const btns = list.map((x) => h('button', { type: 'button', class: x === cur ? 'on' : '', onclick: (e) => {
      btns.forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on');
      sections.forEach((s) => s.classList.toggle('on', s.id === 'gd-' + x.id));
      history.replaceState(null, '', '#/guide/' + aud + '/' + x.id); window.scrollTo({ top: 0, behavior: 'smooth' });
    } }, x.icon + ' ' + x.t));
    const switchAud = h('div', { class: 'row gap', style: 'margin:0' },
      h('a', { class: 'btn sm' + (aud === 'kid' ? ' primary' : ''), href: '#/guide/kid' }, '給孩子'), h('a', { class: 'btn sm' + (aud === 'parent' ? ' primary' : ''), href: '#/guide/parent' }, '給家長'));
    VX.app.replaceChildren(VX.shell(h('div', null,
      h('div', { class: 'gd-hero' }, h('div', { class: 'em' }, aud === 'kid' ? '🤖' : '👪'), h('div', null, h('h2', null, aud === 'kid' ? '歡迎！這裡教你怎麼用這個網站' : '給家長的使用說明'), h('p', null, aud === 'kid' ? '挑一個分頁看就好，不用一次看完。' : '你不需要會 VEX IQ，每週大約 10 分鐘就夠。'))),
      switchAud, h('div', { class: 'gd-tabs', role: 'tablist' }, btns), sections), { title: '網站怎麼用', icon: '🧭' }));
  }

  VX.routes.plan = () => viewPlan();
  VX.routes.start = () => viewStart();
  VX.routes.guide = (who, sec) => viewGuide(who, sec);

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
