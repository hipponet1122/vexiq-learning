// 第二階段內容：工程筆記、挑戰、組裝、比賽。
// 注意：不放任何當季遊戲的規則細節（會隨賽季改變，以官方 Game Manual 為準）。

/* ================= 工程筆記 ================= */
const NB_LESSONS = [
  { id: 'why', title: '1. 為什麼要寫工程筆記？', html: `
    <p>工程筆記（Engineering Notebook）是你<b>思考過程的紀錄</b>。比賽時評審不只看機器人，更想知道：你<b>遇到什麼問題</b>、<b>想過哪些辦法</b>、<b>為什麼這樣選</b>、<b>測試結果如何</b>、<b>怎麼改進</b>。</p>
    <div class="callout">把它想成「機器人的日記＋科學實驗報告」。機器人的每一個決定，都要找得到理由。</div>
    <p>養成習慣的好處：①自己不會忘記改過什麼；②隊友看得懂；③評審看得出你真的懂；④這就是你日後的<b>作品集</b>。</p>` },
  { id: 'process', title: '2. 工程設計流程（6 步）', html: `
    <ol>
      <li><b>定義問題</b>（Define）：要解決什麼？怎樣算成功？</li>
      <li><b>腦力激盪</b>（Brainstorm）：想出至少 3 種方法，先不要批評。</li>
      <li><b>選擇方案</b>（Select）：用<b>決策矩陣</b>比較，寫下理由。</li>
      <li><b>製作原型</b>（Prototype）：先做出能測試的簡單版本。</li>
      <li><b>測試</b>（Test）：重複測、記錄數據。</li>
      <li><b>改進</b>（Improve／Iterate）：根據數據修改，回到第 4 步。</li>
    </ol>
    <div class="callout">這是一個<b>循環</b>，不是一次就結束。每繞一圈，機器人就更好。</div>` },
  { id: 'good', title: '3. 好筆記的 6 個要素', html: `
    <ol>
      <li><b>日期、姓名</b>：每一頁都要有，誰在什麼時候做的。</li>
      <li><b>目標</b>：這一頁要解決什麼？</li>
      <li><b>圖</b>：草圖、照片、截圖，加上<b>標註</b>（尺寸、零件名稱）。</li>
      <li><b>理由</b>：為什麼這樣決定？（最重要！）</li>
      <li><b>數據／結果</b>：測試了幾次、結果是多少。</li>
      <li><b>下一步</b>：根據結果，接下來要做什麼。</li>
    </ol>` },
  { id: 'matrix', title: '4. 決策矩陣：怎麼比較方案', html: `
    <p>有 3 個爪子設計，怎麼選？把<b>評分標準</b>列出來，給每個標準一個<b>重要程度（權重）</b>，再替每個方案打分。</p>
    <table class="tbl"><tr><th>標準</th><th>權重</th><th>方案 A 雙爪</th><th>方案 B 單爪</th><th>方案 C 吸盤式</th></tr>
      <tr><td>抓得穩</td><td>3</td><td>4</td><td>3</td><td>2</td></tr>
      <tr><td>速度快</td><td>2</td><td>3</td><td>4</td><td>3</td></tr>
      <tr><td>好製作</td><td>1</td><td>3</td><td>4</td><td>2</td></tr>
      <tr><th colspan="2">總分（分數×權重）</th><th>21</th><th>21</th><th>14</th></tr></table>
    <p>總分 = 4×3 + 3×2 + 3×1 = 21（A）。A、B 同分時怎麼辦？回頭看哪個標準最重要，或做原型實測。<b>重點是把理由寫出來。</b></p>` },
  { id: 'test', title: '5. 測試紀錄：一次只改一個變數', html: `
    <p>想知道「速度」會不會影響準確度，就<b>只改速度</b>，其他（電池電量、起點、地板）都不變，並且<b>多測幾次</b>。</p>
    <table class="tbl"><tr><th>第幾次</th><th>速度</th><th>目標距離</th><th>實際距離</th><th>誤差</th></tr>
      <tr><td>1</td><td>50%</td><td>1000 mm</td><td>990 mm</td><td>−10</td></tr>
      <tr><td>2</td><td>50%</td><td>1000 mm</td><td>995 mm</td><td>−5</td></tr>
      <tr><td>3</td><td>100%</td><td>1000 mm</td><td>1040 mm</td><td>+40</td></tr></table>
    <p><b>結論要有根據</b>：「速度 100% 時誤差變大（+40），可能是停止時的慣性。下一步：100% 時提早 30 mm 停止，再測 3 次。」</p>` },
  { id: 'compare', title: '6. 好筆記 vs 差筆記', html: `
    <div class="compare">
      <div class="bad"><b>❌ 差的寫法</b><p>「今天改了手臂，比較好了。」</p><small>哪裡改？怎麼改？好多少？為什麼？都看不出來。</small></div>
      <div class="good"><b>✅ 好的寫法</b><p>11/23 目標：手臂舉球時晃動。測試 5 次，有 3 次球掉落。原因猜測：只用一根銷固定。改成兩點固定＋對角斜撐。再測 5 次，掉落 0 次。</p><small>有日期、目標、數據、原因、改法、結果。</small></div>
    </div>` },
  { id: 'english', title: '7. 英文句型（為日後比賽準備）', html: `
    <table class="tbl"><tr><th>用途</th><th>英文句型</th></tr>
      <tr><td>目標</td><td>Our goal is to … （我們的目標是…）</td></tr>
      <tr><td>問題</td><td>The problem is that … （問題是…）</td></tr>
      <tr><td>理由</td><td>We chose design A because … （我們選方案 A，因為…）</td></tr>
      <tr><td>測試</td><td>We tested it 5 times. （我們測了 5 次）</td></tr>
      <tr><td>結果</td><td>The result was … （結果是…）</td></tr>
      <tr><td>改進</td><td>Next, we will … （接下來我們會…）</td></tr></table>
    <p class="help">先用中文寫熟，再慢慢加英文。評審面談時也會用到這些句子。</p>` },
];

const NB_KINDS = {
  goal: { name: '問題定義 / 目標', icon: '🎯', fields: [
    { k: 'problem', l: '我要解決什麼問題？', h: '用一句話。例如：機器人走 1 公尺會偏向右邊。' },
    { k: 'why', l: '為什麼這很重要？', h: '解決後對比賽或任務有什麼幫助？' },
    { k: 'criteria', l: '怎樣算成功？（要量得出來）', h: '例如：連續 5 次，誤差都小於 20 mm。' }],
    check: ['寫了日期和姓名', '問題用一句話說得清楚', '寫了為什麼重要', '「成功」可以用數字量'] },
  brainstorm: { name: '腦力激盪', icon: '💡', fields: [
    { k: 'ideas', l: '我想到的方法（至少 3 個）', h: '一行一個，先不要批評。', big: true },
    { k: 'pros', l: '各方法的優點', h: '', big: true },
    { k: 'cons', l: '各方法的缺點', h: '', big: true }],
    check: ['寫了日期和姓名', '至少想了 3 個方法', '每個方法都有優點和缺點', '有些方法跟別人不一樣'] },
  matrix: { name: '決策矩陣', icon: '⚖️', custom: 'matrix', fields: [{ k: 'reason', l: '我的結論與理由', h: '總分最高的就一定選嗎？為什麼？', big: true }],
    check: ['寫了日期和姓名', '至少 3 個方案、3 個標準', '每個標準有權重', '算出總分', '寫了最後選擇的理由'] },
  sketch: { name: '設計草圖', icon: '✏️', custom: 'sketch', fields: [
    { k: 'label', l: '圖上標註說明', h: '寫下尺寸、零件名稱、為什麼這樣設計。', big: true }],
    check: ['寫了日期和姓名', '圖看得出整體形狀', '有標註尺寸或零件名稱', '寫了設計理由'] },
  test: { name: '測試紀錄', icon: '🧪', custom: 'test', fields: [
    { k: 'goal', l: '這次測試要確認什麼？', h: '一次只測一個變數。' },
    { k: 'conclusion', l: '結論與下一步', h: '根據數字說明，不要只寫「比較好」。', big: true }],
    check: ['寫了日期和姓名', '說明這次只改了什麼變數', '至少測 3 次', '有記錄實際數字', '結論有根據數據', '寫了下一步'] },
  program: { name: '程式說明', icon: '🧩', fields: [
    { k: 'what', l: '這段程式要做什麼？', h: '' },
    { k: 'blocks', l: '主要用了哪些積木？為什麼？', h: '例如：用「重複 4」走正方形，因為每邊動作一樣。', big: true },
    { k: 'result', l: '實際跑起來的結果', h: '有沒有跟預期一樣？', big: true },
    { k: 'improve', l: '還可以怎麼改進？', h: '' }],
    check: ['寫了日期和姓名', '說明了程式的目的', '解釋了積木為什麼這樣用', '寫了實際結果', '想了改進的方向'] },
  reflect: { name: '練習心得', icon: '🌱', fields: [
    { k: 'good', l: '今天做得好的地方', h: '' },
    { k: 'hard', l: '遇到的困難', h: '', big: true },
    { k: 'learn', l: '學到什麼', h: '', big: true },
    { k: 'next', l: '下一步', h: '' }],
    check: ['寫了日期和姓名', '寫了具體的困難', '寫了學到的東西', '有下一步'] },
};
const NB_RUBRIC_COMMON = [];

/* ================= 挑戰 ================= */
// 場地：每格 200 mm。座標 (c,r) 從左上角算起；dir：N 上、E 右、S 下、W 左。
// path 是參考解答的路線（格座標，可含小數）；code 是參考解答積木。
const CHALLENGES = [
  { id: 'ch1', title: '直線衝刺', lv: 1, skills: ['C1', 'B2'], cols: 6, rows: 2, start: { c: 0.5, r: 1, dir: 'E' }, goal: { c: 5.5, r: 1 }, walls: [],
    goal_t: '讓機器人從左邊起點，筆直走到右邊的旗子。', task: '每格是 200 mm，起點到旗子相隔 5 格。想一想要走多少 mm？',
    hints: ['先算距離：5 格 × 200 mm。', '用「驅動 向前 為 □ 毫米」一個積木就夠了。', '距離是 1000 mm。若停的位置不準，先查電池和起點有沒有對齊。'],
    path: [[0.5, 1], [5.5, 1]], code: ['何時開始', '驅動 [向前] 為 (1000) [毫米]'] },
  { id: 'ch2', title: '轉個彎', lv: 1, skills: ['C1', 'C2'], cols: 5, rows: 4, start: { c: 0.5, r: 3, dir: 'E' }, goal: { c: 3.5, r: 0.5 }, walls: [],
    goal_t: '從起點出發，走到旗子。', task: '旗子在右邊 3 格、上面 3 格的地方。機器人一開始面向右。',
    hints: ['先往右走，再轉向上走。', '往上要「向左轉 90 度」（面向右時，左轉就是朝上）。', '直走 600，左轉 90，再直走 500（從 3.5 格列到 0.5 格列，約 2.5 格 = 500）。'],
    path: [[0.5, 3], [3.5, 3], [3.5, 0.5]], code: ['何時開始', '驅動 [向前] 為 (600) [毫米]', '旋轉 [左邊] 度 (90) 度', '驅動 [向前] 為 (500) [毫米]'] },
  { id: 'ch3', title: '繞過障礙', lv: 2, skills: ['C1', 'C2'], cols: 5, rows: 3, start: { c: 0.5, r: 2.5, dir: 'E' }, goal: { c: 4.5, r: 2.5 }, walls: [{ c: 2, r: 1 }, { c: 2, r: 2 }],
    goal_t: '不碰到灰色障礙，走到旗子。', task: '中間的灰色牆擋住了下面兩列，只能從最上面一列繞過去。',
    hints: ['路線像一個倒過來的「U」。', '先左轉朝上，走到最上面一列。', '往上 400、右轉、往右 800、右轉、往下 400。'],
    path: [[0.5, 2.5], [0.5, 0.5], [4.5, 0.5], [4.5, 2.5]], code: ['何時開始', '旋轉 [左邊] 度 (90) 度', '驅動 [向前] 為 (400) [毫米]', '旋轉 [正確的] 度 (90) 度', '驅動 [向前] 為 (800) [毫米]', '旋轉 [正確的] 度 (90) 度', '驅動 [向前] 為 (400) [毫米]'] },
  { id: 'ch4', title: '走正方形', lv: 2, skills: ['C2', 'C4'], cols: 5, rows: 4, start: { c: 1.5, r: 3.5, dir: 'N' }, goal: { c: 1.5, r: 3.5 }, walls: [],
    goal_t: '走出一個邊長 400 mm 的正方形，最後回到起點。', task: '用「重複」積木，不要把同樣的積木寫四次！',
    hints: ['正方形有 4 條邊，4 個轉角。', '每次做的事一樣：「前進 400 + 右轉 90」。', '重複 4：驅動 400、旋轉 右 90。'],
    path: [[1.5, 3.5], [1.5, 1.5], [3.5, 1.5], [3.5, 3.5], [1.5, 3.5]], code: ['何時開始', '重複 (4)', '  驅動 [向前] 為 (400) [毫米]', '  旋轉 [正確的] 度 (90) 度'] },
  { id: 'ch5', title: '爬樓梯', lv: 2, skills: ['C4'], cols: 5, rows: 4, start: { c: 0.5, r: 3.5, dir: 'E' }, goal: { c: 3.5, r: 0.5 }, walls: [],
    goal_t: '像爬樓梯一樣，一格一格往右上走到旗子。', task: '每一階：右走 200、往上 200。一共 3 階。',
    hints: ['找出重複的動作：右走、左轉、上走、右轉。', '一階 = 前進 200 → 左轉 90 → 前進 200 → 右轉 90。', '重複 3。'],
    path: [[0.5, 3.5], [1.5, 3.5], [1.5, 2.5], [2.5, 2.5], [2.5, 1.5], [3.5, 1.5], [3.5, 0.5]], code: ['何時開始', '重複 (3)', '  驅動 [向前] 為 (200) [毫米]', '  旋轉 [左邊] 度 (90) 度', '  驅動 [向前] 為 (200) [毫米]', '  旋轉 [正確的] 度 (90) 度'] },
  { id: 'ch6', title: '正三角形', lv: 3, skills: ['C2', 'C4'], cols: 5, rows: 4, start: { c: 1.5, r: 3.5, dir: 'E' }, goal: { c: 1.5, r: 3.5 }, walls: [],
    goal_t: '走出邊長 400 mm 的正三角形，回到起點。', task: '想想看：每個轉角要轉幾度？（提示：不是 60！）',
    hints: ['機器人轉的是「外角」，三個外角加起來是 360 度。', '360 ÷ 3 = 120。', '重複 3：驅動 400、旋轉 左 120。'],
    path: [[1.5, 3.5], [3.5, 3.5], [2.5, 1.77], [1.5, 3.5]], code: ['何時開始', '重複 (3)', '  驅動 [向前] 為 (400) [毫米]', '  旋轉 [左邊] 度 (120) 度'] },
  { id: 'ch7', title: '兩個大小方形', lv: 3, skills: ['E3', 'C4'], cols: 5, rows: 4, start: { c: 0.5, r: 3.5, dir: 'N' }, goal: { c: 0.5, r: 3.5 }, walls: [],
    goal_t: '從同一個起點，先走邊長 200 的方形，再走邊長 400 的方形。', task: '用「我的積木」做一個會帶「邊長」參數的方形，呼叫兩次。',
    hints: ['在「邏輯 - 我的積木」按「創建一個區塊」，取名並加一個參數 size。', '積木裡面放：重複 4 { 驅動 向前 為 size；旋轉 右 90 }。', '主程式：方形(200)、方形(400)。'],
    path: [[0.5, 3.5], [0.5, 2.5], [1.5, 2.5], [1.5, 3.5], [0.5, 3.5], [0.5, 1.5], [2.5, 1.5], [2.5, 3.5], [0.5, 3.5]], code: ['定義 square (size)', '  重複 (4)', '    驅動 [向前] 為 (size) [毫米]', '    旋轉 [正確的] 度 (90) 度', '何時開始', 'square (200)', 'square (400)'] },
  { id: 'ch9', title: '看到紅色就停（顏色感測器）', lv: 2, skills: ['D4', 'C5'], cols: 6, rows: 2, start: { c: 0.5, r: 1, dir: 'E' }, goal: { c: 4.1, r: 1 }, walls: [], colors: [{ c: 4, r: 0, color: 'red' }, { c: 4, r: 1, color: 'red' }],
    goal_t: '一直往前走，一看到紅色的地板就停下來。', task: '你不知道紅色在多遠的地方，要讓機器人自己判斷。在模擬器的 Sensing 類別找「Color sees red?」，拖進「repeat until」的六角形空格。',
    hints: ['先讓機器人「一直往前走」：用「drive forward」（沒有距離的那個）。', '再用「repeat until」，條件放「Color sees red?」，迴圈裡面可以什麼都不放。', '迴圈結束後，記得用「stop driving」讓機器人停下來。'],
    path: [[0.5, 1], [4.1, 1]], code: ['何時開始', '驅動 [向前]', '重複直到 <看到紅色>', '停止駕駛'], note: '示意：真的顏色感測器要在 VEXcode 的 Devices 加入，並且要在固定距離、固定光線下測試。' },
  { id: 'ch10', title: '撞到牆就後退（碰撞開關）', lv: 2, skills: ['D3', 'C5'], cols: 6, rows: 2, start: { c: 0.5, r: 1, dir: 'E' }, goal: { c: 3.55, r: 1 }, walls: [{ c: 5, r: 0 }, { c: 5, r: 1 }], allowHit: true,
    goal_t: '往前走，用碰撞開關偵測到撞上牆壁，然後後退 200 mm。', task: '這題「要」撞到牆（用碰撞開關偵測），所以撞牆不會被扣分。在 Sensing 類別找「Bumper pressed?」。',
    hints: ['一直往前走，直到碰撞開關被按下：「repeat until」＋「Bumper pressed?」。', '撞到之後先「stop driving」。', '再用「drive reverse for 200 mm」後退。'],
    path: [[0.5, 1], [4.55, 1], [3.55, 1]], code: ['何時開始', '驅動 [向前]', '重複直到 <碰撞開關被按下>', '停止駕駛', '驅動 [反向] 為 (200) [毫米]'], note: '示意：真的碰撞開關要裝在機器人最前面，並在 Devices 加入。' },
  { id: 'ch8', title: '停在牆前（需要距離感測器）', lv: 3, skills: ['D2', 'C5'], cols: 6, rows: 2, start: { c: 0.5, r: 1, dir: 'E' }, goal: { c: 3.8, r: 1 }, walls: [{ c: 5, r: 0 }, { c: 5, r: 1 }],
    goal_t: '往前走，在離牆壁約 150 mm 的地方停下，不要撞到。', task: '你不知道正確距離（牆可能被移動），要讓機器人自己判斷。裝上距離感測器試試看。',
    hints: ['不知道要走多遠，但知道「什麼時候停」，用「重複直到」或「而」。', '條件：距離感測器讀到的距離大於 150。', '感測器積木的實際字樣以你 VEXcode 裡新增的 Distance 為準，下面是示意。'],
    path: [[0.5, 1], [3.8, 1]], code: ['何時開始', '而 <距離 > 150 毫米>', '  驅動 [向前]', '停止駕駛'], note: '示意：感測器積木的實際字樣，請先在 VEXcode 的「裝置」加入距離感測器後再對照。' },
  { id: 'ch11', title: '來回跑一趟', lv: 1, skills: ['C1', 'C2'], cols: 6, rows: 2, start: { c: 0.5, r: 1, dir: 'E' }, goal: { c: 0.5, r: 1 }, walls: [],
    goal_t: '往右走到最右邊，再回到起點。', task: '這題請用「轉身」回來，不要倒退。想一想：要轉幾度才能面向相反方向？',
    hints: ['面向右，要面向左，需要轉半圈。', '半圈是 180 度。', '驅動 800、旋轉 右 180、驅動 800。'],
    path: [[0.5, 1], [4.5, 1], [0.5, 1]], code: ['何時開始', '驅動 [向前] 為 (800) [毫米]', '旋轉 [正確的] 度 (180) 度', '驅動 [向前] 為 (800) [毫米]'] },
  { id: 'ch12', title: 'S 形迷宮', lv: 2, skills: ['C1', 'C2', 'C4'], cols: 6, rows: 4, start: { c: 0.5, r: 3.5, dir: 'E' }, goal: { c: 5.5, r: 0.5 }, walls: [{ c: 2, r: 0 }, { c: 2, r: 1 }, { c: 4, r: 2 }, { c: 4, r: 3 }],
    goal_t: '不碰到灰色障礙，走到旗子。', task: '兩面牆一面擋上面、一面擋下面，路線像一個「S」。先在紙上畫出要走的路，再數每一段有幾格。',
    hints: ['先沿著最下面一列往右走，過第一面牆。', '轉彎的順序：左、右、左。', '驅動 600、左轉 90、驅動 400、右轉 90、驅動 400、左轉 90、驅動 200。'],
    path: [[0.5, 3.5], [3.5, 3.5], [3.5, 1.5], [5.5, 1.5], [5.5, 0.5]], code: ['何時開始', '驅動 [向前] 為 (600) [毫米]', '旋轉 [左邊] 度 (90) 度', '驅動 [向前] 為 (400) [毫米]', '旋轉 [正確的] 度 (90) 度', '驅動 [向前] 為 (400) [毫米]', '旋轉 [左邊] 度 (90) 度', '驅動 [向前] 為 (200) [毫米]'] },
  { id: 'ch13', title: '正六邊形', lv: 3, skills: ['C2', 'C4'], cols: 5, rows: 4, start: { c: 1.5, r: 3.5, dir: 'E' }, goal: { c: 1.5, r: 3.5 }, walls: [],
    goal_t: '走出邊長 300 mm 的正六邊形，回到起點。', task: '跟正三角形同樣的想法：每個轉角要轉幾度？先算外角，再用「重複」。',
    hints: ['六個外角加起來是 360 度。', '360 ÷ 6 = 60。', '重複 6：驅動 300、旋轉 左 60。'],
    path: [[1.5, 3.5], [3, 3.5], [3.75, 2.2], [3, 0.9], [1.5, 0.9], [0.75, 2.2], [1.5, 3.5]], code: ['何時開始', '重複 (6)', '  驅動 [向前] 為 (300) [毫米]', '  旋轉 [左邊] 度 (60) 度'] },
  { id: 'lu1', lu: true, title: 'Level Up：單趟送分', lv: 1, skills: ['F2', 'B2'], cols: 6, rows: 3, start: { c: 0.5, r: 1.5, dir: 'E' }, goal: { c: 5.5, r: 1.5 }, walls: [],
    goal_t: '示意：機器人帶著一個沙包，從左邊直線送到右邊的球門。', task: '⚠ 這是示意場地（每格 200 mm），不是官方尺寸。請在自己的場地實際量距離再調整。想一想：距離多少？走完要幾秒？（用碼錶量！）',
    hints: ['先量你的場地：起點到球門的距離。', '用「驅動 向前 為 □ 毫米」，示意場地是 5 格 = 1000 mm。', '用碼錶量一趟要幾秒，記在「測試紀錄」，這個秒數會用在「得分規劃器」。'],
    path: [[0.5, 1.5], [5.5, 1.5]], code: ['何時開始', '驅動 [向前] 為 (1000) [毫米]'], note: '真正放球的手臂動作要用你的馬達積木，字樣請對照你 VEXcode 的裝置。' },
  { id: 'lu2', lu: true, mode: 'waypoints', title: 'Level Up：來回兩趟', lv: 2, skills: ['F2', 'C4'], cols: 6, rows: 3, start: { c: 0.5, r: 1.5, dir: 'E' }, goal: { c: 3.5, r: 1.5 }, walls: [],
    goal_t: '示意：送一個沙包到球門（600 mm），回到起點，再送第二個，共兩趟。', task: '用「重複」積木，不要複製貼上。倒車回起點要用「反向」。',
    hints: ['一趟 = 前進 600 + 倒退 600。', '「驅動」積木的方向選單有「向前」和「反向」。', '重複 2：驅動 向前 600、驅動 反向 600。'],
    path: [[0.5, 1.5], [3.5, 1.5], [0.5, 1.5], [3.5, 1.5], [0.5, 1.5]], code: ['何時開始', '重複 (2)', '  驅動 [向前] 為 (600) [毫米]', '  驅動 [反向] 為 (600) [毫米]'], note: '真的比賽要在球門前停一下放球：那是你的手臂／爪子動作，加在兩個驅動積木中間。' },
  { id: 'lu3', lu: true, title: 'Level Up：繞到金字塔', lv: 3, skills: ['F2', 'C2'], cols: 6, rows: 4, start: { c: 0.5, r: 3.5, dir: 'E' }, goal: { c: 4.5, r: 0.5 }, walls: [{ c: 2, r: 2 }, { c: 2, r: 3 }],
    goal_t: '示意：從左下角出發，繞過中間的障礙，走到右上角的金字塔（旗子）。', task: '示意場地。想想看：路線能不能更短？更短的路線，一趟就更省時間。',
    hints: ['先往上走，離開障礙的高度，再往右。', '往上要左轉，往右要再右轉（「正確的」＝右）。', '左轉 90；前進 600；右轉 90；前進 800。'],
    path: [[0.5, 3.5], [0.5, 0.5], [4.5, 0.5]], code: ['何時開始', '旋轉 [左邊] 度 (90) 度', '驅動 [向前] 為 (600) [毫米]', '旋轉 [正確的] 度 (90) 度', '驅動 [向前] 為 (800) [毫米]'] },
];

/* ================= 組裝教學 ================= */
const svgWrap = (inner, w = 320, h = 160) => `<svg class="svgfig" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img">${inner}</svg>`;
const gearSvg = (cx, cy, r, n, c) => {
  let t = '';
  for (let i = 0; i < n; i++) { const a = (i * 2 * Math.PI) / n; t += `<rect x="${cx + (r + 3) * Math.cos(a) - 3}" y="${cy + (r + 3) * Math.sin(a) - 3}" width="6" height="6" fill="${c}" transform="rotate(${(a * 180) / Math.PI} ${cx + (r + 3) * Math.cos(a)} ${cy + (r + 3) * Math.sin(a)})"/>`; }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" opacity=".75"/>${t}<circle cx="${cx}" cy="${cy}" r="5" fill="#fff"/>`;
};
const BUILD = [
  { id: 'tri', title: '三角形最穩：結構補強', skill: 'B1', svg: svgWrap(`
      <g fill="none" stroke="#b37b5e" stroke-width="7" stroke-linejoin="round"><polygon points="40,130 100,130 100,50 40,50" opacity=".9"/><polygon points="40,130 100,130 100,50 40,50" transform="translate(0,0)" stroke-dasharray="0"/><line x1="40" y1="50" x2="100" y2="130" stroke="#bf5b2e"/></g>
      <text x="70" y="148" text-anchor="middle" font-size="11" fill="#5d6b7e">加了對角斜撐＝兩個三角形</text>
      <g fill="none" stroke="#5a85bb" stroke-width="7" stroke-linejoin="round"><polygon points="190,130 270,130 230,50"/></g>
      <text x="230" y="148" text-anchor="middle" font-size="11" fill="#5d6b7e">三角形不會歪</text>`),
    html: '<p>四邊形的框架很容易被推歪（變成平行四邊形），三角形卻不會，因為三條邊的長度已經決定了形狀。機器人的手臂、底盤如果會晃，先找哪裡是「四邊形」，加一根斜撐。</p>',
    lab: '動手做：用 4 根梁和 4 根銷搭一個四邊形，用手推看看會不會歪。再加一根斜撐，比較差別。把兩次的感覺寫成一頁「測試紀錄」。' },
  { id: 'wheel', title: '輪子轉一圈走多遠', skill: 'B2', svg: svgWrap(`
      <circle cx="90" cy="80" r="46" fill="none" stroke="#5a85bb" stroke-width="8"/><circle cx="90" cy="80" r="4" fill="#5a85bb"/><line x1="90" y1="80" x2="136" y2="80" stroke="#bf5b2e" stroke-width="3"/><text x="113" y="74" font-size="11" fill="#bf5b2e" text-anchor="middle">半徑</text>
      <line x1="150" y1="126" x2="300" y2="126" stroke="#1f9d55" stroke-width="4"/><text x="225" y="116" text-anchor="middle" font-size="12" fill="#1f9d55">轉一圈 ＝ 圓周</text>
      <text x="225" y="148" text-anchor="middle" font-size="11" fill="#5d6b7e">圓周 ＝ 直徑 × 3.14</text>`),
    html: '<p>輪子（沒打滑）轉一圈，機器人前進一個<b>圓周</b>的距離。所以：距離 = 圈數 × 圓周；圈數 = 距離 ÷ 圓周。這就是程式裡「驅動 向前 為 □ 毫米」背後的原理——VEXcode 會用你設定的輪子大小幫你換算。</p>',
    lab: '動手做：量出你輪子的直徑（mm），算圓周。在地上畫一條直線，用手轉輪子 3 圈，量機器人實際走多遠，跟計算比較，把誤差記下來。' },
  { id: 'gear', title: '齒輪比：速度與力量', skill: 'B3', svg: svgWrap(`
      ${gearSvg(95, 80, 26, 12, '#f2a579')}${gearSvg(168, 80, 52, 36, '#77b2ff')}
      <text x="95" y="130" text-anchor="middle" font-size="11" fill="#5d6b7e">12 齒（主動）</text><text x="190" y="150" text-anchor="middle" font-size="11" fill="#5d6b7e">36 齒（從動）→ 慢 3 倍、力量大 3 倍</text>
      <path d="M95 40 q0 -8 12 -8" fill="none" stroke="#bf5b2e" stroke-width="2"/><text x="270" y="40" font-size="11" fill="#5d6b7e">方向相反</text>`, 340, 160),
    html: '<p>兩個齒輪咬合，<b>轉向相反</b>。小齒輪帶大齒輪：<b>變慢、力量變大</b>（減速），適合手臂舉重物。大齒輪帶小齒輪：變快、力量變小（加速）。從動圈數 = 主動圈數 × 主動齒數 ÷ 從動齒數。</p>',
    lab: '動手做：用 12 齒和 36 齒的齒輪咬合，轉 12 齒的齒輪 3 圈，數 36 齒的齒輪轉幾圈（應該是 1 圈）。把結果記在筆記。' },
  { id: 'diff', title: '傳動系統怎麼轉彎', skill: 'B4', svg: svgWrap(`
      <rect x="60" y="45" width="100" height="70" rx="8" fill="#77b2ff" opacity=".4" stroke="#5a85bb" stroke-width="3"/>
      <rect x="85" y="32" width="50" height="14" rx="4" fill="#5a85bb"/><rect x="85" y="114" width="50" height="14" rx="4" fill="#5a85bb"/>
      <text x="110" y="28" text-anchor="middle" font-size="11" fill="#1f9d55">左輪 ▶ 前進</text><text x="110" y="148" text-anchor="middle" font-size="11" fill="#d33a3a">右輪 ◀ 後退</text>
      <text x="245" y="84" text-anchor="middle" font-size="12" fill="#5d6b7e">→ 原地向右轉</text>`),
    html: '<p>左右各有驅動輪的機器人（差速驅動）：兩邊<b>同向同速</b>就直走；<b>反向</b>就原地轉；一邊快一邊慢，會往慢的那邊畫弧。想走直線卻偏了，常常是兩邊速度或摩擦力不一樣。</p>',
    lab: '動手做：讓機器人「驅動 向前 為 1000 毫米」，量它偏了多少、往哪邊偏。猜原因，改一個地方再測，記錄在「測試紀錄」。' },
  { id: 'lever', title: '手臂與力臂', skill: 'B5', svg: svgWrap(`
      <line x1="40" y1="90" x2="290" y2="90" stroke="#b37b5e" stroke-width="8" stroke-linecap="round"/><polygon points="150,92 130,130 170,130" fill="#5a85bb"/>
      <rect x="245" y="60" width="40" height="30" fill="#f1ae34" stroke="#b38136" stroke-width="3"/><text x="265" y="52" text-anchor="middle" font-size="11" fill="#5d6b7e">物體</text>
      <text x="150" y="150" text-anchor="middle" font-size="11" fill="#5d6b7e">轉軸</text><text x="70" y="75" font-size="11" fill="#1f9d55">施力 ↓</text>
      <text x="205" y="110" text-anchor="middle" font-size="11" fill="#d33a3a">力臂越長越費力</text>`),
    html: '<p>手臂越長，前端舉東西離轉軸越遠（<b>力臂</b>越長），馬達就越費力。想舉重物：縮短手臂，或用減速齒輪換取力量。爪子表面用橡膠，摩擦力大才夾得穩。</p>',
    lab: '動手做：同一個重物，分別掛在手臂近轉軸處和遠轉軸處，比較哪個舉得動。記錄在筆記。' },
  { id: 'cog', title: '重心與穩定', skill: 'B1', svg: svgWrap(`
      <rect x="40" y="90" width="90" height="40" rx="6" fill="#77b2ff" opacity=".5" stroke="#5a85bb" stroke-width="3"/><circle cx="85" cy="112" r="6" fill="#d33a3a"/><text x="85" y="148" text-anchor="middle" font-size="11" fill="#1f9d55">重心低：穩</text>
      <rect x="200" y="40" width="50" height="90" rx="6" fill="#f2a579" opacity=".5" stroke="#b37b5e" stroke-width="3"/><circle cx="225" cy="62" r="6" fill="#d33a3a"/><text x="225" y="148" text-anchor="middle" font-size="11" fill="#d33a3a">重心高：易翻</text>`),
    html: '<p>重的零件（電池、Brain）放<b>低、靠近中間</b>，機器人轉彎、急停、撞到東西時比較不容易翻倒。</p>',
    lab: '動手做：把 Brain 先裝在高處，再裝在低處，用手把機器人斜推，看哪個比較難翻倒。' },
];
const PARTS = [
  { n: 'Brain（主機）', z: '機器人的大腦，程式下載到這裡執行。第二代有 12 個 Smart Port（連接埠），內建慣性感測器。', ic: '🧠' },
  { n: 'Smart Motor（智慧馬達）', z: '讓輪子、手臂轉動。接在 Brain 的連接埠，程式裡要設定同一個埠號。', ic: '⚙️' },
  { n: 'Controller（遙控器）', z: '手動駕駛用。比賽的駕駛階段靠它。', ic: '🎮' },
  { n: 'Bumper（碰撞開關）', z: '偵測有沒有被按到或撞到。', ic: '🔘' },
  { n: 'Touch LED（觸控燈）', z: '偵測觸碰，也能發出不同顏色的光。', ic: '💡' },
  { n: 'Distance（距離感測器）', z: '量前方物體有多遠。', ic: '📏' },
  { n: 'Color（顏色感測器）', z: '辨識物體或地面的顏色。', ic: '🎨' },
  { n: 'Optical（光學感測器）', z: '偵測光線、顏色與接近。', ic: '🔦' },
  { n: 'Gyro（陀螺儀）', z: '量機器人轉了多少度、朝哪個方向。', ic: '🧭' },
  { n: 'Vision / AI Vision（視覺）', z: '用鏡頭辨識物體；AI Vision 可使用預設模型。', ic: '👁️' },
  { n: 'Pneumatic（氣動）', z: '用空氣推動的機構（需要氣動零件）。', ic: '💨' },
  { n: '梁、連接銷、軸、齒輪、輪子', z: '結構與傳動的基本零件：梁搭骨架、銷連接、軸傳遞轉動、齒輪改變速度力量、輪子負責移動（含全向輪）。', ic: '🔩' },
];

/* ================= 比賽專區 ================= */
const GLOSSARY = [
  ['Drivetrain', '傳動系統', '讓機器人移動的整套機構（馬達＋輪子）。'],
  ['Autonomous', '自動階段', '機器人只靠事先寫好的程式自己跑，不能用遙控器。'],
  ['Driver Control', '手動駕駛', '由駕駛員用遙控器操控。'],
  ['Robot Skills', '機器人技能賽', '單一機器人在限定時間內盡量得分的項目，可分手動駕駛與自動程式。'],
  ['Teamwork', '團隊合作賽', '兩支隊伍組成一組一起得分。'],
  ['Engineering Notebook', '工程筆記', '記錄設計與思考過程的筆記本。'],
  ['Interview', '評審面談', '評審當面問你們設計與思考的問題。'],
  ['Game Manual', '比賽規則手冊', '當季遊戲的官方規則，一定要讀。'],
  ['Inspection', '機器人檢錄', '比賽前檢查機器人是否符合規定（尺寸、零件等）。'],
  ['Field', '場地', '比賽用的場地。'],
  ['Match', '場次', '一場比賽。'],
  ['Score', '得分', '分數。'],
  ['Sensor', '感測器', '讓機器人感知環境的零件。'],
  ['Motor', '馬達', '提供轉動的動力零件。'],
  ['Gear Ratio', '齒輪比', '兩個齒輪的齒數比，決定速度與力量。'],
  ['Torque', '扭力', '轉動的力量。'],
  ['Velocity', '速度', '移動的快慢。'],
  ['Calibrate', '校準', '讓感測器回到正確的基準。'],
  ['Debug', '除錯', '找出並修正程式的錯誤。'],
  ['Iterate', '反覆改進', '一次又一次測試與修改。'],
  ['Prototype', '原型', '用來測試想法的初步版本。'],
  ['Hypothesis', '假設', '對結果的預測：「我認為…」。'],
  ['Variable', '變數', '實驗裡只改變的那個條件，或程式裡存數字的盒子。'],
  ['Strategy', '策略', '怎麼安排時間和動作拿最多分。'],
  ['Teamwork (skill)', '團隊精神', '互相尊重、分工、溝通。'],
  ['Design Award', '設計獎', '獎勵好的設計與工程筆記（評審獎項）。'],
  ['Excellence Award', '卓越獎', '表現全面優秀的隊伍（評審獎項）。'],
  ['Judges', '評審', '負責面談與看筆記的人。'],
  ['Loop', '迴圈', '重複執行的程式結構。'],
  ['Condition', '條件', '「如果…」的判斷。'],
];
const INTERVIEW = [
  { q: 'Can you tell us about your robot?', z: '可以介紹一下你們的機器人嗎？', frame: 'Our robot is designed to … It has … The most important feature is … because …' },
  { q: 'What problem were you trying to solve?', z: '你們想解決什麼問題？', frame: 'The problem was that … So our goal was to …' },
  { q: 'Why did you choose this design?', z: '為什麼選這個設計？', frame: 'We compared … designs. We chose this one because … (用決策矩陣的結果)' },
  { q: 'What did you test, and what did you learn?', z: '你們測試了什麼？學到什麼？', frame: 'We tested … times. The result was … We learned that …' },
  { q: 'What was the biggest challenge?', z: '最大的困難是什麼？', frame: 'The biggest challenge was … We solved it by …' },
  { q: 'How does your program work?', z: '你的程式怎麼運作？', frame: 'First the robot … Then it uses a loop to … We used a sensor to …' },
  { q: 'What would you improve if you had more time?', z: '如果有更多時間，會改進什麼？', frame: 'If we had more time, we would … because …' },
  { q: 'How did your team work together?', z: '你們怎麼分工合作？', frame: 'I was responsible for … My teammate … When we disagreed, we …' },
  { q: 'What did you change after a test failed?', z: '測試失敗後改了什麼？', frame: 'In test … the robot … so we changed … After that, …' },
  { q: 'What is your favorite part of your robot?', z: '你最喜歡機器人的哪個部分？', frame: 'My favorite part is … because …' },
];

/* ================= 當季：VEX IQ 2026-2027 Level Up =================
   整理自官方 Game Manual v2.1（2026/10/8）第 2、3、4 章與附錄 C 的可讀部分。
   沒讀全的部分（場地精確尺寸、違規處罰、活動規則、評審獎項細則）不放，請看原文。 */
const SEASON = {
  name: 'Level Up', season: '2026–2027', version: 'v2.1（2026 年 10 月 8 日）',
  manual: 'https://link.vex.com/docs/26-27/viqrc/game-manual',
  objective: '把沙包（Bean Bag）投進球門（Goal）得分，越高的球門分數越高。機器人一次只能帶一個沙包，而且大部分沙包要穿過整個場地才拿得到。',
  elements: [
    ['沙包 Bean Bag', '唯一的得分物。紅、藍、黃三色，共 38 個：紅 16、藍 16、黃 6（其中 2 個是起跑時帶上場的 Preload，每隊一個）。'],
    ['地板球門 Floor Goal', '紅、藍各一，在金字塔 L1 旁邊到場地邊緣的地面區域。'],
    ['金字塔球門 Pyramid Goal', '紅、藍各一，有 L1、L2、L3 三層。'],
    ['L4 球門', '一根塔上的灰色頂面，沒有顏色。'],
    ['裝填區 Load Zone', '紅、藍各一，在角落。由場邊的人把沙包一個一個放進場地（只能放對應顏色）。'],
  ],
  formats: [
    ['團隊合作賽 Teamwork', '一組兩支隊伍、各一台機器人，一起在 1 分鐘內盡量得分。**沒有自動階段**，全程手動駕駛。'],
    ['駕駛技能賽 Driving Skills', '一支隊伍、一台機器人，1 分鐘手動駕駛。'],
    ['自動程式技能賽 Autonomous Coding Skills', '一支隊伍、一台機器人，1 分鐘**只靠程式自己跑**，不能用遙控器。這就是你最需要寫程式練的項目！'],
  ],
  skillsNote: '技能賽的名次是「駕駛」和「自動程式」兩場分數加起來。技能賽的計分規則和團隊賽一樣。',
  scoring: [
    { k: 'floor', n: '地板球門 Floor Goal', p: 1 },
    { k: 'l1', n: 'L1 球門', p: 3 },
    { k: 'l2', n: 'L2 球門', p: 6 },
    { k: 'l3', n: 'L3 球門', p: 12 },
    { k: 'l4', n: 'L4 球門（只收黃色）', p: 16 },
  ],
  colorRules: [
    '沙包要「跟球門同色」或是「黃色」，才能在地板球門和 L1～L3 得分。',
    'L4 球門只收黃色沙包。',
    '同一個沙包如果同時算在好幾層，只算最高那一層的分。',
    '比賽結束、東西都停下來之後才計分，由裁判用眼睛判斷。',
  ],
  robot: [
    ['尺寸', '賽前檢錄和每場開始時，機器人要放得進 11" × 20" × 15"（約 279 × 508 × 381 mm）的空間。'],
    ['馬達', '最多 6 顆 VEX IQ Smart Motor。多帶的也算，即使沒接上。'],
    ['Brain 與遙控器', '每台機器人一個 Brain、一個 Controller，不能用其他微控制器（例如 Raspberry Pi、Arduino）。'],
    ['零件', '只能用官方 VEX IQ 零件（有列出的例外除外），不可用 3D 列印零件。'],
    ['檢錄', '每場比賽前，機器人都要通過檢錄。'],
  ],
  rules: [
    ['手不能伸進場地', '比賽中，隊員不能碰場地、機器人或沙包（有裁判許可的例外）。'],
    ['別提早、別延遲', '計時開始才能動，時間到機器人就要停。'],
    ['一次只能處理一個沙包', '機器人同時最多「持有」一個沙包，或把一個沙包在地上推著走（Plowing，手冊 SG6）。要同時搬或推多個沙包就違規。細節請看手冊原文。'],
    ['安全第一', '不安全的操作可能被禁賽。學生要有大人陪同，每位隊員要有簽署過的參賽同意書。'],
  ],
  strategy: [
    '一次只能帶一個沙包 → 每「一趟」的價值差很多：投 Floor 1 分、L3 12 分、L4 16 分。高層分數高，但機構也比較難做。先算算：一趟多少秒？60 秒最多幾趟？',
    '黃色沙包只有 6 個，而且 L4（16 分）只收黃色，而黃色也能放進任何顏色的球門 → 黃色很珍貴，值得規劃怎麼拿。',
    '團隊賽有兩台機器人 → 可以分工（一台專攻低層又快、一台專攻高層），並且要講好路線，避免互相擋路。',
    '自動程式技能賽 60 秒沒有駕駛 → 路線要固定、每次都跑得一樣。穩定比花俏重要，先把「一個得分動作」寫到每次都成功，再往上加。',
    '兩種技能賽分數要相加 → 手動駕駛練的是機構與操作熟練度，自動程式練的是準確度，兩個都練。',
  ],
};
