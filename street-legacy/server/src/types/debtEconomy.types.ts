/**
 * Debt Economy System Types
 * Favors as binding social contracts between players
 */

// =============================================================================
// ENUMS / UNION TYPES
// =============================================================================

/**
 * Status of a debt
 * - outstanding: Debt exists, not yet called in
 * - called_in: Creditor has demanded fulfillment
 * - fulfilled: Debt has been paid/honored
 * - defaulted: Debtor failed to fulfill
 * - transferred: Debt ownership changed hands
 * - forgiven: Creditor waived the debt
 */
export type DebtStatus =
  | 'outstanding'
  | 'called_in'
  | 'fulfilled'
  | 'defaulted'
  | 'transferred'
  | 'forgiven';

/**
 * Types of debts that can exist between players
 * - favor: General favor owed
 * - money: Financial debt
 * - protection: Owes protection/backup
 * - service: Owes specific service
 * - information: Owes intel/secrets
 * - blood_debt: Life debt - most serious
 */
export type DebtType =
  | 'favor'
  | 'money'
  | 'protection'
  | 'service'
  | 'information'
  | 'blood_debt';

/**
 * Types of asking prices when selling debts
 */
export type AskingPriceType =
  | 'cash'
  | 'favor'
  | 'other_debt'
  | 'service';

/**
 * Offer status for debt marketplace
 */
export type DebtOfferStatus =
  | 'open'
  | 'accepted'
  | 'withdrawn'
  | 'expired';

// =============================================================================
// CORE INTERFACES
// =============================================================================

/**
 * A debt/favor owed between two players
 */
export interface PlayerDebt {
  /** Unique identifier */
  id: string;

  /** Player who is owed the debt */
  creditorId: number;

  /** Creditor's username (from join) */
  creditorName?: string;

  /** Player who owes the debt */
  debtorId: number;

  /** Debtor's username (from join) */
  debtorName?: string;

  /** Type of debt */
  debtType: DebtType;

  /** Description of what is owed */
  description: string;

  /** Current value/severity (1-10) */
  value: number;

  /** Original value if debt was reduced */
  originalValue?: number;

  /** Current status */
  status: DebtStatus;

  /** How the debt was incurred */
  context?: string;

  /** When debt was created */
  createdAt: Date;

  /** When creditor demanded fulfillment */
  calledInAt?: Date;

  /** When debt was resolved (fulfilled/defaulted/forgiven) */
  resolvedAt?: Date;

  /** Optional deadline for fulfillment */
  dueDate?: Date;

  /** Previous creditor if transferred */
  transferredFromId?: number;

  /** Previous creditor's name */
  transferredFromName?: string;

  /** Whether debt is overdue (calculated) */
  isOverdue?: boolean;

  /** Days until due / days overdue (calculated) */
  daysUntilDue?: number;
}

/**
 * Record of a debt being transferred between creditors
 */
export interface DebtTransfer {
  /** Unique identifier */
  id: string;

  /** The debt that was transferred */
  debtId: string;

  /** Previous creditor */
  fromCreditorId: number;

  /** Previous creditor's name */
  fromCreditorName?: string;

  /** New creditor */
  toCreditorId: number;

  /** New creditor's name */
  toCreditorName?: string;

  /** Reason for transfer */
  transferReason?: string;

  /** Debt value at time of transfer */
  valueAtTransfer?: number;

  /** When transfer occurred */
  transferredAt: Date;
}

/**
 * Record of a debt default
 */
export interface DebtDefault {
  /** Unique identifier */
  id: string;

  /** The debt that was defaulted */
  debtId: string;

  /** Player who defaulted */
  debtorId: number;

  /** Debtor's name */
  debtorName?: string;

  /** Player who was owed */
  creditorId: number;

  /** Creditor's name */
  creditorName?: string;

  /** Reason given for default */
  defaultReason?: string;

  /** Whether reputation penalty was applied */
  reputationPenaltyApplied: boolean;

  /** Trust damage amount */
  penaltyAmount?: number;

  /** When default occurred */
  defaultedAt: Date;
}

/**
 * An offer to sell/trade a debt
 */
export interface DebtOffer {
  /** Unique identifier */
  id: string;

  /** The debt being offered */
  debtId: string;

  /** Player selling the debt */
  offeringPlayerId: number;

  /** Seller's name */
  offeringPlayerName?: string;

  /** What they want in return */
  askingPriceType: AskingPriceType;

  /** Numeric value if applicable (cash amount, etc) */
  askingPriceValue?: number;

  /** Additional details about price */
  askingPriceDetails?: string;

  /** Current offer status */
  status: DebtOfferStatus;

  /** Player who accepted (if accepted) */
  acceptedById?: number;

  /** When offer expires */
  expiresAt?: Date;

  /** When offer was created */
  createdAt: Date;

  /** When offer was resolved */
  resolvedAt?: Date;

  /** Debt details (from join) */
  debtType?: DebtType;
  debtDescription?: string;
  debtValue?: number;
  debtorId?: number;
  debtorName?: string;
}

/**
 * Summary of a player's debt situation
 */
export interface DebtSummary {
  /** Total value of debts others owe you */
  totalOwedToYou: number;

  /** Total value of debts you owe others */
  totalYouOwe: number;

  /** Count of debts owed to you */
  debtsOwedToYouCount: number;

  /** Count of debts you owe */
  debtsYouOweCount: number;

  /** Count of outstanding debts */
  outstandingCount: number;

  /** Count of debts called in (need action) */
  calledInCount: number;

  /** Count of defaults on your record */
  defaultCount: number;

  /** Count of debts you've fulfilled */
  fulfilledCount: number;

  /** Your reliability rating based on history */
  reliabilityRating?: 'excellent' | 'good' | 'fair' | 'poor' | 'terrible';
}

// =============================================================================
// DATABASE ROW TYPES (snake_case)
// =============================================================================

/**
 * Database row for player_debts table
 */
export interface PlayerDebtRow {
  id: string;
  creditor_id: number;
  creditor_name?: string;
  debtor_id: number;
  debtor_name?: string;
  debt_type: DebtType;
  description: string;
  value: number;
  original_value: number | null;
  status: DebtStatus;
  context: string | null;
  created_at: string;
  called_in_at: string | null;
  resolved_at: string | null;
  due_date: string | null;
  transferred_from_id: number | null;
  transferred_from_name?: string;
  is_overdue?: boolean;
  days_until_due?: number;
}

/**
 * Database row for debt_transfers table
 */
export interface DebtTransferRow {
  id: string;
  debt_id: string;
  from_creditor_id: number;
  from_creditor_name?: string;
  to_creditor_id: number;
  to_creditor_name?: string;
  transfer_reason: string | null;
  value_at_transfer: number | null;
  transferred_at: string;
}

/**
 * Database row for debt_defaults table
 */
export interface DebtDefaultRow {
  id: string;
  debt_id: string;
  debtor_id: number;
  debtor_name?: string;
  creditor_id: number;
  creditor_name?: string;
  default_reason: string | null;
  reputation_penalty_applied: boolean;
  penalty_amount: number | null;
  defaulted_at: string;
}

/**
 * Database row for debt_offers table
 */
export interface DebtOfferRow {
  id: string;
  debt_id: string;
  offering_player_id: number;
  offering_player_name?: string;
  asking_price_type: AskingPriceType;
  asking_price_value: number | null;
  asking_price_details: string | null;
  status: DebtOfferStatus;
  accepted_by_id: number | null;
  expires_at: string | null;
  created_at: string;
  resolved_at: string | null;
  debt_type?: DebtType;
  debt_description?: string;
  debt_value?: number;
  debtor_id?: number;
  debtor_name?: string;
}

/**
 * Database row for debt summary query
 */
export interface DebtSummaryRow {
  debts_owed_count: number | string;
  debts_owed_value: number | string;
  debts_held_count: number | string;
  debts_held_value: number | string;
  defaults_count: number | string;
  fulfilled_count: number | string;
}

// =============================================================================
// REQUEST TYPES
// =============================================================================

/**
 * Request to create a new debt
 */
export interface CreateDebtRequest {
  /** Player who will owe the debt */
  debtorId: number;

  /** Type of debt */
  debtType: DebtType;

  /** Description of what is owed */
  description: string;

  /** Value/severity 1-10 */
  value: number;

  /** How the debt was incurred */
  context?: string;

  /** Days until due (converted to due_date) */
  dueDays?: number;
}

/**
 * Request to call in a debt (no body needed, debt_id in params)
 */
export interface CallInDebtRequest {
  // debt_id comes from URL params
}

/**
 * Request to fulfill a debt (no body needed)
 */
export interface FulfillDebtRequest {
  // debt_id comes from URL params
}

/**
 * Request to default on a debt
 */
export interface DefaultDebtRequest {
  /** Reason for defaulting */
  reason?: string;
}

/**
 * Request to forgive a debt
 */
export interface ForgiveDebtRequest {
  /** Reason for forgiving */
  reason?: string;
}

/**
 * Request to transfer a debt to another player
 */
export interface TransferDebtRequest {
  /** New creditor who will receive the debt */
  toCreditorId: number;

  /** Reason for transfer */
  reason?: string;
}

/**
 * Request to create a debt offer
 */
export interface CreateDebtOfferRequest {
  /** What you want in exchange */
  askingPriceType: AskingPriceType;

  /** Numeric value if applicable */
  askingPriceValue?: number;

  /** Additional details */
  askingPriceDetails?: string;

  /** Days until offer expires (default 3) */
  expiresDays?: number;
}

/**
 * Request to accept a debt offer
 */
export interface AcceptDebtOfferRequest {
  // offer_id comes from URL params
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * Response for getting player's debts
 */
export interface GetDebtsResponse {
  success: boolean;
  data: {
    /** Debts where player is creditor */
    owedToYou: PlayerDebt[];

    /** Debts where player is debtor */
    youOwe: PlayerDebt[];

    /** Total debt count */
    total: number;

    /** Summary statistics */
    summary: DebtSummary;
  };
}

/**
 * Response for getting a single debt
 */
export interface GetDebtResponse {
  success: boolean;
  data: PlayerDebt & {
    /** Transfer history for this debt */
    transfers?: DebtTransfer[];
  };
}

/**
 * Response for creating a debt
 */
export interface CreateDebtResponse {
  success: boolean;
  data: {
    debtId: string;
    debt: PlayerDebt;
  };
}

/**
 * Response for debt actions (call in, fulfill, etc)
 */
export interface DebtActionResponse {
  success: boolean;
  data: {
    debtId: string;
    action: 'called_in' | 'fulfilled' | 'defaulted' | 'forgiven' | 'transferred';
    message: string;
    trustChange?: number;
    newStatus: DebtStatus;
  };
}

/**
 * Response for getting debt offers
 */
export interface GetDebtOffersResponse {
  success: boolean;
  data: {
    offers: DebtOffer[];
    total: number;
  };
}

/**
 * Response for creating a debt offer
 */
export interface CreateDebtOfferResponse {
  success: boolean;
  data: {
    offerId: string;
    offer: DebtOffer;
  };
}

/**
 * Response for accepting a debt offer
 */
export interface AcceptDebtOfferResponse {
  success: boolean;
  data: {
    offerId: string;
    debtId: string;
    newCreditorId: number;
    message: string;
  };
}

/**
 * Response for getting debt summary
 */
export interface GetDebtSummaryResponse {
  success: boolean;
  data: DebtSummary;
}

/**
 * Response for getting debt history
 */
export interface GetDebtHistoryResponse {
  success: boolean;
  data: {
    transfers: DebtTransfer[];
    defaults: DebtDefault[];
    totalTransfers: number;
    totalDefaults: number;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Trust penalties for defaulting based on debt value
 */
export const DEBT_DEFAULT_PENALTIES: Record<number, number> = {
  1: -5,    // Minor favor
  2: -8,
  3: -12,
  4: -16,
  5: -20,   // Medium favor
  6: -25,
  7: -30,
  8: -38,
  9: -45,
  10: -50   // Blood debt
};

/**
 * Trust bonuses for fulfilling debts based on value
 */
export const DEBT_FULFILL_BONUSES: Record<number, number> = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: 7,
  7: 8,
  8: 9,
  9: 10,
  10: 12
};

/**
 * Human-readable labels for debt types
 */
export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  favor: 'Favor',
  money: 'Money',
  protection: 'Protection',
  service: 'Service',
  information: 'Information',
  blood_debt: 'Blood Debt'
};

/**
 * Human-readable descriptions for debt types
 */
export const DEBT_TYPE_DESCRIPTIONS: Record<DebtType, string> = {
  favor: 'A general favor to be called in later',
  money: 'A financial debt that must be repaid',
  protection: 'Owes protection, backup, or muscle',
  service: 'Owes a specific service or job',
  information: 'Owes intel, secrets, or connections',
  blood_debt: 'A life debt - the most serious obligation'
};

/**
 * Icons for debt types
 */
export const DEBT_TYPE_ICONS: Record<DebtType, string> = {
  favor: '🤝',
  money: '💰',
  protection: '🛡️',
  service: '⚙️',
  information: '🔍',
  blood_debt: '🩸'
};

/**
 * Colors for debt status
 */
export const DEBT_STATUS_COLORS: Record<DebtStatus, string> = {
  outstanding: '#6b7280',  // Gray
  called_in: '#f59e0b',    // Amber/warning
  fulfilled: '#22c55e',    // Green
  defaulted: '#ef4444',    // Red
  transferred: '#3b82f6',  // Blue
  forgiven: '#8b5cf6'      // Purple
};

/**
 * Human-readable labels for debt status
 */
export const DEBT_STATUS_LABELS: Record<DebtStatus, string> = {
  outstanding: 'Outstanding',
  called_in: 'Called In',
  fulfilled: 'Fulfilled',
  defaulted: 'Defaulted',
  transferred: 'Transferred',
  forgiven: 'Forgiven'
};

/**
 * Default expiration days for debt offers
 */
export const DEFAULT_OFFER_EXPIRY_DAYS = 3;

/**
 * Maximum debt value
 */
export const MAX_DEBT_VALUE = 10;

/**
 * Minimum debt value
 */
export const MIN_DEBT_VALUE = 1;

/**
 * Reliability rating thresholds based on default percentage
 */
export const RELIABILITY_THRESHOLDS = {
  excellent: 0,      // 0% defaults
  good: 0.05,        // < 5% defaults
  fair: 0.15,        // < 15% defaults
  poor: 0.30,        // < 30% defaults
  terrible: 1        // >= 30% defaults
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert database row to PlayerDebt
 */
export function rowToPlayerDebt(row: PlayerDebtRow): PlayerDebt {
  return {
    id: row.id,
    creditorId: row.creditor_id,
    creditorName: row.creditor_name,
    debtorId: row.debtor_id,
    debtorName: row.debtor_name,
    debtType: row.debt_type,
    description: row.description,
    value: row.value,
    originalValue: row.original_value ?? undefined,
    status: row.status,
    context: row.context ?? undefined,
    createdAt: new Date(row.created_at),
    calledInAt: row.called_in_at ? new Date(row.called_in_at) : undefined,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
    dueDate: row.due_date ? new Date(row.due_date) : undefined,
    transferredFromId: row.transferred_from_id ?? undefined,
    transferredFromName: row.transferred_from_name,
    isOverdue: row.is_overdue,
    daysUntilDue: row.days_until_due
  };
}

/**
 * Convert database row to DebtTransfer
 */
export function rowToDebtTransfer(row: DebtTransferRow): DebtTransfer {
  return {
    id: row.id,
    debtId: row.debt_id,
    fromCreditorId: row.from_creditor_id,
    fromCreditorName: row.from_creditor_name,
    toCreditorId: row.to_creditor_id,
    toCreditorName: row.to_creditor_name,
    transferReason: row.transfer_reason ?? undefined,
    valueAtTransfer: row.value_at_transfer ?? undefined,
    transferredAt: new Date(row.transferred_at)
  };
}

/**
 * Convert database row to DebtDefault
 */
export function rowToDebtDefault(row: DebtDefaultRow): DebtDefault {
  return {
    id: row.id,
    debtId: row.debt_id,
    debtorId: row.debtor_id,
    debtorName: row.debtor_name,
    creditorId: row.creditor_id,
    creditorName: row.creditor_name,
    defaultReason: row.default_reason ?? undefined,
    reputationPenaltyApplied: row.reputation_penalty_applied,
    penaltyAmount: row.penalty_amount ?? undefined,
    defaultedAt: new Date(row.defaulted_at)
  };
}

/**
 * Convert database row to DebtOffer
 */
export function rowToDebtOffer(row: DebtOfferRow): DebtOffer {
  return {
    id: row.id,
    debtId: row.debt_id,
    offeringPlayerId: row.offering_player_id,
    offeringPlayerName: row.offering_player_name,
    askingPriceType: row.asking_price_type,
    askingPriceValue: row.asking_price_value ?? undefined,
    askingPriceDetails: row.asking_price_details ?? undefined,
    status: row.status,
    acceptedById: row.accepted_by_id ?? undefined,
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    createdAt: new Date(row.created_at),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
    debtType: row.debt_type,
    debtDescription: row.debt_description,
    debtValue: row.debt_value,
    debtorId: row.debtor_id,
    debtorName: row.debtor_name
  };
}

/**
 * Calculate default penalty for a debt value
 */
export function calculateDefaultPenalty(debtValue: number): number {
  return DEBT_DEFAULT_PENALTIES[debtValue] || -(20 + debtValue * 3);
}

/**
 * Calculate fulfill bonus for a debt value
 */
export function calculateFulfillBonus(debtValue: number): number {
  return DEBT_FULFILL_BONUSES[debtValue] || (3 + Math.floor(debtValue / 2));
}

/**
 * Calculate reliability rating based on default percentage
 */
export function calculateReliabilityRating(
  defaultCount: number,
  totalResolved: number
): 'excellent' | 'good' | 'fair' | 'poor' | 'terrible' {
  if (totalResolved === 0) return 'excellent';

  const defaultRate = defaultCount / totalResolved;

  if (defaultRate <= RELIABILITY_THRESHOLDS.excellent) return 'excellent';
  if (defaultRate < RELIABILITY_THRESHOLDS.good) return 'good';
  if (defaultRate < RELIABILITY_THRESHOLDS.fair) return 'fair';
  if (defaultRate < RELIABILITY_THRESHOLDS.poor) return 'poor';
  return 'terrible';
}

/**
 * Check if a debt is overdue
 */
export function isDebtOverdue(debt: PlayerDebt): boolean {
  if (!debt.dueDate) return false;
  if (debt.status !== 'outstanding' && debt.status !== 'called_in') return false;
  return new Date() > debt.dueDate;
}

/**
 * Calculate days until due (negative if overdue)
 */
export function calculateDaysUntilDue(debt: PlayerDebt): number | null {
  if (!debt.dueDate) return null;
  const now = new Date();
  const diff = debt.dueDate.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
