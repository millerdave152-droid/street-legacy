/**
 * TerminalNPCManager - Random NPC communications through the terminal
 *
 * NPCs can offer:
 * - Legitimate opportunities (jobs, tips, intel)
 * - Risky propositions (high reward, high risk)
 * - Scams (lose money if you accept)
 * - Favors (help them for reputation/future rewards)
 * - Warnings (free intel about threats)
 */

import { terminalManager, OUTPUT_TYPES } from './TerminalManager'
import { gameManager } from '../GameManager'

// Helper for random number between min and max
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

// NPC Archetypes
const NPC_TYPES = {
  FIXER: {
    name: 'Fixer',
    prefix: '[FIXER]',
    reliability: 0.85,
    color: 'handler',
    names: ['Marcus', 'The Connect', 'Ghost', 'Switchboard', 'Zero']
  },
  STREET_CONTACT: {
    name: 'Street Contact',
    prefix: '[CONTACT]',
    reliability: 0.7,
    color: 'system',
    names: ['Lil D', 'Shade', 'Rat', 'Whisper', 'Tracks']
  },
  HUSTLER: {
    name: 'Hustler',
    prefix: '[HUSTLER]',
    reliability: 0.5,
    color: 'warning',
    names: ['Slick', 'FastMoney', 'TwoFace', 'Snake', 'Dice']
  },
  ENFORCER: {
    name: 'Enforcer',
    prefix: '[ENFORCER]',
    reliability: 0.8,
    color: 'error',
    names: ['Hammer', 'Brick', 'Tank', 'Razor', 'Knuckles']
  },
  INFORMANT: {
    name: 'Informant',
    prefix: '[INFORMANT]',
    reliability: 0.6,
    color: 'sarah',
    names: ['Ears', 'Eyes', 'Snoop', 'Watcher', 'Mole']
  },
}

// Opportunity types
const OPPORTUNITY_TYPES = {
  LEGIT_JOB: 'legit_job',        // Safe, moderate reward
  RISKY_SCORE: 'risky_score',    // High reward, high risk
  QUICK_FLIP: 'quick_flip',      // Fast cash opportunity
  SCAM: 'scam',                  // Lose money
  FAVOR: 'favor',                // Help for future reward
  WARNING: 'warning',            // Free intel
  TIP: 'tip',                    // Helpful info
  TRADE_OFFER: 'trade_offer',    // Buy/sell opportunity
}

// Message templates
const OPPORTUNITY_TEMPLATES = {
  [OPPORTUNITY_TYPES.LEGIT_JOB]: [
    {
      message: "Got a clean job if you're interested. {reward} for an hour's work. No heat, no hassle. Reply 'accept' or 'decline'.",
      minReward: 200, maxReward: 800, energyCost: 15, successRate: 0.95
    },
    {
      message: "Need someone reliable for a pickup. {reward} on completion. Easy money. What do you say?",
      minReward: 300, maxReward: 600, energyCost: 10, successRate: 0.9
    },
    {
      message: "Client needs a driver for a few hours. {reward} cash. No questions asked. You in?",
      minReward: 400, maxReward: 1000, energyCost: 20, successRate: 0.85
    },
  ],
  [OPPORTUNITY_TYPES.RISKY_SCORE]: [
    {
      message: "Big score downtown. {reward} split if we pull it off. High risk though - you in?",
      minReward: 2000, maxReward: 5000, energyCost: 30, successRate: 0.5, heatGain: 25
    },
    {
      message: "Got intel on a warehouse. Could net {reward} but security's tight. Need an answer fast.",
      minReward: 3000, maxReward: 8000, energyCost: 40, successRate: 0.4, heatGain: 35
    },
    {
      message: "Once in a lifetime opportunity. {reward} guaranteed but we might have company. Reply now.",
      minReward: 5000, maxReward: 12000, energyCost: 35, successRate: 0.35, heatGain: 45
    },
  ],
  [OPPORTUNITY_TYPES.QUICK_FLIP]: [
    {
      message: "Got hot merchandise that needs to move. Give me {cost} now, you get {reward} in an hour.",
      minReward: 150, maxReward: 500, minCost: 100, maxCost: 300, successRate: 0.75
    },
    {
      message: "Buyer lined up for some goods. Need {cost} for the pickup, you'll double it. Quick turnaround.",
      minReward: 400, maxReward: 1200, minCost: 200, maxCost: 600, successRate: 0.7
    },
  ],
  [OPPORTUNITY_TYPES.SCAM]: [
    {
      message: "Yo I got a guaranteed thing. Just need {cost} upfront and you'll see {reward} by tomorrow. Trust me.",
      minCost: 500, maxCost: 2000, fakereward: 5000
    },
    {
      message: "My cousin has connects at the bank. Send {cost} and we split {reward}. This is real, I swear.",
      minCost: 1000, maxCost: 5000, fakereward: 20000
    },
    {
      message: "Found a glitch in the casino system. Need {cost} to exploit it, guaranteed {reward} return.",
      minCost: 800, maxCost: 3000, fakereward: 15000
    },
  ],
  [OPPORTUNITY_TYPES.FAVOR]: [
    {
      message: "Need a solid from you. Nothing dangerous, just need you to hold onto something for a few days. I'll owe you one.",
      reputationReward: 10, riskLevel: 'low'
    },
    {
      message: "Got beef with someone in your area. Need you to deliver a message. I'll remember this.",
      reputationReward: 25, riskLevel: 'medium', heatGain: 10
    },
  ],
  [OPPORTUNITY_TYPES.WARNING]: [
    { message: "Heads up - cops are running a sweep in your district. Might want to lay low." },
    { message: "Word on the street is someone's been asking about you. Watch your back." },
    { message: "Just heard the heat's looking at runners in your area. Be careful out there." },
    { message: "Friendly warning - don't trust anyone offering 'guaranteed' money today. Scammers everywhere." },
  ],
  [OPPORTUNITY_TYPES.TIP]: [
    { message: "Pro tip: The pawn shop in Kensington pays 20% more after midnight." },
    { message: "FYI - Car theft pays best in Yorkville. Rich targets, less security." },
    { message: "Word of advice: Bank your cash when heat's low. You'll thank me later." },
    { message: "Heard the corner store in Parkdale restocks on Tuesdays. Easy pickings." },
  ],
}

// Pending opportunity tracker
let pendingOpportunity = null

class TerminalNPCManager {
  constructor() {
    this.isInitialized = false
    this.lastMessageTime = 0
    this.minInterval = 3 * 60 * 1000  // Minimum 3 minutes between messages
    this.maxInterval = 10 * 60 * 1000 // Maximum 10 minutes between messages
    this.nextMessageTime = 0
    this.messagesSent = 0
    this.opportunitiesTaken = 0
    this.scamsAvoided = 0
    this.scamsFallenFor = 0
  }

  /**
   * Initialize the NPC manager
   */
  initialize() {
    if (this.isInitialized) return

    // Schedule first message after a delay
    this.scheduleNextMessage()

    // Check periodically for message delivery
    this.checkInterval = setInterval(() => {
      this.checkAndDeliverMessage()
    }, 30000) // Check every 30 seconds

    // Register terminal commands for responding to offers
    this.registerCommands()

    this.isInitialized = true
    console.log('[TerminalNPCManager] Initialized')
  }

  /**
   * Schedule the next random NPC message
   */
  scheduleNextMessage() {
    const delay = randomBetween(this.minInterval, this.maxInterval)
    this.nextMessageTime = Date.now() + delay
    console.log(`[TerminalNPCManager] Next message in ${Math.round(delay / 1000)}s`)
  }

  /**
   * Check if it's time to deliver a message
   */
  checkAndDeliverMessage() {
    if (!this.isInitialized) return
    if (Date.now() < this.nextMessageTime) return
    if (pendingOpportunity) return // Wait for response to current opportunity

    this.deliverRandomMessage()
    this.scheduleNextMessage()
  }

  /**
   * Force a message delivery (for testing or events)
   */
  forceMessage(type = null) {
    this.deliverRandomMessage(type)
  }

  /**
   * Deliver a random NPC message to the terminal
   */
  deliverRandomMessage(forcedType = null) {
    const player = gameManager.player
    if (!player) return

    // Choose opportunity type based on player state and randomness
    const type = forcedType || this.chooseOpportunityType(player)
    const npc = this.chooseNPC(type)
    const opportunity = this.generateOpportunity(type, player, npc)

    if (!opportunity) return

    // Deliver to terminal
    this.deliverToTerminal(opportunity, npc)
    this.messagesSent++

    // Store pending opportunity if it requires a response
    if (opportunity.requiresResponse) {
      pendingOpportunity = opportunity
    }
  }

  /**
   * Choose what type of opportunity to offer based on player state
   */
  chooseOpportunityType(player) {
    const roll = Math.random()
    const playerLevel = player.level || 1

    // Scam chance increases if player has lots of cash
    if (player.cash > 5000 && roll < 0.15) {
      return OPPORTUNITY_TYPES.SCAM
    }

    // Warning if heat is high
    if (player.heat > 50 && roll < 0.3) {
      return OPPORTUNITY_TYPES.WARNING
    }

    // Tips for newer players
    if (playerLevel < 5 && roll < 0.4) {
      return OPPORTUNITY_TYPES.TIP
    }

    // Weighted random selection for others
    const weights = {
      [OPPORTUNITY_TYPES.LEGIT_JOB]: 0.3,
      [OPPORTUNITY_TYPES.RISKY_SCORE]: playerLevel >= 5 ? 0.15 : 0.05,
      [OPPORTUNITY_TYPES.QUICK_FLIP]: 0.2,
      [OPPORTUNITY_TYPES.FAVOR]: 0.1,
      [OPPORTUNITY_TYPES.WARNING]: 0.1,
      [OPPORTUNITY_TYPES.TIP]: 0.15,
    }

    let cumulative = 0
    for (const [type, weight] of Object.entries(weights)) {
      cumulative += weight
      if (roll < cumulative) return type
    }

    return OPPORTUNITY_TYPES.TIP
  }

  /**
   * Choose which NPC archetype sends the message
   */
  chooseNPC(opportunityType) {
    const npcMappings = {
      [OPPORTUNITY_TYPES.LEGIT_JOB]: [NPC_TYPES.FIXER, NPC_TYPES.STREET_CONTACT],
      [OPPORTUNITY_TYPES.RISKY_SCORE]: [NPC_TYPES.FIXER, NPC_TYPES.ENFORCER],
      [OPPORTUNITY_TYPES.QUICK_FLIP]: [NPC_TYPES.HUSTLER, NPC_TYPES.STREET_CONTACT],
      [OPPORTUNITY_TYPES.SCAM]: [NPC_TYPES.HUSTLER],
      [OPPORTUNITY_TYPES.FAVOR]: [NPC_TYPES.ENFORCER, NPC_TYPES.STREET_CONTACT],
      [OPPORTUNITY_TYPES.WARNING]: [NPC_TYPES.INFORMANT, NPC_TYPES.STREET_CONTACT],
      [OPPORTUNITY_TYPES.TIP]: [NPC_TYPES.INFORMANT, NPC_TYPES.FIXER],
    }

    const options = npcMappings[opportunityType] || [NPC_TYPES.STREET_CONTACT]
    const npcType = options[Math.floor(Math.random() * options.length)]
    const name = npcType.names[Math.floor(Math.random() * npcType.names.length)]

    return {
      ...npcType,
      displayName: name
    }
  }

  /**
   * Generate a specific opportunity
   */
  generateOpportunity(type, player, npc) {
    const templates = OPPORTUNITY_TEMPLATES[type]
    if (!templates || templates.length === 0) return null

    const template = templates[Math.floor(Math.random() * templates.length)]
    const opportunity = { ...template, type, npc }

    // Calculate rewards/costs based on player level
    const levelMult = 1 + (player.level - 1) * 0.1

    if (template.minReward !== undefined) {
      opportunity.reward = Math.floor(
        randomBetween(template.minReward, template.maxReward) * levelMult
      )
      opportunity.message = template.message.replace('{reward}', `$${opportunity.reward.toLocaleString()}`)
    }

    if (template.minCost !== undefined) {
      opportunity.cost = Math.floor(
        randomBetween(template.minCost, template.maxCost) * levelMult
      )
      opportunity.message = opportunity.message.replace('{cost}', `$${opportunity.cost.toLocaleString()}`)
    }

    if (template.fakereward !== undefined) {
      opportunity.message = opportunity.message.replace('{reward}', `$${template.fakereward.toLocaleString()}`)
    }

    // Determine if this requires a response
    opportunity.requiresResponse = [
      OPPORTUNITY_TYPES.LEGIT_JOB,
      OPPORTUNITY_TYPES.RISKY_SCORE,
      OPPORTUNITY_TYPES.QUICK_FLIP,
      OPPORTUNITY_TYPES.SCAM,
      OPPORTUNITY_TYPES.FAVOR
    ].includes(type)

    return opportunity
  }

  /**
   * Deliver opportunity to terminal
   */
  deliverToTerminal(opportunity, npc) {
    if (!terminalManager) return

    const prefix = `${npc.prefix} ${npc.displayName}`

    // Add a notification sound or visual
    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`:: INCOMING MESSAGE ::`, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`${prefix}: ${opportunity.message}`, OUTPUT_TYPES[npc.color.toUpperCase()] || OUTPUT_TYPES.HANDLER)

    if (opportunity.requiresResponse) {
      terminalManager.addOutput(`:: Type 'accept' or 'decline' to respond`, OUTPUT_TYPES.SYSTEM)
    }
  }

  /**
   * Register terminal commands for responding
   */
  registerCommands() {
    // These will be handled by the CommandRegistry
    // For now, we'll hook into the terminal input processing
  }

  /**
   * Handle player accepting an opportunity
   */
  handleAccept() {
    if (!pendingOpportunity) {
      return { error: true, message: "No pending offer to accept." }
    }

    const opp = pendingOpportunity
    const player = gameManager.player
    const result = { output: [] }

    switch (opp.type) {
      case OPPORTUNITY_TYPES.LEGIT_JOB:
        result.output = this.processLegitJob(opp, player)
        break

      case OPPORTUNITY_TYPES.RISKY_SCORE:
        result.output = this.processRiskyScore(opp, player)
        break

      case OPPORTUNITY_TYPES.QUICK_FLIP:
        result.output = this.processQuickFlip(opp, player)
        break

      case OPPORTUNITY_TYPES.SCAM:
        result.output = this.processScam(opp, player)
        break

      case OPPORTUNITY_TYPES.FAVOR:
        result.output = this.processFavor(opp, player)
        break

      default:
        result.output = [{ text: "Opportunity no longer available.", type: 'error' }]
    }

    this.opportunitiesTaken++
    pendingOpportunity = null
    return result
  }

  /**
   * Handle player declining an opportunity
   */
  handleDecline() {
    if (!pendingOpportunity) {
      return { error: true, message: "No pending offer to decline." }
    }

    const opp = pendingOpportunity
    const npc = opp.npc

    // Track if they avoided a scam
    if (opp.type === OPPORTUNITY_TYPES.SCAM) {
      this.scamsAvoided++
    }

    pendingOpportunity = null

    const declineResponses = [
      `${npc.prefix} ${npc.displayName}: Your loss. Don't come crying when you need work.`,
      `${npc.prefix} ${npc.displayName}: Alright, maybe next time.`,
      `${npc.prefix} ${npc.displayName}: Suit yourself.`,
      `${npc.prefix} ${npc.displayName}: Fine. I'll find someone else.`,
    ]

    return {
      output: [{
        text: declineResponses[Math.floor(Math.random() * declineResponses.length)],
        type: 'handler'
      }]
    }
  }

  /**
   * Process a legit job opportunity
   */
  processLegitJob(opp, player) {
    const success = Math.random() < opp.successRate

    if (player.energy < (opp.energyCost || 10)) {
      return [{ text: `[${opp.npc.displayName}] You look too tired for this. Get some rest first.`, type: 'warning' }]
    }

    // Deduct energy
    gameManager.updatePlayer({ energy: player.energy - (opp.energyCost || 10) })

    if (success) {
      gameManager.updatePlayer({ cash: player.cash + opp.reward })
      return [
        { text: `:: JOB COMPLETE ::`, type: 'system' },
        { text: `[${opp.npc.displayName}] Good work. Here's your cut: $${opp.reward.toLocaleString()}`, type: 'success' },
        { text: `Cash +$${opp.reward.toLocaleString()}`, type: 'success' }
      ]
    } else {
      return [
        { text: `:: JOB FAILED ::`, type: 'system' },
        { text: `[${opp.npc.displayName}] Things went sideways. No pay this time.`, type: 'error' }
      ]
    }
  }

  /**
   * Process a risky score opportunity
   */
  processRiskyScore(opp, player) {
    const success = Math.random() < opp.successRate

    if (player.energy < (opp.energyCost || 30)) {
      return [{ text: `[${opp.npc.displayName}] You need more energy for a job like this.`, type: 'warning' }]
    }

    // Deduct energy
    gameManager.updatePlayer({ energy: player.energy - (opp.energyCost || 30) })

    if (success) {
      const heatGain = opp.heatGain || 20
      gameManager.updatePlayer({
        cash: player.cash + opp.reward,
        heat: Math.min(100, player.heat + heatGain)
      })
      return [
        { text: `:: SCORE SUCCESSFUL ::`, type: 'system' },
        { text: `[${opp.npc.displayName}] We did it! Your cut: $${opp.reward.toLocaleString()}`, type: 'success' },
        { text: `Cash +$${opp.reward.toLocaleString()} | Heat +${heatGain}%`, type: 'warning' }
      ]
    } else {
      const heatGain = Math.floor((opp.heatGain || 20) * 1.5)
      gameManager.updatePlayer({
        heat: Math.min(100, player.heat + heatGain)
      })
      return [
        { text: `:: SCORE FAILED ::`, type: 'system' },
        { text: `[${opp.npc.displayName}] Damn! Cops showed up. We had to bail.`, type: 'error' },
        { text: `Heat +${heatGain}%`, type: 'error' }
      ]
    }
  }

  /**
   * Process a quick flip opportunity
   */
  processQuickFlip(opp, player) {
    if (player.cash < opp.cost) {
      return [{ text: `[${opp.npc.displayName}] You don't have enough cash for this.`, type: 'error' }]
    }

    const success = Math.random() < opp.successRate

    // Deduct cost upfront
    gameManager.updatePlayer({ cash: player.cash - opp.cost })

    if (success) {
      gameManager.updatePlayer({ cash: player.cash - opp.cost + opp.reward })
      const profit = opp.reward - opp.cost
      return [
        { text: `:: FLIP SUCCESSFUL ::`, type: 'system' },
        { text: `[${opp.npc.displayName}] Buyer paid up. Here's your profit: $${profit.toLocaleString()}`, type: 'success' },
        { text: `Net profit: +$${profit.toLocaleString()}`, type: 'success' }
      ]
    } else {
      return [
        { text: `:: FLIP FAILED ::`, type: 'system' },
        { text: `[${opp.npc.displayName}] Buyer backed out. Sorry, I can't refund you.`, type: 'error' },
        { text: `Lost: -$${opp.cost.toLocaleString()}`, type: 'error' }
      ]
    }
  }

  /**
   * Process a scam (player loses money)
   */
  processScam(opp, player) {
    if (player.cash < opp.cost) {
      return [{ text: `[${opp.npc.displayName}] You don't have enough... never mind then.`, type: 'error' }]
    }

    // Take the money
    gameManager.updatePlayer({ cash: player.cash - opp.cost })
    this.scamsFallenFor++

    return [
      { text: `:: TRANSACTION COMPLETE ::`, type: 'system' },
      { text: `[${opp.npc.displayName}] Thanks! You'll see that money soon, I promise...`, type: 'handler' },
      { text: `...`, type: 'response' },
      { text: `:: ${opp.npc.displayName} has gone offline ::`, type: 'error' },
      { text: `You got scammed. Lost: -$${opp.cost.toLocaleString()}`, type: 'error' }
    ]
  }

  /**
   * Process a favor request
   */
  processFavor(opp, player) {
    const heatGain = opp.heatGain || 0
    const repGain = opp.reputationReward || 10

    if (heatGain > 0) {
      gameManager.updatePlayer({ heat: Math.min(100, player.heat + heatGain) })
    }
    gameManager.updatePlayer({ respect: (player.respect || 0) + repGain })

    return [
      { text: `:: FAVOR COMPLETED ::`, type: 'system' },
      { text: `[${opp.npc.displayName}] I owe you one. Won't forget this.`, type: 'success' },
      { text: `Respect +${repGain}${heatGain > 0 ? ` | Heat +${heatGain}%` : ''}`, type: 'success' }
    ]
  }

  /**
   * Check if there's a pending opportunity
   */
  hasPendingOpportunity() {
    return pendingOpportunity !== null
  }

  /**
   * Get stats for debugging
   */
  getStats() {
    return {
      messagesSent: this.messagesSent,
      opportunitiesTaken: this.opportunitiesTaken,
      scamsAvoided: this.scamsAvoided,
      scamsFallenFor: this.scamsFallenFor,
      hasPending: this.hasPendingOpportunity()
    }
  }

  /**
   * Shutdown the manager
   */
  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.isInitialized = false
    pendingOpportunity = null
    console.log('[TerminalNPCManager] Shutdown')
  }
}

// Singleton instance
export const terminalNPCManager = new TerminalNPCManager()

export default terminalNPCManager
