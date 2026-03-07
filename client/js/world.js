// ─── World / Chunk System ────────────────────────────────────────────────
const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 128;
const DEFAULT_RENDER_DISTANCE = 4; // chunks in each direction
const MIN_RENDER_DISTANCE = 2;
const MAX_RENDER_DISTANCE = 10;

class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    this.mesh = null;
    this.dirty = true;

    const min = new THREE.Vector3(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    const max = new THREE.Vector3((cx + 1) * CHUNK_SIZE, CHUNK_HEIGHT, (cz + 1) * CHUNK_SIZE);
    this.bounds = new THREE.Box3(min, max);
  }

  idx(lx, y, lz) {
    return lx + CHUNK_SIZE * (y + CHUNK_HEIGHT * lz);
  }

  getBlock(lx, y, lz) {
    if (lx<0||lx>=CHUNK_SIZE||y<0||y>=CHUNK_HEIGHT||lz<0||lz>=CHUNK_SIZE) return BLOCKS.AIR;
    return this.blocks[this.idx(lx, y, lz)];
  }

  setBlock(lx, y, lz, id) {
    if (lx<0||lx>=CHUNK_SIZE||y<0||y>=CHUNK_HEIGHT||lz<0||lz>=CHUNK_SIZE) return;
    this.blocks[this.idx(lx, y, lz)] = id;
    this.dirty = true;
  }
}

class World {
  constructor(scene, seed) {
    this.scene = scene;
    this.seed = seed || 12345;
    this.noise = new SimplexNoise(this.seed);
    this.chunks = new Map();
    this.serverBlocks = {}; // overrides from server
    this.pendingMeshes = [];
    this._liquidLevels = new Map(); // "x,y,z" -> flow level (0=source-like)
    this._activeLiquids = new Set();
    this._liquidTick = 0;
    this._frustum = new THREE.Frustum();
    this._projScreenMatrix = new THREE.Matrix4();
    this.renderDistance = DEFAULT_RENDER_DISTANCE;

    // Terrain generation worker
    this._terrainWorker = new Worker('js/terrain-worker.js');
    this._pendingChunks = new Map(); // chunkKey -> requestId
    this._chunkRequestId = 0;
    this._workerReady = false;

    // Mesh building worker
    this._meshWorker = new Worker('js/mesh-worker.js');
    this._pendingMeshBuilds = new Map(); // chunkKey -> requestId
    this._meshRequestId = 0;

    this._terrainWorker.postMessage({ type: 'init', data: { seed: this.seed } });
    this._terrainWorker.onmessage = (e) => this._handleWorkerMessage(e);
    this._meshWorker.onmessage = (e) => this._handleMeshWorkerMessage(e);
  }

  setRenderDistance(value) {
    const v = Math.max(MIN_RENDER_DISTANCE, Math.min(MAX_RENDER_DISTANCE, Math.floor(Number(value) || DEFAULT_RENDER_DISTANCE)));
    if (v === this.renderDistance) return;
    this.renderDistance = v;
  }

  getRenderDistance() {
    return this.renderDistance;
  }

  _handleWorkerMessage(e) {
    const { type, data } = e.data;
    
    switch (type) {
      case 'init-complete':
        this._workerReady = true;
        break;
        
      case 'chunk-ready':
        const { cx, cz, blocks, requestId } = data;
        const key = this.chunkKey(cx, cz);
        
        // Check if this chunk is still needed (might have been unloaded)
        if (this._pendingChunks.get(key) === requestId) {
          this._pendingChunks.delete(key);
          
          // Create chunk object if it doesn't exist
          let chunk = this.chunks.get(key);
          if (!chunk) {
            chunk = new Chunk(cx, cz);
            this.chunks.set(key, chunk);
          }
          
          // Copy blocks data
          chunk.blocks = new Uint8Array(blocks);
          chunk.dirty = true;
          
          // Mark neighbor chunks as dirty
          const neighbors = [
            [cx - 1, cz],
            [cx + 1, cz],
            [cx, cz - 1],
            [cx, cz + 1],
          ];
          for (const [nx, nz] of neighbors) {
            const neighbor = this.getChunk(nx, nz);
            if (neighbor) neighbor.dirty = true;
          }
        }
        break;
    }
  }

  _handleMeshWorkerMessage(e) {
    const { type, data } = e.data;
    
    switch (type) {
      case 'mesh-ready':
        const { cx, cz, groups, requestId } = data;
        const key = this.chunkKey(cx, cz);
        
        // Check if this mesh is still needed
        if (this._pendingMeshBuilds.get(key) === requestId) {
          this._pendingMeshBuilds.delete(key);
          
          const chunk = this.chunks.get(key);
          if (!chunk) return; // Chunk was unloaded
          
          // Build Three.js objects from worker data (fast on main thread)
          const meshes = [];
          for (const [groupKey, g] of Object.entries(groups)) {
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.Float32BufferAttribute(g.positions, 3));
            geom.setAttribute('uv', new THREE.Float32BufferAttribute(g.uvs, 2));
            geom.setAttribute('normal', new THREE.Float32BufferAttribute(g.normals, 3));
            geom.setIndex(new THREE.Uint16BufferAttribute(g.indices, 1));
            const mat = getBlockMaterial(g.blockId, g.faceNormal);
            const mesh = new THREE.Mesh(geom, mat);
            // Cross plants (grass, crops) should render before held items
            const isCross = BLOCK_PROPS[g.blockId]?.cross || false;
            if (isCross) mesh.renderOrder = 100;
            meshes.push(mesh);
          }
          
          // Clean up old mesh
          if (chunk.mesh) {
            if (chunk.mesh.parent) chunk.mesh.parent.remove(chunk.mesh);
            chunk.mesh.traverse(o => {
              if (o.geometry) o.geometry.dispose();
            });
          }
          
          // Create new mesh group
          const group = new THREE.Group();
          for (const m of meshes) {
            m.frustumCulled = false;
            group.add(m);
          }
          chunk.mesh = group;
          chunk.dirty = false;
          this.scene.add(group);
        }
        break;
    }
  }

  chunkKey(cx, cz) { return `${cx},${cz}`; }
  posKey(x, y, z) { return `${x},${y},${z}`; }

  parsePosKey(key) {
    const [x, y, z] = key.split(',').map(Number);
    return { x, y, z };
  }

  getChunk(cx, cz) { return this.chunks.get(this.chunkKey(cx, cz)); }

  getOrCreateChunk(cx, cz) {
    const key = this.chunkKey(cx, cz);
    
    // If chunk already exists, return it
    if (this.chunks.has(key)) {
      return this.chunks.get(key);
    }
    
    // If chunk generation is already pending, return null (will be ready soon)
    if (this._pendingChunks.has(key)) {
      return null;
    }
    
    // Request chunk generation from worker
    if (this._workerReady) {
      const requestId = this._chunkRequestId++;
      this._pendingChunks.set(key, requestId);
      
      this._terrainWorker.postMessage({
        type: 'generate',
        data: {
          cx,
          cz,
          serverBlocks: this.serverBlocks,
          requestId
        }
      });
    }
    
    return null;
  }

  // ─── Terrain generation ───────────────────────────────────────────────
  _sampleTerrain(wx, wz) {
    const continental = this.noise.fbm(wx * 0.0012, wz * 0.0012, 3) * 0.5 + 0.5;
    const erosion = this.noise.fbm(wx * 0.0038, wz * 0.0038, 3) * 0.5 + 0.5;
    const ridges = Math.abs(this.noise.fbm(wx * 0.0026, wz * 0.0026, 4));
    const detail = this.noise.fbm(wx * 0.01, wz * 0.01, 4);
    const temp = this.noise.fbm(wx * 0.0025 + 1337, wz * 0.0025 - 741, 2) * 0.5 + 0.5;

    let h = 52;
    h += continental * 30;
    h += (1 - erosion) * 9;
    h += (ridges - 0.35) * 18;
    h += detail * 6;

    return {
      height: MathUtils.clamp(Math.round(h), 2, CHUNK_HEIGHT - 4),
      continental,
      erosion,
      ridges,
      temp,
    };
  }

  _biomeFromSample(s) {
    if (s.continental < 0.32) return 'ocean';
    if (s.ridges > 0.72 || s.height > 88) return 'mountains';
    if (s.temp < 0.27) return 'tundra';
    if (s.temp > 0.72 && s.erosion > 0.45) return 'desert';
    return 'plains';
  }

  getBiome(wx, wz) {
    return this._biomeFromSample(this._sampleTerrain(wx, wz));
  }

  getTerrainHeight(wx, wz) {
    return this._sampleTerrain(wx, wz).height;
  }

  // ─── Block get/set ─────────────────────────────────────────────────────
  getBlock(wx, wy, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BLOCKS.AIR;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getBlock(lx, wy, lz);
  }

  setBlock(wx, wy, wz, blockId) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getOrCreateChunk(cx, cz);
    
    // If chunk isn't loaded yet, it will be requested. 
    // Store the block change in serverBlocks so it's applied when chunk loads
    if (!chunk) {
      this.serverBlocks[`${wx},${wy},${wz}`] = blockId;
      return;
    }
    
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.setBlock(lx, wy, lz, blockId);

    const key = this.posKey(wx, wy, wz);
    const props = BLOCK_PROPS[blockId] || {};
    if (props.liquid) {
      if (!this._liquidLevels.has(key)) this._liquidLevels.set(key, 0);
      this._activeLiquids.add(key);
    } else {
      this._liquidLevels.delete(key);
    }

    this._activateLiquidNeighbors(wx, wy, wz);

    this.serverBlocks[`${wx},${wy},${wz}`] = blockId;

    // Re-mesh adjacent chunks if on border
    this.markAdjacentDirty(cx, cz, lx, lz);
  }

  _activateLiquidNeighbors(wx, wy, wz) {
    const checks = [
      [0, 0, 0],
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
      [0, 1, 0],
      [0, -1, 0],
    ];
    for (const [dx, dy, dz] of checks) {
      const x = wx + dx;
      const y = wy + dy;
      const z = wz + dz;
      const b = this.getBlock(x, y, z);
      const p = BLOCK_PROPS[b] || {};
      if (p.liquid) this._activeLiquids.add(this.posKey(x, y, z));
    }
  }

  _setLiquidBlock(wx, wy, wz, liquidBlock, level) {
    const cur = this.getBlock(wx, wy, wz);
    if (cur === liquidBlock) {
      const key = this.posKey(wx, wy, wz);
      const old = this._liquidLevels.get(key);
      if (old === undefined || level < old) this._liquidLevels.set(key, level);
      this._activeLiquids.add(key);
      return;
    }

    if (cur !== BLOCKS.AIR) return;
    this.setBlock(wx, wy, wz, liquidBlock);
    const key = this.posKey(wx, wy, wz);
    this._liquidLevels.set(key, level);
    this._activeLiquids.add(key);
  }

  _updateLiquids(dt) {
    this._liquidTick += dt;
    if (this._liquidTick < 0.18) return;
    this._liquidTick = 0;

    if (this._activeLiquids.size === 0) return;
    const keys = Array.from(this._activeLiquids).slice(0, 140);
    for (const key of keys) this._activeLiquids.delete(key);

    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const key of keys) {
      const { x, y, z } = this.parsePosKey(key);
      const block = this.getBlock(x, y, z);
      const props = BLOCK_PROPS[block] || {};
      if (!props.liquid) {
        this._liquidLevels.delete(key);
        continue;
      }

      const maxSpread = block === BLOCKS.LAVA ? 4 : 7;
      const level = this._liquidLevels.has(key) ? this._liquidLevels.get(key) : 0;
      const below = this.getBlock(x, y - 1, z);

      // Fluids prioritize falling.
      if (below === BLOCKS.AIR) {
        this._setLiquidBlock(x, y - 1, z, block, 0);
        this._activeLiquids.add(key);
        continue;
      }

      // Horizontal spread when blocked below.
      if (level >= maxSpread) continue;
      for (const [dx, dz] of dirs) {
        const nx = x + dx;
        const nz = z + dz;
        const target = this.getBlock(nx, y, nz);
        if (target === BLOCKS.AIR) {
          this._setLiquidBlock(nx, y, nz, block, level + 1);
          continue;
        }
        if (target === block) {
          const nKey = this.posKey(nx, y, nz);
          const nLvl = this._liquidLevels.get(nKey);
          if (nLvl === undefined || nLvl > level + 1) {
            this._liquidLevels.set(nKey, level + 1);
            this._activeLiquids.add(nKey);
          }
        }
      }
    }
  }

  markAdjacentDirty(cx, cz, lx, lz) {
    const neighbors = [[0,0]];
    if (lx === 0) neighbors.push([-1,0]);
    if (lx === CHUNK_SIZE-1) neighbors.push([1,0]);
    if (lz === 0) neighbors.push([0,-1]);
    if (lz === CHUNK_SIZE-1) neighbors.push([0,1]);
    for (const [dx,dz] of neighbors) {
      const c = this.getChunk(cx+dx, cz+dz);
      if (c) c.dirty = true;
    }
  }

  // ─── Meshing ───────────────────────────────────────────────────────────
  buildMesh(chunk) {
    const key = this.chunkKey(chunk.cx, chunk.cz);
    
    // If mesh is already being built, don't request again
    if (this._pendingMeshBuilds.has(key)) {
      return null;
    }
    
    // Get neighbor chunks for border face calculations
    const neighbors = {
      left: this.getChunk(chunk.cx - 1, chunk.cz)?.blocks,
      right: this.getChunk(chunk.cx + 1, chunk.cz)?.blocks,
      front: this.getChunk(chunk.cx, chunk.cz - 1)?.blocks,
      back: this.getChunk(chunk.cx, chunk.cz + 1)?.blocks,
    };
    
    // Request mesh build from worker
    const requestId = this._meshRequestId++;
    this._pendingMeshBuilds.set(key, requestId);
    
    // Clone blocks array for transfer to worker
    const blocksClone = new Uint8Array(chunk.blocks);
    const transferList = [blocksClone.buffer];
    
    // Clone neighbor blocks if they exist
    const neighborsClone = {};
    if (neighbors.left) {
      neighborsClone.left = new Uint8Array(neighbors.left);
      transferList.push(neighborsClone.left.buffer);
    }
    if (neighbors.right) {
      neighborsClone.right = new Uint8Array(neighbors.right);
      transferList.push(neighborsClone.right.buffer);
    }
    if (neighbors.front) {
      neighborsClone.front = new Uint8Array(neighbors.front);
      transferList.push(neighborsClone.front.buffer);
    }
    if (neighbors.back) {
      neighborsClone.back = new Uint8Array(neighbors.back);
      transferList.push(neighborsClone.back.buffer);
    }
    
    this._meshWorker.postMessage({
      type: 'build-mesh',
      data: {
        cx: chunk.cx,
        cz: chunk.cz,
        blocks: blocksClone,
        neighbors: neighborsClone,
        requestId
      }
    }, transferList);
    
    return null;
  }

  _updateChunkVisibility(pcx, pcz, camera) {
    if (camera) {
      camera.updateMatrixWorld();
      this._projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this._frustum.setFromProjectionMatrix(this._projScreenMatrix);
    }

    for (const chunk of this.chunks.values()) {
      if (!chunk.mesh) continue;

      const inRange = Math.abs(chunk.cx - pcx) <= this.renderDistance + 1
        && Math.abs(chunk.cz - pcz) <= this.renderDistance + 1;
      if (!inRange) {
        chunk.mesh.visible = false;
        continue;
      }

      if (!camera) {
        chunk.mesh.visible = true;
        continue;
      }

      chunk.mesh.visible = this._frustum.intersectsBox(chunk.bounds);
    }
  }

  // ─── Update (call each frame) ──────────────────────────────────────────
  update(playerX, playerZ, dt = 0.016, camera = null) {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    // Load/generate nearby chunks
    for (let dx=-this.renderDistance; dx<=this.renderDistance; dx++) {
      for (let dz=-this.renderDistance; dz<=this.renderDistance; dz++) {
        const cx=pcx+dx, cz=pcz+dz;
        const chunk = this.getOrCreateChunk(cx, cz);
        if (chunk && chunk.dirty) {
          this.buildMesh(chunk);
        }
      }
    }

    // Remove far chunks
    for (const [key, chunk] of this.chunks) {
      const [cx,cz] = key.split(',').map(Number);
      if (Math.abs(cx-pcx)>this.renderDistance+1 || Math.abs(cz-pcz)>this.renderDistance+1) {
        if (chunk.mesh && chunk.mesh.parent) {
          chunk.mesh.parent.remove(chunk.mesh);
          chunk.mesh.traverse(o => { if(o.geometry) o.geometry.dispose(); });
        }
        this.chunks.delete(key);
        // Cancel pending operations for this chunk
        this._pendingChunks.delete(key);
        this._pendingMeshBuilds.delete(key);
      }
    }

    this._updateChunkVisibility(pcx, pcz, camera);
    this._updateLiquids(dt);
  }

  // ─── Raycast ──────────────────────────────────────────────────────────
  raycast(origin, direction, maxDist=6) {
    const step = 0.05;
    let px=origin.x, py=origin.y, pz=origin.z;
    let prevX=Math.floor(px), prevY=Math.floor(py), prevZ=Math.floor(pz);
    for (let d=0; d<maxDist; d+=step) {
      px+=direction.x*step; py+=direction.y*step; pz+=direction.z*step;
      const bx=Math.floor(px), by=Math.floor(py), bz=Math.floor(pz);
      if (bx===prevX && by===prevY && bz===prevZ) continue;
      const block = this.getBlock(bx, by, bz);
      if (block && block !== BLOCKS.WATER) {
        // Normal from previous pos
        const nx=prevX-bx, ny=prevY-by, nz=prevZ-bz;
        return { bx, by, bz, nx, ny, nz, block };
      }
      prevX=bx; prevY=by; prevZ=bz;
    }
    return null;
  }

  // ─── Server blocks apply ───────────────────────────────────────────────
  applyServerBlocks(chunk) {
    for (const [key, blockId] of Object.entries(this.serverBlocks)) {
      const [wx, wy, wz] = key.split(',').map(Number);
      const cx2 = Math.floor(wx / CHUNK_SIZE);
      const cz2 = Math.floor(wz / CHUNK_SIZE);
      if (cx2 === chunk.cx && cz2 === chunk.cz) {
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        chunk.setBlock(lx, wy, lz, blockId);
      }
    }
  }

  applyAllServerBlocks(blocks) {
    this.serverBlocks = blocks || {};
    // Mark all loaded chunks dirty
    for (const chunk of this.chunks.values()) {
      this.applyServerBlocks(chunk);
      chunk.dirty = true;
    }
  }

  // Clean up resources
  dispose() {
    if (this._terrainWorker) {
      this._terrainWorker.terminate();
      this._terrainWorker = null;
    }
    if (this._meshWorker) {
      this._meshWorker.terminate();
      this._meshWorker = null;
    }
  }

  getSurfaceY(wx, wz) {
    return this.getTerrainHeight(wx, wz) + 2;
  }

  _isSolidBlockAt(wx, wy, wz) {
    const id = this.getBlock(wx, wy, wz);
    const props = BLOCK_PROPS[id] || {};
    return !!(id && props.solid && !props.liquid);
  }

  _isPlayerSpaceClear(x, y, z, radius, height) {
    const r = Math.max(0.25, radius || 0.3);
    const h = Math.max(1.6, height || 1.8);
    const sampleY = [0.05, h * 0.5, h - 0.1];
    const sampleXZ = [
      [0, 0],
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
      [r * 0.7, r * 0.7],
      [r * 0.7, -r * 0.7],
      [-r * 0.7, r * 0.7],
      [-r * 0.7, -r * 0.7],
    ];

    for (const [ox, oz] of sampleXZ) {
      for (const oy of sampleY) {
        if (this._isSolidBlockAt(Math.floor(x + ox), Math.floor(y + oy), Math.floor(z + oz))) {
          return false;
        }
      }
    }
    return true;
  }

  _hasGroundBelow(x, y, z, radius) {
    const r = Math.max(0.25, radius || 0.3);
    const samples = [
      [0, 0],
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
    ];
    const gy = Math.floor(y - 0.08);
    for (const [ox, oz] of samples) {
      if (this._isSolidBlockAt(Math.floor(x + ox), gy, Math.floor(z + oz))) return true;
    }
    return false;
  }

  _findNearestSafePosition(startX, startY, startZ, radius, height) {
    const baseX = Math.floor(startX);
    const baseY = Math.floor(startY);
    const baseZ = Math.floor(startZ);
    const maxR = 10;

    const candidateOrder = [];
    for (let r = 0; r <= maxR; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          candidateOrder.push([dx, dz]);
        }
      }
    }

    for (const [dx, dz] of candidateOrder) {
      const x = baseX + dx + 0.5;
      const z = baseZ + dz + 0.5;

      for (let dy = -6; dy <= 24; dy++) {
        const y = baseY + dy;
        if (y < 1 || y >= CHUNK_HEIGHT - 2) continue;

        if (!this._isPlayerSpaceClear(x, y, z, radius, height)) continue;
        if (!this._hasGroundBelow(x, y, z, radius)) continue;

        return { x, y, z };
      }
    }

    return null;
  }

  // Teleport player to the nearest safe open space if stuck in any solid structure.
  ensurePlayerAboveTerrain(player) {
    if (!player) return;

    const safe = this._findNearestSafePosition(player.x, player.y, player.z, player.radius || 0.3, player.height || 1.8);
    if (safe) {
      player.x = safe.x;
      player.y = safe.y;
      player.z = safe.z;
      player.vy = 0;
      if (typeof player._updateCamera === 'function') player._updateCamera();
      return;
    }

    // Fallback: move above local surface and reset velocity.
    player.y = this.getSurfaceY(player.x, player.z) + 1;
    player.vy = 0;
    if (typeof player._updateCamera === 'function') player._updateCamera();
  }
}
