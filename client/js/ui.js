// ─── UI system ──────────────────────────────────────────────────────────
class UI {
  constructor() {
    this.inventoryOpen = false;
    this.craftingTableOpen = false;
    this.cheatOpen = false;
    this.chatOpen = false;
    this.paused = false;
    this._chatMessages = [];
    this._chatFade = [];
    this._itemNameHideTimer = null;
    this.pauseSettingsOpen = false;
    this._hudScale = 1;
    this.furnaceOpen = false;
    this.chestOpen = false;
  }

  _isTouchDevice() {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const touchUA = /Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent || '');
    return coarse || touchUA;
  }

  init(player, inventory, network) {
    this.player = player;
    this.inventory = inventory;
    this.network = network;
    this._bindKeys();
    this._buildCheatPanel();
    this._buildMainMenu();
    this._bindCloseButtons();
    this._bindHudButtons();
  }

  _bindHudButtons() {
    const eatBtn = document.getElementById('btn-eat');
    const chatSend = document.getElementById('chat-send-btn');
    if (eatBtn) {
      eatBtn.addEventListener('click', () => {
        if (window.useSelectedItem) window.useSelectedItem();
      });
    }
    if (chatSend) {
      chatSend.addEventListener('click', () => {
        if (!this.chatOpen) return;
        const input = document.getElementById('chat-input');
        if (input && input.value.trim()) {
          const msg = input.value.trim();
          
          // Handle client-side commands
          if (msg.startsWith('/')) {
            this._handleCommand(msg);
            input.value = '';
            this.closeChat();
            return;
          }
          
          if (this.network) this.network.sendChat(msg);
          else this.addChat(document.getElementById('username-input')?.value || 'You', msg);
          input.value = '';
        }
        this.closeChat();
      });
    }
  }

  _bindCloseButtons() {
    const closeBtnInv = document.getElementById('btn-close-inventory');
    if (closeBtnInv) {
      closeBtnInv.addEventListener('click', () => {
        if (this.chestOpen) this.closeChest();
        else if (this.furnaceOpen) this.closeFurnace();
        else this.toggleInventory();
      });
    }
    const closeBtnCraft = document.getElementById('btn-close-crafting');
    if (closeBtnCraft) {
      closeBtnCraft.addEventListener('click', () => this.closeCraftingTable());
    }
    const closeBtnFurnace = document.getElementById('btn-close-furnace');
    if (closeBtnFurnace) {
      closeBtnFurnace.addEventListener('click', () => this.closeFurnace());
    }
    const closeBtnChest = document.getElementById('btn-close-chest');
    if (closeBtnChest) {
      closeBtnChest.addEventListener('click', () => this.closeChest());
    }
  }

  // ─── Main Menu ──────────────────────────────────────────────────────
  _buildMainMenu() {
    const loginBtn = document.getElementById('btn-login');
    const registerBtn = document.getElementById('btn-register');
    const status = document.getElementById('auth-status');
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');

    if (this.network) {
      this.network.onAuth((msg) => {
        if (!status) return;
        if (!msg.ok) {
          status.textContent = msg.error || 'Authentication failed.';
          status.style.color = '#ff9a9a';
          return;
        }
        status.textContent = `Signed in as ${msg.username}`;
        status.style.color = '#a8ffb0';
        if (window.applyAuthState) window.applyAuthState(msg.playerState || null);
      });
    }

    const submit = (mode) => {
      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';
      if (!username || !password) {
        if (status) {
          status.textContent = 'Enter username and password.';
          status.style.color = '#ffcc88';
        }
        return;
      }
      if (status) {
        status.textContent = mode === 'register' ? 'Registering...' : 'Logging in...';
        status.style.color = '#c8d6ff';
      }
      if (this.network) this.network.authenticate(username, password, mode);
    };

    if (loginBtn) loginBtn.addEventListener('click', () => submit('login'));
    if (registerBtn) registerBtn.addEventListener('click', () => submit('register'));
    if (passwordInput) {
      passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit('login');
      });
    }
  }

  // ─── HUD ─────────────────────────────────────────────────────────────
  updateHUD(player) {
    // Health bar
    const healthBar = document.getElementById('health-bar');
    const healthFill = document.getElementById('health-fill');
    if (healthBar && healthFill) {
      const healthPercent = (player.health / player.maxHealth) * 100;
      healthFill.style.width = healthPercent + '%';
      
      // Add pulsing animation when low on health
      if (player.health <= 6) {
        healthBar.classList.add('low-health');
      } else {
        healthBar.classList.remove('low-health');
      }
    }

    // Hunger bar
    const hungerBar = document.getElementById('hunger-bar');
    const hungerFill = document.getElementById('hunger-fill');
    if (hungerBar && hungerFill) {
      const hungerPercent = (player.hunger / player.maxHunger) * 100;
      hungerFill.style.width = hungerPercent + '%';
    }

    // Coordinates
    const coords = document.getElementById('coordinates');
    if (coords) {
      coords.textContent = `X: ${Math.floor(player.x)}  Y: ${Math.floor(player.y)}  Z: ${Math.floor(player.z)}`;
    }
  }

  updateDaytime(time) {
    const el = document.getElementById('daytime-indicator');
    if (!el) return;
    const h = Math.floor(time * 24);
    const m = Math.floor((time * 24 - h) * 60);
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 || 12;
    const phase = (time > 0.25 && time < 0.75) ? 'DAY' : 'NIGHT';
    el.textContent = `${phase} ${h12}:${String(m).padStart(2,'0')} ${ampm}`;
  }

  showItemName(name) {
    if (!name) return;
    const el = document.getElementById('item-name-pop');
    if (!el) return;
    el.textContent = name;
    el.classList.add('visible');
    if (this._itemNameHideTimer) clearTimeout(this._itemNameHideTimer);
    this._itemNameHideTimer = setTimeout(() => {
      el.classList.remove('visible');
    }, 900);
  }

  flashDamage() {
    const el = document.getElementById('damage-flash');
    if (!el) return;
    el.classList.remove('active');
    // Trigger CSS animation each time damage is applied.
    void el.offsetWidth;
    el.classList.add('active');
  }

  // ─── Chat ─────────────────────────────────────────────────────────────
  addChat(username, text, color) {
    const msgs = document.getElementById('chat-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = 'chat-msg';
    if (color) div.style.color = color;
    if (username) {
      const nameSpan = document.createElement('span');
      nameSpan.className = 'chat-name';
      nameSpan.textContent = `<${username}> `;
      div.appendChild(nameSpan);
    }
    div.appendChild(document.createTextNode(text));
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    // Fade after 10s
    setTimeout(() => div.style.opacity='0.3', 10000);
    // Limit messages
    while (msgs.children.length > 50) msgs.removeChild(msgs.firstChild);
  }

  openChat() {
    this.chatOpen = true;
    const row = document.getElementById('chat-input-row');
    const input = document.getElementById('chat-input');
    if (row) row.style.display = 'block';
    if (input) { input.value = ''; input.focus(); }
    // Unlock pointer
    document.exitPointerLock();
  }

  closeChat() {
    this.chatOpen = false;
    const row = document.getElementById('chat-input-row');
    if (row) row.style.display = 'none';
    // Re-lock
    if (this.player && !this._isTouchDevice()) this.player.lock();
  }

  _handleCommand(msg) {
    const parts = msg.slice(1).split(' '); // Remove / and split
    const cmd = parts[0].toLowerCase();
    
    switch (cmd) {
      case 'stuck':
        if (window.player && window.world) {
          window.world.ensurePlayerAboveTerrain(window.player);
          this.addChat('System', 'Teleported you above terrain!', '#0f0');
        } else {
          this.addChat('System', 'Error: Cannot execute command', '#f00');
        }
        break;
      
      default:
        this.addChat('System', `Unknown command: /${cmd}`, '#f00');
    }
  }

  // ─── Inventory / Crafting ─────────────────────────────────────────────
  _attachInventoryToContainer(panelId) {
    const invPanel = document.getElementById('inventory-panel');
    const panel = document.getElementById(panelId);
    const invScreen = document.getElementById('inventory-screen');
    if (!invPanel || !panel || !invScreen) return;

    if (!this._inventoryHomeParent) this._inventoryHomeParent = invScreen;
    panel.classList.add('container-with-inventory');
    invPanel.classList.add('embedded-in-container');
    panel.appendChild(invPanel);
  }

  _detachInventoryFromContainer() {
    const invPanel = document.getElementById('inventory-panel');
    const invScreen = document.getElementById('inventory-screen');
    if (!invPanel || !invScreen) return;

    invPanel.classList.remove('embedded-in-container');
    const chestPanel = document.getElementById('chest-panel');
    const furnacePanel = document.getElementById('furnace-panel');
    if (chestPanel) chestPanel.classList.remove('container-with-inventory');
    if (furnacePanel) furnacePanel.classList.remove('container-with-inventory');
    invScreen.appendChild(invPanel);
  }

  toggleInventory() {
    if (this.chestOpen) { this.closeChest(); return; }
    if (this.furnaceOpen) { this.closeFurnace(); return; }
    this.inventoryOpen = !this.inventoryOpen;
    const el = document.getElementById('inventory-screen');
    if (el) el.style.display = this.inventoryOpen ? 'flex' : 'none';
    if (this.inventoryOpen) {
      document.exitPointerLock();
    } else {
      if (window.crafting && window.crafting.return2x2ToInventory) window.crafting.return2x2ToInventory();
      if (this.inventory && this.inventory.cancelDrag) this.inventory.cancelDrag();
      if (this.player && !this._isTouchDevice()) this.player.lock();
    }
  }

  openCraftingTable() {
    this.craftingTableOpen = true;
    const el = document.getElementById('crafting-table-screen');
    if (el) el.style.display = 'flex';
    document.exitPointerLock();
  }

  closeCraftingTable() {
    this.craftingTableOpen = false;
    const el = document.getElementById('crafting-table-screen');
    if (el) el.style.display = 'none';
    if (window.crafting && window.crafting.return3x3ToInventory) window.crafting.return3x3ToInventory();
    if (this.inventory && this.inventory.cancelDrag) this.inventory.cancelDrag();
    if (this.player && !this._isTouchDevice()) this.player.lock();
  }

  openFurnace(pos) {
    this.furnaceOpen = true;
    const el = document.getElementById('furnace-screen');
    if (el) el.style.display = 'flex';
    this.inventoryOpen = true;
    const invEl = document.getElementById('inventory-screen');
    if (invEl) invEl.style.display = 'none';
    this._attachInventoryToContainer('furnace-panel');
    if (window.furnace && window.furnace.openAt) window.furnace.openAt(pos || null);
    else if (window.furnace && window.furnace.refresh) window.furnace.refresh();
    document.exitPointerLock();
  }

  closeFurnace() {
    this.furnaceOpen = false;
    const el = document.getElementById('furnace-screen');
    if (el) el.style.display = 'none';
    this._detachInventoryFromContainer();
    this.inventoryOpen = false;
    const invEl = document.getElementById('inventory-screen');
    if (invEl) invEl.style.display = 'none';
    if (window.furnace && window.furnace.close) window.furnace.close();
    if (this.inventory && this.inventory.cancelDrag) this.inventory.cancelDrag();
    if (this.player && !this._isTouchDevice()) this.player.lock();
  }

  openChest(pos) {
    this.chestOpen = true;
    const el = document.getElementById('chest-screen');
    if (el) el.style.display = 'flex';
    this.inventoryOpen = true;
    const invEl = document.getElementById('inventory-screen');
    if (invEl) invEl.style.display = 'none';
    this._attachInventoryToContainer('chest-panel');
    if (window.chest && window.chest.openAt) window.chest.openAt(pos);
    document.exitPointerLock();
  }

  closeChest() {
    this.chestOpen = false;
    const el = document.getElementById('chest-screen');
    if (el) el.style.display = 'none';
    this._detachInventoryFromContainer();
    this.inventoryOpen = false;
    const invEl = document.getElementById('inventory-screen');
    if (invEl) invEl.style.display = 'none';
    if (window.chest && window.chest.close) window.chest.close();
    if (this.inventory && this.inventory.cancelDrag) this.inventory.cancelDrag();
    if (this.player && !this._isTouchDevice()) this.player.lock();
  }

  // ─── Pause ────────────────────────────────────────────────────────────
  _applyHudScale(scale) {
    const clamped = Math.max(0.75, Math.min(1.5, Number(scale) || 1));
    this._hudScale = clamped;
    document.documentElement.style.setProperty('--desktop-hud-scale', String(clamped));
  }

  _syncHudScaleControl() {
    const slider = document.getElementById('hud-scale-slider');
    const valueEl = document.getElementById('hud-scale-value');
    if (!slider || !valueEl) return;

    const pct = Math.round(this._hudScale * 100);
    slider.value = String(pct);
    valueEl.textContent = `${pct}%`;
  }

  _syncRenderDistanceControl() {
    const slider = document.getElementById('render-distance-slider');
    const valueEl = document.getElementById('render-distance-value');
    if (!slider || !valueEl) return;

    const worldValue = window.world && window.world.getRenderDistance
      ? window.world.getRenderDistance()
      : Number(slider.value || 4);
    slider.value = String(worldValue);
    valueEl.textContent = String(worldValue);
  }

  _openPauseSettings() {
    this.pauseSettingsOpen = true;
    const main = document.getElementById('pause-main-actions');
    const panel = document.getElementById('pause-settings-panel');
    if (main) main.style.display = 'none';
    if (panel) panel.style.display = 'flex';
    this._syncRenderDistanceControl();
    this._syncHudScaleControl();
  }

  _closePauseSettings() {
    this.pauseSettingsOpen = false;
    const main = document.getElementById('pause-main-actions');
    const panel = document.getElementById('pause-settings-panel');
    if (main) main.style.display = 'flex';
    if (panel) panel.style.display = 'none';
  }

  togglePause() {
    this.paused = !this.paused;
    const el = document.getElementById('pause-menu');
    if (el) el.style.display = this.paused ? 'flex' : 'none';
    if (this.paused) {
      this._closePauseSettings();
      this._syncRenderDistanceControl();
      this._syncHudScaleControl();
      document.exitPointerLock();
    } else if (this.player && !this._isTouchDevice()) {
      this._closePauseSettings();
      this.player.lock();
    }
  }

  // ─── Death Screen ─────────────────────────────────────────────────────
  showDeathScreen(msg) {
    const el = document.getElementById('death-screen');
    const msgEl = document.getElementById('death-msg');
    if (el) el.style.display = 'flex';
    if (msgEl) msgEl.textContent = msg || 'You died.';
    document.exitPointerLock();

    const btn = document.getElementById('btn-respawn');
    if (btn) {
      btn.onclick = () => {
        if (el) el.style.display = 'none';
        if (window.player && window.world) {
          const sx = 0, sz = 0;
          const sy = window.world.getSurfaceY(sx, sz);
          window.player.spawn(sx, sy, sz);
          window.world.ensurePlayerAboveTerrain(window.player);
          if (this.network) this.network.sendRespawn(sx, sy, sz);
        }
        if (this.player && !this._isTouchDevice()) this.player.lock();
      };
    }
  }

  // ─── Cheat Panel ──────────────────────────────────────────────────────
  _buildCheatPanel() {
    const container = document.getElementById('cheat-blocks');
    if (!container) return;
    for (const [name, id] of Object.entries(BLOCKS)) {
      if (id === BLOCKS.AIR) continue;
      const div = document.createElement('div');
      div.className = 'inv-slot';
      div.title = BLOCK_NAMES[id] || name;
      div.style.cursor = 'pointer';
      div.addEventListener('click', () => {
        if (this.inventory) {
          this.inventory.addItem({ id, count: 64, type: 'block' });
        }
      });
      container.appendChild(div);
      // Fill with texture once loaded
      setTimeout(() => {
        if (blockTextures[id]) {
          try {
            const tex = blockTextures[id];
            const sourceCanvas = tex.image || tex.source?.data;
            if (sourceCanvas) {
              const canvas = document.createElement('canvas');
              canvas.width = 32;
              canvas.height = 32;
              canvas.className = 'slot-icon';
              const ctx = canvas.getContext('2d');
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(sourceCanvas, 0, 0, 16, 16, 0, 0, 32, 32);
              div.appendChild(canvas);
            }
          } catch (e) {
            console.warn('Error adding texture to cheat panel:', e);
          }
        }
      }, 500);
    }

    const btnHeal = document.getElementById('cheat-heal');
    const btnFeed = document.getElementById('cheat-feed');
    const btnAll  = document.getElementById('cheat-creative');
    if (btnHeal) btnHeal.addEventListener('click', () => { if(this.player) this.player.health = this.player.maxHealth; });
    if (btnFeed) btnFeed.addEventListener('click', () => { if(this.player) this.player.hunger = this.player.maxHunger; });
    if (btnAll)  btnAll.addEventListener('click',  () => { if(this.inventory) this.inventory.giveAllBlocks(); });
  }

  toggleCheat() {
    this.cheatOpen = !this.cheatOpen;
    const el = document.getElementById('cheat-panel');
    if (el) el.style.display = this.cheatOpen ? 'block' : 'none';
    if (this.cheatOpen) document.exitPointerLock();
    else if (this.player && !this._isTouchDevice()) this.player.lock();
  }

  // ─── Key bindings ─────────────────────────────────────────────────────
  _bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && !this.chatOpen) {
        if (this.chestOpen) this.closeChest();
        else this.toggleInventory();
      }
      if (e.code === 'Escape') {
        if (this.inventoryOpen) this.toggleInventory();
        else if (this.craftingTableOpen) this.closeCraftingTable();
        else if (this.furnaceOpen) this.closeFurnace();
        else if (this.chestOpen) this.closeChest();
        else if (this.cheatOpen) this.toggleCheat();
        else if (this.chatOpen) this.closeChat();
        else this.togglePause();
      }
      if (e.code === 'KeyT' && !this.chatOpen && !this.inventoryOpen) {
        e.preventDefault();
        this.openChat();
      }
      if (e.code === 'KeyQ' && !this.chatOpen && !this.inventoryOpen && !e.repeat) {
        e.preventDefault();
        if (window.dropSelectedItem) window.dropSelectedItem();
      }
      if (e.code === 'KeyG' && !this.chatOpen && !this.inventoryOpen && !e.repeat) {
        e.preventDefault();
        if (window.dropSelectedItem) window.dropSelectedItem();
      }
      if (e.code === 'F7') { e.preventDefault(); this.toggleCheat(); }

      if (e.code === 'Enter' && this.chatOpen) {
        const input = document.getElementById('chat-input');
        if (input && input.value.trim()) {
          const msg = input.value.trim();
          if (msg.startsWith('/')) {
            this._handleCommand(msg);
          } else if (this.network) {
            this.network.sendChat(msg);
          } else if (window.ui) {
            window.ui.addChat(document.getElementById('username-input')?.value || 'You', msg);
          }
          input.value = '';
        }
        this.closeChat();
      }
    });

    // Pause buttons
    const resume = document.getElementById('btn-resume');
    const settings = document.getElementById('btn-settings');
    const settingsBack = document.getElementById('btn-settings-back');
    const reloadTextures = document.getElementById('btn-reload-textures');
    const disconnect = document.getElementById('btn-disconnect');
    const quit   = document.getElementById('btn-quit');
    if (resume) resume.addEventListener('click', () => this.togglePause());
    if (settings) settings.addEventListener('click', () => this._openPauseSettings());
    if (settingsBack) settingsBack.addEventListener('click', () => this._closePauseSettings());
    if (disconnect) {
      disconnect.addEventListener('click', () => {
        if (this.network) this.network.disconnect();
        location.reload();
      });
    }
    if (quit)   quit.addEventListener('click', () => location.reload());
    if (reloadTextures) {
      reloadTextures.addEventListener('click', () => {
        if (window.tryLoadMinetestTextures) window.tryLoadMinetestTextures();
      });
    }

    const slider = document.getElementById('render-distance-slider');
    const valueEl = document.getElementById('render-distance-value');
    if (slider) {
      slider.addEventListener('input', () => {
        const v = Number(slider.value);
        if (valueEl) valueEl.textContent = String(v);
        if (window.world && window.world.setRenderDistance) {
          window.world.setRenderDistance(v);
        }
      });
    }

    const hudSlider = document.getElementById('hud-scale-slider');
    const hudValueEl = document.getElementById('hud-scale-value');
    const storedHudScale = Number(localStorage.getItem('bloxelHudScale') || '1');
    this._applyHudScale(storedHudScale);
    this._syncHudScaleControl();
    if (hudSlider) {
      hudSlider.addEventListener('input', () => {
        const pct = Number(hudSlider.value);
        const scale = pct / 100;
        this._applyHudScale(scale);
        if (hudValueEl) hudValueEl.textContent = `${pct}%`;
        localStorage.setItem('bloxelHudScale', String(scale));
      });
    }

    // Click on canvas to lock pointer
    const canvas = document.getElementById('gameCanvas');
    if (canvas) canvas.addEventListener('click', () => {
      if (!this.inventoryOpen && !this.chatOpen && !this.paused && !this.cheatOpen && !this.craftingTableOpen && !this.furnaceOpen && !this.chestOpen) {
        if (!document.pointerLockElement && window.gameStarted) {
          this.player && this.player.lock();
        }
      }
    });
  }

  isBlocking() {
    return this.inventoryOpen || this.chatOpen || this.paused || this.cheatOpen || this.craftingTableOpen || this.furnaceOpen || this.chestOpen;
  }
}
