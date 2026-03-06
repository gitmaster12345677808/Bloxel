// ─── Inventory system ──────────────────────────────────────────────────
const HOTBAR_SIZE = 9;
const INV_SIZE = 36; // 9 hotbar + 27 storage

class Inventory {
  constructor() {
    this.slots = new Array(INV_SIZE).fill(null); // { id, count, type:'block'|'item', itemDef }
    this.hotbarIndex = 0;
    this.dragItem = null;

    // Give starter items
    this._giveStarter();
    this._buildHotbar();
    this._buildInventoryGrid();
    this._bindHotkeys();
  }

  _giveStarter() {
    this.addItem({ id: BLOCKS.PLANKS, count: 16, type: 'block' });
    this.addItem({ id: BLOCKS.DIRT,   count: 32, type: 'block' });
    this.addItem({ id: BLOCKS.STONE,  count: 16, type: 'block' });
    this.addItem({ id: ITEM_TYPES.WOOD_PICK.id, count: 1, type: 'item', itemDef: ITEM_TYPES.WOOD_PICK });
    this.addItem({ id: ITEM_TYPES.BREAD.id,    count: 8, type: 'item', itemDef: ITEM_TYPES.BREAD });
  }

  addItem(item) {
    // Try to stack
    for (let i = 0; i < INV_SIZE; i++) {
      if (this.slots[i] && this.slots[i].id === item.id) {
        this.slots[i].count += item.count;
        this.refresh();
        return i;
      }
    }
    // Empty slot
    for (let i = 0; i < INV_SIZE; i++) {
      if (!this.slots[i]) {
        this.slots[i] = { ...item };
        this.refresh();
        return i;
      }
    }
    return -1;
  }

  removeItem(slotIndex, count) {
    if (!this.slots[slotIndex]) return;
    this.slots[slotIndex].count -= count;
    if (this.slots[slotIndex].count <= 0) this.slots[slotIndex] = null;
    this.refresh();
  }

  consumeItem(id, count=1) {
    for (let i=0; i<INV_SIZE; i++) {
      if (this.slots[i] && this.slots[i].id === id) {
        this.removeItem(i, count);
        return true;
      }
    }
    return false;
  }

  countItem(id) {
    let total = 0;
    for (const s of this.slots) if (s && s.id === id) total += s.count;
    return total;
  }

  getHotbarItem() {
    return this.slots[this.hotbarIndex];
  }

  setHotbarIndex(i) {
    this.hotbarIndex = ((i % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    this._updateHotbarUI();
  }

  giveAllBlocks() {
    for (const [name, id] of Object.entries(BLOCKS)) {
      if (id === BLOCKS.AIR) continue;
      this.addItem({ id, count: 64, type: 'block' });
    }
    this.refresh();
  }

  refresh() {
    this._buildHotbar();
    this._updateInventoryGrid();
  }

  // ─── Hotbar UI ────────────────────────────────────────────────────────
  _buildHotbar() {
    const hb = document.getElementById('hotbar');
    if (!hb) return;
    hb.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const div = document.createElement('div');
      div.className = 'hotbar-slot' + (i === this.hotbarIndex ? ' active' : '');
      div.dataset.index = i;
      const slot = this.slots[i];
      if (slot) {
        const icon = this._makeIcon(slot);
        div.appendChild(icon);
        if (slot.count > 1) {
          const cnt = document.createElement('span');
          cnt.className = 'slot-count';
          cnt.textContent = slot.count;
          div.appendChild(cnt);
        }
      }
      div.addEventListener('click', () => this.setHotbarIndex(i));
      hb.appendChild(div);
    }
  }

  _updateHotbarUI() {
    document.querySelectorAll('.hotbar-slot').forEach((el,i)=>{
      el.classList.toggle('active', i === this.hotbarIndex);
    });
  }

  // ─── Inventory Grid UI ────────────────────────────────────────────────
  _buildInventoryGrid() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < INV_SIZE; i++) {
      const div = document.createElement('div');
      div.className = 'inv-slot';
      div.dataset.index = i;
      grid.appendChild(div);
      this._bindSlotDrag(div, i);
    }
    this._updateInventoryGrid();
  }

  _updateInventoryGrid() {
    const slots = document.querySelectorAll('#inventory-grid .inv-slot');
    slots.forEach((el, i) => {
      el.innerHTML = '';
      const slot = this.slots[i];
      if (slot) {
        const icon = this._makeIcon(slot);
        el.appendChild(icon);
        if (slot.count > 1) {
          const cnt = document.createElement('span');
          cnt.className = 'slot-count';
          cnt.textContent = slot.count;
          el.appendChild(cnt);
        }
      }
    });
  }

  _makeIcon(slot) {
    if (slot.type === 'block' && blockTextures[slot.id]) {
      const canvas = blockTextures[slot.id].image;
      const img = canvas.cloneNode();
      img.className = 'slot-icon';
      return img;
    }
    // Fallback: text label
    const span = document.createElement('span');
    span.style.fontSize = '9px';
    span.style.textAlign = 'center';
    span.style.lineHeight = '1.1';
    span.style.padding = '2px';
    span.textContent = slot.itemDef ? slot.itemDef.name.split(' ').slice(-1)[0] : (BLOCK_NAMES[slot.id] || '?');
    return span;
  }

  // ─── Drag and Drop ────────────────────────────────────────────────────
  _bindSlotDrag(el, index) {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (this.dragItem) {
        // Place dragged item
        const tmp = this.slots[index];
        this.slots[index] = this.dragItem;
        this.dragItem = tmp;
        this._stopDrag();
        this.refresh();
      } else if (this.slots[index]) {
        if (e.button === 2) {
          // Right click: split stack
          const half = Math.ceil(this.slots[index].count / 2);
          this.dragItem = { ...this.slots[index], count: half };
          this.slots[index].count -= half;
          if (this.slots[index].count <= 0) this.slots[index] = null;
        } else {
          this.dragItem = this.slots[index];
          this.slots[index] = null;
        }
        this._startDrag(this.dragItem);
        this.refresh();
      }
    });
  }

  _startDrag(item) {
    let ghost = document.getElementById('drag-ghost');
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.id = 'drag-ghost';
      ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;width:44px;height:44px;background:rgba(0,0,0,0.7);border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff';
      document.body.appendChild(ghost);
    }
    ghost.innerHTML = '';
    ghost.appendChild(this._makeIcon(item));
    document.addEventListener('mousemove', this._onDragMove);
    document.addEventListener('mouseup', this._onDragUp);
  }

  _onDragMove = (e) => {
    const ghost = document.getElementById('drag-ghost');
    if (ghost) { ghost.style.left=(e.clientX-22)+'px'; ghost.style.top=(e.clientY-22)+'px'; }
  };

  _onDragUp = (e) => {
    this._stopDrag();
    if (this.dragItem) {
      // Drop back to first empty slot
      const slot = this.slots.findIndex(s=>!s);
      if (slot>=0) this.slots[slot] = this.dragItem;
      this.dragItem = null;
      this.refresh();
    }
  };

  _stopDrag() {
    document.removeEventListener('mousemove', this._onDragMove);
    document.removeEventListener('mouseup', this._onDragUp);
    const ghost = document.getElementById('drag-ghost');
    if (ghost) ghost.remove();
  }

  // ─── Hotkeys ──────────────────────────────────────────────────────────
  _bindHotkeys() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      const n = parseInt(e.key);
      if (n >= 1 && n <= 9) this.setHotbarIndex(n - 1);
      if (e.code === 'Digit0') this.setHotbarIndex(0);
    });

    document.addEventListener('wheel', e => {
      if (e.target.tagName === 'INPUT') return;
      const d = e.deltaY > 0 ? 1 : -1;
      this.setHotbarIndex(this.hotbarIndex + d);
    }, { passive: true });
  }
}
