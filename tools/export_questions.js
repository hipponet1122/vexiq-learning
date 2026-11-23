#!/usr/bin/env node
/* 匯出題庫給教練／老師審題：一個手機也好讀的網頁（可列印）＋一份 CSV（可用試算表填意見）。
   用法：node tools/export_questions.js            全部領域
        node tools/export_questions.js D F        只匯出領域 D 與 F
   產出：審題清單.html、審題清單.csv（已加入 .gitignore，不進版控） */
const fs = require('fs');
const path = require('path');
const { load, ROOT } = require('../tests/harness');
const { VXEN, data } = load();
const want = process.argv.slice(2).map((x) => x.toUpperCase());
const QS = JSON.parse(JSON.stringify(data.QS)); VXEN.localize(QS);
const SK = Object.fromEntries(data.SKILLS.map((s) => [s.id, s]));
const DM = Object.fromEntries(data.DOMAINS.map((d) => [d.id, d]));
const esc = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TYPE = { mc: '選擇題', num: '數值題', ord: '排序題', bug: '找錯題' };
const L = (i) => String.fromCharCode(65 + i);
const pick = QS.filter((q) => !want.length || want.includes(q.s[0]));

function answerText(q) {
  if (q.t === 'mc') return L(q.a) + '. ' + q.opts[q.a];
  if (q.t === 'num') return q.a + (q.unit ? ' ' + q.unit : '') + (q.tol ? '（容許誤差 ' + q.tol + '）' : '');
  if (q.t === 'ord') return q.items.map((x, i) => (i + 1) + '. ' + x).join('  →  ');
  if (q.t === 'bug') return '第 ' + (q.a + 1) + ' 行：' + VXEN.toEn(q.code[q.a] || '');
  return '';
}
const enCode = (lines) => (lines || []).map((l) => VXEN.toEn(l));

// ---- CSV ----
const csvCell = (x) => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"';
const rows = [['題號', '領域', '技能', '難度', '題型', '題目', '選項／程式', '正確答案', '解釋', '審題意見（對／錯／建議）']];
pick.forEach((q) => rows.push([q.id, DM[q.s[0]].name, SK[q.s].name, q.l, TYPE[q.t], q.q,
  q.t === 'mc' ? q.opts.map((o, i) => L(i) + '. ' + o).join('\n') : q.t === 'bug' ? enCode(q.code).join('\n') : q.t === 'ord' ? '（依序點選）' : '',
  answerText(q), q.why, '']));
fs.writeFileSync(path.join(ROOT, '審題清單.csv'), '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'), 'utf8');

// ---- HTML ----
let html = '', lastSkill = '', lastDom = '';
pick.forEach((q) => {
  const d = q.s[0];
  if (d !== lastDom) { html += `<h2>${esc(DM[d].name)}</h2>`; lastDom = d; }
  if (q.s !== lastSkill) { html += `<h3>${esc(q.s + ' ' + SK[q.s].name)}</h3>`; lastSkill = q.s; }
  let body = '';
  if (q.t === 'mc') body = '<ol type="A">' + q.opts.map((o, i) => `<li class="${i === q.a ? 'ok' : ''}">${esc(o)}${i === q.a ? ' ✔ 正解' : ''}</li>`).join('') + '</ol>';
  else if (q.t === 'bug') body = '<pre>' + enCode(q.code).map((l, i) => `<span class="${i === q.a ? 'bad' : ''}">${esc(l)}${i === q.a ? '   ← 錯在這行' : ''}</span>`).join('\n') + '</pre>';
  else if (q.t === 'ord') body = '<ol>' + q.items.map((x) => `<li>${esc(x)}</li>`).join('') + '</ol><p class="muted">（以上是正確順序）</p>';
  else if (q.t === 'num') body = `<p class="ok">答案：${esc(answerText(q))}</p>`;
  if (q.code && q.t !== 'bug') body = '<pre>' + enCode(q.code).map(esc).join('\n') + '</pre>' + body;
  html += `<section class="q"><div class="meta"><b>${esc(q.id)}</b> · 難度 ${q.l} · ${TYPE[q.t]}</div><p class="qt">${esc(q.q)}</p>${body}<p class="why"><b>解釋：</b>${esc(q.why)}</p><p class="cmt">審題意見：＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿</p></section>`;
});
const title = 'VEX IQ 自學網站｜題庫審題清單';
const doc = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
body{font:16px/1.6 -apple-system,"PingFang TC","Noto Sans TC",sans-serif;max-width:760px;margin:0 auto;padding:16px;color:#1b2430}
h1{font-size:1.3rem}h2{margin-top:2rem;border-bottom:2px solid #0875e2;padding-bottom:4px}h3{margin:1.2rem 0 .4rem;color:#0062b6}
.q{border:1px solid #dde4ee;border-radius:10px;padding:10px 14px;margin:10px 0;break-inside:avoid}.meta{color:#5d6b7e;font-size:.8rem}.qt{font-weight:600;margin:.3rem 0}
pre{background:#f3f6fa;padding:8px 10px;border-radius:8px;overflow:auto;font-size:.85rem}.ok{color:#1f9d55;font-weight:600}.bad{background:#fdeaea;color:#d33a3a;font-weight:600}
.why{color:#344256;font-size:.92rem}.muted{color:#5d6b7e;font-size:.8rem}.cmt{color:#8a97a8;font-size:.85rem;margin:.3rem 0 0}ol{margin:.3rem 0}
@media print{.q{border-color:#999}}</style></head><body>
<h1>${title}</h1><p class="muted">共 ${pick.length} 題${want.length ? '（領域 ' + want.join('、') + '）' : ''}。積木以 VEXcode 英文字樣顯示。請看「正解」和「解釋」對不對、孩子看不看得懂，把意見直接回覆給 Elvis 即可，不需要會 GitHub。規則與計分請對照官方 Game Manual 最新版。</p>
${html}</body></html>`;
fs.writeFileSync(path.join(ROOT, '審題清單.html'), doc, 'utf8');
console.log(`已匯出 ${pick.length} 題 → 審題清單.html、審題清單.csv`);
