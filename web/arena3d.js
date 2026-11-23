/* 3D Level Up 模擬練習場：純 JS 3D 透視引擎＋抓取投球得分＋官方 60 秒場地音效（無外部套件、支援 iPad 觸控） */
(function () {
  'use strict';
  const VX = window.VX;
  const { h, shell, api, toast } = VX;

  let aCtx = null;
  function playTone(freq, dur, type = 'sine', vol = 0.16, delay = 0) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      aCtx = aCtx || new AC();
      if (aCtx.state === 'suspended') aCtx.resume();
      const t0 = aCtx.currentTime + delay;
      const osc = aCtx.createOscillator(), g = aCtx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(aCtx.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.03);
    } catch (e) {}
  }

  function viewArena3D() {
    const st = VX.st;
    const rcfg = (st && st.robotCfg) || null;
    const gearMul = rcfg && rcfg.gear === '3:1' ? 0.55 : rcfg && rcfg.gear === '9:1' ? 0.35 : 1;
    const turnMul = rcfg && rcfg.wheel === 'omni' ? 1.25 : 1;

    let soundOn = true;
    const sfx = {
      grab: () => { if (!soundOn) return; playTone(440, 0.08, 'triangle', 0.18, 0); playTone(660, 0.1, 'triangle', 0.18, 0.06); },
      score: (pts) => {
        if (!soundOn) return;
        const base = pts >= 16 ? 784 : pts >= 12 ? 659 : pts >= 6 ? 587 : 523;
        playTone(base, 0.12, 'triangle', 0.22, 0);
        playTone(base * 1.25, 0.14, 'triangle', 0.22, 0.09);
        if (pts >= 12) playTone(base * 1.5, 0.26, 'triangle', 0.24, 0.18);
      },
      miss: () => { if (!soundOn) return; playTone(220, 0.14, 'sawtooth', 0.14, 0); playTone(185, 0.22, 'sawtooth', 0.14, 0.12); },
      count: () => { if (!soundOn) return; playTone(880, 0.12, 'sine', 0.2); },
      start: () => { if (!soundOn) return; playTone(523, 0.13, 'sawtooth', 0.15, 0); playTone(659, 0.13, 'sawtooth', 0.15, 0.12); playTone(784, 0.13, 'sawtooth', 0.15, 0.24); playTone(1046, 0.42, 'sawtooth', 0.2, 0.36); },
      swStart: () => { if (!soundOn) return; playTone(988, 0.16, 'triangle', 0.22, 0); playTone(1318, 0.24, 'triangle', 0.22, 0.18); },
      swEnd: () => { if (!soundOn) return; playTone(1318, 0.15, 'triangle', 0.2, 0); playTone(988, 0.22, 'triangle', 0.2, 0.16); },
      tick: () => { if (!soundOn) return; playTone(740, 0.07, 'square', 0.11); },
      end: () => { if (!soundOn) return; playTone(196, 1.0, 'sawtooth', 0.22, 0); playTone(247, 1.0, 'sawtooth', 0.18, 0); },
    };

    // 場地尺寸（mm，中心為 0,0；X: -900..900，Y: -1200..1200）
    const HW = 900, HL = 1200, R = 105;
    const COL = {
      red: { top: '#ef4444', side: '#b91c1c', rim: '#fca5a5', zh: '紅' },
      blue: { top: '#3b82f6', side: '#1d4ed8', rim: '#93c5fd', zh: '藍' },
      yellow: { top: '#eab308', side: '#a16207', rim: '#fef08a', zh: '黃' },
    };
    const GOALS = [
      { id: 'floor', name: '地板球門', pts: 1, col: 'blue', x: -640, y: -960, w: 260, d: 220, h: 45 },
      { id: 'l1', name: 'L1 球門', pts: 3, col: 'red', x: -320, y: -960, w: 240, d: 220, h: 140 },
      { id: 'l2', name: 'L2 球門', pts: 6, col: 'blue', x: 0, y: -960, w: 240, d: 220, h: 240 },
      { id: 'l3', name: 'L3 球門', pts: 12, col: 'red', x: 320, y: -960, w: 240, d: 220, h: 350 },
      { id: 'l4', name: 'L4 球門(黃)', pts: 16, col: 'yellow', x: 640, y: -960, w: 240, d: 220, h: 460 },
    ];

    let bot, bags, flying, popups, score, scoredLog;
    let camMode = 'orbit', yaw = -0.52, pitch = 0.62, camDist = 2550;
    let matchState = 'free', preSec = 0, leftMs = 60000, endAt = 0, sw1 = false, sw2 = false, lastTick = 61, matchIv = 0;
    const keys = { f: 0, b: 0, l: 0, r: 0 };

    function resetField() {
      bot = { x: 0, y: 780, th: -Math.PI / 2, armLift: 0, carry: null };
      bags = [
        // 6 顆黃色沙包（官方數量）
        { id: 1, col: 'yellow', x: -500, y: 260, z: 0, goal: null },
        { id: 2, col: 'yellow', x: 0, y: 220, z: 0, goal: null },
        { id: 3, col: 'yellow', x: 500, y: 260, z: 0, goal: null },
        { id: 4, col: 'yellow', x: -320, y: -220, z: 0, goal: null },
        { id: 5, col: 'yellow', x: 320, y: -220, z: 0, goal: null },
        { id: 6, col: 'yellow', x: 0, y: -420, z: 0, goal: null },
        // 紅／藍沙包各 4 顆
        { id: 7, col: 'red', x: -640, y: 580, z: 0, goal: null },
        { id: 8, col: 'red', x: -240, y: 480, z: 0, goal: null },
        { id: 9, col: 'red', x: 240, y: -50, z: 0, goal: null },
        { id: 10, col: 'red', x: 620, y: -380, z: 0, goal: null },
        { id: 11, col: 'blue', x: 640, y: 580, z: 0, goal: null },
        { id: 12, col: 'blue', x: 240, y: 480, z: 0, goal: null },
        { id: 13, col: 'blue', x: -240, y: -50, z: 0, goal: null },
        { id: 14, col: 'blue', x: -620, y: -380, z: 0, goal: null },
      ];
      flying = [];
      popups = [];
      score = 0;
      scoredLog = { floor: 0, l1: 0, l2: 0, l3: 0, l4: 0 };
      updateHud();
    }

    const cv = h('canvas', { width: 880, height: 520, style: 'width:100%;height:auto;border-radius:14px;background:#0f172a;display:block;touch-action:none;cursor:grab' });
    const ctx = cv.getContext('2d');
    const scoreEl = h('span', { style: 'font-size:1.55rem;font-weight:900;color:#22c55e' }, '0 分');
    const timerEl = h('span', { style: 'font-size:1.35rem;font-weight:800;font-family:ui-monospace,monospace' }, '自由練習');
    const phaseEl = h('span', { class: 'sub' }, '拖曳畫面可旋轉 3D 視角 · 開過去撿沙包再投入球門！');
    const actBtn = h('button', { type: 'button', class: 'btn primary', style: 'min-width:140px;font-weight:800', onclick: () => doAction() }, '🤏 抓取沙包');
    const matchBtn = h('button', { type: 'button', class: 'btn green sm', onclick: () => start60s() }, '🚨 開始 60 秒比賽');
    const saveBtn = h('button', { type: 'button', class: 'btn primary sm', onclick: () => saveScore() }, '💾 存入技能賽紀錄');

    function nearestBag() {
      let best = null, bd = 210;
      for (const b of bags) {
        if (b.goal || b === bot.carry) continue;
        const d = Math.hypot(b.x - bot.x, b.y - bot.y);
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    }
    function nearestGoal() {
      let best = null, bd = 340;
      for (const g of GOALS) {
        const d = Math.hypot(g.x - bot.x, (g.y + g.d / 2) - bot.y);
        if (d < bd) { bd = d; best = g; }
      }
      return best;
    }

    function updateHud() {
      scoreEl.textContent = score + ' 分';
      if (matchState === 'free') timerEl.textContent = '自由練習';
      else if (matchState === 'pre') timerEl.textContent = '倒數 ' + preSec;
      else if (matchState === 'done') timerEl.textContent = '00:00 結束';
      else {
        const s = Math.max(0, Math.ceil(leftMs / 1000));
        timerEl.textContent = '00:' + String(s).padStart(2, '0');
      }
      if (bot.carry) {
        const g = nearestGoal();
        actBtn.textContent = g ? ('🚀 投入 ' + g.name + '（' + g.pts + '分）') : '📦 放下沙包';
        actBtn.className = 'btn ' + (g ? 'green' : 'primary');
      } else {
        const b = nearestBag();
        actBtn.textContent = b ? ('🤏 抓取' + COL[b.col].zh + '色沙包') : '🤏 靠近沙包抓取';
        actBtn.className = 'btn ' + (b ? 'primary' : '');
      }
    }

    function doAction() {
      if (matchState === 'pre' || matchState === 'done') return;
      if (!bot.carry) {
        const b = nearestBag();
        if (!b) return toast('開近一點到沙包旁邊才能抓喔！');
        bot.carry = b;
        sfx.grab();
        updateHud();
        return;
      }
      const b = bot.carry;
      const g = nearestGoal();
      bot.carry = null;
      if (!g) {
        b.x = bot.x + Math.cos(bot.th) * 140;
        b.y = bot.y + Math.sin(bot.th) * 140;
        b.z = 0;
        updateHud();
        return;
      }
      // 投進球門的 3D 拋物線動畫
      const inGoalCount = bags.filter((x) => x.goal === g.id).length;
      const tx = g.x + ((inGoalCount % 3) - 1) * 58;
      const ty = g.y + (Math.floor(inGoalCount / 3) - 0.3) * 52;
      const tz = g.h + 18;
      flying.push({ bag: b, sx: bot.x, sy: bot.y, sz: 120, tx, ty, tz, t: 0, goal: g });
      bot.armLift = 1;
      updateHud();
    }

    function start60s() {
      clearInterval(matchIv);
      resetField();
      matchState = 'pre'; preSec = 3; leftMs = 60000; sw1 = false; sw2 = false; lastTick = 61;
      sfx.count();
      phaseEl.textContent = '3-2-1 準備出發！';
      updateHud();
      matchIv = setInterval(() => {
        if (!document.body.contains(cv)) { clearInterval(matchIv); matchIv = 0; return; }
        if (matchState === 'pre') {
          preSec--;
          if (preSec > 0) { sfx.count(); phaseEl.textContent = '準備出發… ' + preSec; updateHud(); }
          else { matchState = 'run'; endAt = Date.now() + 60000; sfx.start(); phaseEl.textContent = '🏁 比賽開始！60 秒盡量得分！'; updateHud(); }
          return;
        }
        if (matchState === 'run') {
          leftMs = Math.max(0, endAt - Date.now());
          const s = Math.ceil(leftMs / 1000);
          if (s <= 35 && !sw1) { sw1 = true; sfx.swStart(); phaseEl.textContent = '🔄 換手時間（35s～25s）！'; }
          if (s <= 25 && !sw2) { sw2 = true; sfx.swEnd(); phaseEl.textContent = '⚡ 下半場衝刺！'; }
          if (s <= 10 && s >= 1 && s < lastTick) { lastTick = s; sfx.tick(); phaseEl.textContent = '🔥 最後 ' + s + ' 秒！'; }
          if (leftMs <= 0) {
            clearInterval(matchIv); matchIv = 0; matchState = 'done';
            sfx.end(); phaseEl.textContent = '🏁 時間到！本場得分 ' + score + ' 分！';
            if (window.VXFX && score > 0) window.VXFX.confetti();
          }
          updateHud();
        }
      }, 100);
    }

    async function saveScore() {
      const detail = GOALS.map((g) => (scoredLog[g.id] ? g.name + '×' + scoredLog[g.id] : '')).filter(Boolean).join('、') || '無進球';
      try {
        await api('/api/notes', {
          kind: 'skills',
          title: '3D 練習場 ' + score + ' 分',
          data: { f: { type: '手動駕駛', score: String(score), note: '3D Level Up 練習場：' + detail, date: VX.todayStr() }, c: [] },
        });
        if (VX.act) VX.act('note');
        VX.saveState();
        toast('已將 3D 練習場 ' + score + ' 分存入技能賽紀錄 ✔');
      } catch (e) { toast(e.message || '儲存失敗'); }
    }

    /* ---- 3D 透視投影與畫布渲染 ---- */
    function project(x, y, z, cam) {
      const dx = x - cam.cx, dy = y - cam.cy, dz = z - cam.cz;
      const x1 = dx * cam.cyaw - dy * cam.syaw;
      const y1 = dx * cam.syaw + dy * cam.cyaw;
      const y2 = y1 * cam.cpitch - dz * cam.spitch;
      const z2 = y1 * cam.spitch + dz * cam.cpitch;
      const depth = cam.dist + y2;
      if (depth < 80) return null;
      const sc = 860 / depth;
      return { sx: cv.width / 2 + x1 * sc, sy: cv.height * 0.54 - z2 * sc, depth, sc };
    }

    function drawBox(list, cx, cy, z0, w, d, h2, th, topCol, sideCol, strokeCol, cam, label) {
      const ct = Math.cos(th), st2 = Math.sin(th);
      const hw = w / 2, hd = d / 2;
      const pts3 = [
        [-hw, -hd, z0], [hw, -hd, z0], [hw, hd, z0], [-hw, hd, z0],
        [-hw, -hd, z0 + h2], [hw, -hd, z0 + h2], [hw, hd, z0 + h2], [-hw, hd, z0 + h2],
      ].map(([lx, ly, lz]) => project(cx + lx * ct - ly * st2, cy + lx * st2 + ly * ct, lz, cam));
      if (pts3.some((p) => !p)) return;
      const faces = [
        { idx: [0, 1, 5, 4], col: sideCol },
        { idx: [1, 2, 6, 5], col: sideCol },
        { idx: [2, 3, 7, 6], col: sideCol },
        { idx: [3, 0, 4, 7], col: sideCol },
        { idx: [4, 5, 6, 7], col: topCol, lbl: label },
      ];
      faces.forEach((fc) => {
        const ps = fc.idx.map((i) => pts3[i]);
        const avgD = (ps[0].depth + ps[1].depth + ps[2].depth + ps[3].depth) / 4;
        list.push({ depth: avgD, ps, col: fc.col, stroke: strokeCol, lbl: fc.lbl });
      });
    }

    function renderFrame() {
      const w = cv.width, hh = cv.height;
      ctx.clearRect(0, 0, w, hh);
      // 天空與場地背景漸層
      const bg = ctx.createLinearGradient(0, 0, 0, hh);
      bg.addColorStop(0, '#0f172a'); bg.addColorStop(1, '#1e293b');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, hh);

      const useYaw = camMode === 'chase' ? (-bot.th - Math.PI / 2) : yaw;
      const usePitch = camMode === 'chase' ? 0.42 : pitch;
      const cam = {
        cx: camMode === 'chase' ? bot.x * 0.65 : 0,
        cy: camMode === 'chase' ? bot.y * 0.65 : -80,
        cz: 140,
        dist: camMode === 'chase' ? 1550 : camDist,
        cyaw: Math.cos(useYaw), syaw: Math.sin(useYaw),
        cpitch: Math.cos(usePitch), spitch: Math.sin(usePitch),
      };

      // 畫 3D 地板與格線
      const corners = [[-HW, -HL, 0], [HW, -HL, 0], [HW, HL, 0], [-HW, HL, 0]].map((p) => project(p[0], p[1], p[2], cam));
      if (corners.every(Boolean)) {
        ctx.fillStyle = '#e2e8f0'; ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2;
        ctx.beginPath();
        corners.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy)));
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(100,116,139,.35)'; ctx.lineWidth = 1;
        for (let gx = -HW + 300; gx < HW; gx += 300) {
          const a = project(gx, -HL, 0, cam), b = project(gx, HL, 0, cam);
          if (a && b) { ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke(); }
        }
        for (let gy = -HL + 300; gy < HL; gy += 300) {
          const a = project(-HW, gy, 0, cam), b = project(HW, gy, 0, cam);
          if (a && b) { ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke(); }
        }
      }

      // 收集所有 3D 物件並按深度排序（Painter's Algorithm）
      const drawList = [];
      // 透明感邊牆
      drawBox(drawList, 0, -HL - 14, 0, HW * 2, 28, 70, 0, '#94a3b8', 'rgba(148,163,184,.55)', '#475569', cam);
      drawBox(drawList, 0, HL + 14, 0, HW * 2, 28, 70, 0, '#94a3b8', 'rgba(148,163,184,.35)', '#475569', cam);
      drawBox(drawList, -HW - 14, 0, 0, 28, HL * 2, 70, 0, '#94a3b8', 'rgba(148,163,184,.45)', '#475569', cam);
      drawBox(drawList, HW + 14, 0, 0, 28, HL * 2, 70, 0, '#94a3b8', 'rgba(148,163,184,.45)', '#475569', cam);

      // 5 座立體階梯球門
      GOALS.forEach((g) => {
        const c = COL[g.col];
        drawBox(drawList, g.x, g.y, 0, g.w, g.d, g.h, 0, c.top, c.side, c.rim, cam, g.name + ' ' + g.pts + '分');
      });

      // 沙包
      bags.forEach((b) => {
        const c = COL[b.col];
        const bx = b === bot.carry ? bot.x + Math.cos(bot.th) * 115 : b.x;
        const by = b === bot.carry ? bot.y + Math.sin(bot.th) * 115 : b.y;
        const bz = b === bot.carry ? 85 + bot.armLift * 140 : b.z;
        drawBox(drawList, bx, by, bz, 78, 78, 52, 0, c.top, c.side, '#fff', cam, c.zh);
      });

      // 3D 機器人（含底盤、輪子、車頭方向箭頭、手臂）
      const armH = 75 + bot.armLift * 140;
      drawBox(drawList, bot.x, bot.y, 12, 210, 180, 76, bot.th, '#60a5fa', '#2563eb', '#1e3a8a', cam);
      drawBox(drawList, bot.x + Math.cos(bot.th) * 60, bot.y + Math.sin(bot.th) * 60, 88, 70, 90, 32, bot.th, '#f59e0b', '#b45309', '#fff', cam);
      // 舉重手臂
      drawBox(drawList, bot.x + Math.cos(bot.th) * 115, bot.y + Math.sin(bot.th) * 115, armH, 90, 120, 20, bot.th, '#f97316', '#c2410c', '#fff', cam);

      drawList.sort((a, b) => b.depth - a.depth);
      drawList.forEach((item) => {
        ctx.fillStyle = item.col;
        ctx.strokeStyle = item.stroke || '#334155';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        item.ps.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy)));
        ctx.closePath(); ctx.fill(); ctx.stroke();
        if (item.lbl) {
          const cx = (item.ps[0].sx + item.ps[1].sx + item.ps[2].sx + item.ps[3].sx) / 4;
          const cy = (item.ps[0].sy + item.ps[1].sy + item.ps[2].sy + item.ps[3].sy) / 4;
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.lbl, cx, cy);
        }
      });

      // 飄浮得分文字
      popups = popups.filter((p) => p.life > 0);
      popups.forEach((p) => {
        p.life -= 0.025; p.z += 5;
        const pr = project(p.x, p.y, p.z, cam);
        if (pr) {
          ctx.save(); ctx.globalAlpha = Math.max(0, p.life);
          ctx.font = '900 22px sans-serif'; ctx.textAlign = 'center';
          ctx.fillStyle = p.ok ? '#4ade80' : '#f87171';
          ctx.fillText(p.text, pr.sx, pr.sy);
          ctx.restore();
        }
      });
    }

    // 物理與動畫主迴圈
    let rafId = 0;
    function tick() {
      if (!document.body.contains(cv)) { cancelAnimationFrame(rafId); clearInterval(matchIv); return; }
      if (matchState !== 'pre' && matchState !== 'done') {
        const turn = (keys.r - keys.l) * 0.052 * turnMul;
        const spd = (keys.f - keys.b) * 11 * gearMul;
        if (turn) bot.th += turn;
        if (spd) {
          const nx = Math.max(-HW + R, Math.min(HW - R, bot.x + Math.cos(bot.th) * spd));
          const ny = Math.max(-HL + 240 + R, Math.min(HL - R, bot.y + Math.sin(bot.th) * spd));
          bot.x = nx; bot.y = ny;
        }
      }
      if (bot.armLift > 0) bot.armLift = Math.max(0, bot.armLift - 0.05);

      // 更新飛行中的沙包
      for (let i = flying.length - 1; i >= 0; i--) {
        const fl = flying[i];
        fl.t += 0.07;
        if (fl.t >= 1) {
          fl.bag.x = fl.tx; fl.bag.y = fl.ty; fl.bag.z = fl.tz; fl.bag.goal = fl.goal.id;
          const valid = fl.goal.col === 'yellow' ? fl.bag.col === 'yellow' : (fl.bag.col === fl.goal.col || fl.bag.col === 'yellow');
          if (valid) {
            score += fl.goal.pts;
            scoredLog[fl.goal.id]++;
            sfx.score(fl.goal.pts);
            popups.push({ x: fl.tx, y: fl.ty, z: fl.tz + 60, text: '+' + fl.goal.pts + ' 分！', ok: true, life: 1 });
          } else {
            sfx.miss();
            popups.push({ x: fl.tx, y: fl.ty, z: fl.tz + 60, text: '錯色 0 分', ok: false, life: 1 });
            toast(fl.goal.col === 'yellow' ? 'L4 球門只收黃色沙包喔！' : ('這個球門只收' + COL[fl.goal.col].zh + '色或黃色沙包！'));
          }
          flying.splice(i, 1);
          updateHud();
        } else {
          fl.bag.x = fl.sx + (fl.tx - fl.sx) * fl.t;
          fl.bag.y = fl.sy + (fl.ty - fl.sy) * fl.t;
          fl.bag.z = fl.sz + (fl.tz - fl.sz) * fl.t + Math.sin(fl.t * Math.PI) * 260;
        }
      }

      if (keys.f || keys.b || keys.l || keys.r) updateHud();
      renderFrame();
      rafId = requestAnimationFrame(tick);
    }

    // 觸控／滑鼠拖曳旋轉 3D 視角
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { if (camMode !== 'orbit') return; drag = { x: e.clientX, y: e.clientY, yaw, pitch }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      yaw = drag.yaw + (e.clientX - drag.x) * 0.008;
      pitch = Math.max(0.25, Math.min(1.25, drag.pitch + (e.clientY - drag.y) * 0.006));
    });
    cv.addEventListener('pointerup', () => { drag = null; });

    // 鍵盤操控
    const onKey = (down) => (e) => {
      if (!document.body.contains(cv)) { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); return; }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement || {}).tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') { keys.f = down ? 1 : 0; e.preventDefault(); }
      else if (k === 'arrowdown' || k === 's') { keys.b = down ? 1 : 0; e.preventDefault(); }
      else if (k === 'arrowleft' || k === 'a') { keys.l = down ? 1 : 0; e.preventDefault(); }
      else if (k === 'arrowright' || k === 'd') { keys.r = down ? 1 : 0; e.preventDefault(); }
      else if (down && (k === ' ' || k === 'e')) { e.preventDefault(); doAction(); }
    };
    const kd = onKey(true), ku = onKey(false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    const padBtn = (label, keyName) => {
      const b = h('button', { type: 'button', class: 'btn', style: 'min-width:68px;padding:12px 10px;font-weight:700;user-select:none;-webkit-user-select:none' }, label);
      const dn = (e) => { e.preventDefault(); keys[keyName] = 1; };
      const up = () => { keys[keyName] = 0; };
      b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
      return b;
    };

    const camBtn = h('button', { type: 'button', class: 'btn sm', onclick: () => { camMode = camMode === 'orbit' ? 'chase' : 'orbit'; camBtn.textContent = camMode === 'orbit' ? '🏎️ 切換車尾視角' : '🎥 切換上帝視角'; } }, '🏎️ 切換車尾視角');
    const sndBtn = h('button', { type: 'button', class: 'btn sm', onclick: () => { soundOn = !soundOn; sndBtn.textContent = soundOn ? '🔊 音效：開' : '🔇 音效：關'; } }, '🔊 音效：開');

    resetField();
    VX.app.replaceChildren(shell(h('div', null,
      h('div', { class: 'panel' },
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px' },
          h('div', null, h('h2', { style: 'margin:0' }, '🏟️ 3D Level Up 模擬練習場'), phaseEl),
          h('div', { class: 'row gap', style: 'align-items:center' }, timerEl, scoreEl)),
        h('div', { class: 'row gap', style: 'margin-bottom:8px;align-items:center' },
          matchBtn,
          h('button', { type: 'button', class: 'btn sm', onclick: () => { clearInterval(matchIv); matchIv = 0; matchState = 'free'; resetField(); phaseEl.textContent = '自由練習模式：盡情試開與投球！'; } }, '↺ 重置場地'),
          camBtn, sndBtn, saveBtn,
          h('span', { class: 'sub' }, '目前車輛：' + (rcfg ? rcfg.label : '標準底盤車') + (rcfg && rcfg.gear ? ' (' + rcfg.gear + ')' : ''))),
        cv,
        h('div', { class: 'row gap', style: 'justify-content:center;align-items:center;margin-top:12px;flex-wrap:wrap' },
          padBtn('◀ 左轉', 'l'), padBtn('▲ 前進', 'f'), padBtn('▼ 後退', 'b'), padBtn('▶ 右轉', 'r'), actBtn),
        h('p', { class: 'sub', style: 'text-align:center;margin-top:8px' }, '電腦可用鍵盤 WASD／方向鍵駕駛、空白鍵抓取與投球；iPad 可直接按按鈕操作、手指拖曳旋轉 3D 場地視角！'))), { title: '3D 練習場', icon: '🏟️' }));
    rafId = requestAnimationFrame(tick);
  }

  VX.routes.arena3d = () => viewArena3D();
})();
