// ─── Crafting system ────────────────────────────────────────────────────
// Recipes: pattern (null = empty, number = block/item id) -> output
const RECIPES = [
  // Planks from wood
  { pattern: [[BLOCKS.WOOD]], output: { id: BLOCKS.PLANKS, count: 4, type: 'block' } },
  // Sticks from planks
  { pattern: [[BLOCKS.PLANKS],[BLOCKS.PLANKS]], output: { id: ITEM_TYPES.STICK.id, count: 4, type: 'item', itemDef: ITEM_TYPES.STICK } },
  // Crafting table
  { pattern: [[BLOCKS.PLANKS, BLOCKS.PLANKS],[BLOCKS.PLANKS, BLOCKS.PLANKS]], output: { id: BLOCKS.CRAFTING_TABLE, count: 1, type: 'block' } },
  // Wood pickaxe: PPP / _S_ / _S_
  { pattern: [[BLOCKS.PLANKS, BLOCKS.PLANKS, BLOCKS.PLANKS],[null, ITEM_TYPES.STICK.id, null],[null, ITEM_TYPES.STICK.id, null]], output: { id: ITEM_TYPES.WOOD_PICK.id, count:1, type:'item', itemDef: ITEM_TYPES.WOOD_PICK } },
  // Stone pickaxe
  { pattern: [[BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE],[null, ITEM_TYPES.STICK.id, null],[null, ITEM_TYPES.STICK.id, null]], output: { id: ITEM_TYPES.STONE_PICK.id, count:1, type:'item', itemDef: ITEM_TYPES.STONE_PICK } },
  // Iron pickaxe
  { pattern: [[ITEM_TYPES.IRON_INGOT.id, ITEM_TYPES.IRON_INGOT.id, ITEM_TYPES.IRON_INGOT.id],[null, ITEM_TYPES.STICK.id, null],[null, ITEM_TYPES.STICK.id, null]], output: { id: ITEM_TYPES.IRON_PICK.id, count:1, type:'item', itemDef: ITEM_TYPES.IRON_PICK } },
  // Wood sword
  { pattern: [[BLOCKS.PLANKS],[BLOCKS.PLANKS],[ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.WOOD_SWORD.id, count:1, type:'item', itemDef: ITEM_TYPES.WOOD_SWORD } },
  // Stone sword
  { pattern: [[BLOCKS.COBBLESTONE],[BLOCKS.COBBLESTONE],[ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.STONE_SWORD.id, count:1, type:'item', itemDef: ITEM_TYPES.STONE_SWORD } },
  // Iron sword
  { pattern: [[ITEM_TYPES.IRON_INGOT.id],[ITEM_TYPES.IRON_INGOT.id],[ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.IRON_SWORD.id, count:1, type:'item', itemDef: ITEM_TYPES.IRON_SWORD } },
  // Wood axe
  { pattern: [[BLOCKS.PLANKS, BLOCKS.PLANKS],[BLOCKS.PLANKS, ITEM_TYPES.STICK.id],[null, ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.WOOD_AXE.id, count:1, type:'item', itemDef: ITEM_TYPES.WOOD_AXE } },
  // Wood shovel
  { pattern: [[BLOCKS.PLANKS],[ITEM_TYPES.STICK.id],[ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.WOOD_SHOVEL.id, count:1, type:'item', itemDef: ITEM_TYPES.WOOD_SHOVEL } },
  // Cobblestone
  { pattern: [[BLOCKS.STONE]], output: { id: BLOCKS.COBBLESTONE, count: 1, type:'block' } },
  // Glass (from sand via "smelting" - simplified to crafting)
  { pattern: [[BLOCKS.SAND, BLOCKS.SAND, BLOCKS.SAND],[BLOCKS.SAND, null, BLOCKS.SAND],[BLOCKS.SAND, BLOCKS.SAND, BLOCKS.SAND]], output: { id: BLOCKS.GLASS, count:4, type:'block' } },
  // Brick block
  { pattern: [[ITEM_TYPES.COAL.id, ITEM_TYPES.COAL.id],[ITEM_TYPES.COAL.id, ITEM_TYPES.COAL.id]], output: { id: BLOCKS.BRICK, count:1, type:'block' } },
];

function matchRecipe(grid) {
  // Normalize: remove empty rows/cols
  const rows = grid.length;
  const cols = grid[0].length;

  // Find bounding box
  let minR=rows, maxR=-1, minC=cols, maxC=-1;
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
    if (grid[r][c]) { minR=Math.min(minR,r); maxR=Math.max(maxR,r); minC=Math.min(minC,c); maxC=Math.max(maxC,c); }
  }
  if (maxR < 0) return null; // empty

  // Extract sub-grid
  const sub = [];
  for (let r=minR;r<=maxR;r++) {
    const row = [];
    for (let c=minC;c<=maxC;c++) row.push(grid[r][c] || null);
    sub.push(row);
  }

  for (const recipe of RECIPES) {
    if (patternsMatch(sub, recipe.pattern)) return recipe.output;
  }
  return null;
}

function patternsMatch(grid, pattern) {
  if (grid.length !== pattern.length) return false;
  for (let r=0;r<grid.length;r++) {
    if (grid[r].length !== pattern[r].length) return false;
    for (let c=0;c<grid[r].length;c++) {
      const g = grid[r][c] || null;
      const p = pattern[r][c] || null;
      if (g !== p) return false;
    }
  }
  return true;
}

class CraftingUI {
  constructor(inventory) {
    this.inventory = inventory;
    this.grid2 = Array(2).fill(null).map(()=>Array(2).fill(null));
    this.grid3 = Array(3).fill(null).map(()=>Array(3).fill(null));
    this._build2x2();
    this._build3x3();
  }

  _build2x2() {
    const el = document.getElementById('crafting-grid-2x2');
    if (!el) return;
    el.innerHTML = '';
    for (let r=0;r<2;r++) for (let c=0;c<2;c++) {
      const div = document.createElement('div');
      div.className = 'inv-slot crafting-slot';
      div.dataset.r = r; div.dataset.c = c;
      div.addEventListener('click', () => {
        const item = this.inventory.dragItem;
        if (item) {
          this.grid2[r][c] = item.id;
          this.inventory.dragItem = null;
          this.inventory._stopDrag();
        } else {
          this.grid2[r][c] = null;
        }
        this._refreshGridUI(el, this.grid2, 2, 2);
        this._updateOutput2();
      });
      el.appendChild(div);
    }
    const out = document.getElementById('crafting-output');
    if (out) out.addEventListener('click', () => this._takeOutput(this.grid2, out));
  }

  _build3x3() {
    const el = document.getElementById('crafting-grid-3x3');
    if (!el) return;
    el.innerHTML = '';
    for (let r=0;r<3;r++) for (let c=0;c<3;c++) {
      const div = document.createElement('div');
      div.className = 'inv-slot crafting-slot';
      div.dataset.r = r; div.dataset.c = c;
      div.addEventListener('click', () => {
        const item = this.inventory.dragItem;
        if (item) {
          this.grid3[r][c] = item.id;
          this.inventory.dragItem = null;
          this.inventory._stopDrag();
        } else {
          this.grid3[r][c] = null;
        }
        this._refreshGridUI(el, this.grid3, 3, 3);
        this._updateOutput3();
      });
      el.appendChild(div);
    }
    const out = document.getElementById('crafting-table-output');
    if (out) out.addEventListener('click', () => this._takeOutput(this.grid3, out));
  }

  _refreshGridUI(container, grid, rows, cols) {
    const slots = container.querySelectorAll('.crafting-slot');
    let i=0;
    for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
      const el = slots[i++];
      el.innerHTML = '';
      const id = grid[r][c];
      if (id) {
        // Show block texture or label
        if (blockTextures[id]) {
          const img = blockTextures[id].image.cloneNode();
          img.className = 'slot-icon';
          el.appendChild(img);
        } else {
          el.textContent = id;
        }
      }
    }
  }

  _updateOutput2() {
    const result = matchRecipe(this.grid2);
    const out = document.getElementById('crafting-output');
    if (!out) return;
    out.innerHTML = '';
    if (result) {
      if (result.type === 'block' && blockTextures[result.id]) {
        const img = blockTextures[result.id].image.cloneNode();
        img.className = 'slot-icon';
        out.appendChild(img);
      }
      const cnt = document.createElement('span');
      cnt.className = 'slot-count';
      cnt.textContent = result.count;
      out.appendChild(cnt);
      out.dataset.result = JSON.stringify(result);
    } else {
      delete out.dataset.result;
    }
  }

  _updateOutput3() {
    const result = matchRecipe(this.grid3);
    const out = document.getElementById('crafting-table-output');
    if (!out) return;
    out.innerHTML = '';
    if (result) {
      if (result.type === 'block' && blockTextures[result.id]) {
        const img = blockTextures[result.id].image.cloneNode();
        img.className = 'slot-icon';
        out.appendChild(img);
      }
      const cnt = document.createElement('span');
      cnt.className = 'slot-count';
      cnt.textContent = result.count;
      out.appendChild(cnt);
      out.dataset.result = JSON.stringify(result);
    } else {
      delete out.dataset.result;
    }
  }

  _takeOutput(grid, outEl) {
    if (!outEl.dataset.result) return;
    const result = JSON.parse(outEl.dataset.result);
    // Consume ingredients
    for (let r=0;r<grid.length;r++) for (let c=0;c<grid[r].length;c++) {
      if (grid[r][c]) {
        this.inventory.consumeItem(grid[r][c], 1);
        grid[r][c] = null;
      }
    }
    // Give output
    this.inventory.addItem({ ...result });
    outEl.innerHTML = '';
    delete outEl.dataset.result;
    const container = outEl.id === 'crafting-output'
      ? document.getElementById('crafting-grid-2x2')
      : document.getElementById('crafting-grid-3x3');
    if (container) {
      const rows = grid.length, cols = grid[0].length;
      this._refreshGridUI(container, grid, rows, cols);
    }
  }
}
