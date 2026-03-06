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

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.0);
  sunLight.position.set(100, 200, 100);
  scene.add(sunLight);

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

  // ─── Create systems ───────────────────────────────────────────────────
  window.world = null;
  window.player = null;
  window.inventory = null;
  window.ui = new UI();
  window.gameStarted = false;

  // ─── Network ─────────────────────────────────────────────────────────
  const network = new Network();
  network.connect(scene);

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

    // Inventory
    window.inventory = new Inventory();

    // UI
    window.ui.init(window.player, window.inventory, network);

    // Crafting
    window.crafting = new CraftingUI(window.inventory);

    // Mobs
    window.mobs = new MobManager(scene, window.world, window.player);

    // Mobile
    window.mobile = new MobileControls(window.player);

    // Block interaction (mouse)
    canvas.addEventListener('mousedown', (e) => {
      if (!window.gameStarted || window.ui.isBlocking()) return;
      if (e.button === 0) window.player.startBreaking();
      if (e.button === 2) window.player.startPlacing();
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

    // Right-click craft table
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2 && !window.ui.isBlocking()) {
        const hit = window.world.raycast(window.player.getLookOrigin(), window.player.getLookDirection());
        if (hit && hit.block === BLOCKS.CRAFTING_TABLE) {
          window.ui.openCraftingTable();
        }
      }
    });

    loop(highlight);
  }

  // ─── Game loop ─────────────────────────────────────────────────────────
  let lastTime = performance.now();

  function loop(highlight) {
    requestAnimationFrame(() => loop(highlight));

    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (!window.gameStarted) return;

    const player = window.player;
    const inv = window.inventory;

    // Day/Night
    window.dayTime = (window.dayTime + DAY_SPEED * dt) % 1;
    updateSkyColor(window.dayTime);
    if (window.ui) window.ui.updateDaytime(window.dayTime);

    // Update player
    if (!window.ui.isBlocking()) {
      player.update(dt);
    }

    // Block breaking
    const broken = player.updateBreaking(dt, inv);
    if (broken) {
      window.world.setBlock(broken.bx, broken.by, broken.bz, BLOCKS.AIR);
      network.sendBlockSet(broken.bx, broken.by, broken.bz, 0);
      // Drop block in inventory
      window.inventory.addItem({ id: broken.block, count: 1, type: 'block' });

      // Try attack mobs
      if (window.mobs) {
        const item = inv.getHotbarItem();
        const dmg = item?.itemDef?.damage || 1;
        window.mobs.hitMob(broken.bx, broken.by, broken.bz, dmg);
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
    } else {
      highlight.visible = false;
    }

    // World update
    window.world.update(player.x, player.z);

    // Mobs
    if (window.mobs) window.mobs.update(dt);

    // HUD
    if (window.ui) window.ui.updateHUD(player);

    // Network sync
    network.sendMove(player);

    // Item use (food)
    if (player.keys && player.keys['KeyF']) {
      const item = inv.getHotbarItem();
      if (item?.itemDef?.food) {
        player.eat(item.itemDef.food);
        inv.removeItem(inv.hotbarIndex, 1);
      }
    }

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
