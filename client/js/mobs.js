// Mob system with simple multi-part models, hitboxes, and damage flash.
const MOB_TYPES = {
  ZOMBIE:   { name:'Zombie',   health:20, damage:2, speed:2.5, hostile:true,  passive:false, skin:'#5b9f4a', shirt:'#2f5f8b', pants:'#2f4564' },
  SKELETON: { name:'Skeleton', health:20, damage:3, speed:3.0, hostile:true,  passive:false, skin:'#d6d6d6', shirt:'#a8a8a8', pants:'#8f8f8f' },
  CREEPER:  { name:'Creeper',  health:20, damage:10, speed:2.8, hostile:true,  passive:false, skin:'#50a04c', shirt:'#417f3f', pants:'#366a34' },
  PIG:      { name:'Pig',      health:10, damage:0, speed:1.8, hostile:false, passive:true,  skin:'#e5a7b5', shirt:'#d994a5', pants:'#cf889b' },
  COW:      { name:'Cow',      health:10, damage:0, speed:1.5, hostile:false, passive:true,  skin:'#6b4d3c', shirt:'#4d3a2e', pants:'#3f2f24' },
  SHEEP:    { name:'Sheep',    health:8,  damage:0, speed:1.8, hostile:false, passive:true,  skin:'#f0f0f0', shirt:'#d4d4d4', pants:'#bababa' },
};

function makePart(w, h, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  return mesh;
}

class Mob {
  constructor(type, x, y, z, scene) {
    this.type = type;
    this.def = MOB_TYPES[type];
    this.x = x;
    this.y = y;
    this.z = z;
    this.vy = 0;
    this.health = this.def.health;
    this.alive = true;
    this._aiTimer = Math.random() * 2;
    this._targetX = x;
    this._targetZ = z;
    this._attackTimer = 0;
    this._explodeTimer = 0;
    this._walkPhase = Math.random() * Math.PI * 2;
    this._damageFlash = 0;

    this.hitbox = { halfW: 0.35, halfD: 0.35, height: 1.8 };

    this.mesh = new THREE.Group();
    this.mesh.position.set(x, y, z);

    this.head = makePart(0.58, 0.58, 0.58, this.def.skin);
    this.head.position.set(0, 1.53, 0);
    this.body = makePart(0.62, 0.72, 0.36, this.def.shirt);
    this.body.position.set(0, 1.0, 0);
    this.leftArm = makePart(0.22, 0.72, 0.22, this.def.skin);
    this.leftArm.position.set(-0.42, 1.0, 0);
    this.rightArm = makePart(0.22, 0.72, 0.22, this.def.skin);
    this.rightArm.position.set(0.42, 1.0, 0);
    this.leftLeg = makePart(0.24, 0.72, 0.24, this.def.pants);
    this.leftLeg.position.set(-0.18, 0.28, 0);
    this.rightLeg = makePart(0.24, 0.72, 0.24, this.def.pants);
    this.rightLeg.position.set(0.18, 0.28, 0);

    this.mesh.add(this.head, this.body, this.leftArm, this.rightArm, this.leftLeg, this.rightLeg);
    scene.add(this.mesh);
    this._scene = scene;
    this._materials = [];
    this.mesh.traverse((obj) => {
      if (obj.isMesh && obj.material) this._materials.push(obj.material);
    });
  }

  getAabb() {
    return {
      min: new THREE.Vector3(this.x - this.hitbox.halfW, this.y, this.z - this.hitbox.halfD),
      max: new THREE.Vector3(this.x + this.hitbox.halfW, this.y + this.hitbox.height, this.z + this.hitbox.halfD),
    };
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.health -= amount;
    this._damageFlash = 0.22;
    if (this.health <= 0) this.die();
  }

  _updateDamageFlash(dt) {
    if (this._damageFlash > 0) {
      this._damageFlash = Math.max(0, this._damageFlash - dt);
      for (const mat of this._materials) {
        if (!mat) continue;
        mat.emissive = mat.emissive || new THREE.Color(0x000000);
        mat.emissive.setRGB(0.85, 0.08, 0.08);
        mat.emissiveIntensity = 0.9;
      }
      return;
    }

    for (const mat of this._materials) {
      if (!mat) continue;
      mat.emissiveIntensity = 0;
    }
  }

  die() {
    this.alive = false;
    if (this._scene) this._scene.remove(this.mesh);
    if (window.itemEntities) {
      if (this.type === 'PIG') {
        window.itemEntities.spawnDrop(this.x, this.y, this.z, { id: ITEM_TYPES.PORK.id, count: 1 + Math.floor(Math.random() * 3), type:'item', itemDef: ITEM_TYPES.PORK });
      }
      if (this.type === 'COW') {
        window.itemEntities.spawnDrop(this.x, this.y, this.z, { id: ITEM_TYPES.BEEF.id, count: 1 + Math.floor(Math.random() * 3), type:'item', itemDef: ITEM_TYPES.BEEF });
      }
      if (this.type === 'SKELETON' && Math.random() < 0.8) {
        window.itemEntities.spawnDrop(this.x, this.y, this.z, { id: ITEM_TYPES.COAL.id, count: Math.floor(Math.random() * 2) + 1, type:'item', itemDef: ITEM_TYPES.COAL });
      }
      if (this.type === 'ZOMBIE' && Math.random() < 0.45) {
        window.itemEntities.spawnDrop(this.x, this.y, this.z, { id: ITEM_TYPES.BREAD.id, count: 1, type:'item', itemDef: ITEM_TYPES.BREAD });
      }
      if (this.type === 'ZOMBIE' && Math.random() < 0.35) {
        const crop = Math.random() < 0.5 ? ITEM_TYPES.CARROT : ITEM_TYPES.POTATO;
        window.itemEntities.spawnDrop(this.x, this.y, this.z, { id: crop.id, count: 1, type:'item', itemDef: crop });
      }
      if (this.type === 'CREEPER' && Math.random() < 0.5) {
        window.itemEntities.spawnDrop(this.x, this.y, this.z, { id: ITEM_TYPES.COAL.id, count: 1, type:'item', itemDef: ITEM_TYPES.COAL });
      }
    }
  }

  update(dt, world, player) {
    if (!this.alive) return;

    this.vy += -22 * dt;
    this.y += this.vy * dt;

    const groundY = world.getSurfaceY(Math.floor(this.x), Math.floor(this.z));
    if (this.y <= groundY) {
      this.y = groundY;
      this.vy = 0;
      if (Math.random() < 0.008) this.vy = 6.8;
    }

    this._aiTimer -= dt;
    if (this._aiTimer <= 0) {
      this._aiTimer = 0.9 + Math.random() * 1.6;
      this._pickTarget(player);
    }

    const dx = this._targetX - this.x;
    const dz = this._targetZ - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    let moving = false;
    if (dist > 0.35) {
      const speed = this.def.speed;
      this.x += (dx / dist) * speed * dt;
      this.z += (dz / dist) * speed * dt;
      moving = true;
    }

    if (this.type === 'CREEPER' && player.alive) {
      const pdist = Math.hypot(this.x - player.x, this.z - player.z);
      if (pdist < 2.1) {
        this._explodeTimer += dt;
        if (this._explodeTimer > 1.5) {
          player.takeDamage(this.def.damage, 'was blown up by a Creeper');
          for (let dy = -1; dy <= 1; dy++) {
            for (let ex = -2; ex <= 2; ex++) {
              for (let ez = -2; ez <= 2; ez++) {
                world.setBlock(Math.floor(this.x) + ex, Math.floor(this.y) + dy, Math.floor(this.z) + ez, BLOCKS.AIR);
              }
            }
          }
          this.die();
          return;
        }
      } else {
        this._explodeTimer = 0;
      }
    }

    if (this.def.hostile && player.alive) {
      const pdx = Math.abs(this.x - player.x);
      const pdz = Math.abs(this.z - player.z);
      const pdy = (player.y + player.height * 0.5) - (this.y + this.hitbox.height * 0.5);
      const inHitboxRange = pdx < (this.hitbox.halfW + player.radius + 0.45)
        && pdz < (this.hitbox.halfD + player.radius + 0.45)
        && Math.abs(pdy) < 1.25;

      if (inHitboxRange) {
        this._attackTimer -= dt;
        if (this._attackTimer <= 0) {
          this._attackTimer = 1.2;
          player.takeDamage(this.def.damage, `attacked by ${this.def.name}`);
        }
      }
    }

    this._walkPhase += moving ? dt * 9 : dt * 3;
    const swing = moving ? Math.sin(this._walkPhase) * 0.75 : 0;
    this.leftArm.rotation.x = swing;
    this.rightArm.rotation.x = -swing;
    this.leftLeg.rotation.x = -swing;
    this.rightLeg.rotation.x = swing;

    this.mesh.position.set(this.x, this.y, this.z);
    if (moving) {
      const angle = Math.atan2(this._targetX - this.x, this._targetZ - this.z);
      this.mesh.rotation.y = angle;
    }

    this._updateDamageFlash(dt);
  }

  _pickTarget(player) {
    if (this.def.hostile && player.alive) {
      const d = Math.hypot(this.x - player.x, this.z - player.z);
      if (d < 20) {
        this._targetX = player.x;
        this._targetZ = player.z;
        return;
      }
    }

    this._targetX = this.x + (Math.random() - 0.5) * 10;
    this._targetZ = this.z + (Math.random() - 0.5) * 10;
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
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      if (!mob.alive) {
        this.mobs.splice(i, 1);
        continue;
      }
      mob.update(dt, this.world, this.player);
    }

    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0 && this.mobs.length < this._maxMobs) {
      this._spawnTimer = 8 + Math.random() * 12;
      this._spawnMob();
    }
  }

  _spawnMob() {
    const angle = Math.random() * Math.PI * 2;
    const dist = 16 + Math.random() * 16;
    const sx = this.player.x + Math.cos(angle) * dist;
    const sz = this.player.z + Math.sin(angle) * dist;
    const sy = this.world.getSurfaceY(Math.floor(sx), Math.floor(sz));

    const isDay = window.dayTime !== undefined && window.dayTime > 0.25 && window.dayTime < 0.75;
    const types = isDay
      ? ['PIG', 'COW', 'SHEEP', 'PIG', 'COW']
      : ['ZOMBIE', 'SKELETON', 'CREEPER', 'ZOMBIE', 'SKELETON'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.mobs.push(new Mob(type, sx, sy, sz, this.scene));
  }

  hitByRay(origin, dir, damage, maxDist = 3.2) {
    let closest = null;
    let closestDist = Infinity;

    for (const mob of this.mobs) {
      if (!mob.alive) continue;
      const aabb = mob.getAabb();
      const t = MathUtils.rayAabbIntersect(origin, dir, aabb.min, aabb.max, maxDist);
      if (t === null) continue;
      if (t < closestDist) {
        closestDist = t;
        closest = mob;
      }
    }

    if (!closest) return false;
    closest.takeDamage(damage);
    return true;
  }
}
