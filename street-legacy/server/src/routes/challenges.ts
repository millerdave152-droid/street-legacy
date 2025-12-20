import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Challenge definitions - these reset daily/weekly
const DAILY_CHALLENGES = [
  { id: 'd1', name: 'Street Hustler', description: 'Complete 5 crimes', type: 'crimes', target: 5, reward: { cash: 5000, xp: 100 } },
  { id: 'd2', name: 'Money Maker', description: 'Earn $10,000 from crimes', type: 'crime_earnings', target: 10000, reward: { cash: 2500, xp: 150 } },
  { id: 'd3', name: 'High Roller', description: 'Win 3 casino games', type: 'casino_wins', target: 3, reward: { cash: 7500, xp: 75 } },
  { id: 'd4', name: 'Road Warrior', description: 'Win a street race', type: 'race_wins', target: 1, reward: { cash: 10000, xp: 50 } },
  { id: 'd5', name: 'Brawler', description: 'Win a PvP fight', type: 'pvp_wins', target: 1, reward: { cash: 8000, xp: 100 } },
  { id: 'd6', name: 'Banker', description: 'Deposit $25,000 in the bank', type: 'bank_deposits', target: 25000, reward: { cash: 5000, xp: 50 } },
  { id: 'd7', name: 'Shopper', description: 'Buy an item from the shop', type: 'shop_purchases', target: 1, reward: { cash: 3000, xp: 75 } },
  { id: 'd8', name: 'Traveler', description: 'Travel to 3 different districts', type: 'travel_count', target: 3, reward: { cash: 4000, xp: 100 } },
];

const WEEKLY_CHALLENGES = [
  { id: 'w1', name: 'Crime Lord', description: 'Complete 50 crimes', type: 'crimes', target: 50, reward: { cash: 50000, xp: 1000, streetCred: 50 } },
  { id: 'w2', name: 'Millionaire', description: 'Earn $100,000 total', type: 'crime_earnings', target: 100000, reward: { cash: 25000, xp: 1500, streetCred: 100 } },
  { id: 'w3', name: 'Casino King', description: 'Win 25 casino games', type: 'casino_wins', target: 25, reward: { cash: 75000, xp: 750, streetCred: 75 } },
  { id: 'w4', name: 'Speed Demon', description: 'Win 10 street races', type: 'race_wins', target: 10, reward: { cash: 100000, xp: 500, streetCred: 50 } },
  { id: 'w5', name: 'Warlord', description: 'Win 15 PvP fights', type: 'pvp_wins', target: 15, reward: { cash: 80000, xp: 1000, streetCred: 100 } },
  { id: 'w6', name: 'Bounty Hunter', description: 'Claim 3 bounties', type: 'bounties_claimed', target: 3, reward: { cash: 60000, xp: 800, streetCred: 150 } },
  { id: 'w7', name: 'Level Up', description: 'Gain 5 levels', type: 'levels_gained', target: 5, reward: { cash: 100000, xp: 2000, streetCred: 200 } },
  { id: 'w8', name: 'Investor', description: 'Collect $50,000 in interest', type: 'interest_collected', target: 50000, reward: { cash: 30000, xp: 500, streetCred: 50 } },
];

// Helper: Get start of day/week
function getStartOfDay(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
  return new Date(now.getFullYear(), now.getMonth(), diff);
}

// Helper: Get random challenges for a player
function selectChallenges(challenges: typeof DAILY_CHALLENGES, count: number, seed: number): typeof DAILY_CHALLENGES {
  // Use seed for deterministic selection per player per period
  const shuffled = [...challenges].sort(() => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 1000 - 0.5;
  });
  return shuffled.slice(0, count);
}

// GET /api/challenges - Get player's daily and weekly challenges
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const startOfDay = getStartOfDay();
    const startOfWeek = getStartOfWeek();

    // Get or create player challenge progress
    const progressResult = await pool.query(
      `SELECT * FROM player_challenges WHERE player_id = $1`,
      [playerId]
    );

    let progress = progressResult.rows[0];

    // Check if we need to reset daily challenges
    if (!progress || new Date(progress.daily_reset_at) < startOfDay) {
      // Select new daily challenges for this player
      const dailySeed = playerId * 10000 + startOfDay.getTime();
      const selectedDaily = selectChallenges(DAILY_CHALLENGES, 3, dailySeed);

      if (!progress) {
        await pool.query(
          `INSERT INTO player_challenges (player_id, daily_challenges, daily_progress, daily_reset_at, weekly_challenges, weekly_progress, weekly_reset_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [playerId, JSON.stringify(selectedDaily.map(c => c.id)), '{}', new Date(startOfDay.getTime() + 86400000),
           JSON.stringify([]), '{}', new Date(startOfWeek.getTime() + 604800000)]
        );
      } else {
        await pool.query(
          `UPDATE player_challenges SET daily_challenges = $1, daily_progress = $2, daily_reset_at = $3 WHERE player_id = $4`,
          [JSON.stringify(selectedDaily.map(c => c.id)), '{}', new Date(startOfDay.getTime() + 86400000), playerId]
        );
      }
    }

    // Check if we need to reset weekly challenges
    if (!progress || new Date(progress.weekly_reset_at) < startOfWeek) {
      const weeklySeed = playerId * 10000 + startOfWeek.getTime();
      const selectedWeekly = selectChallenges(WEEKLY_CHALLENGES, 3, weeklySeed);

      await pool.query(
        `UPDATE player_challenges SET weekly_challenges = $1, weekly_progress = $2, weekly_reset_at = $3 WHERE player_id = $4`,
        [JSON.stringify(selectedWeekly.map(c => c.id)), '{}', new Date(startOfWeek.getTime() + 604800000), playerId]
      );
    }

    // Get updated progress
    const updatedResult = await pool.query(
      `SELECT * FROM player_challenges WHERE player_id = $1`,
      [playerId]
    );
    progress = updatedResult.rows[0];

    // Build response with full challenge data
    const dailyChallengeIds = JSON.parse(progress.daily_challenges || '[]');
    const weeklyChallengeIds = JSON.parse(progress.weekly_challenges || '[]');
    const dailyProgress = JSON.parse(progress.daily_progress || '{}');
    const weeklyProgress = JSON.parse(progress.weekly_progress || '{}');

    const dailyChallenges = dailyChallengeIds.map((id: string) => {
      const challenge = DAILY_CHALLENGES.find(c => c.id === id);
      if (!challenge) return null;
      return {
        ...challenge,
        progress: dailyProgress[id] || 0,
        completed: (dailyProgress[id] || 0) >= challenge.target,
        claimed: dailyProgress[`${id}_claimed`] || false
      };
    }).filter(Boolean);

    const weeklyChallenges = weeklyChallengeIds.map((id: string) => {
      const challenge = WEEKLY_CHALLENGES.find(c => c.id === id);
      if (!challenge) return null;
      return {
        ...challenge,
        progress: weeklyProgress[id] || 0,
        completed: (weeklyProgress[id] || 0) >= challenge.target,
        claimed: weeklyProgress[`${id}_claimed`] || false
      };
    }).filter(Boolean);

    res.json({
      success: true,
      data: {
        daily: {
          challenges: dailyChallenges,
          resetAt: progress.daily_reset_at
        },
        weekly: {
          challenges: weeklyChallenges,
          resetAt: progress.weekly_reset_at
        }
      }
    });
  } catch (error) {
    console.error('Challenges error:', error);
    res.status(500).json({ success: false, error: 'Failed to get challenges' });
  }
});

// POST /api/challenges/claim - Claim a completed challenge reward
router.post('/claim', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { challengeId, type } = req.body;

    if (!challengeId || !type) {
      res.status(400).json({ success: false, error: 'Challenge ID and type required' });
      return;
    }

    // Get player progress
    const progressResult = await pool.query(
      `SELECT * FROM player_challenges WHERE player_id = $1`,
      [playerId]
    );

    if (progressResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'No challenges found' });
      return;
    }

    const progress = progressResult.rows[0];
    const isDaily = type === 'daily';
    const challengeList = isDaily ? DAILY_CHALLENGES : WEEKLY_CHALLENGES;
    const progressField = isDaily ? 'daily_progress' : 'weekly_progress';
    const currentProgress = JSON.parse(progress[progressField] || '{}');

    // Find challenge
    const challenge = challengeList.find(c => c.id === challengeId);
    if (!challenge) {
      res.status(404).json({ success: false, error: 'Challenge not found' });
      return;
    }

    // Check if already claimed
    if (currentProgress[`${challengeId}_claimed`]) {
      res.status(400).json({ success: false, error: 'Already claimed' });
      return;
    }

    // Check if completed
    const challengeProgress = currentProgress[challengeId] || 0;
    if (challengeProgress < challenge.target) {
      res.status(400).json({ success: false, error: 'Challenge not completed' });
      return;
    }

    // Award rewards
    const reward = challenge.reward as { cash: number; xp: number; streetCred?: number };
    await pool.query(
      `UPDATE players SET cash = cash + $1, xp = xp + $2, street_cred = street_cred + $3 WHERE id = $4`,
      [reward.cash, reward.xp, reward.streetCred || 0, playerId]
    );

    // Mark as claimed
    currentProgress[`${challengeId}_claimed`] = true;
    await pool.query(
      `UPDATE player_challenges SET ${progressField} = $1 WHERE player_id = $2`,
      [JSON.stringify(currentProgress), playerId]
    );

    res.json({
      success: true,
      data: {
        message: `Claimed ${challenge.name} reward!`,
        reward: {
          cash: reward.cash,
          xp: reward.xp,
          streetCred: reward.streetCred || 0
        }
      }
    });
  } catch (error) {
    console.error('Claim challenge error:', error);
    res.status(500).json({ success: false, error: 'Failed to claim reward' });
  }
});

// Helper function to update challenge progress (called from other routes)
export async function updateChallengeProgress(playerId: number, type: string, amount: number = 1) {
  try {
    const progressResult = await pool.query(
      `SELECT * FROM player_challenges WHERE player_id = $1`,
      [playerId]
    );

    if (progressResult.rows.length === 0) return;

    const progress = progressResult.rows[0];

    // Update daily progress
    const dailyChallengeIds = JSON.parse(progress.daily_challenges || '[]');
    const dailyProgress = JSON.parse(progress.daily_progress || '{}');
    let dailyUpdated = false;

    for (const id of dailyChallengeIds) {
      const challenge = DAILY_CHALLENGES.find(c => c.id === id);
      if (challenge && challenge.type === type && !dailyProgress[`${id}_claimed`]) {
        dailyProgress[id] = (dailyProgress[id] || 0) + amount;
        dailyUpdated = true;
      }
    }

    if (dailyUpdated) {
      await pool.query(
        `UPDATE player_challenges SET daily_progress = $1 WHERE player_id = $2`,
        [JSON.stringify(dailyProgress), playerId]
      );
    }

    // Update weekly progress
    const weeklyChallengeIds = JSON.parse(progress.weekly_challenges || '[]');
    const weeklyProgress = JSON.parse(progress.weekly_progress || '{}');
    let weeklyUpdated = false;

    for (const id of weeklyChallengeIds) {
      const challenge = WEEKLY_CHALLENGES.find(c => c.id === id);
      if (challenge && challenge.type === type && !weeklyProgress[`${id}_claimed`]) {
        weeklyProgress[id] = (weeklyProgress[id] || 0) + amount;
        weeklyUpdated = true;
      }
    }

    if (weeklyUpdated) {
      await pool.query(
        `UPDATE player_challenges SET weekly_progress = $1 WHERE player_id = $2`,
        [JSON.stringify(weeklyProgress), playerId]
      );
    }
  } catch (error) {
    console.error('Update challenge progress error:', error);
  }
}

export default router;
