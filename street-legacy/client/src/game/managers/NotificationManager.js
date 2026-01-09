/**
 * NotificationManager - Singleton notification system for Street Legacy
 *
 * Features:
 * - Toast notifications (slide in from top, color-coded)
 * - Event popups (modal with choices)
 * - Achievement notifications (integrates with AchievementPopup)
 * - Cash/XP floating text gains
 * - Queue system (max 3 visible toasts, stacked vertically)
 *
 * Usage:
 *   import { notificationManager } from '../managers/NotificationManager'
 *   notificationManager.setScene(scene)
 *   notificationManager.showToast('Crime successful!', 'success')
 *   notificationManager.showEvent(event)
 *   notificationManager.showGain(x, y, '+$500', 0x22c55e)
 */

import { achievementPopup } from '../ui/AchievementPopup'
import { audioManager } from './AudioManager'
import { ParticleHelper } from '../utils/ParticleHelper'
import { AnimationHelper } from '../utils/AnimationHelper'

class NotificationManagerClass {
  constructor() {
    this.scene = null
    this.toastQueue = []
    this.activeToasts = []
    this.maxVisibleToasts = 3
    this.currentEventModal = null
    this.isShowingEvent = false
    this.eventQueue = []
  }

  /**
   * Set the current Phaser scene for rendering
   * @param {Phaser.Scene} scene
   */
  setScene(scene) {
    this.scene = scene
  }

  // ==========================================================================
  // TOAST NOTIFICATIONS
  // ==========================================================================

  /**
   * Toast notification types and their configurations
   */
  getToastConfig(type) {
    const configs = {
      success: {
        bgColor: 0x22c55e,
        icon: '✓',
        iconColor: '#ffffff'
      },
      error: {
        bgColor: 0xef4444,
        icon: '✕',
        iconColor: '#ffffff'
      },
      warning: {
        bgColor: 0xf59e0b,
        icon: '⚠',
        iconColor: '#000000'
      },
      info: {
        bgColor: 0x3b82f6,
        icon: 'ℹ',
        iconColor: '#ffffff'
      },
      levelup: {
        bgColor: 0x8b5cf6,
        icon: '⬆',
        iconColor: '#ffffff'
      },
      reward: {
        bgColor: 0xffd700,
        icon: '🎁',
        iconColor: '#000000'
      },
      sync: {
        bgColor: 0x06b6d4, // Cyan for sync operations
        icon: '⟳',
        iconColor: '#ffffff'
      },
      sync_adjusted: {
        bgColor: 0xf97316, // Orange for server-adjusted results
        icon: '⚠️',
        iconColor: '#ffffff'
      },
      sync_rejected: {
        bgColor: 0xdc2626, // Red for rejected actions
        icon: '✗',
        iconColor: '#ffffff'
      }
    }
    return configs[type] || configs.info
  }

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} type - 'success' | 'error' | 'warning' | 'info' | 'levelup' | 'reward'
   * @param {number} duration - Auto-dismiss duration in ms (default: 3000)
   */
  showToast(message, type = 'info', duration = 3000) {
    if (!this.scene || !this.scene.sys.isActive()) {
      // Queue for later if scene not available
      this.toastQueue.push({ message, type, duration })
      return
    }

    // If we have max toasts, queue this one
    if (this.activeToasts.length >= this.maxVisibleToasts) {
      this.toastQueue.push({ message, type, duration })
      return
    }

    // Play notification sound
    audioManager.playNotification()

    this.renderToast(message, type, duration)
  }

  /**
   * Process queued toasts
   */
  processToastQueue() {
    if (this.toastQueue.length === 0) return
    if (this.activeToasts.length >= this.maxVisibleToasts) return
    if (!this.scene || !this.scene.sys.isActive()) return

    const toast = this.toastQueue.shift()
    this.renderToast(toast.message, toast.type, toast.duration)
  }

  /**
   * Render a toast notification
   */
  renderToast(message, type, duration) {
    const { width } = this.scene.cameras.main
    const config = this.getToastConfig(type)

    const toastWidth = Math.min(340, width - 40)
    const toastHeight = 50
    const padding = 10
    const startY = -toastHeight
    const targetY = 20 + (this.activeToasts.length * (toastHeight + padding))

    // Container
    const container = this.scene.add.container(width / 2, startY)
    container.setDepth(3000)

    // Background
    const bg = this.scene.add.rectangle(0, 0, toastWidth, toastHeight, config.bgColor, 0.95)
    bg.setStrokeStyle(1, 0xffffff, 0.3)

    // Icon background
    const iconBg = this.scene.add.rectangle(-toastWidth / 2 + 25, 0, 35, 35, 0x000000, 0.2)

    // Icon
    const icon = this.scene.add.text(-toastWidth / 2 + 25, 0, config.icon, {
      fontSize: '18px',
      color: config.iconColor
    }).setOrigin(0.5)

    // Message text
    const text = this.scene.add.text(-toastWidth / 2 + 55, 0, message, {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
      wordWrap: { width: toastWidth - 80 }
    }).setOrigin(0, 0.5)

    // Dismiss X button
    const dismissBtn = this.scene.add.text(toastWidth / 2 - 15, 0, '×', {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5).setAlpha(0.7)
      .setInteractive({ useHandCursor: true })

    dismissBtn.on('pointerover', () => dismissBtn.setAlpha(1))
    dismissBtn.on('pointerout', () => dismissBtn.setAlpha(0.7))
    dismissBtn.on('pointerdown', () => this.dismissToast(container))

    // Make whole toast tappable to dismiss
    bg.setInteractive({ useHandCursor: true })
    bg.on('pointerdown', () => this.dismissToast(container))

    container.add([bg, iconBg, icon, text, dismissBtn])

    // Store reference
    const toastData = {
      container,
      targetY,
      timer: null
    }
    this.activeToasts.push(toastData)

    // Slide in animation
    this.scene.tweens.add({
      targets: container,
      y: targetY,
      duration: 300,
      ease: 'Back.out',
      onComplete: () => {
        // Start auto-dismiss timer
        toastData.timer = this.scene.time.delayedCall(duration, () => {
          this.dismissToast(container)
        })
      }
    })
  }

  /**
   * Dismiss a toast notification
   */
  dismissToast(container) {
    const index = this.activeToasts.findIndex(t => t.container === container)
    if (index === -1) return

    const toastData = this.activeToasts[index]

    // Cancel timer if exists
    if (toastData.timer) {
      toastData.timer.remove()
    }

    // Remove from active list
    this.activeToasts.splice(index, 1)

    // Slide out animation
    this.scene.tweens.add({
      targets: container,
      y: -60,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        container.destroy()

        // Reposition remaining toasts
        this.repositionToasts()

        // Process queue
        this.scene.time.delayedCall(100, () => {
          this.processToastQueue()
        })
      }
    })
  }

  /**
   * Reposition active toasts after one is dismissed
   */
  repositionToasts() {
    const toastHeight = 50
    const padding = 10

    this.activeToasts.forEach((toastData, index) => {
      const newY = 20 + (index * (toastHeight + padding))
      toastData.targetY = newY

      this.scene.tweens.add({
        targets: toastData.container,
        y: newY,
        duration: 200,
        ease: 'Power2'
      })
    })
  }

  /**
   * Clear all active toasts
   */
  clearAllToasts() {
    this.activeToasts.forEach(toastData => {
      if (toastData.timer) toastData.timer.remove()
      toastData.container.destroy()
    })
    this.activeToasts = []
    this.toastQueue = []
  }

  // ==========================================================================
  // EVENT POPUP MODALS
  // ==========================================================================

  /**
   * Show an event popup modal
   * @param {Object} event - Game event data
   * @param {number} event.id - Event ID
   * @param {string} event.type - 'opportunity' | 'threat' | 'bonus' | 'random'
   * @param {string} event.title - Event title
   * @param {string} event.description - Event description
   * @param {number} event.duration_minutes - Duration in minutes (optional)
   * @param {string} event.effect_type - Type of effect
   * @param {number} event.effect_value - Value of effect
   * @param {Array} event.choices - Optional choice buttons
   * @param {boolean} event.mandatory - Cannot dismiss if true
   * @param {Function} event.onChoice - Callback when choice is made
   */
  showEvent(event) {
    if (!this.scene || !this.scene.sys.isActive()) {
      this.eventQueue.push(event)
      return
    }

    if (this.isShowingEvent) {
      this.eventQueue.push(event)
      return
    }

    // Play event sound based on type
    if (event.type === 'threat' || event.type === 'police' || event.type === 'gang') {
      audioManager.playThreat()
    } else if (event.type === 'opportunity' || event.type === 'bonus') {
      audioManager.playOpportunity()
    } else {
      audioManager.playEventPopup()
    }

    this.isShowingEvent = true
    this.renderEventModal(event)
  }

  /**
   * Get event type configuration
   */
  getEventConfig(type) {
    const configs = {
      opportunity: {
        icon: '💰',
        color: 0x22c55e,
        borderColor: 0x16a34a,
        title: 'OPPORTUNITY'
      },
      threat: {
        icon: '🚨',
        color: 0xef4444,
        borderColor: 0xdc2626,
        title: 'THREAT'
      },
      bonus: {
        icon: '⚡',
        color: 0xf59e0b,
        borderColor: 0xd97706,
        title: 'BONUS'
      },
      random: {
        icon: '🎲',
        color: 0x8b5cf6,
        borderColor: 0x7c3aed,
        title: 'RANDOM EVENT'
      },
      police: {
        icon: '🚔',
        color: 0x3b82f6,
        borderColor: 0x2563eb,
        title: 'POLICE'
      },
      gang: {
        icon: '💀',
        color: 0x991b1b,
        borderColor: 0x7f1d1d,
        title: 'GANG ACTIVITY'
      }
    }
    return configs[type] || configs.random
  }

  /**
   * Render event modal
   */
  renderEventModal(event) {
    const { width, height } = this.scene.cameras.main
    const config = this.getEventConfig(event.type)

    const modalWidth = Math.min(360, width - 40)
    const hasChoices = event.choices && event.choices.length > 0
    const choiceCount = hasChoices ? event.choices.length : 0
    const modalHeight = 280 + (choiceCount * 50)

    // Container for all modal elements
    const container = this.scene.add.container(width / 2, height / 2)
    container.setDepth(4000)

    // Dark overlay
    const overlay = this.scene.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.8)
    overlay.setInteractive() // Block clicks through

    // If not mandatory, allow clicking overlay to dismiss
    if (!event.mandatory) {
      overlay.on('pointerdown', () => this.dismissEvent(container, event, null))
    }

    // Modal background
    const modalBg = this.scene.add.rectangle(0, 0, modalWidth, modalHeight, 0x1a1a2e, 0.98)
    modalBg.setStrokeStyle(3, config.borderColor)

    // Header bar
    const headerBar = this.scene.add.rectangle(0, -modalHeight / 2 + 25, modalWidth, 50, config.color, 0.95)

    // Event type label
    const typeLabel = this.scene.add.text(0, -modalHeight / 2 + 15, config.title, {
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    // Icon
    const icon = this.scene.add.text(0, -modalHeight / 2 + 65, config.icon, {
      fontSize: '48px'
    }).setOrigin(0.5)

    // Title
    const title = this.scene.add.text(0, -modalHeight / 2 + 115, event.title || 'Event', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: modalWidth - 40 }
    }).setOrigin(0.5)

    // Description
    const description = this.scene.add.text(0, -modalHeight / 2 + 160, event.description || '', {
      fontSize: '13px',
      color: '#aaaaaa',
      align: 'center',
      wordWrap: { width: modalWidth - 40 },
      lineSpacing: 4
    }).setOrigin(0.5, 0)

    container.add([overlay, modalBg, headerBar, typeLabel, icon, title, description])

    // Timer display if event has duration
    if (event.duration_minutes && event.duration_minutes > 0) {
      const timerY = -modalHeight / 2 + 220

      const timerBg = this.scene.add.rectangle(0, timerY, 120, 28, 0x333333, 0.8)
      container.add(timerBg)

      const timerIcon = this.scene.add.text(-45, timerY, '⏱', {
        fontSize: '14px'
      }).setOrigin(0.5)
      container.add(timerIcon)

      const timerText = this.scene.add.text(5, timerY, `${event.duration_minutes}:00`, {
        fontSize: '14px',
        color: '#f59e0b',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5)
      container.add(timerText)

      // Store timer reference for updates
      container.setData('timerText', timerText)
      container.setData('remainingSeconds', event.duration_minutes * 60)

      // Update timer every second
      const timerEvent = this.scene.time.addEvent({
        delay: 1000,
        loop: true,
        callback: () => {
          let remaining = container.getData('remainingSeconds') - 1
          container.setData('remainingSeconds', remaining)

          if (remaining <= 0) {
            timerEvent.remove()
            // Auto-dismiss when timer expires
            this.dismissEvent(container, event, 'expired')
          } else {
            const mins = Math.floor(remaining / 60)
            const secs = remaining % 60
            timerText.setText(`${mins}:${secs.toString().padStart(2, '0')}`)

            // Flash red when low
            if (remaining <= 10) {
              timerText.setColor('#ef4444')
            }
          }
        }
      })

      container.setData('timerEvent', timerEvent)
    }

    // Effect preview if applicable
    if (event.effect_type && event.effect_value) {
      const effectY = event.duration_minutes ? -modalHeight / 2 + 255 : -modalHeight / 2 + 220

      let effectText = ''
      switch (event.effect_type) {
        case 'cash':
          effectText = `💵 ${event.effect_value > 0 ? '+' : ''}$${Math.abs(event.effect_value).toLocaleString()}`
          break
        case 'xp':
          effectText = `⚡ ${event.effect_value > 0 ? '+' : ''}${event.effect_value} XP`
          break
        case 'heat':
          effectText = `🔥 Heat ${event.effect_value > 0 ? '+' : ''}${event.effect_value}%`
          break
        case 'bonus':
          effectText = `📈 ${event.effect_value}x Bonus`
          break
        default:
          effectText = `${event.effect_type}: ${event.effect_value}`
      }

      const effectDisplay = this.scene.add.text(0, effectY, effectText, {
        fontSize: '16px',
        color: event.effect_value >= 0 ? '#22c55e' : '#ef4444',
        fontStyle: 'bold'
      }).setOrigin(0.5)
      container.add(effectDisplay)
    }

    // Choice buttons or default OK button
    const buttonY = modalHeight / 2 - 40

    if (hasChoices) {
      const buttonWidth = (modalWidth - 60) / Math.min(choiceCount, 2)
      const buttonHeight = 40

      event.choices.forEach((choice, index) => {
        const row = Math.floor(index / 2)
        const col = index % 2
        const buttonsInRow = Math.min(choiceCount - row * 2, 2)
        const rowWidth = buttonsInRow * buttonWidth + (buttonsInRow - 1) * 10

        const x = -rowWidth / 2 + buttonWidth / 2 + col * (buttonWidth + 10)
        const y = buttonY - (Math.ceil(choiceCount / 2) - 1 - row) * (buttonHeight + 10)

        const btnColor = choice.type === 'danger' ? 0xef4444 :
          choice.type === 'success' ? 0x22c55e : 0x3b82f6

        const btn = this.scene.add.rectangle(x, y, buttonWidth, buttonHeight, btnColor, 0.95)
          .setInteractive({ useHandCursor: true })

        const btnText = this.scene.add.text(x, y, choice.label, {
          fontSize: '13px',
          color: '#ffffff',
          fontStyle: 'bold'
        }).setOrigin(0.5)

        btn.on('pointerover', () => btn.setAlpha(1))
        btn.on('pointerout', () => btn.setAlpha(0.95))
        btn.on('pointerdown', () => {
          this.dismissEvent(container, event, choice.action)
        })

        container.add([btn, btnText])
      })
    } else {
      // Default OK/Dismiss button
      const btn = this.scene.add.rectangle(0, buttonY, 140, 44, config.color, 0.95)
        .setInteractive({ useHandCursor: true })

      const btnText = this.scene.add.text(0, buttonY, event.mandatory ? 'ACCEPT' : 'OK', {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5)

      btn.on('pointerover', () => btn.setAlpha(1))
      btn.on('pointerout', () => btn.setAlpha(0.95))
      btn.on('pointerdown', () => {
        this.dismissEvent(container, event, 'ok')
      })

      container.add([btn, btnText])
    }

    // Close X button (if not mandatory)
    if (!event.mandatory) {
      const closeBtn = this.scene.add.text(modalWidth / 2 - 15, -modalHeight / 2 + 15, '✕', {
        fontSize: '20px',
        color: '#ffffff'
      }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })

      closeBtn.on('pointerover', () => closeBtn.setColor('#ef4444'))
      closeBtn.on('pointerout', () => closeBtn.setColor('#ffffff'))
      closeBtn.on('pointerdown', () => this.dismissEvent(container, event, 'dismissed'))

      container.add(closeBtn)
    }

    // Store reference
    this.currentEventModal = container

    // Animate in
    container.setScale(0.8)
    container.setAlpha(0)

    this.scene.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.out'
    })
  }

  /**
   * Dismiss the current event modal
   */
  dismissEvent(container, event, action) {
    // Cancel timer if exists
    const timerEvent = container.getData('timerEvent')
    if (timerEvent) {
      timerEvent.remove()
    }

    // Call onChoice callback if provided
    if (event.onChoice && typeof event.onChoice === 'function') {
      event.onChoice(action, event)
    }

    // Animate out
    this.scene.tweens.add({
      targets: container,
      scale: 0.8,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        container.destroy()
        this.currentEventModal = null
        this.isShowingEvent = false

        // Process queue
        this.scene.time.delayedCall(200, () => {
          this.processEventQueue()
        })
      }
    })
  }

  /**
   * Process queued events
   */
  processEventQueue() {
    if (this.eventQueue.length === 0) return
    if (this.isShowingEvent) return

    const event = this.eventQueue.shift()
    this.showEvent(event)
  }

  // ==========================================================================
  // ACHIEVEMENT NOTIFICATIONS
  // ==========================================================================

  /**
   * Show achievement notification (delegates to AchievementPopup)
   * @param {Object} achievement
   */
  showAchievement(achievement) {
    if (!this.scene) return
    audioManager.playAchievement()
    achievementPopup.setScene(this.scene)
    achievementPopup.show(achievement)
  }

  /**
   * Show multiple achievements
   * @param {Array} achievements
   */
  showAchievements(achievements) {
    if (!this.scene || !achievements || achievements.length === 0) return
    audioManager.playAchievement()
    achievementPopup.setScene(this.scene)
    achievementPopup.showMultiple(achievements)
  }

  // ==========================================================================
  // FLOATING TEXT (CASH/XP GAINS)
  // ==========================================================================

  /**
   * Show floating text that rises and fades
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} text - Text to display
   * @param {number} color - Hex color (default: green)
   * @param {number} fontSize - Font size (default: 18)
   */
  showGain(x, y, text, color = 0x22c55e, fontSize = 18) {
    if (!this.scene || !this.scene.sys.isActive()) return

    const colorHex = `#${color.toString(16).padStart(6, '0')}`

    const floatText = this.scene.add.text(x, y, text, {
      fontSize: `${fontSize}px`,
      color: colorHex,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5)
      .setDepth(2500)

    // Float up and fade animation
    this.scene.tweens.add({
      targets: floatText,
      y: y - 60,
      alpha: { from: 1, to: 0 },
      scale: { from: 1, to: 1.3 },
      duration: 1500,
      ease: 'Power2',
      onComplete: () => {
        floatText.destroy()
      }
    })
  }

  /**
   * Show cash gain with formatted amount and particles
   * @param {number} x
   * @param {number} y
   * @param {number} amount
   */
  showCashGain(x, y, amount) {
    if (!this.scene || !this.scene.sys.isActive()) return

    const sign = amount >= 0 ? '+' : ''
    const color = amount >= 0 ? 0x22c55e : 0xef4444
    this.showGain(x, y, `${sign}$${Math.abs(amount).toLocaleString()}`, color)

    // Add cash particle burst for gains
    if (amount > 0) {
      ParticleHelper.cashBurst(this.scene, x, y, amount)
    }
  }

  /**
   * Show XP gain with sparkle effect
   * @param {number} x
   * @param {number} y
   * @param {number} amount
   */
  showXPGain(x, y, amount) {
    if (!this.scene || !this.scene.sys.isActive()) return

    this.showGain(x, y, `+${amount} XP`, 0x8b5cf6)

    // Add XP sparkle effect
    ParticleHelper.xpSparkle(this.scene, x, y)
  }

  /**
   * Show respect gain
   * @param {number} x
   * @param {number} y
   * @param {number} amount
   */
  showRespectGain(x, y, amount) {
    const sign = amount >= 0 ? '+' : ''
    const color = amount >= 0 ? 0xf59e0b : 0xef4444
    this.showGain(x, y, `${sign}${amount} ⭐`, color)
  }

  // ==========================================================================
  // SPECIAL NOTIFICATIONS
  // ==========================================================================

  /**
   * Show success effect with confetti
   */
  showSuccess() {
    if (!this.scene || !this.scene.sys.isActive()) return

    AnimationHelper.successFlash(this.scene)
    ParticleHelper.successConfetti(this.scene)
  }

  /**
   * Show failure effect with smoke and shake
   * @param {number} x - Optional center X
   * @param {number} y - Optional center Y
   */
  showFailure(x, y) {
    if (!this.scene || !this.scene.sys.isActive()) return

    const { width, height } = this.scene.cameras.main
    const centerX = x || width / 2
    const centerY = y || height / 2

    AnimationHelper.failureFlash(this.scene)
    AnimationHelper.cameraShake(this.scene, 300, 0.02)
    ParticleHelper.failSmoke(this.scene, centerX, centerY)
  }

  /**
   * Show level up notification with explosion effect and banner
   * @param {number} newLevel
   */
  showLevelUp(newLevel) {
    if (!this.scene || !this.scene.sys.isActive()) return

    const { width, height } = this.scene.cameras.main

    // Trigger the big level up explosion effect
    ParticleHelper.levelUpExplosion(this.scene)

    // Create celebration banner
    const bannerY = height / 2 - 50

    // Background flash
    const flash = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x8b5cf6, 0.3)
      .setDepth(998)
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 500,
      onComplete: () => flash.destroy()
    })

    // Main banner background
    const banner = this.scene.add.rectangle(width / 2, bannerY, 300, 100, 0x1a1a2e, 0.95)
      .setStrokeStyle(3, 0x8b5cf6, 1)
      .setDepth(999)
      .setScale(0)

    // "LEVEL UP!" text
    const levelUpText = this.scene.add.text(width / 2, bannerY - 15, 'LEVEL UP!', {
      fontSize: '32px',
      color: '#c4b5fd',
      fontStyle: 'bold',
      stroke: '#4c1d95',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(1000).setScale(0)

    // New level text
    const newLevelText = this.scene.add.text(width / 2, bannerY + 25, `Level ${newLevel}`, {
      fontSize: '24px',
      color: '#a855f7',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1000).setScale(0)

    // Animate banner in
    this.scene.tweens.add({
      targets: [banner, levelUpText, newLevelText],
      scale: 1,
      duration: 400,
      ease: 'Back.easeOut'
    })

    // Add glow pulse to text
    this.scene.tweens.add({
      targets: levelUpText,
      alpha: { from: 1, to: 0.7 },
      duration: 300,
      yoyo: true,
      repeat: 3
    })

    // Play level up sound
    try {
      audioManager.playLevelUp()
    } catch (e) { /* ignore */ }

    // Animate banner out after delay
    this.scene.time.delayedCall(2500, () => {
      this.scene.tweens.add({
        targets: [banner, levelUpText, newLevelText],
        scale: 0,
        alpha: 0,
        duration: 300,
        ease: 'Back.easeIn',
        onComplete: () => {
          banner.destroy()
          levelUpText.destroy()
          newLevelText.destroy()
        }
      })
    })
  }

  /**
   * Show jail notification
   * @param {number} duration - Jail duration in minutes
   */
  showJailed(duration) {
    this.showEvent({
      type: 'threat',
      title: '🚔 BUSTED!',
      description: `You were caught and sent to jail!\n\nYou will be released in ${duration} minutes, or you can try to escape or pay bail.`,
      mandatory: true,
      choices: [
        { label: 'Pay Bail', action: 'bail', type: 'success' },
        { label: 'Try Escape', action: 'escape', type: 'danger' },
        { label: 'Wait it Out', action: 'wait' }
      ]
    })
  }

  /**
   * Show death/hospital notification
   */
  showHospitalized() {
    this.showEvent({
      type: 'threat',
      title: '🏥 HOSPITALIZED',
      description: 'You were badly injured and taken to the hospital.\n\nYou will recover shortly.',
      mandatory: true,
      duration_minutes: 5
    })
  }

  // ==========================================================================
  // NETWORK MESSAGE NOTIFICATIONS (THE NETWORK integration)
  // ==========================================================================

  /**
   * Show a Network-style encrypted message notification
   * This is the message popup style from THE NETWORK paradigm
   * @param {object} message - Network message object
   * @param {string} message.from.name - Sender name
   * @param {string} message.from.avatar - Sender avatar like [F], [W]
   * @param {string} message.subject - Message subject
   * @param {function} onView - Callback when VIEW is clicked
   * @param {function} onLater - Callback when LATER is clicked
   */
  showNetworkMessage(message, onView, onLater) {
    if (!this.scene || !this.scene.sys.isActive()) return

    // Play notification sound
    audioManager.playNotification()

    const { width, height } = this.scene.cameras.main

    // Container
    const container = this.scene.add.container(width / 2, -100)
    container.setDepth(3100)

    // Notification dimensions
    const notifWidth = Math.min(320, width - 40)
    const notifHeight = 100

    // Background - Network dark theme
    const bg = this.scene.add.rectangle(0, 0, notifWidth, notifHeight, 0x0d1117, 0.98)
    bg.setStrokeStyle(2, 0x00ff88, 0.8)

    // Encrypted badge
    const lockIcon = this.scene.add.text(-notifWidth / 2 + 15, -notifHeight / 2 + 15, '🔒', {
      fontSize: '12px'
    }).setOrigin(0, 0.5)

    const encryptedText = this.scene.add.text(-notifWidth / 2 + 32, -notifHeight / 2 + 15, 'NEW ENCRYPTED MSG', {
      fontSize: '10px',
      color: '#00ff88',
      fontFamily: 'Courier New, monospace',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5)

    // Sender avatar
    const avatar = this.scene.add.text(-notifWidth / 2 + 25, 5, message.from?.avatar || '[?]', {
      fontSize: '18px',
      color: '#00ff88',
      fontFamily: 'Courier New, monospace'
    }).setOrigin(0.5)

    // Sender name
    const senderName = this.scene.add.text(-notifWidth / 2 + 50, -5, message.from?.name || 'Unknown', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5)

    // Subject preview (truncated)
    let subject = message.subject || 'No subject'
    if (subject.length > 30) subject = subject.substring(0, 30) + '...'
    const subjectText = this.scene.add.text(-notifWidth / 2 + 50, 15, `"${subject}"`, {
      fontSize: '11px',
      color: '#9ca3af',
      fontStyle: 'italic'
    }).setOrigin(0, 0.5)

    // Buttons
    const btnWidth = 70
    const btnHeight = 28
    const btnY = 35

    // VIEW button
    const viewBtn = this.scene.add.rectangle(-btnWidth / 2 - 10, btnY, btnWidth, btnHeight, 0x00ff88, 0.9)
      .setInteractive({ useHandCursor: true })
    const viewText = this.scene.add.text(-btnWidth / 2 - 10, btnY, 'VIEW', {
      fontSize: '11px',
      color: '#000000',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    viewBtn.on('pointerover', () => viewBtn.setAlpha(1))
    viewBtn.on('pointerout', () => viewBtn.setAlpha(0.9))
    viewBtn.on('pointerdown', () => {
      this.dismissNetworkMessage(container)
      if (onView) onView()
    })

    // LATER button
    const laterBtn = this.scene.add.rectangle(btnWidth / 2 + 10, btnY, btnWidth, btnHeight, 0x333333, 0.9)
      .setStrokeStyle(1, 0x555555)
      .setInteractive({ useHandCursor: true })
    const laterText = this.scene.add.text(btnWidth / 2 + 10, btnY, 'LATER', {
      fontSize: '11px',
      color: '#888888',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    laterBtn.on('pointerover', () => {
      laterBtn.setFillStyle(0x444444)
      laterText.setColor('#ffffff')
    })
    laterBtn.on('pointerout', () => {
      laterBtn.setFillStyle(0x333333)
      laterText.setColor('#888888')
    })
    laterBtn.on('pointerdown', () => {
      this.dismissNetworkMessage(container)
      if (onLater) onLater()
    })

    container.add([bg, lockIcon, encryptedText, avatar, senderName, subjectText, viewBtn, viewText, laterBtn, laterText])

    // Store reference
    container.setData('isNetworkNotif', true)

    // Slide in animation
    this.scene.tweens.add({
      targets: container,
      y: 70,
      duration: 400,
      ease: 'Back.out'
    })

    // Auto-dismiss after 8 seconds if no interaction
    this.scene.time.delayedCall(8000, () => {
      if (container.scene) {
        this.dismissNetworkMessage(container)
        if (onLater) onLater()
      }
    })
  }

  /**
   * Dismiss a Network message notification
   */
  dismissNetworkMessage(container) {
    if (!container || !container.scene) return

    this.scene.tweens.add({
      targets: container,
      y: -120,
      alpha: 0,
      duration: 250,
      ease: 'Power2',
      onComplete: () => {
        if (container.scene) container.destroy()
      }
    })
  }

  // ==========================================================================
  // UTILITY
  // ==========================================================================

  /**
   * Check if any notifications are active
   */
  isActive() {
    return this.activeToasts.length > 0 || this.isShowingEvent
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    this.clearAllToasts()
    if (this.currentEventModal) {
      this.currentEventModal.destroy()
      this.currentEventModal = null
    }
    this.isShowingEvent = false
    this.eventQueue = []
  }
}

// Singleton instance
export const notificationManager = new NotificationManagerClass()
export default notificationManager
