// Chest UI with server-backed storage.
class ChestUI {
  constructor(inventory, network) {
    this.inventory = inventory;
    this.network = network;
    this.currentKey = null;
    this.slots = new Array(27).fill(null);

    if (this.network) {
      this.network.onChestData((msg) => {
        if (msg.key !== this.currentKey) return;
        this.slots = Array.isArray(msg.slots) ? msg.slots.slice(0, 27) : new Array(27).fill(null);
        while (this.slots.length < 27) this.slots.push(null);
        this.refresh();
      });
    }

    const originalRefresh = this.inventory.refresh.bind(this.inventory);
    this.inventory.refresh = () => {
      originalRefresh();
      if (window.crafting && window.crafting.refreshLists) window.crafting.refreshLists();
      if (window.furnace && window.furnace.refresh) window.furnace.refresh();
      this.refresh();
    };

    this._build();
  }

  openAt(pos) {
    this.currentKey = `${pos.x},${pos.y},${pos.z}`;
    this.slots = new Array(27).fill(null);
    if (this.network) this.network.requestChest(this.currentKey);
    this.refresh();
  }

  close() {
    this.currentKey = null;
  }

  _getLabel(id) {
    const itemDef = Object.values(ITEM_TYPES).find((it) => it.id === id);
    if (itemDef) return itemDef.name;
    return BLOCK_NAMES[id] || `ID ${id}`;
  }

  _slotToItemLike(slot) {
    if (!slot) return null;
    if (slot.type === 'item') {
      const itemDef = Object.values(ITEM_TYPES).find((it) => it.id === slot.id) || null;
      return { id: slot.id, count: slot.count, type: 'item', itemDef };
    }
    return { id: slot.id, count: slot.count, type: 'block' };
  }

  _renderSlotIcon(slot) {
    const item = this._slotToItemLike(slot);
    if (!item) return null;

    if (item.type === 'block' && blockTextures[item.id]) {
      const source = blockTextures[item.id].image || blockTextures[item.id].source?.data;
      if (source) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        canvas.className = 'craft-btn-icon';
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(source, 0, 0, 16, 16, 0, 0, 32, 32);
        return canvas;
      }
    }

    if (item.type === 'item') {
      const tex = itemTextures[item.id];
      const source = tex?.image || tex?.source?.data;
      if (source) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        canvas.className = 'craft-btn-icon';
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(source, 0, 0, 16, 16, 0, 0, 32, 32);
        return canvas;
      }
    }

    const fallback = document.createElement('div');
    fallback.className = 'craft-btn-icon';
    fallback.textContent = '?';
    fallback.style.display = 'flex';
    fallback.style.alignItems = 'center';
    fallback.style.justifyContent = 'center';
    return fallback;
  }

  _takeFromChest(index) {
    const slot = this.slots[index];
    if (!slot) return;
    const itemLike = this._slotToItemLike(slot);
    if (!itemLike) return;

    const added = this.inventory.addItem({ ...itemLike });
    if (added < 0) return;
    this.slots[index] = null;
    this._pushUpdate();
  }

  _insertToChestFromItemLike(index, itemLike, amount) {
    if (!itemLike || amount <= 0) return 0;
    const slot = this.slots[index];
    if (slot && (slot.id !== itemLike.id || slot.type !== itemLike.type)) return 0;
    const current = slot ? slot.count : 0;
    const space = Math.max(0, 64 - current);
    const moved = Math.min(space, amount);
    if (moved <= 0) return 0;

    if (!slot) this.slots[index] = { id: itemLike.id, count: moved, type: itemLike.type };
    else slot.count += moved;
    return moved;
  }

  _placeDraggedIntoChest(index, oneOnly = false) {
    const drag = this.inventory.dragItem;
    if (!drag) return false;
    const want = oneOnly ? 1 : drag.count;
    const moved = this._insertToChestFromItemLike(index, drag, want);
    if (moved <= 0) return false;

    drag.count -= moved;
    if (drag.count <= 0) {
      this.inventory.dragItem = null;
      this.inventory.dragFromIndex = -1;
      if (this.inventory._stopDrag) this.inventory._stopDrag();
    }

    this.inventory.refresh();
    this._pushUpdate();
    return true;
  }

  quickMoveFromInventory(index) {
    const from = this.inventory.slots[index];
    if (!from) return false;

    let remaining = from.count;
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const slot = this.slots[i];
      if (!slot || slot.id !== from.id || slot.type !== from.type) continue;
      const moved = this._insertToChestFromItemLike(i, from, remaining);
      remaining -= moved;
    }
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (this.slots[i]) continue;
      const moved = this._insertToChestFromItemLike(i, from, remaining);
      remaining -= moved;
    }

    if (remaining === from.count) return false;
    from.count = remaining;
    if (from.count <= 0) this.inventory.slots[index] = null;
    this.inventory.refresh();
    this._pushUpdate();
    return true;
  }

  _putSelectedToChest(index) {
    const selected = this.inventory.getHotbarItem();
    if (!selected) return;

    const inChest = this.slots[index];
    if (inChest && (inChest.id !== selected.id || inChest.type !== selected.type)) return;

    if (!inChest) {
      this.slots[index] = { id: selected.id, count: 1, type: selected.type };
    } else {
      inChest.count += 1;
    }

    this.inventory.removeItem(this.inventory.hotbarIndex, 1);
    this._pushUpdate();
  }

  _pushUpdate() {
    this.refresh();
    if (this.network && this.currentKey) this.network.updateChest(this.currentKey, this.slots);
  }

  _build() {
    const grid = document.getElementById('chest-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < 27; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'craft-btn';
      btn.dataset.index = String(i);
      btn.addEventListener('click', (e) => {
        if (this.inventory.dragItem) {
          this._placeDraggedIntoChest(i, false);
          return;
        }
        if (e.ctrlKey) {
          this._takeFromChest(i);
          return;
        }
        this._takeFromChest(i);
      });
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (this.inventory.dragItem) {
          this._placeDraggedIntoChest(i, true);
          return;
        }
        this._putSelectedToChest(i);
      });
      grid.appendChild(btn);
    }
    this.refresh();
  }

  refresh() {
    const grid = document.getElementById('chest-grid');
    if (!grid) return;
    const buttons = grid.querySelectorAll('.craft-btn');
    buttons.forEach((btn, i) => {
      btn.innerHTML = '';
      const slot = this.slots[i];

      const body = document.createElement('div');
      body.className = 'craft-btn-main';

      const name = document.createElement('div');
      name.className = 'craft-btn-name';
      name.textContent = slot ? this._getLabel(slot.id) : 'Empty Slot';

      const meta = document.createElement('div');
      meta.className = 'craft-btn-meta';
      meta.textContent = slot
        ? `Count: ${slot.count} (Click/Ctrl-click take, drag to store)`
        : 'Drag items here, Ctrl-click inventory to quick-move';

      const icon = slot ? this._renderSlotIcon(slot) : (() => {
        const placeholder = document.createElement('div');
        placeholder.className = 'craft-btn-icon';
        placeholder.style.display = 'flex';
        placeholder.style.alignItems = 'center';
        placeholder.style.justifyContent = 'center';
        placeholder.textContent = '+';
        return placeholder;
      })();

      btn.appendChild(icon);
      body.appendChild(name);
      body.appendChild(meta);
      btn.appendChild(body);
    });
  }
}
