const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const WORLD_FILE = path.join(__dirname, '..', 'world_data.json');

// Serve static client files
app.use(express.static(path.join(__dirname, '..', 'client')));

// World state
let worldData = {
  blocks: {},   // "x,y,z" -> blockId
  seed: Math.floor(Math.random() * 2147483647)
};

// Load persisted world
if (fs.existsSync(WORLD_FILE)) {
  try {
    worldData = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
    console.log('[Server] Loaded world data');
  } catch (e) {
    console.warn('[Server] Failed to load world data, starting fresh');
  }
}

// Save world every 30 seconds
setInterval(() => {
  try {
    fs.writeFileSync(WORLD_FILE, JSON.stringify(worldData));
  } catch (e) {
    console.warn('[Server] Failed to save world:', e.message);
  }
}, 30000);

// Players map: id -> { id, x, y, z, rx, ry, username, health, hunger }
const players = new Map();
let nextPlayerId = 1;

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

wss.on('connection', (ws) => {
  const playerId = nextPlayerId++;
  ws.playerId = playerId;

  const player = {
    id: playerId,
    username: `Player${playerId}`,
    x: 0, y: 70, z: 0,
    rx: 0, ry: 0,
    health: 20,
    hunger: 20
  };
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
        if (p) {
          p.x = msg.x; p.y = msg.y; p.z = msg.z;
          p.rx = msg.rx; p.ry = msg.ry;
          broadcast({ type: 'playerMove', id: playerId, x: p.x, y: p.y, z: p.z, rx: p.rx, ry: p.ry }, playerId);
        }
        break;
      }
      case 'blockSet': {
        const key = `${msg.x},${msg.y},${msg.z}`;
        if (msg.blockId === 0) {
          delete worldData.blocks[key];
        } else {
          worldData.blocks[key] = msg.blockId;
        }
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
      case 'healthUpdate': {
        const p = players.get(playerId);
        if (p) {
          p.health = Math.max(0, Math.min(20, Number(msg.health) || 20));
          p.hunger = Math.max(0, Math.min(20, Number(msg.hunger) || 20));
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    console.log(`[Server] Player ${playerId} disconnected`);
    players.delete(playerId);
    broadcast({ type: 'playerLeave', id: playerId });
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Bloxel running at http://localhost:${PORT}`);
  console.log(`[Server] World seed: ${worldData.seed}`);
});
