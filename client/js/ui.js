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
  }

  init(player, inventory, network) {
    this.player = player;
    this.inventory = inventory;
    this.network = network;
    this._bindKeys();
    this._buildCheatPanel();
    this._buildMainMenu();
  }

  // ─── Main Menu ──────────────────────────────────────────────────────
  _buildMainMenu() {
    const btn = document.getElementById('btn-play');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const username = document.getElementById('username-input').value.trim() || 'Player';
      if (this.network) this.network.sendUsername(username);
      document.getElementById('main-menu').style.display = 'none';
      // Lock pointer on desktop
      if (!('ontouchstart' in window)) {
        setTimeout(() => {
          if (this.player) this.player.lock();
        }, 100);
      }
      if (window.gameStarted !== undefined) window.gameStarted = true;
    });
  }

  // ─── HUD ─────────────────────────────────────────────────────────────
  updateHUD(player) {
    // Health
    const hb = document.getElementById('health-bar');
    if (hb) {
      hb.innerHTML = '';
      for (let i=0;i<10;i++) {
        const full = player.health >= (i+1)*2;
        const half = !full && player.health >= i*2+1;
        const span = document.createElement('span');
        span.className = 'heart';
        span.textContent = full ? '❤' : half ? '🖤' : '♡';
        span.style.color = full ? '#e55' : half ? '#a55' : '#555';
        hb.appendChild(span);
      }
    }

    // Hunger
    const hub = document.getElementById('hunger-bar');
    if (hub) {
      hub.innerHTML = '';
      for (let i=0;i<10;i++) {
        const full = player.hunger >= (i+1)*2;
        const span = document.createElement('span');
        span.className = 'hunger-icon';
        span.textContent = full ? '🍗' : '🦴';
        span.style.opacity = full ? '1' : '0.35';
        hub.appendChild(span);
      }
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
    const icon = (time > 0.25 && time < 0.75) ? '☀️' : '🌙';
    el.textContent = `${icon} ${h12}:${String(m).padStart(2,'0')} ${ampm}`;
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
    if (this.player && !('ontouchstart' in window)) this.player.lock();
  }

  // ─── Inventory / Crafting ─────────────────────────────────────────────
  toggleInventory() {
    this.inventoryOpen = !this.inventoryOpen;
    const el = document.getElementById('inventory-screen');
    if (el) el.style.display = this.inventoryOpen ? 'flex' : 'none';
    if (this.inventoryOpen) {
      document.exitPointerLock();
    } else {
      if (this.player && !('ontouchstart' in window)) this.player.lock();
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
    if (this.player && !('ontouchstart' in window)) this.player.lock();
  }

  // ─── Pause ────────────────────────────────────────────────────────────
  togglePause() {
    this.paused = !this.paused;
    const el = document.getElementById('pause-menu');
    if (el) el.style.display = this.paused ? 'flex' : 'none';
    if (this.paused) document.exitPointerLock();
    else if (this.player && !('ontouchstart' in window)) this.player.lock();
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
        }
        if (this.player && !('ontouchstart' in window)) this.player.lock();
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
          const img = blockTextures[id].image.cloneNode();
          img.className = 'slot-icon';
          div.appendChild(img);
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
    else if (this.player && !('ontouchstart' in window)) this.player.lock();
  }

  // ─── Key bindings ─────────────────────────────────────────────────────
  _bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && !this.chatOpen) this.toggleInventory();
      if (e.code === 'Escape') {
        if (this.inventoryOpen) this.toggleInventory();
        else if (this.craftingTableOpen) this.closeCraftingTable();
        else if (this.cheatOpen) this.toggleCheat();
        else if (this.chatOpen) this.closeChat();
        else this.togglePause();
      }
      if (e.code === 'KeyT' && !this.chatOpen && !this.inventoryOpen) {
        e.preventDefault();
        this.openChat();
      }
      if (e.code === 'F7') { e.preventDefault(); this.toggleCheat(); }

      if (e.code === 'Enter' && this.chatOpen) {
        const input = document.getElementById('chat-input');
        if (input && input.value.trim()) {
          if (this.network) this.network.sendChat(input.value.trim());
          else if (window.ui) window.ui.addChat(document.getElementById('username-input')?.value || 'You', input.value.trim());
          input.value = '';
        }
        this.closeChat();
      }
    });

    // Pause buttons
    const resume = document.getElementById('btn-resume');
    const quit   = document.getElementById('btn-quit');
    if (resume) resume.addEventListener('click', () => this.togglePause());
    if (quit)   quit.addEventListener('click', () => location.reload());

    // Click on canvas to lock pointer
    const canvas = document.getElementById('gameCanvas');
    if (canvas) canvas.addEventListener('click', () => {
      if (!this.inventoryOpen && !this.chatOpen && !this.paused && !this.cheatOpen && !this.craftingTableOpen) {
        if (!document.pointerLockElement && window.gameStarted) {
          this.player && this.player.lock();
        }
      }
    });
  }

  isBlocking() {
    return this.inventoryOpen || this.chatOpen || this.paused || this.cheatOpen || this.craftingTableOpen;
  }
}
