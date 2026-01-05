// Steady Hand Mini-Game
// Keep cursor in moving zone to pickpocket or plant a device

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { audioManager } from '../../managers/AudioManager'
import { COLORS, SYMBOLS, getTerminalStyle, toHexString, BORDERS } from '../../ui/NetworkTheme'

export class SteadyHandGame extends BaseMiniGame {
  // Declare supported curveballs for this game
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.SCREEN_SHAKE,
      CURVEBALL_TYPES.VISUAL_BLUR,
      CURVEBALL_TYPES.SPEED_BOOST,
      CURVEBALL_TYPES.SPEED_SLOW,
      CURVEBALL_TYPES.DISTRACTION,
      CURVEBALL_TYPES.BRIEF_BLACKOUT
    ]
  }

  constructor() {
    super('SteadyHandGame')

    this.targetZone = null
    this.cursor = null
    this.progress = 0
    this.targetProgress = 100
    this.progressSpeed = 15 // Progress per second when in zone
    this.penaltySpeed = 25 // Progress lost per second when out
    this.zoneSize = 80
    this.zoneMoveSpeed = 2
    this.zoneDirection = { x: 1, y: 1 }
    this.isInZone = false
    this.isInGraceZone = false  // Buffer zone at edge
    this.shakeFactor = 0
    this.maxShake = 3
    this.graceZone = 10  // Default grace zone pixels

    // Base values for curveball effects
    this.baseZoneMoveSpeed = 2
  }

  create() {
    super.create()

    // IMPORTANT: Reset all game state on each play
    // Without this, values persist between games causing bugs
    this.progress = 0
    this.isInZone = false
    this.shakeFactor = 0
    this.successHandled = false

    // Difficulty scaling - balanced for better playability
    // Zone sizes increased, penalties reduced, grace zone added
    if (this.gameData.difficulty >= 4) {
      this.zoneSize = 60           // Was 50 - slightly larger
      this.zoneMoveSpeed = 3       // Was 4 - slower movement
      this.progressSpeed = 14      // Was 12 - faster progress
      this.penaltySpeed = 20       // Was 35 - much less punishing
      this.maxShake = 4            // Was 5
      this.graceZone = 8           // Buffer zone at edge
    } else if (this.gameData.difficulty >= 2) {
      this.zoneSize = 75           // Was 65 - larger zone
      this.zoneMoveSpeed = 2.2     // Was 3 - slower
      this.progressSpeed = 16      // Was 13 - faster progress
      this.penaltySpeed = 15       // Was 30 - much less punishing
      this.maxShake = 3            // Was 4
      this.graceZone = 10          // Buffer zone at edge
    } else {
      // Easy mode (Pickpocket, etc.) - very forgiving
      this.zoneSize = 95           // Larger target for easy tracking
      this.zoneMoveSpeed = 1.2     // Slower movement
      this.progressSpeed = 22      // Faster completion - can finish in ~5 seconds of zone time
      this.penaltySpeed = 8        // Very gentle penalty
      this.maxShake = 2            // Less shaky
      this.graceZone = 15          // Large buffer zone at edge
    }

    // Store base values for curveball effects
    this.baseZoneMoveSpeed = this.zoneMoveSpeed

    // Success threshold - 80% progress is enough to win
    // This makes the game more forgiving while still requiring skill
    this.targetProgress = 100  // Visual target (100%)
    this.successThreshold = 80 // Actual success threshold (80%)

    // Play area bounds
    this.playArea = {
      x: 50,
      y: 140,
      width: this.gameWidth - 100,
      height: this.gameHeight - 220
    }

    // Create background
    this.drawBackground()

    // Create target zone
    this.createTargetZone()

    // Create cursor
    this.createCursor()

    // Progress bar
    this.createProgressBar()

    // Instructions
    this.add.text(this.gameWidth / 2, this.gameHeight - 40,
      'Keep cursor inside the zone | Hold steady!', {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)

    // Status text
    this.statusText = this.add.text(this.gameWidth / 2, this.gameHeight - 60,
      `${SYMBOLS.system} MOVE CURSOR INTO ZONE`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.status.warning)
      }).setOrigin(0.5)

    // Hide default cursor
    this.input.setDefaultCursor('none')
  }

  drawBackground() {
    // Play area background
    this.add.rectangle(
      this.playArea.x + this.playArea.width / 2,
      this.playArea.y + this.playArea.height / 2,
      this.playArea.width,
      this.playArea.height,
      COLORS.bg.panel
    ).setStrokeStyle(BORDERS.medium, COLORS.network.dim)

    // Corner markers
    const corners = [
      { x: this.playArea.x + 10, y: this.playArea.y + 10 },
      { x: this.playArea.x + this.playArea.width - 10, y: this.playArea.y + 10 },
      { x: this.playArea.x + 10, y: this.playArea.y + this.playArea.height - 10 },
      { x: this.playArea.x + this.playArea.width - 10, y: this.playArea.y + this.playArea.height - 10 }
    ]
    corners.forEach(corner => {
      this.add.text(corner.x, corner.y, '+', {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)
    })

    // Grid lines (subtle)
    const graphics = this.add.graphics()
    graphics.lineStyle(1, COLORS.network.dim, 0.3)

    // Vertical lines
    for (let x = this.playArea.x + 40; x < this.playArea.x + this.playArea.width; x += 40) {
      graphics.moveTo(x, this.playArea.y)
      graphics.lineTo(x, this.playArea.y + this.playArea.height)
    }

    // Horizontal lines
    for (let y = this.playArea.y + 40; y < this.playArea.y + this.playArea.height; y += 40) {
      graphics.moveTo(this.playArea.x, y)
      graphics.lineTo(this.playArea.x + this.playArea.width, y)
    }

    graphics.strokePath()
  }

  createTargetZone() {
    // Starting position (center of play area)
    const startX = this.playArea.x + this.playArea.width / 2
    const startY = this.playArea.y + this.playArea.height / 2

    // Zone container
    this.targetZone = this.add.container(startX, startY)

    // Outer glow
    this.zoneGlow = this.add.circle(0, 0, this.zoneSize + 10, COLORS.network.glow, 0.2)
    this.targetZone.add(this.zoneGlow)

    // Main zone
    this.zoneCircle = this.add.circle(0, 0, this.zoneSize, COLORS.network.primary, 0.3)
      .setStrokeStyle(3, COLORS.network.primary)
    this.targetZone.add(this.zoneCircle)

    // Inner rings
    this.add.circle(0, 0, this.zoneSize * 0.7, 0x000000, 0)
      .setStrokeStyle(1, COLORS.network.primary, 0.5)
    this.targetZone.add(this.targetZone.list[this.targetZone.list.length - 1])

    this.add.circle(0, 0, this.zoneSize * 0.4, 0x000000, 0)
      .setStrokeStyle(1, COLORS.network.primary, 0.5)
    this.targetZone.add(this.targetZone.list[this.targetZone.list.length - 1])

    // Center point
    this.zoneCenter = this.add.circle(0, 0, 5, COLORS.network.primary)
    this.targetZone.add(this.zoneCenter)

    // Set random initial direction
    this.zoneDirection = {
      x: Math.random() > 0.5 ? 1 : -1,
      y: Math.random() > 0.5 ? 1 : -1
    }
  }

  createCursor() {
    // Custom cursor
    this.cursor = this.add.container(this.gameWidth / 2, this.gameHeight / 2)

    // Crosshair
    const crossSize = 15
    const crossThickness = 2

    // Vertical line
    this.cursorV = this.add.rectangle(0, 0, crossThickness, crossSize * 2, COLORS.text.primary)
    this.cursor.add(this.cursorV)

    // Horizontal line
    this.cursorH = this.add.rectangle(0, 0, crossSize * 2, crossThickness, COLORS.text.primary)
    this.cursor.add(this.cursorH)

    // Center dot
    this.cursorDot = this.add.circle(0, 0, 3, COLORS.text.primary)
    this.cursor.add(this.cursorDot)

    // Outer ring
    this.cursorRing = this.add.circle(0, 0, 12, 0x000000, 0)
      .setStrokeStyle(2, COLORS.text.primary)
    this.cursor.add(this.cursorRing)

    // Track mouse
    this.input.on('pointermove', (pointer) => {
      // Clamp to play area
      const x = Phaser.Math.Clamp(pointer.x, this.playArea.x, this.playArea.x + this.playArea.width)
      const y = Phaser.Math.Clamp(pointer.y, this.playArea.y, this.playArea.y + this.playArea.height)

      // Add shake if out of zone
      const shakeX = this.isInZone ? 0 : (Math.random() - 0.5) * this.shakeFactor
      const shakeY = this.isInZone ? 0 : (Math.random() - 0.5) * this.shakeFactor

      this.cursor.setPosition(x + shakeX, y + shakeY)
    })
  }

  createProgressBar() {
    const barWidth = 200
    const barHeight = 20
    const barX = this.gameWidth / 2
    const barY = 125

    // Bar background
    this.progressBg = this.add.rectangle(barX, barY, barWidth, barHeight, COLORS.bg.void)
      .setStrokeStyle(BORDERS.medium, COLORS.network.dim)

    // Progress fill
    this.progressFill = this.add.rectangle(
      barX - barWidth / 2 + 2,
      barY,
      0,
      barHeight - 4,
      COLORS.network.primary
    ).setOrigin(0, 0.5)

    // Progress text
    this.progressText = this.add.text(barX, barY, '0%', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.primary)
    }).setOrigin(0.5)

    // Label
    this.add.text(barX, barY - 20, 'PROGRESS', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)
  }

  update(time, delta) {
    // Call base class update for curveball processing
    super.update(time, delta)
    if (this.isPaused || this.isGameOver) return

    // Move target zone
    this.updateZonePosition(delta)

    // Check if cursor is in zone
    this.checkCursorInZone()

    // Update progress
    this.updateProgress(delta)

    // Update visuals
    this.updateVisuals()

    // Check win condition - succeed at 80% progress
    if (this.progress >= this.successThreshold) {
      this.handleSuccess()
    }
  }

  // Handle curveball speed changes
  onCurveballStart({ type }) {
    if (type === 'speed_boost' || type === 'speed_slow') {
      // speedMultiplier is set by CurveballManager
      this.zoneMoveSpeed = this.baseZoneMoveSpeed * this.speedMultiplier
    }
  }

  onCurveballEnd({ type }) {
    if (type === 'speed_boost' || type === 'speed_slow') {
      this.zoneMoveSpeed = this.baseZoneMoveSpeed
    }
  }

  updateZonePosition(delta) {
    const speed = this.zoneMoveSpeed * (delta / 16)
    let newX = this.targetZone.x + this.zoneDirection.x * speed
    let newY = this.targetZone.y + this.zoneDirection.y * speed

    // Bounce off walls
    if (newX - this.zoneSize < this.playArea.x || newX + this.zoneSize > this.playArea.x + this.playArea.width) {
      this.zoneDirection.x *= -1
      newX = this.targetZone.x + this.zoneDirection.x * speed
    }
    if (newY - this.zoneSize < this.playArea.y || newY + this.zoneSize > this.playArea.y + this.playArea.height) {
      this.zoneDirection.y *= -1
      newY = this.targetZone.y + this.zoneDirection.y * speed
    }

    // Occasionally change direction slightly
    if (Math.random() < 0.01) {
      this.zoneDirection.x += (Math.random() - 0.5) * 0.5
      this.zoneDirection.y += (Math.random() - 0.5) * 0.5

      // Normalize
      const len = Math.sqrt(this.zoneDirection.x ** 2 + this.zoneDirection.y ** 2)
      this.zoneDirection.x /= len
      this.zoneDirection.y /= len
    }

    this.targetZone.setPosition(newX, newY)
  }

  checkCursorInZone() {
    const dist = Phaser.Math.Distance.Between(
      this.cursor.x, this.cursor.y,
      this.targetZone.x, this.targetZone.y
    )

    const wasInZone = this.isInZone
    const wasInGraceZone = this.isInGraceZone

    // Three states: in zone (full progress), in grace zone (no penalty), out (penalty)
    this.isInZone = dist < this.zoneSize
    this.isInGraceZone = !this.isInZone && dist < (this.zoneSize + this.graceZone)

    // Play sound when entering/exiting zone
    if (this.isInZone && !wasInZone) {
      // Entered zone - play positive sound
      try { audioManager.playHit() } catch (e) { /* ignore */ }
      // Pulse effect
      this.tweens.add({
        targets: this.zoneCircle,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 100,
        yoyo: true
      })
    } else if (!this.isInZone && !this.isInGraceZone && (wasInZone || wasInGraceZone)) {
      // Left zone completely - play warning sound
      try { audioManager.playMiss() } catch (e) { /* ignore */ }
    }
  }

  updateProgress(delta) {
    const dt = delta / 1000

    if (this.isInZone) {
      // Full progress when in zone
      this.progress += this.progressSpeed * dt
      this.shakeFactor = Math.max(0, this.shakeFactor - 5 * dt)
    } else if (this.isInGraceZone) {
      // Grace zone: no progress, but minimal penalty (just stops gaining)
      // Small shake to warn player they're at the edge
      this.shakeFactor = Math.min(this.maxShake * 0.3, this.shakeFactor + 2 * dt)
    } else {
      // Outside both zones: penalty applies
      this.progress -= this.penaltySpeed * dt
      this.shakeFactor = Math.min(this.maxShake, this.shakeFactor + 10 * dt)
    }

    // Clamp progress
    this.progress = Phaser.Math.Clamp(this.progress, 0, this.targetProgress)

    // Update score to match progress exactly (no confusion)
    // Score = progress percentage for clarity
    this.score = Math.floor(this.progress)
    this.scoreText.setText(`${SYMBOLS.system} SCORE: ${this.score}%`)

    // Update progress bar
    const barWidth = 196
    this.progressFill.width = (this.progress / this.targetProgress) * barWidth
    this.progressText.setText(`${Math.floor(this.progress)}%`)
  }

  updateVisuals() {
    // Update cursor color based on zone state
    let cursorColor
    if (this.isInZone) {
      cursorColor = COLORS.network.primary
    } else if (this.isInGraceZone) {
      cursorColor = COLORS.status.warning  // Yellow for grace zone
    } else {
      cursorColor = COLORS.status.danger
    }

    this.cursorV.setFillStyle(cursorColor)
    this.cursorH.setFillStyle(cursorColor)
    this.cursorDot.setFillStyle(cursorColor)
    this.cursorRing.setStrokeStyle(2, cursorColor)

    // Update zone glow and status based on state
    if (this.isInZone) {
      this.zoneGlow.setFillStyle(COLORS.network.primary, 0.4)
      this.zoneCircle.setStrokeStyle(4, COLORS.network.primary)
      this.statusText.setText(`${SYMBOLS.system} HOLD STEADY!`)
      this.statusText.setColor(toHexString(COLORS.network.primary))
    } else if (this.isInGraceZone) {
      this.zoneGlow.setFillStyle(COLORS.status.warning, 0.3)
      this.zoneCircle.setStrokeStyle(3, COLORS.status.warning)
      this.statusText.setText(`${SYMBOLS.alert} EDGE OF ZONE!`)
      this.statusText.setColor(toHexString(COLORS.status.warning))
    } else {
      this.zoneGlow.setFillStyle(COLORS.status.danger, 0.2)
      this.zoneCircle.setStrokeStyle(3, COLORS.network.primary)
      this.statusText.setText(`${SYMBOLS.system} GET BACK IN ZONE!`)
      this.statusText.setColor(toHexString(COLORS.status.danger))
    }

    // Progress bar color
    const progressPercent = this.progress / this.targetProgress
    if (progressPercent > 0.7) {
      this.progressFill.setFillStyle(COLORS.network.primary)
    } else if (progressPercent > 0.3) {
      this.progressFill.setFillStyle(COLORS.status.warning)
    } else {
      this.progressFill.setFillStyle(COLORS.status.danger)
    }

    // Pulse zone when close to completion
    if (progressPercent > 0.8 && this.isInZone) {
      const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.05
      this.targetZone.setScale(pulse)
    } else {
      this.targetZone.setScale(1)
    }
  }

  handleSuccess() {
    // Don't set isGameOver here - let endGame() handle it
    // Just prevent multiple calls
    if (this.successHandled) return
    this.successHandled = true

    console.log('[SteadyHandGame] handleSuccess() called')

    // Success animation - Network green flash (0, 255, 65)
    try {
      this.cameras.main.flash(200, 0, 255, 65)
      audioManager.playHit()
    } catch (e) {
      console.warn('[SteadyHandGame] Animation/audio error:', e)
    }

    const successText = this.add.text(this.gameWidth / 2, this.gameHeight / 2, `${SYMBOLS.check} SUCCESS!`, {
      ...getTerminalStyle('display'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5)

    this.tweens.add({
      targets: successText,
      scale: { from: 0.5, to: 1.2 },
      duration: 300
    })

    // Final score = progress percentage (no confusing bonuses)
    this.score = Math.floor(this.progress)

    // Show cursor again
    this.input.setDefaultCursor('default')

    // Call endGame immediately - no delay needed
    console.log('[SteadyHandGame] Calling endGame(true)')
    this.endGame(true)
  }

  shutdown() {
    // Restore cursor on scene exit
    this.input.setDefaultCursor('default')
    super.shutdown()
  }
}

export default SteadyHandGame
