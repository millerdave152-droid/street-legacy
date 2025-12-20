import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware as authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Equipment slot definitions
const EQUIPMENT_SLOTS = [
  { id: 'head', name: 'Head', order: 1 },
  { id: 'face', name: 'Face', order: 2 },
  { id: 'torso', name: 'Torso', order: 3 },
  { id: 'legs', name: 'Legs', order: 4 },
  { id: 'feet', name: 'Feet', order: 5 },
  { id: 'hands', name: 'Hands', order: 6 },
  { id: 'accessory1', name: 'Accessory 1', order: 7 },
  { id: 'accessory2', name: 'Accessory 2', order: 8 },
  { id: 'weapon', name: 'Weapon', order: 9 },
  { id: 'shield', name: 'Shield', order: 10 }
];

// Equipment items with visual assets
const EQUIPMENT_ITEMS: Record<string, any[]> = {
  head: [
    { id: 'baseball_cap', name: 'Baseball Cap', rarity: 'common', defense: 0, style: 5, visual: 'cap_black', price: 50 },
    { id: 'beanie', name: 'Street Beanie', rarity: 'common', defense: 1, style: 8, visual: 'beanie_gray', price: 75 },
    { id: 'bandana', name: 'Bandana', rarity: 'uncommon', defense: 2, style: 12, visual: 'bandana_red', price: 150 },
    { id: 'hoodie_up', name: 'Hood Up', rarity: 'uncommon', defense: 3, style: 15, visual: 'hood_black', price: 200 },
    { id: 'ski_mask', name: 'Ski Mask', rarity: 'rare', defense: 5, style: 20, visual: 'ski_mask', price: 500, effect: { identity_protection: 20 } },
    { id: 'crown', name: 'Street Crown', rarity: 'legendary', defense: 8, style: 50, visual: 'crown_gold', price: 10000, effect: { respect_bonus: 25 } }
  ],
  face: [
    { id: 'shades', name: 'Dark Shades', rarity: 'common', defense: 0, style: 10, visual: 'shades_black', price: 100 },
    { id: 'gold_chain_face', name: 'Face Chain', rarity: 'uncommon', defense: 0, style: 18, visual: 'face_chain', price: 300 },
    { id: 'scar_makeup', name: 'War Paint', rarity: 'rare', defense: 0, style: 25, visual: 'war_paint', price: 750, effect: { intimidation: 15 } },
    { id: 'gas_mask', name: 'Gas Mask', rarity: 'epic', defense: 10, style: 30, visual: 'gas_mask', price: 2500, effect: { identity_protection: 50 } }
  ],
  torso: [
    { id: 'tshirt', name: 'Plain T-Shirt', rarity: 'common', defense: 1, style: 5, visual: 'tshirt_white', price: 25 },
    { id: 'hoodie', name: 'Street Hoodie', rarity: 'common', defense: 3, style: 12, visual: 'hoodie_black', price: 150 },
    { id: 'leather_jacket', name: 'Leather Jacket', rarity: 'uncommon', defense: 8, style: 25, visual: 'leather_jacket', price: 500 },
    { id: 'kevlar_vest', name: 'Kevlar Vest', rarity: 'rare', defense: 25, style: 15, visual: 'kevlar_vest', price: 2000, effect: { damage_reduction: 20 } },
    { id: 'designer_coat', name: 'Designer Coat', rarity: 'epic', defense: 5, style: 45, visual: 'designer_coat', price: 5000, effect: { negotiation_bonus: 10 } },
    { id: 'armored_suit', name: 'Armored Suit', rarity: 'legendary', defense: 40, style: 60, visual: 'armored_suit', price: 25000, effect: { damage_reduction: 35, respect_bonus: 20 } }
  ],
  legs: [
    { id: 'jeans', name: 'Street Jeans', rarity: 'common', defense: 2, style: 8, visual: 'jeans_blue', price: 75 },
    { id: 'cargo_pants', name: 'Cargo Pants', rarity: 'common', defense: 3, style: 10, visual: 'cargo_black', price: 100, effect: { storage_bonus: 2 } },
    { id: 'track_pants', name: 'Track Pants', rarity: 'uncommon', defense: 2, style: 15, visual: 'track_pants', price: 200, effect: { speed_bonus: 5 } },
    { id: 'armored_pants', name: 'Armored Pants', rarity: 'rare', defense: 15, style: 12, visual: 'armored_pants', price: 1500, effect: { damage_reduction: 10 } }
  ],
  feet: [
    { id: 'sneakers', name: 'Street Sneakers', rarity: 'common', defense: 1, style: 10, visual: 'sneakers_white', price: 100 },
    { id: 'boots', name: 'Combat Boots', rarity: 'uncommon', defense: 5, style: 15, visual: 'boots_black', price: 300, effect: { kick_damage: 10 } },
    { id: 'jordans', name: 'Designer Kicks', rarity: 'rare', defense: 2, style: 35, visual: 'jordans', price: 1000, effect: { speed_bonus: 8 } },
    { id: 'steel_toes', name: 'Steel Toe Boots', rarity: 'epic', defense: 12, style: 10, visual: 'steel_toes', price: 2000, effect: { kick_damage: 25, stomp_bonus: 15 } }
  ],
  hands: [
    { id: 'fingerless_gloves', name: 'Fingerless Gloves', rarity: 'common', defense: 2, style: 8, visual: 'gloves_fingerless', price: 50 },
    { id: 'brass_knuckles', name: 'Brass Knuckles', rarity: 'uncommon', defense: 3, style: 12, visual: 'brass_knuckles', price: 200, effect: { punch_damage: 15 } },
    { id: 'tactical_gloves', name: 'Tactical Gloves', rarity: 'rare', defense: 8, style: 20, visual: 'tactical_gloves', price: 750, effect: { lockpick_bonus: 10, grip_bonus: 10 } },
    { id: 'spiked_gloves', name: 'Spiked Gloves', rarity: 'epic', defense: 12, style: 25, visual: 'spiked_gloves', price: 2500, effect: { punch_damage: 30, intimidation: 10 } }
  ],
  accessory1: [
    { id: 'gold_chain', name: 'Gold Chain', rarity: 'uncommon', defense: 0, style: 20, visual: 'gold_chain', price: 500, effect: { respect_bonus: 5 } },
    { id: 'diamond_chain', name: 'Diamond Chain', rarity: 'rare', defense: 0, style: 40, visual: 'diamond_chain', price: 5000, effect: { respect_bonus: 15 } },
    { id: 'dog_tags', name: 'Dog Tags', rarity: 'uncommon', defense: 0, style: 15, visual: 'dog_tags', price: 300, effect: { crew_bonus: 5 } },
    { id: 'medallion', name: 'Boss Medallion', rarity: 'legendary', defense: 0, style: 75, visual: 'medallion', price: 50000, effect: { respect_bonus: 50, crew_bonus: 25 } }
  ],
  accessory2: [
    { id: 'watch_basic', name: 'Street Watch', rarity: 'common', defense: 0, style: 10, visual: 'watch_silver', price: 200 },
    { id: 'rolex', name: 'Luxury Watch', rarity: 'rare', defense: 0, style: 35, visual: 'rolex', price: 10000, effect: { negotiation_bonus: 10 } },
    { id: 'rings', name: 'Gold Rings', rarity: 'uncommon', defense: 1, style: 15, visual: 'rings_gold', price: 750, effect: { punch_damage: 5 } },
    { id: 'diamond_rings', name: 'Diamond Rings', rarity: 'epic', defense: 2, style: 45, visual: 'rings_diamond', price: 15000, effect: { punch_damage: 10, respect_bonus: 20 } }
  ],
  weapon: [
    { id: 'pocket_knife', name: 'Pocket Knife', rarity: 'common', defense: 0, attack: 10, style: 5, visual: 'knife_pocket', price: 100 },
    { id: 'switchblade', name: 'Switchblade', rarity: 'uncommon', defense: 2, attack: 18, style: 12, visual: 'switchblade', price: 300 },
    { id: 'baseball_bat', name: 'Baseball Bat', rarity: 'uncommon', defense: 5, attack: 25, style: 15, visual: 'bat', price: 200 },
    { id: 'machete', name: 'Machete', rarity: 'rare', defense: 3, attack: 35, style: 20, visual: 'machete', price: 800 },
    { id: 'pistol', name: '9mm Pistol', rarity: 'rare', defense: 0, attack: 50, style: 25, visual: 'pistol_9mm', price: 2000, effect: { ranged: true } },
    { id: 'smg', name: 'SMG', rarity: 'epic', defense: 0, attack: 75, style: 35, visual: 'smg', price: 8000, effect: { ranged: true, burst_fire: true } },
    { id: 'golden_gun', name: 'Golden Desert Eagle', rarity: 'legendary', defense: 0, attack: 100, style: 80, visual: 'deagle_gold', price: 50000, effect: { ranged: true, one_shot: 10 } }
  ],
  shield: [
    { id: 'riot_shield', name: 'Riot Shield', rarity: 'rare', defense: 30, style: 10, visual: 'riot_shield', price: 1500, effect: { block_chance: 25 } },
    { id: 'ballistic_shield', name: 'Ballistic Shield', rarity: 'epic', defense: 50, style: 15, visual: 'ballistic_shield', price: 5000, effect: { block_chance: 40, bullet_resist: 30 } },
    { id: 'energy_shield', name: 'Energy Barrier', rarity: 'legendary', defense: 75, style: 60, visual: 'energy_shield', price: 100000, effect: { block_chance: 60, regeneration: 5 } }
  ]
};

// Vehicle definitions
const VEHICLES = [
  { id: 'bicycle', name: 'BMX Bike', type: 'bike', speed: 5, storage: 1, price: 200, visual: 'bmx', fuel: 0 },
  { id: 'scooter', name: 'Street Scooter', type: 'scooter', speed: 15, storage: 2, price: 1000, visual: 'scooter', fuel: 5 },
  { id: 'motorcycle', name: 'Sport Bike', type: 'motorcycle', speed: 40, storage: 3, price: 8000, visual: 'sportbike', fuel: 8 },
  { id: 'sedan', name: 'Street Sedan', type: 'car', speed: 25, storage: 10, price: 5000, visual: 'sedan', fuel: 15 },
  { id: 'muscle_car', name: 'Muscle Car', type: 'car', speed: 45, storage: 8, price: 25000, visual: 'muscle', fuel: 25 },
  { id: 'suv', name: 'Armored SUV', type: 'car', speed: 30, storage: 20, price: 50000, visual: 'suv_armored', fuel: 30, armor: 25 },
  { id: 'sports_car', name: 'Supercar', type: 'car', speed: 60, storage: 4, price: 150000, visual: 'supercar', fuel: 35 },
  { id: 'van', name: 'Cargo Van', type: 'van', speed: 20, storage: 50, price: 15000, visual: 'van', fuel: 20 },
  { id: 'truck', name: 'Pickup Truck', type: 'truck', speed: 22, storage: 35, price: 20000, visual: 'pickup', fuel: 25 },
  { id: 'helicopter', name: 'Private Helicopter', type: 'aircraft', speed: 100, storage: 8, price: 500000, visual: 'helicopter', fuel: 100 }
];

// Vehicle upgrades
const VEHICLE_UPGRADES = [
  { id: 'tinted_windows', name: 'Tinted Windows', price: 500, visual: 'tinted', effect: { identity_protection: 15 } },
  { id: 'armor_plating', name: 'Armor Plating', price: 5000, visual: 'armor', effect: { damage_reduction: 20 } },
  { id: 'nitro', name: 'Nitro System', price: 3000, visual: 'nitro', effect: { speed_boost: 30 } },
  { id: 'hidden_compartment', name: 'Hidden Compartment', price: 2000, visual: 'compartment', effect: { storage_bonus: 10, contraband_hide: 50 } },
  { id: 'bulletproof_tires', name: 'Bulletproof Tires', price: 2500, visual: 'bp_tires', effect: { tire_durability: 100 } },
  { id: 'custom_paint', name: 'Custom Paint Job', price: 1000, visual: 'custom_paint', effect: { style_bonus: 15 } },
  { id: 'turbo', name: 'Turbo Engine', price: 8000, visual: 'turbo', effect: { speed_bonus: 20 } },
  { id: 'sound_system', name: 'Premium Sound', price: 1500, visual: 'speakers', effect: { style_bonus: 10 } }
];

// Property upgrade visuals
const PROPERTY_UPGRADES = [
  { id: 'security_cameras', name: 'Security Cameras', price: 2000, visual: 'cameras', effect: { raid_warning: 30 } },
  { id: 'reinforced_doors', name: 'Reinforced Doors', price: 5000, visual: 'steel_doors', effect: { raid_resistance: 25 } },
  { id: 'panic_room', name: 'Panic Room', price: 15000, visual: 'panic_room', effect: { safe_storage: 50 } },
  { id: 'garage', name: 'Private Garage', price: 10000, visual: 'garage', effect: { vehicle_slots: 2 } },
  { id: 'helipad', name: 'Helipad', price: 100000, visual: 'helipad', effect: { aircraft_slot: 1 } },
  { id: 'vault', name: 'Underground Vault', price: 50000, visual: 'vault', effect: { safe_storage: 200, raid_resistance: 50 } },
  { id: 'lookout_tower', name: 'Lookout Tower', price: 8000, visual: 'tower', effect: { raid_warning: 60 } },
  { id: 'escape_tunnel', name: 'Escape Tunnel', price: 25000, visual: 'tunnel', effect: { escape_chance: 75 } }
];

// Initialize equipment system
export async function initEquipmentSystem() {
  try {
    // Create equipment_slots table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment_slots (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slot_order INT NOT NULL
      )
    `);

    // Create equipment_items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS equipment_items (
        id VARCHAR(50) PRIMARY KEY,
        slot_id VARCHAR(50) REFERENCES equipment_slots(id),
        name VARCHAR(100) NOT NULL,
        rarity VARCHAR(20) NOT NULL DEFAULT 'common',
        defense INT DEFAULT 0,
        attack INT DEFAULT 0,
        style INT DEFAULT 0,
        visual_asset VARCHAR(100),
        price INT NOT NULL,
        effects JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create player_equipment table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_equipment (
        id SERIAL PRIMARY KEY,
        player_id INT REFERENCES players(id) ON DELETE CASCADE,
        slot_id VARCHAR(50) REFERENCES equipment_slots(id),
        item_id VARCHAR(50) REFERENCES equipment_items(id),
        durability INT DEFAULT 100,
        equipped_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(player_id, slot_id)
      )
    `);

    // Create player_inventory_equipment table (owned but not equipped)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_inventory_equipment (
        id SERIAL PRIMARY KEY,
        player_id INT REFERENCES players(id) ON DELETE CASCADE,
        item_id VARCHAR(50) REFERENCES equipment_items(id),
        durability INT DEFAULT 100,
        acquired_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create vehicles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicle_types (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        speed_bonus INT DEFAULT 0,
        storage_capacity INT DEFAULT 0,
        fuel_consumption INT DEFAULT 0,
        base_armor INT DEFAULT 0,
        price INT NOT NULL,
        visual_asset VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create player_vehicles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_vehicles (
        id SERIAL PRIMARY KEY,
        player_id INT REFERENCES players(id) ON DELETE CASCADE,
        vehicle_type_id VARCHAR(50) REFERENCES vehicle_types(id),
        nickname VARCHAR(100),
        condition INT DEFAULT 100,
        fuel INT DEFAULT 100,
        upgrades JSONB DEFAULT '[]',
        custom_color VARCHAR(20),
        location_lat DECIMAL(10, 8),
        location_lng DECIMAL(11, 8),
        parked_at_property INT,
        is_active BOOLEAN DEFAULT false,
        purchased_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create vehicle_upgrades table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicle_upgrade_types (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price INT NOT NULL,
        visual_asset VARCHAR(100),
        effects JSONB DEFAULT '{}'
      )
    `);

    // Create property_upgrades table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS property_upgrade_types (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price INT NOT NULL,
        visual_asset VARCHAR(100),
        effects JSONB DEFAULT '{}'
      )
    `);

    // Create player_property_upgrades table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_property_upgrades (
        id SERIAL PRIMARY KEY,
        player_id INT REFERENCES players(id) ON DELETE CASCADE,
        property_id INT,
        upgrade_id VARCHAR(50) REFERENCES property_upgrade_types(id),
        level INT DEFAULT 1,
        installed_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(player_id, property_id, upgrade_id)
      )
    `);

    // Create player_buffs table for active effects
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_buffs (
        id SERIAL PRIMARY KEY,
        player_id INT REFERENCES players(id) ON DELETE CASCADE,
        buff_type VARCHAR(50) NOT NULL,
        effect JSONB NOT NULL,
        visual_effect VARCHAR(50),
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Seed equipment slots
    for (const slot of EQUIPMENT_SLOTS) {
      await pool.query(`
        INSERT INTO equipment_slots (id, name, slot_order)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING
      `, [slot.id, slot.name, slot.order]);
    }

    // Seed equipment items
    for (const [slotId, items] of Object.entries(EQUIPMENT_ITEMS)) {
      for (const item of items) {
        await pool.query(`
          INSERT INTO equipment_items (id, slot_id, name, rarity, defense, attack, style, visual_asset, price, effects)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO NOTHING
        `, [item.id, slotId, item.name, item.rarity, item.defense || 0, item.attack || 0, item.style || 0, item.visual, item.price, JSON.stringify(item.effect || {})]);
      }
    }

    // Seed vehicles
    for (const vehicle of VEHICLES) {
      await pool.query(`
        INSERT INTO vehicle_types (id, name, type, speed_bonus, storage_capacity, fuel_consumption, base_armor, price, visual_asset)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [vehicle.id, vehicle.name, vehicle.type, vehicle.speed, vehicle.storage, vehicle.fuel, vehicle.armor || 0, vehicle.price, vehicle.visual]);
    }

    // Seed vehicle upgrades
    for (const upgrade of VEHICLE_UPGRADES) {
      await pool.query(`
        INSERT INTO vehicle_upgrade_types (id, name, price, visual_asset, effects)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `, [upgrade.id, upgrade.name, upgrade.price, upgrade.visual, JSON.stringify(upgrade.effect)]);
    }

    // Seed property upgrades
    for (const upgrade of PROPERTY_UPGRADES) {
      await pool.query(`
        INSERT INTO property_upgrade_types (id, name, price, visual_asset, effects)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `, [upgrade.id, upgrade.name, upgrade.price, upgrade.visual, JSON.stringify(upgrade.effect)]);
    }

    console.log('Equipment system initialized successfully');
  } catch (error) {
    console.error('Error initializing equipment system:', error);
  }
}

// Get all equipment slots and available items
router.get('/slots', async (_req, res: Response) => {
  try {
    const slotsResult = await pool.query(`
      SELECT * FROM equipment_slots ORDER BY slot_order
    `);

    const itemsResult = await pool.query(`
      SELECT * FROM equipment_items ORDER BY price
    `);

    const itemsBySlot: Record<string, any[]> = {};
    for (const item of itemsResult.rows) {
      if (!itemsBySlot[item.slot_id]) {
        itemsBySlot[item.slot_id] = [];
      }
      itemsBySlot[item.slot_id].push(item);
    }

    res.json({
      success: true,
      data: {
        slots: slotsResult.rows,
        items: itemsBySlot
      }
    });
  } catch (error) {
    console.error('Error getting equipment slots:', error);
    res.status(500).json({ success: false, error: 'Failed to get equipment data' });
  }
});

// Get player's equipped items
router.get('/equipped', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(`
      SELECT pe.*, ei.name, ei.rarity, ei.defense, ei.attack, ei.style, ei.visual_asset, ei.effects,
             es.name as slot_name
      FROM player_equipment pe
      JOIN equipment_items ei ON pe.item_id = ei.id
      JOIN equipment_slots es ON pe.slot_id = es.id
      WHERE pe.player_id = $1
      ORDER BY es.slot_order
    `, [playerId]);

    // Get active buffs
    const buffsResult = await pool.query(`
      SELECT * FROM player_buffs
      WHERE player_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
    `, [playerId]);

    // Calculate total stats
    let totalDefense = 0;
    let totalAttack = 0;
    let totalStyle = 0;
    const combinedEffects: Record<string, number> = {};

    for (const item of result.rows) {
      totalDefense += item.defense || 0;
      totalAttack += item.attack || 0;
      totalStyle += item.style || 0;

      if (item.effects) {
        for (const [key, value] of Object.entries(item.effects)) {
          if (typeof value === 'number') {
            combinedEffects[key] = (combinedEffects[key] || 0) + value;
          }
        }
      }
    }

    res.json({
      success: true,
      data: {
        equipped: result.rows,
        buffs: buffsResult.rows,
        stats: {
          totalDefense,
          totalAttack,
          totalStyle,
          effects: combinedEffects
        }
      }
    });
  } catch (error) {
    console.error('Error getting equipped items:', error);
    res.status(500).json({ success: false, error: 'Failed to get equipped items' });
  }
});

// Get player's equipment inventory
router.get('/inventory', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(`
      SELECT pie.*, ei.name, ei.rarity, ei.defense, ei.attack, ei.style, ei.visual_asset, ei.effects, ei.slot_id, ei.price
      FROM player_inventory_equipment pie
      JOIN equipment_items ei ON pie.item_id = ei.id
      WHERE pie.player_id = $1
      ORDER BY pie.acquired_at DESC
    `, [playerId]);

    res.json({
      success: true,
      data: {
        inventory: result.rows
      }
    });
  } catch (error) {
    console.error('Error getting equipment inventory:', error);
    res.status(500).json({ success: false, error: 'Failed to get inventory' });
  }
});

// Purchase equipment
router.post('/purchase/:itemId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { itemId } = req.params;

    // Get item info
    const itemResult = await pool.query(`
      SELECT * FROM equipment_items WHERE id = $1
    `, [itemId]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const item = itemResult.rows[0];

    // Check player cash
    const playerResult = await pool.query(`
      SELECT cash FROM players WHERE id = $1
    `, [playerId]);

    if (playerResult.rows[0].cash < item.price) {
      return res.status(400).json({ success: false, error: 'Not enough cash' });
    }

    // Deduct cash and add to inventory
    await pool.query(`
      UPDATE players SET cash = cash - $1 WHERE id = $2
    `, [item.price, playerId]);

    await pool.query(`
      INSERT INTO player_inventory_equipment (player_id, item_id)
      VALUES ($1, $2)
    `, [playerId, itemId]);

    res.json({
      success: true,
      data: {
        message: `Purchased ${item.name}`,
        item
      }
    });
  } catch (error) {
    console.error('Error purchasing equipment:', error);
    res.status(500).json({ success: false, error: 'Failed to purchase item' });
  }
});

// Equip item
router.post('/equip/:inventoryId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { inventoryId } = req.params;

    // Get inventory item
    const invResult = await pool.query(`
      SELECT pie.*, ei.slot_id, ei.name
      FROM player_inventory_equipment pie
      JOIN equipment_items ei ON pie.item_id = ei.id
      WHERE pie.id = $1 AND pie.player_id = $2
    `, [inventoryId, playerId]);

    if (invResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found in inventory' });
    }

    const invItem = invResult.rows[0];

    // Check if slot already has item equipped
    const currentEquipped = await pool.query(`
      SELECT pe.*, ei.name as item_name
      FROM player_equipment pe
      JOIN equipment_items ei ON pe.item_id = ei.id
      WHERE pe.player_id = $1 AND pe.slot_id = $2
    `, [playerId, invItem.slot_id]);

    // If item already equipped, move to inventory
    if (currentEquipped.rows.length > 0) {
      const current = currentEquipped.rows[0];
      await pool.query(`
        INSERT INTO player_inventory_equipment (player_id, item_id, durability)
        VALUES ($1, $2, $3)
      `, [playerId, current.item_id, current.durability]);

      await pool.query(`
        DELETE FROM player_equipment WHERE id = $1
      `, [current.id]);
    }

    // Equip new item
    await pool.query(`
      INSERT INTO player_equipment (player_id, slot_id, item_id, durability)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (player_id, slot_id) DO UPDATE SET
        item_id = EXCLUDED.item_id,
        durability = EXCLUDED.durability,
        equipped_at = NOW()
    `, [playerId, invItem.slot_id, invItem.item_id, invItem.durability]);

    // Remove from inventory
    await pool.query(`
      DELETE FROM player_inventory_equipment WHERE id = $1
    `, [inventoryId]);

    res.json({
      success: true,
      data: {
        message: `Equipped ${invItem.name}`,
        unequipped: currentEquipped.rows[0]?.item_name || null
      }
    });
  } catch (error) {
    console.error('Error equipping item:', error);
    res.status(500).json({ success: false, error: 'Failed to equip item' });
  }
});

// Unequip item
router.post('/unequip/:slotId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { slotId } = req.params;

    // Get equipped item
    const equippedResult = await pool.query(`
      SELECT pe.*, ei.name
      FROM player_equipment pe
      JOIN equipment_items ei ON pe.item_id = ei.id
      WHERE pe.player_id = $1 AND pe.slot_id = $2
    `, [playerId, slotId]);

    if (equippedResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No item equipped in this slot' });
    }

    const equipped = equippedResult.rows[0];

    // Move to inventory
    await pool.query(`
      INSERT INTO player_inventory_equipment (player_id, item_id, durability)
      VALUES ($1, $2, $3)
    `, [playerId, equipped.item_id, equipped.durability]);

    // Remove from equipped
    await pool.query(`
      DELETE FROM player_equipment WHERE id = $1
    `, [equipped.id]);

    res.json({
      success: true,
      data: {
        message: `Unequipped ${equipped.name}`
      }
    });
  } catch (error) {
    console.error('Error unequipping item:', error);
    res.status(500).json({ success: false, error: 'Failed to unequip item' });
  }
});

// Get all vehicles available for purchase
router.get('/vehicles/shop', async (_req, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT * FROM vehicle_types ORDER BY price
    `);

    const upgradesResult = await pool.query(`
      SELECT * FROM vehicle_upgrade_types ORDER BY price
    `);

    res.json({
      success: true,
      data: {
        vehicles: result.rows,
        upgrades: upgradesResult.rows
      }
    });
  } catch (error) {
    console.error('Error getting vehicles:', error);
    res.status(500).json({ success: false, error: 'Failed to get vehicles' });
  }
});

// Get player's vehicles
router.get('/vehicles', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(`
      SELECT pv.*, vt.name, vt.type, vt.speed_bonus, vt.storage_capacity,
             vt.fuel_consumption, vt.base_armor, vt.visual_asset
      FROM player_vehicles pv
      JOIN vehicle_types vt ON pv.vehicle_type_id = vt.id
      WHERE pv.player_id = $1
      ORDER BY pv.purchased_at DESC
    `, [playerId]);

    res.json({
      success: true,
      data: {
        vehicles: result.rows
      }
    });
  } catch (error) {
    console.error('Error getting player vehicles:', error);
    res.status(500).json({ success: false, error: 'Failed to get vehicles' });
  }
});

// Purchase vehicle
router.post('/vehicles/purchase/:vehicleId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { vehicleId } = req.params;
    const { nickname } = req.body;

    // Get vehicle info
    const vehicleResult = await pool.query(`
      SELECT * FROM vehicle_types WHERE id = $1
    `, [vehicleId]);

    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    const vehicle = vehicleResult.rows[0];

    // Check player cash
    const playerResult = await pool.query(`
      SELECT cash FROM players WHERE id = $1
    `, [playerId]);

    if (playerResult.rows[0].cash < vehicle.price) {
      return res.status(400).json({ success: false, error: 'Not enough cash' });
    }

    // Deduct cash and add vehicle
    await pool.query(`
      UPDATE players SET cash = cash - $1 WHERE id = $2
    `, [vehicle.price, playerId]);

    const insertResult = await pool.query(`
      INSERT INTO player_vehicles (player_id, vehicle_type_id, nickname)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [playerId, vehicleId, nickname || vehicle.name]);

    res.json({
      success: true,
      data: {
        message: `Purchased ${vehicle.name}`,
        vehicle: insertResult.rows[0]
      }
    });
  } catch (error) {
    console.error('Error purchasing vehicle:', error);
    res.status(500).json({ success: false, error: 'Failed to purchase vehicle' });
  }
});

// Set active vehicle
router.post('/vehicles/activate/:vehicleId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { vehicleId } = req.params;

    // Deactivate all vehicles first
    await pool.query(`
      UPDATE player_vehicles SET is_active = false WHERE player_id = $1
    `, [playerId]);

    // Activate selected vehicle
    const result = await pool.query(`
      UPDATE player_vehicles
      SET is_active = true
      WHERE id = $1 AND player_id = $2
      RETURNING *
    `, [vehicleId, playerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    res.json({
      success: true,
      data: {
        message: 'Vehicle activated',
        vehicle: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error activating vehicle:', error);
    res.status(500).json({ success: false, error: 'Failed to activate vehicle' });
  }
});

// Upgrade vehicle
router.post('/vehicles/:vehicleId/upgrade/:upgradeId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { vehicleId, upgradeId } = req.params;

    // Get vehicle
    const vehicleResult = await pool.query(`
      SELECT * FROM player_vehicles WHERE id = $1 AND player_id = $2
    `, [vehicleId, playerId]);

    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }

    const vehicle = vehicleResult.rows[0];
    const currentUpgrades = vehicle.upgrades || [];

    // Check if already has upgrade
    if (currentUpgrades.includes(upgradeId)) {
      return res.status(400).json({ success: false, error: 'Vehicle already has this upgrade' });
    }

    // Get upgrade info
    const upgradeResult = await pool.query(`
      SELECT * FROM vehicle_upgrade_types WHERE id = $1
    `, [upgradeId]);

    if (upgradeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Upgrade not found' });
    }

    const upgrade = upgradeResult.rows[0];

    // Check player cash
    const playerResult = await pool.query(`
      SELECT cash FROM players WHERE id = $1
    `, [playerId]);

    if (playerResult.rows[0].cash < upgrade.price) {
      return res.status(400).json({ success: false, error: 'Not enough cash' });
    }

    // Deduct cash and add upgrade
    await pool.query(`
      UPDATE players SET cash = cash - $1 WHERE id = $2
    `, [upgrade.price, playerId]);

    currentUpgrades.push(upgradeId);
    await pool.query(`
      UPDATE player_vehicles SET upgrades = $1 WHERE id = $2
    `, [JSON.stringify(currentUpgrades), vehicleId]);

    res.json({
      success: true,
      data: {
        message: `Installed ${upgrade.name}`,
        upgrades: currentUpgrades
      }
    });
  } catch (error) {
    console.error('Error upgrading vehicle:', error);
    res.status(500).json({ success: false, error: 'Failed to upgrade vehicle' });
  }
});

// Get property upgrades
router.get('/property-upgrades', async (_req, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT * FROM property_upgrade_types ORDER BY price
    `);

    res.json({
      success: true,
      data: {
        upgrades: result.rows
      }
    });
  } catch (error) {
    console.error('Error getting property upgrades:', error);
    res.status(500).json({ success: false, error: 'Failed to get property upgrades' });
  }
});

// Get player's property upgrades
router.get('/property-upgrades/:propertyId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { propertyId } = req.params;

    const result = await pool.query(`
      SELECT ppu.*, put.name, put.visual_asset, put.effects
      FROM player_property_upgrades ppu
      JOIN property_upgrade_types put ON ppu.upgrade_id = put.id
      WHERE ppu.player_id = $1 AND ppu.property_id = $2
    `, [playerId, propertyId]);

    res.json({
      success: true,
      data: {
        upgrades: result.rows
      }
    });
  } catch (error) {
    console.error('Error getting property upgrades:', error);
    res.status(500).json({ success: false, error: 'Failed to get property upgrades' });
  }
});

// Install property upgrade
router.post('/property-upgrades/:propertyId/:upgradeId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { propertyId, upgradeId } = req.params;

    // Get upgrade info
    const upgradeResult = await pool.query(`
      SELECT * FROM property_upgrade_types WHERE id = $1
    `, [upgradeId]);

    if (upgradeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Upgrade not found' });
    }

    const upgrade = upgradeResult.rows[0];

    // Check player cash
    const playerResult = await pool.query(`
      SELECT cash FROM players WHERE id = $1
    `, [playerId]);

    if (playerResult.rows[0].cash < upgrade.price) {
      return res.status(400).json({ success: false, error: 'Not enough cash' });
    }

    // Deduct cash and install upgrade
    await pool.query(`
      UPDATE players SET cash = cash - $1 WHERE id = $2
    `, [upgrade.price, playerId]);

    await pool.query(`
      INSERT INTO player_property_upgrades (player_id, property_id, upgrade_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (player_id, property_id, upgrade_id)
      DO UPDATE SET level = player_property_upgrades.level + 1
    `, [playerId, propertyId, upgradeId]);

    res.json({
      success: true,
      data: {
        message: `Installed ${upgrade.name}`
      }
    });
  } catch (error) {
    console.error('Error installing property upgrade:', error);
    res.status(500).json({ success: false, error: 'Failed to install upgrade' });
  }
});

// Get full character visual data (for avatar rendering)
router.get('/character-visual', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player appearance
    const appearanceResult = await pool.query(`
      SELECT * FROM character_appearance WHERE player_id = $1
    `, [playerId]);

    // Get equipped items
    const equippedResult = await pool.query(`
      SELECT pe.*, ei.visual_asset, ei.slot_id, es.slot_order
      FROM player_equipment pe
      JOIN equipment_items ei ON pe.item_id = ei.id
      JOIN equipment_slots es ON pe.slot_id = es.id
      WHERE pe.player_id = $1
      ORDER BY es.slot_order
    `, [playerId]);

    // Get active buffs for visual effects
    const buffsResult = await pool.query(`
      SELECT buff_type, visual_effect FROM player_buffs
      WHERE player_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
    `, [playerId]);

    // Get player heat level
    const playerResult = await pool.query(`
      SELECT heat, health FROM players WHERE id = $1
    `, [playerId]);

    const player = playerResult.rows[0] || { heat: 0, health: 100 };

    res.json({
      success: true,
      data: {
        appearance: appearanceResult.rows[0] || null,
        equipment: equippedResult.rows,
        buffs: buffsResult.rows,
        status: {
          heat: player.heat,
          health: player.health,
          injured: player.health < 50,
          wanted: player.heat > 50
        }
      }
    });
  } catch (error) {
    console.error('Error getting character visual:', error);
    res.status(500).json({ success: false, error: 'Failed to get character visual data' });
  }
});

export default router;
