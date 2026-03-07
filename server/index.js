const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const WORLD_FILE = path.join(__dirname, '..', 'world_data.json');
const ACCOUNTS_FILE = path.join(__dirname, '..', 'accounts.json');
const AUTH_MAX_ATTEMPTS_PER_MIN = 6;
const AUTH_LOCK_MS = 30_000;

// Serve static client files
app.use(express.static(path.join(__dirname, '..', 'client')));

// World state
let worldData = {
  blocks: {},   // "x,y,z" -> blockId
  chests: {},   // "x,y,z" -> chest slots
  furnaces: {}, // "x,y,z" -> furnace state
  seed: Math.floor(Math.random() * 2147483647)
};

let accounts = {};
const activeAccounts = new Map(); // username -> ws
let accountsMtimeMs = 0;
let accountsReloadVersion = 0;

function hashPasswordLegacy(password) {
  return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

function hashPasswordSecure(password, salt, iterations = 120000) {
  return crypto.pbkdf2Sync(String(password || ''), salt, iterations, 32, 'sha256').toString('hex');
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 120000;
  const hash = hashPasswordSecure(password, salt, iterations);
  return { salt, iterations, hash };
}

function verifyPassword(record, password) {
  if (!record) return false;
  if (record.salt && record.hash) {
    const expected = hashPasswordSecure(password, record.salt, record.iterations || 120000);
    return expected === record.hash;
  }
  if (record.passwordHash) {
    return hashPasswordLegacy(password) === record.passwordHash;
  }
  return false;
}

function isValidChestKey(key) {
  return /^-?\d+,-?\d+,-?\d+$/.test(String(key || ''));
}

function sanitizeChestSlots(rawSlots) {
  const slots = Array.isArray(rawSlots) ? rawSlots.slice(0, 27) : [];
  while (slots.length < 27) slots.push(null);
  return slots.map((slot) => {
    if (!slot || typeof slot !== 'object') return null;
    const id = Number(slot.id);
    const count = Math.max(1, Math.min(64, Number(slot.count) || 1));
    const type = slot.type === 'item' ? 'item' : 'block';
    if (!Number.isFinite(id) || id <= 0) return null;
    return { id, count, type };
  });
}

const FURNACE_RECIPES = {
  13: { output: { id: 302, type: 'item' }, smeltSeconds: 8 }, // iron ore -> iron ingot
  14: { output: { id: 303, type: 'item' }, smeltSeconds: 8 }, // gold ore -> gold ingot
  4: { output: { id: 16, type: 'block' }, smeltSeconds: 5 },  // sand -> glass
  205: { output: { id: 206, type: 'item' }, smeltSeconds: 5 }, // potato -> baked potato
};

const FURNACE_FUELS = {
  301: 16, // coal
};

function isValidFurnaceSlot(slot) {
  return !!slot && typeof slot === 'object' && Number.isFinite(Number(slot.id)) && Number(slot.id) > 0;
}

function sanitizeFurnaceSlot(slot) {
  if (!isValidFurnaceSlot(slot)) return null;
  return {
    id: Number(slot.id),
    count: Math.max(1, Math.min(64, Number(slot.count) || 1)),
    type: slot.type === 'item' ? 'item' : 'block',
  };
}

function sanitizeFurnaceState(state) {
  const s = state && typeof state === 'object' ? state : {};
  return {
    input: sanitizeFurnaceSlot(s.input),
    fuel: sanitizeFurnaceSlot(s.fuel),
    output: sanitizeFurnaceSlot(s.output),
    progress: Math.max(0, Number(s.progress) || 0),
    burn: Math.max(0, Number(s.burn) || 0),
    burnMax: Math.max(0, Number(s.burnMax) || 0),
  };
}

function canStackSlot(a, b) {
  if (!a || !b) return false;
  return a.id === b.id && a.type === b.type;
}

function emptyFurnaceState() {
  return { input: null, fuel: null, output: null, progress: 0, burn: 0, burnMax: 0 };
}

function tickFurnace(state, dt) {
  const input = state.input;
  if (!input || !FURNACE_RECIPES[input.id]) {
    state.progress = 0;
    return false;
  }

  const recipe = FURNACE_RECIPES[input.id];
  const outputTemplate = { id: recipe.output.id, count: 1, type: recipe.output.type };
  if (state.output && !canStackSlot(state.output, outputTemplate)) return false;
  if (state.output && state.output.count >= 64) return false;

  if (state.burn <= 0) {
    const fuel = state.fuel;
    if (!fuel || !FURNACE_FUELS[fuel.id]) return false;
    state.burn = FURNACE_FUELS[fuel.id];
    state.burnMax = state.burn;
    fuel.count -= 1;
    if (fuel.count <= 0) state.fuel = null;
  }

  const use = Math.min(dt, state.burn);
  state.burn = Math.max(0, state.burn - use);
  state.progress += use;
  let changed = true;

  while (state.progress >= recipe.smeltSeconds) {
    if (!state.input || state.input.count <= 0) {
      state.progress = 0;
      break;
    }
    state.input.count -= 1;
    if (state.input.count <= 0) state.input = null;
    if (!state.output) state.output = { ...outputTemplate };
    else state.output.count = Math.min(64, state.output.count + 1);
    state.progress -= recipe.smeltSeconds;
  }

  return changed;
}

function loadAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE)) return false;
  try {
    accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8')) || {};
    const st = fs.statSync(ACCOUNTS_FILE);
    accountsMtimeMs = st.mtimeMs || Date.now();
    accountsReloadVersion += 1;
    console.log('[Server] Loaded accounts');
    return true;
  } catch (e) {
    console.warn('[Server] Failed to load accounts:', e.message);
    return false;
  }
}

function syncAccountsFromDiskIfChanged(reason = 'sync') {
  if (!fs.existsSync(ACCOUNTS_FILE)) return true;
  let st;
  try {
    st = fs.statSync(ACCOUNTS_FILE);
  } catch (e) {
    console.warn(`[Server] Failed to stat accounts file during ${reason}:`, e.message);
    return false;
  }

  const diskMtime = st.mtimeMs || 0;
  if (diskMtime <= accountsMtimeMs) return true;

  try {
    const diskAccounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8')) || {};
    accounts = diskAccounts;
    accountsMtimeMs = diskMtime;
    accountsReloadVersion += 1;
    console.log(`[Server] Reloaded accounts from disk (${reason})`);
    return true;
  } catch (e) {
    console.warn(`[Server] Ignoring invalid accounts.json during ${reason}:`, e.message);
    return false;
  }
}

function saveAccounts() {
  // Preserve valid manual edits made while the server is running.
  syncAccountsFromDiskIfChanged('before save');
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts));
    const st = fs.statSync(ACCOUNTS_FILE);
    accountsMtimeMs = st.mtimeMs || Date.now();
  } catch (e) {
    console.warn('[Server] Failed to save accounts:', e.message);
  }
}

function saveWorldData() {
  try {
    fs.writeFileSync(WORLD_FILE, JSON.stringify(worldData));
  } catch (e) {
    console.warn('[Server] Failed to save world:', e.message);
  }
}

// Load persisted world
if (fs.existsSync(WORLD_FILE)) {
  try {
    worldData = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
    if (!worldData.blocks) worldData.blocks = {};
    if (!worldData.chests) worldData.chests = {};
    if (!worldData.furnaces) worldData.furnaces = {};
    console.log('[Server] Loaded world data');
  } catch (e) {
    console.warn('[Server] Failed to load world data, starting fresh');
  }
}

loadAccounts();

// Save world every 30 seconds
setInterval(() => {
  saveWorldData();
  saveAccounts();
}, 30000);

setInterval(() => {
  const changedKeys = [];
  for (const [key, rawState] of Object.entries(worldData.furnaces || {})) {
    const state = sanitizeFurnaceState(rawState);
    const changed = tickFurnace(state, 1);
    worldData.furnaces[key] = state;
    if (changed) changedKeys.push(key);
  }

  if (changedKeys.length > 0) {
    for (const key of changedKeys) {
      broadcast({ type: 'furnaceData', key, state: worldData.furnaces[key] });
    }
  }
}, 1000);

// Players map: id -> { id, x, y, z, rx, ry, username, health, hunger }
const players = new Map();
let nextPlayerId = 1;
let lastAppliedAccountsReloadVersion = accountsReloadVersion;

function applyAccountStateToPlayer(player, state) {
  if (!player || !state || typeof state !== 'object') return;
  player.x = Number(state.x) || 0;
  player.y = Number(state.y) || 70;
  player.z = Number(state.z) || 0;
  player.rx = Number(state.rx) || 0;
  player.ry = Number(state.ry) || 0;
  player.health = Math.max(1, Math.min(20, Number(state.health) || 20));
  player.hunger = Math.max(0, Math.min(20, Number(state.hunger) || 20));
  player.inventory = state.state && typeof state.state === 'object'
    ? state.state
    : (Array.isArray(state.inventory) ? state.inventory : []);
}

function makePlayerStatePayload(player) {
  return {
    x: player.x,
    y: player.y,
    z: player.z,
    rx: player.rx,
    ry: player.ry,
    health: player.health,
    hunger: player.hunger,
    inventory: Array.isArray(player.inventory) ? player.inventory : [],
    state: !Array.isArray(player.inventory) ? player.inventory : undefined,
  };
}

function applyReloadedAccountsToActivePlayers() {
  for (const p of players.values()) {
    if (!p.account) continue;
    const account = accounts[p.account];
    if (!account || !account.state) continue;

    applyAccountStateToPlayer(p, account.state);

    const ws = activeAccounts.get(p.account);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'accountState', playerState: makePlayerStatePayload(p) }));
    }

    broadcast({ type: 'playerMove', id: p.id, x: p.x, y: p.y, z: p.z, rx: p.rx, ry: p.ry, walking: false }, p.id);
    broadcast({ type: 'playerUpdate', player: p }, p.id);
  }
}

function broadcast(data, excludeId) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      if (!excludeId || client.playerId !== excludeId) {
        client.send(msg);
      }
    }
  });
}

setInterval(() => {
  syncAccountsFromDiskIfChanged('watch');
  if (accountsReloadVersion === lastAppliedAccountsReloadVersion) return;
  lastAppliedAccountsReloadVersion = accountsReloadVersion;
  applyReloadedAccountsToActivePlayers();
}, 1500);

wss.on('connection', (ws) => {
  const playerId = nextPlayerId++;
  ws.playerId = playerId;

  const player = {
    id: playerId,
    username: `Player${playerId}`,
    x: 0, y: 70, z: 0,
    rx: 0, ry: 0,
    health: 20,
    hunger: 20,
    inventory: [],
    account: null,
  };
  ws.authAttempts = [];
  ws.authLockedUntil = 0;
  players.set(playerId, player);

  console.log(`[Server] Player ${playerId} connected`);

  // Send init to new player
  ws.send(JSON.stringify({
    type: 'init',
    id: playerId,
    seed: worldData.seed,
    blocks: worldData.blocks,
    players: Array.from(players.values()).filter(p => p.id !== playerId)
  }));

  // Notify others of new player
  broadcast({ type: 'playerJoin', player }, playerId);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'move': {
        const p = players.get(playerId);
        if (p && p.health > 0) {
          p.x = msg.x; p.y = msg.y; p.z = msg.z;
          p.rx = msg.rx; p.ry = msg.ry;
          broadcast({ type: 'playerMove', id: playerId, x: p.x, y: p.y, z: p.z, rx: p.rx, ry: p.ry, walking: !!msg.walking }, playerId);
        }
        break;
      }
      case 'blockSet': {
        const key = `${msg.x},${msg.y},${msg.z}`;
        // Keep explicit air overrides so broken terrain does not regenerate.
        worldData.blocks[key] = Number(msg.blockId) || 0;
        saveWorldData();
        broadcast({ type: 'blockSet', x: msg.x, y: msg.y, z: msg.z, blockId: msg.blockId }, playerId);
        break;
      }
      case 'chat': {
        const p = players.get(playerId);
        const username = p ? p.username : `Player${playerId}`;
        const text = String(msg.text || '').slice(0, 256);
        broadcast({ type: 'chat', username, text });
        break;
      }
      case 'setUsername': {
        const p = players.get(playerId);
        if (p) {
          p.username = String(msg.username || `Player${playerId}`).slice(0, 32).replace(/[<>]/g, '');
          broadcast({ type: 'playerUpdate', player: p });
        }
        break;
      }
      case 'auth': {
        const p = players.get(playerId);
        if (!p) break;

        const now = Date.now();
        if (ws.authLockedUntil && now < ws.authLockedUntil) {
          ws.send(JSON.stringify({ type: 'authResult', ok: false, error: 'Too many attempts. Try again shortly.' }));
          break;
        }
        ws.authAttempts = (ws.authAttempts || []).filter((t) => now - t < 60_000);

        const mode = String(msg.mode || 'login').toLowerCase();
        const username = String(msg.username || '').trim().slice(0, 32).replace(/[<>]/g, '');
        const password = String(msg.password || '');
        if (!username || password.length < 3) {
          ws.authAttempts.push(now);
          ws.send(JSON.stringify({ type: 'authResult', ok: false, error: 'Invalid username or password.' }));
          break;
        }

        if (ws.authAttempts.length >= AUTH_MAX_ATTEMPTS_PER_MIN) {
          ws.authLockedUntil = now + AUTH_LOCK_MS;
          ws.send(JSON.stringify({ type: 'authResult', ok: false, error: 'Too many attempts. Try again shortly.' }));
          break;
        }

        const existing = accounts[username];

        const activeSession = activeAccounts.get(username);
        if (activeSession && activeSession !== ws) {
          ws.send(JSON.stringify({ type: 'authResult', ok: false, error: 'This account is already online.' }));
          break;
        }

        if (mode === 'register') {
          if (existing) {
            ws.authAttempts.push(now);
            ws.send(JSON.stringify({ type: 'authResult', ok: false, error: 'Username already exists.' }));
            break;
          }
          const pass = createPasswordRecord(password);
          accounts[username] = {
            salt: pass.salt,
            iterations: pass.iterations,
            hash: pass.hash,
            state: {
              x: p.x,
              y: p.y,
              z: p.z,
              rx: p.rx,
              ry: p.ry,
              health: p.health,
              hunger: p.hunger,
              inventory: p.inventory || [],
              state: !Array.isArray(p.inventory) ? p.inventory : undefined,
            },
          };
          saveAccounts();
        } else {
          if (!existing || !verifyPassword(existing, password)) {
            ws.authAttempts.push(now);
            ws.send(JSON.stringify({ type: 'authResult', ok: false, error: 'Invalid username or password.' }));
            break;
          }

          // Opportunistically upgrade legacy unsalted hashes.
          if (existing.passwordHash && !existing.hash) {
            const upgraded = createPasswordRecord(password);
            existing.salt = upgraded.salt;
            existing.iterations = upgraded.iterations;
            existing.hash = upgraded.hash;
            delete existing.passwordHash;
            saveAccounts();
          }
        }

        const account = accounts[username];
        ws.authAttempts = [];
        ws.authLockedUntil = 0;
        activeAccounts.set(username, ws);
        p.account = username;
        p.username = username;

        if (account && account.state) {
          applyAccountStateToPlayer(p, account.state);
        }

        ws.send(JSON.stringify({
          type: 'authResult',
          ok: true,
          mode,
          username,
          playerState: makePlayerStatePayload(p),
        }));

        broadcast({ type: 'playerUpdate', player: p }, playerId);
        break;
      }
      case 'healthUpdate': {
        const p = players.get(playerId);
        if (p) {
          const prev = p.health;
          p.health = Math.max(0, Math.min(20, Number(msg.health) || 20));
          p.hunger = Math.max(0, Math.min(20, Number(msg.hunger) || 20));
          if (p.health !== prev) {
            broadcast({ type: 'playerUpdate', player: p }, playerId);
          }
        }
        break;
      }
      case 'chestGet': {
        const key = String(msg.key || '');
        if (!isValidChestKey(key)) break;
        const slots = Array.isArray(worldData.chests[key]) ? worldData.chests[key] : new Array(27).fill(null);
        ws.send(JSON.stringify({ type: 'chestData', key, slots }));
        break;
      }
      case 'chestSet': {
        const key = String(msg.key || '');
        if (!isValidChestKey(key)) break;
        const slots = sanitizeChestSlots(msg.slots);
        worldData.chests[key] = slots;
        broadcast({ type: 'chestData', key, slots });
        saveWorldData();
        break;
      }
      case 'furnaceGet': {
        const key = String(msg.key || '');
        if (!isValidChestKey(key)) break;
        if (!worldData.furnaces[key]) worldData.furnaces[key] = emptyFurnaceState();
        ws.send(JSON.stringify({ type: 'furnaceData', key, state: worldData.furnaces[key] }));
        break;
      }
      case 'furnaceSet': {
        const key = String(msg.key || '');
        if (!isValidChestKey(key)) break;
        worldData.furnaces[key] = sanitizeFurnaceState(msg.state);
        broadcast({ type: 'furnaceData', key, state: worldData.furnaces[key] });
        saveWorldData();
        break;
      }
      case 'playerState': {
        const p = players.get(playerId);
        if (!p) break;
        if (Array.isArray(msg.inventory)) p.inventory = msg.inventory.slice(0, 128);
        if (msg.state && typeof msg.state === 'object') p.inventory = msg.state;
        if (p.account && accounts[p.account]) {
          accounts[p.account].state = {
            x: p.x,
            y: p.y,
            z: p.z,
            rx: p.rx,
            ry: p.ry,
            health: p.health,
            hunger: p.hunger,
            inventory: Array.isArray(p.inventory) ? p.inventory : [],
            state: !Array.isArray(p.inventory) ? p.inventory : undefined,
          };
        }
        break;
      }
      case 'attackPlayer': {
        const attacker = players.get(playerId);
        const targetId = Number(msg.targetId);
        const target = players.get(targetId);
        if (!attacker || !target) break;
        if (attacker.health <= 0 || target.health <= 0) break;

        const dx = attacker.x - target.x;
        const dy = (attacker.y + 0.9) - (target.y + 0.9);
        const dz = attacker.z - target.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq > 16) break;

        const amount = Math.max(1, Math.min(20, Number(msg.damage) || 1));
        target.health = Math.max(0, target.health - amount);

        const dmgMsg = {
          type: 'playerDamaged',
          id: target.id,
          health: target.health,
          amount,
          attackerId: attacker.id,
          reason: `Hit by ${attacker.username}`,
        };
        broadcast(dmgMsg);

        if (target.health <= 0) {
          broadcast({
            type: 'playerDied',
            id: target.id,
            killerId: attacker.id,
            killerName: attacker.username,
            victimName: target.username,
          });
        }
        break;
      }
      case 'respawn': {
        const p = players.get(playerId);
        if (!p) break;
        p.health = 20;
        p.hunger = 20;
        p.x = Number(msg.x) || 0;
        p.y = Number(msg.y) || 70;
        p.z = Number(msg.z) || 0;
        broadcast({ type: 'playerRespawn', id: p.id, x: p.x, y: p.y, z: p.z });
        break;
      }
    }
  });

  ws.on('close', () => {
    console.log(`[Server] Player ${playerId} disconnected`);
    const p = players.get(playerId);
    if (p && p.account && accounts[p.account]) {
      accounts[p.account].state = {
        x: p.x,
        y: p.y,
        z: p.z,
        rx: p.rx,
        ry: p.ry,
        health: p.health,
        hunger: p.hunger,
        inventory: p.inventory || [],
        state: !Array.isArray(p.inventory) ? p.inventory : undefined,
      };
      saveAccounts();
    }
    if (p && p.account && activeAccounts.get(p.account) === ws) {
      activeAccounts.delete(p.account);
    }
    players.delete(playerId);
    broadcast({ type: 'playerLeave', id: playerId });
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Bloxel running at http://localhost:${PORT}`);
  console.log(`[Server] World seed: ${worldData.seed}`);
});
