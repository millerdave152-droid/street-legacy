/**
 * EmptyState - Reusable empty state component
 *
 * Shows a friendly message when a list or container is empty
 *
 * Usage:
 *   import { EmptyState } from '../ui/EmptyState'
 *
 *   // In your scene:
 *   EmptyState.show(this, x, y, {
 *     icon: '📦',
 *     title: 'No Items',
 *     message: 'Your inventory is empty'
 *   })
 */

import { COLORS_HEX } from '../config/Constants'

export class EmptyState {
  /**
   * Show an empty state component
   * @param {Phaser.Scene} scene - The scene to add the component to
   * @param {number} x - X position (center)
   * @param {number} y - Y position (center)
   * @param {Object} options - Configuration options
   * @param {string} options.icon - Emoji icon to display
   * @param {string} options.title - Title text
   * @param {string} options.message - Description message
   * @param {number} options.width - Container width (default: 280)
   * @param {string} options.actionText - Optional action button text
   * @param {Function} options.onAction - Optional action button callback
   * @returns {Phaser.GameObjects.Container} The created container
   */
  static show(scene, x, y, options = {}) {
    const {
      icon = '📭',
      title = 'Nothing Here',
      message = 'No items to display',
      width = 280,
      actionText = null,
      onAction = null
    } = options

    const container = scene.add.container(x, y)

    // Icon background circle
    const iconBg = scene.add.circle(0, -30, 40, 0x1e293b, 0.8)
    container.add(iconBg)

    // Icon
    const iconText = scene.add.text(0, -30, icon, {
      fontSize: '36px'
    }).setOrigin(0.5)
    container.add(iconText)

    // Title
    const titleText = scene.add.text(0, 30, title, {
      fontSize: '18px',
      color: COLORS_HEX.WHITE,
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    container.add(titleText)

    // Message
    const messageText = scene.add.text(0, 60, message, {
      fontSize: '13px',
      color: COLORS_HEX.GRAY,
      align: 'center',
      wordWrap: { width: width - 40 }
    }).setOrigin(0.5)
    container.add(messageText)

    // Optional action button
    if (actionText && onAction) {
      const buttonY = 100

      const btn = scene.add.rectangle(0, buttonY, 160, 40, 0x3b82f6)
        .setInteractive({ useHandCursor: true })

      const btnText = scene.add.text(0, buttonY, actionText, {
        fontSize: '14px',
        color: '#ffffff'
      }).setOrigin(0.5)

      btn.on('pointerover', () => btn.setFillStyle(0x2563eb))
      btn.on('pointerout', () => btn.setFillStyle(0x3b82f6))
      btn.on('pointerdown', () => onAction())

      container.add([btn, btnText])
    }

    // Fade in animation
    container.setAlpha(0)
    scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 300,
      ease: 'Power2'
    })

    return container
  }

  /**
   * Create a loading indicator
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {string} message - Loading message
   * @returns {Phaser.GameObjects.Container}
   */
  static showLoading(scene, x, y, message = 'Loading...') {
    const container = scene.add.container(x, y)

    // Loading spinner (simple rotating dots)
    const dots = []
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const dotX = Math.cos(angle) * 20
      const dotY = Math.sin(angle) * 20
      const alpha = (i + 1) / 8

      const dot = scene.add.circle(dotX, dotY, 4, 0x8b5cf6, alpha)
      dots.push(dot)
      container.add(dot)
    }

    // Rotate the container
    scene.tweens.add({
      targets: container,
      angle: 360,
      duration: 1000,
      repeat: -1,
      ease: 'Linear'
    })

    // Message
    const messageText = scene.add.text(0, 45, message, {
      fontSize: '14px',
      color: COLORS_HEX.GRAY
    }).setOrigin(0.5)
    container.add(messageText)

    // Mark as loading indicator for easy cleanup
    container.setData('isLoadingIndicator', true)

    return container
  }

  /**
   * Hide loading indicator
   * @param {Phaser.Scene} scene
   */
  static hideLoading(scene) {
    scene.children.list.forEach(child => {
      if (child.getData && child.getData('isLoadingIndicator')) {
        scene.tweens.add({
          targets: child,
          alpha: 0,
          duration: 200,
          onComplete: () => child.destroy()
        })
      }
    })
  }

  /**
   * Show error state
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {string} message
   * @param {Function} onRetry - Optional retry callback
   * @returns {Phaser.GameObjects.Container}
   */
  static showError(scene, x, y, message = 'Something went wrong', onRetry = null) {
    return this.show(scene, x, y, {
      icon: '⚠️',
      title: 'Error',
      message: message,
      actionText: onRetry ? 'Try Again' : null,
      onAction: onRetry
    })
  }

  /**
   * Show offline state
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @returns {Phaser.GameObjects.Container}
   */
  static showOffline(scene, x, y) {
    return this.show(scene, x, y, {
      icon: '📡',
      title: 'No Connection',
      message: 'Check your internet connection and try again'
    })
  }
}

export default EmptyState
