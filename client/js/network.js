// Network (WebSocket client)
class Network {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.playerId = null;
    this.otherPlayers = new Map(); // id -> { mesh, username, mats, flashTimer, alive, health }
    this._onInit = null;
    this._scene = null;
    this._moveTimer = 0;
    this._vitalsTimer = 0;
    this._stateTimer = 0;
    this._onAuth = null;
    this._onChestData = null;
    this._onFurnaceData = null;
  }

  connect(scene) {
    this._scene = scene;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}`;
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
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
    switch (msg.type) {
      case 'init':
        this.playerId = msg.id;
        if (this._onInit) this._onInit(msg);
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
        if (msg.player.id === this.playerId) break;
        if (!this.otherPlayers.has(msg.player.id)) {
          this._spawnPlayer(msg.player);
        }
        if (this.otherPlayers.has(msg.player.id)) {
          const data = this.otherPlayers.get(msg.player.id);
          if (typeof data.health === 'number' && msg.player.health < data.health) {
            data.flashTimer = 0.2;
          }
          data.username = msg.player.username;
          data.health = msg.player.health;
          this._updateNametag(data);
        }
        break;
      case 'authResult':
        if (this._onAuth) this._onAuth(msg);
        break;
      case 'accountState':
        if (window.applyAuthState && msg.playerState) window.applyAuthState(msg.playerState);
        break;
      case 'chestData':
        if (this._onChestData) this._onChestData(msg);
        break;
      case 'furnaceData':
        if (this._onFurnaceData) this._onFurnaceData(msg);
        break;
      case 'playerDamaged':
        this._onPlayerDamaged(msg);
        break;
      case 'playerDied':
        this._onPlayerDied(msg);
        break;
      case 'playerRespawn':
        this._onPlayerRespawn(msg);
        break;
      case 'blockSet':
        if (window.world) {
          window.world.setBlock(msg.x, msg.y, msg.z, msg.blockId);
          window.world.serverBlocks[`${msg.x},${msg.y},${msg.z}`] = msg.blockId;
        }
        break;
      case 'chat':
        if (window.ui) window.ui.addChat(msg.username, msg.text);
        break;
    }
  }

  _createPlayerModel() {
    const group = new THREE.Group();
    const mats = [];

    const make = (w, h, d, color) => {
      const mat = new THREE.MeshLambertMaterial({ color });
      mats.push(mat);
      return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    };

    const head = make(0.6, 0.6, 0.6, 0xf0c8a0);
    head.position.set(0, 1.55, 0);

    const body = make(0.62, 0.74, 0.34, 0x4b7bb5);
    body.position.set(0, 1.02, 0);

    const lArm = make(0.22, 0.72, 0.22, 0xf0c8a0);
    lArm.position.set(-0.42, 1.02, 0);

    const rArm = make(0.22, 0.72, 0.22, 0xf0c8a0);
    rArm.position.set(0.42, 1.02, 0);

    const lLeg = make(0.24, 0.72, 0.24, 0x385274);
    lLeg.position.set(-0.18, 0.28, 0);

    const rLeg = make(0.24, 0.72, 0.24, 0x385274);
    rLeg.position.set(0.18, 0.28, 0);

    group.add(head, body, lArm, rArm, lLeg, rLeg);
    group.userData.lArm = lArm;
    group.userData.rArm = rArm;
    group.userData.lLeg = lLeg;
    group.userData.rLeg = rLeg;

    return { group, mats };
  }

  _createNametag(username) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(String(username || 'Player'), canvas.width / 2, canvas.height / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(0, 2.25, 0);
    sprite.scale.set(2.8, 0.7, 1);
    return sprite;
  }

  _updateNametag(data) {
    if (!data || !data.nametag) return;
    const sprite = data.nametag;
    const canvas = sprite.material?.map?.image;
    const ctx = canvas?.getContext?.('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(String(data.username || 'Player'), canvas.width / 2, canvas.height / 2);
    sprite.material.map.needsUpdate = true;
  }

  _spawnPlayer(p) {
    if (!this._scene) return;
    if (p.id === this.playerId) return;
    if (this.otherPlayers.has(p.id)) return;

    const model = this._createPlayerModel();
    const mesh = model.group;
    const nametag = this._createNametag(p.username);
    mesh.add(nametag);
    mesh.position.set(p.x || 0, p.y || 70, p.z || 0);
    this._scene.add(mesh);

    this.otherPlayers.set(p.id, {
      mesh,
      username: p.username,
      mats: model.mats,
      nametag,
      flashTimer: 0,
      alive: p.health > 0,
      health: p.health || 20,
      phase: Math.random() * Math.PI * 2,
    });

    if (p.health <= 0) mesh.visible = false;
  }

  _removePlayer(id) {
    const data = this.otherPlayers.get(id);
    if (data) {
      if (this._scene) this._scene.remove(data.mesh);
      if (data.nametag?.material?.map) data.nametag.material.map.dispose();
      if (data.nametag?.material) data.nametag.material.dispose();
      this.otherPlayers.delete(id);
    }
  }

  _movePlayer(msg) {
    const data = this.otherPlayers.get(msg.id);
    if (!data) return;

    data.mesh.position.set(msg.x, msg.y, msg.z);
    data.mesh.rotation.y = msg.ry || 0;
    const moving = !!msg.walking;
    data.phase += moving ? 0.36 : 0.12;
    const swing = moving ? Math.sin(data.phase) * 0.72 : 0;
    data.mesh.userData.lArm.rotation.x = swing;
    data.mesh.userData.rArm.rotation.x = -swing;
    data.mesh.userData.lLeg.rotation.x = -swing;
    data.mesh.userData.rLeg.rotation.x = swing;
  }

  _onPlayerDamaged(msg) {
    if (msg.id === this.playerId) {
      if (window.player) {
        window.player.takeDamage(msg.amount || 1, msg.reason || 'Hit by player');
      }
      return;
    }

    const data = this.otherPlayers.get(msg.id);
    if (!data) return;
    data.flashTimer = 0.22;
    data.health = msg.health;
  }

  _onPlayerDied(msg) {
    if (window.ui) {
      window.ui.addChat('', `${msg.victimName} was slain by ${msg.killerName}`, '#ffadad');
    }

    if (msg.id === this.playerId) {
      if (window.player && window.player.alive) {
        window.player.health = 1;
        window.player.takeDamage(1, `Slain by ${msg.killerName}`);
      }
      return;
    }

    const data = this.otherPlayers.get(msg.id);
    if (!data) return;
    data.alive = false;
    data.mesh.visible = false;
  }

  _onPlayerRespawn(msg) {
    if (msg.id === this.playerId) {
      if (window.player) {
        window.player.spawn(msg.x, msg.y, msg.z);
      }
      return;
    }

    const data = this.otherPlayers.get(msg.id);
    if (!data) return;
    data.alive = true;
    data.health = 20;
    data.mesh.visible = true;
    data.mesh.position.set(msg.x, msg.y, msg.z);
  }

  update(dt) {
    this._stateTimer += dt;
    if (this._stateTimer > 2.0 && window.inventory) {
      this._stateTimer = 0;
      if (window.inventory.serializeState) {
        this.sendPlayerState(window.inventory.serializeState());
      } else {
        this.sendPlayerState(window.inventory.serialize());
      }
    }

    for (const data of this.otherPlayers.values()) {
      if (data.flashTimer > 0) {
        data.flashTimer = Math.max(0, data.flashTimer - dt);
        for (const mat of data.mats) {
          mat.emissive.setRGB(0.9, 0.08, 0.08);
          mat.emissiveIntensity = 0.9;
        }
      } else {
        for (const mat of data.mats) {
          mat.emissiveIntensity = 0;
        }
      }
    }
  }

  sendMove(player) {
    if (!this.connected) return;
    this._moveTimer++;
    if (this._moveTimer < 3) return;
    this._moveTimer = 0;
    const moving = !!(
      player.keys['KeyW'] || player.keys['KeyA'] || player.keys['KeyS'] || player.keys['KeyD']
      || Math.abs(player.joystick.x) > 0.2 || Math.abs(player.joystick.y) > 0.2
    );
    this.send({ type:'move', x:player.x, y:player.y, z:player.z, rx:player.rx, ry:player.ry, walking:moving });
  }

  sendVitals(player, dt) {
    if (!this.connected || !player) return;
    this._vitalsTimer += dt;
    if (this._vitalsTimer < 0.5) return;
    this._vitalsTimer = 0;
    this.send({ type:'healthUpdate', health: player.health, hunger: player.hunger });
  }

  tryAttackPlayer(origin, dir, damage, maxDist = 3.2) {
    let targetId = null;
    let closest = Infinity;

    for (const [id, data] of this.otherPlayers.entries()) {
      if (!data.alive || !data.mesh.visible) continue;
      const center = data.mesh.position;
      const min = new THREE.Vector3(center.x - 0.3, center.y, center.z - 0.3);
      const max = new THREE.Vector3(center.x + 0.3, center.y + 1.8, center.z + 0.3);
      const t = MathUtils.rayAabbIntersect(origin, dir, min, max, maxDist);
      if (t === null) continue;
      if (t < closest) {
        closest = t;
        targetId = id;
      }
    }

    if (!targetId) return false;
    this.send({ type:'attackPlayer', targetId, damage });
    return true;
  }

  sendRespawn(x, y, z) {
    this.send({ type:'respawn', x, y, z });
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

  sendPlayerState(state) {
    if (Array.isArray(state)) {
      this.send({ type: 'playerState', inventory: state });
      return;
    }
    this.send({ type: 'playerState', state: state || { slots: [], armor: {} } });
  }

  requestChest(key) {
    this.send({ type: 'chestGet', key });
  }

  updateChest(key, slots) {
    this.send({ type: 'chestSet', key, slots: Array.isArray(slots) ? slots : [] });
  }

  requestFurnace(key) {
    this.send({ type: 'furnaceGet', key });
  }

  updateFurnace(key, state) {
    this.send({ type: 'furnaceSet', key, state: state || null });
  }

  authenticate(username, password, mode = 'login') {
    this.send({ type: 'auth', username, password, mode });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    if (!this.ws) return;
    try {
      this.ws.close(1000, 'Client disconnect');
    } catch (e) {
      console.warn('[Network] Disconnect failed:', e);
    }
    this.connected = false;
  }

  onInit(cb) {
    this._onInit = cb;
  }

  onAuth(cb) {
    this._onAuth = cb;
  }

  onChestData(cb) {
    this._onChestData = cb;
  }

  onFurnaceData(cb) {
    this._onFurnaceData = cb;
  }
}
