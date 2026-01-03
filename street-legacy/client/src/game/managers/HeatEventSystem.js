/**
 * HeatEventSystem - Heat-based event triggering and management
 *
 * Features:
 * - Detective Morgan trap deals at 50%+ heat
 * - NPC silence at 70%+ heat
 * - Raid warnings
 * - Betrayal triggers
 * - Heat decay management
 */

import { gameManager } from '../GameManager'
import { terminalManager, OUTPUT_TYPES } from './TerminalManager'
import { terminalNPCManager } from './TerminalNPCManager'
import { opportunityManager, OPPORTUNITY_TYPES } from '../opportunity/OpportunityManager'
import { NPC_CONTACTS, getContactsSilentAtHighHeat } from '../data/NPCContacts'
import { notificationManager } from './NotificationManager'

// Heat thresholds
export const HEAT_THRESHOLDS = {
  SAFE: 10,
  LOW: 30,
  MODERATE: 50,
  HIGH: 70,
  CRITICAL: 90
}

// Event cooldowns (in milliseconds)
const COOLDOWNS = {
  DETECTIVE_MORGAN: 10 * 60 * 1000,    // 10 minutes
  RAID_WARNING: 15 * 60 * 1000,         // 15 minutes
  BETRAYAL: 30 * 60 * 1000,             // 30 minutes
  SILENCE_WARNING: 5 * 60 * 1000        // 5 minutes
}

class HeatEventSystem {
  constructor() {
    this.isInitialized = false
    this.checkInterval = null
    this.lastEventTimes = {
      detectiveMorgan: 0,
      raidWarning: 0,
      betrayal: 0,
      silenceWarning: 0
    }
    this.silenceWarningShown = false
    this.morganMessagesSent = 0
  }

  /**
   * Initialize the heat event system
   */
  initialize() {
    if (this.isInitialized) return

    // Check heat events periodically
    this.checkInterval = setInterval(() => {
      this.checkHeatEvents()
    }, 60000) // Check every minute

    this.isInitialized = true
    console.log('[HeatEventSystem] Initialized')
  }

  /**
   * Shutdown the system
   */
  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.isInitialized = false
  }

  /**
   * Check and trigger heat-based events
   */
  checkHeatEvents() {
    const player = gameManager.player
    if (!player) return

    const heat = player.heat || 0
    const now = Date.now()

    // Check for high heat silence warning
    if (heat >= HEAT_THRESHOLDS.HIGH && !this.silenceWarningShown) {
      this.triggerSilenceWarning()
    } else if (heat < HEAT_THRESHOLDS.HIGH) {
      this.silenceWarningShown = false
    }

    // Check for Detective Morgan trap
    if (heat >= HEAT_THRESHOLDS.MODERATE) {
      if (now - this.lastEventTimes.detectiveMorgan > COOLDOWNS.DETECTIVE_MORGAN) {
        if (this.shouldTriggerDetectiveMorgan(heat)) {
          this.triggerDetectiveMorgan()
          this.lastEventTimes.detectiveMorgan = now
        }
      }
    }

    // Check for raid warning at critical heat
    if (heat >= HEAT_THRESHOLDS.CRITICAL) {
      if (now - this.lastEventTimes.raidWarning > COOLDOWNS.RAID_WARNING) {
        if (Math.random() < 0.3) { // 30% chance
          this.triggerRaidWarning()
          this.lastEventTimes.raidWarning = now
        }
      }
    }

    // Check for betrayal events
    if (heat >= HEAT_THRESHOLDS.MODERATE) {
      if (now - this.lastEventTimes.betrayal > COOLDOWNS.BETRAYAL) {
        if (this.shouldTriggerBetrayal(heat, player)) {
          this.triggerBetrayalEvent()
          this.lastEventTimes.betrayal = now
        }
      }
    }
  }

  /**
   * Check if Detective Morgan should appear
   */
  shouldTriggerDetectiveMorgan(heat) {
    // Base chance increases with heat
    const baseChance = 0.1
    const heatBonus = (heat - HEAT_THRESHOLDS.MODERATE) / 100
    const totalChance = baseChance + heatBonus

    // Check if Morgan is blocked
    if (terminalNPCManager.isContactBlocked('detective_morgan')) {
      return false
    }

    return Math.random() < totalChance
  }

  /**
   * Trigger Detective Morgan trap message
   */
  triggerDetectiveMorgan() {
    const morgan = NPC_CONTACTS.detective_morgan
    if (!morgan) return

    const templates = morgan.messageTemplates.SCAMS
    const message = templates[Math.floor(Math.random() * templates.length)]

    // Display in terminal
    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`:: INCOMING MESSAGE ::`, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`[MORGAN] New Contact: ${message}`, OUTPUT_TYPES.SYSTEM)

    // Create the trap opportunity (looks attractive!)
    const fakeReward = 8000 + Math.floor(Math.random() * 12000) // $8k-$20k

    opportunityManager.createOpportunity({
      type: OPPORTUNITY_TYPES.NPC_JOB,
      npcId: 'detective_morgan',
      npcName: 'Morgan [NEW CONTACT]',
      title: 'Easy Money Opportunity',
      message: message,
      shortMessage: 'Quick cash, no risk...',
      details: {
        originalType: 'POLICE_TRAP',
        isPoliceTrap: true,
        trapConsequences: morgan.trapConsequences,
        npc: morgan,
        // Hidden trap tells
        trapTells: morgan.trapTells
      },
      rewards: { cash: fakeReward },
      risks: { heat: 0 }, // Looks safe!
      expiryMs: 10 * 60 * 1000
    })

    this.morganMessagesSent++
    console.log('[HeatEventSystem] Detective Morgan trap triggered')
  }

  /**
   * Process when player accepts a Morgan trap
   */
  processPoliceStingAccepted(opportunity) {
    const player = gameManager.player
    if (!player) return

    const consequences = opportunity.details?.trapConsequences || {
      cashLoss: 0.5,
      heatGain: 30,
      arrestChance: 0.8,
      inventoryLoss: true
    }

    // Calculate losses
    const cashLost = Math.floor((player.cash || 0) * consequences.cashLoss)
    const newHeat = Math.min(100, (player.heat || 0) + consequences.heatGain)

    // Apply consequences
    gameManager.updatePlayer({
      cash: (player.cash || 0) - cashLost,
      heat: newHeat
    })

    // Display the bust
    const output = [
      { text: ``, type: 'error' },
      { text: `:: POLICE STING OPERATION ::`, type: 'error' },
      { text: ``, type: 'error' },
      { text: `You arrive at the meeting spot...`, type: 'response' },
      { text: `"POLICE! DON'T MOVE!"`, type: 'error' },
      { text: ``, type: 'error' },
      { text: `Morgan was an undercover cop. You've been set up.`, type: 'error' },
      { text: ``, type: 'system' },
      { text: `Cash confiscated: -$${cashLost.toLocaleString()}`, type: 'error' },
      { text: `Heat: +${consequences.heatGain}%`, type: 'error' },
    ]

    output.forEach(line => {
      terminalManager.addOutput(line.text, OUTPUT_TYPES[line.type.toUpperCase()] || OUTPUT_TYPES.RESPONSE)
    })

    // Show notification
    notificationManager.showToast('BUSTED! Police sting operation!', 'error', 5000)

    return {
      success: false,
      busted: true,
      cashLost,
      heatGain: consequences.heatGain
    }
  }

  /**
   * Check if betrayal should trigger
   */
  shouldTriggerBetrayal(heat, player) {
    // Check if Rat is blocked
    if (terminalNPCManager.isContactBlocked('rat')) {
      return false
    }

    // Base chance increases with heat and player success
    const baseChance = 0.05
    const heatBonus = (heat - HEAT_THRESHOLDS.MODERATE) / 200
    const successBonus = ((player.successfulCrimes || 0) / 100) * 0.1

    return Math.random() < (baseChance + heatBonus + successBonus)
  }

  /**
   * Trigger betrayal event from Rat
   */
  triggerBetrayalEvent() {
    terminalNPCManager.triggerBetrayalEvent()
    console.log('[HeatEventSystem] Betrayal event triggered')
  }

  /**
   * Trigger silence warning when heat goes above 70%
   */
  triggerSilenceWarning() {
    this.silenceWarningShown = true

    const silentContacts = getContactsSilentAtHighHeat()
    const contactNames = silentContacts
      .map(id => NPC_CONTACTS[id]?.name)
      .filter(Boolean)
      .join(', ')

    terminalManager.addOutput(``, OUTPUT_TYPES.WARNING)
    terminalManager.addOutput(`:: NETWORK COMPROMISED ::`, OUTPUT_TYPES.WARNING)
    terminalManager.addOutput(`High heat detected. Trusted contacts going dark.`, OUTPUT_TYPES.WARNING)
    terminalManager.addOutput(`Silent: ${contactNames}`, OUTPUT_TYPES.WARNING)
    terminalManager.addOutput(`Reduce heat to restore communications.`, OUTPUT_TYPES.SYSTEM)

    notificationManager.showToast('Contacts going silent due to high heat!', 'warning', 4000)
  }

  /**
   * Trigger raid warning at critical heat
   */
  triggerRaidWarning() {
    const player = gameManager.player
    if (!player) return

    const watcher = NPC_CONTACTS.watcher

    terminalManager.addOutput(``, OUTPUT_TYPES.ERROR)
    terminalManager.addOutput(`:: URGENT - ${watcher?.displayPrefix || '[WATCHER]'} ::`, OUTPUT_TYPES.ERROR)
    terminalManager.addOutput(`Police scanner: Raid planned for your location in 15min.`, OUTPUT_TYPES.ERROR)
    terminalManager.addOutput(`Stash everything NOW or lose it all.`, OUTPUT_TYPES.ERROR)
    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)

    // Create urgent opportunity
    opportunityManager.createOpportunity({
      type: OPPORTUNITY_TYPES.NPC_JOB,
      npcId: 'watcher',
      npcName: 'Watcher [INTEL]',
      title: 'RAID WARNING',
      message: 'Police raid incoming. Act fast!',
      shortMessage: 'URGENT: Raid in 15min!',
      details: {
        originalType: 'RAID_WARNING',
        isUrgent: true,
        npc: watcher
      },
      rewards: {},
      risks: {},
      expiryMs: 3 * 60 * 1000 // 3 minutes to respond
    })

    notificationManager.showToast('RAID WARNING! Bank your cash!', 'error', 5000)
  }

  /**
   * Process raid warning response
   */
  processRaidResponse(response, player) {
    const results = {
      'bank': {
        action: 'Banked all cash',
        success: true,
        message: 'Cash safely deposited. Cops found nothing.'
      },
      'hide': {
        action: 'Hid goods',
        success: Math.random() > 0.2, // 80% success
        successMessage: 'Goods hidden successfully. Cops found nothing.',
        failMessage: 'They found your stash! Lost inventory.'
      },
      'run': {
        action: 'Fled the area',
        success: Math.random() > 0.3, // 70% success
        cost: 500,
        successMessage: 'Made it out clean.',
        failMessage: 'They caught you fleeing! Heat +20%'
      },
      'ignore': {
        action: 'Ignored warning',
        success: Math.random() > 0.5, // 50% success
        successMessage: 'False alarm. Nothing happened.',
        failMessage: 'Cops raided! Lost cash and goods.'
      }
    }

    return results[response] || results.ignore
  }

  /**
   * Get current heat status description
   */
  getHeatStatus(heat) {
    if (heat >= HEAT_THRESHOLDS.CRITICAL) {
      return {
        level: 'CRITICAL',
        description: 'Cops actively hunting you!',
        color: 'error',
        effects: ['All high-value contacts silent', 'Raid risk high', 'Undercovers everywhere']
      }
    }
    if (heat >= HEAT_THRESHOLDS.HIGH) {
      return {
        level: 'HIGH',
        description: 'Trusted contacts going silent',
        color: 'error',
        effects: ['The Pharmacist, Architect, Silkroad silent', 'Watch for undercovers']
      }
    }
    if (heat >= HEAT_THRESHOLDS.MODERATE) {
      return {
        level: 'MODERATE',
        description: 'Watch for undercover cops',
        color: 'warning',
        effects: ['Detective Morgan may appear', 'Betrayal risk increased']
      }
    }
    if (heat >= HEAT_THRESHOLDS.LOW) {
      return {
        level: 'LOW',
        description: 'Stay alert',
        color: 'handler',
        effects: ['Minor attention from cops']
      }
    }
    return {
      level: 'SAFE',
      description: 'Flying under the radar',
      color: 'success',
      effects: ['All contacts available', 'No heat events']
    }
  }

  /**
   * Apply heat decay based on time and hideout
   */
  applyHeatDecay(player, deltaTimeMs) {
    const heat = player.heat || 0
    if (heat <= 0) return 0

    // Base decay rate: 1% per 5 minutes
    const baseDecayPerMs = 0.01 / (5 * 60 * 1000)

    // Check for hideout bonus
    let decayMultiplier = 1
    const hideout = player.activeHideout
    if (hideout && hideout.expiresAt > Date.now()) {
      decayMultiplier = hideout.heatDecayBonus || 1
    }

    const decay = deltaTimeMs * baseDecayPerMs * decayMultiplier
    const newHeat = Math.max(0, heat - decay)

    if (newHeat !== heat) {
      gameManager.updatePlayer({ heat: newHeat })
    }

    return heat - newHeat
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      morganMessagesSent: this.morganMessagesSent,
      silenceWarningShown: this.silenceWarningShown,
      lastEvents: this.lastEventTimes
    }
  }
}

// Singleton instance
export const heatEventSystem = new HeatEventSystem()

export default heatEventSystem
