import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { modifyReputation } from '../services/reputationWeb.service.js';

const router = Router();

// Reputation level thresholds and names
const REPUTATION_LEVELS = [
  { min: -1000, max: -500, name: 'Hostile', canInteract: false, attackOnSight: true },
  { min: -499, max: -100, name: 'Unfriendly', canInteract: false, attackOnSight: false },
  { min: -99, max: 99, name: 'Neutral', canInteract: true, attackOnSight: false },
  { min: 100, max: 299, name: 'Friendly', canInteract: true, attackOnSight: false },
  { min: 300, max: 499, name: 'Trusted', canInteract: true, attackOnSight: false },
  { min: 500, max: 699, name: 'Respected', canInteract: true, attackOnSight: false },
  { min: 700, max: 899, name: 'Honored', canInteract: true, attackOnSight: false },
  { min: 900, max: 1000, name: 'Revered', canInteract: true, attackOnSight: false }
];

// Rank progression thresholds (2091 system)
const RANK_THRESHOLDS: Record<string, number> = {
  // Universal ranks
  outsider: 0,
  contact: 100,
  associate: 300,
  member: 500,
  trusted: 650,
  lieutenant: 800,
  commander: 900,
  council: 950,
  // Legacy ranks (mapped for backward compatibility)
  made: 650,
  captain: 800,
  underboss: 900,
  boss: 950
};

function getReputationLevel(rep: number) {
  return REPUTATION_LEVELS.find(l => rep >= l.min && rep <= l.max) || REPUTATION_LEVELS[2];
}

// 2091 Rank progression (new ranks)
function getRankForReputation(rep: number): string {
  if (rep >= RANK_THRESHOLDS.council) return 'council';
  if (rep >= RANK_THRESHOLDS.commander) return 'commander';
  if (rep >= RANK_THRESHOLDS.lieutenant) return 'lieutenant';
  if (rep >= RANK_THRESHOLDS.trusted) return 'trusted';
  if (rep >= RANK_THRESHOLDS.member) return 'member';
  if (rep >= RANK_THRESHOLDS.associate) return 'associate';
  if (rep >= RANK_THRESHOLDS.contact) return 'contact';
  return 'outsider';
}

// Get 2091 ranks only (for UI display)
const RANK_ORDER_2091 = ['outsider', 'contact', 'associate', 'member', 'trusted', 'lieutenant', 'commander', 'council'];

// GET /api/factions/list - All factions with player rep
router.get('/list', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(`
      SELECT
        f.*,
        COALESCE(pfr.reputation, 0) as player_reputation,
        COALESCE(pfr.rank, 'outsider') as player_rank,
        COALESCE(pfr.missions_completed, 0) as missions_completed,
        COALESCE(pfr.is_banned, false) as is_banned
      FROM factions f
      LEFT JOIN player_faction_rep pfr ON f.id = pfr.faction_id AND pfr.player_id = $1
      WHERE f.is_active = true
      ORDER BY f.power_level DESC
    `, [playerId]);

    const factions = result.rows.map(f => ({
      ...f,
      reputation_level: getReputationLevel(f.player_reputation),
      hostilities: f.hostilities || {},
      territory_district_ids: f.territory_district_ids || []
    }));

    res.json({
      success: true,
      data: { factions }
    });
  } catch (error) {
    console.error('Error fetching factions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch factions' });
  }
});

// GET /api/factions/relationships - Faction war/peace status
router.get('/relationships', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const warsResult = await pool.query(`
      SELECT
        fw.*,
        f1.name as aggressor_name,
        f1.icon as aggressor_icon,
        f2.name as defender_name,
        f2.icon as defender_icon
      FROM faction_wars fw
      JOIN factions f1 ON fw.aggressor_faction_id = f1.id
      JOIN factions f2 ON fw.defender_faction_id = f2.id
      WHERE fw.ended_at IS NULL
      ORDER BY fw.war_state DESC, fw.started_at DESC
    `);

    const factionsResult = await pool.query(`
      SELECT id, name, hostilities, icon, color
      FROM factions
      WHERE is_active = true
    `);

    res.json({
      success: true,
      data: {
        active_wars: warsResult.rows,
        factions: factionsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching faction relationships:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch relationships' });
  }
});

// GET /api/factions/:id/details - Faction info and ranks
router.get('/:id/details', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);

    const factionResult = await pool.query(`
      SELECT f.*
      FROM factions f
      WHERE f.id = $1 AND f.is_active = true
    `, [factionId]);

    if (factionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Faction not found' });
    }

    const faction = factionResult.rows[0];

    // Get player's standing
    const repResult = await pool.query(`
      SELECT * FROM player_faction_rep
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    const playerRep = repResult.rows[0] || {
      reputation: 0,
      rank: 'outsider',
      missions_completed: 0,
      members_killed: 0,
      money_donated: 0
    };

    // Get faction members (top players)
    const membersResult = await pool.query(`
      SELECT
        p.id, p.username, p.level,
        pfr.reputation, pfr.rank, pfr.missions_completed
      FROM player_faction_rep pfr
      JOIN players p ON pfr.player_id = p.id
      WHERE pfr.faction_id = $1 AND pfr.reputation >= 500
      ORDER BY pfr.reputation DESC
      LIMIT 20
    `, [factionId]);

    // Get active wars involving this faction
    const warsResult = await pool.query(`
      SELECT
        fw.*,
        CASE WHEN fw.aggressor_faction_id = $1 THEN f2.name ELSE f1.name END as enemy_name,
        CASE WHEN fw.aggressor_faction_id = $1 THEN f2.icon ELSE f1.icon END as enemy_icon,
        CASE WHEN fw.aggressor_faction_id = $1 THEN 'aggressor' ELSE 'defender' END as our_role
      FROM faction_wars fw
      JOIN factions f1 ON fw.aggressor_faction_id = f1.id
      JOIN factions f2 ON fw.defender_faction_id = f2.id
      WHERE (fw.aggressor_faction_id = $1 OR fw.defender_faction_id = $1)
        AND fw.ended_at IS NULL
    `, [factionId]);

    // Get safehouses if player has access
    let safehouses: any[] = [];
    if (playerRep.reputation >= 100) {
      const safehouseResult = await pool.query(`
        SELECT * FROM faction_safehouses
        WHERE faction_id = $1 AND is_active = true
          AND (
            min_rank = 'outsider' OR
            (min_rank = 'associate' AND $2 >= 500) OR
            (min_rank = 'member' AND $2 >= 700) OR
            (min_rank = 'made' AND $2 >= 800) OR
            (min_rank = 'captain' AND $2 >= 900)
          )
      `, [factionId, playerRep.reputation]);
      safehouses = safehouseResult.rows;
    }

    // Get story progress
    const storyResult = await pool.query(`
      SELECT * FROM faction_story_progress
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    res.json({
      success: true,
      data: {
        faction: {
          ...faction,
          hostilities: faction.hostilities || {},
          territory_district_ids: faction.territory_district_ids || []
        },
        player_standing: {
          ...playerRep,
          reputation_level: getReputationLevel(playerRep.reputation),
          next_rank: getRankForReputation(playerRep.reputation + 100),
          rep_to_next_rank: getNextRankThreshold(playerRep.reputation) - playerRep.reputation
        },
        members: membersResult.rows,
        active_wars: warsResult.rows,
        safehouses,
        story_progress: storyResult.rows[0] || null,
        rank_thresholds: RANK_THRESHOLDS
      }
    });
  } catch (error) {
    console.error('Error fetching faction details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch faction details' });
  }
});

function getNextRankThreshold(currentRep: number): number {
  const thresholds = Object.values(RANK_THRESHOLDS).sort((a, b) => a - b);
  for (const t of thresholds) {
    if (t > currentRep) return t;
  }
  return 1000;
}

// GET /api/factions/:id/shop - Faction dealer inventory
router.get('/:id/shop', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);

    // Check player reputation
    const repResult = await pool.query(`
      SELECT reputation, rank FROM player_faction_rep
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    const playerRep = repResult.rows[0]?.reputation || 0;
    const playerRank = repResult.rows[0]?.rank || 'outsider';

    if (playerRep < 100) {
      return res.status(403).json({
        success: false,
        error: 'You need at least Friendly reputation (100) to access the faction shop'
      });
    }

    // Get available items based on rank and reputation
    const itemsResult = await pool.query(`
      SELECT * FROM faction_shop_items
      WHERE faction_id = $1
        AND is_active = true
        AND min_reputation <= $2
        AND (stock_limit IS NULL OR current_stock > 0)
      ORDER BY base_price ASC
    `, [factionId, playerRep]);

    // Calculate discounts based on rank
    const rankIndex = Object.keys(RANK_THRESHOLDS).indexOf(playerRank);
    const items = itemsResult.rows.map(item => {
      const discount = item.discount_per_rank * rankIndex;
      const finalPrice = Math.floor(item.base_price * (1 - discount / 100));
      return {
        ...item,
        discount_percent: discount,
        final_price: finalPrice,
        can_purchase: canPurchaseItem(playerRank, item.min_rank)
      };
    });

    res.json({
      success: true,
      data: {
        items,
        player_rank: playerRank,
        player_reputation: playerRep
      }
    });
  } catch (error) {
    console.error('Error fetching faction shop:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch shop' });
  }
});

function canPurchaseItem(playerRank: string, requiredRank: string): boolean {
  const ranks = Object.keys(RANK_THRESHOLDS);
  return ranks.indexOf(playerRank) >= ranks.indexOf(requiredRank);
}

// POST /api/factions/:id/shop/:itemId/buy - Purchase from faction shop
router.post('/:id/shop/:itemId/buy', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);

    // Get player data and reputation
    const playerResult = await pool.query(`
      SELECT p.cash, pfr.reputation, pfr.rank
      FROM players p
      LEFT JOIN player_faction_rep pfr ON pfr.player_id = p.id AND pfr.faction_id = $2
      WHERE p.id = $1
    `, [playerId, factionId]);

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }

    const player = playerResult.rows[0];
    const playerRank = player.rank || 'outsider';
    const playerRep = player.reputation || 0;

    // Get item
    const itemResult = await pool.query(`
      SELECT * FROM faction_shop_items
      WHERE id = $1 AND faction_id = $2 AND is_active = true
    `, [itemId, factionId]);

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const item = itemResult.rows[0];

    // Check requirements
    if (!canPurchaseItem(playerRank, item.min_rank)) {
      return res.status(403).json({
        success: false,
        error: `You need to be at least ${item.min_rank} rank to purchase this item`
      });
    }

    if (playerRep < item.min_reputation) {
      return res.status(403).json({
        success: false,
        error: `You need at least ${item.min_reputation} reputation to purchase this item`
      });
    }

    // Calculate price with discount
    const rankIndex = Object.keys(RANK_THRESHOLDS).indexOf(playerRank);
    const discount = item.discount_per_rank * rankIndex;
    const finalPrice = Math.floor(item.base_price * (1 - discount / 100));

    if (player.cash < finalPrice) {
      return res.status(400).json({ success: false, error: 'Insufficient funds' });
    }

    // Check stock
    if (item.stock_limit !== null && item.current_stock <= 0) {
      return res.status(400).json({ success: false, error: 'Item out of stock' });
    }

    // Process purchase
    await pool.query('BEGIN');

    // Deduct cash
    await pool.query(`
      UPDATE players SET cash = cash - $1 WHERE id = $2
    `, [finalPrice, playerId]);

    // Update stock if limited
    if (item.stock_limit !== null) {
      await pool.query(`
        UPDATE faction_shop_items SET current_stock = current_stock - 1 WHERE id = $1
      `, [itemId]);
    }

    // Add item to player inventory based on type
    // This would integrate with your existing inventory system
    // For now, we'll just record the purchase

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Purchased ${item.name} for $${finalPrice.toLocaleString()}`,
        item_type: item.item_type,
        item_name: item.name,
        price_paid: finalPrice,
        discount_applied: discount
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error purchasing from faction shop:', error);
    res.status(500).json({ success: false, error: 'Failed to purchase item' });
  }
});

// POST /api/factions/:id/donate - Give money to faction
router.post('/:id/donate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);
    const { amount } = req.body;

    if (!amount || amount < 1000) {
      return res.status(400).json({
        success: false,
        error: 'Minimum donation is $1,000'
      });
    }

    // Check player cash
    const playerResult = await pool.query(`
      SELECT cash FROM players WHERE id = $1
    `, [playerId]);

    if (playerResult.rows[0].cash < amount) {
      return res.status(400).json({ success: false, error: 'Insufficient funds' });
    }

    // Check faction exists
    const factionResult = await pool.query(`
      SELECT id, name FROM factions WHERE id = $1 AND is_active = true
    `, [factionId]);

    if (factionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Faction not found' });
    }

    // Calculate reputation gain (+1 per $1000)
    const repGain = Math.floor(amount / 1000);

    await pool.query('BEGIN');

    // Deduct from player
    await pool.query(`
      UPDATE players SET cash = cash - $1 WHERE id = $2
    `, [amount, playerId]);

    // Add to faction wealth
    await pool.query(`
      UPDATE factions SET wealth = wealth + $1 WHERE id = $2
    `, [amount, factionId]);

    // Update reputation
    await pool.query(`
      INSERT INTO player_faction_rep (player_id, faction_id, reputation, money_donated, last_interaction)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (player_id, faction_id) DO UPDATE SET
        reputation = LEAST(1000, player_faction_rep.reputation + $3),
        money_donated = player_faction_rep.money_donated + $4,
        last_interaction = NOW()
    `, [playerId, factionId, repGain, amount]);

    // Get updated reputation
    const repResult = await pool.query(`
      SELECT reputation, rank FROM player_faction_rep
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    // Check for rank up
    const newRep = repResult.rows[0].reputation;
    const newRank = getRankForReputation(newRep);
    if (newRank !== repResult.rows[0].rank) {
      await pool.query(`
        UPDATE player_faction_rep SET rank = $1
        WHERE player_id = $2 AND faction_id = $3
      `, [newRank, playerId, factionId]);
    }

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Donated $${amount.toLocaleString()} to ${factionResult.rows[0].name}`,
        reputation_gained: repGain,
        new_reputation: newRep,
        new_rank: newRank,
        reputation_level: getReputationLevel(newRep)
      }
    });

    // Update contextual reputation - donations build trust (non-blocking)
    const trustGain = Math.min(10, Math.ceil(amount / 2500));
    modifyReputation(
      String(playerId),
      'faction',
      String(factionId),
      { trust: trustGain, respect: Math.ceil(trustGain / 2) },
      'Faction donation'
    ).catch(err => console.error('Faction donate contextual rep error:', err));
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error donating to faction:', error);
    res.status(500).json({ success: false, error: 'Failed to donate' });
  }
});

// GET /api/player/faction-standing - Player's all faction reps
router.get('/player/standing', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(`
      SELECT
        f.id, f.name, f.type, f.icon, f.color,
        COALESCE(pfr.reputation, 0) as reputation,
        COALESCE(pfr.rank, 'outsider') as rank,
        COALESCE(pfr.missions_completed, 0) as missions_completed,
        COALESCE(pfr.members_killed, 0) as members_killed,
        COALESCE(pfr.money_donated, 0) as money_donated,
        COALESCE(pfr.is_banned, false) as is_banned,
        pfr.joined_at
      FROM factions f
      LEFT JOIN player_faction_rep pfr ON f.id = pfr.faction_id AND pfr.player_id = $1
      WHERE f.is_active = true
      ORDER BY COALESCE(pfr.reputation, 0) DESC
    `, [playerId]);

    const standings = result.rows.map(row => ({
      ...row,
      reputation_level: getReputationLevel(row.reputation)
    }));

    // Group by relationship status
    const hostile = standings.filter(s => s.reputation <= -500);
    const unfriendly = standings.filter(s => s.reputation > -500 && s.reputation < -100);
    const neutral = standings.filter(s => s.reputation >= -100 && s.reputation < 100);
    const friendly = standings.filter(s => s.reputation >= 100 && s.reputation < 500);
    const allied = standings.filter(s => s.reputation >= 500);

    res.json({
      success: true,
      data: {
        all_standings: standings,
        grouped: { hostile, unfriendly, neutral, friendly, allied }
      }
    });
  } catch (error) {
    console.error('Error fetching player faction standing:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch standing' });
  }
});

// POST /api/factions/:id/join - Request to join faction
router.post('/:id/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);

    // Get faction requirements
    const factionResult = await pool.query(`
      SELECT * FROM factions WHERE id = $1 AND is_active = true
    `, [factionId]);

    if (factionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Faction not found' });
    }

    const faction = factionResult.rows[0];

    if (!faction.is_recruitable) {
      return res.status(400).json({
        success: false,
        error: 'This faction is not currently recruiting'
      });
    }

    // Get player data and current reputation
    const playerResult = await pool.query(`
      SELECT p.level, pfr.reputation, pfr.rank, pfr.is_banned
      FROM players p
      LEFT JOIN player_faction_rep pfr ON pfr.player_id = p.id AND pfr.faction_id = $2
      WHERE p.id = $1
    `, [playerId, factionId]);

    const player = playerResult.rows[0];

    if (player.is_banned) {
      return res.status(403).json({
        success: false,
        error: 'You have been banned from this faction'
      });
    }

    if (player.level < faction.min_level_to_join) {
      return res.status(400).json({
        success: false,
        error: `You must be level ${faction.min_level_to_join} to join this faction`
      });
    }

    const currentRep = player.reputation || 0;
    if (currentRep < 500) {
      return res.status(400).json({
        success: false,
        error: 'You need at least Respected reputation (500) to officially join a faction'
      });
    }

    // Check if already member of another faction
    const existingMembership = await pool.query(`
      SELECT f.name FROM player_faction_rep pfr
      JOIN factions f ON pfr.faction_id = f.id
      WHERE pfr.player_id = $1 AND pfr.rank != 'outsider' AND pfr.reputation >= 500
    `, [playerId]);

    if (existingMembership.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: `You are already a member of ${existingMembership.rows[0].name}. Leave first to join another faction.`
      });
    }

    // Join faction
    await pool.query(`
      UPDATE player_faction_rep
      SET rank = 'associate', joined_at = NOW()
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    // Update faction member count
    await pool.query(`
      UPDATE factions SET member_count = member_count + 1 WHERE id = $1
    `, [factionId]);

    res.json({
      success: true,
      data: {
        message: `Welcome to ${faction.name}! You are now an associate.`,
        rank: 'associate',
        faction: faction.name
      }
    });

    // Update contextual reputation - joining shows commitment (non-blocking)
    modifyReputation(
      String(playerId),
      'faction',
      String(factionId),
      { trust: 15, respect: 10 },
      'Joined faction'
    ).catch(err => console.error('Faction join contextual rep error:', err));
  } catch (error) {
    console.error('Error joining faction:', error);
    res.status(500).json({ success: false, error: 'Failed to join faction' });
  }
});

// POST /api/factions/:id/leave - Leave faction
router.post('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);

    // Check current membership
    const repResult = await pool.query(`
      SELECT pfr.*, f.name as faction_name
      FROM player_faction_rep pfr
      JOIN factions f ON pfr.faction_id = f.id
      WHERE pfr.player_id = $1 AND pfr.faction_id = $2
    `, [playerId, factionId]);

    if (repResult.rows.length === 0 || repResult.rows[0].rank === 'outsider') {
      return res.status(400).json({
        success: false,
        error: 'You are not a member of this faction'
      });
    }

    const membership = repResult.rows[0];

    // Leaving costs reputation
    const repPenalty = membership.rank === 'associate' ? 100 : 250;

    await pool.query('BEGIN');

    // Update reputation and rank
    await pool.query(`
      UPDATE player_faction_rep
      SET
        rank = 'outsider',
        reputation = GREATEST(-1000, reputation - $3),
        joined_at = NULL
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId, repPenalty]);

    // Update faction member count
    await pool.query(`
      UPDATE factions SET member_count = GREATEST(0, member_count - 1) WHERE id = $1
    `, [factionId]);

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `You have left ${membership.faction_name}. Your reputation has decreased by ${repPenalty}.`,
        reputation_penalty: repPenalty
      }
    });

    // Update contextual reputation - leaving is a betrayal (non-blocking)
    modifyReputation(
      String(playerId),
      'faction',
      String(factionId),
      { trust: -25, respect: -15 },
      'Left faction voluntarily'
    ).catch(err => console.error('Faction leave contextual rep error:', err));
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error leaving faction:', error);
    res.status(500).json({ success: false, error: 'Failed to leave faction' });
  }
});

// Helper function to modify reputation (used by other systems)
export async function modifyFactionReputation(
  playerId: number,
  factionId: number,
  amount: number,
  reason: string
): Promise<{ newReputation: number; newRank: string; levelName: string }> {
  // Ensure player has a rep record
  await pool.query(`
    INSERT INTO player_faction_rep (player_id, faction_id, reputation)
    VALUES ($1, $2, 0)
    ON CONFLICT (player_id, faction_id) DO NOTHING
  `, [playerId, factionId]);

  // Update reputation
  const result = await pool.query(`
    UPDATE player_faction_rep
    SET
      reputation = GREATEST(-1000, LEAST(1000, reputation + $3)),
      last_interaction = NOW()
    WHERE player_id = $1 AND faction_id = $2
    RETURNING reputation
  `, [playerId, factionId, amount]);

  const newRep = result.rows[0].reputation;
  const newRank = getRankForReputation(newRep);

  // Update rank if needed
  await pool.query(`
    UPDATE player_faction_rep SET rank = $3
    WHERE player_id = $1 AND faction_id = $2 AND rank != $3
  `, [playerId, factionId, newRank]);

  // Also update contextual reputation system (non-blocking)
  // Map the legacy amount to contextual dimensions
  const contextualChanges = amount >= 0
    ? { respect: Math.ceil(amount / 20), trust: Math.ceil(amount / 25) }
    : { respect: Math.floor(amount / 15), trust: Math.floor(amount / 20) };

  modifyReputation(
    String(playerId),
    'faction',
    String(factionId),
    contextualChanges,
    reason
  ).catch(err => console.error('Contextual faction rep update error:', err));

  return {
    newReputation: newRep,
    newRank,
    levelName: getReputationLevel(newRep).name
  };
}

// Helper to check if factions are at war
export async function areFactionsAtWar(faction1Id: number, faction2Id: number): Promise<boolean> {
  const result = await pool.query(`
    SELECT war_state FROM faction_wars
    WHERE ((aggressor_faction_id = $1 AND defender_faction_id = $2)
       OR (aggressor_faction_id = $2 AND defender_faction_id = $1))
      AND ended_at IS NULL
      AND war_state IN ('hot_war', 'total_war')
  `, [faction1Id, faction2Id]);

  return result.rows.length > 0;
}

// Process faction events periodically
export async function processFactionEvents(): Promise<void> {
  try {
    // Check for war escalations based on scores
    await pool.query(`
      UPDATE faction_wars
      SET war_state = 'hot_war', escalated_at = NOW()
      WHERE war_state = 'cold_war'
        AND (aggressor_score >= 100 OR defender_score >= 100)
        AND ended_at IS NULL
    `);

    // Check for war de-escalations (inactivity)
    await pool.query(`
      UPDATE faction_wars
      SET war_state = 'tension'
      WHERE war_state = 'cold_war'
        AND escalated_at < NOW() - INTERVAL '7 days'
        AND ended_at IS NULL
    `);

    console.log('Faction events processed');
  } catch (error) {
    console.error('Error processing faction events:', error);
  }
}

// =====================================================
// 2091 FACTION SYSTEM - ADDITIONAL FEATURES
// =====================================================

// Log faction action to history
export async function logFactionAction(
  playerId: number,
  factionId: number,
  actionType: string,
  reputationChange: number,
  description: string,
  relatedMissionId?: number
): Promise<void> {
  try {
    // Get current rank before change
    const currentResult = await pool.query(`
      SELECT rank FROM player_faction_rep
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    const oldRank = currentResult.rows[0]?.rank || 'outsider';
    const oldRep = currentResult.rows[0]?.reputation || 0;
    const newRep = Math.max(-1000, Math.min(1000, oldRep + reputationChange));
    const newRank = getRankForReputation(newRep);

    await pool.query(`
      INSERT INTO player_faction_history
        (player_id, faction_id, action_type, reputation_change, old_rank, new_rank, description, related_mission_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [playerId, factionId, actionType, reputationChange, oldRank, newRank, description, relatedMissionId || null]);
  } catch (error) {
    console.error('Error logging faction action:', error);
  }
}

// GET /api/factions/:id/history - Player's history with a faction
router.get('/:id/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await pool.query(`
      SELECT
        pfh.*,
        fm.name as mission_name
      FROM player_faction_history pfh
      LEFT JOIN faction_missions fm ON pfh.related_mission_id = fm.id
      WHERE pfh.player_id = $1 AND pfh.faction_id = $2
      ORDER BY pfh.timestamp DESC
      LIMIT $3 OFFSET $4
    `, [playerId, factionId, limit, offset]);

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM player_faction_history
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    res.json({
      success: true,
      data: {
        history: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('Error fetching faction history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

// GET /api/factions/:id/territories - Faction territory control (2091)
router.get('/:id/territories', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const factionId = parseInt(req.params.id);

    const result = await pool.query(`
      SELECT
        ft.*,
        f.name as faction_name,
        f.code as faction_code,
        cf.name as contested_by_name
      FROM faction_territories_2091 ft
      JOIN factions f ON ft.faction_id = f.id
      LEFT JOIN factions cf ON ft.contested_by = cf.id
      WHERE ft.faction_id = $1
      ORDER BY ft.control_percentage DESC
    `, [factionId]);

    // Calculate total daily income
    const totalIncome = result.rows.reduce((sum, t) => sum + (t.daily_income || 0), 0);

    res.json({
      success: true,
      data: {
        territories: result.rows,
        totalSectors: result.rows.length,
        totalDailyIncome: totalIncome
      }
    });
  } catch (error) {
    console.error('Error fetching faction territories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch territories' });
  }
});

// GET /api/factions/:id/resources - Faction resources (2091)
router.get('/:id/resources', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const factionId = parseInt(req.params.id);

    const result = await pool.query(`
      SELECT * FROM faction_resources
      WHERE faction_id = $1
      ORDER BY resource_type
    `, [factionId]);

    res.json({
      success: true,
      data: { resources: result.rows }
    });
  } catch (error) {
    console.error('Error fetching faction resources:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch resources' });
  }
});

// GET /api/factions/2091 - Get 2091 factions only (NNB, FFN, HNC, LST)
router.get('/2091', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(`
      SELECT
        f.*,
        COALESCE(pfr.reputation, 0) as player_reputation,
        COALESCE(pfr.rank, 'outsider') as player_rank,
        COALESCE(pfr.missions_completed, 0) as missions_completed,
        COALESCE(pfr.is_banned, false) as is_banned
      FROM factions f
      LEFT JOIN player_faction_rep pfr ON f.id = pfr.faction_id AND pfr.player_id = $1
      WHERE f.is_active = true AND f.code IN ('NNB', 'FFN', 'HNC', 'LST')
      ORDER BY f.power_level DESC
    `, [playerId]);

    const factions = result.rows.map(f => ({
      ...f,
      reputation_level: getReputationLevel(f.player_reputation),
      hostilities: f.hostilities || {},
      territory_district_ids: f.territory_district_ids || [],
      rank_thresholds: RANK_THRESHOLDS,
      rank_order: RANK_ORDER_2091
    }));

    res.json({
      success: true,
      data: {
        factions,
        factionCodes: ['NNB', 'FFN', 'HNC', 'LST'],
        rankOrder: RANK_ORDER_2091,
        rankThresholds: RANK_THRESHOLDS
      }
    });
  } catch (error) {
    console.error('Error fetching 2091 factions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch factions' });
  }
});

// =====================================================
// PHASE 4.3: FACTION MISSIONS
// =====================================================

// GET /api/factions/:id/missions - Get available faction missions
router.get('/:id/missions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);

    // Get player's reputation and rank
    const repResult = await pool.query(`
      SELECT reputation, rank FROM player_faction_rep
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    const playerRep = repResult.rows[0]?.reputation || 0;
    const playerRank = repResult.rows[0]?.rank || 'outsider';

    if (playerRep < 50) {
      return res.status(403).json({
        success: false,
        error: 'You need to establish contact with this faction first'
      });
    }

    // Get available missions based on rank and reputation
    const missionsResult = await pool.query(`
      SELECT
        fm.*,
        ef.name as enemy_faction_name,
        ef.icon as enemy_faction_icon,
        (
          SELECT COUNT(*) FROM faction_mission_completions fmc
          WHERE fmc.player_id = $1 AND fmc.mission_id = fm.id
          AND fmc.completed_at > NOW() - INTERVAL '24 hours'
        ) as completions_today,
        (
          SELECT MAX(completed_at) FROM faction_mission_completions fmc
          WHERE fmc.player_id = $1 AND fmc.mission_id = fm.id
        ) as last_completed
      FROM faction_missions fm
      LEFT JOIN factions ef ON fm.enemy_faction_id = ef.id
      WHERE fm.faction_id = $2
        AND fm.is_active = true
        AND fm.min_reputation <= $3
      ORDER BY fm.difficulty ASC, fm.reputation_reward DESC
    `, [playerId, factionId, playerRep]);

    // Filter by rank and check cooldowns
    const now = new Date();
    const missions = missionsResult.rows.filter(m => {
      // Check rank requirement
      if (!canAccessMission(playerRank, m.min_rank)) return false;

      // Check daily completions
      if (m.completions_today >= m.max_daily_completions) return false;

      // Check cooldown
      if (m.last_completed) {
        const cooldownEnd = new Date(m.last_completed);
        cooldownEnd.setHours(cooldownEnd.getHours() + m.cooldown_hours);
        if (now < cooldownEnd) return false;
      }

      return true;
    }).map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      missionType: m.mission_type,
      minRank: m.min_rank,
      minReputation: m.min_reputation,
      reputationReward: m.reputation_reward,
      cashReward: m.cash_reward,
      xpReward: m.xp_reward,
      enemyFaction: m.enemy_faction_name ? {
        name: m.enemy_faction_name,
        icon: m.enemy_faction_icon
      } : null,
      objectives: m.objectives,
      timeLimitMinutes: m.time_limit_minutes,
      difficulty: m.difficulty,
      requiresNeuralImplant: m.requires_neural_implant || false,
      hydranetDetectionRisk: m.hydranet_detection_risk || 0,
      isStoryMission: m.is_story_mission,
      storyOrder: m.story_order,
      icon: m.icon,
      cooldownHours: m.cooldown_hours,
      maxDaily: m.max_daily_completions,
      completionsToday: m.completions_today
    }));

    // Separate story and regular missions
    const storyMissions = missions.filter(m => m.isStoryMission).sort((a, b) => (a.storyOrder || 0) - (b.storyOrder || 0));
    const regularMissions = missions.filter(m => !m.isStoryMission);

    res.json({
      success: true,
      data: {
        storyMissions,
        regularMissions,
        playerRank,
        playerReputation: playerRep,
        rankOrder: RANK_ORDER_2091
      }
    });
  } catch (error) {
    console.error('Error fetching faction missions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch missions' });
  }
});

function canAccessMission(playerRank: string, requiredRank: string): boolean {
  const playerIndex = RANK_ORDER_2091.indexOf(playerRank);
  const requiredIndex = RANK_ORDER_2091.indexOf(requiredRank);
  if (playerIndex === -1 || requiredIndex === -1) return false;
  return playerIndex >= requiredIndex;
}

// POST /api/factions/:id/missions/:missionId/start - Start a faction mission
router.post('/:id/missions/:missionId/start', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);
    const missionId = parseInt(req.params.missionId);

    // Check if player already has an active mission for this faction
    const activeResult = await pool.query(`
      SELECT * FROM active_faction_missions
      WHERE player_id = $1 AND faction_id = $2 AND status = 'active'
    `, [playerId, factionId]);

    if (activeResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active mission for this faction. Complete or abandon it first.'
      });
    }

    // Get mission and verify eligibility
    const missionResult = await pool.query(`
      SELECT fm.*, f.name as faction_name
      FROM faction_missions fm
      JOIN factions f ON fm.faction_id = f.id
      WHERE fm.id = $1 AND fm.faction_id = $2 AND fm.is_active = true
    `, [missionId, factionId]);

    if (missionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Mission not found' });
    }

    const mission = missionResult.rows[0];

    // Check player reputation and rank
    const repResult = await pool.query(`
      SELECT reputation, rank FROM player_faction_rep
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    const playerRep = repResult.rows[0]?.reputation || 0;
    const playerRank = repResult.rows[0]?.rank || 'outsider';

    if (playerRep < mission.min_reputation) {
      return res.status(403).json({
        success: false,
        error: `You need at least ${mission.min_reputation} reputation for this mission`
      });
    }

    if (!canAccessMission(playerRank, mission.min_rank)) {
      return res.status(403).json({
        success: false,
        error: `You need to be at least ${mission.min_rank} rank for this mission`
      });
    }

    // Check daily completions and cooldown
    const completionCheck = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE completed_at > NOW() - INTERVAL '24 hours') as today_count,
        MAX(completed_at) as last_completed
      FROM faction_mission_completions
      WHERE player_id = $1 AND mission_id = $2
    `, [playerId, missionId]);

    if (parseInt(completionCheck.rows[0].today_count) >= mission.max_daily_completions) {
      return res.status(400).json({
        success: false,
        error: `You've reached the daily limit for this mission (${mission.max_daily_completions}/day)`
      });
    }

    if (completionCheck.rows[0].last_completed) {
      const cooldownEnd = new Date(completionCheck.rows[0].last_completed);
      cooldownEnd.setHours(cooldownEnd.getHours() + mission.cooldown_hours);
      if (new Date() < cooldownEnd) {
        const remainingMs = cooldownEnd.getTime() - Date.now();
        const remainingMins = Math.ceil(remainingMs / 60000);
        return res.status(400).json({
          success: false,
          error: `Mission on cooldown. Available in ${remainingMins} minutes.`
        });
      }
    }

    // Create active mission
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + mission.time_limit_minutes);

    const insertResult = await pool.query(`
      INSERT INTO active_faction_missions
        (player_id, mission_id, faction_id, status, progress, expires_at)
      VALUES ($1, $2, $3, 'active', '{}', $4)
      RETURNING *
    `, [playerId, missionId, factionId, expiresAt]);

    // Log the action
    await logFactionAction(
      playerId,
      factionId,
      'mission_started',
      0,
      `Started mission: ${mission.name}`,
      missionId
    );

    res.json({
      success: true,
      data: {
        activeMission: {
          id: insertResult.rows[0].id,
          missionId: mission.id,
          name: mission.name,
          description: mission.description,
          objectives: mission.objectives,
          timeLimitMinutes: mission.time_limit_minutes,
          expiresAt: expiresAt.toISOString(),
          status: 'active',
          progress: {},
          rewards: {
            reputation: mission.reputation_reward,
            cash: mission.cash_reward,
            xp: mission.xp_reward
          }
        },
        message: `Mission "${mission.name}" started! Complete before time runs out.`
      }
    });
  } catch (error) {
    console.error('Error starting faction mission:', error);
    res.status(500).json({ success: false, error: 'Failed to start mission' });
  }
});

// GET /api/factions/:id/missions/active - Get player's active mission for this faction
router.get('/:id/missions/active', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);

    const result = await pool.query(`
      SELECT
        afm.*,
        fm.name, fm.description, fm.objectives, fm.time_limit_minutes,
        fm.reputation_reward, fm.cash_reward, fm.xp_reward, fm.icon
      FROM active_faction_missions afm
      JOIN faction_missions fm ON afm.mission_id = fm.id
      WHERE afm.player_id = $1 AND afm.faction_id = $2 AND afm.status = 'active'
    `, [playerId, factionId]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: { activeMission: null }
      });
    }

    const m = result.rows[0];

    // Check if expired
    if (new Date(m.expires_at) < new Date()) {
      // Auto-fail expired mission
      await pool.query(`
        UPDATE active_faction_missions SET status = 'failed' WHERE id = $1
      `, [m.id]);

      await logFactionAction(playerId, factionId, 'mission_failed', -25, `Mission expired: ${m.name}`, m.mission_id);

      // Apply reputation penalty
      await pool.query(`
        UPDATE player_faction_rep
        SET reputation = GREATEST(-1000, reputation - 25)
        WHERE player_id = $1 AND faction_id = $2
      `, [playerId, factionId]);

      return res.json({
        success: true,
        data: {
          activeMission: null,
          expiredMission: {
            name: m.name,
            penalty: 25
          }
        }
      });
    }

    res.json({
      success: true,
      data: {
        activeMission: {
          id: m.id,
          missionId: m.mission_id,
          name: m.name,
          description: m.description,
          objectives: m.objectives,
          progress: m.progress,
          timeLimitMinutes: m.time_limit_minutes,
          expiresAt: m.expires_at,
          startedAt: m.started_at,
          status: m.status,
          rewards: {
            reputation: m.reputation_reward,
            cash: m.cash_reward,
            xp: m.xp_reward
          },
          icon: m.icon
        }
      }
    });
  } catch (error) {
    console.error('Error fetching active mission:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch active mission' });
  }
});

// POST /api/factions/:id/missions/:missionId/complete - Complete faction mission
router.post('/:id/missions/:missionId/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);
    const missionId = parseInt(req.params.missionId);

    // Get active mission
    const activeResult = await pool.query(`
      SELECT afm.*, fm.name, fm.reputation_reward, fm.cash_reward, fm.xp_reward
      FROM active_faction_missions afm
      JOIN faction_missions fm ON afm.mission_id = fm.id
      WHERE afm.player_id = $1 AND afm.mission_id = $2 AND afm.faction_id = $3 AND afm.status = 'active'
    `, [playerId, missionId, factionId]);

    if (activeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active mission found'
      });
    }

    const mission = activeResult.rows[0];

    // Check not expired
    if (new Date(mission.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Mission has expired'
      });
    }

    await pool.query('BEGIN');

    // Mark mission as completed
    await pool.query(`
      UPDATE active_faction_missions
      SET status = 'completed', completed_at = NOW()
      WHERE id = $1
    `, [mission.id]);

    // Record completion
    await pool.query(`
      INSERT INTO faction_mission_completions
        (player_id, mission_id, faction_id, was_successful, reputation_earned, cash_earned)
      VALUES ($1, $2, $3, true, $4, $5)
    `, [playerId, missionId, factionId, mission.reputation_reward, mission.cash_reward]);

    // Award rewards
    await pool.query(`
      UPDATE players
      SET cash = cash + $1, xp = xp + $2
      WHERE id = $3
    `, [mission.cash_reward, mission.xp_reward, playerId]);

    // Update faction reputation
    const repResult = await pool.query(`
      UPDATE player_faction_rep
      SET
        reputation = LEAST(1000, reputation + $3),
        missions_completed = missions_completed + 1,
        last_interaction = NOW()
      WHERE player_id = $1 AND faction_id = $2
      RETURNING reputation
    `, [playerId, factionId, mission.reputation_reward]);

    const newRep = repResult.rows[0].reputation;
    const newRank = getRankForReputation(newRep);

    // Check for rank up
    const oldRank = (await pool.query(`
      SELECT rank FROM player_faction_rep WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId])).rows[0]?.rank || 'outsider';

    let rankUp = false;
    if (newRank !== oldRank) {
      await pool.query(`
        UPDATE player_faction_rep SET rank = $3
        WHERE player_id = $1 AND faction_id = $2
      `, [playerId, factionId, newRank]);
      rankUp = true;
    }

    // Log the action
    await logFactionAction(
      playerId,
      factionId,
      'mission_completed',
      mission.reputation_reward,
      `Completed mission: ${mission.name}`,
      missionId
    );

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Mission "${mission.name}" completed!`,
        rewards: {
          reputation: mission.reputation_reward,
          cash: mission.cash_reward,
          xp: mission.xp_reward
        },
        newReputation: newRep,
        newRank,
        rankUp: rankUp ? { from: oldRank, to: newRank } : null
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error completing faction mission:', error);
    res.status(500).json({ success: false, error: 'Failed to complete mission' });
  }
});

// POST /api/factions/:id/missions/:missionId/abandon - Abandon faction mission
router.post('/:id/missions/:missionId/abandon', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);
    const missionId = parseInt(req.params.missionId);

    // Get active mission
    const activeResult = await pool.query(`
      SELECT afm.*, fm.name FROM active_faction_missions afm
      JOIN faction_missions fm ON afm.mission_id = fm.id
      WHERE afm.player_id = $1 AND afm.mission_id = $2 AND afm.faction_id = $3 AND afm.status = 'active'
    `, [playerId, missionId, factionId]);

    if (activeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active mission found'
      });
    }

    const mission = activeResult.rows[0];
    const reputationPenalty = 50;

    await pool.query('BEGIN');

    // Mark as abandoned
    await pool.query(`
      UPDATE active_faction_missions SET status = 'abandoned' WHERE id = $1
    `, [mission.id]);

    // Apply reputation penalty
    await pool.query(`
      UPDATE player_faction_rep
      SET reputation = GREATEST(-1000, reputation - $3)
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId, reputationPenalty]);

    // Log the action
    await logFactionAction(
      playerId,
      factionId,
      'mission_abandoned',
      -reputationPenalty,
      `Abandoned mission: ${mission.name}`,
      missionId
    );

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Mission "${mission.name}" abandoned. Reputation penalty: -${reputationPenalty}`,
        reputationPenalty
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error abandoning faction mission:', error);
    res.status(500).json({ success: false, error: 'Failed to abandon mission' });
  }
});

// =====================================================
// PHASE 4.4: FACTION TERRITORY CONTROL
// =====================================================

// GET /api/factions/territories/map - Get all territory control data
router.get('/territories/map', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        ft.*,
        f.name as faction_name,
        f.code as faction_code,
        f.color as faction_color,
        f.icon as faction_icon,
        cf.name as contested_by_name,
        cf.code as contested_by_code
      FROM faction_territories_2091 ft
      JOIN factions f ON ft.faction_id = f.id
      LEFT JOIN factions cf ON ft.contested_by = cf.id
      ORDER BY ft.sector_code
    `);

    // Group by sector
    const sectorMap: Record<string, any[]> = {};
    for (const row of result.rows) {
      if (!sectorMap[row.sector_code]) {
        sectorMap[row.sector_code] = [];
      }
      sectorMap[row.sector_code].push({
        factionId: row.faction_id,
        factionName: row.faction_name,
        factionCode: row.faction_code,
        factionColor: row.faction_color,
        factionIcon: row.faction_icon,
        controlPercentage: row.control_percentage,
        contestedBy: row.contested_by_name ? {
          name: row.contested_by_name,
          code: row.contested_by_code
        } : null,
        infrastructureControl: row.infrastructure_control,
        notableLocations: row.notable_locations || [],
        dailyIncome: row.daily_income,
        defenseRating: row.defense_rating
      });
    }

    // Calculate dominant faction per sector
    const sectors = Object.entries(sectorMap).map(([code, factions]) => {
      const dominant = factions.reduce((a, b) =>
        a.controlPercentage > b.controlPercentage ? a : b
      );
      const isContested = factions.length > 1 ||
        factions.some(f => f.contestedBy !== null);

      return {
        code,
        dominantFaction: dominant,
        allFactions: factions,
        isContested,
        totalControl: factions.reduce((sum, f) => sum + f.controlPercentage, 0)
      };
    });

    res.json({
      success: true,
      data: {
        sectors,
        totalSectors: sectors.length
      }
    });
  } catch (error) {
    console.error('Error fetching territory map:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch territory map' });
  }
});

// POST /api/factions/:id/territory/:sectorCode/attack - Attack enemy territory
router.post('/:id/territory/:sectorCode/attack', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const attackerFactionId = parseInt(req.params.id);
    const sectorCode = req.params.sectorCode;

    // Verify player is a member with sufficient rank
    const repResult = await pool.query(`
      SELECT reputation, rank FROM player_faction_rep
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, attackerFactionId]);

    const playerRank = repResult.rows[0]?.rank || 'outsider';
    if (!canAccessMission(playerRank, 'member')) {
      return res.status(403).json({
        success: false,
        error: 'You must be at least a member to participate in territory attacks'
      });
    }

    // Get territory data
    const territoryResult = await pool.query(`
      SELECT ft.*, f.name as defender_name, f.code as defender_code
      FROM faction_territories_2091 ft
      JOIN factions f ON ft.faction_id = f.id
      WHERE ft.sector_code = $1 AND ft.faction_id != $2
      ORDER BY ft.control_percentage DESC
      LIMIT 1
    `, [sectorCode, attackerFactionId]);

    if (territoryResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No enemy territory found in this sector'
      });
    }

    const territory = territoryResult.rows[0];

    // Check player has stamina/resources (simplified for now)
    const playerResult = await pool.query(`
      SELECT stamina FROM players WHERE id = $1
    `, [playerId]);

    if (playerResult.rows[0].stamina < 20) {
      return res.status(400).json({
        success: false,
        error: 'Not enough stamina for territory attack (requires 20)'
      });
    }

    // Calculate attack outcome (simplified combat)
    const attackRoll = Math.random() * 100;
    const defenseRating = territory.defense_rating || 50;
    const success = attackRoll > defenseRating * 0.8;

    await pool.query('BEGIN');

    // Deduct stamina
    await pool.query(`
      UPDATE players SET stamina = stamina - 20 WHERE id = $1
    `, [playerId]);

    let controlChange = 0;
    let message = '';

    if (success) {
      // Reduce defender control
      controlChange = Math.floor(Math.random() * 5) + 3; // 3-7% control reduction
      await pool.query(`
        UPDATE faction_territories_2091
        SET control_percentage = GREATEST(0, control_percentage - $1),
            contested_by = $2,
            last_conflict = NOW()
        WHERE id = $3
      `, [controlChange, attackerFactionId, territory.id]);

      // Check if attacker already has territory in this sector
      const existingResult = await pool.query(`
        SELECT id, control_percentage FROM faction_territories_2091
        WHERE faction_id = $1 AND sector_code = $2
      `, [attackerFactionId, sectorCode]);

      if (existingResult.rows.length > 0) {
        // Increase existing control
        await pool.query(`
          UPDATE faction_territories_2091
          SET control_percentage = LEAST(100, control_percentage + $1),
              last_conflict = NOW()
          WHERE id = $2
        `, [controlChange, existingResult.rows[0].id]);
      } else {
        // Create new territory foothold
        await pool.query(`
          INSERT INTO faction_territories_2091
            (faction_id, sector_code, control_percentage, infrastructure_control, defense_rating)
          VALUES ($1, $2, $3, '{"power": 0, "water": 0, "data": 0, "transit": 0}', 30)
        `, [attackerFactionId, sectorCode, controlChange]);
      }

      // Award reputation
      await pool.query(`
        UPDATE player_faction_rep
        SET reputation = LEAST(1000, reputation + 15),
            territories_defended = territories_defended + 1
        WHERE player_id = $1 AND faction_id = $2
      `, [playerId, attackerFactionId]);

      message = `Successful attack! Captured ${controlChange}% of ${sectorCode} from ${territory.defender_name}.`;

      // Log war contribution
      const warResult = await pool.query(`
        SELECT id FROM faction_wars
        WHERE (aggressor_faction_id = $1 AND defender_faction_id = $2)
           OR (aggressor_faction_id = $2 AND defender_faction_id = $1)
        AND ended_at IS NULL
      `, [attackerFactionId, territory.faction_id]);

      if (warResult.rows.length > 0) {
        await pool.query(`
          INSERT INTO faction_war_contributions
            (war_id, player_id, faction_id, territories_captured, contribution_score)
          VALUES ($1, $2, $3, 1, 50)
          ON CONFLICT DO NOTHING
        `, [warResult.rows[0].id, playerId, attackerFactionId]);
      }
    } else {
      // Failed attack - small reputation loss
      await pool.query(`
        UPDATE player_faction_rep
        SET reputation = GREATEST(-1000, reputation - 5)
        WHERE player_id = $1 AND faction_id = $2
      `, [playerId, attackerFactionId]);

      message = `Attack failed! ${territory.defender_name}'s defenses held in ${sectorCode}.`;
    }

    await logFactionAction(
      playerId,
      attackerFactionId,
      success ? 'territory_attack_success' : 'territory_attack_failed',
      success ? 15 : -5,
      message
    );

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        attackSuccess: success,
        message,
        controlChange: success ? controlChange : 0,
        sectorCode,
        defenderFaction: territory.defender_code,
        staminaUsed: 20
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error in territory attack:', error);
    res.status(500).json({ success: false, error: 'Failed to attack territory' });
  }
});

// POST /api/factions/:id/territory/:sectorCode/defend - Defend your faction's territory
router.post('/:id/territory/:sectorCode/defend', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);
    const sectorCode = req.params.sectorCode;

    // Verify membership
    const repResult = await pool.query(`
      SELECT reputation, rank FROM player_faction_rep
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    if (!repResult.rows[0] || repResult.rows[0].reputation < 100) {
      return res.status(403).json({
        success: false,
        error: 'You need at least 100 reputation to defend territory'
      });
    }

    // Get territory
    const territoryResult = await pool.query(`
      SELECT * FROM faction_territories_2091
      WHERE faction_id = $1 AND sector_code = $2
    `, [factionId, sectorCode]);

    if (territoryResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Your faction has no territory in this sector'
      });
    }

    const territory = territoryResult.rows[0];

    // Check stamina
    const playerResult = await pool.query(`
      SELECT stamina FROM players WHERE id = $1
    `, [playerId]);

    if (playerResult.rows[0].stamina < 15) {
      return res.status(400).json({
        success: false,
        error: 'Not enough stamina for defense patrol (requires 15)'
      });
    }

    await pool.query('BEGIN');

    // Deduct stamina
    await pool.query(`
      UPDATE players SET stamina = stamina - 15 WHERE id = $1
    `, [playerId]);

    // Increase defense rating temporarily (or permanently if contested)
    const defenseBoost = territory.contested_by ? 5 : 2;
    await pool.query(`
      UPDATE faction_territories_2091
      SET defense_rating = LEAST(100, defense_rating + $1)
      WHERE id = $2
    `, [defenseBoost, territory.id]);

    // Award reputation
    await pool.query(`
      UPDATE player_faction_rep
      SET reputation = LEAST(1000, reputation + 10),
          territories_defended = territories_defended + 1
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    // Clear contested status if defense is high enough
    if (territory.contested_by && territory.defense_rating + defenseBoost >= 75) {
      await pool.query(`
        UPDATE faction_territories_2091
        SET contested_by = NULL WHERE id = $1
      `, [territory.id]);
    }

    await logFactionAction(
      playerId,
      factionId,
      'territory_defended',
      10,
      `Defended ${sectorCode} (+${defenseBoost} defense)`
    );

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Patrolled ${sectorCode}. Defense rating increased by ${defenseBoost}.`,
        sectorCode,
        defenseBoost,
        newDefenseRating: Math.min(100, territory.defense_rating + defenseBoost),
        reputationGained: 10,
        staminaUsed: 15
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error defending territory:', error);
    res.status(500).json({ success: false, error: 'Failed to defend territory' });
  }
});

// GET /api/factions/:id/territory/income - Collect territory income
router.post('/:id/territory/collect-income', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);

    // Verify membership at trusted rank
    const repResult = await pool.query(`
      SELECT reputation, rank FROM player_faction_rep
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    if (!canAccessMission(repResult.rows[0]?.rank || 'outsider', 'trusted')) {
      return res.status(403).json({
        success: false,
        error: 'Only trusted members can collect territory income'
      });
    }

    // Get total faction territory income
    const incomeResult = await pool.query(`
      SELECT
        SUM(daily_income * control_percentage / 100) as total_income,
        COUNT(*) as territories_count
      FROM faction_territories_2091
      WHERE faction_id = $1 AND control_percentage > 0
    `, [factionId]);

    const totalIncome = Math.floor(incomeResult.rows[0].total_income || 0);
    const playerShare = Math.floor(totalIncome * 0.1); // Player gets 10% of daily income

    if (playerShare < 100) {
      return res.status(400).json({
        success: false,
        error: 'Not enough income to collect (minimum $100)'
      });
    }

    await pool.query('BEGIN');

    // Give player their share
    await pool.query(`
      UPDATE players SET cash = cash + $1 WHERE id = $2
    `, [playerShare, playerId]);

    // Update faction resources
    await pool.query(`
      UPDATE faction_resources
      SET quantity = quantity + $1
      WHERE faction_id = $2 AND resource_type = 'credits'
    `, [totalIncome - playerShare, factionId]);

    await logFactionAction(
      playerId,
      factionId,
      'income_collected',
      5,
      `Collected $${playerShare.toLocaleString()} territory income`
    );

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Collected $${playerShare.toLocaleString()} from territory operations`,
        playerShare,
        totalFactionIncome: totalIncome,
        territoriesCount: parseInt(incomeResult.rows[0].territories_count)
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error collecting income:', error);
    res.status(500).json({ success: false, error: 'Failed to collect income' });
  }
});

// =====================================================
// PHASE 4.5: CROSS-FACTION DIPLOMACY
// =====================================================

// GET /api/factions/diplomacy - Get all faction relationships
router.get('/diplomacy', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    // Get all factions
    const factionsResult = await pool.query(`
      SELECT id, name, code, icon, color, hostilities FROM factions
      WHERE is_active = true AND code IN ('NNB', 'FFN', 'HNC', 'LST')
    `);

    // Get all active wars/tensions
    const warsResult = await pool.query(`
      SELECT
        fw.*,
        f1.name as aggressor_name, f1.code as aggressor_code, f1.icon as aggressor_icon,
        f2.name as defender_name, f2.code as defender_code, f2.icon as defender_icon
      FROM faction_wars fw
      JOIN factions f1 ON fw.aggressor_faction_id = f1.id
      JOIN factions f2 ON fw.defender_faction_id = f2.id
      WHERE fw.ended_at IS NULL
      ORDER BY fw.war_state DESC
    `);

    // Build relationship matrix
    const factions = factionsResult.rows;
    const relationships: Record<string, Record<string, any>> = {};

    for (const f1 of factions) {
      relationships[f1.code] = {};
      for (const f2 of factions) {
        if (f1.id === f2.id) continue;

        const hostility = (f1.hostilities as Record<string, number>)?.[f2.id.toString()] || 50;
        let status = 'neutral';
        if (hostility <= 30) status = 'friendly';
        else if (hostility <= 45) status = 'wary';
        else if (hostility <= 60) status = 'tense';
        else if (hostility <= 80) status = 'hostile';
        else status = 'war';

        // Check for active war
        const war = warsResult.rows.find(w =>
          (w.aggressor_code === f1.code && w.defender_code === f2.code) ||
          (w.defender_code === f1.code && w.aggressor_code === f2.code)
        );

        relationships[f1.code][f2.code] = {
          hostility,
          status,
          warState: war?.war_state || null,
          warId: war?.id || null
        };
      }
    }

    res.json({
      success: true,
      data: {
        factions: factions.map(f => ({
          id: f.id,
          code: f.code,
          name: f.name,
          icon: f.icon,
          color: f.color
        })),
        relationships,
        activeWars: warsResult.rows.map(w => ({
          id: w.id,
          aggressor: { code: w.aggressor_code, name: w.aggressor_name, icon: w.aggressor_icon },
          defender: { code: w.defender_code, name: w.defender_name, icon: w.defender_icon },
          warState: w.war_state,
          aggressorScore: w.aggressor_score,
          defenderScore: w.defender_score,
          startedAt: w.started_at
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching diplomacy data:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch diplomacy data' });
  }
});

// POST /api/factions/:id/diplomacy/ally/:targetId - Request alliance (high rank only)
router.post('/:id/diplomacy/ally/:targetId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);
    const targetFactionId = parseInt(req.params.targetId);

    // Verify player is commander or council
    const repResult = await pool.query(`
      SELECT rank FROM player_faction_rep
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    if (!canAccessMission(repResult.rows[0]?.rank || 'outsider', 'commander')) {
      return res.status(403).json({
        success: false,
        error: 'Only commanders and council members can initiate diplomacy'
      });
    }

    // Get faction hostility
    const factionResult = await pool.query(`
      SELECT hostilities FROM factions WHERE id = $1
    `, [factionId]);

    const currentHostility = (factionResult.rows[0].hostilities as Record<string, number>)?.[targetFactionId.toString()] || 50;

    if (currentHostility > 60) {
      return res.status(400).json({
        success: false,
        error: 'Relations are too hostile for alliance talks. Improve relations first.'
      });
    }

    // Reduce hostility further
    const newHostility = Math.max(0, currentHostility - 15);
    const updatedHostilities = {
      ...(factionResult.rows[0].hostilities || {}),
      [targetFactionId.toString()]: newHostility
    };

    await pool.query(`
      UPDATE factions SET hostilities = $1 WHERE id = $2
    `, [JSON.stringify(updatedHostilities), factionId]);

    // Also reduce target's hostility
    const targetResult = await pool.query(`
      SELECT hostilities FROM factions WHERE id = $1
    `, [targetFactionId]);

    const targetHostility = (targetResult.rows[0].hostilities as Record<string, number>)?.[factionId.toString()] || 50;
    const newTargetHostility = Math.max(0, targetHostility - 10);
    const updatedTargetHostilities = {
      ...(targetResult.rows[0].hostilities || {}),
      [factionId.toString()]: newTargetHostility
    };

    await pool.query(`
      UPDATE factions SET hostilities = $1 WHERE id = $2
    `, [JSON.stringify(updatedTargetHostilities), targetFactionId]);

    const targetName = (await pool.query(`SELECT name FROM factions WHERE id = $1`, [targetFactionId])).rows[0].name;

    await logFactionAction(
      playerId,
      factionId,
      'diplomacy_alliance',
      25,
      `Initiated alliance talks with ${targetName}`
    );

    res.json({
      success: true,
      data: {
        message: `Alliance proposal sent to ${targetName}. Relations improved.`,
        previousHostility: currentHostility,
        newHostility,
        reputationGained: 25
      }
    });
  } catch (error) {
    console.error('Error in alliance diplomacy:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate diplomacy' });
  }
});

// POST /api/factions/:id/diplomacy/provoke/:targetId - Increase tensions (any member)
router.post('/:id/diplomacy/provoke/:targetId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);
    const targetFactionId = parseInt(req.params.targetId);

    // Verify membership
    const repResult = await pool.query(`
      SELECT reputation FROM player_faction_rep
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    if ((repResult.rows[0]?.reputation || 0) < 100) {
      return res.status(403).json({
        success: false,
        error: 'You need at least 100 reputation to engage in faction politics'
      });
    }

    // Increase hostility
    const factionResult = await pool.query(`
      SELECT hostilities FROM factions WHERE id = $1
    `, [factionId]);

    const currentHostility = (factionResult.rows[0].hostilities as Record<string, number>)?.[targetFactionId.toString()] || 50;
    const newHostility = Math.min(100, currentHostility + 10);

    const updatedHostilities = {
      ...(factionResult.rows[0].hostilities || {}),
      [targetFactionId.toString()]: newHostility
    };

    await pool.query(`
      UPDATE factions SET hostilities = $1 WHERE id = $2
    `, [JSON.stringify(updatedHostilities), factionId]);

    // Target also becomes more hostile
    const targetResult = await pool.query(`
      SELECT hostilities FROM factions WHERE id = $1
    `, [targetFactionId]);

    const targetHostility = (targetResult.rows[0].hostilities as Record<string, number>)?.[factionId.toString()] || 50;
    const newTargetHostility = Math.min(100, targetHostility + 15);

    const updatedTargetHostilities = {
      ...(targetResult.rows[0].hostilities || {}),
      [factionId.toString()]: newTargetHostility
    };

    await pool.query(`
      UPDATE factions SET hostilities = $1 WHERE id = $2
    `, [JSON.stringify(updatedTargetHostilities), targetFactionId]);

    // Check if war should start
    if (newHostility >= 80 && newTargetHostility >= 80) {
      // Check for existing war
      const existingWar = await pool.query(`
        SELECT id FROM faction_wars
        WHERE ((aggressor_faction_id = $1 AND defender_faction_id = $2)
           OR (aggressor_faction_id = $2 AND defender_faction_id = $1))
          AND ended_at IS NULL
      `, [factionId, targetFactionId]);

      if (existingWar.rows.length === 0) {
        // Start new war
        await pool.query(`
          INSERT INTO faction_wars (aggressor_faction_id, defender_faction_id, war_state)
          VALUES ($1, $2, 'tension')
        `, [factionId, targetFactionId]);
      } else {
        // Escalate existing tension
        await pool.query(`
          UPDATE faction_wars
          SET war_state = CASE
            WHEN war_state = 'tension' THEN 'cold_war'
            WHEN war_state = 'cold_war' THEN 'hot_war'
            ELSE war_state
          END,
          escalated_at = NOW()
          WHERE id = $1
        `, [existingWar.rows[0].id]);
      }
    }

    const targetName = (await pool.query(`SELECT name FROM factions WHERE id = $1`, [targetFactionId])).rows[0].name;

    await logFactionAction(
      playerId,
      factionId,
      'diplomacy_provocation',
      10,
      `Provoked ${targetName}, increasing tensions`
    );

    res.json({
      success: true,
      data: {
        message: `Provoked ${targetName}. Tensions are rising.`,
        previousHostility: currentHostility,
        newHostility,
        warThreshold: newHostility >= 80,
        reputationGained: 10
      }
    });
  } catch (error) {
    console.error('Error in provocation:', error);
    res.status(500).json({ success: false, error: 'Failed to provoke faction' });
  }
});

// POST /api/factions/:id/first-contact - Initial contact with a faction (2091)
router.post('/:id/first-contact', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const factionId = parseInt(req.params.id);

    // Get faction info
    const factionResult = await pool.query(`
      SELECT * FROM factions WHERE id = $1 AND is_active = true
    `, [factionId]);

    if (factionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Faction not found' });
    }

    const faction = factionResult.rows[0];

    // Check if already have reputation
    const existingRep = await pool.query(`
      SELECT * FROM player_faction_rep
      WHERE player_id = $1 AND faction_id = $2
    `, [playerId, factionId]);

    if (existingRep.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You already have a relationship with this faction'
      });
    }

    // Create initial contact record
    await pool.query(`
      INSERT INTO player_faction_rep
        (player_id, faction_id, reputation, rank, last_interaction)
      VALUES ($1, $2, 50, 'outsider', NOW())
    `, [playerId, factionId]);

    // Log the action
    await logFactionAction(
      playerId,
      factionId,
      'first_contact',
      50,
      `Made first contact with ${faction.name}`
    );

    res.json({
      success: true,
      data: {
        message: `You have made contact with ${faction.name}. ${faction.slogan || ''}`,
        factionCode: faction.code,
        initialReputation: 50,
        rank: 'outsider',
        hydranetChannel: faction.hydranet_channel
      }
    });

    // Initialize contextual reputation for this faction (non-blocking)
    modifyReputation(
      String(playerId),
      'faction',
      String(factionId),
      { respect: 0 },  // Just initialize with zero
      'First contact with faction'
    ).catch(err => console.error('Faction first-contact contextual rep error:', err));
  } catch (error) {
    console.error('Error making first contact:', error);
    res.status(500).json({ success: false, error: 'Failed to make contact' });
  }
});

export default router;
