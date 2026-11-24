/* VEX IQ 自動路徑規劃器（參考 PATH.JERRYIO 概念）：在場地上點出路線 → 自動算距離與轉角 → 一鍵轉成積木與 Python */
(function () {
  'use strict';
  const VX = window.VX;
  const { h, shell, blocksEl, toast } = VX;
  const T = (s, o) => { let r = (window.VXI18N && window.VXI18N.tr) ? window.VXI18N.tr(s) : s; if (o) Object.keys(o).forEach((k) => { r = r.split('{' + k + '}').join(o[k]); }); return r; };

  function viewPathPlanner() {
    const COLS = 6, ROWS = 4, CELL = 200, W = COLS * CELL, H = ROWS * CELL;
    let snap50 = true;
    let pts = [{ x: 100, y: 700 }, { x: 500, y: 700 }, { x: 500, y: 300 }, { x: 900, y: 300 }];
    let dragIdx = -1, animRaf = 0, animT = -1;

    const cv = h('canvas', { width: 720, height: 480, style: 'width:100%;max-width:720px;height:auto;border:2px solid var(--line);border-radius:12px;background:#fff;touch-action:none;cursor:crosshair;display:block' });
    const ctx = cv.getContext('2d');
    const summaryEl = h('div', { class: 'callout' });
    const blocksBox = h('div');
    const pyBox = h('pre', { style: 'margin:0;padding:10px 12px;border-radius:10px;background:var(--bg);border:1px solid var(--line);font-size:.86rem;overflow-x:auto', 'data-notrans': '1' });

    const normDeg = (d) => { let a = ((d % 360) + 540) % 360 - 180; return Math.round(a); };

    function computePlan() {
      const steps = [], dsl = ['何時開始'], py = ['def when_started1():'], simBlocks = [];
      let heading = 0; // 0 = 朝右（與模擬器自由練習起點一致）
      let totalDist = 0, totalTurn = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.round(Math.hypot(dx, dy));
        if (dist < 10) continue;
        const target = (Math.atan2(dy, dx) * 180) / Math.PI;
        const delta = normDeg(target - heading);
        if (Math.abs(delta) >= 2) {
          const dir = delta > 0 ? 'right' : 'left';
          const deg = Math.abs(delta);
          totalTurn += deg;
          dsl.push('旋轉 [' + (dir === 'right' ? '正確的' : '左邊') + '] 度 (' + deg + ') 度');
          py.push('    drivetrain.turn_for(' + (dir === 'right' ? 'RIGHT' : 'LEFT') + ', ' + deg + ', DEGREES)');
          simBlocks.push({ t: 'turn', dir, v: String(deg) });
          steps.push({ type: 'turn', dir, deg, x: a.x, y: a.y });
          heading = target;
        }
        totalDist += dist;
        dsl.push('驅動 [向前] 為 (' + dist + ') [毫米]');
        py.push('    drivetrain.drive_for(FORWARD, ' + dist + ', MM)');
        simBlocks.push({ t: 'drive', dir: 'forward', v: String(dist) });
        steps.push({ type: 'drive', dist, ax: a.x, ay: a.y, bx: b.x, by: b.y });
      }
      if (py.length === 1) py.push('    pass');
      py.push('', 'when_started1()');
      const estSec = (totalDist / 200 + totalTurn / 90).toFixed(1); // 預設 50% 速度估算
      return { steps, dsl, py: py.join('\n'), simBlocks, totalDist, totalTurn, estSec };
    }

    function draw(plan) {
      plan = plan || computePlan();
      const k = cv.width / W;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, cv.width, cv.height);
      // 場地格線（每格 200 mm）
      ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += CELL) { ctx.beginPath(); ctx.moveTo(x * k, 0); ctx.lineTo(x * k, H * k); ctx.stroke(); }
      for (let y = 0; y <= H; y += CELL) { ctx.beginPath(); ctx.moveTo(0, y * k); ctx.lineTo(W * k, y * k); ctx.stroke(); }
      // 機器人車寬走廊（180 mm 寬）
      if (pts.length >= 2) {
        ctx.save();
        ctx.strokeStyle = 'rgba(14,165,233,.16)';
        ctx.lineWidth = 180 * k;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x * k, p.y * k) : ctx.moveTo(p.x * k, p.y * k)));
        ctx.stroke();
        ctx.restore();
      }
      // 主路線與距離標註
      if (pts.length >= 2) {
        ctx.strokeStyle = '#0284c7'; ctx.lineWidth = 3.5;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x * k, p.y * k) : ctx.moveTo(p.x * k, p.y * k)));
        ctx.stroke();
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const d = Math.round(Math.hypot(b.x - a.x, b.y - a.y));
          if (d < 10) continue;
          const mx = ((a.x + b.x) / 2) * k, my = ((a.y + b.y) / 2) * k;
          ctx.fillStyle = '#0f172a'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(d + ' mm', mx, my - 8);
        }
      }
      // 節點
      pts.forEach((p, i) => {
        ctx.fillStyle = i === 0 ? '#22c55e' : i === pts.length - 1 ? '#ef4444' : '#0284c7';
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(p.x * k, p.y * k, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(i === 0 ? '起' : String(i), p.x * k, p.y * k);
      });
      // 預覽動畫機器人
      if (animT >= 0 && pts.length >= 2) {
        let remain = animT * Math.max(1, plan.totalDist), rx = pts[0].x, ry = pts[0].y, rth = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1], seg = Math.hypot(b.x - a.x, b.y - a.y);
          rth = Math.atan2(b.y - a.y, b.x - a.x);
          if (remain <= seg || i === pts.length - 2) {
            const f = seg ? Math.min(1, remain / seg) : 0;
            rx = a.x + (b.x - a.x) * f; ry = a.y + (b.y - a.y) * f;
            break;
          }
          remain -= seg;
        }
        ctx.save(); ctx.translate(rx * k, ry * k); ctx.rotate(rth);
        ctx.fillStyle = 'rgba(59,130,246,.85)'; ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-90 * k, -78 * k, 180 * k, 156 * k, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(90 * k, 0); ctx.lineTo(50 * k, -26 * k); ctx.lineTo(50 * k, 26 * k); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    function refresh() {
      const plan = computePlan();
      draw(plan);
      summaryEl.replaceChildren(
        h('b', null, '路線統計：'),
        T('共 {p} 個點 · 總長 {d} mm · 累計轉彎 {t}° · 預估耗時約 {s} 秒（50% 速度）', { p: pts.length, d: plan.totalDist, t: plan.totalTurn, s: plan.estSec }));
      blocksBox.replaceChildren(blocksEl(plan.dsl));
      pyBox.textContent = plan.py;
    }

    function getPos(e) {
      const rect = cv.getBoundingClientRect();
      let x = ((e.clientX - rect.left) / rect.width) * W;
      let y = ((e.clientY - rect.top) / rect.height) * H;
      x = Math.max(90, Math.min(W - 90, x));
      y = Math.max(90, Math.min(H - 90, y));
      if (snap50) { x = Math.round(x / 50) * 50; y = Math.round(y / 50) * 50; }
      return { x, y };
    }
    cv.addEventListener('pointerdown', (e) => {
      const p = getPos(e);
      const hit = pts.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 55);
      if (hit >= 0) { dragIdx = hit; cv.setPointerCapture(e.pointerId); return; }
      if (pts.length >= 16) return toast('最多放 16 個路徑點喔');
      pts.push(p); refresh();
    });
    cv.addEventListener('pointermove', (e) => {
      if (dragIdx < 0) return;
      const p = getPos(e);
      if (dragIdx === 0) return; // 起點固定在 (100, 700) 方便直接對齊模擬器自由練習場
      pts[dragIdx] = p; refresh();
    });
    cv.addEventListener('pointerup', () => { dragIdx = -1; });

    const preview = () => {
      cancelAnimationFrame(animRaf);
      const plan = computePlan();
      if (plan.totalDist < 10) return toast('先在場地上點出至少 2 個點！');
      const start = performance.now(), dur = Math.max(1200, Math.min(6000, plan.totalDist * 2.5));
      const loop = (now) => {
        if (!document.body.contains(cv)) return;
        animT = Math.min(1, (now - start) / dur);
        draw(plan);
        if (animT < 1) animRaf = requestAnimationFrame(loop);
        else { animT = -1; draw(plan); }
      };
      animRaf = requestAnimationFrame(loop);
    };

    const sendToSim = () => {
      const plan = computePlan();
      if (!plan.simBlocks.length) return toast('先在場地上點出路線！');
      VX.st.sim = VX.st.sim || {};
      VX.st.sim.free = { main: plan.simBlocks, defs: [] };
      VX.saveState();
      toast('已轉成 VEXcode 積木並送進模擬器！按下 RUN 就能看它跑');
      location.hash = '#/sim';
    };

    refresh();
    VX.app.replaceChildren(shell(h('div', null,
      h('div', { class: 'panel' },
        h('h2', null, '🗺️ VEX IQ 自動路徑規劃器'),
        h('p', { class: 'sub' }, '點擊場地新增路徑點、拖曳藍／紅點微調位置（綠色「起」對齊模擬器起點），系統自動算出每段距離與轉角並產生 VEXcode 積木與 Python！'),
        h('div', { class: 'row gap', style: 'margin-bottom:10px;align-items:center' },
          h('button', { type: 'button', class: 'btn primary sm', onclick: preview }, '▶ 預覽走法'),
          h('button', { type: 'button', class: 'btn green sm', onclick: sendToSim }, '🖥️ 一鍵送進模擬器執行'),
          h('button', { type: 'button', class: 'btn sm', onclick: () => { if (pts.length > 1) { pts.pop(); refresh(); } } }, '↶ 刪掉最後一點'),
          h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { pts = [{ x: 100, y: 700 }]; refresh(); } }, '🧹 清空重畫'),
          h('label', { style: 'display:inline-flex;align-items:center;gap:4px;font-size:.88rem' },
            h('input', { type: 'checkbox', checked: snap50, onchange: (e) => { snap50 = e.target.checked; } }), '對齊 50 mm 格點')),
        cv,
        summaryEl),
      h('div', { class: 'grid2' },
        h('div', { class: 'panel' }, h('h3', null, '🧩 自動生成的 VEXcode 積木'), blocksBox),
        h('div', { class: 'panel' },
          h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;margin-bottom:8px' },
            h('h3', { style: 'margin:0' }, '🐍 自動生成的 Python'),
            h('button', { type: 'button', class: 'btn sm', onclick: async () => { try { await navigator.clipboard.writeText(pyBox.textContent); toast('已複製 Python 程式碼 ✔'); } catch (e) { toast('請手動選取複製'); } } }, '📋 複製 Python')),
          pyBox))), { title: '自動路徑規劃器', icon: '🗺️' }));
  }

  VX.routes.pathplan = () => viewPathPlanner();
})();
