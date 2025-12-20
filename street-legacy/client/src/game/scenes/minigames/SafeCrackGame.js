// Safe Crack Mini-Game
// Crack the combination lock by finding the correct numbers

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { audioManager } from '../../managers/AudioManager'
import { COLORS, SYMBOLS, getTerminalStyle, toHexString, BORDERS } from '../../ui/NetworkTheme'

export class SafeCrackGame extends BaseMiniGame {
  // Declare supported curveballs
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.SCREEN_SHAKE,
      CURVEBALL_TYPES.VISUAL_BLUR,
      CURVEBALL_TYPES.SPEED_BOOST,
      CURVEBALL_TYPES.SPEED_SLOW
    ]
  }

  constructor() {
    super('SafeCrackGame')

    this.dial = null
    this.dialAngle = 0
    this.targetNumbers = []
    this.currentTargetIndex = 0
    this.currentDirection = 1 // 1 = clockwise, -1 = counter-clockwise
    this.isRotating = false
    this.lastNumber = 0
    this.successCount = 0
    this.totalNumbers = 3
    this.dialSensitivity = 0.5
    this.numberRange = 40 // 0-39
    this.hintActive = false
    this.feedbackText = null
  }

  create() {
    super.create()

    // Difficulty scaling
    if (this.gameData.difficulty >= 4) {
      this.totalNumbers = 5
      this.dialSensitivity = 0.3
    } else if (this.gameData.difficulty >= 2) {
      this.totalNumbers = 4
      this.dialSensitivity = 0.4
    } else {
      this.totalNumbers = 3
      this.dialSensitivity = 0.5
    }

    // Generate random combination
    this.generateCombination()

    // Draw safe door background
    this.drawSafeBackground()

    // Create the dial
    this.createDial()

    // Create combination display
    this.createCombinationDisplay()

    // Instructions
    this.instructionText = this.add.text(this.gameWidth / 2, this.gameHeight - 60,
      'Drag dial to rotate | Find the numbers in order', {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)

    this.directionText = this.add.text(this.gameWidth / 2, this.gameHeight - 40,
      this.getDirectionText(), {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.status.warning)
      }).setOrigin(0.5)

    // Feedback text
    this.feedbackText = this.add.text(this.gameWidth / 2, 150, '', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setAlpha(0)
  }

  generateCombination() {
    this.targetNumbers = []
    for (let i = 0; i < this.totalNumbers; i++) {
      // Ensure numbers are at least 5 apart for clarity
      let num
      do {
        num = Phaser.Math.Between(0, this.numberRange - 1)
      } while (this.targetNumbers.some(n => Math.abs(n - num) < 5))
      this.targetNumbers.push(num)
    }
  }

  drawSafeBackground() {
    // Safe door
    const safeX = this.gameWidth / 2
    const safeY = this.gameHeight / 2 + 20

    // Outer frame
    this.add.rectangle(safeX, safeY, 280, 280, COLORS.bg.secondary)
      .setStrokeStyle(4, COLORS.border.panel)

    // Inner panel
    this.add.rectangle(safeX, safeY, 250, 250, COLORS.bg.panel)
      .setStrokeStyle(2, COLORS.bg.secondary)

    // Decorative bolts
    const boltPositions = [
      { x: -110, y: -110 }, { x: 110, y: -110 },
      { x: -110, y: 110 }, { x: 110, y: 110 }
    ]
    boltPositions.forEach(pos => {
      this.add.circle(safeX + pos.x, safeY + pos.y, 8, COLORS.border.panel)
        .setStrokeStyle(1, COLORS.text.muted)
    })

    // Handle
    this.add.rectangle(safeX + 90, safeY, 15, 60, COLORS.border.panel)
      .setStrokeStyle(2, COLORS.text.muted)
  }

  createDial() {
    const dialX = this.gameWidth / 2
    const dialY = this.gameHeight / 2 + 20
    const dialRadius = 80

    // Dial container
    this.dialContainer = this.add.container(dialX, dialY)

    // Outer ring
    const outerRing = this.add.circle(0, 0, dialRadius + 10, COLORS.border.panel)
      .setStrokeStyle(3, COLORS.border.panel)
    this.dialContainer.add(outerRing)

    // Main dial
    this.dial = this.add.circle(0, 0, dialRadius, COLORS.bg.panel)
      .setStrokeStyle(2, COLORS.status.info)
    this.dialContainer.add(this.dial)

    // Center knob
    const centerKnob = this.add.circle(0, 0, 20, COLORS.bg.secondary)
      .setStrokeStyle(2, COLORS.border.panel)
    this.dialContainer.add(centerKnob)

    // Dial marker (indicator line)
    this.dialMarker = this.add.rectangle(0, -dialRadius + 15, 4, 25, COLORS.status.danger)
    this.dialContainer.add(this.dialMarker)

    // Number markings around the dial
    for (let i = 0; i < this.numberRange; i++) {
      const angle = (i / this.numberRange) * Math.PI * 2 - Math.PI / 2
      const markRadius = dialRadius - 8
      const markX = Math.cos(angle) * markRadius
      const markY = Math.sin(angle) * markRadius

      // Major ticks every 5
      if (i % 5 === 0) {
        const tickEnd = dialRadius - 20
        const tickX = Math.cos(angle) * tickEnd
        const tickY = Math.sin(angle) * tickEnd

        this.add.line(dialX, dialY, markX, markY, tickX, tickY, COLORS.text.primary)
          .setLineWidth(2)

        // Number labels every 10
        if (i % 10 === 0) {
          const labelRadius = dialRadius + 25
          const labelX = Math.cos(angle) * labelRadius
          const labelY = Math.sin(angle) * labelRadius

          this.add.text(dialX + labelX, dialY + labelY, i.toString(), {
            ...getTerminalStyle('md'),
            color: toHexString(COLORS.text.muted)
          }).setOrigin(0.5)
        }
      }
    }

    // Fixed indicator at top
    this.add.triangle(dialX, dialY - dialRadius - 20, 0, 0, -10, -15, 10, -15, COLORS.status.danger)
      .setAngle(180)

    // Current number display
    this.currentNumberText = this.add.text(dialX, dialY,
      '0', {
        ...getTerminalStyle('xl'),
        color: toHexString(COLORS.text.primary)
      }).setOrigin(0.5)

    // Make dial interactive
    this.dialContainer.setSize(dialRadius * 2, dialRadius * 2)
    this.dialContainer.setInteractive({ useHandCursor: true, draggable: true })

    // Drag events
    this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
      if (gameObject === this.dialContainer) {
        this.handleDialDrag(pointer)
      }
    })

    // Track last pointer position for drag calculation
    this.lastPointerAngle = 0
    this.dialContainer.on('pointerdown', (pointer) => {
      this.lastPointerAngle = this.getPointerAngle(pointer)
      this.isRotating = true
    })

    this.input.on('pointerup', () => {
      this.isRotating = false
      this.checkNumber()
    })
  }

  getPointerAngle(pointer) {
    const dialX = this.gameWidth / 2
    const dialY = this.gameHeight / 2 + 20
    return Math.atan2(pointer.y - dialY, pointer.x - dialX)
  }

  handleDialDrag(pointer) {
    if (this.isPaused || this.isGameOver) return

    const currentAngle = this.getPointerAngle(pointer)
    let angleDiff = currentAngle - this.lastPointerAngle

    // Handle wrap-around
    if (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    if (angleDiff < -Math.PI) angleDiff += Math.PI * 2

    // Apply rotation
    this.dialAngle += angleDiff * this.dialSensitivity
    this.dialContainer.setRotation(this.dialAngle)

    // Calculate current number from angle
    let normalizedAngle = this.dialAngle % (Math.PI * 2)
    if (normalizedAngle < 0) normalizedAngle += Math.PI * 2
    const currentNumber = Math.round((normalizedAngle / (Math.PI * 2)) * this.numberRange) % this.numberRange

    // Detect direction change
    const diff = currentNumber - this.lastNumber
    if (Math.abs(diff) < 20) { // Ignore wrap-around
      if (diff > 0) this.currentDirection = 1
      else if (diff < 0) this.currentDirection = -1
    }

    this.lastNumber = currentNumber
    this.currentNumberText.setText(currentNumber.toString())
    this.lastPointerAngle = currentAngle

    // Click sound on number change
    if (Math.abs(diff) > 0 && Math.abs(diff) < 5) {
      // Subtle tick
    }
  }

  checkNumber() {
    if (this.isPaused || this.isGameOver) return

    const targetNumber = this.targetNumbers[this.currentTargetIndex]
    const currentNumber = parseInt(this.currentNumberText.text)

    // Check if we're on the right number
    if (Math.abs(currentNumber - targetNumber) <= 1) {
      this.handleCorrectNumber()
    }
  }

  handleCorrectNumber() {
    audioManager.playHit()
    this.cameras.main.flash(100, 0, 255, 65)

    // Mark this number as found
    this.successCount++
    this.currentTargetIndex++

    // Update combination display
    this.updateCombinationDisplay()

    // Show feedback
    this.showFeedback(`${SYMBOLS.system} CLICK!`, toHexString(COLORS.network.primary))

    // Add score
    this.addScore(100)

    // Check if all numbers found
    if (this.currentTargetIndex >= this.totalNumbers) {
      this.time.delayedCall(500, () => {
        this.handleSafeCracked()
      })
    } else {
      // Update direction for next number
      this.directionText.setText(this.getDirectionText())
    }
  }

  handleSafeCracked() {
    // Safe cracked animation
    this.cameras.main.flash(200, 0, 255, 65)

    const successText = this.add.text(this.gameWidth / 2, this.gameHeight / 2, `${SYMBOLS.system} CRACKED!`, {
      ...getTerminalStyle('2xl'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5)

    this.tweens.add({
      targets: successText,
      scale: { from: 0.5, to: 1.2 },
      duration: 300
    })

    // Time bonus
    this.addScore(this.timeRemaining * 5)

    this.time.delayedCall(1000, () => {
      this.endGame(true)
    })
  }

  showFeedback(text, color) {
    this.feedbackText.setText(text)
    this.feedbackText.setColor(color)
    this.feedbackText.setAlpha(1)

    this.tweens.add({
      targets: this.feedbackText,
      alpha: 0,
      y: this.feedbackText.y - 20,
      duration: 800,
      onComplete: () => {
        this.feedbackText.y = 150
      }
    })
  }

  createCombinationDisplay() {
    const startX = this.gameWidth / 2 - (this.totalNumbers * 35) / 2
    const y = 130

    this.add.text(this.gameWidth / 2, y - 30, 'COMBINATION', {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    this.numberDisplays = []
    for (let i = 0; i < this.totalNumbers; i++) {
      const x = startX + i * 35 + 17

      // Number box
      const box = this.add.rectangle(x, y, 30, 36, COLORS.bg.panel)
        .setStrokeStyle(2, COLORS.bg.secondary)

      // Number text (hidden initially based on difficulty)
      const numText = this.add.text(x, y, this.targetNumbers[i].toString(), {
        ...getTerminalStyle('lg'),
        color: toHexString(COLORS.text.primary)
      }).setOrigin(0.5)

      // Direction indicator
      const dirText = this.add.text(x, y + 25, i % 2 === 0 ? '↻' : '↺', {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)

      this.numberDisplays.push({ box, numText, dirText, found: false })

      // Separator
      if (i < this.totalNumbers - 1) {
        this.add.text(x + 17, y, '-', {
          ...getTerminalStyle('lg'),
          color: toHexString(COLORS.text.muted)
        }).setOrigin(0.5)
      }
    }

    // Highlight current target
    this.highlightCurrentTarget()
  }

  updateCombinationDisplay() {
    // Mark found number
    if (this.currentTargetIndex > 0) {
      const prevDisplay = this.numberDisplays[this.currentTargetIndex - 1]
      prevDisplay.found = true
      prevDisplay.box.setFillStyle(COLORS.network.dark)
      prevDisplay.box.setStrokeStyle(2, COLORS.network.primary)
    }

    // Highlight next target
    this.highlightCurrentTarget()
  }

  highlightCurrentTarget() {
    this.numberDisplays.forEach((display, index) => {
      if (!display.found) {
        if (index === this.currentTargetIndex) {
          display.box.setStrokeStyle(3, COLORS.status.warning)
        } else {
          display.box.setStrokeStyle(2, COLORS.bg.secondary)
        }
      }
    })
  }

  getDirectionText() {
    const direction = this.currentTargetIndex % 2 === 0 ? 'CLOCKWISE ↻' : 'COUNTER-CLOCKWISE ↺'
    return `Turn ${direction} to ${this.targetNumbers[this.currentTargetIndex]}`
  }

  update(time, delta) {
    if (this.isPaused || this.isGameOver) return
    // Safe cracking is input-based, minimal update needed
  }
}

export default SafeCrackGame
