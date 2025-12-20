/**
 * ProactiveMonitor - Unprompted assistance for S.A.R.A.H.
 *
 * Monitors game state and triggers helpful notifications
 * at appropriate times without being spammy.
 */

import { gameManager } from '../GameManager'
import { responseGenerator } from './ResponseGenerator'

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

    // Store state for comparison
    this.previousPlayerState = { ...playerData }
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
