/**
 * ProactiveMonitor - Unprompted assistance for S.A.R.A.H.
 *
 * Monitors game state and triggers helpful notifications
 * at appropriate times without being spammy.
 *
 * Enhanced with:
 * - AI threat detection
 * - Trade offer analysis
 * - Optimal timing detection
 * - Predictive warnings
 */

import { gameManager } from '../GameManager'
import { responseGenerator } from './ResponseGenerator'
import { aiIntelAnalyzer } from './AIIntelAnalyzer'

// Trigger thresholds and cooldowns
const TRIGGERS = {
  LOW_ENERGY: {
    threshold: 20,
    cooldown: 5 * 60 * 1000, // 5 minutes
  },
  HIGH_HEAT: {
    threshold: 70,
    cooldown: 3 * 60 * 1000, // 3 minutes
  },
  CRITICAL_HEAT: {
    threshold: 90,
    cooldown: 1 * 60 * 1000, // 1 minute - more urgent
  },
  LOW_HEALTH: {
    threshold: 30,
    cooldown: 5 * 60 * 1000, // 5 minutes
  },
  CASH_AT_RISK: {
    threshold: 10000, // Cash on hand above this with high heat
    cooldown: 10 * 60 * 1000, // 10 minutes
  },
  ACHIEVEMENT_CLOSE: {
    progress: 0.9, // 90% complete
    cooldown: 10 * 60 * 1000, // 10 minutes
  },
  LEVEL_UP: {
    cooldown: 0, // Always notify
  },
  AI_MESSAGE: {
    cooldown: 5 * 60 * 1000, // 5 minutes
  },

  // NEW TRIGGERS
  AI_THREAT_DETECTED: {
    cooldown: 10 * 60 * 1000, // 10 minutes
  },
  SCAM_DETECTED: {
    cooldown: 2 * 60 * 1000, // 2 minutes - urgent
  },
  GOOD_DEAL_AVAILABLE: {
    cooldown: 15 * 60 * 1000, // 15 minutes
  },
  OPTIMAL_CONDITIONS: {
    cooldown: 10 * 60 * 1000, // 10 minutes
  },
  PROPERTY_AFFORDABLE: {
    cooldown: 30 * 60 * 1000, // 30 minutes
  },
  ENERGY_RECOVERED: {
    threshold: 80, // Energy above this after being low
    cooldown: 5 * 60 * 1000, // 5 minutes
  },
  HEAT_COOLED: {
    threshold: 30, // Heat below this after being high
    cooldown: 5 * 60 * 1000, // 5 minutes
  },
}

class ProactiveMonitor {
  constructor() {
    this.lastNotifications = new Map()
    this.isInitialized = false
    this.notificationCallback = null
    this.previousPlayerState = null
  }

  /**
   * Initialize the monitor with game manager subscriptions
   */
  initialize(notificationCallback) {
    if (this.isInitialized) return

    this.notificationCallback = notificationCallback

    // Subscribe to player state changes
    if (gameManager.on) {
      gameManager.on('playerUpdated', this.onPlayerUpdated.bind(this))
      gameManager.on('levelUp', this.onLevelUp.bind(this))
      gameManager.on('aiMessage', this.onAIMessage.bind(this))
      gameManager.on('tradeOffer', this.onTradeOffer.bind(this))
    }

    // Also set up periodic check as fallback
    this.checkInterval = setInterval(() => {
      this.checkPlayerState()
    }, 30000) // Check every 30 seconds

    this.isInitialized = true
    console.log('[ProactiveMonitor] Initialized')
  }

  /**
   * Shutdown the monitor
   */
  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    this.isInitialized = false
    console.log('[ProactiveMonitor] Shutdown')
  }

  /**
   * Handle player state updates
   */
  onPlayerUpdated(player) {
    this.checkPlayerState(player)
  }

  /**
   * Handle level up events
   */
  onLevelUp(data) {
    if (!this.shouldNotify('levelUp')) return

    const message = responseGenerator.generateProactiveMessage('levelUp', {
      level: data.newLevel || data.level,
    })

    if (message) {
      this.sendNotification('levelUp', message)
    }
  }

  /**
   * Handle incoming AI messages
   */
  onAIMessage(data) {
    if (!this.shouldNotify('aiMessage')) return

    const message = responseGenerator.generateProactiveMessage('aiMessage', {
      sender: data.sender || data.from || 'someone',
    })

    if (message) {
      this.sendNotification('aiMessage', message)
    }
  }

  /**
   * Handle incoming trade offers
   */
  onTradeOffer(data) {
    this.analyzeIncomingOffer(data)
  }

  /**
   * Check player state for trigger conditions
   */
  checkPlayerState(player = null) {
    const playerData = player || gameManager.player

    if (!playerData) return

    // Low energy check
    if (playerData.energy <= TRIGGERS.LOW_ENERGY.threshold) {
      if (this.shouldNotify('lowEnergy')) {
        const message = responseGenerator.generateProactiveMessage('lowEnergy', {
          energy: playerData.energy,
        })
        if (message) {
          this.sendNotification('lowEnergy', message)
        }
      }
    }

    // Critical heat check (more urgent)
    if (playerData.heat >= TRIGGERS.CRITICAL_HEAT.threshold) {
      if (this.shouldNotify('criticalHeat')) {
        const message = responseGenerator.generateProactiveMessage('highHeat', {
          heat: playerData.heat,
        })
        if (message) {
          this.sendNotification('criticalHeat', message + " This is serious - you're about to get busted!")
        }
      }
    }
    // Regular high heat check
    else if (playerData.heat >= TRIGGERS.HIGH_HEAT.threshold) {
      if (this.shouldNotify('highHeat')) {
        const message = responseGenerator.generateProactiveMessage('highHeat', {
          heat: playerData.heat,
        })
        if (message) {
          this.sendNotification('highHeat', message)
        }
      }
    }

    // Low health check
    if (playerData.health <= TRIGGERS.LOW_HEALTH.threshold) {
      if (this.shouldNotify('lowHealth')) {
        this.sendNotification('lowHealth',
          `Your health is at ${playerData.health}%. Might want to grab a First Aid Kit before things get worse.`
        )
      }
    }

    // Cash at risk check (high cash + high heat)
    if (playerData.cash >= TRIGGERS.CASH_AT_RISK.threshold && playerData.heat >= 50) {
      if (this.shouldNotify('cashAtRisk')) {
        this.sendNotification('cashAtRisk',
          `You're carrying $${playerData.cash.toLocaleString()} with ${playerData.heat}% heat. Bank that cash before the cops do!`
        )
      }
    }

    // NEW CHECKS

    // Energy recovered check (was low, now high)
    if (this.previousPlayerState && this.previousPlayerState.energy < 30 &&
        playerData.energy >= TRIGGERS.ENERGY_RECOVERED.threshold) {
      if (this.shouldNotify('energyRecovered')) {
        this.sendNotification('energyRecovered',
          `Energy's back to ${playerData.energy}. Ready to make some moves.`
        )
      }
    }

    // Heat cooled check (was high, now low)
    if (this.previousPlayerState && this.previousPlayerState.heat >= 50 &&
        playerData.heat <= TRIGGERS.HEAT_COOLED.threshold) {
      if (this.shouldNotify('heatCooled')) {
        this.sendNotification('heatCooled',
          `Heat's down to ${playerData.heat}%. You're clear to operate again.`
        )
      }
    }

    // Optimal conditions check (high energy + low heat)
    if (playerData.energy >= 80 && playerData.heat <= 30 && playerData.health >= 70) {
      if (this.shouldNotify('optimalConditions')) {
        this.sendNotification('optimalConditions',
          `Perfect conditions - ${playerData.energy} energy, ${playerData.heat}% heat. Time to make your move.`
        )
      }
    }

    // Property affordable check
    this.checkPropertyAffordable(playerData)

    // AI threat check
    this.checkAIThreats()

    // Store state for comparison
    this.previousPlayerState = { ...playerData }
  }

  /**
   * Check if player can afford a new property tier
   */
  checkPropertyAffordable(playerData) {
    const totalCash = (playerData.cash || 0) + (playerData.bank || 0)

    const propertyTiers = [
      { name: 'Small Apartment', cost: 5000 },
      { name: 'Garage', cost: 15000 },
      { name: 'Warehouse', cost: 50000 },
      { name: 'Nightclub', cost: 100000 },
      { name: 'Penthouse', cost: 250000 },
    ]

    // Find newly affordable property (compare with previous state)
    if (this.previousPlayerState) {
      const prevCash = (this.previousPlayerState.cash || 0) + (this.previousPlayerState.bank || 0)

      for (const prop of propertyTiers) {
        if (totalCash >= prop.cost && prevCash < prop.cost) {
          if (this.shouldNotify('propertyAffordable')) {
            this.sendNotification('propertyAffordable',
              `You can now afford a ${prop.name} ($${prop.cost.toLocaleString()}). Passive income opportunity.`
            )
          }
          break
        }
      }
    }
  }

  /**
   * Check for active AI threats
   */
  checkAIThreats() {
    try {
      const threats = aiIntelAnalyzer.getActiveThreats()

      if (threats.length > 0) {
        const highThreats = threats.filter(t => t.threat.level === 'HIGH')

        if (highThreats.length > 0 && this.shouldNotify('aiThreatDetected')) {
          const threat = highThreats[0]
          this.sendNotification('aiThreatDetected',
            `Watch your back - ${threat.name} (Lvl ${threat.level}) is showing hostile intent. ${threat.threat.warning}`
          )
        }
      }
    } catch (e) {
      // AI systems may not be initialized yet
    }
  }

  /**
   * Analyze incoming trade offer
   */
  analyzeIncomingOffer(offer) {
    if (!offer) return

    try {
      const analysis = aiIntelAnalyzer.analyzeTradeOffer(offer)

      if (!analysis.safe && this.shouldNotify('scamDetected')) {
        this.sendNotification('scamDetected',
          `Warning: ${offer.sender || 'Someone'}'s offer looks shady. ${analysis.warnings[0] || 'Trust your gut.'}`
        )
      } else if (analysis.safe && analysis.warnings.length === 0 && this.shouldNotify('goodDealAvailable')) {
        this.sendNotification('goodDealAvailable',
          `Legit deal from ${offer.sender || 'a contact'}. Looks clean, might be worth your time.`
        )
      }
    } catch (e) {
      // AI systems may not be initialized
    }
  }

  /**
   * Check if we should send a notification (cooldown check)
   */
  shouldNotify(triggerType) {
    const now = Date.now()
    const lastNotification = this.lastNotifications.get(triggerType) || 0

    // Get cooldown for this trigger type
    let cooldown = 5 * 60 * 1000 // Default 5 minutes
    const triggerKey = triggerType.replace(/([A-Z])/g, '_$1').toUpperCase()
    if (TRIGGERS[triggerKey]) {
      cooldown = TRIGGERS[triggerKey].cooldown
    }

    // Check if cooldown has passed
    return (now - lastNotification) >= cooldown
  }

  /**
   * Send a notification through the callback
   */
  sendNotification(triggerType, message) {
    this.lastNotifications.set(triggerType, Date.now())

    if (this.notificationCallback) {
      this.notificationCallback({
        type: 'sarah',
        triggerType,
        message,
        timestamp: Date.now(),
      })
    }

    console.log(`[ProactiveMonitor] Triggered: ${triggerType}`)
  }

  /**
   * Manually trigger a check (for testing or on-demand)
   */
  forceCheck() {
    this.checkPlayerState()
  }

  /**
   * Reset all cooldowns (for testing)
   */
  resetCooldowns() {
    this.lastNotifications.clear()
  }

  /**
   * Get status for debugging
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      notificationCounts: Object.fromEntries(this.lastNotifications),
      hasCallback: !!this.notificationCallback,
    }
  }
}

// Singleton instance
export const proactiveMonitor = new ProactiveMonitor()

export default proactiveMonitor
