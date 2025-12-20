/**
 * Witness Mechanic Service
 * Social proof system where players witness and verify events
 * Verified witnesses create testimonials that boost reputation
 */

import pool from '../db/connection.js';
import {
  WitnessedEvent,
  EventWitness,
  PlayerTestimonial,
  WitnessedEventRow,
  EventWitnessRow,
  PlayerTestimonialRow,
  CreateWitnessedEventRequest,
  WitnessableEventType,
  EVENT_TYPE_LABELS,
  MIN_SEVERITY_FOR_TESTIMONIAL,
  MAX_WITNESSES_PER_EVENT,
  MAX_FEATURED_TESTIMONIALS,
  REPUTATION_BONUS_FIRST_WITNESS
} from '../types/witness.types.js';
import { modifyReputation } from './reputationWeb.service.js';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Map database row to WitnessedEvent
 */
function mapRowToWitnessedEvent(row: WitnessedEventRow): WitnessedEvent {
  return {
    id: row.id,
    eventType: row.event_type as WitnessableEventType,
    actorPlayerId: row.actor_player_id,
    actorPlayerName: row.actor_player_name,
    targetPlayerId: row.target_player_id ?? undefined,
    targetPlayerName: row.target_player_name,
    districtId: row.district_id,
    districtName: row.district_name,
    eventDescription: row.event_description ?? undefined,
    eventSeverity: row.event_severity,
    metadata: row.metadata || {},
    verificationWindowEnds: new Date(row.verification_window_ends),
    occurredAt: new Date(row.occurred_at),
    createdAt: new Date(row.created_at),
    witnessCount: row.witness_count ? parseInt(String(row.witness_count), 10) : undefined,
    verifiedCount: row.verified_count ? parseInt(String(row.verified_count), 10) : undefined,
    disputedCount: row.disputed_count ? parseInt(String(row.disputed_count), 10) : undefined
  };
}

/**
 * Map database row to EventWitness
 */
function mapRowToEventWitness(row: EventWitnessRow): EventWitness {
  return {
    id: row.id,
    witnessedEventId: row.witnessed_event_id,
    witnessPlayerId: row.witness_player_id,
    witnessPlayerName: row.witness_player_name || row.witness_username,
    witnessStatus: row.witness_status,
    verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
    testimony: row.testimony ?? undefined,
    reputationBonusGiven: row.reputation_bonus_given,
    createdAt: new Date(row.created_at)
  };
}

/**
 * Map database row to PlayerTestimonial
 */
function mapRowToTestimonial(row: PlayerTestimonialRow): PlayerTestimonial {
  return {
    id: row.id,
    playerId: row.player_id,
    playerName: row.player_name,
    witnessPlayerId: row.witness_player_id,
    witnessPlayerName: row.witness_player_name || row.witness_username,
    witnessedEventId: row.witnessed_event_id ?? undefined,
    testimonialText: row.testimonial_text,
    eventType: row.event_type as WitnessableEventType | undefined,
    featured: row.featured,
    createdAt: new Date(row.created_at)
  };
}

/**
 * Generate testimonial text based on event details
 */
function generateTestimonialText(
  event: WitnessedEvent,
  witnessName: string
): string {
  const eventLabel = EVENT_TYPE_LABELS[event.eventType] || 'event';
  const districtName = event.districtName || event.districtId;

  const templates: Record<WitnessableEventType, string[]> = {
    crime_committed: [
      `I saw them pull off a job in ${districtName}. Smooth operator.`,
      `Witnessed their work in ${districtName}. The streets are talking.`,
      `They handled business in ${districtName}. No doubt about it.`
    ],
    heist: [
      `I was there when they hit ${districtName}. Legendary move.`,
      `Witnessed the heist in ${districtName}. They've got skills.`,
      `They pulled off something big in ${districtName}. Respect.`
    ],
    pvp_victory: [
      `Saw them take down their opponent in ${districtName}. Don't mess with them.`,
      `I watched the fight in ${districtName}. They're not to be tested.`,
      `Witnessed the beatdown in ${districtName}. They mean business.`
    ],
    property_purchase: [
      `Watched them acquire property in ${districtName}. Moving up.`,
      `Saw them expand into ${districtName}. Money moves.`,
      `They're claiming ${districtName} now. Smart investment.`
    ],
    crew_battle: [
      `Was there during the crew war in ${districtName}. They held it down.`,
      `Witnessed the crew battle in ${districtName}. Their squad is solid.`,
      `Saw their crew in action in ${districtName}. Impressive.`
    ],
    business_opened: [
      `Saw them open up shop in ${districtName}. Going legit.`,
      `Watched them establish their business in ${districtName}. Entrepreneur life.`,
      `They've got a new operation in ${districtName}. Building an empire.`
    ],
    landmark_event: [
      `I witnessed something historic in ${districtName}. They made history.`,
      `Was there for a landmark moment in ${districtName}. Unforgettable.`,
      `Saw them do something memorable in ${districtName}. Legend status.`
    ],
    territory_capture: [
      `Watched them claim territory in ${districtName}. The block is theirs now.`,
      `Saw them take over in ${districtName}. Expansion on lock.`,
      `They captured ${districtName}. Territory secured.`
    ],
    major_deal: [
      `Witnessed a big deal go down in ${districtName}. Heavy moves.`,
      `Saw them close a major deal in ${districtName}. Power player.`,
      `Was there for the transaction in ${districtName}. Big money.`
    ],
    faction_mission: [
      `Watched them complete the mission in ${districtName}. Faction approved.`,
      `Saw them handle faction business in ${districtName}. Loyal soldier.`,
      `They completed their mission in ${districtName}. Respect earned.`
    ]
  };

  const eventTemplates = templates[event.eventType] || [`I witnessed this ${eventLabel} in ${districtName}.`];
  const randomIndex = Math.floor(Math.random() * eventTemplates.length);
  return eventTemplates[randomIndex];
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Find players in a district within a time window
 */
export async function findPlayersInDistrict(
  districtId: string,
  withinMinutes: number = 15
): Promise<string[]> {
  console.log(`[Witness] Finding players in district ${districtId} within ${withinMinutes} minutes`);

  // Query players with current_district matching
  // Also check player_activity_logs for recent activity
  const result = await pool.query(
    `SELECT DISTINCT p.id::text as player_id
     FROM players p
     WHERE p.current_district = $1
       AND p.last_action_at > NOW() - INTERVAL '${withinMinutes} minutes'
     UNION
     SELECT DISTINCT pal.player_id::text
     FROM player_activity_logs pal
     WHERE pal.district_id = $1
       AND pal.created_at > NOW() - INTERVAL '${withinMinutes} minutes'
     LIMIT $2`,
    [districtId, MAX_WITNESSES_PER_EVENT]
  );

  const playerIds = result.rows.map(row => row.player_id);
  console.log(`[Witness] Found ${playerIds.length} players in district ${districtId}`);
  return playerIds;
}

/**
 * Create a new witnessed event and find potential witnesses
 */
export async function createWitnessedEvent(
  params: CreateWitnessedEventRequest
): Promise<WitnessedEvent | null> {
  console.log(`[Witness] Creating witnessed event: type=${params.eventType}, actor=${params.actorPlayerId}, district=${params.districtId}`);

  const {
    eventType,
    actorPlayerId,
    districtId,
    description,
    severity = 5,
    metadata = {},
    targetPlayerId
  } = params;

  // Insert the witnessed event with 24-hour verification window
  const eventResult = await pool.query(
    `INSERT INTO witnessed_events (
       event_type,
       actor_player_id,
       target_player_id,
       district_id,
       event_description,
       event_severity,
       metadata,
       verification_window_ends,
       occurred_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '24 hours', NOW())
     RETURNING *`,
    [eventType, actorPlayerId, targetPlayerId || null, districtId, description || null, severity, metadata]
  );

  if (eventResult.rows.length === 0) {
    console.log(`[Witness] Failed to create witnessed event`);
    return null;
  }

  const eventId = eventResult.rows[0].id;

  // Find potential witnesses (players in district within last 15 minutes)
  const potentialWitnesses = await findPlayersInDistrict(districtId, 15);

  // Filter out the actor and target from potential witnesses
  const filteredWitnesses = potentialWitnesses.filter(
    id => id !== String(actorPlayerId) && id !== String(targetPlayerId)
  );

  // Create event_witnesses records for each potential witness
  if (filteredWitnesses.length > 0) {
    const witnessValues = filteredWitnesses.map((_, i) =>
      `($1, $${i + 2}, 'potential')`
    ).join(', ');

    await pool.query(
      `INSERT INTO event_witnesses (witnessed_event_id, witness_player_id, witness_status)
       VALUES ${witnessValues}
       ON CONFLICT DO NOTHING`,
      [eventId, ...filteredWitnesses.map(id => parseInt(id, 10))]
    );
  }

  console.log(`[Witness] Created event ${eventId} with ${filteredWitnesses.length} potential witnesses`);

  // Fetch the complete event with counts
  return getEventById(eventId);
}

/**
 * Get events that a player can witness (they are a potential witness)
 */
export async function getWitnessableEvents(playerId: string): Promise<WitnessedEvent[]> {
  console.log(`[Witness] Getting witnessable events for player ${playerId}`);

  const result = await pool.query(
    `SELECT
       we.*,
       actor.username as actor_player_name,
       target.username as target_player_name,
       d.name as district_name,
       COUNT(ew2.id) FILTER (WHERE ew2.witness_status = 'potential') as witness_count,
       COUNT(ew2.id) FILTER (WHERE ew2.witness_status = 'verified') as verified_count,
       COUNT(ew2.id) FILTER (WHERE ew2.witness_status = 'disputed') as disputed_count
     FROM witnessed_events we
     JOIN event_witnesses ew ON ew.witnessed_event_id = we.id
     LEFT JOIN event_witnesses ew2 ON ew2.witnessed_event_id = we.id
     LEFT JOIN players actor ON actor.id = we.actor_player_id
     LEFT JOIN players target ON target.id = we.target_player_id
     LEFT JOIN districts d ON d.id = we.district_id
     WHERE ew.witness_player_id = $1
       AND ew.witness_status = 'potential'
       AND we.verification_window_ends > NOW()
     GROUP BY we.id, actor.username, target.username, d.name
     ORDER BY we.occurred_at DESC`,
    [playerId]
  );

  console.log(`[Witness] Found ${result.rows.length} witnessable events for player ${playerId}`);
  return result.rows.map(row => mapRowToWitnessedEvent(row as WitnessedEventRow));
}

/**
 * Verify a witness and optionally create a testimonial
 */
export async function verifyWitness(
  witnessedEventId: string,
  witnessPlayerId: string,
  testimony?: string
): Promise<{ success: boolean; testimonial?: PlayerTestimonial }> {
  console.log(`[Witness] Verifying witness: event=${witnessedEventId}, witness=${witnessPlayerId}`);

  // Validate witness is 'potential' and within verification window
  const witnessResult = await pool.query(
    `SELECT ew.*, we.verification_window_ends, we.event_severity, we.actor_player_id, we.event_type
     FROM event_witnesses ew
     JOIN witnessed_events we ON we.id = ew.witnessed_event_id
     WHERE ew.witnessed_event_id = $1
       AND ew.witness_player_id = $2`,
    [witnessedEventId, witnessPlayerId]
  );

  if (witnessResult.rows.length === 0) {
    console.log(`[Witness] Witness record not found`);
    return { success: false };
  }

  const witnessRecord = witnessResult.rows[0];

  if (witnessRecord.witness_status !== 'potential') {
    console.log(`[Witness] Witness already processed: status=${witnessRecord.witness_status}`);
    return { success: false };
  }

  if (new Date(witnessRecord.verification_window_ends) < new Date()) {
    console.log(`[Witness] Verification window expired`);
    return { success: false };
  }

  // Update witness status to 'verified'
  await pool.query(
    `UPDATE event_witnesses
     SET witness_status = 'verified',
         verified_at = NOW(),
         testimony = $3
     WHERE witnessed_event_id = $1 AND witness_player_id = $2`,
    [witnessedEventId, witnessPlayerId, testimony || null]
  );

  // Get the witnessed event
  const event = await getEventById(parseInt(witnessedEventId, 10));
  if (!event) {
    return { success: true };
  }

  let testimonial: PlayerTestimonial | undefined;

  // If severity >= 5, create a testimonial
  if (witnessRecord.event_severity >= MIN_SEVERITY_FOR_TESTIMONIAL) {
    // Get witness name for testimonial
    const witnessNameResult = await pool.query(
      `SELECT username FROM players WHERE id = $1`,
      [witnessPlayerId]
    );
    const witnessName = witnessNameResult.rows[0]?.username || 'Unknown';

    const testimonialText = testimony || generateTestimonialText(event, witnessName);

    const testimonialResult = await pool.query(
      `INSERT INTO player_testimonials (
         player_id,
         witness_player_id,
         witnessed_event_id,
         testimonial_text,
         event_type
       ) VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [witnessRecord.actor_player_id, witnessPlayerId, witnessedEventId, testimonialText, witnessRecord.event_type]
    );

    if (testimonialResult.rows.length > 0) {
      // Fetch with player names
      const fullTestimonial = await pool.query(
        `SELECT pt.*,
                p.username as player_name,
                w.username as witness_player_name
         FROM player_testimonials pt
         LEFT JOIN players p ON p.id = pt.player_id
         LEFT JOIN players w ON w.id = pt.witness_player_id
         WHERE pt.id = $1`,
        [testimonialResult.rows[0].id]
      );

      if (fullTestimonial.rows.length > 0) {
        testimonial = mapRowToTestimonial(fullTestimonial.rows[0] as PlayerTestimonialRow);
      }
    }
  }

  // Check if this is the first verified witness
  const firstWitnessCheck = await pool.query(
    `SELECT COUNT(*) as verified_count
     FROM event_witnesses
     WHERE witnessed_event_id = $1
       AND witness_status = 'verified'`,
    [witnessedEventId]
  );

  const isFirstWitness = parseInt(firstWitnessCheck.rows[0].verified_count, 10) === 1;

  // Award reputation bonus to actor if first verified witness
  if (isFirstWitness) {
    const respectBonus = REPUTATION_BONUS_FIRST_WITNESS.respect * witnessRecord.event_severity;
    const fearBonus = REPUTATION_BONUS_FIRST_WITNESS.fear * witnessRecord.event_severity;

    try {
      await modifyReputation(
        String(witnessRecord.actor_player_id),
        'district',
        event.districtId,
        { respect: respectBonus, fear: fearBonus },
        `Witnessed ${witnessRecord.event_type} verified`,
        witnessPlayerId
      );

      // Mark reputation bonus as given
      await pool.query(
        `UPDATE event_witnesses
         SET reputation_bonus_given = true
         WHERE witnessed_event_id = $1 AND witness_player_id = $2`,
        [witnessedEventId, witnessPlayerId]
      );

      console.log(`[Witness] Awarded reputation bonus: respect=${respectBonus}, fear=${fearBonus}`);
    } catch (error) {
      console.error(`[Witness] Failed to award reputation bonus:`, error);
    }
  }

  console.log(`[Witness] Successfully verified witness for event ${witnessedEventId}`);
  return { success: true, testimonial };
}

/**
 * Get all witnesses for an event with player names
 */
export async function getEventWitnesses(witnessedEventId: string): Promise<EventWitness[]> {
  console.log(`[Witness] Getting witnesses for event ${witnessedEventId}`);

  const result = await pool.query(
    `SELECT ew.*,
            p.username as witness_player_name
     FROM event_witnesses ew
     LEFT JOIN players p ON p.id = ew.witness_player_id
     WHERE ew.witnessed_event_id = $1
     ORDER BY ew.witness_status, ew.created_at`,
    [witnessedEventId]
  );

  console.log(`[Witness] Found ${result.rows.length} witnesses for event ${witnessedEventId}`);
  return result.rows.map(row => mapRowToEventWitness(row as EventWitnessRow));
}

/**
 * Get testimonials about a player (they are the actor)
 */
export async function getPlayerTestimonials(
  playerId: string,
  limit: number = 20
): Promise<PlayerTestimonial[]> {
  console.log(`[Witness] Getting testimonials for player ${playerId}`);

  const result = await pool.query(
    `SELECT pt.*,
            p.username as player_name,
            w.username as witness_player_name
     FROM player_testimonials pt
     LEFT JOIN players p ON p.id = pt.player_id
     LEFT JOIN players w ON w.id = pt.witness_player_id
     WHERE pt.player_id = $1
     ORDER BY pt.featured DESC, pt.created_at DESC
     LIMIT $2`,
    [playerId, limit]
  );

  console.log(`[Witness] Found ${result.rows.length} testimonials for player ${playerId}`);
  return result.rows.map(row => mapRowToTestimonial(row as PlayerTestimonialRow));
}

/**
 * Set testimonial featured status
 * Limit to max 3 featured per player
 */
export async function setTestimonialFeatured(
  testimonialId: string,
  playerId: string,
  featured: boolean
): Promise<boolean> {
  console.log(`[Witness] Setting testimonial ${testimonialId} featured=${featured} for player ${playerId}`);

  // Validate testimonial belongs to player
  const validationResult = await pool.query(
    `SELECT id FROM player_testimonials
     WHERE id = $1 AND player_id = $2`,
    [testimonialId, playerId]
  );

  if (validationResult.rows.length === 0) {
    console.log(`[Witness] Testimonial ${testimonialId} does not belong to player ${playerId}`);
    return false;
  }

  // If featuring, check limit
  if (featured) {
    const countResult = await pool.query(
      `SELECT COUNT(*) as featured_count
       FROM player_testimonials
       WHERE player_id = $1 AND featured = true`,
      [playerId]
    );

    const currentFeatured = parseInt(countResult.rows[0].featured_count, 10);
    if (currentFeatured >= MAX_FEATURED_TESTIMONIALS) {
      console.log(`[Witness] Player ${playerId} already has ${MAX_FEATURED_TESTIMONIALS} featured testimonials`);
      return false;
    }
  }

  // Update featured status
  await pool.query(
    `UPDATE player_testimonials
     SET featured = $3
     WHERE id = $1 AND player_id = $2`,
    [testimonialId, playerId, featured]
  );

  console.log(`[Witness] Updated testimonial ${testimonialId} featured=${featured}`);
  return true;
}

/**
 * Get witness history for a player
 */
export async function getWitnessHistory(
  playerId: string
): Promise<{ witnessed: WitnessedEvent[]; verified: number }> {
  console.log(`[Witness] Getting witness history for player ${playerId}`);

  // Get events player has witnessed (as witness)
  const eventsResult = await pool.query(
    `SELECT
       we.*,
       actor.username as actor_player_name,
       target.username as target_player_name,
       d.name as district_name,
       COUNT(ew2.id) FILTER (WHERE ew2.witness_status = 'potential') as witness_count,
       COUNT(ew2.id) FILTER (WHERE ew2.witness_status = 'verified') as verified_count,
       COUNT(ew2.id) FILTER (WHERE ew2.witness_status = 'disputed') as disputed_count
     FROM witnessed_events we
     JOIN event_witnesses ew ON ew.witnessed_event_id = we.id
     LEFT JOIN event_witnesses ew2 ON ew2.witnessed_event_id = we.id
     LEFT JOIN players actor ON actor.id = we.actor_player_id
     LEFT JOIN players target ON target.id = we.target_player_id
     LEFT JOIN districts d ON d.id = we.district_id
     WHERE ew.witness_player_id = $1
     GROUP BY we.id, actor.username, target.username, d.name
     ORDER BY we.occurred_at DESC`,
    [playerId]
  );

  // Count verified witnesses by this player
  const verifiedResult = await pool.query(
    `SELECT COUNT(*) as verified_count
     FROM event_witnesses
     WHERE witness_player_id = $1 AND witness_status = 'verified'`,
    [playerId]
  );

  const witnessed = eventsResult.rows.map(row => mapRowToWitnessedEvent(row as WitnessedEventRow));
  const verified = parseInt(verifiedResult.rows[0].verified_count, 10);

  console.log(`[Witness] Player ${playerId} has witnessed ${witnessed.length} events, verified ${verified}`);
  return { witnessed, verified };
}

/**
 * Expire witness windows that have passed
 */
export async function expireWitnessWindows(): Promise<number> {
  console.log(`[Witness] Expiring witness windows`);

  const result = await pool.query(
    `UPDATE event_witnesses ew
     SET witness_status = 'expired'
     FROM witnessed_events we
     WHERE ew.witnessed_event_id = we.id
       AND ew.witness_status = 'potential'
       AND we.verification_window_ends < NOW()
     RETURNING ew.id`
  );

  const expiredCount = result.rows.length;
  console.log(`[Witness] Expired ${expiredCount} witness records`);
  return expiredCount;
}

/**
 * Get a single event by ID with counts
 */
export async function getEventById(eventId: number): Promise<WitnessedEvent | null> {
  console.log(`[Witness] Getting event by ID: ${eventId}`);

  const result = await pool.query(
    `SELECT
       we.*,
       actor.username as actor_player_name,
       target.username as target_player_name,
       d.name as district_name,
       COUNT(ew.id) FILTER (WHERE ew.witness_status = 'potential') as witness_count,
       COUNT(ew.id) FILTER (WHERE ew.witness_status = 'verified') as verified_count,
       COUNT(ew.id) FILTER (WHERE ew.witness_status = 'disputed') as disputed_count
     FROM witnessed_events we
     LEFT JOIN event_witnesses ew ON ew.witnessed_event_id = we.id
     LEFT JOIN players actor ON actor.id = we.actor_player_id
     LEFT JOIN players target ON target.id = we.target_player_id
     LEFT JOIN districts d ON d.id = we.district_id
     WHERE we.id = $1
     GROUP BY we.id, actor.username, target.username, d.name`,
    [eventId]
  );

  if (result.rows.length === 0) {
    console.log(`[Witness] Event ${eventId} not found`);
    return null;
  }

  return mapRowToWitnessedEvent(result.rows[0] as WitnessedEventRow);
}

// =============================================================================
// EXPORT
// =============================================================================

export default {
  createWitnessedEvent,
  findPlayersInDistrict,
  getWitnessableEvents,
  verifyWitness,
  getEventWitnesses,
  getPlayerTestimonials,
  setTestimonialFeatured,
  getWitnessHistory,
  expireWitnessWindows,
  getEventById
};
