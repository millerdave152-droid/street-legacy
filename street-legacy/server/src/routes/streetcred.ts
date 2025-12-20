import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Daily login rewards (days 1-7)
const LOGIN_REWARDS = [1, 2, 3, 5, 7, 10, 15];

// Spending costs
const SPENDING_COSTS = {
  skipJail: 10, // per minute
  resetCooldown: 5,
  extraMissionSlot: 20,
  crewNameChange: 100
};

// GET /api/cred/balance - Get street cred balance and transaction history
router.get('/balance', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const playerResult = await pool.query(
      `SELECT street_cred, last_login_date, login_streak FROM players WHERE id = $1`,
      [playerId]
    );

    const player = playerResult.rows[0];

    // Get recent transactions
    const transactionsResult = await pool.query(
      `SELECT * FROM street_cred_transactions
       WHERE player_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [playerId]
    );

    res.json({
      success: true,
      data: {
        balance: player.street_cred,
        loginStreak: player.login_streak,
        lastLoginDate: player.last_login_date,
        transactions: transactionsResult.rows,
        spendingCosts: SPENDING_COSTS
      }
    });
  } catch (error) {
    console.error('Get cred balance error:', error);
    res.status(500).json({ success: false, error: 'Failed to get balance' });
  }
});

// POST /api/cred/claim-daily - Claim daily login reward
router.post('/claim-daily', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const today = new Date().toISOString().split('T')[0];

    const playerResult = await pool.query(
      `SELECT last_login_date, login_streak FROM players WHERE id = $1`,
      [playerId]
    );

    const player = playerResult.rows[0];
    const lastLogin = player.last_login_date;

    // Check if already claimed today
    if (lastLogin === today) {
      res.status(400).json({ success: false, error: 'Already claimed today' });
      return;
    }

    // Calculate streak
    let newStreak = 1;
    if (lastLogin) {
      const lastDate = new Date(lastLogin);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive day
        newStreak = Math.min(player.login_streak + 1, 7);
      }
      // If diffDays > 1, streak resets to 1
    }

    // Get reward (0-indexed array, streak is 1-7)
    const reward = LOGIN_REWARDS[newStreak - 1];

    // Update player
    await pool.query(
      `UPDATE players SET
        last_login_date = $1,
        login_streak = $2,
        street_cred = street_cred + $3
       WHERE id = $4`,
      [today, newStreak, reward, playerId]
    );

    // Log transaction
    await pool.query(
      `INSERT INTO street_cred_transactions (player_id, amount, type, description)
       VALUES ($1, $2, 'bonus', $3)`,
      [playerId, reward, `Daily login reward (Day ${newStreak})`]
    );

    res.json({
      success: true,
      data: {
        reward,
        newStreak,
        nextReward: newStreak < 7 ? LOGIN_REWARDS[newStreak] : LOGIN_REWARDS[6],
        message: `Claimed ${reward} Street Cred! (Day ${newStreak} streak)`
      }
    });
  } catch (error) {
    console.error('Claim daily error:', error);
    res.status(500).json({ success: false, error: 'Failed to claim daily reward' });
  }
});

// POST /api/cred/spend/skip-jail - Skip jail time
router.post('/spend/skip-jail', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const playerResult = await pool.query(
      `SELECT street_cred, in_jail, jail_release_at FROM players WHERE id = $1`,
      [playerId]
    );

    const player = playerResult.rows[0];

    if (!player.in_jail || !player.jail_release_at) {
      res.status(400).json({ success: false, error: 'Not in jail' });
      return;
    }

    const releaseAt = new Date(player.jail_release_at);
    const now = new Date();
    const minutesRemaining = Math.ceil((releaseAt.getTime() - now.getTime()) / (1000 * 60));

    if (minutesRemaining <= 0) {
      res.status(400).json({ success: false, error: 'Already released' });
      return;
    }

    const cost = minutesRemaining * SPENDING_COSTS.skipJail;

    if (player.street_cred < cost) {
      res.status(400).json({ success: false, error: `Not enough cred (need ${cost})` });
      return;
    }

    // Release from jail and deduct cred
    await pool.query(
      `UPDATE players SET
        in_jail = FALSE,
        jail_release_at = NULL,
        street_cred = street_cred - $1
       WHERE id = $2`,
      [cost, playerId]
    );

    // Log transaction
    await pool.query(
      `INSERT INTO street_cred_transactions (player_id, amount, type, description)
       VALUES ($1, $2, 'spend', $3)`,
      [playerId, -cost, `Skipped ${minutesRemaining} minutes jail time`]
    );

    res.json({
      success: true,
      data: {
        cost,
        message: `Paid ${cost} Street Cred to escape jail!`
      }
    });
  } catch (error) {
    console.error('Skip jail error:', error);
    res.status(500).json({ success: false, error: 'Failed to skip jail' });
  }
});

// POST /api/cred/spend/reset-cooldown - Reset a crime cooldown
router.post('/spend/reset-cooldown', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { crimeId } = req.body;

    if (!crimeId) {
      res.status(400).json({ success: false, error: 'Crime ID required' });
      return;
    }

    const playerResult = await pool.query(
      `SELECT street_cred FROM players WHERE id = $1`,
      [playerId]
    );

    const player = playerResult.rows[0];
    const cost = SPENDING_COSTS.resetCooldown;

    if (player.street_cred < cost) {
      res.status(400).json({ success: false, error: `Not enough cred (need ${cost})` });
      return;
    }

    // Check if cooldown exists
    const cooldownResult = await pool.query(
      `SELECT available_at FROM player_cooldowns
       WHERE player_id = $1 AND crime_id = $2 AND available_at > NOW()`,
      [playerId, crimeId]
    );

    if (cooldownResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'No active cooldown for this crime' });
      return;
    }

    // Reset cooldown and deduct cred
    await pool.query(
      `DELETE FROM player_cooldowns WHERE player_id = $1 AND crime_id = $2`,
      [playerId, crimeId]
    );

    await pool.query(
      `UPDATE players SET street_cred = street_cred - $1 WHERE id = $2`,
      [cost, playerId]
    );

    // Log transaction
    await pool.query(
      `INSERT INTO street_cred_transactions (player_id, amount, type, description)
       VALUES ($1, $2, 'spend', 'Reset crime cooldown')`,
      [playerId, -cost]
    );

    res.json({
      success: true,
      data: {
        cost,
        message: `Paid ${cost} Street Cred to reset cooldown!`
      }
    });
  } catch (error) {
    console.error('Reset cooldown error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset cooldown' });
  }
});

// Helper function to award street cred (used by other modules)
export async function awardStreetCred(
  playerId: number,
  amount: number,
  description: string
): Promise<void> {
  try {
    await pool.query(
      `UPDATE players SET street_cred = street_cred + $1 WHERE id = $2`,
      [amount, playerId]
    );

    await pool.query(
      `INSERT INTO street_cred_transactions (player_id, amount, type, description)
       VALUES ($1, $2, 'bonus', $3)`,
      [playerId, amount, description]
    );
  } catch (error) {
    console.error('Award street cred error:', error);
  }
}

// Helper to spend street cred
export async function spendStreetCred(
  playerId: number,
  amount: number,
  description: string
): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE players SET street_cred = street_cred - $1
       WHERE id = $2 AND street_cred >= $1
       RETURNING id`,
      [amount, playerId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    await pool.query(
      `INSERT INTO street_cred_transactions (player_id, amount, type, description)
       VALUES ($1, $2, 'spend', $3)`,
      [playerId, -amount, description]
    );

    return true;
  } catch (error) {
    console.error('Spend street cred error:', error);
    return false;
  }
}

export default router;
