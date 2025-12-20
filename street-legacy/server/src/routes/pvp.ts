import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { cancelBountySchema } from '../validation/schemas/index.js';
import { z } from 'zod';
import {
  notifyAttackReceived,
  notifyBountyPlaced,
  notifyStatUpdate,
  sendToUser
} from '../websocket/index.js';
import { createEvent, BountyClaimedEvent } from '../websocket/events.js';
import { logDistrictEvent } from '../services/districtEcosystem.service.js';
import { modifyReputation, propagateReputation } from '../services/reputationWeb.service.js';

// Local schemas for PvP routes
const attackPlayerSchema = z.object({
  body: z.object({
    targetId: z.number().int().positive()
  })
});

const placeBountySchema = z.object({
  body: z.object({
    targetId: z.number().int().positive(),
    amount: z.number().int().min(1000, 'Minimum bounty is $1,000'),
    reason: z.string().max(200).optional()
  })
});

const router = Router();

router.use(authMiddleware);

// Helper to get district ID string for ecosystem tracking
async function getDistrictIdString(districtNumericId: number): Promise<string | null> {
  try {
    const result = await pool.query(
      `SELECT LOWER(REPLACE(name, ' ', '_')) as district_id FROM districts WHERE id = $1`,
      [districtNumericId]
    );
    return result.rows[0]?.district_id || null;
  } catch {
    return null;
  }
}

// Helper: Get player combat power
async function getPlayerCombatPower(playerId: number): Promise<{ attack: number; defense: number }> {
  // Base stats from level
  const playerResult = await pool.query(
    `SELECT level FROM players WHERE id = $1`,
    [playerId]
  );
  const level = playerResult.rows[0]?.level || 1;
  let attack = level * 2;
  let defense = level * 2;

  // Add equipment bonuses
  const equipmentResult = await pool.query(
    `SELECT COALESCE(SUM(i.attack_bonus), 0) as total_attack,
            COALESCE(SUM(i.defense_bonus), 0) as total_defense
     FROM player_inventory pi
     JOIN items i ON pi.item_id = i.id
     WHERE pi.player_id = $1 AND pi.equipped = true`,
    [playerId]
  );
  attack += Number(equipmentResult.rows[0]?.total_attack) || 0;
  defense += Number(equipmentResult.rows[0]?.total_defense) || 0;

  return { attack, defense };
}

// GET /api/pvp - Get PvP arena and bounties
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player stats
    const playerResult = await pool.query(
      `SELECT p.*, ps.pvp_wins, ps.pvp_losses, ps.total_bounty_claimed
       FROM players p
       LEFT JOIN player_stats ps ON p.id = ps.player_id
       WHERE p.id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];

    // Get player combat power
    const combatPower = await getPlayerCombatPower(playerId);

    // Get potential targets (players within level range, not self, not in jail)
    const targetsResult = await pool.query(
      `SELECT p.id, p.username, p.level, p.cash,
              COALESCE(ps.pvp_wins, 0) as pvp_wins,
              COALESCE(ps.pvp_losses, 0) as pvp_losses
       FROM players p
       LEFT JOIN player_stats ps ON p.id = ps.player_id
       WHERE p.id != $1
         AND p.level BETWEEN $2 - 10 AND $2 + 10
         AND (p.jail_release_at IS NULL OR p.jail_release_at < NOW())
       ORDER BY p.level DESC, p.cash DESC
       LIMIT 20`,
      [playerId, player.level]
    );

    // Get active bounties
    const bountiesResult = await pool.query(
      `SELECT b.*, p.username as target_username, p.level as target_level,
              placer.username as placer_username
       FROM bounties b
       JOIN players p ON b.target_id = p.id
       JOIN players placer ON b.placer_id = placer.id
       WHERE b.status = 'active'
       ORDER BY b.amount DESC
       LIMIT 20`
    );

    // Get recent fights
    const fightsResult = await pool.query(
      `SELECT pf.*,
              a.username as attacker_username,
              d.username as defender_username
       FROM pvp_fights pf
       JOIN players a ON pf.attacker_id = a.id
       JOIN players d ON pf.defender_id = d.id
       WHERE pf.attacker_id = $1 OR pf.defender_id = $1
       ORDER BY pf.created_at DESC
       LIMIT 10`,
      [playerId]
    );

    // Check attack cooldown
    const cooldownResult = await pool.query(
      `SELECT created_at FROM pvp_fights
       WHERE attacker_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [playerId]
    );
    const lastAttack = cooldownResult.rows[0]?.created_at;
    const cooldownRemaining = lastAttack
      ? Math.max(0, 60000 - (Date.now() - new Date(lastAttack).getTime()))
      : 0;

    res.json({
      success: true,
      data: {
        player: {
          id: player.id,
          username: player.username,
          level: player.level,
          cash: player.cash,
          nerve: player.nerve,
          attack: combatPower.attack,
          defense: combatPower.defense,
          pvpWins: player.pvp_wins || 0,
          pvpLosses: player.pvp_losses || 0,
          totalBountyClaimed: player.total_bounty_claimed || 0
        },
        targets: targetsResult.rows.map(t => ({
          id: t.id,
          username: t.username,
          level: t.level,
          cash: t.cash,
          pvpWins: t.pvp_wins,
          pvpLosses: t.pvp_losses
        })),
        bounties: bountiesResult.rows.map(b => ({
          id: b.id,
          targetId: b.target_id,
          targetUsername: b.target_username,
          targetLevel: b.target_level,
          placerUsername: b.placer_username,
          amount: b.amount,
          reason: b.reason,
          createdAt: b.created_at
        })),
        recentFights: fightsResult.rows.map(f => ({
          id: f.id,
          attackerId: f.attacker_id,
          attackerUsername: f.attacker_username,
          defenderId: f.defender_id,
          defenderUsername: f.defender_username,
          winnerId: f.winner_id,
          cashStolen: f.cash_stolen,
          createdAt: f.created_at
        })),
        cooldownRemaining
      }
    });
  } catch (error) {
    console.error('PvP error:', error);
    res.status(500).json({ success: false, error: 'Failed to get PvP data' });
  }
});

// POST /api/pvp/attack - Attack another player
router.post('/attack', validate(attackPlayerSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { targetId } = req.body;

    if (targetId === playerId) {
      res.status(400).json({ success: false, error: 'Cannot attack yourself' });
      return;
    }

    // Check cooldown
    const cooldownResult = await pool.query(
      `SELECT created_at FROM pvp_fights
       WHERE attacker_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [playerId]
    );
    const lastAttack = cooldownResult.rows[0]?.created_at;
    if (lastAttack && Date.now() - new Date(lastAttack).getTime() < 60000) {
      res.status(400).json({ success: false, error: 'Attack on cooldown' });
      return;
    }

    // Get attacker
    const attackerResult = await pool.query(
      `SELECT * FROM players WHERE id = $1`,
      [playerId]
    );
    const attacker = attackerResult.rows[0];

    // Check nerve
    if (attacker.nerve < 5) {
      res.status(400).json({ success: false, error: 'Need 5 nerve to attack' });
      return;
    }

    // Check jail
    if (attacker.jail_release_at && new Date(attacker.jail_release_at) > new Date()) {
      res.status(400).json({ success: false, error: 'Cannot attack while in jail' });
      return;
    }

    // Get defender
    const defenderResult = await pool.query(
      `SELECT * FROM players WHERE id = $1`,
      [targetId]
    );
    const defender = defenderResult.rows[0];

    if (!defender) {
      res.status(404).json({ success: false, error: 'Target not found' });
      return;
    }

    // Check defender jail
    if (defender.jail_release_at && new Date(defender.jail_release_at) > new Date()) {
      res.status(400).json({ success: false, error: 'Target is in jail' });
      return;
    }

    // Get combat powers
    const attackerPower = await getPlayerCombatPower(playerId);
    const defenderPower = await getPlayerCombatPower(targetId);

    // Calculate fight outcome
    const attackRoll = (attackerPower.attack + Math.random() * 20);
    const defenseRoll = (defenderPower.defense + Math.random() * 20);
    const won = attackRoll > defenseRoll;

    let cashStolen = 0;
    let xpGained = 0;

    // Deduct nerve
    await pool.query(
      `UPDATE players SET nerve = nerve - 5 WHERE id = $1`,
      [playerId]
    );

    if (won) {
      // Winner gets 5-15% of defender's cash
      const stealPercent = 0.05 + Math.random() * 0.10;
      cashStolen = Math.floor(defender.cash * stealPercent);
      xpGained = Math.floor(10 + defender.level * 2);

      // Transfer cash
      await pool.query(
        `UPDATE players SET cash = cash - $1 WHERE id = $2`,
        [cashStolen, targetId]
      );
      await pool.query(
        `UPDATE players SET cash = cash + $1, xp = xp + $2 WHERE id = $3`,
        [cashStolen, xpGained, playerId]
      );

      // Update stats
      await pool.query(
        `INSERT INTO player_stats (player_id, pvp_wins)
         VALUES ($1, 1)
         ON CONFLICT (player_id)
         DO UPDATE SET pvp_wins = player_stats.pvp_wins + 1`,
        [playerId]
      );
      await pool.query(
        `INSERT INTO player_stats (player_id, pvp_losses)
         VALUES ($1, 1)
         ON CONFLICT (player_id)
         DO UPDATE SET pvp_losses = player_stats.pvp_losses + 1`,
        [targetId]
      );

      // Check if bounty exists on target
      const bountyResult = await pool.query(
        `SELECT * FROM bounties WHERE target_id = $1 AND status = 'active'`,
        [targetId]
      );
      if (bountyResult.rows.length > 0) {
        const bounty = bountyResult.rows[0];
        // Claim bounty
        await pool.query(
          `UPDATE bounties SET status = 'claimed', claimed_by = $1, claimed_at = NOW()
           WHERE id = $2`,
          [playerId, bounty.id]
        );
        await pool.query(
          `UPDATE players SET cash = cash + $1 WHERE id = $2`,
          [bounty.amount, playerId]
        );
        cashStolen += bounty.amount;

        await pool.query(
          `INSERT INTO player_stats (player_id, total_bounty_claimed)
           VALUES ($1, $2)
           ON CONFLICT (player_id)
           DO UPDATE SET total_bounty_claimed = player_stats.total_bounty_claimed + $2`,
          [playerId, bounty.amount]
        );
      }
    } else {
      // Loser loses some XP
      await pool.query(
        `UPDATE players SET xp = GREATEST(0, xp - 5) WHERE id = $1`,
        [playerId]
      );

      // Update stats
      await pool.query(
        `INSERT INTO player_stats (player_id, pvp_losses)
         VALUES ($1, 1)
         ON CONFLICT (player_id)
         DO UPDATE SET pvp_losses = player_stats.pvp_losses + 1`,
        [playerId]
      );
      await pool.query(
        `INSERT INTO player_stats (player_id, pvp_wins)
         VALUES ($1, 1)
         ON CONFLICT (player_id)
         DO UPDATE SET pvp_wins = player_stats.pvp_wins + 1`,
        [targetId]
      );
    }

    // Record fight
    await pool.query(
      `INSERT INTO pvp_fights (attacker_id, defender_id, winner_id, cash_stolen)
       VALUES ($1, $2, $3, $4)`,
      [playerId, targetId, won ? playerId : targetId, cashStolen]
    );

    // Send WebSocket notification to defender
    notifyAttackReceived(
      targetId,
      {
        id: playerId,
        username: attacker.username,
        level: attacker.level
      },
      won ? Math.floor(cashStolen * 0.1) : 0, // Damage representation
      defender.health || 100,
      won ? cashStolen : 0
    );

    // Update attacker stats via WebSocket
    const updatedAttacker = await pool.query(
      `SELECT cash, xp, nerve FROM players WHERE id = $1`,
      [playerId]
    );
    notifyStatUpdate(playerId, {
      cash: updatedAttacker.rows[0].cash,
      xp: updatedAttacker.rows[0].xp,
      nerve: updatedAttacker.rows[0].nerve
    });

    res.json({
      success: true,
      data: {
        won,
        attackRoll: Math.round(attackRoll),
        defenseRoll: Math.round(defenseRoll),
        cashStolen,
        xpGained: won ? xpGained : -5,
        message: won
          ? `Victory! You beat ${defender.username} and stole $${cashStolen.toLocaleString()}!`
          : `Defeat! ${defender.username} defended successfully.`
      }
    });

    // Log district ecosystem event (non-blocking) - use attacker's district
    if (attacker.current_district) {
      getDistrictIdString(attacker.current_district).then(districtIdStr => {
        if (districtIdStr) {
          logDistrictEvent({
            districtId: districtIdStr,
            eventType: 'player_attacked',
            playerId: String(playerId),
            targetPlayerId: String(targetId),
            severity: 4,
            metadata: {
              attackerId: playerId,
              defenderId: targetId,
              attackerWon: won,
              cashStolen
            }
          }).catch(err => console.error('District ecosystem log error:', err));
        }
      }).catch(err => console.error('District ID lookup error:', err));
    }

    // Update contextual reputation (non-blocking)
    (async () => {
      try {
        const districtIdStr = attacker.current_district
          ? await getDistrictIdString(attacker.current_district)
          : null;

        if (won) {
          // Winner gains fear and respect in district
          if (districtIdStr) {
            await modifyReputation(
              String(playerId),
              'district',
              districtIdStr,
              { fear: 5, respect: 2, heat: 2 },
              'Won PvP fight'
            );
            // Propagate to adjacent districts
            await propagateReputation(
              String(playerId),
              'district',
              districtIdStr,
              { fear: 5, respect: 2 }
            );
          }
          // Winner gains fear reputation with the defeated player
          await modifyReputation(
            String(playerId),
            'player',
            String(targetId),
            { fear: 10, respect: 3 },
            'Defeated in combat'
          );
        } else {
          // Loser loses respect in district
          if (districtIdStr) {
            await modifyReputation(
              String(playerId),
              'district',
              districtIdStr,
              { respect: -3 },
              'Lost PvP fight'
            );
          }
          // Defender who won gains fear reputation with the attacker
          await modifyReputation(
            String(targetId),
            'player',
            String(playerId),
            { fear: 8, respect: 2 },
            'Defended against attack'
          );
        }
      } catch (err) {
        console.error('PvP reputation update error:', err);
      }
    })();
  } catch (error) {
    console.error('Attack error:', error);
    res.status(500).json({ success: false, error: 'Failed to attack' });
  }
});

// POST /api/pvp/bounty - Place a bounty on a player
router.post('/bounty', validate(placeBountySchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { targetId, amount, reason } = req.body;

    if (targetId === playerId) {
      res.status(400).json({ success: false, error: 'Cannot place bounty on yourself' });
      return;
    }

    // Get placer
    const placerResult = await pool.query(
      `SELECT * FROM players WHERE id = $1`,
      [playerId]
    );
    const placer = placerResult.rows[0];

    if (placer.cash < amount) {
      res.status(400).json({ success: false, error: 'Not enough cash' });
      return;
    }

    // Get target
    const targetResult = await pool.query(
      `SELECT * FROM players WHERE id = $1`,
      [targetId]
    );
    const target = targetResult.rows[0];

    if (!target) {
      res.status(404).json({ success: false, error: 'Target not found' });
      return;
    }

    // Check for existing bounty
    const existingResult = await pool.query(
      `SELECT * FROM bounties WHERE target_id = $1 AND placer_id = $2 AND status = 'active'`,
      [targetId, playerId]
    );
    if (existingResult.rows.length > 0) {
      // Add to existing bounty
      await pool.query(
        `UPDATE bounties SET amount = amount + $1 WHERE target_id = $2 AND placer_id = $3 AND status = 'active'`,
        [amount, targetId, playerId]
      );
    } else {
      // Create new bounty
      await pool.query(
        `INSERT INTO bounties (target_id, placer_id, amount, reason, status)
         VALUES ($1, $2, $3, $4, 'active')`,
        [targetId, playerId, amount, reason || 'No reason given']
      );
    }

    // Deduct cash
    await pool.query(
      `UPDATE players SET cash = cash - $1 WHERE id = $2`,
      [amount, playerId]
    );

    // Get total bounty on target
    const totalBountyResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM bounties WHERE target_id = $1 AND status = 'active'`,
      [targetId]
    );
    const totalBounty = parseInt(totalBountyResult.rows[0].total);

    // Send WebSocket notification about bounty
    notifyBountyPlaced(
      targetId,
      target.username,
      amount,
      totalBounty,
      placer.username
    );

    // Update placer's cash via WebSocket
    notifyStatUpdate(playerId, { cash: placer.cash - amount });

    res.json({
      success: true,
      data: {
        message: `Placed $${amount.toLocaleString()} bounty on ${target.username}`,
        newCash: placer.cash - amount
      }
    });
  } catch (error) {
    console.error('Bounty error:', error);
    res.status(500).json({ success: false, error: 'Failed to place bounty' });
  }
});

// POST /api/pvp/bounty/cancel - Cancel your own bounty
router.post('/bounty/cancel', validate(cancelBountySchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { bountyId } = req.body;

    // Get bounty
    const bountyResult = await pool.query(
      `SELECT * FROM bounties WHERE id = $1 AND placer_id = $2 AND status = 'active'`,
      [bountyId, playerId]
    );

    if (bountyResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Bounty not found or cannot cancel' });
      return;
    }

    const bounty = bountyResult.rows[0];

    // Refund 50% of bounty
    const refund = Math.floor(bounty.amount * 0.5);

    await pool.query(
      `UPDATE bounties SET status = 'cancelled' WHERE id = $1`,
      [bountyId]
    );

    await pool.query(
      `UPDATE players SET cash = cash + $1 WHERE id = $2`,
      [refund, playerId]
    );

    res.json({
      success: true,
      data: {
        message: `Bounty cancelled. Refunded $${refund.toLocaleString()} (50%)`,
        refund
      }
    });
  } catch (error) {
    console.error('Cancel bounty error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel bounty' });
  }
});

export default router;
