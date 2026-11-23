/* 關於本站：版本資訊、作者聯絡、問題回報、更新紀錄、隱私與商標聲明；頁尾版本列 */
(function () {
  const { h } = VX;
  let info = null, loading = null;
  function load() {
    if (info) return Promise.resolve(info);
    if (!loading) loading = fetch('version.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((j) => { info = j || {}; return info; });
    return loading;
  }
  const fmt = (s) => (s ? String(s).replace('T', ' ').slice(0, 16) : '—');

  // 頁尾：版本 · 提交代號 · 更新時間 · 關於
  VX.footer = function () {
    const f = h('footer', { class: 'sitefoot' }, '© 2026 Elvis Huang · ', h('a', { href: '#/about' }, '關於本站'));
    load().then((v) => {
      if (!v.version) return;
      f.replaceChildren('v' + v.version + (v.commit_short ? ' · ' + v.commit_short : '') + ' · 更新 ' + fmt(v.built_at) + ' · ', h('a', { href: '#/about' }, '關於本站'), ' · © 2026 Elvis Huang');
    });
    return f;
  };

  function row(k, v) { return h('tr', null, h('th', null, k), h('td', null, v)); }

  VX.routes.about = function () {
    const box = h('div', null, h('p', { class: 'sub' }, '載入版本資訊…'));
    VX.app.replaceChildren(VX.shell(box, { title: '關於本站', icon: 'ℹ️' }));
    Promise.all([load(), fetch('/healthz', { cache: 'no-store' }).then((r) => r.json()).catch(() => null)]).then(([v, hz]) => {
      const a = v.author || { name: 'Elvis Huang', email: 'elvis@mingchhun.com' };
      const ver = v.version ? 'v' + v.version : '（未知）';
      const commit = v.commit_short
        ? (v.commit_url ? h('a', { href: v.commit_url, target: '_blank', rel: 'noopener' }, h('code', null, v.commit_short)) : h('code', null, v.commit_short))
        : '—';
      const subject = '【VEX IQ 自學】問題回報（' + ver + (v.commit_short ? ' / ' + v.commit_short : '') + '）';
      const body = '請描述發生了什麼事、在哪一頁、你原本預期什麼：\n\n\n----（以下請保留，方便我查問題）----\n版本：' + ver + '\n提交：' + (v.commit_short || '—') + '\n更新：' + (v.built_at || '—') + '\n網址：' + location.href + '\n瀏覽器：' + navigator.userAgent + '\n';
      const mail = 'mailto:' + a.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      const health = hz && hz.ok ? h('span', { class: 'okpill' }, '✅ 伺服器運作正常') : h('span', { class: 'badpill' }, '⚠ 無法連到伺服器');
      const log = (v.changelog || []).map((c) => h('details', { open: c === (v.changelog || [])[0] },
        h('summary', null, h('b', null, 'v' + c.version), '　', c.date),
        c.items.map((it) => h('div', null, h('h4', null, it.h), h('ul', null, it.lines.map((l) => h('li', null, l)))))));
      box.replaceChildren(
        h('div', { class: 'card' }, h('h3', null, '版本資訊'),
          h('table', { class: 'infotbl' }, h('tbody', null,
            row('版本', ver),
            row('GitHub 提交代號', commit),
            row('GitHub 專案', v.repo ? h('a', { href: v.repo, target: '_blank', rel: 'noopener' }, v.repo_name) : '（未公開）'),
            row('分支', v.branch || '—'),
            row('最後更新', (v.built_at || '—') + '（台北時間）'),
            row('程式提交時間', fmt(v.commit_date)),
            row('伺服器狀態', health),
            v.dirty ? row('備註', '此版本含尚未提交的修改') : null))),
        h('div', { class: 'card' }, h('h3', null, '作者與聯絡窗口'),
          h('p', null, h('b', null, a.name), '　', h('a', { href: 'mailto:' + a.email }, a.email)),
          h('p', { class: 'sub' }, '遇到錯誤、題目有疑問、或想要新功能，都可以來信。按下面按鈕會自動帶入版本與瀏覽器資訊，我比較好查。'),
          h('a', { class: 'btn primary', href: mail }, '✉️ 回報問題／提供建議')),
        h('div', { class: 'card' }, h('h3', null, '更新紀錄'), log.length ? log : h('p', { class: 'sub' }, '尚無紀錄')),
        h('div', { class: 'card' }, h('h3', null, '資料與隱私'),
          h('ul', null,
            h('li', null, '資料只存放在本站自己的伺服器，不使用第三方追蹤或廣告。'),
            h('li', null, '會儲存：暱稱、答題紀錄、工程筆記、模擬器程式、（若有上傳）VEXcode 存檔內容。'),
            h('li', null, '角色：學員只看自己的資料；家長可看並管理自己的學員；教練只能唯讀檢視被指派學員的練習狀況。'),
            h('li', null, '本站不開放搜尋引擎收錄；請勿在筆記中寫真實全名、學校或聯絡方式。'),
            h('li', null, '想刪除資料，請聯絡家長或上方窗口。'))),
        h('div', { class: 'card' }, h('h3', null, '聲明'),
          h('p', { class: 'sub' }, 'VEX、VEX IQ、VEXcode、Level Up 為 Innovation First International, Inc.（REC Foundation／VEX Robotics）之商標。本站是個人製作的自學工具，與其無隸屬或背書關係；比賽規則請一律以官方最新版手冊為準。'),
          h('p', { class: 'sub' }, '建議使用最新版 Safari／Chrome／Edge（電腦或 iPad）。手機畫面較小，模擬器建議用 iPad 或電腦。'),
          h('p', { class: 'sub' }, '© 2026 Elvis Huang。程式碼採 MIT 授權，教學與題庫內容採 CC BY-SA 4.0；詳見專案說明檔。')));
    });
  };
})();
