#!/usr/bin/env node
/* 自動測試（不需要安裝任何套件）：node tests/run.js
   涵蓋：題庫結構、當季計分題算術、挑戰參考解答、模擬引擎、程式碼轉換、.iqblocks 匯入。 */
const assert = require('assert');
const { load } = require('./harness');
const { VX, data, content } = load();
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

group('程式碼轉換');
t('Python 與 C++ 都有 drive 動作', () => {
  const p = S.parseDsl(['何時開始', '驅動 [向前] 為 (200) [毫米]']);
  assert(/drivetrain\.drive_for/.test(S.toPython(p.main, p.defs)), 'python');
  assert(/Drivetrain\.driveFor/.test(S.toCpp(p.main, p.defs)), 'cpp');
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

console.log(`\n${pass} 通過、${fail} 失敗`);
process.exit(fail ? 1 : 0);
