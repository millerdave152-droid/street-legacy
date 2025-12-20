/**
 * Witness Mechanic System Types
 * Social proof system where players witness and verify events
 * Verified witnesses create testimonials that boost reputation
 */

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Status of a witness record
 * - potential: Player was in district, could verify
 * - verified: Player confirmed they witnessed the event
 * - disputed: Player disputes the event occurred
 * - expired: Verification window passed without action
 */
export type WitnessStatus = 'potential' | 'verified' | 'disputed' | 'expired';

/**
 * Types of events that can be witnessed by other players
 */
export type WitnessableEventType =
  | 'crime_committed'    // Successfully committed a crime
  | 'heist'              // Participated in or completed a heist
  | 'pvp_victory'        // Won a PvP battle
  | 'property_purchase'  // Bought a property
  | 'crew_battle'        // Participated in crew warfare
  | 'business_opened'    // Started a new business
  | 'landmark_event'     // World memory landmark event
  | 'territory_capture'  // Captured territory/POI
  | 'major_deal'         // Large transaction or deal
  | 'faction_mission';   // Completed faction mission

// =============================================================================
// WITNESSED EVENT
// =============================================================================

/**
 * An event that can be witnessed and verified by other players
 */
export interface WitnessedEvent {
  /** Unique identifier */
  id: number;

  /** Type of event that occurred */
  eventType: WitnessableEventType;

  /** Player who performed the action */
  actorPlayerId: number;

  /** Actor's username (from join) */
  actorPlayerName?: string;

  /** Target player for PvP events */
  targetPlayerId?: number;

  /** Target's username (from join) */
  targetPlayerName?: string;

  /** District where event occurred */
  districtId: string;

  /** Human-readable district name */
  districtName?: string;

  /** Description of what happened */
  eventDescription?: string;

  /** Severity/significance of event (1-10) */
  eventSeverity: number;

  /** Additional metadata about the event */
  metadata: Record<string, unknown>;

  /** When verification window closes */
  verificationWindowEnds: Date;

  /** When the event actually occurred */
  occurredAt: Date;

  /** When the record was created */
  createdAt: Date;

  /** Total number of potential witnesses (aggregated) */
  witnessCount?: number;

  /** Number of verified witnesses (aggregated) */
  verifiedCount?: number;

  /** Number of disputed witnesses (aggregated) */
  disputedCount?: number;
}

// =============================================================================
// EVENT WITNESS
// =============================================================================

/**
 * A witness record for a specific event
 */
export interface EventWitness {
  /** Unique identifier */
  id: number;

  /** The event being witnessed */
  witnessedEventId: number;

  /** Player who can witness/verify */
  witnessPlayerId: number;

  /** Witness's username (from join) */
  witnessPlayerName?: string;

  /** Current status of this witness */
  witnessStatus: WitnessStatus;

  /** When witness verified/disputed */
  verifiedAt?: Date;

  /** Optional testimony from witness */
  testimony?: string;

  /** Whether reputation bonus was awarded */
  reputationBonusGiven: boolean;

  /** When record was created */
  createdAt: Date;
}

// =============================================================================
// PLAYER TESTIMONIAL
// =============================================================================

/**
 * A verified testimonial displayed on a player's profile
 */
export interface PlayerTestimonial {
  /** Unique identifier */
  id: number;

  /** Player who received the testimonial (the actor) */
  playerId: number;

  /** Actor's username (from join) */
  playerName?: string;

  /** Player who gave the testimonial (the witness) */
  witnessPlayerId: number;

  /** Witness's username (from join) */
  witnessPlayerName?: string;

  /** Original event this testimonial is from */
  witnessedEventId?: number;

  /** The testimonial text */
  testimonialText: string;

  /** Type of event witnessed */
  eventType?: WitnessableEventType;

  /** Whether featured on profile */
  featured: boolean;

  /** When testimonial was created */
  createdAt: Date;
}

// =============================================================================
// WITNESS STATISTICS
// =============================================================================

/**
 * Witness/testimonial statistics for a player
 */
export interface WitnessStats {
  /** Total events where player was a potential witness */
  eventsWitnessed: number;

  /** Events the player verified */
  eventsVerified: number;

  /** Events the player disputed */
  eventsDisputed: number;

  /** Testimonials given to other players */
  testimonialsGiven: number;

  /** Testimonials received from other players */
  testimonialsReceived: number;

  /** Testimonials featured on profile */
  featuredTestimonials: number;
}

// =============================================================================
// DATABASE ROW TYPES (snake_case)
// =============================================================================

/**
 * Database row for witnessed_events table
 */
export interface WitnessedEventRow {
  id: number;
  event_type: string;
  actor_player_id: number;
  actor_player_name?: string;
  target_player_id: number | null;
  target_player_name?: string;
  district_id: string;
  district_name?: string;
  event_description: string | null;
  event_severity: number;
  metadata: Record<string, unknown>;
  verification_window_ends: string;
  occurred_at: string;
  created_at: string;
  witness_count?: string | number;
  verified_count?: string | number;
  disputed_count?: string | number;
}

/**
 * Database row for event_witnesses table
 */
export interface EventWitnessRow {
  id: number;
  witnessed_event_id: number;
  witness_player_id: number;
  witness_player_name?: string;
  witness_username?: string;
  witness_status: WitnessStatus;
  verified_at: string | null;
  testimony: string | null;
  reputation_bonus_given: boolean;
  created_at: string;
}

/**
 * Database row for player_testimonials table
 */
export interface PlayerTestimonialRow {
  id: number;
  player_id: number;
  player_name?: string;
  witness_player_id: number;
  witness_player_name?: string;
  witness_username?: string;
  witnessed_event_id: number | null;
  testimonial_text: string;
  event_type: string | null;
  featured: boolean;
  created_at: string;
}

/**
 * Database row for witness statistics
 */
export interface WitnessStatsRow {
  events_witnessed: number | string;
  events_verified: number | string;
  events_disputed: number | string;
  testimonials_given: number | string;
  testimonials_received: number | string;
  featured_testimonials: number | string;
}

// =============================================================================
// API REQUEST TYPES
// =============================================================================

/**
 * Request to create a witnessed event
 */
export interface CreateWitnessedEventRequest {
  /** Type of event */
  eventType: WitnessableEventType;

  /** Player who performed the action */
  actorPlayerId: number;

  /** District where event occurred */
  districtId: string;

  /** Description of the event */
  description?: string;

  /** Event severity 1-10 */
  severity?: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Target player for PvP events */
  targetPlayerId?: number;
}

/**
 * Request to verify a witnessed event
 */
export interface VerifyWitnessRequest {
  /** Optional testimony from the witness */
  testimony?: string;
}

/**
 * Request to dispute a witnessed event
 */
export interface DisputeWitnessRequest {
  /** Reason for disputing */
  reason?: string;
}

/**
 * Request to toggle testimonial featured status
 */
export interface ToggleFeaturedRequest {
  /** Testimonial ID to toggle */
  testimonialId: number;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Response for getting witnessable events
 */
export interface GetWitnessableEventsResponse {
  success: boolean;
  data: {
    events: WitnessedEvent[];
    total: number;
  };
}

/**
 * Response for getting a single witnessed event
 */
export interface GetWitnessedEventResponse {
  success: boolean;
  data: WitnessedEvent & {
    witnesses: EventWitness[];
  };
}

/**
 * Response for getting pending verifications
 */
export interface GetPendingVerificationsResponse {
  success: boolean;
  data: {
    events: WitnessedEvent[];
    total: number;
  };
}

/**
 * Response for verifying a witness
 */
export interface VerifyWitnessResponse {
  success: boolean;
  data: {
    verified: boolean;
    message: string;
    testimonialId?: number;
    reputationBonus?: number;
  };
}

/**
 * Response for disputing a witness
 */
export interface DisputeWitnessResponse {
  success: boolean;
  data: {
    disputed: boolean;
    message: string;
  };
}

/**
 * Response for getting player testimonials
 */
export interface GetPlayerTestimonialsResponse {
  success: boolean;
  data: {
    testimonials: PlayerTestimonial[];
    total: number;
    featuredCount: number;
  };
}

/**
 * Response for getting witness statistics
 */
export interface GetWitnessStatsResponse {
  success: boolean;
  data: WitnessStats;
}

/**
 * Response for toggling featured status
 */
export interface ToggleFeaturedResponse {
  success: boolean;
  data: {
    testimonialId: number;
    featured: boolean;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * How long the verification window stays open (in hours)
 */
export const VERIFICATION_WINDOW_HOURS = 24;

/**
 * Reputation bonus for the first witness to verify an event
 * Multiplied by event severity
 */
export const REPUTATION_BONUS_FIRST_WITNESS = {
  respect: 2,  // First verifier gives 2x respect bonus
  fear: 1      // Fear bonus for intimidating events
};

/**
 * Reputation bonus for subsequent witnesses
 * Multiplied by event severity
 */
export const REPUTATION_BONUS_SUBSEQUENT_WITNESS = {
  respect: 1,
  fear: 0
};

/**
 * Minimum event severity required to create a testimonial
 * Lower severity events don't generate profile testimonials
 */
export const MIN_SEVERITY_FOR_TESTIMONIAL = 5;

/**
 * Maximum number of potential witnesses per event
 * Prevents spam from events in crowded districts
 */
export const MAX_WITNESSES_PER_EVENT = 20;

/**
 * How recent a player must be active to be a potential witness (in minutes)
 */
export const WITNESS_ACTIVITY_WINDOW_MINUTES = 30;

/**
 * Maximum featured testimonials a player can display
 */
export const MAX_FEATURED_TESTIMONIALS = 5;

/**
 * Severity thresholds for different event types
 */
export const EVENT_TYPE_SEVERITY: Record<WitnessableEventType, number> = {
  crime_committed: 3,
  heist: 7,
  pvp_victory: 5,
  property_purchase: 4,
  crew_battle: 8,
  business_opened: 4,
  landmark_event: 9,
  territory_capture: 6,
  major_deal: 5,
  faction_mission: 5
};

/**
 * Human-readable labels for event types
 */
export const EVENT_TYPE_LABELS: Record<WitnessableEventType, string> = {
  crime_committed: 'Crime',
  heist: 'Heist',
  pvp_victory: 'PvP Victory',
  property_purchase: 'Property Purchase',
  crew_battle: 'Crew Battle',
  business_opened: 'Business Opening',
  landmark_event: 'Landmark Event',
  territory_capture: 'Territory Capture',
  major_deal: 'Major Deal',
  faction_mission: 'Faction Mission'
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert database row to WitnessedEvent interface
 */
export function rowToWitnessedEvent(row: WitnessedEventRow): WitnessedEvent {
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
 * Convert database row to EventWitness interface
 */
export function rowToEventWitness(row: EventWitnessRow): EventWitness {
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
 * Convert database row to PlayerTestimonial interface
 */
export function rowToPlayerTestimonial(row: PlayerTestimonialRow): PlayerTestimonial {
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
 * Convert database row to WitnessStats interface
 */
export function rowToWitnessStats(row: WitnessStatsRow): WitnessStats {
  return {
    eventsWitnessed: parseInt(String(row.events_witnessed), 10),
    eventsVerified: parseInt(String(row.events_verified), 10),
    eventsDisputed: parseInt(String(row.events_disputed), 10),
    testimonialsGiven: parseInt(String(row.testimonials_given), 10),
    testimonialsReceived: parseInt(String(row.testimonials_received), 10),
    featuredTestimonials: parseInt(String(row.featured_testimonials), 10)
  };
}

/**
 * Check if an event's verification window is still open
 */
export function isVerificationWindowOpen(event: WitnessedEvent): boolean {
  return new Date() < event.verificationWindowEnds;
}

/**
 * Calculate remaining time in verification window (in hours)
 */
export function getVerificationTimeRemaining(event: WitnessedEvent): number {
  const remaining = event.verificationWindowEnds.getTime() - Date.now();
  return Math.max(0, remaining / (1000 * 60 * 60));
}

/**
 * Generate a default testimony based on event type
 */
export function generateDefaultTestimony(
  eventType: WitnessableEventType,
  districtId: string
): string {
  const label = EVENT_TYPE_LABELS[eventType] || 'event';
  return `I witnessed this ${label.toLowerCase()} in ${districtId}.`;
}
