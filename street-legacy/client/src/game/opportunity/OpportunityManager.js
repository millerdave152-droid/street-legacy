/**
 * OpportunityManager - Central coordinator for all terminal opportunities
 *
 * Manages the lifecycle of opportunities:
 * - NPC job offers
 * - Text adventures
 * - Trade deals
 * - Alliance requests
 *
 * Works with the scheduler for smart timing and the resolver for responses
 */

import { gameManager } from '../GameManager'
import { terminalManager, OUTPUT_TYPES } from '../managers/TerminalManager'
import { opportunityScheduler } from './OpportunityScheduler'
import { relationshipTracker } from './RelationshipTracker'
import { audioManager } from '../managers/AudioManager'

// Opportunity types
export const OPPORTUNITY_TYPES = {
  NPC_JOB: 'npc_job',           // Crime/heist offers from NPCs
  TRADE_DEAL: 'trade_deal',     // Buy/sell opportunities
  ALLIANCE: 'alliance',          // Team up requests
  ADVENTURE: 'adventure',        // Text adventure hooks
  INTEL: 'intel',               // Information offers
  FAVOR: 'favor',               // Requests for help
}

// Opportunity states
export const OPPORTUNITY_STATES = {
  PENDING: 'pending',           // Waiting for player response
  ACCEPTED: 'accepted',         // Player accepted
  DECLINED: 'declined',         // Player declined
  EXPIRED: 'expired',           // Time ran out
  COMPLETED: 'completed',       // Successfully finished
  FAILED: 'failed',             // Attempt failed
}

// Default expiry times by type (in milliseconds)
const DEFAULT_EXPIRY = {
  [OPPORTUNITY_TYPES.NPC_JOB]: 10 * 60 * 1000,    // 10 minutes
  [OPPORTUNITY_TYPES.TRADE_DEAL]: 5 * 60 * 1000,  // 5 minutes
  [OPPORTUNITY_TYPES.ALLIANCE]: 30 * 60 * 1000,   // 30 minutes
  [OPPORTUNITY_TYPES.ADVENTURE]: 60 * 60 * 1000,  // 1 hour
  [OPPORTUNITY_TYPES.INTEL]: 15 * 60 * 1000,      // 15 minutes
  [OPPORTUNITY_TYPES.FAVOR]: 20 * 60 * 1000,      // 20 minutes
}

class OpportunityManagerClass {
  constructor() {
    this.opportunities = new Map()      // Active opportunities by ID
    this.opportunityHistory = []        // Past opportunities (for learning)
    this.nextId = 1
    this.initialized = false

    // Event listeners for game events
    this.eventListeners = new Map()

    // Callbacks for opportunity events
    this.onOpportunityCreated = null
    this.onOpportunityExpired = null
    this.onOpportunityResolved = null
  }

  /**
   * Initialize the opportunity system
   */
  initialize() {
    if (this.initialized) return

    // Initialize scheduler
    opportunityScheduler.initialize()

    // Initialize relationship tracker
    relationshipTracker.initialize()

    // Load from localStorage
    this.loadState()

    // Subscribe to game events
    this.subscribeToGameEvents()

    // Start expiry checker
    this.startExpiryChecker()

    this.initialized = true
    console.log('[OpportunityManager] Initialized with', this.opportunities.size, 'active opportunities')
  }

  /**
   * Subscribe to game events for opportunity triggers
   */
  subscribeToGameEvents() {
    // These events trigger opportunity generation
    const eventHandlers = {
      'crimeCompleted': this.handleCrimeCompleted.bind(this),
      'levelUp': this.handleLevelUp.bind(this),
      'traveled': this.handleTraveled.bind(this),
      'itemAcquired': this.handleItemAcquired.bind(this),
    }

    // Store handlers so we can unsubscribe later
    for (const [event, handler] of Object.entries(eventHandlers)) {
      this.eventListeners.set(event, handler)
      if (gameManager.on) {
        gameManager.on(event, handler)
      }
    }
  }

  /**
   * Handle crime completion - may trigger follow-up opportunities
   */
  handleCrimeCompleted(data) {
    if (!opportunityScheduler.canGenerateOpportunity(OPPORTUNITY_TYPES.NPC_JOB)) {
      return
    }

    const player = gameManager.player
    if (!player) return

    // 30% chance of follow-up after successful crime
    if (data?.success && Math.random() < 0.3) {
      // Delay the opportunity slightly
      setTimeout(() => {
        this.generateCrimeFollowUp(data)
      }, 5000 + Math.random() * 10000)
    }
  }

  /**
   * Handle level up - unlock new opportunities
   */
  handleLevelUp(data) {
    const player = gameManager.player
    if (!player) return

    // At certain levels, special opportunities unlock
    const milestones = [5, 10, 15, 20, 25, 30]
    if (milestones.includes(data?.newLevel)) {
      this.generateMilestoneOpportunity(data.newLevel)
    }
  }

  /**
   * Handle travel - location-based opportunities
   */
  handleTraveled(data) {
    if (!opportunityScheduler.canGenerateOpportunity(OPPORTUNITY_TYPES.TRADE_DEAL)) {
      return
    }

    // Small chance of encounter in new district
    if (Math.random() < 0.15) {
      setTimeout(() => {
        this.generateLocationOpportunity(data?.toDistrict)
      }, 2000 + Math.random() * 5000)
    }
  }

  /**
   * Handle item acquisition
   */
  handleItemAcquired(data) {
    // If acquired rare item, might attract interest
    if (data?.item?.rarity >= 3 && Math.random() < 0.4) {
      this.generateTradeOpportunity(data.item)
    }
  }

  /**
   * Create a new opportunity
   */
  createOpportunity(config) {
    const id = `opp_${this.nextId++}_${Date.now()}`

    const opportunity = {
      id,
      type: config.type || OPPORTUNITY_TYPES.NPC_JOB,
      npcId: config.npcId,
      npcName: config.npcName || 'Unknown Contact',
      title: config.title,
      message: config.message,
      shortMessage: config.shortMessage || config.title,
      details: config.details || {},

      // Risk/Reward
      rewards: config.rewards || {},
      risks: config.risks || {},
      requirements: config.requirements || {},

      // Timing
      createdAt: Date.now(),
      expiresAt: Date.now() + (config.expiryMs || DEFAULT_EXPIRY[config.type] || 600000),

      // State
      state: OPPORTUNITY_STATES.PENDING,

      // Response options
      responseOptions: config.responseOptions || ['accept', 'decline'],

      // Chain info (for multi-part opportunities)
      chainId: config.chainId || null,
      chainStep: config.chainStep || 0,

      // Adventure hook
      adventureId: config.adventureId || null,
    }

    this.opportunities.set(id, opportunity)
    this.saveState()

    // Notify scheduler
    opportunityScheduler.recordOpportunity(opportunity.type)

    // Notify terminal
    this.notifyTerminal(opportunity)

    // Callback
    if (this.onOpportunityCreated) {
      this.onOpportunityCreated(opportunity)
    }

    console.log('[OpportunityManager] Created opportunity:', id, opportunity.type)
    return opportunity
  }

  /**
   * Respond to an opportunity
   */
  respond(opportunityId, response) {
    const opportunity = this.opportunities.get(opportunityId)
    if (!opportunity) {
      return { success: false, error: 'Opportunity not found' }
    }

    if (opportunity.state !== OPPORTUNITY_STATES.PENDING) {
      return { success: false, error: 'Opportunity is no longer available' }
    }

    // Check if expired
    if (Date.now() > opportunity.expiresAt) {
      this.expireOpportunity(opportunityId)
      return { success: false, error: 'Opportunity has expired' }
    }

    const normalizedResponse = response.toLowerCase().trim()

    // Handle accept/decline
    if (['yes', 'accept', 'ok', 'sure', 'yeah', 'y', '1'].includes(normalizedResponse)) {
      return this.acceptOpportunity(opportunityId)
    } else if (['no', 'decline', 'nah', 'pass', 'n', '2'].includes(normalizedResponse)) {
      return this.declineOpportunity(opportunityId)
    }

    return { success: false, error: 'Invalid response. Use yes/no or accept/decline' }
  }

  /**
   * Accept an opportunity
   */
  acceptOpportunity(opportunityId) {
    const opportunity = this.opportunities.get(opportunityId)
    if (!opportunity) {
      return { success: false, error: 'Opportunity not found' }
    }

    opportunity.state = OPPORTUNITY_STATES.ACCEPTED
    opportunity.acceptedAt = Date.now()

    // Update NPC relationship (if applicable)
    if (opportunity.npcId) {
      relationshipTracker.recordInteraction(opportunity.npcId, 'accepted_job', 5)
    }

    // Handle different opportunity types
    let result = { success: true, opportunity, rewards: opportunity.rewards }

    switch (opportunity.type) {
      case OPPORTUNITY_TYPES.NPC_JOB:
        result.message = this.handleJobAccept(opportunity)
        break
      case OPPORTUNITY_TYPES.TRADE_DEAL:
        result = { ...result, ...this.handleTradeAccept(opportunity) }
        break
      case OPPORTUNITY_TYPES.ALLIANCE:
        result.message = this.handleAllianceAccept(opportunity)
        break
      case OPPORTUNITY_TYPES.ADVENTURE:
        result.adventureStart = true
        result.adventureId = opportunity.adventureId
        result.message = opportunity.details.acceptMessage || 'Adventure begins...'
        break
      default:
        result.message = 'Opportunity accepted.'
    }

    this.saveState()

    if (this.onOpportunityResolved) {
      this.onOpportunityResolved(opportunity, 'accepted')
    }

    return result
  }

  /**
   * Decline an opportunity
   */
  declineOpportunity(opportunityId) {
    const opportunity = this.opportunities.get(opportunityId)
    if (!opportunity) {
      return { success: false, error: 'Opportunity not found' }
    }

    opportunity.state = OPPORTUNITY_STATES.DECLINED
    opportunity.declinedAt = Date.now()

    // Update NPC relationship (slight negative impact)
    if (opportunity.npcId) {
      relationshipTracker.recordInteraction(opportunity.npcId, 'declined_job', -2)
    }

    // Move to history
    this.archiveOpportunity(opportunityId)

    if (this.onOpportunityResolved) {
      this.onOpportunityResolved(opportunity, 'declined')
    }

    return {
      success: true,
      message: opportunity.details.declineMessage || 'Opportunity declined.',
      opportunity
    }
  }

  /**
   * Handle job acceptance
   */
  handleJobAccept(opportunity) {
    // Start the job - could trigger a minigame, adventure, or immediate action
    const jobDetails = opportunity.details

    if (jobDetails.immediate) {
      // Immediate reward/consequence
      this.applyConsequences(opportunity.rewards)
      this.applyConsequences(opportunity.risks, true)
      this.completeOpportunity(opportunity.id)
      return jobDetails.successMessage || 'Job completed.'
    }

    // Otherwise, job is in progress
    return opportunity.details.acceptMessage ||
      `[${opportunity.npcName}] "Good. Let me know when you're ready."`
  }

  /**
   * Handle trade acceptance
   */
  handleTradeAccept(opportunity) {
    const player = gameManager.player
    const trade = opportunity.details

    // Check if player can afford (for buy trades)
    if (trade.cost && player.cash < trade.cost) {
      return {
        success: false,
        error: `Not enough cash. Need $${trade.cost}, you have $${player.cash}.`
      }
    }

    // Execute trade
    if (trade.cost) {
      gameManager.updatePlayerCash(-trade.cost)
    }
    if (trade.gain) {
      gameManager.updatePlayerCash(trade.gain)
    }

    this.completeOpportunity(opportunity.id)

    return {
      success: true,
      message: trade.successMessage || 'Trade completed.',
      opportunity
    }
  }

  /**
   * Handle alliance acceptance
   */
  handleAllianceAccept(opportunity) {
    const npcId = opportunity.npcId

    if (npcId) {
      relationshipTracker.formAlliance(npcId)
    }

    this.completeOpportunity(opportunity.id)

    return opportunity.details.acceptMessage ||
      `Alliance formed with ${opportunity.npcName}.`
  }

  /**
   * Apply consequences (rewards or risks)
   */
  applyConsequences(consequences, isRisk = false) {
    if (!consequences) return

    const player = gameManager.player
    if (!player) return

    if (consequences.cash) {
      const amount = isRisk ? -Math.abs(consequences.cash) : consequences.cash
      gameManager.updatePlayerCash(amount)
      // Play audio feedback for cash changes
      if (amount > 0) {
        audioManager.playCashGain(amount)
      }
    }

    if (consequences.heat) {
      const amount = isRisk ? Math.abs(consequences.heat) : consequences.heat
      gameManager.updatePlayerHeat(amount)
    }

    if (consequences.xp) {
      gameManager.addExperience(consequences.xp)
      // Play level up sound if XP is significant
      if (consequences.xp >= 50) {
        audioManager.playAchievement()
      }
    }

    if (consequences.respect) {
      const amount = isRisk ? -Math.abs(consequences.respect) : consequences.respect
      gameManager.updatePlayerRespect?.(amount)
    }
  }

  /**
   * Complete an opportunity successfully
   */
  completeOpportunity(opportunityId) {
    const opportunity = this.opportunities.get(opportunityId)
    if (!opportunity) return

    opportunity.state = OPPORTUNITY_STATES.COMPLETED
    opportunity.completedAt = Date.now()

    // Positive relationship impact
    if (opportunity.npcId) {
      relationshipTracker.recordInteraction(opportunity.npcId, 'completed_job', 10)
    }

    this.archiveOpportunity(opportunityId)
  }

  /**
   * Fail an opportunity
   */
  failOpportunity(opportunityId, reason = null) {
    const opportunity = this.opportunities.get(opportunityId)
    if (!opportunity) return

    opportunity.state = OPPORTUNITY_STATES.FAILED
    opportunity.failedAt = Date.now()
    opportunity.failReason = reason

    // Negative relationship impact
    if (opportunity.npcId) {
      relationshipTracker.recordInteraction(opportunity.npcId, 'failed_job', -15)
    }

    this.archiveOpportunity(opportunityId)
  }

  /**
   * Expire an opportunity
   */
  expireOpportunity(opportunityId) {
    const opportunity = this.opportunities.get(opportunityId)
    if (!opportunity) return

    opportunity.state = OPPORTUNITY_STATES.EXPIRED
    opportunity.expiredAt = Date.now()

    // Slight negative relationship impact for ignoring
    if (opportunity.npcId) {
      relationshipTracker.recordInteraction(opportunity.npcId, 'ignored', -5)
    }

    if (this.onOpportunityExpired) {
      this.onOpportunityExpired(opportunity)
    }

    this.archiveOpportunity(opportunityId)
  }

  /**
   * Archive an opportunity to history
   */
  archiveOpportunity(opportunityId) {
    const opportunity = this.opportunities.get(opportunityId)
    if (!opportunity) return

    this.opportunityHistory.push(opportunity)

    // Keep history limited
    if (this.opportunityHistory.length > 100) {
      this.opportunityHistory = this.opportunityHistory.slice(-100)
    }

    this.opportunities.delete(opportunityId)
    this.saveState()
  }

  /**
   * Get all pending opportunities
   */
  getPendingOpportunities() {
    const pending = []
    for (const opp of this.opportunities.values()) {
      if (opp.state === OPPORTUNITY_STATES.PENDING) {
        // Check expiry
        if (Date.now() > opp.expiresAt) {
          this.expireOpportunity(opp.id)
        } else {
          pending.push(opp)
        }
      }
    }
    return pending.sort((a, b) => a.createdAt - b.createdAt)
  }

  /**
   * Get opportunity by ID
   */
  getOpportunity(id) {
    return this.opportunities.get(id) || null
  }

  /**
   * Get opportunity by index (1-based for user convenience)
   */
  getOpportunityByIndex(index) {
    const pending = this.getPendingOpportunities()
    return pending[index - 1] || null
  }

  /**
   * Notify terminal of new opportunity
   */
  notifyTerminal(opportunity) {
    if (!terminalManager) return

    const expiryMins = Math.round((opportunity.expiresAt - Date.now()) / 60000)

    const notification = [
      `:: NEW OPPORTUNITY ::`,
      `[${opportunity.npcName}] ${opportunity.shortMessage}`,
      `Expires in ${expiryMins} minutes`,
      `Type 'opportunities' to view, 'respond ${this.getOpportunityIndex(opportunity.id)}' to respond`
    ]

    notification.forEach(line => {
      terminalManager.addOutput(line, OUTPUT_TYPES.SYSTEM)
    })
  }

  /**
   * Get index of an opportunity
   */
  getOpportunityIndex(opportunityId) {
    const pending = this.getPendingOpportunities()
    const index = pending.findIndex(o => o.id === opportunityId)
    return index + 1
  }

  /**
   * Format opportunities for terminal display
   */
  formatOpportunitiesForTerminal() {
    const pending = this.getPendingOpportunities()

    if (pending.length === 0) {
      return ['No active opportunities right now.', 'Check back later or do some jobs to attract attention.']
    }

    const lines = [':: ACTIVE OPPORTUNITIES ::']

    pending.forEach((opp, index) => {
      const expiryMins = Math.round((opp.expiresAt - Date.now()) / 60000)
      const typeLabel = this.getTypeLabel(opp.type)

      lines.push(``)
      lines.push(`[${index + 1}] ${opp.npcName.toUpperCase()} - ${typeLabel}`)
      lines.push(`    "${opp.message}"`)
      lines.push(`    Expires: ${expiryMins} minutes`)
      lines.push(`    Type: respond ${index + 1} yes/no`)
    })

    return lines
  }

  /**
   * Get human-readable type label
   */
  getTypeLabel(type) {
    const labels = {
      [OPPORTUNITY_TYPES.NPC_JOB]: 'Job Offer',
      [OPPORTUNITY_TYPES.TRADE_DEAL]: 'Trade Deal',
      [OPPORTUNITY_TYPES.ALLIANCE]: 'Alliance Request',
      [OPPORTUNITY_TYPES.ADVENTURE]: 'Adventure Hook',
      [OPPORTUNITY_TYPES.INTEL]: 'Intel Offer',
      [OPPORTUNITY_TYPES.FAVOR]: 'Favor Request',
    }
    return labels[type] || 'Opportunity'
  }

  /**
   * Generate a crime follow-up opportunity
   */
  generateCrimeFollowUp(crimeData) {
    const npcs = ['Marcus the Fixer', 'Nina', 'Sal', 'The Shadow']
    const npc = npcs[Math.floor(Math.random() * npcs.length)]

    this.createOpportunity({
      type: OPPORTUNITY_TYPES.NPC_JOB,
      npcId: npc.toLowerCase().replace(/\s/g, '_'),
      npcName: npc,
      title: 'Follow-up Job',
      message: `Good work on that last job. Got something bigger if you're interested.`,
      shortMessage: 'Got another job for you',
      rewards: { cash: 500 + Math.floor(Math.random() * 500), xp: 50 },
      risks: { heat: 10 + Math.floor(Math.random() * 20) },
    })
  }

  /**
   * Generate a milestone opportunity
   */
  generateMilestoneOpportunity(level) {
    const milestoneJobs = {
      5: { npc: 'The Recruiter', title: 'Crew Invitation', type: OPPORTUNITY_TYPES.ALLIANCE },
      10: { npc: 'The Fence', title: 'VIP Access', type: OPPORTUNITY_TYPES.TRADE_DEAL },
      15: { npc: 'The Shadow', title: 'High-Stakes Heist', type: OPPORTUNITY_TYPES.ADVENTURE },
      20: { npc: 'The Kingpin', title: 'An Audience', type: OPPORTUNITY_TYPES.NPC_JOB },
      25: { npc: 'The Council', title: 'Territory Offer', type: OPPORTUNITY_TYPES.ALLIANCE },
      30: { npc: 'The Legend', title: 'The Big One', type: OPPORTUNITY_TYPES.ADVENTURE },
    }

    const milestone = milestoneJobs[level]
    if (!milestone) return

    this.createOpportunity({
      type: milestone.type,
      npcId: milestone.npc.toLowerCase().replace(/\s/g, '_'),
      npcName: milestone.npc,
      title: milestone.title,
      message: `You've made a name for yourself. Level ${level}. Time to step up.`,
      shortMessage: milestone.title,
      expiryMs: 60 * 60 * 1000, // 1 hour for milestones
    })
  }

  /**
   * Generate a location-based opportunity
   */
  generateLocationOpportunity(district) {
    const locationOffers = {
      downtown: { npc: 'Street Vendor', message: 'Psst... got some goods, cheap.' },
      uptown: { npc: 'Wealthy Mark', message: 'Looking for someone discreet...' },
      industrial: { npc: 'Warehouse Boss', message: 'Need help with a shipment.' },
      waterfront: { npc: 'Dock Worker', message: 'Something valuable came in...' },
    }

    const offer = locationOffers[district?.toLowerCase()] || locationOffers.downtown

    this.createOpportunity({
      type: OPPORTUNITY_TYPES.TRADE_DEAL,
      npcId: offer.npc.toLowerCase().replace(/\s/g, '_'),
      npcName: offer.npc,
      title: 'Local Deal',
      message: offer.message,
      shortMessage: offer.message,
      expiryMs: 5 * 60 * 1000, // Quick 5 minute window
    })
  }

  /**
   * Generate a trade opportunity for rare items
   */
  generateTradeOpportunity(item) {
    this.createOpportunity({
      type: OPPORTUNITY_TYPES.TRADE_DEAL,
      npcId: 'collector',
      npcName: 'The Collector',
      title: 'Item Interest',
      message: `I hear you have a ${item.name}. I'll pay top dollar.`,
      shortMessage: 'Interested buyer',
      details: {
        item: item,
        offer: item.value * 1.5,
      },
    })
  }

  /**
   * Start expiry checker interval
   */
  startExpiryChecker() {
    // Check every 30 seconds for expired opportunities
    this.expiryInterval = setInterval(() => {
      const now = Date.now()
      for (const opp of this.opportunities.values()) {
        if (opp.state === OPPORTUNITY_STATES.PENDING && now > opp.expiresAt) {
          this.expireOpportunity(opp.id)
        }
      }
    }, 30000)
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      const state = {
        opportunities: Array.from(this.opportunities.entries()),
        opportunityHistory: this.opportunityHistory.slice(-50),
        nextId: this.nextId,
      }
      localStorage.setItem('street_legacy_opportunities', JSON.stringify(state))
    } catch (e) {
      console.warn('[OpportunityManager] Failed to save state:', e)
    }
  }

  /**
   * Load state from localStorage
   */
  loadState() {
    try {
      const saved = localStorage.getItem('street_legacy_opportunities')
      if (saved) {
        const state = JSON.parse(saved)
        this.opportunities = new Map(state.opportunities || [])
        this.opportunityHistory = state.opportunityHistory || []
        this.nextId = state.nextId || 1
      }
    } catch (e) {
      console.warn('[OpportunityManager] Failed to load state:', e)
    }
  }

  /**
   * Shutdown and cleanup
   */
  shutdown() {
    if (this.expiryInterval) {
      clearInterval(this.expiryInterval)
    }
    this.saveState()
    this.initialized = false
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      activeCount: this.opportunities.size,
      historyCount: this.opportunityHistory.length,
      pending: this.getPendingOpportunities().length,
    }
  }
}

// Singleton export
export const opportunityManager = new OpportunityManagerClass()
export default opportunityManager
