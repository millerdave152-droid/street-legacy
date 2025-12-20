/**
 * NetworkTransition - Command-prompt style scene transitions
 *
 * Creates immersive hacker/terminal aesthetic transitions between scenes
 * with typing effects, glitch animations, and category-specific messages.
 */

import Phaser from 'phaser'
import { COLORS, BORDERS, getTerminalStyle, toHexString } from './NetworkTheme'

// Category-specific transition configs
const TRANSITION_CONFIGS = {
  // Crime scenes
  crime: {
    title: 'BREACH PROTOCOL',
    messages: [
      'Scanning security...',
      'Bypassing firewall...',
      'Access granted.'
    ],
    color: COLORS.status.danger,
    icon: '[!]',
    sound: 'alert'
  },
  CrimeScene: {
    title: 'CRIME TERMINAL',
    messages: [
      'Loading criminal database...',
      'Checking heat level...',
      'Ready for action.'
    ],
    color: COLORS.status.danger,
    icon: '[!]'
  },

  // Jobs
  job: {
    title: 'WORK NODE',
    messages: [
      'Connecting to employer...',
      'Verifying credentials...',
      'Job listings loaded.'
    ],
    color: COLORS.network.primary,
    icon: '[W]'
  },
  JobScene: {
    title: 'JOB TERMINAL',
    messages: [
      'Accessing work network...',
      'Loading opportunities...',
      'Connection established.'
    ],
    color: COLORS.network.primary,
    icon: '[W]'
  },

  // Heists
  heists: {
    title: 'SECURE CHANNEL',
    messages: [
      'Encrypting connection...',
      'Scanning targets...',
      'Channel secure.'
    ],
    color: COLORS.status.warning,
    icon: '[H]'
  },
  HeistsScene: {
    title: 'HEIST PLANNER',
    messages: [
      'Initializing secure channel...',
      'Loading blueprints...',
      'Planning mode active.'
    ],
    color: COLORS.status.warning,
    icon: '[H]'
  },

  // Trading
  trading: {
    title: 'MARKET DATA',
    messages: [
      'Syncing prices...',
      'Loading inventory...',
      'Market ready.'
    ],
    color: COLORS.status.info,
    icon: '[T]'
  },
  TradingScene: {
    title: 'TRADE TERMINAL',
    messages: [
      'Connecting to black market...',
      'Verifying reputation...',
      'Trading enabled.'
    ],
    color: COLORS.status.info,
    icon: '[T]'
  },

  // Property
  property: {
    title: 'ASSET MANAGER',
    messages: [
      'Loading properties...',
      'Calculating income...',
      'Portfolio loaded.'
    ],
    color: 0x7c3aed,
    icon: '[P]'
  },
  PropertyScene: {
    title: 'PROPERTY NODE',
    messages: [
      'Accessing real estate db...',
      'Syncing ownership data...',
      'Properties loaded.'
    ],
    color: 0x7c3aed,
    icon: '[P]'
  },

  // Bank
  bank: {
    title: 'FINANCIAL NODE',
    messages: [
      'Secure connection...',
      'Authenticating...',
      'Access granted.'
    ],
    color: 0x0d9488,
    icon: '[B]'
  },
  BankScene: {
    title: 'BANK TERMINAL',
    messages: [
      'Connecting to bank server...',
      'Encrypting session...',
      'Account access ready.'
    ],
    color: 0x0d9488,
    icon: '[B]'
  },

  // Crew
  crew: {
    title: 'CREW NETWORK',
    messages: [
      'Pinging members...',
      'Loading roster...',
      'Network active.'
    ],
    color: 0x2563eb,
    icon: '[C]'
  },
  CrewScene: {
    title: 'CREW TERMINAL',
    messages: [
      'Accessing crew database...',
      'Loading member status...',
      'Crew online.'
    ],
    color: 0x2563eb,
    icon: '[C]'
  },

  // Travel
  travel: {
    title: 'NAVIGATION',
    messages: [
      'Loading map data...',
      'Calculating routes...',
      'GPS locked.'
    ],
    color: 0x4f46e5,
    icon: '[M]'
  },
  TravelScene: {
    title: 'TRAVEL NODE',
    messages: [
      'Scanning districts...',
      'Checking travel costs...',
      'Routes available.'
    ],
    color: 0x4f46e5,
    icon: '[M]'
  },

  // Inventory
  inventory: {
    title: 'INVENTORY',
    messages: [
      'Scanning items...',
      'Loading gear...',
      'Inventory synced.'
    ],
    color: 0xea580c,
    icon: '[I]'
  },
  InventoryScene: {
    title: 'ITEM DATABASE',
    messages: [
      'Loading inventory...',
      'Checking equipment...',
      'Items ready.'
    ],
    color: 0xea580c,
    icon: '[I]'
  },

  // Reputation
  reputation: {
    title: 'REP TRACKER',
    messages: [
      'Calculating respect...',
      'Loading rankings...',
      'Status updated.'
    ],
    color: COLORS.cred.gold,
    icon: '[R]'
  },
  ReputationScene: {
    title: 'REPUTATION NODE',
    messages: [
      'Accessing rep database...',
      'Loading street cred...',
      'Rankings loaded.'
    ],
    color: COLORS.cred.gold,
    icon: '[R]'
  },

  // Achievements
  achievements: {
    title: 'ACHIEVEMENTS',
    messages: [
      'Loading records...',
      'Checking milestones...',
      'Progress synced.'
    ],
    color: 0x06b6d4,
    icon: '[A]'
  },
  AchievementsScene: {
    title: 'ACHIEVEMENT LOG',
    messages: [
      'Scanning achievements...',
      'Calculating progress...',
      'Records loaded.'
    ],
    color: 0x06b6d4,
    icon: '[A]'
  },

  // Events
  events: {
    title: 'EVENT FEED',
    messages: [
      'Checking alerts...',
      'Loading events...',
      'Feed active.'
    ],
    color: COLORS.status.danger,
    icon: '[E]'
  },
  EventsScene: {
    title: 'EVENT TERMINAL',
    messages: [
      'Scanning for events...',
      'Loading notifications...',
      'Events ready.'
    ],
    color: COLORS.status.danger,
    icon: '[E]'
  },

  // OS-style Hub Scenes
  OperationsHubScene: {
    title: 'OPERATIONS HUB',
    messages: [
      'Connecting to ops network...',
      'Loading crime data...',
      'Operations terminal ready.'
    ],
    color: 0xFF4444,
    icon: '[!]'
  },
  CommerceHubScene: {
    title: 'COMMERCE HUB',
    messages: [
      'Syncing market data...',
      'Loading portfolios...',
      'Commerce terminal ready.'
    ],
    color: 0x00FF88,
    icon: '[$]'
  },
  ConnectionsHubScene: {
    title: 'NETWORK HUB',
    messages: [
      'Pinging contacts...',
      'Loading crew data...',
      'Network terminal ready.'
    ],
    color: 0x4488FF,
    icon: '[@]'
  },
  SystemHubScene: {
    title: 'SYSTEM HUB',
    messages: [
      'Checking status...',
      'Loading metrics...',
      'System terminal ready.'
    ],
    color: 0xAA44FF,
    icon: '[i]'
  },

  // Default fallback
  default: {
    title: 'ACCESSING',
    messages: [
      'Initializing...',
      'Loading data...',
      'Ready.'
    ],
    color: COLORS.network.primary,
    icon: '[>]'
  }
}

class NetworkTransitionManager {
  constructor() {
    this.isTransitioning = false
    this.transitionContainer = null
    this.currentScene = null
  }

  /**
   * Get transition config for a scene
   */
  getConfig(sceneKey) {
    return TRANSITION_CONFIGS[sceneKey] || TRANSITION_CONFIGS.default
  }

  /**
   * Play a transition effect when opening a scene
   * @param {Phaser.Scene} scene - The current scene
   * @param {string} targetScene - The scene to transition to
   * @param {object} options - Additional options
   */
  async playTransition(scene, targetScene, options = {}) {
    if (this.isTransitioning) return
    this.isTransitioning = true
    this.currentScene = scene

    const { width, height } = scene.cameras.main
    const config = this.getConfig(targetScene)
    const duration = options.duration || 800

    // Create transition container at high depth
    this.transitionContainer = scene.add.container(0, 0).setDepth(9999)

    // Dark overlay with scanlines
    const overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0.95).setOrigin(0)
    this.transitionContainer.add(overlay)

    // Scanline effect
    const scanlines = scene.add.graphics()
    scanlines.setAlpha(0.3)
    for (let y = 0; y < height; y += 3) {
      scanlines.fillStyle(0x000000, 0.5)
      scanlines.fillRect(0, y, width, 1)
    }
    this.transitionContainer.add(scanlines)

    // Glitch bars (random horizontal lines)
    const glitchBars = []
    for (let i = 0; i < 5; i++) {
      const barY = Math.random() * height
      const barHeight = 2 + Math.random() * 8
      const bar = scene.add.rectangle(0, barY, width, barHeight, config.color, 0.3).setOrigin(0)
      glitchBars.push(bar)
      this.transitionContainer.add(bar)
    }

    // Animate glitch bars
    glitchBars.forEach((bar, i) => {
      scene.tweens.add({
        targets: bar,
        y: bar.y + (Math.random() - 0.5) * 100,
        alpha: { from: 0.3, to: 0 },
        duration: 300 + i * 100,
        ease: 'Power2'
      })
    })

    // Terminal box in center
    const boxWidth = 280
    const boxHeight = 140
    const boxX = width / 2
    const boxY = height / 2

    const terminalBg = scene.add.rectangle(boxX, boxY, boxWidth, boxHeight, COLORS.bg.void, 0.98)
    terminalBg.setStrokeStyle(BORDERS.medium, config.color, 0.8)
    this.transitionContainer.add(terminalBg)

    // Corner accents
    const corners = [
      { x: boxX - boxWidth/2 + 8, y: boxY - boxHeight/2 + 8 },
      { x: boxX + boxWidth/2 - 8, y: boxY - boxHeight/2 + 8 },
      { x: boxX - boxWidth/2 + 8, y: boxY + boxHeight/2 - 8 },
      { x: boxX + boxWidth/2 - 8, y: boxY + boxHeight/2 - 8 }
    ]
    corners.forEach(corner => {
      const accent = scene.add.rectangle(corner.x, corner.y, 4, 4, config.color, 0.8)
      this.transitionContainer.add(accent)
    })

    // Title with icon
    const titleText = scene.add.text(boxX, boxY - 45, `${config.icon} ${config.title}`, {
      ...getTerminalStyle('lg'),
      color: toHexString(config.color)
    }).setOrigin(0.5)
    this.transitionContainer.add(titleText)

    // Typing effect for messages
    const messageY = boxY - 10
    const messageTexts = []

    for (let i = 0; i < config.messages.length; i++) {
      const msgText = scene.add.text(boxX - boxWidth/2 + 20, messageY + i * 22, '', {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.text.secondary)
      })
      messageTexts.push(msgText)
      this.transitionContainer.add(msgText)
    }

    // Progress bar at bottom
    const progressBg = scene.add.rectangle(boxX, boxY + 50, boxWidth - 40, 6, COLORS.bg.panel, 0.8)
    progressBg.setStrokeStyle(1, config.color, 0.3)
    this.transitionContainer.add(progressBg)

    const progressFill = scene.add.rectangle(boxX - (boxWidth - 40)/2, boxY + 50, 0, 4, config.color, 0.8).setOrigin(0, 0.5)
    this.transitionContainer.add(progressFill)

    // Cursor blink
    const cursor = scene.add.text(boxX - boxWidth/2 + 20, messageY, '_', {
      ...getTerminalStyle('sm'),
      color: toHexString(config.color)
    })
    this.transitionContainer.add(cursor)

    scene.tweens.add({
      targets: cursor,
      alpha: { from: 1, to: 0 },
      duration: 300,
      yoyo: true,
      repeat: -1
    })

    // Animate typing each message
    const typeDelay = duration / (config.messages.length + 1)

    for (let i = 0; i < config.messages.length; i++) {
      await this.typeMessage(scene, messageTexts[i], config.messages[i], typeDelay * 0.6, cursor, messageY + i * 22)

      // Flash the line green when complete
      scene.tweens.add({
        targets: messageTexts[i],
        alpha: { from: 1, to: 0.5 },
        duration: 50,
        yoyo: true,
        onComplete: () => messageTexts[i].setColor(toHexString(COLORS.network.primary))
      })

      // Update progress bar
      scene.tweens.add({
        targets: progressFill,
        width: ((boxWidth - 40) / config.messages.length) * (i + 1),
        duration: 150,
        ease: 'Power2'
      })

      await this.delay(scene, typeDelay * 0.3)
    }

    // Final flash effect
    const flash = scene.add.rectangle(0, 0, width, height, config.color, 0).setOrigin(0)
    this.transitionContainer.add(flash)

    scene.tweens.add({
      targets: flash,
      alpha: { from: 0, to: 0.3 },
      duration: 100,
      yoyo: true
    })

    await this.delay(scene, 200)

    // Fade out and open scene
    console.log(`[NetworkTransition] Starting final fade, will launch: ${targetScene}`)
    scene.tweens.add({
      targets: this.transitionContainer,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        console.log(`[NetworkTransition] Fade complete, launching: ${targetScene}`)
        this.cleanup()
        console.log(`[NetworkTransition] Cleanup done, calling scene.launch(${targetScene})`)

        // CRITICAL: Disable source scene input BEFORE launching target
        // This prevents input conflicts where source scene intercepts clicks
        scene.input.enabled = false
        console.log(`[NetworkTransition] Source scene input disabled`)

        try {
          // Pass returnScene data so hub scene knows how to return
          scene.scene.launch(targetScene, {
            returnScene: scene.scene.key,
            ...options.data
          })
          console.log(`[NetworkTransition] Hub scene launched successfully`)

          // CRITICAL FIX: Bring hub scene to TOP of scene stack for input priority
          // scene.launch() adds scene but doesn't change input order - bringToTop does
          scene.scene.bringToTop(targetScene)
          console.log(`[NetworkTransition] Hub scene brought to top of scene stack`)

          // Wait for hub scene to signal readiness before pausing source scene
          const hubScene = scene.scene.get(targetScene)
          if (hubScene) {
            const onReady = () => {
              console.log(`[NetworkTransition] Hub scene signaled ready, pausing: ${scene.scene.key}`)
              scene.scene.pause()  // Pause source (input already disabled)
              this.isTransitioning = false
              console.log(`[NetworkTransition] Transition complete`)
            }

            // Listen for sceneReady event from hub scene
            hubScene.events.once('sceneReady', onReady)

            // Safety timeout: if hub doesn't signal ready within 500ms, proceed anyway
            scene.time.delayedCall(500, () => {
              hubScene.events.off('sceneReady', onReady)
              if (this.isTransitioning) {
                console.log(`[NetworkTransition] Timeout waiting for sceneReady, forcing pause`)
                onReady()
              }
            })
          } else {
            // Fallback: hub scene not found, use legacy behavior
            console.warn(`[NetworkTransition] Hub scene ${targetScene} not found, using fallback`)
            setTimeout(() => {
              scene.scene.pause()
              this.isTransitioning = false
            }, 100)
          }
        } catch (error) {
          console.error(`[NetworkTransition] Error launching hub scene:`, error)
          // Restore input on error
          scene.input.enabled = true
          this.isTransitioning = false
        }
      }
    })
  }

  /**
   * Type a message character by character
   */
  typeMessage(scene, textObj, message, duration, cursor, cursorY) {
    return new Promise((resolve) => {
      const chars = message.split('')
      const charDelay = duration / chars.length
      let currentText = ''
      let charIndex = 0

      const typeChar = () => {
        if (charIndex < chars.length) {
          currentText += chars[charIndex]
          textObj.setText('> ' + currentText)
          cursor.x = textObj.x + textObj.width + 5
          cursor.y = cursorY
          charIndex++
          scene.time.delayedCall(charDelay, typeChar)
        } else {
          resolve()
        }
      }

      typeChar()
    })
  }

  /**
   * Simple delay helper
   */
  delay(scene, ms) {
    return new Promise((resolve) => {
      scene.time.delayedCall(ms, resolve)
    })
  }

  /**
   * Play a quick intro animation when a scene starts
   */
  playSceneIntro(scene, sceneKey) {
    const { width, height } = scene.cameras.main
    const config = this.getConfig(sceneKey)

    // Top banner that slides in
    const banner = scene.add.container(0, -60).setDepth(1000)

    const bannerBg = scene.add.rectangle(width / 2, 25, width, 50, COLORS.bg.void, 0.95)
    bannerBg.setStrokeStyle(BORDERS.thin, config.color, 0.8)
    banner.add(bannerBg)

    const bannerText = scene.add.text(width / 2, 25, `${config.icon} ${config.title} ONLINE`, {
      ...getTerminalStyle('md'),
      color: toHexString(config.color)
    }).setOrigin(0.5)
    banner.add(bannerText)

    // Slide in
    scene.tweens.add({
      targets: banner,
      y: 0,
      duration: 300,
      ease: 'Back.out'
    })

    // Add scanline sweep effect
    const scanSweep = scene.add.rectangle(0, 0, width, 4, config.color, 0.5).setOrigin(0).setDepth(999)
    scene.tweens.add({
      targets: scanSweep,
      y: height,
      duration: 500,
      ease: 'Linear',
      onComplete: () => scanSweep.destroy()
    })

    // Slide out after delay
    scene.time.delayedCall(1500, () => {
      scene.tweens.add({
        targets: banner,
        y: -60,
        duration: 200,
        ease: 'Power2',
        onComplete: () => banner.destroy()
      })
    })
  }

  /**
   * Play exit animation when closing a scene
   */
  playSceneExit(scene, callback) {
    const { width, height } = scene.cameras.main

    // Glitch effect
    const glitchContainer = scene.add.container(0, 0).setDepth(9998)

    // Random glitch bars
    for (let i = 0; i < 8; i++) {
      const y = Math.random() * height
      const barHeight = 2 + Math.random() * 6
      const bar = scene.add.rectangle(0, y, width, barHeight, COLORS.network.primary, 0.4).setOrigin(0)
      glitchContainer.add(bar)

      scene.tweens.add({
        targets: bar,
        x: { from: -width, to: width },
        duration: 150 + Math.random() * 100,
        ease: 'Linear'
      })
    }

    // Screen shake
    scene.cameras.main.shake(100, 0.005)

    // Fade out
    scene.tweens.add({
      targets: scene.cameras.main,
      alpha: 0,
      duration: 150,
      onComplete: () => {
        glitchContainer.destroy()
        scene.cameras.main.alpha = 1
        if (callback) callback()
      }
    })
  }

  /**
   * Cleanup transition elements
   */
  cleanup() {
    if (this.transitionContainer) {
      this.transitionContainer.destroy()
      this.transitionContainer = null
    }
  }
}

// Singleton instance
export const networkTransition = new NetworkTransitionManager()
export default networkTransition
