// RhythmGame - Music/Timing based mini-game
// Arrows fall from top, player must press matching direction at the right time

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { audioManager } from '../../managers/AudioManager'
import { COLORS, toHexString, getTerminalStyle } from '../../ui/NetworkTheme'
import { createMiniGameEffects } from '../../utils/MiniGameEffects'

// Arrow directions
const DIRECTIONS = ['left', 'down', 'up', 'right']
const DIRECTION_KEYS = {
  left: 'LEFT',
  down: 'DOWN',
  up: 'UP',
  right: 'RIGHT'
}
const DIRECTION_ARROWS = {
  left: '◄',
  down: '▼',
  up: '▲',
  right: '►'
}
const DIRECTION_COLORS = {
  left: 0xff0040,  // Red
  down: 0x00ff41,  // Green
  up: 0x00aaff,    // Blue
  right: 0xffd700  // Gold
}

// Timing windows (in pixels from target line)
const TIMING = {
  PERFECT: 15,
  GREAT: 30,
  GOOD: 50,
  MISS: 80
}

// Points for each timing
const POINTS = {
  PERFECT: 100,
  GREAT: 75,
  GOOD: 50,
  MISS: 0
}

export class RhythmGame extends BaseMiniGame {
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.SCREEN_SHAKE,
      CURVEBALL_TYPES.BLUR,
      CURVEBALL_TYPES.SPEED_UP,
      CURVEBALL_TYPES.CONTROL_REVERSAL
    ]
  }

  constructor() {
    super('RhythmGame')

    this.arrows = []
    this.laneWidth = 60
    this.lanes = []
    this.targetY = 0
    this.spawnY = 0
    this.arrowSpeed = 3
    this.spawnTimer = null
    this.combo = 0
    this.maxCombo = 0
    this.lastHitRating = null
    this.effects = null
  }

  init(data) {
    super.init(data)
    this.arrows = []
    this.combo = 0
    this.maxCombo = 0
    this.lastHitRating = null

    // Difficulty scaling
    const tier = data.difficultyTier?.name || 'Novice'
    const tierSpeeds = {
      Novice: 2.5,
      Apprentice: 3,
      Skilled: 3.5,
      Expert: 4,
      Master: 5
    }
    this.arrowSpeed = tierSpeeds[tier] || 3
    this.spawnInterval = tier === 'Master' ? 600 : tier === 'Expert' ? 750 : 900
  }

  create() {
    super.create()

    this.effects = createMiniGameEffects(this)

    const { width, height } = this.scale

    // Lane setup
    const totalLaneWidth = this.laneWidth * 4
    const startX = (width - totalLaneWidth) / 2 + this.laneWidth / 2

    // Create lanes
    DIRECTIONS.forEach((dir, i) => {
      const x = startX + i * this.laneWidth
      this.lanes.push({
        x,
        direction: dir,
        key: this.input.keyboard.addKey(DIRECTION_KEYS[dir])
      })

      // Lane background
      this.add.rectangle(x, height / 2 + 50, this.laneWidth - 4, height - 200, COLORS.bg.panel, 0.3)
        .setStrokeStyle(1, DIRECTION_COLORS[dir], 0.3)

      // Lane label at top
      this.add.text(x, 130, DIRECTION_ARROWS[dir], {
        fontSize: '24px',
        color: toHexString(DIRECTION_COLORS[dir])
      }).setOrigin(0.5)
    })

    // Target line
    this.targetY = height - 120
    this.add.rectangle(width / 2, this.targetY, totalLaneWidth + 20, 4, COLORS.network.primary, 0.8)

    // Target indicators
    this.lanes.forEach(lane => {
      const indicator = this.add.circle(lane.x, this.targetY, 25)
        .setStrokeStyle(3, DIRECTION_COLORS[lane.direction], 0.6)
        .setFillStyle(COLORS.bg.void, 0.5)
      lane.indicator = indicator
    })

    // Spawn zone
    this.spawnY = 150

    // Instructions
    this.add.text(width / 2, height - 50, 'Press arrow keys when notes reach the line!', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    // Combo display
    this.comboText = this.add.text(width / 2, height - 180, '', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '24px',
      color: toHexString(COLORS.cred.gold),
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0)

    // Rating display
    this.ratingText = this.add.text(width / 2, this.targetY - 60, '', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0)

    // Start spawning arrows
    this.startSpawning()
  }

  startSpawning() {
    this.spawnTimer = this.time.addEvent({
      delay: this.spawnInterval,
      callback: () => this.spawnArrow(),
      loop: true
    })

    // Initial arrows
    this.spawnArrow()
  }

  spawnArrow() {
    if (this.isPaused || this.isGameOver) return

    // Pick random lane
    const laneIndex = Phaser.Math.Between(0, 3)
    const lane = this.lanes[laneIndex]
    const direction = DIRECTIONS[laneIndex]

    // Sometimes spawn double arrows on higher difficulties
    const tier = this.gameData.difficultyTier?.name || 'Novice'
    const doubleChance = tier === 'Master' ? 0.3 : tier === 'Expert' ? 0.2 : 0.1

    // Create arrow
    const arrow = this.createArrow(lane.x, this.spawnY, direction)
    this.arrows.push(arrow)

    // Maybe spawn a second arrow in a different lane
    if (Math.random() < doubleChance) {
      const otherLanes = [0, 1, 2, 3].filter(i => i !== laneIndex)
      const secondLane = Phaser.Math.RND.pick(otherLanes)
      const secondArrow = this.createArrow(
        this.lanes[secondLane].x,
        this.spawnY,
        DIRECTIONS[secondLane]
      )
      this.arrows.push(secondArrow)
    }
  }

  createArrow(x, y, direction) {
    const color = DIRECTION_COLORS[direction]

    // Arrow container
    const container = this.add.container(x, y)

    // Arrow body
    const body = this.add.circle(0, 0, 22, color, 0.9)
    body.setStrokeStyle(2, 0xffffff, 0.5)

    // Arrow symbol
    const symbol = this.add.text(0, 0, DIRECTION_ARROWS[direction], {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5)

    container.add([body, symbol])
    container.setData('direction', direction)
    container.setData('hit', false)
    container.setData('missed', false)
    container.setDepth(50)

    return container
  }

  update(time, delta) {
    super.update(time, delta)

    if (this.isPaused || this.isGameOver) return

    // Apply speed modifier from curveballs
    const speed = this.arrowSpeed * this.speedMultiplier

    // Move arrows down
    this.arrows.forEach(arrow => {
      if (!arrow.getData('hit') && !arrow.getData('missed')) {
        arrow.y += speed

        // Check if missed (passed target line too far)
        if (arrow.y > this.targetY + TIMING.MISS) {
          this.missArrow(arrow)
        }
      }
    })

    // Check for key presses
    this.checkInputs()

    // Clean up destroyed arrows
    this.arrows = this.arrows.filter(a => a.active)
  }

  checkInputs() {
    this.lanes.forEach((lane, i) => {
      if (Phaser.Input.Keyboard.JustDown(lane.key)) {
        // Apply control reversal if active
        let targetLane = i
        if (this.controlsReversed) {
          targetLane = 3 - i // Reverse: 0↔3, 1↔2
        }

        this.handleKeyPress(targetLane)
      }
    })
  }

  handleKeyPress(laneIndex) {
    const lane = this.lanes[laneIndex]
    const direction = DIRECTIONS[laneIndex]

    // Find the closest arrow in this lane that hasn't been hit
    let closestArrow = null
    let closestDistance = Infinity

    this.arrows.forEach(arrow => {
      if (arrow.getData('direction') === direction &&
          !arrow.getData('hit') &&
          !arrow.getData('missed')) {
        const distance = Math.abs(arrow.y - this.targetY)
        if (distance < closestDistance) {
          closestDistance = distance
          closestArrow = arrow
        }
      }
    })

    // Check timing
    if (closestArrow && closestDistance < TIMING.MISS) {
      this.hitArrow(closestArrow, closestDistance, laneIndex)
    } else {
      // No arrow to hit - still flash the indicator
      this.flashIndicator(laneIndex, 0x666666)
    }
  }

  hitArrow(arrow, distance, laneIndex) {
    arrow.setData('hit', true)

    let rating, points, color

    if (distance <= TIMING.PERFECT) {
      rating = 'PERFECT!'
      points = POINTS.PERFECT
      color = 0xffd700
      this.effects.perfectHit(arrow.x, this.targetY)
    } else if (distance <= TIMING.GREAT) {
      rating = 'GREAT!'
      points = POINTS.GREAT
      color = 0x00ff41
    } else if (distance <= TIMING.GOOD) {
      rating = 'GOOD'
      points = POINTS.GOOD
      color = 0x00aaff
    } else {
      rating = 'OK'
      points = 25
      color = 0xffffff
    }

    // Update combo
    this.combo++
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo
    }

    // Apply combo bonus
    const comboBonus = Math.floor(this.combo / 5) * 10
    points += comboBonus

    // Add score
    this.addScore(points)

    // Flash indicator
    this.flashIndicator(laneIndex, color)

    // Show rating
    this.showRating(rating, color)

    // Update combo display
    this.updateComboDisplay()

    // Visual feedback
    this.effects.sparkEffect(arrow.x, this.targetY, { color, count: 6 })

    // Animate arrow destruction
    this.tweens.add({
      targets: arrow,
      scale: 1.5,
      alpha: 0,
      duration: 150,
      onComplete: () => arrow.destroy()
    })

    // Sound
    if (rating === 'PERFECT!') {
      audioManager.playPerfect()
    } else {
      audioManager.playHit()
    }
  }

  missArrow(arrow) {
    arrow.setData('missed', true)

    // Break combo
    this.combo = 0
    this.updateComboDisplay()

    // Show miss rating
    this.showRating('MISS', 0xff0040)

    // Fade out
    this.tweens.add({
      targets: arrow,
      alpha: 0.3,
      y: arrow.y + 50,
      duration: 300,
      onComplete: () => arrow.destroy()
    })

    // Sound
    audioManager.playMiss()

    // Screen effect
    this.effects.failureFlash(100)
  }

  flashIndicator(laneIndex, color) {
    const indicator = this.lanes[laneIndex].indicator
    const originalStroke = DIRECTION_COLORS[DIRECTIONS[laneIndex]]

    indicator.setStrokeStyle(4, color, 1)
    indicator.setFillStyle(color, 0.3)

    this.time.delayedCall(100, () => {
      indicator.setStrokeStyle(3, originalStroke, 0.6)
      indicator.setFillStyle(COLORS.bg.void, 0.5)
    })
  }

  showRating(text, color) {
    this.ratingText.setText(text)
    this.ratingText.setColor(toHexString(color))
    this.ratingText.setAlpha(1)
    this.ratingText.setScale(0.5)

    this.tweens.add({
      targets: this.ratingText,
      scale: 1,
      duration: 100,
      ease: 'Back.out'
    })

    this.tweens.add({
      targets: this.ratingText,
      alpha: 0,
      y: this.targetY - 80,
      duration: 400,
      delay: 200,
      onComplete: () => {
        this.ratingText.y = this.targetY - 60
      }
    })
  }

  updateComboDisplay() {
    if (this.combo >= 3) {
      this.comboText.setText(`${this.combo}x COMBO`)
      this.comboText.setAlpha(1)

      // Pulse effect
      this.tweens.add({
        targets: this.comboText,
        scale: { from: 1.2, to: 1 },
        duration: 150
      })

      // Color based on combo
      if (this.combo >= 20) {
        this.comboText.setColor(toHexString(COLORS.cred.gold))
      } else if (this.combo >= 10) {
        this.comboText.setColor(toHexString(COLORS.status.warning))
      } else {
        this.comboText.setColor(toHexString(COLORS.network.primary))
      }
    } else {
      this.tweens.add({
        targets: this.comboText,
        alpha: 0,
        duration: 200
      })
    }
  }

  endGame(success) {
    // Stop spawning
    if (this.spawnTimer) {
      this.spawnTimer.destroy()
    }

    // Add max combo bonus
    if (this.maxCombo >= 10) {
      const comboBonus = this.maxCombo * 5
      this.addScore(comboBonus)
    }

    super.endGame(success)
  }

  shutdown() {
    if (this.spawnTimer) {
      this.spawnTimer.destroy()
    }
    if (this.effects) {
      this.effects.cleanup()
    }
    this.arrows.forEach(a => {
      if (a && a.destroy) a.destroy()
    })
    this.arrows = []
  }
}

export default RhythmGame
