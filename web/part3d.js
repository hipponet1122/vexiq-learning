/* VEX IQ 3D 零件檢視器（Three.js + GLTFLoader）：
   優先載入 web/models/<id>.glb 原廠 CAD 模型；支援多零件套件組合、
   依模型明暗自動切換高對比攝影棚背景、360° 觸控／滑鼠旋轉與縮放。 */
(function () {
  'use strict';
  const VX = window.VX;
  if (!VX) return;

  let enginePromise = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = src;
      sc.onload = resolve;
      sc.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.append(sc);
    });
  }
  function loadEngine() {
    if (window.THREE && window.THREE.GLTFLoader) return Promise.resolve(window.THREE);
    if (!enginePromise) {
      enginePromise = (window.THREE ? Promise.resolve() : loadScript('vendor/three.min.js'))
        .then(() => (window.THREE && window.THREE.GLTFLoader ? Promise.resolve() : loadScript('vendor/GLTFLoader.js')))
        .then(() => {
          if (!window.THREE || !window.THREE.GLTFLoader) throw new Error('3D engine unavailable');
          return window.THREE;
        });
    }
    return enginePromise;
  }

  // 套件展示：用多顆真實原廠 CAD .glb 零件組成 3D 套件陳列台
  const KIT_LAYOUTS = {
    kit_edu: [
      { id: 'brain', pos: [-1.05, 0.1, -0.35], scale: 0.72, rot: [0, 0.35, 0] },
      { id: 'controller', pos: [1.05, 0.1, -0.25], scale: 0.72, rot: [0, -0.35, 0] },
      { id: 'motor', pos: [-0.95, -0.25, 0.95], scale: 0.45, rot: [0, 0.5, 0] },
      { id: 'distance', pos: [0.0, -0.25, 0.95], scale: 0.42, rot: [0, 0, 0] },
      { id: 'gear', pos: [0.95, -0.2, 0.95], scale: 0.45, rot: [0.3, 0, 0] },
    ],
    kit_comp: [
      { id: 'motor', pos: [-1.15, 0.15, -0.2], scale: 0.52, rot: [0, 0.4, 0] },
      { id: 'wheel', pos: [0.0, 0.15, -0.35], scale: 0.62, rot: [0, 0.3, 0] },
      { id: 'sprocket', pos: [1.15, 0.1, -0.15], scale: 0.52, rot: [0.2, -0.4, 0] },
      { id: 'gear', pos: [-0.65, -0.25, 0.95], scale: 0.48, rot: [0.3, 0, 0] },
      { id: 'rubberband', pos: [0.65, -0.25, 0.95], scale: 0.48, rot: [0.4, 0.2, 0] },
    ],
    kit_addons: [
      { id: 'smartcable', pos: [-1.05, 0.0, 0.1], scale: 0.55, rot: [0, 0.4, 0] },
      { id: 'rubberband', pos: [0.0, 0.05, -0.2], scale: 0.55, rot: [0.3, 0, 0] },
      { id: 'shaft', pos: [0.95, 0.0, 0.15], scale: 0.55, rot: [0, -0.3, 0.35] },
      { id: 'standoff', pos: [0.0, -0.25, 0.85], scale: 0.42, rot: [0, 0.5, 0] },
    ],
  };

  // 共用相近外觀的官方 CAD（直到未來補入專屬 .glb）
  const MODEL_ALIAS = {
    optical: 'color',
    vision: 'distance',
    usbc: 'smartcable',
    pneumatic: 'motor',
  };

  // 計算 3D 模型平均明度（0=純黑, 1=純白），用來自動挑選最高對比背景
  function estimateLuminance(THREE, obj) {
    let sum = 0, count = 0;
    obj.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if (m && m.color) {
          const lum = 0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b;
          sum += lum; count++;
        }
      });
    });
    return count ? sum / count : 0.35;
  }

  // 建立高解析度 VEX IQ Brain 液晶螢幕貼圖（仿真實 LCD 介面與玻璃反光）
  function makeBrainLcdMesh(THREE) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 320;
    const ctx = cv.getContext('2d');
    // 螢幕底色（真實微灰白高對比 LCD）
    ctx.fillStyle = '#e8eef2';
    ctx.fillRect(0, 0, 512, 320);
    // 頂部狀態列
    ctx.fillStyle = '#cfd8e0';
    ctx.fillRect(0, 0, 512, 54);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Home', 20, 38);
    // 訊號條 + 電量 100%
    ctx.fillStyle = '#1e293b';
    [0, 1, 2, 3].forEach((i) => ctx.fillRect(322 + i * 10, 34 - i * 5, 6, 10 + i * 5));
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3;
    ctx.strokeRect(374, 16, 44, 24);
    ctx.fillStyle = '#16a34a'; ctx.fillRect(378, 20, 36, 16);
    ctx.fillStyle = '#1e293b'; ctx.font = 'bold 22px sans-serif';
    ctx.fillText('100%', 428, 36);
    // 中間三個圖示方塊（Drive / Programs / Settings）
    // 1. 選中的 Drive（深底＋藍色遙控器）
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(24, 78, 146, 152);
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(52, 122, 90, 50, 18) : ctx.rect(52, 122, 90, 50); ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.arc(76, 147, 9, 0, Math.PI * 2); ctx.arc(118, 147, 9, 0, Math.PI * 2); ctx.fill();
    // 2. Programs
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 5;
    ctx.strokeRect(184, 78, 144, 152);
    ctx.fillStyle = '#334155';
    ctx.fillRect(216, 118, 80, 12); ctx.fillRect(216, 144, 62, 12); ctx.fillRect(216, 170, 74, 12);
    // 3. Devices
    ctx.strokeRect(342, 78, 146, 152);
    ctx.fillStyle = '#334155';
    ctx.fillRect(386, 114, 58, 66);
    // 底部選中標籤列
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 250, 512, 70);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Drive', 256, 297);
    // 淡淡的玻璃對角反光
    const grad = ctx.createLinearGradient(0, 0, 512, 320);
    grad.addColorStop(0, 'rgba(255,255,255,0.22)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.0)');
    grad.addColorStop(1, 'rgba(15,23,42,0.08)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 320);

    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const mat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.16, metalness: 0.08,
      emissive: new THREE.Color(0xffffff), emissiveMap: tex, emissiveIntensity: 0.28,
    });
    const grp = new THREE.Group();
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.6), mat);
    screen.rotation.x = -Math.PI / 2;
    screen.position.set(-0.04, 0.458, -0.03);
    grp.add(screen);
    // 綠色電源／連線狀態燈
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.015, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.9, roughness: 0.2 })
    );
    led.position.set(0.64, 0.458, -0.03);
    grp.add(led);
    return grp;
  }

  function enhanceMaterials(THREE, obj, modelId) {
    obj.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const nm = (child.name || '').toLowerCase();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if (!m) return;
        // 依真實 VEX IQ 實拍外觀校正原廠 STEP 單色黑塊材質
        if (modelId === 'brain' && m.color) {
          if (nm.includes('228-2540-001')) m.color.setHex(0x5b636c);       // 上蓋：霧面深灰
          else if (nm.includes('228-2540-002')) m.color.setHex(0xc8cfd6);  // 中框：淺銀灰
          else if (nm.includes('228-2621')) m.color.setHex(0x0284c7);      // Smart Radio：原廠藍
          else if (nm.includes('228-2604')) m.color.setHex(0x343a42);      // 底部電池座：炭灰
          else if (nm.includes('901')) m.color.setHex(0x1f252c);           // 12 埠插槽：深黑灰
        } else if (modelId === 'controller' && m.color) {
          if (nm === '228-2530') m.color.setHex(0x525b66);                 // 主殼：霧面中深灰
          else if (nm === '228-2530_1') m.color.setHex(0x1c2128);          // 搖桿與按鍵：黑橡膠
          else if (nm === '228-2530_2') m.color.setHex(0x9aa4b0);          // 飾條：銀灰
          else if (nm === '228-2530_4') { m.color.setHex(0x22c55e); m.emissive = new THREE.Color(0x16a34a); m.emissiveIntensity = 0.7; }
        } else if (modelId === 'motor' && m.color) {
          if (nm.includes('228-2560-001')) m.color.setHex(0x505862);       // 馬達本體：霧面灰
          else if (nm.includes('228-2560-002')) m.color.setHex(0xc4ccd4);  // 齒輪蓋：淺銀灰
          else if (nm.includes('228-2560-003')) m.color.setHex(0x2c323b);  // 固定法蘭：炭灰
        }
        if (typeof m.roughness === 'number') m.roughness = Math.min(0.72, Math.max(0.28, m.roughness));
        if (typeof m.metalness === 'number') m.metalness = Math.min(0.45, m.metalness);
      });
    });
    if (modelId === 'brain') obj.add(makeBrainLcdMesh(THREE));
  }

  function mount(hostEl, initialId) {
    let curId = initialId || 'brain';
    let renderer = null, scene = null, camera = null, rootGroup = null, gridHelper = null;
    let yaw = 0.65, pitch = 0.42, dist = 4.2, autoSpin = true;
    let bgMode = 'auto'; // 'auto' | 'light' | 'dark'
    let lastLum = 0.35;
    let rafId = 0, alive = true, ready = false, reqSeq = 0;
    const glbCache = new Map();

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'part3d-canvas bg-light';
    const status = document.createElement('div');
    status.className = 'part3d-loading';
    status.textContent = '3D CAD…';
    canvasWrap.append(status);
    hostEl.replaceChildren(canvasWrap);

    function applyBackground(lum) {
      lastLum = lum;
      let theme;
      if (bgMode === 'light') theme = 'light';
      else if (bgMode === 'dark') theme = 'dark';
      else theme = lum < 0.48 ? 'light' : lum > 0.68 ? 'dark' : 'mid';
      canvasWrap.classList.remove('bg-light', 'bg-mid', 'bg-dark');
      canvasWrap.classList.add('bg-' + theme);
      if (gridHelper && gridHelper.material) {
        gridHelper.material.opacity = theme === 'dark' ? 0.24 : 0.16;
      }
    }

    function loadGlb(loader, modelId) {
      if (glbCache.has(modelId)) {
        return glbCache.get(modelId).then((orig) => orig.clone(true));
      }
      const p = new Promise((resolve, reject) => {
        loader.load(
          'models/' + modelId + '.glb',
          (gltf) => {
            const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
            if (!root) return reject(new Error('empty glb'));
            enhanceMaterials(window.THREE, root, modelId);
            resolve(root);
          },
          undefined,
          reject
        );
      });
      glbCache.set(modelId, p);
      return p.then((orig) => orig.clone(true));
    }

    function updateCam() {
      if (!camera) return;
      pitch = Math.max(-1.2, Math.min(1.25, pitch));
      dist = Math.max(2.2, Math.min(8.5, dist));
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist + 0.15,
        Math.cos(yaw) * Math.cos(pitch) * dist
      );
      camera.lookAt(0, 0, 0);
    }

    let loader = null;
    async function setPart(id) {
      curId = id;
      if (!ready || !window.THREE || !loader) return;
      const mySeq = ++reqSeq;
      status.style.display = 'grid';
      status.textContent = 'Loading CAD…';
      try {
        const THREE = window.THREE;
        let nextObj;
        if (KIT_LAYOUTS[id]) {
          const kitGroup = new THREE.Group();
          const items = KIT_LAYOUTS[id];
          const loaded = await Promise.all(items.map((it) => loadGlb(loader, it.id).catch(() => null)));
          loaded.forEach((m, i) => {
            if (!m) return;
            const cfg = items[i];
            m.scale.setScalar(cfg.scale);
            m.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
            m.rotation.set(cfg.rot[0], cfg.rot[1], cfg.rot[2]);
            kitGroup.add(m);
          });
          nextObj = kitGroup;
        } else {
          const targetId = MODEL_ALIAS[id] || id;
          nextObj = await loadGlb(loader, targetId);
        }
        if (!alive || mySeq !== reqSeq) return;
        if (rootGroup) scene.remove(rootGroup);
        rootGroup = nextObj;
        scene.add(rootGroup);
        applyBackground(estimateLuminance(THREE, rootGroup));
        status.style.display = 'none';
      } catch (err) {
        if (!alive || mySeq !== reqSeq) return;
        status.style.display = 'grid';
        status.textContent = 'CAD model unavailable';
      }
    }

    loadEngine().then((THREE) => {
      if (!alive || !document.body.contains(canvasWrap)) return;
      loader = new THREE.GLTFLoader();
      const w = Math.max(260, canvasWrap.clientWidth || 480);
      const h2 = Math.max(260, canvasWrap.clientHeight || 320);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h2);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = true;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.touchAction = 'none';
      canvasWrap.prepend(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(38, w / h2, 0.1, 60);
      updateCam();

      // 三點攝影棚打光（讓黑色塑膠與淺灰零件的邊緣折線都清晰立體）
      scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 1.1));
      const key = new THREE.DirectionalLight(0xffffff, 1.15);
      key.position.set(5, 8, 6);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xe0f2fe, 0.65);
      fill.position.set(-6, 4, 4);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffffff, 0.75);
      rim.position.set(0, 5, -7);
      scene.add(rim);

      gridHelper = new THREE.GridHelper(6, 12, 0x64748b, 0x94a3b8);
      gridHelper.position.y = -1.35;
      gridHelper.material.opacity = 0.16;
      gridHelper.material.transparent = true;
      scene.add(gridHelper);

      ready = true;
      setPart(curId);

      let dragging = false, lx = 0, ly = 0;
      const dom = renderer.domElement;
      dom.addEventListener('pointerdown', (e) => {
        dragging = true; lx = e.clientX; ly = e.clientY;
        try { dom.setPointerCapture(e.pointerId); } catch (err) {}
      });
      dom.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        yaw -= (e.clientX - lx) * 0.011;
        pitch += (e.clientY - ly) * 0.009;
        lx = e.clientX; ly = e.clientY;
        updateCam();
      });
      const stopDrag = () => { dragging = false; };
      dom.addEventListener('pointerup', stopDrag);
      dom.addEventListener('pointercancel', stopDrag);
      dom.addEventListener('wheel', (e) => {
        e.preventDefault();
        dist += e.deltaY * 0.003;
        updateCam();
      }, { passive: false });

      const ro = new ResizeObserver(() => {
        if (!alive || !renderer) return;
        const nw = canvasWrap.clientWidth, nh = canvasWrap.clientHeight;
        if (nw > 40 && nh > 40) {
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh);
        }
      });
      ro.observe(canvasWrap);

      const tick = () => {
        if (!alive || !document.body.contains(dom)) {
          alive = false;
          ro.disconnect();
          try { renderer.dispose(); } catch (err) {}
          return;
        }
        if (autoSpin && !dragging) { yaw += 0.0055; updateCam(); }
        renderer.render(scene, camera);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }).catch(() => {
      status.textContent = 'WebGL 3D unavailable';
    });

    return {
      setPart,
      zoomIn: () => { dist -= 0.6; updateCam(); },
      zoomOut: () => { dist += 0.6; updateCam(); },
      reset: () => { yaw = 0.65; pitch = 0.42; dist = 4.2; updateCam(); },
      toggleAuto: () => { autoSpin = !autoSpin; return autoSpin; },
      cycleBg: () => {
        bgMode = bgMode === 'auto' ? 'light' : bgMode === 'light' ? 'dark' : 'auto';
        applyBackground(lastLum);
        return bgMode;
      },
      destroy: () => { alive = false; cancelAnimationFrame(rafId); if (renderer) try { renderer.dispose(); } catch (err) {} },
    };
  }

  VX.part3d = { mount };
})();
