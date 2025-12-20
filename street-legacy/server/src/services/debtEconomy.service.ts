/**
 * Debt Economy Service
 * Handles favors as binding social contracts between players
 */

import pool from '../db/connection.js';
import {
  DebtType,
  DebtStatus,
  AskingPriceType,
  PlayerDebt,
  DebtTransfer,
  DebtDefault,
  DebtOffer,
  DebtSummary,
  PlayerDebtRow,
  DebtTransferRow,
  DebtDefaultRow,
  DebtOfferRow,
  CreateDebtRequest,
  CreateDebtOfferRequest,
  rowToPlayerDebt,
  rowToDebtTransfer,
  rowToDebtDefault,
  rowToDebtOffer,
  calculateReliabilityRating,
  DEBT_DEFAULT_PENALTIES,
  DEBT_FULFILL_BONUSES
} from '../types/debtEconomy.types.js';
import { modifyReputation, propagateReputation } from './reputationWeb.service.js';

// =============================================================================
// DEBT CREATION & MANAGEMENT
// =============================================================================

/**
 * Create a new debt between players
 */
export async function createDebt(
  creditorId: string,
  params: CreateDebtRequest
): Promise<PlayerDebt | null> {
  const { debtorId, debtType, description, value, context, dueDays } = params;

  // Validate creditor != debtor
  if (creditorId === String(debtorId)) {
    console.log(`[DebtEconomy] Cannot create debt to yourself`);
    return null;
  }

  // Calculate due date if dueDays provided
  let dueDate: Date | null = null;
  if (dueDays && dueDays > 0) {
    dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);
  }

  const result = await pool.query<PlayerDebtRow>(
    `INSERT INTO player_debts (
      creditor_id, debtor_id, debt_type, description,
      value, original_value, context, due_date, status
    ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7, 'outstanding')
    RETURNING *`,
    [creditorId, debtorId, debtType, description, value, context || null, dueDate]
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Get with player names
  const debt = await getDebtById(result.rows[0].id);

  console.log(`[DebtEconomy] Created debt: ${creditorId} -> ${debtorId} (${debtType}, value: ${value})`);

  return debt;
}

/**
 * Get all debts for a player (both owed and owing)
 */
export async function getPlayerDebts(
  playerId: string
): Promise<{ owedToYou: PlayerDebt[]; youOwe: PlayerDebt[] }> {
  // Debts owed TO player (they are creditor) - non-resolved
  const owedResult = await pool.query<PlayerDebtRow>(
    `SELECT
      pd.*,
      c.username as creditor_name,
      d.username as debtor_name,
      t.username as transferred_from_name,
      CASE
        WHEN pd.due_date IS NOT NULL AND pd.due_date < NOW()
          AND pd.status IN ('outstanding', 'called_in') THEN TRUE
        ELSE FALSE
      END as is_overdue,
      CASE
        WHEN pd.due_date IS NOT NULL THEN
          EXTRACT(DAY FROM (pd.due_date - NOW()))::INTEGER
        ELSE NULL
      END as days_until_due
    FROM player_debts pd
    JOIN players c ON c.id = pd.creditor_id
    JOIN players d ON d.id = pd.debtor_id
    LEFT JOIN players t ON t.id = pd.transferred_from_id
    WHERE pd.creditor_id = $1
      AND pd.status IN ('outstanding', 'called_in')
    ORDER BY pd.created_at DESC`,
    [playerId]
  );

  // Debts player OWES (they are debtor) - non-resolved
  const oweResult = await pool.query<PlayerDebtRow>(
    `SELECT
      pd.*,
      c.username as creditor_name,
      d.username as debtor_name,
      t.username as transferred_from_name,
      CASE
        WHEN pd.due_date IS NOT NULL AND pd.due_date < NOW()
          AND pd.status IN ('outstanding', 'called_in') THEN TRUE
        ELSE FALSE
      END as is_overdue,
      CASE
        WHEN pd.due_date IS NOT NULL THEN
          EXTRACT(DAY FROM (pd.due_date - NOW()))::INTEGER
        ELSE NULL
      END as days_until_due
    FROM player_debts pd
    JOIN players c ON c.id = pd.creditor_id
    JOIN players d ON d.id = pd.debtor_id
    LEFT JOIN players t ON t.id = pd.transferred_from_id
    WHERE pd.debtor_id = $1
      AND pd.status IN ('outstanding', 'called_in')
    ORDER BY pd.created_at DESC`,
    [playerId]
  );

  return {
    owedToYou: owedResult.rows.map(rowToPlayerDebt),
    youOwe: oweResult.rows.map(rowToPlayerDebt)
  };
}

/**
 * Get a single debt by ID
 */
export async function getDebtById(debtId: string): Promise<PlayerDebt | null> {
  const result = await pool.query<PlayerDebtRow>(
    `SELECT
      pd.*,
      c.username as creditor_name,
      d.username as debtor_name,
      t.username as transferred_from_name,
      CASE
        WHEN pd.due_date IS NOT NULL AND pd.due_date < NOW()
          AND pd.status IN ('outstanding', 'called_in') THEN TRUE
        ELSE FALSE
      END as is_overdue,
      CASE
        WHEN pd.due_date IS NOT NULL THEN
          EXTRACT(DAY FROM (pd.due_date - NOW()))::INTEGER
        ELSE NULL
      END as days_until_due
    FROM player_debts pd
    JOIN players c ON c.id = pd.creditor_id
    JOIN players d ON d.id = pd.debtor_id
    LEFT JOIN players t ON t.id = pd.transferred_from_id
    WHERE pd.id = $1`,
    [debtId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToPlayerDebt(result.rows[0]);
}

/**
 * Call in a debt (creditor demands fulfillment)
 */
export async function callInDebt(
  debtId: string,
  creditorId: string
): Promise<PlayerDebt | null> {
  // Validate creditor owns debt and status
  const debt = await getDebtById(debtId);

  if (!debt) {
    console.log(`[DebtEconomy] Debt ${debtId} not found`);
    return null;
  }

  if (String(debt.creditorId) !== creditorId) {
    console.log(`[DebtEconomy] Player ${creditorId} is not creditor of debt ${debtId}`);
    return null;
  }

  if (debt.status !== 'outstanding') {
    console.log(`[DebtEconomy] Debt ${debtId} cannot be called in (status: ${debt.status})`);
    return null;
  }

  // Update status
  await pool.query(
    `UPDATE player_debts
     SET status = 'called_in', called_in_at = NOW()
     WHERE id = $1`,
    [debtId]
  );

  console.log(`[DebtEconomy] Debt ${debtId} called in`);

  return getDebtById(debtId);
}

/**
 * Fulfill a debt (debtor honors obligation)
 */
export async function fulfillDebt(
  debtId: string,
  debtorId: string
): Promise<{ success: boolean; trustBonus: number }> {
  // Validate debtor owns debt
  const debt = await getDebtById(debtId);

  if (!debt) {
    console.log(`[DebtEconomy] Debt ${debtId} not found`);
    return { success: false, trustBonus: 0 };
  }

  if (String(debt.debtorId) !== debtorId) {
    console.log(`[DebtEconomy] Player ${debtorId} is not debtor of debt ${debtId}`);
    return { success: false, trustBonus: 0 };
  }

  if (debt.status !== 'outstanding' && debt.status !== 'called_in') {
    console.log(`[DebtEconomy] Debt ${debtId} cannot be fulfilled (status: ${debt.status})`);
    return { success: false, trustBonus: 0 };
  }

  // Update status
  await pool.query(
    `UPDATE player_debts
     SET status = 'fulfilled', resolved_at = NOW()
     WHERE id = $1`,
    [debtId]
  );

  // Calculate trust bonus based on value
  const trustBonus = DEBT_FULFILL_BONUSES[debt.value] || (3 + Math.floor(debt.value / 2));

  // Award reputation to debtor (trust with creditor)
  try {
    await modifyReputation(
      debtorId,
      'player',
      String(debt.creditorId),
      { trust: trustBonus },
      `Fulfilled debt: ${debt.description}`
    );
    console.log(`[DebtEconomy] Debt ${debtId} fulfilled, trust +${trustBonus}`);
  } catch (error) {
    console.log(`[DebtEconomy] Debt ${debtId} fulfilled (reputation update skipped)`);
  }

  return { success: true, trustBonus };
}

/**
 * Default on a debt (debtor fails to fulfill)
 */
export async function defaultOnDebt(
  debtId: string,
  debtorId: string,
  reason?: string
): Promise<{ success: boolean; penalty: number }> {
  // Validate debtor owns debt
  const debt = await getDebtById(debtId);

  if (!debt) {
    console.log(`[DebtEconomy] Debt ${debtId} not found`);
    return { success: false, penalty: 0 };
  }

  if (String(debt.debtorId) !== debtorId) {
    console.log(`[DebtEconomy] Player ${debtorId} is not debtor of debt ${debtId}`);
    return { success: false, penalty: 0 };
  }

  if (debt.status !== 'outstanding' && debt.status !== 'called_in') {
    console.log(`[DebtEconomy] Debt ${debtId} cannot be defaulted (status: ${debt.status})`);
    return { success: false, penalty: 0 };
  }

  // Calculate penalty based on debt value
  const penalty = Math.abs(DEBT_DEFAULT_PENALTIES[debt.value] || (20 + debt.value * 3));

  // Create debt_default record
  await pool.query(
    `INSERT INTO debt_defaults (
      debt_id, debtor_id, creditor_id, default_reason,
      reputation_penalty_applied, penalty_amount
    ) VALUES ($1, $2, $3, $4, TRUE, $5)`,
    [debtId, debt.debtorId, debt.creditorId, reason || null, penalty]
  );

  // Update debt status
  await pool.query(
    `UPDATE player_debts
     SET status = 'defaulted', resolved_at = NOW()
     WHERE id = $1`,
    [debtId]
  );

  // Apply reputation penalty (trust with creditor)
  try {
    await modifyReputation(
      debtorId,
      'player',
      String(debt.creditorId),
      { trust: -penalty },
      `Defaulted on debt: ${debt.description}`
    );

    // Propagate to creditor's network (they hear about defaults)
    await propagateReputation(
      debtorId,
      'player',
      String(debt.creditorId),
      { trust: Math.round(-penalty * 0.3) },
      { maxDepth: 2, decayRate: 0.5 }
    );
  } catch (error) {
    console.log(`[DebtEconomy] Debt ${debtId} defaulted (reputation update skipped)`);
  }

  console.log(`[DebtEconomy] Debt ${debtId} defaulted by ${debtorId}`);

  return { success: true, penalty };
}

/**
 * Transfer debt to another creditor
 */
export async function transferDebt(
  debtId: string,
  fromCreditorId: string,
  toCreditorId: string,
  reason?: string
): Promise<PlayerDebt | null> {
  // Validate fromCreditor owns debt
  const debt = await getDebtById(debtId);

  if (!debt) {
    console.log(`[DebtEconomy] Debt ${debtId} not found`);
    return null;
  }

  if (String(debt.creditorId) !== fromCreditorId) {
    console.log(`[DebtEconomy] Player ${fromCreditorId} is not creditor of debt ${debtId}`);
    return null;
  }

  if (debt.status !== 'outstanding' && debt.status !== 'called_in') {
    console.log(`[DebtEconomy] Debt ${debtId} cannot be transferred (status: ${debt.status})`);
    return null;
  }

  // Cannot transfer to debtor
  if (String(debt.debtorId) === toCreditorId) {
    console.log(`[DebtEconomy] Cannot transfer debt to the debtor`);
    return null;
  }

  // Cannot transfer to self
  if (fromCreditorId === toCreditorId) {
    console.log(`[DebtEconomy] Cannot transfer debt to yourself`);
    return null;
  }

  // Create debt_transfer record
  await pool.query(
    `INSERT INTO debt_transfers (
      debt_id, from_creditor_id, to_creditor_id,
      transfer_reason, value_at_transfer
    ) VALUES ($1, $2, $3, $4, $5)`,
    [debtId, fromCreditorId, toCreditorId, reason || null, debt.value]
  );

  // Update debt
  await pool.query(
    `UPDATE player_debts
     SET creditor_id = $1,
         transferred_from_id = $2,
         status = CASE WHEN status = 'called_in' THEN 'outstanding' ELSE status END
     WHERE id = $3`,
    [toCreditorId, fromCreditorId, debtId]
  );

  console.log(`[DebtEconomy] Debt ${debtId} transferred from ${fromCreditorId} to ${toCreditorId}`);

  return getDebtById(debtId);
}

/**
 * Forgive a debt (creditor releases debtor)
 */
export async function forgiveDebt(
  debtId: string,
  creditorId: string
): Promise<boolean> {
  // Validate creditor owns debt
  const debt = await getDebtById(debtId);

  if (!debt) {
    console.log(`[DebtEconomy] Debt ${debtId} not found`);
    return false;
  }

  if (String(debt.creditorId) !== creditorId) {
    console.log(`[DebtEconomy] Player ${creditorId} is not creditor of debt ${debtId}`);
    return false;
  }

  if (debt.status !== 'outstanding' && debt.status !== 'called_in') {
    console.log(`[DebtEconomy] Debt ${debtId} cannot be forgiven (status: ${debt.status})`);
    return false;
  }

  // Update status
  await pool.query(
    `UPDATE player_debts
     SET status = 'forgiven', resolved_at = NOW()
     WHERE id = $1`,
    [debtId]
  );

  // Small trust bonus to debtor (goodwill gesture)
  const trustBonus = Math.ceil(debt.value / 3);
  try {
    await modifyReputation(
      String(debt.debtorId),
      'player',
      creditorId,
      { trust: trustBonus, respect: 1 },
      `Debt forgiven by creditor`
    );
  } catch (error) {
    // Reputation update optional
  }

  console.log(`[DebtEconomy] Debt ${debtId} forgiven`);

  return true;
}

/**
 * Get debt history (transfers and defaults)
 */
export async function getDebtHistory(
  debtId: string
): Promise<{ transfers: DebtTransfer[]; defaults: DebtDefault[] }> {
  // Get transfers
  const transferResult = await pool.query<DebtTransferRow>(
    `SELECT
      dt.*,
      f.username as from_creditor_name,
      t.username as to_creditor_name
    FROM debt_transfers dt
    JOIN players f ON f.id = dt.from_creditor_id
    JOIN players t ON t.id = dt.to_creditor_id
    WHERE dt.debt_id = $1
    ORDER BY dt.transferred_at DESC`,
    [debtId]
  );

  // Get default record if exists
  const defaultResult = await pool.query<DebtDefaultRow>(
    `SELECT
      dd.*,
      db.username as debtor_name,
      cr.username as creditor_name
    FROM debt_defaults dd
    JOIN players db ON db.id = dd.debtor_id
    JOIN players cr ON cr.id = dd.creditor_id
    WHERE dd.debt_id = $1`,
    [debtId]
  );

  return {
    transfers: transferResult.rows.map(rowToDebtTransfer),
    defaults: defaultResult.rows.map(rowToDebtDefault)
  };
}

/**
 * Get debt summary for a player
 */
export async function getDebtSummary(playerId: string): Promise<DebtSummary> {
  const result = await pool.query(
    `SELECT
      (SELECT COUNT(*)::INTEGER FROM player_debts WHERE debtor_id = $1 AND status IN ('outstanding', 'called_in')) as debts_you_owe_count,
      (SELECT COALESCE(SUM(value), 0)::INTEGER FROM player_debts WHERE debtor_id = $1 AND status IN ('outstanding', 'called_in')) as total_you_owe,
      (SELECT COUNT(*)::INTEGER FROM player_debts WHERE creditor_id = $1 AND status IN ('outstanding', 'called_in')) as debts_owed_to_you_count,
      (SELECT COALESCE(SUM(value), 0)::INTEGER FROM player_debts WHERE creditor_id = $1 AND status IN ('outstanding', 'called_in')) as total_owed_to_you,
      (SELECT COUNT(*)::INTEGER FROM player_debts WHERE debtor_id = $1 AND status = 'outstanding') as outstanding_count,
      (SELECT COUNT(*)::INTEGER FROM player_debts WHERE debtor_id = $1 AND status = 'called_in') as called_in_count,
      (SELECT COUNT(*)::INTEGER FROM debt_defaults WHERE debtor_id = $1) as default_count,
      (SELECT COUNT(*)::INTEGER FROM player_debts WHERE debtor_id = $1 AND status = 'fulfilled') as fulfilled_count`,
    [playerId]
  );

  const row = result.rows[0];
  const defaultCount = Number(row.default_count);
  const fulfilledCount = Number(row.fulfilled_count);
  const totalResolved = defaultCount + fulfilledCount;

  return {
    totalOwedToYou: Number(row.total_owed_to_you),
    totalYouOwe: Number(row.total_you_owe),
    debtsOwedToYouCount: Number(row.debts_owed_to_you_count),
    debtsYouOweCount: Number(row.debts_you_owe_count),
    outstandingCount: Number(row.outstanding_count),
    calledInCount: Number(row.called_in_count),
    defaultCount,
    fulfilledCount,
    reliabilityRating: calculateReliabilityRating(defaultCount, totalResolved)
  };
}

// =============================================================================
// DEBT MARKETPLACE (OFFERS)
// =============================================================================

/**
 * Create an offer to sell a debt
 */
export async function createDebtOffer(
  debtId: string,
  creditorId: string,
  params: CreateDebtOfferRequest
): Promise<DebtOffer | null> {
  const { askingPriceType, askingPriceValue, askingPriceDetails, expiresDays } = params;

  // Validate creditor owns debt
  const debt = await getDebtById(debtId);

  if (!debt) {
    console.log(`[DebtEconomy] Debt ${debtId} not found`);
    return null;
  }

  if (String(debt.creditorId) !== creditorId) {
    console.log(`[DebtEconomy] Player ${creditorId} is not creditor of debt ${debtId}`);
    return null;
  }

  if (debt.status !== 'outstanding' && debt.status !== 'called_in') {
    console.log(`[DebtEconomy] Debt ${debtId} cannot be offered (status: ${debt.status})`);
    return null;
  }

  // Check for existing open offers
  const existingCheck = await pool.query(
    `SELECT 1 FROM debt_offers WHERE debt_id = $1 AND status = 'open' LIMIT 1`,
    [debtId]
  );

  if (existingCheck.rows.length > 0) {
    console.log(`[DebtEconomy] Debt ${debtId} already has an open offer`);
    return null;
  }

  // Calculate expiration
  const expiresHours = (expiresDays || 3) * 24;

  const result = await pool.query<DebtOfferRow>(
    `INSERT INTO debt_offers (
      debt_id, offering_player_id, asking_price_type,
      asking_price_value, asking_price_details, expires_at, status
    ) VALUES (
      $1, $2, $3, $4, $5, NOW() + ($6 || ' hours')::INTERVAL, 'open'
    )
    RETURNING *`,
    [debtId, creditorId, askingPriceType, askingPriceValue || null, askingPriceDetails || null, expiresHours]
  );

  if (result.rows.length === 0) {
    return null;
  }

  console.log(`[DebtEconomy] Created offer for debt ${debtId}`);

  return getOfferById(result.rows[0].id);
}

/**
 * Get open debt offers (marketplace)
 */
export async function getOpenOffers(playerId?: string): Promise<DebtOffer[]> {
  // Optionally exclude player's own debts and offers
  const excludeClause = playerId
    ? `AND do.offering_player_id != $1 AND pd.debtor_id != $1`
    : '';

  const result = await pool.query<DebtOfferRow>(
    `SELECT
      do.*,
      op.username as offering_player_name,
      pd.debt_type,
      pd.description as debt_description,
      pd.value as debt_value,
      pd.debtor_id,
      db.username as debtor_name
    FROM debt_offers do
    JOIN player_debts pd ON pd.id = do.debt_id
    JOIN players op ON op.id = do.offering_player_id
    JOIN players db ON db.id = pd.debtor_id
    WHERE do.status = 'open'
      AND (do.expires_at IS NULL OR do.expires_at > NOW())
      ${excludeClause}
    ORDER BY do.created_at DESC`,
    playerId ? [playerId] : []
  );

  return result.rows.map(rowToDebtOffer);
}

/**
 * Get a single offer by ID
 */
export async function getOfferById(offerId: string): Promise<DebtOffer | null> {
  const result = await pool.query<DebtOfferRow>(
    `SELECT
      do.*,
      op.username as offering_player_name,
      pd.debt_type,
      pd.description as debt_description,
      pd.value as debt_value,
      pd.debtor_id,
      db.username as debtor_name
    FROM debt_offers do
    JOIN player_debts pd ON pd.id = do.debt_id
    JOIN players op ON op.id = do.offering_player_id
    JOIN players db ON db.id = pd.debtor_id
    WHERE do.id = $1`,
    [offerId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return rowToDebtOffer(result.rows[0]);
}

/**
 * Accept a debt offer
 */
export async function acceptOffer(
  offerId: string,
  acceptingPlayerId: string
): Promise<{ success: boolean; debtId?: string; message: string }> {
  const offer = await getOfferById(offerId);

  if (!offer) {
    return { success: false, message: 'Offer not found' };
  }

  if (offer.status !== 'open') {
    return { success: false, message: `Offer is not open (status: ${offer.status})` };
  }

  if (offer.expiresAt && new Date(offer.expiresAt) < new Date()) {
    // Mark as expired
    await pool.query(
      `UPDATE debt_offers SET status = 'expired', resolved_at = NOW() WHERE id = $1`,
      [offerId]
    );
    return { success: false, message: 'Offer has expired' };
  }

  // Cannot accept own offer
  if (String(offer.offeringPlayerId) === acceptingPlayerId) {
    return { success: false, message: 'Cannot accept your own offer' };
  }

  // Cannot accept if you're the debtor
  if (String(offer.debtorId) === acceptingPlayerId) {
    return { success: false, message: 'Cannot accept offer for your own debt' };
  }

  // Transfer the debt
  const transferredDebt = await transferDebt(
    offer.debtId,
    String(offer.offeringPlayerId),
    acceptingPlayerId,
    'Debt offer accepted'
  );

  if (!transferredDebt) {
    return { success: false, message: 'Failed to transfer debt' };
  }

  // Mark offer as accepted
  await pool.query(
    `UPDATE debt_offers
     SET status = 'accepted', accepted_by_id = $1, resolved_at = NOW()
     WHERE id = $2`,
    [acceptingPlayerId, offerId]
  );

  console.log(`[DebtEconomy] Offer ${offerId} accepted by ${acceptingPlayerId}`);

  return {
    success: true,
    debtId: offer.debtId,
    message: 'Offer accepted and debt transferred'
  };
}

/**
 * Withdraw a debt offer
 */
export async function withdrawOffer(
  offerId: string,
  offeringPlayerId: string
): Promise<{ success: boolean; message: string }> {
  const offer = await getOfferById(offerId);

  if (!offer) {
    return { success: false, message: 'Offer not found' };
  }

  if (String(offer.offeringPlayerId) !== offeringPlayerId) {
    return { success: false, message: 'You are not the owner of this offer' };
  }

  if (offer.status !== 'open') {
    return { success: false, message: `Offer is not open (status: ${offer.status})` };
  }

  await pool.query(
    `UPDATE debt_offers SET status = 'withdrawn', resolved_at = NOW() WHERE id = $1`,
    [offerId]
  );

  console.log(`[DebtEconomy] Offer ${offerId} withdrawn`);

  return { success: true, message: 'Offer withdrawn successfully' };
}

/**
 * Get player's own debt offers
 */
export async function getPlayerOffers(playerId: string): Promise<DebtOffer[]> {
  const result = await pool.query<DebtOfferRow>(
    `SELECT
      do.*,
      op.username as offering_player_name,
      pd.debt_type,
      pd.description as debt_description,
      pd.value as debt_value,
      pd.debtor_id,
      db.username as debtor_name
    FROM debt_offers do
    JOIN player_debts pd ON pd.id = do.debt_id
    JOIN players op ON op.id = do.offering_player_id
    JOIN players db ON db.id = pd.debtor_id
    WHERE do.offering_player_id = $1
    ORDER BY do.created_at DESC`,
    [playerId]
  );

  return result.rows.map(rowToDebtOffer);
}

/**
 * Get debts between two players
 */
export async function getDebtsBetweenPlayers(
  playerId1: string,
  playerId2: string
): Promise<PlayerDebt[]> {
  const result = await pool.query<PlayerDebtRow>(
    `SELECT
      pd.*,
      c.username as creditor_name,
      d.username as debtor_name,
      t.username as transferred_from_name,
      CASE
        WHEN pd.due_date IS NOT NULL AND pd.due_date < NOW()
          AND pd.status IN ('outstanding', 'called_in') THEN TRUE
        ELSE FALSE
      END as is_overdue
    FROM player_debts pd
    JOIN players c ON c.id = pd.creditor_id
    JOIN players d ON d.id = pd.debtor_id
    LEFT JOIN players t ON t.id = pd.transferred_from_id
    WHERE ((pd.creditor_id = $1 AND pd.debtor_id = $2)
       OR (pd.creditor_id = $2 AND pd.debtor_id = $1))
      AND pd.status IN ('outstanding', 'called_in')
    ORDER BY pd.created_at DESC`,
    [playerId1, playerId2]
  );

  return result.rows.map(rowToPlayerDebt);
}

/**
 * Get called-in debts for a player (need action)
 */
export async function getCalledInDebts(playerId: string): Promise<PlayerDebt[]> {
  const result = await pool.query<PlayerDebtRow>(
    `SELECT
      pd.*,
      c.username as creditor_name,
      d.username as debtor_name,
      t.username as transferred_from_name,
      CASE
        WHEN pd.due_date IS NOT NULL AND pd.due_date < NOW() THEN TRUE
        ELSE FALSE
      END as is_overdue
    FROM player_debts pd
    JOIN players c ON c.id = pd.creditor_id
    JOIN players d ON d.id = pd.debtor_id
    LEFT JOIN players t ON t.id = pd.transferred_from_id
    WHERE pd.debtor_id = $1
      AND pd.status = 'called_in'
    ORDER BY pd.called_in_at ASC`,
    [playerId]
  );

  return result.rows.map(rowToPlayerDebt);
}

/**
 * Get player's default history
 */
export async function getPlayerDefaults(playerId: string): Promise<DebtDefault[]> {
  const result = await pool.query<DebtDefaultRow>(
    `SELECT
      dd.*,
      db.username as debtor_name,
      cr.username as creditor_name
    FROM debt_defaults dd
    JOIN players db ON db.id = dd.debtor_id
    JOIN players cr ON cr.id = dd.creditor_id
    WHERE dd.debtor_id = $1
    ORDER BY dd.defaulted_at DESC`,
    [playerId]
  );

  return result.rows.map(rowToDebtDefault);
}

/**
 * Expire old debt offers (maintenance function)
 */
export async function expireOldOffers(): Promise<number> {
  const result = await pool.query(
    `UPDATE debt_offers
     SET status = 'expired', resolved_at = NOW()
     WHERE status = 'open'
       AND expires_at IS NOT NULL
       AND expires_at < NOW()
     RETURNING id`
  );

  const count = result.rowCount || 0;
  if (count > 0) {
    console.log(`[DebtEconomy] Expired ${count} offers`);
  }

  return count;
}

// =============================================================================
// EXPORT SERVICE OBJECT
// =============================================================================

export default {
  // Debt management
  createDebt,
  getPlayerDebts,
  getDebtById,
  callInDebt,
  fulfillDebt,
  defaultOnDebt,
  transferDebt,
  forgiveDebt,
  getDebtHistory,
  getDebtSummary,
  getDebtsBetweenPlayers,
  getCalledInDebts,
  getPlayerDefaults,

  // Marketplace
  createDebtOffer,
  getOpenOffers,
  getOfferById,
  acceptOffer,
  withdrawOffer,
  getPlayerOffers,
  expireOldOffers
};
