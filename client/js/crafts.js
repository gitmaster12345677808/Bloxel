// ===================================================================
// Centralized Recipe Database
// ===================================================================
// This file contains all crafting and smelting recipes.
// To add a new item, simply add a recipe here - no need to modify
// other files!
//
// Recipe format:
// - pattern: 2D array representing the crafting grid (use null for empty slots)
// - output: { id, count, type ('block' or 'item'), itemDef (for items) }
//
// For blocks: use BLOCKS.BLOCK_NAME as the id
// For items: use ITEM_TYPES.ITEM_NAME.id as the id, and include itemDef: ITEM_TYPES.ITEM_NAME
//
// NOTE: If you add smelting recipes, you also need to update the server-side
// FURNACE_RECIPES in server/index.js with the corresponding numeric IDs.
// ===================================================================

const CRAFTING_RECIPES = [
  // Basic Materials
  { pattern: [[BLOCKS.WOOD]], output: { id: BLOCKS.PLANKS, count: 4, type: 'block' } },
  { pattern: [[BLOCKS.PLANKS], [BLOCKS.PLANKS]], output: { id: ITEM_TYPES.STICK.id, count: 4, type: 'item', itemDef: ITEM_TYPES.STICK } },
  { pattern: [[BLOCKS.STONE]], output: { id: BLOCKS.COBBLESTONE, count: 1, type: 'block' } },
  
  // Crafting Table
  { pattern: [[BLOCKS.PLANKS, BLOCKS.PLANKS], [BLOCKS.PLANKS, BLOCKS.PLANKS]], output: { id: BLOCKS.CRAFTING_TABLE, count: 1, type: 'block' } },
  
  // Pickaxes
  { pattern: [[BLOCKS.PLANKS, BLOCKS.PLANKS, BLOCKS.PLANKS], [null, ITEM_TYPES.STICK.id, null], [null, ITEM_TYPES.STICK.id, null]], output: { id: ITEM_TYPES.WOOD_PICK.id, count: 1, type: 'item', itemDef: ITEM_TYPES.WOOD_PICK } },
  { pattern: [[BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE], [null, ITEM_TYPES.STICK.id, null], [null, ITEM_TYPES.STICK.id, null]], output: { id: ITEM_TYPES.STONE_PICK.id, count: 1, type: 'item', itemDef: ITEM_TYPES.STONE_PICK } },
  { pattern: [[ITEM_TYPES.IRON_INGOT.id, ITEM_TYPES.IRON_INGOT.id, ITEM_TYPES.IRON_INGOT.id], [null, ITEM_TYPES.STICK.id, null], [null, ITEM_TYPES.STICK.id, null]], output: { id: ITEM_TYPES.IRON_PICK.id, count: 1, type: 'item', itemDef: ITEM_TYPES.IRON_PICK } },
  { pattern: [[ITEM_TYPES.DIAMOND.id, ITEM_TYPES.DIAMOND.id, ITEM_TYPES.DIAMOND.id], [null, ITEM_TYPES.STICK.id, null], [null, ITEM_TYPES.STICK.id, null]], output: { id: ITEM_TYPES.DIAMOND_PICK.id, count: 1, type: 'item', itemDef: ITEM_TYPES.DIAMOND_PICK } },
  
  // Swords
  { pattern: [[BLOCKS.PLANKS], [BLOCKS.PLANKS], [ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.WOOD_SWORD.id, count: 1, type: 'item', itemDef: ITEM_TYPES.WOOD_SWORD } },
  { pattern: [[BLOCKS.COBBLESTONE], [BLOCKS.COBBLESTONE], [ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.STONE_SWORD.id, count: 1, type: 'item', itemDef: ITEM_TYPES.STONE_SWORD } },
  { pattern: [[ITEM_TYPES.IRON_INGOT.id], [ITEM_TYPES.IRON_INGOT.id], [ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.IRON_SWORD.id, count: 1, type: 'item', itemDef: ITEM_TYPES.IRON_SWORD } },
  { pattern: [[ITEM_TYPES.DIAMOND.id], [ITEM_TYPES.DIAMOND.id], [ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.DIAMOND_SWORD.id, count: 1, type: 'item', itemDef: ITEM_TYPES.DIAMOND_SWORD } },
  
  // Axes
  { pattern: [[BLOCKS.PLANKS, BLOCKS.PLANKS], [BLOCKS.PLANKS, ITEM_TYPES.STICK.id], [null, ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.WOOD_AXE.id, count: 1, type: 'item', itemDef: ITEM_TYPES.WOOD_AXE } },
  { pattern: [[BLOCKS.COBBLESTONE, BLOCKS.COBBLESTONE], [BLOCKS.COBBLESTONE, ITEM_TYPES.STICK.id], [null, ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.STONE_AXE.id, count: 1, type: 'item', itemDef: ITEM_TYPES.STONE_AXE } },
  { pattern: [[ITEM_TYPES.IRON_INGOT.id, ITEM_TYPES.IRON_INGOT.id], [ITEM_TYPES.IRON_INGOT.id, ITEM_TYPES.STICK.id], [null, ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.IRON_AXE.id, count: 1, type: 'item', itemDef: ITEM_TYPES.IRON_AXE } },
  { pattern: [[ITEM_TYPES.DIAMOND.id, ITEM_TYPES.DIAMOND.id], [ITEM_TYPES.DIAMOND.id, ITEM_TYPES.STICK.id], [null, ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.DIAMOND_AXE.id, count: 1, type: 'item', itemDef: ITEM_TYPES.DIAMOND_AXE } },
  
  // Shovels
  { pattern: [[BLOCKS.PLANKS], [ITEM_TYPES.STICK.id], [ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.WOOD_SHOVEL.id, count: 1, type: 'item', itemDef: ITEM_TYPES.WOOD_SHOVEL } },
  { pattern: [[BLOCKS.COBBLESTONE], [ITEM_TYPES.STICK.id], [ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.STONE_SHOVEL.id, count: 1, type: 'item', itemDef: ITEM_TYPES.STONE_SHOVEL } },
  { pattern: [[ITEM_TYPES.IRON_INGOT.id], [ITEM_TYPES.STICK.id], [ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.IRON_SHOVEL.id, count: 1, type: 'item', itemDef: ITEM_TYPES.IRON_SHOVEL } },
  { pattern: [[ITEM_TYPES.DIAMOND.id], [ITEM_TYPES.STICK.id], [ITEM_TYPES.STICK.id]], output: { id: ITEM_TYPES.DIAMOND_SHOVEL.id, count: 1, type: 'item', itemDef: ITEM_TYPES.DIAMOND_SHOVEL } },
  
  // Food
  { pattern: [[ITEM_TYPES.WHEAT.id, ITEM_TYPES.WHEAT.id, ITEM_TYPES.WHEAT.id]], output: { id: ITEM_TYPES.BREAD.id, count: 1, type: 'item', itemDef: ITEM_TYPES.BREAD } },
  
  // Iron Armor
  { pattern: [[ITEM_TYPES.IRON_INGOT.id, ITEM_TYPES.IRON_INGOT.id, ITEM_TYPES.IRON_INGOT.id], [ITEM_TYPES.IRON_INGOT.id, null, ITEM_TYPES.IRON_INGOT.id]], output: { id: ITEM_TYPES.IRON_HELMET.id, count: 1, type: 'item', itemDef: ITEM_TYPES.IRON_HELMET } },
  { pattern: [[ITEM_TYPES.IRON_INGOT.id, null, ITEM_TYPES.IRON_INGOT.id], [ITEM_TYPES.IRON_INGOT.id, ITEM_TYPES.IRON_INGOT.id, ITEM_TYPES.IRON_INGOT.id], [ITEM_TYPES.IRON_INGOT.id, ITEM_TYPES.IRON_INGOT.id, ITEM_TYPES.IRON_INGOT.id]], output: { id: ITEM_TYPES.IRON_CHESTPLATE.id, count: 1, type: 'item', itemDef: ITEM_TYPES.IRON_CHESTPLATE } },
  { pattern: [[ITEM_TYPES.IRON_INGOT.id, ITEM_TYPES.IRON_INGOT.id, ITEM_TYPES.IRON_INGOT.id], [ITEM_TYPES.IRON_INGOT.id, null, ITEM_TYPES.IRON_INGOT.id], [ITEM_TYPES.IRON_INGOT.id, null, ITEM_TYPES.IRON_INGOT.id]], output: { id: ITEM_TYPES.IRON_LEGGINGS.id, count: 1, type: 'item', itemDef: ITEM_TYPES.IRON_LEGGINGS } },
  { pattern: [[ITEM_TYPES.IRON_INGOT.id, null, ITEM_TYPES.IRON_INGOT.id], [ITEM_TYPES.IRON_INGOT.id, null, ITEM_TYPES.IRON_INGOT.id]], output: { id: ITEM_TYPES.IRON_BOOTS.id, count: 1, type: 'item', itemDef: ITEM_TYPES.IRON_BOOTS } },
  
  // Diamond Armor
  { pattern: [[ITEM_TYPES.DIAMOND.id, ITEM_TYPES.DIAMOND.id, ITEM_TYPES.DIAMOND.id], [ITEM_TYPES.DIAMOND.id, null, ITEM_TYPES.DIAMOND.id]], output: { id: ITEM_TYPES.DIAMOND_HELMET.id, count: 1, type: 'item', itemDef: ITEM_TYPES.DIAMOND_HELMET } },
  { pattern: [[ITEM_TYPES.DIAMOND.id, null, ITEM_TYPES.DIAMOND.id], [ITEM_TYPES.DIAMOND.id, ITEM_TYPES.DIAMOND.id, ITEM_TYPES.DIAMOND.id], [ITEM_TYPES.DIAMOND.id, ITEM_TYPES.DIAMOND.id, ITEM_TYPES.DIAMOND.id]], output: { id: ITEM_TYPES.DIAMOND_CHESTPLATE.id, count: 1, type: 'item', itemDef: ITEM_TYPES.DIAMOND_CHESTPLATE } },
  { pattern: [[ITEM_TYPES.DIAMOND.id, ITEM_TYPES.DIAMOND.id, ITEM_TYPES.DIAMOND.id], [ITEM_TYPES.DIAMOND.id, null, ITEM_TYPES.DIAMOND.id], [ITEM_TYPES.DIAMOND.id, null, ITEM_TYPES.DIAMOND.id]], output: { id: ITEM_TYPES.DIAMOND_LEGGINGS.id, count: 1, type: 'item', itemDef: ITEM_TYPES.DIAMOND_LEGGINGS } },
  { pattern: [[ITEM_TYPES.DIAMOND.id, null, ITEM_TYPES.DIAMOND.id], [ITEM_TYPES.DIAMOND.id, null, ITEM_TYPES.DIAMOND.id]], output: { id: ITEM_TYPES.DIAMOND_BOOTS.id, count: 1, type: 'item', itemDef: ITEM_TYPES.DIAMOND_BOOTS } },
  
  // Building Blocks
  { pattern: [[BLOCKS.SAND, BLOCKS.SAND, BLOCKS.SAND], [BLOCKS.SAND, null, BLOCKS.SAND], [BLOCKS.SAND, BLOCKS.SAND, BLOCKS.SAND]], output: { id: BLOCKS.GLASS, count: 4, type: 'block' } },
  { pattern: [[ITEM_TYPES.COAL.id, ITEM_TYPES.COAL.id], [ITEM_TYPES.COAL.id, ITEM_TYPES.COAL.id]], output: { id: BLOCKS.BRICK, count: 1, type: 'block' } },
];

// ===================================================================
// Furnace Recipes
// ===================================================================
// Format: input item/block ID -> output specification
// ===================================================================

const SMELTING_RECIPES = {
  [BLOCKS.IRON_ORE]: { output: { id: ITEM_TYPES.IRON_INGOT.id, type: 'item' } },
  [BLOCKS.GOLD_ORE]: { output: { id: ITEM_TYPES.GOLD_INGOT.id, type: 'item' } },
  [BLOCKS.SAND]: { output: { id: BLOCKS.GLASS, type: 'block' } },
  [ITEM_TYPES.POTATO.id]: { output: { id: ITEM_TYPES.BAKED_POTATO.id, type: 'item' } },
};

// ===================================================================
// Furnace Fuel
// ===================================================================
// Format: item ID -> burn time in seconds
// ===================================================================

const FURNACE_FUELS = {
  [ITEM_TYPES.COAL.id]: { burnSeconds: 16 },
};
