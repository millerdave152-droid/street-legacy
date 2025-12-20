import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { withTransaction, lockRowForUpdate, lockRowsForUpdate } from '../db/transaction.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate, validateParams } from '../validation/validate.middleware.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const targetIdParamSchema = z.object({
  targetId: z.coerce.number().int().positive('Invalid target ID')
});

const combatActionSchema = z.object({
  body: z.object({
    action: z.enum(['attack', 'defend', 'heavy_attack', 'flee'], {
      message: 'Invalid action. Must be: attack, defend, heavy_attack, or flee'
    })
  })
});

const historyQuerySchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(50).optional().default(20)
  })
});

// Combat configuration
const COMBAT_CONFIG = {
  minStaminaPercent: 25,
  maxLevelDifference: 10,
  cooldownMinutes: 30,
  maxRounds: 10,
  baseLootPercent: 10,
  maxLootPercent: 25,
  fleeChanceBase: 30,
  fleeDamagePercent: 15,
  fleeCashLossPercent: 5,
  actionTimeoutSeconds: 60,
  combatXpBase: 50,
  combatXpPerDamage: 1,
  xpPerLevel: 1000
};

// Combat actions
type CombatAction = 'attack' | 'defend' | 'heavy_attack' | 'flee';

interface CombatStats {
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  accuracy: number;
  evasion: number;
}

// Get player combat stats with all bonuses
async function getPlayerCombatStats(playerId: number): Promise<CombatStats & { level: number; stamina: number; staminaMax: number }> {
  const result = await pool.query(`
    SELECT
      p.health, p.max_health, p.attack, p.defense, p.accuracy, p.evasion,
      p.level, p.stamina, p.stamina as stamina_max,
      COALESCE(
        (SELECT SUM((stat_modifiers->>'attack')::int) FROM player_combat_buffs
         WHERE player_id = p.id AND is_active = true AND expires_at > NOW()), 0
      ) as buff_attack,
      COALESCE(
        (SELECT SUM((stat_modifiers->>'defense')::int) FROM player_combat_buffs
         WHERE player_id = p.id AND is_active = true AND expires_at > NOW()), 0
      ) as buff_defense,
      COALESCE(
        (SELECT SUM((stat_modifiers->>'accuracy')::int) FROM player_combat_buffs
         WHERE player_id = p.id AND is_active = true AND expires_at > NOW()), 0
      ) as buff_accuracy,
      COALESCE(
        (SELECT SUM((stat_modifiers->>'evasion')::int) FROM player_combat_buffs
         WHERE player_id = p.id AND is_active = true AND expires_at > NOW()), 0
      ) as buff_evasion
    FROM players p
    WHERE p.id = $1
  `, [playerId]);

  if (result.rows.length === 0) {
    throw new Error('Player not found');
  }

  const p = result.rows[0];

  // Apply injury effects
  const injuryResult = await pool.query(`
    SELECT effects FROM injuries
    WHERE player_id = $1 AND is_healed = false AND heals_at > NOW()
  `, [playerId]);

  let injuryPenalties = { attack: 0, defense: 0, accuracy: 0, evasion: 0, max_health: 0 };
  for (const injury of injuryResult.rows) {
    const effects = injury.effects || {};
    injuryPenalties.attack += effects.attack || 0;
    injuryPenalties.defense += effects.defense || 0;
    injuryPenalties.accuracy += effects.accuracy || 0;
    injuryPenalties.evasion += effects.evasion || 0;
    injuryPenalties.max_health += effects.max_health || 0;
  }

  return {
    health: p.health,
    maxHealth: Math.max(10, p.max_health + injuryPenalties.max_health),
    attack: Math.max(1, p.attack + p.buff_attack + injuryPenalties.attack),
    defense: Math.max(0, p.defense + p.buff_defense + injuryPenalties.defense),
    accuracy: Math.max(10, Math.min(95, p.accuracy + p.buff_accuracy + injuryPenalties.accuracy)),
    evasion: Math.max(0, Math.min(80, p.evasion + p.buff_evasion + injuryPenalties.evasion)),
    level: p.level,
    stamina: p.stamina,
    staminaMax: p.stamina_max || 100
  };
}

// Calculate damage for an attack
function calculateDamage(attackerStats: CombatStats, defenderStats: CombatStats, action: CombatAction): {
  damage: number;
  hit: boolean;
  critical: boolean;
} {
  // Check if hit lands (accuracy vs evasion)
  const hitChance = Math.max(20, Math.min(95, attackerStats.accuracy - defenderStats.evasion + 50));
  const hitRoll = Math.random() * 100;
  const hit = hitRoll <= hitChance;

  if (!hit) {
    return { damage: 0, hit: false, critical: false };
  }

  // Calculate base damage
  let baseDamage = attackerStats.attack;
  let defenseMultiplier = 1;

  if (action === 'heavy_attack') {
    baseDamage *= 1.5; // Heavy attack does more damage
  }

  // Apply defense
  const effectiveDefense = defenderStats.defense * defenseMultiplier;
  const damageReduction = effectiveDefense / (effectiveDefense + 50); // Diminishing returns

  // Randomize damage (80-120% of base)
  const randomMultiplier = 0.8 + Math.random() * 0.4;
  let damage = Math.floor(baseDamage * randomMultiplier * (1 - damageReduction));

  // Critical hit chance (5%)
  const critical = Math.random() < 0.05;
  if (critical) {
    damage = Math.floor(damage * 1.5);
  }

  return { damage: Math.max(1, damage), hit: true, critical };
}

// POST /api/combat/attack/:targetId - Initiate combat
// Validation ensures targetId is a positive integer
router.post('/attack/:targetId', authMiddleware, validateParams(targetIdParamSchema), async (req: AuthRequest, res: Response) => {
  try {
    const attackerId = req.player!.id;
    const targetId = parseInt(req.params.targetId); // Already validated as valid number

    if (attackerId === targetId) {
      return res.status(400).json({ success: false, error: 'Cannot attack yourself' });
    }

    // Check if attacker has active combat
    const activeCombatCheck = await pool.query(`
      SELECT id FROM combat_sessions
      WHERE (attacker_id = $1 OR defender_id = $1) AND status = 'active'
    `, [attackerId]);

    if (activeCombatCheck.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'You are already in combat' });
    }

    // Check if target exists and is valid
    const targetResult = await pool.query(`
      SELECT id, username, level, health, max_health, current_district_id, is_hospitalized,
             stamina, crew_id
      FROM players WHERE id = $1
    `, [targetId]);

    if (targetResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Target not found' });
    }

    const target = targetResult.rows[0];

    // Get attacker info
    const attackerResult = await pool.query(`
      SELECT id, username, level, health, max_health, current_district_id, is_hospitalized,
             stamina, crew_id
      FROM players WHERE id = $1
    `, [attackerId]);

    const attacker = attackerResult.rows[0];

    // Check hospitalization
    if (attacker.is_hospitalized) {
      return res.status(400).json({ success: false, error: 'You cannot fight while hospitalized' });
    }

    if (target.is_hospitalized) {
      return res.status(400).json({ success: false, error: 'Target is hospitalized' });
    }

    // Check same district
    if (attacker.current_district_id !== target.current_district_id) {
      return res.status(400).json({ success: false, error: 'Target is not in your district' });
    }

    // Check stamina
    const attackerStaminaPercent = (attacker.stamina / 100) * 100;
    if (attackerStaminaPercent < COMBAT_CONFIG.minStaminaPercent) {
      return res.status(400).json({
        success: false,
        error: `You need at least ${COMBAT_CONFIG.minStaminaPercent}% stamina to fight`
      });
    }

    // Check level difference
    const levelDiff = Math.abs(attacker.level - target.level);
    if (levelDiff > COMBAT_CONFIG.maxLevelDifference) {
      return res.status(400).json({
        success: false,
        error: `Target is too far from your level (max ${COMBAT_CONFIG.maxLevelDifference} level difference)`
      });
    }

    // Check crew (can't attack crew members)
    if (attacker.crew_id && attacker.crew_id === target.crew_id) {
      return res.status(400).json({ success: false, error: 'Cannot attack crew members' });
    }

    // Check cooldown
    const cooldownCheck = await pool.query(`
      SELECT cooldown_until FROM combat_cooldowns
      WHERE attacker_id = $1 AND target_id = $2 AND cooldown_until > NOW()
    `, [attackerId, targetId]);

    if (cooldownCheck.rows.length > 0) {
      const cooldownEnd = new Date(cooldownCheck.rows[0].cooldown_until);
      return res.status(400).json({
        success: false,
        error: 'Cannot attack this player yet',
        cooldownEnds: cooldownEnd
      });
    }

    // Check safe zone
    const safeZoneCheck = await pool.query(`
      SELECT id, name FROM safe_zones
      WHERE district_id = $1 AND is_active = true
    `, [attacker.current_district_id]);

    if (safeZoneCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot fight in ${safeZoneCheck.rows[0].name} - this is a safe zone`
      });
    }

    // Check if target is in active combat
    const targetCombatCheck = await pool.query(`
      SELECT id FROM combat_sessions
      WHERE (attacker_id = $1 OR defender_id = $1) AND status = 'active'
    `, [targetId]);

    if (targetCombatCheck.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Target is already in combat' });
    }

    // All checks passed - create combat session
    const combatResult = await pool.query(`
      INSERT INTO combat_sessions
        (attacker_id, defender_id, district_id, attacker_health, defender_health,
         attacker_starting_health, defender_starting_health, combat_log)
      VALUES ($1, $2, $3, $4, $5, $4, $5, $6)
      RETURNING *
    `, [
      attackerId, targetId, attacker.current_district_id,
      attacker.health, target.health,
      JSON.stringify([{
        round: 0,
        type: 'combat_start',
        message: `${attacker.username} attacked ${target.username}!`,
        timestamp: new Date().toISOString()
      }])
    ]);

    // Update last combat time
    await pool.query(`
      UPDATE players SET last_combat_at = NOW() WHERE id IN ($1, $2)
    `, [attackerId, targetId]);

    res.json({
      success: true,
      data: {
        combatId: combatResult.rows[0].id,
        message: `Combat initiated with ${target.username}!`,
        attacker: {
          id: attackerId,
          username: attacker.username,
          health: attacker.health,
          maxHealth: attacker.max_health
        },
        defender: {
          id: targetId,
          username: target.username,
          health: target.health,
          maxHealth: target.max_health
        },
        currentRound: 1,
        maxRounds: COMBAT_CONFIG.maxRounds
      }
    });
  } catch (error) {
    console.error('Error initiating combat:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate combat' });
  }
});

// GET /api/combat/active - Get active combat session
router.get('/active', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(`
      SELECT
        cs.*,
        pa.username as attacker_username, pa.health as attacker_current_health, pa.max_health as attacker_max_health,
        pd.username as defender_username, pd.health as defender_current_health, pd.max_health as defender_max_health
      FROM combat_sessions cs
      JOIN players pa ON cs.attacker_id = pa.id
      JOIN players pd ON cs.defender_id = pd.id
      WHERE (cs.attacker_id = $1 OR cs.defender_id = $1) AND cs.status = 'active'
      LIMIT 1
    `, [playerId]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: { inCombat: false }
      });
    }

    const combat = result.rows[0];
    const isAttacker = combat.attacker_id === playerId;

    // Check for timeout
    const lastActionTime = new Date(combat.last_action_at).getTime();
    const now = Date.now();
    if (now - lastActionTime > COMBAT_CONFIG.actionTimeoutSeconds * 1000) {
      // Timeout - the player who didn't act loses
      const winnerId = isAttacker ?
        (combat.attacker_action ? combat.attacker_id : combat.defender_id) :
        (combat.defender_action ? combat.defender_id : combat.attacker_id);

      await endCombat(combat.id, winnerId === combat.attacker_id ? 'attacker_won' : 'defender_won', 'timeout');

      return res.json({
        success: true,
        data: {
          inCombat: false,
          combatEnded: true,
          reason: 'timeout'
        }
      });
    }

    res.json({
      success: true,
      data: {
        inCombat: true,
        combatId: combat.id,
        isAttacker,
        currentRound: combat.current_round,
        maxRounds: combat.max_rounds,
        yourHealth: isAttacker ? combat.attacker_health : combat.defender_health,
        yourMaxHealth: isAttacker ? combat.attacker_max_health : combat.defender_max_health,
        opponentHealth: isAttacker ? combat.defender_health : combat.attacker_health,
        opponentMaxHealth: isAttacker ? combat.defender_max_health : combat.attacker_max_health,
        opponentUsername: isAttacker ? combat.defender_username : combat.attacker_username,
        yourActionSubmitted: isAttacker ? !!combat.attacker_action : !!combat.defender_action,
        opponentActionSubmitted: isAttacker ? !!combat.defender_action : !!combat.attacker_action,
        combatLog: combat.combat_log || [],
        timeRemaining: Math.max(0, COMBAT_CONFIG.actionTimeoutSeconds - Math.floor((now - lastActionTime) / 1000))
      }
    });
  } catch (error) {
    console.error('Error getting active combat:', error);
    res.status(500).json({ success: false, error: 'Failed to get combat status' });
  }
});

// POST /api/combat/action - Submit combat action
// Validation ensures action is one of: attack, defend, heavy_attack, flee
router.post('/action', authMiddleware, validate(combatActionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { action } = req.body as { action: CombatAction };
    // Validation already ensures action is valid

    // Get active combat
    const combatResult = await pool.query(`
      SELECT * FROM combat_sessions
      WHERE (attacker_id = $1 OR defender_id = $1) AND status = 'active'
      FOR UPDATE
    `, [playerId]);

    if (combatResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Not in active combat' });
    }

    const combat = combatResult.rows[0];
    const isAttacker = combat.attacker_id === playerId;

    // Check if already submitted action
    if (isAttacker && combat.attacker_action) {
      return res.status(400).json({ success: false, error: 'Action already submitted for this round' });
    }
    if (!isAttacker && combat.defender_action) {
      return res.status(400).json({ success: false, error: 'Action already submitted for this round' });
    }

    // Handle flee attempt immediately
    if (action === 'flee') {
      const stats = await getPlayerCombatStats(playerId);
      const fleeChance = COMBAT_CONFIG.fleeChanceBase + stats.evasion / 2;
      const fleeSuccess = Math.random() * 100 < fleeChance;

      if (fleeSuccess) {
        // Successful flee
        const fleeDamage = Math.floor(stats.maxHealth * COMBAT_CONFIG.fleeDamagePercent / 100);
        const cashLost = Math.floor(stats.level * 100 * COMBAT_CONFIG.fleeCashLossPercent / 100);

        await pool.query(`
          UPDATE players SET health = GREATEST(1, health - $1), cash = GREATEST(0, cash - $2)
          WHERE id = $3
        `, [fleeDamage, cashLost, playerId]);

        await endCombat(combat.id, 'fled', isAttacker ? 'attacker_fled' : 'defender_fled');

        return res.json({
          success: true,
          data: {
            action: 'flee',
            success: true,
            message: 'You escaped from combat!',
            damageTaken: fleeDamage,
            cashLost,
            combatEnded: true
          }
        });
      } else {
        // Failed flee - counts as doing nothing this round
        await pool.query(`
          UPDATE combat_sessions
          SET ${isAttacker ? 'attacker_action' : 'defender_action'} = 'flee_failed',
              last_action_at = NOW()
          WHERE id = $1
        `, [combat.id]);

        return res.json({
          success: true,
          data: {
            action: 'flee',
            success: false,
            message: 'Failed to escape!',
            waitingForOpponent: true
          }
        });
      }
    }

    // Submit regular action
    await pool.query(`
      UPDATE combat_sessions
      SET ${isAttacker ? 'attacker_action' : 'defender_action'} = $1,
          last_action_at = NOW()
      WHERE id = $2
    `, [action, combat.id]);

    // Check if both players have submitted actions
    const updatedCombat = await pool.query(`
      SELECT * FROM combat_sessions WHERE id = $1
    `, [combat.id]);

    const currentCombat = updatedCombat.rows[0];

    if (currentCombat.attacker_action && currentCombat.defender_action) {
      // Resolve the round
      const roundResult = await resolveRound(currentCombat);
      return res.json({
        success: true,
        data: roundResult
      });
    }

    res.json({
      success: true,
      data: {
        action,
        message: 'Action submitted. Waiting for opponent...',
        waitingForOpponent: true
      }
    });
  } catch (error) {
    console.error('Error submitting combat action:', error);
    res.status(500).json({ success: false, error: 'Failed to submit action' });
  }
});

// Resolve a combat round
async function resolveRound(combat: any) {
  const attackerStats = await getPlayerCombatStats(combat.attacker_id);
  const defenderStats = await getPlayerCombatStats(combat.defender_id);

  const attackerAction = combat.attacker_action as CombatAction;
  const defenderAction = combat.defender_action as CombatAction;

  let attackerDamage = 0;
  let defenderDamage = 0;
  const roundLog: any[] = [];

  // Apply defend bonuses
  const attackerDefending = attackerAction === 'defend';
  const defenderDefending = defenderAction === 'defend';

  if (attackerDefending) {
    attackerStats.defense *= 1.5;
    roundLog.push({ type: 'action', player: 'attacker', message: 'Attacker takes a defensive stance' });
  }
  if (defenderDefending) {
    defenderStats.defense *= 1.5;
    roundLog.push({ type: 'action', player: 'defender', message: 'Defender takes a defensive stance' });
  }

  // Calculate attacker's damage to defender
  if (attackerAction === 'attack' || attackerAction === 'heavy_attack') {
    const result = calculateDamage(attackerStats, defenderStats, attackerAction);
    if (result.hit) {
      attackerDamage = result.damage;
      roundLog.push({
        type: 'damage',
        player: 'attacker',
        damage: attackerDamage,
        critical: result.critical,
        message: result.critical ?
          `CRITICAL HIT! Attacker deals ${attackerDamage} damage!` :
          `Attacker hits for ${attackerDamage} damage`
      });
    } else {
      roundLog.push({ type: 'miss', player: 'attacker', message: 'Attacker misses!' });
    }
  }

  // Calculate defender's damage to attacker
  if (defenderAction === 'attack' || defenderAction === 'heavy_attack') {
    const result = calculateDamage(defenderStats, attackerStats, defenderAction);
    if (result.hit) {
      defenderDamage = result.damage;
      roundLog.push({
        type: 'damage',
        player: 'defender',
        damage: defenderDamage,
        critical: result.critical,
        message: result.critical ?
          `CRITICAL HIT! Defender deals ${defenderDamage} damage!` :
          `Defender hits for ${defenderDamage} damage`
      });
    } else {
      roundLog.push({ type: 'miss', player: 'defender', message: 'Defender misses!' });
    }
  }

  // Apply damage
  const newAttackerHealth = Math.max(0, combat.attacker_health - defenderDamage);
  const newDefenderHealth = Math.max(0, combat.defender_health - attackerDamage);

  // Update combat log
  const existingLog = combat.combat_log || [];
  existingLog.push({
    round: combat.current_round,
    attackerAction,
    defenderAction,
    attackerDamage,
    defenderDamage,
    attackerHealth: newAttackerHealth,
    defenderHealth: newDefenderHealth,
    events: roundLog,
    timestamp: new Date().toISOString()
  });

  // Check for combat end
  let combatEnded = false;
  let winner: 'attacker' | 'defender' | 'draw' | null = null;

  if (newAttackerHealth <= 0 && newDefenderHealth <= 0) {
    combatEnded = true;
    winner = 'draw';
  } else if (newAttackerHealth <= 0) {
    combatEnded = true;
    winner = 'defender';
  } else if (newDefenderHealth <= 0) {
    combatEnded = true;
    winner = 'attacker';
  } else if (combat.current_round >= combat.max_rounds) {
    combatEnded = true;
    // Winner is who has more health percentage
    const attackerHealthPercent = newAttackerHealth / combat.attacker_starting_health;
    const defenderHealthPercent = newDefenderHealth / combat.defender_starting_health;
    if (attackerHealthPercent > defenderHealthPercent) {
      winner = 'attacker';
    } else if (defenderHealthPercent > attackerHealthPercent) {
      winner = 'defender';
    } else {
      winner = 'draw';
    }
  }

  if (combatEnded) {
    const status = winner === 'attacker' ? 'attacker_won' :
                   winner === 'defender' ? 'defender_won' : 'draw';
    return await endCombat(combat.id, status, 'combat_resolved', {
      attackerHealth: newAttackerHealth,
      defenderHealth: newDefenderHealth,
      combatLog: existingLog
    });
  }

  // Continue to next round
  await pool.query(`
    UPDATE combat_sessions
    SET attacker_health = $1, defender_health = $2,
        current_round = current_round + 1,
        attacker_action = NULL, defender_action = NULL,
        combat_log = $3, last_action_at = NOW()
    WHERE id = $4
  `, [newAttackerHealth, newDefenderHealth, JSON.stringify(existingLog), combat.id]);

  return {
    roundComplete: true,
    round: combat.current_round,
    attackerHealth: newAttackerHealth,
    defenderHealth: newDefenderHealth,
    roundLog,
    combatEnded: false,
    nextRound: combat.current_round + 1
  };
}

// End combat and distribute rewards
async function endCombat(combatId: number, status: string, reason: string, finalState?: any) {
  const combatCheck = await pool.query(`
    SELECT * FROM combat_sessions WHERE id = $1
  `, [combatId]);

  if (combatCheck.rows.length === 0) return { error: 'Combat not found' };

  const c = combatCheck.rows[0];
  const attackerHealth = finalState?.attackerHealth ?? c.attacker_health;
  const defenderHealth = finalState?.defenderHealth ?? c.defender_health;
  const combatLog = finalState?.combatLog ?? c.combat_log;

  return withTransaction(async (client) => {
    // Lock both players to prevent race conditions
    const players = await lockRowsForUpdate(client, 'players', [c.attacker_id, c.defender_id]);

    let winnerId: number | null = null;
    let loserId: number | null = null;
    let lootAmount = 0;
    let combatXp = 0;

    if (status === 'attacker_won') {
      winnerId = c.attacker_id;
      loserId = c.defender_id;
    } else if (status === 'defender_won') {
      winnerId = c.defender_id;
      loserId = c.attacker_id;
    }

    // Calculate loot and XP
    if (winnerId && loserId) {
      const loserResult = await client.query('SELECT cash, level FROM players WHERE id = $1', [loserId]);
      const loserCash = loserResult.rows[0].cash;
      const loserLevel = loserResult.rows[0].level;

      // Loot calculation (10-25% of loser's cash)
      const lootPercent = COMBAT_CONFIG.baseLootPercent +
        Math.random() * (COMBAT_CONFIG.maxLootPercent - COMBAT_CONFIG.baseLootPercent);
      lootAmount = Math.floor(loserCash * lootPercent / 100);

      // XP calculation
      combatXp = COMBAT_CONFIG.combatXpBase + (loserLevel * 10);

      // Transfer loot
      await client.query('UPDATE players SET cash = cash - $1 WHERE id = $2', [lootAmount, loserId]);
      await client.query('UPDATE players SET cash = cash + $1, combat_xp = combat_xp + $2 WHERE id = $3',
        [lootAmount, combatXp, winnerId]);

      // Update kill counts
      await client.query(`
        UPDATE players SET total_kills = total_kills + 1,
          current_kill_streak = current_kill_streak + 1,
          best_kill_streak = GREATEST(best_kill_streak, current_kill_streak + 1)
        WHERE id = $1
      `, [winnerId]);

      await client.query(`
        UPDATE players SET total_deaths = total_deaths + 1, current_kill_streak = 0
        WHERE id = $1
      `, [loserId]);

      // Log the kill
      await client.query(`
        INSERT INTO player_kill_log (killer_id, victim_id, district_id)
        VALUES ($1, $2, $3)
      `, [winnerId, loserId, c.district_id]);

      // Apply injuries to loser (pass client for transaction)
      await applyInjuryWithClient(client, loserId, c.defender_starting_health - defenderHealth, winnerId);

      // Check for auto-bounty (pass client for transaction)
      await checkAutoBountyWithClient(client, winnerId);
    }

    // Update player health
    await client.query('UPDATE players SET health = $1 WHERE id = $2', [Math.max(1, attackerHealth), c.attacker_id]);
    await client.query('UPDATE players SET health = $1 WHERE id = $2', [Math.max(1, defenderHealth), c.defender_id]);

    // Hospitalize if health is critical
    if (attackerHealth <= 0) {
      await hospitalizePlayerWithClient(client, c.attacker_id, 30); // 30 minutes
    }
    if (defenderHealth <= 0) {
      await hospitalizePlayerWithClient(client, c.defender_id, 30);
    }

    // Update combat session
    await client.query(`
      UPDATE combat_sessions
      SET status = $1, winner_id = $2, loot_amount = $3, combat_log = $4, ended_at = NOW(),
          attacker_health = $5, defender_health = $6
      WHERE id = $7
    `, [status, winnerId, lootAmount, JSON.stringify(combatLog), attackerHealth, defenderHealth, combatId]);

    // Record in history
    await client.query(`
      INSERT INTO combat_history
        (attacker_id, defender_id, winner_id, district_id, rounds_fought,
         attacker_damage_dealt, defender_damage_dealt, loot_transferred, combat_xp_gained)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      c.attacker_id, c.defender_id, winnerId, c.district_id, c.current_round,
      c.defender_starting_health - defenderHealth,
      c.attacker_starting_health - attackerHealth,
      lootAmount, combatXp
    ]);

    // Set cooldown
    const cooldownUntil = new Date(Date.now() + COMBAT_CONFIG.cooldownMinutes * 60 * 1000);
    await client.query(`
      INSERT INTO combat_cooldowns (attacker_id, target_id, cooldown_until)
      VALUES ($1, $2, $3)
      ON CONFLICT (attacker_id, target_id) DO UPDATE SET cooldown_until = $3
    `, [c.attacker_id, c.defender_id, cooldownUntil]);

    return {
      combatEnded: true,
      status,
      reason,
      winner: winnerId,
      loser: loserId,
      lootAmount,
      combatXp,
      finalAttackerHealth: attackerHealth,
      finalDefenderHealth: defenderHealth,
      combatLog
    };
  });
}

import { PoolClient } from 'pg';

// Apply injury based on damage taken (with transaction client)
async function applyInjuryWithClient(client: PoolClient, playerId: number, damageTaken: number, sourcePlayerId: number): Promise<void> {
  // Determine injury severity based on damage
  let severity = 1;
  if (damageTaken >= 75) severity = 5;
  else if (damageTaken >= 50) severity = 4;
  else if (damageTaken >= 35) severity = 3;
  else if (damageTaken >= 20) severity = 2;

  // Get random injury of appropriate severity
  const injuryResult = await client.query(`
    SELECT * FROM injury_types WHERE severity = $1 ORDER BY RANDOM() LIMIT 1
  `, [severity]);

  if (injuryResult.rows.length === 0) return;

  const injury = injuryResult.rows[0];
  const healsAt = new Date(Date.now() + injury.base_heal_minutes * 60 * 1000);

  await client.query(`
    INSERT INTO injuries (player_id, injury_type, injury_name, severity, effects, source, source_player_id, heals_at)
    VALUES ($1, $2, $3, $4, $5, 'combat', $6, $7)
  `, [playerId, injury.type_code, injury.name, severity, JSON.stringify(injury.effects), sourcePlayerId, healsAt]);
}

// Apply injury based on damage taken (standalone)
async function applyInjury(playerId: number, damageTaken: number, sourcePlayerId: number): Promise<void> {
  // Determine injury severity based on damage
  let severity = 1;
  if (damageTaken >= 75) severity = 5;
  else if (damageTaken >= 50) severity = 4;
  else if (damageTaken >= 35) severity = 3;
  else if (damageTaken >= 20) severity = 2;

  // Get random injury of appropriate severity
  const injuryResult = await pool.query(`
    SELECT * FROM injury_types WHERE severity = $1 ORDER BY RANDOM() LIMIT 1
  `, [severity]);

  if (injuryResult.rows.length === 0) return;

  const injury = injuryResult.rows[0];
  const healsAt = new Date(Date.now() + injury.base_heal_minutes * 60 * 1000);

  await pool.query(`
    INSERT INTO injuries (player_id, injury_type, injury_name, severity, effects, source, source_player_id, heals_at)
    VALUES ($1, $2, $3, $4, $5, 'combat', $6, $7)
  `, [playerId, injury.type_code, injury.name, severity, JSON.stringify(injury.effects), sourcePlayerId, healsAt]);
}

// Hospitalize a player (with transaction client)
async function hospitalizePlayerWithClient(client: PoolClient, playerId: number, minutes: number): Promise<void> {
  const releaseAt = new Date(Date.now() + minutes * 60 * 1000);
  await client.query(`
    UPDATE players SET is_hospitalized = true, hospital_release_at = $1 WHERE id = $2
  `, [releaseAt, playerId]);
}

// Hospitalize a player (standalone)
async function hospitalizePlayer(playerId: number, minutes: number): Promise<void> {
  const releaseAt = new Date(Date.now() + minutes * 60 * 1000);
  await pool.query(`
    UPDATE players SET is_hospitalized = true, hospital_release_at = $1 WHERE id = $2
  `, [releaseAt, playerId]);
}

// Check if player should get auto-bounty (with transaction client)
async function checkAutoBountyWithClient(client: PoolClient, killerId: number): Promise<void> {
  // Check kills in last 24 hours
  const killCountResult = await client.query(`
    SELECT COUNT(*) as kill_count FROM player_kill_log
    WHERE killer_id = $1 AND killed_at > NOW() - INTERVAL '24 hours'
  `, [killerId]);

  const killCount = parseInt(killCountResult.rows[0].kill_count);

  if (killCount >= 5) {
    // Check if already has auto-bounty
    const existingBounty = await client.query(`
      SELECT id FROM bounties
      WHERE target_player_id = $1 AND is_auto_bounty = true AND status = 'active'
    `, [killerId]);

    if (existingBounty.rows.length === 0) {
      // Place auto-bounty
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await client.query(`
        INSERT INTO bounties (target_player_id, amount, reason, is_anonymous, is_auto_bounty, auto_bounty_type, expires_at)
        VALUES ($1, 5000, 'Serial killer - 5+ kills in 24 hours', true, true, 'serial_killer', $2)
      `, [killerId, expiresAt]);

      await client.query(`
        UPDATE players SET bounties_on_head = bounties_on_head + 1 WHERE id = $1
      `, [killerId]);
    }
  }
}

// Check if player should get auto-bounty (standalone)
async function checkAutoBounty(killerId: number): Promise<void> {
  // Check kills in last 24 hours
  const killCountResult = await pool.query(`
    SELECT COUNT(*) as kill_count FROM player_kill_log
    WHERE killer_id = $1 AND killed_at > NOW() - INTERVAL '24 hours'
  `, [killerId]);

  const killCount = parseInt(killCountResult.rows[0].kill_count);

  if (killCount >= 5) {
    // Check if already has auto-bounty
    const existingBounty = await pool.query(`
      SELECT id FROM bounties
      WHERE target_player_id = $1 AND is_auto_bounty = true AND status = 'active'
    `, [killerId]);

    if (existingBounty.rows.length === 0) {
      // Place auto-bounty
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await pool.query(`
        INSERT INTO bounties (target_player_id, amount, reason, is_anonymous, is_auto_bounty, auto_bounty_type, expires_at)
        VALUES ($1, 5000, 'Serial killer - 5+ kills in 24 hours', true, true, 'serial_killer', $2)
      `, [killerId, expiresAt]);

      await pool.query(`
        UPDATE players SET bounties_on_head = bounties_on_head + 1 WHERE id = $1
      `, [killerId]);
    }
  }
}

// GET /api/combat/stats - Get player combat stats
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const stats = await getPlayerCombatStats(playerId);

    const recordResult = await pool.query(`
      SELECT total_kills, total_deaths, current_kill_streak, best_kill_streak,
             combat_level, combat_xp, bounties_claimed
      FROM players WHERE id = $1
    `, [playerId]);

    const record = recordResult.rows[0];

    // Get active injuries
    const injuriesResult = await pool.query(`
      SELECT injury_name, severity, effects, heals_at
      FROM injuries WHERE player_id = $1 AND is_healed = false AND heals_at > NOW()
    `, [playerId]);

    // Get active buffs
    const buffsResult = await pool.query(`
      SELECT buff_name, stat_modifiers, expires_at
      FROM player_combat_buffs WHERE player_id = $1 AND is_active = true AND expires_at > NOW()
    `, [playerId]);

    res.json({
      success: true,
      data: {
        stats,
        record: {
          kills: record.total_kills,
          deaths: record.total_deaths,
          kdr: record.total_deaths > 0 ? (record.total_kills / record.total_deaths).toFixed(2) : record.total_kills,
          currentStreak: record.current_kill_streak,
          bestStreak: record.best_kill_streak,
          combatLevel: record.combat_level,
          combatXp: record.combat_xp,
          xpToNextLevel: (record.combat_level + 1) * COMBAT_CONFIG.xpPerLevel - record.combat_xp,
          bountiesClaimed: record.bounties_claimed
        },
        injuries: injuriesResult.rows,
        buffs: buffsResult.rows
      }
    });
  } catch (error) {
    console.error('Error getting combat stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get combat stats' });
  }
});

// GET /api/combat/history - Get combat history
// Validation ensures limit is between 1 and 50
router.get('/history', authMiddleware, validate(historyQuerySchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const limit = req.query.limit as unknown as number; // Already validated and defaulted to 20

    const result = await pool.query(`
      SELECT
        ch.*,
        pa.username as attacker_username,
        pd.username as defender_username,
        pw.username as winner_username
      FROM combat_history ch
      JOIN players pa ON ch.attacker_id = pa.id
      JOIN players pd ON ch.defender_id = pd.id
      LEFT JOIN players pw ON ch.winner_id = pw.id
      WHERE ch.attacker_id = $1 OR ch.defender_id = $1
      ORDER BY ch.occurred_at DESC
      LIMIT $2
    `, [playerId, limit]);

    res.json({
      success: true,
      data: {
        history: result.rows.map(h => ({
          ...h,
          wasAttacker: h.attacker_id === playerId,
          won: h.winner_id === playerId
        }))
      }
    });
  } catch (error) {
    console.error('Error getting combat history:', error);
    res.status(500).json({ success: false, error: 'Failed to get history' });
  }
});

// Process timed out combat sessions
export async function processTimedOutCombats(): Promise<void> {
  try {
    // SECURITY: Use make_interval for parameterized interval
    const timedOut = await pool.query(`
      SELECT id, attacker_id, defender_id, attacker_action, defender_action
      FROM combat_sessions
      WHERE status = 'active'
        AND last_action_at < NOW() - make_interval(secs => $1)
    `, [COMBAT_CONFIG.actionTimeoutSeconds]);

    for (const combat of timedOut.rows) {
      // Whoever didn't submit action loses
      let status: string;
      if (!combat.attacker_action && !combat.defender_action) {
        status = 'draw';
      } else if (!combat.attacker_action) {
        status = 'defender_won';
      } else {
        status = 'attacker_won';
      }

      await endCombat(combat.id, status, 'timeout');
    }

    if (timedOut.rows.length > 0) {
      console.log(`Processed ${timedOut.rows.length} timed out combats`);
    }
  } catch (error) {
    console.error('Error processing timed out combats:', error);
  }
}

export default router;
