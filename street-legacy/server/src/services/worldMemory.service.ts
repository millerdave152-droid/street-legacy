/**
 * World Memory Service
 * Manages permanent memory of significant game events that NPCs and the world reference
 */

import pool from '../db/connection.js';
import {
  WorldEvent,
  WorldEventRow,
  WorldEventType,
  WorldMonument,
  WorldMonumentRow,
  NpcMemory,
  NpcMemoryRow,
  MemoryType,
  MemorySentiment,
  MonumentType,
  CreateWorldEventRequest,
  LANDMARK_TRIGGERS,
  rowToWorldEvent,
  rowToWorldMonument,
  rowToNpcMemory,
  isLandmarkEvent,
  getDefaultMonumentType,
  getDefaultMonumentTitle
} from '../types/worldMemory.types.js';

// =============================================================================
// WORLD EVENT OPERATIONS
// =============================================================================

/**
 * Record a significant world event
 */
export async function recordWorldEvent(
  params: CreateWorldEventRequest
): Promise<WorldEvent | null> {
  console.log(`[WorldMemory] Recording event: ${params.eventType} (significance: ${params.significance})`);

  const isLandmark = isLandmarkEvent(params.significance);

  try {
    const result = await pool.query(
      `INSERT INTO world_events (
        event_type,
        significance,
        headline,
        description,
        primary_player_id,
        secondary_player_ids,
        crew_id,
        district_id,
        metadata,
        is_landmark
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        params.eventType,
        params.significance,
        params.headline,
        params.description || null,
        params.primaryPlayerId || null,
        params.secondaryPlayerIds || [],
        params.crewId || null,
        params.districtId || null,
        params.metadata || {},
        isLandmark
      ]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const event = rowToWorldEvent(result.rows[0] as WorldEventRow);

    // Auto-create monument for landmark events
    if (isLandmark && params.districtId) {
      console.log(`[WorldMemory] Creating monument for landmark event: ${event.id}`);
      await createMonument(event.id, params.districtId, event);
    }

    console.log(`[WorldMemory] Event recorded: ${event.id} - "${event.headline}"`);
    return event;
  } catch (error) {
    console.error('[WorldMemory] Error recording world event:', error);
    return null;
  }
}

/**
 * Create a monument for a landmark event
 */
export async function createMonument(
  worldEventId: number,
  districtId: string,
  event: WorldEvent
): Promise<WorldMonument | null> {
  console.log(`[WorldMemory] Creating monument for event ${worldEventId} in ${districtId}`);

  const monumentType = getDefaultMonumentType(event.eventType);
  const monumentTitle = getDefaultMonumentTitle(event.eventType);
  const inscription = `${event.headline} - ${new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })}`;

  try {
    const result = await pool.query(
      `INSERT INTO world_monuments (
        world_event_id,
        district_id,
        monument_type,
        title,
        inscription
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [worldEventId, districtId, monumentType, monumentTitle, inscription]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const monument = rowToWorldMonument(result.rows[0] as WorldMonumentRow);
    console.log(`[WorldMemory] Monument created: ${monument.id} - "${monument.title}"`);
    return monument;
  } catch (error) {
    console.error('[WorldMemory] Error creating monument:', error);
    return null;
  }
}

/**
 * Get a specific world event by ID
 */
export async function getWorldEvent(eventId: number): Promise<WorldEvent | null> {
  console.log(`[WorldMemory] Getting event: ${eventId}`);

  try {
    const result = await pool.query(
      `SELECT
        we.*,
        p.username as primary_player_name,
        c.name as crew_name
      FROM world_events we
      LEFT JOIN players p ON we.primary_player_id = p.id
      LEFT JOIN crews c ON we.crew_id = c.id
      WHERE we.id = $1`,
      [eventId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return rowToWorldEvent(result.rows[0] as WorldEventRow);
  } catch (error) {
    console.error('[WorldMemory] Error getting world event:', error);
    return null;
  }
}

/**
 * Get recent world events
 */
export async function getRecentWorldEvents(
  limit: number = 50,
  minSignificance: number = 1
): Promise<WorldEvent[]> {
  console.log(`[WorldMemory] Getting recent events: limit=${limit}, minSignificance=${minSignificance}`);

  try {
    const result = await pool.query(
      `SELECT
        we.*,
        p.username as primary_player_name,
        c.name as crew_name
      FROM world_events we
      LEFT JOIN players p ON we.primary_player_id = p.id
      LEFT JOIN crews c ON we.crew_id = c.id
      WHERE we.significance >= $1
      ORDER BY we.created_at DESC
      LIMIT $2`,
      [minSignificance, limit]
    );

    return result.rows.map(row => rowToWorldEvent(row as WorldEventRow));
  } catch (error) {
    console.error('[WorldMemory] Error getting recent events:', error);
    return [];
  }
}

/**
 * Get district history (events and monuments)
 */
export async function getDistrictHistory(
  districtId: string,
  limit: number = 20
): Promise<{ events: WorldEvent[]; monuments: WorldMonument[] }> {
  console.log(`[WorldMemory] Getting district history: ${districtId}`);

  try {
    // Get events for district
    const eventsResult = await pool.query(
      `SELECT
        we.*,
        p.username as primary_player_name,
        c.name as crew_name
      FROM world_events we
      LEFT JOIN players p ON we.primary_player_id = p.id
      LEFT JOIN crews c ON we.crew_id = c.id
      WHERE we.district_id = $1
      ORDER BY we.significance DESC, we.created_at DESC
      LIMIT $2`,
      [districtId, limit]
    );

    // Get monuments for district
    const monumentsResult = await pool.query(
      `SELECT * FROM world_monuments
      WHERE district_id = $1
      ORDER BY created_at DESC`,
      [districtId]
    );

    return {
      events: eventsResult.rows.map(row => rowToWorldEvent(row as WorldEventRow)),
      monuments: monumentsResult.rows.map(row => rowToWorldMonument(row as WorldMonumentRow))
    };
  } catch (error) {
    console.error('[WorldMemory] Error getting district history:', error);
    return { events: [], monuments: [] };
  }
}

/**
 * Get a player's legacy (all events they're involved in)
 */
export async function getPlayerLegacy(
  playerId: number
): Promise<{ events: WorldEvent[]; monumentsEarned: number }> {
  console.log(`[WorldMemory] Getting player legacy: ${playerId}`);

  try {
    // Get events where player is primary or in secondary array
    const eventsResult = await pool.query(
      `SELECT
        we.*,
        p.username as primary_player_name,
        c.name as crew_name
      FROM world_events we
      LEFT JOIN players p ON we.primary_player_id = p.id
      LEFT JOIN crews c ON we.crew_id = c.id
      WHERE we.primary_player_id = $1
         OR $1 = ANY(we.secondary_player_ids)
      ORDER BY we.significance DESC, we.created_at DESC`,
      [playerId]
    );

    // Count monuments earned
    const monumentsResult = await pool.query(
      `SELECT COUNT(*) as count
      FROM world_monuments wm
      JOIN world_events we ON wm.world_event_id = we.id
      WHERE we.primary_player_id = $1`,
      [playerId]
    );

    return {
      events: eventsResult.rows.map(row => rowToWorldEvent(row as WorldEventRow)),
      monumentsEarned: parseInt(monumentsResult.rows[0]?.count || '0', 10)
    };
  } catch (error) {
    console.error('[WorldMemory] Error getting player legacy:', error);
    return { events: [], monumentsEarned: 0 };
  }
}

/**
 * Get landmark events (the "history book" moments)
 */
export async function getLandmarkEvents(limit: number = 50): Promise<WorldEvent[]> {
  console.log(`[WorldMemory] Getting landmark events: limit=${limit}`);

  try {
    const result = await pool.query(
      `SELECT
        we.*,
        p.username as primary_player_name,
        c.name as crew_name
      FROM world_events we
      LEFT JOIN players p ON we.primary_player_id = p.id
      LEFT JOIN crews c ON we.crew_id = c.id
      WHERE we.is_landmark = TRUE
      ORDER BY we.significance DESC, we.created_at DESC
      LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => rowToWorldEvent(row as WorldEventRow));
  } catch (error) {
    console.error('[WorldMemory] Error getting landmark events:', error);
    return [];
  }
}

/**
 * Get all monuments, optionally filtered by district
 */
export async function getMonuments(districtId?: string): Promise<WorldMonument[]> {
  console.log(`[WorldMemory] Getting monuments: ${districtId || 'all'}`);

  try {
    let query = 'SELECT * FROM world_monuments';
    const params: string[] = [];

    if (districtId) {
      query += ' WHERE district_id = $1';
      params.push(districtId);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return result.rows.map(row => rowToWorldMonument(row as WorldMonumentRow));
  } catch (error) {
    console.error('[WorldMemory] Error getting monuments:', error);
    return [];
  }
}

// =============================================================================
// NPC MEMORY OPERATIONS
// =============================================================================

/**
 * Add a memory to an NPC
 */
export async function addNpcMemory(
  npcId: string,
  worldEventId: number,
  memoryType: MemoryType,
  sentiment: MemorySentiment,
  dialogueSnippets: string[],
  durationDays?: number
): Promise<NpcMemory | null> {
  console.log(`[WorldMemory] Adding NPC memory: npc=${npcId}, event=${worldEventId}`);

  const expiresAt = durationDays
    ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
    : null;

  try {
    const result = await pool.query(
      `INSERT INTO npc_memories (
        npc_id,
        world_event_id,
        memory_type,
        sentiment,
        dialogue_snippets,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [npcId, worldEventId, memoryType, sentiment, dialogueSnippets, expiresAt]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const memory = rowToNpcMemory(result.rows[0] as NpcMemoryRow);
    console.log(`[WorldMemory] NPC memory added: ${memory.id}`);
    return memory;
  } catch (error) {
    console.error('[WorldMemory] Error adding NPC memory:', error);
    return null;
  }
}

/**
 * Get memories for an NPC (excludes expired)
 */
export async function getNpcMemories(
  npcId: string,
  limit: number = 10
): Promise<NpcMemory[]> {
  console.log(`[WorldMemory] Getting NPC memories: ${npcId}`);

  try {
    const result = await pool.query(
      `SELECT nm.*
      FROM npc_memories nm
      JOIN world_events we ON nm.world_event_id = we.id
      WHERE nm.npc_id = $1
        AND (nm.expires_at IS NULL OR nm.expires_at > NOW())
      ORDER BY we.significance DESC, nm.created_at DESC
      LIMIT $2`,
      [npcId, limit]
    );

    return result.rows.map(row => rowToNpcMemory(row as NpcMemoryRow));
  } catch (error) {
    console.error('[WorldMemory] Error getting NPC memories:', error);
    return [];
  }
}

/**
 * Get NPC dialogue about remembered events
 */
export async function getNpcDialogue(
  npcId: string,
  limit: number = 5
): Promise<{ eventHeadline: string; sentiment: MemorySentiment; dialogue: string }[]> {
  console.log(`[WorldMemory] Getting NPC dialogue: ${npcId}`);

  try {
    const result = await pool.query(
      `SELECT
        we.headline,
        nm.sentiment,
        unnest(nm.dialogue_snippets) as dialogue
      FROM npc_memories nm
      JOIN world_events we ON we.id = nm.world_event_id
      WHERE nm.npc_id = $1
        AND (nm.expires_at IS NULL OR nm.expires_at > NOW())
      ORDER BY we.significance DESC, we.created_at DESC
      LIMIT $2`,
      [npcId, limit]
    );

    return result.rows.map(row => ({
      eventHeadline: row.headline,
      sentiment: row.sentiment as MemorySentiment,
      dialogue: row.dialogue
    }));
  } catch (error) {
    console.error('[WorldMemory] Error getting NPC dialogue:', error);
    return [];
  }
}

/**
 * Clean up expired NPC memories
 */
export async function cleanExpiredMemories(): Promise<number> {
  console.log('[WorldMemory] Cleaning expired NPC memories');

  try {
    const result = await pool.query(
      `DELETE FROM npc_memories
      WHERE expires_at IS NOT NULL AND expires_at < NOW()
      RETURNING id`
    );

    const count = result.rows.length;
    console.log(`[WorldMemory] Cleaned ${count} expired memories`);
    return count;
  } catch (error) {
    console.error('[WorldMemory] Error cleaning expired memories:', error);
    return 0;
  }
}

// =============================================================================
// LANDMARK TRIGGER OPERATIONS
// =============================================================================

/**
 * Check if a landmark should be recorded and create the event
 */
export async function checkAndRecordLandmark(
  trigger: string,
  playerId: number,
  districtId?: string,
  metadata?: Record<string, unknown>,
  playerName?: string,
  districtName?: string,
  crewId?: number,
  crewName?: string
): Promise<WorldEvent | null> {
  console.log(`[WorldMemory] Checking landmark trigger: ${trigger} for player ${playerId}`);

  const triggerConfig = LANDMARK_TRIGGERS[trigger];
  if (!triggerConfig) {
    console.log(`[WorldMemory] Unknown trigger: ${trigger}`);
    return null;
  }

  // Check if this exact landmark already exists for this player/district combo
  try {
    const existingCheck = await pool.query(
      `SELECT id FROM world_events
      WHERE event_type = $1
        AND primary_player_id = $2
        AND ($3::VARCHAR IS NULL OR district_id = $3)
      LIMIT 1`,
      [triggerConfig.eventType, playerId, districtId || null]
    );

    if (existingCheck.rows.length > 0) {
      console.log(`[WorldMemory] Landmark already exists for this trigger`);
      return null;
    }

    // Generate the headline
    const headline = generateHeadline(
      triggerConfig.eventType,
      playerName,
      districtName,
      crewName,
      metadata
    );

    // Record the world event
    return await recordWorldEvent({
      eventType: triggerConfig.eventType,
      significance: triggerConfig.significance,
      headline,
      description: `A landmark moment in city history.`,
      primaryPlayerId: playerId,
      districtId,
      crewId,
      metadata: {
        trigger,
        ...metadata
      }
    });
  } catch (error) {
    console.error('[WorldMemory] Error checking/recording landmark:', error);
    return null;
  }
}

/**
 * Generate a headline for an event type
 */
export function generateHeadline(
  eventType: WorldEventType,
  playerName?: string,
  districtName?: string,
  crewName?: string,
  metadata?: Record<string, unknown>
): string {
  const player = playerName || 'Unknown Player';
  const district = districtName || 'the City';
  const crew = crewName || 'Unknown Crew';

  switch (eventType) {
    case 'first_district_monopoly':
      return `${player} Achieves Total Control of ${district}`;

    case 'crew_wipe':
      return `${crew} Falls - Complete Crew Elimination`;

    case 'heist_record':
      const amount = metadata?.amount || 'massive';
      return `Historic $${amount} Heist Breaks All Records`;

    case 'property_empire':
      return `${player} Builds Real Estate Empire`;

    case 'crew_war_ended':
      const warName = metadata?.warName || 'Great';
      return `The ${warName} War Finally Ends`;

    case 'first_million':
      return `${player} Joins the Millionaires Club`;

    case 'legendary_escape':
      return `${player} Escapes Against All Odds`;

    case 'betrayal':
      return `Infamous Betrayal Rocks ${crew}`;

    case 'crew_founded':
      return `${crew} Rises - New Power in the Streets`;

    case 'business_empire':
      return `${player} Builds Business Empire`;

    case 'police_crackdown':
      return `Massive Police Crackdown Sweeps ${district}`;

    case 'district_takeover':
      return `${crew} Takes Control of ${district}`;

    case 'faction_alliance':
      return `Historic Alliance Formed in ${district}`;

    case 'faction_war':
      return `War Declared - Factions Clash in ${district}`;

    case 'prison_break':
      return `${player} Orchestrates Daring Prison Break`;

    case 'kingpin_rise':
      return `${player} Crowned Kingpin of ${district}`;

    case 'legendary_fight':
      const opponent = metadata?.opponent || 'Rival';
      return `Legendary Battle: ${player} vs ${opponent}`;

    case 'market_crash':
      return `Economic Crisis Hits ${district}`;

    case 'market_boom':
      return `${district} Experiences Economic Boom`;

    default:
      return `Historic Event Occurs in ${district}`;
  }
}

/**
 * Distribute memories of an event to nearby NPCs
 */
export async function distributeEventMemories(
  worldEventId: number,
  districtId: string,
  significance: number
): Promise<number> {
  console.log(`[WorldMemory] Distributing event memories: event=${worldEventId}, district=${districtId}`);

  // Get NPCs in the district (assuming NPC IDs follow a pattern like 'npc_downtown_1')
  // In a real implementation, you'd query an NPCs table
  const npcCount = Math.min(significance, 5); // More significant = more NPCs remember

  const sentiments: MemorySentiment[] = ['neutral', 'positive', 'negative', 'fearful', 'respectful'];
  const memoryTypes: MemoryType[] = ['witnessed', 'heard_rumor', 'personal_impact'];

  let memoriesCreated = 0;

  for (let i = 1; i <= npcCount; i++) {
    const npcId = `npc_${districtId}_${i}`;
    const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
    const memoryType = i <= 2 ? 'witnessed' : memoryTypes[Math.floor(Math.random() * memoryTypes.length)];

    // Duration based on significance (high significance = longer/permanent memory)
    const durationDays = significance >= 8 ? undefined : (significance * 10);

    // Generate dialogue snippets
    const dialogueSnippets = generateDialogueSnippets(sentiment, significance);

    const memory = await addNpcMemory(
      npcId,
      worldEventId,
      memoryType,
      sentiment,
      dialogueSnippets,
      durationDays
    );

    if (memory) {
      memoriesCreated++;
    }
  }

  console.log(`[WorldMemory] Created ${memoriesCreated} NPC memories for event`);
  return memoriesCreated;
}

/**
 * Generate dialogue snippets based on sentiment
 */
function generateDialogueSnippets(
  sentiment: MemorySentiment,
  significance: number
): string[] {
  const snippets: string[] = [];

  switch (sentiment) {
    case 'positive':
      snippets.push("Did you hear about that? Amazing times we live in.");
      if (significance >= 7) snippets.push("That's one for the history books!");
      break;

    case 'negative':
      snippets.push("Things haven't been the same since then...");
      if (significance >= 7) snippets.push("Dark times. I try not to think about it.");
      break;

    case 'neutral':
      snippets.push("Everyone's been talking about it.");
      snippets.push("Interesting times, that's for sure.");
      break;

    case 'fearful':
      snippets.push("Keep your voice down... I don't want that kind of attention.");
      if (significance >= 7) snippets.push("Just thinking about it gives me chills.");
      break;

    case 'respectful':
      snippets.push("You have to respect what happened there.");
      if (significance >= 7) snippets.push("Now THAT took real skill.");
      break;
  }

  return snippets;
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get world memory statistics
 */
export async function getWorldMemoryStats(): Promise<{
  totalEvents: number;
  landmarkEvents: number;
  totalMonuments: number;
  totalNpcMemories: number;
  recentEventsCount: number;
}> {
  console.log('[WorldMemory] Getting statistics');

  try {
    const results = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM world_events'),
      pool.query('SELECT COUNT(*) as count FROM world_events WHERE is_landmark = TRUE'),
      pool.query('SELECT COUNT(*) as count FROM world_monuments'),
      pool.query('SELECT COUNT(*) as count FROM npc_memories WHERE expires_at IS NULL OR expires_at > NOW()'),
      pool.query(`SELECT COUNT(*) as count FROM world_events WHERE created_at > NOW() - INTERVAL '24 hours'`)
    ]);

    return {
      totalEvents: parseInt(results[0].rows[0].count, 10),
      landmarkEvents: parseInt(results[1].rows[0].count, 10),
      totalMonuments: parseInt(results[2].rows[0].count, 10),
      totalNpcMemories: parseInt(results[3].rows[0].count, 10),
      recentEventsCount: parseInt(results[4].rows[0].count, 10)
    };
  } catch (error) {
    console.error('[WorldMemory] Error getting statistics:', error);
    return {
      totalEvents: 0,
      landmarkEvents: 0,
      totalMonuments: 0,
      totalNpcMemories: 0,
      recentEventsCount: 0
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // World Event operations
  recordWorldEvent,
  createMonument,
  getWorldEvent,
  getRecentWorldEvents,
  getDistrictHistory,
  getPlayerLegacy,
  getLandmarkEvents,
  getMonuments,

  // NPC Memory operations
  addNpcMemory,
  getNpcMemories,
  getNpcDialogue,
  cleanExpiredMemories,

  // Landmark triggers
  checkAndRecordLandmark,
  generateHeadline,
  distributeEventMemories,

  // Statistics
  getWorldMemoryStats
};
