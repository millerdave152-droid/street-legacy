import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

const MIN_LEVEL_FOR_PRESTIGE = 15;
const MIN_EARNINGS_FOR_PRESTIGE = 100000;

// Prestige bonuses per level (cumulative)
const PRESTIGE_BONUSES = {
  successRate: 2,      // +2% per prestige level
  payoutBonus: 5,      // +5% payout per prestige level
  startingCash: 1000,  // +$1,000 starting cash per prestige
  xpBonus: 3           // +3% XP per prestige level
};

// GET /api/prestige - Get prestige info
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const playerResult = await pool.query(
      `SELECT level, total_earnings, prestige_level FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    const canPrestige = player.level >= MIN_LEVEL_FOR_PRESTIGE &&
                        player.total_earnings >= MIN_EARNINGS_FOR_PRESTIGE;

    // Calculate current bonuses
    const currentBonuses = {
      successRate: player.prestige_level * PRESTIGE_BONUSES.successRate,
      payoutBonus: player.prestige_level * PRESTIGE_BONUSES.payoutBonus,
      xpBonus: player.prestige_level * PRESTIGE_BONUSES.xpBonus
    };

    // Calculate next level bonuses
    const nextBonuses = {
      successRate: (player.prestige_level + 1) * PRESTIGE_BONUSES.successRate,
      payoutBonus: (player.prestige_level + 1) * PRESTIGE_BONUSES.payoutBonus,
      xpBonus: (player.prestige_level + 1) * PRESTIGE_BONUSES.xpBonus,
      startingCash: 500 + ((player.prestige_level + 1) * PRESTIGE_BONUSES.startingCash)
    };

    res.json({
      success: true,
      data: {
        prestigeLevel: player.prestige_level,
        playerLevel: player.level,
        totalEarnings: player.total_earnings,
        canPrestige,
        requirements: {
          minLevel: MIN_LEVEL_FOR_PRESTIGE,
          minEarnings: MIN_EARNINGS_FOR_PRESTIGE,
          levelMet: player.level >= MIN_LEVEL_FOR_PRESTIGE,
          earningsMet: player.total_earnings >= MIN_EARNINGS_FOR_PRESTIGE
        },
        currentBonuses,
        nextBonuses,
        prestigeInfo: {
          description: 'Prestige resets your level, cash, and inventory but grants permanent bonuses.',
          rewards: [
            `+${PRESTIGE_BONUSES.successRate}% success rate per prestige`,
            `+${PRESTIGE_BONUSES.payoutBonus}% payout bonus per prestige`,
            `+${PRESTIGE_BONUSES.xpBonus}% XP bonus per prestige`,
            `+$${PRESTIGE_BONUSES.startingCash} starting cash per prestige`
          ]
        }
      }
    });
  } catch (error) {
    console.error('Get prestige error:', error);
    res.status(500).json({ success: false, error: 'Failed to get prestige info' });
  }
});

// POST /api/prestige/reset - Prestige and reset progress
router.post('/reset', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const playerResult = await pool.query(
      `SELECT level, total_earnings, prestige_level, username FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Validate requirements
    if (player.level < MIN_LEVEL_FOR_PRESTIGE) {
      res.status(400).json({
        success: false,
        error: `Must be level ${MIN_LEVEL_FOR_PRESTIGE} to prestige`
      });
      return;
    }

    if (player.total_earnings < MIN_EARNINGS_FOR_PRESTIGE) {
      res.status(400).json({
        success: false,
        error: `Must have earned $${MIN_EARNINGS_FOR_PRESTIGE} total to prestige`
      });
      return;
    }

    const newPrestigeLevel = player.prestige_level + 1;
    const startingCash = 500 + (newPrestigeLevel * PRESTIGE_BONUSES.startingCash);

    // Reset player progress but keep prestige bonuses
    await pool.query(
      `UPDATE players SET
        level = 1,
        xp = 0,
        cash = $1,
        bank = 0,
        energy = 100,
        nerve = 50,
        total_earnings = 0,
        prestige_level = $2,
        current_district = NULL,
        in_jail = false,
        jail_release_at = NULL
       WHERE id = $3`,
      [startingCash, newPrestigeLevel, playerId]
    );

    // Clear inventory
    await pool.query(`DELETE FROM player_inventory WHERE player_id = $1`, [playerId]);

    // Clear cooldowns
    await pool.query(`DELETE FROM player_cooldowns WHERE player_id = $1`, [playerId]);

    // Clear mission progress (but keep history via crime_logs)
    await pool.query(`DELETE FROM player_missions WHERE player_id = $1`, [playerId]);

    // Calculate new bonuses
    const newBonuses = {
      successRate: newPrestigeLevel * PRESTIGE_BONUSES.successRate,
      payoutBonus: newPrestigeLevel * PRESTIGE_BONUSES.payoutBonus,
      xpBonus: newPrestigeLevel * PRESTIGE_BONUSES.xpBonus
    };

    res.json({
      success: true,
      data: {
        message: `Congratulations! You are now Prestige ${newPrestigeLevel}!`,
        newPrestigeLevel,
        startingCash,
        bonuses: newBonuses,
        resetItems: [
          'Level reset to 1',
          'Cash and bank reset',
          'Inventory cleared',
          'Cooldowns reset',
          'Missions reset'
        ],
        kept: [
          'Crew membership',
          'Crime history/stats',
          'Chat history'
        ]
      }
    });
  } catch (error) {
    console.error('Prestige reset error:', error);
    res.status(500).json({ success: false, error: 'Failed to prestige' });
  }
});

// Helper function to get prestige bonuses for a player
export async function getPrestigeBonuses(playerId: number): Promise<{
  successRate: number;
  payoutBonus: number;
  xpBonus: number;
}> {
  const result = await pool.query(
    `SELECT prestige_level FROM players WHERE id = $1`,
    [playerId]
  );

  const prestigeLevel = result.rows[0]?.prestige_level || 0;

  return {
    successRate: prestigeLevel * PRESTIGE_BONUSES.successRate,
    payoutBonus: prestigeLevel * PRESTIGE_BONUSES.payoutBonus,
    xpBonus: prestigeLevel * PRESTIGE_BONUSES.xpBonus
  };
}

export default router;
