/* 上傳 VEXcode 存檔（.iqblocks）→ 檢查 → 訂正教學 → 工程筆記草稿。
   檔案只在瀏覽器裡讀取分析，不會自動上傳；按「存成筆記」才會把筆記（與存檔）存到網站。
   存檔格式：JSON，其中 workspace 是 Blockly XML。積木型別名稱取自 VEXcode IQ 網頁版（codeiq.vex.com）。 */
(function () {
  'use strict';
  const VX = window.VX;
  const { h, api, toast, shell } = VX;
  const S = VX.sim;
  const CELL = S.CELL;
  const L = (el) => el.localName;
  const MAX_BYTES = 500000;

  /* ================= 一、解析存檔 ================= */
  let stats = null;
  function parseBlock(el) {
    const node = { type: el.getAttribute('type') || '?', shadow: L(el) === 'shadow', f: {}, v: {}, s: {}, next: null, mut: {} };
    if (!node.shadow) { stats.count++; stats.types[node.type] = (stats.types[node.type] || 0) + 1; }
    for (const c of el.children) {
      const n = L(c);
      if (n === 'field') node.f[c.getAttribute('name')] = c.textContent;
      else if (n === 'mutation') { for (const a of c.attributes) node.mut[a.name] = a.value; }
      else if (n === 'value') {
        const kids = [...c.children];
        const inner = kids.find((x) => L(x) === 'block') || kids.find((x) => L(x) === 'shadow');
        node.v[c.getAttribute('name')] = inner ? parseBlock(inner) : null;
      } else if (n === 'statement') node.s[c.getAttribute('name')] = parseStack(c);
      else if (n === 'next') { const nb = [...c.children].find((x) => L(x) === 'block'); node.next = nb ? parseBlock(nb) : null; }
    }
    return node;
  }
  function flatten(first) { const out = []; let n = first; while (n) { const nx = n.next; n.next = null; out.push(n); n = nx; } return out; }
  function parseStack(container) {
    const first = [...container.children].find((x) => L(x) === 'block' || L(x) === 'shadow');
    return first ? flatten(parseBlock(first)) : [];
  }
  function parseIq(text, name) {
    let d;
    try { d = JSON.parse(text); } catch (e) { throw new Error('這不是 VEXcode 的積木存檔（讀不懂格式）。請選副檔名是 .iqblocks 的檔案。'); }
    if (!d || typeof d.workspace !== 'string') throw new Error('這個檔案裡找不到積木程式。如果是 Python 或 C++ 專案，目前還不能檢查，請用積木專案（.iqblocks）。');
    if (d.mode && d.mode !== 'Blocks') throw new Error('這是「' + d.mode + '」專案，目前只能檢查積木專案（.iqblocks）。');
    const doc = new DOMParser().parseFromString(d.workspace, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('積木內容讀不懂，檔案可能壞掉了。請回 VEXcode 重新存一次。');
    stats = { count: 0, types: {} };
    const root = doc.documentElement; const vars = {}; const scripts = [];
    for (const el of root.children) if (L(el) === 'variables') for (const v of el.children) vars[v.getAttribute('id')] = v.textContent;
    for (const el of root.children) if (L(el) === 'block') { const node = parseBlock(el); const body = flatten(node.next); node.next = null; scripts.push({ hat: node, body }); }
    return { name, meta: { app: d.appVersion || '', gen: d.targetBrainGen || '', platform: d.platform || '', lang: d.downloadLanguage || '', fileFormat: d.fileFormat || '' }, devices: Array.isArray(d.robotConfig) ? d.robotConfig : [], vars, scripts, stats, raw: text };
  }

  /* ================= 二、共用小工具 ================= */
  const F = (id, level, title, why, fix, hints) => ({ id, level, title, why, fix: fix || [], hints: hints || [] });
  const LEVEL = { error: ['❌', '一定要改'], warn: ['⚠️', '建議改進'], tip: ['💡', '小提醒'] };
  const btnName = (b) => { const m = String(b || '').match(/^Button([A-Z])(Up|Down)$/); return m ? m[1] + ' ' + m[2] : String(b || ''); };
  const isNum = (v) => /^-?\d+(\.\d+)?$/.test(String(v).trim());
  const devNames = (p) => p.devices.map((d) => d.name).filter(Boolean);
  const dirTxt = (d) => ({ forward: 'forward', reverse: 'reverse', left: 'left', right: 'right' }[d] || d);
  const primTxt = (p) => (p.k === 'drive' ? 'drive ' + dirTxt(p.dir) + ' for ' + (isFinite(p.v) ? Math.round(p.v) : '?') + ' mm' : 'turn ' + dirTxt(p.dir) + ' for ' + (isFinite(p.v) ? Math.round(p.v) : '?') + ' degrees');

  /* ================= 三、自動程式：轉成模擬器程式 ================= */
  const NUMT = ['math_number', 'math_integer', 'math_whole_number', 'math_positive_number', 'math_positive_number_only'];
  function convertAuto(stack, ctx) {
    const numOf = (nd) => {
      if (!nd) return '0';
      if (NUMT.includes(nd.type)) return nd.f.NUM != null ? nd.f.NUM : '0';
      if (nd.type === 'iq_variables_variable' || nd.type === 'data_variable') return nd.f.VARIABLE || '0';
      ctx.unsup.add(nd.type); return '0';
    };
    const mm = (v, units) => (units === 'in' && isNum(v) ? String(Math.round(parseFloat(v) * 25.4 * 10) / 10) : v);
    const flip = (op) => ({ '<': '>', '>': '<', '<=': '>=', '>=': '<=' }[op] || op);
    const cond = (nd) => {
      if (!nd) { ctx.unsup.add('（空的條件）'); return { k: 'dist', op: '<', v: '0' }; }
      if (nd.type === 'iq_sensing_pressing_bumper') return { k: 'bump' };
      if (nd.type === 'iq_operator_comparison') {
        const a = nd.v.NUM1, b = nd.v.NUM2, op = nd.f.COMPARISON || '==';
        const isD = (x) => x && x.type === 'iq_sensing_distance_object_distance';
        const isN = (x) => x && NUMT.includes(x.type);
        if (isD(a) && isN(b)) return { k: 'dist', op, v: mm(b.f.NUM, a.f.UNITS) };
        if (isD(b) && isN(a)) return { k: 'dist', op: flip(op), v: mm(a.f.NUM, b.f.UNITS) };
      }
      ctx.unsup.add(nd.type); return { k: 'dist', op: '<', v: '0' };
    };
    const out = [];
    stack.forEach((n) => {
      const kids = (name) => convertAuto(n.s[name] || [], ctx);
      const dontWait = n.f.anddontwait_mutator === 'true' || n.mut.anddontwait === 'true';
      switch (n.type) {
        case 'iq_drivetrain_drive_for': out.push({ t: 'drive', dir: n.f.DIRECTION === 'rev' ? 'reverse' : 'forward', v: mm(numOf(n.v.AMOUNT), n.f.UNITS) }); if (dontWait) ctx.dontwait = true; break;
        case 'iq_drivetrain_drive': out.push({ t: 'drivec', dir: n.f.DIRECTION === 'rev' ? 'reverse' : 'forward' }); break;
        case 'iq_drivetrain_turn_for': out.push({ t: 'turn', dir: n.f.TURNDIRECTION === 'right' ? 'right' : 'left', v: numOf(n.v.AMOUNT) }); if (dontWait) ctx.dontwait = true; break;
        case 'iq_motion_stop_driving': out.push({ t: 'stop' }); break;
        case 'iq_drivetrain_set_drive_velocity': if (n.f.UNITS === 'rpm') { ctx.unsup.add('速度單位 rpm'); } else out.push({ t: 'vel', v: numOf(n.v.VELOCITY) }); ctx.velSet = true; break;
        case 'iq_drivetrain_set_turn_velocity': if (n.f.UNITS === 'rpm') { ctx.unsup.add('速度單位 rpm'); } else out.push({ t: 'tvel', v: numOf(n.v.VELOCITY) }); ctx.velSet = true; break;
        case 'iq_control_wait': out.push({ t: 'wait', v: numOf(n.v.DURATION) }); break;
        case 'iq_control_repeat': out.push({ t: 'repeat', v: numOf(n.v.TIMES), kids: kids('SUBSTACK') }); break;
        case 'iq_control_forever': out.push({ t: 'forever', kids: kids('SUBSTACK') }); break;
        case 'iq_control_repeat_until': out.push({ t: 'until', cond: cond(n.v.CONDITION), kids: kids('SUBSTACK') }); break;
        case 'iq_control_while': out.push({ t: 'while', cond: cond(n.v.CONDITION), kids: kids('SUBSTACK') }); break;
        case 'iq_control_wait_until': out.push({ t: 'until', cond: cond(n.v.CONDITION), kids: [] }); break;
        case 'iq_control_if_then': out.push({ t: 'if', cond: cond(n.v.CONDITION), kids: kids('SUBSTACK'), elseKids: [] }); break;
        case 'iq_control_if_then_else': out.push({ t: 'if', cond: cond(n.v.CONDITION), kids: kids('SUBSTACK'), elseKids: kids('SUBSTACK2') }); break;
        case 'iq_control_if_elseif_else': {
          const nb = parseInt(n.mut.branches, 10) || 1;
          const build = (i) => (i > nb ? convertAuto(n.s.SUBSTACK_ELSE || [], ctx) : [{ t: 'if', cond: cond(n.v['CONDITION' + i]), kids: convertAuto(n.s['SUBSTACK' + i] || [], ctx), elseKids: build(i + 1) }]);
          out.push(...build(1)); break;
        }
        case 'iq_variables_set_variable': case 'data_setvariableto': { const val = Object.values(n.v)[0]; out.push({ t: 'setvar', name: n.f.VARIABLE || 'var', v: numOf(val) }); break; }
        case 'iq_variables_change_variable': case 'data_changevariableby': { const val = Object.values(n.v)[0]; out.push({ t: 'chvar', name: n.f.VARIABLE || 'var', v: numOf(val) }); break; }
        case 'iq_screen_print': { const d = n.v.DATA; const txt = d ? (d.f.TEXT != null ? d.f.TEXT : d.f.NUM != null ? d.f.NUM : d.f.VARIABLE || '') : ''; out.push({ t: 'print', v: txt }); if (n.f.andsetcursortonextrow_mutator === 'true' || n.mut.andsetcursortonextrow === 'true') out.push({ t: 'nextrow' }); break; }
        default: ctx.unsup.add(n.type); out.push({ t: 'unsupported', label: n.type });
      }
    });
    return out;
  }

  /* ---- 動作展開（用來和參考路線逐步對照）---- */
  function expandPrims(list, defs, scope, out) {
    for (const b of list) {
      if (out.length > 80 || out.complex) return;
      const val = (v) => (isNum(v) ? parseFloat(v) : scope && v in scope ? scope[v] : NaN);
      const nd = (d) => ((d === 'reverse' || d === '反向') ? 'reverse' : (d === 'left' || d === '左邊') ? 'left' : (d === 'right' || d === '正確的') ? 'right' : 'forward');
      switch (b.t) {
        case 'drive': out.push({ k: 'drive', dir: nd(b.dir), v: val(b.v) }); break;
        case 'turn': out.push({ k: 'turn', dir: nd(b.dir), v: val(b.v) }); break;
        case 'repeat': { const n = val(b.v); if (!isFinite(n)) { out.complex = true; return; } for (let i = 0; i < Math.min(n, 40); i++) expandPrims(b.kids, defs, scope, out); break; }
        case 'call': { const d = (defs || []).find((x) => x.name === b.name); if (!d) { out.complex = true; return; } const sc = {}; (d.params || []).forEach((p, i) => { sc[p] = val((b.args || [])[i]); }); expandPrims(d.kids, defs, sc, out); break; }
        case 'forever': case 'while': case 'until': case 'if': case 'setvar': case 'chvar': out.complex = true; return;
        default: break;
      }
    }
  }
  const prims = (list, defs) => { const o = []; expandPrims(list, defs, {}, o); return o; };

  function firstDiff(user, ref) {
    const n = Math.max(user.length, ref.length);
    for (let i = 0; i < n; i++) {
      const u = user[i], r = ref[i];
      if (!u) return { i, type: 'missing', r };
      if (!r) return { i, type: 'extra', u };
      if (u.k !== r.k) return { i, type: 'kind', u, r };
      if (u.dir !== r.dir) return { i, type: 'dir', u, r };
      const tol = u.k === 'drive' ? Math.max(20, 0.1 * Math.abs(r.v)) : Math.max(5, 0.1 * Math.abs(r.v));
      if (isFinite(u.v) && Math.abs(Math.abs(u.v) - Math.abs(r.v)) > tol) return { i, type: 'val', u, r };
      if (!isFinite(u.v)) return { i, type: 'noval', u, r };
    }
    return null;
  }

  /* ================= 四、自動程式檢查 ================= */
  function analyzeAuto(p, ch) {
    const findings = [];
    const starts = p.scripts.filter((s) => s.hat.type === 'iq_events_when_started');
    const ctx = { unsup: new Set(), velSet: false, dontwait: false };
    if (!starts.length) {
      findings.push(F('no-start', 'error', '程式沒有接在「when started」下面', '程式一定要從「when started」開始才會執行。沒有接在它下面的積木，按 RUN 時不會動。', ['在 VEXcode 左邊的 Events 類別，把「when started」拖到工作區。', '把你的積木接在它的正下方。', '重新存檔、再上傳一次。'], ['提示：這個存檔裡找不到「when started」積木，或它下面沒有接任何積木。']));
      return { kind: 'auto', findings, model: { main: [] }, unsup: [], world: S.makeWorld(ch), result: null, j: null, prims: [], ref: null };
    }
    const main = convertAuto(starts[0].body, ctx);
    if (starts.length > 1) findings.push(F('multi-start', 'warn', '有 ' + starts.length + ' 組「when started」', '每一組 when started 會「同時」執行。模擬器只模擬第一組，結果可能和真機不同。', ['確認是不是真的需要好幾組同時跑。', '自動程式通常只要一組就夠了。']));
    if (!starts[0].body.length) findings.push(F('empty-start', 'error', '「when started」底下沒有積木', '程式是空的，機器人不會做任何事。', ['把 drive、turn 等積木接在「when started」下面。']));
    const unsup = [...ctx.unsup];
    if (unsup.length) findings.push(F('unsupported', 'warn', '有 ' + unsup.length + ' 種積木，模擬器還看不懂', '這些積木模擬器無法模擬，所以「模擬結果」可能不準：' + unsup.slice(0, 6).join('、') + (unsup.length > 6 ? '…' : ''), ['這不一定是錯誤，只是要用真的機器人實測來確認這一部分。', '請把這段在真機上的結果記進測試紀錄。']));
    if (ctx.dontwait) findings.push(F('dontwait', 'tip', '用了「and don\'t wait（不等待）」', '勾了這個，積木會一開始動就「馬上」做下一個，不會等它走完。模擬器按「走完才繼續」來模擬，可能和真機不同。', ['確定你需要同時做兩件事時才使用。']));
    const world = S.makeWorld(ch);
    const model = { main, defs: [] };
    const result = S.simulate(model, world); const j = S.judge(result);
    // 設備檢查
    const hasDrive = p.devices.some((d) => /drive/i.test((d.deviceType || '') + (d.deviceClass || '') + (d.name || '')));
    const usesDrive = JSON.stringify(main).includes('"t":"drive"') || JSON.stringify(main).includes('"t":"turn"');
    if (usesDrive && p.devices.length && !hasDrive) findings.push(F('no-drivetrain', 'warn', '裝置裡好像沒有 Drivetrain', 'drive、turn 這類積木要先在 Devices（裝置）加入 Drivetrain，才知道哪兩顆馬達是輪子。', ['在 VEXcode 右上角點 Devices。', '按 Add a device，選 Drivetrain 2-motor。', '選左右馬達的埠，按完成。'], ['請對照：你的存檔裡有這些裝置：' + (devNames(p).join('、') || '（沒有）')]));
    // 對照參考路線
    let ref = null, diff = null;
    if (ch) {
      const rp = S.parseDsl(ch.code); if (rp) { rp.main = S.normDirs(rp.main); rp.defs.forEach((d) => S.normDirs(d.kids)); ref = rp; }
    }
    const userP = prims(main, []);
    let refP = null;
    if (ref) { refP = prims(ref.main, ref.defs); }
    if (ch && !j.ok) {

      if (refP && !userP.complex && !refP.complex) {
        diff = firstDiff(userP, refP);
        if (diff) {
          const n = diff.i + 1;
          const map = {
            dir: () => F('diff-dir', 'error', '第 ' + n + ' 個動作：轉彎方向和目標路線不一樣', '「right」是向右轉、「left」是向左轉。轉完面向哪裡，決定下一段往哪走；一個方向錯，後面整條路都會偏。', ['在 VEXcode 找到第 ' + n + ' 個移動積木（drive 或 turn）。', '點下拉選單，把方向改成另一邊。', '按 RUN（或回網站再上傳）檢查。'], ['提示 1：整條路線裡有一個轉彎方向和目標不一樣。', '提示 2：問題出在第 ' + n + ' 個移動動作。', '提示 3：你寫的是「' + primTxt(diff.u) + '」，目標路線在這裡是「' + primTxt(diff.r) + '」。']),
            val: () => F('diff-val', 'error', '第 ' + n + ' 個動作：' + (diff.u.k === 'drive' ? '走的距離' : '轉的角度') + '和目標差不少', diff.u.k === 'drive' ? '距離要用場地來算：這個場地每一格是 200 mm。走多少格，就是格數 × 200。' : '轉彎角度要和路線一致：直角是 90°，掉頭是 180°。', ['先量／算出這一段正確的' + (diff.u.k === 'drive' ? '距離（每格 200 mm）' : '角度') + '。', '把第 ' + n + ' 個積木裡的數字改掉。', '重新跑、再上傳。'], ['提示 1：有一個動作的數字不對。', '提示 2：問題出在第 ' + n + ' 個移動動作。', '提示 3：你寫「' + primTxt(diff.u) + '」，目標大約是「' + primTxt(diff.r) + '」。']),
            kind: () => F('diff-kind', 'error', '第 ' + n + ' 個動作：種類不對（該走還是該轉？）', '路線是「走一段、轉一下」交替的。想一想這一步機器人應該直走還是轉彎。', ['對照場地圖，看第 ' + n + ' 步機器人要做什麼。', '把積木換成正確的種類。'], ['提示 1：某一步該直走卻轉彎了，或相反。', '提示 2：問題出在第 ' + n + ' 個動作。', '提示 3：你寫「' + primTxt(diff.u) + '」，目標這裡是「' + primTxt(diff.r) + '」。']),
            missing: () => F('diff-missing', 'error', '少了動作：路線還沒走完', '目標路線有 ' + refP.length + ' 個移動動作，你的程式只有 ' + userP.length + ' 個。', ['對照場地圖，看機器人還要走到哪裡。', '補上缺的 drive／turn 積木（或用 repeat）。'], ['提示 1：你的程式在路線走完之前就結束了。', '提示 2：從第 ' + n + ' 個動作開始少了。', '提示 3：缺的是「' + primTxt(diff.r) + '」。']),
            extra: () => F('diff-extra', 'warn', '多了動作：路線之後還有多餘的動作', '目標路線只有 ' + refP.length + ' 個移動動作，你的程式有 ' + userP.length + ' 個。多出來的動作可能讓機器人走過頭。', ['看看最後面的積木是不是多放了。', '刪掉多餘的動作再試。'], ['提示：從第 ' + n + ' 個動作開始是多出來的（' + primTxt(diff.u) + '）。']),
            noval: () => F('diff-noval', 'warn', '第 ' + n + ' 個動作的數字是變數或算式', '模擬器沒辦法預先知道變數的值，所以無法逐步對照。', ['確認變數的值有設對。'], []),
          };
          findings.push(map[diff.type]());
        }
      } else if (userP.complex) findings.push(F('complex', 'tip', '程式用到迴圈裡的條件或變數，無法逐步對照', '只用模擬結果判斷。如果結果不對，請先檢查條件（例如距離數字）和變數的值。', []));
    }
    if (ch && !j.ok && !findings.some((f) => /^diff-/.test(f.id))) {
  j.msgs.forEach((m, i) => findings.push(F('sim-' + i, 'error', '模擬結果：' + m.replace(/^[^一-龥A-Za-z]+/, '').slice(0, 40), '這是把你的程式放進模擬器場地跑出來的結果。', ['先看下面「對照參考路線」找出哪一步不一樣。', '改完後，在 VEXcode 存檔，再上傳一次。'])));
    }
    // 程式風格檢查
    const rep = findRepeat(main);
    if (rep) findings.push(F('use-repeat', 'tip', '同樣的積木重複寫了 ' + rep + ' 次', '重複的動作可以用「repeat」積木包起來，程式更短、更好改，也比較不容易出錯。', ['在 Control 類別拖一個「repeat」。', '把重複的那一組積木放進去，次數填 ' + rep + '。']));
    if (!ctx.velSet && userP.length) findings.push(F('no-velocity', 'tip', '沒有設定速度', '沒設定就用預設速度。想要走得更準，可以先降低速度，並在測試紀錄寫下你用的速度。', ['在 Drivetrain - Settings 類別，拖「set drive velocity to ... %」放在最前面。']));
    if (JSON.stringify(main).match(/"t":"(while|until)"/) && JSON.stringify(main).match(/"k":"dist"/)) {
      const v = [...JSON.stringify(main).matchAll(/"t":"vel","v":"(\d+)"/g)].map((m) => +m[1]);
      if (!v.length || Math.max(...v) > 70) findings.push(F('sensor-speed', 'tip', '用距離感測器停車時，速度要慢一點', '機器人停下來會因為慣性多滑一段，速度越快滑越遠，所以常常停得比想的更近。', ['把驅動速度降到 50% 左右再試。', '或把停止的距離門檻設大一點。']));
    }
    if (ch && j.ok) findings.push(F('sim-pass', 'tip', '模擬通過了！下一步用真的機器人試試看', '模擬器是理想的，真機會有誤差。把同一個程式放到機器人上跑，量一量實際結果，這個差距就是工程筆記最好的內容。', ['在 VEXcode 按 Download，再按 RUN。', '用尺量實際走的距離。', '按下方「存成工程筆記」，補上你量到的數字。']));
    return { kind: 'auto', findings, model, unsup, world, result, j, prims: userP, ref: refP };
  }
  function findRepeat(list) {
    const key = (b) => JSON.stringify(b);
    for (let k = 1; k <= 3; k++) for (let s = 0; s + k * 3 <= list.length; s++) {
      const seg = list.slice(s, s + k).map(key).join('|'); let times = 1;
      while (s + (times + 1) * k <= list.length && list.slice(s + times * k, s + (times + 1) * k).map(key).join('|') === seg) times++;
      if (times >= 3 && !(list[s].t === 'wait')) return times;
    }
    return 0;
  }

  /* ================= 五、遙控程式檢查 ================= */
  const SPIN = ['iq_motion_spin', 'iq_motion_spin_for', 'iq_motion_spin_to_position'];
  function analyzeTeleop(p) {
    const findings = [];
    if (!p.scripts.length) { findings.push(F('t-empty', 'error', '工作區裡沒有任何程式', '', ['回 VEXcode 拖積木、寫好程式再存檔。'])); return { kind: 'teleop', findings, table: [], facts: {} }; }
    const cfgNames = new Set(devNames(p));
    const facts = { spun: {}, stopped: new Set(), velocity: new Set(), stopping: false, torque: false, controllerReads: [], motorsUsed: new Set(), scriptsOfMotor: {} };
    const table = []; const dupFind = []; const conflicts = []; const readsOutsideLoop = [];
    const motorRef = (n) => { if (n.f && n.f.MOTOR) { facts.motorsUsed.add(n.f.MOTOR); return n.f.MOTOR; } return null; };
    const exprWalk = (nd, fn) => { if (!nd) return; fn(nd); Object.values(nd.v || {}).forEach((x) => exprWalk(x, fn)); };
    const actionTxt = (n) => {
      switch (n.type) {
        case 'iq_motion_spin': return 'spin ' + n.f.MOTOR + ' ' + (n.f.DIRECTION === 'rev' ? 'reverse' : 'forward');
        case 'iq_motion_spin_for': return 'spin ' + n.f.MOTOR + ' ' + (n.f.DIRECTION === 'rev' ? 'reverse' : 'forward') + ' for ' + numTxt(n.v.AMOUNT);
        case 'iq_motion_spin_to_position': return 'spin ' + n.f.MOTOR + ' to position ' + numTxt(n.v.AMOUNT);
        case 'iq_motion_stop_motor': return 'stop ' + n.f.MOTOR;
        case 'iq_motion_set_motor_velocity': return 'set ' + n.f.MOTOR + ' velocity to ' + numTxt(n.v.VELOCITY) + '%';
        case 'iq_motion_set_motor_stopping': return 'set ' + n.f.MOTOR + ' stopping to ' + n.f.MODE;
        case 'iq_motion_set_motor_torque': return 'set ' + n.f.MOTOR + ' max torque to ' + numTxt(n.v.TORQUE) + '%';
        case 'iq_motion_stop_driving': return 'stop driving';
        case 'iq_drivetrain_drive': return 'drive ' + (n.f.DIRECTION === 'rev' ? 'reverse' : 'forward');
        case 'iq_drivetrain_turn': return 'turn ' + n.f.TURNDIRECTION;
        default: return null;
      }
    };
    const numTxt = (nd) => (!nd ? '?' : NUMT.includes(nd.type) ? nd.f.NUM : nd.type === 'iq_variables_variable' ? nd.f.VARIABLE : '…');
    const condTxt = (nd) => {
      if (!nd) return '（空條件）';
      if (nd.type === 'iq_sensing_pressing_controller') return 'button ' + btnName(nd.f.BUTTON) + ' pressed';
      if (nd.type === 'iq_operator_not') return 'not ' + condTxt(nd.v.OPERAND);
      if (nd.type === 'iq_operator_comparison') { const side = (x) => (x && x.type === 'iq_sensing_position_of_controller' ? 'axis ' + String(x.f.AXIS || '').replace('Axis', '') + ' position' : numTxt(x)); return side(nd.v.NUM1) + ' ' + (nd.f.COMPARISON || '') + ' ' + side(nd.v.NUM2); }
      return nd.type.replace(/^iq_/, '');
    };
    function walk(list, ctx) {
      const seenDir = {};
      list.forEach((n) => {
        const m = motorRef(n);
        if (m && SPIN.includes(n.type)) {
          facts.spun[m] = true; (facts.scriptsOfMotor[m] = facts.scriptsOfMotor[m] || new Set()).add(ctx.script);
          if (n.f.DIRECTION) { if (seenDir[m] && seenDir[m] !== n.f.DIRECTION) conflicts.push({ motor: m, where: ctx.where }); seenDir[m] = n.f.DIRECTION; }
        }
        if (m && n.type === 'iq_motion_stop_motor') facts.stopped.add(m);
        if (m && n.type === 'iq_motion_set_motor_velocity') facts.velocity.add(m);
        if (n.type === 'iq_motion_set_motor_stopping') facts.stopping = true;
        if (n.type === 'iq_motion_set_motor_torque') facts.torque = true;
        // 條件裡的遙控器讀取
        const condKeys = Object.keys(n.v).filter((k) => /^CONDITION/.test(k));
        condKeys.forEach((k) => exprWalk(n.v[k], (x) => { if (x.type === 'iq_sensing_pressing_controller' || x.type === 'iq_sensing_position_of_controller') { facts.controllerReads.push(x); if (!ctx.loop) readsOutsideLoop.push({ script: ctx.script, node: x }); } }));
        const isLoop = ['iq_control_forever', 'iq_control_while', 'iq_control_repeat_until'].includes(n.type);
        if (n.type === 'iq_control_if_then' || n.type === 'iq_control_if_then_else' || n.type === 'iq_control_if_elseif_else') {
          const branches = [];
          if (n.type === 'iq_control_if_elseif_else') { const nb = parseInt(n.mut.branches, 10) || 1; for (let i = 1; i <= nb; i++) branches.push([n.v['CONDITION' + i], n.s['SUBSTACK' + i] || []]); if (n.s.SUBSTACK_ELSE) branches.push([null, n.s.SUBSTACK_ELSE]); }
          else { branches.push([n.v.CONDITION, n.s.SUBSTACK || []]); if (n.type === 'iq_control_if_then_else') branches.push([null, n.s.SUBSTACK2 || []]); }
          const btnSeen = {};
          branches.forEach(([c, st]) => {
            const acts = st.map(actionTxt).filter(Boolean);
            const t = c ? condTxt(c) : 'otherwise（其他情況）';
            if (acts.length) table.push({ trigger: t, actions: acts, script: ctx.script });
            exprWalk(c, (x) => { if (x.type === 'iq_sensing_pressing_controller') { btnSeen[x.f.BUTTON] = (btnSeen[x.f.BUTTON] || 0) + 1; } });
          });
          Object.entries(btnSeen).forEach(([b, c]) => { if (c > 1) dupFind.push(b); });
        }
        Object.keys(n.s).forEach((k) => walk(n.s[k], { ...ctx, loop: ctx.loop || isLoop, where: ctx.where }));
      });
    }
    p.scripts.forEach((sc, i) => {
      const hat = sc.hat; const hatName = hat.type.replace(/^iq_events_/, '');
      const ctx = { script: i, loop: false, where: '第 ' + (i + 1) + ' 組程式（' + hatName + '）' };
      if (hat.type === 'iq_events_when_controller_button') {
        const acts = sc.body.map(actionTxt).filter(Boolean);
        table.push({ trigger: 'when button ' + btnName(hat.f.BUTTON) + ' ' + (hat.f.EVENTTYPE || 'pressed'), actions: acts, script: i });
        ctx.loop = true;
      } else if (hat.type === 'iq_events_when_controller_axis') { table.push({ trigger: 'when axis ' + String(hat.f.AXIS || '').replace('Axis', '') + ' changed', actions: sc.body.map(actionTxt).filter(Boolean), script: i }); ctx.loop = true; }
      walk(sc.body, ctx);
    });
    const hats = p.scripts.map((s) => s.hat.type);
    const spunList = Object.keys(facts.spun);
    // 發現
    const nonStart = hats.filter((x) => x !== 'iq_events_when_started').length;
    if (!hats.some((x) => /^iq_events_when/.test(x))) findings.push(F('t-nohat', 'error', '程式沒有任何「when」開頭的積木', '沒有 when started 或其他事件積木，按 RUN 時什麼都不會發生。', ['在 Events 類別拖「when started」，把積木接在下面。']));
    if (readsOutsideLoop.length) findings.push(F('t-noloop', 'error', '只在程式剛開始時檢查一次遙控器', '遙控器按鈕要「一直」檢查，機器人才會跟著你的手動。如果只在 when started 裡檢查一次，之後再怎麼按都沒反應。', ['在 Control 類別拖一個「forever」。', '把「if 按鈕按下」那一堆積木放進 forever 裡面。', '重新存檔上傳。'], ['提示 1：你的遙控器判斷沒有放在會「重複」的積木裡。', '提示 2：看 ' + (readsOutsideLoop[0] ? '第 ' + (readsOutsideLoop[0].script + 1) + ' 組程式' : '程式') + '裡的 if 判斷。', '提示 3：把它們整組放進 forever 迴圈。']));
    const noStop = spunList.filter((m) => !facts.stopped.has(m));
    if (noStop.length) findings.push(F('t-nostop', 'error', '有馬達轉起來之後沒有地方讓它停：' + noStop.join('、'), 'spin 積木會讓馬達一直轉。一定要有「stop」積木（例如放開按鈕時），不然馬達會停不下來。', ['在每個「按下按鈕就 spin」的 if 後面加一個「else」（else 裡放 stop 這顆馬達）。', '或用「when button released」事件積木來 stop。', '重新存檔上傳。'], ['提示 1：有些馬達只有 spin、沒有 stop。', '提示 2：沒有 stop 的馬達：' + noStop.join('、') + '。', '提示 3：在 if 的 else 裡放「stop 這顆馬達」。']));
    if (conflicts.length) findings.push(F('t-conflict', 'error', '同一組積木裡，同一顆馬達被叫去往兩個方向轉', '同一顆馬達在同一個動作裡先正轉又反轉，後面的會蓋掉前面的，馬達不會照你想的動。', ['檢查 ' + conflicts[0].where + ' 裡 ' + conflicts[0].motor + ' 的 spin 方向。', '一組動作裡，每顆馬達只要有一個方向。'], []));
    const bad = [...facts.motorsUsed].filter((m) => cfgNames.size && !cfgNames.has(m));
    if (bad.length) findings.push(F('t-baddev', 'error', '積木用到沒有設定的裝置：' + bad.join('、'), '積木裡的馬達名稱，要和 Devices（裝置）裡設定的一樣，否則下載到機器人時會出錯。', ['在 VEXcode 的 Devices 檢查有沒有這顆馬達。', '沒有就新增，有的話把積木改成正確的名稱。'], ['你的存檔裡有這些裝置：' + (devNames(p).join('、') || '（沒有）')]));
    if (dupFind.length) findings.push(F('t-dupbtn', 'warn', '同一個按鈕在同一組 if 裡出現不只一次：' + [...new Set(dupFind)].map(btnName).join('、'), '前面的條件成立後，後面一樣的條件永遠不會被執行。', ['檢查那組 if／else if，把重複的按鈕改成不同按鈕，或合併。']));
    const multi = spunList.filter((m) => facts.scriptsOfMotor[m] && facts.scriptsOfMotor[m].size > 1);
    if (multi.length) findings.push(F('t-multi', 'warn', '同一顆馬達被好幾組程式同時控制：' + multi.join('、'), '多組程式（when started、when 按鈕…）是同時執行的。如果它們都控制同一顆馬達，可能互相搶著下命令，動作會怪怪的。', ['盡量讓一顆馬達只由一組程式控制。', '或確認它們不會同時被觸發。']));
    const novel = spunList.filter((m) => !facts.velocity.has(m));
    if (novel.length) findings.push(F('t-novel', 'tip', '這些馬達沒有設定速度：' + novel.join('、'), '沒設定就用預設速度。手臂、爪子通常需要自己調速度，才不會太快。', ['在 when started 最前面加「set 馬達 velocity to … %」。']));
    if (spunList.length >= 3 && !facts.stopping) findings.push(F('t-hold', 'tip', '手臂、爪子可以設定「stopping: hold」', '預設放開後馬達會自由滑動；設成 hold 可以把手臂或爪子「鎖住」不掉下來。', ['在 when started 最前面，加「set 馬達 stopping to hold」。']));
    const drivePair = table.filter((r) => /button/.test(r.trigger) && r.actions.length >= 2 && r.actions.every((a) => /^spin/.test(a)));
    if (drivePair.length >= 4) findings.push(F('t-axis', 'tip', '有 ' + drivePair.length + ' 個按鈕在控制車子前進轉彎', '這樣很像一般遙控車。其實可以直接用搖桿（axis）控制：搖桿推多少，馬達就轉多快，更順手，程式也短很多。', ['在 Sensing 類別找「controller axis position」積木。', '用它的值去設定左右馬達速度（tank 或 arcade 控制）。', '這是進階玩法，可以之後再嘗試。']));
    const usesGyro = Object.keys(p.stats.types).some((k) => /gyro|inertial|heading|rotation/i.test(k));
    if (!usesGyro && spunList.length >= 2 && table.some((r) => /button|axis/.test(r.trigger))) findings.push(F('t-lock', 'tip', '可以加「方向鎖定」，讓遙控直走更穩', '這份程式沒有用到 Gyro。遙控時機器人常會慢慢偏。很多隊伍會加一個按鈕：按下時用 Gyro 記住目前朝向，之後自動把機器人轉回那個方向（回授），直走就穩多了。', ['按下鎖定按鈕時，把 Gyro 朝向存進變數當目標。', '在「一直重複」裡，用「目標 − 目前朝向」算誤差，乘上 Kp，加到左右輪速度差。', '到「比賽專區 → 控制實驗室 → 遙控方向鎖定」先看原理。']));
    if (!findings.some((f) => f.level === 'error')) findings.push(F('t-ok', 'tip', '結構檢查沒發現明顯問題', '下一步是用真的機器人，把每個按鈕都按一次，看機器人是不是照「控制對照表」動。', ['下載到機器人，一個按鈕一個按鈕測。', '用下方的「存成工程筆記」，會產生一份可以勾選的測試表。']));
    return { kind: 'teleop', findings, table, facts: { motors: spunList, devices: devNames(p), scripts: p.scripts.length } };
  }

  /* ================= 六、判斷種類 ================= */
  function detectKind(p) {
    const t = p.stats.types; const has = (re) => Object.keys(t).some((k) => re.test(k));
    const tele = has(/controller|spin|stop_motor|set_motor/), auto = has(/^iq_drivetrain_(drive|turn)/);
    if (auto && !tele) return 'auto'; if (tele && !auto) return 'teleop';
    if (auto && tele) return p.scripts.some((s) => /controller/.test(s.hat.type)) ? 'teleop' : 'auto';
    return 'auto';
  }

  /* ================= 七、畫面 ================= */
  let cur = null;
  function viewImport() {
    const st = VX.st; st.imports = st.imports || [];
    const chSel = h('select', { id: 'impch', onchange: () => { if (cur) run(cur.parsed); } }, h('option', { value: '' }, '不指定（只做一般檢查）'), CHALLENGES.map((c) => h('option', { value: c.id }, (c.lu ? '🎯 ' : '') + c.title)));
    const kindSel = h('select', { id: 'impkind', onchange: () => { if (cur) run(cur.parsed); } }, [['auto', '自動辨識'], ['autoprog', '自動程式（走路線）'], ['teleop', '遙控程式（用遙控器開）']].map(([v, t]) => h('option', { value: v === 'auto' ? '' : v === 'autoprog' ? 'auto' : v }, t)));
    const out = h('div');
    const file = h('input', { type: 'file', accept: '.iqblocks,.json,application/json', onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > MAX_BYTES) return showErr(out, '這個檔案太大了（超過 500 KB），不像是 VEXcode 的存檔。');
      try { const text = await f.text(); const parsed = parseIq(text, f.name); run(parsed); } catch (err) { showErr(out, err.message); }
    } });
    // 預選挑戰
    const pre = (location.hash.split('/')[2] || '');
    if (pre && CHALLENGES.find((c) => c.id === pre)) chSel.value = pre;
    function run(parsed) {
      const chId = chSel.value, ch = CHALLENGES.find((c) => c.id === chId) || null;
      const kind = kindSel.value || detectKind(parsed);
      const analysis = kind === 'teleop' ? analyzeTeleop(parsed) : analyzeAuto(parsed, ch);
      const prev = (st.imports || []).slice().reverse().find((x) => x.key === (chId || 'free') + ':' + kind);
      cur = { parsed, ch, kind, analysis, prev };
      render(out);
      const rec = { key: (chId || 'free') + ':' + kind, ts: Date.now(), name: parsed.name, ids: analysis.findings.filter((f) => f.level !== 'tip').map((f) => f.id), titles: Object.fromEntries(analysis.findings.map((f) => [f.id, f.title])), ok: analysis.findings.every((f) => f.level === 'tip') };
      st.imports.push(rec); if (st.imports.length > 12) st.imports.shift();
      if (VX.act) VX.act('import'); VX.saveState();
    }
    VX.app.replaceChildren(shell(h('div', { class: 'vxscope' },
      h('p', { class: 'sub' }, '在 VEXcode 寫好程式後存檔，再上傳到這裡。網站會檢查有沒有問題，不對的話一步一步帶你改，最後幫你產生工程筆記的草稿。'),
      h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, '怎麼存檔？'), h('ol', null, h('li', null, '在 VEXcode 左上角按「File（檔案）」→「Save as（另存為）」。'), h('li', null, '存到電腦（iPad 存到「檔案」App）。檔案的副檔名是 .iqblocks。'), h('li', null, '回到這裡，按下面的「選擇檔案」。'))),
      h('div', { class: 'panel' }, h('div', { class: 'field' }, h('label', null, '1. 這個程式是做哪個挑戰的？'), chSel, h('div', { class: 'help' }, '選了才能對照路線；不選就只做一般檢查。')),
        h('div', { class: 'field' }, h('label', null, '2. 程式類型'), kindSel),
        h('div', { class: 'field' }, h('label', null, '3. 選擇 VEXcode 存檔（.iqblocks）'), file),
        h('p', { class: 'sub' }, '🔒 檔案只在你的瀏覽器裡分析，不會自動上傳。')),
      out), { title: '上傳 VEXcode 存檔', icon: '📤' }));
  }
  function showErr(out, msg) { out.replaceChildren(h('div', { class: 'panel' }, h('div', { class: 'errmsg' }, '❌ ' + msg))); cur = null; }

  function render(out) {
    const { parsed, ch, kind, analysis, prev } = cur; const A = analysis;
    const errs = A.findings.filter((f) => f.level === 'error'), warns = A.findings.filter((f) => f.level === 'warn');
    const okAll = !errs.length;
    const badge = okAll ? (warns.length ? h('span', { class: 'tag' }, '⚠️ 沒有錯誤，有 ' + warns.length + ' 項建議') : h('span', { class: 'tag done' }, '✅ 沒有發現問題')) : h('span', { class: 'tag', style: 'background:var(--badbg);color:var(--bad)' }, '❌ ' + errs.length + ' 項要修正');
    const dev = parsed.devices.map((d) => d.name).filter(Boolean);
    const parts = [];
    parts.push(h('div', { class: 'panel' }, h('h2', { style: 'margin-top:0' }, '📄 ' + parsed.name, ' ', badge),
      h('div', { class: 'sub' }, '類型：' + (kind === 'teleop' ? '遙控程式' : '自動程式') + '　·　積木數：' + parsed.stats.count + '　·　VEXcode ' + (parsed.meta.app || '?') + (parsed.meta.gen ? '（' + parsed.meta.gen + ' 代 Brain）' : '')),
      h('div', { class: 'sub' }, '裝置：' + (dev.join('、') || '（存檔裡沒有裝置資料）'))));
    // 與上次比較
    if (prev) {
      const nowIds = A.findings.filter((f) => f.level !== 'tip').map((f) => f.id);
      const fixed = prev.ids.filter((id) => !nowIds.includes(id)), still = nowIds.filter((id) => prev.ids.includes(id)), fresh = nowIds.filter((id) => !prev.ids.includes(id));
      parts.push(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, '🔁 和上次上傳比較'),
        h('div', { class: 'sub' }, '上次：' + prev.name + '，' + prev.ids.length + ' 項待改進'),
        fixed.length ? h('div', { class: 'callout' }, '✅ 已經修好 ' + fixed.length + ' 項：' + fixed.map((id) => prev.titles[id] || id).join('；')) : null,
        still.length ? h('div', { class: 'callout warn' }, '還沒改好 ' + still.length + ' 項。') : null,
        fresh.length ? h('div', { class: 'callout warn' }, '這次新出現 ' + fresh.length + ' 項。') : null,
        !prev.ids.length && !nowIds.length ? h('div', { class: 'sub' }, '兩次都沒有問題。') : null));
    }
    // 程式預覽 / 控制對照表
    if (kind === 'auto') {
      parts.push(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, '🧩 你的程式（已轉成模擬器的積木）'), A.model.main.length ? S.staticList(A.model.main, 'en') : h('div', { class: 'sub' }, '（沒有可以顯示的積木）')));
      if (A.result) parts.push(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, '🗺️ 模擬結果'), pathCanvas(A), h('div', { class: A.j && A.j.ok ? 'callout' : 'callout warn' }, A.j.free || !ch ? '沒有指定挑戰，只顯示機器人走過的路線。' : A.j.ok ? '✅ 模擬成功' : '❌ 這次還沒成功', h('div', { class: 'sub' }, '模擬時間 ' + A.j.secs + ' 秒，走了約 ' + A.j.dist + ' mm。'), A.j.msgs.map((m) => h('div', null, m))), ch ? h('a', { class: 'btn sm', href: '#/sim/' + ch.id }, '到模擬器自己改改看') : null));
    } else {
      parts.push(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, '🎮 控制對照表（程式實際寫的）'), A.table.length ? h('table', { class: 'tbl' }, h('tr', null, h('th', null, '什麼時候'), h('th', null, '機器人做什麼')), ...A.table.map((r) => h('tr', null, h('td', null, r.trigger), h('td', null, r.actions.join('；') || '（沒有動作）')))) : h('div', { class: 'sub' }, '（沒有找到遙控器按鈕的對應）'),
        h('div', { class: 'sub' }, '馬達：' + (A.facts.motors || []).join('、') + '　·　共 ' + (A.facts.scripts || 0) + ' 組程式')));
    }
    // 檢查與訂正教學
    const order = ['error', 'warn', 'tip'];
    const sorted = A.findings.slice().sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
    const first = sorted.find((f) => f.level === 'error') || sorted.find((f) => f.level === 'warn');
    if (first) parts.push(h('div', { class: 'panel', style: 'border:2px solid var(--accent)' }, h('h3', { style: 'margin-top:0' }, '🎯 先處理這一項（一次改一個就好）'), findingCard(first, true)));
    parts.push(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, '📋 所有檢查結果'), sorted.map((f) => findingCard(f, false)),
      h('p', { class: 'sub' }, '改完之後，在 VEXcode 重新存檔，再回來上傳一次，我會告訴你修好了幾項。')));
    // 筆記
    parts.push(h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, '📓 寫成工程筆記'), h('p', { class: 'sub' }, '網站會幫你把「這次做了什麼、檢查發現什麼、怎麼改」整理成筆記草稿，還有一張可以拿去真機測試的表格。你要再補上自己的想法。'),
      h('button', { class: 'btn primary', onclick: () => makeNotes() }, '存成工程筆記（含 VEXcode 存檔）'), ' ', h('button', { class: 'btn', onclick: () => makeNotes(true) }, '只存筆記，不附存檔')));
    out.replaceChildren(...parts);
  }

  function findingCard(f, open) {
    const [ic, lv] = LEVEL[f.level];
    let shown = 0; const hintBox = h('div');
    const hintBtn = f.hints.length ? h('button', { class: 'btn sm', onclick: () => { shown = Math.min(f.hints.length, shown + 1); hintBox.replaceChildren(...f.hints.slice(0, shown).map((t) => h('div', { class: 'callout' }, t))); hintBtn.textContent = shown < f.hints.length ? '再給我一個提示（' + shown + '/' + f.hints.length + '）' : '提示都看完了'; } }, '給我提示（0/' + f.hints.length + '）') : null;
    return h('details', { class: 'lessonbox', open: open || f.level === 'error' }, h('summary', null, ic + ' ' + f.title + '　', h('small', null, lv)),
      h('div', { class: 'body' }, f.why ? h('p', null, h('b', null, '為什麼：'), f.why) : null,
        f.fix.length ? h('div', null, h('b', null, '怎麼改：'), h('ol', null, f.fix.map((x) => h('li', null, x)))) : null, hintBtn, hintBox));
  }

  function pathCanvas(A) {
    const world = A.world, W = world.cols * CELL, H = world.rows * CELL;
    const px = Math.min(520, window.innerWidth - 60), cv = h('canvas', { class: 'simcanvas', width: px, height: Math.round((px * H) / W) }), k = px / W, c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.strokeStyle = '#dde4ee';
    for (let x = 0; x <= W; x += CELL) { c.beginPath(); c.moveTo(x * k, 0); c.lineTo(x * k, H * k); c.stroke(); }
    for (let y = 0; y <= H; y += CELL) { c.beginPath(); c.moveTo(0, y * k); c.lineTo(W * k, y * k); c.stroke(); }
    const CHX = { red: '#ff9b9b', green: '#8fe0a3', blue: '#9bbcff', yellow: '#ffe680' };
    (world.colors || []).forEach((z) => { c.fillStyle = CHX[z.color] || '#ccc'; c.fillRect(z.x * k, z.y * k, CELL * k, CELL * k); });
    c.fillStyle = '#8a94a6'; world.walls.forEach(([x, y, w, hh]) => c.fillRect(x * k, y * k, w * k, hh * k));
    if (world.goal) { c.font = Math.round(CELL * k * 0.55) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🚩', world.goal.x * k, world.goal.y * k); }
    if (A.ref && A.j && !A.j.ok && A.world.ch) { c.strokeStyle = 'rgba(31,157,85,.55)'; c.lineWidth = 3; c.setLineDash([8, 6]); c.beginPath(); A.world.ch.path.forEach(([cc, rr], i) => { const X = cc * CELL * k, Y = rr * CELL * k; if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }); c.stroke(); c.setLineDash([]); }
    const fr = A.result.frames; c.strokeStyle = '#0875e2'; c.lineWidth = 2.5; c.beginPath(); fr.forEach((f, i) => { if (i % 2) return; if (!i) c.moveTo(f[0] * k, f[1] * k); else c.lineTo(f[0] * k, f[1] * k); }); c.stroke();
    const f = fr[fr.length - 1]; c.save(); c.translate(f[0] * k, f[1] * k); c.rotate((f[2] * Math.PI) / 180); c.fillStyle = '#77b2ff'; c.strokeStyle = '#3a63a0'; c.lineWidth = 2; c.beginPath(); c.roundRect(-90 * k, -78 * k, 180 * k, 156 * k, 8 * k); c.fill(); c.stroke(); c.fillStyle = '#f1ae34'; c.beginPath(); c.moveTo(90 * k, 0); c.lineTo(50 * k, -28 * k); c.lineTo(50 * k, 28 * k); c.closePath(); c.fill(); c.restore();
    return h('div', null, cv, h('div', { class: 'sub' }, '藍線＝你的機器人走的路；綠色虛線＝目標路線（沒成功時才顯示）。'));
  }

  /* ================= 八、存成工程筆記 ================= */
  async function makeNotes(noFile) {
    if (!cur) return;
    const { parsed, ch, kind, analysis: A } = cur; const date = VX.todayStr(), author = VX.user.display || '';
    const open = A.findings.filter((f) => f.level !== 'tip');
    const improve = open.length ? open.map((f, i) => (i + 1) + '. ' + f.title).join('\n') : '（這次檢查沒有發現需要改的地方）';
    let blocks, result, what, trials = [];
    if (kind === 'auto') {
      blocks = S.programText(A.model.main, [], 'en');
      result = (ch ? '挑戰：' + ch.title + '。' : '') + '模擬器：' + (A.j ? (A.j.ok ? '成功' : '未成功') + '，用 ' + A.j.secs + ' 秒、走約 ' + A.j.dist + ' mm。' + A.j.msgs.join(' ') : '沒有可模擬的程式');
      what = ch ? ch.goal_t : '自動程式練習（' + parsed.name + '）';
      const last = A.result && A.result.frames[A.result.frames.length - 1];
      const target = ch && last ? '目標：旗子位置' : '';
      trials = [{ a: '模擬器（同一個程式）', b: target, c: A.j && A.world.goal ? String(Math.round(Math.hypot(last[0] - A.world.goal.x, last[1] - A.world.goal.y))) + '（離旗子 mm）' : '', d: '模擬' }, { a: '真機第 1 次', b: target, c: '', d: '' }, { a: '真機第 2 次', b: target, c: '', d: '' }, { a: '真機第 3 次', b: target, c: '', d: '' }];
    } else {
      blocks = A.table.map((r) => 'When ' + r.trigger + ':\n  ' + (r.actions.join('\n  ') || '(no actions)')).join('\n');
      result = '遙控程式結構檢查：' + (A.findings.some((f) => f.level === 'error') ? '有 ' + A.findings.filter((f) => f.level === 'error').length + ' 項要修正。' : '沒有發現明顯問題。');
      what = '遙控程式（' + parsed.name + '）：馬達 ' + ((A.facts.motors || []).join('、') || '—');
      trials = A.table.filter((r) => /button/.test(r.trigger)).slice(0, 12).map((r) => ({ a: '按 ' + r.trigger.replace(/^when /, ''), b: '預期：' + (r.actions.join('；') || '').slice(0, 60), c: '', d: '' }));
      if (!trials.length) trials = [{ a: '', b: '', c: '', d: '' }, { a: '', b: '', c: '', d: '' }];
    }
    const prog = { f: { what, blocks, result, improve, date, author }, c: [] };
    if (!noFile) prog.iq = parsed.raw;
    const title = '實機練習：' + (ch ? ch.title : parsed.name.replace(/\.iqblocks$/i, ''));
    try {
      const r1 = await api('/api/notes', { kind: 'program', title: '程式說明：' + title.replace('實機練習：', ''), data: prog });
      await api('/api/notes', { kind: 'test', title: '測試紀錄：' + title.replace('實機練習：', ''), data: { f: { goal: kind === 'auto' ? '比較「模擬器」和「真的機器人」的差距，並記錄數字。' : '把每個按鈕都按一次，確認機器人照控制對照表動。', conclusion: '', date, author }, c: [], trials } });
      if (VX.act) VX.act('note'); VX.saveState();
      toast('已存成 2 則筆記 ✔'); location.hash = '#/notebook/edit/' + r1.id;
    } catch (e) { toast(e.message); }
  }

  VX.routes['import'] = () => viewImport();
  VX.iq = { parseIq, analyzeAuto, analyzeTeleop, detectKind, convertAuto };
})();
