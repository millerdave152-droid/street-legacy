import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';
import { cache, cacheKeys, cacheTTL, cacheInvalidation } from '../utils/cache.js';

// Local schemas for inventory routes
const buyItemSchema = z.object({
  body: z.object({
    itemId: z.number().int().positive()
  })
});

const equipItemSchema = z.object({
  body: z.object({
    itemId: z.number().int().positive(),
    equip: z.boolean().optional().default(true)
  })
});

const sellItemSchema = z.object({
  body: z.object({
    itemId: z.number().int().positive()
  })
});

const compareItemsSchema = z.object({
  query: z.object({
    itemIds: z.string() // comma-separated item IDs
  })
});

const router = Router();

router.use(authMiddleware);

// GET /api/shop - Get all items available in shop
router.get('/shop', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player level
    const playerResult = await pool.query(
      `SELECT level, cash FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get all items from cache (static data, cached for 24 hours)
    const allItems = await cache.getOrSet(
      cacheKeys.allItems(),
      async () => {
        const result = await pool.query(
          `SELECT id, name, description, type, slot, bonus_type, bonus_value,
                  attack_bonus, defense_bonus, rarity, crime_category,
                  price, sell_price, min_level
           FROM items
           ORDER BY type, min_level, price`
        );
        return result.rows;
      },
      cacheTTL.veryLong // 24 hours
    );

    // Get player's inventory (dynamic per-player data)
    const inventoryResult = await pool.query(
      `SELECT item_id, equipped FROM player_inventory WHERE player_id = $1`,
      [playerId]
    );

    // Create a map of owned items
    const ownedItems = new Map<number, boolean>();
    for (const row of inventoryResult.rows) {
      ownedItems.set(row.item_id, row.equipped);
    }

    // Merge static item data with player ownership
    const itemsResult = {
      rows: allItems.map((item: any) => ({
        ...item,
        owned: ownedItems.has(item.id),
        equipped: ownedItems.get(item.id) || false
      }))
    };

    res.json({
      success: true,
      data: {
        playerCash: player.cash,
        playerLevel: player.level,
        items: itemsResult.rows.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          type: item.type,
          slot: item.slot,
          bonusType: item.bonus_type,
          bonusValue: item.bonus_value,
          attackBonus: item.attack_bonus || 0,
          defenseBonus: item.defense_bonus || 0,
          rarity: item.rarity || 'common',
          crimeCategory: item.crime_category,
          price: item.price,
          minLevel: item.min_level,
          owned: item.owned,
          equipped: item.equipped,
          canBuy: !item.owned && player.level >= item.min_level && player.cash >= item.price
        }))
      }
    });
  } catch (error) {
    console.error('Shop error:', error);
    res.status(500).json({ success: false, error: 'Failed to get shop' });
  }
});

// POST /api/shop/buy - Purchase an item
router.post('/shop/buy', validate(buyItemSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { itemId } = req.body;

    // Get item
    const itemResult = await pool.query(`SELECT * FROM items WHERE id = $1`, [itemId]);
    const item = itemResult.rows[0];

    if (!item) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }

    // Get player
    const playerResult = await pool.query(
      `SELECT level, cash FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Check level requirement
    if (player.level < item.min_level) {
      res.status(400).json({ success: false, error: `Requires level ${item.min_level}` });
      return;
    }

    // Check if already owned
    const ownedResult = await pool.query(
      `SELECT id FROM player_inventory WHERE player_id = $1 AND item_id = $2`,
      [playerId, itemId]
    );
    if (ownedResult.rows.length > 0) {
      res.status(400).json({ success: false, error: 'Item already owned' });
      return;
    }

    // Check cash
    if (player.cash < item.price) {
      res.status(400).json({ success: false, error: 'Not enough cash' });
      return;
    }

    // Purchase
    await pool.query(
      `UPDATE players SET cash = cash - $1 WHERE id = $2`,
      [item.price, playerId]
    );

    await pool.query(
      `INSERT INTO player_inventory (player_id, item_id) VALUES ($1, $2)`,
      [playerId, itemId]
    );

    res.json({
      success: true,
      data: {
        message: `Purchased ${item.name}`,
        item: {
          id: item.id,
          name: item.name,
          type: item.type
        },
        newCash: player.cash - item.price
      }
    });
  } catch (error) {
    console.error('Buy error:', error);
    res.status(500).json({ success: false, error: 'Failed to purchase item' });
  }
});

// GET /api/inventory - Get player's inventory
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const inventoryResult = await pool.query(
      `SELECT i.*, pi.equipped, pi.purchased_at, pi.slot as equipped_slot
       FROM player_inventory pi
       JOIN items i ON pi.item_id = i.id
       WHERE pi.player_id = $1
       ORDER BY i.type, i.name`,
      [playerId]
    );

    // Calculate total bonuses from equipped items
    const equippedItems = inventoryResult.rows.filter(i => i.equipped);
    const bonuses = {
      successRate: 0,
      payout: 0,
      cooldown: 0,
      attack: 0,
      defense: 0,
      crimeSpecific: {} as Record<string, number>
    };

    for (const item of equippedItems) {
      if (item.bonus_type === 'success_rate') {
        bonuses.successRate += item.bonus_value;
      } else if (item.bonus_type === 'payout') {
        bonuses.payout += item.bonus_value;
      } else if (item.bonus_type === 'cooldown') {
        bonuses.cooldown += item.bonus_value;
      } else if (item.bonus_type === 'crime_specific' && item.crime_category) {
        bonuses.crimeSpecific[item.crime_category] =
          (bonuses.crimeSpecific[item.crime_category] || 0) + item.bonus_value;
      }
      // Add attack and defense bonuses
      if (item.attack_bonus) bonuses.attack += item.attack_bonus;
      if (item.defense_bonus) bonuses.defense += item.defense_bonus;
    }

    // Get equipped items by slot
    const equippedBySlot: Record<string, number | null> = {
      weapon: null,
      armor: null,
      accessory: null
    };
    for (const item of equippedItems) {
      if (item.slot && item.slot in equippedBySlot) {
        equippedBySlot[item.slot] = item.id;
      }
    }

    res.json({
      success: true,
      data: {
        items: inventoryResult.rows.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          type: item.type,
          slot: item.slot,
          bonusType: item.bonus_type,
          bonusValue: item.bonus_value,
          attackBonus: item.attack_bonus || 0,
          defenseBonus: item.defense_bonus || 0,
          rarity: item.rarity || 'common',
          crimeCategory: item.crime_category,
          equipped: item.equipped,
          purchasedAt: item.purchased_at
        })),
        bonuses,
        equippedBySlot
      }
    });
  } catch (error) {
    console.error('Inventory error:', error);
    res.status(500).json({ success: false, error: 'Failed to get inventory' });
  }
});

// POST /api/inventory/equip - Equip or unequip an item
router.post('/equip', validate(equipItemSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { itemId, equip } = req.body;

    // Check ownership
    const ownershipResult = await pool.query(
      `SELECT pi.*, i.type, i.name FROM player_inventory pi
       JOIN items i ON pi.item_id = i.id
       WHERE pi.player_id = $1 AND pi.item_id = $2`,
      [playerId, itemId]
    );

    if (ownershipResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Item not in inventory' });
      return;
    }

    const item = ownershipResult.rows[0];
    const shouldEquip = equip !== false;

    // If equipping, unequip any other item of the same type
    if (shouldEquip) {
      await pool.query(
        `UPDATE player_inventory pi
         SET equipped = false
         FROM items i
         WHERE pi.item_id = i.id AND pi.player_id = $1 AND i.type = $2`,
        [playerId, item.type]
      );
    }

    // Update equipped status
    await pool.query(
      `UPDATE player_inventory SET equipped = $1 WHERE player_id = $2 AND item_id = $3`,
      [shouldEquip, playerId, itemId]
    );

    res.json({
      success: true,
      data: {
        message: shouldEquip ? `Equipped ${item.name}` : `Unequipped ${item.name}`,
        itemId,
        equipped: shouldEquip
      }
    });
  } catch (error) {
    console.error('Equip error:', error);
    res.status(500).json({ success: false, error: 'Failed to equip item' });
  }
});

// POST /api/inventory/sell - Sell an item back to the shop
router.post('/sell', validate(sellItemSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { itemId } = req.body;

    // Check ownership and get item details
    const ownershipResult = await pool.query(
      `SELECT pi.*, i.name, i.price, i.sell_price, i.type
       FROM player_inventory pi
       JOIN items i ON pi.item_id = i.id
       WHERE pi.player_id = $1 AND pi.item_id = $2`,
      [playerId, itemId]
    );

    if (ownershipResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Item not in inventory' });
      return;
    }

    const item = ownershipResult.rows[0];

    // Check if equipped - must unequip first
    if (item.equipped) {
      res.status(400).json({ success: false, error: 'Cannot sell equipped item. Unequip it first.' });
      return;
    }

    // Calculate sell price (sell_price column or 40% of purchase price)
    const sellPrice = item.sell_price || Math.floor(item.price * 0.4);

    // Remove from inventory
    await pool.query(
      `DELETE FROM player_inventory WHERE player_id = $1 AND item_id = $2`,
      [playerId, itemId]
    );

    // Add cash to player
    await pool.query(
      `UPDATE players SET cash = cash + $1 WHERE id = $2`,
      [sellPrice, playerId]
    );

    // Record the sale
    try {
      await pool.query(
        `INSERT INTO item_sales (player_id, item_id, item_name, sale_price)
         VALUES ($1, $2, $3, $4)`,
        [playerId, itemId, item.name, sellPrice]
      );
    } catch {
      // Non-critical if table doesn't exist
    }

    // Get new cash balance
    const playerResult = await pool.query(
      `SELECT cash FROM players WHERE id = $1`,
      [playerId]
    );

    res.json({
      success: true,
      data: {
        message: `Sold ${item.name} for $${sellPrice.toLocaleString()}`,
        itemId,
        itemName: item.name,
        sellPrice,
        newCash: playerResult.rows[0].cash
      }
    });
  } catch (error) {
    console.error('Sell error:', error);
    res.status(500).json({ success: false, error: 'Failed to sell item' });
  }
});

// GET /api/inventory/compare - Compare multiple items
router.get('/compare', async (req: AuthRequest, res: Response) => {
  try {
    const itemIdsParam = req.query.itemIds as string;
    if (!itemIdsParam) {
      res.status(400).json({ success: false, error: 'Item IDs required' });
      return;
    }

    const itemIds = itemIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

    if (itemIds.length < 2) {
      res.status(400).json({ success: false, error: 'Need at least 2 items to compare' });
      return;
    }

    if (itemIds.length > 5) {
      res.status(400).json({ success: false, error: 'Maximum 5 items can be compared' });
      return;
    }

    // Get all items
    const itemsResult = await pool.query(
      `SELECT id, name, description, type, slot, bonus_type, bonus_value,
              attack_bonus, defense_bonus, rarity, crime_category,
              price, sell_price, min_level
       FROM items
       WHERE id = ANY($1)`,
      [itemIds]
    );

    if (itemsResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'No items found' });
      return;
    }

    // Format items for comparison
    const items = itemsResult.rows.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      type: item.type,
      slot: item.slot,
      stats: {
        bonusType: item.bonus_type,
        bonusValue: item.bonus_value || 0,
        attackBonus: item.attack_bonus || 0,
        defenseBonus: item.defense_bonus || 0,
        crimeCategory: item.crime_category
      },
      rarity: item.rarity || 'common',
      price: item.price,
      sellPrice: item.sell_price || Math.floor(item.price * 0.4),
      minLevel: item.min_level
    }));

    // Calculate stat differences (compared to first item)
    const baseItem = items[0];
    const comparisons = items.slice(1).map(item => ({
      itemId: item.id,
      vsBase: {
        attackDiff: item.stats.attackBonus - baseItem.stats.attackBonus,
        defenseDiff: item.stats.defenseBonus - baseItem.stats.defenseBonus,
        bonusValueDiff: item.stats.bonusValue - baseItem.stats.bonusValue,
        priceDiff: item.price - baseItem.price
      }
    }));

    res.json({
      success: true,
      data: {
        items,
        comparisons,
        baseItemId: baseItem.id
      }
    });
  } catch (error) {
    console.error('Compare error:', error);
    res.status(500).json({ success: false, error: 'Failed to compare items' });
  }
});

// GET /api/inventory/bonuses - Get current equipment bonuses
router.get('/bonuses', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const equippedResult = await pool.query(
      `SELECT i.*, pi.equipped
       FROM player_inventory pi
       JOIN items i ON pi.item_id = i.id
       WHERE pi.player_id = $1 AND pi.equipped = true`,
      [playerId]
    );

    // Calculate bonuses
    const bonuses = {
      successRate: 0,
      payout: 0,
      cooldown: 0,
      attack: 0,
      defense: 0,
      crimeSpecific: {} as Record<string, number>
    };

    const equippedItems: any[] = [];

    for (const item of equippedResult.rows) {
      equippedItems.push({
        id: item.id,
        name: item.name,
        type: item.type,
        slot: item.slot,
        bonusType: item.bonus_type,
        bonusValue: item.bonus_value
      });

      if (item.bonus_type === 'success_rate') {
        bonuses.successRate += item.bonus_value;
      } else if (item.bonus_type === 'payout') {
        bonuses.payout += item.bonus_value;
      } else if (item.bonus_type === 'cooldown') {
        bonuses.cooldown += item.bonus_value;
      } else if (item.bonus_type === 'crime_specific' && item.crime_category) {
        bonuses.crimeSpecific[item.crime_category] =
          (bonuses.crimeSpecific[item.crime_category] || 0) + item.bonus_value;
      }
      if (item.attack_bonus) bonuses.attack += item.attack_bonus;
      if (item.defense_bonus) bonuses.defense += item.defense_bonus;
    }

    res.json({
      success: true,
      data: {
        bonuses,
        equippedItems,
        summary: {
          totalAttack: bonuses.attack,
          totalDefense: bonuses.defense,
          successBonus: `+${bonuses.successRate}%`,
          payoutBonus: `+${bonuses.payout}%`,
          cooldownReduction: `-${bonuses.cooldown}%`
        }
      }
    });
  } catch (error) {
    console.error('Bonuses error:', error);
    res.status(500).json({ success: false, error: 'Failed to get bonuses' });
  }
});

export default router;
