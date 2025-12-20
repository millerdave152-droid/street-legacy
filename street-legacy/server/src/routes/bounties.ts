import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, validateParams } from '../validation/validate.middleware.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const placeBountySchema = z.object({
  body: z.object({
    targetId: z.coerce.number().int().positive('Invalid target ID'),
    amount: z.coerce.number().int().min(1000, 'Minimum bounty is $1,000').max(10000000, 'Maximum bounty is $10,000,000'),
    reason: z.string().max(200, 'Reason too long').optional(),
    anonymous: z.boolean().optional().default(false)
  })
});

const bountyIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid bounty ID')
});

const hireHitmanSchema = z.object({
  body: z.object({
    bountyId: z.coerce.number().int().positive('Invalid bounty ID'),
    hitmanId: z.coerce.number().int().positive('Invalid hitman ID')
  })
});

const hireBodyguardSchema = z.object({
  body: z.object({
    bodyguardType: z.enum(['street_muscle', 'professional_guard', 'ex_military', 'elite_protection'], {
      message: 'Invalid bodyguard type'
    }),
    days: z.coerce.number().int().min(1, 'Minimum 1 day').max(30, 'Maximum 30 days').optional().default(1)
  })
});

const boardQuerySchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    minAmount: z.coerce.number().int().min(0).optional().default(0),
    district: z.coerce.number().int().positive().optional()
  })
});

// Bounty configuration
const BOUNTY_CONFIG = {
  minAmount: 1000,
  maxAmount: 10000000,
  anonymousFeePercent: 25,
  payOffMultiplier: 2,
  expiryDays: 7,
  hitmanAttemptHours: 6,
  minBountyForHitman: 5000
};

// GET /api/bounties/board - Get bounty board (all active bounties)
// Validation ensures query params are valid integers
router.get('/board', authMiddleware, validate(boardQuerySchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const limit = req.query.limit as unknown as number;
    const minAmount = req.query.minAmount as unknown as number;
    const districtId = req.query.district as unknown as number | undefined;

    let query = `
      SELECT
        b.*,
        p.username as target_username,
        p.level as target_level,
        p.current_district_id as target_district,
        p.last_combat_at as target_last_seen,
        CASE WHEN b.is_anonymous THEN NULL ELSE placer.username END as placed_by_username,
        (SELECT COUNT(*) FROM bounty_contributions bc WHERE bc.bounty_id = b.id) as contributor_count,
        (SELECT SUM(amount) FROM bounty_contributions bc WHERE bc.bounty_id = b.id) as total_contributions
      FROM bounties b
      JOIN players p ON b.target_player_id = p.id
      LEFT JOIN players placer ON b.placed_by_player_id = placer.id
      WHERE b.status = 'active' AND b.expires_at > NOW()
        AND b.amount >= $1
    `;

    const params: any[] = [minAmount];

    if (districtId) {
      params.push(districtId);
      query += ` AND p.current_district_id = $${params.length}`;
    }

    query += ` ORDER BY b.amount DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    // Calculate total bounty pool
    const totalResult = await pool.query(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM bounties WHERE status = 'active' AND expires_at > NOW()
    `);

    res.json({
      success: true,
      data: {
        bounties: result.rows.map(b => ({
          ...b,
          isMyBounty: b.placed_by_player_id === playerId,
          isOnMe: b.target_player_id === playerId,
          timeRemaining: Math.max(0, new Date(b.expires_at).getTime() - Date.now())
        })),
        totalActiveBounties: parseInt(totalResult.rows[0].count),
        totalBountyPool: parseInt(totalResult.rows[0].total) || 0
      }
    });
  } catch (error) {
    console.error('Error getting bounty board:', error);
    res.status(500).json({ success: false, error: 'Failed to get bounty board' });
  }
});

// GET /api/bounties/my - My bounties (placed and on me)
router.get('/my', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Bounties on me
    const onMeResult = await pool.query(`
      SELECT
        b.*,
        CASE WHEN b.is_anonymous THEN NULL ELSE placer.username END as placed_by_username
      FROM bounties b
      LEFT JOIN players placer ON b.placed_by_player_id = placer.id
      WHERE b.target_player_id = $1 AND b.status = 'active' AND b.expires_at > NOW()
      ORDER BY b.amount DESC
    `, [playerId]);

    // Bounties I placed
    const placedResult = await pool.query(`
      SELECT
        b.*,
        p.username as target_username,
        p.level as target_level
      FROM bounties b
      JOIN players p ON b.target_player_id = p.id
      WHERE b.placed_by_player_id = $1
      ORDER BY b.created_at DESC
      LIMIT 20
    `, [playerId]);

    // Total bounty on my head
    const totalOnMe = onMeResult.rows.reduce((sum, b) => sum + b.amount, 0);

    // Bounties I've claimed
    const claimedResult = await pool.query(`
      SELECT
        b.*,
        p.username as target_username
      FROM bounties b
      JOIN players p ON b.target_player_id = p.id
      WHERE b.claimed_by_player_id = $1
      ORDER BY b.claimed_at DESC
      LIMIT 10
    `, [playerId]);

    res.json({
      success: true,
      data: {
        bountiesOnMe: onMeResult.rows,
        totalBountyOnMe: totalOnMe,
        bountiesPlaced: placedResult.rows,
        bountiesClaimed: claimedResult.rows
      }
    });
  } catch (error) {
    console.error('Error getting my bounties:', error);
    res.status(500).json({ success: false, error: 'Failed to get bounties' });
  }
});

// POST /api/bounties/place - Place a bounty
// Validation ensures targetId and amount are valid
router.post('/place', authMiddleware, validate(placeBountySchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { targetId, amount, reason, anonymous } = req.body;
    // Validation already ensures targetId and amount are valid

    if (targetId === playerId) {
      return res.status(400).json({ success: false, error: 'Cannot place bounty on yourself' });
    }

    // Check target exists
    const targetResult = await pool.query('SELECT id, username FROM players WHERE id = $1', [targetId]);
    if (targetResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Target not found' });
    }

    // Calculate total cost (with anonymous fee)
    const anonymousFee = anonymous ? Math.floor(amount * BOUNTY_CONFIG.anonymousFeePercent / 100) : 0;
    const totalCost = amount + anonymousFee;

    // Check player has funds
    const playerResult = await pool.query('SELECT cash FROM players WHERE id = $1', [playerId]);
    if (playerResult.rows[0].cash < totalCost) {
      return res.status(400).json({ success: false, error: 'Insufficient funds' });
    }

    await pool.query('BEGIN');

    // Deduct cash
    await pool.query('UPDATE players SET cash = cash - $1 WHERE id = $2', [totalCost, playerId]);

    // Check for existing active bounty on target
    const existingBounty = await pool.query(`
      SELECT id, amount FROM bounties
      WHERE target_player_id = $1 AND status = 'active' AND expires_at > NOW()
      ORDER BY amount DESC LIMIT 1
    `, [targetId]);

    let bountyId: number;

    if (existingBounty.rows.length > 0) {
      // Add to existing bounty
      bountyId = existingBounty.rows[0].id;
      await pool.query(`
        UPDATE bounties SET amount = amount + $1 WHERE id = $2
      `, [amount, bountyId]);

      // Record contribution
      await pool.query(`
        INSERT INTO bounty_contributions (bounty_id, contributor_id, amount, is_anonymous)
        VALUES ($1, $2, $3, $4)
      `, [bountyId, anonymous ? null : playerId, amount, anonymous]);
    } else {
      // Create new bounty
      const expiresAt = new Date(Date.now() + BOUNTY_CONFIG.expiryDays * 24 * 60 * 60 * 1000);

      const bountyResult = await pool.query(`
        INSERT INTO bounties (target_player_id, placed_by_player_id, amount, reason, is_anonymous, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [targetId, anonymous ? null : playerId, amount, reason || 'Wanted', anonymous, expiresAt]);

      bountyId = bountyResult.rows[0].id;

      // Record initial contribution
      await pool.query(`
        INSERT INTO bounty_contributions (bounty_id, contributor_id, amount, is_anonymous)
        VALUES ($1, $2, $3, $4)
      `, [bountyId, anonymous ? null : playerId, amount, anonymous]);

      // Update target's bounty count
      await pool.query(`
        UPDATE players SET bounties_on_head = bounties_on_head + 1 WHERE id = $1
      `, [targetId]);
    }

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Bounty of $${amount.toLocaleString()} placed on ${targetResult.rows[0].username}`,
        bountyId,
        totalCost,
        anonymousFee,
        expiresAt: new Date(Date.now() + BOUNTY_CONFIG.expiryDays * 24 * 60 * 60 * 1000)
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error placing bounty:', error);
    res.status(500).json({ success: false, error: 'Failed to place bounty' });
  }
});

// POST /api/bounties/:id/claim - Claim a bounty (after killing target)
// Validation ensures bounty ID is a positive integer
router.post('/:id/claim', authMiddleware, validateParams(bountyIdParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const bountyId = parseInt(req.params.id); // Already validated

    // Get bounty
    const bountyResult = await pool.query(`
      SELECT b.*, p.username as target_username
      FROM bounties b
      JOIN players p ON b.target_player_id = p.id
      WHERE b.id = $1 AND b.status = 'active'
    `, [bountyId]);

    if (bountyResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Bounty not found or already claimed' });
    }

    const bounty = bountyResult.rows[0];

    if (bounty.target_player_id === playerId) {
      return res.status(400).json({ success: false, error: 'Cannot claim bounty on yourself' });
    }

    // Verify kill happened recently (within last hour)
    const killCheck = await pool.query(`
      SELECT id FROM player_kill_log
      WHERE killer_id = $1 AND victim_id = $2 AND killed_at > NOW() - INTERVAL '1 hour'
      LIMIT 1
    `, [playerId, bounty.target_player_id]);

    if (killCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'You must kill the target first to claim this bounty'
      });
    }

    await pool.query('BEGIN');

    // Mark bounty as claimed
    await pool.query(`
      UPDATE bounties
      SET status = 'claimed', claimed_by_player_id = $1, claimed_at = NOW()
      WHERE id = $2
    `, [playerId, bountyId]);

    // Pay the bounty hunter
    await pool.query(`
      UPDATE players SET cash = cash + $1, bounties_claimed = bounties_claimed + 1 WHERE id = $2
    `, [bounty.amount, playerId]);

    // Update target's bounty count
    await pool.query(`
      UPDATE players SET bounties_on_head = GREATEST(0, bounties_on_head - 1) WHERE id = $1
    `, [bounty.target_player_id]);

    // Update kill log to mark as bounty kill
    await pool.query(`
      UPDATE player_kill_log SET was_bounty_kill = true
      WHERE killer_id = $1 AND victim_id = $2 AND killed_at > NOW() - INTERVAL '1 hour'
    `, [playerId, bounty.target_player_id]);

    // Update combat history
    await pool.query(`
      UPDATE combat_history
      SET was_bounty_kill = true, bounty_claimed = $1
      WHERE attacker_id = $2 AND defender_id = $3
        AND occurred_at > NOW() - INTERVAL '1 hour'
        AND winner_id = $2
    `, [bounty.amount, playerId, bounty.target_player_id]);

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Bounty claimed! You received $${bounty.amount.toLocaleString()}`,
        amount: bounty.amount,
        target: bounty.target_username
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error claiming bounty:', error);
    res.status(500).json({ success: false, error: 'Failed to claim bounty' });
  }
});

// POST /api/bounties/:id/payoff - Pay off your own bounty
// Validation ensures bounty ID is a positive integer
router.post('/:id/payoff', authMiddleware, validateParams(bountyIdParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const bountyId = parseInt(req.params.id); // Already validated

    // Get bounty
    const bountyResult = await pool.query(`
      SELECT * FROM bounties WHERE id = $1 AND status = 'active'
    `, [bountyId]);

    if (bountyResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Bounty not found' });
    }

    const bounty = bountyResult.rows[0];

    if (bounty.target_player_id !== playerId) {
      return res.status(400).json({ success: false, error: 'This bounty is not on you' });
    }

    // Calculate payoff cost (2x the bounty amount)
    const payoffCost = bounty.amount * BOUNTY_CONFIG.payOffMultiplier;

    // Check player funds
    const playerResult = await pool.query('SELECT cash FROM players WHERE id = $1', [playerId]);
    if (playerResult.rows[0].cash < payoffCost) {
      return res.status(400).json({
        success: false,
        error: `Insufficient funds. Pay off costs $${payoffCost.toLocaleString()} (2x bounty amount)`
      });
    }

    await pool.query('BEGIN');

    // Deduct cash
    await pool.query('UPDATE players SET cash = cash - $1 WHERE id = $2', [payoffCost, playerId]);

    // Mark bounty as paid off
    await pool.query(`
      UPDATE bounties SET status = 'paid_off' WHERE id = $1
    `, [bountyId]);

    // Return original amount to placer (if not anonymous)
    if (bounty.placed_by_player_id) {
      await pool.query(`
        UPDATE players SET cash = cash + $1 WHERE id = $2
      `, [bounty.amount, bounty.placed_by_player_id]);
    }

    // Update bounty count
    await pool.query(`
      UPDATE players SET bounties_on_head = GREATEST(0, bounties_on_head - 1) WHERE id = $1
    `, [playerId]);

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: 'Bounty paid off successfully',
        cost: payoffCost,
        originalAmount: bounty.amount
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error paying off bounty:', error);
    res.status(500).json({ success: false, error: 'Failed to pay off bounty' });
  }
});

// POST /api/bounties/:id/cancel - Cancel bounty you placed (partial refund)
// Validation ensures bounty ID is a positive integer
router.post('/:id/cancel', authMiddleware, validateParams(bountyIdParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const bountyId = parseInt(req.params.id); // Already validated

    const bountyResult = await pool.query(`
      SELECT * FROM bounties WHERE id = $1 AND status = 'active'
    `, [bountyId]);

    if (bountyResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Bounty not found' });
    }

    const bounty = bountyResult.rows[0];

    if (bounty.placed_by_player_id !== playerId) {
      return res.status(400).json({ success: false, error: 'You did not place this bounty' });
    }

    // 50% refund for cancellation
    const refund = Math.floor(bounty.amount * 0.5);

    await pool.query('BEGIN');

    await pool.query(`
      UPDATE bounties SET status = 'cancelled' WHERE id = $1
    `, [bountyId]);

    await pool.query(`
      UPDATE players SET cash = cash + $1 WHERE id = $2
    `, [refund, playerId]);

    await pool.query(`
      UPDATE players SET bounties_on_head = GREATEST(0, bounties_on_head - 1) WHERE id = $1
    `, [bounty.target_player_id]);

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: 'Bounty cancelled',
        refund,
        originalAmount: bounty.amount
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error cancelling bounty:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel bounty' });
  }
});

// GET /api/bounties/hitmen - Get available hitmen
router.get('/hitmen', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT * FROM hitmen WHERE is_active = true ORDER BY skill_level ASC
    `);

    res.json({
      success: true,
      data: { hitmen: result.rows }
    });
  } catch (error) {
    console.error('Error getting hitmen:', error);
    res.status(500).json({ success: false, error: 'Failed to get hitmen' });
  }
});

// POST /api/bounties/hire-hitman - Hire hitman for a bounty
// Validation ensures bountyId and hitmanId are valid
router.post('/hire-hitman', authMiddleware, validate(hireHitmanSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { bountyId, hitmanId } = req.body;
    // Validation already ensures bountyId and hitmanId are valid

    // Get bounty
    const bountyResult = await pool.query(`
      SELECT b.*, p.username as target_username
      FROM bounties b
      JOIN players p ON b.target_player_id = p.id
      WHERE b.id = $1 AND b.status = 'active'
    `, [bountyId]);

    if (bountyResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Bounty not found' });
    }

    const bounty = bountyResult.rows[0];

    // Get hitman
    const hitmanResult = await pool.query(`
      SELECT * FROM hitmen WHERE id = $1 AND is_active = true
    `, [hitmanId]);

    if (hitmanResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Hitman not found' });
    }

    const hitman = hitmanResult.rows[0];

    // Check bounty is large enough for this hitman
    if (bounty.amount < hitman.min_bounty_amount) {
      return res.status(400).json({
        success: false,
        error: `This hitman requires bounties of at least $${hitman.min_bounty_amount.toLocaleString()}`
      });
    }

    // Calculate hire cost
    const hireCost = Math.floor(bounty.amount * hitman.price_multiplier * 0.1); // 10% of bounty * multiplier

    // Check player funds
    const playerResult = await pool.query('SELECT cash FROM players WHERE id = $1', [playerId]);
    if (playerResult.rows[0].cash < hireCost) {
      return res.status(400).json({
        success: false,
        error: `Insufficient funds. Hire cost: $${hireCost.toLocaleString()}`
      });
    }

    await pool.query('BEGIN');

    // Deduct cost
    await pool.query('UPDATE players SET cash = cash - $1 WHERE id = $2', [hireCost, playerId]);

    // Attempt the hit
    const successRoll = Math.random() * 100;
    const success = successRoll < hitman.success_rate;

    // Get target stats
    const targetStats = await pool.query(`
      SELECT health, defense, level FROM players WHERE id = $1
    `, [bounty.target_player_id]);

    const target = targetStats.rows[0];

    // Check if target has bodyguard
    const bodyguardResult = await pool.query(`
      SELECT * FROM player_bodyguards
      WHERE player_id = $1 AND is_active = true AND expires_at > NOW()
    `, [bounty.target_player_id]);

    let bodyguardBlocked = false;
    if (bodyguardResult.rows.length > 0) {
      const bodyguard = bodyguardResult.rows[0];
      const blockChance = bodyguard.protection_level * 15;
      bodyguardBlocked = Math.random() * 100 < blockChance;
    }

    let result: any;

    if (bodyguardBlocked) {
      result = {
        success: false,
        message: `${hitman.name}'s attempt was blocked by the target's bodyguard!`,
        damageDealt: 0,
        targetSurvived: true
      };
    } else if (success) {
      // Calculate damage
      const baseDamage = hitman.attack * (0.8 + Math.random() * 0.4);
      const damage = Math.floor(baseDamage * (1 - target.defense / (target.defense + 50)));
      const newHealth = Math.max(0, target.health - damage);

      await pool.query('UPDATE players SET health = $1 WHERE id = $2', [newHealth, bounty.target_player_id]);

      if (newHealth <= 0) {
        // Target killed - bounty claimed by hitman (money goes to placer)
        await pool.query(`
          UPDATE bounties SET status = 'claimed', claimed_at = NOW() WHERE id = $1
        `, [bountyId]);

        // Hospitalize target
        const releaseAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await pool.query(`
          UPDATE players SET is_hospitalized = true, hospital_release_at = $1 WHERE id = $2
        `, [releaseAt, bounty.target_player_id]);

        result = {
          success: true,
          message: `${hitman.name} successfully eliminated ${bounty.target_username}!`,
          damageDealt: damage,
          targetSurvived: false,
          bountyCompleted: true
        };
      } else {
        result = {
          success: true,
          message: `${hitman.name} wounded ${bounty.target_username} for ${damage} damage!`,
          damageDealt: damage,
          targetSurvived: true
        };
      }
    } else {
      result = {
        success: false,
        message: `${hitman.name} failed to reach the target.`,
        damageDealt: 0,
        targetSurvived: true
      };
    }

    // Record attempt
    await pool.query(`
      INSERT INTO hitman_attempts
        (hitman_id, target_player_id, bounty_id, was_successful, damage_dealt, target_survived)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [hitmanId, bounty.target_player_id, bountyId, success && !bodyguardBlocked, result.damageDealt, result.targetSurvived]);

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        ...result,
        hitman: hitman.name,
        cost: hireCost
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error hiring hitman:', error);
    res.status(500).json({ success: false, error: 'Failed to hire hitman' });
  }
});

// GET /api/bounties/bodyguards - Get available bodyguard types
router.get('/bodyguards', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const bodyguards = [
      { type: 'street_muscle', name: 'Street Muscle', protectionLevel: 1, dailyCost: 500, description: 'Basic protection' },
      { type: 'professional_guard', name: 'Professional Guard', protectionLevel: 2, dailyCost: 2000, description: 'Trained security' },
      { type: 'ex_military', name: 'Ex-Military', protectionLevel: 3, dailyCost: 5000, description: 'Combat veteran' },
      { type: 'elite_protection', name: 'Elite Protection', protectionLevel: 4, dailyCost: 15000, description: 'Top tier security detail' }
    ];

    res.json({
      success: true,
      data: { bodyguards }
    });
  } catch (error) {
    console.error('Error getting bodyguards:', error);
    res.status(500).json({ success: false, error: 'Failed to get bodyguards' });
  }
});

// POST /api/bounties/hire-bodyguard - Hire bodyguard protection
// Validation ensures bodyguardType and days are valid
router.post('/hire-bodyguard', authMiddleware, validate(hireBodyguardSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { bodyguardType, days } = req.body;
    // Validation already ensures bodyguardType and days are valid

    const bodyguards: Record<string, any> = {
      street_muscle: { name: 'Street Muscle', protectionLevel: 1, dailyCost: 500 },
      professional_guard: { name: 'Professional Guard', protectionLevel: 2, dailyCost: 2000 },
      ex_military: { name: 'Ex-Military', protectionLevel: 3, dailyCost: 5000 },
      elite_protection: { name: 'Elite Protection', protectionLevel: 4, dailyCost: 15000 }
    };

    const daysCount = days; // Already validated and defaulted to 1
    const bodyguard = bodyguards[bodyguardType];
    const totalCost = bodyguard.dailyCost * daysCount;

    // Check funds
    const playerResult = await pool.query('SELECT cash FROM players WHERE id = $1', [playerId]);
    if (playerResult.rows[0].cash < totalCost) {
      return res.status(400).json({ success: false, error: 'Insufficient funds' });
    }

    await pool.query('BEGIN');

    await pool.query('UPDATE players SET cash = cash - $1 WHERE id = $2', [totalCost, playerId]);

    const expiresAt = new Date(Date.now() + daysCount * 24 * 60 * 60 * 1000);

    await pool.query(`
      INSERT INTO player_bodyguards (player_id, bodyguard_type, name, protection_level, daily_cost, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (player_id, bodyguard_type) DO UPDATE SET
        expires_at = GREATEST(player_bodyguards.expires_at, $6),
        is_active = true
    `, [playerId, bodyguardType, bodyguard.name, bodyguard.protectionLevel, bodyguard.dailyCost, expiresAt]);

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Hired ${bodyguard.name} for ${daysCount} days`,
        cost: totalCost,
        expiresAt
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error hiring bodyguard:', error);
    res.status(500).json({ success: false, error: 'Failed to hire bodyguard' });
  }
});

// Process expired bounties
export async function processExpiredBounties(): Promise<void> {
  try {
    const expired = await pool.query(`
      UPDATE bounties
      SET status = 'expired'
      WHERE status = 'active' AND expires_at < NOW()
      RETURNING target_player_id
    `);

    // Update bounty counts
    for (const bounty of expired.rows) {
      await pool.query(`
        UPDATE players SET bounties_on_head = GREATEST(0, bounties_on_head - 1)
        WHERE id = $1
      `, [bounty.target_player_id]);
    }

    if (expired.rowCount && expired.rowCount > 0) {
      console.log(`Expired ${expired.rowCount} bounties`);
    }
  } catch (error) {
    console.error('Error processing expired bounties:', error);
  }
}

// Process hitman attempts on high bounties
export async function processHitmanAttempts(): Promise<void> {
  try {
    // Get high bounties that haven't had a hitman attempt recently
    // SECURITY: Use make_interval for parameterized interval
    const bounties = await pool.query(`
      SELECT b.* FROM bounties b
      WHERE b.status = 'active'
        AND b.amount >= $1
        AND NOT EXISTS (
          SELECT 1 FROM hitman_attempts ha
          WHERE ha.bounty_id = b.id
            AND ha.attempted_at > NOW() - make_interval(hours => $2)
        )
    `, [BOUNTY_CONFIG.minBountyForHitman, BOUNTY_CONFIG.hitmanAttemptHours]);

    for (const bounty of bounties.rows) {
      // Random chance for hitman to attempt
      if (Math.random() < 0.3) { // 30% chance per cycle
        // Get random hitman appropriate for bounty size
        const hitman = await pool.query(`
          SELECT * FROM hitmen
          WHERE is_active = true AND min_bounty_amount <= $1
          ORDER BY RANDOM() LIMIT 1
        `, [bounty.amount]);

        if (hitman.rows.length > 0) {
          // Simulate attempt (simplified version)
          const success = Math.random() * 100 < hitman.rows[0].success_rate * 0.5; // Halved for auto-attempts

          await pool.query(`
            INSERT INTO hitman_attempts
              (hitman_id, target_player_id, bounty_id, was_successful, target_survived)
            VALUES ($1, $2, $3, $4, true)
          `, [hitman.rows[0].id, bounty.target_player_id, bounty.id, success]);

          if (success) {
            // Deal some damage
            const damage = Math.floor(hitman.rows[0].attack * 0.5);
            await pool.query(`
              UPDATE players SET health = GREATEST(1, health - $1) WHERE id = $2
            `, [damage, bounty.target_player_id]);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error processing hitman attempts:', error);
  }
}

export default router;
