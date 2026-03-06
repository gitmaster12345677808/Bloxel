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
  }

  takeDamage(amount, msg) {
    if (!this.alive) return;
    this._damageTimer = 0.5;
    this.health = Math.max(0, this.health - amount);
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
    const speed = (this.hunger <= 0) ? this.speed * 0.5 : this.speed;
    const forward = new THREE.Vector3(-Math.sin(this.ry), 0, -Math.cos(this.ry));
    const right   = new THREE.Vector3( Math.cos(this.ry), 0, -Math.sin(this.ry));
    const move = new THREE.Vector3();

    // Keyboard
    if (this.keys['KeyW'] || this.joystick.y > 0.2) move.addScaledVector(forward, 1);
    if (this.keys['KeyS'] || this.joystick.y < -0.2) move.addScaledVector(forward, -1);
    if (this.keys['KeyA'] || this.joystick.x < -0.2) move.addScaledVector(right, -1);
    if (this.keys['KeyD'] || this.joystick.x > 0.2) move.addScaledVector(right, 1);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
    }

    // Apply gravity
    this.vy += this.gravity * dt;
    if (this.vy < -50) this.vy = -50;

    // Jump
    if ((this.keys['Space'] || this.jumpPressed) && this.onGround) {
      this.vy = this.jumpVel;
      this.onGround = false;
      this.jumpPressed = false;
    }

    // Collide & move
    this._moveAndCollide(move.x, this.vy * dt, move.z);
  }

  _moveAndCollide(dx, dy, dz) {
    // Move in each axis separately
    this.x += dx;
    if (this._checkCollision()) this.x -= dx;

    this.y += dy;
    const wasDown = dy < 0;
    if (this._checkCollision()) {
      this.y -= dy;
      if (wasDown) {
        this.onGround = true;
        // Fall damage
        if (this.vy < -18) this.takeDamage(Math.floor((-this.vy - 18) * 0.5), 'Fell from a high place');
      }
      this.vy = 0;
    } else {
      if (wasDown) this.onGround = false;
    }

    this.z += dz;
    if (this._checkCollision()) this.z -= dz;

    // Void damage
    if (this.y < 0) this.takeDamage(1, 'Fell into the void');
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

    // Hunger drain
    this._hungerTimer += dt;
    if (this._hungerTimer > 20) {
      this._hungerTimer = 0;
      if (this.hunger > 0) this.hunger = Math.max(0, this.hunger - 0.5);
    }

    // Health regen if hunger > 18
    if (this.hunger >= 18 && this.health < this.maxHealth) {
      this._regenTimer += dt;
      if (this._regenTimer > 1) {
        this._regenTimer = 0;
        this.health = Math.min(this.maxHealth, this.health + 1);
      }
    } else {
      this._regenTimer = 0;
    }

    // Starve damage
    if (this.hunger <= 0 && this.health > 1) {
      this._hungerTimer -= dt * 2;
      if (this._hungerTimer < -5) {
        this._hungerTimer = 0;
        this.takeDamage(1, 'Starved to death');
      }
    }
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

    // Tool speed
    let speed = 1;
    if (inventory) {
      const item = inventory.getHotbarItem();
      if (item && item.speed) speed = item.speed;
    }

    this.breakProgress += dt * speed;
    const hardness = props.hardness || 1;
    if (this.breakProgress >= hardness) {
      this.breakProgress = 0;
      this.breakTarget = null;
      return hit;
    }
    return null;
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
