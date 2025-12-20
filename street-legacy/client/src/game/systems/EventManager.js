import { gameManager } from '../GameManager'
import { notificationManager } from './NotificationManager'

/**
 * EventManager - Handles random events, timed events, and global game events
 */
class EventManagerClass {
  constructor() {
    this.scene = null
    this.activeEvents = []
    this.eventTimer = null
    this.isInitialized = false

    // Event definitions
    this.randomEvents = [
      // Positive events
      {
        id: 'street_tip',
        name: 'Street Tip',
        description: 'You received a tip about an easy score!',
        icon: '💡',
        type: 'success',
        weight: 15,
        effect: { type: 'buff', stat: 'crime_success', value: 10, duration: 300000 } // 5 min
      },
      {
        id: 'lucky_find',
        name: 'Lucky Find',
        description: 'You found some cash on the street!',
        icon: '💵',
        type: 'money',
        weight: 10,
        effect: { type: 'cash', min: 100, max: 500 }
      },
      {
        id: 'reputation_boost',
        name: 'Word on the Street',
        description: 'Your reputation is spreading! +5% respect bonus.',
        icon: '🗣️',
        type: 'success',
        weight: 8,
        effect: { type: 'buff', stat: 'respect', value: 5, duration: 600000 } // 10 min
      },
      {
        id: 'energy_surge',
        name: 'Energy Surge',
        description: 'You feel energized! Energy restored.',
        icon: '⚡',
        type: 'success',
        weight: 12,
        effect: { type: 'restore', stat: 'energy', value: 25 }
      },
      {
        id: 'informant_intel',
        name: 'Informant Intel',
        description: 'An informant shares valuable info. Heat reduced!',
        icon: '🕵️',
        type: 'success',
        weight: 10,
        effect: { type: 'reduce', stat: 'heat', value: 15 }
      },

      // Neutral events
      {
        id: 'police_patrol',
        name: 'Police Patrol',
        description: 'Increased police activity in the area. Lay low for a bit.',
        icon: '🚔',
        type: 'warning',
        weight: 15,
        effect: { type: 'buff', stat: 'heat_gain', value: 50, duration: 180000 } // 3 min
      },
      {
        id: 'market_fluctuation',
        name: 'Market Fluctuation',
        description: 'The black market prices are changing...',
        icon: '📈',
        type: 'info',
        weight: 10,
        effect: { type: 'none' }
      },
      {
        id: 'gang_activity',
        name: 'Gang Activity',
        description: 'Rival gang activity spotted nearby. Watch your back!',
        icon: '⚔️',
        type: 'warning',
        weight: 12,
        effect: { type: 'buff', stat: 'danger', value: 20, duration: 240000 } // 4 min
      },

      // Negative events
      {
        id: 'pickpocketed',
        name: 'Pickpocketed!',
        description: 'Someone stole some cash from you!',
        icon: '😱',
        type: 'error',
        weight: 8,
        effect: { type: 'cash', min: -200, max: -50 }
      },
      {
        id: 'shakedown',
        name: 'Shakedown',
        description: 'Local thugs demanded protection money.',
        icon: '👊',
        type: 'error',
        weight: 6,
        effect: { type: 'cash', min: -500, max: -100 }
      },
      {
        id: 'heat_spike',
        name: 'Witness Report',
        description: 'Someone reported suspicious activity. Heat increased!',
        icon: '👁️',
        type: 'error',
        weight: 10,
        effect: { type: 'increase', stat: 'heat', value: 10 }
      },

      // Special events
      {
        id: 'double_xp',
        name: 'Training Montage',
        description: 'Double XP for the next 5 minutes!',
        icon: '🏋️',
        type: 'achievement',
        weight: 5,
        effect: { type: 'buff', stat: 'xp_mult', value: 100, duration: 300000 }
      },
      {
        id: 'frenzy',
        name: 'Crime Frenzy',
        description: 'Crime cooldowns reduced by 50% for 3 minutes!',
        icon: '🔥',
        type: 'achievement',
        weight: 4,
        effect: { type: 'buff', stat: 'cooldown_reduction', value: 50, duration: 180000 }
      }
    ]

    // Active buffs
    this.activeBuffs = new Map()
  }

  /**
   * Initialize the event manager
   */
  initialize(scene) {
    this.scene = scene
    this.isInitialized = true

    // Start random event timer
    this.startEventTimer()

    // Listen for game events
    this.setupListeners()
  }

  /**
   * Start the random event timer
   */
  startEventTimer() {
    if (this.eventTimer) {
      this.eventTimer.remove()
    }

    // Random event every 2-5 minutes
    const minDelay = 120000 // 2 minutes
    const maxDelay = 300000 // 5 minutes
    const delay = Phaser.Math.Between(minDelay, maxDelay)

    this.eventTimer = this.scene.time.delayedCall(delay, () => {
      this.triggerRandomEvent()
      this.startEventTimer() // Schedule next event
    })
  }

  /**
   * Setup game event listeners
   */
  setupListeners() {
    // Listen for game manager events
    gameManager.on('crimeCompleted', (result) => {
      if (result.success) {
        notificationManager.showToast({
          message: `Crime successful! +${result.cash_earned?.toLocaleString() || 0}`,
          type: 'money',
          icon: '💰'
        })

        if (result.leveled_up) {
          notificationManager.showEventBanner({
            title: 'LEVEL UP!',
            subtitle: `You reached level ${result.new_level}!`,
            icon: '⬆️',
            type: 'levelup'
          })
        }
      } else if (result.jailed) {
        notificationManager.showToast({
          message: 'You were caught and sent to jail!',
          type: 'jail',
          duration: 4000
        })
      }
    })

    gameManager.on('jobCompleted', (result) => {
      notificationManager.showToast({
        message: `Job complete! +${result.cash_earned?.toLocaleString() || 0}`,
        type: 'success',
        icon: '💼'
      })
    })

    gameManager.on('traveled', (result) => {
      notificationManager.showToast({
        message: `Arrived at ${result.district?.name || 'destination'}`,
        type: 'info',
        icon: '🗺️'
      })
    })

    gameManager.on('propertyPurchased', (result) => {
      notificationManager.showToast({
        message: 'Property purchased!',
        type: 'success',
        icon: '🏠'
      })
    })

    gameManager.on('businessPurchased', (result) => {
      notificationManager.showToast({
        message: 'Business acquired!',
        type: 'success',
        icon: '🏢'
      })
    })

    gameManager.on('businessCollected', (result) => {
      notificationManager.showToast({
        message: `Collected $${result.amount?.toLocaleString() || 0}`,
        type: 'money',
        icon: '💰'
      })
    })

    // Listen for notification events from GameManager
    gameManager.on('notification', (notification) => {
      // Don't duplicate notifications - GameScene handles its own
      // This is for scenes that don't handle notifications
    })
  }

  /**
   * Trigger a random event
   */
  triggerRandomEvent() {
    if (!this.scene || !this.isInitialized) return

    // Calculate total weight
    const totalWeight = this.randomEvents.reduce((sum, event) => sum + event.weight, 0)

    // Random selection based on weight
    let random = Math.random() * totalWeight
    let selectedEvent = null

    for (const event of this.randomEvents) {
      random -= event.weight
      if (random <= 0) {
        selectedEvent = event
        break
      }
    }

    if (!selectedEvent) return

    // Apply event effect
    this.applyEventEffect(selectedEvent)

    // Show notification
    notificationManager.showToast({
      message: selectedEvent.description,
      type: selectedEvent.type,
      icon: selectedEvent.icon,
      duration: 4000
    })

    // Emit event
    gameManager.emit('randomEvent', selectedEvent)
  }

  /**
   * Apply the effect of an event
   */
  applyEventEffect(event) {
    const effect = event.effect

    switch (effect.type) {
      case 'cash': {
        const amount = Phaser.Math.Between(effect.min, effect.max)
        const player = gameManager.player
        if (player) {
          player.cash = Math.max(0, (player.cash || 0) + amount)
          gameManager.emit('playerUpdated', player)
        }
        break
      }

      case 'restore': {
        const player = gameManager.player
        if (player) {
          const current = player[effect.stat] || 0
          const max = player[`${effect.stat}Max`] || 100
          player[effect.stat] = Math.min(max, current + effect.value)
          gameManager.emit('playerUpdated', player)
        }
        break
      }

      case 'increase': {
        const player = gameManager.player
        if (player && player[effect.stat] !== undefined) {
          player[effect.stat] = Math.min(100, (player[effect.stat] || 0) + effect.value)
          gameManager.emit('playerUpdated', player)
        }
        break
      }

      case 'reduce': {
        const player = gameManager.player
        if (player && player[effect.stat] !== undefined) {
          player[effect.stat] = Math.max(0, (player[effect.stat] || 0) - effect.value)
          gameManager.emit('playerUpdated', player)
        }
        break
      }

      case 'buff': {
        this.addBuff(effect.stat, effect.value, effect.duration)
        break
      }

      case 'none':
      default:
        // No effect
        break
    }
  }

  /**
   * Add a temporary buff
   */
  addBuff(stat, value, duration) {
    // Remove existing buff for same stat
    if (this.activeBuffs.has(stat)) {
      const existing = this.activeBuffs.get(stat)
      if (existing.timer) {
        existing.timer.remove()
      }
    }

    // Add new buff
    const buff = {
      stat,
      value,
      startTime: Date.now(),
      duration,
      timer: this.scene.time.delayedCall(duration, () => {
        this.removeBuff(stat)
      })
    }

    this.activeBuffs.set(stat, buff)

    // Show buff indicator
    notificationManager.showToast({
      message: `Buff active: ${stat.replace('_', ' ')} +${value}%`,
      type: 'info',
      icon: '✨',
      duration: 2000
    })
  }

  /**
   * Remove a buff
   */
  removeBuff(stat) {
    if (this.activeBuffs.has(stat)) {
      const buff = this.activeBuffs.get(stat)
      if (buff.timer) {
        buff.timer.remove()
      }
      this.activeBuffs.delete(stat)

      notificationManager.showToast({
        message: `Buff expired: ${stat.replace('_', ' ')}`,
        type: 'info',
        icon: '⏰',
        duration: 2000
      })
    }
  }

  /**
   * Get current buff value for a stat
   */
  getBuffValue(stat) {
    if (this.activeBuffs.has(stat)) {
      return this.activeBuffs.get(stat).value
    }
    return 0
  }

  /**
   * Check if a buff is active
   */
  hasBuff(stat) {
    return this.activeBuffs.has(stat)
  }

  /**
   * Get all active buffs
   */
  getActiveBuffs() {
    const buffs = []
    this.activeBuffs.forEach((buff, stat) => {
      const remaining = buff.duration - (Date.now() - buff.startTime)
      buffs.push({
        stat,
        value: buff.value,
        remaining: Math.max(0, remaining)
      })
    })
    return buffs
  }

  /**
   * Trigger a specific event by ID
   */
  triggerEvent(eventId) {
    const event = this.randomEvents.find(e => e.id === eventId)
    if (event) {
      this.applyEventEffect(event)
      notificationManager.showToast({
        message: event.description,
        type: event.type,
        icon: event.icon,
        duration: 4000
      })
    }
  }

  /**
   * Show a custom event banner
   */
  showEventBanner(options) {
    notificationManager.showEventBanner(options)
  }

  /**
   * Stop the event manager
   */
  stop() {
    if (this.eventTimer) {
      this.eventTimer.remove()
      this.eventTimer = null
    }

    this.activeBuffs.forEach((buff) => {
      if (buff.timer) {
        buff.timer.remove()
      }
    })
    this.activeBuffs.clear()

    this.isInitialized = false
  }

  /**
   * Clean up
   */
  cleanup() {
    this.stop()
    this.scene = null
  }
}

// Export singleton instance
export const eventManager = new EventManagerClass()
export default eventManager
