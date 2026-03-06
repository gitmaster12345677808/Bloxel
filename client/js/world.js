// ─── World / Chunk System ────────────────────────────────────────────────
const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 128;
const RENDER_DISTANCE = 4; // chunks in each direction

class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    this.mesh = null;
    this.dirty = true;
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
  }

  chunkKey(cx, cz) { return `${cx},${cz}`; }

  getChunk(cx, cz) { return this.chunks.get(this.chunkKey(cx, cz)); }

  getOrCreateChunk(cx, cz) {
    const key = this.chunkKey(cx, cz);
    if (!this.chunks.has(key)) {
      const chunk = new Chunk(cx, cz);
      this.generateChunk(chunk);
      this.chunks.set(key, chunk);
    }
    return this.chunks.get(key);
  }

  // ─── Terrain generation ───────────────────────────────────────────────
  getBiome(wx, wz) {
    const t = this.noise.fbm(wx * 0.003, wz * 0.003, 2) * 0.5 + 0.5;
    const h = this.noise.fbm(wx * 0.002, wz * 0.002, 2) * 0.5 + 0.5;
    if (h > 0.75) return 'mountains';
    if (t < 0.3) return 'tundra';
    if (t > 0.7) return 'desert';
    return 'plains';
  }

  getTerrainHeight(wx, wz) {
    const biome = this.getBiome(wx, wz);
    let base = 64;
    let scale, amp;
    switch (biome) {
      case 'mountains': scale = 0.008; amp = 40; base = 60; break;
      case 'desert':    scale = 0.006; amp = 10; base = 62; break;
      case 'tundra':    scale = 0.007; amp = 12; base = 63; break;
      default:          scale = 0.007; amp = 18; base = 63;
    }
    const h = this.noise.fbm(wx * scale, wz * scale, 4) * amp;
    return Math.max(2, Math.round(base + h));
  }

  generateChunk(chunk) {
    const { cx, cz } = chunk;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const biome = this.getBiome(wx, wz);
        const h = this.getTerrainHeight(wx, wz);

        // Bedrock
        chunk.setBlock(lx, 0, lz, BLOCKS.BEDROCK);

        // Stone layers
        for (let y = 1; y < h - 3; y++) {
          // Ore veins
          const ore = this.noise.fbm(wx*0.3 + y, wz*0.3, 2);
          let block = BLOCKS.STONE;
          if (ore > 0.55) {
            if (y < 20) block = BLOCKS.DIAMOND_ORE;
            else if (y < 35) block = BLOCKS.GOLD_ORE;
            else if (y < 55) block = BLOCKS.IRON_ORE;
            else block = BLOCKS.COAL_ORE;
          }
          chunk.setBlock(lx, y, lz, block);
        }

        // Gravel layer below stone sometimes
        if (this.noise.noise2D(wx*0.1, wz*0.1) > 0.3) {
          for (let y = h-3; y < h-1; y++) chunk.setBlock(lx, y, lz, BLOCKS.GRAVEL);
        }

        // Surface layers by biome
        switch (biome) {
          case 'desert':
            for (let y = h-3; y <= h; y++) chunk.setBlock(lx, y, lz, BLOCKS.SAND);
            // Cactus
            if (this.noise.noise2D(wx*1.5, wz*1.5) > 0.7 && h < 70) {
              const ch = 2 + Math.floor(this.noise.noise2D(wx*2, wz*3)*2);
              for (let y=h+1; y<=h+ch; y++) chunk.setBlock(lx, y, lz, BLOCKS.CACTUS);
            }
            break;
          case 'tundra':
            chunk.setBlock(lx, h, lz, BLOCKS.SNOW);
            for (let y = h-2; y < h; y++) chunk.setBlock(lx, y, lz, BLOCKS.DIRT);
            break;
          case 'mountains':
            if (h > 85) {
              chunk.setBlock(lx, h, lz, BLOCKS.SNOW);
            } else {
              chunk.setBlock(lx, h, lz, BLOCKS.STONE);
            }
            for (let y = h-2; y < h; y++) chunk.setBlock(lx, y, lz, BLOCKS.STONE);
            break;
          default:
            chunk.setBlock(lx, h, lz, BLOCKS.GRASS);
            for (let y = h-3; y < h; y++) chunk.setBlock(lx, y, lz, BLOCKS.DIRT);
            // Trees
            if (this.noise.noise2D(wx*1.2, wz*1.2) > 0.72 && lx > 2 && lx < 13 && lz > 2 && lz < 13) {
              this.placeTree(chunk, lx, h+1, lz);
            }
            break;
        }

        // Water fill below sea level
        for (let y = h + 1; y <= 60; y++) chunk.setBlock(lx, y, lz, BLOCKS.WATER);
      }
    }

    // Apply server block overrides
    this.applyServerBlocks(chunk);
    chunk.dirty = true;
  }

  placeTree(chunk, lx, base, lz) {
    const trunkH = 4 + Math.floor(Math.random() * 2);
    for (let y = 0; y < trunkH; y++) chunk.setBlock(lx, base+y, lz, BLOCKS.WOOD);
    // Leaves
    for (let dy = -1; dy <= 1; dy++) {
      const r = dy === 0 ? 2 : 1;
      for (let dlx = -r; dlx <= r; dlx++) {
        for (let dlz = -r; dlz <= r; dlz++) {
          if (Math.abs(dlx) === r && Math.abs(dlz) === r) continue;
          chunk.setBlock(lx+dlx, base+trunkH+dy, lz+dlz, BLOCKS.LEAVES);
        }
      }
    }
    chunk.setBlock(lx, base+trunkH+1, lz, BLOCKS.LEAVES);
  }

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
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.setBlock(lx, wy, lz, blockId);
    this.serverBlocks[`${wx},${wy},${wz}`] = blockId;
    if (blockId === 0) delete this.serverBlocks[`${wx},${wy},${wz}`];

    // Re-mesh adjacent chunks if on border
    this.markAdjacentDirty(cx, cz, lx, lz);
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
    // Group faces by blockId
    const faceGroups = {};

    const addFace = (blockId, verts, uvs, normals) => {
      if (!faceGroups[blockId]) faceGroups[blockId] = { positions:[], uvs:[], normals:[], indices:[] };
      const g = faceGroups[blockId];
      const base = g.positions.length / 3;
      for (const v of verts) g.positions.push(...v);
      for (const uv of uvs) g.uvs.push(...uv);
      for (const n of normals) g.normals.push(...n);
      g.indices.push(base,base+1,base+2, base,base+2,base+3);
    };

    const dirs = [
      { dx:0,dy:0,dz:-1, verts:[[0,1,0],[1,1,0],[1,0,0],[0,0,0]], norm:[0,0,-1] },
      { dx:0,dy:0,dz: 1, verts:[[1,1,1],[0,1,1],[0,0,1],[1,0,1]], norm:[0,0,1]  },
      { dx:-1,dy:0,dz:0, verts:[[0,1,1],[0,1,0],[0,0,0],[0,0,1]], norm:[-1,0,0] },
      { dx: 1,dy:0,dz:0, verts:[[1,1,0],[1,1,1],[1,0,1],[1,0,0]], norm:[1,0,0]  },
      { dx:0,dy: 1,dz:0, verts:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]], norm:[0,1,0]  },
      { dx:0,dy:-1,dz:0, verts:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]], norm:[0,-1,0] },
    ];
    const UV = [[0,1],[1,1],[1,0],[0,0]];

    for (let lx=0;lx<CHUNK_SIZE;lx++) {
      for (let y=0;y<CHUNK_HEIGHT;y++) {
        for (let lz=0;lz<CHUNK_SIZE;lz++) {
          const blockId = chunk.getBlock(lx,y,lz);
          if (!blockId) continue;
          const props = BLOCK_PROPS[blockId];
          if (!props || !props.solid) continue;

          const wx = chunk.cx*CHUNK_SIZE + lx;
          const wz = chunk.cz*CHUNK_SIZE + lz;

          for (const dir of dirs) {
            const nx = lx+dir.dx, ny=y+dir.dy, nz=lz+dir.dz;
            let neighbor;
            if (nx<0||nx>=CHUNK_SIZE||nz<0||nz>=CHUNK_SIZE) {
              neighbor = this.getBlock(wx+dir.dx, ny, wz+dir.dz);
            } else {
              neighbor = chunk.getBlock(nx,ny,nz);
            }
            const nProps = BLOCK_PROPS[neighbor];
            const showFace = !neighbor || !nProps || !nProps.solid || nProps.transparent;
            if (!showFace) continue;

            const verts = dir.verts.map(([vx,vy,vz])=>[wx+vx, y+vy, wz+vz]);
            const norms = [dir.norm, dir.norm, dir.norm, dir.norm];
            addFace(blockId, verts, UV, norms);
          }
        }
      }
    }

    // Build group geometries
    const meshes = [];
    for (const [blockId, g] of Object.entries(faceGroups)) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(g.positions, 3));
      geom.setAttribute('uv',       new THREE.Float32BufferAttribute(g.uvs, 2));
      geom.setAttribute('normal',   new THREE.Float32BufferAttribute(g.normals, 3));
      geom.setIndex(g.indices);
      const mat = getBlockMaterial(Number(blockId));
      meshes.push(new THREE.Mesh(geom, mat));
    }

    if (chunk.mesh) {
      if (chunk.mesh.parent) chunk.mesh.parent.remove(chunk.mesh);
      chunk.mesh.traverse(o => {
        if (o.geometry) o.geometry.dispose();
      });
    }

    const group = new THREE.Group();
    for (const m of meshes) group.add(m);
    chunk.mesh = group;
    chunk.dirty = false;
    return group;
  }

  // ─── Update (call each frame) ──────────────────────────────────────────
  update(playerX, playerZ) {
    const pcx = Math.floor(playerX / CHUNK_SIZE);
    const pcz = Math.floor(playerZ / CHUNK_SIZE);

    // Load/generate nearby chunks
    for (let dx=-RENDER_DISTANCE; dx<=RENDER_DISTANCE; dx++) {
      for (let dz=-RENDER_DISTANCE; dz<=RENDER_DISTANCE; dz++) {
        const cx=pcx+dx, cz=pcz+dz;
        const chunk = this.getOrCreateChunk(cx, cz);
        if (chunk.dirty) {
          const mesh = this.buildMesh(chunk);
          this.scene.add(mesh);
        }
      }
    }

    // Remove far chunks
    for (const [key, chunk] of this.chunks) {
      const [cx,cz] = key.split(',').map(Number);
      if (Math.abs(cx-pcx)>RENDER_DISTANCE+1 || Math.abs(cz-pcz)>RENDER_DISTANCE+1) {
        if (chunk.mesh && chunk.mesh.parent) {
          chunk.mesh.parent.remove(chunk.mesh);
          chunk.mesh.traverse(o => { if(o.geometry) o.geometry.dispose(); });
        }
        this.chunks.delete(key);
      }
    }
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
  applyAllServerBlocks(blocks) {
    this.serverBlocks = blocks || {};
    // Mark all loaded chunks dirty
    for (const chunk of this.chunks.values()) {
      this.applyServerBlocks(chunk);
      chunk.dirty = true;
    }
  }

  getSurfaceY(wx, wz) {
    return this.getTerrainHeight(wx, wz) + 2;
  }
}
