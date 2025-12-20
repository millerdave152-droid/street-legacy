import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Black market inventory - refreshes periodically with random items
async function refreshBlackMarketInventory() {
  try {
    // Check if we need to refresh
    const checkResult = await pool.query(
      `SELECT COUNT(*) as active FROM black_market_inventory WHERE available_until > NOW()`
    );

    if (Number(checkResult.rows[0].active) >= 6) {
      return; // Already have enough active items
    }

    // Get random items to add
    const itemsResult = await pool.query(
      `SELECT id, base_price, rarity FROM black_market_items
       ORDER BY RANDOM() LIMIT 8`
    );

    for (const item of itemsResult.rows) {
      // Price fluctuation based on rarity
      const rarityMultipliers: Record<string, number> = {
        'common': 0.8 + Math.random() * 0.4,
        'uncommon': 0.9 + Math.random() * 0.3,
        'rare': 1.0 + Math.random() * 0.5,
        'epic': 1.1 + Math.random() * 0.6,
        'legendary': 1.2 + Math.random() * 0.8
      };

      const multiplier = rarityMultipliers[item.rarity] || 1;
      const currentPrice = Math.floor(item.base_price * multiplier);

      // Quantity based on rarity
      const rarityQuantities: Record<string, number> = {
        'common': 5 + Math.floor(Math.random() * 10),
        'uncommon': 3 + Math.floor(Math.random() * 5),
        'rare': 2 + Math.floor(Math.random() * 3),
        'epic': 1 + Math.floor(Math.random() * 2),
        'legendary': 1
      };

      const quantity = rarityQuantities[item.rarity] || 1;

      // Available for 6-24 hours
      const hoursAvailable = 6 + Math.floor(Math.random() * 18);
      const availableUntil = new Date(Date.now() + hoursAvailable * 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO black_market_inventory (item_id, current_price, quantity, available_until)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [item.id, currentPrice, quantity, availableUntil]
      );
    }
  } catch (error) {
    console.error('Failed to refresh black market:', error);
  }
}

// GET /api/blackmarket - Get available black market items
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Refresh inventory if needed
    await refreshBlackMarketInventory();

    // Get available items
    const inventoryResult = await pool.query(
      `SELECT bmi.id as inventory_id, bmi.current_price, bmi.quantity, bmi.available_until,
              bm.id as item_id, bm.name, bm.description, bm.type, bm.base_price,
              bm.effect_type, bm.effect_value, bm.min_level, bm.rarity
       FROM black_market_inventory bmi
       JOIN black_market_items bm ON bmi.item_id = bm.id
       WHERE bmi.available_until > NOW() AND bmi.quantity > 0
       ORDER BY bm.rarity DESC, bmi.available_until ASC`
    );

    // Get player's black market purchases
    const purchasesResult = await pool.query(
      `SELECT pbm.*, bm.name, bm.description, bm.type, bm.effect_type, bm.effect_value, bm.rarity
       FROM player_black_market pbm
       JOIN black_market_items bm ON pbm.item_id = bm.id
       WHERE pbm.player_id = $1
       ORDER BY pbm.purchased_at DESC`,
      [playerId]
    );

    // Get player level and cash for filtering
    const playerResult = await pool.query(
      `SELECT level, cash FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Calculate time until next refresh
    const oldestExpiry = inventoryResult.rows.length > 0
      ? new Date(inventoryResult.rows[inventoryResult.rows.length - 1].available_until)
      : new Date(Date.now() + 6 * 60 * 60 * 1000);

    res.json({
      success: true,
      data: {
        inventory: inventoryResult.rows.map(item => ({
          inventoryId: item.inventory_id,
          itemId: item.item_id,
          name: item.name,
          description: item.description,
          type: item.type,
          basePrice: item.base_price,
          currentPrice: item.current_price,
          quantity: item.quantity,
          availableUntil: item.available_until,
          effectType: item.effect_type,
          effectValue: item.effect_value,
          minLevel: item.min_level,
          rarity: item.rarity,
          canAfford: player.cash >= item.current_price,
          meetsLevel: player.level >= item.min_level
        })),
        playerPurchases: purchasesResult.rows.map(p => ({
          id: p.id,
          itemId: p.item_id,
          name: p.name,
          description: p.description,
          type: p.type,
          effectType: p.effect_type,
          effectValue: p.effect_value,
          quantity: p.quantity,
          rarity: p.rarity,
          purchasedAt: p.purchased_at
        })),
        nextRefresh: oldestExpiry
      }
    });
  } catch (error) {
    console.error('Black market error:', error);
    res.status(500).json({ success: false, error: 'Failed to load black market' });
  }
});

// POST /api/blackmarket/buy - Purchase an item from the black market
router.post('/buy', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { inventoryId, quantity = 1 } = req.body;

    if (!inventoryId) {
      res.status(400).json({ success: false, error: 'Item inventory ID required' });
      return;
    }

    // Get inventory item
    const inventoryResult = await pool.query(
      `SELECT bmi.*, bm.name, bm.min_level, bm.effect_type, bm.effect_value, bm.rarity
       FROM black_market_inventory bmi
       JOIN black_market_items bm ON bmi.item_id = bm.id
       WHERE bmi.id = $1 AND bmi.available_until > NOW() AND bmi.quantity >= $2`,
      [inventoryId, quantity]
    );

    if (inventoryResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Item not available or sold out' });
      return;
    }

    const item = inventoryResult.rows[0];
    const totalCost = item.current_price * quantity;

    // Check player level and cash
    const playerResult = await pool.query(
      `SELECT level, cash FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (player.level < item.min_level) {
      res.status(400).json({
        success: false,
        error: `You need to be level ${item.min_level} to purchase this item`
      });
      return;
    }

    if (player.cash < totalCost) {
      res.status(400).json({
        success: false,
        error: `Insufficient cash. Need $${totalCost.toLocaleString()}`
      });
      return;
    }

    // Deduct cash
    await pool.query(
      `UPDATE players SET cash = cash - $2 WHERE id = $1`,
      [playerId, totalCost]
    );

    // Reduce inventory quantity
    await pool.query(
      `UPDATE black_market_inventory SET quantity = quantity - $2 WHERE id = $1`,
      [inventoryId, quantity]
    );

    // Add to player's black market inventory
    const existingResult = await pool.query(
      `SELECT id, quantity FROM player_black_market WHERE player_id = $1 AND item_id = $2`,
      [playerId, item.item_id]
    );

    if (existingResult.rows.length > 0) {
      await pool.query(
        `UPDATE player_black_market SET quantity = quantity + $3 WHERE player_id = $1 AND item_id = $2`,
        [playerId, item.item_id, quantity]
      );
    } else {
      await pool.query(
        `INSERT INTO player_black_market (player_id, item_id, quantity) VALUES ($1, $2, $3)`,
        [playerId, item.item_id, quantity]
      );
    }

    res.json({
      success: true,
      data: {
        message: `Purchased ${quantity}x ${item.name} for $${totalCost.toLocaleString()}`,
        item: {
          name: item.name,
          quantity,
          effectType: item.effect_type,
          effectValue: item.effect_value,
          rarity: item.rarity
        },
        cost: totalCost
      }
    });
  } catch (error) {
    console.error('Black market purchase error:', error);
    res.status(500).json({ success: false, error: 'Failed to purchase item' });
  }
});

// POST /api/blackmarket/use - Use a black market item
router.post('/use', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { itemId } = req.body;

    if (!itemId) {
      res.status(400).json({ success: false, error: 'Item ID required' });
      return;
    }

    // Check if player has the item
    const purchaseResult = await pool.query(
      `SELECT pbm.*, bm.name, bm.effect_type, bm.effect_value
       FROM player_black_market pbm
       JOIN black_market_items bm ON pbm.item_id = bm.id
       WHERE pbm.player_id = $1 AND pbm.item_id = $2 AND pbm.quantity > 0`,
      [playerId, itemId]
    );

    if (purchaseResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'You do not own this item' });
      return;
    }

    const item = purchaseResult.rows[0];
    let effectMessage = '';

    // Apply effect based on type
    switch (item.effect_type) {
      case 'heat_reduction':
        await pool.query(
          `UPDATE players SET heat_level = GREATEST(0, heat_level - $2) WHERE id = $1`,
          [playerId, item.effect_value]
        );
        effectMessage = `Reduced your heat level by ${item.effect_value}`;
        break;

      case 'escape_bonus':
        // This would be applied to next escape attempt - store as temporary buff
        // For now, just acknowledge
        effectMessage = `+${item.effect_value}% escape chance on next jail break attempt`;
        break;

      case 'stealth_bonus':
        effectMessage = `+${item.effect_value}% stealth for next crime`;
        break;

      case 'crime_bonus':
        effectMessage = `+${item.effect_value}% crime success rate temporarily`;
        break;

      case 'defense_bonus':
        effectMessage = `+${item.effect_value} defense in PvP`;
        break;

      case 'heist_payout':
        effectMessage = `+${item.effect_value}% payout on next heist`;
        break;

      case 'jail_reduction':
        effectMessage = `${item.effect_value}% reduced jail time`;
        break;

      default:
        effectMessage = `Used ${item.name}`;
    }

    // Reduce quantity
    if (purchaseResult.rows[0].quantity === 1) {
      await pool.query(
        `DELETE FROM player_black_market WHERE player_id = $1 AND item_id = $2`,
        [playerId, itemId]
      );
    } else {
      await pool.query(
        `UPDATE player_black_market SET quantity = quantity - 1 WHERE player_id = $1 AND item_id = $2`,
        [playerId, itemId]
      );
    }

    res.json({
      success: true,
      data: {
        message: effectMessage,
        itemUsed: item.name,
        effectType: item.effect_type,
        effectValue: item.effect_value
      }
    });
  } catch (error) {
    console.error('Black market use error:', error);
    res.status(500).json({ success: false, error: 'Failed to use item' });
  }
});

// POST /api/blackmarket/sell - Sell an item back (at reduced price)
router.post('/sell', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { itemId, quantity = 1 } = req.body;

    if (!itemId) {
      res.status(400).json({ success: false, error: 'Item ID required' });
      return;
    }

    // Check if player has the item
    const purchaseResult = await pool.query(
      `SELECT pbm.*, bm.name, bm.base_price, bm.rarity
       FROM player_black_market pbm
       JOIN black_market_items bm ON pbm.item_id = bm.id
       WHERE pbm.player_id = $1 AND pbm.item_id = $2 AND pbm.quantity >= $3`,
      [playerId, itemId, quantity]
    );

    if (purchaseResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'You do not own enough of this item' });
      return;
    }

    const item = purchaseResult.rows[0];

    // Sell price is 40% of base price
    const sellPrice = Math.floor(item.base_price * 0.4 * quantity);

    // Add cash to player
    await pool.query(
      `UPDATE players SET cash = cash + $2 WHERE id = $1`,
      [playerId, sellPrice]
    );

    // Reduce quantity
    if (item.quantity <= quantity) {
      await pool.query(
        `DELETE FROM player_black_market WHERE player_id = $1 AND item_id = $2`,
        [playerId, itemId]
      );
    } else {
      await pool.query(
        `UPDATE player_black_market SET quantity = quantity - $3 WHERE player_id = $1 AND item_id = $2`,
        [playerId, itemId, quantity]
      );
    }

    res.json({
      success: true,
      data: {
        message: `Sold ${quantity}x ${item.name} for $${sellPrice.toLocaleString()}`,
        cashReceived: sellPrice
      }
    });
  } catch (error) {
    console.error('Black market sell error:', error);
    res.status(500).json({ success: false, error: 'Failed to sell item' });
  }
});

// GET /api/blackmarket/contacts - Get underground contacts for special deals
router.get('/contacts', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player level for contact availability
    const playerResult = await pool.query(
      `SELECT level, street_cred FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Define contacts with level requirements
    const contacts = [
      {
        id: 1,
        name: 'Shifty Pete',
        title: 'Small-Time Fence',
        description: 'Deals in common contraband. Low prices, low quality.',
        minLevel: 1,
        minCred: 0,
        discount: 5,
        specialties: ['contraband', 'service']
      },
      {
        id: 2,
        name: 'Red',
        title: 'Arms Dealer',
        description: 'Has connections to get you any weapon you need.',
        minLevel: 5,
        minCred: 100,
        discount: 10,
        specialties: ['weapon']
      },
      {
        id: 3,
        name: 'The Oracle',
        title: 'Information Broker',
        description: 'Knows things. Things that could be very valuable.',
        minLevel: 8,
        minCred: 250,
        discount: 15,
        specialties: ['intel']
      },
      {
        id: 4,
        name: 'Ghost',
        title: 'Elite Smuggler',
        description: 'Can get anything across any border. For a price.',
        minLevel: 12,
        minCred: 500,
        discount: 20,
        specialties: ['rare', 'contraband']
      }
    ];

    const availableContacts = contacts.map(contact => ({
      ...contact,
      unlocked: player.level >= contact.minLevel && player.street_cred >= contact.minCred
    }));

    res.json({
      success: true,
      data: {
        contacts: availableContacts
      }
    });
  } catch (error) {
    console.error('Black market contacts error:', error);
    res.status(500).json({ success: false, error: 'Failed to load contacts' });
  }
});

export default router;
