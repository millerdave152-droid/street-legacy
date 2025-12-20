import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { awardStreetCred } from './streetcred.js';

const router = Router();

router.use(authMiddleware);

// Premium battle pass cost
const PREMIUM_PASS_COST = 500; // Street Cred

// GET /api/battlepass - Get current season and player progress
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get active season
    const seasonResult = await pool.query(
      `SELECT * FROM seasons WHERE is_active = TRUE LIMIT 1`
    );

    if (seasonResult.rows.length === 0) {
      res.json({
        success: true,
        data: {
          activeSeason: null,
          message: 'No active season'
        }
      });
      return;
    }

    const season = seasonResult.rows[0];

    // Get or create player progress
    let progressResult = await pool.query(
      `SELECT * FROM player_battle_pass
       WHERE player_id = $1 AND season_id = $2`,
      [playerId, season.id]
    );

    if (progressResult.rows.length === 0) {
      // Create new progress entry
      await pool.query(
        `INSERT INTO player_battle_pass (player_id, season_id)
         VALUES ($1, $2)`,
        [playerId, season.id]
      );

      progressResult = await pool.query(
        `SELECT * FROM player_battle_pass
         WHERE player_id = $1 AND season_id = $2`,
        [playerId, season.id]
      );
    }

    const progress = progressResult.rows[0];

    // Get all tiers with their rewards
    const tiersResult = await pool.query(
      `SELECT * FROM battle_pass_tiers
       WHERE season_id = $1
       ORDER BY tier`,
      [season.id]
    );

    // Get player's street cred
    const playerResult = await pool.query(
      `SELECT street_cred FROM players WHERE id = $1`,
      [playerId]
    );

    // Calculate time remaining
    const endDate = new Date(season.end_date);
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    res.json({
      success: true,
      data: {
        season: {
          id: season.id,
          name: season.name,
          startDate: season.start_date,
          endDate: season.end_date,
          daysRemaining
        },
        progress: {
          currentTier: progress.current_tier,
          xp: progress.xp,
          isPremium: progress.is_premium,
          claimedTiers: progress.claimed_tiers
        },
        tiers: tiersResult.rows,
        playerCred: playerResult.rows[0].street_cred,
        premiumCost: PREMIUM_PASS_COST
      }
    });
  } catch (error) {
    console.error('Get battle pass error:', error);
    res.status(500).json({ success: false, error: 'Failed to load battle pass' });
  }
});

// POST /api/battlepass/upgrade - Purchase premium battle pass
router.post('/upgrade', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get active season
    const seasonResult = await pool.query(
      `SELECT id FROM seasons WHERE is_active = TRUE LIMIT 1`
    );

    if (seasonResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'No active season' });
      return;
    }

    const seasonId = seasonResult.rows[0].id;

    // Get player progress
    const progressResult = await pool.query(
      `SELECT * FROM player_battle_pass
       WHERE player_id = $1 AND season_id = $2`,
      [playerId, seasonId]
    );

    if (progressResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'Battle pass not initialized' });
      return;
    }

    const progress = progressResult.rows[0];

    if (progress.is_premium) {
      res.status(400).json({ success: false, error: 'Already have premium pass' });
      return;
    }

    // Check player's street cred
    const playerResult = await pool.query(
      `SELECT street_cred FROM players WHERE id = $1`,
      [playerId]
    );

    if (playerResult.rows[0].street_cred < PREMIUM_PASS_COST) {
      res.status(400).json({ success: false, error: `Not enough cred (need ${PREMIUM_PASS_COST})` });
      return;
    }

    // Deduct cred and upgrade
    await pool.query(
      `UPDATE players SET street_cred = street_cred - $1 WHERE id = $2`,
      [PREMIUM_PASS_COST, playerId]
    );

    await pool.query(
      `INSERT INTO street_cred_transactions (player_id, amount, type, description)
       VALUES ($1, $2, 'spend', 'Premium Battle Pass')`,
      [playerId, -PREMIUM_PASS_COST]
    );

    await pool.query(
      `UPDATE player_battle_pass SET is_premium = TRUE
       WHERE player_id = $1 AND season_id = $2`,
      [playerId, seasonId]
    );

    res.json({
      success: true,
      data: {
        message: 'Upgraded to Premium Battle Pass!',
        cost: PREMIUM_PASS_COST
      }
    });
  } catch (error) {
    console.error('Upgrade battle pass error:', error);
    res.status(500).json({ success: false, error: 'Failed to upgrade battle pass' });
  }
});

// POST /api/battlepass/claim - Claim tier reward
router.post('/claim', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { tier, track } = req.body; // track: 'free' or 'premium'

    if (!tier || !track || !['free', 'premium'].includes(track)) {
      res.status(400).json({ success: false, error: 'Invalid tier or track' });
      return;
    }

    // Get active season
    const seasonResult = await pool.query(
      `SELECT id FROM seasons WHERE is_active = TRUE LIMIT 1`
    );

    if (seasonResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'No active season' });
      return;
    }

    const seasonId = seasonResult.rows[0].id;

    // Get player progress
    const progressResult = await pool.query(
      `SELECT * FROM player_battle_pass
       WHERE player_id = $1 AND season_id = $2`,
      [playerId, seasonId]
    );

    if (progressResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'Battle pass not initialized' });
      return;
    }

    const progress = progressResult.rows[0];

    // Check if tier is unlocked
    if (progress.current_tier < tier) {
      res.status(400).json({ success: false, error: 'Tier not unlocked yet' });
      return;
    }

    // Check if premium track requires premium pass
    if (track === 'premium' && !progress.is_premium) {
      res.status(400).json({ success: false, error: 'Premium pass required' });
      return;
    }

    // Check if already claimed
    const claimedTiers = progress.claimed_tiers;
    if (claimedTiers[track]?.includes(tier)) {
      res.status(400).json({ success: false, error: 'Already claimed' });
      return;
    }

    // Get tier rewards
    const tierResult = await pool.query(
      `SELECT * FROM battle_pass_tiers
       WHERE season_id = $1 AND tier = $2`,
      [seasonId, tier]
    );

    if (tierResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Tier not found' });
      return;
    }

    const tierData = tierResult.rows[0];
    const rewardType = track === 'free' ? tierData.free_reward_type : tierData.premium_reward_type;
    const rewardValue = track === 'free' ? tierData.free_reward_value : tierData.premium_reward_value;
    const rewardId = track === 'free' ? tierData.free_reward_id : tierData.premium_reward_id;

    if (!rewardType) {
      res.status(400).json({ success: false, error: 'No reward for this track' });
      return;
    }

    // Award the reward
    let rewardMessage = '';

    switch (rewardType) {
      case 'cash':
        await pool.query(
          `UPDATE players SET cash = cash + $1 WHERE id = $2`,
          [rewardValue, playerId]
        );
        rewardMessage = `$${rewardValue!.toLocaleString()}`;
        break;

      case 'cred':
        await awardStreetCred(playerId, rewardValue!, `Battle Pass Tier ${tier} reward`);
        rewardMessage = `${rewardValue} Street Cred`;
        break;

      case 'xp_boost':
        // XP boosts give direct XP
        await pool.query(
          `UPDATE players SET xp = xp + $1 WHERE id = $2`,
          [rewardValue, playerId]
        );
        rewardMessage = `${rewardValue} XP`;
        break;

      case 'cosmetic':
        if (rewardId) {
          // Add cosmetic to player's inventory
          await pool.query(
            `INSERT INTO player_cosmetics (player_id, cosmetic_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [playerId, rewardId]
          );
          const cosmeticResult = await pool.query(
            `SELECT name FROM cosmetics WHERE id = $1`,
            [rewardId]
          );
          rewardMessage = cosmeticResult.rows[0]?.name || 'Cosmetic';
        }
        break;

      case 'item':
        if (rewardId) {
          // Add item to player's inventory
          await pool.query(
            `INSERT INTO player_inventory (player_id, item_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [playerId, rewardId]
          );
          const itemResult = await pool.query(
            `SELECT name FROM items WHERE id = $1`,
            [rewardId]
          );
          rewardMessage = itemResult.rows[0]?.name || 'Item';
        }
        break;

      case 'title':
        // Titles are stored as cosmetics with type 'title'
        if (rewardId) {
          await pool.query(
            `INSERT INTO player_cosmetics (player_id, cosmetic_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [playerId, rewardId]
          );
          const titleResult = await pool.query(
            `SELECT name FROM cosmetics WHERE id = $1`,
            [rewardId]
          );
          rewardMessage = `Title: ${titleResult.rows[0]?.name || 'Unknown'}`;
        }
        break;
    }

    // Mark as claimed
    claimedTiers[track] = claimedTiers[track] || [];
    claimedTiers[track].push(tier);

    await pool.query(
      `UPDATE player_battle_pass SET claimed_tiers = $1
       WHERE player_id = $2 AND season_id = $3`,
      [JSON.stringify(claimedTiers), playerId, seasonId]
    );

    res.json({
      success: true,
      data: {
        tier,
        track,
        rewardType,
        rewardValue,
        message: `Claimed ${rewardMessage}!`
      }
    });
  } catch (error) {
    console.error('Claim tier error:', error);
    res.status(500).json({ success: false, error: 'Failed to claim reward' });
  }
});

// Helper function to add XP to battle pass (called from other modules)
export async function addBattlePassXP(playerId: number, xp: number): Promise<void> {
  try {
    // Get active season
    const seasonResult = await pool.query(
      `SELECT id FROM seasons WHERE is_active = TRUE LIMIT 1`
    );

    if (seasonResult.rows.length === 0) {
      return; // No active season
    }

    const seasonId = seasonResult.rows[0].id;

    // Get or create player progress
    let progressResult = await pool.query(
      `SELECT * FROM player_battle_pass
       WHERE player_id = $1 AND season_id = $2`,
      [playerId, seasonId]
    );

    if (progressResult.rows.length === 0) {
      await pool.query(
        `INSERT INTO player_battle_pass (player_id, season_id)
         VALUES ($1, $2)`,
        [playerId, seasonId]
      );

      progressResult = await pool.query(
        `SELECT * FROM player_battle_pass
         WHERE player_id = $1 AND season_id = $2`,
        [playerId, seasonId]
      );
    }

    const progress = progressResult.rows[0];
    const newXP = progress.xp + xp;

    // Get all tiers to check for tier-ups
    const tiersResult = await pool.query(
      `SELECT tier, xp_required FROM battle_pass_tiers
       WHERE season_id = $1
       ORDER BY tier`,
      [seasonId]
    );

    // Calculate new tier
    let newTier = 0;
    for (const tier of tiersResult.rows) {
      if (newXP >= tier.xp_required) {
        newTier = tier.tier;
      } else {
        break;
      }
    }

    // Update progress
    await pool.query(
      `UPDATE player_battle_pass
       SET xp = $1, current_tier = $2
       WHERE player_id = $3 AND season_id = $4`,
      [newXP, newTier, playerId, seasonId]
    );

    // Notify if tier increased
    if (newTier > progress.current_tier) {
      await pool.query(
        `INSERT INTO notifications (player_id, type, message, data)
         VALUES ($1, 'battlepass', $2, $3)`,
        [
          playerId,
          `Battle Pass Tier Up! You reached Tier ${newTier}!`,
          JSON.stringify({ tier: newTier, xp: newXP })
        ]
      );
    }
  } catch (error) {
    console.error('Add battle pass XP error:', error);
  }
}

export default router;
