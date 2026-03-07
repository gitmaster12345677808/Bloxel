// Lightweight client-side dropped item entities.
class ItemEntityManager {
  constructor(scene, world, inventory, player) {
    this.scene = scene;
    this.world = world;
    this.inventory = inventory;
    this.player = player;
    this.items = [];
  }

  _getHeldKind(item) {
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
  }

  _getTextureImageData(texture) {
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
  }

  _buildVoxelItemMesh(texture, kind) {
    const imageData = this._getTextureImageData(texture);
    if (!imageData) return null;

    const { data, width, height } = imageData;
    const group = new THREE.Group();
    const isTool = kind === 'sword' || kind === 'pickaxe' || kind === 'axe' || kind === 'shovel' || kind === 'hoe';
    const pixelSize = isTool ? 0.03 : 0.026;
    const depth = isTool ? 0.06 : 0.05;
    const ox = -(width * pixelSize) * 0.5 + pixelSize * 0.5;
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
          matCache.set(key, mat);
        }
        const px = ox + x * pixelSize;
        const py = oy - y * pixelSize;
        const voxel = new THREE.Mesh(geom, mat);
        voxel.position.set(px, py, 0);
        group.add(voxel);
      }
    }

    if (!group.children.length) {
      geom.dispose();
      matCache.forEach((m) => m.dispose());
      return null;
    }

    return group;
  }

  _makeDropObject(item) {
    if (item.type === 'block') {
      const tex = blockTextures[item.id] || null;
      const mat = new THREE.MeshLambertMaterial({ map: tex, color: tex ? 0xffffff : 0xb0b0b0, transparent: true });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), mat);
      mesh.rotation.set(0.06, 0.78, 0.0);
      return mesh;
    }

    const tex = itemTextures[item.id] || null;
    const kind = this._getHeldKind(item);
    const voxel = this._buildVoxelItemMesh(tex, kind);
    if (voxel) {
      voxel.scale.setScalar(1.22);
      const isLongTool = kind === 'sword' || kind === 'pickaxe' || kind === 'axe' || kind === 'shovel' || kind === 'hoe';
      voxel.position.set(0.0, isLongTool ? -0.06 : -0.02, 0.0);
      return voxel;
    }

    const fallbackMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    return new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.08), fallbackMat);
  }

  _disposeObject(obj) {
    if (!obj) return;
    obj.traverse((node) => {
      if (!node.isMesh) return;
      if (node.geometry) node.geometry.dispose();
      const mat = node.material;
      if (Array.isArray(mat)) mat.forEach((m) => m && m.dispose && m.dispose());
      else if (mat && mat.dispose) mat.dispose();
    });
  }

  spawnDrop(x, y, z, item) {
    if (!item || !item.id) return;
    const mesh = this._makeDropObject(item);
    const fx = Number(x) || 0;
    const fy = Number(y) || 0;
    const fz = Number(z) || 0;
    mesh.position.set(fx, fy + 0.35, fz);
    this.scene.add(mesh);

    this.items.push({
      mesh,
      item: { ...item, count: Math.max(1, Math.floor(item.count || 1)) },
      vx: Number(item.vx) || 0,
      vz: Number(item.vz) || 0,
      vy: Number(item.vy) || 1.5,
      age: 0,
      pickupDelay: 0.45,
    });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const ent = this.items[i];
      ent.age += dt;
      ent.pickupDelay = Math.max(0, (ent.pickupDelay || 0) - dt);

      ent.vy += -9 * dt;
      ent.mesh.position.x += ent.vx * dt;
      ent.mesh.position.y += ent.vy * dt;
      ent.mesh.position.z += ent.vz * dt;

      // Air drag so thrown items arc then settle.
      const drag = Math.max(0, 1 - dt * 2.2);
      ent.vx *= drag;
      ent.vz *= drag;

      const bx = Math.floor(ent.mesh.position.x);
      const by = Math.floor(ent.mesh.position.y - 0.2);
      const bz = Math.floor(ent.mesh.position.z);
      const b = this.world.getBlock(bx, by, bz);
      const props = BLOCK_PROPS[b] || {};
      if (props.solid) {
        ent.mesh.position.y = by + 1.18;
        if (ent.vy < -1.2) {
          ent.vy *= -0.28;
        } else {
          ent.vy = 0;
        }
        ent.vx *= 0.72;
        ent.vz *= 0.72;
      }

      ent.mesh.rotation.y += dt * 1.6;
      ent.mesh.position.y += Math.sin(ent.age * 4) * 0.0015;

      const dx = ent.mesh.position.x - this.player.x;
      const dy = ent.mesh.position.y - (this.player.y + 0.9);
      const dz = ent.mesh.position.z - this.player.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (ent.pickupDelay <= 0 && distSq < 1.7) {
        const added = this.inventory.addItem({ ...ent.item });
        if (added >= 0) {
          this.scene.remove(ent.mesh);
          this._disposeObject(ent.mesh);
          this.items.splice(i, 1);
          continue;
        }
      }

      if (ent.age > 120) {
        this.scene.remove(ent.mesh);
        this._disposeObject(ent.mesh);
        this.items.splice(i, 1);
      }
    }
  }
}
