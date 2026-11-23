/* 網頁模擬器：用 VEXcode 風格積木寫程式，在挑戰場地上看虛擬機器人跑。
   物理是簡化的（理想的差速機器人、速度與轉速是假設值），真機一定要再實測。 */
(function () {
  'use strict';
  const VX = window.VX;
  const { h, shell, blocksEl, toast, api } = VX;

  /* ================= 模擬引擎 ================= */
  const DT = 20;            // 每個時間刻 20 ms
  const SPD = 400;          // 驅動速度 100% 時的 mm/s（假設）
  const TSPD = 180;         // 轉彎速度 100% 時的 度/s（假設）
  const R = 90;             // 機器人碰撞半徑 mm
  const MAXT = 120000;      // 最長模擬 120 秒
  const CELL = 200;
  const HEAD = { E: 0, S: 90, W: 180, N: 270 };

  function makeWorld(ch) {
    if (!ch) return { cols: 6, rows: 4, start: { x: 100, y: 700, th: 0 }, goal: null, walls: [], colors: [], ch: null };
    return {
      cols: ch.cols, rows: ch.rows, ch,
      start: { x: ch.start.c * CELL, y: ch.start.r * CELL, th: HEAD[ch.start.dir] },
      goal: { x: ch.goal.c * CELL, y: ch.goal.r * CELL },
      walls: ch.walls.map((w) => [w.c * CELL, w.r * CELL, CELL, CELL]),
      colors: (ch.colors || []).map((k) => ({ x: k.c * CELL, y: k.r * CELL, color: k.color })),
    };
  }

  function simulate(program, world) {
    const prog = Array.isArray(program) ? program : (program.main || []);
    const defs = Array.isArray(program) ? [] : (program.defs || []);
    const W = world.cols * CELL, H = world.rows * CELL;
    const C = { x: world.start.x, y: world.start.y, th: world.start.th, dv: 50, tv: 50, cv: 0, vars: {}, hits: 0, touching: false, bump: false, time: 0, dist: 0, timeout: false, scope: null, depth: 0, screen: { rows: [], cr: 1, cc: 1 }, screenLog: [], sounds: [], rot: 0, rotOff: 0, hOff: world.start.th, cturn: 0, timerOff: 0 };
    const collide = (x, y) => {
      if (x - R < 0 || x + R > W || y - R < 0 || y + R > H) return true;
      for (const [rx, ry, rw, rh] of world.walls) {
        const nx = Math.max(rx, Math.min(x, rx + rw)), ny = Math.max(ry, Math.min(y, ry + rh));
        if ((x - nx) ** 2 + (y - ny) ** 2 < R * R) return true;
      }
      return false;
    };
    // 沿著車頭方向移動 d（可為負）；撞到就停在碰到之前。回傳實際移動量。
    C.move = (d) => {
      const rad = (C.th * Math.PI) / 180, sgn = d < 0 ? -1 : 1;
      let moved = 0, left = Math.abs(d), hit = false;
      while (left > 1e-9) {
        const s = Math.min(1, left), nx = C.x + Math.cos(rad) * s * sgn, ny = C.y + Math.sin(rad) * s * sgn;
        if (collide(nx, ny)) { hit = true; break; }
        C.x = nx; C.y = ny; moved += s; left -= s;
      }
      C.dist += moved;
      if (hit) { if (!C.touching) { C.hits++; C.touching = true; } C.bump = sgn > 0; } else { C.touching = false; C.bump = false; }
      C.hitNow = hit;
      return moved * sgn;
    };
    C.sensor = () => { // 車頭前方到障礙的距離（mm）
      const rad = (C.th * Math.PI) / 180, fx = C.x + Math.cos(rad) * R, fy = C.y + Math.sin(rad) * R;
      for (let d = 0; d <= 2000; d += 2) {
        const px = fx + Math.cos(rad) * d, py = fy + Math.sin(rad) * d;
        if (px < 0 || px > W || py < 0 || py > H) return d;
        for (const [rx, ry, rw, rh] of world.walls) if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) return d;
      }
      return 2000;
    };
    const colorAt = () => { const c = Math.floor(C.x / CELL), r = Math.floor(C.y / CELL); const k = (world.colors || []).find((z) => Math.floor(z.x / CELL) === c && Math.floor(z.y / CELL) === r); return k ? k.color : 'none'; };
    function sensorVal(k) {
      switch (k) {
        case 'dist': return C.sensor();
        case 'heading': return (((C.th - C.hOff) % 360) + 360) % 360;
        case 'rotation': return C.rot - C.rotOff;
        case 'timer': return (C.ticks * DT) / 1000 - C.timerOff;
        default: return 0;
      }
    }
    function ev(x) {
      if (x == null) return 0;
      if (typeof x !== 'object') return val(x);
      switch (x.e) {
        case 'sensor': return sensorVal(x.k);
        case 'var': return val(x.name);
        case 'math': { const a = ev(x.a), b = ev(x.b); switch (x.op) { case '+': return a + b; case '-': return a - b; case '*': return a * b; default: return b === 0 ? 0 : a / b; } }
        case 'cmp': { const a = ev(x.a), b = ev(x.b); switch (x.op) { case '<': return +(a < b); case '>': return +(a > b); case '<=': return +(a <= b); case '>=': return +(a >= b); default: return +(Math.abs(a - b) < 1e-9); } }
        case 'logic': return x.op === 'or' ? +(!!ev(x.a) || !!ev(x.b)) : +(!!ev(x.a) && !!ev(x.b));
        case 'not': return +!ev(x.a);
        case 'bumper': return +!!C.bump;
        case 'found': return +(C.sensor() < 1500);
        case 'color': return +(colorAt() === x.color);
        default: return 0;
      }
    }
    function val(v) {
      if (v && typeof v === 'object') return ev(v);
      const n = parseFloat(v); if (!isNaN(n)) return n;
      const key = String(v).trim(); if (C.scope && key in C.scope) return C.scope[key]; return C.vars[key] || 0;
    }
    const cond = (c) => {
      if (!c) return false;
      if (!c.e && c.k === 'bump') return !!C.bump;
      if (!c.e && c.k === 'dist') { const d = C.sensor(), v = val(c.v); switch (c.op) { case '>': return d > v; case '>=': return d >= v; case '<=': return d <= v; case '==': return d === v; default: return d < v; } }
      return !!ev(c);
    };
    function* exec(list) { for (const b of list) yield* one(b); }
    function* loopTick(body, t0) { /* 迴圈本體沒花任何時間時，補一個時間刻，避免當機 */ if (C.ticks === t0) yield; }
    function* one(b) {
      const prevBid = C.bid;
      if (b && b._bid) C.bid = b._bid;
      C.nBlocks = (C.nBlocks || 0) + 1;
      try {
        switch (b.t) {
          case 'drive': {
            const target = Math.abs(val(b.v)), dir = (b.dir === '反向' || b.dir === 'reverse') ? -1 : 1, spd = (C.dv / 100) * SPD;
            let moved = 0;
            if (spd <= 0) return;
            while (moved < target - 1e-9) {
              const step = Math.min((spd * DT) / 1000, target - moved);
              moved += Math.abs(C.move(dir * step));
              if (C.hitNow) break;
              yield;
            }
            return;
          }
          case 'drivec': C.cv = ((b.dir === '反向' || b.dir === 'reverse') ? -1 : 1) * (C.dv / 100) * SPD; return;
          case 'stop': C.cv = 0; C.cturn = 0; return;
          case 'turnc': C.cturn = ((b.dir === '左邊' || b.dir === 'left') ? -1 : 1) * (C.tv / 100) * TSPD; return;
          case 'calibrate': C.hOff = C.th; C.rotOff = C.rot; for (let i = 0; i < 100; i++) yield; return;
          case 'resettimer': C.timerOff = (C.ticks * DT) / 1000; return;
          case 'vel': C.dv = Math.max(0, Math.min(100, val(b.v))); return;
          case 'tvel': C.tv = Math.max(0, Math.min(100, val(b.v))); return;
          case 'turn': {
            const ang = Math.abs(val(b.v)), sgn = (b.dir === '正確的' || b.dir === 'right') ? 1 : -1, rate = (C.tv / 100) * TSPD;
            let t = 0;
            if (rate <= 0) return;
            while (t < ang - 1e-9) { const s = Math.min((rate * DT) / 1000, ang - t); C.th = (C.th + sgn * s + 360) % 360; C.rot += sgn * s; t += s; yield; }
            return;
          }
          case 'wait': { const n = Math.round((val(b.v) * 1000) / DT); for (let i = 0; i < n; i++) yield; return; }
          case 'repeat': { const n = Math.min(1000, Math.max(0, Math.floor(val(b.v)))); for (let i = 0; i < n; i++) { const t0 = C.ticks; yield* exec(b.kids); yield* loopTick(null, t0); } return; }
          case 'forever': while (true) { const t0 = C.ticks; yield* exec(b.kids); yield* loopTick(null, t0); } return;
          case 'until': while (!cond(b.cond)) { const t0 = C.ticks; yield* exec(b.kids); yield* loopTick(null, t0); } return;
          case 'while': while (cond(b.cond)) { const t0 = C.ticks; yield* exec(b.kids); yield* loopTick(null, t0); } return;
          case 'if': if (cond(b.cond)) yield* exec(b.kids); else yield* exec(b.elseKids || []); return;
          case 'call': {
            const d = defs.find((x) => x.name === b.name);
            if (!d || C.depth >= 20) return;
            const sc = {}; (d.params || []).forEach((p, i) => { sc[p] = val((b.args || [])[i]); });
            const old = C.scope; C.scope = sc; C.depth++;
            yield* exec(d.kids || []);
            C.depth--; C.scope = old; return;
          }
          case 'print': {
            if (b.v && typeof b.v === 'object') { putText(String(Math.round(val(b.v) * 100) / 100)); return; }
            const t = String(b.v == null ? '' : b.v).trim();
            const isVar = (C.scope && t in C.scope) || (t in C.vars);
            putText(isVar ? String(Math.round(val(t) * 100) / 100) : String(b.v == null ? '' : b.v)); return;
          }
          case 'cursor': C.screen.cr = Math.max(1, Math.min(ROWS, Math.floor(val(b.row)) || 1)); C.screen.cc = Math.max(1, Math.min(COLS, Math.floor(val(b.col)) || 1)); return;
          case 'nextrow': C.screen.cr = Math.min(ROWS, C.screen.cr + 1); C.screen.cc = 1; return;
          case 'clearall': C.screen.rows = []; C.screen.cr = 1; C.screen.cc = 1; shot(); return;
          case 'sound': { const nm = b.snd || 'siren'; const same = C.sounds.filter((x) => x.tick === C.ticks); if (C.sounds.length < 40 && same.length < 2 && !same.some((x) => x.name === nm)) C.sounds.push({ tick: C.ticks, name: nm }); return; }
          case 'setvar': C.vars[String(b.name).trim()] = val(b.v); return;
          case 'chvar': C.vars[String(b.name).trim()] = (C.vars[String(b.name).trim()] || 0) + val(b.v); return;
          default: return;
        }
      } finally {
        C.bid = prevBid;
      }
    }
    const ROWS = 8, COLS = 24;
    const shot = () => C.screenLog.push({ tick: C.ticks, rows: C.screen.rows.slice() });
    const putText = (txt) => {
      const sc = C.screen; while (sc.rows.length < sc.cr) sc.rows.push('');
      let row = (sc.rows[sc.cr - 1] || '').padEnd(sc.cc - 1, ' ');
      row = (row.slice(0, sc.cc - 1) + txt + row.slice(sc.cc - 1 + txt.length)).slice(0, COLS);
      sc.rows[sc.cr - 1] = row; sc.cc += txt.length; shot();
    };
    C.ticks = 0; C.bid = '';
    const frames = [[C.x, C.y, C.th, '']];
    const gen = exec(prog);
    let finished = false;
    while (C.ticks < MAXT / DT) {
      const r = gen.next();
      if (C.cv) { const m = C.move(C.cv * DT / 1000); if (C.hitNow) C.cv = 0; }
      if (C.cturn) { const dd = C.cturn * DT / 1000; C.th = (C.th + dd + 360) % 360; C.rot += dd; }
      C.ticks++; C.time = C.ticks * DT;
      frames.push([C.x, C.y, C.th, C.bid || '']);
      if (r.done) { finished = true; break; }
    }
    if (!finished) C.timeout = true;
    return { frames, C, world };
  }

  function judge(res) {
    const { frames, C, world } = res, ch = world.ch;
    const secs = (C.time / 1000).toFixed(1);
    const out = { ok: false, msgs: [], secs, dist: Math.round(C.dist) };
    if (C.timeout) out.msgs.push('⏱ 超過 120 秒還沒結束（是不是有「永遠」或條件一直不成立？）');
    if (C.hits && !(world.ch && world.ch.allowHit)) out.msgs.push('💥 撞到牆或障礙 ' + C.hits + ' 次');
    if (!ch && !world.goal) { out.msgs.push('自由練習：沒有目標，看看機器人走去哪裡了。'); out.free = true; return out; }
    const TOL = 100;
    const last = frames[frames.length - 1];
    if (ch && (ch.mode === 'waypoints' || (ch.goal && ch.goal.c === ch.start.c && ch.goal.r === ch.start.r))) {
      const wps = (ch.path || []).map(([c, r]) => [c * CELL, r * CELL]);
      let wi = 0;
      for (const f of frames) { while (wi < wps.length && Math.hypot(f[0] - wps[wi][0], f[1] - wps[wi][1]) <= TOL) wi++; }
      if (wi >= wps.length) out.ok = true; else out.msgs.push('路線沒有走完：第 ' + (wi + 1) + ' 個轉角／終點沒到達（參考路線的第 ' + (wi + 1) + ' 個點）');
    } else if (world.goal) {
      const d = Math.hypot(last[0] - world.goal.x, last[1] - world.goal.y);
      out.goalDist = Math.round(d);
      if (d <= TOL) out.ok = true; else out.msgs.push('離旗子還差約 ' + out.goalDist + ' mm（需要在 ' + TOL + ' mm 內）');
    }
    if (out.ok && ((ch && ch.walls && ch.walls.length) || (!ch && world.walls.length)) && C.hits && !(ch && ch.allowHit)) { out.ok = false; out.msgs.push('這題不能碰到障礙'); }
    if (out.ok && C.timeout) out.ok = false;
    return out;
  }

  function tagBids(prog, defs) {
    let n = 0;
    // 用不可列舉屬性：不會被 JSON.stringify／clone 帶進存檔（避免撐大進度資料）
    const walk = (list) => (list || []).forEach((b) => { Object.defineProperty(b, '_bid', { value: 'b' + (++n), writable: true, configurable: true, enumerable: false }); if (b.kids) walk(b.kids); if (b.elseKids) walk(b.elseKids); });
    (defs || []).forEach((d) => walk(d.kids));
    walk(prog);
  }
  function countBlocks(prog, defs) {
    let n = 0;
    const walk = (list) => (list || []).forEach((b) => { n++; if (b.kids) walk(b.kids); if (b.elseKids) walk(b.elseKids); });
    (defs || []).forEach((d) => { n++; walk(d.kids); });
    walk(prog);
    return n;
  }
  function calcStars(ch, prog, defs, res, usedRef) {
    const j = res && (res.j || judge(res));
    if (!j || !j.ok) return 0;
    if (usedRef) return 1;
    const myN = countBlocks(prog, defs);
    let refN = 99;
    if (ch && ch.code) {
      const parsed = parseDsl(ch.code);
      if (parsed) refN = countBlocks(parsed.main, parsed.defs);
    }
    const compact = myN <= refN + 1;
    const precise = j.goalDist == null ? true : j.goalDist <= 40;
    return compact && precise ? 3 : compact ? 2 : 1;
  }

  /* 模擬失敗時的教練診斷提示（純函式，方便測試） */
  function diagnoseFail(res, ch) {
    if (!res || !ch) return [];
    const { frames, C, world } = res, j = res.j || judge(res);
    if (j.ok) return [];
    const tips = [];
    if (j.dist === 0 && !C.timeout && parseFloat(j.secs) === 0) {
      tips.push(C.nBlocks ? '程式有執行，但車子一動也沒動：檢查 while／if 的條件（< 和 > 有沒有寫反）或 drive 的距離是不是 0。' : '工作區裡還沒有讓車子動的積木，先從左邊拉一個 drive 積木試試看。');
      return tips;
    }
    if (C.timeout) tips.push('程式停不下來了：檢查看看 forever 或重複條件是不是永遠不會結束。');
    if (C.hits && !ch.allowHit) tips.push('撞到障礙或邊界了：試著縮短直走距離，或早一點轉彎繞開。');
    const isLoop = ch.mode === 'waypoints' || (ch.goal.c === ch.start.c && ch.goal.r === ch.start.r);
    if (isLoop) {
      if (j.dist < 100) tips.push('車子幾乎還沒移動，先確認有放 drive 積木並填上距離（每格 200 mm）。');
      else tips.push('試著勾選「顯示參考路線」，對照看看車子是在哪一個轉彎偏掉（角度或邊長）。');
    } else if (world.goal && frames.length) {
      const last = frames[frames.length - 1];
      const d0 = Math.hypot(world.start.x - world.goal.x, world.start.y - world.goal.y);
      const d = Math.hypot(last[0] - world.goal.x, last[1] - world.goal.y);
      if (d > d0 + 50) tips.push('車子離旗子反而變遠了！檢查看看轉彎方向（left／right）或前進／後退有沒有相反。');
      else if (d > 100 && j.dist > 0) tips.push('方向有接近旗子了！再微調一下距離（每格是 200 mm）或轉彎角度。');
    }
    return tips;
  }

  /* 過關後找下一個相關的類似挑戰（優先同技能且還沒過關） */
  function pickNextChallenge(ch, stCh) {
    if (!ch || typeof CHALLENGES === 'undefined') return null;
    const done = (id) => !!(stCh && stCh[id] && (stCh[id].sim || stCh[id].done));
    const idx = CHALLENGES.findIndex((c) => c.id === ch.id);
    const skills = new Set(ch.skills || []);
    const others = CHALLENGES.filter((c) => c.id !== ch.id);
    const sameUndone = others.find((c) => !done(c.id) && (c.skills || []).some((s) => skills.has(s)));
    if (sameUndone) return sameUndone;
    if (idx >= 0 && idx + 1 < CHALLENGES.length) return CHALLENGES[idx + 1];
    return others.find((c) => !done(c.id)) || null;
  }

  /* DSL → 積木資料（載入參考解答用；也拿來自動驗證）。回傳 { main, defs }；遇到不支援的積木回傳 null。 */
  function parseBlocks(lines, defNames) {
    const items = lines.map((ln) => ({ ind: (ln.match(/^ */)[0].length / 2) | 0, t: ln.trim() })).filter((x) => x.t && !/^何時開始/.test(x.t));
    let i = 0;
    const build = (level) => {
      const out = [];
      while (i < items.length && items[i].ind >= level) {
        const it = items[i++]; let b = null, m;
        if ((m = it.t.match(/^驅動 \[(向前|反向)\] 為 \((.+?)\)/))) b = { t: 'drive', dir: m[1], v: m[2] };
        else if ((m = it.t.match(/^驅動 \[(向前|反向)\]$/))) b = { t: 'drivec', dir: m[1] };
        else if ((m = it.t.match(/^旋轉 \[(.+?)\] 度 \((.+?)\) 度/))) b = { t: 'turn', dir: m[1], v: m[2] };
        else if (/^停止駕駛/.test(it.t)) b = { t: 'stop' };
        else if ((m = it.t.match(/^等待 \((.+?)\) 秒/))) b = { t: 'wait', v: m[1] };
        else if ((m = it.t.match(/^將驅動速度設定為 \((.+?)\)/))) b = { t: 'vel', v: m[1] };
        else if ((m = it.t.match(/^重複 \((.+?)\)$/))) b = { t: 'repeat', v: m[1], kids: [] };
        else if (/^永遠/.test(it.t)) b = { t: 'forever', kids: [] };
        else if ((m = it.t.match(/^而 <距離 ([<>]) (\d+) 毫米>/))) b = { t: 'while', cond: { k: 'dist', op: m[1], v: m[2] }, kids: [] };
        else if ((m = it.t.match(/^重複直到 <距離 ([<>]) (\d+) 毫米>/))) b = { t: 'until', cond: { k: 'dist', op: m[1], v: m[2] }, kids: [] };
        else if (/^重複直到 <碰撞開關被按下>/.test(it.t)) b = { t: 'until', cond: { e: 'bumper' }, kids: [] };
        else if ((m = it.t.match(/^重複直到 <看到(紅色|綠色|藍色|黃色)>/))) b = { t: 'until', cond: { e: 'color', color: { 紅色: 'red', 綠色: 'green', 藍色: 'blue', 黃色: 'yellow' }[m[1]] }, kids: [] };
        else if ((m = it.t.match(/^(\S+) \((.*)\)$/)) && defNames.includes(m[1])) b = { t: 'call', name: m[1], args: m[2].split(',').map((x) => x.trim()) };
        else return null;
        if (b.kids && i < items.length && items[i].ind > it.ind) { const k = build(it.ind + 1); if (!k) return null; b.kids = k; }
        out.push(b);
      }
      return out;
    };
    return build(0);
  }
  function parseDsl(lines) {
    const defLines = [], mainLines = [], defHeads = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^定義 (\S+) \((.*)\)$/);
      if (m) {
        const body = []; i++;
        while (i < lines.length && /^ /.test(lines[i])) { body.push(lines[i].slice(2)); i++; }
        i--; defHeads.push({ name: m[1], params: m[2].split(',').map((x) => x.trim()).filter(Boolean) }); defLines.push(body);
      } else mainLines.push(lines[i]);
    }
    const names = defHeads.map((d) => d.name), defs = [];
    for (let k = 0; k < defHeads.length; k++) { const kids = parseBlocks(defLines[k], names); if (!kids) return null; defs.push({ name: defHeads[k].name, params: defHeads[k].params, kids }); }
    const main = parseBlocks(mainLines, names);
    return main ? { main, defs } : null;
  }

  /* ===== 類別與積木（仿 VEXcode IQ Blocks：Scratch 風格配色）===== */
  // supported=false 的類別只展示外觀（模擬器還不能用）
  const CATS = [
    { id: 'drive', en: 'Drivetrain', zh: '傳動系統', desc: '控制機器人前進、後退、轉彎與速度。', color: '#1873e0', sections: [
      { en: 'Drivetrain - Actions', zh: '傳動系統 - 動作', items: ['drive', 'drivec', 'turn', 'turnc', 'stop'] },
      { en: 'Drivetrain - Settings', zh: '傳動系統 - 設定', items: ['vel', 'tvel'] }] },
    { id: 'looks', en: 'Looks', zh: '外觀', desc: '在 Brain 螢幕印出文字、數字或清空畫面。', color: '#9966ff', sections: [
      { en: 'Looks', zh: '外觀（Brain 螢幕）', items: ['print', 'cursor', 'nextrow', 'clearall'] }] },
    { id: 'sound', en: 'Sound', zh: '聲音', desc: '讓 Brain 播放提示音或音效。', color: '#cf63cf', sections: [
      { en: 'Sound', zh: '聲音', items: ['sound'] }] },
    { id: 'events', en: 'Events', zh: '事件', desc: '決定程式什麼時候開始執行（when started）。', color: '#ffbf00', info: 'events', sections: [] },
    { id: 'control', en: 'Control', zh: '控制', desc: '等待、重複迴圈與如果（if）條件判斷。', color: '#ffab19', sections: [
      { en: 'Control', zh: '控制', items: ['wait', 'repeat', 'forever', 'until', 'while', 'if'] }] },
    { id: 'sensing', en: 'Sensing', zh: '感測', desc: '讀取距離、顏色、碰撞、陀螺儀與計時器。', color: '#5cb1d6', sections: [{ en: 'Sensing', zh: '感測', items: ['calibrate', 'resettimer'], exprs: ['bumper', 'found', 'color', 'sdist', 'sheading', 'srotation', 'stimer'] }] },
    { id: 'operators', en: 'Operators', zh: '運算', desc: '加減乘除、大小比較與「且／或／非」邏輯。', color: '#59c059', sections: [{ en: 'Operators', zh: '運算', exprs: ['math', 'cmp', 'logic', 'not'] }] },
    { id: 'var', en: 'Variables', zh: '變數', desc: '用來記住會變動的數字（例如分數、距離）。', color: '#ff8c1a', sections: [
      { en: 'Variables', zh: '變數', items: ['setvar', 'chvar'], exprs: ['varref'] }] },
    { id: 'my', en: 'My Blocks', zh: '我的積木', desc: '把常用的一組積木包起來，之後重複使用。', color: '#ff6680', sections: [] },
    { id: 'comments', en: 'Comments', zh: '註解', desc: '在程式旁寫筆記提醒自己（模擬器不執行）。', color: '#b3b3b3', info: 'comments', sections: [] },
  ];
  const BLOCK_CLASS = { drive: 'b-drive', drivec: 'b-drive', turn: 'b-drive', stop: 'b-drive', vel: 'b-drive', tvel: 'b-drive',
    print: 'b-looks', cursor: 'b-looks', nextrow: 'b-looks', clearall: 'b-looks', sound: 'b-sound',
    wait: 'b-control', repeat: 'b-control', forever: 'b-control', until: 'b-control', while: 'b-control', if: 'b-control', else: 'b-control', turnc: 'b-drive', calibrate: 'b-sense', resettimer: 'b-sense',
    setvar: 'b-var', chvar: 'b-var', call: 'b-my', define: 'b-my hat', hat: 'b-event hat' };
  const LOOPY = { repeat: 1, forever: 1, until: 1, while: 1 };
  const DIRL = {
    dir: { en: [['forward', 'forward'], ['reverse', 'reverse']], zh: [['forward', '向前'], ['reverse', '反向']] },
    turn: { en: [['right', 'right'], ['left', 'left']], zh: [['right', '正確的'], ['left', '左邊']] },
    snd: { en: [['siren', 'siren'], ['tada', 'tada'], ['doorbell', 'doorbell'], ['ribbit', 'ribbit']], zh: [['siren', '警笛'], ['tada', '噹噹'], ['doorbell', '門鈴'], ['ribbit', '呱呱']] },
  };
  const DIR_FIX = { '向前': 'forward', '反向': 'reverse', '左邊': 'left', '正確的': 'right' };
  function normDirs(list) { (list || []).forEach((b) => { if (b.dir && DIR_FIX[b.dir]) b.dir = DIR_FIX[b.dir]; if (b.cond && !b.cond.e && b.cond.k) b.cond = normCond(b.cond); if (b.kids) normDirs(b.kids); if (b.elseKids) normDirs(b.elseKids); }); return list; }
  const CONDL = { en: { dist: 'distance (mm)', bump: 'bumper pressed?' }, zh: { dist: '距離', bump: '碰撞開關被按下' } };
  const CC = { c: 1 };
  const TPL = {
    drive: { en: ['drive', { s: 'dir' }, 'for', { n: 'v' }, 'mm'], zh: ['驅動', { s: 'dir' }, '為', { n: 'v' }, '毫米'] },
    drivec: { en: ['drive', { s: 'dir' }], zh: ['驅動', { s: 'dir' }] },
    turn: { en: ['turn', { s: 'turn' }, 'for', { n: 'v' }, 'degrees'], zh: ['旋轉', { s: 'turn' }, '度', { n: 'v' }, '度'] },
    stop: { en: ['stop driving'], zh: ['停止駕駛'] },
    turnc: { en: ['turn', { s: 'turn' }], zh: ['轉', { s: 'turn' }] },
    calibrate: { en: ['calibrate Gyro'], zh: ['校準陀螺儀'] },
    resettimer: { en: ['reset timer'], zh: ['重置計時器'] },
    vel: { en: ['set drive velocity to', { n: 'v' }, '%'], zh: ['將驅動速度設定為', { n: 'v' }, '%'] },
    tvel: { en: ['set turn velocity to', { n: 'v' }, '%'], zh: ['將轉彎速度設定為', { n: 'v' }, '%'] },
    print: { en: ['print', { n: 'v', w: 76 }], zh: ['在螢幕上列印', { n: 'v', w: 76 }] },
    cursor: { en: ['set cursor to row', { n: 'row', w: 36 }, 'column', { n: 'col', w: 36 }], zh: ['將游標設定到第', { n: 'row', w: 36 }, '行第', { n: 'col', w: 36 }, '列'] },
    nextrow: { en: ['set cursor to next row'], zh: ['將游標設定到下一行'] },
    clearall: { en: ['clear all rows'], zh: ['清除所有行'] },
    sound: { en: ['play sound', { s: 'snd', k: 'snd' }], zh: ['播放聲音', { s: 'snd', k: 'snd' }] },
    wait: { en: ['wait', { n: 'v' }, 'seconds'], zh: ['等待', { n: 'v' }, '秒'] },
    repeat: { en: ['repeat', { n: 'v' }], zh: ['重複', { n: 'v' }] },
    forever: { en: ['forever'], zh: ['永遠'] },
    until: { en: ['repeat until', CC], zh: ['重複直到', CC] },
    while: { en: ['while', CC], zh: ['而', CC] },
    if: { en: ['if', CC, 'then'], zh: ['如果', CC, '則'] },
    else: { en: ['else'], zh: ['別的'] },
    setvar: { en: ['set', { n: 'name', w: 66 }, 'to', { n: 'v' }], zh: ['將', { n: 'name', w: 66 }, '設定為', { n: 'v' }] },
    chvar: { en: ['change', { n: 'name', w: 66 }, 'by', { n: 'v' }], zh: ['將', { n: 'name', w: 66 }, '改為', { n: 'v' }] },
    hat: { en: ['when started'], zh: ['何時開始'] },
  };
  // 停留 1 秒顯示的中文白話說明
  const DESC = {
    turnc: '開始一直轉彎，不會自己停——要用「停止駕駛」才會停。常搭配陀螺儀：轉到指定角度再停。', calibrate: '校準陀螺儀（機器人要靜止不動）。校準之後，「航向」從 0 度開始算。', resettimer: '把計時器歸零，從現在重新開始算秒數。',
    drive: '前進（或後退）指定的距離，走完才做下一個積木。', drivec: '開始一直往前（或後退），不會自己停——要用「停止駕駛」才會停。',
    turn: '原地轉指定的角度。right ＝ 向右、left ＝ 向左。', stop: '讓機器人停止移動。',
    vel: '設定直走的速度。只影響快慢，不會改變走多遠。', tvel: '設定轉彎的速度。',
    print: '把文字（或變數的值）印在 Brain 的螢幕上。右邊的「Brain」分頁看得到。', cursor: '決定下一次 print 要印在螢幕的第幾行、第幾列。', nextrow: '把游標移到下一行的開頭。', clearall: '清掉 Brain 螢幕上所有文字。',
    sound: '讓 Brain 發出聲音。',
    wait: '讓程式暫停幾秒，再繼續。', repeat: '裡面的積木重複做指定的次數。', forever: '裡面的積木一直重複，不會結束。',
    until: '一直重複，直到條件成立為止。', while: '條件成立的期間，一直重複。', if: '條件成立才做裡面的積木。', else: '上面的「if」條件不成立時，做這裡的積木。',
    setvar: '把變數直接設成某個數字。', chvar: '把變數增加（或減少）某個數字。',
    hat: '程式從這裡開始執行。沒接在它底下的積木不會自動跑。', call: '呼叫你自己做的積木（My Block）。', define: '定義一個新積木：把一組積木包成一個，之後可以重複使用。',
  };
  const labelOf = (pairs, v) => { const p = pairs.find((x) => x[0] === v); return p ? p[1] : v; };
  /* ===== 運算式（感測器、比較、算術、且／或／非）===== */
  const SENS = { dist: { en: 'Distance object distance in mm', zh: '距離感測器 物體距離（毫米）' }, heading: { en: 'Gyro heading in degrees', zh: '陀螺儀 航向（度）' }, rotation: { en: 'Gyro rotation in degrees', zh: '陀螺儀 旋轉（度）' }, timer: { en: 'Brain timer in seconds', zh: 'Brain 計時器（秒）' } };
  const COLORS = [['red', '紅色'], ['green', '綠色'], ['blue', '藍色'], ['yellow', '黃色']];
  const COLORHEX = { red: '#ff9b9b', green: '#8fe0a3', blue: '#9bbcff', yellow: '#ffe680' };
  const colorName = (c, lg) => (lg === 'zh' ? (COLORS.find((x) => x[0] === c) || [0, c])[1] : c);
  const EXK = { sensor: 'num', math: 'num', var: 'num', cmp: 'bool', logic: 'bool', not: 'bool', bumper: 'bool', found: 'bool', color: 'bool' };
  const EXCLS = { sensor: 'b-sense', bumper: 'b-sense', found: 'b-sense', color: 'b-sense', math: 'b-op', cmp: 'b-op', logic: 'b-op', not: 'b-op', var: 'b-var' };
  const EXPROTO = { bumper: () => ({ e: 'bumper' }), found: () => ({ e: 'found' }), color: () => ({ e: 'color', color: 'red' }), sdist: () => ({ e: 'sensor', k: 'dist' }), sheading: () => ({ e: 'sensor', k: 'heading' }), srotation: () => ({ e: 'sensor', k: 'rotation' }), stimer: () => ({ e: 'sensor', k: 'timer' }), math: () => ({ e: 'math', op: '+', a: '0', b: '0' }), cmp: () => ({ e: 'cmp', op: '<', a: '0', b: '0' }), logic: () => ({ e: 'logic', op: 'and', a: null, b: null }), not: () => ({ e: 'not', a: null }) };
  const DESCE = { sdist: '前方物體到感測器的距離（毫米）。常放在比較積木的左邊，例如「距離 < 150」。', sheading: '機器人現在面向的角度（0～360 度），校準後從 0 度開始，向右轉會增加。', srotation: '機器人累積轉了多少度（向右轉加、向左轉減），可以超過 360。', stimer: '從程式開始（或上次重置）到現在經過的秒數。', bumper: '碰撞開關有沒有被按下（機器人撞到東西）。', found: '距離感測器有沒有看到前方的物體。', color: '顏色感測器現在看到的地板顏色是不是這個顏色。', math: '兩個數字做加、減、乘、除。', cmp: '比較兩個數字，結果是「真」或「假」。', logic: '「且」＝兩邊都要成立；「或」＝只要有一邊成立。', not: '把「真」變成「假」，「假」變成「真」。', var: '變數現在的值。' };
  const descOfExpr = (x) => { if (x.e === 'sensor') return DESCE[{ dist: 'sdist', heading: 'sheading', rotation: 'srotation', timer: 'stimer' }[x.k]]; return DESCE[x.e] || ''; };
  function fv(v, lg) { return v && typeof v === 'object' ? exprStr(v, lg) : (v == null ? '' : String(v)); }
  function exprStr(x, lg) {
    if (x == null) return '   ';
    if (typeof x !== 'object') return String(x);
    if (!x.e && x.k) return x.k === 'bump' ? CONDL[lg].bump : CONDL[lg].dist + ' ' + x.op + ' ' + x.v + (lg === 'zh' ? ' 毫米' : '');
    switch (x.e) {
      case 'sensor': return SENS[x.k][lg];
      case 'var': return x.name;
      case 'bumper': return lg === 'zh' ? '碰撞開關被按下？' : 'Bumper pressed?';
      case 'found': return lg === 'zh' ? '距離感測器找到物體？' : 'Distance found an object?';
      case 'color': return lg === 'zh' ? '顏色感測器看到 ' + colorName(x.color, lg) + '？' : 'Color sees ' + x.color + '?';
      case 'math': case 'cmp': return fv(x.a, lg) + ' ' + x.op + ' ' + fv(x.b, lg);
      case 'logic': return exprStr(x.a, lg) + ' ' + (lg === 'zh' ? (x.op === 'or' ? '或' : '且') : x.op) + ' ' + exprStr(x.b, lg);
      case 'not': return (lg === 'zh' ? '非 ' : 'not ') + exprStr(x.a, lg);
      default: return '?';
    }
  }
  const condStr = (c, lg) => exprStr(c, lg);
  function normCond(c) { if (!c || c.e || !c.k) return c; return c.k === 'bump' ? { e: 'bumper' } : { e: 'cmp', op: c.op === '==' ? '=' : c.op, a: { e: 'sensor', k: 'dist' }, b: String(c.v) }; }
  const tkKey = (tk) => tk.k || 'dir';
  function tokText(b, lang) {
    if (b.t === 'call') return b.name + ((b.args || []).length ? ' ' + b.args.map((a) => fv(a, lang)).join(', ') : '');
    return TPL[b.t][lang].map((tk) => (typeof tk === 'string' ? tk : tk.s ? labelOf(DIRL[tk.s][lang], b[tkKey(tk)]) : tk.n ? fv(b[tk.n], lang) : condStr(b.cond, lang))).join(' ');
  }
  const newBlock = (t, name, defsList) => {
    if (t === 'call') { const d = (defsList || []).find((x) => x.name === name); return { t: 'call', name, args: ((d && d.params) || []).map(() => '100') }; }
    const d = { drive: { dir: 'forward', v: '200' }, drivec: { dir: 'forward' }, turn: { dir: 'right', v: '90' }, stop: {}, turnc: { dir: 'right' }, calibrate: {}, resettimer: {}, vel: { v: '50' }, tvel: { v: '50' },
      print: { v: 'Hello' }, cursor: { row: '1', col: '1' }, nextrow: {}, clearall: {}, sound: { snd: 'siren' }, wait: { v: '1' },
      repeat: { v: '4', kids: [] }, forever: { kids: [] }, until: { cond: null, kids: [] }, while: { cond: null, kids: [] },
      if: { cond: null, kids: [], elseKids: [] }, setvar: { name: 'score', v: '0' }, chvar: { name: 'score', v: '1' } }[t];
    return Object.assign({ t }, JSON.parse(JSON.stringify(d)));
  };
  function toText(list, ind, lang) {
    ind = ind || ''; lang = lang || 'en'; const out = [];
    list.forEach((b) => {
      out.push(ind + tokText(b, lang));
      if (b.kids) out.push(toText(b.kids, ind + '  ', lang));
      if (b.t === 'if' && b.elseKids && b.elseKids.length) { out.push(ind + TPL.else[lang][0]); out.push(toText(b.elseKids, ind + '  ', lang)); }
    });
    return out.filter(Boolean).join('\n');
  }
  function programText(prog, defs, lang) {
    lang = lang || 'en'; const parts = [];
    (defs || []).forEach((d) => { parts.push((lang === 'zh' ? '定義 ' : 'define ') + d.name + (d.params.length ? ' (' + d.params.join(', ') + ')' : '')); parts.push(toText(d.kids, '  ', lang)); });
    parts.push(TPL.hat[lang][0]); parts.push(toText(prog, '', lang)); return parts.filter(Boolean).join('\n');
  }

  /* ===== 積木 → 文字程式（Python / C++，仿 VEXcode 程式碼檢視器；僅為示意）===== */
  const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const safeId = (s) => (IDENT.test(s) ? s : 'v_' + String(s).replace(/[^A-Za-z0-9_]/g, '_'));
  let cgLang = 'py';
  function exprCode(x) {
    const py = cgLang === 'py';
    if (x == null) return py ? 'False' : 'false';
    if (typeof x !== 'object') return valOf(x);
    if (!x.e && x.k) return x.k === 'bump' ? (py ? 'bumper.pressed()' : 'Bumper.pressing()') : (py ? 'distance.object_distance(MM) ' : 'Distance.objectDistance(mm) ') + x.op + ' ' + valOf(x.v);
    switch (x.e) {
      case 'sensor': return { dist: py ? 'distance.object_distance(MM)' : 'Distance.objectDistance(mm)', heading: py ? 'brain_inertial.heading(DEGREES)' : 'BrainInertial.heading(degrees)', rotation: py ? 'brain_inertial.rotation(DEGREES)' : 'BrainInertial.rotation(degrees)', timer: py ? 'brain.timer.time(SECONDS)' : 'Brain.Timer.time(seconds)' }[x.k];
      case 'var': return safeId(x.name);
      case 'bumper': return py ? 'bumper.pressed()' : 'Bumper.pressing()';
      case 'found': return py ? 'distance.found_object()' : 'Distance.foundObject()';
      case 'color': return py ? 'color_sensor.color() == Color.' + String(x.color).toUpperCase() : 'Color.color() == ' + x.color;
      case 'math': return '(' + valOf(x.a) + ' ' + x.op + ' ' + valOf(x.b) + ')';
      case 'cmp': return '(' + valOf(x.a) + ' ' + (x.op === '=' ? '==' : x.op) + ' ' + valOf(x.b) + ')';
      case 'logic': return '(' + exprCode(x.a) + (py ? (x.op === 'or' ? ' or ' : ' and ') : (x.op === 'or' ? ' || ' : ' && ')) + exprCode(x.b) + ')';
      case 'not': return py ? '(not ' + exprCode(x.a) + ')' : '(!' + exprCode(x.a) + ')';
      default: return '0';
    }
  }
  const valOf = (v) => { if (v && typeof v === 'object') return exprCode(v); const t = String(v == null ? '' : v).trim(); return /^-?\d+(\.\d+)?$/.test(t) ? t : (t === '' ? '0' : safeId(t)); };
  const blockNames = (defs) => { const m = {}; (defs || []).forEach((d, i) => { m[d.name] = IDENT.test(d.name) ? d.name : 'myBlock' + (i + 1); }); return m; };
  function collectRawVars(prog, defs) {
    const set = []; const walk = (l) => (l || []).forEach((b) => { if (b.t === 'setvar' || b.t === 'chvar') { const n = String(b.name == null ? '' : b.name).trim(); if (n && !set.includes(n)) set.push(n); } if (b.kids) walk(b.kids); if (b.elseKids) walk(b.elseKids); });
    walk(prog); (defs || []).forEach((d) => walk(d.kids)); return set;
  }
  function collectVars(prog, defs) {
    const set = []; collectRawVars(prog, defs).forEach((n) => { const id = safeId(n); if (!set.includes(id)) set.push(id); }); return set;
  }
  const printArg = (v) => { if (v && typeof v === 'object') return exprCode(v); const t = String(v == null ? '' : v).trim(); return /^-?\d+(\.\d+)?$/.test(t) ? t : (IDENT.test(t) && t !== 'Hello' && /^[a-z_]/.test(t) ? t : JSON.stringify(String(v == null ? '' : v))); };
  const HEAD_NOTE = '示意：用 VEXcode 把積木轉成文字程式，大概會長這樣（實際內容與裝置設定以 VEXcode 為準，這裡只是幫你預習）';
  function toPython(prog, defs) {
    cgLang = 'py';
    const vars = collectVars(prog, defs), nm = blockNames(defs);
    const cond = (c) => exprCode(c);
    const body = (list, ind) => {
      const pad = '    '.repeat(ind), out = [];
      list.forEach((b) => {
        const kids = (k, loop) => { const r = body(k || [], ind + 1); if (loop) r.push('    '.repeat(ind + 1) + 'wait(20, MSEC)'); return r.length ? r : ['    '.repeat(ind + 1) + 'pass']; };
        switch (b.t) {
          case 'drive': out.push(pad + 'drivetrain.drive_for(' + (b.dir === 'reverse' || b.dir === '反向' ? 'REVERSE' : 'FORWARD') + ', ' + valOf(b.v) + ', MM)'); break;
          case 'drivec': out.push(pad + 'drivetrain.drive(' + (b.dir === 'reverse' || b.dir === '反向' ? 'REVERSE' : 'FORWARD') + ')'); break;
          case 'turn': out.push(pad + 'drivetrain.turn_for(' + (b.dir === 'left' || b.dir === '左邊' ? 'LEFT' : 'RIGHT') + ', ' + valOf(b.v) + ', DEGREES)'); break;
          case 'stop': out.push(pad + 'drivetrain.stop()'); break;
          case 'vel': out.push(pad + 'drivetrain.set_drive_velocity(' + valOf(b.v) + ', PERCENT)'); break;
          case 'tvel': out.push(pad + 'drivetrain.set_turn_velocity(' + valOf(b.v) + ', PERCENT)'); break;
          case 'wait': out.push(pad + 'wait(' + valOf(b.v) + ', SECONDS)'); break;
          case 'repeat': out.push(pad + 'for repeat_count in range(int(' + valOf(b.v) + ')):', ...kids(b.kids, false)); break;
          case 'forever': out.push(pad + 'while True:', ...kids(b.kids, true)); break;
          case 'until': out.push(pad + 'while not (' + cond(b.cond) + '):', ...kids(b.kids, true)); break;
          case 'while': out.push(pad + 'while ' + cond(b.cond) + ':', ...kids(b.kids, true)); break;
          case 'if': out.push(pad + 'if ' + cond(b.cond) + ':', ...kids(b.kids, false)); if (b.elseKids && b.elseKids.length) out.push(pad + 'else:', ...kids(b.elseKids, false)); break;
          case 'setvar': out.push(pad + safeId(b.name) + ' = ' + valOf(b.v)); break;
          case 'chvar': out.push(pad + safeId(b.name) + ' = ' + safeId(b.name) + ' + ' + valOf(b.v)); break;
          case 'call': out.push(pad + (nm[b.name] || safeId(b.name)) + '(' + (b.args || []).map(valOf).join(', ') + ')'); break;
          case 'turnc': out.push(pad + 'drivetrain.turn(' + (b.dir === 'left' || b.dir === '左邊' ? 'LEFT' : 'RIGHT') + ')'); break;
          case 'calibrate': out.push(pad + 'brain_inertial.calibrate()'); break;
          case 'resettimer': out.push(pad + 'brain.timer.clear()'); break;
          case 'print': out.push(pad + 'brain.screen.print(' + printArg(b.v) + ')'); break;
          case 'cursor': out.push(pad + 'brain.screen.set_cursor(' + valOf(b.row) + ', ' + valOf(b.col) + ')'); break;
          case 'nextrow': out.push(pad + 'brain.screen.next_row()'); break;
          case 'clearall': out.push(pad + 'brain.screen.clear_screen()'); break;
          case 'sound': out.push(pad + 'brain.play_sound(SoundType.' + String(b.snd || 'siren').toUpperCase() + ')'); break;
          default: break;
        }
      });
      return out;
    };
    const fn = (head, list) => { const b2 = body(list, 1); return [head, ...(vars.length ? ['    global ' + vars.join(', ')] : []), ...(b2.length ? b2 : ['    pass']), '']; };
    const lines = ['# ' + HEAD_NOTE, ''];
    vars.forEach((v) => lines.push(v + ' = 0'));
    if (vars.length) lines.push('');
    (defs || []).forEach((d) => lines.push(...fn('def ' + nm[d.name] + '(' + d.params.map(safeId).join(', ') + '):', d.kids)));
    lines.push('# "when started" hat block', ...fn('def when_started1():', prog), 'when_started1()');
    return lines.join('\n');
  }
  function toCpp(prog, defs) {
    cgLang = 'cpp';
    const vars = collectVars(prog, defs), nm = blockNames(defs);
    const cond = (c) => exprCode(c);
    const body = (list, ind) => {
      const pad = '  '.repeat(ind), out = [];
      const block = (head, k, loop, ...tail) => { out.push(pad + head + ' {', ...body(k || [], ind + 1)); if (loop) out.push(pad + '  wait(20, msec);'); out.push(pad + '}' + (tail[0] || '')); };
      list.forEach((b) => {
        switch (b.t) {
          case 'drive': out.push(pad + 'Drivetrain.driveFor(' + (b.dir === 'reverse' || b.dir === '反向' ? 'reverse' : 'forward') + ', ' + valOf(b.v) + ', mm);'); break;
          case 'drivec': out.push(pad + 'Drivetrain.drive(' + (b.dir === 'reverse' || b.dir === '反向' ? 'reverse' : 'forward') + ');'); break;
          case 'turn': out.push(pad + 'Drivetrain.turnFor(' + (b.dir === 'left' || b.dir === '左邊' ? 'left' : 'right') + ', ' + valOf(b.v) + ', degrees);'); break;
          case 'stop': out.push(pad + 'Drivetrain.stop();'); break;
          case 'vel': out.push(pad + 'Drivetrain.setDriveVelocity(' + valOf(b.v) + ', percent);'); break;
          case 'tvel': out.push(pad + 'Drivetrain.setTurnVelocity(' + valOf(b.v) + ', percent);'); break;
          case 'wait': out.push(pad + 'wait(' + valOf(b.v) + ', seconds);'); break;
          case 'repeat': block('repeat(' + valOf(b.v) + ')', b.kids, false); break;
          case 'forever': block('while (true)', b.kids, true); break;
          case 'until': block('while (!(' + cond(b.cond) + '))', b.kids, true); break;
          case 'while': block('while (' + cond(b.cond) + ')', b.kids, true); break;
          case 'if':
            out.push(pad + 'if (' + cond(b.cond) + ') {', ...body(b.kids || [], ind + 1));
            if (b.elseKids && b.elseKids.length) out.push(pad + '} else {', ...body(b.elseKids, ind + 1));
            out.push(pad + '}'); break;
          case 'setvar': out.push(pad + safeId(b.name) + ' = ' + valOf(b.v) + ';'); break;
          case 'chvar': out.push(pad + safeId(b.name) + ' = ' + safeId(b.name) + ' + ' + valOf(b.v) + ';'); break;
          case 'call': out.push(pad + (nm[b.name] || safeId(b.name)) + '(' + (b.args || []).map(valOf).join(', ') + ');'); break;
          case 'turnc': out.push(pad + 'Drivetrain.turn(' + (b.dir === 'left' || b.dir === '左邊' ? 'left' : 'right') + ');'); break;
          case 'calibrate': out.push(pad + 'BrainInertial.calibrate();'); break;
          case 'resettimer': out.push(pad + 'Brain.Timer.clear();'); break;
          case 'print': out.push(pad + 'Brain.Screen.print(' + printArg(b.v) + ');'); break;
          case 'cursor': out.push(pad + 'Brain.Screen.setCursor(' + valOf(b.row) + ', ' + valOf(b.col) + ');'); break;
          case 'nextrow': out.push(pad + 'Brain.Screen.newLine();'); break;
          case 'clearall': out.push(pad + 'Brain.Screen.clearScreen();'); break;
          case 'sound': out.push(pad + 'Brain.playSound(' + String(b.snd || 'siren') + ');'); break;
          default: break;
        }
      });
      return out;
    };
    const lines = ['// ' + HEAD_NOTE, ''];
    vars.forEach((v) => lines.push('float ' + v + ';'));
    if (vars.length) lines.push('');
    (defs || []).forEach((d) => lines.push('void ' + nm[d.name] + '(' + d.params.map((p) => 'float ' + safeId(p)).join(', ') + ') {', ...body(d.kids, 1), '}', ''));
    lines.push('// "when started" hat block', 'int whenStarted1() {', ...body(prog, 1), '  return 0;', '}', '', 'int main() {', '  // Initializing Robot Configuration. DO NOT REMOVE!', '  vexcodeInit();', '  whenStarted1();', '}');
    return lines.join('\n');
  }

  /* ===== 只顯示、不能編輯的積木（匯入頁用）===== */
  function staticBlock(b, lg) {
    if (b.t === 'unsupported') return h('div', { class: 'blk b-other' }, h('span', null, b.label), h('span', { class: 'fd dd' }, lg === 'zh' ? '模擬器不支援' : 'not supported'));
    const kids = b.t === 'call' ? [b.name] : TPL[b.t][lg].map((tk) => (typeof tk === 'string' ? tk : tk.s ? h('span', { class: 'fd dd' }, labelOf(DIRL[tk.s][lg], b[tkKey(tk)])) : tk.n ? h('span', { class: 'fd num' }, fv(b[tk.n], lg)) : h('span', { class: 'fd bool' }, condStr(b.cond, lg))));
    return h('div', { class: 'blk ' + BLOCK_CLASS[b.t] }, kids);
  }
  function staticList(list, lg) {
    const box = h('div', { class: 'blist' });
    (list || []).forEach((b) => {
      box.append(h('div', { class: 'brow' }, staticBlock(b, lg)));
      if (b.kids) {
        const cls = (BLOCK_CLASS[b.t] || 'b-control').split(' ')[0];
        box.append(h('div', { class: 'cinner ' + cls }, staticList(b.kids, lg)));
        if (b.t === 'if') { box.append(h('div', { class: 'brow' }, staticBlock({ t: 'else' }, lg))); box.append(h('div', { class: 'cinner b-control' }, staticList(b.elseKids || [], lg))); }
        box.append(h('div', { class: 'brow' }, h('div', { class: 'cend ' + cls }, LOOPY[b.t] ? '↻' : '')));
      }
    });
    return box;
  }

  /* ================= 介面（參照 VEXcode IQ Blocks）================= */
  const SVG = {
    globe: '<svg viewBox="0 0 24 24" width="26" height="26"><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="2"/><ellipse cx="12" cy="12" rx="4" ry="9" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M3 12h18" stroke="#fff" stroke-width="1.6"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3z" fill="none" stroke="#fff" stroke-width="2"/><path d="M9.5 20h5" stroke="#fff" stroke-width="2"/></svg>',
    slot: '<svg viewBox="0 0 24 24" width="28" height="28"><rect x="3" y="3" width="18" height="18" rx="2" fill="#fff"/><text x="12" y="17" text-anchor="middle" font-size="14" font-weight="800" fill="#2d8ff3">1</text></svg>',
    hex: '<svg viewBox="0 0 24 24" width="22" height="22"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#fff"/></svg>',
    brain: '<svg viewBox="0 0 24 24" width="30" height="26"><rect x="2" y="6" width="20" height="12" rx="2" fill="#3ddc84"/><rect x="5" y="9" width="9" height="6" rx="1" fill="#0d3b22"/><circle cx="18" cy="12" r="1.6" fill="#0d3b22"/></svg>',
    download: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 3v11m0 0l-4-4m4 4l4-4M5 20h14" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M7 4l13 8-13 8z" fill="#fff"/></svg>',
    stop: '<svg viewBox="0 0 24 24" width="26" height="26"><rect x="5" y="5" width="14" height="14" rx="2" fill="#fff"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 12v7h14v-7M12 15V3m0 0l-4 4m4-4l4 4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    exit: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 5h16v11H9l-5 4z" fill="#fff"/></svg>',
    blocksIc: '<svg viewBox="0 0 28 24" width="30" height="26"><rect x="1" y="2" width="20" height="6" rx="2" fill="#2d8ff3"/><rect x="5" y="10" width="20" height="6" rx="2" fill="#2d8ff3"/><rect x="1" y="18" width="20" height="5" rx="2" fill="#2d8ff3"/></svg>',
    field: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 4v16M15 4v16M3 12h18" stroke="currentColor" stroke-width="1.4"/></svg>',
    screen: '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="5" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 21h8" stroke="currentColor" stroke-width="2"/></svg>',
    code: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    help: '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="10" fill="currentColor"/><text x="12" y="17" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">?</text></svg>',
  };
  const ico = (k) => h('span', { class: 'vxico', html: SVG[k] });
  let actx = null;
  function playSound(name) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      actx = actx || new AC(); if (actx.state === 'suspended') actx.resume();
      const pat = { siren: [[660, .25], [880, .25], [660, .25], [880, .25]], tada: [[523, .12], [659, .12], [784, .12], [1047, .45]], doorbell: [[880, .35], [659, .55]], ribbit: [[160, .12], [200, .12], [140, .22]] }[name] || [[600, .3]];
      let t = actx.currentTime;
      pat.forEach(([f, d]) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.value = 0.04; o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d); t += d; });
    } catch (e) { /* 沒聲音也沒關係 */ }
  }
  const BRAIN_ROWS = 8;

  function viewSim(chId) {
    const st = VX.st; st.sim = st.sim || {}; st.ch = st.ch || {}; st.customCh = Array.isArray(st.customCh) ? st.customCh : [];
    const key = chId || 'free';
    const ch = CHALLENGES.find((c) => c.id === chId) || st.customCh.find((c) => c.id === chId) || null;
    const world = makeWorld(ch);
    const saved = st.sim[key], clone = (o) => JSON.parse(JSON.stringify(o));
    let prog = Array.isArray(saved) ? clone(saved) : (saved && saved.main ? clone(saved.main) : []);
    let defs = saved && !Array.isArray(saved) && saved.defs ? clone(saved.defs) : [];
    if (!saved && ch && ch.starter) {
      const sp = parseDsl(ch.starter);
      if (sp) { prog = sp.main; defs = sp.defs; }
    }
    normDirs(prog); defs.forEach((d) => normDirs(d.kids));
    let lang = st.simLang === 'zh' ? 'zh' : 'en';
    let codeLang = st.simCode === 'cpp' ? 'cpp' : 'py';
    let target = prog, result = null, cat = 'drive', zoom = 0.95, rightTab = 'field', showRef = false, isSaved = true;
    let failStreak = 0, everFailed = false, usedRef = false, improvedBy = 0;
    let editMode = false, editTool = 'wall';
    const customWalls = [], customColors = [];
    let customGoal = null;
    const inTree = (arr, list) => list === arr || list.some((b) => (b.kids && inTree(arr, b.kids)) || (b.elseKids && inTree(arr, b.elseKids)));
    const targetValid = () => inTree(target, prog) || defs.some((d) => inTree(target, d.kids));
    const undoS = [], redoS = [];
    const snapStr = () => JSON.stringify({ prog, defs });
    const pushSnap = (str) => { undoS.push(str); if (undoS.length > 60) undoS.shift(); redoS.length = 0; };
    const snap = () => pushSnap(snapStr());
    const restore = (str) => { const o = JSON.parse(str); prog = o.prog; defs = o.defs; target = prog; selected = null; draw(); drawFly(true); persist(); };
    const doUndo = () => { if (!undoS.length) return toast('沒有可以復原的了'); redoS.push(snapStr()); restore(undoS.pop()); };
    const doRedo = () => { if (!redoS.length) return toast('沒有可以重做的了'); undoS.push(snapStr()); restore(redoS.pop()); };
    let saveTimer = 0;
    const persist = () => { clearTimeout(saveTimer); saveTimer = 0; st.sim[key] = { main: clone(prog), defs: clone(defs) }; VX.saveState(); isSaved = true; if (typeof savedEl !== 'undefined') savedEl.textContent = lang === 'en' ? 'Saved' : '已儲存'; };
    const scheduleSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { if (!isSaved) persist(); }, 1200); };

    const rail = h('nav', { class: 'vxrail2' });
    const fly = h('div', { class: 'vxfly2' });
    const wsInner = h('div', { class: 'vxws-inner' });
    const applyZoom = () => { wsInner.style.transform = zoom === 1 ? '' : 'scale(' + zoom + ')'; wsInner.style.transformOrigin = '0 0'; };
    const ws = h('div', { class: 'vxws2' }, wsInner);
    ws.addEventListener('pointerdown', (e) => { if (selected && !(e.target.closest && e.target.closest('.blk, .bsel, .addhere'))) { selected = null; draw(); } });
    const canvas = h('canvas', { class: 'simcanvas' });
    const resBox = h('div');
    const codeBox = h('div', { class: 'vxcode' });
    const brainEl = h('div', { class: 'vxbrain' });
    const timeEl = h('span', { class: 'vxtime' }, '0.0 秒');
    const savedEl = h('span', { class: 'vxsaved' }, '');
    const ctx2 = canvas.getContext('2d');
    const W = world.cols * CELL, H = world.rows * CELL;
    const px = Math.min(520, Math.max(300, Math.floor((window.innerWidth > 1000 ? 340 : window.innerWidth - 40))));
    canvas.width = px; canvas.height = Math.round((px * H) / W);
    const k = px / W;

    /* ---- 場地與積木高亮 ---- */
    let activeEl = null;
    function highlightBid(bid) {
      if (activeEl) { activeEl.classList.remove('running'); activeEl = null; }
      if (!bid) return;
      const el = wsInner.querySelector('[data-bid="' + bid + '"]');
      if (el) { el.classList.add('running'); activeEl = el; }
    }
    function syncCustomWorld() {
      if (ch) return;
      world.walls = customWalls.map((w) => [w.c * CELL, w.r * CELL, CELL, CELL]);
      world.colors = customColors.map((z) => ({ x: z.c * CELL, y: z.r * CELL, color: z.color }));
      world.goal = customGoal ? { x: customGoal.c * CELL, y: customGoal.r * CELL } : null;
    }
    canvas.addEventListener('click', (e) => {
      if (ch || !editMode) return;
      const rect = canvas.getBoundingClientRect();
      const col = Math.floor(((e.clientX - rect.left) / rect.width) * world.cols);
      const row = Math.floor(((e.clientY - rect.top) / rect.height) * world.rows);
      if (col < 0 || row < 0 || col >= world.cols || row >= world.rows) return;
      const startC = Math.floor(world.start.x / CELL), startR = Math.floor(world.start.y / CELL);
      if (editTool === 'wall') {
        if (col === startC && row === startR) return toast('不能把牆壁放在起點上');
        const idx = customWalls.findIndex((w) => w.c === col && w.r === row);
        if (idx >= 0) customWalls.splice(idx, 1); else customWalls.push({ c: col, r: row });
      } else if (editTool === 'goal') {
        customGoal = { c: col + 0.5, r: row + 0.5 };
      } else if (editTool === 'red') {
        const idx = customColors.findIndex((z) => z.c === col && z.r === row);
        if (idx >= 0) customColors.splice(idx, 1); else customColors.push({ c: col, r: row, color: 'red' });
      }
      syncCustomWorld(); stop();
    });
    function drawWorld(fi) {
      const c = ctx2; c.clearRect(0, 0, canvas.width, canvas.height);
      c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height);
      c.strokeStyle = '#dde4ee'; c.lineWidth = 1;
      for (let x = 0; x <= W; x += CELL) { c.beginPath(); c.moveTo(x * k, 0); c.lineTo(x * k, H * k); c.stroke(); }
      for (let y = 0; y <= H; y += CELL) { c.beginPath(); c.moveTo(0, y * k); c.lineTo(W * k, y * k); c.stroke(); }
      (world.colors || []).forEach((z) => { c.fillStyle = COLORHEX[z.color] || '#ccc'; c.fillRect(z.x * k, z.y * k, CELL * k, CELL * k); });
      c.fillStyle = '#8a94a6'; world.walls.forEach(([x, y, w, hh]) => c.fillRect(x * k, y * k, w * k, hh * k));
      if (showRef && ch && ch.path && ch.path.length) { c.strokeStyle = 'rgba(31,157,85,.55)'; c.lineWidth = 3; c.setLineDash([8, 6]); c.beginPath(); ch.path.forEach(([cc, rr], i) => { const X = cc * CELL * k, Y = rr * CELL * k; if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }); c.stroke(); c.setLineDash([]); }
      if (world.goal) { c.font = Math.round(CELL * k * 0.55) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🚩', world.goal.x * k, world.goal.y * k); c.strokeStyle = '#1f9d55'; c.setLineDash([4, 4]); c.beginPath(); c.arc(world.goal.x * k, world.goal.y * k, 100 * k, 0, 7); c.stroke(); c.setLineDash([]); }
      const frames = result ? result.frames : [[world.start.x, world.start.y, world.start.th, '']];
      const idx = Math.max(0, Math.min(fi == null ? 0 : fi, frames.length - 1));
      c.strokeStyle = '#0875e2'; c.lineWidth = 2.5; c.beginPath();
      for (let i = 0; i <= idx; i += 2) { const f = frames[i]; if (i === 0) c.moveTo(f[0] * k, f[1] * k); else c.lineTo(f[0] * k, f[1] * k); }
      c.stroke();
      const f = frames[idx];
      c.save(); c.translate(f[0] * k, f[1] * k); c.rotate((f[2] * Math.PI) / 180);
      c.fillStyle = '#77b2ff'; c.strokeStyle = '#3a63a0'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(-R * k, -78 * k, 2 * R * k, 156 * k, 8 * k); c.fill(); c.stroke();
      c.fillStyle = '#f1ae34'; c.beginPath(); c.moveTo(R * k, 0); c.lineTo((R - 40) * k, -28 * k); c.lineTo((R - 40) * k, 28 * k); c.closePath(); c.fill();
      c.restore();
      timeEl.textContent = ((idx * DT) / 1000).toFixed(1) + ' 秒';
      if (typeof scrubEl !== 'undefined' && result) scrubEl.value = String(idx);
      highlightBid(result ? f[3] : '');
    }
    /* ---- Brain 螢幕 ---- */
    function drawBrain(idx) {
      let rows = [];
      if (result && idx != null) { for (const e of result.C.screenLog) { if (e.tick <= idx) rows = e.rows; else break; } }
      const lines = []; for (let i = 0; i < BRAIN_ROWS; i++) lines.push(h('div', { class: 'bl' }, (rows[i] || '').replace(/ /g, ' ') || ' '));
      brainEl.replaceChildren(...lines);
    }

    /* ---- 播放 ---- */
    let speed = 2, raf = 0, playing = false, startReal = 0, baseIdx = 0, curIdx = 0, sndI = 0;
    const playPauseBtn = h('button', { class: 'btn sm', title: '播放／暫停', disabled: true, onclick: () => { if (!result) return; if (playing) { playing = false; cancelAnimationFrame(raf); playPauseBtn.textContent = '▶'; } else play(); } }, '▶');
    const scrubEl = h('input', { type: 'range', class: 'vxscrub', min: '0', max: '0', value: '0', disabled: true, title: '拖曳時間軸查看每一步對應的積木', oninput: (e) => { if (!result) return; playing = false; cancelAnimationFrame(raf); playPauseBtn.textContent = '▶'; curIdx = parseInt(e.target.value, 10) || 0; drawWorld(curIdx); drawBrain(curIdx); } });
    function frameLoop() {
      if (!playing) return;
      const idx = Math.max(0, Math.min(result.frames.length - 1, baseIdx + Math.floor(((performance.now() - startReal) * speed) / DT)));
      curIdx = idx; drawWorld(idx); drawBrain(idx);
      const snds = result.C.sounds;
      if (sndI < snds.length && snds[sndI].tick <= idx) {
        const played = [];
        while (sndI < snds.length && snds[sndI].tick <= idx) {
          const nm = snds[sndI].name;
          if (!played.includes(nm)) played.push(nm);
          sndI++;
        }
        played.slice(-2).forEach(playSound);
      }
      if (idx >= result.frames.length - 1) { playing = false; playPauseBtn.textContent = '▶'; highlightBid(''); showResult(); return; }
      raf = requestAnimationFrame(frameLoop);
    }
    function play() { if (!result) return; if (curIdx >= result.frames.length - 1) curIdx = 0; baseIdx = curIdx; startReal = performance.now(); playing = true; playPauseBtn.textContent = '⏸'; const sn = result.C.sounds; sndI = sn.findIndex((s) => s.tick >= curIdx); if (sndI < 0) sndI = sn.length; resBox.replaceChildren(); raf = requestAnimationFrame(frameLoop); }
    function run() {
      cancelAnimationFrame(raf); playing = false; if (rightTab === 'code') setRightTab('field');
      try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { actx = actx || new AC(); actx.resume(); } } catch (e) { /* ignore */ }
      if (typeof seg !== 'undefined' && seg._focusField) seg._focusField();
      tagBids(prog, defs);
      result = simulate({ main: prog, defs }, world); result.j = judge(result);
      improvedBy = 0;
      if (ch) {
        const rec = st.ch[ch.id] || (st.ch[ch.id] = { done: false, hints: 0 });
        rec.runs = (rec.runs || 0) + 1;
        if (!result.j.ok) {
          failStreak++; everFailed = true; rec.fails = (rec.fails || 0) + 1;
          if (result.j.goalDist != null) {
            if (rec.bestDist != null && result.j.goalDist < rec.bestDist) improvedBy = rec.bestDist - result.j.goalDist;
            if (rec.bestDist == null || result.j.goalDist < rec.bestDist) rec.bestDist = result.j.goalDist;
          }
        }
      }
      curIdx = 0;
      scrubEl.max = String(Math.max(0, result.frames.length - 1)); scrubEl.value = '0'; scrubEl.disabled = false; playPauseBtn.disabled = false;
      if (VX.act) VX.act('sim'); persist(); play();
    }
    function stop() { cancelAnimationFrame(raf); playing = false; result = null; curIdx = 0; scrubEl.max = '0'; scrubEl.value = '0'; scrubEl.disabled = true; playPauseBtn.disabled = true; playPauseBtn.textContent = '▶'; highlightBid(''); resBox.replaceChildren(); drawWorld(0); drawBrain(null); }
    function showResult() {
      const j = result.j, C = result.C;
      const tips = !j.ok && ch ? diagnoseFail(result, ch) : [];
      resBox.replaceChildren(h('div', { class: 'callout ' + (j.ok ? '' : 'warn') },
        h('b', null, j.free ? '🏁 執行完畢' : j.ok ? '✅ 模擬成功！' : '❌ 這次還沒成功'),
        improvedBy >= 20 ? h('div', { class: 'vxnewrec' }, '🔥 新紀錄！比上次更靠近旗子 ' + improvedBy + ' mm，快破關了！') : null,
        h('div', null, '模擬時間 ' + j.secs + ' 秒　·　走了約 ' + j.dist + ' mm　·　最後位置 (' + Math.round(C.x) + ', ' + Math.round(C.y) + ') mm，朝向 ' + Math.round(C.th) + '°'),
        j.msgs.map((m) => h('div', null, m)),
        tips.length ? h('div', { class: 'vxdiag' }, tips.map((t) => h('div', null, '💡 ' + t))) : null,
        Object.keys(C.vars).length ? h('div', null, '變數：' + Object.entries(C.vars).map(([n, v]) => n + ' = ' + Math.round(v * 100) / 100).join('、')) : null,
        h('div', { class: 'sub' }, '⚠ 模擬是理想化的（速度與轉速是假設值）。真的機器人會有誤差，一定要在實機上再測。')));

      if (j.ok && ch) {
        const rec = st.ch[ch.id] || (st.ch[ch.id] = { done: false, hints: 0 });
        const struggled = everFailed || rec.hints > 0;
        failStreak = 0;
        const refUsed = usedRef || !!rec.usedRef;
        const earnedStars = ch.custom ? 3 : calcStars(ch, prog, defs, result, refUsed);
        const myBlocks = countBlocks(prog, defs);
        const firstSim = !rec.sim;
        if (!ch.custom) { // 自訂關卡是自己出的題，不計星數與亮點，避免刷徽章
          const prevStars = rec.stars || 0;
          rec.stars = Math.max(prevStars, earnedStars);
          rec.bestBlocks = rec.bestBlocks ? Math.min(rec.bestBlocks, myBlocks) : myBlocks;
          if ((firstSim && (rec.fails || 0) >= 2) || (earnedStars >= 3 && prevStars < 3)) rec.gritT = Date.now(); // 週報「克服卡關亮點」只列本週新達成的
        }
        rec.sim = true;
        if (firstSim && VX.act) VX.act('simok');
        VX.saveState();
        if (VX.badges) VX.badges.check(false);
        if (firstSim) toast('模擬通過！接著去機器人上實測吧');
        if (window.VXFX && (earnedStars >= 3 || firstSim)) setTimeout(() => window.VXFX.confetti(), 150);
        const starLine = !ch.custom ? h('div', { class: 'vxstars' },
          h('span', { class: 'stars' }, '★'.repeat(earnedStars) + '☆'.repeat(3 - earnedStars)),
          h('span', null, earnedStars === 3 ? ' 精簡又精準，滿星過關！' : earnedStars === 2 ? ' 寫法很精簡！試試看微調距離讓終點誤差更小拿 3 星' : refUsed ? ' 參考解答 1 星；試著自己改寫或精簡積木拿 3 星！' : ' 用了 ' + myBlocks + ' 塊積木；試著用 repeat 或精簡步驟拿 2～3 星！')) : null;
        const coreSkill = (ch.skills || []).filter((id) => VX.SK && VX.SK[id]).sort((a, b) => VX.pOf(a) - VX.pOf(b))[0] || null; // 該關技能中目前最弱的一個
        const skObj = coreSkill && VX.SK && VX.SK[coreSkill];
        const nextCh = ch.custom ? null : pickNextChallenge(ch, st.ch);
        if (starLine || skObj || nextCh) {
          resBox.append(h('div', { class: 'vxcoach ok' },
            starLine,
            (skObj || nextCh) ? h('b', null, struggled ? '🎯 克服卡關成功過關！趁剛想通，鞏固一下：' : '🎯 模擬通過！趁熱打鐵：') : null,
            (skObj || nextCh) ? h('div', { class: 'row gap', style: 'margin-top:8px' },
              skObj ? h('a', { class: 'btn primary sm', href: '#/practice/' + skObj.id + '/2' }, '✏️ 做 2 題「' + skObj.name + '」觀念小考') : null,
              nextCh ? h('a', { class: 'btn sm', href: '#/sim/' + nextCh.id }, '🚀 再挑戰類似題：' + nextCh.title) : null
            ) : null));
        }
        resBox.append(h('div', { class: 'row gap', style: 'margin-top:8px' }, h('button', { class: 'btn sm', onclick: saveNote }, '📓 存成「程式說明」筆記'), !ch.custom ? h('a', { class: 'btn sm', href: '#/challenge/' + ch.id }, '回挑戰頁') : h('a', { class: 'btn sm', href: '#/challenge' }, '回挑戰列表')));
      } else if (!j.ok && ch) {
        const rec = st.ch[ch.id] || (st.ch[ch.id] = { done: false, hints: 0 });
        if (failStreak >= 2 && ch.hints && ch.hints.length) {
          const coachBox = h('div', { class: 'vxcoach' });
          const drawCoach = () => {
            const shown = ch.hints.slice(0, rec.hints);
            coachBox.replaceChildren(
              h('b', null, '🧭 教練小幫手（連續第 ' + failStreak + ' 次未通過）'),
              h('div', { class: 'sub', style: 'margin:2px 0 6px' }, '卡關很正常！不用急，可以拖曳上方時間軸看每一步發光的積木，或打開提示：'),
              ...shown.map((t, i) => h('div', { class: 'vxhint-item' }, h('b', null, '提示 ' + (i + 1) + '：'), t)),
              h('div', { class: 'row gap', style: 'margin-top:8px' },
                rec.hints < ch.hints.length ? h('button', { class: 'btn primary sm', onclick: () => { rec.hints++; VX.saveState(); drawCoach(); } }, '💡 給我提示（' + rec.hints + '/' + ch.hints.length + '）') : null,
                failStreak >= 3 && !showRef && ch.path && ch.path.length ? h('button', { class: 'btn sm', onclick: () => { showRef = true; const cb = rightBody.querySelector('.vxcheck input'); if (cb) cb.checked = true; drawWorld(curIdx); drawCoach(); } }, '🗺️ 顯示參考路線') : null,
                failStreak >= 4 && ch.code ? h('button', { class: 'btn ghost sm', onclick: loadRef }, '📖 載入參考解答看看') : null
              )
            );
          };
          drawCoach();
          resBox.append(coachBox);
        }
        resBox.append(h('div', { class: 'row gap', style: 'margin-top:8px' }, h('button', { class: 'btn sm', onclick: saveNote }, '📓 存成「程式說明」筆記')));
      } else {
        resBox.append(h('div', { class: 'row gap', style: 'margin-top:8px' }, h('button', { class: 'btn sm', onclick: saveNote }, '📓 存成「程式說明」筆記')));
      }
    }
    async function saveNote() {
      const j = result && result.j;
      try {
        await api('/api/notes', { kind: 'program', title: '程式說明：' + (ch ? ch.title : '自由練習'), data: { f: { what: ch ? ch.goal_t : '自由練習', blocks: programText(prog, defs, lang), result: j ? (j.ok ? '模擬成功' : '模擬未成功') + '，用了 ' + j.secs + ' 秒（模擬）。' + j.msgs.join(' ') : '', improve: '', date: VX.todayStr(), author: VX.user.display || '' }, c: [] } });
        if (VX.act) VX.act('note'); VX.saveState(); toast('已存成筆記 ✔（記得補上你的想法）');
      } catch (e) { toast(e.message); }
    }

    /* ---- 拖曳 ---- */
    function containsList(b, list) { return (b.kids && inTree(list, b.kids)) || (b.elseKids && inTree(list, b.elseKids)); }
    function beginTrack(e, info) {
      if (e.button > 0) return;
      const sx = e.clientX, sy = e.clientY, touch = e.pointerType === 'touch', srcEl = e.currentTarget;
      let started = false, ghost = null, hot = null;
      const chunkOf = () => (info.kind === 'move' && info.stack ? info.list.slice(info.list.indexOf(info.block)) : [info.block]);
      const slotAt = (x, y) => document.elementsFromPoint(x, y).find((el) => (info.kind === 'expr' ? el._acc === info.cls : el._list));
      const move = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!started) {
          if (touch && (info.kind === 'new' || info.kind === 'expr')) { if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return cleanup(); if (!(Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy))) return; }
          else if (Math.hypot(dx, dy) < 6) return;
          started = true; document.body.classList.add('simdragging');
          ghost = h('div', { class: 'vxscope dragghost' }, (info.kind === 'new' || info.kind === 'expr') ? srcEl.cloneNode(true) : chunkOf().slice(0, 4).map((x) => head(x).cloneNode(true)));
          if (info.kind === 'move' && chunkOf().length > 4) ghost.append(h('div', { class: 'dragmore' }, '+' + (chunkOf().length - 4)));
          document.body.append(ghost);
        }
        ev.preventDefault();
        ghost.style.left = ev.clientX + 8 + 'px'; ghost.style.top = ev.clientY + 8 + 'px';
        const s = slotAt(ev.clientX, ev.clientY);
        if (hot && hot !== s) hot.classList.remove('hot');
        hot = s || null; if (hot) hot.classList.add('hot');
      };
      const up = (ev) => {
        const wasStarted = started, s = wasStarted ? slotAt(ev.clientX, ev.clientY) : null;
        cleanup();
        if (!wasStarted) { if (info.onClick) { info.onClick(); return; } if (info.kind === 'expr') { toast('把它拖到積木的空格裡（六角形或圓形的格子）'); } else if (info.kind === 'new' && !info.disabled) { snap(); target.push(newBlock(info.t, info.name, defs)); markDirty(); draw(); } return; }
        if (!s) return;
        if (info.kind === 'expr') { s._set(info.build()); return; }
        let list = s._list, idx = s._idx;
        snap();
        if (info.kind === 'new') { list.splice(idx, 0, newBlock(info.t, info.name, defs)); target = list; }
        else {
          const b = info.block, chunk = chunkOf();
          if (chunk.some((x) => list === x.kids || list === x.elseKids || containsList(x, list))) { undoS.pop(); toast('不能把積木放進它自己裡面'); return; }
          const si = info.list.indexOf(b);
          if (info.list === list && idx >= si && idx <= si + chunk.length) { undoS.pop(); return; } // 放回原位
          info.list.splice(si, chunk.length);
          if (info.list === list && idx > si) idx -= chunk.length;
          list.splice(idx, 0, ...chunk);
          selected = b;
        }
        markDirty();
        draw();
      };
      function cleanup() {
        document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel);
        if (ghost) ghost.remove(); if (hot) hot.classList.remove('hot'); document.body.classList.remove('simdragging');
      }
      const cancel = () => cleanup();
      document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel);
    }

    /* ---- 程式碼檢視 ---- */
    const codeText = () => (codeLang === 'cpp' ? toCpp(prog, defs) : toPython(prog, defs));
    const KW = { py: /^(def|if|else|while|for|in|range|global|pass|True|False|not|and|or|return|int)$/, cpp: /^(void|int|float|if|else|while|return|true|false|using|namespace)$/ };
    function hl(line) {
      const ci = codeLang === 'py' ? line.indexOf('#') : line.indexOf('//');
      const code = ci >= 0 ? line.slice(0, ci) : line, com = ci >= 0 ? line.slice(ci) : '';
      const parts = code.split(/(\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/).filter((x) => x !== '').map((t) => (/^\d/.test(t) ? h('span', { class: 'cn-num' }, t) : KW[codeLang].test(t) ? h('span', { class: 'cn-kw' }, t) : document.createTextNode(t)));
      if (com) parts.push(h('span', { class: 'cn-com' }, com));
      return parts;
    }
    function drawCode() {
      const text = codeText();
      codeBox.replaceChildren(...text.split('\n').map((ln, i) => h('div', { class: 'cl' }, h('span', { class: 'cln' }, String(i + 1)), h('span', { class: 'clt' }, ...hl(ln)))));
      codeBox._text = text;
    }
    const refreshCode = () => { if (rightTab === 'code') drawCode(); };

    /* ---- 工作區積木（可編輯）＋ 停留 1 秒的中文提示 ---- */
    let preSnap;
    const endEdit = () => { if (preSnap !== undefined && preSnap !== snapStr()) pushSnap(preSnap); preSnap = undefined; };
    const markDirty = () => { isSaved = false; savedEl.textContent = lang === 'en' ? 'Not Saved' : '尚未儲存'; scheduleSave(); };
    const sel = (b, key, opts) => h('select', { class: 'ssel', onfocus: () => { preSnap = snapStr(); }, onchange: (e) => { b[key] = e.target.value; markDirty(); refreshCode(); endEdit(); } }, opts.map((o) => h('option', { value: o, selected: b[key] === o }, o)));
    const selDir = (b, tk) => h('select', { class: 'ssel', onfocus: () => { preSnap = snapStr(); }, onchange: (e) => { b[tkKey(tk)] = e.target.value; markDirty(); refreshCode(); endEdit(); } }, DIRL[tk.s][lang].map(([v, l]) => h('option', { value: v, selected: b[tkKey(tk)] === v }, l)));
    const textIn = (obj, key, w) => h('input', { class: 'sin', type: 'text', value: obj[key] == null ? '' : obj[key], style: 'width:' + (w || 50) + 'px', onfocus: () => { preSnap = snapStr(); }, oninput: (e) => { obj[key] = e.target.value; markDirty(); refreshCode(); }, onchange: endEdit });
    const selWith = (obj, key, pairs) => h('select', { class: 'ssel', onfocus: () => { preSnap = snapStr(); }, onchange: (e) => { obj[key] = e.target.value; markDirty(); refreshCode(); endEdit(); } }, pairs.map(([v, t]) => h('option', { value: v, selected: obj[key] === v }, t)));
    // 插槽：可以輸入數字，也可以把運算式／感測器積木拖進來
    function sock(obj, key, accept, w) {
      const v = obj[key], filled = v && typeof v === 'object';
      const el = h('span', { class: 'sock ' + accept + (filled ? ' filled' : '') });
      el._acc = accept;
      el._set = (x) => { snap(); obj[key] = x; markDirty(); draw(); };
      if (filled) el.append(exprEl(v, obj, key, accept));
      else if (accept === 'num') el.append(textIn(obj, key, w));
      else el.append(h('span', { class: 'sockph' }, '    '));
      return el;
    }
    const num = (b, key, w) => sock(b, key, 'num', w);
    const boolSock = (b, key) => sock(b, key, 'bool');
    function exprEl(x, parent, key, accept) {
      const kids = [];
      switch (x.e) {
        case 'sensor': kids.push(SENS[x.k][lang]); break;
        case 'var': kids.push(x.name); break;
        case 'bumper': case 'found': kids.push(exprStr(x, lang)); break;
        case 'color': kids.push(lang === 'zh' ? '顏色感測器看到' : 'Color sees', selWith(x, 'color', COLORS.map(([v, zh]) => [v, lang === 'zh' ? zh : v])), lang === 'zh' ? '？' : '?'); break;
        case 'math': kids.push(sock(x, 'a', 'num', 38), sel(x, 'op', ['+', '-', '*', '/']), sock(x, 'b', 'num', 38)); break;
        case 'cmp': kids.push(sock(x, 'a', 'num', 38), sel(x, 'op', ['<', '>', '=', '<=', '>=']), sock(x, 'b', 'num', 38)); break;
        case 'logic': kids.push(sock(x, 'a', 'bool'), selWith(x, 'op', [['and', lang === 'zh' ? '且' : 'and'], ['or', lang === 'zh' ? '或' : 'or']]), sock(x, 'b', 'bool')); break;
        case 'not': kids.push(lang === 'zh' ? '非' : 'not', sock(x, 'a', 'bool')); break;
        default: kids.push('?');
      }
      const rm = h('button', { class: 'exrm', title: '移除', onclick: (e) => { e.stopPropagation(); snap(); parent[key] = accept === 'bool' ? null : '0'; markDirty(); draw(); } }, '×');
      const el = h('span', { class: 'ex ' + EXK[x.e] + ' ' + EXCLS[x.e] }, ...kids, rm);
      attachTip(el, () => ({ t: 'expr', x }));
      return el;
    }
    const exprStatic = (x, lg) => h('span', { class: 'ex ' + EXK[x.e] + ' ' + EXCLS[x.e] }, exprStr(x, lg));
    function blockEl(b, lg, editable) {
      let kids;
      if (b.t === 'call') kids = [b.name, ...(b.args || []).map((a, i) => (editable ? num(b.args, i, 46) : h('span', { class: 'fd num' }, fv(a, lg))))];
      else kids = TPL[b.t][lg].map((tk) => (typeof tk === 'string' ? tk : tk.s ? (editable ? selDir(b, tk) : h('span', { class: 'fd dd' }, labelOf(DIRL[tk.s][lg], b[tkKey(tk)]))) : tk.n ? (editable ? num(b, tk.n, tk.w) : h('span', { class: 'fd num' }, fv(b[tk.n], lg))) : (editable ? boolSock(b, 'cond') : h('span', { class: 'fd bool' }, exprStr(b.cond, lg)))));
      return h('div', { class: 'blk ' + BLOCK_CLASS[b.t] }, kids);
    }
    const head = (b) => blockEl(b, lang, true);
    const defHead = (d, lg) => h('div', { class: 'blk b-my hat' }, lg === 'zh' ? '定義' : 'define', h('span', { class: 'fd dd' }, d.name), ...d.params.map((p) => h('span', { class: 'fd num' }, p)));

    const tip = h('div', { class: 'vxscope vxtip hidden' }); document.body.append(tip);
    let tipTimer = 0, tipHide = 0;
    const hideTip = () => { clearTimeout(tipTimer); clearTimeout(tipHide); tip.classList.add('hidden'); };
    /* 把浮動方塊放在某個元素旁邊。用「文件座標」的 absolute，而不是 fixed：
       iPad／iPhone Safari 的 fixed 會受工具列伸縮、縮放影響，提示框會跑到畫面最上面（看不到）；
       同時用 visualViewport 夾在目前看得到的範圍內，絕不會超出螢幕。 */
    function placeNear(el, anchor, toRight) {
      const vv = window.visualViewport, sx = window.scrollX || 0, sy = window.scrollY || 0;
      const r = anchor.getBoundingClientRect(), t = el.getBoundingClientRect();
      const vx = vv ? vv.pageLeft : sx, vy = vv ? vv.pageTop : sy, vw = vv ? vv.width : window.innerWidth, vh = vv ? vv.height : window.innerHeight;
      let x = (toRight ? r.right + 8 : r.left) + sx, y = (toRight ? r.top : r.bottom + 8) + sy;
      if (y + t.height > vy + vh - 8) y = toRight ? r.bottom + sy - t.height : r.top + sy - t.height - 8;
      x = Math.max(vx + 8, Math.min(x, vx + vw - t.width - 8));
      y = Math.max(vy + 8, Math.min(y, vy + vh - t.height - 8));
      el.style.position = 'absolute'; el.style.left = x + 'px'; el.style.top = y + 'px';
    }
    function showTip(anchor, b) {
      const other = lang === 'en' ? 'zh' : 'en';
      if (b.t === 'cat') {
        const badge = h('div', { style: 'display:flex;align-items:center;gap:8px;font-weight:700;font-size:1rem;margin:2px 0 4px', 'data-notrans': '1' },
          h('span', { style: 'width:14px;height:14px;border-radius:50%;flex:none;background:' + b.cat.color }), b.cat[other]);
        tip.replaceChildren(h('div', { class: 'vxtipl' }, other === 'zh' ? '中文' : 'English'), badge, h('div', { class: 'vxtipd' }, b.cat.desc || ''));
      } else {
        const blk = b.t === 'expr' ? exprStatic(b.x, other) : b.t === 'define' ? defHead(b, other) : blockEl(b, other, false);
        tip.replaceChildren(h('div', { class: 'vxtipl' }, other === 'zh' ? '中文' : 'English'), blk, h('div', { class: 'vxtipd' }, b.t === 'expr' ? descOfExpr(b.x) : (DESC[b.t] || '')));
      }
      tip.classList.remove('hidden');
      placeNear(tip, anchor, b.t === 'cat' && window.innerWidth > 760);
    }
    function attachTip(el, getBlock) {
      el.addEventListener('mouseenter', () => { clearTimeout(tipTimer); tipTimer = setTimeout(() => showTip(el, getBlock()), 1000); });
      el.addEventListener('mouseleave', hideTip);
      el.addEventListener('pointerdown', (e) => { hideTip(); if (e.pointerType === 'touch') { tipTimer = setTimeout(() => { showTip(el, getBlock()); tipHide = setTimeout(hideTip, 3500); }, 800); } });
      el.addEventListener('pointerup', () => clearTimeout(tipTimer)); el.addEventListener('pointercancel', () => clearTimeout(tipTimer));
      el.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') clearTimeout(tipTimer); });
    }
    const onKey = (e) => {
      if (!selected || e.target.closest && e.target.closest('input,select,textarea,[contenteditable]')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { const l = findList(prog, selected) || defs.map((d) => findList(d.kids, selected)).find(Boolean); if (l) { e.preventDefault(); removeBlock(selected, l); } }
      else if (e.key === 'Escape') { selected = null; draw(); }
    };
    const findList = (list, b) => { if (list.includes(b)) return list; for (const x of list) { const r = (x.kids && findList(x.kids, b)) || (x.elseKids && findList(x.elseKids, b)); if (r) return r; } return null; };
    document.addEventListener('keydown', onKey);
    const cleanupGlobal = () => { document.removeEventListener('keydown', onKey); if (!isSaved) persist(); clearTimeout(saveTimer); tip.remove(); closeMenu(); };
    window.addEventListener('hashchange', cleanupGlobal, { once: true });

    const slot = (list, i) => { const s = h('div', { class: 'slot' }); s._list = list; s._idx = i; return s; };
    const cend = (b) => h('div', { class: 'cend ' + BLOCK_CLASS[b.t].split(' ')[0] }, LOOPY[b.t] ? '↻' : '');
    /* 選取的積木（像 VEXcode：點一下選取，出現小工具列；Delete 鍵可刪除） */
    let selected = null;
    const clone2 = (o) => JSON.parse(JSON.stringify(o));
    const selectBlock = (b) => { if (selected === b) return; selected = b; draw(); };
    const removeBlock = (b, list) => { const i = list.indexOf(b); if (i < 0) return; snap(); list.splice(i, 1); selected = null; if (!targetValid()) target = prog; markDirty(); draw(); };
    const moveBlock = (b, list, d) => { const i = list.indexOf(b), j = i + d; if (i < 0 || j < 0 || j >= list.length) return; snap(); [list[i], list[j]] = [list[j], list[i]]; markDirty(); draw(); };
    const dupBlock = (b, list) => { const i = list.indexOf(b); if (i < 0) return; snap(); const c = clone2(b); list.splice(i + 1, 0, c); selected = c; markDirty(); draw(); };
    function listEl(list) {
      const box = h('div', { class: 'blist' + (list === target ? ' target' : '') + (!list.length ? ' empty' : '') });
      list.forEach((b, i) => {
        box.append(slot(list, i));
        const hd = head(b); if (b._bid) hd.dataset.bid = b._bid; attachTip(hd, () => b);
        if (b === selected) hd.classList.add('sel');
        // 整個積木都可以拖；點一下（沒拖）就選取。欄位、下拉選單照常可以編輯。
        hd.addEventListener('pointerdown', (e) => {
          if (e.target.closest('input,select,textarea,option,button')) return;
          beginTrack(e, { kind: 'move', block: b, list, stack: true, onClick: () => selectBlock(b) });
        });
        const row = h('div', { class: 'brow' + (b === selected ? ' sel' : '') }, hd);
        if (b === selected) {
          row.append(h('span', { class: 'bsel', role: 'toolbar', 'aria-label': '積木工具' },
            h('button', { title: '往上', 'aria-label': '往上', onclick: () => moveBlock(b, list, -1) }, '↑'),
            h('button', { title: '往下', 'aria-label': '往下', onclick: () => moveBlock(b, list, 1) }, '↓'),
            h('button', { title: '複製', 'aria-label': '複製', onclick: () => dupBlock(b, list) }, '⧉'),
            h('button', { class: 'del', title: '刪除', 'aria-label': '刪除', onclick: () => removeBlock(b, list) }, '✕')));
        }
        box.append(row);
        if (b.kids) {
          box.append(h('div', { class: 'cinner ' + BLOCK_CLASS[b.t].split(' ')[0], onclick: (e) => { if (e.target === e.currentTarget) { target = b.kids; draw(); } } }, listEl(b.kids)));
          if (b.t === 'if') {
            const el = blockEl({ t: 'else' }, lang, false); attachTip(el, () => ({ t: 'else' })); el.classList.add('celse');
            box.append(h('div', { class: 'brow' }, el));
            box.append(h('div', { class: 'cinner b-control', onclick: (e) => { if (e.target === e.currentTarget) { target = b.elseKids; draw(); } } }, listEl(b.elseKids)));
          }
          box.append(h('div', { class: 'brow' }, cend(b)));
        }
      });
      box.append(slot(list, list.length));
      box.append(h('button', { class: 'addhere' + (list === target ? ' on' : ''), title: list === target ? '點積木庫的積木會加在這裡' : '把新積木加到這裡', onclick: () => { target = list; draw(); } }, list === target ? '▼ 點積木庫的積木會加在這裡' : '＋'));
      return box;
    }
    function draw() {
      tagBids(prog, defs);
      const nodes = [];
      defs.forEach((d, di) => {
        const dh = defHead(d, lang); attachTip(dh, () => ({ t: 'define', name: d.name, params: d.params }));
        nodes.push(h('div', { class: 'vxdefhead' }, dh, h('button', { class: 'bctrl-x', title: '刪除這個積木', onclick: () => deleteDef(di) }, '🗑')));
        nodes.push(listEl(d.kids));
      });
      const hat = blockEl({ t: 'hat' }, lang, false); attachTip(hat, () => ({ t: 'hat' }));
      nodes.push(hat, listEl(prog));
      if (!prog.length && !defs.length) nodes.push(h('div', { class: 'vxhint' }, '👈 從左邊的積木庫「拖」或「點」積木進來'));
      wsInner.replaceChildren(...nodes);
      protectZh();
      applyZoom();
      refreshCode();
      if (cat === 'my' || cat === 'var') drawFly(true);
    }

    /* ---- 類別欄與積木庫 ---- */
    function drawRail() {
      rail.replaceChildren(...CATS.map((c) => {
        const b = h('button', { class: 'vxcat2' + (c.id === cat ? ' on' : ''), onclick: () => { cat = c.id; drawRail(); drawFly(); } },
          h('span', { class: 'dot', style: 'background:' + c.color }), c[lang]);
        attachTip(b, () => ({ t: 'cat', cat: c }));
        return b;
      }));
      protectZh();
    }
    function removeCalls(list, name) { for (let i = list.length - 1; i >= 0; i--) { const b = list[i]; if (b.t === 'call' && b.name === name) list.splice(i, 1); else { if (b.kids) removeCalls(b.kids, name); if (b.elseKids) removeCalls(b.elseKids, name); } } }
    function deleteDef(di) {
      if (!confirm('刪除積木「' + defs[di].name + '」？用到它的地方也會一起被移除。')) return;
      snap(); const name = defs[di].name; removeCalls(prog, name); defs.forEach((d) => removeCalls(d.kids, name)); defs.splice(di, 1);
      selected = null; if (!targetValid()) target = prog; markDirty(); draw(); drawFly(true);
    }
    function createDef() {
      const name = (prompt('積木叫什麼名字？（例如：方形，最多 10 個字，不要有空白或括號）') || '').trim();
      if (!name) return;
      if (!/^[^\s()\[\]<>,，、]{1,10}$/.test(name)) return toast('名字不可以有空白、括號或逗號，最多 10 個字');
      if (defs.some((d) => d.name === name) || ['驅動', '旋轉', '等待', '重複', '永遠', '而', '如果', '別的'].includes(name)) return toast('這個名字已經有了，換一個');
      const pr = (prompt('要加「參數」嗎？參數讓積木每次可以帶不同的數字，例如 size。\n不需要就直接按確定；多個參數用逗號隔開（最多 3 個）。') || '').trim();
      const params = pr.split(/[,，、\s]+/).filter(Boolean).slice(0, 3);
      if (params.some((p) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(p))) return toast('參數名稱請用英文字母（例如 size）');
      snap(); defs.push({ name, params, kids: [] }); target = defs[defs.length - 1].kids; markDirty(); draw(); drawFly(true);
    }
    const hexSample = (text, cls) => h('div', { class: 'hexblk ' + cls }, text);
    const INFO = {
      events: () => [h('div', { class: 'vxsec' }, 'Events'), (() => { const e = blockEl({ t: 'hat' }, lang, false); e.classList.add('flyblk', 'dis'); return e; })(), h('div', { class: 'vxnote' }, '模擬器的程式一定從「when started」開始，它固定在工作區最上面。其他事件積木（例如按遙控器按鈕）模擬器還不能用。')],
      comments: () => [h('div', { class: 'vxsec' }, 'Comments'), h('div', { class: 'vxnote' }, '註解積木模擬器還不支援。工程筆記請寫在「筆記」頁。')],
    };
    function drawFly(keep) {
      const c = CATS.find((x) => x.id === cat);
      const top = fly.scrollTop;
      const mk = (b) => { const el = blockEl(b, lang, false); el.classList.add('flyblk'); el.addEventListener('pointerdown', (e) => beginTrack(e, { kind: 'new', t: b.t, name: b.name })); attachTip(el, () => b); return el; };
      if (c.info) { fly.replaceChildren(...INFO[c.info]()); protectZh(); fly.scrollTop = 0; return; }
      if (cat === 'my') {
        fly.replaceChildren(h('div', { class: 'vxsec' }, lang === 'en' ? 'My Blocks' : '我的積木'),
          h('button', { class: 'vxmk', onclick: createDef }, lang === 'en' ? 'Make a Block（創建一個區塊）' : '創建一個區塊'),
          defs.length ? null : h('div', { class: 'vxnote' }, '還沒有自己的積木。把常用的一組積木包成一個，之後可以重複使用。'),
          ...defs.map((d) => mk(newBlock('call', d.name, defs))).filter(Boolean));
        protectZh(); fly.scrollTop = keep ? top : 0; return;
      }
      const protoFor = (key) => { if (key === 'varref') { const names = collectRawVars(prog, defs); if (!names.includes('score')) names.unshift('score'); return names.map((n) => ({ e: 'var', name: n })); } return [EXPROTO[key]()]; };
      const exprItems = (sec) => (sec.exprs || []).flatMap((key) => protoFor(key).map((x) => { const el = exprStatic(x, lang); el.classList.add('flyex'); el.addEventListener('pointerdown', (e) => beginTrack(e, { kind: 'expr', cls: EXK[x.e], build: () => JSON.parse(JSON.stringify(x)) })); attachTip(el, () => ({ t: 'expr', x })); return h('div', { class: 'flyrow' }, el); }));
      fly.replaceChildren(...c.sections.flatMap((sec) => [h('div', { class: 'vxsec' }, sec[lang]), ...(sec.items || []).map((t) => mk(newBlock(t))), ...exprItems(sec)]));
      protectZh(); fly.scrollTop = keep ? top : 0;
    }

    /* ---- 右側面板：Field / Brain / Code ---- */
    const rightBody = h('div', { class: 'vxrbody2' });
    const rcKids = (el, ...kids) => el.replaceChildren(...kids.filter(Boolean));
    const rtitle = h('span', { class: 'vxrtitle' }, 'Field');
    const rbtn = {};
    const rbtns = [['field', 'field', 'Field 場地'], ['brain', 'screen', 'Brain 螢幕'], ['code', 'code', 'Code 程式碼']].map(([id, ic, tt]) => { const b = h('button', { class: 'vxrb', title: tt, onclick: () => setRightTab(id) }, ico(ic)); rbtn[id] = b; return b; });
    const speedSel = h('select', { onchange: (e) => { speed = parseFloat(e.target.value); if (playing) { baseIdx = curIdx; startReal = performance.now(); } } }, [[1, '1×'], [2, '2×'], [5, '5×'], [10, '10×']].map(([v, t]) => h('option', { value: v, selected: v === 2 }, t)));
    const editBox = h('div', { class: 'vxedit' });
    function saveCustomLevel() {
      if (!customGoal) return toast('先用「🚩 旗子」點一個終點位置，別人才知道要走到哪裡！');
      const gc = Math.floor(customGoal.c), gr = Math.floor(customGoal.r);
      if (customWalls.some((w) => w.c === gc && w.r === gr)) return toast('旗子被放在牆壁裡了，換個位置吧！');
      if (Math.hypot(customGoal.c * CELL - world.start.x, customGoal.r * CELL - world.start.y) <= 150) return toast('旗子離起點太近了，一開始就過關囉！放遠一點。');
      if (st.customCh.length >= 8) return toast('最多可存 8 個自訂關卡，先到挑戰列表刪除不需要的');
      const title = (prompt('幫你設計的關卡取個名字！（例如：爸爸挑戰迷宮）', '我的迷宮 ' + (st.customCh.length + 1)) || '').trim().slice(0, 20);
      if (!title) return;
      const newCh = {
        id: 'custom_' + Date.now().toString(36), custom: true, title, lv: 2, skills: ['C1', 'C2'],
        cols: world.cols, rows: world.rows, start: { c: 0.5, r: world.rows - 0.5, dir: 'E' },
        goal: { c: customGoal.c, r: customGoal.r },
        walls: clone(customWalls), colors: clone(customColors),
        goal_t: '自己設計的關卡！不碰到灰色障礙，走到旗子。', task: '請爸媽或隊友來挑戰看看！',
        hints: ['先數起點到第一個轉角有幾格（每格 200 mm）。', '用 left / right 轉彎繞過障礙。'],
        path: [],
      };
      st.customCh.push(newCh);
      VX.saveState();
      if (VX.badges) VX.badges.check(false);
      toast('已儲存自訂關卡「' + title + '」！現在可以直接挑戰或請爸媽來玩');
      location.hash = '#/sim/' + newCh.id;
    }
    function drawEditBox() {
      if (ch) return;
      canvas.style.cursor = editMode ? 'crosshair' : '';
      if (!editMode) {
        editBox.replaceChildren(h('button', { class: 'btn sm', onclick: () => { editMode = true; drawEditBox(); } }, '🎨 設計自己的關卡（放牆壁／旗子出題）'));
        return;
      }
      const toolBtn = (id, label) => h('button', { class: 'btn sm' + (editTool === id ? ' primary' : ''), onclick: () => { editTool = id; drawEditBox(); } }, label);
      editBox.replaceChildren(
        h('div', { class: 'sub', style: 'margin-bottom:6px' }, '點上方場地格子即可擺放／移除，完成後存成關卡考考爸媽！'),
        h('div', { class: 'row gap' },
          toolBtn('wall', '🧱 牆壁'), toolBtn('goal', '🚩 旗子'), toolBtn('red', '🟥 紅區'),
          h('button', { class: 'btn ghost sm', onclick: () => { customWalls.length = 0; customColors.length = 0; customGoal = null; syncCustomWorld(); stop(); } }, '🧹 清空'),
          h('button', { class: 'btn green sm', onclick: saveCustomLevel }, '💾 存成關卡出題'),
          h('button', { class: 'btn ghost sm', onclick: () => { editMode = false; drawEditBox(); } }, '收合')
        )
      );
    }
    function setRightTab(t) {
      rightTab = t; Object.entries(rbtn).forEach(([id, b]) => b.classList.toggle('on', id === t));
      rtitle.textContent = t === 'field' ? 'Field' : t === 'brain' ? 'Brain' : 'Code Viewer';
      if (t === 'field') {
        drawEditBox();
        rcKids(rightBody, canvas,
          h('div', { class: 'vxbar' }, playPauseBtn, scrubEl, timeEl, h('span', { class: 'sub' }, '速度'), speedSel),
          !ch ? editBox : null,
          ch && ch.path && ch.path.length ? h('label', { class: 'vxcheck' }, h('input', { type: 'checkbox', checked: showRef, onchange: (e) => { showRef = e.target.checked; drawWorld(curIdx); } }), '顯示參考路線（提示）') : null,
          resBox);
      }
      else if (t === 'brain') { drawBrain(result ? curIdx : null); rcKids(rightBody, h('div', { class: 'vxbrainwrap' }, h('div', { class: 'vxbrainhead' }, 'IQ Brain'), brainEl), h('p', { class: 'sub' }, '這是 Brain 的螢幕。用左邊「Looks」類別的 print 積木印出文字或變數，執行時這裡會顯示。')); }
      else {
        drawCode();
        const bar = h('div', { class: 'vxcodebar' },
          ['py', 'cpp'].map((l) => h('button', { class: 'vxlang' + (codeLang === l ? ' on' : ''), onclick: () => { codeLang = l; st.simCode = l; VX.saveState(); setRightTab('code'); } }, l === 'py' ? 'Python' : 'C++')),
          h('span', { class: 'vxspacer' }),
          h('button', { class: 'vxtb', onclick: async () => { try { await navigator.clipboard.writeText(codeBox._text); toast('已複製程式碼'); } catch (e) { toast('這個瀏覽器不能自動複製，請手動選取'); } } }, '複製'));
        rcKids(rightBody, bar, codeBox, h('p', { class: 'sub' }, '這是示意：同一份積木，轉成 VEXcode 的文字程式（Python 或 C++）大概的樣子。實際以 VEXcode 的「轉換為文字項目」為準——裝置設定（馬達、感測器的名稱與埠）這裡沒有顯示。'));
      }
    }

    /* ---- 頂欄、選單 ---- */
    let menuEl = null;
    function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
    function popMenu(anchor, items) {
      closeMenu();
      menuEl = h('div', { class: 'vxmenu' }, items.map(([label, fn]) => h('button', { onclick: () => { closeMenu(); fn(); } }, label)));
      document.body.append(menuEl);
      placeNear(menuEl, anchor, false);
      setTimeout(() => document.addEventListener('pointerdown', (e) => { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }, { once: true }), 0);
    }
    // 積木選「中文」時，積木庫與工作區的字保持中文，不被英文介面的自動翻譯改掉
    const protectZh = () => {
      [rail, fly, wsInner].forEach((box) => box.querySelectorAll('.blk, .flyex, .vxcat2').forEach((e) => (lang === 'zh' ? e.setAttribute('data-notrans', '1') : e.removeAttribute('data-notrans'))));
    };
    protectZh();
    const setLang = (l) => { lang = l; st.simLang = l; protectZh(); VX.saveState(); hideTip(); drawRail(); drawFly(true); draw(); savedEl.textContent = isSaved ? (lang === 'en' ? 'Saved' : '已儲存') : (lang === 'en' ? 'Not Saved' : '尚未儲存'); };
    const loadRef = () => {
      if (!ch || !ch.code) return toast('這關沒有參考解答');
      const p = parseDsl(ch.code);
      if (!p) { toast('這題的參考解答用了模擬器還不支援的積木'); return; }
      if ((prog.length || defs.length) && !confirm('要用參考解答取代目前的程式嗎？')) return;
      usedRef = true; (st.ch[ch.id] || (st.ch[ch.id] = { done: false, hints: 0 })).usedRef = true;
      snap(); prog = normDirs(p.main); defs = p.defs.map((d) => { normDirs(d.kids); return d; }); target = prog; draw(); drawFly(true); stop(); persist();
    };
    const resetStarter = () => {
      if (!ch || !ch.starter) return;
      if (!confirm('要重新載入原本有 bug 的程式嗎？')) return;
      const p = parseDsl(ch.starter);
      if (!p) return;
      usedRef = false; if (st.ch[ch.id]) st.ch[ch.id].usedRef = false;
      snap(); prog = normDirs(p.main); defs = p.defs.map((d) => { normDirs(d.kids); return d; }); target = prog; draw(); drawFly(true); stop(); persist();
    };
    const clearAll = () => { if ((!prog.length && !defs.length) || confirm('清空全部積木？')) { usedRef = false; if (ch && st.ch[ch.id]) st.ch[ch.id].usedRef = false; snap(); prog = []; defs = []; target = prog; draw(); drawFly(true); stop(); persist(); } };
    const downloadCode = () => { const text = codeText(); const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })), download: (ch ? ch.id : 'program') + (codeLang === 'py' ? '.py' : '.cpp') }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
    const tb = (icKey, label, fn, cls) => h('button', { class: 'vxtb2 ' + (cls || ''), onclick: fn }, ico(icKey), h('span', null, label));
    let globeBtn, fileBtn;
    const fileItems = () => [
      ch && ch.starter ? ['🐛 重設成原本有 bug 的程式', resetStarter] : null,
      ch && ch.code ? ['載入參考解答', loadRef] : null,
      ['清空全部積木', clearAll],
      ['存成「程式說明」筆記', saveNote],
      ['複製／下載程式碼…', () => setRightTab('code')],
      ['上傳 VEXcode 存檔檢查…', () => { location.hash = ch && !ch.custom ? '#/import/' + ch.id : '#/import'; }],
      ['回網站首頁', () => { location.hash = '#/'; }],
    ].filter(Boolean);
    const top = h('header', { class: 'vxbar2' },
      h('a', { class: 'vxlogo', href: '#/', title: '回網站首頁' }, 'IQ'),
      (globeBtn = h('button', { class: 'vxtb2 slim', title: 'Language', onclick: () => popMenu(globeBtn, [['English blocks', () => setLang('en')], ['中文積木', () => setLang('zh')]]) }, ico('globe'), h('span', { class: 'caret' }, '▾'))),
      (fileBtn = h('button', { class: 'vxfile', onclick: () => popMenu(fileBtn, fileItems()) }, 'File')),
      h('span', { class: 'vxdiv' }),
      h('button', { class: 'vxtb2 inline', onclick: () => { location.hash = ch && !ch.custom ? '#/challenge/' + ch.id : '#/challenge'; } }, ico('bulb'), h('span', null, 'Tutorials')),
      h('span', { class: 'vxspacer' }),
      h('div', { class: 'vxslot' }, ico('slot'), h('span', null, 'SLOT')),
      h('div', { class: 'vxproj' }, ico('hex'), h('b', null, ch ? ch.title : 'VEXcode Project')), savedEl,
      h('span', { class: 'vxspacer' }),
      h('div', { class: 'vxtb2 static' }, h('span', { class: 'vxico', html: SVG.brain }), h('span', null, 'BRAIN')),
      tb('download', 'DOWNLOAD', downloadCode), tb('play', 'RUN', run, 'run'), tb('stop', 'STOP', stop), tb('share', 'SHARE', saveNote), tb('exit', 'EXIT', () => { location.hash = '#/'; }));

    const chSel = h('select', { class: 'vxfieldsel', onchange: (e) => { location.hash = e.target.value ? '#/sim/' + e.target.value : '#/sim'; } },
      h('option', { value: '', selected: !ch }, '自由練習／設計關卡'),
      CHALLENGES.map((c) => h('option', { value: c.id, selected: ch && ch.id === c.id }, (c.lu ? '🎯 ' : '') + c.title)),
      st.customCh.map((c) => h('option', { value: c.id, selected: ch && ch.id === c.id }, '🎨 自訂：' + c.title)));
    let rightOff = false;
    const root = h('div', { class: 'vxroot vxscope' });
    const sub = h('div', { class: 'vxsub2' },
      h('div', { class: 'vxcodetab' }, ico('blocksIc'), 'Code'),
      h('span', { class: 'vxlbl' }, '場地'), chSel,
      h('button', { class: 'vxsbtn', title: '復原', onclick: doUndo }, '↶'), h('button', { class: 'vxsbtn', title: '重做', onclick: doRedo }, '↷'),
      h('span', { class: 'vxspacer' }),
      h('button', { class: 'vxsicon', title: '顯示／隱藏右側面板', onclick: () => { rightOff = !rightOff; root.classList.toggle('rightoff', rightOff); } }, ico('screen')),
      h('button', { class: 'vxsicon round', title: '說明', onclick: () => toast('從左邊拖積木到工作區 → 按 RUN。停在積木上 1 秒會顯示中文意思。') }, ico('help')));
    const goal = ch ? h('div', { class: 'vxgoal2' }, h('b', null, '目標：'), ch.goal_t, h('span', null, '　' + ch.task)) : h('div', { class: 'vxgoal2' }, '空場地（每格 200 mm）。拖積木進來，按「RUN」看看機器人怎麼走。');
    const zoomBtn = (label, f) => h('button', { class: 'vxzoom', onclick: f }, label);
    const wsBox = h('div', { class: 'vxwsbox2' }, ws, h('div', { class: 'vxzooms' }, zoomBtn('＋', () => { zoom = Math.min(1.5, zoom + 0.1); applyZoom(); }), zoomBtn('－', () => { zoom = Math.max(0.5, zoom - 0.1); applyZoom(); }), zoomBtn('＝', () => { zoom = 0.95; applyZoom(); })));
    const right = h('div', { class: 'vxright2' }, h('div', { class: 'vxrhead2' }, rtitle, h('span', { class: 'vxspacer' }), ...rbtns, h('button', { class: 'vxrb chev', title: '收合', onclick: () => { rightOff = true; root.classList.add('rightoff'); } }, '›')), rightBody);
    /* 手機（窄螢幕）：積木與場地分成兩個分頁，不用一直上下捲 */
    const segBtns = {};
    const setSeg = (name) => { root.classList.toggle('seg-field', name === 'field'); root.classList.toggle('seg-blocks', name !== 'field'); Object.entries(segBtns).forEach(([k, b]) => b.classList.toggle('on', k === (name === 'field' ? 'field' : 'blocks'))); };
    const seg = h('div', { class: 'vxseg', role: 'tablist' },
      (segBtns.blocks = h('button', { type: 'button', onclick: () => setSeg('blocks') }, '🧩 積木')),
      (segBtns.field = h('button', { type: 'button', onclick: () => setSeg('field') }, '🏁 場地')));
    const narrow = () => window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
    seg._focusField = () => { if (narrow()) setSeg('field'); };
    root.append(top, sub, goal, seg, h('div', { class: 'vxbody' }, h('div', { class: 'vxleft2' }, rail, fly), wsBox, right));
    setSeg('blocks');
    VX.app.replaceChildren(shell(root, { full: true }));
    drawRail(); drawFly(); draw(); setRightTab('field'); drawWorld(0); drawBrain(null); savedEl.textContent = lang === 'en' ? 'Saved' : '已儲存';
    window.addEventListener('hashchange', () => { cancelAnimationFrame(raf); playing = false; }, { once: true });
  }

  VX.routes.sim = (id) => viewSim(id);
  VX.sim = { simulate, judge, diagnoseFail, pickNextChallenge, countBlocks, calcStars, tagBids, parseDsl, makeWorld, toText, toPython, toCpp, programText, staticList, staticBlock, normDirs, CELL, DT };
})();
