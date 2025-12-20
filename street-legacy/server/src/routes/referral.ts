import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { awardStreetCred } from './streetcred.js';

const router = Router();

router.use(authMiddleware);

// Referral rewards
const REFERRER_CASH_REWARD = 5000;
const REFERRER_CRED_REWARD = 10;
const REFEREE_STARTING_BONUS = 2000;
const REFEREE_LEVEL_THRESHOLD = 5;

// Generate a unique referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/referral/code - Get or generate player's referral code
router.get('/code', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const playerResult = await pool.query(
      `SELECT referral_code FROM players WHERE id = $1`,
      [playerId]
    );

    let referralCode = playerResult.rows[0].referral_code;

    // Generate code if player doesn't have one
    if (!referralCode) {
      // Try up to 10 times to generate a unique code
      for (let i = 0; i < 10; i++) {
        referralCode = generateReferralCode();
        try {
          await pool.query(
            `UPDATE players SET referral_code = $1 WHERE id = $2`,
            [referralCode, playerId]
          );
          break;
        } catch (error: any) {
          if (error.code === '23505') {
            // Unique constraint violation, try again
            referralCode = null;
            continue;
          }
          throw error;
        }
      }

      if (!referralCode) {
        res.status(500).json({ success: false, error: 'Failed to generate referral code' });
        return;
      }
    }

    res.json({
      success: true,
      data: {
        referralCode,
        referralLink: `https://streetlegacy.com/register?ref=${referralCode}`,
        rewards: {
          referrerCash: REFERRER_CASH_REWARD,
          referrerCred: REFERRER_CRED_REWARD,
          refereBonus: REFEREE_STARTING_BONUS,
          levelThreshold: REFEREE_LEVEL_THRESHOLD
        }
      }
    });
  } catch (error) {
    console.error('Get referral code error:', error);
    res.status(500).json({ success: false, error: 'Failed to get referral code' });
  }
});

// GET /api/referral/stats - Get player's referral statistics
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get total referrals
    const totalResult = await pool.query(
      `SELECT COUNT(*) as total FROM players WHERE referred_by = $1`,
      [playerId]
    );

    // Get referrals that hit level threshold (rewarded)
    const rewardedResult = await pool.query(
      `SELECT COUNT(*) as rewarded FROM referral_rewards
       WHERE referrer_id = $1 AND rewarded = TRUE`,
      [playerId]
    );

    // Get pending referrals (signed up but not yet level 5)
    const pendingResult = await pool.query(
      `SELECT p.id, p.username, p.level, p.created_at
       FROM players p
       LEFT JOIN referral_rewards rr ON rr.referee_id = p.id AND rr.referrer_id = $1
       WHERE p.referred_by = $1 AND (rr.rewarded IS NULL OR rr.rewarded = FALSE)
       ORDER BY p.created_at DESC`,
      [playerId]
    );

    // Get recent rewards
    const rewardsResult = await pool.query(
      `SELECT rr.*, p.username as referee_username
       FROM referral_rewards rr
       JOIN players p ON p.id = rr.referee_id
       WHERE rr.referrer_id = $1 AND rr.rewarded = TRUE
       ORDER BY rr.rewarded_at DESC
       LIMIT 10`,
      [playerId]
    );

    // Calculate total earnings
    const totalEarnings = {
      cash: parseInt(rewardedResult.rows[0].rewarded) * REFERRER_CASH_REWARD,
      cred: parseInt(rewardedResult.rows[0].rewarded) * REFERRER_CRED_REWARD
    };

    res.json({
      success: true,
      data: {
        totalReferrals: parseInt(totalResult.rows[0].total),
        rewardedReferrals: parseInt(rewardedResult.rows[0].rewarded),
        pendingReferrals: pendingResult.rows,
        recentRewards: rewardsResult.rows,
        totalEarnings
      }
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get referral stats' });
  }
});

// POST /api/referral/check-rewards - Check and process pending referral rewards
// This is called when a player levels up or periodically
router.post('/check-rewards', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Check if this player was referred and has hit level 5
    const playerResult = await pool.query(
      `SELECT p.level, p.referred_by, rr.rewarded
       FROM players p
       LEFT JOIN referral_rewards rr ON rr.referee_id = p.id
       WHERE p.id = $1`,
      [playerId]
    );

    const player = playerResult.rows[0];

    // If player was referred, is level 5+, and hasn't been processed yet
    if (player.referred_by && player.level >= REFEREE_LEVEL_THRESHOLD && !player.rewarded) {
      // Check if already rewarded (might not be in left join result)
      const existingReward = await pool.query(
        `SELECT id, rewarded FROM referral_rewards
         WHERE referrer_id = $1 AND referee_id = $2`,
        [player.referred_by, playerId]
      );

      if (existingReward.rows.length === 0) {
        // Create reward entry
        await pool.query(
          `INSERT INTO referral_rewards (referrer_id, referee_id, rewarded, rewarded_at)
           VALUES ($1, $2, TRUE, NOW())`,
          [player.referred_by, playerId]
        );

        // Reward the referrer
        await pool.query(
          `UPDATE players SET cash = cash + $1 WHERE id = $2`,
          [REFERRER_CASH_REWARD, player.referred_by]
        );

        await awardStreetCred(
          player.referred_by,
          REFERRER_CRED_REWARD,
          `Referral reward: ${req.player!.username} reached level ${REFEREE_LEVEL_THRESHOLD}`
        );

        // Create notification for referrer
        await pool.query(
          `INSERT INTO notifications (player_id, type, message, data)
           VALUES ($1, 'referral', $2, $3)`,
          [
            player.referred_by,
            `Your referral ${req.player!.username} reached level ${REFEREE_LEVEL_THRESHOLD}! You earned $${REFERRER_CASH_REWARD.toLocaleString()} and ${REFERRER_CRED_REWARD} Street Cred!`,
            JSON.stringify({ refereeName: req.player!.username, cashReward: REFERRER_CASH_REWARD, credReward: REFERRER_CRED_REWARD })
          ]
        );

        // Check for "Networker" achievement for both players
        await checkNetworkerAchievement(player.referred_by);
        await checkNetworkerAchievement(playerId);

        res.json({
          success: true,
          data: {
            rewardProcessed: true,
            message: `Referral reward sent to your referrer!`
          }
        });
        return;
      } else if (!existingReward.rows[0].rewarded) {
        // Entry exists but not rewarded, process it
        await pool.query(
          `UPDATE referral_rewards SET rewarded = TRUE, rewarded_at = NOW()
           WHERE referrer_id = $1 AND referee_id = $2`,
          [player.referred_by, playerId]
        );

        // Same rewards as above
        await pool.query(
          `UPDATE players SET cash = cash + $1 WHERE id = $2`,
          [REFERRER_CASH_REWARD, player.referred_by]
        );

        await awardStreetCred(
          player.referred_by,
          REFERRER_CRED_REWARD,
          `Referral reward: ${req.player!.username} reached level ${REFEREE_LEVEL_THRESHOLD}`
        );

        await pool.query(
          `INSERT INTO notifications (player_id, type, message, data)
           VALUES ($1, 'referral', $2, $3)`,
          [
            player.referred_by,
            `Your referral ${req.player!.username} reached level ${REFEREE_LEVEL_THRESHOLD}! You earned $${REFERRER_CASH_REWARD.toLocaleString()} and ${REFERRER_CRED_REWARD} Street Cred!`,
            JSON.stringify({ refereeName: req.player!.username, cashReward: REFERRER_CASH_REWARD, credReward: REFERRER_CRED_REWARD })
          ]
        );

        await checkNetworkerAchievement(player.referred_by);
        await checkNetworkerAchievement(playerId);

        res.json({
          success: true,
          data: {
            rewardProcessed: true,
            message: `Referral reward sent to your referrer!`
          }
        });
        return;
      }
    }

    res.json({
      success: true,
      data: {
        rewardProcessed: false
      }
    });
  } catch (error) {
    console.error('Check referral rewards error:', error);
    res.status(500).json({ success: false, error: 'Failed to check referral rewards' });
  }
});

// Helper function to check and award Networker achievement
async function checkNetworkerAchievement(playerId: number): Promise<void> {
  try {
    // Check if player already has the achievement
    const existingResult = await pool.query(
      `SELECT id FROM player_achievements pa
       JOIN achievements a ON a.id = pa.achievement_id
       WHERE pa.player_id = $1 AND a.name = 'Networker'`,
      [playerId]
    );

    if (existingResult.rows.length > 0) {
      return; // Already has achievement
    }

    // Get the Networker achievement
    const achievementResult = await pool.query(
      `SELECT * FROM achievements WHERE name = 'Networker'`
    );

    if (achievementResult.rows.length === 0) {
      return; // Achievement doesn't exist
    }

    const achievement = achievementResult.rows[0];

    // Award the achievement
    await pool.query(
      `INSERT INTO player_achievements (player_id, achievement_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [playerId, achievement.id]
    );

    // Give rewards
    if (achievement.reward_cash > 0) {
      await pool.query(
        `UPDATE players SET cash = cash + $1 WHERE id = $2`,
        [achievement.reward_cash, playerId]
      );
    }

    if (achievement.reward_xp > 0) {
      await pool.query(
        `UPDATE players SET xp = xp + $1 WHERE id = $2`,
        [achievement.reward_xp, playerId]
      );
    }

    if (achievement.reward_cred > 0) {
      await awardStreetCred(playerId, achievement.reward_cred, `Achievement: ${achievement.name}`);
    }

    // Create notification
    await pool.query(
      `INSERT INTO notifications (player_id, type, message, data)
       VALUES ($1, 'achievement', $2, $3)`,
      [
        playerId,
        `Achievement Unlocked: ${achievement.name}!`,
        JSON.stringify({ achievementId: achievement.id, name: achievement.name, icon: achievement.icon })
      ]
    );
  } catch (error) {
    console.error('Check networker achievement error:', error);
  }
}

// Export for use by auth route during registration
export async function processReferralCode(
  newPlayerId: number,
  referralCode: string
): Promise<{ success: boolean; referrerId?: number }> {
  try {
    // Find referrer by code
    const referrerResult = await pool.query(
      `SELECT id FROM players WHERE referral_code = $1`,
      [referralCode.toUpperCase()]
    );

    if (referrerResult.rows.length === 0) {
      return { success: false };
    }

    const referrerId = referrerResult.rows[0].id;

    // Prevent self-referral
    if (referrerId === newPlayerId) {
      return { success: false };
    }

    // Set referred_by on the new player
    await pool.query(
      `UPDATE players SET referred_by = $1 WHERE id = $2`,
      [referrerId, newPlayerId]
    );

    // Give referee starting bonus
    await pool.query(
      `UPDATE players SET cash = cash + $1 WHERE id = $2`,
      [REFEREE_STARTING_BONUS, newPlayerId]
    );

    // Create referral_rewards entry (not yet rewarded - happens at level 5)
    await pool.query(
      `INSERT INTO referral_rewards (referrer_id, referee_id, rewarded)
       VALUES ($1, $2, FALSE)`,
      [referrerId, newPlayerId]
    );

    // Notify the referrer
    const newPlayerResult = await pool.query(
      `SELECT username FROM players WHERE id = $1`,
      [newPlayerId]
    );

    await pool.query(
      `INSERT INTO notifications (player_id, type, message, data)
       VALUES ($1, 'referral', $2, $3)`,
      [
        referrerId,
        `${newPlayerResult.rows[0].username} signed up using your referral code! You'll earn rewards when they reach level ${REFEREE_LEVEL_THRESHOLD}.`,
        JSON.stringify({ refereeName: newPlayerResult.rows[0].username })
      ]
    );

    return { success: true, referrerId };
  } catch (error) {
    console.error('Process referral code error:', error);
    return { success: false };
  }
}

export default router;
