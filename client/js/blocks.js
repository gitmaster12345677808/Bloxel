// Block definitions and procedural texture generation
const BLOCKS = {
  AIR:          0,
  GRASS:        1,
  DIRT:         2,
  STONE:        3,
  SAND:         4,
  WATER:        5,
  WOOD:         6,
  LEAVES:       7,
  PLANKS:       8,
  COBBLESTONE:  9,
  BEDROCK:      10,
  GRAVEL:       11,
  COAL_ORE:     12,
  IRON_ORE:     13,
  GOLD_ORE:     14,
  DIAMOND_ORE:  15,
  GLASS:        16,
  BRICK:        17,
  TNT:          18,
  CRAFTING_TABLE: 19,
  FURNACE:      20,
  CHEST:        21,
  SNOW:         22,
  ICE:          23,
  CACTUS:       24,
  OBSIDIAN:     25,
  LAVA:         26,
  SPONGE:       27,
  BOOKSHELF:    28,
  GLOWSTONE:    29,
  NETHERRACK:   30,
  WHEAT_CROP:   31,
  CARROT_CROP:  32,
  POTATO_CROP:  33,
  TALL_GRASS:   34,
};

const BLOCK_NAMES = {};
for (const [k,v] of Object.entries(BLOCKS)) BLOCK_NAMES[v] = k.charAt(0) + k.slice(1).toLowerCase().replace(/_/g,' ');

// Block properties
const BLOCK_PROPS = {
  [BLOCKS.AIR]:           { solid: false, transparent: true,  hardness: 0  },
  [BLOCKS.GRASS]:         { solid: true,  transparent: false, hardness: 0.6 },
  [BLOCKS.DIRT]:          { solid: true,  transparent: false, hardness: 0.5 },
  [BLOCKS.STONE]:         { solid: true,  transparent: false, hardness: 1.5 },
  [BLOCKS.SAND]:          { solid: true,  transparent: false, hardness: 0.5 },
  [BLOCKS.WATER]:         { solid: false, transparent: true,  hardness: 0,  liquid: true },
  [BLOCKS.WOOD]:          { solid: true,  transparent: false, hardness: 2   },
  [BLOCKS.LEAVES]:        { solid: true,  transparent: true,  hardness: 0.2 },
  [BLOCKS.PLANKS]:        { solid: true,  transparent: false, hardness: 2   },
  [BLOCKS.COBBLESTONE]:   { solid: true,  transparent: false, hardness: 2   },
  [BLOCKS.BEDROCK]:       { solid: true,  transparent: false, hardness: Infinity },
  [BLOCKS.GRAVEL]:        { solid: true,  transparent: false, hardness: 0.6 },
  [BLOCKS.COAL_ORE]:      { solid: true,  transparent: false, hardness: 3   },
  [BLOCKS.IRON_ORE]:      { solid: true,  transparent: false, hardness: 3   },
  [BLOCKS.GOLD_ORE]:      { solid: true,  transparent: false, hardness: 3   },
  [BLOCKS.DIAMOND_ORE]:   { solid: true,  transparent: false, hardness: 3   },
  [BLOCKS.GLASS]:         { solid: true,  transparent: true,  hardness: 0.3 },
  [BLOCKS.BRICK]:         { solid: true,  transparent: false, hardness: 2   },
  [BLOCKS.TNT]:           { solid: true,  transparent: false, hardness: 0   },
  [BLOCKS.CRAFTING_TABLE]:{ solid: true,  transparent: false, hardness: 2.5 },
  [BLOCKS.FURNACE]:       { solid: true,  transparent: false, hardness: 3.5 },
  [BLOCKS.CHEST]:         { solid: true,  transparent: false, hardness: 2.5 },
  [BLOCKS.SNOW]:          { solid: true,  transparent: false, hardness: 0.1 },
  [BLOCKS.ICE]:           { solid: true,  transparent: true,  hardness: 0.5 },
  [BLOCKS.CACTUS]:        { solid: true,  transparent: false, hardness: 0.4 },
  [BLOCKS.OBSIDIAN]:      { solid: true,  transparent: false, hardness: 50  },
  [BLOCKS.LAVA]:          { solid: false, transparent: true,  hardness: 0,  liquid: true },
  [BLOCKS.SPONGE]:        { solid: true,  transparent: false, hardness: 0.6 },
  [BLOCKS.BOOKSHELF]:     { solid: true,  transparent: false, hardness: 1.5 },
  [BLOCKS.GLOWSTONE]:     { solid: true,  transparent: false, hardness: 0.3, emissive: 1 },
  [BLOCKS.NETHERRACK]:    { solid: true,  transparent: false, hardness: 0.4 },
  [BLOCKS.WHEAT_CROP]:    { solid: false, transparent: true,  hardness: 0.1, cross: true, alphaTest: 0.35 },
  [BLOCKS.CARROT_CROP]:   { solid: false, transparent: true,  hardness: 0.1, cross: true, alphaTest: 0.35 },
  [BLOCKS.POTATO_CROP]:   { solid: false, transparent: true,  hardness: 0.1, cross: true, alphaTest: 0.35 },
  [BLOCKS.TALL_GRASS]:    { solid: false, transparent: true,  hardness: 0.05, cross: true, alphaTest: 0.35 },
};

// ─── Texture generation ───────────────────────────────────────────────────
const TEX_SIZE = 16;
const textureCache = {};

function rng(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = TEX_SIZE;
  return c;
}

function fillNoise(ctx, base, variation, r, g, b, seed) {
  const rand = rng(seed);
  const img = ctx.createImageData(TEX_SIZE, TEX_SIZE);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (rand() * 2 - 1) * variation;
    img.data[i]   = MathUtils.clamp(r + v, 0, 255);
    img.data[i+1] = MathUtils.clamp(g + v, 0, 255);
    img.data[i+2] = MathUtils.clamp(b + v, 0, 255);
    img.data[i+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function makeTexture(id) {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  switch (id) {
    case BLOCKS.GRASS: {
      fillNoise(ctx, 0, 15, 86, 125, 40, id*100);
      // Add a few darker patches
      const rand = rng(id*7);
      for (let i=0;i<12;i++){
        ctx.fillStyle=`rgba(60,100,20,${0.3+rand()*0.3})`;
        ctx.fillRect(Math.floor(rand()*14),Math.floor(rand()*14),2,2);
      }
      break;
    }
    case BLOCKS.DIRT: fillNoise(ctx, 0, 20, 121, 85, 58, id*100); break;
    case BLOCKS.STONE: fillNoise(ctx, 0, 18, 128, 128, 128, id*100); break;
    case BLOCKS.SAND: fillNoise(ctx, 0, 12, 210, 190, 130, id*100); break;
    case BLOCKS.WATER: {
      const img = ctx.createImageData(TEX_SIZE, TEX_SIZE);
      for (let i=0;i<img.data.length;i+=4){img.data[i]=40;img.data[i+1]=100;img.data[i+2]=200;img.data[i+3]=180;}
      ctx.putImageData(img,0,0);
      break;
    }
    case BLOCKS.WOOD: {
      fillNoise(ctx, 0, 12, 130, 90, 50, id*100);
      // vertical grain
      for (let x=0;x<TEX_SIZE;x+=3){
        ctx.fillStyle='rgba(80,50,20,0.25)';
        ctx.fillRect(x,0,1,TEX_SIZE);
      }
      break;
    }
    case BLOCKS.LEAVES: {
      fillNoise(ctx, 0, 20, 40, 110, 30, id*100);
      const rand=rng(id*13);
      for(let i=0;i<20;i++){
        ctx.fillStyle=`rgba(20,80,10,${0.2+rand()*0.4})`;
        ctx.fillRect(Math.floor(rand()*15),Math.floor(rand()*15),1+Math.floor(rand()*2),1+Math.floor(rand()*2));
      }
      break;
    }
    case BLOCKS.PLANKS: {
      fillNoise(ctx, 0, 8, 180, 140, 80, id*100);
      ctx.fillStyle='rgba(100,70,30,0.4)';
      ctx.fillRect(0,TEX_SIZE/2-1,TEX_SIZE,1);
      ctx.fillRect(0,0,1,TEX_SIZE/2);
      ctx.fillRect(TEX_SIZE/2,TEX_SIZE/2,1,TEX_SIZE/2);
      break;
    }
    case BLOCKS.COBBLESTONE: {
      fillNoise(ctx, 0, 16, 108, 108, 112, id*100);
      const rand = rng(id * 41);
      const stones = [];
      for (let i = 0; i < 10; i++) {
        const sx = Math.floor(rand() * 14) + 1;
        const sy = Math.floor(rand() * 14) + 1;
        const sw = 2 + Math.floor(rand() * 4);
        const sh = 2 + Math.floor(rand() * 4);
        stones.push({ sx, sy, sw, sh });
      }
      for (const s of stones) {
        ctx.fillStyle = `rgba(${120 + Math.floor(rand() * 30)}, ${120 + Math.floor(rand() * 30)}, ${125 + Math.floor(rand() * 35)}, 0.65)`;
        ctx.fillRect(s.sx, s.sy, s.sw, s.sh);
        ctx.strokeStyle = 'rgba(55, 55, 60, 0.75)';
        ctx.strokeRect(s.sx - 0.5, s.sy - 0.5, s.sw + 1, s.sh + 1);
      }
      // Irregular mortar cracks.
      ctx.strokeStyle = 'rgba(45,45,48,0.55)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        const x0 = Math.floor(rand() * TEX_SIZE);
        const y0 = Math.floor(rand() * TEX_SIZE);
        const x1 = MathUtils.clamp(x0 + Math.floor((rand() - 0.5) * 10), 0, TEX_SIZE - 1);
        const y1 = MathUtils.clamp(y0 + Math.floor((rand() - 0.5) * 10), 0, TEX_SIZE - 1);
        ctx.beginPath();
        ctx.moveTo(x0 + 0.5, y0 + 0.5);
        ctx.lineTo(x1 + 0.5, y1 + 0.5);
        ctx.stroke();
      }
      break;
    }
    case BLOCKS.BEDROCK: fillNoise(ctx, 0, 12, 30, 30, 30, id*100); break;
    case BLOCKS.GRAVEL: fillNoise(ctx, 0, 28, 130, 120, 110, id*100); break;
    case BLOCKS.COAL_ORE: {
      fillNoise(ctx, 0, 18, 128, 128, 128, id*100);
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(5,3,3,3); ctx.fillRect(10,8,3,3); ctx.fillRect(3,10,3,3);
      break;
    }
    case BLOCKS.IRON_ORE: {
      fillNoise(ctx, 0, 18, 128, 128, 128, id*100);
      ctx.fillStyle='#c8845a'; ctx.fillRect(5,3,3,3); ctx.fillRect(10,8,3,3); ctx.fillRect(3,10,3,3);
      break;
    }
    case BLOCKS.GOLD_ORE: {
      fillNoise(ctx, 0, 18, 128, 128, 128, id*100);
      ctx.fillStyle='#e8c820'; ctx.fillRect(5,3,3,3); ctx.fillRect(10,8,3,3); ctx.fillRect(3,10,3,3);
      break;
    }
    case BLOCKS.DIAMOND_ORE: {
      fillNoise(ctx, 0, 18, 128, 128, 128, id*100);
      ctx.fillStyle='#5cdce8'; ctx.fillRect(5,3,3,3); ctx.fillRect(10,8,3,3); ctx.fillRect(3,10,3,3);
      break;
    }
    case BLOCKS.GLASS: {
      const img=ctx.createImageData(TEX_SIZE,TEX_SIZE);
      for(let i=0;i<img.data.length;i+=4){img.data[i]=200;img.data[i+1]=230;img.data[i+2]=255;img.data[i+3]=100;}
      ctx.putImageData(img,0,0);
      ctx.strokeStyle='rgba(180,210,255,0.6)'; ctx.strokeRect(0,0,TEX_SIZE,TEX_SIZE);
      break;
    }
    case BLOCKS.BRICK: {
      ctx.fillStyle='#a84030'; ctx.fillRect(0,0,TEX_SIZE,TEX_SIZE);
      ctx.fillStyle='#c05040';
      for(let y=0;y<TEX_SIZE;y+=4){
        const offset=(Math.floor(y/4)%2)*4;
        for(let x=-TEX_SIZE;x<TEX_SIZE*2;x+=8){
          ctx.fillRect(x+offset,y+1,6,2);
        }
      }
      break;
    }
    case BLOCKS.TNT: {
      ctx.fillStyle='#c83030'; ctx.fillRect(0,0,TEX_SIZE,TEX_SIZE);
      ctx.fillStyle='#fff'; ctx.font='6px monospace'; ctx.textAlign='center';
      ctx.fillText('TNT',8,10);
      break;
    }
    case BLOCKS.CRAFTING_TABLE: {
      fillNoise(ctx, 0, 8, 180, 140, 80, id*100);
      ctx.strokeStyle='rgba(60,40,20,0.6)';
      ctx.strokeRect(2,2,TEX_SIZE-4,TEX_SIZE-4);
      ctx.fillStyle='#8b5e3c'; ctx.fillRect(4,4,TEX_SIZE-8,TEX_SIZE-8);
      break;
    }
    case BLOCKS.FURNACE: {
      fillNoise(ctx, 0, 18, 110, 110, 110, id*100);
      ctx.fillStyle='#e86020';
      ctx.fillRect(5,8,6,5);
      break;
    }
    case BLOCKS.CHEST: {
      fillNoise(ctx, 0, 8, 180, 140, 80, id*100);
      ctx.fillStyle='#8b4513'; ctx.fillRect(1,1,TEX_SIZE-2,TEX_SIZE-2);
      ctx.fillStyle='#c8a060'; ctx.fillRect(2,2,TEX_SIZE-4,5);
      ctx.fillStyle='#e8c030'; ctx.fillRect(6,5,4,3);
      break;
    }
    case BLOCKS.SNOW: {
      const img=ctx.createImageData(TEX_SIZE,TEX_SIZE);
      for(let i=0;i<img.data.length;i+=4){img.data[i]=240;img.data[i+1]=245;img.data[i+2]=255;img.data[i+3]=255;}
      ctx.putImageData(img,0,0);
      break;
    }
    case BLOCKS.ICE: {
      const img=ctx.createImageData(TEX_SIZE,TEX_SIZE);
      for(let i=0;i<img.data.length;i+=4){img.data[i]=160;img.data[i+1]=200;img.data[i+2]=255;img.data[i+3]=180;}
      ctx.putImageData(img,0,0);
      break;
    }
    case BLOCKS.CACTUS: fillNoise(ctx, 0, 12, 40, 120, 20, id*100); break;
    case BLOCKS.OBSIDIAN: fillNoise(ctx, 0, 8, 15, 10, 25, id*100); break;
    case BLOCKS.LAVA: {
      const img=ctx.createImageData(TEX_SIZE,TEX_SIZE);
      for(let i=0;i<img.data.length;i+=4){img.data[i]=220;img.data[i+1]=80;img.data[i+2]=0;img.data[i+3]=230;}
      ctx.putImageData(img,0,0);
      break;
    }
    case BLOCKS.SPONGE: fillNoise(ctx, 0, 18, 200, 190, 60, id*100); break;
    case BLOCKS.BOOKSHELF: {
      fillNoise(ctx, 0, 8, 180, 140, 80, id*100);
      ctx.fillStyle='#a05030'; ctx.fillRect(1,1,TEX_SIZE-2,2);
      ctx.fillStyle='#4050c8'; ctx.fillRect(1,4,3,8);
      ctx.fillStyle='#c04040'; ctx.fillRect(5,4,3,8);
      ctx.fillStyle='#40a040'; ctx.fillRect(9,4,3,8);
      ctx.fillStyle='#c8a000'; ctx.fillRect(13,4,2,8);
      break;
    }
    case BLOCKS.GLOWSTONE: {
      const img=ctx.createImageData(TEX_SIZE,TEX_SIZE);
      for(let i=0;i<img.data.length;i+=4){img.data[i]=255;img.data[i+1]=210;img.data[i+2]=80;img.data[i+3]=255;}
      ctx.putImageData(img,0,0);
      break;
    }
    case BLOCKS.NETHERRACK: fillNoise(ctx, 0, 18, 140, 30, 30, id*100); break;
    case BLOCKS.WHEAT_CROP: {
      ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
      ctx.fillStyle = '#d8c45b';
      for (let y = 4; y <= 13; y += 2) ctx.fillRect(7, y, 2, 1);
      ctx.fillStyle = '#8aa843';
      ctx.fillRect(6, 12, 1, 3);
      ctx.fillRect(9, 12, 1, 3);
      break;
    }
    case BLOCKS.CARROT_CROP: {
      ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
      ctx.fillStyle = '#65a74a';
      ctx.fillRect(6, 8, 1, 6);
      ctx.fillRect(9, 8, 1, 6);
      ctx.fillRect(7, 7, 2, 7);
      ctx.fillStyle = '#db7b28';
      ctx.fillRect(7, 12, 2, 3);
      break;
    }
    case BLOCKS.POTATO_CROP: {
      ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
      ctx.fillStyle = '#63a24a';
      ctx.fillRect(6, 8, 1, 6);
      ctx.fillRect(9, 8, 1, 6);
      ctx.fillRect(7, 7, 2, 7);
      ctx.fillStyle = '#c9a163';
      ctx.fillRect(7, 12, 2, 3);
      break;
    }
    case BLOCKS.TALL_GRASS: {
      ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
      const rand = rng(id * 13);
      for (let i = 0; i < 18; i++) {
        const x = 2 + Math.floor(rand() * 12);
        const h = 4 + Math.floor(rand() * 10);
        const y = 15 - h;
        const shade = 120 + Math.floor(rand() * 70);
        ctx.fillStyle = `rgba(${50 + Math.floor(rand() * 25)}, ${shade}, ${35 + Math.floor(rand() * 20)}, 0.95)`;
        ctx.fillRect(x, y, 1, h);
      }
      break;
    }
    default: fillNoise(ctx, 0, 20, 180, 60, 180, id*100); break;
  }
  return c;
}

// Build Three.js textures for all blocks
const blockTextures = {};
const blockFaceTextures = {};
const itemTextures = {};
const MINETEST_TEXTURE_BASE = 'textures/minetest';
const TEX_LOADER = new THREE.TextureLoader();
const MINETEST_TEXTURE_CACHE = new Map();
const BLOCK_MATERIAL_CACHE = new Map();

const MINETEST_BLOCK_TEXTURE_FILES = {
  [BLOCKS.GRASS]: 'default_grass.png',
  [BLOCKS.DIRT]: 'default_dirt.png',
  [BLOCKS.STONE]: 'default_stone.png',
  [BLOCKS.SAND]: 'default_sand.png',
  [BLOCKS.WATER]: 'default_water.png',
  [BLOCKS.WOOD]: 'default_tree.png',
  [BLOCKS.LEAVES]: 'default_leaves.png',
  [BLOCKS.PLANKS]: 'default_wood.png',
  [BLOCKS.COBBLESTONE]: 'default_cobble.png',
  [BLOCKS.BEDROCK]: 'default_obsidian.png',
  [BLOCKS.GRAVEL]: 'default_gravel.png',
  [BLOCKS.COAL_ORE]: 'default_coal_lump.png',
  [BLOCKS.IRON_ORE]: 'default_steel_ingot.png',
  [BLOCKS.GOLD_ORE]: 'default_gold_ingot.png',
  [BLOCKS.DIAMOND_ORE]: 'default_diamond.png',
  [BLOCKS.GLASS]: 'default_glass.png',
  [BLOCKS.BRICK]: 'default_brick.png',
  [BLOCKS.TNT]: 'default_brick.png',
  [BLOCKS.CRAFTING_TABLE]: 'default_wood.png',
  [BLOCKS.FURNACE]: 'default_furnace_front.png',
  [BLOCKS.CHEST]: 'default_chest_front.png',
  [BLOCKS.SNOW]: 'default_snow.png',
  [BLOCKS.ICE]: 'default_ice.png',
  [BLOCKS.CACTUS]: 'default_cactus_side.png',
  [BLOCKS.OBSIDIAN]: 'default_obsidian.png',
  [BLOCKS.LAVA]: 'default_lava.png',
  [BLOCKS.SPONGE]: 'default_sand.png',
  [BLOCKS.BOOKSHELF]: 'default_bookshelf.png',
  [BLOCKS.GLOWSTONE]: 'default_meselamp.png',
  [BLOCKS.NETHERRACK]: 'default_stone.png',
  [BLOCKS.WHEAT_CROP]: 'default_grass.png',
  [BLOCKS.CARROT_CROP]: 'default_grass.png',
  [BLOCKS.POTATO_CROP]: 'default_grass.png',
  [BLOCKS.TALL_GRASS]: 'default_grass_3.png',
};

const MINETEST_BLOCK_TEXTURE_FALLBACKS = {
  [BLOCKS.TALL_GRASS]: 'default_grass.png',
};

const MINETEST_BLOCK_FACE_TEXTURE_FILES = {
  [BLOCKS.GRASS]: {
    top: 'default_grass.png',
    side: 'default_grass_side.png',
    bottom: 'default_dirt.png',
  },
  [BLOCKS.WOOD]: {
    top: 'default_tree_top.png',
    side: 'default_tree.png',
    bottom: 'default_tree_top.png',
  },
};

const MINETEST_ITEM_TEXTURE_FILES = {
  WOOD_SWORD: 'default_tool_woodsword.png',
  STONE_SWORD: 'default_tool_stonesword.png',
  IRON_SWORD: 'default_tool_steelsword.png',
  DIAMOND_SWORD: 'default_tool_steelsword.png',
  WOOD_PICK: 'default_tool_woodpick.png',
  STONE_PICK: 'default_tool_stonepick.png',
  IRON_PICK: 'default_tool_steelpick.png',
  DIAMOND_PICK: 'default_tool_steelpick.png',
  WOOD_AXE: 'default_tool_woodaxe.png',
  STONE_AXE: 'default_tool_stoneaxe.png',
  IRON_AXE: 'default_tool_steelaxe.png',
  DIAMOND_AXE: 'default_tool_steelaxe.png',
  WOOD_SHOVEL: 'default_tool_woodshovel.png',
  STONE_SHOVEL: 'default_tool_stonepick.png',
  IRON_SHOVEL: 'default_tool_steelpick.png',
  DIAMOND_SHOVEL: 'default_tool_steelpick.png',
  BREAD: 'farming_bread.png',
  APPLE: 'default_apple.png',
  CARROT: 'default_apple.png',
  POTATO: 'default_apple.png',
  BAKED_POTATO: 'default_apple.png',
  WHEAT: 'default_stick.png',
  WHEAT_SEEDS: 'default_stick.png',
  PORK: 'default_apple.png',
  BEEF: 'default_apple.png',
  STICK: 'default_stick.png',
  COAL: 'default_coal_lump.png',
  IRON_INGOT: 'default_steel_ingot.png',
  GOLD_INGOT: 'default_gold_ingot.png',
  DIAMOND: 'default_diamond.png',
};

function makeNearestTextureFromCanvas(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function makeNearestTextureFromImage(image) {
  const tex = new THREE.Texture(image);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function loadMinetestTexture(file, fallbackFile = 'default_stone.png') {
  const safeFile = file || fallbackFile;
  if (MINETEST_TEXTURE_CACHE.has(safeFile)) return MINETEST_TEXTURE_CACHE.get(safeFile);

  const tex = TEX_LOADER.load(
    `${MINETEST_TEXTURE_BASE}/${safeFile}`,
    () => {
      tex.needsUpdate = true;
    },
    undefined,
    () => {
      if (!fallbackFile || safeFile === fallbackFile) return;
      const fb = TEX_LOADER.load(`${MINETEST_TEXTURE_BASE}/${fallbackFile}`);
      fb.magFilter = THREE.NearestFilter;
      fb.minFilter = THREE.NearestFilter;
      fb.wrapS = THREE.ClampToEdgeWrapping;
      fb.wrapT = THREE.ClampToEdgeWrapping;
      tex.image = fb.image;
      tex.needsUpdate = true;
    }
  );
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  MINETEST_TEXTURE_CACHE.set(safeFile, tex);
  return tex;
}

function loadImage(path, onLoad, onError) {
  const img = new Image();
  img.onload = () => onLoad(img);
  img.onerror = () => onError && onError();
  img.src = path;
}

function notifyTextureSwap() {
  // Some materials are cached by block/face role and need to be rebuilt when maps swap.
  BLOCK_MATERIAL_CACHE.clear();
  if (window.world && window.world.chunks) {
    for (const chunk of window.world.chunks.values()) chunk.dirty = true;
  }
  if (window.inventory) window.inventory.refresh();
  if (window.crafting && window.crafting.refreshLists) window.crafting.refreshLists();
}

function getFaceRoleFromNormal(normal) {
  if (!normal || !Array.isArray(normal)) return 'side';
  if (normal[1] > 0.5) return 'top';
  if (normal[1] < -0.5) return 'bottom';
  return 'side';
}

function makeGrassSideFallbackTexture() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  const dirt = blockTextures[BLOCKS.DIRT]?.image;
  const grass = blockTextures[BLOCKS.GRASS]?.image;
  if (dirt) ctx.drawImage(dirt, 0, 0, 16, 16, 0, 0, 16, 16);
  else fillNoise(ctx, 0, 20, 121, 85, 58, BLOCKS.DIRT * 100);

  if (grass) {
    ctx.drawImage(grass, 0, 0, 16, 16, 0, 0, 16, 5);
  } else {
    ctx.fillStyle = 'rgba(96, 160, 68, 0.95)';
    ctx.fillRect(0, 0, 16, 5);
  }
  return makeNearestTextureFromCanvas(c);
}

function makeLogTopFallbackTexture() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6f4b2b';
  ctx.fillRect(0, 0, 16, 16);
  ctx.strokeStyle = '#9a6f42';
  ctx.lineWidth = 1;
  ctx.strokeRect(2.5, 2.5, 11, 11);
  ctx.strokeRect(4.5, 4.5, 7, 7);
  ctx.strokeRect(6.5, 6.5, 3, 3);
  return makeNearestTextureFromCanvas(c);
}

function initDefaultFaceTextures() {
  for (const idStr of Object.keys(BLOCKS)) {
    const id = BLOCKS[idStr];
    if (id === BLOCKS.AIR) continue;
    blockFaceTextures[id] = {
      top: blockTextures[id],
      side: blockTextures[id],
      bottom: blockTextures[id],
    };
  }

  for (const [idStr, faces] of Object.entries(MINETEST_BLOCK_FACE_TEXTURE_FILES)) {
    const blockId = Number(idStr);
    blockFaceTextures[blockId] = {
      top: faces.top ? loadMinetestTexture(faces.top, MINETEST_BLOCK_TEXTURE_FILES[blockId]) : blockTextures[blockId],
      side: faces.side ? loadMinetestTexture(faces.side, MINETEST_BLOCK_TEXTURE_FILES[blockId]) : blockTextures[blockId],
      bottom: faces.bottom ? loadMinetestTexture(faces.bottom, MINETEST_BLOCK_TEXTURE_FILES[blockId]) : blockTextures[blockId],
    };
  }
}

function getBlockFaceTexture(blockId, normal) {
  const role = getFaceRoleFromNormal(normal);
  const face = blockFaceTextures[blockId];
  if (face && face[role]) return face[role];
  return blockTextures[blockId];
}

function getBlockMaterialCacheKey(blockId, normal) {
  return `${blockId}:${getFaceRoleFromNormal(normal)}`;
}

function getBlockFaceKey(blockId, normal) {
  return `${blockId}:${getFaceRoleFromNormal(normal)}`;
}

function makeToolTexture(type, tierColor) {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Transparent background with subtle vignette so tools pop on dark UI slots.
  const bg = ctx.createRadialGradient(8, 8, 2, 8, 8, 9);
  bg.addColorStop(0, 'rgba(255,255,255,0.08)');
  bg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  const handle = '#6e4f2f';
  ctx.fillStyle = handle;
  ctx.fillRect(7, 7, 2, 8);
  ctx.fillStyle = '#8a633a';
  ctx.fillRect(8, 7, 1, 8);

  if (type === 'sword') {
    ctx.fillStyle = tierColor;
    ctx.fillRect(7, 1, 2, 7);
    ctx.fillRect(6, 2, 1, 5);
    ctx.fillRect(9, 2, 1, 5);
    ctx.fillStyle = '#d6c3a0';
    ctx.fillRect(5, 8, 6, 1);
    ctx.fillRect(7, 14, 2, 1);
  } else if (type === 'pickaxe') {
    ctx.fillStyle = tierColor;
    ctx.fillRect(3, 3, 10, 2);
    ctx.fillRect(2, 4, 2, 1);
    ctx.fillRect(12, 4, 2, 1);
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(4, 5, 8, 1);
  } else if (type === 'axe') {
    ctx.fillStyle = tierColor;
    ctx.fillRect(4, 3, 6, 5);
    ctx.fillRect(3, 4, 1, 3);
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(9, 3, 1, 5);
  } else if (type === 'shovel') {
    ctx.fillStyle = tierColor;
    ctx.fillRect(6, 2, 4, 4);
    ctx.fillRect(7, 1, 2, 1);
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(6, 5, 4, 1);
  }

  return c;
}

function buildItemTextures() {
  const toolDefs = [
    ['WOOD_SWORD', 'sword', '#8f6b46'],
    ['STONE_SWORD', 'sword', '#9a9a9a'],
    ['IRON_SWORD', 'sword', '#cfd7df'],
    ['WOOD_PICK', 'pickaxe', '#8f6b46'],
    ['STONE_PICK', 'pickaxe', '#9a9a9a'],
    ['IRON_PICK', 'pickaxe', '#cfd7df'],
    ['WOOD_AXE', 'axe', '#8f6b46'],
    ['STONE_AXE', 'axe', '#9a9a9a'],
    ['IRON_AXE', 'axe', '#cfd7df'],
    ['WOOD_SHOVEL', 'shovel', '#8f6b46'],
  ];

  for (const [key, type, color] of toolDefs) {
    const item = ITEM_TYPES[key];
    if (!item) continue;
    const canvas = makeToolTexture(type, color);
    itemTextures[item.id] = makeNearestTextureFromCanvas(canvas);
  }

  const miscDefs = [
    ['BREAD', drawBreadTexture],
    ['APPLE', drawAppleTexture],
    ['PORK', drawMeatTexture],
    ['BEEF', drawMeatTexture],
    ['STICK', drawStickTexture],
    ['COAL', drawCoalTexture],
    ['IRON_INGOT', drawIngotTexture],
    ['GOLD_INGOT', drawIngotTexture],
    ['DIAMOND', drawDiamondTexture],
  ];

  for (const [key, drawFn] of miscDefs) {
    const item = ITEM_TYPES[key];
    if (!item) continue;
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    drawFn(ctx, item.color || '#cccccc');
    itemTextures[item.id] = makeNearestTextureFromCanvas(canvas);
  }
}

function tryLoadMinetestTextures() {
  for (const [idStr, file] of Object.entries(MINETEST_BLOCK_TEXTURE_FILES)) {
    const id = Number(idStr);
    if (!file || id === BLOCKS.AIR) continue;
    const path = `${MINETEST_TEXTURE_BASE}/${file}`;
    loadImage(path, (img) => {
      blockTextures[id] = makeNearestTextureFromImage(img);
      notifyTextureSwap();
    });
  }

  for (const [idStr, faces] of Object.entries(MINETEST_BLOCK_FACE_TEXTURE_FILES)) {
    const blockId = Number(idStr);
    if (!blockFaceTextures[blockId]) {
      blockFaceTextures[blockId] = {
        top: blockTextures[blockId],
        side: blockTextures[blockId],
        bottom: blockTextures[blockId],
      };
    }

    for (const role of ['top', 'side', 'bottom']) {
      const file = faces[role];
      if (!file) continue;
      const path = `${MINETEST_TEXTURE_BASE}/${file}`;
      loadImage(path, (img) => {
        blockFaceTextures[blockId][role] = makeNearestTextureFromImage(img);
        notifyTextureSwap();
      });
    }
  }

  for (const [itemKey, file] of Object.entries(MINETEST_ITEM_TEXTURE_FILES)) {
    const def = ITEM_TYPES[itemKey];
    if (!def || !file) continue;
    const path = `${MINETEST_TEXTURE_BASE}/${file}`;
    loadImage(path, (img) => {
      itemTextures[def.id] = makeNearestTextureFromImage(img);
      notifyTextureSwap();
    });
  }
}

function drawBreadTexture(ctx) {
  ctx.fillStyle = '#4b351d';
  ctx.fillRect(3, 4, 10, 8);
  ctx.fillStyle = '#c8863a';
  ctx.fillRect(4, 5, 8, 6);
  ctx.fillStyle = '#dfb064';
  ctx.fillRect(5, 6, 6, 2);
}

function drawAppleTexture(ctx) {
  ctx.fillStyle = '#1f7f2a';
  ctx.fillRect(7, 2, 2, 2);
  ctx.fillStyle = '#ba1f24';
  ctx.fillRect(4, 4, 8, 8);
  ctx.fillStyle = '#ea4e53';
  ctx.fillRect(5, 5, 3, 3);
}

function drawMeatTexture(ctx, color) {
  ctx.fillStyle = '#4d2424';
  ctx.fillRect(3, 4, 10, 8);
  ctx.fillStyle = color;
  ctx.fillRect(4, 5, 8, 6);
  ctx.fillStyle = '#f7b5a2';
  ctx.fillRect(10, 6, 2, 3);
}

function drawStickTexture(ctx) {
  ctx.fillStyle = '#6e4f2f';
  ctx.fillRect(7, 3, 2, 10);
  ctx.fillStyle = '#8a633a';
  ctx.fillRect(8, 3, 1, 10);
}

function drawCoalTexture(ctx) {
  ctx.fillStyle = '#181818';
  ctx.fillRect(4, 4, 8, 8);
  ctx.fillStyle = '#2d2d2d';
  ctx.fillRect(5, 5, 2, 2);
}

function drawIngotTexture(ctx, color) {
  ctx.fillStyle = '#444';
  ctx.fillRect(3, 6, 10, 4);
  ctx.fillStyle = color;
  ctx.fillRect(4, 7, 8, 2);
}

function drawDiamondTexture(ctx, color) {
  ctx.fillStyle = '#1f6f74';
  ctx.fillRect(7, 3, 2, 1);
  ctx.fillRect(6, 4, 4, 1);
  ctx.fillRect(5, 5, 6, 1);
  ctx.fillStyle = color;
  ctx.fillRect(6, 6, 4, 4);
  ctx.fillStyle = '#89f4ff';
  ctx.fillRect(7, 7, 1, 1);
}

function initBlockTextures() {
  // Use Minetest textures for all world blocks.
  for (const [name, id] of Object.entries(BLOCKS)) {
    if (id === BLOCKS.AIR) continue;
    const file = MINETEST_BLOCK_TEXTURE_FILES[id] || 'default_stone.png';
    const fallback = MINETEST_BLOCK_TEXTURE_FALLBACKS[id] || 'default_stone.png';
    blockTextures[id] = loadMinetestTexture(file, fallback);
  }

  buildItemTextures();
  initDefaultFaceTextures();
  // Upgrade to Minetest assets as they finish loading.
  tryLoadMinetestTextures();
}

// Returns a MeshLambertMaterial for a given block face
function getBlockMaterial(blockId, normal) {
  const key = getBlockMaterialCacheKey(blockId, normal);
  if (BLOCK_MATERIAL_CACHE.has(key)) return BLOCK_MATERIAL_CACHE.get(key);

  const tex = getBlockFaceTexture(blockId, normal);
  if (!tex) {
    const fallback = new THREE.MeshLambertMaterial({ color: 0xff00ff });
    BLOCK_MATERIAL_CACHE.set(key, fallback);
    return fallback;
  }

  const props = BLOCK_PROPS[blockId] || {};
  const mat = new THREE.MeshLambertMaterial({
    map: tex,
    transparent: props.transparent || false,
    opacity: blockId === BLOCKS.WATER ? 0.7 : blockId === BLOCKS.GLASS ? 0.6 : blockId === BLOCKS.ICE ? 0.7 : 1,
    side: props.transparent ? THREE.DoubleSide : THREE.FrontSide,
    alphaTest: props.alphaTest || 0,
    depthWrite: props.cross ? false : true,
    depthTest: true,
    emissive: props.emissive ? new THREE.Color(1, 0.8, 0.3) : undefined,
    emissiveIntensity: props.emissive ? 0.5 : 0,
  });
  BLOCK_MATERIAL_CACHE.set(key, mat);
  return mat;
}

// Draggable items & tools for inventory
const ITEM_TYPES = {
  WOOD_SWORD:  { id: 100, name: 'Wood Sword',   damage: 4, durability: 60, color: '#8B4513', textureKey: 'WOOD_SWORD' },
  STONE_SWORD: { id: 101, name: 'Stone Sword',  damage: 5, durability: 132, color: '#808080', textureKey: 'STONE_SWORD' },
  IRON_SWORD:  { id: 102, name: 'Iron Sword',   damage: 6, durability: 251, color: '#c0c0c0', textureKey: 'IRON_SWORD' },
  DIAMOND_SWORD:{ id: 103, name: 'Diamond Sword',damage: 8, durability: 1561, color: '#00CED1', textureKey: 'DIAMOND_SWORD' },
  WOOD_PICK:   { id: 110, name: 'Wood Pickaxe', speed: 2,  durability: 60, color: '#8B4513', textureKey: 'WOOD_PICK' },
  STONE_PICK:  { id: 111, name: 'Stone Pickaxe',speed: 4,  durability: 132, color: '#808080', textureKey: 'STONE_PICK' },
  IRON_PICK:   { id: 112, name: 'Iron Pickaxe', speed: 6,  durability: 251, color: '#c0c0c0', textureKey: 'IRON_PICK' },
  DIAMOND_PICK:{ id: 113, name: 'Diamond Pickaxe', speed: 8, durability: 1561, color: '#00CED1', textureKey: 'DIAMOND_PICK' },
  WOOD_AXE:    { id: 120, name: 'Wood Axe',     speed: 2,  durability: 60, color: '#8B4513', textureKey: 'WOOD_AXE' },
  STONE_AXE:   { id: 121, name: 'Stone Axe',    speed: 4,  durability: 132, color: '#808080', textureKey: 'STONE_AXE' },
  IRON_AXE:    { id: 122, name: 'Iron Axe',     speed: 6,  durability: 251, color: '#c0c0c0', textureKey: 'IRON_AXE' },
  DIAMOND_AXE: { id: 123, name: 'Diamond Axe',  speed: 8,  durability: 1561, color: '#00CED1', textureKey: 'DIAMOND_AXE' },
  WOOD_SHOVEL: { id: 130, name: 'Wood Shovel',  speed: 2,  durability: 60, color: '#8B4513', textureKey: 'WOOD_SHOVEL' },
  STONE_SHOVEL:{ id: 131, name: 'Stone Shovel', speed: 4,  durability: 132, color: '#808080', textureKey: 'STONE_SHOVEL' },
  IRON_SHOVEL: { id: 132, name: 'Iron Shovel',  speed: 6,  durability: 251, color: '#c0c0c0', textureKey: 'IRON_SHOVEL' },
  DIAMOND_SHOVEL:{ id: 133, name: 'Diamond Shovel', speed: 8, durability: 1561, color: '#00CED1', textureKey: 'DIAMOND_SHOVEL' },
  IRON_HELMET: { id: 150, name: 'Iron Helmet', armor: 'head', armorValue: 2, durability: 165, color: '#c0c0c0' },
  IRON_CHESTPLATE: { id: 151, name: 'Iron Chestplate', armor: 'chest', armorValue: 6, durability: 240, color: '#c0c0c0' },
  IRON_LEGGINGS: { id: 152, name: 'Iron Leggings', armor: 'legs', armorValue: 5, durability: 225, color: '#c0c0c0' },
  IRON_BOOTS: { id: 153, name: 'Iron Boots', armor: 'feet', armorValue: 2, durability: 195, color: '#c0c0c0' },
  DIAMOND_HELMET: { id: 154, name: 'Diamond Helmet', armor: 'head', armorValue: 3, durability: 363, color: '#00CED1' },
  DIAMOND_CHESTPLATE: { id: 155, name: 'Diamond Chestplate', armor: 'chest', armorValue: 8, durability: 528, color: '#00CED1' },
  DIAMOND_LEGGINGS: { id: 156, name: 'Diamond Leggings', armor: 'legs', armorValue: 6, durability: 495, color: '#00CED1' },
  DIAMOND_BOOTS: { id: 157, name: 'Diamond Boots', armor: 'feet', armorValue: 3, durability: 429, color: '#00CED1' },
  BREAD:       { id: 200, name: 'Bread',        food: 5, color: '#D2691E' },
  APPLE:       { id: 201, name: 'Apple',        food: 4, color: '#DC143C' },
  CARROT:      { id: 204, name: 'Carrot',       food: 3, color: '#e0701e' },
  POTATO:      { id: 205, name: 'Potato',       food: 2, color: '#b18a4d' },
  BAKED_POTATO:{ id: 206, name: 'Baked Potato', food: 5, color: '#c69b55' },
  WHEAT:       { id: 207, name: 'Wheat', color: '#d8c060' },
  WHEAT_SEEDS: { id: 208, name: 'Wheat Seeds', seedBlock: BLOCKS.WHEAT_CROP, color: '#95a748' },
  PORK:        { id: 202, name: 'Pork',         food: 8, color: '#FF69B4' },
  BEEF:        { id: 203, name: 'Beef',         food: 8, color: '#8B0000' },
  STICK:       { id: 300, name: 'Stick', color: '#8B4513' },
  COAL:        { id: 301, name: 'Coal', color: '#2F2F2F' },
  IRON_INGOT:  { id: 302, name: 'Iron Ingot', color: '#c0c0c0' },
  GOLD_INGOT:  { id: 303, name: 'Gold Ingot', color: '#FFD700' },
  DIAMOND:     { id: 304, name: 'Diamond', color: '#00CED1' },
};
