// Sniper Mini-Game
// Wait for the perfect moment and take the shot

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { audioManager } from '../../managers/AudioManager'
import { COLORS, SYMBOLS, getTerminalStyle, toHexString, BORDERS } from '../../ui/NetworkTheme'

export class SniperGame extends BaseMiniGame {
  // Declare supported curveballs
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.SCREEN_SHAKE,
      CURVEBALL_TYPES.VISUAL_BLUR,
      CURVEBALL_TYPES.DISTRACTION
    ]
  }

  constructor() {
    super('SniperGame')

    this.scope = null
    this.target = null
    this.crosshair = null
    this.breathing = 0
    this.breathingSpeed = 2
    this.breathingAmplitude = 30
    this.isHoldingBreath = false
    this.breathHoldTime = 0
    this.maxBreathHold = 3 // seconds
    this.stability = 100
    this.shotsFired = 0
    this.shotsRequired = 1
    this.targetMovePattern = 'patrol'
    this.targetSpeed = 1
    this.targetDirection = 1
  }

  create() {
    super.create()

    // Reset game state flags
    this.successHandled = false

    // Difficulty scaling
    if (this.gameData.difficulty >= 4) {
      this.shotsRequired = 3
      this.targetSpeed = 2.5
      this.breathingAmplitude = 40
      this.maxBreathHold = 2
    } else if (this.gameData.difficulty >= 2) {
      this.shotsRequired = 2
      this.targetSpeed = 1.8
      this.breathingAmplitude = 35
      this.maxBreathHold = 2.5
    } else {
      this.shotsRequired = 1
      this.targetSpeed = 1.2
      this.breathingAmplitude = 30
      this.maxBreathHold = 3
    }

    // Create environment
    this.createEnvironment()

    // Create target
    this.createTarget()

    // Create scope overlay
    this.createScope()

    // Create breath meter
    this.createBreathMeter()

    // Setup input
    this.setupInput()

    // Instructions
    this.add.text(this.gameWidth / 2, this.gameHeight - 40,
      'HOLD SPACE/CLICK to steady | RELEASE to shoot', {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)

    // Shot counter
    this.shotText = this.add.text(this.gameWidth / 2, this.gameHeight - 60,
      `${SYMBOLS.system} Targets: ${this.shotsFired}/${this.shotsRequired}`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.status.warning)
      }).setOrigin(0.5)
  }

  createEnvironment() {
    // Background (distant scene through scope)
    this.add.rectangle(this.gameWidth / 2, this.gameHeight / 2, this.gameWidth, this.gameHeight, COLORS.bg.panel)

    // Distant buildings
    const buildingColors = [COLORS.bg.elevated, COLORS.bg.panel, COLORS.bg.card]
    for (let i = 0; i < 8; i++) {
      const x = 30 + i * 50 + Phaser.Math.Between(-10, 10)
      const h = Phaser.Math.Between(100, 200)
      const w = Phaser.Math.Between(30, 50)
      this.add.rectangle(x, this.gameHeight - h / 2, w, h, buildingColors[i % 3])

      // Windows
      for (let wy = 0; wy < h - 20; wy += 25) {
        for (let wx = 0; wx < w - 10; wx += 15) {
          if (Math.random() > 0.3) {
            this.add.rectangle(x - w / 2 + 10 + wx, this.gameHeight - h + 15 + wy, 8, 12, COLORS.status.warning, Math.random() * 0.5 + 0.2)
          }
        }
      }
    }

    // Street
    this.add.rectangle(this.gameWidth / 2, this.gameHeight - 40, this.gameWidth, 80, COLORS.bg.elevated)

    // Street markings
    for (let x = 20; x < this.gameWidth; x += 50) {
      this.add.rectangle(x, this.gameHeight - 40, 30, 4, COLORS.status.warning)
    }
  }

  createTarget() {
    // Target starting position
    const startX = this.gameWidth / 4
    const startY = this.gameHeight - 90

    this.target = this.add.container(startX, startY)

    // Target silhouette (person)
    const body = this.add.rectangle(0, 0, 25, 50, COLORS.bg.void)
    const head = this.add.circle(0, -35, 12, COLORS.bg.void)
    this.target.add([body, head])

    // Target indicator (subtle)
    const indicator = this.add.circle(0, 0, 20, COLORS.status.danger, 0)
      .setStrokeStyle(2, COLORS.status.danger)
    this.target.add(indicator)

    // Store references
    this.target.setData('body', body)
    this.target.setData('head', head)
    this.target.setData('indicator', indicator)
    this.target.setData('hit', false)

    // Movement bounds
    this.targetMinX = 50
    this.targetMaxX = this.gameWidth - 50
  }

  createScope() {
    // Scope container (moves with breathing)
    this.scope = this.add.container(this.gameWidth / 2, this.gameHeight / 2)

    // Scope mask/vignette (dark edges)
    const vignetteGraphics = this.add.graphics()

    // Create scope view with dark edges
    vignetteGraphics.fillStyle(COLORS.bg.void, 0.9)
    vignetteGraphics.fillRect(-this.gameWidth, -this.gameHeight, this.gameWidth * 2, this.gameHeight * 2)

    // Cut out the scope circle
    vignetteGraphics.fillStyle(COLORS.bg.void, 0)
    vignetteGraphics.beginPath()
    vignetteGraphics.arc(0, 0, 140, 0, Math.PI * 2)
    vignetteGraphics.fill()

    // Scope edge
    const scopeRing = this.add.circle(0, 0, 145, COLORS.bg.void, 0)
      .setStrokeStyle(8, COLORS.bg.void)
    this.scope.add(scopeRing)

    // Inner scope ring
    const innerRing = this.add.circle(0, 0, 140, COLORS.bg.void, 0)
      .setStrokeStyle(2, COLORS.bg.elevated)
    this.scope.add(innerRing)

    // Crosshair
    this.crosshair = this.add.container(0, 0)

    // Vertical line
    const vLine = this.add.rectangle(0, 0, 2, 280, COLORS.status.danger, 0.7)
    this.crosshair.add(vLine)

    // Horizontal line
    const hLine = this.add.rectangle(0, 0, 280, 2, COLORS.status.danger, 0.7)
    this.crosshair.add(hLine)

    // Center dot
    const centerDot = this.add.circle(0, 0, 3, COLORS.status.danger)
    this.crosshair.add(centerDot)

    // Range markers
    for (let i = 1; i <= 3; i++) {
      // Vertical ticks
      this.crosshair.add(this.add.rectangle(0, i * 30, 10, 2, COLORS.status.danger, 0.5))
      this.crosshair.add(this.add.rectangle(0, -i * 30, 10, 2, COLORS.status.danger, 0.5))

      // Horizontal ticks
      this.crosshair.add(this.add.rectangle(i * 30, 0, 2, 10, COLORS.status.danger, 0.5))
      this.crosshair.add(this.add.rectangle(-i * 30, 0, 2, 10, COLORS.status.danger, 0.5))
    }

    this.scope.add(this.crosshair)

    // Stability indicator in scope
    this.stabilityText = this.add.text(0, 110, `${SYMBOLS.system} STEADY: 100%`, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5)
    this.scope.add(this.stabilityText)

    // Distance indicator
    this.add.text(0, -120, `${SYMBOLS.system} RANGE: 150m`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)
    this.scope.add(this.scope.list[this.scope.list.length - 1])
  }

  createBreathMeter() {
    const meterX = this.gameWidth - 40
    const meterY = this.gameHeight / 2
    const meterHeight = 150

    // Background
    this.add.rectangle(meterX, meterY, 20, meterHeight, COLORS.bg.elevated)
      .setStrokeStyle(BORDERS.medium, COLORS.bg.elevated)

    // Fill (breath remaining)
    this.breathFill = this.add.rectangle(meterX, meterY + meterHeight / 2 - 2, 16, 0, COLORS.status.info)
      .setOrigin(0.5, 1)

    // Label
    this.add.text(meterX, meterY - meterHeight / 2 - 15, 'BREATH', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    // Lung icon
    this.breathIcon = this.add.text(meterX, meterY + meterHeight / 2 + 15, '🫁', {
      fontSize: '20px'
    }).setOrigin(0.5)
  }

  setupInput() {
    // Space bar to hold breath
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', () => this.startHoldingBreath())
      this.input.keyboard.on('keyup-SPACE', () => this.shoot())
    }

    // Mouse/touch
    this.input.on('pointerdown', () => this.startHoldingBreath())
    this.input.on('pointerup', () => this.shoot())
  }

  startHoldingBreath() {
    if (this.isPaused || this.isGameOver) return
    if (this.stability <= 0) return // Can't hold breath if exhausted

    this.isHoldingBreath = true
  }

  shoot() {
    if (this.isPaused || this.isGameOver) return
    if (!this.isHoldingBreath) return

    this.isHoldingBreath = false

    // Check if target is in crosshair
    const scopeX = this.scope.x
    const scopeY = this.scope.y
    const targetX = this.target.x
    const targetY = this.target.y

    const dist = Phaser.Math.Distance.Between(scopeX, scopeY, targetX, targetY)
    const hitRadius = 40 // How close to center for a hit

    // Shot effect
    this.cameras.main.shake(100, 0.02)

    // Muzzle flash
    const flash = this.add.circle(scopeX, scopeY, 30, COLORS.text.primary)
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 100,
      onComplete: () => flash.destroy()
    })

    if (dist < hitRadius && !this.target.getData('hit')) {
      this.handleHit()
    } else {
      this.handleMiss()
    }

    // Reset breath
    this.breathHoldTime = 0
  }

  handleHit() {
    audioManager.playHit()
    this.cameras.main.flash(100, 0, 255, 65)

    // Mark target as hit
    this.target.getData('body').setFillStyle(COLORS.status.danger)
    this.target.getData('head').setFillStyle(COLORS.status.danger)
    this.target.setData('hit', true)

    this.shotsFired++
    this.shotText.setText(`${SYMBOLS.system} Targets: ${this.shotsFired}/${this.shotsRequired}`)

    // Add score
    this.addScore(200 + Math.floor(this.stability * 2))

    // Hit text
    const hitText = this.add.text(this.target.x, this.target.y - 60, `${SYMBOLS.system} HIT!`, {
      ...getTerminalStyle('xxl'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5)

    this.tweens.add({
      targets: hitText,
      y: hitText.y - 30,
      alpha: 0,
      duration: 800,
      onComplete: () => hitText.destroy()
    })

    // Check if all targets hit
    if (this.shotsFired >= this.shotsRequired) {
      this.time.delayedCall(500, () => this.handleSuccess())
    } else {
      // Spawn new target
      this.time.delayedCall(1000, () => this.respawnTarget())
    }
  }

  handleMiss() {
    audioManager.playMiss()

    // Miss indicator
    const missText = this.add.text(this.scope.x, this.scope.y, `${SYMBOLS.system} MISS!`, {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.status.danger)
    }).setOrigin(0.5)

    this.tweens.add({
      targets: missText,
      y: missText.y - 30,
      alpha: 0,
      duration: 600,
      onComplete: () => missText.destroy()
    })

    // Penalty - target moves faster
    this.targetSpeed *= 1.2
  }

  respawnTarget() {
    // Reset target
    this.target.x = Phaser.Math.Between(this.targetMinX, this.targetMaxX)
    this.target.getData('body').setFillStyle(COLORS.bg.void)
    this.target.getData('head').setFillStyle(COLORS.bg.void)
    this.target.setData('hit', false)

    // Increase speed
    this.targetSpeed += 0.3
  }

  handleSuccess() {
    // Use separate flag - don't set isGameOver (let endGame handle it)
    if (this.successHandled) return
    this.successHandled = true

    try {
      this.cameras.main.flash(200, 0, 255, 65)
    } catch (e) { /* ignore */ }

    const successText = this.add.text(this.gameWidth / 2, this.gameHeight / 2, `${SYMBOLS.system} TARGET ELIMINATED!`, {
      ...getTerminalStyle('xxl'),
      color: toHexString(COLORS.network.glow)
    }).setOrigin(0.5)

    this.tweens.add({
      targets: successText,
      scale: { from: 0.5, to: 1.2 },
      duration: 300
    })

    // Time bonus
    this.addScore(Math.floor(this.timeRemaining * 5))

    // Call endGame immediately
    this.endGame(true)
  }

  update(time, delta) {
    if (this.isPaused || this.isGameOver) return

    const dt = delta / 1000

    // Update breathing sway (when not holding breath)
    if (!this.isHoldingBreath) {
      this.breathing += this.breathingSpeed * dt
      const swayX = Math.sin(this.breathing) * this.breathingAmplitude
      const swayY = Math.cos(this.breathing * 0.7) * this.breathingAmplitude * 0.5

      this.scope.x = this.gameWidth / 2 + swayX
      this.scope.y = this.gameHeight / 2 + swayY

      // Regenerate stability when not holding
      this.stability = Math.min(100, this.stability + 20 * dt)
    } else {
      // Holding breath - much steadier
      this.breathHoldTime += dt

      // Small sway increases over time
      const holdSway = Math.min(this.breathHoldTime * 5, 15)
      const microSwayX = Math.sin(time * 0.01) * holdSway
      const microSwayY = Math.cos(time * 0.008) * holdSway * 0.5

      this.scope.x = this.gameWidth / 2 + microSwayX
      this.scope.y = this.gameHeight / 2 + microSwayY

      // Drain stability
      this.stability = Math.max(0, this.stability - (100 / this.maxBreathHold) * dt)

      // Force release if out of breath
      if (this.stability <= 0) {
        this.isHoldingBreath = false
      }
    }

    // Update stability display
    this.stabilityText.setText(`${SYMBOLS.system} STEADY: ${Math.floor(this.stability)}%`)
    if (this.stability > 70) {
      this.stabilityText.setColor(toHexString(COLORS.network.primary))
    } else if (this.stability > 30) {
      this.stabilityText.setColor(toHexString(COLORS.status.warning))
    } else {
      this.stabilityText.setColor(toHexString(COLORS.status.danger))
    }

    // Update breath meter
    this.breathFill.height = (this.stability / 100) * 146

    // Breath icon pulse when low
    if (this.stability < 30 && this.isHoldingBreath) {
      this.breathIcon.setScale(1 + Math.sin(time * 0.02) * 0.2)
    } else {
      this.breathIcon.setScale(1)
    }

    // Update crosshair color based on target alignment
    const dist = Phaser.Math.Distance.Between(this.scope.x, this.scope.y, this.target.x, this.target.y)
    if (dist < 40) {
      this.crosshair.list.forEach(item => {
        if (item.setFillStyle) item.setFillStyle(COLORS.network.primary)
        if (item.setStrokeStyle) item.setStrokeStyle(2, COLORS.network.primary)
      })
    } else {
      this.crosshair.list.forEach(item => {
        if (item.setFillStyle) item.setFillStyle(COLORS.status.danger, 0.7)
      })
    }

    // Move target
    this.updateTarget(dt)
  }

  updateTarget(dt) {
    if (this.target.getData('hit')) return

    // Patrol movement
    this.target.x += this.targetDirection * this.targetSpeed * 60 * dt

    // Bounce at boundaries
    if (this.target.x <= this.targetMinX || this.target.x >= this.targetMaxX) {
      this.targetDirection *= -1
    }

    // Random direction changes
    if (Math.random() < 0.005) {
      this.targetDirection *= -1
    }

    // Random speed variations
    if (Math.random() < 0.01) {
      this.targetSpeed = this.targetSpeed * 0.8 + Math.random() * 0.4
    }
  }
}

export default SniperGame
