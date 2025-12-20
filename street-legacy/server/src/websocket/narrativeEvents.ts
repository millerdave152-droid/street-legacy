/**
 * Narrative System WebSocket Events
 *
 * Real-time notifications for narrative systems:
 * - Witness opportunities
 * - Breaking news
 * - Debt notifications
 * - Life chapter transitions
 * - District status changes
 * - Testimonials and succession
 */

import {
  sendToUser,
  sendToUsers,
  broadcast,
  sendToDistrict,
  getDistrictOnlinePlayers
} from './index.js';

// ============================================================================
// Narrative Event Types
// ============================================================================

export type NarrativeEventType =
  | 'narrative:witness_opportunity'
  | 'narrative:news_breaking'
  | 'narrative:debt_called_in'
  | 'narrative:debt_transferred'
  | 'narrative:chapter_transition'
  | 'narrative:district_status_change'
  | 'narrative:testimonial_received'
  | 'narrative:succession_triggered'
  | 'narrative:reputation_shift'
  | 'narrative:legacy_milestone';

// ============================================================================
// Event Interfaces
// ============================================================================

export interface BaseNarrativeEvent {
  type: NarrativeEventType;
  timestamp: number;
}

export interface WitnessOpportunityEvent extends BaseNarrativeEvent {
  type: 'narrative:witness_opportunity';
  eventId: string;
  districtId: string;
  description: string;
  expiresAt: string;
  severity: number;
  eventType: string;
}

export interface NewsBreakingEvent extends BaseNarrativeEvent {
  type: 'narrative:news_breaking';
  newsId: string;
  headline: string;
  significance: number;
  districtId?: string;
  category: string;
}

export interface DebtCalledInEvent extends BaseNarrativeEvent {
  type: 'narrative:debt_called_in';
  debtId: string;
  creditorId: string;
  creditorName: string;
  value: number;
  debtType: string;
  description?: string;
  dueDate?: string;
}

export interface DebtTransferredEvent extends BaseNarrativeEvent {
  type: 'narrative:debt_transferred';
  debtId: string;
  previousCreditorName: string;
  newCreditorId: string;
  newCreditorName: string;
  value: number;
  debtType: string;
}

export interface ChapterTransitionEvent extends BaseNarrativeEvent {
  type: 'narrative:chapter_transition';
  newChapter: string;
  previousChapter?: string;
  unlockedFeatures: string[];
  lockedFeatures: string[];
  milestone?: string;
}

export interface DistrictStatusChangeEvent extends BaseNarrativeEvent {
  type: 'narrative:district_status_change';
  districtId: string;
  districtName: string;
  oldStatus: string;
  newStatus: string;
  cause?: string;
}

export interface TestimonialReceivedEvent extends BaseNarrativeEvent {
  type: 'narrative:testimonial_received';
  fromPlayerId: string;
  fromPlayerName: string;
  eventType: string;
  testimonialText: string;
  isPositive: boolean;
}

export interface SuccessionTriggeredEvent extends BaseNarrativeEvent {
  type: 'narrative:succession_triggered';
  endingType: string;
  endingReason: string;
  inheritancePreview: {
    cashPercent: number;
    propertyPercent: number;
    reputationPercent: number;
    heirType?: string;
  };
  timeRemaining?: number;
}

export interface ReputationShiftEvent extends BaseNarrativeEvent {
  type: 'narrative:reputation_shift';
  contextType: string;
  contextId: string;
  contextName: string;
  changes: {
    respect?: number;
    fear?: number;
    trust?: number;
    heat?: number;
  };
  reason: string;
}

export interface LegacyMilestoneEvent extends BaseNarrativeEvent {
  type: 'narrative:legacy_milestone';
  milestoneType: string;
  title: string;
  description: string;
  reward?: {
    cash?: number;
    reputation?: number;
    item?: string;
  };
}

// Union type for all narrative events
export type NarrativeEvent =
  | WitnessOpportunityEvent
  | NewsBreakingEvent
  | DebtCalledInEvent
  | DebtTransferredEvent
  | ChapterTransitionEvent
  | DistrictStatusChangeEvent
  | TestimonialReceivedEvent
  | SuccessionTriggeredEvent
  | ReputationShiftEvent
  | LegacyMilestoneEvent;

// ============================================================================
// Helper Functions
// ============================================================================

function createNarrativeEvent<T extends BaseNarrativeEvent>(
  type: T['type'],
  data: Omit<T, 'type' | 'timestamp'>
): T {
  return {
    type,
    timestamp: Date.now(),
    ...data,
  } as T;
}

// ============================================================================
// Event Emission Functions
// ============================================================================

/**
 * Emit witness opportunity to potential witnesses in a district
 */
export function emitWitnessOpportunity(
  potentialWitnessIds: number[],
  params: {
    eventId: string;
    districtId: string;
    description: string;
    expiresAt: string;
    severity: number;
    eventType: string;
  }
): number {
  const event = createNarrativeEvent<WitnessOpportunityEvent>('narrative:witness_opportunity', params);
  return sendToUsers(potentialWitnessIds, event);
}

/**
 * Emit witness opportunity to all players in a district
 */
export function emitWitnessOpportunityToDistrict(
  districtId: string,
  params: {
    eventId: string;
    description: string;
    expiresAt: string;
    severity: number;
    eventType: string;
  }
): number {
  const event = createNarrativeEvent<WitnessOpportunityEvent>('narrative:witness_opportunity', {
    ...params,
    districtId,
  });
  // Convert string district ID to numeric for the channel
  const numericDistrictId = parseInt(districtId.replace(/\D/g, '')) || 1;
  return sendToDistrict(numericDistrictId, event);
}

/**
 * Emit breaking news to all players (for high significance) or district players
 */
export function emitBreakingNews(params: {
  newsId: string;
  headline: string;
  significance: number;
  districtId?: string;
  category: string;
}): void {
  const event = createNarrativeEvent<NewsBreakingEvent>('narrative:news_breaking', params);

  // High significance news (8+) goes to everyone
  if (params.significance >= 8) {
    broadcast(event);
  } else if (params.districtId) {
    // Lower significance news stays in district
    const numericDistrictId = parseInt(params.districtId.replace(/\D/g, '')) || 1;
    sendToDistrict(numericDistrictId, event);
  }
}

/**
 * Emit debt called in notification to debtor
 */
export function emitDebtCalledIn(
  debtorId: number,
  params: {
    debtId: string;
    creditorId: string;
    creditorName: string;
    value: number;
    debtType: string;
    description?: string;
    dueDate?: string;
  }
): boolean {
  const event = createNarrativeEvent<DebtCalledInEvent>('narrative:debt_called_in', params);
  return sendToUser(debtorId, event);
}

/**
 * Emit debt transferred notification to debtor
 */
export function emitDebtTransferred(
  debtorId: number,
  params: {
    debtId: string;
    previousCreditorName: string;
    newCreditorId: string;
    newCreditorName: string;
    value: number;
    debtType: string;
  }
): boolean {
  const event = createNarrativeEvent<DebtTransferredEvent>('narrative:debt_transferred', params);
  return sendToUser(debtorId, event);
}

/**
 * Emit chapter transition notification to player
 */
export function emitChapterTransition(
  playerId: number,
  params: {
    newChapter: string;
    previousChapter?: string;
    unlockedFeatures: string[];
    lockedFeatures: string[];
    milestone?: string;
  }
): boolean {
  const event = createNarrativeEvent<ChapterTransitionEvent>('narrative:chapter_transition', params);
  return sendToUser(playerId, event);
}

/**
 * Emit district status change to all players in district
 */
export function emitDistrictStatusChange(
  districtId: string,
  params: {
    districtName: string;
    oldStatus: string;
    newStatus: string;
    cause?: string;
  }
): number {
  const event = createNarrativeEvent<DistrictStatusChangeEvent>('narrative:district_status_change', {
    ...params,
    districtId,
  });
  const numericDistrictId = parseInt(districtId.replace(/\D/g, '')) || 1;
  return sendToDistrict(numericDistrictId, event);
}

/**
 * Emit testimonial received notification to player
 */
export function emitTestimonialReceived(
  playerId: number,
  params: {
    fromPlayerId: string;
    fromPlayerName: string;
    eventType: string;
    testimonialText: string;
    isPositive: boolean;
  }
): boolean {
  const event = createNarrativeEvent<TestimonialReceivedEvent>('narrative:testimonial_received', params);
  return sendToUser(playerId, event);
}

/**
 * Emit succession triggered notification to player
 */
export function emitSuccessionTriggered(
  playerId: number,
  params: {
    endingType: string;
    endingReason: string;
    inheritancePreview: {
      cashPercent: number;
      propertyPercent: number;
      reputationPercent: number;
      heirType?: string;
    };
    timeRemaining?: number;
  }
): boolean {
  const event = createNarrativeEvent<SuccessionTriggeredEvent>('narrative:succession_triggered', params);
  return sendToUser(playerId, event);
}

/**
 * Emit reputation shift notification to player
 */
export function emitReputationShift(
  playerId: number,
  params: {
    contextType: string;
    contextId: string;
    contextName: string;
    changes: {
      respect?: number;
      fear?: number;
      trust?: number;
      heat?: number;
    };
    reason: string;
  }
): boolean {
  const event = createNarrativeEvent<ReputationShiftEvent>('narrative:reputation_shift', params);
  return sendToUser(playerId, event);
}

/**
 * Emit legacy milestone notification to player
 */
export function emitLegacyMilestone(
  playerId: number,
  params: {
    milestoneType: string;
    title: string;
    description: string;
    reward?: {
      cash?: number;
      reputation?: number;
      item?: string;
    };
  }
): boolean {
  const event = createNarrativeEvent<LegacyMilestoneEvent>('narrative:legacy_milestone', params);
  return sendToUser(playerId, event);
}

// ============================================================================
// Batch Emission Functions
// ============================================================================

/**
 * Emit to all potential witnesses of an event
 */
export async function notifyPotentialWitnesses(
  districtId: string,
  eventId: string,
  description: string,
  severity: number,
  eventType: string,
  expiresAt: Date,
  excludePlayerId?: number
): Promise<number> {
  const numericDistrictId = parseInt(districtId.replace(/\D/g, '')) || 1;
  const onlinePlayers = getDistrictOnlinePlayers(numericDistrictId);

  // Filter out the actor if provided
  const witnesses = excludePlayerId
    ? onlinePlayers.filter(id => id !== excludePlayerId)
    : onlinePlayers;

  if (witnesses.length === 0) return 0;

  return emitWitnessOpportunity(witnesses, {
    eventId,
    districtId,
    description,
    expiresAt: expiresAt.toISOString(),
    severity,
    eventType,
  });
}

/**
 * Broadcast significant news to relevant audience
 */
export function broadcastNews(
  newsId: string,
  headline: string,
  significance: number,
  category: string,
  districtId?: string
): void {
  emitBreakingNews({
    newsId,
    headline,
    significance,
    category,
    districtId,
  });
}

// ============================================================================
// Generic Event Emission Function
// ============================================================================

/**
 * Generic narrative event emitter used by narrativeIntegration.service.ts
 * Maps simplified event types to the full WebSocket event system
 */
export function emitNarrativeEvent(
  eventType: string,
  data: Record<string, any>
): void {
  switch (eventType) {
    case 'witness_opportunity':
      if (data.playerId) {
        sendToUser(parseInt(data.playerId), {
          type: 'narrative:witness_opportunity',
          timestamp: Date.now(),
          eventId: data.eventId,
          districtId: data.districtId,
          description: data.description,
          expiresAt: data.expiresAt,
          severity: data.severity || 5,
          eventType: data.eventType || 'unknown'
        });
      }
      break;

    case 'news_breaking':
      emitBreakingNews({
        newsId: data.newsId || `news_${Date.now()}`,
        headline: data.headline,
        significance: data.significance || 8,
        districtId: data.districtId,
        category: data.category || 'general'
      });
      break;

    case 'debt_called_in':
      if (data.debtorId) {
        emitDebtCalledIn(parseInt(data.debtorId), {
          debtId: data.debtId || `debt_${Date.now()}`,
          creditorId: data.creditorId,
          creditorName: data.creditorName,
          value: data.amount || data.value,
          debtType: data.debtType,
          description: data.description,
          dueDate: data.dueDate
        });
      }
      break;

    case 'debt_transferred':
      if (data.debtorId) {
        emitDebtTransferred(parseInt(data.debtorId), {
          debtId: data.debtId || `debt_${Date.now()}`,
          previousCreditorName: data.originalCreditorName || 'Unknown',
          newCreditorId: data.newCreditorId,
          newCreditorName: data.newCreditorName,
          value: data.amount || data.value,
          debtType: data.debtType
        });
      }
      break;

    case 'chapter_transition':
      if (data.playerId) {
        emitChapterTransition(parseInt(data.playerId), {
          newChapter: data.toChapter || data.newChapter,
          previousChapter: data.fromChapter || data.previousChapter,
          unlockedFeatures: data.unlockedFeatures || [],
          lockedFeatures: data.lockedFeatures || [],
          milestone: data.milestone
        });
      }
      break;

    case 'district_status_change':
      if (data.districtId) {
        emitDistrictStatusChange(data.districtId, {
          districtName: data.districtName || 'Unknown District',
          oldStatus: data.oldStatus || data.previousController || 'none',
          newStatus: data.newStatus || data.newController || data.change,
          cause: data.cause
        });
      }
      break;

    case 'testimonial_received':
      if (data.playerId) {
        emitTestimonialReceived(parseInt(data.playerId), {
          fromPlayerId: data.fromPlayerId,
          fromPlayerName: data.fromPlayerName,
          eventType: data.eventType,
          testimonialText: data.testimonialText,
          isPositive: data.isPositive ?? true
        });
      }
      break;

    case 'succession_triggered':
      if (data.playerId) {
        emitSuccessionTriggered(parseInt(data.playerId), {
          endingType: data.endingType,
          endingReason: data.endingReason || data.endingType,
          inheritancePreview: data.inheritancePreview || {
            cashPercent: 50,
            propertyPercent: 50,
            reputationPercent: 25,
            heirType: data.heirType
          },
          timeRemaining: data.timeRemaining
        });
        // Also broadcast to inform other players
        broadcast({
          type: 'narrative:succession_triggered',
          timestamp: Date.now(),
          playerId: data.playerId,
          playerName: data.playerName,
          heirId: data.heirId,
          heirName: data.heirName,
          endingType: data.endingType,
          generation: data.generation,
          legacyScore: data.legacyScore
        });
      }
      break;

    case 'reputation_shift':
      if (data.playerId) {
        emitReputationShift(parseInt(data.playerId), {
          contextType: data.contextType || 'district',
          contextId: data.districtId || data.contextId,
          contextName: data.contextName || 'Unknown',
          changes: {
            respect: data.change || data.respect,
            fear: data.fear,
            trust: data.trust,
            heat: data.heat
          },
          reason: data.reason || 'Unknown'
        });
      }
      break;

    case 'legacy_milestone':
      if (data.playerId) {
        emitLegacyMilestone(parseInt(data.playerId), {
          milestoneType: data.milestone || data.milestoneType,
          title: data.title || `${data.milestone} Achieved`,
          description: data.description || `Legacy score: ${data.legacyScore}`,
          reward: data.reward
        });
        // Broadcast significant milestones
        if (data.legacyScore >= 1000) {
          broadcast({
            type: 'narrative:legacy_milestone',
            timestamp: Date.now(),
            playerId: data.playerId,
            playerName: data.playerName,
            milestone: data.milestone,
            legacyScore: data.legacyScore,
            generation: data.generation
          });
        }
      }
      break;

    default:
      console.warn(`Unknown narrative event type: ${eventType}`);
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Generic emission
  emitNarrativeEvent,
  // Event emission
  emitWitnessOpportunity,
  emitWitnessOpportunityToDistrict,
  emitBreakingNews,
  emitDebtCalledIn,
  emitDebtTransferred,
  emitChapterTransition,
  emitDistrictStatusChange,
  emitTestimonialReceived,
  emitSuccessionTriggered,
  emitReputationShift,
  emitLegacyMilestone,
  // Batch functions
  notifyPotentialWitnesses,
  broadcastNews,
};
