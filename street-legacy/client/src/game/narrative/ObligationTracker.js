/**
 * ObligationTracker - Phase 16: Obligation and Debt System
 *
 * Tracks what players owe and are owed.
 *
 * Types:
 * - MONETARY: Cash debts with interest
 * - FAVOR: Owed services/jobs
 * - LOYALTY: Expected ongoing support
 * - INFORMATION: Secrets/intel owed
 *
 * Features:
 * - Due dates and reminders
 * - Compound interest on monetary debts
 * - Overdue penalties (reputation damage, hostility)
 * - Dark path: Too much debt → enslavement narrative
 */

import { narrativeState, TRAITS } from './NarrativeState'

const STORAGE_KEY = 'player_obligations'

// Obligation types
export const OBLIGATION_TYPES = {
  MONETARY: 'monetary',
  FAVOR: 'favor',
  LOYALTY: 'loyalty',
  INFORMATION: 'information',
  PROTECTION: 'protection',
}

// Obligation severity
export const OBLIGATION_SEVERITY = {
  MINOR: 'minor',
  STANDARD: 'standard',
  SIGNIFICANT: 'significant',
  CRITICAL: 'critical',
}

// Interest rates (per day in game time, compressed for gameplay)
const INTEREST_RATES = {
  [OBLIGATION_SEVERITY.MINOR]: 0.05,      // 5% per period
  [OBLIGATION_SEVERITY.STANDARD]: 0.10,   // 10% per period
  [OBLIGATION_SEVERITY.SIGNIFICANT]: 0.15, // 15% per period
  [OBLIGATION_SEVERITY.CRITICAL]: 0.25,   // 25% per period
}

// Overdue penalties
const OVERDUE_PENALTIES = {
  first: {
    message: 'friendly_reminder',
    reputationHit: 0,
    graceHours: 24,
  },
  second: {
    message: 'stern_warning',
    reputationHit: -5,
    graceHours: 12,
  },
  third: {
    message: 'threat',
    reputationHit: -10,
    trait: TRAITS.DEBT_RIDDEN,
    graceHours: 6,
  },
  final: {
    message: 'collection',
    reputationHit: -20,
    event: 'debt_collectors',
    graceHours: 0,
  },
}

/**
 * ObligationTracker class
 */
class ObligationTrackerClass {
  constructor() {
    this.obligations = this.load()
    this.intervalId = null
  }

  /**
   * Start tracking (call on game init)
   */
  startTracking() {
    // Check obligations every minute
    this.intervalId = setInterval(() => {
      this.checkObligations()
    }, 60000)
  }

  /**
   * Stop tracking
   */
  stopTracking() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Create a new obligation
   */
  createObligation(config) {
    const {
      type = OBLIGATION_TYPES.MONETARY,
      creditorId,
      creditorName,
      amount = 0,           // For monetary
      description = '',     // For favors/info
      severity = OBLIGATION_SEVERITY.STANDARD,
      dueInMs = 300000,     // 5 minutes default (would be days in real game)
      interestEnabled = type === OBLIGATION_TYPES.MONETARY,
    } = config

    const obligation = {
      id: `obl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      creditorId,
      creditorName,
      originalAmount: amount,
      currentAmount: amount,
      description,
      severity,
      createdAt: Date.now(),
      dueAt: Date.now() + dueInMs,
      interestEnabled,
      interestAccrued: 0,
      lastInterestAt: Date.now(),
      overdueLevel: 0,  // 0 = not overdue, 1-4 = penalty levels
      status: 'active', // active, paid, defaulted
      reminders: [],
    }

    this.obligations.push(obligation)
    this.save()

    // Update narrative state
    narrativeState.incrementStat('debtsIncurred')
    narrativeState.addPressure('debt', severity === OBLIGATION_SEVERITY.CRITICAL ? 3 : 1)

    console.log(`[ObligationTracker] Created obligation: ${obligation.id} to ${creditorName}`)

    // Emit event
    const event = new CustomEvent('obligation_created', { detail: obligation })
    window.dispatchEvent(event)

    return obligation
  }

  /**
   * Check all obligations (called periodically)
   */
  checkObligations() {
    const now = Date.now()
    let changed = false

    for (const obligation of this.obligations) {
      if (obligation.status !== 'active') continue

      // Apply interest
      if (obligation.interestEnabled) {
        changed = this.applyInterest(obligation) || changed
      }

      // Check if overdue
      if (now > obligation.dueAt) {
        changed = this.handleOverdue(obligation) || changed
      }
    }

    if (changed) {
      this.save()
    }
  }

  /**
   * Apply interest to a monetary obligation
   */
  applyInterest(obligation) {
    const now = Date.now()
    const periodMs = 60000  // 1 minute = 1 "period" for testing (would be 1 day in real game)

    // Check if a period has passed since last interest
    if (now - obligation.lastInterestAt < periodMs) {
      return false
    }

    const periods = Math.floor((now - obligation.lastInterestAt) / periodMs)
    const rate = INTEREST_RATES[obligation.severity] || 0.10

    const interest = obligation.currentAmount * rate * periods
    obligation.currentAmount += interest
    obligation.interestAccrued += interest
    obligation.lastInterestAt = now

    console.log(`[ObligationTracker] Interest accrued: $${interest.toFixed(2)} on ${obligation.id}`)

    return true
  }

  /**
   * Handle overdue obligation
   */
  handleOverdue(obligation) {
    const now = Date.now()
    const overdueTime = now - obligation.dueAt

    // Determine overdue level
    let newLevel = 0
    if (overdueTime > 180000) newLevel = 4       // 3+ min = final
    else if (overdueTime > 120000) newLevel = 3  // 2 min = third
    else if (overdueTime > 60000) newLevel = 2   // 1 min = second
    else if (overdueTime > 0) newLevel = 1       // Just overdue = first

    if (newLevel <= obligation.overdueLevel) {
      return false  // Already at this level
    }

    obligation.overdueLevel = newLevel

    // Apply penalties
    const penaltyKeys = ['first', 'second', 'third', 'final']
    const penaltyKey = penaltyKeys[newLevel - 1]
    const penalty = OVERDUE_PENALTIES[penaltyKey]

    if (penalty) {
      // Send message
      obligation.reminders.push({
        level: newLevel,
        sentAt: now,
        type: penalty.message,
      })

      // Apply reputation hit
      if (penalty.reputationHit) {
        narrativeState.modifyKarma(penalty.reputationHit, `Debt to ${obligation.creditorName}`)
      }

      // Apply trait
      if (penalty.trait) {
        narrativeState.addTrait(penalty.trait)
      }

      // Trigger event
      if (penalty.event) {
        const event = new CustomEvent('narrative_event', {
          detail: {
            event: penalty.event,
            context: { obligation },
          },
        })
        window.dispatchEvent(event)
      }

      // Emit overdue event
      const overdueEvent = new CustomEvent('obligation_overdue', {
        detail: {
          obligation,
          level: newLevel,
          penalty,
        },
      })
      window.dispatchEvent(overdueEvent)

      console.log(`[ObligationTracker] Overdue level ${newLevel}: ${obligation.id}`)
    }

    // Check for enslavement threshold
    if (this.getTotalDebt() > 50000 && newLevel >= 3) {
      this.triggerEnslavement()
    }

    return true
  }

  /**
   * Pay off an obligation (fully or partially)
   */
  payObligation(obligationId, amount) {
    const obligation = this.obligations.find(o => o.id === obligationId)
    if (!obligation || obligation.status !== 'active') {
      return { success: false, error: 'Obligation not found or inactive' }
    }

    if (obligation.type !== OBLIGATION_TYPES.MONETARY) {
      return { success: false, error: 'Cannot pay non-monetary obligation with cash' }
    }

    const previousAmount = obligation.currentAmount
    obligation.currentAmount = Math.max(0, obligation.currentAmount - amount)

    if (obligation.currentAmount === 0) {
      obligation.status = 'paid'
      obligation.paidAt = Date.now()

      // Update narrative state
      narrativeState.incrementStat('debtsPaid')
      narrativeState.reducePressure('debt', 1)

      // Remove debt-ridden trait if all debts clear
      if (this.getTotalDebt() === 0) {
        narrativeState.removeTrait(TRAITS.DEBT_RIDDEN)
      }

      console.log(`[ObligationTracker] Obligation paid: ${obligationId}`)
    }

    this.save()

    return {
      success: true,
      amountPaid: Math.min(amount, previousAmount),
      remaining: obligation.currentAmount,
      fullyPaid: obligation.status === 'paid',
    }
  }

  /**
   * Fulfill a non-monetary obligation
   */
  fulfillObligation(obligationId, proofOfFulfillment = null) {
    const obligation = this.obligations.find(o => o.id === obligationId)
    if (!obligation || obligation.status !== 'active') {
      return { success: false, error: 'Obligation not found or inactive' }
    }

    obligation.status = 'paid'
    obligation.fulfilledAt = Date.now()
    obligation.proof = proofOfFulfillment

    // Update narrative state
    narrativeState.incrementStat('promisesKept')
    narrativeState.reducePressure('obligations', 1)

    this.save()

    console.log(`[ObligationTracker] Obligation fulfilled: ${obligationId}`)

    return { success: true }
  }

  /**
   * Trigger enslavement narrative (too much debt)
   */
  triggerEnslavement() {
    console.log('[ObligationTracker] ENSLAVEMENT TRIGGERED')

    narrativeState.transitionArc('trapped')
    narrativeState.setFlag('debt_enslaved')

    const event = new CustomEvent('narrative_event', {
      detail: {
        event: 'enslavement',
        context: {
          totalDebt: this.getTotalDebt(),
          creditors: this.getCreditors(),
        },
      },
    })
    window.dispatchEvent(event)
  }

  /**
   * Get total monetary debt
   */
  getTotalDebt() {
    return this.obligations
      .filter(o => o.type === OBLIGATION_TYPES.MONETARY && o.status === 'active')
      .reduce((sum, o) => sum + o.currentAmount, 0)
  }

  /**
   * Get all unique creditors
   */
  getCreditors() {
    const creditors = new Map()
    for (const o of this.obligations.filter(ob => ob.status === 'active')) {
      if (!creditors.has(o.creditorId)) {
        creditors.set(o.creditorId, {
          id: o.creditorId,
          name: o.creditorName,
          totalOwed: 0,
          obligations: [],
        })
      }
      const creditor = creditors.get(o.creditorId)
      creditor.totalOwed += o.currentAmount || 0
      creditor.obligations.push(o)
    }
    return Array.from(creditors.values())
  }

  /**
   * Get active obligations
   */
  getActiveObligations() {
    return this.obligations.filter(o => o.status === 'active')
  }

  /**
   * Get overdue obligations
   */
  getOverdueObligations() {
    return this.obligations.filter(o => o.status === 'active' && o.overdueLevel > 0)
  }

  /**
   * Get obligation summary
   */
  getSummary() {
    const active = this.getActiveObligations()
    const overdue = this.getOverdueObligations()

    return {
      totalActive: active.length,
      totalOverdue: overdue.length,
      totalDebt: this.getTotalDebt(),
      creditorCount: this.getCreditors().length,
      byType: active.reduce((acc, o) => {
        acc[o.type] = (acc[o.type] || 0) + 1
        return acc
      }, {}),
      isEnslaved: narrativeState.hasFlag('debt_enslaved'),
    }
  }

  /**
   * Save to localStorage
   */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.obligations))
    } catch (e) {
      console.warn('[ObligationTracker] Failed to save:', e)
    }
  }

  /**
   * Load from localStorage
   */
  load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.warn('[ObligationTracker] Failed to load:', e)
    }
    return []
  }

  /**
   * Reset all obligations
   */
  reset() {
    this.obligations = []
    localStorage.removeItem(STORAGE_KEY)
  }
}

// Export singleton
export const obligationTracker = new ObligationTrackerClass()
export default obligationTracker
