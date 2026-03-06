// ─── Mob system ─────────────────────────────────────────────────────────
const MOB_TYPES = {
  ZOMBIE:   { name:'Zombie',   health:20, damage:2, speed:2.5, hostile:true,  color:0x2a6e2a, passive:false },
  SKELETON: { name:'Skeleton', health:20, damage:3, speed:3,   hostile:true,  color:0xdddddd, passive:false },
  CREEPER:  { name:'Creeper',  health:20, damage:10,speed:2.8, hostile:true,  color:0x2a8a2a, passive:false },
  PIG:      { name:'Pig',      health:10, damage:0, speed:1.8, hostile:false, color:0xffb6c1, passive:true  },
  COW:      { name:'Cow',      health:10, damage:0, speed:1.5, hostile:false, color:0x444444, passive:true  },
  SHEEP:    { name:'Sheep',    health:8,  damage:0, speed:1.8, hostile:false, color:0xffffff, passive:true  },
};

class Mob {
  constructor(type, x, y, z, scene) {
    this.type = type;
    this.def = MOB_TYPES[type];
    this.x = x; this.y = y; this.z = z;
    this.vy = 0;
    this.health = this.def.health;
    this.alive = true;
    this._aiTimer = Math.random() * 2;
    this._targetX = x; this._targetZ = z;
    this._attackTimer = 0;
    this._exploding = false;
    this._explodeTimer = 0;

    // Mesh
    const w = 0.6, h = 1.8;
    const geom = new THREE.BoxGeometry(w, h, w);
    const mat = new THREE.MeshLambertMaterial({ color: this.def.color });
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.position.set(x, y + h/2, z);
    scene.add(this.mesh);
    this._scene = scene;
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) this.die();
  }

  die() {
    this.alive = false;
    if (this._scene) this._scene.remove(this.mesh);
    // Drop loot
    if (window.inventory && window.player) {
      const dist = Math.hypot(this.x - window.player.x, this.z - window.player.z);
      if (dist < 4) {
        if (this.type === 'PIG') window.inventory.addItem({ id: ITEM_TYPES.PORK.id, count: 1+Math.floor(Math.random()*2), type:'item', itemDef: ITEM_TYPES.PORK });
        if (this.type === 'COW') window.inventory.addItem({ id: ITEM_TYPES.BEEF.id, count: 1+Math.floor(Math.random()*2), type:'item', itemDef: ITEM_TYPES.BEEF });
        if (this.type === 'SKELETON') window.inventory.addItem({ id: ITEM_TYPES.COAL.id, count: Math.floor(Math.random()*3), type:'item', itemDef: ITEM_TYPES.COAL });
        if (this.type === 'ZOMBIE') window.inventory.addItem({ id: ITEM_TYPES.BREAD.id, count: 1, type:'item', itemDef: ITEM_TYPES.BREAD });
      }
    }
  }

  update(dt, world, player) {
    if (!this.alive) return;

    // Gravity
    this.vy += -22 * dt;
    this.y += this.vy * dt;

    // Ground check
    const by = Math.floor(this.y - 0.1);
    const bBelow = world.getBlock(Math.floor(this.x), by, Math.floor(this.z));
    const props = BLOCK_PROPS[bBelow];
    if (props && props.solid) {
      this.y = by + 1;
      this.vy = 0;
      // Random jump
      if (Math.random() < 0.01) this.vy = 7;
    }

    // AI
    this._aiTimer -= dt;
    if (this._aiTimer <= 0) {
      this._aiTimer = 1 + Math.random() * 2;
      this._pickTarget(player);
    }

    // Move toward target
    const dx = this._targetX - this.x;
    const dz = this._targetZ - this.z;
    const dist = Math.sqrt(dx*dx+dz*dz);
    if (dist > 0.5) {
      const speed = this.def.speed;
      this.x += (dx/dist) * speed * dt;
      this.z += (dz/dist) * speed * dt;
    }

    // Creeper: explode near player
    if (this.type === 'CREEPER' && player.alive) {
      const pdist = Math.hypot(this.x-player.x, this.z-player.z);
      if (pdist < 2) {
        this._explodeTimer += dt;
        if (this._explodeTimer > 1.5) {
          // Explode
          player.takeDamage(this.def.damage, 'was blown up by a Creeper');
          // Destroy nearby blocks
          for (let dy=-1;dy<=1;dy++) for (let ex=-2;ex<=2;ex++) for (let ez=-2;ez<=2;ez++) {
            world.setBlock(Math.floor(this.x)+ex, Math.floor(this.y)+dy, Math.floor(this.z)+ez, BLOCKS.AIR);
          }
          this.die();
          return;
        }
      } else {
        this._explodeTimer = 0;
      }
    }

    // Attack player if close
    if (this.def.hostile && player.alive) {
      const pdist = Math.hypot(this.x-player.x, this.z-player.z);
      if (pdist < 1.2) {
        this._attackTimer -= dt;
        if (this._attackTimer <= 0) {
          this._attackTimer = 1.5;
          player.takeDamage(this.def.damage, `attacked by ${this.def.name}`);
        }
      }
    }

    // Update mesh
    this.mesh.position.set(this.x, this.y + 0.9, this.z);
    const angle = Math.atan2(this._targetX - this.x, this._targetZ - this.z);
    this.mesh.rotation.y = angle;
  }

  _pickTarget(player) {
    if (this.def.hostile && player.alive) {
      const d = Math.hypot(this.x-player.x, this.z-player.z);
      if (d < 20) {
        this._targetX = player.x;
        this._targetZ = player.z;
        return;
      }
    }
    // Wander
    this._targetX = this.x + (Math.random()-0.5)*10;
    this._targetZ = this.z + (Math.random()-0.5)*10;
  }
}

class MobManager {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.mobs = [];
    this._spawnTimer = 5;
    this._maxMobs = 20;
  }

  update(dt) {
    // Update existing mobs
    for (let i = this.mobs.length-1; i >= 0; i--) {
      const mob = this.mobs[i];
      if (!mob.alive) { this.mobs.splice(i,1); continue; }
      mob.update(dt, this.world, this.player);
    }

    // Spawn
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0 && this.mobs.length < this._maxMobs) {
      this._spawnTimer = 8 + Math.random()*12;
      this._spawnMob();
    }
  }

  _spawnMob() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 16 + Math.random() * 16;
    const sx = this.player.x + Math.cos(angle)*dist;
    const sz = this.player.z + Math.sin(angle)*dist;
    const sy = this.world.getSurfaceY(Math.floor(sx), Math.floor(sz));

    // Hostile mobs spawn at night or underground, passive anytime
    const isDay = window.dayTime !== undefined && window.dayTime > 0.25 && window.dayTime < 0.75;
    const types = isDay
      ? ['PIG','COW','SHEEP','ZOMBIE']
      : ['ZOMBIE','SKELETON','CREEPER','ZOMBIE','ZOMBIE'];
    const type = types[Math.floor(Math.random()*types.length)];
    this.mobs.push(new Mob(type, sx, sy, sz, this.scene));
  }

  hitMob(x, y, z, damage) {
    for (const mob of this.mobs) {
      if (!mob.alive) continue;
      const d = Math.hypot(mob.x-x, mob.y-y, mob.z-z);
      if (d < 1.5) {
        mob.takeDamage(damage);
        return true;
      }
    }
    return false;
  }
}
