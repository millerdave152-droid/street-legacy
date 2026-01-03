/**
 * TerminalNPCManager - Named NPC communications through the terminal
 *
 * Features:
 * - 10 unique named NPCs with distinct personalities
 * - Heat-based message filtering (NPCs go silent at high heat)
 * - Block/unblock contacts
 * - Detective Morgan police trap at high heat
 * - Betrayal mechanics (Rat)
 *
 * NPCs can offer:
 * - Intel (tips, warnings, schedules)
 * - Deals (buy/sell opportunities)
 * - Jobs (crew missions, heists)
 * - Scams (lose money if you accept)
 * - Warnings (free intel about threats)
 * - Betrayals (snitch mechanics)
 */

import { terminalManager, OUTPUT_TYPES } from './TerminalManager'
import { gameManager } from '../GameManager'
import { opportunityManager, OPPORTUNITY_TYPES as OPP_TYPES } from '../opportunity/OpportunityManager'
import {
  NPC_CONTACTS,
  NPC_ROLES,
  getContactById,
  getContactByName,
  getAvailableContacts,
  isContactSilent,
  getRandomMessage,
  buildNPCMessage
} from '../data/NPCContacts'

// Helper for random number between min and max
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

// LocalStorage keys
const STORAGE_KEYS = {
  BLOCKED_CONTACTS: 'street_legacy_blocked_contacts',
  NPC_MESSAGE_COUNTS: 'street_legacy_npc_message_counts',
  LAST_MESSAGE_TIMES: 'street_legacy_last_message_times'
}

// Legacy NPC Archetypes (kept for backwards compatibility)
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

// NOTE: pendingOpportunity removed - now uses OpportunityManager

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

    // Named NPC tracking
    this.blockedContacts = new Set()
    this.npcMessageCounts = {} // Track messages per NPC per day
    this.lastMessageByNPC = {} // Track last message time per NPC
    this.useNamedNPCs = true   // Toggle for new system

    // Load persisted state
    this.loadPersistedState()
  }

  /**
   * Load blocked contacts and message counts from localStorage
   */
  loadPersistedState() {
    try {
      const blocked = localStorage.getItem(STORAGE_KEYS.BLOCKED_CONTACTS)
      if (blocked) {
        this.blockedContacts = new Set(JSON.parse(blocked))
      }

      const counts = localStorage.getItem(STORAGE_KEYS.NPC_MESSAGE_COUNTS)
      if (counts) {
        const data = JSON.parse(counts)
        // Reset if it's a new day
        const today = new Date().toDateString()
        if (data.date === today) {
          this.npcMessageCounts = data.counts || {}
        }
      }

      const lastTimes = localStorage.getItem(STORAGE_KEYS.LAST_MESSAGE_TIMES)
      if (lastTimes) {
        this.lastMessageByNPC = JSON.parse(lastTimes)
      }
    } catch (e) {
      console.error('[TerminalNPCManager] Error loading persisted state:', e)
    }
  }

  /**
   * Save state to localStorage
   */
  savePersistedState() {
    try {
      localStorage.setItem(
        STORAGE_KEYS.BLOCKED_CONTACTS,
        JSON.stringify([...this.blockedContacts])
      )

      localStorage.setItem(
        STORAGE_KEYS.NPC_MESSAGE_COUNTS,
        JSON.stringify({
          date: new Date().toDateString(),
          counts: this.npcMessageCounts
        })
      )

      localStorage.setItem(
        STORAGE_KEYS.LAST_MESSAGE_TIMES,
        JSON.stringify(this.lastMessageByNPC)
      )
    } catch (e) {
      console.error('[TerminalNPCManager] Error saving state:', e)
    }
  }

  // ============================================================
  // CONTACT MANAGEMENT
  // ============================================================

  /**
   * Block a contact from sending messages
   */
  blockContact(contactId) {
    const contact = getContactById(contactId) || getContactByName(contactId)
    if (!contact) {
      return { success: false, error: `Unknown contact: ${contactId}` }
    }

    this.blockedContacts.add(contact.id)
    this.savePersistedState()
    return {
      success: true,
      message: `Blocked ${contact.name}. You won't receive messages from them.`
    }
  }

  /**
   * Unblock a contact
   */
  unblockContact(contactId) {
    const contact = getContactById(contactId) || getContactByName(contactId)
    if (!contact) {
      return { success: false, error: `Unknown contact: ${contactId}` }
    }

    if (!this.blockedContacts.has(contact.id)) {
      return { success: false, error: `${contact.name} is not blocked.` }
    }

    this.blockedContacts.delete(contact.id)
    this.savePersistedState()
    return {
      success: true,
      message: `Unblocked ${contact.name}. They can message you again.`
    }
  }

  /**
   * Get all blocked contacts
   */
  getBlockedContacts() {
    return [...this.blockedContacts].map(id => getContactById(id)).filter(Boolean)
  }

  /**
   * Check if a contact is blocked
   */
  isContactBlocked(contactId) {
    return this.blockedContacts.has(contactId)
  }

  /**
   * Get all contacts with their status
   */
  getAllContactsWithStatus(player) {
    const playerLevel = player?.level || 1
    const playerHeat = player?.heat || 0

    return Object.values(NPC_CONTACTS).map(contact => ({
      ...contact,
      isBlocked: this.blockedContacts.has(contact.id),
      isUnlocked: !contact.minLevel || playerLevel >= contact.minLevel,
      isSilent: isContactSilent(contact.id, playerHeat),
      messagestoday: this.npcMessageCounts[contact.id] || 0
    }))
  }

  /**
   * Check if NPC can send a message (rate limiting, heat, etc.)
   */
  canNPCSendMessage(contact, player) {
    // Check if blocked
    if (this.blockedContacts.has(contact.id)) {
      return false
    }

    // Check level requirement
    if (contact.minLevel && (player?.level || 1) < contact.minLevel) {
      return false
    }

    // Check heat-based silence
    if (isContactSilent(contact.id, player?.heat || 0)) {
      return false
    }

    // Check daily message limit
    const todayCount = this.npcMessageCounts[contact.id] || 0
    if (todayCount >= contact.maxMessagesPerDay) {
      return false
    }

    // Check per-NPC cooldown
    const lastTime = this.lastMessageByNPC[contact.id] || 0
    const minCooldown = contact.messageFrequency?.min || 180000
    if (Date.now() - lastTime < minCooldown) {
      return false
    }

    return true
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

    // Check if we already have too many pending opportunities
    const pendingCount = opportunityManager.getPendingOpportunities().length
    if (pendingCount >= 3) return // Max 3 pending at a time

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
   * Routes opportunities through the unified OpportunityManager
   */
  deliverRandomMessage(forcedType = null) {
    const player = gameManager.player
    if (!player) return

    // Choose opportunity type based on player state and randomness
    const type = forcedType || this.chooseOpportunityType(player)
    const npc = this.chooseNPC(type)
    const opportunity = this.generateOpportunity(type, player, npc)

    if (!opportunity) return

    this.messagesSent++

    // For opportunities that require response, route through OpportunityManager
    if (opportunity.requiresResponse) {
      // Map local type to OpportunityManager type
      const oppTypeMap = {
        [OPPORTUNITY_TYPES.LEGIT_JOB]: OPP_TYPES.NPC_JOB,
        [OPPORTUNITY_TYPES.RISKY_SCORE]: OPP_TYPES.NPC_JOB,
        [OPPORTUNITY_TYPES.QUICK_FLIP]: OPP_TYPES.TRADE_DEAL,
        [OPPORTUNITY_TYPES.SCAM]: OPP_TYPES.TRADE_DEAL,
        [OPPORTUNITY_TYPES.FAVOR]: OPP_TYPES.FAVOR,
      }

      opportunityManager.createOpportunity({
        type: oppTypeMap[type] || OPP_TYPES.NPC_JOB,
        npcId: `npc_${npc.displayName.toLowerCase().replace(/\s/g, '_')}`,
        npcName: `${npc.displayName} ${npc.prefix}`.trim(),
        title: this.getOpportunityTitle(type),
        message: opportunity.message,
        shortMessage: opportunity.message.substring(0, 60) + '...',
        details: {
          originalType: type,
          reward: opportunity.reward,
          cost: opportunity.cost,
          energyCost: opportunity.energyCost,
          successRate: opportunity.successRate,
          heatGain: opportunity.heatGain,
          reputationReward: opportunity.reputationReward,
          npc: npc,
          immediate: true,  // Resolve immediately on accept
        },
        rewards: {
          cash: opportunity.reward || 0,
          respect: opportunity.reputationReward || 0,
        },
        risks: {
          heat: opportunity.heatGain || 0,
          cost: opportunity.cost || 0,
        },
      })
    } else {
      // Non-response messages (warnings, tips) go directly to terminal
      this.deliverToTerminal(opportunity, npc)
    }
  }

  /**
   * Get a title for opportunity type
   */
  getOpportunityTitle(type) {
    const titles = {
      [OPPORTUNITY_TYPES.LEGIT_JOB]: 'Job Offer',
      [OPPORTUNITY_TYPES.RISKY_SCORE]: 'High-Risk Score',
      [OPPORTUNITY_TYPES.QUICK_FLIP]: 'Quick Flip Deal',
      [OPPORTUNITY_TYPES.SCAM]: 'Investment Opportunity',
      [OPPORTUNITY_TYPES.FAVOR]: 'Favor Request',
    }
    return titles[type] || 'Opportunity'
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
   * Uses named NPCs if enabled, falls back to legacy system
   */
  chooseNPC(opportunityType) {
    const player = gameManager.player

    // Use named NPC system if enabled
    if (this.useNamedNPCs) {
      const namedNPC = this.chooseNamedNPC(opportunityType, player)
      if (namedNPC) {
        return namedNPC
      }
    }

    // Fallback to legacy system
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
   * Choose a named NPC based on opportunity type and player state
   */
  chooseNamedNPC(opportunityType, player) {
    const heat = player?.heat || 0
    const level = player?.level || 1

    // Detective Morgan trap at high heat
    if (heat >= 50 && Math.random() < 0.25) {
      const morgan = NPC_CONTACTS.detective_morgan
      if (this.canNPCSendMessage(morgan, player)) {
        return this.formatNamedNPC(morgan)
      }
    }

    // Map opportunity types to named NPCs
    const npcMappings = {
      [OPPORTUNITY_TYPES.LEGIT_JOB]: ['snoop', 'the_connect', 'scarlett'],
      [OPPORTUNITY_TYPES.RISKY_SCORE]: ['the_connect', 'scarlett', 'the_architect'],
      [OPPORTUNITY_TYPES.QUICK_FLIP]: ['silkroad', 'ironman'],
      [OPPORTUNITY_TYPES.SCAM]: ['ironman', 'rat'],
      [OPPORTUNITY_TYPES.FAVOR]: ['scarlett', 'snoop'],
      [OPPORTUNITY_TYPES.WARNING]: ['watcher', 'snoop', 'rat'],
      [OPPORTUNITY_TYPES.TIP]: ['snoop', 'watcher'],
      [OPPORTUNITY_TYPES.TRADE_OFFER]: ['silkroad', 'the_pharmacist'],
    }

    const candidateIds = npcMappings[opportunityType] || ['snoop']
    const availableCandidates = candidateIds
      .map(id => NPC_CONTACTS[id])
      .filter(npc => npc && this.canNPCSendMessage(npc, player))

    if (availableCandidates.length === 0) {
      return null
    }

    // Randomly select from available candidates
    const selected = availableCandidates[Math.floor(Math.random() * availableCandidates.length)]
    return this.formatNamedNPC(selected)
  }

  /**
   * Format a named NPC for use with existing opportunity system
   */
  formatNamedNPC(contact) {
    // Track this NPC's message
    this.npcMessageCounts[contact.id] = (this.npcMessageCounts[contact.id] || 0) + 1
    this.lastMessageByNPC[contact.id] = Date.now()
    this.savePersistedState()

    return {
      ...contact,
      displayName: contact.name,
      prefix: contact.displayPrefix,
      reliability: contact.reliability,
      color: this.getColorForContact(contact),
      isNamedNPC: true
    }
  }

  /**
   * Get OUTPUT_TYPE color key for a contact
   */
  getColorForContact(contact) {
    // Map contact roles to output colors
    const colorMap = {
      'FIXER': 'handler',
      'INTEL': 'sarah',
      'BROKER': 'handler',
      'HUSTLER': 'warning',
      'SUPPLIER': 'success',
      'SPECIALIST': 'handler',
      'CREW': 'error',
      'MASTERMIND': 'warning',
      'UNDERCOVER': 'system', // Looks innocent
      'SNITCH': 'system'
    }
    return colorMap[contact.role] || 'handler'
  }

  /**
   * Send a message from a specific named NPC
   */
  sendNamedNPCMessage(contactId, messageType, customMessage = null) {
    const contact = getContactById(contactId) || getContactByName(contactId)
    if (!contact) {
      console.error(`[TerminalNPCManager] Unknown contact: ${contactId}`)
      return false
    }

    const player = gameManager.player
    if (!this.canNPCSendMessage(contact, player)) {
      console.log(`[TerminalNPCManager] ${contact.name} cannot send message right now`)
      return false
    }

    const message = customMessage || getRandomMessage(contact.id, messageType)
    if (!message) {
      console.error(`[TerminalNPCManager] No message template for ${contact.name}/${messageType}`)
      return false
    }

    // Track the message
    this.npcMessageCounts[contact.id] = (this.npcMessageCounts[contact.id] || 0) + 1
    this.lastMessageByNPC[contact.id] = Date.now()
    this.savePersistedState()

    // Deliver to terminal
    const fullMessage = buildNPCMessage(contact.id, messageType, message)
    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`:: INCOMING MESSAGE ::`, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`${contact.displayPrefix} ${contact.name}:`, OUTPUT_TYPES[this.getColorForContact(contact).toUpperCase()] || OUTPUT_TYPES.HANDLER)
    terminalManager.addOutput(fullMessage, OUTPUT_TYPES.RESPONSE)

    this.messagesSent++
    return true
  }

  /**
   * Trigger a betrayal event from Rat
   */
  triggerBetrayalEvent() {
    const rat = NPC_CONTACTS.rat
    const player = gameManager.player

    if (!player || this.blockedContacts.has(rat.id)) {
      return false
    }

    const templates = rat.messageTemplates.BETRAYALS
    const message = templates[Math.floor(Math.random() * templates.length)]

    terminalManager.addOutput(``, OUTPUT_TYPES.ERROR)
    terminalManager.addOutput(`:: URGENT MESSAGE ::`, OUTPUT_TYPES.ERROR)
    terminalManager.addOutput(`${rat.displayPrefix} ${rat.name}: ${message}`, OUTPUT_TYPES.ERROR)
    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`:: RESPOND: 'hide stash' | 'flee' | 'retaliate'`, OUTPUT_TYPES.SYSTEM)

    // Create urgent opportunity
    opportunityManager.createOpportunity({
      type: OPP_TYPES.NPC_JOB,
      npcId: rat.id,
      npcName: `${rat.name} ${rat.displayPrefix}`,
      title: 'BETRAYAL',
      message: message,
      shortMessage: 'Rat sold you out!',
      details: {
        originalType: 'BETRAYAL',
        urgent: true,
        isBetrayalEvent: true,
        npc: rat
      },
      rewards: {},
      risks: { heat: 30 },
      expiryMs: 3 * 60 * 1000 // 3 minutes to respond
    })

    return true
  }

  /**
   * Check if Detective Morgan should send a trap message
   */
  shouldTriggerDetectiveMorgan(player) {
    const heat = player?.heat || 0
    if (heat < 50) return false

    const morgan = NPC_CONTACTS.detective_morgan
    if (this.blockedContacts.has(morgan.id)) return false

    // Higher chance at higher heat
    const baseChance = 0.1
    const heatBonus = (heat - 50) / 100 // 0 to 0.5 extra
    return Math.random() < (baseChance + heatBonus)
  }

  /**
   * Send Detective Morgan trap message
   */
  sendDetectiveMorganTrap() {
    const morgan = NPC_CONTACTS.detective_morgan
    const templates = morgan.messageTemplates.SCAMS
    const message = templates[Math.floor(Math.random() * templates.length)]

    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`:: INCOMING MESSAGE ::`, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`${morgan.displayPrefix} Morgan: ${message}`, OUTPUT_TYPES.SYSTEM)

    // Create trap opportunity (looks like a good deal)
    opportunityManager.createOpportunity({
      type: OPP_TYPES.NPC_JOB,
      npcId: morgan.id,
      npcName: 'Morgan [NEW CONTACT]',
      title: 'Easy Money',
      message: message,
      shortMessage: 'Quick cash opportunity...',
      details: {
        originalType: 'POLICE_TRAP',
        isPoliceTrap: true,
        trapConsequences: morgan.trapConsequences,
        npc: morgan
      },
      rewards: { cash: randomBetween(8000, 20000) }, // Looks great!
      risks: { heat: 0 }, // Looks safe!
      expiryMs: 10 * 60 * 1000
    })

    this.messagesSent++
    return true
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
   * DEPRECATED: Now routes through OpportunityManager
   * Kept for backwards compatibility with 'accept' command
   */
  handleAccept() {
    const pending = opportunityManager.getPendingOpportunities()

    if (pending.length === 0) {
      return { error: true, message: "No pending offers. Type 'opportunities' to check for new ones." }
    }

    if (pending.length === 1) {
      // If only one opportunity, accept it
      const result = opportunityManager.respond(pending[0].id, 'yes')
      if (result.success) {
        this.opportunitiesTaken++
        return { output: [{ text: result.message || 'Accepted.', type: 'success' }] }
      }
      return { error: true, message: result.error }
    }

    // Multiple opportunities - ask user to specify
    return {
      error: true,
      message: `Multiple offers pending. Use 'respond 1 yes' or 'respond 2 yes'. Type 'opportunities' to see list.`
    }
  }

  /**
   * Handle player declining an opportunity
   * DEPRECATED: Now routes through OpportunityManager
   * Kept for backwards compatibility with 'decline' command
   */
  handleDecline() {
    const pending = opportunityManager.getPendingOpportunities()

    if (pending.length === 0) {
      return { error: true, message: "No pending offers to decline." }
    }

    if (pending.length === 1) {
      // If only one opportunity, decline it
      const result = opportunityManager.respond(pending[0].id, 'no')
      if (result.success) {
        // Check if it was a scam they avoided
        if (pending[0].details?.originalType === OPPORTUNITY_TYPES.SCAM) {
          this.scamsAvoided++
        }
        return { output: [{ text: result.message || 'Declined.', type: 'handler' }] }
      }
      return { error: true, message: result.error }
    }

    // Multiple opportunities - ask user to specify
    return {
      error: true,
      message: `Multiple offers pending. Use 'respond 1 no' or 'respond 2 no'. Type 'opportunities' to see list.`
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
   * Now checks OpportunityManager instead of local variable
   */
  hasPendingOpportunity() {
    return opportunityManager.getPendingOpportunities().length > 0
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
    console.log('[TerminalNPCManager] Shutdown')
  }
}

// Singleton instance
export const terminalNPCManager = new TerminalNPCManager()

export default terminalNPCManager
