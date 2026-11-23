#!/usr/bin/env node
/* 自動測試（不需要安裝任何套件）：node tests/run.js
   涵蓋：題庫結構、當季計分題算術、挑戰參考解答、模擬引擎、程式碼轉換、.iqblocks 匯入。 */
const assert = require('assert');
const { load } = require('./harness');
const { VX, VXEN, data, content } = load();
const S = VX.sim, IQ = VX.iq;
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message.split('\n')[0]); } };
const group = (n) => console.log('\n' + n);
const run = (code, ch) => { const w = S.makeWorld(ch || null); const r = S.simulate(S.parseDsl(code), w); return { r, j: S.judge(r) }; };

group('題庫結構');
const { QS, SKILLS } = data;
t('題數 138、技能 26', () => { assert.strictEqual(QS.length, 138); assert.strictEqual(SKILLS.length, 26); });
t('題號不重複、技能都存在', () => {
  const ids = new Set(), sk = new Set(SKILLS.map((s) => s.id));
  for (const q of QS) { assert(!ids.has(q.id), '重複 ' + q.id); ids.add(q.id); assert(sk.has(q.s), q.id + ' 技能不存在'); }
});
t('每題有題目與解釋', () => QS.forEach((q) => assert(q.q && q.why, q.id)));
t('選擇題：答案索引有效、選項不重複、tags 長度一致', () => {
  QS.filter((q) => q.t === 'mc').forEach((q) => {
    assert(q.a >= 0 && q.a < q.opts.length, q.id + ' 答案超界');
    assert.strictEqual(new Set(q.opts).size, q.opts.length, q.id + ' 選項重複');
    if (q.tags) assert.strictEqual(q.tags.length, q.opts.length, q.id + ' tags 長度');
  });
});
t('每個技能至少 3 題', () => SKILLS.forEach((s) => assert(QS.filter((q) => q.s === s.id).length >= 3, s.id)));

group('當季計分（Level Up）');
const num = (id) => String(QS.find((q) => q.id === id).a);
t('F1-2 = 3×3+2×1 = 11', () => assert.strictEqual(num('F1-2'), '11'));
t('F1-4 = 16+12+2×6 = 40', () => assert.strictEqual(num('F1-4'), '40'));
t('F1-5 = 2×12+4×1 = 28', () => assert.strictEqual(num('F1-5'), '28'));
t('F2-1 = 60÷12 = 5；F2-5 = 60÷15 = 4', () => { assert.strictEqual(num('F2-1'), '5'); assert.strictEqual(num('F2-5'), '4'); });
t('F2-3 = (60÷20)×12 = 36', () => assert.strictEqual(num('F2-3'), '36'));
t('計分表：Floor 1、L1 3、L2 6、L3 12、L4 16', () => {
  const p = Object.fromEntries(content.SEASON.scoring.map((s) => [s.k, s.p]));
  assert.deepStrictEqual(p, { floor: 1, l1: 3, l2: 6, l3: 12, l4: 16 });
});

group('挑戰：參考解答要能通過，空程式不能通過');
content.CHALLENGES.forEach((ch) => {
  t(ch.id + ' ' + ch.title + '：參考解答通過', () => { const { j } = run(ch.code, ch); assert(j.ok, (j.msgs || []).join(' / ')); });
  t(ch.id + '：空程式不算通過', () => { const { j } = run(['何時開始'], ch); assert(!j.ok); });
});

group('模擬引擎');
t('向前 1000 mm ＝ 走 1000、約 5 秒', () => { const { j } = run(['何時開始', '驅動 [向前] 為 (1000) [毫米]']); assert.strictEqual(j.dist, 1000); assert.strictEqual(j.secs, '5.0'); });
t('等待 2 秒會讓時間增加', () => { const a = run(['何時開始', '等待 (2) 秒']).j; assert(parseFloat(a.secs) >= 2); });
t('永遠迴圈不會卡死，會在上限停下', () => { const { j } = run(['何時開始', '永遠', '  等待 (1) 秒']); assert(j.msgs.join('').includes('120')); });
t('重複 4 次：走 4 趟', () => { const { j } = run(['何時開始', '重複 (4)', '  驅動 [向前] 為 (100) [毫米]']); assert.strictEqual(j.dist, 400); });
t('同樣程式、同樣場地，結果每次一樣（決定性）', () => {
  const ch = content.CHALLENGES[1]; const a = run(ch.code, ch).j, b = run(ch.code, ch).j;
  assert.deepStrictEqual([a.secs, a.dist, a.ok], [b.secs, b.dist, b.ok]);
});

group('題目積木英文化');
const en = VXEN.toEn;
t('驅動／旋轉', () => { assert.strictEqual(en('驅動 [向前] 為 (200) [毫米]'), 'drive [forward] for (200) [mm]'); assert.strictEqual(en('旋轉 [正確的] 度 (90) 度'), 'turn [right] for (90) [degrees]'); assert.strictEqual(en('旋轉 [左邊] 度 (90) 度'), 'turn [left] for (90) [degrees]'); });
t('控制與變數', () => { assert.strictEqual(en('重複 (4)'), 'repeat (4)'); assert.strictEqual(en('等待 (2) 秒'), 'wait (2) seconds'); assert.strictEqual(en('將 [score] 設定為 (0)'), 'set [score] to (0)'); assert.strictEqual(en('將 [score] 改為 (5)'), 'change [score] by (5)'); assert.strictEqual(en('何時開始'), 'when started'); });
t('條件', () => { assert.strictEqual(en('如果 <距離 < 100 毫米> 則'), 'if <Distance < 100 mm> then'); assert.strictEqual(en('而 <距離 > 150 毫米>'), 'while <Distance > 150 mm>'); assert.strictEqual(en('重複直到 <碰撞開關被按下>'), 'repeat until <Bumper pressed?>'); });
t('題庫與挑戰裡所有積木行都轉成英文（不剩中文）', () => {
  const lines = [];
  QS.forEach((q) => { if (Array.isArray(q.code)) lines.push(...q.code); });
  content.CHALLENGES.forEach((c) => lines.push(...c.code));
  const left = lines.filter((l) => /[\u4e00-\u9fff]/.test(en(l)));
  assert.strictEqual(left.length, 0, '還有中文：' + [...new Set(left)].slice(0, 5).join(' | '));
});

t('題目文字、選項、排序項目裡的積木也轉英文', () => {
  const copy = JSON.parse(JSON.stringify(QS)); VXEN.localize(copy);
  const all = []; copy.forEach((q) => { all.push(q.q, q.why, ...(q.opts || []), ...(q.items || [])); });
  const left = all.filter((x) => typeof x === 'string' && (/「(驅動|旋轉|等待|重複|將驅動速度)[^」：]*」/.test(x) || /^(驅動|旋轉) ?\[/.test(x.trim())));
  assert.strictEqual(left.length, 0, '還有中文積木：' + left.slice(0, 3).join(' | '));
  assert.strictEqual(copy.find((q) => q.id === 'C1-2').items[0], 'drive [forward] for (300) [mm]');
});

t('課文與挑戰提示裡的 <code>／「」積木也轉英文，且不動 code 陣列', () => {
  const sk = JSON.parse(JSON.stringify(SKILLS)), ch = JSON.parse(JSON.stringify(content.CHALLENGES));
  VXEN.localizeDeep(sk); VXEN.localizeDeep(ch);
  const txt = JSON.stringify([sk, ch.map((c) => Object.assign({}, c, { code: null, path: null }))]);
  const left = txt.match(/<code>[^<]*(驅動|旋轉|等待|重複|將驅動速度)[^<]*<\/code>|「(驅動|旋轉|重複)[^」：]*」/g) || [];
  assert.strictEqual(left.length, 0, '還有：' + left.slice(0, 3).join(' | '));
  assert.strictEqual(JSON.stringify(ch.map((c) => c.code)), JSON.stringify(content.CHALLENGES.map((c) => c.code)));
});


group('模擬引擎：我的積木與變數');
const CH = (id) => content.CHALLENGES.find((c) => c.id === id);
t('我的積木：square(100) 走 4 邊共 400 mm', () => { const { j } = run(['定義 sq (size)', '  重複 (4)', '    驅動 [向前] 為 (size) [毫米]', '    旋轉 [正確的] 度 (90) 度', '何時開始', 'sq (100)'], CH('ch4')); assert.strictEqual(j.dist, 400); });
t('變數：d 從 100 每次加 50，重複 3 次 → 100+150+200 = 450', () => {
  const prog = { main: [{ t: 'setvar', name: 'd', v: '100' }, { t: 'repeat', v: '3', kids: [{ t: 'drive', dir: '向前', v: 'd' }, { t: 'chvar', name: 'd', v: '50' }] }], defs: [] };
  const w = S.makeWorld(CH('ch1')); const j = S.judge(S.simulate(prog, w)); assert.strictEqual(j.dist, 450);
});
t('撞牆會被偵測（往牆的方向走）', () => {
  const ch = content.CHALLENGES.find((c) => c.id === 'ch12'); const { j } = run(['何時開始', '驅動 [向前] 為 (1000) [毫米]'], ch);
  assert(!j.ok); assert(j.msgs.join('').includes('撞到'), j.msgs.join('/'));
});


group('程式碼轉換');
t('Python 與 C++ 都有 drive 動作', () => {
  const p = S.parseDsl(['何時開始', '驅動 [向前] 為 (200) [毫米]']);
  assert(/drivetrain\.drive_for/.test(S.toPython(p.main, p.defs)), 'python');
  assert(/Drivetrain\.driveFor/.test(S.toCpp(p.main, p.defs)), 'cpp');
});
t('未經 normDirs 的中文方向也能正確轉成 Python／C++', () => {
  const p = S.parseDsl(['何時開始', '驅動 [反向] 為 (100) [毫米]', '旋轉 [左邊] 度 (90) 度']);
  const py = S.toPython(p.main, p.defs), cpp = S.toCpp(p.main, p.defs);
  assert(/REVERSE/.test(py) && /LEFT/.test(py), py);
  assert(/reverse/.test(cpp) && /left/.test(cpp), cpp);
});
t('迴圈內連續播放聲音會有數量上限，不會造成聲音風暴', () => {
  const prog = { main: [{ t: 'repeat', v: '200', kids: [{ t: 'sound', snd: 'siren' }] }], defs: [] };
  const r = S.simulate(prog, S.makeWorld(null));
  assert(r.C.sounds.length <= 40, 'sounds=' + r.C.sounds.length);
});

group('.iqblocks 匯入（用自己手寫的小範例）');
const iq = (xml, extra) => JSON.stringify(Object.assign({ mode: 'Blocks', workspace: xml, robotConfig: [] }, extra || {}));
const AUTO = '<xml><block type="iq_events_when_started"><next><block type="iq_drivetrain_drive_for"><field name="DIRECTION">fwd</field><field name="UNITS">mm</field><value name="AMOUNT"><shadow type="math_number"><field name="NUM">1000</field></shadow></value></block></next></block></xml>';
t('讀得懂並判成自動程式', () => { const p = IQ.parseIq(iq(AUTO), 't.iqblocks'); assert.strictEqual(IQ.detectKind(p), 'auto'); assert.strictEqual(p.scripts.length, 1); });
t('自動程式能轉成模擬器程式並跑完', () => {
  const p = IQ.parseIq(iq(AUTO), 't.iqblocks'); const a = IQ.analyzeAuto(p, content.CHALLENGES[0]);
  assert.strictEqual(a.kind, 'auto'); assert(a.result || a.model.main.length === 1);
  assert.strictEqual(a.model.main[0].t, 'drive'); assert.strictEqual(String(a.model.main[0].v), '1000');
});
t('沒接「when started」會被抓到', () => {
  const x = '<xml><block type="iq_drivetrain_drive_for"><field name="DIRECTION">fwd</field><value name="AMOUNT"><shadow type="math_number"><field name="NUM">100</field></shadow></value></block></xml>';
  const a = IQ.analyzeAuto(IQ.parseIq(iq(x), 't'), null); assert(a.findings.some((f) => f.id === 'no-start'));
});
t('不是 JSON → 友善錯誤', () => assert.throws(() => IQ.parseIq('abc', 'x'), /不是 VEXcode/));
t('缺 workspace → 友善錯誤', () => assert.throws(() => IQ.parseIq('{"mode":"Blocks"}', 'x'), /找不到積木/));
t('Python 專案 → 說明目前只能檢查積木', () => assert.throws(() => IQ.parseIq(JSON.stringify({ mode: 'Python', workspace: '<xml/>' }), 'x'), /目前只能檢查積木/));

group('.iqblocks 匯入：遙控程式');
const motor = (type, name, dir) => `<block type="${type}"><field name="MOTOR">${name}</field><field name="DIRECTION">${dir || 'fwd'}</field></block>`;
const pressed = (b) => `<block type="iq_sensing_pressing_controller"><field name="BUTTON">${b}</field></block>`;
const cfg = (...names) => names.map((n) => ({ name: n, type: 'Motor' }));
const TELE_OK = `<xml><block type="iq_events_when_started"><next><block type="iq_control_forever"><statement name="SUBSTACK"><block type="iq_control_if_then_else"><value name="CONDITION">${pressed('ButtonRUp')}</value><statement name="SUBSTACK">${motor('iq_motion_spin', 'Arm')}</statement><statement name="SUBSTACK2">${motor('iq_motion_stop_motor', 'Arm')}</statement></block></statement></block></next></block></xml>`;
const TELE_BAD = `<xml><block type="iq_events_when_started"><next><block type="iq_control_if_then"><value name="CONDITION">${pressed('ButtonRUp')}</value><statement name="SUBSTACK">${motor('iq_motion_spin', 'Arm')}</statement></block></next></block></xml>`;
const TELE_DEV = TELE_OK.replace(/Arm/g, 'Claw');
const tele = (xml, devs) => IQ.analyzeTeleop(IQ.parseIq(iq(xml, { robotConfig: cfg(...devs) }), 't'));
const ids = (a) => a.findings.map((f) => f.id);
t('判成遙控程式', () => assert.strictEqual(IQ.detectKind(IQ.parseIq(iq(TELE_OK, { robotConfig: cfg('Arm') }), 't')), 'teleop'));
t('寫得好的遙控程式：沒有「一定要改」的問題，且有對照表', () => { const a = tele(TELE_OK, ['Arm']); assert(!a.findings.some((f) => f.level === 'error'), ids(a).join(',')); assert(a.table.length >= 1); });
t('只檢查一次按鈕、沒有 stop：抓到兩個錯誤', () => { const a = tele(TELE_BAD, ['Arm']); assert(ids(a).includes('t-noloop'), ids(a).join(',')); assert(ids(a).includes('t-nostop'), ids(a).join(',')); });
t('用到沒設定的裝置：抓到', () => assert(ids(tele(TELE_DEV, ['Arm'])).includes('t-baddev')));
t('空的工作區：抓到', () => assert(ids(IQ.analyzeTeleop(IQ.parseIq(iq('<xml></xml>'), 't'))).includes('t-empty')));
t('缺 MOTOR 欄位的積木不會把 null 當成馬達名稱', () => {
  const x = '<xml><block type="iq_events_when_started"><next><block type="iq_motion_spin"></block></next></block></xml>';
  const a = IQ.analyzeTeleop(IQ.parseIq(iq(x), 't'));
  assert(!a.facts.motors.includes('null') && !a.facts.motors.includes(null));
});

group('教練介入與類似題推薦');
t('空程式失敗診斷：提醒從左邊拉 drive 積木', () => {
  const ch = content.CHALLENGES[0];
  const { r } = run(['何時開始'], ch);
  const tips = S.diagnoseFail(r, ch);
  assert(tips.length >= 1 && tips[0].includes('drive'), tips.join(' | '));
});
t('方向走反失敗診斷：提醒檢查方向', () => {
  const ch = content.CHALLENGES[0]; // 起點在左、旗子在右，改用反向走遠
  const { r } = run(['何時開始', '驅動 [反向] 為 (300) [毫米]'], ch);
  const tips = S.diagnoseFail(r, ch);
  assert(tips.some((x) => x.includes('方向')), tips.join(' | '));
});
t('撞牆失敗診斷：提醒縮短距離或提早轉彎', () => {
  const ch = content.CHALLENGES[2]; // ch3 有障礙牆
  const { r } = run(['何時開始', '驅動 [向前] 為 (800) [毫米]'], ch);
  const tips = S.diagnoseFail(r, ch);
  assert(tips.some((x) => x.includes('障礙') || x.includes('撞')), tips.join(' | '));
});
t('模擬通過時不產生失敗診斷', () => {
  const ch = content.CHALLENGES[0];
  const { r } = run(ch.code, ch);
  assert.strictEqual(S.diagnoseFail(r, ch).length, 0);
});
t('過關後推薦類似挑戰：不會推同一關，且優先同技能未完成', () => {
  const ch1 = content.CHALLENGES[0]; // skills: ['C1', 'B2']
  const nxt = S.pickNextChallenge(ch1, { ch1: { sim: true } });
  assert(nxt && nxt.id !== ch1.id, '應推薦其他關卡');
  assert((nxt.skills || []).some((s) => ch1.skills.includes(s)), '應優先同技能關卡：' + nxt.id);
});
t('所有挑戰都有對應有效技能（過關小考不落空）', () => {
  const skIds = new Set(SKILLS.map((s) => s.id));
  content.CHALLENGES.forEach((c) => {
    assert(Array.isArray(c.skills) && c.skills.length >= 1, c.id + ' 缺 skills');
    c.skills.forEach((s) => assert(skIds.has(s), c.id + ' 無效技能 ' + s));
  });
});

group('除錯偵探、積木追蹤與三星評分');
content.CHALLENGES.filter((c) => c.starter).forEach((ch) => {
  t(ch.id + ' ' + ch.title + '：初始 bug 程式不通過，修正後通過', () => {
    const bad = run(ch.starter, ch);
    assert(!bad.j.ok, ch.id + ' 的 starter 應該要失敗');
    const good = run(ch.code, ch);
    assert(good.j.ok, ch.id + ' 的參考解答應該要通過');
  });
});
t('模擬執行會記錄當下執行中的積木編號（frames[i][3]）', () => {
  const ch = content.CHALLENGES[0];
  const parsed = S.parseDsl(ch.code);
  S.tagBids(parsed.main, parsed.defs);
  const res = S.simulate(parsed, S.makeWorld(ch));
  const bids = new Set(res.frames.map((f) => f[3]).filter(Boolean));
  assert(bids.has('b1'), '應追蹤到 b1 積木，實際：' + [...bids].join(','));
});
t('三星評分：精簡獨立過關 3 星、載入解答 1 星、過長寫法 1 星、未過關 0 星', () => {
  const ch = content.CHALLENGES[0]; // drive 1000
  const ref = S.parseDsl(ch.code);
  const resOk = S.simulate(ref, S.makeWorld(ch)); resOk.j = S.judge(resOk);
  assert.strictEqual(S.calcStars(ch, ref.main, ref.defs, resOk, false), 3);
  assert.strictEqual(S.calcStars(ch, ref.main, ref.defs, resOk, true), 1);
  const longLines = ['何時開始', ...Array(10).fill('驅動 [向前] 為 (100) [毫米]')];
  const longP = S.parseDsl(longLines);
  const resLong = S.simulate(longP, S.makeWorld(ch)); resLong.j = S.judge(resLong);
  assert(resLong.j.ok);
  assert.strictEqual(S.calcStars(ch, longP.main, longP.defs, resLong, false), 1);
  const bad = run(['何時開始'], ch);
  assert.strictEqual(S.calcStars(ch, [], [], bad.r, false), 0);
});
t('judge 回傳 goalDist 供「更靠近旗子」新紀錄比較', () => {
  const ch = content.CHALLENGES[0];
  const a = run(['何時開始', '驅動 [向前] 為 (200) [毫米]'], ch).j;
  const b = run(['何時開始', '驅動 [向前] 為 (600) [毫米]'], ch).j;
  assert(typeof a.goalDist === 'number' && typeof b.goalDist === 'number' && b.goalDist < a.goalDist);
});

t('積木編號 _bid 不會被序列化進存檔', () => {
  const p = S.parseDsl(content.CHALLENGES[0].code);
  S.tagBids(p.main, p.defs);
  assert(p.main[0]._bid, '應有編號');
  assert(!JSON.stringify(p).includes('_bid'), '存檔不該含 _bid');
});
t('dbg3 的 bug 程式：診斷說「有執行但沒動」，不是「還沒放積木」', () => {
  const ch = content.CHALLENGES.find((c) => c.id === 'dbg3');
  const { r } = run(ch.starter, ch);
  const tips = S.diagnoseFail(r, ch);
  assert(tips.length && !tips[0].includes('還沒有讓車子動'), tips.join('|'));
});


group('介面語言（中／English）');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const I18N = path.join(__dirname, '..', 'i18n');
const H = (z) => crypto.createHash('md5').update(z).digest('hex').slice(0, 6);
const enMap = {};
fs.readdirSync(path.join(I18N, 'en')).filter((f) => f.endsWith('.tsv')).forEach((f) => {
  fs.readFileSync(path.join(I18N, 'en', f), 'utf8').split('\n').forEach((ln) => { const m = ln.match(/^([0-9a-f]{6})[|\t](.*)$/); if (m && m[2].trim()) enMap[m[1]] = m[2]; });
});
const srcOf = (a) => JSON.parse(fs.readFileSync(path.join(I18N, 'src', a + '.json'), 'utf8'));
const missing = (a) => srcOf(a).filter((z) => !enMap[H(z)]);
t('擷取清單內的字串雜湊不衝突', () => {
  const seen = {};
  fs.readdirSync(path.join(I18N, 'src')).forEach((f) => srcOf(f.replace('.json', '')).forEach((z) => { const h = H(z); assert(!seen[h] || seen[h] === z, '雜湊衝突 ' + h); seen[h] = z; }));
});
[['data-QS', 0], ['data-SKILLS', 0], ['data-DOMAINS', 0], ['data-TAGS', 0], ['content-CHALLENGES', 0], ['content-NB_LESSONS', 0], ['content-NB_KINDS', 0], ['content-BUILD', 0], ['content-PARTS', 0],
  ['content-INTERVIEW', 0], ['content-SEASON', 0], ['server', 0], ['page', 0], ['ui-app', 12], ['ui-modules', 2], ['ui-guide', 0], ['ui-extras', 0], ['ui-about', 0], ['ui-a11y', 0], ['ui-iqimport', 5], ['ui-sim', 70]].forEach(([a, allow]) => {
  t('英文翻譯齊全：' + a + (allow ? '（容許 ' + allow + ' 句中文積木字樣不翻）' : ''), () => { const m = missing(a); assert(m.length <= allow, '還有 ' + m.length + ' 句沒翻：' + m.slice(0, 3).join(' | ')); });
});
t('翻譯過的課文 HTML 標籤跟原文一致（不會把頁面弄壞）', () => {
  const tags = (x) => (x.match(/<\/?(?:b|i|em|strong|code|br|p|ul|ol|li|table|tr|td|th|div|small|span|a|svg|text)\b[^>]*>/g) || []).map((s) => s.replace(/\s.*>/, '>')).sort().join(',');
  let n = 0;
  fs.readdirSync(path.join(I18N, 'src')).forEach((f) => srcOf(f.replace('.json', '')).forEach((z) => { if (/<[a-zA-Z]/.test(z) && enMap[H(z)]) { n++; assert.strictEqual(tags(enMap[H(z)]), tags(z), '標籤不同：' + H(z) + ' ' + z.slice(0, 30)); } }));
  assert(n > 30, 'HTML 翻譯數量異常：' + n);
});
t('web/i18n-en.js 是最新的（改了翻譯要跑 python3 tools/i18n_build.py）', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'web', 'i18n-en.js'), 'utf8');
  const dict = JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1));
  const want = new Set(Object.keys(enMap)); let have = 0;
  fs.readdirSync(path.join(I18N, 'src')).forEach((f) => srcOf(f.replace('.json', '')).forEach((z) => { if (want.has(H(z))) { have++; assert(dict[z] !== undefined, '字典缺：' + z.slice(0, 30)); } }));
  assert(have > 2000, '字典條目太少：' + have);
});

t('逐段翻譯：中文句子拼著數字也能翻對，不會翻成一半中一半英', () => {
  const vm = require('vm');
  const js = fs.readFileSync(path.join(__dirname, '..', 'web', 'i18n-en.js'), 'utf8');
  const dict = JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1));
  const box = { window: {}, document: { documentElement: {}, addEventListener() {}, write() {} }, location: { search: '' }, localStorage: { getItem: () => 'en', setItem() {} }, navigator: { language: 'en' }, URLSearchParams };
  box.window = box; vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'web', 'i18n.js'), 'utf8'), box);
  const { tr } = box.VXI18N.makeTr(dict);
  const ZH = /[一-鿿]/;
  const cases = ['熟練度 2 顆星（滿分 3 顆）', '預估得分：5 分　用掉時間：48 / 60 秒', '這回合答對 3 題', '已精通 4 / 26 個技能　·　連續練習 3 天', '模擬時間 5.2 秒　·　走了約 1000 mm'];
  cases.forEach((c) => { const r = tr(c); assert(!ZH.test(r), c + ' → ' + r); });
  assert.strictEqual(tr('熟練度 2 顆星（滿分 3 顆）'), 'Mastery 2 stars (out of 3)');
  assert.strictEqual(tr('測試'), '測試'); // 使用者名字不亂翻
});

console.log(`\n${pass} 通過、${fail} 失敗`);
process.exit(fail ? 1 : 0);
