/* 積木文字：把題目與課文裡的中文積木轉成 VEXcode 英文字樣（可單獨在 Node 測試）。 */
(function () {
  'use strict';
  /* 題目與課文裡的積木是用中文寫的；顯示時轉成 VEXcode 的英文字樣（跟模擬器一致），滑鼠停留可看中文原文。 */
  const EN_WORD = { '向前': 'forward', '反向': 'reverse', '向後': 'reverse', '左邊': 'left', '左': 'left', '正確的': 'right', '右邊': 'right', '右': 'right', '毫米': 'mm', '度': 'degrees', '秒': 'seconds', '英寸': 'inches' };
  const enWord = (x) => EN_WORD[x] || x;
  function enCond(c) {
    c = c.trim();
    let m;
    if ((m = c.match(/^距離\s*([<>]=?|=)\s*\(?(\d+(?:\.\d+)?)\)?\s*(毫米|英寸)?$/))) return 'Distance ' + m[1] + ' ' + m[2] + ' ' + enWord(m[3] || '毫米');
    if (/^碰撞開關被按下$|^碰撞開關已被按下$/.test(c)) return 'Bumper pressed?';
    if ((m = c.match(/^看到(紅|綠|藍|黃)色$/))) return 'sees ' + ({ 紅: 'red', 綠: 'green', 藍: 'blue', 黃: 'yellow' }[m[1]]) + '?';
    return c;
  }
  function toEn(line) {
    const raw = line.trim();
    if (!/[\u4e00-\u9fff]/.test(raw)) return raw;
    if (/[；;]/.test(raw) && /^(驅動|旋轉|等待|停止駕駛)/.test(raw)) return raw.split(/[；;]/).map((x) => toEn(x)).join('; ');
    let m;
    if (raw === '何時開始') return 'when started';
    if (raw === '停止駕駛') return 'stop driving';
    if (raw === '永遠') return 'forever';
    if (raw === '別的' || raw === '否則') return 'else';
    if ((m = raw.match(/^驅動\s*\[?(向前|反向|向後)\]?\s*(?:為\s*\(?(\d+(?:\.\d+)?|\w+)\)?\s*\[?(毫米|英寸)?\]?)?\s*$/))) return 'drive [' + enWord(m[1]) + ']' + (m[2] ? ' for (' + m[2] + ') [' + enWord(m[3] || '毫米') + ']' : '');
    if ((m = raw.match(/^旋轉\s*\[?(左邊|正確的|右邊|左|右)\]?\s*度\s*\(?(\d+(?:\.\d+)?|\w+)\)?\s*度?$/))) return 'turn [' + enWord(m[1]) + '] for (' + m[2] + ') [degrees]';
    if ((m = raw.match(/^重複直到\s*<(.+)>$/))) return 'repeat until <' + enCond(m[1]) + '>';
    if ((m = raw.match(/^而\s*<(.+)>$/))) return 'while <' + enCond(m[1]) + '>';
    if ((m = raw.match(/^如果\s*<(.+)>\s*則?$/))) return 'if <' + enCond(m[1]) + '> then';
    if ((m = raw.match(/^等到\s*<?(.+?)>?$/))) return 'wait until <' + enCond(m[1]) + '>';
    if ((m = raw.match(/^重複\s*\(?(\d+|\w+)\)?(?:\s*次)?$/))) return 'repeat (' + m[1] + ')';
    if ((m = raw.match(/^等待\s*\(?(\d+(?:\.\d+)?)\)?\s*秒$/))) return 'wait (' + m[1] + ') seconds';
    if ((m = raw.match(/^將\s*\[(\w+)\]\s*設定為\s*\(?([^)\s]+)\)?$/))) return 'set [' + m[1] + '] to (' + m[2] + ')';
    if ((m = raw.match(/^將\s*\[(\w+)\]\s*改為\s*\(?([^)\s]+)\)?$/))) return 'change [' + m[1] + '] by (' + m[2] + ')';
    if ((m = raw.match(/^將(驅動|轉彎)速度設定為\s*\(?(\d+)\)?\s*\[?%?\]?$/))) return 'set ' + (m[1] === '驅動' ? 'drive' : 'turn') + ' velocity to (' + m[2] + ') [%]';
    if ((m = raw.match(/^定義\s+(.+)$/))) return 'define ' + m[1];
    return raw;
  }
  /* 題目文字、選項、排序項目裡引用的積木也改英文（只動長得像積木的片段）。 */
  const BLOCKY = /^(何時開始|驅動|旋轉|等待|停止駕駛|重複|永遠|將|如果|而|別的|等到)/;
  const NAMES = { 驅動: 'drive', 旋轉: 'turn', 等待: 'wait', 重複: 'repeat', 重複直到: 'repeat until', 而: 'while', 永遠: 'forever', 如果: 'if', 將驅動速度設定為: 'set drive velocity to', 將轉彎速度設定為: 'set turn velocity to', 停止駕駛: 'stop driving' };
  const enProse = (s) => (typeof s !== 'string' ? s : s.replace(/「([^」]+)」/g, (m, x) => { if (NAMES[x.trim()]) return '「' + NAMES[x.trim()] + '」'; const e = toEn(x); return BLOCKY.test(x.trim()) && e !== x.trim() ? '「' + e.replace(/[\[\]()]/g, '') + '」' : m; }));
  const enItem = (s) => (typeof s === 'string' && BLOCKY.test(s.trim()) && /[\[(<]|\d/.test(s) ? toEn(s) : enProse(s));
  function localize(qs) {
    qs.forEach((q) => {
      q.q = enProse(q.q); q.why = enProse(q.why);
      if (Array.isArray(q.opts)) q.opts = q.opts.map(enItem);
      if (Array.isArray(q.items)) q.items = q.items.map(enItem);
    });
    return qs;
  }
  window.VXEN = { toEn, enProse, enItem, localize };
})();
