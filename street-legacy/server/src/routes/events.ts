import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// Event types and their effects
export const EVENT_TYPES = {
  police_strike: {
    name: 'Police Strike',
    description: 'Police are on strike! Reduced chance of getting caught.',
    bonus_type: 'catch_reduction',
    bonus_value: 50, // 50% less likely to get caught
    duration_hours: 2
  },
  economic_boom: {
    name: 'Economic Boom',
    description: 'The economy is booming! All payouts increased.',
    bonus_type: 'payout_bonus',
    bonus_value: 25, // 25% more money
    duration_hours: 3
  },
  crackdown: {
    name: 'Police Crackdown',
    description: 'Police are cracking down on crime. Be extra careful!',
    bonus_type: 'catch_increase',
    bonus_value: 30, // 30% more likely to get caught
    duration_hours: 2
  },
  happy_hour: {
    name: 'Happy Hour',
    description: 'Double XP from all crimes!',
    bonus_type: 'xp_bonus',
    bonus_value: 100, // 100% more XP
    duration_hours: 1
  },
  turf_war: {
    name: 'Turf War',
    description: 'Territory control is up for grabs! Crimes count double for territory.',
    bonus_type: 'territory_bonus',
    bonus_value: 100, // Crimes count 2x for territory
    duration_hours: 4
  },
  heat_wave: {
    name: 'Heat Wave',
    description: 'Everyone is staying inside. Easier crimes but lower payouts.',
    bonus_type: 'mixed',
    bonus_value: 20, // +20% success, -20% payout
    duration_hours: 3
  },
  blackout: {
    name: 'City Blackout',
    description: 'Power is out across the city. Perfect cover for crime.',
    bonus_type: 'success_bonus',
    bonus_value: 15, // +15% success rate
    duration_hours: 2
  }
};

// GET /api/events/active - Get currently active events
router.get('/active', async (req: AuthRequest, res: Response) => {
  try {
    const activeResult = await pool.query(
      `SELECT e.*, d.name as district_name
       FROM events e
       LEFT JOIN districts d ON e.affected_district_id = d.id
       WHERE e.start_time <= NOW() AND e.end_time > NOW()
       ORDER BY e.start_time DESC`
    );

    res.json({
      success: true,
      data: {
        events: activeResult.rows.map(e => ({
          id: e.id,
          name: e.name,
          description: e.description,
          type: e.type,
          bonusType: e.bonus_type,
          bonusValue: e.bonus_value,
          affectedDistrict: e.affected_district_id ? {
            id: e.affected_district_id,
            name: e.district_name
          } : null,
          startTime: e.start_time,
          endTime: e.end_time,
          timeRemaining: Math.max(0, new Date(e.end_time).getTime() - Date.now())
        }))
      }
    });
  } catch (error) {
    console.error('Get active events error:', error);
    res.status(500).json({ success: false, error: 'Failed to get active events' });
  }
});

// GET /api/events/history - Get past events
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const historyResult = await pool.query(
      `SELECT e.*, d.name as district_name
       FROM events e
       LEFT JOIN districts d ON e.affected_district_id = d.id
       WHERE e.end_time <= NOW()
       ORDER BY e.end_time DESC
       LIMIT 20`
    );

    res.json({
      success: true,
      data: {
        events: historyResult.rows.map(e => ({
          id: e.id,
          name: e.name,
          description: e.description,
          type: e.type,
          bonusType: e.bonus_type,
          bonusValue: e.bonus_value,
          affectedDistrict: e.affected_district_id ? {
            id: e.affected_district_id,
            name: e.district_name
          } : null,
          startTime: e.start_time,
          endTime: e.end_time
        }))
      }
    });
  } catch (error) {
    console.error('Get event history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get event history' });
  }
});

// POST /api/admin/events/trigger - Trigger a new event (admin only - for now just check if crew leader or high level)
router.post('/trigger', async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;
    const { eventType, districtId } = req.body;

    // Check if player is admin (for now, level 20+ or crew leader)
    const playerResult = await pool.query(
      `SELECT p.level, c.leader_id
       FROM players p
       LEFT JOIN crews c ON p.crew_id = c.id
       WHERE p.id = $1`,
      [playerId]
    );

    const player = playerResult.rows[0];
    const isAdmin = player.level >= 20 || player.leader_id === playerId;

    if (!isAdmin) {
      res.status(403).json({ success: false, error: 'Not authorized to trigger events' });
      return;
    }

    if (!eventType || !EVENT_TYPES[eventType as keyof typeof EVENT_TYPES]) {
      res.status(400).json({ success: false, error: 'Invalid event type' });
      return;
    }

    const eventTemplate = EVENT_TYPES[eventType as keyof typeof EVENT_TYPES];

    // Check if similar event is already active
    const existingResult = await pool.query(
      `SELECT id FROM events WHERE type = $1 AND end_time > NOW()`,
      [eventType]
    );

    if (existingResult.rows.length > 0) {
      res.status(400).json({ success: false, error: 'This event is already active' });
      return;
    }

    const endTime = new Date(Date.now() + eventTemplate.duration_hours * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO events (name, description, type, bonus_type, bonus_value, affected_district_id, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        eventTemplate.name,
        eventTemplate.description,
        eventType,
        eventTemplate.bonus_type,
        eventTemplate.bonus_value,
        districtId || null,
        endTime
      ]
    );

    res.json({
      success: true,
      data: {
        eventId: result.rows[0].id,
        message: `Event "${eventTemplate.name}" started!`,
        endsAt: endTime
      }
    });
  } catch (error) {
    console.error('Trigger event error:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger event' });
  }
});

// Get active event bonuses for a player/district
export async function getEventBonuses(districtId?: number): Promise<{
  payoutBonus: number;
  xpBonus: number;
  successBonus: number;
  catchReduction: number;
  catchIncrease: number;
  territoryBonus: number;
}> {
  const bonuses = {
    payoutBonus: 0,
    xpBonus: 0,
    successBonus: 0,
    catchReduction: 0,
    catchIncrease: 0,
    territoryBonus: 0
  };

  try {
    // Get all active events (global or affecting this district)
    const eventsResult = await pool.query(
      `SELECT * FROM events
       WHERE start_time <= NOW() AND end_time > NOW()
       AND (affected_district_id IS NULL OR affected_district_id = $1)`,
      [districtId || 0]
    );

    for (const event of eventsResult.rows) {
      switch (event.bonus_type) {
        case 'payout_bonus':
          bonuses.payoutBonus += event.bonus_value;
          break;
        case 'xp_bonus':
          bonuses.xpBonus += event.bonus_value;
          break;
        case 'success_bonus':
          bonuses.successBonus += event.bonus_value;
          break;
        case 'catch_reduction':
          bonuses.catchReduction += event.bonus_value;
          break;
        case 'catch_increase':
          bonuses.catchIncrease += event.bonus_value;
          break;
        case 'territory_bonus':
          bonuses.territoryBonus += event.bonus_value;
          break;
        case 'mixed':
          // Heat wave: easier but less money
          bonuses.successBonus += event.bonus_value;
          bonuses.payoutBonus -= event.bonus_value;
          break;
      }
    }
  } catch (error) {
    console.error('Get event bonuses error:', error);
  }

  return bonuses;
}

// Random event trigger - call periodically
export async function triggerRandomEvent(): Promise<void> {
  try {
    // Check if there's already an active global event
    const activeResult = await pool.query(
      `SELECT id FROM events
       WHERE affected_district_id IS NULL
       AND end_time > NOW()`
    );

    if (activeResult.rows.length > 0) {
      return; // Already have an active global event
    }

    // 10% chance to trigger a random event
    if (Math.random() > 0.1) {
      return;
    }

    const eventTypes = Object.keys(EVENT_TYPES);
    const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)] as keyof typeof EVENT_TYPES;
    const eventTemplate = EVENT_TYPES[randomType];

    const endTime = new Date(Date.now() + eventTemplate.duration_hours * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO events (name, description, type, bonus_type, bonus_value, end_time)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        eventTemplate.name,
        eventTemplate.description,
        randomType,
        eventTemplate.bonus_type,
        eventTemplate.bonus_value,
        endTime
      ]
    );

    console.log(`Random event triggered: ${eventTemplate.name}`);
  } catch (error) {
    console.error('Trigger random event error:', error);
  }
}

export default router;
