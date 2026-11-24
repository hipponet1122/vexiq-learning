/* 比賽專區 → 台灣賽事路線：用自己的話整理 VEX Taiwan Open 的賽事流程與準備清單。
   資料來源：VEX Taiwan Open 官網（vto.cacet.org）2024–2025 賽季公開頁面（2026-11-24 讀取）。
   每年日期、地點、報名方式都會變，一律以官網與 RobotEvents 的當季公告為準。 */
(function () {
  'use strict';
  const VX = window.VX;
  const { h } = VX;

  // 路線（以 2024–2025 賽季為例）
  const ROUTE = [
    { ic: '🧪', t: '邀請賽（練習場）', when: '例：2024 年 9～10 月', d: '學校或企業辦的單日比賽，通常是熱身與累積比賽經驗的好機會。是否影響晉級，要看簡章，不要假設。', tip: '第一次比賽先當「看流程」：檢錄、抽籤、排隊、記分、面談怎麼進行。' },
    { ic: '📋', t: '預賽', when: '例：2024 年 10 月下旬（國中組、國小組分開兩天）', d: '依組別（國小組、國中組）分開舉行。官網會公布賽前通知、晉級名單與得獎名單。', tip: '賽前通知要看：集合時間、場地、規定。' },
    { ic: '🏆', t: '冠軍賽', when: '例：2025 年 1 月（國中組、國小組分開）', d: '官網在預賽後會公布晉級名單，名單上的隊伍進冠軍賽（實際辦法以簡章為準）。表現最好的隊伍可以取得世界賽資格。', tip: '技能賽成績與評審獎項（工程筆記、面談）都很重要。' },
    { ic: '🌏', t: '世界賽', when: 'VEX Robotics World Championship', d: '官網說明：冠軍賽中脫穎而出的隊伍，將贏得參與世界賽的資格。名額與規則每年不同。', tip: '這是長期目標。現在先把基本功與工程筆記練扎實。' },
  ];

  const LINKS = [
    ['VEX Taiwan Open 官網（VTO）', 'https://vto.cacet.org/', '賽事日程、賽前通知、得獎名單、歷年賽事。主辦：國立臺北教育大學、中華資訊與科技教育學會（CACET）。'],
    ['VTO 報名資訊', 'https://vto.cacet.org/registration-information', '報名簡章與流程（每年更新）。'],
    ['VTO 相關資源', 'https://vto.cacet.org/related-resources', '官方整理的賽事相關資源。'],
    ['RobotEvents', 'https://www.robotevents.com/', '全球賽事報名與查詢平台：註冊隊伍、找比賽、看賽程與結果。'],
    ['庫樂思機器人 Curious Blog', 'https://curious-edu.com/blog/', '台灣教育機構的部落格，常分享賽季車型與策略心得（第三方內容，請自行判斷）。'],
  ];

  const PREP = [
    ['先問清楚', '這個賽季你們補習班／學校有沒有要報名？哪一場？向教練確認組隊、報名與費用。'],
    ['帳號與隊伍', '隊伍通常要在 RobotEvents 註冊。家長或老師協助處理，個資與付款一律由大人處理。'],
    ['機器人', '符合當季機器人規定（尺寸、馬達數、零件）。比賽前自己用手冊逐條檢查。'],
    ['程式', '自動程式要練到「每次都一樣」。技能賽的自動程式與駕駛都要練。'],
    ['工程筆記', '評審看筆記：問題、點子、決策、測試、改良都要有紀錄與日期。'],
    ['面談', '準備用英文或中文說明機器人與設計過程（看賽事規定的語言）。可用本站「面談練習」。'],
    ['比賽當天', '提早到、帶備用電池與工具、先充飽電、看賽前通知。'],
  ];

  function taiwanPage(nav) {
    VX.paint(h('div', null, nav,
      h('div', { class: 'panel' }, h('h2', null, '🇹🇼 台灣的 VEX IQ 賽事路線'),
        h('p', null, '想參加比賽，大概會怎麼走？下面用 2024–2025 賽季的 VEX Taiwan Open 當例子，說明大致流程。'),
        h('div', { class: 'callout warn' }, '日期、地點、組別與報名方式每年都不同。這裡是「例子」，請以 VTO 官網與 RobotEvents 的當季公告為準（官網目前顯示的是 2024–2025；新賽季公告出來後要再核對）。')),
      h('div', { class: 'panel' }, h('h3', null, '賽事路線（例）'),
        h('div', { class: 'twroute' }, ROUTE.map((r, i) => h('div', { class: 'twstep' },
          h('div', { class: 'twic' }, r.ic),
          h('div', null, h('b', null, (i + 1) + '. ' + r.t), h('div', { class: 'twwhen' }, r.when), h('p', null, r.d), h('p', { class: 'sub' }, '💡 ' + r.tip))))),
        h('p', { class: 'sub' }, '組別：台灣的 VEX IQ 比賽（VIQRC）常分「國小組」與「國中組」。另有 V5 系列（國中、高中），是不同的機器人系列。')),
      h('div', { class: 'panel' }, h('h3', null, '參賽準備清單'),
        h('div', null, PREP.map(([k, v]) => h('div', { class: 'wrongitem' }, h('b', null, k), '：', v)))),
      h('div', { class: 'panel' }, h('h3', null, '你現在可以做的三件事'),
        h('ol', null,
          h('li', null, '到 VTO 官網看這個賽季有沒有公告，記下日期。'),
          h('li', null, '問教練：我們這季會報名嗎？我需要先準備什麼？'),
          h('li', null, '用本站「技能賽練習」記錄分數，用「工程筆記」記下每一次測試。')),
        h('div', { class: 'row gap' }, h('a', { class: 'btn primary', href: '#/compete/skills' }, '技能賽練習'), h('a', { class: 'btn', href: '#/notebook' }, '工程筆記'), h('a', { class: 'btn', href: '#/compete/interview' }, '面談練習'))),
      h('div', { class: 'panel' }, h('h3', null, '官方與在地連結'),
        LINKS.map(([name, url, d]) => h('div', { class: 'wrongitem' }, h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, h('b', null, name + ' ↗')), h('div', { class: 'sub' }, d))))), '🇹🇼 台灣賽事路線', '🇹🇼');
  }
  VX.taiwanPage = taiwanPage;
})();
