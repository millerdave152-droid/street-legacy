import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const robAttemptSchema = z.object({
  body: z.object({
    targetId: z.coerce.number().int().positive('Invalid target ID')
  })
});

router.use(authMiddleware);

const ROB_COOLDOWN_HOURS = 4;
const MIN_LEVEL_TO_ROB = 3;
const ROB_PERCENTAGE_MIN = 5;
const ROB_PERCENTAGE_MAX = 20;
const PROTECTED_CASH_AMOUNT = 500; // Players always keep at least this much

// GET /api/rob/targets - Get list of players you can rob
router.get('/targets', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get current player
    const playerResult = await pool.query(
      `SELECT level, current_district FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    if (player.level < MIN_LEVEL_TO_ROB) {
      res.json({
        success: true,
        data: {
          targets: [],
          message: `Must be level ${MIN_LEVEL_TO_ROB} to rob other players`
        }
      });
      return;
    }

    if (!player.current_district) {
      res.json({
        success: true,
        data: {
          targets: [],
          message: 'Must be in a district to rob'
        }
      });
      return;
    }

    // Get potential targets in same district, excluding self
    // Only show players with cash above protected amount, not in jail
    const targetsResult = await pool.query(
      `SELECT p.id, p.username, p.level, p.cash, p.crew_id, c.tag as crew_tag,
              rc.available_at as cooldown_until
       FROM players p
       LEFT JOIN crews c ON p.crew_id = c.id
       LEFT JOIN rob_cooldowns rc ON rc.attacker_id = $1 AND rc.target_id = p.id
       WHERE p.current_district = $2
         AND p.id != $1
         AND p.cash > $3
         AND p.in_jail = false
       ORDER BY p.cash DESC
       LIMIT 20`,
      [playerId, player.current_district, PROTECTED_CASH_AMOUNT]
    );

    res.json({
      success: true,
      data: {
        targets: targetsResult.rows.map(t => ({
          id: t.id,
          username: t.username,
          level: t.level,
          estimatedCash: t.cash > 10000 ? 'Loaded' : t.cash > 1000 ? 'Has some cash' : 'Light pockets',
          crewTag: t.crew_tag,
          onCooldown: t.cooldown_until && new Date(t.cooldown_until) > new Date(),
          cooldownUntil: t.cooldown_until
        }))
      }
    });
  } catch (error) {
    console.error('Get targets error:', error);
    res.status(500).json({ success: false, error: 'Failed to get targets' });
  }
});

// POST /api/rob/attempt - Attempt to rob another player
// Validation ensures targetId is a positive integer
router.post('/attempt', validate(robAttemptSchema), async (req: AuthRequest, res: Response) => {
  try {
    const attackerId = req.player!.id;
    const { targetId } = req.body;
    // Validation already ensures targetId is valid

    if (attackerId === targetId) {
      res.status(400).json({ success: false, error: 'Cannot rob yourself' });
      return;
    }

    // Get attacker
    const attackerResult = await pool.query(
      `SELECT p.*, d.police_presence
       FROM players p
       LEFT JOIN districts d ON p.current_district = d.id
       WHERE p.id = $1`,
      [attackerId]
    );
    const attacker = attackerResult.rows[0];

    if (attacker.level < MIN_LEVEL_TO_ROB) {
      res.status(400).json({ success: false, error: `Must be level ${MIN_LEVEL_TO_ROB} to rob` });
      return;
    }

    if (attacker.in_jail) {
      res.status(400).json({ success: false, error: 'Cannot rob while in jail' });
      return;
    }

    if (!attacker.current_district) {
      res.status(400).json({ success: false, error: 'Must be in a district' });
      return;
    }

    if (attacker.nerve < 20) {
      res.status(400).json({ success: false, error: 'Need at least 20 nerve to rob' });
      return;
    }

    // Check cooldown
    const cooldownResult = await pool.query(
      `SELECT available_at FROM rob_cooldowns
       WHERE attacker_id = $1 AND target_id = $2 AND available_at > NOW()`,
      [attackerId, targetId]
    );

    if (cooldownResult.rows.length > 0) {
      res.status(400).json({
        success: false,
        error: 'You recently robbed this player',
        cooldownUntil: cooldownResult.rows[0].available_at
      });
      return;
    }

    // Get target
    const targetResult = await pool.query(
      `SELECT id, username, level, cash, current_district, in_jail, crew_id
       FROM players WHERE id = $1`,
      [targetId]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Target not found' });
      return;
    }

    const target = targetResult.rows[0];

    if (target.current_district !== attacker.current_district) {
      res.status(400).json({ success: false, error: 'Target is not in your district' });
      return;
    }

    if (target.in_jail) {
      res.status(400).json({ success: false, error: 'Target is in jail' });
      return;
    }

    if (target.cash <= PROTECTED_CASH_AMOUNT) {
      res.status(400).json({ success: false, error: 'Target has no cash worth stealing (protected amount)' });
      return;
    }

    // Calculate success chance
    // Base 50%, +5% per level above target, -5% per level below
    // Reduced by police presence
    const levelDiff = attacker.level - target.level;
    let successChance = 50 + (levelDiff * 5);
    successChance = Math.max(10, Math.min(90, successChance)); // Clamp 10-90%

    // Apply equipment bonuses (get attacker's equipped items)
    const equipResult = await pool.query(
      `SELECT i.bonus_value FROM player_inventory pi
       JOIN items i ON pi.item_id = i.id
       WHERE pi.player_id = $1 AND pi.equipped = true AND i.bonus_type = 'success_rate'`,
      [attackerId]
    );
    for (const item of equipResult.rows) {
      successChance += item.bonus_value;
    }

    // Reduce by police presence
    successChance = successChance * (1 - (attacker.police_presence || 5) / 100);

    // Roll for success
    const roll = Math.random() * 100;
    const success = roll < successChance;

    // Deduct nerve
    await pool.query(`UPDATE players SET nerve = nerve - 20 WHERE id = $1`, [attackerId]);

    // Set cooldown regardless of outcome
    // SECURITY: Use make_interval for parameterized interval
    await pool.query(
      `INSERT INTO rob_cooldowns (attacker_id, target_id, available_at)
       VALUES ($1, $2, NOW() + make_interval(hours => $3))
       ON CONFLICT (attacker_id, target_id)
       DO UPDATE SET available_at = NOW() + make_interval(hours => $3)`,
      [attackerId, targetId, ROB_COOLDOWN_HOURS]
    );

    let stolenAmount = 0;
    let caught = false;
    let jailUntil: Date | null = null;

    if (success) {
      // Calculate stolen amount (5-20% of target's UNPROTECTED cash)
      // Players always keep at least PROTECTED_CASH_AMOUNT
      const stealableCash = target.cash - PROTECTED_CASH_AMOUNT;
      const stealPercentage = ROB_PERCENTAGE_MIN +
        Math.random() * (ROB_PERCENTAGE_MAX - ROB_PERCENTAGE_MIN);
      stolenAmount = Math.floor(stealableCash * (stealPercentage / 100));
      stolenAmount = Math.min(stolenAmount, stealableCash); // Can't steal protected amount

      // Apply payout bonus from equipment
      const payoutResult = await pool.query(
        `SELECT SUM(i.bonus_value) as total FROM player_inventory pi
         JOIN items i ON pi.item_id = i.id
         WHERE pi.player_id = $1 AND pi.equipped = true AND i.bonus_type = 'payout'`,
        [attackerId]
      );
      if (payoutResult.rows[0].total) {
        stolenAmount = Math.floor(stolenAmount * (1 + payoutResult.rows[0].total / 100));
      }

      // Transfer cash
      await pool.query(`UPDATE players SET cash = cash + $1 WHERE id = $2`, [stolenAmount, attackerId]);
      await pool.query(`UPDATE players SET cash = cash - $1 WHERE id = $2`, [stolenAmount, targetId]);

      // Notify target
      await pool.query(
        `INSERT INTO notifications (player_id, type, message, data)
         VALUES ($1, 'robbed', $2, $3)`,
        [
          targetId,
          `You were robbed by ${attacker.username} for $${stolenAmount}!`,
          JSON.stringify({ attackerId, attackerName: attacker.username, amount: stolenAmount })
        ]
      );
    } else {
      // 30% chance of getting caught when failing
      const catchChance = 0.3 + (attacker.police_presence || 5) / 100;
      caught = Math.random() < catchChance;

      if (caught) {
        jailUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes jail
        await pool.query(
          `UPDATE players SET in_jail = true, jail_release_at = $1 WHERE id = $2`,
          [jailUntil, attackerId]
        );
      }

      // Notify target of failed attempt
      await pool.query(
        `INSERT INTO notifications (player_id, type, message, data)
         VALUES ($1, 'rob_attempt', $2, $3)`,
        [
          targetId,
          `${attacker.username} tried to rob you but failed!`,
          JSON.stringify({ attackerId, attackerName: attacker.username, caught })
        ]
      );
    }

    res.json({
      success: true,
      data: {
        robSuccess: success,
        stolenAmount,
        caught,
        jailUntil,
        targetName: target.username,
        message: success
          ? `You robbed ${target.username} for $${stolenAmount}!`
          : caught
            ? `Failed to rob ${target.username} and got caught!`
            : `Failed to rob ${target.username}, but got away!`
      }
    });
  } catch (error) {
    console.error('Rob attempt error:', error);
    res.status(500).json({ success: false, error: 'Failed to attempt robbery' });
  }
});

// GET /api/rob/notifications - Get robbery notifications
router.get('/notifications', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const notificationsResult = await pool.query(
      `SELECT id, type, message, data, read, created_at
       FROM notifications
       WHERE player_id = $1 AND type IN ('robbed', 'rob_attempt')
       ORDER BY created_at DESC
       LIMIT 20`,
      [playerId]
    );

    // Mark as read
    await pool.query(
      `UPDATE notifications SET read = true
       WHERE player_id = $1 AND type IN ('robbed', 'rob_attempt') AND read = false`,
      [playerId]
    );

    res.json({
      success: true,
      data: {
        notifications: notificationsResult.rows.map(n => ({
          id: n.id,
          type: n.type,
          message: n.message,
          data: n.data,
          read: n.read,
          createdAt: n.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, error: 'Failed to get notifications' });
  }
});

export default router;
