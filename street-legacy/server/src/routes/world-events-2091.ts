import { Router, Response } from 'express';
import pool from '../db/connection.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// =====================================================
// PHASE 6: WORLD EVENTS (2091 THEMED)
// =====================================================

// GET /api/world-events/active - Get all active world events
router.get('/active', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    // Get active events
    const eventsResult = await pool.query(`
      SELECT awe.*, we.*,
             EXTRACT(EPOCH FROM (awe.ends_at - NOW())) * 1000 as time_remaining
      FROM active_world_events awe
      JOIN world_events_2091 we ON awe.event_key = we.event_key
      WHERE awe.is_active = true AND awe.ends_at > NOW()
      ORDER BY awe.started_at DESC
    `);

    // Get player's participations
    const participationsResult = await pool.query(`
      SELECT * FROM event_participation
      WHERE player_id = $1
      AND event_id IN (SELECT id FROM active_world_events WHERE is_active = true)
    `, [playerId]);

    const participationMap = new Map(
      participationsResult.rows.map(p => [p.event_id, p])
    );

    const events = eventsResult.rows.map(e => ({
      id: e.id,
      eventKey: e.event_key,
      event: {
        id: e.id,
        eventKey: e.event_key,
        name: e.name,
        description: e.description,
        loreText: e.lore_text,
        eventCategory: e.event_category,
        affectedSectors: e.affected_sectors,
        effects: e.effects,
        durationHours: e.duration_hours,
        rarity: e.rarity,
        icon: e.icon,
        isPositive: e.is_positive,
        canParticipate: e.can_participate,
        participationReward: e.participation_reward
      },
      affectedSectors: e.affected_sectors,
      startedAt: e.started_at,
      endsAt: e.ends_at,
      triggeredBy: e.triggered_by,
      participants: e.participants,
      isActive: e.is_active,
      timeRemaining: Math.max(0, e.time_remaining)
    }));

    const globalEvents = events.filter(e => !e.affectedSectors || e.affectedSectors.length === 0);
    const sectorEvents = events.filter(e => e.affectedSectors && e.affectedSectors.length > 0);

    res.json({
      success: true,
      data: {
        events,
        globalEvents,
        sectorEvents,
        upcomingEvents: [],
        playerParticipating: participationsResult.rows.map(p => ({
          id: p.id,
          eventId: p.event_id,
          playerId: p.player_id,
          joinedAt: p.joined_at,
          contributionScore: p.contribution_score,
          rewardsClaimed: p.rewards_claimed,
          rewardsData: p.rewards_data
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching active events:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch events' });
  }
});

// GET /api/world-events/catalog - Get all event definitions
router.get('/catalog', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT * FROM world_events_2091 ORDER BY rarity, name
    `);

    const events = result.rows.map(e => ({
      id: e.id,
      eventKey: e.event_key,
      name: e.name,
      description: e.description,
      loreText: e.lore_text,
      eventCategory: e.event_category,
      affectedSectors: e.affected_sectors,
      effects: e.effects,
      requirements: e.requirements,
      durationHours: e.duration_hours,
      rarity: e.rarity,
      triggerChance: parseFloat(e.trigger_chance),
      icon: e.icon,
      isPositive: e.is_positive,
      canParticipate: e.can_participate,
      participationReward: e.participation_reward,
      minParticipants: e.min_participants,
      maxConcurrent: e.max_concurrent
    }));

    // Group by category
    const byCategory: Record<string, typeof events> = {};
    for (const event of events) {
      if (!byCategory[event.eventCategory]) {
        byCategory[event.eventCategory] = [];
      }
      byCategory[event.eventCategory].push(event);
    }

    res.json({
      success: true,
      data: {
        events,
        byCategory,
        rarityBreakdown: {
          common: events.filter(e => e.rarity === 'common').length,
          uncommon: events.filter(e => e.rarity === 'uncommon').length,
          rare: events.filter(e => e.rarity === 'rare').length,
          epic: events.filter(e => e.rarity === 'epic').length,
          legendary: events.filter(e => e.rarity === 'legendary').length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching event catalog:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch catalog' });
  }
});

// GET /api/world-events/:id - Get specific event details
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.id);
    const playerId = req.player!.id;

    const eventResult = await pool.query(`
      SELECT awe.*, we.*,
             EXTRACT(EPOCH FROM (awe.ends_at - NOW())) * 1000 as time_remaining
      FROM active_world_events awe
      JOIN world_events_2091 we ON awe.event_key = we.event_key
      WHERE awe.id = $1
    `, [eventId]);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    const e = eventResult.rows[0];

    // Get participation
    const participationResult = await pool.query(`
      SELECT * FROM event_participation WHERE event_id = $1 AND player_id = $2
    `, [eventId, playerId]);

    // Get top contributors
    const contributorsResult = await pool.query(`
      SELECT ep.player_id, ep.contribution_score, p.username
      FROM event_participation ep
      JOIN players p ON ep.player_id = p.id
      WHERE ep.event_id = $1
      ORDER BY ep.contribution_score DESC
      LIMIT 10
    `, [eventId]);

    // Get total participants
    const countResult = await pool.query(`
      SELECT COUNT(*) as count FROM event_participation WHERE event_id = $1
    `, [eventId]);

    // Check if player can join
    let canJoin = e.can_participate;
    const joinRequirements: string[] = [];

    // Get player level for requirements check
    const playerLevelResult = await pool.query(`
      SELECT level FROM players WHERE id = $1
    `, [playerId]);
    const playerLevel = playerLevelResult.rows[0]?.level || 1;

    if (e.requirements) {
      if (e.requirements.minLevel && playerLevel < e.requirements.minLevel) {
        canJoin = false;
        joinRequirements.push(`Requires level ${e.requirements.minLevel}`);
      }
      // TODO: Check faction requirements
    }

    if (participationResult.rows.length > 0) {
      canJoin = false;
      joinRequirements.push('Already participating');
    }

    res.json({
      success: true,
      data: {
        event: {
          id: e.id,
          eventKey: e.event_key,
          event: {
            id: e.id,
            eventKey: e.event_key,
            name: e.name,
            description: e.description,
            loreText: e.lore_text,
            eventCategory: e.event_category,
            affectedSectors: e.affected_sectors,
            effects: e.effects,
            durationHours: e.duration_hours,
            rarity: e.rarity,
            icon: e.icon,
            isPositive: e.is_positive,
            canParticipate: e.can_participate,
            participationReward: e.participation_reward
          },
          affectedSectors: e.affected_sectors,
          startedAt: e.started_at,
          endsAt: e.ends_at,
          triggeredBy: e.triggered_by,
          participants: e.participants,
          isActive: e.is_active,
          timeRemaining: Math.max(0, e.time_remaining)
        },
        participation: participationResult.rows.length > 0 ? {
          id: participationResult.rows[0].id,
          eventId: participationResult.rows[0].event_id,
          playerId: participationResult.rows[0].player_id,
          joinedAt: participationResult.rows[0].joined_at,
          contributionScore: participationResult.rows[0].contribution_score,
          rewardsClaimed: participationResult.rows[0].rewards_claimed,
          rewardsData: participationResult.rows[0].rewards_data
        } : null,
        topContributors: contributorsResult.rows.map((c, i) => ({
          playerId: c.player_id,
          username: c.username,
          score: c.contribution_score,
          rank: i + 1
        })),
        totalParticipants: parseInt(countResult.rows[0].count),
        canJoin,
        joinRequirements: joinRequirements.length > 0 ? joinRequirements : null
      }
    });
  } catch (error) {
    console.error('Error fetching event details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch event' });
  }
});

// POST /api/world-events/:id/join - Join an event
router.post('/:id/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.id);
    const playerId = req.player!.id;

    // Get event
    const eventResult = await pool.query(`
      SELECT awe.*, we.*
      FROM active_world_events awe
      JOIN world_events_2091 we ON awe.event_key = we.event_key
      WHERE awe.id = $1 AND awe.is_active = true AND awe.ends_at > NOW()
    `, [eventId]);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Event not found or inactive' });
    }

    const event = eventResult.rows[0];

    if (!event.can_participate) {
      return res.status(400).json({ success: false, error: 'This event does not allow participation' });
    }

    // Check if already participating
    const existingResult = await pool.query(`
      SELECT id FROM event_participation WHERE event_id = $1 AND player_id = $2
    `, [eventId, playerId]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Already participating in this event' });
    }

    // Get player level for requirements check
    const playerLevelResult = await pool.query(`
      SELECT level FROM players WHERE id = $1
    `, [playerId]);
    const playerLevel = playerLevelResult.rows[0]?.level || 1;

    // Check requirements
    if (event.requirements) {
      if (event.requirements.minLevel && playerLevel < event.requirements.minLevel) {
        return res.status(400).json({
          success: false,
          error: `Requires level ${event.requirements.minLevel}`
        });
      }
    }

    // Join event
    await pool.query('BEGIN');

    const participationResult = await pool.query(`
      INSERT INTO event_participation (event_id, player_id)
      VALUES ($1, $2)
      RETURNING *
    `, [eventId, playerId]);

    await pool.query(`
      UPDATE active_world_events SET participants = participants + 1 WHERE id = $1
    `, [eventId]);

    await pool.query('COMMIT');

    // Get active effects
    const effects = event.effects || {};
    const eventEffects: string[] = [];
    if (effects.payoutBonus) eventEffects.push(`+${effects.payoutBonus}% Payout`);
    if (effects.xpBonus) eventEffects.push(`+${effects.xpBonus}% XP`);
    if (effects.heatReduction) eventEffects.push(`-${effects.heatReduction}% Heat Gain`);
    if (effects.successBonus) eventEffects.push(`+${effects.successBonus}% Success Rate`);
    if (effects.surveillanceDisabled) eventEffects.push('Surveillance Disabled');

    res.json({
      success: true,
      data: {
        message: `Joined "${event.name}"!`,
        participation: {
          id: participationResult.rows[0].id,
          eventId: participationResult.rows[0].event_id,
          playerId: participationResult.rows[0].player_id,
          joinedAt: participationResult.rows[0].joined_at,
          contributionScore: 0,
          rewardsClaimed: false,
          rewardsData: null
        },
        eventEffects
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error joining event:', error);
    res.status(500).json({ success: false, error: 'Failed to join event' });
  }
});

// POST /api/world-events/:id/contribute - Add contribution to event
router.post('/:id/contribute', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.id);
    const playerId = req.player!.id;
    const { amount = 1 } = req.body;

    // Check participation
    const participationResult = await pool.query(`
      SELECT ep.*, awe.is_active, awe.ends_at
      FROM event_participation ep
      JOIN active_world_events awe ON ep.event_id = awe.id
      WHERE ep.event_id = $1 AND ep.player_id = $2
    `, [eventId, playerId]);

    if (participationResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Not participating in this event' });
    }

    const participation = participationResult.rows[0];

    if (!participation.is_active || new Date(participation.ends_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'Event has ended' });
    }

    // Add contribution
    await pool.query(`
      UPDATE event_participation
      SET contribution_score = contribution_score + $1
      WHERE event_id = $2 AND player_id = $3
    `, [amount, eventId, playerId]);

    res.json({
      success: true,
      data: {
        message: `Added ${amount} contribution points`,
        newScore: participation.contribution_score + amount
      }
    });
  } catch (error) {
    console.error('Error contributing to event:', error);
    res.status(500).json({ success: false, error: 'Failed to contribute' });
  }
});

// POST /api/world-events/:id/claim - Claim rewards from event
router.post('/:id/claim', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.id);
    const playerId = req.player!.id;

    // Get participation and event
    const result = await pool.query(`
      SELECT ep.*, awe.ends_at, we.participation_reward, we.name
      FROM event_participation ep
      JOIN active_world_events awe ON ep.event_id = awe.id
      JOIN world_events_2091 we ON awe.event_key = we.event_key
      WHERE ep.event_id = $1 AND ep.player_id = $2
    `, [eventId, playerId]);

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Not participating in this event' });
    }

    const participation = result.rows[0];

    // Check if event has ended
    if (new Date(participation.ends_at) > new Date()) {
      return res.status(400).json({ success: false, error: 'Event has not ended yet' });
    }

    // Check if already claimed
    if (participation.rewards_claimed) {
      return res.status(400).json({ success: false, error: 'Rewards already claimed' });
    }

    // Calculate rewards based on contribution
    const baseRewards = participation.participation_reward || {};
    const contributionBonus = Math.min(2, 1 + (participation.contribution_score / 100));

    const finalRewards: Record<string, any> = {};
    if (baseRewards.xp) finalRewards.xp = Math.floor(baseRewards.xp * contributionBonus);
    if (baseRewards.cash) finalRewards.cash = Math.floor(baseRewards.cash * contributionBonus);

    // Get player's rank
    const rankResult = await pool.query(`
      SELECT COUNT(*) + 1 as rank
      FROM event_participation
      WHERE event_id = $1 AND contribution_score > $2
    `, [eventId, participation.contribution_score]);

    const countResult = await pool.query(`
      SELECT COUNT(*) as total FROM event_participation WHERE event_id = $1
    `, [eventId]);

    await pool.query('BEGIN');

    // Apply rewards
    if (finalRewards.xp) {
      await pool.query(`
        UPDATE players SET xp = xp + $1 WHERE id = $2
      `, [finalRewards.xp, playerId]);
    }
    if (finalRewards.cash) {
      await pool.query(`
        UPDATE players SET cash = cash + $1 WHERE id = $2
      `, [finalRewards.cash, playerId]);
    }

    // Mark claimed
    await pool.query(`
      UPDATE event_participation
      SET rewards_claimed = true, rewards_data = $1
      WHERE event_id = $2 AND player_id = $3
    `, [finalRewards, eventId, playerId]);

    await pool.query('COMMIT');

    res.json({
      success: true,
      data: {
        message: `Claimed rewards from "${participation.name}"!`,
        rewards: finalRewards,
        contribution: {
          score: participation.contribution_score,
          rank: parseInt(rankResult.rows[0].rank),
          totalParticipants: parseInt(countResult.rows[0].total)
        }
      }
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error claiming rewards:', error);
    res.status(500).json({ success: false, error: 'Failed to claim rewards' });
  }
});

// POST /api/world-events/history - Get past events
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const playerId = req.player!.id;

    const result = await pool.query(`
      SELECT awe.*, we.name, we.description, we.icon, we.rarity, we.event_category,
             ep.contribution_score, ep.rewards_claimed, ep.rewards_data
      FROM active_world_events awe
      JOIN world_events_2091 we ON awe.event_key = we.event_key
      LEFT JOIN event_participation ep ON awe.id = ep.event_id AND ep.player_id = $1
      WHERE awe.ends_at < NOW()
      ORDER BY awe.ends_at DESC
      LIMIT 20
    `, [playerId]);

    res.json({
      success: true,
      data: {
        events: result.rows.map(e => ({
          id: e.id,
          eventKey: e.event_key,
          name: e.name,
          description: e.description,
          icon: e.icon,
          rarity: e.rarity,
          eventCategory: e.event_category,
          startedAt: e.started_at,
          endedAt: e.ends_at,
          participants: e.participants,
          playerContribution: e.contribution_score,
          playerClaimed: e.rewards_claimed,
          playerRewards: e.rewards_data
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching event history:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

// Trigger random world event - called by server interval
export async function triggerRandomWorldEvent(): Promise<void> {
  try {
    // Get events that could trigger
    const eventsResult = await pool.query(`
      SELECT we.*,
             (SELECT COUNT(*) FROM active_world_events awe
              WHERE awe.event_key = we.event_key AND awe.is_active = true) as active_count
      FROM world_events_2091 we
      WHERE we.trigger_chance > 0
    `);

    for (const event of eventsResult.rows) {
      // Skip if max concurrent reached
      if (event.active_count >= event.max_concurrent) continue;

      // Roll for trigger
      const roll = Math.random();
      if (roll > parseFloat(event.trigger_chance)) continue;

      // Trigger the event
      const endsAt = new Date();
      endsAt.setHours(endsAt.getHours() + event.duration_hours);

      await pool.query(`
        INSERT INTO active_world_events (event_key, affected_sectors, ends_at, triggered_by)
        VALUES ($1, $2, $3, 'system')
      `, [event.event_key, event.affected_sectors, endsAt]);

      console.log(`[World Events] Triggered: ${event.name} (${event.rarity})`);

      // Only trigger one event per cycle
      break;
    }
  } catch (error) {
    console.error('[World Events] Error triggering random event:', error);
  }
}

// Clean up ended events
export async function cleanupEndedEvents(): Promise<void> {
  try {
    await pool.query(`
      UPDATE active_world_events
      SET is_active = false
      WHERE ends_at < NOW() AND is_active = true
    `);
  } catch (error) {
    console.error('[World Events] Error cleaning up events:', error);
  }
}

export default router;
