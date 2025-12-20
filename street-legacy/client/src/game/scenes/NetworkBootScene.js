/**
 * THE NETWORK - Boot Sequence Scene
 *
 * Immersive encryption/connection animation that plays on every launch.
 * Creates the feeling of connecting to a secure criminal network.
 */

import Phaser from 'phaser'
import { COLORS, BORDERS, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'
import { networkEffects } from '../ui/NetworkEffects'
import { networkMessageManager } from '../managers/NetworkMessageManager'
import { audioManager, AUDIO_KEYS } from '../managers/AudioManager'

export default class NetworkBootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'NetworkBootScene' })
  }

  create() {
    const { width, height } = this.cameras.main

    // Pure black background
    this.cameras.main.setBackgroundColor(0x000000)

    // Initialize effects
    networkEffects.initialize(this)

    // Boot sequence steps (fast ~1.5s total)
    this.bootSteps = [
      { text: 'INITIALIZING SECURE CONNECTION', duration: 120 },
      { text: 'LOADING ENCRYPTION KEYS', duration: 150, progress: true },
      { text: 'VERIFYING NODE IDENTITY', duration: 100 },
      { text: 'ESTABLISHING ENCRYPTED TUNNEL', duration: 150, progress: true },
      { text: 'KEY EXCHANGE COMPLETE', duration: 80 },
      { text: 'CONNECTED TO THE NETWORK', duration: 150, final: true }
    ]

    this.currentStep = 0
    this.bootLines = []

    // Create boot container
    this.bootContainer = this.add.container(width / 2, height / 2 - 80)

    // Network logo/title
    this.networkTitle = this.add.text(width / 2, 80, 'THE NETWORK', {
      ...getTerminalStyle('display'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setAlpha(0)

    // Subtitle
    this.networkSubtitle = this.add.text(width / 2, 115, 'ENCRYPTED COMMUNICATION HUB', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setAlpha(0)

    // Version/node info
    this.nodeInfo = this.add.text(width / 2, height - 40, `NODE: ${this.generateNodeId()} | v2.1.0`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setAlpha(0)

    // Start boot sequence after brief delay
    this.time.delayedCall(100, () => {
      this.fadeInTitle()
    })
  }

  /**
   * Generate a random node ID
   */
  generateNodeId() {
    const chars = 'ABCDEF0123456789'
    let id = ''
    for (let i = 0; i < 8; i++) {
      id += chars[Math.floor(Math.random() * chars.length)]
    }
    return id
  }

  /**
   * Fade in the title and start boot sequence
   */
  fadeInTitle() {
    // Fade in title with glitch effect (fast)
    this.tweens.add({
      targets: this.networkTitle,
      alpha: 1,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        // Sound: Title appears
        audioManager.playSFX(AUDIO_KEYS.SFX.MODAL_OPEN)

        // Small glitch
        networkEffects.triggerGlitch(50)

        // Fade in subtitle
        this.tweens.add({
          targets: this.networkSubtitle,
          alpha: 1,
          duration: 80,
          onComplete: () => {
            // Start boot sequence immediately
            this.time.delayedCall(50, () => {
              this.runBootSequence()
            })
          }
        })
      }
    })

    // Fade in node info
    this.tweens.add({
      targets: this.nodeInfo,
      alpha: 0.5,
      duration: 200,
      delay: 50
    })
  }

  /**
   * Run the boot sequence steps
   */
  runBootSequence() {
    if (this.currentStep >= this.bootSteps.length) {
      this.completeBootSequence()
      return
    }

    const step = this.bootSteps[this.currentStep]
    this.addBootLine(step)
  }

  /**
   * Add a boot line to the display
   */
  addBootLine(step) {
    const { width, height } = this.cameras.main
    const startY = height / 2 - 60
    const lineHeight = 28
    const y = startY + (this.bootLines.length * lineHeight)

    // Cursor blink effect for typing
    const cursor = this.add.text(40, y, '_', {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.network.primary)
    }).setAlpha(1)

    // Blink cursor
    const cursorBlink = this.tweens.add({
      targets: cursor,
      alpha: { from: 1, to: 0 },
      duration: 300,
      yoyo: true,
      repeat: -1
    })

    // Type out the text
    const fullText = `${SYMBOLS.system} ${step.text}`
    let currentChar = 0
    const textObj = this.add.text(40, y, '', {
      ...getTerminalStyle('md'),
      color: toHexString(step.final ? COLORS.status.success : COLORS.network.primary)
    })

    // Sound: typing tick (play once at start of each line)
    audioManager.playSFX(AUDIO_KEYS.SFX.TICK, { volume: 0.3, detune: -200 })

    const typeTimer = this.time.addEvent({
      delay: 8,  // Fast typing
      callback: () => {
        currentChar++
        textObj.setText(fullText.substring(0, currentChar))
        cursor.x = 40 + textObj.width + 5

        // Sound: soft tick every 5 characters
        if (currentChar % 5 === 0) {
          audioManager.playSFX(AUDIO_KEYS.SFX.TICK, { volume: 0.15, detune: Math.random() * 400 - 200 })
        }

        if (currentChar >= fullText.length) {
          typeTimer.remove()
          cursorBlink.stop()
          cursor.destroy()

          // Add status indicator
          this.addStatusIndicator(y, step, () => {
            this.currentStep++
            this.time.delayedCall(30, () => {  // Quick transition between steps
              this.runBootSequence()
            })
          })
        }
      },
      repeat: fullText.length - 1
    })

    this.bootLines.push(textObj)
  }

  /**
   * Add status indicator after boot line
   */
  addStatusIndicator(y, step, onComplete) {
    const { width } = this.cameras.main

    if (step.progress) {
      // Progress bar
      const barWidth = 120
      const barX = width - 40 - barWidth

      const barBg = this.add.rectangle(barX + barWidth / 2, y + 8, barWidth, 12, COLORS.bg.void)
        .setStrokeStyle(1, COLORS.network.dim)

      const barFill = this.add.rectangle(barX, y + 8, 0, 10, COLORS.network.primary)
        .setOrigin(0, 0.5)

      // Animate progress
      this.tweens.add({
        targets: barFill,
        width: barWidth - 4,
        duration: step.duration,
        ease: 'Power1',
        onComplete: () => {
          // Sound: progress complete
          audioManager.playSFX(AUDIO_KEYS.SFX.HIT, { volume: 0.4 })

          // Replace with checkmark
          barBg.destroy()
          barFill.destroy()
          this.add.text(width - 40, y, SYMBOLS.check, {
            ...getTerminalStyle('md'),
            color: toHexString(COLORS.status.success)
          }).setOrigin(1, 0)
          onComplete()
        }
      })
    } else if (step.final) {
      // Final step - lock icon
      this.time.delayedCall(step.duration, () => {
        // Sound: connection established
        audioManager.playSFX(AUDIO_KEYS.SFX.LEVEL_UP, { volume: 0.5 })

        this.add.text(width - 40, y, SYMBOLS.locked, {
          ...getTerminalStyle('md'),
          color: toHexString(COLORS.status.success)
        }).setOrigin(1, 0)
        onComplete()
      })
    } else {
      // Simple checkmark after delay
      this.time.delayedCall(step.duration, () => {
        // Sound: step complete
        audioManager.playSFX(AUDIO_KEYS.SFX.CLICK, { volume: 0.3 })

        this.add.text(width - 40, y, SYMBOLS.check, {
          ...getTerminalStyle('md'),
          color: toHexString(COLORS.status.success)
        }).setOrigin(1, 0)
        onComplete()
      })
    }
  }

  /**
   * Complete the boot sequence and transition to game
   */
  completeBootSequence() {
    const { width, height } = this.cameras.main

    // Initialize message manager
    networkMessageManager.initialize()

    // Show connection established banner
    const banner = this.add.rectangle(width / 2, height / 2 + 80, width - 60, 50, COLORS.network.primary, 0.15)
      .setStrokeStyle(2, COLORS.network.primary)
      .setAlpha(0)

    const bannerText = this.add.text(width / 2, height / 2 + 80, `${SYMBOLS.locked} SECURE CONNECTION ACTIVE`, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setAlpha(0)

    // Unread count
    const unreadCount = networkMessageManager.getUnreadCount()
    const unreadText = this.add.text(width / 2, height / 2 + 115,
      unreadCount > 0 ? `${unreadCount} NEW MESSAGE${unreadCount > 1 ? 'S' : ''}` : 'NO NEW MESSAGES', {
      ...getTerminalStyle('sm'),
      color: toHexString(unreadCount > 0 ? COLORS.status.warning : COLORS.text.muted)
    }).setOrigin(0.5).setAlpha(0)

    // Animate banner in (fast)
    this.tweens.add({
      targets: [banner, bannerText, unreadText],
      alpha: 1,
      duration: 150,
      onComplete: () => {
        // Sound: secure connection active
        audioManager.playSFX(AUDIO_KEYS.SFX.ACHIEVEMENT, { volume: 0.4 })

        // Trigger glitch effect
        networkEffects.triggerGlitch(80)

        // Quick transition
        this.time.delayedCall(250, () => {
          this.transitionToGame()
        })
      }
    })
  }

  /**
   * Transition to the main game
   */
  transitionToGame() {
    const { width, height } = this.cameras.main

    // Create transition overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setDepth(1000)

    // Fade to black (fast)
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 150,
      onComplete: () => {
        // Clean up effects
        networkEffects.destroy()

        // Start GameScene - it will launch UIScene in its create()
        this.scene.start('GameScene')
      }
    })
  }
}
