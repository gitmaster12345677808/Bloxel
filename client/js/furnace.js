// Furnace UI - recipes are now defined in crafts.js for easy management.

class FurnaceUI {
  constructor(inventory, network) {
    this.inventory = inventory;
    this.network = network;
    this.currentKey = null;
    this.state = this._emptyState();
    this._build();

    if (this.network) {
      this.network.onFurnaceData((msg) => {
        if (!this.currentKey || msg.key !== this.currentKey) return;
        this.state = this._sanitizeState(msg.state);
        this.refresh();
      });
    }

    const originalRefresh = this.inventory.refresh.bind(this.inventory);
    this.inventory.refresh = () => {
      originalRefresh();
      this.refresh();
      if (window.crafting && window.crafting.refreshLists) window.crafting.refreshLists();
    };
  }

  _emptyState() {
    return { input: null, fuel: null, output: null, progress: 0, burn: 0, burnMax: 0 };
  }

  _sanitizeSlot(slot) {
    if (!slot || typeof slot.id !== 'number') return null;
    return {
      id: slot.id,
      count: Math.max(1, Math.floor(slot.count || 1)),
      type: slot.type === 'item' ? 'item' : 'block',
    };
  }

  _sanitizeState(state) {
    const s = state || {};
    return {
      input: this._sanitizeSlot(s.input),
      fuel: this._sanitizeSlot(s.fuel),
      output: this._sanitizeSlot(s.output),
      progress: Math.max(0, Number(s.progress) || 0),
      burn: Math.max(0, Number(s.burn) || 0),
      burnMax: Math.max(0, Number(s.burnMax) || 0),
    };
  }

  openAt(pos) {
    if (!pos) return;
    this.currentKey = `${pos.x},${pos.y},${pos.z}`;
    this.state = this._emptyState();
    if (this.network) this.network.requestFurnace(this.currentKey);
    this.refresh();
  }

  close() {
    this.currentKey = null;
  }

  tick() {
    if (window.ui && window.ui.furnaceOpen) this.refresh();
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

  _makeIcon(slot) {
    const item = this._slotToItemLike(slot);
    if (!item) {
      const fallback = document.createElement('div');
      fallback.className = 'craft-btn-icon';
      fallback.textContent = '+';
      fallback.style.display = 'flex';
      fallback.style.alignItems = 'center';
      fallback.style.justifyContent = 'center';
      return fallback;
    }

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

    const fallback = document.createElement('div');
    fallback.className = 'craft-btn-icon';
    fallback.textContent = '?';
    fallback.style.display = 'flex';
    fallback.style.alignItems = 'center';
    fallback.style.justifyContent = 'center';
    return fallback;
  }

  _push() {
    if (this.network && this.currentKey) {
      this.network.updateFurnace(this.currentKey, this.state);
    }
  }

  _canPutToInput(selected) {
    return !!selected && !!SMELTING_RECIPES[selected.id];
  }

  _canPutToFuel(selected) {
    return !!selected && !!FURNACE_FUELS[selected.id];
  }

  _putSelected(slotName) {
    if (!this.currentKey) return;
    const selected = this.inventory.getHotbarItem();
    if (!selected) return;
    if (slotName === 'input' && !this._canPutToInput(selected)) return;
    if (slotName === 'fuel' && !this._canPutToFuel(selected)) return;

    const slot = this.state[slotName];
    if (slot && (slot.id !== selected.id || slot.type !== selected.type)) return;

    if (!slot) {
      this.state[slotName] = { id: selected.id, count: 1, type: selected.type };
    } else {
      slot.count = Math.min(64, slot.count + 1);
    }

    this.inventory.removeItem(this.inventory.hotbarIndex, 1);
    this._push();
    this.refresh();
  }

  _takeSlotToInventory(slotName) {
    if (!this.currentKey) return false;
    const slot = this.state[slotName];
    if (!slot) return false;
    const itemLike = this._slotToItemLike(slot);
    const added = this.inventory.addItem(itemLike);
    if (added < 0) return false;
    this.state[slotName] = null;
    this._push();
    this.refresh();
    return true;
  }

  _insertFromItemLike(slotName, itemLike, amount) {
    if (!itemLike || amount <= 0) return 0;
    if (slotName === 'input' && !this._canPutToInput(itemLike)) return 0;
    if (slotName === 'fuel' && !this._canPutToFuel(itemLike)) return 0;

    const slot = this.state[slotName];
    if (slot && (slot.id !== itemLike.id || slot.type !== itemLike.type)) return 0;
    const current = slot ? slot.count : 0;
    const space = Math.max(0, 64 - current);
    const moved = Math.min(space, amount);
    if (moved <= 0) return 0;

    if (!slot) this.state[slotName] = { id: itemLike.id, count: moved, type: itemLike.type };
    else slot.count += moved;
    return moved;
  }

  _placeDragged(slotName, oneOnly = false) {
    if (slotName === 'output') return false;
    const drag = this.inventory.dragItem;
    if (!drag) return false;

    const want = oneOnly ? 1 : drag.count;
    const moved = this._insertFromItemLike(slotName, drag, want);
    if (moved <= 0) return false;

    drag.count -= moved;
    if (drag.count <= 0) {
      this.inventory.dragItem = null;
      this.inventory.dragFromIndex = -1;
      if (this.inventory._stopDrag) this.inventory._stopDrag();
    }

    this.inventory.refresh();
    this._push();
    this.refresh();
    return true;
  }

  quickMoveFromInventory(index) {
    const from = this.inventory.slots[index];
    if (!from) return false;

    let remaining = from.count;
    if (this._canPutToInput(from)) {
      const moved = this._insertFromItemLike('input', from, remaining);
      remaining -= moved;
    }
    if (remaining > 0 && this._canPutToFuel(from)) {
      const moved = this._insertFromItemLike('fuel', from, remaining);
      remaining -= moved;
    }

    if (remaining === from.count) return false;
    from.count = remaining;
    if (from.count <= 0) this.inventory.slots[index] = null;
    this.inventory.refresh();
    this._push();
    this.refresh();
    return true;
  }

  _takeOutput() {
    if (!this.currentKey || !this.state.output) return;
    const added = this.inventory.addItem(this._slotToItemLike(this.state.output));
    if (added < 0) return;
    this.state.output.count -= 1;
    if (this.state.output.count <= 0) this.state.output = null;
    this._push();
    this.refresh();
  }

  _build() {
    const container = document.getElementById('furnace-list');
    if (!container) return;
    container.innerHTML = '';

    const makeBtn = (slotName, title, desc, onClick) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'craft-btn';
      btn.dataset.slot = slotName;
      btn.addEventListener('click', (e) => {
        if (this.inventory.dragItem) {
          this._placeDragged(slotName, false);
          return;
        }
        if (e.ctrlKey) {
          if (slotName === 'output') this._takeOutput();
          else this._takeSlotToInventory(slotName);
          return;
        }
        onClick();
      });
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (this.inventory.dragItem) {
          this._placeDragged(slotName, true);
          return;
        }
      });

      const icon = document.createElement('div');
      icon.className = 'craft-btn-icon';
      icon.textContent = '+';

      const body = document.createElement('div');
      body.className = 'craft-btn-main';
      const name = document.createElement('div');
      name.className = 'craft-btn-name';
      name.textContent = title;
      const meta = document.createElement('div');
      meta.className = 'craft-btn-meta';
      meta.textContent = desc;
      body.appendChild(name);
      body.appendChild(meta);
      btn.appendChild(icon);
      btn.appendChild(body);
      container.appendChild(btn);
    };

    makeBtn('input', 'Input Slot', 'Click to insert selected smeltable item', () => {
      if (this.state.input) this._takeSlotToInventory('input');
      else this._putSelected('input');
    });
    makeBtn('fuel', 'Fuel Slot', 'Click to insert selected fuel', () => {
      if (this.state.fuel) this._takeSlotToInventory('fuel');
      else this._putSelected('fuel');
    });
    makeBtn('output', 'Output Slot', 'Click to take smelted output', () => this._takeOutput());
    this.refresh();
  }

  refresh() {
    const container = document.getElementById('furnace-list');
    if (!container) return;
    const map = {
      input: this.state.input,
      fuel: this.state.fuel,
      output: this.state.output,
    };
    const buttons = container.querySelectorAll('.craft-btn');
    buttons.forEach((btn) => {
      const slotName = btn.dataset.slot;
      const slot = map[slotName] || null;
      const iconWrap = btn.querySelector('.craft-btn-icon');
      if (iconWrap) {
        iconWrap.replaceWith(this._makeIcon(slot));
      }
      const name = btn.querySelector('.craft-btn-name');
      const meta = btn.querySelector('.craft-btn-meta');
      if (name) name.textContent = slot ? `${this._getLabel(slot.id)} x${slot.count}` : `${slotName[0].toUpperCase()}${slotName.slice(1)} Slot`;
      if (meta) {
        if (slotName === 'output') {
          meta.textContent = slot ? 'Click/Ctrl-click to take output' : 'No output yet';
        } else if (slotName === 'input') {
          meta.textContent = slot ? 'Smeltable input ready (click to take)' : 'Drag smeltable item or Ctrl-click inventory';
        } else {
          const burnPct = this.state.burnMax > 0 ? Math.floor((this.state.burn / this.state.burnMax) * 100) : 0;
          meta.textContent = slot ? `Fuel remaining ${burnPct}% (click to take)` : 'Drag fuel item or Ctrl-click inventory';
        }
      }
      btn.disabled = !this.currentKey || (slotName === 'output' && !this.state.output);
    });
  }
}
