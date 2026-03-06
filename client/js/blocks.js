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
      fillNoise(ctx, 0, 22, 110, 110, 110, id*100);
      ctx.strokeStyle='rgba(60,60,60,0.5)';
      ctx.strokeRect(2,2,6,6); ctx.strokeRect(9,2,5,5);
      ctx.strokeRect(2,10,5,5); ctx.strokeRect(8,9,6,6);
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
    default: fillNoise(ctx, 0, 20, 180, 60, 180, id*100); break;
  }
  return c;
}

// Build Three.js textures for all blocks
const blockTextures = {};

function initBlockTextures() {
  for (const [name, id] of Object.entries(BLOCKS)) {
    if (id === BLOCKS.AIR) continue;
    const canvas = makeTexture(id);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    blockTextures[id] = tex;
  }
}

// Returns a MeshLambertMaterial for a given block face
function getBlockMaterial(blockId) {
  const tex = blockTextures[blockId];
  if (!tex) return new THREE.MeshLambertMaterial({ color: 0xff00ff });
  const props = BLOCK_PROPS[blockId] || {};
  return new THREE.MeshLambertMaterial({
    map: tex,
    transparent: props.transparent || false,
    opacity: blockId === BLOCKS.WATER ? 0.7 : blockId === BLOCKS.GLASS ? 0.6 : blockId === BLOCKS.ICE ? 0.7 : 1,
    side: props.transparent ? THREE.DoubleSide : THREE.FrontSide,
    emissive: props.emissive ? new THREE.Color(1, 0.8, 0.3) : undefined,
    emissiveIntensity: props.emissive ? 0.5 : 0,
  });
}

// Draggable items & tools for inventory
const ITEM_TYPES = {
  WOOD_SWORD:  { id: 100, name: 'Wood Sword',   damage: 4, durability: 60 },
  STONE_SWORD: { id: 101, name: 'Stone Sword',  damage: 5, durability: 132 },
  IRON_SWORD:  { id: 102, name: 'Iron Sword',   damage: 6, durability: 251 },
  WOOD_PICK:   { id: 110, name: 'Wood Pickaxe', speed: 2,  durability: 60 },
  STONE_PICK:  { id: 111, name: 'Stone Pickaxe',speed: 4,  durability: 132 },
  IRON_PICK:   { id: 112, name: 'Iron Pickaxe', speed: 6,  durability: 251 },
  WOOD_AXE:    { id: 120, name: 'Wood Axe',     speed: 2,  durability: 60 },
  STONE_AXE:   { id: 121, name: 'Stone Axe',    speed: 4,  durability: 132 },
  IRON_AXE:    { id: 122, name: 'Iron Axe',     speed: 6,  durability: 251 },
  WOOD_SHOVEL: { id: 130, name: 'Wood Shovel',  speed: 2,  durability: 60 },
  BREAD:       { id: 200, name: 'Bread',        food: 5   },
  APPLE:       { id: 201, name: 'Apple',        food: 4   },
  PORK:        { id: 202, name: 'Pork',         food: 8   },
  BEEF:        { id: 203, name: 'Beef',         food: 8   },
  STICK:       { id: 300, name: 'Stick' },
  COAL:        { id: 301, name: 'Coal' },
  IRON_INGOT:  { id: 302, name: 'Iron Ingot' },
  GOLD_INGOT:  { id: 303, name: 'Gold Ingot' },
  DIAMOND:     { id: 304, name: 'Diamond' },
};
