import Phaser from 'phaser'

/**
 * NotificationManager - Handles toast notifications and event banners
 * Creates a persistent notification layer that displays over all scenes
 */
class NotificationManagerClass {
  constructor() {
    this.scene = null
    this.toastQueue = []
    this.activeToasts = []
    this.maxToasts = 3
    this.isProcessing = false
    this.eventBanner = null
  }

  /**
   * Initialize the notification manager with a Phaser scene
   * Should be called once the game is ready
   */
  initialize(scene) {
    this.scene = scene
    this.setupContainer()
  }

  setupContainer() {
    if (!this.scene) return

    const { width, height } = this.scene.cameras.main

    // Create a container for all notifications
    this.container = this.scene.add.container(0, 0).setDepth(9999)
  }

  /**
   * Show a toast notification
   * @param {Object} options - Toast options
   * @param {string} options.message - The message to display
   * @param {string} options.type - Type: 'success', 'error', 'warning', 'info', 'achievement', 'levelup'
   * @param {number} options.duration - Duration in ms (default: 3000)
   * @param {string} options.icon - Optional emoji icon
   */
  showToast({ message, type = 'info', duration = 3000, icon = null }) {
    this.toastQueue.push({ message, type, duration, icon })

    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  processQueue() {
    if (this.toastQueue.length === 0 || !this.scene) {
      this.isProcessing = false
      return
    }

    if (this.activeToasts.length >= this.maxToasts) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true

    const toast = this.toastQueue.shift()
    this.createToast(toast)

    // Process next after a short delay
    this.scene.time.delayedCall(300, () => {
      this.processQueue()
    })
  }

  createToast({ message, type, duration, icon }) {
    const { width, height } = this.scene.cameras.main

    // Get type configuration
    const config = this.getTypeConfig(type)
    const displayIcon = icon || config.icon

    // Calculate Y position based on active toasts
    const toastHeight = 50
    const padding = 10
    const startY = 80 // Below top bar
    const y = startY + this.activeToasts.length * (toastHeight + padding)

    // Create toast container
    const toastContainer = this.scene.add.container(width / 2, y - 50)
    toastContainer.setAlpha(0)

    // Background
    const bg = this.scene.add.rectangle(0, 0, 320, toastHeight, config.bgColor, 0.95)
      .setStrokeStyle(2, config.strokeColor)

    // Icon
    const iconText = this.scene.add.text(-140, 0, displayIcon, {
      fontSize: '24px'
    }).setOrigin(0.5)

    // Message
    const messageText = this.scene.add.text(-110, 0, message, {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial',
      wordWrap: { width: 230 }
    }).setOrigin(0, 0.5)

    toastContainer.add([bg, iconText, messageText])
    this.container.add(toastContainer)

    // Track active toast
    const toastData = { container: toastContainer, y }
    this.activeToasts.push(toastData)

    // Animate in
    this.scene.tweens.add({
      targets: toastContainer,
      y: y,
      alpha: 1,
      duration: 200,
      ease: 'Power2'
    })

    // Auto remove after duration
    this.scene.time.delayedCall(duration, () => {
      this.removeToast(toastData)
    })
  }

  removeToast(toastData) {
    const index = this.activeToasts.indexOf(toastData)
    if (index === -1) return

    // Animate out
    this.scene.tweens.add({
      targets: toastData.container,
      alpha: 0,
      y: toastData.y - 30,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        toastData.container.destroy()
        this.activeToasts.splice(index, 1)

        // Reposition remaining toasts
        this.repositionToasts()

        // Process more from queue
        if (this.toastQueue.length > 0 && !this.isProcessing) {
          this.processQueue()
        }
      }
    })
  }

  repositionToasts() {
    const toastHeight = 50
    const padding = 10
    const startY = 80

    this.activeToasts.forEach((toast, i) => {
      const newY = startY + i * (toastHeight + padding)
      toast.y = newY

      this.scene.tweens.add({
        targets: toast.container,
        y: newY,
        duration: 150,
        ease: 'Power2'
      })
    })
  }

  getTypeConfig(type) {
    const configs = {
      success: { bgColor: 0x166534, strokeColor: 0x22c55e, icon: '✅' },
      error: { bgColor: 0x991b1b, strokeColor: 0xef4444, icon: '❌' },
      warning: { bgColor: 0x854d0e, strokeColor: 0xeab308, icon: '⚠️' },
      info: { bgColor: 0x1e40af, strokeColor: 0x3b82f6, icon: 'ℹ️' },
      achievement: { bgColor: 0x7c2d12, strokeColor: 0xf97316, icon: '🏆' },
      levelup: { bgColor: 0x581c87, strokeColor: 0xa855f7, icon: '⬆️' },
      money: { bgColor: 0x14532d, strokeColor: 0x22c55e, icon: '💰' },
      jail: { bgColor: 0x450a0a, strokeColor: 0xb91c1c, icon: '🔒' },
      message: { bgColor: 0x4c1d95, strokeColor: 0x8b5cf6, icon: '💬' }
    }

    return configs[type] || configs.info
  }

  /**
   * Show a full-screen event banner for major events
   * @param {Object} options - Banner options
   */
  showEventBanner({ title, subtitle, icon = '🎉', type = 'info', duration = 4000, onComplete = null }) {
    if (!this.scene) return

    // Remove existing banner if any
    if (this.eventBanner) {
      this.eventBanner.destroy()
    }

    const { width, height } = this.scene.cameras.main

    // Create banner container
    this.eventBanner = this.scene.add.container(width / 2, height / 2)
    this.eventBanner.setAlpha(0)
    this.eventBanner.setScale(0.8)
    this.eventBanner.setDepth(10000)

    // Overlay background
    const overlay = this.scene.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.7)

    // Banner background
    const config = this.getTypeConfig(type)
    const bannerBg = this.scene.add.rectangle(0, 0, 350, 180, 0x1a1a2e, 0.98)
      .setStrokeStyle(3, config.strokeColor)

    // Glow effect
    const glow = this.scene.add.rectangle(0, 0, 360, 190, config.strokeColor, 0.3)

    // Icon
    const iconText = this.scene.add.text(0, -45, icon, {
      fontSize: '48px'
    }).setOrigin(0.5)

    // Title
    const titleText = this.scene.add.text(0, 15, title, {
      fontSize: '24px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5)

    // Subtitle
    const subtitleText = this.scene.add.text(0, 50, subtitle, {
      fontSize: '14px',
      color: '#94a3b8',
      align: 'center'
    }).setOrigin(0.5)

    this.eventBanner.add([overlay, glow, bannerBg, iconText, titleText, subtitleText])
    this.container.add(this.eventBanner)

    // Animate in
    this.scene.tweens.add({
      targets: this.eventBanner,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut'
    })

    // Pulse glow
    this.scene.tweens.add({
      targets: glow,
      alpha: 0.1,
      yoyo: true,
      repeat: -1,
      duration: 500
    })

    // Auto remove after duration
    this.scene.time.delayedCall(duration, () => {
      this.hideEventBanner(onComplete)
    })
  }

  hideEventBanner(onComplete = null) {
    if (!this.eventBanner) return

    this.scene.tweens.add({
      targets: this.eventBanner,
      alpha: 0,
      scale: 0.8,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        if (this.eventBanner) {
          this.eventBanner.destroy()
          this.eventBanner = null
        }
        if (onComplete) onComplete()
      }
    })
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    this.toastQueue = []

    this.activeToasts.forEach(toast => {
      toast.container.destroy()
    })
    this.activeToasts = []

    if (this.eventBanner) {
      this.eventBanner.destroy()
      this.eventBanner = null
    }
  }

  /**
   * Update on resize
   */
  handleResize(width, height) {
    // Reposition active toasts
    this.activeToasts.forEach((toast, i) => {
      toast.container.x = width / 2
    })

    // Reposition event banner
    if (this.eventBanner) {
      this.eventBanner.x = width / 2
      this.eventBanner.y = height / 2
    }
  }
}

// Export singleton instance
export const notificationManager = new NotificationManagerClass()
export default notificationManager
