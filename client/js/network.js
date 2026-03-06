// ─── Network (WebSocket client) ─────────────────────────────────────────
class Network {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.playerId = null;
    this.otherPlayers = new Map(); // id -> { mesh, username, label }
    this._onInit = null;
    this._scene = null;
    this._moveTimer = 0;
  }

  connect(scene) {
    this._scene = scene;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}`;
    try {
      this.ws = new WebSocket(url);
    } catch(e) {
      console.warn('[Network] WebSocket unavailable:', e.message);
      return;
    }

    this.ws.addEventListener('open', () => {
      this.connected = true;
      console.log('[Network] Connected');
    });

    this.ws.addEventListener('message', (e) => {
      try {
        const msg = JSON.parse(e.data);
        this._handleMessage(msg);
      } catch {}
    });

    this.ws.addEventListener('close', () => {
      this.connected = false;
      console.log('[Network] Disconnected');
    });

    this.ws.addEventListener('error', (e) => {
      console.warn('[Network] Error', e);
    });
  }

  _handleMessage(msg) {
    switch(msg.type) {
      case 'init':
        this.playerId = msg.id;
        if (this._onInit) this._onInit(msg);
        // Spawn other players
        for (const p of (msg.players || [])) this._spawnPlayer(p);
        break;
      case 'playerJoin':
        this._spawnPlayer(msg.player);
        if (window.ui) window.ui.addChat('', `${msg.player.username} joined the game`, '#aaa');
        break;
      case 'playerLeave':
        this._removePlayer(msg.id);
        break;
      case 'playerMove':
        this._movePlayer(msg);
        break;
      case 'playerUpdate':
        if (this.otherPlayers.has(msg.player.id)) {
          this.otherPlayers.get(msg.player.id).username = msg.player.username;
        }
        break;
      case 'blockSet':
        if (window.world) {
          window.world.setBlock(msg.x, msg.y, msg.z, msg.blockId);
          window.world.serverBlocks[`${msg.x},${msg.y},${msg.z}`] = msg.blockId;
          if (msg.blockId === 0) delete window.world.serverBlocks[`${msg.x},${msg.y},${msg.z}`];
        }
        break;
      case 'chat':
        if (window.ui) window.ui.addChat(msg.username, msg.text);
        break;
    }
  }

  _spawnPlayer(p) {
    if (!this._scene) return;
    if (p.id === this.playerId) return;
    if (this.otherPlayers.has(p.id)) return;

    // Simple box player mesh
    const geom = new THREE.BoxGeometry(0.6, 1.8, 0.6);
    const mat = new THREE.MeshLambertMaterial({ color: 0x4488ff });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(p.x || 0, (p.y || 70) + 0.9, p.z || 0);
    this._scene.add(mesh);

    this.otherPlayers.set(p.id, { mesh, username: p.username });
  }

  _removePlayer(id) {
    const data = this.otherPlayers.get(id);
    if (data) {
      if (this._scene) this._scene.remove(data.mesh);
      this.otherPlayers.delete(id);
    }
  }

  _movePlayer(msg) {
    const data = this.otherPlayers.get(msg.id);
    if (data) {
      data.mesh.position.set(msg.x, msg.y + 0.9, msg.z);
      data.mesh.rotation.y = msg.ry || 0;
    }
  }

  sendMove(player) {
    if (!this.connected) return;
    this._moveTimer++;
    if (this._moveTimer < 3) return; // throttle
    this._moveTimer = 0;
    this.send({ type:'move', x:player.x, y:player.y, z:player.z, rx:player.rx, ry:player.ry });
  }

  sendBlockSet(x, y, z, blockId) {
    this.send({ type:'blockSet', x, y, z, blockId });
  }

  sendChat(text) {
    this.send({ type:'chat', text });
  }

  sendUsername(username) {
    this.send({ type:'setUsername', username });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  onInit(cb) { this._onInit = cb; }
}
