// ─── Main game loop ─────────────────────────────────────────────────────
(function() {
  // ─── Three.js setup ─────────────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 80, 180);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 500);
  scene.add(camera);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.0);
  sunLight.position.set(100, 200, 100);
  scene.add(sunLight);

  function makeCloudShape(seed) {
    const cells = [];
    const width = 24;
    const depth = 16;
    const centerX = (width - 1) * 0.5;
    const centerZ = (depth - 1) * 0.5;

    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - centerX) / (width * 0.5);
        const dz = (z - centerZ) / (depth * 0.5);
        const radial = dx * dx + dz * dz;
        const wave = Math.sin((x + seed * 1.7) * 0.55) * 0.13 + Math.cos((z + seed * 2.3) * 0.6) * 0.12;
        if (radial + wave < 0.9) cells.push([x, z]);
      }
    }

    return { cells, width, depth };
  }

  function createBlockCloud(seed) {
    const voxelSize = 5;
    const halfX = voxelSize * 0.5;
    const halfY = 0.6;
    const halfZ = voxelSize * 0.5;
    const shape = makeCloudShape(seed);
    const occupied = new Set(shape.cells.map(([x, z]) => `${x},${z}`));

    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const UV = [[0, 1], [1, 1], [1, 0], [0, 0]];

    const addQuad = (verts, normal) => {
      const base = positions.length / 3;
      for (const [vx, vy, vz] of verts) positions.push(vx, vy, vz);
      for (let i = 0; i < 4; i++) normals.push(normal[0], normal[1], normal[2]);
      for (const [u, v] of UV) uvs.push(u, v);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    const hasCell = (x, z) => occupied.has(`${x},${z}`);

    for (const [x, z] of shape.cells) {
      const cx = (x - shape.width * 0.5) * voxelSize;
      const cy = 0;
      const cz = (z - shape.depth * 0.5) * voxelSize;

      // Top face.
      addQuad([
        [cx - halfX, cy + halfY, cz - halfZ],
        [cx + halfX, cy + halfY, cz - halfZ],
        [cx + halfX, cy + halfY, cz + halfZ],
        [cx - halfX, cy + halfY, cz + halfZ],
      ], [0, 1, 0]);

      // Bottom face.
      addQuad([
        [cx - halfX, cy - halfY, cz + halfZ],
        [cx + halfX, cy - halfY, cz + halfZ],
        [cx + halfX, cy - halfY, cz - halfZ],
        [cx - halfX, cy - halfY, cz - halfZ],
      ], [0, -1, 0]);

      // Side faces only where neighboring cloud cell does not exist.
      if (!hasCell(x, z - 1)) {
        addQuad([
          [cx + halfX, cy + halfY, cz - halfZ],
          [cx - halfX, cy + halfY, cz - halfZ],
          [cx - halfX, cy - halfY, cz - halfZ],
          [cx + halfX, cy - halfY, cz - halfZ],
        ], [0, 0, -1]);
      }
      if (!hasCell(x, z + 1)) {
        addQuad([
          [cx - halfX, cy + halfY, cz + halfZ],
          [cx + halfX, cy + halfY, cz + halfZ],
          [cx + halfX, cy - halfY, cz + halfZ],
          [cx - halfX, cy - halfY, cz + halfZ],
        ], [0, 0, 1]);
      }
      if (!hasCell(x - 1, z)) {
        addQuad([
          [cx - halfX, cy + halfY, cz - halfZ],
          [cx - halfX, cy + halfY, cz + halfZ],
          [cx - halfX, cy - halfY, cz + halfZ],
          [cx - halfX, cy - halfY, cz - halfZ],
        ], [-1, 0, 0]);
      }
      if (!hasCell(x + 1, z)) {
        addQuad([
          [cx + halfX, cy + halfY, cz + halfZ],
          [cx + halfX, cy + halfY, cz - halfZ],
          [cx + halfX, cy - halfY, cz - halfZ],
          [cx + halfX, cy - halfY, cz + halfZ],
        ], [1, 0, 0]);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);

    const mat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });

    return new THREE.Mesh(geom, mat);
  }

  function createCloudLayer() {
    const group = new THREE.Group();
    const clouds = [];
    const rows = 3;
    const cols = 4;
    const spacingX = 280;
    const spacingZ = 210;
    const total = rows * cols;

    for (let i = 0; i < total; i++) {
      const mesh = createBlockCloud(i + 1);
      const row = Math.floor(i / cols);
      const col = i % cols;
      const startX = (col - (cols - 1) * 0.5) * spacingX + ((i % 2) ? 70 : -70);
      const startZ = (row - (rows - 1) * 0.5) * spacingZ + (((i + 1) % 3) - 1) * 45;
      mesh.position.set(startX, 114 + (i % 3) * 4, startZ);
      group.add(mesh);
      clouds.push({ mesh, startX, startZ, speed: 1.5 + (i % cols) * 0.35 + row * 0.15 });
    }

    return {
      group,
      update(dt, playerX, playerZ) {
        for (const p of clouds) {
          p.startX += dt * p.speed;
          if (p.startX > 700) p.startX = -700;
          p.mesh.position.x = playerX + p.startX;
          p.mesh.position.z = playerZ + p.startZ;
        }
      },
    };
  }

  const clouds = createCloudLayer();
  scene.add(clouds.group);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ─── Day/Night ────────────────────────────────────────────────────────
  window.dayTime = 0.4; // 0..1, 0=midnight, 0.5=noon
  const DAY_SPEED = 1 / 600; // full cycle in 600 seconds

  function updateSkyColor(t) {
    // t: 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset
    let r, g, b;
    if (t < 0.25) { // night → sunrise
      const f = t / 0.25;
      r = MathUtils.lerp(5, 255, f);
      g = MathUtils.lerp(5, 100, f);
      b = MathUtils.lerp(20, 50, f);
    } else if (t < 0.5) { // sunrise → noon
      const f = (t - 0.25) / 0.25;
      r = MathUtils.lerp(255, 135, f);
      g = MathUtils.lerp(100, 206, f);
      b = MathUtils.lerp(50, 235, f);
    } else if (t < 0.75) { // noon → sunset
      const f = (t - 0.5) / 0.25;
      r = MathUtils.lerp(135, 255, f);
      g = MathUtils.lerp(206, 80, f);
      b = MathUtils.lerp(235, 40, f);
    } else { // sunset → night
      const f = (t - 0.75) / 0.25;
      r = MathUtils.lerp(255, 5, f);
      g = MathUtils.lerp(80, 5, f);
      b = MathUtils.lerp(40, 20, f);
    }
    const color = new THREE.Color(r/255, g/255, b/255);
    scene.background = color;
    scene.fog.color.copy(color);

    // Adjust lighting
    const brightness = Math.max(0.1, Math.sin(t * Math.PI));
    ambientLight.intensity = 0.2 + brightness * 0.6;
    sunLight.intensity = brightness;
    sunLight.position.set(
      Math.sin(t * Math.PI * 2) * 200,
      Math.cos(t * Math.PI * 2) * 200,
      100
    );
  }

  // ─── Init blocks/textures ─────────────────────────────────────────────
  initBlockTextures();

  const BREAK_CRACK_STAGES = 10;

  function makeBreakCrackTexture(stage, totalStages = BREAK_CRACK_STAGES) {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;

    const center = size * 0.5;
    const major = 4 + stage * 2;
    const branch = 2 + Math.floor(stage * 1.6);

    ctx.lineCap = 'square';
    ctx.strokeStyle = 'rgba(35,35,35,0.95)';
    ctx.lineWidth = 1 + Math.floor(stage / 4);

    for (let i = 0; i < major; i++) {
      const a = ((i * 137.5 + stage * 21) % 360) * Math.PI / 180;
      const len = 7 + ((i * 13) % 8) + stage * 0.8;
      const sx = center + Math.cos(a) * 1.5;
      const sy = center + Math.sin(a) * 1.5;
      const ex = center + Math.cos(a) * len;
      const ey = center + Math.sin(a) * len;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(20,20,20,0.75)';
    ctx.lineWidth = 1;
    for (let i = 0; i < branch; i++) {
      const a = ((i * 91 + stage * 17) % 360) * Math.PI / 180;
      const base = 8 + ((i * 7) % 7);
      const bend = a + ((i % 2 === 0) ? 0.42 : -0.42);
      const sx = center + Math.cos(a) * (base * 0.55);
      const sy = center + Math.sin(a) * (base * 0.55);
      const ex = sx + Math.cos(bend) * (4 + stage * 0.4);
      const ey = sy + Math.sin(bend) * (4 + stage * 0.4);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  function makeNearestTextureFromImage(image) {
    const tex = new THREE.Texture(image);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  function loadTextureImage(path, onLoad) {
    const img = new Image();
    img.onload = () => onLoad(img);
    img.onerror = () => {};
    img.src = path;
  }

  function applyCrackAtlasToStages(textures, img) {
    const w = Number(img.width) || 0;
    const h = Number(img.height) || 0;
    if (!w || !h) return false;

    // Minetest crack atlas is typically stacked vertically in 10 slices.
    const sliceH = Math.floor(h / BREAK_CRACK_STAGES);
    if (!sliceH || h < BREAK_CRACK_STAGES) return false;

    for (let i = 0; i < BREAK_CRACK_STAGES; i++) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = sliceH;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, sliceH);
      ctx.drawImage(img, 0, i * sliceH, w, sliceH, 0, 0, w, sliceH);
      textures[i] = new THREE.CanvasTexture(c);
      textures[i].magFilter = THREE.NearestFilter;
      textures[i].minFilter = THREE.NearestFilter;
      textures[i].wrapS = THREE.ClampToEdgeWrapping;
      textures[i].wrapT = THREE.ClampToEdgeWrapping;
      textures[i].needsUpdate = true;
    }
    return true;
  }

  function tryLoadMinetestBreakTextures(textures) {
    const localBase = 'textures/minetest';
    const remoteBases = [
      'https://raw.githubusercontent.com/minetest/minetest/master/textures/base/pack',
      'https://raw.githubusercontent.com/minetest/minetest_game/master/mods/default/textures',
    ];

    // If present, use atlas first (Minetest-style crack strip).
    loadTextureImage(`${localBase}/crack_anylength.png`, (img) => {
      applyCrackAtlasToStages(textures, img);
    });
    const atlasNames = ['crack_anylength.png', 'default_crack_anylength.png'];
    for (const base of remoteBases) {
      for (const atlas of atlasNames) {
        loadTextureImage(`${base}/${atlas}`, (img) => {
          applyCrackAtlasToStages(textures, img);
        });
      }
    }

    // If staged textures exist, they override individual stages.
    for (let i = 0; i < BREAK_CRACK_STAGES; i++) {
      const candidates = [
        `destroy_stage_${i}.png`,
        `break_${i}.png`,
        `crack_${i}.png`,
      ];
      for (const name of candidates) {
        loadTextureImage(`${localBase}/${name}`, (img) => {
          textures[i] = makeNearestTextureFromImage(img);
        });
        for (const base of remoteBases) {
          loadTextureImage(`${base}/${name}`, (img) => {
            textures[i] = makeNearestTextureFromImage(img);
          });
        }
      }
    }
  }

  function buildBreakCrackTextures() {
    const textures = [];
    for (let i = 0; i < BREAK_CRACK_STAGES; i++) {
      textures.push(makeBreakCrackTexture(i));
    }
    tryLoadMinetestBreakTextures(textures);
    return textures;
  }

  function getBreakCrackStage(player, hit) {
    if (!player || !hit || !player.breaking || !player.breakTarget) return -1;
    const key = `${hit.bx},${hit.by},${hit.bz}`;
    if (player.breakTarget.key !== key) return -1;
    const hardness = Number(BLOCK_PROPS[hit.block]?.hardness || 1);
    if (!Number.isFinite(hardness) || hardness <= 0) return -1;
    const t = MathUtils.clamp(player.breakProgress / hardness, 0, 0.9999);
    return Math.floor(t * BREAK_CRACK_STAGES);
  }

  // ─── Create systems ───────────────────────────────────────────────────
  window.world = null;
  window.player = null;
  window.inventory = null;
  window.ui = new UI();
  window.gameStarted = false;

  // ─── Network ─────────────────────────────────────────────────────────
  const network = new Network();
  network.connect(scene);
  let pendingAuthState = null;

  window.applyAuthState = (state) => {
    pendingAuthState = state || null;
    const menu = document.getElementById('main-menu');
    if (menu) menu.style.display = 'none';
    if (window.gameStarted !== undefined) window.gameStarted = true;

    if (window.player && pendingAuthState) {
      const s = pendingAuthState;
      window.player.spawn(Number(s.x) || 0, Number(s.y) || 70, Number(s.z) || 0);
      window.player.ry = Number(s.ry) || 0;
      window.player.rx = Number(s.rx) || 0;
      window.player.health = Math.max(1, Math.min(window.player.maxHealth, Number(s.health) || window.player.maxHealth));
      window.player.hunger = Math.max(0, Math.min(window.player.maxHunger, Number(s.hunger) || window.player.maxHunger));
      
      // Ensure player is above terrain
      if (window.world) window.world.ensurePlayerAboveTerrain(window.player);
      if (window.inventory) {
        if (s.state && window.inventory.loadState) {
          window.inventory.loadState(s.state);
        } else if (Array.isArray(s.inventory)) {
          window.inventory.loadSerialized(s.inventory);
        }
        if (window.inventory.serializeState) network.sendPlayerState(window.inventory.serializeState());
      }
      if (!window.ui._isTouchDevice()) {
        setTimeout(() => window.player && window.player.lock(), 100);
      }
    }
  };

  // ─── Start game after main menu ───────────────────────────────────────
  function startGame(seed) {
    seed = seed || 12345;

    // World
    window.world = new World(scene, seed);

    // Player
    window.player = new Player(camera, window.world);

    // Find surface to spawn
    const spawnX = 0, spawnZ = 0;
    const spawnY = window.world.getSurfaceY(spawnX, spawnZ);
    window.player.spawn(spawnX, spawnY, spawnZ);
    
    // Ensure player is above terrain (in case chunks aren't loaded yet)
    window.world.ensurePlayerAboveTerrain(window.player);

    // Inventory
    window.inventory = new Inventory();

    // UI
    window.ui.init(window.player, window.inventory, network);

    // Crafting
    window.crafting = new CraftingUI(window.inventory);

    // Furnace
    window.furnace = new FurnaceUI(window.inventory, network);

    // Chest
    window.chest = new ChestUI(window.inventory, network);

    // Dropped item entities
    window.itemEntities = new ItemEntityManager(scene, window.world, window.inventory, window.player);

    // Mobs
    window.mobs = new MobManager(scene, window.world, window.player);

    // Mobile
    window.mobile = new MobileControls(window.player);

    // First-person arm/tool rendering.
    viewModel = createViewModel();

    if (pendingAuthState) window.applyAuthState(pendingAuthState);

    // Block interaction (mouse)
    canvas.addEventListener('mousedown', (e) => {
      if (!window.gameStarted || window.ui.isBlocking()) return;
      if (e.button === 0) {
        if (!performMeleeAttack()) window.player.startBreaking();
      }
      if (e.button === 2) {
        if (!desktopUseAction()) window.player.startPlacing();
      }
    });
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) window.player.stopBreaking();
      if (e.button === 2) window.player.stopPlacing();
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Block highlight mesh
    const hlGeom = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.5 });
    const highlight = new THREE.Mesh(hlGeom, hlMat);
    highlight.visible = false;
    scene.add(highlight);

    // Block break crack overlay (Minecraft-style progressive cracks)
    const crackTextures = buildBreakCrackTextures();
    const crackGeom = new THREE.BoxGeometry(1.014, 1.014, 1.014);
    const crackMat = new THREE.MeshBasicMaterial({
      map: crackTextures[0],
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const crackOverlay = new THREE.Mesh(crackGeom, crackMat);
    crackOverlay.visible = false;
    crackOverlay.renderOrder = 2;
    scene.add(crackOverlay);

    loop(highlight, crackOverlay, crackTextures);
  }

  // ─── Game loop ─────────────────────────────────────────────────────────
  let lastTime = performance.now();
  let fpsTime = 0;
  let fpsFrames = 0;

  function updateFPS(dt) {
    fpsTime += dt;
    fpsFrames += 1;
    if (fpsTime < 0.25) return;
    const fps = Math.round(fpsFrames / fpsTime);
    fpsTime = 0;
    fpsFrames = 0;
    const el = document.getElementById('fps-counter');
    if (el) el.textContent = `FPS: ${fps}`;
  }

  let itemUseCooldown = 0;
  let attackCooldown = 0;
  let dropCooldown = 0;
  let viewModel = null;

  function createViewModel() {
    const root = new THREE.Group();
    root.name = 'viewModelRoot';
    root.position.set(0.3, -0.17, -0.48);
    root.frustumCulled = false;
    root.renderOrder = 1000;
    camera.add(root);

    const armPivot = new THREE.Group();
    armPivot.position.set(0.16, 0.03, 0.04);
    root.add(armPivot);

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xf0c8a0 });
    skinMat.depthTest = true;
    skinMat.depthWrite = true;

    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0xd7a879 });
    sleeveMat.depthTest = true;
    sleeveMat.depthWrite = true;

    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 0.16), sleeveMat);
    upperArm.position.set(0, -0.15, 0);
    upperArm.frustumCulled = false;
    upperArm.renderOrder = 1000;
    armPivot.add(upperArm);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.32, 0.15), skinMat);
    forearm.position.set(0, -0.46, 0);
    forearm.frustumCulled = false;
    forearm.renderOrder = 1000;
    armPivot.add(forearm);

    const toolPivot = new THREE.Group();
    toolPivot.position.set(0.05, -0.46, -0.2);
    armPivot.add(toolPivot);

    let currentMesh = null;
    let currentSig = '';
    let bobPhase = 0;
    let equipLerp = 1;
    let minePhase = 0;
    let placePhase = 0;

    const BASE_ROOT = { x: 0.3, y: -0.17, z: -0.48 };
    const POSES = {
      hand:   { arm: { x: -0.92, y: -0.26, z: -0.16 }, toolPos: { x: 0.1, y: -0.28, z: -0.26 }, toolRot: { x: -0.18, y: 0.12, z: 0.02 } },
      block:  { arm: { x: -0.66, y: -0.12, z: -0.12 }, toolPos: { x: 0.12, y: -0.05, z: -0.24 }, toolRot: { x: -0.06, y: 0.84, z: -0.08 } },
      sword:  { arm: { x: -1.02, y: -0.28, z: -0.14 }, toolPos: { x: 0.1, y: -0.14, z: -0.24 }, toolRot: { x: -0.2, y: 0.1, z: 0.1 } },
      pickaxe:{ arm: { x: -0.98, y: -0.26, z: -0.2 }, toolPos: { x: 0.1, y: -0.15, z: -0.24 }, toolRot: { x: -0.22, y: 0.14, z: 0.04 } },
      axe:    { arm: { x: -0.98, y: -0.24, z: -0.2 }, toolPos: { x: 0.1, y: -0.15, z: -0.24 }, toolRot: { x: -0.22, y: 0.14, z: 0.06 } },
      shovel: { arm: { x: -0.96, y: -0.22, z: -0.2 }, toolPos: { x: 0.1, y: -0.16, z: -0.24 }, toolRot: { x: -0.2, y: 0.12, z: 0.04 } },
      hoe:    { arm: { x: -0.98, y: -0.22, z: -0.21 }, toolPos: { x: 0.1, y: -0.16, z: -0.24 }, toolRot: { x: -0.24, y: 0.1, z: 0.04 } },
      food:   { arm: { x: -0.9, y: -0.2, z: -0.1 }, toolPos: { x: 0.11, y: -0.24, z: -0.27 }, toolRot: { x: -0.08, y: 0.12, z: 0.02 } },
      item:   { arm: { x: -0.95, y: -0.24, z: -0.14 }, toolPos: { x: 0.11, y: -0.25, z: -0.28 }, toolRot: { x: -0.12, y: 0.14, z: 0.02 } },
    };

    let poseKind = 'hand';
    const poseBlend = {
      armX: POSES.hand.arm.x,
      armY: POSES.hand.arm.y,
      armZ: POSES.hand.arm.z,
      toolPosX: POSES.hand.toolPos.x,
      toolPosY: POSES.hand.toolPos.y,
      toolPosZ: POSES.hand.toolPos.z,
      toolRotX: POSES.hand.toolRot.x,
      toolRotY: POSES.hand.toolRot.y,
      toolRotZ: POSES.hand.toolRot.z,
    };

    const disposeCurrent = () => {
      if (!currentMesh) return;
      toolPivot.remove(currentMesh);
      currentMesh.traverse((obj) => {
        if (!obj.isMesh) return;
        if (obj.geometry) obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m && m.dispose && m.dispose());
        else if (mat && mat.dispose) mat.dispose();
      });
      currentMesh = null;
      currentSig = '';
    };

    const getHeldKind = (item) => {
      if (!item) return 'hand';
      if (item.type === 'block') return 'block';
      const name = String(item.itemDef?.name || '').toLowerCase();
      if (name.includes('sword')) return 'sword';
      if (name.includes('pickaxe') || name.includes('pick')) return 'pickaxe';
      if (name.includes('shovel')) return 'shovel';
      if (name.includes('axe')) return 'axe';
      if (name.includes('hoe')) return 'hoe';
      if (item.itemDef?.food) return 'food';
      return 'item';
    };

    const getTextureImageData = (texture) => {
      if (!texture || !texture.image) return null;
      const img = texture.image;
      const w = Number(img.width) || 0;
      const h = Number(img.height) || 0;
      if (!w || !h) return null;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      return { data: data.data, width: w, height: h };
    };

    const buildVoxelItemMesh = (texture, kind) => {
      const imageData = getTextureImageData(texture);
      if (!imageData) return null;

      const { data, width, height } = imageData;
      const group = new THREE.Group();
      const isTool = kind === 'sword' || kind === 'pickaxe' || kind === 'axe' || kind === 'shovel' || kind === 'hoe';
      const pixelSize = isTool ? 0.03 : 0.026;
      const depth = isTool ? 0.06 : 0.05;
      const ox = -(width * pixelSize) * 0.5 + pixelSize * 0.5;
      // Grip-anchored so long tools remain visible when idle.
      const oy = (height - 1) * pixelSize;

      const geom = new THREE.BoxGeometry(pixelSize, pixelSize, depth);
      const matCache = new Map();

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const a = data[idx + 3] / 255;
          if (a < 0.1) continue;
          const r = data[idx] / 255;
          const g = data[idx + 1] / 255;
          const b = data[idx + 2] / 255;
          const key = `${data[idx]}:${data[idx + 1]}:${data[idx + 2]}:${Math.round(a * 255)}`;
          let mat = matCache.get(key);
          if (!mat) {
            mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(r, g, b), transparent: a < 0.99, opacity: a });
            mat.depthTest = true;
            mat.depthWrite = true;
            matCache.set(key, mat);
          }
          const px = ox + x * pixelSize;
          const py = oy - y * pixelSize;
          const voxel = new THREE.Mesh(geom, mat);
          voxel.position.set(px, py, 0);
          voxel.frustumCulled = false;
          voxel.renderOrder = 1000;
          group.add(voxel);
        }
      }

      if (!group.children.length) {
        geom.dispose();
        matCache.forEach((m) => m.dispose());
        return null;
      }

      return group;
    };

    const buildMeshForItem = (item, kind) => {
      if (!item) return null;
      if (item.type === 'block') {
        const tex = blockTextures[item.id] || null;
        const mat = new THREE.MeshLambertMaterial({
          map: tex || null,
          color: tex ? 0xffffff : 0xb0b0b0,
          transparent: true,
        });
        mat.depthTest = true;
        mat.depthWrite = true;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), mat);
        mesh.rotation.set(0.06, 0.78, 0.0);
        mesh.position.set(0.0, 0.05, -0.08);
        return mesh;
      }

      const tex = itemTextures[item.id] || null;
      const voxel = buildVoxelItemMesh(tex, kind);
      if (voxel) {
        voxel.scale.setScalar(1.22);
        const isLongTool = kind === 'sword' || kind === 'pickaxe' || kind === 'axe' || kind === 'shovel' || kind === 'hoe';
        voxel.position.set(0.0, isLongTool ? -0.06 : -0.02, -0.08);
        return voxel;
      }

      const fallbackMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
      fallbackMat.depthTest = true;
      fallbackMat.depthWrite = true;
      const fallback = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.08), fallbackMat);
      fallback.position.set(0.0, 0.0, -0.08);
      return fallback;
    };

    const syncHeldItem = (item) => {
      const kind = getHeldKind(item);
      const sig = item ? `${item.type}:${item.id}:${kind}` : '';
      if (sig === currentSig) return;
      disposeCurrent();
      poseKind = kind;
      equipLerp = 0;
      if (!item) return;
      currentMesh = buildMeshForItem(item, kind);
      if (currentMesh) {
        currentSig = sig;
        currentMesh.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.frustumCulled = false;
          obj.renderOrder = 1000;
        });
        toolPivot.add(currentMesh);
      }
    };

    return {
      update(dt, state) {
        const visible = !state.blocking;
        root.visible = visible;
        if (!visible) return;

        syncHeldItem(state.heldItem);
        equipLerp = Math.min(1, equipLerp + dt * 7.5);

        const hasHeldMesh = !!(state.heldItem && currentMesh);
        upperArm.visible = !hasHeldMesh;
        forearm.visible = !hasHeldMesh;

        const targetPose = POSES[poseKind] || POSES.item;
        const poseLerp = Math.min(1, dt * 14);
        poseBlend.armX = MathUtils.lerp(poseBlend.armX, targetPose.arm.x, poseLerp);
        poseBlend.armY = MathUtils.lerp(poseBlend.armY, targetPose.arm.y, poseLerp);
        poseBlend.armZ = MathUtils.lerp(poseBlend.armZ, targetPose.arm.z, poseLerp);
        poseBlend.toolPosX = MathUtils.lerp(poseBlend.toolPosX, targetPose.toolPos.x, poseLerp);
        poseBlend.toolPosY = MathUtils.lerp(poseBlend.toolPosY, targetPose.toolPos.y, poseLerp);
        poseBlend.toolPosZ = MathUtils.lerp(poseBlend.toolPosZ, targetPose.toolPos.z, poseLerp);
        poseBlend.toolRotX = MathUtils.lerp(poseBlend.toolRotX, targetPose.toolRot.x, poseLerp);
        poseBlend.toolRotY = MathUtils.lerp(poseBlend.toolRotY, targetPose.toolRot.y, poseLerp);
        poseBlend.toolRotZ = MathUtils.lerp(poseBlend.toolRotZ, targetPose.toolRot.z, poseLerp);

        bobPhase += dt * (state.walking ? 8.6 : 2.6);
        const walkBobX = state.walking ? Math.sin(bobPhase * 0.5) * 0.022 : 0;
        const walkBobY = state.walking ? Math.abs(Math.sin(bobPhase)) * 0.026 : 0;
        const idleSway = Math.sin(performance.now() * 0.0018) * 0.004;
        const equipDrop = (1 - equipLerp) * 0.14;
        const equipSlide = (1 - equipLerp) * 0.08;
        root.position.set(BASE_ROOT.x + walkBobX + equipSlide, BASE_ROOT.y - walkBobY - equipDrop, BASE_ROOT.z);
        root.rotation.z = idleSway + walkBobX * 0.45;

        let swing = 0;
        if (state.breaking) {
          minePhase += dt * 6.8;
          swing += Math.pow(Math.sin(minePhase * Math.PI), 1.2) * 0.94;
        } else {
          minePhase = 0;
        }
        if (state.placing) {
          placePhase = Math.min(1, placePhase + dt * 9);
          swing += Math.sin(placePhase * Math.PI) * 0.35;
        } else {
          placePhase = Math.max(0, placePhase - dt * 12);
        }
        if (state.attackCooldown > 0) {
          const t = 1 - state.attackCooldown / 0.35;
          swing += Math.sin(MathUtils.clamp(t, 0, 1) * Math.PI) * 1.05;
        }

        const swingPow = poseKind === 'sword' ? 1.15 : 1.0;
        const swingAmount = swing * swingPow;

        armPivot.rotation.x = poseBlend.armX - swingAmount * 0.95;
        armPivot.rotation.y = poseBlend.armY + swingAmount * 0.22;
        armPivot.rotation.z = poseBlend.armZ - swingAmount * 0.55;

        toolPivot.position.set(poseBlend.toolPosX, poseBlend.toolPosY, poseBlend.toolPosZ);
        toolPivot.rotation.x = poseBlend.toolRotX - swingAmount * 0.4;
        toolPivot.rotation.y = poseBlend.toolRotY + swingAmount * 0.32;
        toolPivot.rotation.z = poseBlend.toolRotZ - swingAmount * 0.22;
      },
      dispose() {
        disposeCurrent();
        camera.remove(root);
      },
    };
  }

  function getAttackDamage() {
    const held = window.inventory?.getHotbarItem();
    return held?.itemDef?.damage || 1;
  }

  function performMeleeAttack() {
    if (!window.player || !window.inventory) return false;
    if (attackCooldown > 0) return false;

    const origin = window.player.getLookOrigin();
    const dir = window.player.getLookDirection();
    const damage = getAttackDamage();
    let didHit = false;

    if (window.mobs && window.mobs.hitByRay(origin, dir, damage, 3.2)) didHit = true;
    if (network.tryAttackPlayer(origin, dir, damage, 3.2)) didHit = true;

    if (!didHit) return false;
    if (window.inventory && window.inventory.useHeldItemDurability) window.inventory.useHeldItemDurability(1);
    attackCooldown = 0.35;
    return true;
  }
  function useSelectedItem() {
    if (!window.player || !window.inventory) return false;
    if (itemUseCooldown > 0) return false;
    if (window.ui && window.ui.isBlocking()) return false;
    const item = window.inventory.getHotbarItem();
    if (!item?.itemDef?.food) return false;
    if (window.player.hunger >= window.player.maxHunger) return false;

    window.player.eat(item.itemDef.food);
    window.inventory.removeItem(window.inventory.hotbarIndex, 1);
    itemUseCooldown = 0.25;
    return true;
  }

  // Expose for UI button.
  window.useSelectedItem = useSelectedItem;

  function dropSelectedItem() {
    if (!window.player || !window.inventory || !window.itemEntities) return false;
    if (window.ui && window.ui.isBlocking()) return false;
    if (dropCooldown > 0) return false;

    const held = window.inventory.getHotbarItem();
    if (!held || held.count <= 0) return false;

    const dir = window.player.getLookDirection();
    const ox = window.player.x + dir.x * 0.8;
    const oy = window.player.y + 0.9;
    const oz = window.player.z + dir.z * 0.8;
    const dropped = {
      id: held.id,
      count: 1,
      type: held.type,
      itemDef: held.itemDef || null,
      durability: typeof held.durability === 'number' ? held.durability : undefined,
      vx: dir.x * 5.4,
      vy: 2.1,
      vz: dir.z * 5.4,
    };

    window.inventory.removeItem(window.inventory.hotbarIndex, 1);
    window.itemEntities.spawnDrop(ox, oy, oz, dropped);
    dropCooldown = 0.18;
    return true;
  }

  window.dropSelectedItem = dropSelectedItem;

  function desktopUseAction() {
    if (!window.player || !window.world || !window.inventory) return false;
    if (window.ui && window.ui.isBlocking()) return false;

    if (useSelectedItem()) return true;

    const player = window.player;
    const inv = window.inventory;
    const hit = window.world.raycast(player.getLookOrigin(), player.getLookDirection());
    if (!hit) return false;

    if (hit.block === BLOCKS.CRAFTING_TABLE && window.ui) {
      window.ui.openCraftingTable();
      return true;
    }

    if (hit.block === BLOCKS.FURNACE && window.ui) {
      window.ui.openFurnace({ x: hit.bx, y: hit.by, z: hit.bz });
      return true;
    }

    if (hit.block === BLOCKS.CHEST && window.ui) {
      window.ui.openChest({ x: hit.bx, y: hit.by, z: hit.bz });
      return true;
    }

    const held = inv.getHotbarItem();
    if (held && held.type === 'item' && tryPlantCrop(hit, held, inv)) {
      return true;
    }
    if (!held || held.type !== 'block') return false;

    const px = hit.bx + hit.nx;
    const py = hit.by + hit.ny;
    const pz = hit.bz + hit.nz;

    const ppx = Math.floor(player.x);
    const ppy = Math.floor(player.y);
    const ppz = Math.floor(player.z);
    if (px === ppx && (py === ppy || py === ppy + 1) && pz === ppz) return false;

    window.world.setBlock(px, py, pz, held.id);
    network.sendBlockSet(px, py, pz, held.id);
    inv.removeItem(inv.hotbarIndex, 1);
    if (held.itemDef?.durability && inv.useHeldItemDurability) inv.useHeldItemDurability(1);
    return true;
  }

  function mobilePrimaryAction() {
    if (!window.player || !window.world || !window.inventory) return false;
    if (window.ui && window.ui.isBlocking()) return false;

    // Food use has priority when holding edible items.
    if (useSelectedItem()) return true;

    const player = window.player;
    const inv = window.inventory;
    const hit = window.world.raycast(player.getLookOrigin(), player.getLookDirection());
    if (!hit) return false;

    // Open crafting table by tapping it.
    if (hit.block === BLOCKS.CRAFTING_TABLE && window.ui) {
      window.ui.openCraftingTable();
      return true;
    }

    if (hit.block === BLOCKS.FURNACE && window.ui) {
      window.ui.openFurnace({ x: hit.bx, y: hit.by, z: hit.bz });
      return true;
    }

    if (hit.block === BLOCKS.CHEST && window.ui) {
      window.ui.openChest({ x: hit.bx, y: hit.by, z: hit.bz });
      return true;
    }

    const held = inv.getHotbarItem();
    if (held && held.type === 'item' && tryPlantCrop(hit, held, inv)) {
      return true;
    }
    if (!held || held.type !== 'block') {
      return performMeleeAttack();
    }

    // Place held block on the targeted face.
    const item = inv.getHotbarItem();
    if (!item || item.type !== 'block') return false;

    const px = hit.bx + hit.nx;
    const py = hit.by + hit.ny;
    const pz = hit.bz + hit.nz;

    const ppx = Math.floor(player.x);
    const ppy = Math.floor(player.y);
    const ppz = Math.floor(player.z);
    if (px === ppx && (py === ppy || py === ppy + 1) && pz === ppz) return false;

    window.world.setBlock(px, py, pz, item.id);
    network.sendBlockSet(px, py, pz, item.id);
    inv.removeItem(inv.hotbarIndex, 1);
    if (item.itemDef?.durability && inv.useHeldItemDurability) inv.useHeldItemDurability(1);
    return true;
  }

  // Expose for mobile touch input.
  window.mobilePrimaryAction = mobilePrimaryAction;

  function getBlockDrop(blockId) {
    switch (blockId) {
      case BLOCKS.STONE:
        return { id: BLOCKS.COBBLESTONE, count: 1, type: 'block' };
      case BLOCKS.DIAMOND_ORE:
        return { id: ITEM_TYPES.DIAMOND.id, count: 1, type: 'item', itemDef: ITEM_TYPES.DIAMOND };
      case BLOCKS.COAL_ORE:
        return { id: ITEM_TYPES.COAL.id, count: 1 + (Math.random() < 0.35 ? 1 : 0), type: 'item', itemDef: ITEM_TYPES.COAL };
      case BLOCKS.GRASS:
        return { id: BLOCKS.DIRT, count: 1, type: 'block' };
      case BLOCKS.LEAVES:
        if (Math.random() < 0.22) {
          if (Math.random() < 0.65) return { id: ITEM_TYPES.APPLE.id, count: 1, type: 'item', itemDef: ITEM_TYPES.APPLE };
          return { id: ITEM_TYPES.WHEAT_SEEDS.id, count: 1, type: 'item', itemDef: ITEM_TYPES.WHEAT_SEEDS };
        }
        return null;
      case BLOCKS.WHEAT_CROP:
        return { id: ITEM_TYPES.WHEAT.id, count: 1 + (Math.random() < 0.5 ? 1 : 0), type: 'item', itemDef: ITEM_TYPES.WHEAT };
      case BLOCKS.CARROT_CROP:
        return { id: ITEM_TYPES.CARROT.id, count: 1 + (Math.random() < 0.5 ? 1 : 0), type: 'item', itemDef: ITEM_TYPES.CARROT };
      case BLOCKS.POTATO_CROP:
        return { id: ITEM_TYPES.POTATO.id, count: 1 + (Math.random() < 0.5 ? 1 : 0), type: 'item', itemDef: ITEM_TYPES.POTATO };
      case BLOCKS.TALL_GRASS:
        if (Math.random() < 0.4) {
          return { id: ITEM_TYPES.WHEAT_SEEDS.id, count: 1, type: 'item', itemDef: ITEM_TYPES.WHEAT_SEEDS };
        }
        return null;
      default:
        return { id: blockId, count: 1, type: 'block' };
    }
  }

  function cropBlockFromItem(item) {
    if (!item || item.type !== 'item') return null;
    if (item.id === ITEM_TYPES.WHEAT_SEEDS.id) return BLOCKS.WHEAT_CROP;
    if (item.id === ITEM_TYPES.CARROT.id) return BLOCKS.CARROT_CROP;
    if (item.id === ITEM_TYPES.POTATO.id) return BLOCKS.POTATO_CROP;
    return null;
  }

  function tryPlantCrop(hit, held, inv) {
    const cropBlock = cropBlockFromItem(held);
    if (!cropBlock) return false;
    const soil = hit.block;
    if (hit.ny !== 1) return false;
    if (soil !== BLOCKS.DIRT && soil !== BLOCKS.GRASS) return false;
    const px = hit.bx + hit.nx;
    const py = hit.by + hit.ny;
    const pz = hit.bz + hit.nz;
    if (window.world.getBlock(px, py, pz) !== BLOCKS.AIR) return false;
    window.world.setBlock(px, py, pz, cropBlock);
    network.sendBlockSet(px, py, pz, cropBlock);
    inv.removeItem(inv.hotbarIndex, 1);
    return true;
  }

  let leafAppleTimer = 0;
  function tryPassiveLeafAppleDrop(dt) {
    leafAppleTimer += dt;
    if (leafAppleTimer < 7) return;
    leafAppleTimer = 0;
    if (!window.player || !window.world || !window.itemEntities) return;
    const baseX = Math.floor(window.player.x);
    const baseY = Math.floor(window.player.y + 1);
    const baseZ = Math.floor(window.player.z);
    for (let i = 0; i < 5; i++) {
      const x = baseX + Math.floor(Math.random() * 18) - 9;
      const y = baseY + Math.floor(Math.random() * 6) - 2;
      const z = baseZ + Math.floor(Math.random() * 18) - 9;
      if (window.world.getBlock(x, y, z) === BLOCKS.LEAVES && Math.random() < 0.2) {
        window.itemEntities.spawnDrop(x, y, z, { id: ITEM_TYPES.APPLE.id, count: 1, type: 'item', itemDef: ITEM_TYPES.APPLE });
        break;
      }
    }
  }

  function loop(highlight, crackOverlay, crackTextures) {
    requestAnimationFrame(() => loop(highlight, crackOverlay, crackTextures));

    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    itemUseCooldown = Math.max(0, itemUseCooldown - dt);
    attackCooldown = Math.max(0, attackCooldown - dt);
    dropCooldown = Math.max(0, dropCooldown - dt);

    if (!window.gameStarted) return;

    updateFPS(dt);

    const player = window.player;
    const inv = window.inventory;

    // Day/Night
    window.dayTime = (window.dayTime + DAY_SPEED * dt) % 1;
    updateSkyColor(window.dayTime);
    if (window.ui) window.ui.updateDaytime(window.dayTime);

    if (clouds && player) clouds.update(dt, player.x, player.z);

    // Update player
    if (!window.ui.isBlocking()) {
      player.update(dt);
      // Fail-safe: if streaming/chunk timing ever drops the player too low, recover.
      if (player.y < -4 && window.world && window.world.ensurePlayerAboveTerrain) {
        window.world.ensurePlayerAboveTerrain(player);
      }
    }

    // Block breaking
    const broken = player.updateBreaking(dt, inv);
    if (broken) {
      window.world.setBlock(broken.bx, broken.by, broken.bz, BLOCKS.AIR);
      network.sendBlockSet(broken.bx, broken.by, broken.bz, 0);
      if (window.inventory && window.inventory.useHeldItemDurability) window.inventory.useHeldItemDurability(1);
      // Only drop items when the current tool can harvest this block.
      if (broken.dropsWithCurrentTool !== false) {
        const drop = getBlockDrop(broken.block);
        if (drop && window.itemEntities) {
          window.itemEntities.spawnDrop(broken.bx, broken.by, broken.bz, drop);
        }
        if (broken.block === BLOCKS.GRASS && window.itemEntities && Math.random() < 0.25) {
          window.itemEntities.spawnDrop(broken.bx, broken.by, broken.bz, {
            id: ITEM_TYPES.WHEAT_SEEDS.id,
            count: 1,
            type: 'item',
            itemDef: ITEM_TYPES.WHEAT_SEEDS,
          });
        }
      }

    }

    // Block placing
    const placeResult = player.updatePlacing(dt, inv, null);
    if (placeResult) {
      const item = inv.getHotbarItem();
      if (item && item.type === 'block') {
        window.world.setBlock(placeResult.px, placeResult.py, placeResult.pz, item.id);
        network.sendBlockSet(placeResult.px, placeResult.py, placeResult.pz, item.id);
        inv.removeItem(inv.hotbarIndex, 1);
      }
    }

    // Block highlight
    const hit = window.world.raycast(player.getLookOrigin(), player.getLookDirection());
    if (hit) {
      highlight.visible = true;
      highlight.position.set(hit.bx + 0.5, hit.by + 0.5, hit.bz + 0.5);

      const crackStage = getBreakCrackStage(player, hit);
      if (crackOverlay && crackTextures && crackStage >= 0) {
        crackOverlay.visible = true;
        crackOverlay.position.set(hit.bx + 0.5, hit.by + 0.5, hit.bz + 0.5);
        crackOverlay.material.map = crackTextures[crackStage];
        crackOverlay.material.opacity = 0.24 + crackStage * 0.06;
        crackOverlay.material.needsUpdate = true;
      } else if (crackOverlay) {
        crackOverlay.visible = false;
      }
    } else {
      highlight.visible = false;
      if (crackOverlay) crackOverlay.visible = false;
    }

    // World update
    window.world.update(player.x, player.z, dt, camera);

    // Mobs
    if (window.mobs) window.mobs.update(dt);

    // Dropped items
    if (window.itemEntities) window.itemEntities.update(dt);

    // Furnace simulation
    if (window.furnace) window.furnace.tick(dt);

    // Passive apples dropping from leaves.
    tryPassiveLeafAppleDrop(dt);

    // HUD
    if (window.ui) window.ui.updateHUD(player);

    if (viewModel) {
      viewModel.update(dt, {
        heldItem: inv ? inv.getHotbarItem() : null,
        breaking: !!player.breaking,
        placing: !!player.placing,
        walking: !!player._isMovingHoriz,
        attackCooldown,
        blocking: !!(window.ui && window.ui.isBlocking()),
        touchDevice: !!(window.ui && window.ui._isTouchDevice && window.ui._isTouchDevice()),
      });
    }

    // Network sync
    network.sendMove(player);
    network.sendVitals(player, dt);
    network.update(dt);

    // Item use (food)
    if (player.keys && player.keys['KeyF']) useSelectedItem();

    // Render
    renderer.render(scene, camera);
  }

  // ─── Wait for network init then start ─────────────────────────────────
  // If network initializes quickly, use the server seed; otherwise use random
  let started = false;
  network.onInit((msg) => {
    if (!started) {
      started = true;
      startGame(msg.seed);
      window.world.applyAllServerBlocks(msg.blocks || {});
    }
  });

  // Fallback: start without server after 2 seconds
  setTimeout(() => {
    if (!started) {
      started = true;
      startGame(Math.floor(Math.random() * 2147483647));
    }
  }, 2000);

})();
