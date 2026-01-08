/**
 * BaseScene - Street Legacy base class for all game scenes
 *
 * Extends CoreBaseScene with game-specific functionality:
 * - AudioManager integration
 * - NotificationManager integration
 * - NetworkTransition animations
 * - Game-themed UI helpers
 *
 * Usage:
 *   import BaseScene from './BaseScene'
 *
 *   export class MyScene extends BaseScene {
 *     constructor() {
 *       super('MyScene')
 *     }
 *
 *     create() {
 *       super.create()
 *       // Your scene setup...
 *     }
 *   }
 */

import { CoreBaseScene } from '../core/scenes/CoreBaseScene'
import { audioManager } from '../managers/AudioManager'
import { notificationManager } from '../managers/NotificationManager'
import { networkTransition } from '../ui/NetworkTransition'
import { DEPTH, getTerminalStyle } from '../ui/NetworkTheme'

export class BaseScene extends CoreBaseScene {
  constructor(key) {
    super(key, {
      onSceneReady: (scene) => {
        // Set up managers when scene is ready
        audioManager.setScene(scene)
        notificationManager.setScene(scene)
      },
      onSceneWake: (scene) => {
        // Re-initialize managers on wake
        audioManager.setScene(scene)
        notificationManager.setScene(scene)
      }
    })
  }

  /**
   * Create - set up common scene elements
   * @param {Object} options - Options for scene creation
   * @param {boolean} options.skipIntro - Skip the intro animation
   */
  create(options = {}) {
    // Call parent create
    super.create(options)

    // Play scene intro animation (unless skipped)
    // Skip for utility scenes like Settings, Boot, Preload, etc.
    const skipScenes = ['BootScene', 'PreloadScene', 'NetworkBootScene', 'MainMenuScene',
      'GameScene', 'UIScene', 'SettingsScene', 'AudioSettingsScene', 'AdminScene']
    if (!options.skipIntro && !skipScenes.includes(this.scene.key)) {
      this.time.delayedCall(100, () => {
        networkTransition.playSceneIntro(this, this.scene.key)
      })
    }
  }

  /**
   * Close this scene if it's an overlay and return to previous
   * @param {Object} data - Data to return
   * @param {boolean} animate - Whether to play exit animation
   */
  closeOverlay(data = {}, animate = true) {
    console.log(`[BaseScene] closeOverlay() called on ${this.scene.key}`)
    console.trace(`[BaseScene] closeOverlay stack trace`)
    const returnScene = this.initData?.returnScene

    if (animate) {
      // Play exit animation then close
      networkTransition.playSceneExit(this, () => {
        if (returnScene) {
          this.scene.resume(returnScene, data)
        }
        this.scene.stop()
      })
    } else {
      if (returnScene) {
        this.scene.resume(returnScene, data)
      }
      this.scene.stop()
    }
  }

  // ==========================================================================
  // GAME-THEMED UI HELPERS
  // ==========================================================================

  /**
   * Create a back button in top-left corner
   * Specs: position (20,20), rgba(0,0,0,0.6) bg, white border, red hover
   * @param {Function} onClick - Optional click handler (default: goBack)
   * @returns {Phaser.GameObjects.Container}
   */
  createBackButton(onClick = null) {
    const btn = this.add.container(20, 20).setDepth(DEPTH.CLOSE_BUTTON)

    // Background: rgba(0,0,0,0.6), padding 8px 16px, border 1px white 0.3
    const bg = this.add.rectangle(50, 16, 100, 32, 0x000000, 0.6)
      .setStrokeStyle(1, 0xffffff, 0.3)
      .setInteractive({ useHandCursor: true })

    // Terminal-style text: "← BACK"
    const label = this.add.text(50, 16, '← BACK', {
      ...getTerminalStyle('sm'),
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5)

    btn.add([bg, label])

    bg.on('pointerover', () => {
      bg.setFillStyle(0xff0000, 0.4)
      bg.setStrokeStyle(1, 0xffffff, 0.5)
      audioManager.playHover()
    })

    bg.on('pointerout', () => {
      bg.setFillStyle(0x000000, 0.6)
      bg.setStrokeStyle(1, 0xffffff, 0.3)
    })

    bg.on('pointerdown', () => {
      audioManager.playClick()
      if (onClick) {
        onClick()
      } else {
        this.goBack()
      }
    })

    return btn
  }

  /**
   * Create a close button in top-right corner
   * @param {Function} onClick - Click handler
   * @returns {Phaser.GameObjects.Container}
   */
  createCloseButton(onClick) {
    const btn = this.add.container(this.width - 40, 50).setDepth(DEPTH.CLOSE_BUTTON)

    const bg = this.add.circle(0, 0, 24, 0x333333)
      .setInteractive({ useHandCursor: true })

    const icon = this.add.text(0, 0, '×', {
      fontSize: '28px',
      color: '#ffffff'
    }).setOrigin(0.5)

    btn.add([bg, icon])

    bg.on('pointerover', () => {
      bg.setFillStyle(0xef4444)
      audioManager.playHover()
    })

    bg.on('pointerout', () => bg.setFillStyle(0x333333))

    bg.on('pointerdown', () => {
      audioManager.playClick()
      onClick()
    })

    return btn
  }

  /**
   * Get terminal style for consistent theming
   * @param {string} size - Size variant (sm, md, lg)
   * @returns {Object} Text style object
   */
  getTerminalStyle(size = 'md') {
    return getTerminalStyle(size)
  }

  /**
   * Get depth constants for layering
   * @returns {Object} DEPTH constants
   */
  get DEPTH() {
    return DEPTH
  }
}

export default BaseScene
