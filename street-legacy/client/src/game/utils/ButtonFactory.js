/**
 * ButtonFactory - Creates polished, animated buttons for Street Legacy
 *
 * All buttons have:
 * - Hover scale animation
 * - Press feedback
 * - Optional audio integration
 * - Pulse effect for CTAs
 */

import { audioManager } from '../managers/AudioManager'

export class ButtonFactory {
  /**
   * Create a standard animated button
   * @param {Phaser.Scene} scene
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} text - Button label
   * @param {Function} callback - Click handler
   * @param {object} options - Button options
   * @returns {Phaser.GameObjects.Container}
   */
  static create(scene, x, y, text, callback, options = {}) {
    const {
      width = 200,
      height = 50,
      color = 0x4a4a6a,
      hoverColor = null,
      textColor = '#ffffff',
      fontSize = '18px',
      fontFamily = 'Arial',
      icon = null,
      iconSize = '20px',
      rounded = true,
      enabled = true,
      playSound = true,
      pulseCTA = false,
      strokeColor = null,
      strokeWidth = 0
    } = options

    // Container for button elements
    const container = scene.add.container(x, y)

    // Background
    const bg = scene.add.rectangle(0, 0, width, height, color)
    if (rounded) {
      bg.setStrokeStyle(strokeWidth || (rounded ? 2 : 0), strokeColor || color)
    }

    // Icon (if provided)
    let iconText = null
    if (icon) {
      iconText = scene.add.text(icon ? -width / 2 + 30 : 0, 0, icon, {
        fontSize: iconSize
      }).setOrigin(0.5)
    }

    // Label
    const label = scene.add.text(icon ? 10 : 0, 0, text, {
      fontSize,
      fontFamily,
      color: textColor
    }).setOrigin(0.5)

    // Add to container
    container.add([bg])
    if (iconText) container.add(iconText)
    container.add(label)

    // Store references
    container.setData('bg', bg)
    container.setData('label', label)
    container.setData('icon', iconText)
    container.setData('enabled', enabled)
    container.setData('baseColor', color)
    container.setData('hoverColor', hoverColor || Phaser.Display.Color.ValueToColor(color).lighten(20).color)

    // Make interactive
    bg.setInteractive({ useHandCursor: enabled })

    if (enabled) {
      // Hover animations
      bg.on('pointerover', () => {
        if (!container.getData('enabled')) return

        if (playSound) audioManager.playHover()

        bg.setFillStyle(container.getData('hoverColor'))

        scene.tweens.add({
          targets: container,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100,
          ease: 'Sine.out'
        })
      })

      bg.on('pointerout', () => {
        bg.setFillStyle(container.getData('baseColor'))

        scene.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: 100,
          ease: 'Sine.out'
        })
      })

      // Press animations
      bg.on('pointerdown', () => {
        if (!container.getData('enabled')) return

        if (playSound) audioManager.playClick()

        scene.tweens.add({
          targets: container,
          scaleX: 0.95,
          scaleY: 0.95,
          duration: 50,
          ease: 'Sine.out'
        })
      })

      bg.on('pointerup', () => {
        scene.tweens.add({
          targets: container,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 50,
          ease: 'Sine.out',
          onComplete: () => {
            scene.tweens.add({
              targets: container,
              scaleX: 1,
              scaleY: 1,
              duration: 100
            })
            if (container.getData('enabled') && callback) {
              callback()
            }
          }
        })
      })
    }

    // Pulse animation for CTAs
    if (pulseCTA && enabled) {
      container.setData('pulseTween', scene.tweens.add({
        targets: container,
        scaleX: 1.03,
        scaleY: 1.03,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      }))
    }

    // Helper methods
    container.setEnabled = (isEnabled) => {
      container.setData('enabled', isEnabled)
      bg.setInteractive({ useHandCursor: isEnabled })
      container.setAlpha(isEnabled ? 1 : 0.5)

      // Stop pulse if disabled
      const pulseTween = container.getData('pulseTween')
      if (pulseTween && !isEnabled) {
        pulseTween.stop()
        container.setScale(1)
      }
    }

    container.setText = (newText) => {
      label.setText(newText)
    }

    container.setButtonColor = (newColor) => {
      container.setData('baseColor', newColor)
      container.setData('hoverColor', Phaser.Display.Color.ValueToColor(newColor).lighten(20).color)
      bg.setFillStyle(newColor)
    }

    return container
  }

  /**
   * Create a primary action button (larger, more prominent)
   */
  static createPrimary(scene, x, y, text, callback, options = {}) {
    return this.create(scene, x, y, text, callback, {
      width: 240,
      height: 55,
      color: 0x22c55e,
      fontSize: '20px',
      fontFamily: 'Arial Black, Arial',
      pulseCTA: true,
      ...options
    })
  }

  /**
   * Create a danger/warning button (red)
   */
  static createDanger(scene, x, y, text, callback, options = {}) {
    return this.create(scene, x, y, text, callback, {
      color: 0xef4444,
      ...options
    })
  }

  /**
   * Create a secondary/subtle button
   */
  static createSecondary(scene, x, y, text, callback, options = {}) {
    return this.create(scene, x, y, text, callback, {
      color: 0x374151,
      textColor: '#9ca3af',
      ...options
    })
  }

  /**
   * Create an icon-only button (circular)
   */
  static createIconButton(scene, x, y, icon, callback, options = {}) {
    const {
      size = 50,
      color = 0x4a4a6a,
      iconSize = '24px',
      playSound = true,
      enabled = true
    } = options

    const container = scene.add.container(x, y)

    // Circle background
    const bg = scene.add.circle(0, 0, size / 2, color)
      .setInteractive({ useHandCursor: enabled })

    // Icon
    const iconText = scene.add.text(0, 0, icon, {
      fontSize: iconSize
    }).setOrigin(0.5)

    container.add([bg, iconText])
    container.setData('bg', bg)
    container.setData('enabled', enabled)

    if (enabled) {
      bg.on('pointerover', () => {
        if (playSound) audioManager.playHover()
        scene.tweens.add({
          targets: container,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 100
        })
      })

      bg.on('pointerout', () => {
        scene.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: 100
        })
      })

      bg.on('pointerdown', () => {
        if (playSound) audioManager.playClick()
        scene.tweens.add({
          targets: container,
          scaleX: 0.9,
          scaleY: 0.9,
          duration: 50,
          yoyo: true,
          onComplete: () => {
            if (callback) callback()
          }
        })
      })
    }

    return container
  }

  /**
   * Create a tab button for navigation
   */
  static createTab(scene, x, y, text, isActive, callback, options = {}) {
    const {
      width = 120,
      height = 40,
      activeColor = 0x3b82f6,
      inactiveColor = 0x1e293b,
      fontSize = '14px',
      playSound = true
    } = options

    const container = scene.add.container(x, y)

    const bg = scene.add.rectangle(0, 0, width, height, isActive ? activeColor : inactiveColor)
      .setInteractive({ useHandCursor: true })

    const label = scene.add.text(0, 0, text, {
      fontSize,
      color: isActive ? '#ffffff' : '#9ca3af'
    }).setOrigin(0.5)

    // Active indicator line at bottom
    const indicator = scene.add.rectangle(0, height / 2 - 2, width - 10, 3, activeColor)
      .setAlpha(isActive ? 1 : 0)

    container.add([bg, label, indicator])
    container.setData('active', isActive)
    container.setData('activeColor', activeColor)
    container.setData('inactiveColor', inactiveColor)

    bg.on('pointerover', () => {
      if (!container.getData('active')) {
        if (playSound) audioManager.playHover()
        label.setColor('#ffffff')
      }
    })

    bg.on('pointerout', () => {
      if (!container.getData('active')) {
        label.setColor('#9ca3af')
      }
    })

    bg.on('pointerdown', () => {
      if (playSound) audioManager.playTab()
      if (callback) callback()
    })

    // Method to set active state
    container.setActive = (active) => {
      container.setData('active', active)
      bg.setFillStyle(active ? activeColor : inactiveColor)
      label.setColor(active ? '#ffffff' : '#9ca3af')

      scene.tweens.add({
        targets: indicator,
        alpha: active ? 1 : 0,
        duration: 200
      })
    }

    return container
  }

  /**
   * Create a card/panel button (for action grids)
   */
  static createCard(scene, x, y, icon, label, callback, options = {}) {
    const {
      width = 120,
      height = 100,
      color = 0x2a2a4a,
      iconSize = '32px',
      fontSize = '14px',
      playSound = true,
      badge = null
    } = options

    const container = scene.add.container(x, y)

    // Background
    const bg = scene.add.rectangle(0, 0, width, height, color, 0.8)
      .setInteractive({ useHandCursor: true })

    // Icon
    const iconText = scene.add.text(0, -15, icon, {
      fontSize: iconSize
    }).setOrigin(0.5)

    // Label
    const labelText = scene.add.text(0, 25, label, {
      fontSize,
      color: '#ffffff'
    }).setOrigin(0.5)

    container.add([bg, iconText, labelText])

    // Badge (optional)
    if (badge !== null) {
      const badgeCircle = scene.add.circle(width / 2 - 10, -height / 2 + 10, 12, 0xef4444)
      const badgeText = scene.add.text(width / 2 - 10, -height / 2 + 10, badge.toString(), {
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5)

      container.add([badgeCircle, badgeText])
      container.setData('badgeCircle', badgeCircle)
      container.setData('badgeText', badgeText)

      // Pulse badge
      scene.tweens.add({
        targets: badgeCircle,
        scale: { from: 1, to: 1.2 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      })
    }

    // Hover
    bg.on('pointerover', () => {
      if (playSound) audioManager.playHover()
      bg.setFillStyle(color, 1)
      scene.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100
      })
    })

    bg.on('pointerout', () => {
      bg.setFillStyle(color, 0.8)
      scene.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 100
      })
    })

    bg.on('pointerdown', () => {
      if (playSound) audioManager.playClick()
      scene.tweens.add({
        targets: container,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          if (callback) callback()
        }
      })
    })

    // Helper to update badge
    container.setBadge = (value) => {
      const badgeText = container.getData('badgeText')
      const badgeCircle = container.getData('badgeCircle')
      if (badgeText && badgeCircle) {
        if (value > 0) {
          badgeText.setText(value > 9 ? '9+' : value.toString())
          badgeCircle.setVisible(true)
          badgeText.setVisible(true)
        } else {
          badgeCircle.setVisible(false)
          badgeText.setVisible(false)
        }
      }
    }

    return container
  }

  /**
   * Create a close (X) button
   */
  static createCloseButton(scene, x, y, callback, options = {}) {
    const {
      size = 30,
      color = '#ffffff',
      hoverColor = '#ef4444',
      fontSize = '24px',
      playSound = true
    } = options

    const btn = scene.add.text(x, y, '✕', {
      fontSize,
      color
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    btn.on('pointerover', () => {
      if (playSound) audioManager.playHover()
      btn.setColor(hoverColor)
      scene.tweens.add({
        targets: btn,
        scale: 1.2,
        duration: 100
      })
    })

    btn.on('pointerout', () => {
      btn.setColor(color)
      scene.tweens.add({
        targets: btn,
        scale: 1,
        duration: 100
      })
    })

    btn.on('pointerdown', () => {
      if (playSound) audioManager.playClick()
      scene.tweens.add({
        targets: btn,
        scale: 0.9,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          if (callback) callback()
        }
      })
    })

    return btn
  }
}

export default ButtonFactory
