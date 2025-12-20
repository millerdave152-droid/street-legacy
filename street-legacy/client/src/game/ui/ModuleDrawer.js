/**
 * ModuleDrawer - Slide-out drawer for OS-style module navigation
 *
 * Inspired by iOS/Android drawer patterns with hacker terminal aesthetic.
 * Slides from right edge, shows sub-options for each module.
 */

import { COLORS, BORDERS, toHexString, getTerminalStyle } from './NetworkTheme'
import { audioManager } from '../managers/AudioManager'

export class ModuleDrawer {
  constructor(scene) {
    this.scene = scene
    this.isOpen = false
    this.currentModule = null
    this.container = null
    this.overlay = null
    this.drawerWidth = 200
    this.animationDuration = 200
  }

  /**
   * Open the drawer with module options
   * @param {Object} moduleConfig - Module configuration
   * @param {string} moduleConfig.name - Module name (e.g., 'OPERATIONS')
   * @param {number} moduleConfig.color - Module accent color
   * @param {string} moduleConfig.icon - Module icon (e.g., '[!]')
   * @param {Array} moduleConfig.options - Sub-options array
   * @param {Function} onSelect - Callback when option selected
   */
  open(moduleConfig, onSelect) {
    if (this.isOpen) {
      this.close()
      return
    }

    this.isOpen = true
    this.currentModule = moduleConfig
    this.onSelectCallback = onSelect

    const { width, height } = this.scene.cameras.main

    // Create container for all drawer elements
    this.container = this.scene.add.container(width, 0)
    this.container.setDepth(1000)

    // Dark overlay (tap to close)
    this.overlay = this.scene.add.rectangle(
      -width / 2, height / 2,
      width, height,
      0x000000, 0
    )
    this.overlay.setInteractive()
    this.overlay.on('pointerdown', () => this.close())
    this.container.add(this.overlay)

    // Drawer panel background
    const panelX = -this.drawerWidth / 2
    const panelBg = this.scene.add.rectangle(
      panelX, height / 2,
      this.drawerWidth, height,
      COLORS.bg.screen, 0.95
    )
    panelBg.setStrokeStyle(BORDERS.medium, moduleConfig.color, 0.8)
    this.container.add(panelBg)

    // Glow effect on left edge
    const glowLine = this.scene.add.rectangle(
      panelX - this.drawerWidth / 2 + 2, height / 2,
      4, height,
      moduleConfig.color, 0.4
    )
    this.container.add(glowLine)

    // Module header
    const headerY = 80
    const headerBg = this.scene.add.rectangle(
      panelX, headerY,
      this.drawerWidth - 20, 50,
      moduleConfig.color, 0.15
    )
    headerBg.setStrokeStyle(1, moduleConfig.color, 0.4)
    this.container.add(headerBg)

    // Module icon
    const iconText = this.scene.add.text(
      panelX - 60, headerY,
      moduleConfig.icon,
      {
        ...getTerminalStyle('lg'),
        color: toHexString(moduleConfig.color)
      }
    ).setOrigin(0.5)
    this.container.add(iconText)

    // Module name
    const nameText = this.scene.add.text(
      panelX - 20, headerY,
      moduleConfig.name,
      {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '14px',
        color: toHexString(COLORS.text.primary),
        fontStyle: 'bold'
      }
    ).setOrigin(0, 0.5)
    this.container.add(nameText)

    // Options list
    const optionStartY = headerY + 60
    const optionHeight = 70
    const optionSpacing = 8

    moduleConfig.options.forEach((option, index) => {
      const optionY = optionStartY + index * (optionHeight + optionSpacing)
      this.createOptionCard(panelX, optionY, option, moduleConfig.color, index)
    })

    // Close hint at bottom
    const closeHint = this.scene.add.text(
      panelX, height - 40,
      '[ tap outside to close ]',
      {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '9px',
        color: toHexString(COLORS.text.muted)
      }
    ).setOrigin(0.5).setAlpha(0.6)
    this.container.add(closeHint)

    // Animate in
    this.scene.tweens.add({
      targets: this.container,
      x: width - this.drawerWidth,
      duration: this.animationDuration,
      ease: 'Back.out'
    })

    // Fade in overlay
    this.scene.tweens.add({
      targets: this.overlay,
      fillAlpha: 0.5,
      duration: this.animationDuration
    })

    // Dim the rest of the scene (optional - tell GameScene)
    if (this.scene.onDrawerOpen) {
      this.scene.onDrawerOpen()
    }
  }

  /**
   * Create an option card within the drawer
   */
  createOptionCard(x, y, option, moduleColor, index) {
    const cardWidth = this.drawerWidth - 30
    const cardHeight = 65

    // Card background
    const cardBg = this.scene.add.rectangle(
      x, y,
      cardWidth, cardHeight,
      COLORS.bg.card, 0.9
    )
    cardBg.setStrokeStyle(1, COLORS.network.dim, 0.4)
    this.container.add(cardBg)

    // Option icon
    const iconText = this.scene.add.text(
      x - cardWidth / 2 + 25, y - 10,
      option.icon,
      {
        ...getTerminalStyle('sm'),
        color: toHexString(option.color || moduleColor)
      }
    ).setOrigin(0.5)
    this.container.add(iconText)

    // Option label
    const labelText = this.scene.add.text(
      x - cardWidth / 2 + 50, y - 10,
      option.label,
      {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '13px',
        color: toHexString(COLORS.text.primary),
        fontStyle: 'bold'
      }
    ).setOrigin(0, 0.5)
    this.container.add(labelText)

    // Option stat/count
    const statText = this.scene.add.text(
      x - cardWidth / 2 + 50, y + 12,
      option.stat || '',
      {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '10px',
        color: toHexString(COLORS.text.muted)
      }
    ).setOrigin(0, 0.5)
    this.container.add(statText)

    // Arrow indicator
    const arrowText = this.scene.add.text(
      x + cardWidth / 2 - 20, y,
      '>',
      {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '16px',
        color: toHexString(COLORS.text.muted)
      }
    ).setOrigin(0.5)
    this.container.add(arrowText)

    // Interactive
    cardBg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        cardBg.setFillStyle(COLORS.bg.elevated, 1)
        cardBg.setStrokeStyle(1, option.color || moduleColor, 0.8)
        iconText.setColor(toHexString(COLORS.network.glow))
        arrowText.setColor(toHexString(option.color || moduleColor))
        audioManager.playHover()
      })
      .on('pointerout', () => {
        cardBg.setFillStyle(COLORS.bg.card, 0.9)
        cardBg.setStrokeStyle(1, COLORS.network.dim, 0.4)
        iconText.setColor(toHexString(option.color || moduleColor))
        arrowText.setColor(toHexString(COLORS.text.muted))
      })
      .on('pointerdown', () => {
        audioManager.playClick()

        // Press animation
        this.scene.tweens.add({
          targets: cardBg,
          scaleX: 0.98,
          scaleY: 0.98,
          duration: 50,
          yoyo: true,
          onComplete: () => {
            // Close drawer and trigger callback
            this.close(() => {
              if (this.onSelectCallback) {
                this.onSelectCallback(option)
              }
            })
          }
        })
      })
  }

  /**
   * Close the drawer
   * @param {Function} onComplete - Callback after close animation
   */
  close(onComplete) {
    if (!this.isOpen) {
      if (onComplete) onComplete()
      return
    }

    this.isOpen = false
    const { width } = this.scene.cameras.main

    // Animate out
    this.scene.tweens.add({
      targets: this.container,
      x: width + 10,
      duration: this.animationDuration * 0.8,
      ease: 'Back.in',
      onComplete: () => {
        if (this.container) {
          this.container.destroy()
          this.container = null
        }
        this.overlay = null
        this.currentModule = null

        // Un-dim the scene
        if (this.scene.onDrawerClose) {
          this.scene.onDrawerClose()
        }

        if (onComplete) onComplete()
      }
    })

    // Fade out overlay
    if (this.overlay) {
      this.scene.tweens.add({
        targets: this.overlay,
        fillAlpha: 0,
        duration: this.animationDuration * 0.8
      })
    }
  }

  /**
   * Check if drawer is currently open
   */
  get open() {
    return this.isOpen
  }

  /**
   * Destroy the drawer (cleanup)
   */
  destroy() {
    if (this.container) {
      this.container.destroy()
      this.container = null
    }
    this.isOpen = false
    this.currentModule = null
  }
}

// Singleton instance for easy access
let drawerInstance = null

export function getModuleDrawer(scene) {
  if (!drawerInstance || drawerInstance.scene !== scene) {
    drawerInstance = new ModuleDrawer(scene)
  }
  return drawerInstance
}

export default ModuleDrawer
