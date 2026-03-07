// Crafting system using recipe buttons (classic mobile style).
// Recipes are now defined in crafts.js for easy management.

function recipeSize(recipe) {
  const height = recipe.pattern.length;
  let width = 0;
  for (const row of recipe.pattern) width = Math.max(width, row.length);
  return { width, height };
}

function recipeNeeds(recipe) {
  const needs = new Map();
  for (const row of recipe.pattern) {
    for (const id of row) {
      if (!id) continue;
      needs.set(id, (needs.get(id) || 0) + 1);
    }
  }
  return needs;
}

class CraftingUI {
  constructor(inventory) {
    this.inventory = inventory;
    this.recipes2 = CRAFTING_RECIPES.filter((r) => {
      const sz = recipeSize(r);
      return sz.width <= 2 && sz.height <= 2;
    });
    this.recipes3 = CRAFTING_RECIPES.slice();

    this._buildRecipeList('crafting-list-2x2', this.recipes2);
    this._buildRecipeList('crafting-list-3x3', this.recipes3);

    const originalRefresh = this.inventory.refresh.bind(this.inventory);
    this.inventory.refresh = () => {
      originalRefresh();
      this.refreshLists();
    };

    this.refreshLists();
  }

  _getLabel(id) {
    const itemDef = Object.values(ITEM_TYPES).find((it) => it.id === id);
    if (itemDef) return itemDef.name;
    return BLOCK_NAMES[id] || `ID ${id}`;
  }

  _makeIconForOutput(output) {
    if (output.type === 'block' && blockTextures[output.id]) {
      const tex = blockTextures[output.id];
      const source = tex.image || tex.source?.data;
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

    if (output.type === 'item' && output.itemDef) {
      const tex = itemTextures[output.id];
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

      const div = document.createElement('div');
      div.className = 'item-icon craft-btn-icon';
      div.style.backgroundColor = output.itemDef.color || '#333';
      div.textContent = '?';
      return div;
    }

    const fallback = document.createElement('div');
    fallback.className = 'craft-btn-icon';
    fallback.style.display = 'flex';
    fallback.style.alignItems = 'center';
    fallback.style.justifyContent = 'center';
    fallback.textContent = '?';
    return fallback;
  }

  _canCraft(recipe) {
    const needs = recipeNeeds(recipe);
    for (const [id, count] of needs.entries()) {
      if (this.inventory.countItem(id) < count) return false;
    }
    return true;
  }

  _consumeIngredients(recipe) {
    const needs = recipeNeeds(recipe);
    for (const [id, count] of needs.entries()) {
      if (!this.inventory.consumeItem(id, count)) return false;
    }
    return true;
  }

  _buildRecipeList(containerId, recipes) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    for (const recipe of recipes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'craft-btn';

      const icon = this._makeIconForOutput(recipe.output);
      const body = document.createElement('div');
      body.className = 'craft-btn-main';

      const name = document.createElement('div');
      name.className = 'craft-btn-name';
      const outName = recipe.output.type === 'item'
        ? (recipe.output.itemDef?.name || this._getLabel(recipe.output.id))
        : this._getLabel(recipe.output.id);
      name.textContent = `${outName} x${recipe.output.count}`;

      const meta = document.createElement('div');
      meta.className = 'craft-btn-meta';
      const needs = recipeNeeds(recipe);
      meta.textContent = Array.from(needs.entries()).map(([id, count]) => `${this._getLabel(id)} x${count}`).join(', ');

      body.appendChild(name);
      body.appendChild(meta);
      btn.appendChild(icon);
      btn.appendChild(body);

      btn.addEventListener('click', () => {
        if (!this._canCraft(recipe)) return;
        if (!this._consumeIngredients(recipe)) return;
        this.inventory.addItem({ ...recipe.output });
      });

      container.appendChild(btn);
    }
  }

  refreshLists() {
    this._refreshListState('crafting-list-2x2', this.recipes2);
    this._refreshListState('crafting-list-3x3', this.recipes3);
  }

  _refreshListState(containerId, recipes) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const buttons = container.querySelectorAll('.craft-btn');
    buttons.forEach((btn, i) => {
      const can = this._canCraft(recipes[i]);
      btn.disabled = !can;
    });
  }

  return2x2ToInventory() {}
  return3x3ToInventory() {}
}
