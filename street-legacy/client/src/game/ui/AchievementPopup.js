/**
 * AchievementPopup - Singleton notification manager for achievement popups
 *
 * Features:
 * - Slides in from top when achievement is unlocked
 * - Shows icon, name, "Achievement Unlocked!"
 * - Auto-dismisses after 3 seconds
 * - Tap to go to achievements scene
 * - Queue system (shows one at a time)
 *
 * Usage:
 *   import { achievementPopup } from '../ui/AchievementPopup'
 *   achievementPopup.show(achievement)
 */

class AchievementPopupManager {
  constructor() {
    this.scene = null
    this.queue = []
    this.isShowing = false
    this.currentPopup = null
    this.dismissTimer = null
  }

  /**
   * Set the current Phaser scene to render popups in
   * @param {Phaser.Scene} scene - The active Phaser scene
   */
  setScene(scene) {
    this.scene = scene
  }

  /**
   * Show an achievement popup
   * @param {Object} achievement - Achievement data
   * @param {string} achievement.id - Achievement ID
   * @param {string} achievement.name - Achievement name
   * @param {string} achievement.icon - Achievement icon emoji
   * @param {string} achievement.description - Achievement description
   * @param {number} achievement.cash_reward - Cash reward amount
   * @param {number} achievement.xp_reward - XP reward amount
   */
  show(achievement) {
    if (!achievement) return

    // Add to queue
    this.queue.push(achievement)

    // If not currently showing, start showing
    if (!this.isShowing) {
      this.showNext()
    }
  }

  /**
   * Show multiple achievements (adds all to queue)
   * @param {Array} achievements - Array of achievement objects
   */
  showMultiple(achievements) {
    if (!achievements || !Array.isArray(achievements)) return

    achievements.forEach(achievement => {
      this.queue.push(achievement)
    })

    if (!this.isShowing) {
      this.showNext()
    }
  }

  /**
   * Show the next achievement in the queue
   */
  showNext() {
    if (this.queue.length === 0) {
      this.isShowing = false
      return
    }

    if (!this.scene || !this.scene.sys.isActive()) {
      // Scene not available, try again later
      setTimeout(() => this.showNext(), 500)
      return
    }

    this.isShowing = true
    const achievement = this.queue.shift()
    this.renderPopup(achievement)
  }

  /**
   * Render the popup UI
   * @param {Object} achievement - Achievement to display
   */
  renderPopup(achievement) {
    const { width } = this.scene.cameras.main
    const popupWidth = Math.min(320, width - 40)
    const popupHeight = 80
    const startY = -popupHeight
    const targetY = 60

    // Container for all popup elements
    const container = this.scene.add.container(width / 2, startY)
    container.setDepth(2000) // Above everything

    // Background with gradient effect
    const bg = this.scene.add.rectangle(0, 0, popupWidth, popupHeight, 0x1a1a2e, 0.98)
    bg.setStrokeStyle(2, 0xf59e0b)

    // Golden accent bar at top
    const accentBar = this.scene.add.rectangle(0, -popupHeight / 2 + 3, popupWidth, 6, 0xf59e0b)

    // Icon background
    const iconBg = this.scene.add.rectangle(-popupWidth / 2 + 45, 0, 55, 55, 0xf59e0b, 0.2)

    // Icon
    const icon = this.scene.add.text(-popupWidth / 2 + 45, 0, achievement.icon || '🏆', {
      fontSize: '32px'
    }).setOrigin(0.5)

    // "Achievement Unlocked!" text
    const titleText = this.scene.add.text(-popupWidth / 2 + 85, -15, '🎉 Achievement Unlocked!', {
      fontSize: '11px',
      color: '#f59e0b',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5)

    // Achievement name
    const nameText = this.scene.add.text(-popupWidth / 2 + 85, 8, achievement.name || 'Unknown', {
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5)

    // Rewards preview
    let rewardStr = ''
    if (achievement.cash_reward) {
      rewardStr += `💵 $${achievement.cash_reward.toLocaleString()}`
    }
    if (achievement.xp_reward) {
      if (rewardStr) rewardStr += '  '
      rewardStr += `⚡ +${achievement.xp_reward} XP`
    }

    const rewardsText = this.scene.add.text(-popupWidth / 2 + 85, 28, rewardStr || 'Tap to claim!', {
      fontSize: '10px',
      color: '#888888'
    }).setOrigin(0, 0.5)

    // Tap hint
    const tapHint = this.scene.add.text(popupWidth / 2 - 10, 0, '👆', {
      fontSize: '16px'
    }).setOrigin(1, 0.5).setAlpha(0.6)

    // Add all elements to container
    container.add([bg, accentBar, iconBg, icon, titleText, nameText, rewardsText, tapHint])

    // Make interactive
    bg.setInteractive({ useHandCursor: true })

    // Tap to go to achievements
    bg.on('pointerdown', () => {
      this.dismiss()
      // Navigate to achievements scene
      if (this.scene && this.scene.scene) {
        this.scene.scene.launch('AchievementsScene')
        this.scene.scene.pause()
      }
    })

    // Hover effect
    bg.on('pointerover', () => {
      bg.setFillStyle(0x2a2a4e, 0.98)
    })

    bg.on('pointerout', () => {
      bg.setFillStyle(0x1a1a2e, 0.98)
    })

    // Store reference
    this.currentPopup = container

    // Slide in animation
    this.scene.tweens.add({
      targets: container,
      y: targetY,
      duration: 400,
      ease: 'Back.out',
      onComplete: () => {
        // Start auto-dismiss timer
        this.dismissTimer = this.scene.time.delayedCall(3000, () => {
          this.dismiss()
        })
      }
    })

    // Subtle glow pulse animation
    this.scene.tweens.add({
      targets: bg,
      alpha: { from: 0.98, to: 1 },
      duration: 800,
      yoyo: true,
      repeat: 3
    })
  }

  /**
   * Dismiss the current popup
   */
  dismiss() {
    if (!this.currentPopup || !this.scene) return

    // Cancel auto-dismiss timer
    if (this.dismissTimer) {
      this.dismissTimer.remove()
      this.dismissTimer = null
    }

    const container = this.currentPopup

    // Slide out animation
    this.scene.tweens.add({
      targets: container,
      y: -100,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        container.destroy()
        this.currentPopup = null

        // Show next in queue after a brief delay
        this.scene.time.delayedCall(200, () => {
          this.showNext()
        })
      }
    })
  }

  /**
   * Clear all queued popups
   */
  clearQueue() {
    this.queue = []
  }

  /**
   * Force dismiss current popup and clear queue
   */
  dismissAll() {
    this.clearQueue()
    if (this.currentPopup) {
      this.dismiss()
    }
  }

  /**
   * Check if there are pending popups
   * @returns {boolean}
   */
  hasPending() {
    return this.queue.length > 0 || this.isShowing
  }
}

// Singleton instance
export const achievementPopup = new AchievementPopupManager()
export default achievementPopup
