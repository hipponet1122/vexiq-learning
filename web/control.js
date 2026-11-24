/* 控制實驗室：用互動小實驗看懂「走直線（P 控制）」「PID」「里程計」。
   全部是自己寫的簡化模型（單位與參數是假設值），目的是理解概念，不是精確模擬實體機器人。 */
(function () {
  'use strict';
  const VX = window.VX;
  const { h } = VX;
  const NS = 'http://www.w3.org/2000/svg';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const R2D = 180 / Math.PI;

  /* ---------- 小工具：SVG 折線圖 ---------- */
  function sv(tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  // series: [{pts:[[x,y],...], color, dash, w}]；opts: {w,h,xmin,xmax,ymin,ymax,xlab,ylab,equal,band:[a,b],hline:[y..],label}
  function chart(series, o) {
    const W = o.w || 420, H = o.h || 220, L = 44, Rt = 12, T = 12, B = 34;
    const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'ctlchart', role: 'img', 'aria-label': o.label || '' });
    let { xmin, xmax, ymin, ymax } = o;
    if (o.equal) { // x、y 用同樣比例尺
      const sx = (W - L - Rt) / (xmax - xmin), sy = (H - T - B) / (ymax - ymin), s = Math.min(sx, sy);
      const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
      const hw = (W - L - Rt) / s / 2, hh = (H - T - B) / s / 2;
      xmin = cx - hw; xmax = cx + hw; ymin = cy - hh; ymax = cy + hh;
    }
    const X = (x) => L + ((x - xmin) / (xmax - xmin)) * (W - L - Rt);
    const Y = (y) => H - B - ((y - ymin) / (ymax - ymin)) * (H - T - B);
    svg.append(sv('rect', { x: L, y: T, width: W - L - Rt, height: H - T - B, fill: 'var(--card)', stroke: 'var(--line)' }));
    const tick = (v0, v1, n) => { const step = (v1 - v0) / n; const out = []; for (let i = 0; i <= n; i++) out.push(v0 + step * i); return out; };
    tick(xmin, xmax, 5).forEach((v) => { svg.append(sv('line', { x1: X(v), x2: X(v), y1: T, y2: H - B, stroke: 'var(--line)', 'stroke-width': 0.6 })); svg.append(sv('text', { x: X(v), y: H - B + 14, 'text-anchor': 'middle', class: 'ctltick' }, String(Math.round(v * 10) / 10))); });
    tick(ymin, ymax, 4).forEach((v) => { svg.append(sv('line', { x1: L, x2: W - Rt, y1: Y(v), y2: Y(v), stroke: 'var(--line)', 'stroke-width': 0.6 })); svg.append(sv('text', { x: L - 5, y: Y(v) + 3, 'text-anchor': 'end', class: 'ctltick' }, String(Math.round(v * 10) / 10))); });
    if (o.band) svg.append(sv('rect', { x: L, y: Y(o.band[1]), width: W - L - Rt, height: Math.abs(Y(o.band[0]) - Y(o.band[1])), fill: 'rgba(31,157,85,.14)' }));
    (o.hline || []).forEach((v) => svg.append(sv('line', { x1: L, x2: W - Rt, y1: Y(v), y2: Y(v), stroke: '#8a97a8', 'stroke-dasharray': '5 4' })));
    series.forEach((s) => {
      if (!s.pts.length) return;
      svg.append(sv('polyline', { points: s.pts.map((p) => X(p[0]).toFixed(1) + ',' + Y(clamp(p[1], ymin, ymax)).toFixed(1)).join(' '), fill: 'none', stroke: s.color, 'stroke-width': s.w || 2.2, 'stroke-dasharray': s.dash || '', 'stroke-linejoin': 'round' }));
    });
    if (o.xlab) svg.append(sv('text', { x: (L + W - Rt) / 2, y: H - 4, 'text-anchor': 'middle', class: 'ctllab' }, o.xlab));
    if (o.ylab) svg.append(sv('text', { x: 12, y: (T + H - B) / 2, 'text-anchor': 'middle', class: 'ctllab', transform: 'rotate(-90 12 ' + (T + H - B) / 2 + ')' }, o.ylab));
    return svg;
  }
  const legend = (items) => h('div', { class: 'ctllegend' }, items.map(([c, t, dash]) => h('span', null, h('i', { style: 'background:' + c + (dash ? ';opacity:.7' : '') }), t)));

  // 滑桿
  function slider(label, min, max, step, val, unit, onch) {
    const out = h('b', { class: 'ctlval' }, String(val) + unit);
    const inp = h('input', { type: 'range', min: String(min), max: String(max), step: String(step) });
    inp.value = String(val);
    inp.setAttribute('aria-label', label);
    inp.addEventListener('input', () => { out.textContent = inp.value + unit; onch(parseFloat(inp.value)); });
    const wrap = h('label', { class: 'ctlslider' }, h('span', null, label), inp, out);
    wrap.set = (v) => { inp.value = String(v); out.textContent = inp.value + unit; };
    return wrap;
  }

  /* ================= 實驗一：走直線（P 控制）=================
     模型：機器人想沿 x 軸直走。朝向 θ（度，0＝目標方向）。
     每 20 ms：θ += (漂移 + 修正效果) × dt；修正量 u = Kp × 誤差，誤差 = 0 − Gyro 讀值（Gyro 有一點延遲）。 */
  function simStraight(P) {
    const dt = 0.02, T = 6, V = 300, G = 1.8, DELAY = 5; // 速度 300 mm/s；1% 修正 ≈ 1.8°/s；延遲 5 步（0.1 秒）
    const n = Math.round(T / dt);
    let th = 0, x = 0, y = 0;
    const hist = [0]; const path = [[0, 0]], err = [[0, 0]];
    let maxOff = 0, flips = 0, last = 0;
    for (let i = 1; i <= n; i++) {
      if (P.kick && i === Math.round(2 / dt)) th += P.kick; // 第 2 秒被撞一下，朝向突然偏了
      const meas = hist[Math.max(0, hist.length - 1 - DELAY)];
      const u = P.on ? clamp(P.kp * (0 - meas), -40, 40) : 0;
      th += (P.drift + G * u) * dt;
      x += V * Math.cos(th / R2D) * dt; y += V * Math.sin(th / R2D) * dt;
      hist.push(th);
      path.push([x, y]); err.push([i * dt, th]);
      maxOff = Math.max(maxOff, Math.abs(y));
      const sgn = Math.abs(th) < 0.3 ? 0 : th > 0 ? 1 : -1;
      if (sgn && last && sgn !== last) flips++;
      if (sgn) last = sgn;
    }
    return { path, err, maxOff, endErr: th, flips, endY: y, endX: x };
  }

  function labStraight() {
    const P = { drift: 3, kp: 2, on: true };
    const box = h('div');
    const res = h('div', { class: 'ctlres' });
    const draw = () => {
      const a = simStraight(P), b = simStraight({ ...P, on: false });
      const lim = Math.max(150, Math.ceil(Math.max(a.maxOff, b.maxOff) / 50) * 50);
      box.replaceChildren(
        h('div', { class: 'ctlcharts' },
          h('div', null, h('h4', null, '從上面看機器人走的路'), chart([{ pts: b.path, color: '#d33a3a', dash: '6 4' }, { pts: a.path, color: '#0875e2' }],
            { w: 420, h: 220, xmin: 0, xmax: 1800, ymin: -lim, ymax: lim, equal: false, xlab: '前進 (mm)', ylab: '橫向偏移 (mm)', hline: [0], label: '走直線路徑圖' })),
          h('div', null, h('h4', null, 'Gyro 朝向誤差'), chart([{ pts: b.err, color: '#d33a3a', dash: '6 4' }, { pts: a.err, color: '#0875e2' }],
            { w: 420, h: 220, xmin: 0, xmax: 6, ymin: -30, ymax: 30, xlab: '時間 (秒)', ylab: '朝向誤差 (度)', hline: [0], label: '朝向誤差隨時間變化' }))),
        legend([['#0875e2', P.on ? '有修正（Kp = ' + P.kp + '）' : '沒有修正'], ['#d33a3a', '完全不修正（對照）', true]]));
      const verdict = !P.on ? '沒有修正：一路偏下去。' : a.flips >= 4 ? '⚠ 修過頭了：左右來回擺動！Kp 太大了。' : a.maxOff > 40 ? 'Kp 偏小，還是偏了不少，再調大一點。' : '不錯！偏移很小，而且沒有一直擺動。';
      res.replaceChildren(h('div', { class: 'ctlstats' },
        h('div', null, h('b', null, Math.round(a.maxOff)), ' mm', h('small', null, '最大橫向偏移')),
        h('div', null, h('b', null, (Math.round(a.endErr * 10) / 10)), '°', h('small', null, '結束時朝向誤差')),
        h('div', null, h('b', null, a.flips), ' 次', h('small', null, '左右擺動')),
        h('div', null, h('b', null, Math.round(b.maxOff)), ' mm', h('small', null, '不修正時偏移'))),
        h('p', { class: 'ctlverdict' }, verdict));
    };
    const sDrift = slider('漂移（機器人天生往一邊偏）', 0, 8, 0.5, P.drift, ' °/秒', (v) => { P.drift = v; draw(); });
    const sKp = slider('Kp（修正有多用力）', 0, 14, 0.5, P.kp, '', (v) => { P.kp = v; draw(); });
    const cb = h('input', { type: 'checkbox' }); cb.checked = true; cb.setAttribute('aria-label', '開啟修正');
    cb.addEventListener('change', () => { P.on = cb.checked; draw(); });
    draw();
    return h('div', null,
      h('p', null, '機器人明明寫「直走」，卻會慢慢偏——因為左右兩邊的馬達、輪子不會一模一樣。解法是「回授」：用 Gyro 量現在朝哪裡，算出誤差，再把左右輪速度調一點點。這個實驗用最簡單的 ', h('b', null, 'P 控制'), '：修正量 = Kp × 誤差。'),
      h('div', { class: 'panel ctlctrl' }, sDrift, sKp, h('label', { class: 'check' }, cb, h('span', null, '開啟修正（取消勾選可看到不修正的樣子）'))),
      res, box,
      h('div', { class: 'panel' }, h('h3', null, '試試看'),
        h('ol', null,
          h('li', null, '把 Kp 設成 0：機器人一路偏下去。'),
          h('li', null, '慢慢把 Kp 調大：偏移越來越小。注意「結束時朝向誤差」還剩一點點——只用 P 會留下小小的誤差。'),
          h('li', null, '再把 Kp 調得很大（超過 9）：左右擺動出現了！這叫「震盪」。因為 Gyro 讀值有延遲，修正太用力就會修過頭。'),
          h('li', null, '把「漂移」調大再試一次：漂移越大，同樣的 Kp 誤差越大。'))),
      h('div', { class: 'panel' }, h('h3', null, '這在程式裡長什麼樣子'),
        h('pre', { class: 'ctlpre' }, 'forever\n  error = target heading − Gyro heading\n  correction = Kp × error\n  left speed = base speed − correction\n  right speed = base speed + correction\n  wait 0.02 seconds'),
        h('p', { class: 'sub' }, '這是概念示意，不是能直接貼上的程式：積木要用「變數」和「運算」積木拼出來，正負號要依你的機器人轉向調整。先在實驗裡找到合理的 Kp，再到真機上微調。')));
  }

  /* ================= 實驗二：PID 轉向 90° =================
     模型：馬達有一點反應延遲（τ）。轉速 ω 追著「1.8 °/s × 輸出%」走，朝向 θ 是 ω 的累積。 */
  function simPid(P) {
    const dt = 0.01, T = 4, G = 1.8, TAU = 0.3, DB = 5, target = 90; // DB：馬達要超過 5% 的力量才推得動（靜摩擦）
    let th = 0, w = 0, I = 0, ePrev = target;
    const pts = [[0, 0]], us = [[0, 0]];
    let maxTh = 0, settle = 0;
    for (let i = 1; i <= T / dt; i++) {
      const e = target - th;
      if (Math.abs(e) < 30) I = clamp(I + e * dt, -40, 40); // 誤差還很大時不累加（避免積分失控）
      const D = (e - ePrev) / dt; ePrev = e;
      const u = clamp(P.kp * e + P.ki * I + P.kd * D, -100, 100);
      const ue = Math.abs(u) <= DB ? 0 : u - Math.sign(u) * DB;
      w += (G * ue - w) / TAU * dt;
      th += w * dt;
      const t = i * dt;
      pts.push([t, th]); us.push([t, u]);
      maxTh = Math.max(maxTh, th);
      if (Math.abs(target - th) > 2) settle = t;
    }
    return { pts, us, over: Math.max(0, (maxTh - target) / target * 100), settle: settle >= T - 0.02 ? null : settle, endErr: target - th };
  }
  function labPid() {
    const P = { kp: 1, ki: 0, kd: 0 };
    const box = h('div'), res = h('div', { class: 'ctlres' });
    const sKp = slider('Kp（比例）', 0, 10, 0.1, P.kp, '', (v) => { P.kp = v; draw(); });
    const sKi = slider('Ki（積分）', 0, 3, 0.05, P.ki, '', (v) => { P.ki = v; draw(); });
    const sKd = slider('Kd（微分）', 0, 0.6, 0.01, P.kd, '', (v) => { P.kd = v; draw(); });
    const preset = (name, kp, ki, kd) => h('button', { type: 'button', class: 'btn sm', onclick: () => { P.kp = kp; P.ki = ki; P.kd = kd; sKp.set(kp); sKi.set(ki); sKd.set(kd); draw(); } }, name);
    function draw() {
      const r = simPid(P);
      box.replaceChildren(chart([{ pts: r.pts, color: '#0875e2' }],
        { w: 640, h: 250, xmin: 0, xmax: 4, ymin: 0, ymax: 140, xlab: '時間 (秒)', ylab: '朝向 (度)', hline: [90], band: [88, 92], label: 'PID 轉向 90 度的回應曲線' }),
      legend([['#0875e2', '機器人朝向'], ['#8a97a8', '目標 90°（綠帶＝誤差 ±2° 內）', true]]));
      const msg = r.over > 25 ? '過衝很多：衝過頭又拉回來。試著降低 Kp，或加一點 Kd。' : r.settle == null ? '4 秒內還沒穩定在目標附近：Kp 太小（太慢），或停在差一點的地方，試試加一點 Ki。' : r.over > 8 ? '有點過衝，不過還能接受。加一點 Kd 會更穩。' : '又快又穩！';
      res.replaceChildren(h('div', { class: 'ctlstats' },
        h('div', null, h('b', null, Math.round(r.over)), '%', h('small', null, '過衝（衝過目標）')),
        h('div', null, h('b', null, r.settle == null ? '—' : r.settle.toFixed(2)), r.settle == null ? '' : ' 秒', h('small', null, '穩定時間')),
        h('div', null, h('b', null, (Math.round(r.endErr * 10) / 10)), '°', h('small', null, '最後誤差'))),
        h('p', { class: 'ctlverdict' }, msg));
    }
    draw();
    return h('div', null,
      h('p', null, '要讓機器人「原地轉 90 度」停得又快又準，常用 ', h('b', null, 'PID'), ' 三個旋鈕：'),
      h('ul', null,
        h('li', null, h('b', null, 'P（比例）'), '：離目標越遠，推越用力。太大會衝過頭。'),
        h('li', null, h('b', null, 'I（積分）'), '：把「一直沒修掉的小誤差」累加起來，慢慢推到 0。太大會越推越過頭。'),
        h('li', null, h('b', null, 'D（微分）'), '：看誤差縮小得多快，太快就踩煞車，減少衝過頭。')),
      h('div', { class: 'panel ctlctrl' }, sKp, sKi, sKd, h('div', { class: 'row gap' }, preset('Kp 小', 0.5, 0, 0), preset('Kp 很大', 6, 0, 0), preset('P + D', 3, 0, 0.15), preset('P + I + D', 1, 0.2, 0.2))),
      res, box,
      h('div', { class: 'panel' }, h('h3', null, '試試看'),
        h('ol', null,
          h('li', null, '只用 P：Kp = 0.5 很慢，而且停在差 10° 左右的地方（馬達力量太小推不動）；Kp = 6 衝過頭再回來。'),
          h('li', null, '保持 Kp = 3，慢慢加 Kd：過衝變小、更快穩定。'),
          h('li', null, 'Kp = 0.5、Kd = 0.1 時，慢慢加 Ki：最後誤差被「累加」推到接近 0。')),
        h('p', { class: 'sub' }, '比賽中大多數人只用 P，或 P + D 就夠了。重點是理解「為什麼會衝過頭」與「怎麼調」。真機上要用「改一個、測一次、記錄」的方式微調，並寫進工程筆記。')));
  }

  /* ================= 實驗三：里程計 ================= */
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function odo(steps, C, track, slip, seed, useGyro) {
    const ideal = [[0, 0]], real = [[0, 0]];
    let ix = 0, iy = 0, ith = 0, rx = 0, ry = 0, rth = 0;
    const rand = rng(seed);
    steps.forEach(([revL, revR]) => {
      const dL = revL * C, dR = revR * C;
      const ds = (dL + dR) / 2, dth = (dR - dL) / track;
      ix += ds * Math.cos(ith + dth / 2); iy += ds * Math.sin(ith + dth / 2); ith += dth;
      const eL = (rand() * 2 - 1) * slip / 100, eR = (rand() * 2 - 1) * slip / 100;
      const sL = dL * (1 + eL), sR = dR * (1 + eR);
      const rds = (sL + sR) / 2, rdth = useGyro ? dth : (sR - sL) / track; // 有 Gyro：朝向用真實值，不受打滑影響
      rx += rds * Math.cos(rth + rdth / 2); ry += rds * Math.sin(rth + rdth / 2); rth += rdth;
      ideal.push([ix, iy]); real.push([rx, ry]);
    });
    return { ideal, real, err: Math.hypot(ix - rx, iy - ry), ith: ith * R2D, rth: rth * R2D };
  }
  function labOdo() {
    const S = { C: 200, track: 180, slip: 3, seed: 7, gyro: false, steps: [] };
    const turnRev = (deg, dir) => (deg / R2D) * S.track / 2 / S.C * dir; // 原地轉：兩輪各走相反的距離
    const sq = () => { const o = []; for (let i = 0; i < 4; i++) { o.push([1.5, 1.5]); const t = turnRev(90, 1); o.push([-t, t]); } return o; };
    S.steps = sq();
    const rows = h('div', { class: 'ctlrows' }), box = h('div'), res = h('div', { class: 'ctlres' });
    const numIn = (v, label, on) => { const i = h('input', { type: 'number', step: '0.05', min: '-100', max: '100', style: 'width:84px', 'aria-label': label }); i.value = String(Math.round(v * 1000) / 1000); i.addEventListener('input', () => { const x = parseFloat(i.value); if (isFinite(x)) on(clamp(x, -100, 100)); }); return i; };
    function drawRows() {
      rows.replaceChildren(h('div', { class: 'ctlrow ctlhead' }, h('span', null, '步驟'), h('span', null, '左輪圈數'), h('span', null, '右輪圈數'), h('span', null, '')),
        ...S.steps.map((st, i) => h('div', { class: 'ctlrow' }, h('span', null, String(i + 1)),
          numIn(st[0], '左輪圈數', (x) => { st[0] = x; draw(); }), numIn(st[1], '右輪圈數', (x) => { st[1] = x; draw(); }),
          h('button', { type: 'button', class: 'btn sm', title: '刪除這一步', 'aria-label': '刪除這一步', onclick: () => { S.steps.splice(i, 1); drawRows(); draw(); } }, '✕'))));
    }
    function draw() {
      const r = odo(S.steps, S.C, S.track, S.slip, S.seed, S.gyro);
      const all = r.ideal.concat(r.real);
      let xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
      const pad = 80, xmin = Math.min(...xs, 0) - pad, xmax = Math.max(...xs, 1) + pad, ymin = Math.min(...ys, 0) - pad, ymax = Math.max(...ys, 1) + pad;
      box.replaceChildren(chart([{ pts: r.ideal, color: '#1f9d55', dash: '6 4', w: 2 }, { pts: r.real, color: '#d33a3a' }],
        { w: 420, h: 300, xmin, xmax, ymin, ymax, equal: true, xlab: 'x (mm)', ylab: 'y (mm)', label: '里程計路徑：理想與打滑後' }),
      legend([['#1f9d55', '理想（沒有打滑）', true], ['#d33a3a', S.gyro ? '有打滑，朝向用 Gyro 校正' : '有打滑，只靠輪子推算']]));
      res.replaceChildren(h('div', { class: 'ctlstats' },
        h('div', null, h('b', null, Math.round(r.err)), ' mm', h('small', null, '終點誤差')),
        h('div', null, h('b', null, Math.round(r.ith)), '°', h('small', null, '理想朝向變化')),
        h('div', null, h('b', null, Math.round(r.rth)), '°', h('small', null, '推算朝向變化'))),
      h('p', { class: 'ctlverdict' }, S.slip === 0 ? '沒有打滑時，推算和理想完全一樣。把「打滑」調大看看。' : S.gyro ? '加了 Gyro 校正朝向：誤差小很多，剩下的是前進距離的小誤差。' : '誤差一步步累積，所以終點歪掉了。勾選「用 Gyro 校正朝向」試試。'));
    }
    const sSlip = slider('打滑／輪徑誤差（每一步隨機 ±）', 0, 10, 0.5, S.slip, ' %', (v) => { S.slip = v; draw(); });
    const sC = slider('輪子周長', 150, 260, 5, S.C, ' mm', (v) => { S.C = v; draw(); });
    const sT = slider('輪距（兩輪中心的距離）', 120, 260, 5, S.track, ' mm', (v) => { S.track = v; draw(); });
    const cb = h('input', { type: 'checkbox' }); cb.setAttribute('aria-label', '用 Gyro 校正朝向');
    cb.addEventListener('change', () => { S.gyro = cb.checked; draw(); });
    const btn = (t, f) => h('button', { type: 'button', class: 'btn sm', onclick: f }, t);
    drawRows(); draw();
    return h('div', null,
      h('p', null, h('b', null, '里程計（odometry）'), '：用兩個輪子各轉了多少，一步一步推算機器人的位置和朝向。公式只有兩條：'),
      h('ul', null,
        h('li', null, '前進距離 = (左輪走的 + 右輪走的) ÷ 2'),
        h('li', null, '轉的角度（弧度）= (右輪走的 − 左輪走的) ÷ 輪距'),
        h('li', null, '輪子走的距離 = 圈數 × 周長（還記得「輪子與走多遠」那一課嗎？）')),
      h('div', { class: 'panel ctlctrl' }, sC, sT, sSlip, h('label', { class: 'check' }, cb, h('span', null, '用 Gyro 校正朝向（朝向不受打滑影響）')),
        h('div', { class: 'row gap' }, btn('走正方形', () => { S.steps = sq(); drawRows(); draw(); }), btn('走直線', () => { S.steps = [[5, 5]]; drawRows(); draw(); }),
          btn('弧形（右輪走比較遠）', () => { S.steps = [[1, 1.4], [1, 1.4], [1, 1.4], [1, 1.4]]; drawRows(); draw(); }),
          btn('新增一步', () => { S.steps.push([1, 1]); drawRows(); draw(); }), btn('換一次運氣', () => { S.seed = (S.seed * 7 + 13) % 100000; draw(); }))),
      res, h('div', { class: 'ctlcharts' }, box, h('div', null, h('h4', null, '每一步輪子轉了幾圈（可以改）'), rows)),
      h('div', { class: 'panel' }, h('h3', null, '試試看'),
        h('ol', null,
          h('li', null, '「走正方形」：打滑 0% 時回到起點；調到 3～5%，終點就歪了。'),
          h('li', null, '勾選「用 Gyro 校正朝向」：誤差大幅變小。這就是比賽隊伍常把輪子和 Gyro 一起用的原因。'),
          h('li', null, '「弧形」：右輪走比較遠，機器人往左繞圈（呼應題庫的「右輪走比較遠會往哪轉」）。'),
          h('li', null, '改「輪距」：同樣的圈數，轉的角度跟著改變。真機上要量準輪距。')),
        h('p', { class: 'sub' }, '想一想：為什麼走越久、誤差越大？（提示：每一步的小誤差會累積。）有些隊伍會用牆壁、白線或距離感測器，每隔一段就「重新對位」把誤差歸零。')));
  }


  /* ================= 角度繞回、走到座標、方向鎖定 =================
     朝向的約定（跟 VEXcode 的 Gyro 一樣）：0–360°，向右（順時針）轉會變大。畫圖時 0° 是正上方，90° 是右邊。 */
  const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
  const norm360 = (a) => ((a % 360) + 360) % 360;

  function labWrap() {
    const S = { cur: 10, tar: 350 };
    const box = h('div'), res = h('div', { class: 'ctlres' });
    function dial() {
      const W = 220, C = 110, Rr = 86;
      const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + W, class: 'ctlchart ctldial', role: 'img', 'aria-label': '朝向羅盤：目前與目標' });
      svg.append(sv('circle', { cx: C, cy: C, r: Rr, fill: 'var(--card)', stroke: 'var(--line)', 'stroke-width': 2 }));
      [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']].forEach(([a, t]) => {
        const x = C + (Rr + 12) * Math.sin(a / R2D), y = C - (Rr + 12) * Math.cos(a / R2D);
        svg.append(sv('text', { x, y: y + 3, 'text-anchor': 'middle', class: 'ctltick' }, t));
      });
      const needle = (deg, col, w) => svg.append(sv('line', { x1: C, y1: C, x2: C + Rr * Math.sin(deg / R2D), y2: C - Rr * Math.cos(deg / R2D), stroke: col, 'stroke-width': w, 'stroke-linecap': 'round' }));
      needle(S.tar, '#f97316', 4); needle(S.cur, '#0875e2', 4);
      svg.append(sv('circle', { cx: C, cy: C, r: 5, fill: '#1b2430' }));
      return svg;
    }
    function draw() {
      const raw = S.tar - S.cur, e = wrap180(raw);
      box.replaceChildren(dial(), legend([['#0875e2', '現在的朝向（Gyro）：' + S.cur + '°'], ['#f97316', '目標朝向：' + S.tar + '°']]));
      const dir = e === 0 ? '不用轉' : e > 0 ? '向右轉 ' + e + '°' : '向左轉 ' + (-e) + '°';
      res.replaceChildren(h('div', { class: 'ctlstats' },
        h('div', null, h('b', null, raw), '°', h('small', null, '直接相減（目標 − 現在）')),
        h('div', null, h('b', null, e), '°', h('small', null, '角度繞回後（−180～180）')),
        h('div', null, h('b', null, Math.abs(e)), '°', h('small', null, '最短要轉'))),
        h('p', { class: 'ctlverdict' }, '最短的轉法：' + dir + (Math.abs(raw) > 180 ? '。⚠ 直接相減會讓機器人繞遠路！' : '。')));
    }
    const sC = slider('現在的朝向', 0, 359, 1, S.cur, '°', (v) => { S.cur = v; draw(); });
    const sT = slider('目標朝向', 0, 359, 1, S.tar, '°', (v) => { S.tar = v; draw(); });
    const ex = (name, c, t) => h('button', { type: 'button', class: 'btn sm', onclick: () => { S.cur = c; S.tar = t; sC.set(c); sT.set(t); draw(); } }, name);
    draw();
    return h('div', null,
      h('p', null, 'Gyro 的朝向是 0～360°，轉到 360° 會「繞回」0°。如果直接用「目標 − 現在」當誤差，目標 350°、現在 10° 時誤差是 340°——機器人會往錯的方向轉一大圈！正確做法是把誤差換算到 −180° ～ +180°：'),
      h('pre', { class: 'ctlpre' }, 'error = target − current\nif error > 180:  error = error − 360\nif error < −180: error = error + 360'),
      h('div', { class: 'panel ctlctrl' }, sC, sT, h('div', { class: 'row gap' }, ex('350° ← 10°（要往回轉）', 10, 350), ex('90° ← 80°', 80, 90), ex('10° ← 350°', 350, 10), ex('180° ← 0°（正後方）', 0, 180))),
      res, h('div', { class: 'ctlcharts' }, box),
      h('div', { class: 'panel' }, h('h3', null, '試試看'),
        h('ol', null,
          h('li', null, '按「350° ← 10°」：直接相減是 340°，但最短其實是向左轉 20°。'),
          h('li', null, '把兩根針慢慢拉開：直接相減超過 180° 的時候，就要小心。'),
          h('li', null, '到「走到座標」實驗，把「使用角度繞回處理」關掉，看機器人怎麼繞大圈。'))));
  }

  // 走到座標：x 向右、y 向上，朝向 0° 是正上方（順時針變大）
  function simGoto(P) {
    const dt = 0.02, T = 14, VMAX = 300, WMAX = 180, VMIN = 35;
    let x = P.x0 || 0, y = P.y0 || 0, hd = norm360(P.h0);
    const pts = [[x, y]]; let t = 0, spun = 0, reached = false, maxH = 0;
    while (t < T) {
      const dx = P.tx - x, dy = P.ty - y, dist = Math.hypot(dx, dy);
      if (dist < 8) { reached = true; break; }
      const target = norm360(Math.atan2(dx, dy) * R2D);
      const herr = P.wrap ? wrap180(target - hd) : target - hd; // 沒做角度繞回：直接相減（可能是 ±340° 這種大數字）
      maxH = Math.max(maxH, Math.abs(herr));
      const w = clamp(P.kh * herr, -WMAX, WMAX);
      let v = clamp(P.kd * dist, 0, VMAX);
      v = P.mode === 'turn' ? (Math.abs(herr) < 8 ? Math.max(v, VMIN) : 0) : Math.max(v * Math.max(0, Math.cos(herr / R2D)), Math.cos(herr / R2D) > 0 ? VMIN : 0);
      hd = norm360(hd + w * dt); spun += Math.abs(w * dt);
      x += v * Math.sin(hd / R2D) * dt; y += v * Math.cos(hd / R2D) * dt;
      t += dt; pts.push([x, y]);
    }
    return { pts, time: t, reached, end: Math.hypot(P.tx - x, P.ty - y), spun, maxH };
  }

  function labGoto() {
    const P = { tx: -100, ty: 500, h0: 10, kh: 2, kd: 1, mode: 'blend', wrap: true, x0: 0, y0: 0 };
    const box = h('div'), res = h('div', { class: 'ctlres' });
    function draw() {
      const r = simGoto(P);
      const cross = [{ pts: [[P.tx - 25, P.ty], [P.tx + 25, P.ty]], color: '#f97316', w: 3 }, { pts: [[P.tx, P.ty - 25], [P.tx, P.ty + 25]], color: '#f97316', w: 3 }];
      const xs = r.pts.map((p) => p[0]).concat([P.tx, 0]), ys = r.pts.map((p) => p[1]).concat([P.ty, 0]);
      const pad = 80, xmin = Math.min(...xs) - pad, xmax = Math.max(...xs) + pad, ymin = Math.min(...ys) - pad, ymax = Math.max(...ys) + pad;
      box.replaceChildren(chart([{ pts: r.pts, color: '#0875e2' }].concat(cross), { w: 460, h: 320, xmin, xmax, ymin, ymax, equal: true, xlab: 'x (mm)', ylab: 'y (mm)', label: '走到指定座標的路徑' }),
        legend([['#0875e2', '機器人走過的路'], ['#f97316', '目標點']]));
      const v = !r.reached ? '⚠ 14 秒內沒有到達：試著把 Kh（轉向）或 Kd（前進）調大，或打開「角度繞回」。' : !P.wrap && r.spun > 300 ? '沒有角度繞回：機器人轉了一大圈才對準目標！' : r.end > 20 ? '快到了但有點偏。' : '到達目標！';
      res.replaceChildren(h('div', { class: 'ctlstats' },
        h('div', null, h('b', null, r.time.toFixed(1)), ' 秒', h('small', null, '花的時間')),
        h('div', null, h('b', null, Math.round(r.end)), ' mm', h('small', null, '離目標的距離')),
        h('div', null, h('b', null, Math.round(r.spun)), '°', h('small', null, '總共轉了幾度'))),
        h('p', { class: 'ctlverdict' }, v));
    }
    const sx = slider('目標 x', -600, 600, 25, P.tx, ' mm', (v) => { P.tx = v; draw(); });
    const sy = slider('目標 y', -300, 800, 25, P.ty, ' mm', (v) => { P.ty = v; draw(); });
    const sh = slider('一開始的朝向', 0, 359, 1, P.h0, '°', (v) => { P.h0 = v; draw(); });
    const sKh = slider('Kh（轉向有多用力）', 0.5, 6, 0.1, P.kh, '', (v) => { P.kh = v; draw(); });
    const sKd = slider('Kd（前進速度比例）', 0.2, 3, 0.1, P.kd, '', (v) => { P.kd = v; draw(); });
    const cb = h('input', { type: 'checkbox' }); cb.checked = true; cb.setAttribute('aria-label', '使用角度繞回處理');
    cb.addEventListener('change', () => { P.wrap = cb.checked; draw(); });
    const modeBtns = [['blend', '邊走邊轉'], ['turn', '先轉再走']].map(([k, name]) => {
      const b = h('button', { type: 'button', class: 'btn sm' + (P.mode === k ? ' primary' : ''), onclick: () => { P.mode = k; modeBtns.forEach((x) => x.b.classList.toggle('primary', x.k === k)); draw(); } }, name);
      return { k, b };
    });
    draw();
    return h('div', null,
      h('p', null, '知道自己在哪（里程計）之後，就能「走到指定座標」。每一刻算兩件事：目標在哪個方向？還有多遠？再用兩組回授——', h('b', null, '朝向誤差'), '決定怎麼轉，', h('b', null, '距離誤差'), '決定走多快。靠近目標時距離誤差變小，機器人就會自然變慢。'),
      h('div', { class: 'panel ctlctrl' }, sx, sy, sh, sKh, sKd,
        h('label', { class: 'check' }, cb, h('span', null, '使用角度繞回處理（關掉看看會怎樣）')),
        h('div', { class: 'row gap' }, modeBtns.map((x) => x.b),
          h('button', { type: 'button', class: 'btn sm', onclick: () => { P.tx = -100; P.ty = 500; P.h0 = 10; sx.set(-100); sy.set(500); sh.set(10); draw(); } }, '目標在左前方（朝向 10°）'),
          h('button', { type: 'button', class: 'btn sm', onclick: () => { P.tx = 0; P.ty = -300; P.h0 = 0; sx.set(0); sy.set(-300); sh.set(0); draw(); } }, '目標在正後方'))),
      res, h('div', { class: 'ctlcharts' }, box),
      h('div', { class: 'panel' }, h('h3', null, '試試看'),
        h('ol', null,
          h('li', null, '預設：目標在左前方、機器人朝向 10°。正確處理時只要向左轉一點就能出發。'),
          h('li', null, '把「使用角度繞回處理」關掉：誤差變成 340°，機器人往右轉一大圈才對準。'),
          h('li', null, '比較「邊走邊轉」和「先轉再走」：前者比較快、路線是弧形；後者路線直、好預測，但要先停下來轉。'),
          h('li', null, '把 Kh 調得很大或很小，看看對準的快慢。把 Kd 調大：衝得比較快，靠近時才會減速。'))),
      h('div', { class: 'panel' }, h('h3', null, '這在程式裡長什麼樣子'),
        h('pre', { class: 'ctlpre' }, 'forever\n  dx = target x − x ;  dy = target y − y\n  distance = √(dx² + dy²)\n  heading error = wrap(angle to target − Gyro heading)\n  turn = Kh × heading error\n  speed = Kd × distance\n  left = speed + turn ;  right = speed − turn   (limit to ±100)\n  update x, y from wheel odometry\n  wait 0.02 seconds'),
        h('p', { class: 'sub' }, '概念示意，不是能直接貼上的程式。真機上的 x、y 要靠里程計（輪子圈數、輪周、輪距）並用 Gyro 校正朝向，正負號要依機器人調整。')));
  }

  function labLock() {
    const P = { drift: 2, kp: 3, kick: 15, on: true };
    const box = h('div'), res = h('div', { class: 'ctlres' });
    function draw() {
      const a = simStraight({ drift: P.drift, kp: P.kp, on: true, kick: P.kick }), b = simStraight({ drift: P.drift, kp: 0, on: false, kick: P.kick });
      const lim = Math.max(150, Math.ceil(Math.max(a.maxOff, b.maxOff) / 50) * 50);
      box.replaceChildren(
        h('div', { class: 'ctlcharts' },
          h('div', null, h('h4', null, '從上面看機器人走的路'), chart([{ pts: b.path, color: '#d33a3a', dash: '6 4' }, { pts: a.path, color: '#0875e2' }], { w: 420, h: 220, xmin: 0, xmax: 1800, ymin: -lim, ymax: lim, xlab: '前進 (mm)', ylab: '橫向偏移 (mm)', hline: [0], label: '方向鎖定的路徑' })),
          h('div', null, h('h4', null, 'Gyro 朝向誤差'), chart([{ pts: b.err, color: '#d33a3a', dash: '6 4' }, { pts: a.err, color: '#0875e2' }], { w: 420, h: 220, xmin: 0, xmax: 6, ymin: -30, ymax: 30, xlab: '時間 (秒)', ylab: '朝向誤差 (度)', hline: [0], label: '朝向誤差隨時間變化' }))),
        legend([['#0875e2', '按下方向鎖定'], ['#d33a3a', '沒有鎖定（對照）', true]]));
      res.replaceChildren(h('div', { class: 'ctlstats' },
        h('div', null, h('b', null, Math.round(a.maxOff)), ' mm', h('small', null, '有鎖定：最大橫向偏移')),
        h('div', null, h('b', null, Math.round(b.maxOff)), ' mm', h('small', null, '沒鎖定：最大橫向偏移')),
        h('div', null, h('b', null, (Math.round(a.endErr * 10) / 10)), '°', h('small', null, '有鎖定：結束時朝向誤差'))),
        h('p', { class: 'ctlverdict' }, P.kick ? '第 2 秒機器人被撞了一下（朝向突然偏 ' + P.kick + '°）：有鎖定的會自己轉回來，沒鎖定的就一路歪下去。' : '把「被撞一下」調大看看。'));
    }
    const sd = slider('漂移', 0, 6, 0.5, P.drift, ' °/秒', (v) => { P.drift = v; draw(); });
    const sk = slider('第 2 秒被撞一下（朝向突然偏）', 0, 30, 1, P.kick, '°', (v) => { P.kick = v; draw(); });
    const sp = slider('Kp（修正有多用力）', 0.5, 8, 0.5, P.kp, '', (v) => { P.kp = v; draw(); });
    draw();
    return h('div', null,
      h('p', null, '遙控駕駛時，推著搖桿也很難一直保持直線。很多隊伍會加一個「', h('b', null, '方向鎖定'), '」：按下按鈕的那一刻，記住目前朝向當目標；之後只要偏了，程式就用 Gyro 自動把機器人轉回來。這就是前面學的回授，用在遙控上。'),
      h('div', { class: 'panel ctlctrl' }, sd, sk, sp),
      res, box,
      h('div', { class: 'panel' }, h('h3', null, '這在程式裡長什麼樣子'),
        h('pre', { class: 'ctlpre' }, 'when button pressed:  target = Gyro heading ;  lock = on\nwhen button released:  lock = off\nforever\n  if lock is on:\n    correction = Kp × wrap(target − Gyro heading)\n  else:\n    correction = 0\n  left = forward − correction ;  right = forward + correction   (limit to ±100)\n  wait 0.05 seconds'),
        h('p', { class: 'sub' }, '概念示意。實際的積木要用「變數」「如果」「運算」拼出來；按鈕事件、Gyro 校準都要記得做。上傳你的遙控存檔，本站也會提醒你有沒有用到 Gyro。')),
      h('div', { class: 'panel' }, h('h3', null, '三個容易忘的小細節'),
        h('ul', null,
          h('li', null, h('b', null, '限幅'), '：算出來的速度要限制在 −100% ～ 100%，超過沒有意義。'),
          h('li', null, h('b', null, '迴圈週期'), '：每圈最後等 0.02～0.05 秒，讓感測器更新、馬達有時間反應，修正才穩。'),
          h('li', null, h('b', null, '校準'), '：程式一開始要校準 Gyro 並等它完成，校準時機器人要靜止不動。'))));
  }

  VX.ctl = { simStraight, simPid, odo, simGoto, wrap180 }; // 給自動測試用

  /* ================= 頁面 ================= */
  const TABS = [['p', '🧭 走直線（P 控制）', labStraight], ['pid', '🎚️ PID 轉向', labPid], ['odo', '🛞 里程計', labOdo], ['wrap', '🔄 角度繞回', labWrap], ['goto', '📍 走到座標', labGoto], ['lock', '🔒 遙控方向鎖定', labLock]];
  VX.routes.control = (tab) => {
    const cur = TABS.find((t) => t[0] === tab) || TABS[0];
    const nav = h('div', { class: 'row gap', style: 'margin:10px 0' }, TABS.map(([k, n]) => h('a', { class: 'btn sm' + (k === cur[0] ? ' primary' : ''), href: '#/control/' + k }, n)));
    VX.app.replaceChildren(VX.shell(h('div', { class: 'ctl' },
      h('div', { class: 'panel' }, h('h2', null, '🧪 控制實驗室'),
        h('p', null, '進階主題：機器人怎麼「走得直」「轉得準」「知道自己在哪」「走到指定位置」。這裡用互動小實驗看懂概念，不用寫程式。'),
        h('div', { class: 'callout warn' }, '這些是簡化的模型：數字（速度、延遲、打滑）是假設值，不是你機器人的真實數據。概念要理解，參數要在真機上測。')),
      nav, cur[2](),
      h('div', { class: 'panel' }, h('h3', null, '學完做什麼'),
        h('p', null, '回到「練習」，會出現「走直線與回授」「里程計與誤差累積」「走到指定座標」三個進階技能的題目。也別忘了把真機的測試寫進工程筆記。'),
        h('div', { class: 'row gap' }, h('a', { class: 'btn primary', href: '#/practice' }, '去練習'), h('a', { class: 'btn', href: '#/notebook' }, '工程筆記'), h('a', { class: 'btn', href: '#/compete' }, '回比賽專區')))),
    { title: '控制實驗室', icon: '🧪' }));
  };
})();
