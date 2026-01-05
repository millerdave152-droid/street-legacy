// Frogger Mini-Game
// Navigate through guards and security to reach the goal

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { audioManager } from '../../managers/AudioManager'
import { COLORS, SYMBOLS, getTerminalStyle, toHexString, BORDERS } from '../../ui/NetworkTheme'

export class FroggerGame extends BaseMiniGame {
  // Declare supported curveballs
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.CONTROL_REVERSAL,
      CURVEBALL_TYPES.SPEED_BOOST,
      CURVEBALL_TYPES.SPEED_SLOW,
      CURVEBALL_TYPES.VISUAL_BLUR,
      CURVEBALL_TYPES.SCREEN_SHAKE,
      CURVEBALL_TYPES.DISTRACTION
    ]
  }

  constructor() {
    super('FroggerGame')

    this.player = null
    this.playerRow = 0
    this.playerCol = 2
    this.gridCols = 5
    this.gridRows = 6
    this.cellSize = 60
    this.obstacles = []
    this.isMoving = false
    this.moveDelay = 150
    this.successRow = 0
  }

  create() {
    super.create()

    // Reset game state flags
    this.successHandled = false
    this.caughtHandled = false

    // Difficulty scaling
    if (this.gameData.difficulty >= 4) {
      this.gridRows = 7
      this.moveDelay = 100
      this.collisionRadius = 0.55  // Tighter collision for hard mode
      this.maxObstaclesPerRow = 2
    } else if (this.gameData.difficulty >= 2) {
      this.gridRows = 6
      this.moveDelay = 125
      this.collisionRadius = 0.5   // Standard collision
      this.maxObstaclesPerRow = 2
    } else {
      // Easy mode (Shoplifting, etc.) - more forgiving
      this.gridRows = 5
      this.moveDelay = 150
      this.collisionRadius = 0.45  // Forgiving collision radius
      this.maxObstaclesPerRow = 1  // Fewer guards per row
    }

    this.successRow = this.gridRows - 1
    this.playerRow = 0

    // Calculate grid position
    this.gridOffsetX = (this.gameWidth - this.gridCols * this.cellSize) / 2
    this.gridOffsetY = 130

    // Draw the grid
    this.drawGrid()

    // Create obstacles on each row
    this.createObstacles()

    // Create player
    this.createPlayer()

    // Create goal marker
    this.createGoal()

    // Input handling
    this.setupInput()

    // Instructions
    this.add.text(this.gameWidth / 2, this.gameHeight - 40,
      '← → ↑ ↓ or WASD to move | Avoid guards!', {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)

    // Row indicator
    this.rowText = this.add.text(this.gameWidth / 2, this.gameHeight - 60,
      `${SYMBOLS.system} Row: ${this.playerRow + 1}/${this.gridRows}`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.status.warning)
      }).setOrigin(0.5)
  }

  drawGrid() {
    // Background zones
    for (let row = 0; row < this.gridRows; row++) {
      const y = this.gridOffsetY + row * this.cellSize + this.cellSize / 2

      // Alternate row colors
      let color = row === 0 ? COLORS.network.dark : // Start (safe zone)
        row === this.gridRows - 1 ? COLORS.status.warning : // Goal
          row % 2 === 0 ? COLORS.bg.panel : COLORS.bg.card // Alternating

      this.add.rectangle(
        this.gameWidth / 2, y,
        this.gridCols * this.cellSize, this.cellSize,
        color, 0.5
      ).setStrokeStyle(BORDERS.thin, COLORS.text.muted)

      // Row labels
      if (row === 0) {
        this.add.text(this.gridOffsetX - 30, y, 'START', {
          ...getTerminalStyle('xs'),
          color: toHexString(COLORS.network.primary)
        }).setOrigin(0.5)
      } else if (row === this.gridRows - 1) {
        this.add.text(this.gridOffsetX - 30, y, 'GOAL', {
          ...getTerminalStyle('xs'),
          color: toHexString(COLORS.status.warning)
        }).setOrigin(0.5)
      }
    }

    // Grid lines
    const graphics = this.add.graphics()
    graphics.lineStyle(BORDERS.thin, COLORS.text.muted, 0.5)

    // Vertical lines
    for (let col = 0; col <= this.gridCols; col++) {
      const x = this.gridOffsetX + col * this.cellSize
      graphics.moveTo(x, this.gridOffsetY)
      graphics.lineTo(x, this.gridOffsetY + this.gridRows * this.cellSize)
    }

    // Horizontal lines
    for (let row = 0; row <= this.gridRows; row++) {
      const y = this.gridOffsetY + row * this.cellSize
      graphics.moveTo(this.gridOffsetX, y)
      graphics.lineTo(this.gridOffsetX + this.gridCols * this.cellSize, y)
    }

    graphics.strokePath()
  }

  createObstacles() {
    // Create moving obstacles on each row (except start and goal)
    for (let row = 1; row < this.gridRows - 1; row++) {
      // Use difficulty-scaled obstacle count
      const obstacleCount = this.maxObstaclesPerRow || Phaser.Math.Between(1, 2)
      const direction = row % 2 === 0 ? 1 : -1

      // Scale speed with difficulty - easier = slower guards
      const baseSpeed = this.gameData.difficulty >= 4 ? 1.5 :
                       this.gameData.difficulty >= 2 ? 1.2 : 0.8
      const speed = baseSpeed + Math.random() * 0.5 + (this.gameData.difficulty - 1) * 0.2

      // Track used columns to ensure spacing
      const usedCols = []

      for (let i = 0; i < obstacleCount; i++) {
        // Find a column with good spacing from other guards
        let startCol
        let attempts = 0
        do {
          startCol = Phaser.Math.Between(0, this.gridCols - 1)
          attempts++
        } while (usedCols.some(col => Math.abs(col - startCol) < 2) && attempts < 10)

        usedCols.push(startCol)
        this.createObstacle(row, startCol, direction, speed)
      }
    }
  }

  createObstacle(row, startCol, direction, speed) {
    const x = this.gridOffsetX + startCol * this.cellSize + this.cellSize / 2
    const y = this.gridOffsetY + row * this.cellSize + this.cellSize / 2

    const container = this.add.container(x, y)

    // Guard body
    const body = this.add.rectangle(0, 0, this.cellSize - 10, this.cellSize - 10, COLORS.status.danger, 0.8)
      .setStrokeStyle(BORDERS.medium, 0xb91c1c)
    container.add(body)

    // Guard icon
    const icon = this.add.text(0, 0, '👮', {
      fontSize: '28px'
    }).setOrigin(0.5)
    container.add(icon)

    // Vision cone (shows direction)
    const visionWidth = 20
    const visionHeight = 8
    const vision = this.add.triangle(
      direction * 25, 0,
      0, -visionHeight,
      direction * visionWidth, 0,
      0, visionHeight,
      COLORS.status.danger, 0.4
    )
    container.add(vision)

    // Store data
    container.setData('row', row)
    container.setData('col', startCol)
    container.setData('direction', direction)
    container.setData('speed', speed)
    container.setData('body', body)

    this.obstacles.push(container)
  }

  createPlayer() {
    const x = this.gridOffsetX + this.playerCol * this.cellSize + this.cellSize / 2
    const y = this.gridOffsetY + this.playerRow * this.cellSize + this.cellSize / 2

    this.player = this.add.container(x, y)

    // Player body
    const body = this.add.rectangle(0, 0, this.cellSize - 14, this.cellSize - 14, COLORS.status.info)
      .setStrokeStyle(BORDERS.medium, 0x1d4ed8)
    this.player.add(body)

    // Player icon
    const icon = this.add.text(0, 0, '🏃', {
      fontSize: '24px'
    }).setOrigin(0.5)
    this.player.add(icon)

    this.player.setData('body', body)
  }

  createGoal() {
    const y = this.gridOffsetY + this.successRow * this.cellSize + this.cellSize / 2

    // Goal markers on each column
    for (let col = 0; col < this.gridCols; col++) {
      const x = this.gridOffsetX + col * this.cellSize + this.cellSize / 2
      this.add.text(x, y, '💰', {
        fontSize: '24px'
      }).setOrigin(0.5).setAlpha(0.7)
    }

    // Goal text
    this.add.text(this.gameWidth / 2, this.gridOffsetY + this.successRow * this.cellSize + this.cellSize + 10,
      `${SYMBOLS.up} REACH THE LOOT ${SYMBOLS.up}`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.status.warning)
      }).setOrigin(0.5)
  }

  setupInput() {
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-UP', () => this.movePlayer(0, 1))
      this.input.keyboard.on('keydown-DOWN', () => this.movePlayer(0, -1))
      this.input.keyboard.on('keydown-LEFT', () => this.movePlayer(-1, 0))
      this.input.keyboard.on('keydown-RIGHT', () => this.movePlayer(1, 0))
      this.input.keyboard.on('keydown-W', () => this.movePlayer(0, 1))
      this.input.keyboard.on('keydown-S', () => this.movePlayer(0, -1))
      this.input.keyboard.on('keydown-A', () => this.movePlayer(-1, 0))
      this.input.keyboard.on('keydown-D', () => this.movePlayer(1, 0))
    }

    // Touch controls with on-screen buttons
    this.createTouchControls()
  }

  createTouchControls() {
    const buttonSize = 40
    const centerX = this.gameWidth / 2
    const baseY = this.gameHeight - 100

    // Up button
    this.createTouchButton(centerX, baseY - 30, '↑', () => this.movePlayer(0, 1))

    // Down button
    this.createTouchButton(centerX, baseY + 30, '↓', () => this.movePlayer(0, -1))

    // Left button
    this.createTouchButton(centerX - 50, baseY, '←', () => this.movePlayer(-1, 0))

    // Right button
    this.createTouchButton(centerX + 50, baseY, '→', () => this.movePlayer(1, 0))
  }

  createTouchButton(x, y, text, callback) {
    const btn = this.add.rectangle(x, y, 36, 36, COLORS.bg.card)
      .setStrokeStyle(BORDERS.medium, COLORS.text.muted)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        btn.setFillStyle(COLORS.bg.elevated)
        callback()
      })
      .on('pointerup', () => btn.setFillStyle(COLORS.bg.card))
      .on('pointerout', () => btn.setFillStyle(COLORS.bg.card))

    this.add.text(x, y, text, {
      fontSize: '20px',
      color: toHexString(COLORS.text.primary)
    }).setOrigin(0.5)
  }

  movePlayer(dx, dy) {
    if (this.isMoving || this.isPaused || this.isGameOver) return

    // Note: dy is inverted because moving "up" visually means increasing row
    const newCol = this.playerCol + dx
    const newRow = this.playerRow + dy // Moving up = higher row number

    // Check bounds
    if (newCol < 0 || newCol >= this.gridCols) return
    if (newRow < 0 || newRow >= this.gridRows) return

    this.isMoving = true
    this.playerCol = newCol
    this.playerRow = newRow

    // Calculate new position
    const newX = this.gridOffsetX + this.playerCol * this.cellSize + this.cellSize / 2
    const newY = this.gridOffsetY + this.playerRow * this.cellSize + this.cellSize / 2

    // Animate movement
    this.tweens.add({
      targets: this.player,
      x: newX,
      y: newY,
      duration: this.moveDelay,
      ease: 'Power2',
      onComplete: () => {
        this.isMoving = false
        this.checkPosition()
      }
    })

    audioManager.playClick()

    // Update row display
    this.rowText.setText(`${SYMBOLS.system} Row: ${this.playerRow + 1}/${this.gridRows}`)

    // Add score for moving forward
    if (dy > 0) {
      this.addScore(10)
    }
  }

  checkPosition() {
    // Check if reached goal
    if (this.playerRow >= this.successRow) {
      this.handleSuccess()
      return
    }

    // Check collision with obstacles
    this.checkCollision()
  }

  update(time, delta) {
    if (this.isPaused || this.isGameOver) return

    // Move obstacles
    this.updateObstacles(delta)

    // Check collision continuously
    if (!this.isMoving) {
      this.checkCollision()
    }
  }

  updateObstacles(delta) {
    const dt = delta / 1000

    this.obstacles.forEach(obstacle => {
      const direction = obstacle.getData('direction')
      const speed = obstacle.getData('speed')

      // Move obstacle
      obstacle.x += direction * speed * this.cellSize * dt

      // Wrap around
      const leftBound = this.gridOffsetX - this.cellSize / 2
      const rightBound = this.gridOffsetX + this.gridCols * this.cellSize + this.cellSize / 2

      if (obstacle.x < leftBound) {
        obstacle.x = rightBound
      } else if (obstacle.x > rightBound) {
        obstacle.x = leftBound
      }

      // Update column data based on position
      const col = Math.floor((obstacle.x - this.gridOffsetX) / this.cellSize)
      obstacle.setData('col', col)
    })
  }

  checkCollision() {
    const playerX = this.player.x
    const playerY = this.player.y
    // Use difficulty-scaled collision radius (default 0.5 if not set)
    const collisionDist = this.cellSize * (this.collisionRadius || 0.5)

    for (const obstacle of this.obstacles) {
      const obstacleRow = obstacle.getData('row')

      // Only check obstacles on same row
      if (obstacleRow !== this.playerRow) continue

      const dist = Math.abs(obstacle.x - playerX)

      if (dist < collisionDist) {
        this.handleCaught()
        return
      }
    }
  }

  handleCaught() {
    // Use separate flag - don't set isGameOver (let endGame handle it)
    if (this.caughtHandled) return
    this.caughtHandled = true

    // Caught animation
    try {
      this.cameras.main.shake(300, 0.03)
      this.cameras.main.flash(200, 255, 0, 64)
    } catch (e) { /* ignore */ }

    // Highlight player as caught
    const body = this.player.getData('body')
    if (body) body.setFillStyle(COLORS.status.danger)

    const caughtText = this.add.text(this.gameWidth / 2, this.gameHeight / 2 - 50, `${SYMBOLS.alert} ${SYMBOLS.system} CAUGHT! ${SYMBOLS.system} ${SYMBOLS.alert}`, {
      ...getTerminalStyle('xxl'),
      color: toHexString(COLORS.status.danger)
    }).setOrigin(0.5)

    this.tweens.add({
      targets: caughtText,
      scale: { from: 0.5, to: 1.2 },
      duration: 300
    })

    // Call endGame immediately
    this.endGame(false)
  }

  handleSuccess() {
    // Use separate flag - don't set isGameOver (let endGame handle it)
    if (this.successHandled) return
    this.successHandled = true

    // Success animation - Network green RGB (0, 255, 65)
    try {
      this.cameras.main.flash(200, 0, 255, 65)
      audioManager.playHit()
    } catch (e) { /* ignore */ }

    const successText = this.add.text(this.gameWidth / 2, this.gameHeight / 2 - 50, `${SYMBOLS.system} REACHED THE LOOT!`, {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5)

    this.tweens.add({
      targets: successText,
      scale: { from: 0.5, to: 1.2 },
      duration: 300
    })

    // Bonus for remaining time
    this.addScore(Math.floor(this.timeRemaining * 5))

    // Call endGame immediately
    this.endGame(true)
  }
}

export default FroggerGame
