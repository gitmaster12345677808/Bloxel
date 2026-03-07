// ─── Player controller ──────────────────────────────────────────────────
class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;

    // Position & rotation
    this.x = 0; this.y = 72; this.z = 0;
    this.vy = 0;        // vertical velocity
    this.rx = 0;        // pitch (vertical look)
    this.ry = 0;        // yaw (horizontal look)

    // Physics
    this.onGround = false;
    this.height = 1.8;
    this.radius = 0.3;
    this.speed = 5;
    this.jumpVel = 9;
    this.gravity = -22;

    // Stats
    this.health = 20;
    this.maxHealth = 20;
    this.hunger = 20;
    this.maxHunger = 20;
    this.alive = true;
    this._hungerTimer = 0;
    this._regenTimer = 0;
    this._damageTimer = 0;
    this._lavaTimer = 0;
    this._starveTimer = 0;
    this._isMovingHoriz = false;
    this._fallStartY = null;

    // Block interaction
    this.breakProgress = 0;
    this.breakTarget = null;
    this.breaking = false;
    this.placing = false;
    this._placeTimer = 0;

    // Input state
    this.keys = {};
    this.mouseDelta = { x: 0, y: 0 };
    this.sensitivity = 0.002;
    this.locked = false;

    // Mobile input overlay
    this.joystick = { x: 0, y: 0 };

    this._bindInput();
  }

  _bindInput() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      this.keys[e.code] = true;
    });
    document.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });

    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.mouseDelta.x += e.movementX;
      this.mouseDelta.y += e.movementY;
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = !!document.pointerLockElement;
    });
  }

  lock() {
    const canvas = document.getElementById('gameCanvas');
    canvas.requestPointerLock();
  }

  spawn(x, y, z) {
    this.x = x; this.y = y; this.z = z;
    this.vy = 0;
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.alive = true;
    this.breakProgress = 0;
    this.breakTarget = null;
    this._fallStartY = null;
  }

  takeDamage(amount, msg) {
    if (!this.alive) return;
    let finalAmount = amount;
    if (window.inventory && window.inventory.getArmorReduction) {
      const reduction = window.inventory.getArmorReduction();
      finalAmount = Math.max(1, Math.ceil(amount * (1 - reduction)));
      if (window.inventory.damageEquippedArmor) {
        window.inventory.damageEquippedArmor(Math.max(1, Math.ceil(amount * 0.5)));
      }
    }
    this._damageTimer = 0.5;
    if (window.ui) window.ui.flashDamage();
    this.health = Math.max(0, this.health - finalAmount);
    if (this.health <= 0) this.die(msg || 'Unknown cause');
  }

  die(msg) {
    this.alive = false;
    if (window.ui) window.ui.showDeathScreen(msg);
  }

  update(dt) {
    if (!this.alive) return;
    this._updateLook(dt);
    this._updateMovement(dt);
    this._updateStats(dt);
    this._updateCamera();
  }

  _updateLook(dt) {
    // Mouse
    const dx = this.mouseDelta.x * this.sensitivity;
    const dy = this.mouseDelta.y * this.sensitivity;
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;

    this.ry -= dx;
    this.rx -= dy;
    this.rx = MathUtils.clamp(this.rx, -Math.PI/2 + 0.01, Math.PI/2 - 0.01);
  }

  _updateMovement(dt) {
    const inWater = this._isTouchingWater();
    const baseSpeed = (this.hunger <= 0) ? this.speed * 0.5 : this.speed;
    const speed = inWater ? baseSpeed * 0.5 : baseSpeed;
    const forward = new THREE.Vector3(-Math.sin(this.ry), 0, -Math.cos(this.ry));
    const right   = new THREE.Vector3( Math.cos(this.ry), 0, -Math.sin(this.ry));
    const move = new THREE.Vector3();

    // Keyboard
    if (this.keys['KeyW'] || this.joystick.y > 0.2) move.addScaledVector(forward, 1);
    if (this.keys['KeyS'] || this.joystick.y < -0.2) move.addScaledVector(forward, -1);
    if (this.keys['KeyA'] || this.joystick.x < -0.2) move.addScaledVector(right, -1);
    if (this.keys['KeyD'] || this.joystick.x > 0.2) move.addScaledVector(right, 1);

    this._isMovingHoriz = move.lengthSq() > 0;
    if (this._isMovingHoriz) {
      move.normalize().multiplyScalar(speed * dt);
    }

    if (inWater) {
      // Water movement: reduced gravity and strong drag for swimmable controls.
      this.vy += this.gravity * 0.12 * dt;
      this.vy *= 0.88;
      this.vy = MathUtils.clamp(this.vy, -4.2, 4.2);

      const swimUp = this.keys['Space'] || this.jumpPressed;
      const swimDown = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
      if (swimUp) this.vy = 4.2;
      else if (swimDown) this.vy = -3.8;
    } else {
      // Apply gravity
      this.vy += this.gravity * dt;
      if (this.vy < -50) this.vy = -50;

      // Jump
      if ((this.keys['Space'] || this.jumpPressed) && this.onGround) {
        this.vy = this.jumpVel;
        this.onGround = false;
      }
    }
    this.jumpPressed = false;

    // Collide & move
    this._moveAndCollide(move.x, this.vy * dt, move.z);
  }

  _moveAndCollide(dx, dy, dz) {
    const wasOnGround = this.onGround;

    // Move in each axis separately
    this.x += dx;
    if (this._checkCollision()) this.x -= dx;

    this.y += dy;
    const wasDown = dy < 0;
    if (this._checkCollision()) {
      this.y -= dy;
      if (wasDown) {
        this.onGround = true;
        if (!wasOnGround && this._fallStartY !== null && !this._isTouchingWater()) {
          const fallen = this._fallStartY - this.y;
          if (fallen > 3.2) {
            const damage = Math.floor((fallen - 3) * 1.25);
            if (damage > 0) this.takeDamage(damage, 'Fell from a high place');
          }
        }
        this._fallStartY = null;
      }
      this.vy = 0;
    } else {
      if (wasDown) {
        this.onGround = false;
        if (this._fallStartY === null) this._fallStartY = this.y;
      }
    }

    this.z += dz;
    if (this._checkCollision()) this.z -= dz;

    // Void damage
    if (this.y < 0) {
      this._fallStartY = null;
      this.takeDamage(1, 'Fell into the void');
    }
  }

  _checkCollision() {
    const r = this.radius;
    for (let dx of [-r, r]) {
      for (let dz of [-r, r]) {
        for (let dy of [0, 0.9, 1.7]) {
          const bx=Math.floor(this.x+dx), by=Math.floor(this.y+dy), bz=Math.floor(this.z+dz);
          const b = this.world.getBlock(bx,by,bz);
          const props = BLOCK_PROPS[b];
          if (props && props.solid && !props.liquid) return true;
        }
      }
    }
    return false;
  }

  _updateStats(dt) {
    if (this._damageTimer > 0) this._damageTimer -= dt;

    if (this._isTouchingLava()) {
      this._lavaTimer += dt;
      if (this._lavaTimer >= 1.0) {
        this._lavaTimer = 0;
        this.takeDamage(4, 'Tried to swim in lava');
      }
    } else {
      this._lavaTimer = 0;
    }

    // Hunger drain scales with movement and action.
    const hungerRate = this._isMovingHoriz ? 1.4 : 0.7;
    this._hungerTimer += dt * hungerRate;
    if (this._hungerTimer > 28) {
      this._hungerTimer = 0;
      if (this.hunger > 0) this.hunger = Math.max(0, this.hunger - 0.5);
    }

    // Health regen if hunger is high enough; regen slowly and consumes hunger.
    if (this.hunger >= 16 && this.health < this.maxHealth) {
      this._regenTimer += dt;
      if (this._regenTimer > 2.5) {
        this._regenTimer = 0;
        this.health = Math.min(this.maxHealth, this.health + 1);
        this.hunger = Math.max(0, this.hunger - 0.2);
      }
    } else {
      this._regenTimer = 0;
    }

    // Starve damage
    if (this.hunger <= 0 && this.health > 1) {
      this._starveTimer += dt;
      if (this._starveTimer > 4) {
        this._starveTimer = 0;
        this.takeDamage(1, 'Starved to death');
      }
    } else {
      this._starveTimer = 0;
    }
  }

  _isTouchingLava() {
    const sampleHeights = [0.1, 0.9, 1.6];
    const r = this.radius * 0.9;
    const sampleXZ = [[0,0], [r,0], [-r,0], [0,r], [0,-r]];

    for (const [ox, oz] of sampleXZ) {
      for (const sy of sampleHeights) {
        const bx = Math.floor(this.x + ox);
        const by = Math.floor(this.y + sy);
        const bz = Math.floor(this.z + oz);
        if (this.world.getBlock(bx, by, bz) === BLOCKS.LAVA) return true;
      }
    }
    return false;
  }

  _isTouchingWater() {
    const sampleHeights = [0.1, 0.9, 1.6];
    const r = this.radius * 0.9;
    const sampleXZ = [[0,0], [r,0], [-r,0], [0,r], [0,-r]];

    for (const [ox, oz] of sampleXZ) {
      for (const sy of sampleHeights) {
        const bx = Math.floor(this.x + ox);
        const by = Math.floor(this.y + sy);
        const bz = Math.floor(this.z + oz);
        if (this.world.getBlock(bx, by, bz) === BLOCKS.WATER) return true;
      }
    }
    return false;
  }

  eat(foodPoints) {
    this.hunger = Math.min(this.maxHunger, this.hunger + foodPoints);
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  _updateCamera() {
    this.camera.position.set(this.x, this.y + this.height, this.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.ry;
    this.camera.rotation.x = this.rx;
  }

  getLookDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(this.rx, this.ry, 0, 'YXZ'));
    return dir;
  }

  getLookOrigin() {
    return new THREE.Vector3(this.x, this.y + this.height * 0.9, this.z);
  }

  startBreaking() { this.breaking = true; }
  stopBreaking()  { this.breaking = false; this.breakProgress = 0; this.breakTarget = null; }
  startPlacing()  { this.placing = true; }
  stopPlacing()   { this.placing = false; }

  updateBreaking(dt, inventory) {
    if (!this.breaking || !this.alive) {
      this.breakProgress = 0;
      this.breakTarget = null;
      return null;
    }

    const hit = this.world.raycast(this.getLookOrigin(), this.getLookDirection());
    if (!hit) {
      this.breakProgress = 0;
      this.breakTarget = null;
      return null;
    }

    const key = `${hit.bx},${hit.by},${hit.bz}`;
    if (!this.breakTarget || this.breakTarget.key !== key) {
      this.breakProgress = 0;
      this.breakTarget = { key, ...hit };
    }

    const block = hit.block;
    const props = BLOCK_PROPS[block] || {};
    if (props.hardness === Infinity) { this.breakProgress = 0; return null; }

    // Minecraft-like mining rules: some blocks require tools to break,
    // and some require a minimum tier to drop themselves.
    let speed = 1;
    let heldItem = null;
    let tool = this._getHeldToolInfo(null);
    if (inventory) {
      heldItem = inventory.getHotbarItem();
      tool = this._getHeldToolInfo(heldItem);
      if (heldItem && heldItem.speed) speed = heldItem.speed;
    }

    const rule = this._getBlockMiningRule(block);
    if (!this._canBreakBlockNow(rule, tool)) {
      this.breakProgress = 0;
      return null;
    }

    if (rule.requiredTool && tool.type !== rule.requiredTool) {
      speed *= 0.35;
    }

    const dropsWithCurrentTool = this._canHarvestBlockDrop(rule, tool);

    this.breakProgress += dt * speed;
    const hardness = props.hardness || 1;
    if (this.breakProgress >= hardness) {
      this.breakProgress = 0;
      this.breakTarget = null;
      return { ...hit, dropsWithCurrentTool };
    }
    return null;
  }

  _getHeldToolInfo(heldItem) {
    const name = String(heldItem?.itemDef?.name || '').toLowerCase();
    let type = 'hand';
    if (name.includes('pickaxe')) type = 'pickaxe';
    else if (name.includes('shovel')) type = 'shovel';
    else if (name.includes('axe')) type = 'axe';
    else if (name.includes('sword')) type = 'sword';

    let tier = 0;
    if (name.includes('wood')) tier = 1;
    else if (name.includes('stone')) tier = 2;
    else if (name.includes('iron')) tier = 3;
    else if (name.includes('diamond')) tier = 4;

    return { type, tier };
  }

  _getBlockMiningRule(blockId) {
    const rules = {
      [BLOCKS.STONE]: { requiredTool: 'pickaxe', minTier: 1, handBreakable: false },
      [BLOCKS.COBBLESTONE]: { requiredTool: 'pickaxe', minTier: 1, handBreakable: false },
      [BLOCKS.COAL_ORE]: { requiredTool: 'pickaxe', minTier: 1, handBreakable: false },
      [BLOCKS.IRON_ORE]: { requiredTool: 'pickaxe', minTier: 2, handBreakable: false },
      [BLOCKS.GOLD_ORE]: { requiredTool: 'pickaxe', minTier: 3, handBreakable: false },
      [BLOCKS.DIAMOND_ORE]: { requiredTool: 'pickaxe', minTier: 3, handBreakable: false },
      [BLOCKS.OBSIDIAN]: { requiredTool: 'pickaxe', minTier: 4, handBreakable: false },
      [BLOCKS.FURNACE]: { requiredTool: 'pickaxe', minTier: 1, handBreakable: false },
      [BLOCKS.BRICK]: { requiredTool: 'pickaxe', minTier: 1, handBreakable: false },
      [BLOCKS.BEDROCK]: { requiredTool: null, minTier: 999, handBreakable: false },
    };

    return rules[blockId] || { requiredTool: null, minTier: 0, handBreakable: true };
  }

  _canBreakBlockNow(rule, tool) {
    if (!rule.requiredTool) return true;
    if (tool.type === rule.requiredTool) return true;
    return !!rule.handBreakable;
  }

  _canHarvestBlockDrop(rule, tool) {
    if (!rule.requiredTool) return true;
    if (tool.type !== rule.requiredTool) return false;
    return tool.tier >= rule.minTier;
  }

  updatePlacing(dt, inventory, lastPlaceHit) {
    if (!this.placing || !this.alive) { this._placeTimer = 0; return null; }
    this._placeTimer -= dt;
    if (this._placeTimer > 0) return null;
    this._placeTimer = 0.25;

    const hit = this.world.raycast(this.getLookOrigin(), this.getLookDirection());
    if (!hit) return null;
    // Prevent placing inside player
    const px=hit.bx+hit.nx, py=hit.by+hit.ny, pz=hit.bz+hit.nz;
    const ppx=Math.floor(this.x), ppy=Math.floor(this.y), ppz=Math.floor(this.z);
    if (px===ppx && (py===ppy||py===ppy+1) && pz===ppz) return null;
    return { px, py, pz, ...hit };
  }
}
