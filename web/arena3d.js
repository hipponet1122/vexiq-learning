/* 3D Level Up 模擬練習場（Three.js WebGL 光影版）：真實陰影、PBR 質感場地與機器人、抓取投球得分＋官方 60 秒場地音效 */
(function () {
  'use strict';
  const VX = window.VX;
  const { h, shell, api, toast } = VX;

  let threePromise = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (!threePromise) {
      threePromise = new Promise((resolve, reject) => {
        const sc = document.createElement('script');
        sc.src = 'vendor/three.min.js';
        sc.onload = () => (window.THREE ? resolve(window.THREE) : reject(new Error('THREE 未載入')));
        sc.onerror = () => reject(new Error('無法載入 3D 引擎'));
        document.head.append(sc);
      });
    }
    return threePromise;
  }

  let aCtx = null;
  function playTone(freq, dur, type = 'sine', vol = 0.16, delay = 0) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      aCtx = aCtx || new AC();
      if (aCtx.state === 'suspended') aCtx.resume();
      const t0 = aCtx.currentTime + delay;
      const osc = aCtx.createOscillator(), g = aCtx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(aCtx.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.03);
    } catch (e) {}
  }

  async function viewArena3D() {
    VX.app.replaceChildren(shell(h('div', { class: 'panel center', style: 'padding:40px 16px' },
      h('div', { class: 'big' }, '🏟️'), h('h2', null, '正在啟動 3D WebGL 模擬練習場…'),
      h('p', { class: 'sub' }, '載入立體光影引擎與 Level Up 場地模型中')), { title: '3D 練習場', icon: '🏟️' }));

    let THREE;
    try { THREE = await loadThree(); }
    catch (e) {
      VX.app.replaceChildren(shell(h('div', { class: 'panel' }, h('h2', null, '無法啟動 3D 引擎'), h('p', { class: 'sub' }, e.message)), { title: '3D 練習場', icon: '🏟️' }));
      return;
    }

    const st = VX.st;
    const rcfg = (st && st.robotCfg) || null;
    const gearMul = rcfg && rcfg.gear === '3:1' ? 0.55 : rcfg && rcfg.gear === '9:1' ? 0.35 : 1;
    const turnMul = rcfg && rcfg.wheel === 'omni' ? 1.25 : 1;

    let soundOn = true;
    const sfx = {
      grab: () => { if (!soundOn) return; playTone(440, 0.08, 'triangle', 0.18, 0); playTone(660, 0.1, 'triangle', 0.18, 0.06); },
      score: (pts) => {
        if (!soundOn) return;
        const base = pts >= 16 ? 784 : pts >= 12 ? 659 : pts >= 6 ? 587 : 523;
        playTone(base, 0.12, 'triangle', 0.22, 0);
        playTone(base * 1.25, 0.14, 'triangle', 0.22, 0.09);
        if (pts >= 12) playTone(base * 1.5, 0.28, 'triangle', 0.24, 0.18);
      },
      miss: () => { if (!soundOn) return; playTone(220, 0.14, 'sawtooth', 0.14, 0); playTone(185, 0.22, 'sawtooth', 0.14, 0.12); },
      count: () => { if (!soundOn) return; playTone(880, 0.12, 'sine', 0.2); },
      start: () => { if (!soundOn) return; playTone(523, 0.13, 'sawtooth', 0.15, 0); playTone(659, 0.13, 'sawtooth', 0.15, 0.12); playTone(784, 0.13, 'sawtooth', 0.15, 0.24); playTone(1046, 0.42, 'sawtooth', 0.2, 0.36); },
      swStart: () => { if (!soundOn) return; playTone(988, 0.16, 'triangle', 0.22, 0); playTone(1318, 0.24, 'triangle', 0.22, 0.18); },
      swEnd: () => { if (!soundOn) return; playTone(1318, 0.15, 'triangle', 0.2, 0); playTone(988, 0.22, 'triangle', 0.2, 0.16); },
      tick: () => { if (!soundOn) return; playTone(740, 0.07, 'square', 0.11); },
      end: () => { if (!soundOn) return; playTone(196, 1.0, 'sawtooth', 0.22, 0); playTone(247, 1.0, 'sawtooth', 0.18, 0); },
    };

    // 場地比例：1 單位 = 100 mm（6ft × 8ft ≈ 18 × 24 單位；X: -9..9，Z: -12..12）
    const HW = 9, HL = 12, R = 1.1;
    const COL = {
      red: { hex: 0xef4444, css: '#ef4444', zh: '紅' },
      blue: { hex: 0x2563eb, css: '#3b82f6', zh: '藍' },
      yellow: { hex: 0xeab308, css: '#eab308', zh: '黃' },
    };
    const GOALS = [
      { id: 'floor', name: '地板球門', pts: 1, col: 'blue', x: -6.4, z: -9.6, w: 2.6, d: 2.2, h: 0.45 },
      { id: 'l1', name: 'L1 球門', pts: 3, col: 'red', x: -3.2, z: -9.6, w: 2.4, d: 2.2, h: 1.4 },
      { id: 'l2', name: 'L2 球門', pts: 6, col: 'blue', x: 0, z: -9.6, w: 2.4, d: 2.2, h: 2.4 },
      { id: 'l3', name: 'L3 球門', pts: 12, col: 'red', x: 3.2, z: -9.6, w: 2.4, d: 2.2, h: 3.5 },
      { id: 'l4', name: 'L4 球門(黃)', pts: 16, col: 'yellow', x: 6.4, z: -9.6, w: 2.4, d: 2.2, h: 4.6 },
    ];

    /* ---- 建立 WebGL 場景、光影與材質 ---- */
    const stageWrap = h('div', { style: 'position:relative;width:100%;aspect-ratio:16/9;max-height:540px;border-radius:14px;overflow:hidden;background:#0f172a;touch-action:none;cursor:grab' });
    const popOverlay = h('div', { style: 'position:absolute;inset:0;pointer-events:none;overflow:hidden' });
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    stageWrap.append(renderer.domElement, popOverlay);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 34, 68);

    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.2, 120);

    // 攝影棚等級三點照明＋真實軟陰影
    scene.add(new THREE.HemisphereLight(0xf1f5f9, 0x334155, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(11, 22, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 2; sun.shadow.camera.far = 55;
    sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x93c5fd, 0.35);
    rim.position.set(-14, 12, -14);
    scene.add(rim);

    // 程式化 VEX IQ 地墊紋理（6 × 8 拼裝格紋＋起始線）
    const floorTex = (() => {
      const c = document.createElement('canvas'); c.width = 768; c.height = 1024;
      const g = c.getContext('2d');
      g.fillStyle = '#d5dde8'; g.fillRect(0, 0, c.width, c.height);
      const cols = 6, rows = 8, cw = c.width / cols, ch = c.height / rows;
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < cols; k++) {
          g.fillStyle = (r + k) % 2 === 0 ? '#dce3ec' : '#cfd8e3';
          g.fillRect(k * cw + 2, r * ch + 2, cw - 4, ch - 4);
          g.strokeStyle = '#94a3b8'; g.lineWidth = 2;
          g.strokeRect(k * cw + 1, r * ch + 1, cw - 2, ch - 2);
        }
      }
      // 起始區線條
      g.strokeStyle = '#1e293b'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(0, ch * 6); g.lineTo(c.width, ch * 6); g.stroke();
      g.strokeStyle = 'rgba(37,99,235,.45)'; g.lineWidth = 4; g.setLineDash([12, 10]);
      g.strokeRect(cw * 2, ch * 6.15, cw * 2, ch * 1.7);
      const tex = new THREE.CanvasTexture(c);
      tex.anisotropy = 4;
      return tex;
    })();

    const floorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(HW * 2, 0.35, HL * 2),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.72, metalness: 0.05 })
    );
    floorMesh.position.y = -0.175;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // 場地半透明壓克力圍牆＋金屬感護邊
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.72 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.5 });
    const addWall = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.95, d), wallMat);
      m.position.set(x, 0.475, z); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.1, d + 0.04), railMat);
      top.position.set(x, 0.98, z); scene.add(top);
    };
    addWall(0, -HL - 0.14, HW * 2 + 0.56, 0.28);
    addWall(0, HL + 0.14, HW * 2 + 0.56, 0.28);
    addWall(-HW - 0.14, 0, 0.28, HL * 2);
    addWall(HW + 0.14, 0, 0.28, HL * 2);

    // 產生 3D 標籤 Sprite
    function makeLabelSprite(text, bgCss) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 72;
      const g = c.getContext('2d');
      g.fillStyle = bgCss; g.beginPath(); g.roundRect(6, 6, 244, 60, 16); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
      g.fillStyle = '#fff'; g.font = 'bold 28px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, 128, 37);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
      sp.scale.set(2.4, 0.68, 1);
      return sp;
    }

    // 5 座立體 Level Up 階梯球門（帶四角 VEX 支撐柱、透明背板與彩色計分籃框）
    const postMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.45 });
    GOALS.forEach((g) => {
      const grp = new THREE.Group();
      grp.position.set(g.x, 0, g.z);
      const colMat = new THREE.MeshStandardMaterial({ color: COL[g.col].hex, roughness: 0.32, metalness: 0.15 });
      const trayMat = new THREE.MeshStandardMaterial({ color: COL[g.col].hex, roughness: 0.45, metalness: 0.1, transparent: true, opacity: 0.88 });
      // 四角支撐柱
      if (g.h > 0.5) {
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, g.h, 0.16), postMat);
          post.position.set(sx * (g.w / 2 - 0.12), g.h / 2, sz * (g.d / 2 - 0.12));
          post.castShadow = true; post.receiveShadow = true;
          grp.add(post);
        });
      }
      // 籃底盤與四側護框
      const base = new THREE.Mesh(new THREE.BoxGeometry(g.w, 0.14, g.d), trayMat);
      base.position.y = g.h; base.castShadow = true; base.receiveShadow = true; grp.add(base);
      const rimH = 0.28;
      [[0, -g.d / 2 + 0.06, g.w, 0.12], [0, g.d / 2 - 0.06, g.w, 0.12], [-g.w / 2 + 0.06, 0, 0.12, g.d], [g.w / 2 - 0.06, 0, 0.12, g.d]].forEach(([rx, rz, rw, rd]) => {
        const rm = new THREE.Mesh(new THREE.BoxGeometry(rw, rimH, rd), colMat);
        rm.position.set(rx, g.h + rimH / 2, rz); rm.castShadow = true; grp.add(rm);
      });
      const lbl = makeLabelSprite(g.name + ' ' + g.pts + '分', COL[g.col].css);
      lbl.position.set(0, g.h + 1.05, 0);
      grp.add(lbl);
      scene.add(grp);
    });

    /* ---- 擬真 3D VEX IQ 機器人（輪子會轉、Brain 螢幕發光、手臂夾爪可動）---- */
    const robotGroup = new THREE.Group();
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.45, metalness: 0.35 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.35, metalness: 0.15 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.88, metalness: 0.05 });
    const omniMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.35 });

    // 底盤主體＋側梁
    const chas = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.42, 2.0), bodyMat);
    chas.position.y = 0.48; chas.castShadow = true; chas.receiveShadow = true; robotGroup.add(chas);
    [-0.95, 0.95].forEach((sx) => {
      const bm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 2.15), beamMat);
      bm.position.set(sx, 0.48, 0); bm.castShadow = true; robotGroup.add(bm);
    });
    // 4 顆可旋轉 3D 輪子（後輪若設為全向輪則畫金色滾輪）
    const wheels = [];
    const wGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.24, 20);
    wGeo.rotateZ(Math.PI / 2);
    [[-1.1, -0.68, false], [1.1, -0.68, false], [-1.1, 0.68, true], [1.1, 0.68, true]].forEach(([wx, wz, isRear]) => {
      const mat = isRear && rcfg && rcfg.wheel === 'omni' ? omniMat : rubberMat;
      const wMesh = new THREE.Mesh(wGeo, mat);
      wMesh.position.set(wx, 0.42, wz); wMesh.castShadow = true;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.26, 12).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 }));
      wMesh.add(hub);
      robotGroup.add(wMesh);
      wheels.push(wMesh);
    });
    // VEX IQ Brain Gen 2（帶發光藍螢幕與綠燈）
    const brain = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.36, 0.95), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.2 }));
    brain.position.set(0, 0.88, 0.25); brain.castShadow = true; robotGroup.add(brain);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.46), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    scr.rotation.x = -Math.PI / 2; scr.position.set(0, 1.07, 0.25); robotGroup.add(scr);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    led.position.set(0.42, 1.07, 0.56); robotGroup.add(led);

    // 車頭感測器模組（依 robotCfg 顯示）
    if (rcfg && Array.isArray(rcfg.sensors)) {
      if (rcfg.sensors.includes('bumper')) {
        const bp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.16), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 }));
        bp.position.set(0, 0.42, -1.12); robotGroup.add(bp);
      }
      if (rcfg.sensors.includes('dist')) {
        const ds = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.26, 0.2), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.25 }));
        ds.position.set(0, 0.72, -1.0); robotGroup.add(ds);
      }
      if (rcfg.sensors.includes('color')) {
        const cs = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0x9333ea, emissive: 0x581c87 }));
        cs.position.set(0, 0.24, -0.82); robotGroup.add(cs);
      }
    }

    // 可動 3D 舉重手臂＋雙指夾爪（樞軸在車身前上方）
    const armPivot = new THREE.Group();
    armPivot.position.set(0, 0.72, -0.45);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35, metalness: 0.2 });
    [-0.52, 0.52].forEach((sx) => {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 1.45), armMat);
      a.position.set(sx, 0, -0.68); a.castShadow = true; armPivot.add(a);
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.48), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 }));
      finger.position.set(sx * 0.85, -0.05, -1.48); finger.castShadow = true; armPivot.add(finger);
    });
    const cross = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.14, 0.16), beamMat);
    cross.position.set(0, 0, -1.25); armPivot.add(cross);
    robotGroup.add(armPivot);
    scene.add(robotGroup);

    // 14 顆立體軟質沙包 Mesh
    const bagGeo = new THREE.SphereGeometry(0.46, 16, 12);
    bagGeo.scale(1.05, 0.62, 1.05);
    const bagMats = {
      red: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.82, metalness: 0.02 }),
      blue: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.82, metalness: 0.02 }),
      yellow: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.75, metalness: 0.05 }),
    };

    let bot, bags, flying, score, scoredLog;
    let camMode = 'orbit', yaw = -0.48, pitch = 0.62, camDist = 24;
    let matchState = 'free', preSec = 0, leftMs = 60000, endAt = 0, sw1 = false, sw2 = false, lastTick = 61, matchIv = 0;
    const keys = { f: 0, b: 0, l: 0, r: 0 };

    const bagInit = [
      ['yellow', -5.0, 2.6], ['yellow', 0, 2.2], ['yellow', 5.0, 2.6], ['yellow', -3.2, -2.2], ['yellow', 3.2, -2.2], ['yellow', 0, -4.2],
      ['red', -6.4, 5.8], ['red', -2.4, 4.8], ['red', 2.4, -0.5], ['red', 6.2, -3.8],
      ['blue', 6.4, 5.8], ['blue', 2.4, 4.8], ['blue', -2.4, -0.5], ['blue', -6.2, -3.8],
    ];
    bags = bagInit.map(([col, x, z], i) => {
      const m = new THREE.Mesh(bagGeo, bagMats[col]);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
      return { id: i + 1, col, ix: x, iz: z, x, y: 0.28, z, goal: null, mesh: m };
    });

    function spawnPopup(worldPos, text, ok) {
      const v = worldPos.clone().project(camera);
      const x = (v.x * 0.5 + 0.5) * stageWrap.clientWidth;
      const y = (-v.y * 0.5 + 0.5) * stageWrap.clientHeight;
      const el = h('div', { style: `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);font-size:1.35rem;font-weight:900;color:${ok ? '#4ade80' : '#f87171'};text-shadow:0 2px 8px rgba(0,0,0,.75);transition:transform .9s ease-out,opacity .9s ease-out;white-space:nowrap` }, text);
      popOverlay.append(el);
      requestAnimationFrame(() => { el.style.transform = 'translate(-50%, -140%)'; el.style.opacity = '0'; });
      setTimeout(() => el.remove(), 950);
    }

    const scoreEl = h('span', { style: 'font-size:1.55rem;font-weight:900;color:#22c55e' }, '0 分');
    const timerEl = h('span', { style: 'font-size:1.35rem;font-weight:800;font-family:ui-monospace,monospace' }, '自由練習');
    const phaseEl = h('span', { class: 'sub' }, '拖曳旋轉 3D 場地 · 滾輪／按鈕縮放 · 開過去撿沙包投進 L1～L4！');
    const actBtn = h('button', { type: 'button', class: 'btn primary', style: 'min-width:150px;font-weight:800', onclick: () => doAction() }, '🤏 抓取沙包');
    const matchBtn = h('button', { type: 'button', class: 'btn green sm', onclick: () => start60s() }, '🚨 開始 60 秒比賽');
    const saveBtn = h('button', { type: 'button', class: 'btn primary sm', onclick: () => saveScore() }, '💾 存入技能賽紀錄');

    function resetField() {
      bot = { x: 0, z: 7.8, th: 0, armAngle: 0, carry: null }; // th=0 朝向 -Z（球門方向）
      bags.forEach((b) => { b.x = b.ix; b.z = b.iz; b.y = 0.28; b.goal = null; b.mesh.position.set(b.x, b.y, b.z); });
      flying = [];
      score = 0;
      scoredLog = { floor: 0, l1: 0, l2: 0, l3: 0, l4: 0 };
      updateHud();
    }

    function nearestBag() {
      let best = null, bd = 2.2;
      for (const b of bags) {
        if (b.goal || b === bot.carry) continue;
        const d = Math.hypot(b.x - bot.x, b.z - bot.z);
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    }
    function nearestGoal() {
      let best = null, bd = 3.5;
      for (const g of GOALS) {
        const d = Math.hypot(g.x - bot.x, (g.z + g.d / 2) - bot.z);
        if (d < bd) { bd = d; best = g; }
      }
      return best;
    }

    function updateHud() {
      scoreEl.textContent = score + ' 分';
      if (matchState === 'free') timerEl.textContent = '自由練習';
      else if (matchState === 'pre') timerEl.textContent = '倒數 ' + preSec;
      else if (matchState === 'done') timerEl.textContent = '00:00 結束';
      else timerEl.textContent = '00:' + String(Math.max(0, Math.ceil(leftMs / 1000))).padStart(2, '0');
      if (bot.carry) {
        const g = nearestGoal();
        actBtn.textContent = g ? ('🚀 投入 ' + g.name + '（' + g.pts + '分）') : '📦 放下沙包';
        actBtn.className = 'btn ' + (g ? 'green' : 'primary');
      } else {
        const b = nearestBag();
        actBtn.textContent = b ? ('🤏 抓取' + COL[b.col].zh + '色沙包') : '🤏 靠近沙包抓取';
        actBtn.className = 'btn ' + (b ? 'primary' : '');
      }
    }

    function doAction() {
      if (matchState === 'pre' || matchState === 'done') return;
      if (!bot.carry) {
        const b = nearestBag();
        if (!b) return toast('開近一點到沙包旁邊才能抓喔！');
        bot.carry = b; sfx.grab(); updateHud(); return;
      }
      const b = bot.carry; const g = nearestGoal(); bot.carry = null;
      if (!g) {
        b.x = bot.x - Math.sin(bot.th) * 1.5; b.z = bot.z - Math.cos(bot.th) * 1.5; b.y = 0.28;
        b.mesh.position.set(b.x, b.y, b.z); updateHud(); return;
      }
      const inG = bags.filter((x) => x.goal === g.id).length;
      const tx = g.x + ((inG % 3) - 1) * 0.58;
      const tz = g.z + (Math.floor(inG / 3) - 0.3) * 0.52;
      const ty = g.h + 0.36;
      flying.push({ bag: b, sx: b.mesh.position.x, sy: b.mesh.position.y, sz: b.mesh.position.z, tx, ty, tz, t: 0, goal: g });
      bot.armAngle = 0.9;
      updateHud();
    }

    function start60s() {
      clearInterval(matchIv); resetField();
      matchState = 'pre'; preSec = 3; leftMs = 60000; sw1 = false; sw2 = false; lastTick = 61;
      sfx.count(); phaseEl.textContent = '3-2-1 準備出發！'; updateHud();
      matchIv = setInterval(() => {
        if (!document.body.contains(stageWrap)) { clearInterval(matchIv); matchIv = 0; return; }
        if (matchState === 'pre') {
          preSec--;
          if (preSec > 0) { sfx.count(); phaseEl.textContent = '準備出發… ' + preSec; updateHud(); }
          else { matchState = 'run'; endAt = Date.now() + 60000; sfx.start(); phaseEl.textContent = '🏁 比賽開始！60 秒盡量得分！'; updateHud(); }
          return;
        }
        if (matchState === 'run') {
          leftMs = Math.max(0, endAt - Date.now());
          const s = Math.ceil(leftMs / 1000);
          if (s <= 35 && !sw1) { sw1 = true; sfx.swStart(); phaseEl.textContent = '🔄 換手時間（35s～25s）！'; }
          if (s <= 25 && !sw2) { sw2 = true; sfx.swEnd(); phaseEl.textContent = '⚡ 下半場衝刺！'; }
          if (s <= 10 && s >= 1 && s < lastTick) { lastTick = s; sfx.tick(); phaseEl.textContent = '🔥 最後 ' + s + ' 秒！'; }
          if (leftMs <= 0) {
            clearInterval(matchIv); matchIv = 0; matchState = 'done';
            sfx.end(); phaseEl.textContent = '🏁 時間到！本場得分 ' + score + ' 分！';
            if (window.VXFX && score > 0) window.VXFX.confetti();
          }
          updateHud();
        }
      }, 100);
    }

    async function saveScore() {
      const detail = GOALS.map((g) => (scoredLog[g.id] ? g.name + '×' + scoredLog[g.id] : '')).filter(Boolean).join('、') || '無進球';
      try {
        await api('/api/notes', {
          kind: 'skills',
          title: '3D 練習場 ' + score + ' 分',
          data: { f: { type: '手動駕駛', score: String(score), note: '3D Level Up 練習場：' + detail, date: VX.todayStr() }, c: [] },
        });
        if (VX.act) VX.act('note');
        VX.saveState();
        toast('已將 3D 練習場 ' + score + ' 分存入技能賽紀錄 ✔');
      } catch (e) { toast(e.message || '儲存失敗'); }
    }

    // 觸控／滑鼠旋轉與縮放 3D 鏡頭
    let drag = null;
    stageWrap.addEventListener('pointerdown', (e) => { if (camMode !== 'orbit') return; drag = { x: e.clientX, y: e.clientY, yaw, pitch }; stageWrap.setPointerCapture(e.pointerId); });
    stageWrap.addEventListener('pointermove', (e) => {
      if (!drag) return;
      yaw = drag.yaw - (e.clientX - drag.x) * 0.008;
      pitch = Math.max(0.22, Math.min(1.38, drag.pitch + (e.clientY - drag.y) * 0.006));
    });
    stageWrap.addEventListener('pointerup', () => { drag = null; });
    stageWrap.addEventListener('wheel', (e) => { e.preventDefault(); camDist = Math.max(12, Math.min(38, camDist + e.deltaY * 0.015)); }, { passive: false });

    const onKey = (down) => (e) => {
      if (!document.body.contains(stageWrap)) { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); return; }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement || {}).tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') { keys.f = down ? 1 : 0; e.preventDefault(); }
      else if (k === 'arrowdown' || k === 's') { keys.b = down ? 1 : 0; e.preventDefault(); }
      else if (k === 'arrowleft' || k === 'a') { keys.l = down ? 1 : 0; e.preventDefault(); }
      else if (k === 'arrowright' || k === 'd') { keys.r = down ? 1 : 0; e.preventDefault(); }
      else if (down && (k === ' ' || k === 'e')) { e.preventDefault(); doAction(); }
    };
    const kd = onKey(true), ku = onKey(false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    const padBtn = (label, keyName) => {
      const b = h('button', { type: 'button', class: 'btn', style: 'min-width:68px;padding:12px 10px;font-weight:700;user-select:none;-webkit-user-select:none' }, label);
      const dn = (e) => { e.preventDefault(); keys[keyName] = 1; };
      const up = () => { keys[keyName] = 0; };
      b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
      return b;
    };

    const camBtn = h('button', { type: 'button', class: 'btn sm', onclick: () => { camMode = camMode === 'orbit' ? 'chase' : 'orbit'; camBtn.textContent = camMode === 'orbit' ? '🏎️ 切換車尾視角' : '🎥 切換上帝視角'; } }, '🏎️ 切換車尾視角');
    const sndBtn = h('button', { type: 'button', class: 'btn sm', onclick: () => { soundOn = !soundOn; sndBtn.textContent = soundOn ? '🔊 音效：開' : '🔇 音效：關'; } }, '🔊 音效：開');

    resetField();
    VX.app.replaceChildren(shell(h('div', null,
      h('div', { class: 'panel' },
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px' },
          h('div', null, h('h2', { style: 'margin:0' }, '🏟️ 3D Level Up 模擬練習場（WebGL 光影版）'), phaseEl),
          h('div', { class: 'row gap', style: 'align-items:center' }, timerEl, scoreEl)),
        h('div', { class: 'row gap', style: 'margin-bottom:8px;align-items:center' },
          matchBtn,
          h('button', { type: 'button', class: 'btn sm', onclick: () => { clearInterval(matchIv); matchIv = 0; matchState = 'free'; resetField(); phaseEl.textContent = '自由練習模式：盡情試開與投球！'; } }, '↺ 重置場地'),
          camBtn,
          h('button', { type: 'button', class: 'btn sm', onclick: () => { camDist = Math.max(12, camDist - 3); } }, '＋'),
          h('button', { type: 'button', class: 'btn sm', onclick: () => { camDist = Math.min(38, camDist + 3); } }, '－'),
          sndBtn, saveBtn,
          h('span', { class: 'sub' }, '目前車輛：' + (rcfg ? rcfg.label : '標準底盤車') + (rcfg && rcfg.gear ? ' (' + rcfg.gear + ')' : ''))),
        stageWrap,
        h('div', { class: 'row gap', style: 'justify-content:center;align-items:center;margin-top:12px;flex-wrap:wrap' },
          padBtn('◀ 左轉', 'l'), padBtn('▲ 前進', 'f'), padBtn('▼ 後退', 'b'), padBtn('▶ 右轉', 'r'), actBtn),
        h('p', { class: 'sub', style: 'text-align:center;margin-top:8px' }, '電腦可用鍵盤 WASD／方向鍵駕駛、空白鍵抓取與投球；iPad 可直接按按鈕操作、手指拖曳旋轉 3D 場地！'))), { title: '3D 練習場', icon: '🏟️' }));

    let rafId = 0, lastW = 0, lastH = 0;
    function animate() {
      if (!document.body.contains(stageWrap)) { cancelAnimationFrame(rafId); clearInterval(matchIv); renderer.dispose(); return; }
      const cw = stageWrap.clientWidth || 800, ch = stageWrap.clientHeight || 450;
      if (cw !== lastW || ch !== lastH) { lastW = cw; lastH = ch; renderer.setSize(cw, ch, false); camera.aspect = cw / ch; camera.updateProjectionMatrix(); }

      if (matchState !== 'pre' && matchState !== 'done') {
        const turn = (keys.l - keys.r) * 0.052 * turnMul;
        const spd = (keys.f - keys.b) * 0.14 * gearMul;
        if (turn) bot.th += turn;
        if (spd) {
          bot.x = Math.max(-HW + R, Math.min(HW - R, bot.x - Math.sin(bot.th) * spd));
          bot.z = Math.max(-HL + 2.4 + R, Math.min(HL - R, bot.z - Math.cos(bot.th) * spd));
          wheels.forEach((w) => { w.rotation.x -= spd * 2.2; });
        }
      }
      const targetArm = bot.carry ? 0.55 : 0.0;
      bot.armAngle += (targetArm - bot.armAngle) * 0.14;

      robotGroup.position.set(bot.x, 0, bot.z);
      robotGroup.rotation.y = bot.th;
      armPivot.rotation.x = bot.armAngle;

      if (bot.carry) {
        const liftY = 0.72 + Math.sin(bot.armAngle) * 1.45;
        const reach = 0.45 + Math.cos(bot.armAngle) * 1.45;
        bot.carry.mesh.position.set(bot.x - Math.sin(bot.th) * reach, liftY, bot.z - Math.cos(bot.th) * reach);
      }

      for (let i = flying.length - 1; i >= 0; i--) {
        const fl = flying[i];
        fl.t += 0.065;
        if (fl.t >= 1) {
          fl.bag.x = fl.tx; fl.bag.y = fl.ty; fl.bag.z = fl.tz; fl.bag.goal = fl.goal.id;
          fl.bag.mesh.position.set(fl.tx, fl.ty, fl.tz);
          const valid = fl.goal.col === 'yellow' ? fl.bag.col === 'yellow' : (fl.bag.col === fl.goal.col || fl.bag.col === 'yellow');
          if (valid) {
            score += fl.goal.pts; scoredLog[fl.goal.id]++; sfx.score(fl.goal.pts);
            spawnPopup(new THREE.Vector3(fl.tx, fl.ty + 0.8, fl.tz), '+' + fl.goal.pts + ' 分！', true);
          } else {
            sfx.miss();
            spawnPopup(new THREE.Vector3(fl.tx, fl.ty + 0.8, fl.tz), '錯色 0 分', false);
            toast(fl.goal.col === 'yellow' ? 'L4 球門只收黃色沙包喔！' : ('這個球門只收' + COL[fl.goal.col].zh + '色或黃色沙包！'));
          }
          flying.splice(i, 1); updateHud();
        } else {
          const arc = Math.sin(fl.t * Math.PI) * 2.8;
          fl.bag.mesh.position.set(fl.sx + (fl.tx - fl.sx) * fl.t, fl.sy + (fl.ty - fl.sy) * fl.t + arc, fl.sz + (fl.tz - fl.sz) * fl.t);
        }
      }

      if (camMode === 'chase') {
        const backX = bot.x + Math.sin(bot.th) * 9.5;
        const backZ = bot.z + Math.cos(bot.th) * 9.5;
        camera.position.lerp(new THREE.Vector3(backX, 6.2, backZ), 0.12);
        camera.lookAt(bot.x - Math.sin(bot.th) * 4, 1.4, bot.z - Math.cos(bot.th) * 4);
      } else {
        const cx = Math.sin(yaw) * Math.cos(pitch) * camDist;
        const cy = Math.sin(pitch) * camDist;
        const cz = Math.cos(yaw) * Math.cos(pitch) * camDist;
        camera.position.set(cx, cy, cz);
        camera.lookAt(0, 1.0, -1.0);
      }

      if (keys.f || keys.b || keys.l || keys.r) updateHud();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    }
    rafId = requestAnimationFrame(animate);
  }

  VX.routes.arena3d = () => viewArena3D();
})();
