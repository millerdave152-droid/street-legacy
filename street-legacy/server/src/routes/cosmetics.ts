import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/cosmetics/shop - Get all available cosmetics
router.get('/shop', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player info
    const playerResult = await pool.query(
      `SELECT level, cash, street_cred FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get all cosmetics
    const cosmeticsResult = await pool.query(
      `SELECT c.*,
        CASE WHEN pc.id IS NOT NULL THEN true ELSE false END as owned,
        CASE WHEN pc.equipped THEN true ELSE false END as equipped
       FROM cosmetics c
       LEFT JOIN player_cosmetics pc ON pc.cosmetic_id = c.id AND pc.player_id = $1
       ORDER BY c.type, c.min_level, c.price_cash NULLS LAST, c.price_cred`,
      [playerId]
    );

    // Group by type
    const grouped: Record<string, typeof cosmeticsResult.rows> = {
      name_color: [],
      avatar_border: [],
      chat_badge: [],
      title: []
    };

    for (const cosmetic of cosmeticsResult.rows) {
      if (grouped[cosmetic.type]) {
        grouped[cosmetic.type].push(cosmetic);
      }
    }

    res.json({
      success: true,
      data: {
        playerLevel: player.level,
        playerCash: player.cash,
        playerCred: player.street_cred,
        cosmetics: grouped
      }
    });
  } catch (error) {
    console.error('Get cosmetics shop error:', error);
    res.status(500).json({ success: false, error: 'Failed to load shop' });
  }
});

// GET /api/cosmetics/owned - Get player's owned cosmetics
router.get('/owned', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(
      `SELECT c.*, pc.equipped, pc.purchased_at
       FROM player_cosmetics pc
       JOIN cosmetics c ON c.id = pc.cosmetic_id
       WHERE pc.player_id = $1
       ORDER BY pc.purchased_at DESC`,
      [playerId]
    );

    res.json({
      success: true,
      data: {
        cosmetics: result.rows
      }
    });
  } catch (error) {
    console.error('Get owned cosmetics error:', error);
    res.status(500).json({ success: false, error: 'Failed to load owned cosmetics' });
  }
});

// POST /api/cosmetics/buy - Purchase a cosmetic
router.post('/buy', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { cosmeticId, paymentType } = req.body;

    if (!cosmeticId) {
      res.status(400).json({ success: false, error: 'Cosmetic ID required' });
      return;
    }

    if (!paymentType || !['cash', 'cred'].includes(paymentType)) {
      res.status(400).json({ success: false, error: 'Payment type must be "cash" or "cred"' });
      return;
    }

    // Get cosmetic details
    const cosmeticResult = await pool.query(
      `SELECT * FROM cosmetics WHERE id = $1`,
      [cosmeticId]
    );

    if (cosmeticResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Cosmetic not found' });
      return;
    }

    const cosmetic = cosmeticResult.rows[0];

    // Check if already owned
    const ownedResult = await pool.query(
      `SELECT id FROM player_cosmetics WHERE player_id = $1 AND cosmetic_id = $2`,
      [playerId, cosmeticId]
    );

    if (ownedResult.rows.length > 0) {
      res.status(400).json({ success: false, error: 'Already owned' });
      return;
    }

    // Get player info
    const playerResult = await pool.query(
      `SELECT level, cash, street_cred FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Check level requirement
    if (player.level < cosmetic.min_level) {
      res.status(400).json({ success: false, error: `Requires level ${cosmetic.min_level}` });
      return;
    }

    // Handle payment
    if (paymentType === 'cash') {
      if (cosmetic.price_cash === null) {
        res.status(400).json({ success: false, error: 'Cannot purchase with cash (cred only)' });
        return;
      }

      if (player.cash < cosmetic.price_cash) {
        res.status(400).json({ success: false, error: `Not enough cash (need $${cosmetic.price_cash.toLocaleString()})` });
        return;
      }

      // Deduct cash and add cosmetic
      await pool.query(
        `UPDATE players SET cash = cash - $1 WHERE id = $2`,
        [cosmetic.price_cash, playerId]
      );
    } else {
      // paymentType === 'cred'
      if (cosmetic.price_cred === null) {
        res.status(400).json({ success: false, error: 'Cannot purchase with cred (cash only)' });
        return;
      }

      if (player.street_cred < cosmetic.price_cred) {
        res.status(400).json({ success: false, error: `Not enough cred (need ${cosmetic.price_cred})` });
        return;
      }

      // Deduct cred and log transaction
      await pool.query(
        `UPDATE players SET street_cred = street_cred - $1 WHERE id = $2`,
        [cosmetic.price_cred, playerId]
      );

      await pool.query(
        `INSERT INTO street_cred_transactions (player_id, amount, type, description)
         VALUES ($1, $2, 'spend', $3)`,
        [playerId, -cosmetic.price_cred, `Purchased cosmetic: ${cosmetic.name}`]
      );
    }

    // Add to player's cosmetics
    await pool.query(
      `INSERT INTO player_cosmetics (player_id, cosmetic_id) VALUES ($1, $2)`,
      [playerId, cosmeticId]
    );

    res.json({
      success: true,
      data: {
        cosmetic,
        message: `Purchased ${cosmetic.name}!`
      }
    });
  } catch (error) {
    console.error('Buy cosmetic error:', error);
    res.status(500).json({ success: false, error: 'Failed to purchase cosmetic' });
  }
});

// POST /api/cosmetics/equip - Equip a cosmetic
router.post('/equip', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { cosmeticId } = req.body;

    if (!cosmeticId) {
      res.status(400).json({ success: false, error: 'Cosmetic ID required' });
      return;
    }

    // Check if owned
    const ownedResult = await pool.query(
      `SELECT pc.*, c.type, c.css_value, c.name
       FROM player_cosmetics pc
       JOIN cosmetics c ON c.id = pc.cosmetic_id
       WHERE pc.player_id = $1 AND pc.cosmetic_id = $2`,
      [playerId, cosmeticId]
    );

    if (ownedResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'Cosmetic not owned' });
      return;
    }

    const cosmetic = ownedResult.rows[0];

    // Unequip other cosmetics of the same type
    await pool.query(
      `UPDATE player_cosmetics pc
       SET equipped = FALSE
       FROM cosmetics c
       WHERE pc.cosmetic_id = c.id
         AND pc.player_id = $1
         AND c.type = $2`,
      [playerId, cosmetic.type]
    );

    // Equip the selected cosmetic
    await pool.query(
      `UPDATE player_cosmetics SET equipped = TRUE
       WHERE player_id = $1 AND cosmetic_id = $2`,
      [playerId, cosmeticId]
    );

    // Update player's name_color if applicable
    if (cosmetic.type === 'name_color') {
      await pool.query(
        `UPDATE players SET name_color = $1 WHERE id = $2`,
        [cosmetic.css_value, playerId]
      );
    }

    res.json({
      success: true,
      data: {
        message: `Equipped ${cosmetic.name}!`
      }
    });
  } catch (error) {
    console.error('Equip cosmetic error:', error);
    res.status(500).json({ success: false, error: 'Failed to equip cosmetic' });
  }
});

// POST /api/cosmetics/unequip - Unequip a cosmetic
router.post('/unequip', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { cosmeticId } = req.body;

    if (!cosmeticId) {
      res.status(400).json({ success: false, error: 'Cosmetic ID required' });
      return;
    }

    // Check if owned and get type
    const ownedResult = await pool.query(
      `SELECT c.type FROM player_cosmetics pc
       JOIN cosmetics c ON c.id = pc.cosmetic_id
       WHERE pc.player_id = $1 AND pc.cosmetic_id = $2`,
      [playerId, cosmeticId]
    );

    if (ownedResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'Cosmetic not owned' });
      return;
    }

    const cosmeticType = ownedResult.rows[0].type;

    // Unequip the cosmetic
    await pool.query(
      `UPDATE player_cosmetics SET equipped = FALSE
       WHERE player_id = $1 AND cosmetic_id = $2`,
      [playerId, cosmeticId]
    );

    // Reset player's name_color if applicable
    if (cosmeticType === 'name_color') {
      await pool.query(
        `UPDATE players SET name_color = NULL WHERE id = $1`,
        [playerId]
      );
    }

    res.json({
      success: true,
      data: {
        message: 'Cosmetic unequipped'
      }
    });
  } catch (error) {
    console.error('Unequip cosmetic error:', error);
    res.status(500).json({ success: false, error: 'Failed to unequip cosmetic' });
  }
});

// GET /api/cosmetics/equipped - Get player's currently equipped cosmetics
router.get('/equipped', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(
      `SELECT c.*
       FROM player_cosmetics pc
       JOIN cosmetics c ON c.id = pc.cosmetic_id
       WHERE pc.player_id = $1 AND pc.equipped = TRUE`,
      [playerId]
    );

    // Create a map by type
    const equipped: Record<string, typeof result.rows[0]> = {};
    for (const cosmetic of result.rows) {
      equipped[cosmetic.type] = cosmetic;
    }

    res.json({
      success: true,
      data: {
        equipped
      }
    });
  } catch (error) {
    console.error('Get equipped cosmetics error:', error);
    res.status(500).json({ success: false, error: 'Failed to load equipped cosmetics' });
  }
});

export default router;
