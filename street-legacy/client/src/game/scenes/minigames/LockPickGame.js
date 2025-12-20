// Lock Pick Mini-Game
// Stop the picker in the green zone to crack locks

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { COLORS, SYMBOLS, getTerminalStyle, toHexString, BORDERS } from '../../ui/NetworkTheme'

export class LockPickGame extends BaseMiniGame {
  // Declare supported curveballs
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.SCREEN_SHAKE,
      CURVEBALL_TYPES.VISUAL_BLUR,
      CURVEBALL_TYPES.DISTRACTION
    ]
  }

  constructor() {
    super('LockPickGame')

    this.picker = null
    this.zone = null
    this.pickerX = 50
    this.pickerDirection = 1
    this.pickerSpeed = 2.5  // Slower base speed for better control
    this.zoneX = 200
    this.zoneWidth = 80  // Wider zone for easier targeting
    this.locksCompleted = 0
    this.totalLocks = 5
    this.isAnimating = false

    this.lockIcons = []
    this.statusText = null
    this.barLeft = 40
    this.barWidth = 320
  }

  create() {
    super.create()

    // Difficulty scaling - slower speeds, gentler curve
    this.pickerSpeed = 2.2 + (this.gameData.difficulty - 1) * 0.8
    this.zoneWidth = Math.max(40, 85 - (this.gameData.difficulty - 1) * 8)
    this.totalLocks = this.gameData.targetScore || 5

    this.barLeft = (this.gameWidth - this.barWidth) / 2

    // Lock icon
    this.add.text(this.gameWidth / 2, 200, '🔐', { fontSize: '80px' }).setOrigin(0.5)

    // Status
    this.statusText = this.add.text(this.gameWidth / 2, 300, `${SYMBOLS.system} CRACK THE LOCK`, {
      ...getTerminalStyle('xl'),
      fontSize: '26px'
    }).setOrigin(0.5)

    // Bar background
    this.add.rectangle(this.gameWidth / 2, 400, this.barWidth, 50, COLORS.bg.card)
      .setStrokeStyle(BORDERS.medium, COLORS.bg.elevated)

    // Zone - positioned closer to center (middle 60% of the bar)
    const centerX = this.gameWidth / 2
    const centerRange = this.barWidth * 0.3  // Zone spawns within 30% of center
    this.zoneX = Phaser.Math.Between(centerX - centerRange, centerX + centerRange)
    this.zone = this.add.rectangle(this.zoneX, 400, this.zoneWidth, 50, COLORS.network.primary, 0.4)

    // Picker
    this.pickerX = this.barLeft + 10
    this.picker = this.add.rectangle(this.pickerX, 400, 8, 60, COLORS.status.warning)

    // Lock progress
    this.lockIcons = []
    const startX = this.gameWidth / 2 - (this.totalLocks * 18)
    for (let i = 0; i < this.totalLocks; i++) {
      const icon = this.add.text(startX + i * 36, 480, '🔒', { fontSize: '28px' }).setOrigin(0.5)
      this.lockIcons.push(icon)
    }

    // Instructions
    this.add.text(this.gameWidth / 2, 550, 'TAP or SPACE to stop the picker in the green zone', {
      ...getTerminalStyle('sm'),
      fontSize: '13px'
    }).setOrigin(0.5)

    // Input
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', () => this.tryStop())
    }
    this.input.on('pointerdown', () => this.tryStop())
  }

  update(time, delta) {
    if (this.isPaused || this.isGameOver || this.isAnimating) return

    // Move picker
    this.pickerX += this.pickerSpeed * this.pickerDirection

    const maxX = this.barLeft + this.barWidth - 10
    const minX = this.barLeft + 10

    if (this.pickerX >= maxX) {
      this.pickerX = maxX
      this.pickerDirection = -1
    } else if (this.pickerX <= minX) {
      this.pickerX = minX
      this.pickerDirection = 1
    }

    this.picker.setX(this.pickerX)
  }

  tryStop() {
    if (this.isPaused || this.isGameOver || this.isAnimating) return

    this.isAnimating = true

    const zoneLeft = this.zoneX - this.zoneWidth / 2
    const zoneRight = this.zoneX + this.zoneWidth / 2
    const inZone = this.pickerX >= zoneLeft && this.pickerX <= zoneRight

    if (inZone) {
      // Success - flash with Network green RGB (0, 255, 65)
      this.cameras.main.flash(100, 0, 255, 65)
      this.statusText.setText(`${SYMBOLS.system} CLICK!`).setColor(toHexString(COLORS.network.primary))
      this.lockIcons[this.locksCompleted].setText('🔓')
      this.locksCompleted++
      this.addScore(1)

      this.time.delayedCall(350, () => {
        if (this.locksCompleted >= this.totalLocks) {
          this.endGame(true)
        } else {
          this.statusText.setText(`${SYMBOLS.system} CRACK THE LOCK`).setColor(toHexString(COLORS.text.primary))
          // Keep zone closer to center (within 35% of center, slightly wider range as difficulty increases)
          const centerX = this.gameWidth / 2
          const centerRange = this.barWidth * (0.25 + this.locksCompleted * 0.03)  // Expands slightly each lock
          this.zoneX = Phaser.Math.Between(centerX - centerRange, centerX + centerRange)
          this.zone.setX(this.zoneX)
          this.zoneWidth = Math.max(35, this.zoneWidth - 3)  // Shrinks slower, minimum 35
          this.zone.width = this.zoneWidth
          this.pickerSpeed += 0.4  // Speed increases slower
          this.isAnimating = false
        }
      })
    } else {
      // Fail
      this.cameras.main.shake(200, 0.015)
      this.statusText.setText(`${SYMBOLS.system} ALARM!`).setColor(toHexString(COLORS.status.danger))
      this.picker.setFillStyle(COLORS.status.danger)

      this.time.delayedCall(500, () => {
        this.endGame(false)
      })
    }
  }
}

export default LockPickGame
