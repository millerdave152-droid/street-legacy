/**
 * World Memory System Types
 * Permanent memory of significant game events that NPCs and the world reference
 */

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Types of world events that can be recorded
 */
export type WorldEventType =
  | 'first_district_monopoly'  // Player owns all properties in a district
  | 'crew_wipe'                // Entire crew eliminated
  | 'heist_record'             // Record-breaking heist
  | 'property_empire'          // Massive property portfolio milestone
  | 'crew_war_ended'           // Major crew war concluded
  | 'first_million'            // Player reaches $1M
  | 'legendary_escape'         // Escaped impossible odds
  | 'betrayal'                 // Major crew betrayal
  | 'crew_founded'             // New crew established
  | 'business_empire'          // Business milestone
  | 'police_crackdown'         // Major police operation
  | 'district_takeover'        // Crew takes control of district
  | 'faction_alliance'         // Major faction alliance formed
  | 'faction_war'              // Faction war declared
  | 'prison_break'             // Successful prison escape
  | 'kingpin_rise'             // Player becomes district kingpin
  | 'legendary_fight'          // Epic PvP battle
  | 'market_crash'             // Economic event
  | 'market_boom';             // Economic event

/**
 * Types of monuments that commemorate landmark events
 */
export type MonumentType = 'plaque' | 'memorial' | 'statue' | 'renamed_location';

/**
 * NPC sentiment towards a remembered event
 */
export type MemorySentiment = 'positive' | 'negative' | 'neutral' | 'fearful' | 'respectful';

/**
 * How an NPC knows about an event
 */
export type MemoryType = 'witnessed' | 'heard_rumor' | 'personal_impact';

// =============================================================================
// WORLD EVENT INTERFACES
// =============================================================================

/**
 * A significant world event that becomes part of the game's permanent history
 */
export interface WorldEvent {
  /** Unique event identifier */
  id: number;
  /** Type classification of the event */
  eventType: WorldEventType;
  /** Importance level (1=minor, 10=legendary) */
  significance: number;
  /** News-style headline summarizing the event */
  headline: string;
  /** Detailed narrative description */
  description: string | null;
  /** Primary player involved in the event */
  primaryPlayerId: number | null;
  /** Array of other players involved */
  secondaryPlayerIds: number[];
  /** Crew involved (if applicable) */
  crewId: number | null;
  /** District where the event occurred */
  districtId: string | null;
  /** Flexible metadata for event-specific data */
  metadata: Record<string, unknown>;
  /** True if this is a landmark event (significance >= 8) */
  isLandmark: boolean;
  /** When the event occurred */
  createdAt: Date;
  /** Primary player's username (from join) */
  primaryPlayerName?: string;
  /** District name (from join) */
  districtName?: string;
  /** Crew name (from join) */
  crewName?: string;
}

/**
 * Database row type for world_events (snake_case)
 */
export interface WorldEventRow {
  id: number;
  event_type: string;
  significance: number;
  headline: string;
  description: string | null;
  primary_player_id: number | null;
  secondary_player_ids: number[];
  crew_id: number | null;
  district_id: string | null;
  metadata: Record<string, unknown>;
  is_landmark: boolean;
  created_at: Date;
  // Optional joined fields
  primary_player_name?: string;
  district_name?: string;
  crew_name?: string;
}

// =============================================================================
// MONUMENT INTERFACES
// =============================================================================

/**
 * A physical monument commemorating a landmark event
 */
export interface WorldMonument {
  /** Unique monument identifier */
  id: number;
  /** Reference to the event this commemorates */
  worldEventId: number;
  /** District where the monument is located */
  districtId: string;
  /** Type of monument (plaque, memorial, statue, renamed_location) */
  monumentType: MonumentType;
  /** Name/title of the monument */
  title: string;
  /** Text inscribed on the monument */
  inscription: string | null;
  /** When the monument was created */
  createdAt: Date;
}

/**
 * Database row type for world_monuments (snake_case)
 */
export interface WorldMonumentRow {
  id: number;
  world_event_id: number;
  district_id: string;
  monument_type: string;
  title: string;
  inscription: string | null;
  created_at: Date;
}

// =============================================================================
// NPC MEMORY INTERFACES
// =============================================================================

/**
 * An NPC's memory of a world event
 */
export interface NpcMemory {
  /** Unique memory identifier */
  id: number;
  /** NPC who has this memory */
  npcId: string;
  /** Reference to the remembered event */
  worldEventId: number;
  /** How the NPC knows about this (witnessed, heard_rumor, personal_impact) */
  memoryType: MemoryType;
  /** NPC's feeling about the event */
  sentiment: MemorySentiment;
  /** Array of dialogue lines the NPC might say */
  dialogueSnippets: string[];
  /** When this memory expires (null = permanent) */
  expiresAt: Date | null;
  /** When the memory was created */
  createdAt: Date;
}

/**
 * Database row type for npc_memories (snake_case)
 */
export interface NpcMemoryRow {
  id: number;
  npc_id: string;
  world_event_id: number;
  memory_type: string;
  sentiment: string;
  dialogue_snippets: string[];
  expires_at: Date | null;
  created_at: Date;
}

// =============================================================================
// API REQUEST TYPES
// =============================================================================

/**
 * Request to create a new world event
 */
export interface CreateWorldEventRequest {
  /** Type of event being recorded */
  eventType: WorldEventType;
  /** Importance level (1-10) */
  significance: number;
  /** News-style headline */
  headline: string;
  /** Detailed description (optional) */
  description?: string;
  /** Primary player involved (optional) */
  primaryPlayerId?: number;
  /** Other players involved (optional) */
  secondaryPlayerIds?: number[];
  /** Crew involved (optional) */
  crewId?: number;
  /** District where event occurred (optional) */
  districtId?: string;
  /** Additional metadata (optional) */
  metadata?: Record<string, unknown>;
}

/**
 * Request to add an NPC memory
 */
export interface AddNpcMemoryRequest {
  /** NPC identifier */
  npcId: string;
  /** World event to remember */
  worldEventId: number;
  /** How the NPC knows about this */
  memoryType: MemoryType;
  /** NPC's feeling about the event */
  sentiment: MemorySentiment;
  /** Dialogue snippets the NPC might say */
  dialogueSnippets: string[];
  /** Days until memory expires (null = permanent) */
  durationDays?: number | null;
}

/**
 * Request filters for getting world events
 */
export interface GetWorldEventsFilters {
  /** Filter by district */
  districtId?: string;
  /** Filter by event type */
  eventType?: WorldEventType;
  /** Filter by player */
  playerId?: number;
  /** Filter by crew */
  crewId?: number;
  /** Minimum significance level */
  minSignificance?: number;
  /** Only return landmark events */
  landmarksOnly?: boolean;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Response for getting world events
 */
export interface GetWorldEventsResponse {
  success: boolean;
  data: {
    events: WorldEvent[];
    total: number;
  };
}

/**
 * Response for getting a single world event
 */
export interface GetWorldEventResponse {
  success: boolean;
  data: WorldEvent;
}

/**
 * Response for getting district history
 */
export interface GetDistrictHistoryResponse {
  success: boolean;
  data: {
    districtId: string;
    events: WorldEvent[];
    monuments: WorldMonument[];
    total: number;
  };
}

/**
 * Response for getting landmarks
 */
export interface GetLandmarksResponse {
  success: boolean;
  data: {
    landmarks: (WorldEvent & { monument?: WorldMonument })[];
    total: number;
  };
}

/**
 * Response for getting NPC memories
 */
export interface GetNpcMemoriesResponse {
  success: boolean;
  data: {
    npcId: string;
    memories: (NpcMemory & { event: WorldEvent })[];
  };
}

/**
 * Response for creating a world event
 */
export interface CreateWorldEventResponse {
  success: boolean;
  data: {
    event: WorldEvent;
    monument?: WorldMonument;
  };
}

/**
 * NPC dialogue about an event
 */
export interface NpcDialogue {
  eventHeadline: string;
  sentiment: MemorySentiment;
  dialogue: string;
}

/**
 * Response for getting NPC dialogue
 */
export interface GetNpcDialogueResponse {
  success: boolean;
  data: {
    npcId: string;
    dialogues: NpcDialogue[];
  };
}

// =============================================================================
// LANDMARK TRIGGERS
// =============================================================================

/**
 * Configuration for a landmark trigger
 */
export interface LandmarkTriggerConfig {
  eventType: WorldEventType;
  significance: number;
  headlineTemplate: string;
  monumentType: MonumentType;
  monumentTitle: string;
}

/**
 * Pre-defined triggers for automatic world event creation
 * These fire when specific game conditions are met
 */
export const LANDMARK_TRIGGERS: Record<string, LandmarkTriggerConfig> = {
  /** Player acquires all properties in a district */
  FIRST_DISTRICT_MONOPOLY: {
    eventType: 'first_district_monopoly',
    significance: 9,
    headlineTemplate: '{player} Seizes Complete Control of {district}',
    monumentType: 'plaque',
    monumentTitle: 'District Monopoly Memorial'
  },
  /** Player reaches $1,000,000 cash */
  FIRST_MILLION: {
    eventType: 'first_million',
    significance: 7,
    headlineTemplate: '{player} Joins the Millionaires Club',
    monumentType: 'plaque',
    monumentTitle: 'Millionaire Achievement Marker'
  },
  /** Entire crew is eliminated */
  CREW_WIPE: {
    eventType: 'crew_wipe',
    significance: 8,
    headlineTemplate: '{crew} Falls - Complete Crew Elimination',
    monumentType: 'memorial',
    monumentTitle: 'Fallen Crew Memorial'
  },
  /** New heist dollar record set */
  HEIST_RECORD: {
    eventType: 'heist_record',
    significance: 8,
    headlineTemplate: 'Historic ${amount} Heist Breaks All Records',
    monumentType: 'plaque',
    monumentTitle: 'Historic Heist Marker'
  },
  /** Player owns 20+ properties */
  PROPERTY_EMPIRE: {
    eventType: 'property_empire',
    significance: 8,
    headlineTemplate: '{player} Builds Real Estate Empire',
    monumentType: 'statue',
    monumentTitle: 'Real Estate Baron Statue'
  },
  /** Major crew war concludes */
  CREW_WAR_ENDED: {
    eventType: 'crew_war_ended',
    significance: 8,
    headlineTemplate: 'The {war_name} War Ends After {duration}',
    monumentType: 'memorial',
    monumentTitle: 'Peace Memorial'
  },
  /** Player escapes from impossible odds */
  LEGENDARY_ESCAPE: {
    eventType: 'legendary_escape',
    significance: 7,
    headlineTemplate: '{player} Escapes Against All Odds',
    monumentType: 'plaque',
    monumentTitle: 'Great Escape Memorial'
  },
  /** Major betrayal within a crew */
  BETRAYAL: {
    eventType: 'betrayal',
    significance: 8,
    headlineTemplate: 'Infamous Betrayal Rocks {crew}',
    monumentType: 'memorial',
    monumentTitle: 'Day of Betrayal Marker'
  },
  /** New crew is established */
  CREW_FOUNDED: {
    eventType: 'crew_founded',
    significance: 6,
    headlineTemplate: '{crew} Rises - New Power in the Streets',
    monumentType: 'plaque',
    monumentTitle: 'Crew Founding Stone'
  },
  /** Player owns 5+ businesses */
  BUSINESS_EMPIRE: {
    eventType: 'business_empire',
    significance: 7,
    headlineTemplate: '{player} Builds Business Empire',
    monumentType: 'plaque',
    monumentTitle: 'Business Empire Marker'
  },
  /** Major police operation in district */
  POLICE_CRACKDOWN: {
    eventType: 'police_crackdown',
    significance: 7,
    headlineTemplate: 'Massive Police Crackdown Sweeps {district}',
    monumentType: 'plaque',
    monumentTitle: 'Law Enforcement Memorial'
  },
  /** Crew takes control of a district */
  DISTRICT_TAKEOVER: {
    eventType: 'district_takeover',
    significance: 8,
    headlineTemplate: '{crew} Takes Control of {district}',
    monumentType: 'statue',
    monumentTitle: 'Territory Control Monument'
  },
  /** Epic PvP battle */
  LEGENDARY_FIGHT: {
    eventType: 'legendary_fight',
    significance: 7,
    headlineTemplate: 'Legendary Battle: {player1} vs {player2}',
    monumentType: 'memorial',
    monumentTitle: 'Battle Memorial'
  },
  /** Player becomes kingpin */
  KINGPIN_RISE: {
    eventType: 'kingpin_rise',
    significance: 9,
    headlineTemplate: '{player} Crowned Kingpin of {district}',
    monumentType: 'statue',
    monumentTitle: 'Kingpin Monument'
  }
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert database row to WorldEvent interface
 */
export function rowToWorldEvent(row: WorldEventRow): WorldEvent {
  return {
    id: row.id,
    eventType: row.event_type as WorldEventType,
    significance: row.significance,
    headline: row.headline,
    description: row.description,
    primaryPlayerId: row.primary_player_id,
    secondaryPlayerIds: row.secondary_player_ids || [],
    crewId: row.crew_id,
    districtId: row.district_id,
    metadata: row.metadata || {},
    isLandmark: row.is_landmark,
    createdAt: row.created_at,
    primaryPlayerName: row.primary_player_name,
    districtName: row.district_name,
    crewName: row.crew_name
  };
}

/**
 * Convert database row to WorldMonument interface
 */
export function rowToWorldMonument(row: WorldMonumentRow): WorldMonument {
  return {
    id: row.id,
    worldEventId: row.world_event_id,
    districtId: row.district_id,
    monumentType: row.monument_type as MonumentType,
    title: row.title,
    inscription: row.inscription,
    createdAt: row.created_at
  };
}

/**
 * Convert database row to NpcMemory interface
 */
export function rowToNpcMemory(row: NpcMemoryRow): NpcMemory {
  return {
    id: row.id,
    npcId: row.npc_id,
    worldEventId: row.world_event_id,
    memoryType: row.memory_type as MemoryType,
    sentiment: row.sentiment as MemorySentiment,
    dialogueSnippets: row.dialogue_snippets || [],
    expiresAt: row.expires_at,
    createdAt: row.created_at
  };
}

/**
 * Generate headline from template and data
 */
export function generateHeadline(
  template: string,
  data: Record<string, string | number>
): string {
  let headline = template;
  for (const [key, value] of Object.entries(data)) {
    headline = headline.replace(`{${key}}`, String(value));
  }
  return headline;
}

/**
 * Check if an event should be a landmark based on significance
 */
export function isLandmarkEvent(significance: number): boolean {
  return significance >= 8;
}

/**
 * Get default monument type for an event type
 */
export function getDefaultMonumentType(eventType: WorldEventType): MonumentType {
  const trigger = Object.values(LANDMARK_TRIGGERS).find(t => t.eventType === eventType);
  return trigger?.monumentType || 'plaque';
}

/**
 * Get default monument title for an event type
 */
export function getDefaultMonumentTitle(eventType: WorldEventType): string {
  const trigger = Object.values(LANDMARK_TRIGGERS).find(t => t.eventType === eventType);
  return trigger?.monumentTitle || 'Historic Event Marker';
}

// =============================================================================
// DIALOGUE GENERATION HELPERS
// =============================================================================

/**
 * Templates for generating NPC dialogue based on sentiment
 */
export const DIALOGUE_TEMPLATES: Record<MemorySentiment, string[]> = {
  positive: [
    "Did you hear about {headline}? Amazing times we live in.",
    "I remember when {headline}. Changed everything around here.",
    "{headline}... those were the days."
  ],
  negative: [
    "Things haven't been the same since {headline}.",
    "I try not to think about {headline}. Dark times.",
    "{headline}... I lost good friends that day."
  ],
  neutral: [
    "You heard about {headline}? Interesting times.",
    "Everyone's been talking about {headline}.",
    "So, {headline}. That happened."
  ],
  fearful: [
    "Keep your voice down... {headline}. I don't want that kind of attention.",
    "After {headline}, I learned to keep my head down.",
    "{headline}... sends chills down my spine just thinking about it."
  ],
  respectful: [
    "You have to respect what happened with {headline}.",
    "{headline}... now that took real skill.",
    "Whoever pulled off {headline} earned their reputation."
  ]
};

export default {
  LANDMARK_TRIGGERS,
  DIALOGUE_TEMPLATES,
  rowToWorldEvent,
  rowToWorldMonument,
  rowToNpcMemory,
  generateHeadline,
  isLandmarkEvent,
  getDefaultMonumentType,
  getDefaultMonumentTitle
};
