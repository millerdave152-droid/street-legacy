import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/hospital/status - Get player's health and injury status
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get player health status
    const playerResult = await pool.query(`
      SELECT health, max_health, is_hospitalized, hospital_release_at
      FROM players WHERE id = $1
    `, [playerId]);

    const player = playerResult.rows[0];

    // Get active injuries
    const injuriesResult = await pool.query(`
      SELECT i.*, p.username as caused_by_username
      FROM injuries i
      LEFT JOIN players p ON i.source_player_id = p.id
      WHERE i.player_id = $1 AND i.is_healed = false AND i.heals_at > NOW()
      ORDER BY i.severity DESC
    `, [playerId]);

    // Calculate total stat penalties from injuries
    const statPenalties = {
      attack: 0,
      defense: 0,
      accuracy: 0,
      evasion: 0,
      max_health: 0,
      stamina_max: 0,
      stamina_regen: 0,
      focus_max: 0,
      focus_regen: 0,
      health_regen: 0,
      movement_speed: 0,
      influence: 0
    };

    for (const injury of injuriesResult.rows) {
      const effects = injury.effects || {};
      for (const [stat, value] of Object.entries(effects)) {
        if (statPenalties.hasOwnProperty(stat)) {
          (statPenalties as any)[stat] += value as number;
        }
      }
    }

    // Get available services
    const servicesResult = await pool.query(`
      SELECT * FROM hospital_services ORDER BY base_cost ASC
    `);

    // Check hospital release time
    let timeToRelease = 0;
    if (player.is_hospitalized && player.hospital_release_at) {
      timeToRelease = Math.max(0, new Date(player.hospital_release_at).getTime() - Date.now());
    }

    res.json({
      success: true,
      data: {
        health: player.health,
        maxHealth: player.max_health,
        healthPercent: Math.floor((player.health / player.max_health) * 100),
        isHospitalized: player.is_hospitalized,
        hospitalReleaseAt: player.hospital_release_at,
        timeToRelease,
        injuries: injuriesResult.rows.map(i => ({
          ...i,
          timeToHeal: Math.max(0, new Date(i.heals_at).getTime() - Date.now())
        })),
        totalInjuries: injuriesResult.rows.length,
        statPenalties,
        services: servicesResult.rows
      }
    });
  } catch (error) {
    console.error('Error getting hospital status:', error);
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

// GET /api/hospital/injuries - Get all injury types
router.get('/injuries', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT * FROM injury_types ORDER BY severity ASC, name ASC
    `);

    res.json({
      success: true,
      data: { injuryTypes: result.rows }
    });
  } catch (error) {
    console.error('Error getting injury types:', error);
    res.status(500).json({ success: false, error: 'Failed to get injury types' });
  }
});

// POST /api/hospital/heal - Use hospital service to heal
router.post('/heal', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { serviceId, injuryId } = req.body;

    // Get player
    const playerResult = await pool.query(`
      SELECT cash, health, max_health, level FROM players WHERE id = $1
    `, [playerId]);

    const player = playerResult.rows[0];

    // Get service
    const serviceResult = await pool.query(`
      SELECT * FROM hospital_services WHERE id = $1
    `, [serviceId]);

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }

    const service = serviceResult.rows[0];

    // Check level requirement
    if (player.level < service.requires_level) {
      return res.status(400).json({
        success: false,
        error: `You need to be level ${service.requires_level} to use this service`
      });
    }

    // If healing specific injury
    if (injuryId) {
      const injuryResult = await pool.query(`
        SELECT * FROM injuries WHERE id = $1 AND player_id = $2 AND is_healed = false
      `, [injuryId, playerId]);

      if (injuryResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Injury not found' });
      }

      const injury = injuryResult.rows[0];

      // Check severity compatibility
      if (injury.severity < service.min_severity || injury.severity > service.max_severity) {
        return res.status(400).json({
          success: false,
          error: `This service cannot treat severity ${injury.severity} injuries`
        });
      }

      // Calculate cost based on injury severity
      const cost = service.base_cost * injury.severity;

      if (player.cash < cost) {
        return res.status(400).json({ success: false, error: 'Insufficient funds' });
      }

      await pool.query('BEGIN');

      // Deduct cost
      await pool.query('UPDATE players SET cash = cash - $1 WHERE id = $2', [cost, playerId]);

      // Calculate new heal time
      const currentHealTime = new Date(injury.heals_at).getTime() - Date.now();
      const newHealTime = Math.floor(currentHealTime * (1 - service.heal_time_reduction / 100));
      const newHealsAt = new Date(Date.now() + newHealTime);

      if (newHealTime <= 0) {
        // Heal immediately
        await pool.query(`
          UPDATE injuries SET is_healed = true, healed_by = $1, heals_at = NOW()
          WHERE id = $2
        `, [service.service_type, injuryId]);
      } else {
        // Reduce heal time
        await pool.query(`
          UPDATE injuries SET heals_at = $1 WHERE id = $2
        `, [newHealsAt, injuryId]);
      }

      await pool.query('COMMIT');

      res.json({
        success: true,
        data: {
          message: newHealTime <= 0 ? 'Injury healed!' : `Healing time reduced by ${service.heal_time_reduction}%`,
          cost,
          newHealsAt: newHealTime <= 0 ? null : newHealsAt,
          healed: newHealTime <= 0
        }
      });
    } else {
      // General health restoration
      const healthMissing = player.max_health - player.health;
      if (healthMissing <= 0) {
        return res.status(400).json({ success: false, error: 'You are already at full health' });
      }

      // Cost scales with health to restore
      const costPerHealth = Math.floor(service.base_cost / 50);
      const cost = Math.max(service.base_cost, costPerHealth * healthMissing);

      if (player.cash < cost) {
        return res.status(400).json({ success: false, error: 'Insufficient funds' });
      }

      await pool.query('BEGIN');

      await pool.query('UPDATE players SET cash = cash - $1 WHERE id = $2', [cost, playerId]);

      // Restore health based on service quality
      const healPercent = 50 + service.heal_time_reduction; // Better services heal more
      const healthRestored = Math.floor(healthMissing * healPercent / 100);

      await pool.query(`
        UPDATE players SET health = LEAST(max_health, health + $1) WHERE id = $2
      `, [healthRestored, playerId]);

      await pool.query('COMMIT');

      res.json({
        success: true,
        data: {
          message: `Restored ${healthRestored} health`,
          cost,
          healthRestored,
          newHealth: Math.min(player.max_health, player.health + healthRestored)
        }
      });
    }
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error using hospital service:', error);
    res.status(500).json({ success: false, error: 'Failed to heal' });
  }
});

// POST /api/hospital/heal-all - Heal all injuries
router.post('/heal-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { serviceId } = req.body;

    // Get player
    const playerResult = await pool.query(`
      SELECT cash, health, max_health, level FROM players WHERE id = $1
    `, [playerId]);

    const player = playerResult.rows[0];

    // Get service
    const serviceResult = await pool.query(`
      SELECT * FROM hospital_services WHERE id = $1
    `, [serviceId]);

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }

    const service = serviceResult.rows[0];

    // Get all active injuries
    const injuriesResult = await pool.query(`
      SELECT * FROM injuries
      WHERE player_id = $1 AND is_healed = false AND heals_at > NOW()
        AND severity >= $2 AND severity <= $3
    `, [playerId, service.min_severity, service.max_severity]);

    if (injuriesResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No injuries to heal' });
    }

    // Calculate total cost
    let totalCost = 0;
    for (const injury of injuriesResult.rows) {
      totalCost += service.base_cost * injury.severity;
    }

    // 10% discount for healing all at once
    totalCost = Math.floor(totalCost * 0.9);

    if (player.cash < totalCost) {
      return res.status(400).json({
        success: false,
        error: `Insufficient funds. Total cost: $${totalCost.toLocaleString()}`
      });
    }

    await pool.query('BEGIN');

    await pool.query('UPDATE players SET cash = cash - $1 WHERE id = $2', [totalCost, playerId]);

    let healed = 0;
    let reduced = 0;

    for (const injury of injuriesResult.rows) {
      const currentHealTime = new Date(injury.heals_at).getTime() - Date.now();
      const newHealTime = Math.floor(currentHealTime * (1 - service.heal_time_reduction / 100));

      if (newHealTime <= 0) {
        await pool.query(`
          UPDATE injuries SET is_healed = true, healed_by = $1, heals_at = NOW()
          WHERE id = $2
        `, [service.service_type, injury.id]);
        healed++;
      } else {
        const newHealsAt = new Date(Date.now() + newHealTime);
        await pool.query(`
          UPDATE injuries SET heals_at = $1 WHERE id = $2
        `, [newHealsAt, injury.id]);
        reduced++;
      }
    }

    // Also restore health
    const healthMissing = player.max_health - player.health;
    const healthRestored = Math.floor(healthMissing * 0.75);
    await pool.query(`
      UPDATE players SET health = LEAST(max_health, health + $1) WHERE id = $2
    `, [healthRestored, playerId]);

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Treatment complete: ${healed} injuries healed, ${reduced} reduced`,
        cost: totalCost,
        injuriesHealed: healed,
        injuriesReduced: reduced,
        healthRestored
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error healing all injuries:', error);
    res.status(500).json({ success: false, error: 'Failed to heal' });
  }
});

// POST /api/hospital/revive - Revive from hospital (pay to leave early)
router.post('/revive', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const playerResult = await pool.query(`
      SELECT cash, is_hospitalized, hospital_release_at, level
      FROM players WHERE id = $1
    `, [playerId]);

    const player = playerResult.rows[0];

    if (!player.is_hospitalized) {
      return res.status(400).json({ success: false, error: 'You are not hospitalized' });
    }

    // Calculate remaining time
    const timeRemaining = Math.max(0, new Date(player.hospital_release_at).getTime() - Date.now());
    const minutesRemaining = Math.ceil(timeRemaining / 60000);

    // Cost: $100 per minute remaining
    const cost = minutesRemaining * 100;

    if (player.cash < cost) {
      return res.status(400).json({
        success: false,
        error: `Insufficient funds. Early release costs $${cost.toLocaleString()}`
      });
    }

    await pool.query('BEGIN');

    await pool.query('UPDATE players SET cash = cash - $1 WHERE id = $2', [cost, playerId]);

    await pool.query(`
      UPDATE players SET is_hospitalized = false, hospital_release_at = NULL, health = 25
      WHERE id = $1
    `, [playerId]);

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: 'You have been released from the hospital',
        cost,
        minutesSaved: minutesRemaining
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error reviving:', error);
    res.status(500).json({ success: false, error: 'Failed to revive' });
  }
});

// POST /api/hospital/rest - Free healing by waiting
router.post('/rest', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Natural healing: 1 HP per 5 minutes
    // This endpoint just confirms the player is resting
    // Actual healing happens through periodic processes

    const playerResult = await pool.query(`
      SELECT health, max_health FROM players WHERE id = $1
    `, [playerId]);

    const player = playerResult.rows[0];

    if (player.health >= player.max_health) {
      return res.json({
        success: true,
        data: {
          message: 'You are already at full health',
          health: player.health,
          maxHealth: player.max_health
        }
      });
    }

    const healthMissing = player.max_health - player.health;
    const minutesToFullHealth = healthMissing * 5;
    const fullHealthAt = new Date(Date.now() + minutesToFullHealth * 60 * 1000);

    res.json({
      success: true,
      data: {
        message: 'Resting... You will heal naturally over time',
        health: player.health,
        maxHealth: player.max_health,
        healRate: '1 HP per 5 minutes',
        estimatedFullHealth: fullHealthAt
      }
    });
  } catch (error) {
    console.error('Error resting:', error);
    res.status(500).json({ success: false, error: 'Failed to rest' });
  }
});

// Process natural healing
export async function processNaturalHealing(): Promise<void> {
  try {
    // Heal 1 HP for all players not in combat and not hospitalized
    await pool.query(`
      UPDATE players
      SET health = LEAST(max_health, health + 1)
      WHERE health < max_health
        AND is_hospitalized = false
        AND (last_combat_at IS NULL OR last_combat_at < NOW() - INTERVAL '5 minutes')
    `);

    // Process natural injury healing
    await pool.query(`
      UPDATE injuries
      SET is_healed = true, healed_by = 'natural'
      WHERE is_healed = false AND heals_at <= NOW()
    `);

    // Release hospitalized players whose time is up
    await pool.query(`
      UPDATE players
      SET is_hospitalized = false, hospital_release_at = NULL, health = GREATEST(25, health)
      WHERE is_hospitalized = true AND hospital_release_at <= NOW()
    `);

    // Expire bodyguards
    await pool.query(`
      UPDATE player_bodyguards
      SET is_active = false
      WHERE is_active = true AND expires_at <= NOW()
    `);

    // Expire combat buffs
    await pool.query(`
      UPDATE player_combat_buffs
      SET is_active = false
      WHERE is_active = true AND expires_at <= NOW()
    `);
  } catch (error) {
    console.error('Error processing natural healing:', error);
  }
}

export default router;
