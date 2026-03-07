// ─── Inventory system ──────────────────────────────────────────────────
const HOTBAR_SIZE = 9;
const INV_SIZE = 36; // 9 hotbar + 27 storage

class Inventory {
  constructor() {
    this.slots = new Array(INV_SIZE).fill(null); // { id, count, type:'block'|'item', itemDef }
    this.armor = { head: null, chest: null, legs: null, feet: null };
    this.hotbarIndex = 0;
    this.dragItem = null;
    this.dragFromIndex = -1;

    // Give starter items
    this._giveStarter();
    this._buildHotbar();
    this._buildInventoryGrid();
    this._bindArmorSlots();
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
    const stack = this._normalizeItem(item);
    if (!stack) return -1;
    const maxStack = this._maxStackFor(stack);

    if (maxStack > 1) {
      // Try to stack non-durable items.
      for (let i = 0; i < INV_SIZE; i++) {
        if (this.slots[i] && this._canStack(this.slots[i], stack)) {
          this.slots[i].count += stack.count;
          this.refresh();
          return i;
        }
      }
    }

    // Place each item stack unit where needed.
    let remaining = stack.count;
    let firstIndex = -1;
    while (remaining > 0) {
      const take = Math.min(maxStack, remaining);
      const idx = this.slots.findIndex((s) => !s);
      if (idx < 0) break;
      const next = { ...stack, count: take };
      if (this._isDurableItem(next) && typeof next.durability !== 'number') {
        next.durability = next.itemDef?.durability || 1;
      }
      this.slots[idx] = next;
      if (firstIndex < 0) firstIndex = idx;
      remaining -= take;
    }

    this.refresh();
    return remaining === 0 ? firstIndex : -1;
  }

  _normalizeItem(item) {
    if (!item || typeof item.id !== 'number') return null;
    const out = {
      id: item.id,
      count: Math.max(1, Math.floor(item.count || 1)),
      type: item.type === 'item' ? 'item' : 'block',
    };
    if (out.type === 'item') {
      out.itemDef = item.itemDef || Object.values(ITEM_TYPES).find((it) => it.id === out.id) || null;
      if (!out.itemDef) return null;
      if (typeof item.durability === 'number') out.durability = Math.max(0, Math.floor(item.durability));
    }
    return out;
  }

  _isDurableItem(item) {
    return !!(item && item.type === 'item' && item.itemDef && Number(item.itemDef.durability) > 0);
  }

  _maxStackFor(item) {
    if (this._isDurableItem(item)) return 1;
    return 64;
  }

  _canStack(a, b) {
    if (!a || !b || a.id !== b.id || a.type !== b.type) return false;
    if (this._isDurableItem(a) || this._isDurableItem(b)) return false;
    return true;
  }

  removeItem(slotIndex, count) {
    if (!this.slots[slotIndex]) return;
    this.slots[slotIndex].count -= count;
    if (this.slots[slotIndex].count <= 0) this.slots[slotIndex] = null;
    this.refresh();
  }

  consumeItem(id, count=1) {
    let remaining = count;
    for (let i = 0; i < INV_SIZE && remaining > 0; i++) {
      const slot = this.slots[i];
      if (!slot || slot.id !== id) continue;
      const take = Math.min(slot.count, remaining);
      slot.count -= take;
      remaining -= take;
      if (slot.count <= 0) this.slots[i] = null;
    }
    this.refresh();
    return remaining === 0;
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
    this._showSlotName(this.getHotbarItem());
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
    this._updateArmorUI();
  }

  serialize() {
    return this.slots.map((slot) => {
      if (!slot) return null;
      const out = { id: slot.id, count: slot.count, type: slot.type };
      if (slot.itemDef) out.itemKey = Object.keys(ITEM_TYPES).find((k) => ITEM_TYPES[k].id === slot.id) || null;
      if (typeof slot.durability === 'number') out.durability = slot.durability;
      return out;
    });
  }

  serializeState() {
    const armor = {};
    for (const key of ['head', 'chest', 'legs', 'feet']) {
      const slot = this.armor[key];
      if (!slot) {
        armor[key] = null;
        continue;
      }
      armor[key] = {
        id: slot.id,
        count: slot.count,
        type: slot.type,
        itemKey: Object.keys(ITEM_TYPES).find((k) => ITEM_TYPES[k].id === slot.id) || null,
        durability: typeof slot.durability === 'number' ? slot.durability : undefined,
      };
    }
    return { slots: this.serialize(), armor };
  }

  loadSerialized(serializedSlots) {
    if (!Array.isArray(serializedSlots)) return;
    const next = new Array(INV_SIZE).fill(null);
    for (let i = 0; i < Math.min(INV_SIZE, serializedSlots.length); i++) {
      const s = serializedSlots[i];
      if (!s || typeof s.id !== 'number' || typeof s.count !== 'number') continue;
      const slot = { id: s.id, count: Math.max(1, Math.floor(s.count)), type: s.type === 'item' ? 'item' : 'block' };
      if (slot.type === 'item') {
        if (s.itemKey && ITEM_TYPES[s.itemKey]) slot.itemDef = ITEM_TYPES[s.itemKey];
        else slot.itemDef = Object.values(ITEM_TYPES).find((it) => it.id === s.id) || null;
        if (typeof s.durability === 'number') slot.durability = Math.max(0, Math.floor(s.durability));
      }
      next[i] = slot;
    }
    this.slots = next;
    this.hotbarIndex = Math.max(0, Math.min(HOTBAR_SIZE - 1, this.hotbarIndex));
    this.refresh();
  }

  loadState(state) {
    if (Array.isArray(state)) {
      this.loadSerialized(state);
      return;
    }
    if (!state || typeof state !== 'object') return;
    this.loadSerialized(Array.isArray(state.slots) ? state.slots : []);
    this.armor = { head: null, chest: null, legs: null, feet: null };
    const armorState = state.armor || {};
    for (const key of ['head', 'chest', 'legs', 'feet']) {
      const s = armorState[key];
      if (!s || typeof s.id !== 'number') continue;
      const itemDef = (s.itemKey && ITEM_TYPES[s.itemKey]) || Object.values(ITEM_TYPES).find((it) => it.id === s.id) || null;
      if (!itemDef) continue;
      this.armor[key] = {
        id: s.id,
        count: 1,
        type: 'item',
        itemDef,
        durability: typeof s.durability === 'number' ? Math.max(0, Math.floor(s.durability)) : (itemDef.durability || 1),
      };
    }
    this.refresh();
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
      div.dataset.slotIndex = i;
      div.style.cursor = 'pointer';
      div.style.userSelect = 'none';
      const slot = this.slots[i];
      if (slot) {
        div.title = this._getSlotName(slot);
        try {
          const icon = this._makeIcon(slot);
          div.appendChild(icon);
        } catch (e) {
          console.warn('Error creating hotbar icon:', e);
        }
        if (slot.count > 1) {
          const cnt = document.createElement('span');
          cnt.className = 'slot-count';
          cnt.textContent = slot.count;
          div.appendChild(cnt);
        }
      }
      // Add click event with error handling
      div.addEventListener('click', (e) => {
        if (window.ui && (window.ui.inventoryOpen || window.ui.craftingTableOpen)) return;
        e.preventDefault();
        e.stopPropagation();
        this.setHotbarIndex(i);
        this._showSlotName(slot);
      });
      this._bindSlotDrag(div, i, { hotbar: true });
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
      div.dataset.slotIndex = i;
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
        el.title = this._getSlotName(slot);
        const icon = this._makeIcon(slot);
        el.appendChild(icon);
        if (slot.count > 1) {
          const cnt = document.createElement('span');
          cnt.className = 'slot-count';
          cnt.textContent = slot.count;
          el.appendChild(cnt);
        }
      }
      if (!slot) el.title = '';
    });
  }

  _makeIcon(slot) {
    // Block icon - create canvas element
    if (slot.type === 'block' && blockTextures[slot.id]) {
      try {
        const tex = blockTextures[slot.id];
        const sourceCanvas = tex.image || tex.source?.data;
        if (sourceCanvas) {
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          canvas.className = 'slot-icon';
          const ctx = canvas.getContext('2d');
          // Scale up the 16x16 texture to 32x32 with pixelated style
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(sourceCanvas, 0, 0, 16, 16, 0, 0, 32, 32);
          return canvas;
        }
      } catch (e) {
        console.warn('Error creating block icon for block', slot.id, e);
      }
    }
    // Item icon
    if (slot.type === 'item' && slot.itemDef) {
      const tex = itemTextures[slot.id];
      const sourceCanvas = tex?.image || tex?.source?.data;
      if (sourceCanvas) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        canvas.className = 'slot-icon';
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sourceCanvas, 0, 0, 16, 16, 0, 0, 32, 32);
        return canvas;
      }

      const div = document.createElement('div');
      div.className = 'item-icon';
      if (slot.itemDef.color) div.style.backgroundColor = slot.itemDef.color;
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.style.justifyContent = 'center';
      div.style.fontSize = '9px';
      div.textContent = this._shortLabel(slot.itemDef.name);
      return div;
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

  _shortLabel(name) {
    return String(name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  _getSlotName(slot) {
    if (!slot) return '';
    const base = slot.type === 'item' && slot.itemDef ? slot.itemDef.name : (BLOCK_NAMES[slot.id] || 'Unknown');
    if (typeof slot.durability === 'number' && slot.itemDef?.durability) {
      return `${base} (${slot.durability}/${slot.itemDef.durability})`;
    }
    return base;
  }

  _showSlotName(slot) {
    if (!window.ui || !slot) return;
    window.ui.showItemName(this._getSlotName(slot));
  }

  // ─── Drag and Drop ────────────────────────────────────────────────────
  _bindSlotDrag(el, index, opts = {}) {
    const onDown = (e, button = 0) => {
      const canDrag = !window.ui || window.ui.inventoryOpen || window.ui.craftingTableOpen || window.ui.chestOpen || window.ui.furnaceOpen;
      if (!canDrag && opts.hotbar) return;
      if (!canDrag) return;

      if (this.slots[index]) this._showSlotName(this.slots[index]);

      e.preventDefault();
      e.stopPropagation();

      const canQuickMove = !!(window.ui && (window.ui.chestOpen || window.ui.furnaceOpen));
      if (e.ctrlKey && !this.dragItem && this.slots[index] && canQuickMove) {
        let moved = false;
        if (window.ui.chestOpen && window.chest && window.chest.quickMoveFromInventory) {
          moved = !!window.chest.quickMoveFromInventory(index);
        } else if (window.ui.furnaceOpen && window.furnace && window.furnace.quickMoveFromInventory) {
          moved = !!window.furnace.quickMoveFromInventory(index);
        }
        if (moved) {
          this.refresh();
          return;
        }
      }

      if (this.dragItem) {
        // Place dragged item
        const tmp = this.slots[index];
        this.slots[index] = this.dragItem;
        this.dragItem = tmp;
        if (this.dragItem) {
          this.dragFromIndex = index;
          this._startDrag(this.dragItem);
        } else {
          this.dragFromIndex = -1;
          this._stopDrag();
        }
        this.refresh();
      } else if (this.slots[index]) {
        if (button === 2) {
          // Right click: split stack
          const half = Math.ceil(this.slots[index].count / 2);
          this.dragItem = { ...this.slots[index], count: half };
          this.slots[index].count -= half;
          if (this.slots[index].count <= 0) this.slots[index] = null;
        } else {
          this.dragItem = this.slots[index];
          this.slots[index] = null;
        }
        this.dragFromIndex = index;
        this._startDrag(this.dragItem);
        this.refresh();
      }
    };

    el.addEventListener('mousedown', (e) => onDown(e, e.button));
    el.addEventListener('touchstart', (e) => {
      const touch = e.changedTouches && e.changedTouches[0];
      if (!touch) return;
      onDown(e, 0);
      this._positionGhost(touch.clientX, touch.clientY);
    }, { passive: false });

    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _startDrag(item) {
    let ghost = document.getElementById('drag-ghost');
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.id = 'drag-ghost';
      ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;width:44px;height:44px;background:rgba(0,0,0,0.7);border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;border-radius:2px';
      document.body.appendChild(ghost);
    }
    ghost.innerHTML = '';
    try {
      ghost.appendChild(this._makeIcon(item));
    } catch (e) {
      console.warn('Error creating drag icon:', e);
    }

    if (!this._dragMouseMove) {
      this._dragMouseMove = this._onDragMove.bind(this);
      document.addEventListener('mousemove', this._dragMouseMove);
    }
    if (!this._dragTouchMove) {
      this._dragTouchMove = this._onDragTouchMove.bind(this);
      document.addEventListener('touchmove', this._dragTouchMove, { passive: false });
    }
  }

  _positionGhost(x, y) {
    const ghost = document.getElementById('drag-ghost');
    if (!ghost) return;
    ghost.style.left = (x - 22) + 'px';
    ghost.style.top = (y - 22) + 'px';
  }

  _onDragMove = (e) => {
    this._positionGhost(e.clientX, e.clientY);
  };

  _onDragTouchMove = (e) => {
    if (!this.dragItem) return;
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    e.preventDefault();
    this._positionGhost(touch.clientX, touch.clientY);
  };

  _stopDrag() {
    if (this._dragMouseMove) document.removeEventListener('mousemove', this._dragMouseMove);
    if (this._dragTouchMove) document.removeEventListener('touchmove', this._dragTouchMove);
    this._dragMouseMove = null;
    this._dragTouchMove = null;
    const ghost = document.getElementById('drag-ghost');
    if (ghost) ghost.remove();
  }

  cancelDrag() {
    if (!this.dragItem) return;

    if (this.dragFromIndex >= 0 && !this.slots[this.dragFromIndex]) {
      this.slots[this.dragFromIndex] = this.dragItem;
    } else {
      const empty = this.slots.findIndex((s) => !s);
      if (empty >= 0) this.slots[empty] = this.dragItem;
    }

    this.dragItem = null;
    this.dragFromIndex = -1;
    this._stopDrag();
    this.refresh();
  }

  _bindArmorSlots() {
    const slots = document.querySelectorAll('#armor-panel .armor-slot');
    slots.forEach((el) => {
      const key = el.dataset.armorSlot;
      if (!key) return;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.dragItem) {
          if (this.dragItem.itemDef?.armor !== key) return;
          const prev = this.armor[key];
          this.armor[key] = { ...this.dragItem, count: 1 };
          this.dragItem = prev || null;
          if (!this.dragItem) this._stopDrag();
          this.refresh();
          return;
        }

        const equipped = this.armor[key];
        if (!equipped) return;
        const idx = this.slots.findIndex((s) => !s);
        if (idx < 0) return;
        this.slots[idx] = equipped;
        this.armor[key] = null;
        this.refresh();
      });
    });
  }

  _updateArmorUI() {
    const slots = document.querySelectorAll('#armor-panel .armor-slot');
    const symbol = { head: 'H', chest: 'C', legs: 'L', feet: 'B' };
    slots.forEach((el) => {
      const key = el.dataset.armorSlot;
      el.innerHTML = '';
      const equipped = this.armor[key];
      if (!equipped) {
        const badge = document.createElement('span');
        badge.style.fontSize = '10px';
        badge.style.color = '#8ea1bc';
        badge.textContent = symbol[key] || 'A';
        el.appendChild(badge);
        return;
      }
      const icon = this._makeIcon(equipped);
      el.appendChild(icon);
      el.title = this._getSlotName(equipped);
    });
  }

  equipFromInventory(index) {
    const slot = this.slots[index];
    if (!slot || slot.type !== 'item' || !slot.itemDef?.armor) return false;
    const armorKey = slot.itemDef.armor;
    const previous = this.armor[armorKey];
    this.armor[armorKey] = { ...slot, count: 1 };
    this.slots[index] = previous || null;
    this.refresh();
    return true;
  }

  useHeldItemDurability(amount = 1) {
    const item = this.getHotbarItem();
    if (!item || !this._isDurableItem(item)) return;
    item.durability = Math.max(0, (typeof item.durability === 'number' ? item.durability : item.itemDef.durability) - amount);
    if (item.durability <= 0) {
      this.slots[this.hotbarIndex] = null;
    }
    this.refresh();
  }

  getArmorReduction() {
    let armorPoints = 0;
    for (const key of ['head', 'chest', 'legs', 'feet']) {
      const slot = this.armor[key];
      if (!slot || !slot.itemDef?.armorValue) continue;
      armorPoints += Number(slot.itemDef.armorValue) || 0;
    }
    return Math.min(0.8, armorPoints * 0.04);
  }

  damageEquippedArmor(amount = 1) {
    const keys = ['head', 'chest', 'legs', 'feet'];
    for (const key of keys) {
      const slot = this.armor[key];
      if (!slot || !slot.itemDef?.durability) continue;
      slot.durability = Math.max(0, (typeof slot.durability === 'number' ? slot.durability : slot.itemDef.durability) - amount);
      if (slot.durability <= 0) this.armor[key] = null;
    }
    this.refresh();
  }

  // ─── Hotkeys ──────────────────────────────────────────────────────────
  _bindHotkeys() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      const n = parseInt(e.key);
      if (n >= 1 && n <= 9) this.setHotbarIndex(n - 1);
      if (e.code === 'Digit0') this.setHotbarIndex(0);
      if (e.code === 'KeyR') {
        const picked = this.equipFromInventory(this.hotbarIndex);
        if (picked && this.getHotbarItem()) this._showSlotName(this.getHotbarItem());
      }
    });

    document.addEventListener('wheel', e => {
      if (e.target.tagName === 'INPUT') return;
      const d = e.deltaY > 0 ? 1 : -1;
      this.setHotbarIndex(this.hotbarIndex + d);
    }, { passive: true });
  }
}
