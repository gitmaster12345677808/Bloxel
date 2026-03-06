# ⛏ Bloxel

A browser-based Minecraft-like multiplayer voxel survival game built with JavaScript, Three.js, Node.js, and WebSockets.

## Features

- **Chunk-based infinite world** with procedural terrain generation, biomes (plains, desert, tundra, mountains), caves, and ore veins
- **Survival mechanics**: 20 HP health, 20 hunger points, fall damage, void damage, starvation
- **Day/Night cycle** with dynamic sky color and lighting
- **Block interaction**: break & place 30+ block types with tool-speed bonuses
- **Crafting system**: 2×2 inventory crafting + 3×3 crafting table with recipes for tools, weapons, and blocks
- **Inventory**: 36 slots with drag-and-drop, hotbar (1–9 keys + scroll wheel)
- **Mobs**: Zombie, Skeleton, Creeper (hostile) + Pig, Cow, Sheep (passive) with wandering/pursuit AI
- **Multiplayer**: WebSocket real-time sync of player positions, block changes, and chat
- **Chat**: Press `T` to open, `Enter` to send
- **Cheat / Anarchy panel** (`F7`): spawn any block, full heal/feed, give all blocks — no anti-cheat
- **Mobile touch controls**: virtual joystick, touch camera look, action buttons
- **Procedural pixel-art textures** generated on canvas (no external images)

## Requirements

- Node.js 16+
- npm

## Install & Run

```bash
npm install
npm start
```

Open your browser at **http://localhost:3000**

## Controls

| Action | Key / Input |
|---|---|
| Move | WASD |
| Jump | Space |
| Look | Mouse (click canvas to lock) |
| Break block | Left Mouse Button (hold) |
| Place block | Right Mouse Button (hold) |
| Select hotbar | 1–9 keys / Scroll wheel |
| Open inventory | E |
| Chat | T |
| Eat held food | F |
| Cheat panel | F7 |
| Pause | Escape |
| Mobile move | Virtual joystick (bottom-left) |
| Mobile look | Touch & drag (canvas) |
| Mobile jump/break/place/inventory | Action buttons (bottom-right) |

## Project Structure

```
Bloxel/
├── package.json          # npm dependencies (express, ws)
├── server/
│   └── index.js          # Express + WebSocket server, world persistence
└── client/
    ├── index.html        # Game HTML with Three.js CDN
    ├── css/
    │   └── style.css     # UI + mobile styles
    └── js/
        ├── utils.js      # Simplex noise, math helpers
        ├── blocks.js     # Block definitions, procedural textures
        ├── world.js      # Chunk terrain generation, meshing, raycasting
        ├── player.js     # First-person camera, WASD physics, health/hunger
        ├── inventory.js  # 36-slot inventory, hotbar, drag-and-drop
        ├── crafting.js   # Recipes, 2×2 / 3×3 crafting grids
        ├── network.js    # WebSocket client, multiplayer sync
        ├── mobile.js     # Virtual joystick, touch camera
        ├── ui.js         # HUD, chat, menus, death/pause screen, cheat panel
        ├── mobs.js       # Mob AI (hostile + passive), loot drops
        └── main.js       # Three.js setup, game loop entry point
```

## Block Types

Air, Grass, Dirt, Stone, Sand, Water, Wood, Leaves, Planks, Cobblestone, Bedrock, Gravel, Coal Ore, Iron Ore, Gold Ore, Diamond Ore, Glass, Brick, TNT, Crafting Table, Furnace, Chest, Snow, Ice, Cactus, Obsidian, Lava, Sponge, Bookshelf, Glowstone, Netherrack

## Multiplayer

The server stores world block changes and syncs them to all connected clients. Player positions, chat messages, and block edits are broadcast in real-time over WebSockets. The world seed is shared so all clients generate the same terrain.

## License

MIT