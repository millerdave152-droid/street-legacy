import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { withTransaction, lockRowForUpdate } from '../db/transaction.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { z } from 'zod';
import { updateMissionProgress } from './missions.js';
import { getPrestigeBonuses } from './prestige.js';
import { checkAchievements, updatePlayerStats } from './achievements.js';
import { getTerritoryBonus } from './territory.js';
import { getEventBonuses } from './events.js';
import { cache, cacheKeys, cacheTTL } from '../utils/cache.js';
import { economyAudit } from '../utils/auditLog.js';
import {
  notifyStatUpdate,
  sendToUser,
  updateUserDistrict
} from '../websocket/index.js';
import { createEvent, LevelUpEvent, CrimeResultEvent } from '../websocket/events.js';
import { logDistrictEvent, getDistrictModifiers } from '../services/districtEcosystem.service.js';
import { modifyReputation, propagateReputation } from '../services/reputationWeb.service.js';
import { createWitnessedEvent } from '../services/witness.service.js';

const router = Router();

// Validation schemas for game routes
const crimeSchema = z.object({
  body: z.object({
    crimeId: z.string().min(1, 'Crime ID required').or(z.coerce.number().int().positive())
  })
});

const travelSchema = z.object({
  body: z.object({
    districtId: z.coerce.number().int().min(1).max(12, 'Invalid district ID')
  })
});

const depositWithdrawSchema = z.object({
  body: z.object({
    amount: z.coerce.number().int().positive('Amount must be positive').max(999999999999, 'Amount too large')
  })
});

// All game routes require auth
router.use(authMiddleware);

// XP required for each level (index = level)
const XP_PER_LEVEL = [0, 0, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000];

function getRequiredXP(level: number): number {
  return XP_PER_LEVEL[level] || level * 50000;
}

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

// GET /api/game/state
router.get('/state', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player with basic info - simplified query for compatibility
    const playerResult = await pool.query(
      `SELECT id, username, email,
              COALESCE(level, 1) as level,
              COALESCE(xp, 0) as xp,
              COALESCE(cash, 1000) as cash,
              COALESCE(bank, 0) as bank,
              COALESCE(energy, 100) as energy,
              COALESCE(nerve, 50) as nerve
       FROM players
       WHERE id = $1`,
      [playerId]
    );

    const player = playerResult.rows[0];
    if (!player) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    // Try to get crimes - handle both old and new schema
    let crimes: any[] = [];
    try {
      // Try new schema first (crime_types)
      const crimesResult = await pool.query(
        `SELECT id, name, description,
                COALESCE(category, 'petty') as category,
                COALESCE(required_level, 1) as min_level,
                COALESCE(energy_cost, 5) as energy_cost,
                COALESCE(success_rate, 50) as base_success_rate,
                COALESCE(payout_min, 10) as min_payout,
                COALESCE(payout_max, 100) as max_payout,
                COALESCE(cooldown_seconds, 30) as cooldown_seconds,
                COALESCE(has_minigame, false) as has_minigame,
                COALESCE(icon, 'hand-grab') as icon
         FROM crime_types
         ORDER BY COALESCE(required_level, 1), COALESCE(payout_min, 10)
         LIMIT 50`
      );
      crimes = crimesResult.rows;
    } catch (e) {
      // Try old schema (crimes table)
      try {
        const oldCrimesResult = await pool.query(
          `SELECT id, name, description,
                  'petty' as category,
                  COALESCE(min_level, 1) as min_level,
                  COALESCE(energy_cost, 5) as energy_cost,
                  COALESCE(base_success_rate, 50) as base_success_rate,
                  COALESCE(min_payout, 10) as min_payout,
                  COALESCE(max_payout, 100) as max_payout,
                  COALESCE(cooldown_seconds, 30) as cooldown_seconds,
                  false as has_minigame,
                  'hand-grab' as icon
           FROM crimes
           ORDER BY COALESCE(min_level, 1), COALESCE(min_payout, 10)
           LIMIT 50`
        );
        crimes = oldCrimesResult.rows;
      } catch (e2) {
        console.log('Neither crime_types nor crimes table available');
      }
    }

    // Try to get districts - handle both old and new schema
    let districts: any[] = [];
    try {
      // Try new schema first
      const districtsResult = await pool.query(
        `SELECT id, name, description,
                COALESCE(difficulty, 1) as difficulty,
                COALESCE(police_presence, 50) as police_presence,
                COALESCE(economy_level, 50) as wealth,
                COALESCE(is_starter_district, false) as is_starter
         FROM districts
         ORDER BY difficulty
         LIMIT 20`
      );
      districts = districtsResult.rows;
    } catch (e) {
      // Try old schema (districts with city column)
      try {
        const oldDistrictsResult = await pool.query(
          `SELECT id, name, city as description,
                  COALESCE(difficulty, 1) as difficulty,
                  COALESCE(police_presence, 50) as police_presence,
                  COALESCE(wealth, 50) as wealth,
                  true as is_starter
           FROM districts
           ORDER BY difficulty
           LIMIT 20`
        );
        districts = oldDistrictsResult.rows;
      } catch (e2) {
        console.log('Districts table not available');
      }
    }

    res.json({
      success: true,
      data: {
        player: {
          id: player.id,
          username: player.username,
          level: player.level || 1,
          xp: player.xp || 0,
          xpToNextLevel: getRequiredXP((player.level || 1) + 1),
          cash: player.cash || 1000,
          bank: player.bank || 0,
          energy: player.energy || 100,
          nerve: player.nerve || 50,
          stamina: player.energy || 100,
          staminaMax: 100,
          focus: player.nerve || 50,
          focusMax: 100,
          heat: 0,
          influence: 0,
          streetRep: 0,
          totalEarnings: 0,
          inJail: false,
          jailReleaseAt: null,
          isMaster: false,
          streetCred: 0,
          prestigeLevel: 0
        },
        currentDistrict: null,
        districts: districts,
        crimes: crimes,
        cooldowns: {}
      }
    });
  } catch (error: any) {
    console.error('Game state error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      column: error.column
    });
    res.status(500).json({ success: false, error: 'Failed to get game state', details: error.message });
  }
});

// POST /api/game/travel
// Validation ensures districtId is valid
router.post('/travel', validate(travelSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { districtId } = req.body;

    // Check player not in jail (master accounts bypass)
    const playerResult = await pool.query(
      `SELECT in_jail, jail_release_at, is_master FROM players WHERE id = $1`,
      [playerId]
    );
    const player = playerResult.rows[0];
    const isMaster = player?.is_master === true;

    if (!isMaster && player.in_jail && (!player.jail_release_at || new Date(player.jail_release_at) > new Date())) {
      res.status(400).json({ success: false, error: 'Cannot travel while in jail' });
      return;
    }

    // Verify district exists
    const districtResult = await pool.query(
      `SELECT id, name, city FROM districts WHERE id = $1`,
      [districtId]
    );

    if (districtResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'District not found' });
      return;
    }

    const district = districtResult.rows[0];

    // Update player location
    await pool.query(
      `UPDATE players SET current_district = $1, in_jail = FALSE, jail_release_at = NULL WHERE id = $2`,
      [districtId, playerId]
    );

    // WebSocket: Update presence tracking for district
    updateUserDistrict(playerId, districtId);

    res.json({
      success: true,
      data: {
        message: `Traveled to ${district.name}`,
        district
      }
    });
  } catch (error) {
    console.error('Travel error:', error);
    res.status(500).json({ success: false, error: 'Failed to travel' });
  }
});

// POST /api/game/crime
// Validation ensures crimeId is a positive integer
router.post('/crime', validate(crimeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { crimeId } = req.body;

    // Get crime first (doesn't need transaction)
    // Query crime_types table (the actual table name in migrations)
    // Try with is_active check first, then without (for seeded data that might not have is_active)
    let crimeResult = await pool.query(
      `SELECT id, name, description, category,
              COALESCE(required_level, 1) as min_level,
              COALESCE(payout_min, 50) as min_payout, COALESCE(payout_max, 200) as max_payout,
              COALESCE(success_rate, 70) as base_success_rate,
              COALESCE(heat_min, 3) as heat_min, COALESCE(heat_max, 10) as heat_max,
              COALESCE(heat_min, 5) as heat_generated,
              COALESCE(energy_cost, 5) as energy_cost,
              COALESCE(energy_cost, 5) as stamina_cost,
              COALESCE(energy_cost, 5) as nerve_cost,
              COALESCE(energy_cost, 5) as focus_cost,
              0 as influence_required,
              COALESCE(cooldown_seconds, 30) as cooldown_seconds,
              COALESCE(cooldown_seconds / 60, 5) as jail_minutes,
              COALESCE(has_minigame, false) as has_minigame,
              COALESCE(requires_weapon, false) as requires_weapon,
              COALESCE(xp_reward, 10) as xp_reward
       FROM crime_types WHERE id = $1 AND (is_active = true OR is_active IS NULL)`,
      [crimeId]
    );

    // If no result, try without the is_active check
    if (crimeResult.rows.length === 0) {
      crimeResult = await pool.query(
        `SELECT id, name, description, category,
                COALESCE(required_level, 1) as min_level,
                COALESCE(payout_min, 50) as min_payout, COALESCE(payout_max, 200) as max_payout,
                COALESCE(success_rate, 70) as base_success_rate,
                COALESCE(heat_min, 3) as heat_min, COALESCE(heat_max, 10) as heat_max,
                COALESCE(heat_min, 5) as heat_generated,
                COALESCE(energy_cost, 5) as energy_cost,
                COALESCE(energy_cost, 5) as stamina_cost,
                COALESCE(energy_cost, 5) as nerve_cost,
                COALESCE(energy_cost, 5) as focus_cost,
                0 as influence_required,
                COALESCE(cooldown_seconds, 30) as cooldown_seconds,
                COALESCE(cooldown_seconds / 60, 5) as jail_minutes,
                COALESCE(has_minigame, false) as has_minigame,
                COALESCE(requires_weapon, false) as requires_weapon,
                COALESCE(xp_reward, 10) as xp_reward
         FROM crime_types WHERE id = $1`,
        [crimeId]
      );
    }

    const crime = crimeResult.rows[0];

    if (!crime) {
      // Return helpful error with crime ID for debugging
      console.log(`Crime not found: ${crimeId}. Checking available crimes...`);
      const availableCrimes = await pool.query(`SELECT id FROM crime_types LIMIT 10`);
      console.log('Available crimes:', availableCrimes.rows.map(r => r.id));
      res.status(404).json({ success: false, error: `Crime '${crimeId}' not found. Check if crime_types table is seeded.` });
      return;
    }

    // Fetch prestige bonuses early (can run outside transaction, in parallel with initial checks)
    const prestigeBonusesPromise = getPrestigeBonuses(playerId);

    // Execute crime within a transaction
    const result = await withTransaction(async (client) => {
      // Lock player row to prevent race conditions
      const playerResult = await client.query(
        `SELECT p.*, d.police_presence, d.wealth
         FROM players p
         LEFT JOIN districts d ON p.current_district = d.id
         WHERE p.id = $1
         FOR UPDATE OF p`,
        [playerId]
      );
      const player = playerResult.rows[0];
      const isMaster = player?.is_master === true;

      if (!player) {
        throw new Error('Player not found');
      }

      // Check jail status (master accounts bypass jail)
      if (player.in_jail && !isMaster) {
        if (!player.jail_release_at || new Date(player.jail_release_at) > new Date()) {
          throw new Error('Cannot commit crimes while in jail');
        }
      }

      // Default district values if player has no district
      // This allows crimes to work without a district set
      if (!player.current_district) {
        player.police_presence = 3;
        player.wealth = 5;
      }

      // Check level requirement (master accounts bypass)
      if (player.level < crime.min_level && !isMaster) {
        throw new Error(`Requires level ${crime.min_level}`);
      }

      // Get stamina/focus costs (fallback to energy/nerve for backward compatibility)
      const staminaCost = crime.stamina_cost || crime.energy_cost || 5;
      const focusCost = crime.focus_cost || crime.nerve_cost || 5;
      const heatGenerated = crime.heat_generated || 5;

      // Get player's stamina/focus (fallback to energy/nerve for backward compatibility)
      const playerStamina = player.stamina ?? player.energy ?? 100;
      const playerFocus = player.focus ?? player.nerve ?? 100;

      // Check stamina (master accounts have unlimited)
      if (playerStamina < staminaCost && !isMaster) {
        throw new Error('Not enough stamina');
      }

      // Check focus (master accounts have unlimited)
      if (playerFocus < focusCost && !isMaster) {
        throw new Error('Not enough focus');
      }

      // Get district ID for ecosystem tracking
      const districtId = player.current_district ? await getDistrictIdString(player.current_district) : null;

      // Run independent queries in parallel: cooldown, equipment, territory bonus, event bonuses, district modifiers
      const [cooldownResult, equipResult, territoryBonus, eventBonuses, prestigeBonuses, districtMods] = await Promise.all([
        // Check cooldown (master accounts bypass cooldowns)
        isMaster ? Promise.resolve({ rows: [] }) : client.query(
          `SELECT available_at FROM player_cooldowns WHERE player_id = $1 AND crime_id = $2 AND available_at > NOW()`,
          [playerId, crimeId]
        ),
        // Get equipment bonuses
        client.query(
          `SELECT i.bonus_type, i.bonus_value, i.crime_category
           FROM player_inventory pi
           JOIN items i ON pi.item_id = i.id
           WHERE pi.player_id = $1 AND pi.equipped = true`,
          [playerId]
        ),
        // Get territory bonus
        getTerritoryBonus(playerId, player.current_district),
        // Get event bonuses
        getEventBonuses(player.current_district),
        // Await prestige bonuses (started earlier)
        prestigeBonusesPromise,
        // Get district ecosystem modifiers
        districtId ? getDistrictModifiers(districtId) : Promise.resolve(null)
      ]);

      if (cooldownResult.rows.length > 0) {
        throw new Error('Crime on cooldown');
      }

      let equipSuccessBonus = 0;
      let equipPayoutBonus = 0;
      let equipCooldownBonus = 0;
      for (const item of equipResult.rows) {
        if (item.bonus_type === 'success_rate') {
          equipSuccessBonus += item.bonus_value;
        } else if (item.bonus_type === 'payout') {
          equipPayoutBonus += item.bonus_value;
        } else if (item.bonus_type === 'cooldown') {
          equipCooldownBonus += item.bonus_value;
        } else if (item.bonus_type === 'crime_specific' && crime.category === item.crime_category) {
          equipSuccessBonus += item.bonus_value;
        }
      }

      // Calculate success rate: base_rate * (1 - police_presence/200) * district_modifier + bonuses
      // Master accounts always succeed
      let successRate: number;
      let success: boolean;

      if (isMaster) {
        successRate = 100;
        success = true;
      } else {
        const policeModifier = 1 - (player.police_presence / 200);
        // Apply district ecosystem modifier (crimeDifficulty: 0.5-1.5, higher = easier)
        const districtCrimeModifier = districtMods?.crimeDifficulty ?? 1.0;
        successRate = crime.base_success_rate * policeModifier * districtCrimeModifier;
        successRate += equipSuccessBonus + prestigeBonuses.successRate + eventBonuses.successBonus;
        successRate = Math.min(95, successRate); // Cap at 95%
        const roll = Math.random() * 100;
        success = roll < successRate;
      }

      let cashGained = 0;
      let xpGained = 0;
      let caught = false;
      let jailUntil: Date | null = null;
      let leveledUp = false;
      let newLevel = player.level;

      if (success) {
        // Calculate payout: random between min/max * wealth/5
        const basePayout = crime.min_payout + Math.random() * (crime.max_payout - crime.min_payout);
        const wealthModifier = player.wealth / 5;
        // Include territory bonus, event bonus, and district ecosystem bonus in payout
        const districtPayoutBonus = (districtMods?.crimePayoutBonus ?? 0) * 100; // Convert 0-0.5 to 0-50%
        let payoutMultiplier = 1 + (equipPayoutBonus + prestigeBonuses.payoutBonus + territoryBonus + eventBonuses.payoutBonus + districtPayoutBonus) / 100;
        cashGained = Math.floor(basePayout * wealthModifier * payoutMultiplier);

        // Apply XP bonus from prestige and events
        const xpMultiplier = 1 + (prestigeBonuses.xpBonus + eventBonuses.xpBonus) / 100;
        xpGained = Math.floor((crime.min_level * 10 + cashGained / 10) * xpMultiplier);
      } else {
        // Arrest chance based on police presence, modified by events
        let arrestChance = (player.police_presence / 10) * 0.5;
        // Apply event modifiers
        arrestChance = arrestChance * (1 - eventBonuses.catchReduction / 100) * (1 + eventBonuses.catchIncrease / 100);
        caught = Math.random() < arrestChance;

        if (caught) {
          jailUntil = new Date(Date.now() + crime.jail_minutes * 60 * 1000);
        }
      }

      // Deduct stamina, focus and add heat (master accounts don't lose resources)
      const newStamina = isMaster ? playerStamina : playerStamina - staminaCost;
      const newFocus = isMaster ? playerFocus : playerFocus - focusCost;
      const currentHeat = player.heat || 0;
      const newHeat = isMaster ? currentHeat : Math.min(100, currentHeat + heatGenerated);
      // Update legacy fields for backward compatibility
      const newEnergy = newStamina;
      const newNerve = newFocus;
      const newCash = player.cash + cashGained;
      const newXP = player.xp + xpGained;
      const newTotalEarnings = player.total_earnings + cashGained;

      // Check for level up
      let xpRemaining = newXP;
      let checkLevel = player.level;
      while (xpRemaining >= getRequiredXP(checkLevel + 1)) {
        xpRemaining -= getRequiredXP(checkLevel + 1);
        checkLevel++;
        leveledUp = true;
      }
      newLevel = checkLevel;

      // Update player with new attribute system
      await client.query(
        `UPDATE players SET
          stamina = $1, focus = $2, energy = $1, nerve = $2,
          heat = $3, cash = $4, xp = $5, level = $6,
          total_earnings = $7, in_jail = $8, jail_release_at = $9
         WHERE id = $10`,
        [newStamina, newFocus, newHeat, newCash, leveledUp ? xpRemaining : newXP, newLevel, newTotalEarnings, caught, jailUntil, playerId]
      );

      // Set cooldown (reduced by equipment bonus, master accounts skip cooldowns)
      if (!isMaster) {
        const cooldownReduction = equipCooldownBonus / 100;
        const actualCooldown = Math.floor(crime.cooldown_seconds * (1 - cooldownReduction));
        await client.query(
          `INSERT INTO player_cooldowns (player_id, crime_id, available_at)
           VALUES ($1, $2, NOW() + make_interval(secs => $3))
           ON CONFLICT (player_id, crime_id) DO UPDATE SET available_at = NOW() + make_interval(secs => $3)`,
          [playerId, crimeId, actualCooldown]
        );
      }

      // Log the crime (non-critical, ignore errors)
      try {
        await client.query(
          `INSERT INTO crime_logs (player_id, crime_id, district_id, success, cash_gained, caught)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [playerId, crimeId, player.current_district || null, success, cashGained, caught]
        );
      } catch (logError) {
        // Logging is non-critical, continue if table doesn't exist
        console.log('Crime log skipped (table may not exist)');
      }

      return {
        crimeSuccess: success,
        cashGained,
        xpGained,
        caught,
        jailUntil,
        leveledUp,
        newLevel,
        xpRemaining,
        newXP,
        newStamina,
        newFocus,
        newHeat,
        newEnergy,
        newNerve,
        newCash,
        newTotalEarnings,
        territoryBonus,
        eventBonuses,
        heatGenerated,
        isMaster,
        districtId,
        crimeCategory: crime.category
      };
    });

    // Send response immediately - don't wait for non-critical background tasks
    res.json({
      success: true,
      data: {
        crimeSuccess: result.crimeSuccess,
        cashGained: result.cashGained,
        xpGained: result.xpGained,
        caught: result.caught,
        jailUntil: result.jailUntil,
        leveledUp: result.leveledUp,
        newLevel: result.newLevel,
        newAchievements: [], // Achievements are now processed in background
        activeBonuses: {
          territoryBonus: result.territoryBonus > 0,
          eventBonuses: result.eventBonuses.payoutBonus > 0 || result.eventBonuses.xpBonus > 0 || result.eventBonuses.successBonus > 0
        },
        player: {
          stamina: result.newStamina,
          focus: result.newFocus,
          heat: result.newHeat,
          energy: result.newEnergy,
          nerve: result.newNerve,
          cash: result.newCash,
          xp: result.leveledUp ? result.xpRemaining : result.newXP,
          level: result.newLevel,
          totalEarnings: result.newTotalEarnings,
          inJail: result.caught,
          jailReleaseAt: result.jailUntil
        },
        heatGained: result.isMaster ? 0 : result.heatGenerated
      }
    });

    // Send WebSocket updates for real-time client sync
    notifyStatUpdate(playerId, {
      cash: result.newCash,
      xp: result.leveledUp ? result.xpRemaining : result.newXP,
      energy: result.newEnergy,
      nerve: result.newNerve,
      heatLevel: result.newHeat
    });

    // Notify level up via WebSocket
    if (result.leveledUp) {
      sendToUser(playerId, createEvent<LevelUpEvent>('game:level_up', {
        oldLevel: result.newLevel - 1,
        newLevel: result.newLevel,
        rewards: {
          statPoints: 3 // Standard stat points per level
        }
      }));
    }

    // Run non-critical background tasks (missions, stats, achievements, district ecosystem, reputation) without blocking
    // These fire-and-forget updates run after response is sent
    const currentDistrict = req.player!.current_district ?? 1;
    Promise.all([
      updateMissionProgress(playerId, crimeId, currentDistrict, result.cashGained, result.crimeSuccess)
        .catch(err => console.error('Mission progress error:', err)),
      updatePlayerStats(playerId, crimeId, currentDistrict, result.crimeSuccess, result.caught ? crime.jail_minutes : 0)
        .then(() => checkAchievements(playerId))
        .catch(err => console.error('Achievement check error:', err)),
      // Log district ecosystem event
      result.districtId ? logDistrictEvent({
        districtId: result.districtId,
        eventType: 'crime_committed',
        playerId: String(playerId),
        severity: result.crimeSuccess ? Math.min(10, Math.ceil(result.cashGained / 1000)) : 1,
        metadata: {
          crimeId,
          crimeCategory: result.crimeCategory,
          success: result.crimeSuccess,
          payout: result.cashGained,
          caught: result.caught
        }
      }).catch(err => console.error('District ecosystem log error:', err)) : Promise.resolve(),
      // Update contextual reputation based on crime outcome
      result.districtId ? (async () => {
        try {
          const crimeScale = Math.min(5, Math.ceil(result.cashGained / 2000)); // 1-5 based on payout
          if (result.crimeSuccess) {
            // Successful crime: gain respect and fear, increase heat
            await modifyReputation(
              String(playerId),
              'district',
              result.districtId,
              {
                respect: 2 + crimeScale,
                fear: 1 + Math.floor(crimeScale / 2),
                heat: 3 + crimeScale
              },
              `Successful ${result.crimeCategory || 'crime'}`
            );
          } else {
            // Failed crime: lose respect, gain heat if caught
            await modifyReputation(
              String(playerId),
              'district',
              result.districtId,
              {
                respect: -2,
                heat: result.caught ? 5 : 2
              },
              `Failed ${result.crimeCategory || 'crime'}${result.caught ? ' (caught)' : ''}`
            );
          }
          // Propagate reputation changes to adjacent districts and local factions
          await propagateReputation(
            String(playerId),
            'district',
            result.districtId,
            result.crimeSuccess
              ? { respect: 2 + crimeScale, fear: 1 + Math.floor(crimeScale / 2) }
              : { respect: -2 }
          );
        } catch (err) {
          console.error('Reputation update error:', err);
        }
      })() : Promise.resolve(),
      // Create witnessed event for high-severity crimes (severity >= 5)
      (result.districtId && result.crimeSuccess) ? (async () => {
        try {
          const severity = Math.min(10, Math.ceil(result.cashGained / 1000));
          // Only create witnessed events for notable crimes (severity >= 5)
          if (severity >= 5) {
            const playerResult = await pool.query(
              `SELECT username FROM players WHERE id = $1`,
              [playerId]
            );
            const playerName = playerResult.rows[0]?.username || 'Unknown';

            await createWitnessedEvent({
              eventType: 'crime_committed',
              actorPlayerId: playerId,
              districtId: result.districtId,
              description: `${playerName} committed a ${result.crimeCategory || 'crime'} and made off with $${result.cashGained.toLocaleString()}`,
              severity,
              metadata: {
                crimeCategory: result.crimeCategory,
                earnings: result.cashGained,
                crimeId
              }
            });
          }
        } catch (err) {
          console.error('Witnessed event creation error:', err);
        }
      })() : Promise.resolve()
    ]).catch(err => console.error('Background tasks error:', err));
  } catch (error: any) {
    console.error('Crime error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to commit crime' });
  }
});

// POST /api/game/bank/deposit
// Validation ensures amount is a positive integer
router.post('/bank/deposit', validate(depositWithdrawSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { amount } = req.body;

    const result = await withTransaction(async (client) => {
      // Lock player row to prevent race conditions
      const player = await lockRowForUpdate<{ cash: number; bank: number }>(client, 'players', playerId);
      if (!player) throw new Error('Player not found');

      if (player.cash < amount) {
        throw new Error('Insufficient cash');
      }

      const updateResult = await client.query(
        `UPDATE players SET cash = cash - $1, bank = bank + $1
         WHERE id = $2
         RETURNING cash, bank`,
        [amount, playerId]
      );

      return {
        message: `Deposited $${amount}`,
        cash: updateResult.rows[0].cash,
        bank: updateResult.rows[0].bank
      };
    });

    // Audit log: bank deposit
    await economyAudit.bankDeposit(req, playerId, amount);

    // WebSocket: Update client stats
    notifyStatUpdate(playerId, { cash: result.cash, bank: result.bank });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Deposit error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to deposit' });
  }
});

// POST /api/game/bank/withdraw
// Validation ensures amount is a positive integer
router.post('/bank/withdraw', validate(depositWithdrawSchema), async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { amount } = req.body;

    const result = await withTransaction(async (client) => {
      // Lock player row to prevent race conditions
      const player = await lockRowForUpdate<{ cash: number; bank: number }>(client, 'players', playerId);
      if (!player) throw new Error('Player not found');

      if (player.bank < amount) {
        throw new Error('Insufficient bank balance');
      }

      const updateResult = await client.query(
        `UPDATE players SET cash = cash + $1, bank = bank - $1
         WHERE id = $2
         RETURNING cash, bank`,
        [amount, playerId]
      );

      return {
        message: `Withdrew $${amount}`,
        cash: updateResult.rows[0].cash,
        bank: updateResult.rows[0].bank
      };
    });

    // Audit log: bank withdraw
    await economyAudit.bankWithdraw(req, playerId, amount);

    // WebSocket: Update client stats
    notifyStatUpdate(playerId, { cash: result.cash, bank: result.bank });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Withdraw error:', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to withdraw' });
  }
});

export default router;
