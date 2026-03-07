// ─── Mesh Building Worker ──────────────────────────────────────────────────
// This worker builds chunk meshes on a separate thread to prevent lag spikes.

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 128;

// Block properties (must match blocks.js)
const BLOCK_PROPS = {
  0: { solid: false, transparent: true, hardness: 0 },
  1: { solid: true, transparent: false, hardness: 0.6 },
  2: { solid: true, transparent: false, hardness: 0.5 },
  3: { solid: true, transparent: false, hardness: 1.5 },
  4: { solid: true, transparent: false, hardness: 0.5 },
  5: { solid: false, transparent: true, hardness: 0, liquid: true },
  6: { solid: true, transparent: false, hardness: 2 },
  7: { solid: true, transparent: true, hardness: 0.2 },
  8: { solid: true, transparent: false, hardness: 2 },
  9: { solid: true, transparent: false, hardness: 2 },
  10: { solid: true, transparent: false, hardness: 99 },
  11: { solid: true, transparent: false, hardness: 0.6 },
  12: { solid: true, transparent: false, hardness: 3 },
  13: { solid: true, transparent: false, hardness: 3 },
  14: { solid: true, transparent: false, hardness: 3 },
  15: { solid: true, transparent: false, hardness: 3 },
  16: { solid: true, transparent: true, hardness: 0.3 },
  17: { solid: true, transparent: false, hardness: 2 },
  18: { solid: true, transparent: false, hardness: 0 },
  19: { solid: true, transparent: false, hardness: 2.5 },
  20: { solid: true, transparent: false, hardness: 3.5 },
  21: { solid: true, transparent: false, hardness: 2.5 },
  22: { solid: true, transparent: false, hardness: 0.2 },
  23: { solid: true, transparent: true, hardness: 0.5 },
  24: { solid: true, transparent: false, hardness: 0.4 },
  25: { solid: true, transparent: false, hardness: 50 },
  26: { solid: false, transparent: true, hardness: 0, liquid: true },
  27: { solid: true, transparent: false, hardness: 0.6 },
  28: { solid: true, transparent: false, hardness: 1.5 },
  29: { solid: true, transparent: false, hardness: 0.3 },
  30: { solid: true, transparent: false, hardness: 0.4 },
  31: { solid: false, transparent: true, hardness: 0 },
  32: { solid: false, transparent: true, hardness: 0 },
  33: { solid: false, transparent: true, hardness: 0 },
  34: { solid: false, transparent: true, hardness: 0 },
};

const CROSS_BLOCKS = new Set([31, 32, 33, 34]);

function getBlockFaceKey(blockId, normal) {
  const [nx, ny, nz] = normal;
  let role = 'side';
  if (ny > 0.5) role = 'top';
  else if (ny < -0.5) role = 'bottom';
  return `${blockId}_${role}`;
}

function getBlock(blocks, lx, y, lz, neighbors) {
  // Check if it's within the main chunk
  if (lx >= 0 && lx < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT && lz >= 0 && lz < CHUNK_SIZE) {
    const idx = lx + CHUNK_SIZE * (y + CHUNK_HEIGHT * lz);
    return blocks[idx];
  }
  
  // Check neighbor chunks
  if (!neighbors) return 0;
  
  if (lx < 0 && neighbors.left) {
    const idx = (CHUNK_SIZE - 1) + CHUNK_SIZE * (y + CHUNK_HEIGHT * lz);
    return neighbors.left[idx];
  }
  if (lx >= CHUNK_SIZE && neighbors.right) {
    const idx = 0 + CHUNK_SIZE * (y + CHUNK_HEIGHT * lz);
    return neighbors.right[idx];
  }
  if (lz < 0 && neighbors.front) {
    const idx = lx + CHUNK_SIZE * (y + CHUNK_HEIGHT * (CHUNK_SIZE - 1));
    return neighbors.front[idx];
  }
  if (lz >= CHUNK_SIZE && neighbors.back) {
    const idx = lx + CHUNK_SIZE * (y + CHUNK_HEIGHT * 0);
    return neighbors.back[idx];
  }
  
  return 0; // Air
}

function buildMesh(blocks, neighbors, cx, cz) {
  const faceGroups = {};

  const addFace = (groupKey, blockId, faceNormal, verts, uvs, normals) => {
    if (!faceGroups[groupKey]) {
      faceGroups[groupKey] = { blockId, faceNormal, positions: [], uvs: [], normals: [], indices: [] };
    }
    const g = faceGroups[groupKey];
    const base = g.positions.length / 3;
    for (const v of verts) g.positions.push(...v);
    for (const uv of uvs) g.uvs.push(...uv);
    for (const n of normals) g.normals.push(...n);
    g.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  const dirs = [
    { dx: 0, dy: 0, dz: -1, verts: [[0, 1, 0], [1, 1, 0], [1, 0, 0], [0, 0, 0]], norm: [0, 0, -1] },
    { dx: 0, dy: 0, dz: 1, verts: [[1, 1, 1], [0, 1, 1], [0, 0, 1], [1, 0, 1]], norm: [0, 0, 1] },
    { dx: -1, dy: 0, dz: 0, verts: [[0, 1, 1], [0, 1, 0], [0, 0, 0], [0, 0, 1]], norm: [-1, 0, 0] },
    { dx: 1, dy: 0, dz: 0, verts: [[1, 1, 0], [1, 1, 1], [1, 0, 1], [1, 0, 0]], norm: [1, 0, 0] },
    { dx: 0, dy: 1, dz: 0, verts: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], norm: [0, 1, 0] },
    { dx: 0, dy: -1, dz: 0, verts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], norm: [0, -1, 0] },
  ];
  const UV = [[0, 1], [1, 1], [1, 0], [0, 0]];

  const addCrossPlant = (blockId, wx, y, wz) => {
    const centerX = wx + 0.5;
    const centerZ = wz + 0.5;
    const y0 = y;
    const y1 = y + 1;
    const n = [0, 1, 0];

    // Two diagonal quads form a Minecraft-style X plant billboard.
    const quadA = [
      [centerX - 0.5, y1, centerZ - 0.5],
      [centerX + 0.5, y1, centerZ + 0.5],
      [centerX + 0.5, y0, centerZ + 0.5],
      [centerX - 0.5, y0, centerZ - 0.5],
    ];
    const quadB = [
      [centerX + 0.5, y1, centerZ - 0.5],
      [centerX - 0.5, y1, centerZ + 0.5],
      [centerX - 0.5, y0, centerZ + 0.5],
      [centerX + 0.5, y0, centerZ - 0.5],
    ];

    addFace(`${blockId}_cross_a`, blockId, n, quadA, UV, [n, n, n, n]);
    addFace(`${blockId}_cross_b`, blockId, n, quadB, UV, [n, n, n, n]);
  };

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const blockId = getBlock(blocks, lx, y, lz, neighbors);
        if (!blockId) continue;
        const props = BLOCK_PROPS[blockId];
        if (!props) continue;

        // Convert to world coordinates
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;

        if (CROSS_BLOCKS.has(blockId)) {
          addCrossPlant(blockId, wx, y, wz);
          continue;
        }

        if (!props.solid && !props.liquid) continue;

        for (const dir of dirs) {
          const nx = lx + dir.dx;
          const ny = y + dir.dy;
          const nz = lz + dir.dz;

          const neighbor = getBlock(blocks, nx, ny, nz, neighbors);
          const nProps = BLOCK_PROPS[neighbor];

          let showFace;
          if (props.liquid) {
            showFace = (!nProps || !nProps.solid) && neighbor !== blockId;
          } else {
            showFace = !neighbor || !nProps || !nProps.solid || nProps.transparent;
          }
          if (!showFace) continue;

          const verts = dir.verts.map(([vx, vy, vz]) => [wx + vx, y + vy, wz + vz]);
          const norms = [dir.norm, dir.norm, dir.norm, dir.norm];
          const faceKey = getBlockFaceKey(blockId, dir.norm);
          addFace(faceKey, blockId, dir.norm, verts, UV, norms);
        }
      }
    }
  }

  return faceGroups;
}

// ─── Worker message handler ────────────────────────────────────────────────
self.onmessage = function (e) {
  const { type, data } = e.data;

  switch (type) {
    case 'build-mesh':
      const { blocks, neighbors, cx, cz, requestId } = data;
      const faceGroups = buildMesh(blocks, neighbors, cx, cz);

      // Convert to transferrable arrays
      const groups = {};
      for (const [key, g] of Object.entries(faceGroups)) {
        groups[key] = {
          blockId: g.blockId,
          faceNormal: g.faceNormal,
          positions: new Float32Array(g.positions),
          uvs: new Float32Array(g.uvs),
          normals: new Float32Array(g.normals),
          indices: new Uint16Array(g.indices),
        };
      }

      // Collect all transferrable buffers
      const transferList = [];
      for (const g of Object.values(groups)) {
        transferList.push(g.positions.buffer, g.uvs.buffer, g.normals.buffer, g.indices.buffer);
      }

      self.postMessage({
        type: 'mesh-ready',
        data: { cx, cz, groups, requestId }
      }, transferList);
      break;

    default:
      console.warn('[MeshWorker] Unknown message type:', type);
  }
};
