// Smash & Grab Mini-Game
// Break into vehicles: Smash window, grab valuables, escape before alarm
// Two phases: 1) Rapid tap to break glass, 2) Quick grab valuable items

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { audioManager } from '../../managers/AudioManager'
import { COLORS, SYMBOLS, getTerminalStyle, toHexString, BORDERS } from '../../ui/NetworkTheme'

// Item types for grab phase
const ITEM_TYPES = {
  VALUABLE: { points: 50, color: 0xfbbf24, icon: '💰', name: 'Cash' },
  ELECTRONICS: { points: 75, color: 0x3b82f6, icon: '📱', name: 'Phone' },
  JEWELRY: { points: 100, color: 0xa855f7, icon: '💎', name: 'Jewelry' },
  WALLET: { points: 40, color: 0x8b4513, icon: '👛', name: 'Wallet' },
  KEYS: { points: 30, color: 0x64748b, icon: '🔑', name: 'Keys' },
  // Negative items
  TRASH: { points: -20, color: 0x6b7280, icon: '🗑️', name: 'Trash' },
  ALARM: { points: -50, color: 0xef4444, icon: '🚨', name: 'Alarm!' }
}

export class SmashGrabGame extends BaseMiniGame {
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.SCREEN_SHAKE,
      CURVEBALL_TYPES.VISUAL_BLUR,
      CURVEBALL_TYPES.DISTRACTION,
      CURVEBALL_TYPES.BRIEF_BLACKOUT
    ]
  }

  constructor() {
    super('SmashGrabGame')

    // Game phases
    this.phase = 'smash' // 'smash', 'grab', 'escape'

    // Smash phase
    this.smashProgress = 0
    this.smashTarget = 100
    this.smashPerTap = 8
    this.crackLevel = 0

    // Grab phase
    this.items = []
    this.grabbedItems = []
    this.itemSpawnTimer = null
    this.maxItems = 8

    // Visuals
    this.windowGraphics = null
    this.cracks = []
    this.glassShards = []
  }

  create() {
    super.create()

    // Reset state
    this.phase = 'smash'
    this.smashProgress = 0
    this.crackLevel = 0
    this.items = []
    this.grabbedItems = []

    // Difficulty scaling
    this.setupDifficulty()

    // Create car window visual
    this.createCarWindow()

    // Create smash progress bar
    this.createSmashBar()

    // Instructions
    this.instructionText = this.add.text(this.gameWidth / 2, this.gameHeight - 40,
      'TAP RAPIDLY to break the window!', {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)

    // Phase indicator
    this.phaseText = this.add.text(this.gameWidth / 2, 130,
      `${SYMBOLS.system} PHASE 1: BREAK IN`, {
        ...getTerminalStyle('lg'),
        color: toHexString(COLORS.status.warning)
      }).setOrigin(0.5)

    // Set up tap input for smash phase
    this.input.on('pointerdown', (pointer) => this.handleTap(pointer))
  }

  setupDifficulty() {
    const difficulty = this.gameData.difficulty || 1

    if (difficulty >= 4) {
      this.smashPerTap = 5
      this.smashTarget = 120
      this.maxItems = 10
    } else if (difficulty >= 2) {
      this.smashPerTap = 7
      this.smashTarget = 100
      this.maxItems = 8
    } else {
      this.smashPerTap = 10
      this.smashTarget = 80
      this.maxItems = 6
    }
  }

  createCarWindow() {
    const windowX = this.gameWidth / 2
    const windowY = this.gameHeight / 2 - 30
    const windowW = 280
    const windowH = 200

    // Car body background
    this.add.rectangle(windowX, windowY + 50, windowW + 60, windowH + 100, 0x1e293b)
      .setStrokeStyle(3, 0x475569)

    // Window frame
    this.windowFrame = this.add.rectangle(windowX, windowY, windowW + 10, windowH + 10, 0x334155)
      .setStrokeStyle(4, 0x64748b)

    // Window glass
    this.windowGlass = this.add.rectangle(windowX, windowY, windowW, windowH, 0x0ea5e9, 0.3)
      .setStrokeStyle(2, 0x38bdf8)
      .setInteractive({ useHandCursor: true })

    // Glass reflection effect
    this.add.rectangle(windowX - 60, windowY - 40, 80, 4, 0xffffff, 0.3).setAngle(-20)
    this.add.rectangle(windowX - 40, windowY - 50, 40, 3, 0xffffff, 0.2).setAngle(-20)

    // Target indicator (where to tap)
    this.targetIndicator = this.add.circle(windowX, windowY, 40, 0xff0000, 0)
      .setStrokeStyle(3, 0xef4444)

    // Pulsing animation on target
    this.tweens.add({
      targets: this.targetIndicator,
      scale: { from: 0.9, to: 1.1 },
      alpha: { from: 0.5, to: 1 },
      duration: 400,
      yoyo: true,
      repeat: -1
    })

    // Tap hint text
    this.tapHint = this.add.text(windowX, windowY + 60, 'TAP HERE!', {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.status.danger)
    }).setOrigin(0.5)

    // Crack container (for visual cracks)
    this.crackContainer = this.add.container(windowX, windowY)

    // Store window bounds for grab phase
    this.windowBounds = {
      x: windowX - windowW / 2,
      y: windowY - windowH / 2,
      width: windowW,
      height: windowH,
      centerX: windowX,
      centerY: windowY
    }
  }

  createSmashBar() {
    const barX = this.gameWidth / 2
    const barY = this.gameHeight - 80

    // Background
    this.smashBarBg = this.add.rectangle(barX, barY, 250, 24, COLORS.bg.void)
      .setStrokeStyle(2, COLORS.network.dim)

    // Fill
    this.smashBarFill = this.add.rectangle(barX - 123, barY, 0, 20, COLORS.status.danger)
      .setOrigin(0, 0.5)

    // Label
    this.add.text(barX, barY - 20, 'BREAK PROGRESS', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    this.smashPercentText = this.add.text(barX, barY, '0%', {
      ...getTerminalStyle('sm'),
      color: '#ffffff'
    }).setOrigin(0.5)
  }

  handleTap(pointer) {
    if (this.isPaused || this.isGameOver) return

    if (this.phase === 'smash') {
      this.handleSmashTap(pointer)
    }
    // Grab phase handles taps on individual items
  }

  handleSmashTap(pointer) {
    // Check if tap is on window
    const dist = Phaser.Math.Distance.Between(
      pointer.x, pointer.y,
      this.windowBounds.centerX, this.windowBounds.centerY
    )

    if (dist > 150) return // Too far from window

    // Add progress
    this.smashProgress += this.smashPerTap

    // Visual feedback
    this.addCrack(pointer.x, pointer.y)

    // Screen shake
    this.cameras.main.shake(50, 0.01)

    // Sound
    try { audioManager.playClick() } catch (e) {}

    // Update bar
    const progress = Math.min(1, this.smashProgress / this.smashTarget)
    this.smashBarFill.width = progress * 246
    this.smashPercentText.setText(`${Math.floor(progress * 100)}%`)

    // Color progression
    if (progress > 0.7) {
      this.smashBarFill.setFillStyle(COLORS.network.primary)
    } else if (progress > 0.4) {
      this.smashBarFill.setFillStyle(COLORS.status.warning)
    }

    // Glass gets more transparent as it breaks
    this.windowGlass.setAlpha(0.3 * (1 - progress * 0.7))

    // Check if broken
    if (this.smashProgress >= this.smashTarget) {
      this.breakWindow()
    }
  }

  addCrack(x, y) {
    // Add crack line from tap point
    const localX = x - this.windowBounds.centerX
    const localY = y - this.windowBounds.centerY

    const graphics = this.add.graphics()
    graphics.lineStyle(2, 0xffffff, 0.8)

    // Draw random crack lines from tap point
    const numLines = Phaser.Math.Between(3, 5)
    for (let i = 0; i < numLines; i++) {
      const angle = Math.random() * Math.PI * 2
      const length = Phaser.Math.Between(20, 60)

      graphics.moveTo(this.windowBounds.centerX + localX, this.windowBounds.centerY + localY)
      graphics.lineTo(
        this.windowBounds.centerX + localX + Math.cos(angle) * length,
        this.windowBounds.centerY + localY + Math.sin(angle) * length
      )
    }
    graphics.strokePath()

    this.cracks.push(graphics)

    // Tap effect
    const tapEffect = this.add.circle(x, y, 20, 0xffffff, 0.5)
    this.tweens.add({
      targets: tapEffect,
      scale: 2,
      alpha: 0,
      duration: 200,
      onComplete: () => tapEffect.destroy()
    })
  }

  breakWindow() {
    this.phase = 'grab'

    // Big impact effect
    this.cameras.main.shake(200, 0.03)
    this.cameras.main.flash(100, 255, 255, 255)

    try { audioManager.playHit() } catch (e) {}

    // Hide smash elements
    this.windowGlass.setVisible(false)
    this.targetIndicator.setVisible(false)
    this.tapHint.setVisible(false)
    this.smashBarBg.setVisible(false)
    this.smashBarFill.setVisible(false)
    this.smashPercentText.setVisible(false)

    // Clear cracks
    this.cracks.forEach(c => c.destroy())
    this.cracks = []

    // Create glass shard particles
    this.createGlassShards()

    // Update phase text
    this.phaseText.setText(`${SYMBOLS.system} PHASE 2: GRAB LOOT!`)
    this.phaseText.setColor(toHexString(COLORS.network.primary))

    this.instructionText.setText('TAP valuable items quickly! Avoid trash and alarms!')

    // Score bonus for breaking in
    this.addScore(50)

    // Start spawning items
    this.startGrabPhase()
  }

  createGlassShards() {
    // Particle effect for broken glass
    for (let i = 0; i < 15; i++) {
      const shard = this.add.polygon(
        this.windowBounds.centerX + Phaser.Math.Between(-100, 100),
        this.windowBounds.centerY + Phaser.Math.Between(-80, 80),
        [0, 0, 10, 5, 5, 15],
        0x87ceeb, 0.6
      )

      this.tweens.add({
        targets: shard,
        y: shard.y + 200,
        alpha: 0,
        angle: Phaser.Math.Between(-180, 180),
        duration: 800,
        ease: 'Power2',
        onComplete: () => shard.destroy()
      })
    }
  }

  startGrabPhase() {
    // Spawn initial items
    this.spawnItem()
    this.spawnItem()
    this.spawnItem()

    // Continue spawning items
    this.itemSpawnTimer = this.time.addEvent({
      delay: 1200 - (this.gameData.difficulty || 1) * 100,
      callback: () => {
        if (this.items.length < this.maxItems && this.phase === 'grab') {
          this.spawnItem()
        }
      },
      loop: true
    })
  }

  spawnItem() {
    // Determine item type (weighted)
    const rand = Math.random()
    let itemType

    if (rand < 0.1) {
      itemType = ITEM_TYPES.ALARM
    } else if (rand < 0.2) {
      itemType = ITEM_TYPES.TRASH
    } else if (rand < 0.35) {
      itemType = ITEM_TYPES.JEWELRY
    } else if (rand < 0.5) {
      itemType = ITEM_TYPES.ELECTRONICS
    } else if (rand < 0.7) {
      itemType = ITEM_TYPES.VALUABLE
    } else if (rand < 0.85) {
      itemType = ITEM_TYPES.WALLET
    } else {
      itemType = ITEM_TYPES.KEYS
    }

    // Random position inside window
    const x = this.windowBounds.x + 30 + Math.random() * (this.windowBounds.width - 60)
    const y = this.windowBounds.y + 30 + Math.random() * (this.windowBounds.height - 60)

    // Create item container
    const item = this.add.container(x, y)

    // Background circle
    const bg = this.add.circle(0, 0, 28, itemType.color, 0.3)
      .setStrokeStyle(2, itemType.color)
    item.add(bg)

    // Icon
    const icon = this.add.text(0, 0, itemType.icon, { fontSize: '24px' }).setOrigin(0.5)
    item.add(icon)

    // Store item data
    item.setData('type', itemType)
    item.setData('bg', bg)

    // Make interactive
    item.setSize(56, 56)
    item.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.grabItem(item))
      .on('pointerover', () => bg.setStrokeStyle(3, 0xffffff))
      .on('pointerout', () => bg.setStrokeStyle(2, itemType.color))

    // Spawn animation
    item.setScale(0)
    this.tweens.add({
      targets: item,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    })

    // Item expires after a while
    const lifetime = 3000 + Math.random() * 2000
    this.time.delayedCall(lifetime, () => {
      if (item.active) {
        this.tweens.add({
          targets: item,
          scale: 0,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            const idx = this.items.indexOf(item)
            if (idx > -1) this.items.splice(idx, 1)
            item.destroy()
          }
        })
      }
    })

    this.items.push(item)
  }

  grabItem(item) {
    if (this.isPaused || this.isGameOver || this.phase !== 'grab') return

    const itemType = item.getData('type')

    // Remove from active items
    const idx = this.items.indexOf(item)
    if (idx > -1) this.items.splice(idx, 1)

    // Add score
    this.addScore(itemType.points)

    // Visual feedback
    if (itemType.points > 0) {
      // Good item
      this.cameras.main.flash(50, 0, 255, 65)
      try { audioManager.playHit() } catch (e) {}

      // Float up effect
      const scorePopup = this.add.text(item.x, item.y, `+${itemType.points}`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.network.primary)
      }).setOrigin(0.5)

      this.tweens.add({
        targets: scorePopup,
        y: scorePopup.y - 50,
        alpha: 0,
        duration: 600,
        onComplete: () => scorePopup.destroy()
      })

      this.grabbedItems.push(itemType.name)
    } else {
      // Bad item
      this.cameras.main.shake(100, 0.02)
      try { audioManager.playError() } catch (e) {}

      // Penalty popup
      const penaltyPopup = this.add.text(item.x, item.y, `${itemType.points}`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.status.danger)
      }).setOrigin(0.5)

      this.tweens.add({
        targets: penaltyPopup,
        y: penaltyPopup.y - 30,
        alpha: 0,
        duration: 400,
        onComplete: () => penaltyPopup.destroy()
      })
    }

    // Grab animation
    this.tweens.add({
      targets: item,
      scale: 1.3,
      alpha: 0,
      duration: 150,
      onComplete: () => item.destroy()
    })

    // Check win condition
    if (this.score >= (this.gameData.targetScore || 200)) {
      this.handleSuccess()
    }
  }

  handleSuccess() {
    if (this.isGameOver) return
    this.phase = 'escape'

    // Stop spawning
    if (this.itemSpawnTimer) {
      this.itemSpawnTimer.destroy()
    }

    // Success effects
    this.cameras.main.flash(200, 0, 255, 65)

    const successText = this.add.text(this.gameWidth / 2, this.gameHeight / 2,
      `${SYMBOLS.check} GOT THE GOODS!`, {
        ...getTerminalStyle('display'),
        color: toHexString(COLORS.network.primary)
      }).setOrigin(0.5)

    this.tweens.add({
      targets: successText,
      scale: { from: 0.5, to: 1.2 },
      duration: 300
    })

    // Time bonus
    this.addScore(Math.floor(this.timeRemaining * 5))

    // End game
    this.endGame(true)
  }

  update(time, delta) {
    super.update(time, delta)

    if (this.isPaused || this.isGameOver) return

    // Auto-fail if time runs out in smash phase
    if (this.phase === 'smash' && this.timeRemaining <= 0) {
      this.endGame(false)
    }
  }

  shutdown() {
    if (this.itemSpawnTimer) {
      this.itemSpawnTimer.destroy()
    }
    super.shutdown()
  }
}

export default SmashGrabGame
