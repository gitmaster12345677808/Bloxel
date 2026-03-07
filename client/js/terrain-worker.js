// ─── Terrain Generation Worker ─────────────────────────────────────────────
// This worker runs on a separate thread to generate terrain without blocking the main thread.

// Block IDs (must match blocks.js)
const BLOCKS = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5,
  WOOD: 6, LEAVES: 7, PLANKS: 8, COBBLESTONE: 9, BEDROCK: 10,
  GRAVEL: 11, COAL_ORE: 12, IRON_ORE: 13, GOLD_ORE: 14, DIAMOND_ORE: 15,
  GLASS: 16, BRICK: 17, TNT: 18, CRAFTING_TABLE: 19, FURNACE: 20,
  CHEST: 21, SNOW: 22, ICE: 23, CACTUS: 24, OBSIDIAN: 25,
  LAVA: 26, SPONGE: 27, BOOKSHELF: 28, GLOWSTONE: 29, NETHERRACK: 30,
  WHEAT_CROP: 31, CARROT_CROP: 32, POTATO_CROP: 33, TALL_GRASS: 34
};

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 128;

// ─── SimplexNoise implementation ───────────────────────────────────────────
const grad3 = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
];

function dot(g, x, y) { return g[0]*x + g[1]*y; }

function noise2D(perm, xin, yin) {
  const F2 = 0.5*(Math.sqrt(3)-1);
  const G2 = (3-Math.sqrt(3))/6;
  const s = (xin+yin)*F2;
  const i = Math.floor(xin+s), j = Math.floor(yin+s);
  const t = (i+j)*G2;
  const X0=i-t, Y0=j-t;
  const x0=xin-X0, y0=yin-Y0;
  let i1,j1;
  if (x0>y0){i1=1;j1=0;}else{i1=0;j1=1;}
  const x1=x0-i1+G2, y1=y0-j1+G2;
  const x2=x0-1+2*G2, y2=y0-1+2*G2;
  const ii=i&255, jj=j&255;
  const gi0=perm[ii+perm[jj]]%12;
  const gi1=perm[ii+i1+perm[jj+j1]]%12;
  const gi2=perm[ii+1+perm[jj+1]]%12;
  let n0,n1,n2;
  let t0=0.5-x0*x0-y0*y0; if(t0<0)n0=0;else{t0*=t0;n0=t0*t0*dot(grad3[gi0],x0,y0);}
  let t1=0.5-x1*x1-y1*y1; if(t1<0)n1=0;else{t1*=t1;n1=t1*t1*dot(grad3[gi1],x1,y1);}
  let t2=0.5-x2*x2-y2*y2; if(t2<0)n2=0;else{t2*=t2;n2=t2*t2*dot(grad3[gi2],x2,y2);}
  return 70*(n0+n1+n2);
}

class SimplexNoise {
  constructor(seed) {
    const p = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = (seed || 12345) & 0xffffffff;
    for (let i = 255; i > 0; i--) {
      s = (s ^ (s << 13)) >>> 0;
      s = (s ^ (s >>> 17)) >>> 0;
      s = (s ^ (s << 5)) >>> 0;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  noise2D(x, y) { return noise2D(this.perm, x, y); }
  fbm(x, y, octaves=4, lacunarity=2, persistence=0.5) {
    let v=0, amp=1, freq=1, max=0;
    for (let i=0;i<octaves;i++){
      v += this.noise2D(x*freq, y*freq)*amp;
      max += amp; amp *= persistence; freq *= lacunarity;
    }
    return v/max;
  }
}

// Math utilities
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─── Terrain generation ───────────────────────────────────────────────────
let noise = null;

function initNoise(seed) {
  noise = new SimplexNoise(seed);
}

function sampleTerrain(wx, wz) {
  const continental = noise.fbm(wx * 0.0012, wz * 0.0012, 3) * 0.5 + 0.5;
  const erosion = noise.fbm(wx * 0.0038, wz * 0.0038, 3) * 0.5 + 0.5;
  const ridges = Math.abs(noise.fbm(wx * 0.0026, wz * 0.0026, 4));
  const detail = noise.fbm(wx * 0.01, wz * 0.01, 4);
  const temp = noise.fbm(wx * 0.0025 + 1337, wz * 0.0025 - 741, 2) * 0.5 + 0.5;

  let h = 52;
  h += continental * 30;
  h += (1 - erosion) * 9;
  h += (ridges - 0.35) * 18;
  h += detail * 6;

  return {
    height: clamp(Math.round(h), 2, CHUNK_HEIGHT - 4),
    continental,
    erosion,
    ridges,
    temp,
  };
}

function biomeFromSample(s) {
  if (s.continental < 0.32) return 'ocean';
  if (s.ridges > 0.72 || s.height > 88) return 'mountains';
  if (s.temp < 0.27) return 'tundra';
  if (s.temp > 0.72 && s.erosion > 0.45) return 'desert';
  return 'plains';
}

function idx(lx, y, lz) {
  return lx + CHUNK_SIZE * (y + CHUNK_HEIGHT * lz);
}

function setBlock(blocks, lx, y, lz, id) {
  if (lx<0||lx>=CHUNK_SIZE||y<0||y>=CHUNK_HEIGHT||lz<0||lz>=CHUNK_SIZE) return;
  blocks[idx(lx, y, lz)] = id;
}

function placeTree(blocks, lx, base, lz) {
  const trunkH = 4 + Math.floor(Math.random() * 2);
  for (let y = 0; y < trunkH; y++) setBlock(blocks, lx, base+y, lz, BLOCKS.WOOD);
  // Leaves
  for (let dy = -1; dy <= 1; dy++) {
    const r = dy === 0 ? 2 : 1;
    for (let dlx = -r; dlx <= r; dlx++) {
      for (let dlz = -r; dlz <= r; dlz++) {
        if (Math.abs(dlx) === r && Math.abs(dlz) === r) continue;
        setBlock(blocks, lx+dlx, base+trunkH+dy, lz+dlz, BLOCKS.LEAVES);
      }
    }
  }
  setBlock(blocks, lx, base+trunkH+1, lz, BLOCKS.LEAVES);
}

function generateChunk(cx, cz, serverBlocks) {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  const SEA_LEVEL = 60;

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;
      const terrain = sampleTerrain(wx, wz);
      const biome = biomeFromSample(terrain);
      const h = terrain.height;
      const lakeNoise = noise.fbm(wx * 0.025, wz * 0.025, 2);
      const lavaNoise = noise.fbm(wx * 0.07, wz * 0.07, 3);

      // Bedrock
      setBlock(blocks, lx, 0, lz, BLOCKS.BEDROCK);

      // Stone layers
      for (let y = 1; y < h - 3; y++) {
        const cave = noise.fbm(wx * 0.045 + y * 0.055, wz * 0.045 - y * 0.055, 2);
        if (y > 8 && y < h - 5 && cave > 0.56) {
          setBlock(blocks, lx, y, lz, y < 9 ? BLOCKS.LAVA : BLOCKS.AIR);
          continue;
        }

        // Ore veins
        const ore = noise.fbm(wx*0.3 + y, wz*0.3, 2);
        let block = BLOCKS.STONE;
        if (ore > 0.55) {
          if (y < 20) block = BLOCKS.DIAMOND_ORE;
          else if (y < 35) block = BLOCKS.GOLD_ORE;
          else if (y < 55) block = BLOCKS.IRON_ORE;
          else block = BLOCKS.COAL_ORE;
        }

        // Underground lava pockets near bedrock
        if (y <= 10 && lavaNoise > 0.58 && noise.noise2D(wx * 0.12 + y, wz * 0.12 - y) > 0.15) {
          block = BLOCKS.LAVA;
        }

        setBlock(blocks, lx, y, lz, block);
      }

      // Gravel layer below stone sometimes
      if (noise.noise2D(wx*0.1, wz*0.1) > 0.3) {
        for (let y = h-3; y < h-1; y++) setBlock(blocks, lx, y, lz, BLOCKS.GRAVEL);
      }

      // Surface layers by biome
      switch (biome) {
        case 'ocean':
          setBlock(blocks, lx, h, lz, BLOCKS.SAND);
          for (let y = h - 3; y < h; y++) setBlock(blocks, lx, y, lz, BLOCKS.SAND);
          break;
        case 'desert':
          for (let y = h-3; y <= h; y++) setBlock(blocks, lx, y, lz, BLOCKS.SAND);
          // Cactus
          if (noise.noise2D(wx*1.5, wz*1.5) > 0.7 && h < 70) {
            const ch = 2 + Math.floor(noise.noise2D(wx*2, wz*3)*2);
            for (let y=h+1; y<=h+ch; y++) setBlock(blocks, lx, y, lz, BLOCKS.CACTUS);
          }
          break;
        case 'tundra':
          setBlock(blocks, lx, h, lz, BLOCKS.SNOW);
          for (let y = h-2; y < h; y++) setBlock(blocks, lx, y, lz, BLOCKS.DIRT);
          break;
        case 'mountains':
          if (h > 85) {
            setBlock(blocks, lx, h, lz, BLOCKS.SNOW);
          } else {
            setBlock(blocks, lx, h, lz, BLOCKS.STONE);
          }
          for (let y = h-2; y < h; y++) setBlock(blocks, lx, y, lz, BLOCKS.STONE);
          break;
        default:
          setBlock(blocks, lx, h, lz, BLOCKS.GRASS);
          for (let y = h-3; y < h; y++) setBlock(blocks, lx, y, lz, BLOCKS.DIRT);
          // Trees
          const treeNoise = noise.noise2D(wx*1.2, wz*1.2);
          if (treeNoise > 0.72 && lx > 2 && lx < 13 && lz > 2 && lz < 13) {
            placeTree(blocks, lx, h+1, lz);
          } else if (h >= SEA_LEVEL && noise.noise2D(wx * 2.9 + 41, wz * 2.9 - 19) > 0.25) {
            setBlock(blocks, lx, h + 1, lz, BLOCKS.TALL_GRASS);
          }
          break;
      }

      // Water fill below sea level
      for (let y = h + 1; y <= SEA_LEVEL; y++) setBlock(blocks, lx, y, lz, BLOCKS.WATER);

      // Surface lakes above sea level for plains/tundra
      if ((biome === 'plains' || biome === 'tundra') && h > SEA_LEVEL + 1 && h < SEA_LEVEL + 12 && lakeNoise > 0.62) {
        const lakeDepth = 1 + Math.floor(noise.noise2D(wx * 0.4, wz * 0.4) * 2);
        for (let y = h - lakeDepth + 1; y <= h; y++) {
          setBlock(blocks, lx, y, lz, BLOCKS.WATER);
        }
      }
    }
  }

  // Apply server block overrides
  if (serverBlocks) {
    for (const [key, blockId] of Object.entries(serverBlocks)) {
      const [wx, wy, wz] = key.split(',').map(Number);
      const cx2 = Math.floor(wx / CHUNK_SIZE);
      const cz2 = Math.floor(wz / CHUNK_SIZE);
      if (cx2 === cx && cz2 === cz) {
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        setBlock(blocks, lx, wy, lz, blockId);
      }
    }
  }

  return blocks;
}

// ─── Worker message handler ────────────────────────────────────────────────
self.onmessage = function(e) {
  const { type, data } = e.data;

  switch (type) {
    case 'init':
      initNoise(data.seed);
      self.postMessage({ type: 'init-complete' });
      break;

    case 'generate':
      const { cx, cz, serverBlocks, requestId } = data;
      const blocks = generateChunk(cx, cz, serverBlocks);
      // Transfer the block array to avoid copying
      self.postMessage({
        type: 'chunk-ready',
        data: { cx, cz, blocks, requestId }
      }, [blocks.buffer]);
      break;

    default:
      console.warn('[TerrainWorker] Unknown message type:', type);
  }
};
