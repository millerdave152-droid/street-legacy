// Stealth Mini-Game
// Navigate through a grid avoiding patrol guards with vision cones
// Time your movements to slip past patrols and reach the goal

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { audioManager } from '../../managers/AudioManager'
import { COLORS, SYMBOLS, getTerminalStyle, toHexString, BORDERS } from '../../ui/NetworkTheme'

// Guard patrol patterns
const PATROL_PATTERNS = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
  SQUARE: 'square',
  STATIONARY: 'stationary'
}

export class StealthGame extends BaseMiniGame {
  // Declare supported curveballs
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.CONTROL_REVERSAL,
      CURVEBALL_TYPES.VISUAL_BLUR,
      CURVEBALL_TYPES.SCREEN_SHAKE,
      CURVEBALL_TYPES.DISTRACTION
    ]
  }

  constructor() {
    super('StealthGame')

    // Grid configuration
    this.gridCols = 7
    this.gridRows = 7
    this.cellSize = 50
    this.gridOffsetX = 0
    this.gridOffsetY = 0

    // Player state
    this.player = null
    this.playerRow = 0
    this.playerCol = 0
    this.isMoving = false
    this.moveDelay = 120

    // Guards
    this.guards = []
    this.guardMoveTimer = null

    // Goal
    this.goalRow = 0
    this.goalCol = 0

    // Cover spots (safe zones)
    this.coverSpots = []

    // Game state
    this.successHandled = false
    this.caughtHandled = false
    this.isHidden = false
  }

  create() {
    super.create()

    // Reset flags
    this.successHandled = false
    this.caughtHandled = false
    this.isHidden = false

    // Scale difficulty
    this.setupDifficulty()

    // Calculate grid position
    this.gridOffsetX = (this.gameWidth - this.gridCols * this.cellSize) / 2
    this.gridOffsetY = 140

    // Draw the playing field
    this.drawGrid()

    // Create cover spots
    this.createCoverSpots()

    // Create guards
    this.createGuards()

    // Create player
    this.createPlayer()

    // Create goal
    this.createGoal()

    // Setup input
    this.setupInput()

    // Start guard patrol timer
    this.startGuardPatrols()

    // Instructions
    this.createInstructions()

    // Status display
    this.statusText = this.add.text(this.gameWidth / 2, this.gridOffsetY - 20,
      `${SYMBOLS.system} INFILTRATION IN PROGRESS`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.network.primary)
      }).setOrigin(0.5)
  }

  setupDifficulty() {
    const difficulty = this.gameData.difficulty || 1

    if (difficulty >= 5) {
      this.gridCols = 9
      this.gridRows = 9
      this.cellSize = 42
      this.moveDelay = 100
    } else if (difficulty >= 3) {
      this.gridCols = 8
      this.gridRows = 8
      this.cellSize = 46
      this.moveDelay = 110
    } else {
      this.gridCols = 7
      this.gridRows = 7
      this.cellSize = 50
      this.moveDelay = 120
    }

    // Set goal position (top-right area)
    this.goalRow = this.gridRows - 1
    this.goalCol = this.gridCols - 1

    // Start position (bottom-left)
    this.playerRow = 0
    this.playerCol = 0
  }

  drawGrid() {
    const graphics = this.add.graphics()

    // Draw floor tiles
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        const x = this.gridOffsetX + col * this.cellSize
        const y = this.gridOffsetY + row * this.cellSize

        // Checkerboard pattern
        const isLight = (row + col) % 2 === 0
        const color = isLight ? COLORS.bg.panel : COLORS.bg.card

        this.add.rectangle(
          x + this.cellSize / 2,
          y + this.cellSize / 2,
          this.cellSize - 2,
          this.cellSize - 2,
          color, 0.6
        ).setStrokeStyle(1, COLORS.text.muted, 0.3)
      }
    }

    // Start zone highlight
    const startX = this.gridOffsetX + this.cellSize / 2
    const startY = this.gridOffsetY + this.cellSize / 2
    this.add.rectangle(startX, startY, this.cellSize - 4, this.cellSize - 4, COLORS.network.dark, 0.5)
      .setStrokeStyle(2, COLORS.network.primary, 0.8)

    this.add.text(this.gridOffsetX - 35, startY, 'START', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5)

    // Goal zone highlight
    const goalX = this.gridOffsetX + this.goalCol * this.cellSize + this.cellSize / 2
    const goalY = this.gridOffsetY + this.goalRow * this.cellSize + this.cellSize / 2
    this.add.rectangle(goalX, goalY, this.cellSize - 4, this.cellSize - 4, COLORS.status.warning, 0.3)
      .setStrokeStyle(2, COLORS.status.warning, 0.8)

    // Grid border
    graphics.lineStyle(2, COLORS.network.dim, 0.8)
    graphics.strokeRect(
      this.gridOffsetX,
      this.gridOffsetY,
      this.gridCols * this.cellSize,
      this.gridRows * this.cellSize
    )
  }

  createCoverSpots() {
    this.coverSpots = []
    const difficulty = this.gameData.difficulty || 1

    // Number of cover spots based on difficulty (more = easier)
    const coverCount = Math.max(2, 5 - Math.floor(difficulty / 2))

    // Generate random cover positions (not on start, goal, or edges for variety)
    const usedPositions = new Set()
    usedPositions.add(`0,0`) // Start
    usedPositions.add(`${this.goalCol},${this.goalRow}`) // Goal

    let placed = 0
    let attempts = 0
    const maxAttempts = 50

    while (placed < coverCount && attempts < maxAttempts) {
      const col = Phaser.Math.Between(1, this.gridCols - 2)
      const row = Phaser.Math.Between(1, this.gridRows - 2)
      const key = `${col},${row}`

      if (!usedPositions.has(key)) {
        usedPositions.add(key)
        this.createCoverSpot(row, col)
        placed++
      }
      attempts++
    }
  }

  createCoverSpot(row, col) {
    const x = this.gridOffsetX + col * this.cellSize + this.cellSize / 2
    const y = this.gridOffsetY + row * this.cellSize + this.cellSize / 2

    const cover = this.add.container(x, y)

    // Cover visual (crate/shadow)
    const base = this.add.rectangle(0, 0, this.cellSize - 8, this.cellSize - 8, COLORS.bg.elevated, 0.9)
      .setStrokeStyle(2, COLORS.text.muted, 0.6)
    cover.add(base)

    // Cover icon
    const icon = this.add.text(0, 0, '📦', { fontSize: '20px' }).setOrigin(0.5)
    cover.add(icon)

    cover.setData('row', row)
    cover.setData('col', col)
    cover.setData('type', 'cover')

    this.coverSpots.push({ row, col, container: cover })
  }

  createGuards() {
    this.guards = []
    const difficulty = this.gameData.difficulty || 1

    // Guard count based on difficulty
    const guardCount = Math.min(2 + difficulty, 6)

    // Define guard positions and patterns
    const guardConfigs = this.generateGuardConfigs(guardCount)

    guardConfigs.forEach(config => {
      this.createGuard(config.row, config.col, config.pattern, config.direction)
    })
  }

  generateGuardConfigs(count) {
    const configs = []
    const usedPositions = new Set()

    // Reserve start, goal, and cover positions
    usedPositions.add(`0,0`)
    usedPositions.add(`${this.goalCol},${this.goalRow}`)
    this.coverSpots.forEach(spot => {
      usedPositions.add(`${spot.col},${spot.row}`)
    })

    const patterns = [
      PATROL_PATTERNS.HORIZONTAL,
      PATROL_PATTERNS.VERTICAL,
      PATROL_PATTERNS.SQUARE,
      PATROL_PATTERNS.STATIONARY
    ]

    let placed = 0
    let attempts = 0
    const maxAttempts = 100

    while (placed < count && attempts < maxAttempts) {
      // Place guards in middle area of grid
      const col = Phaser.Math.Between(1, this.gridCols - 2)
      const row = Phaser.Math.Between(1, this.gridRows - 2)
      const key = `${col},${row}`

      if (!usedPositions.has(key)) {
        usedPositions.add(key)

        const pattern = patterns[placed % patterns.length]
        const direction = Phaser.Math.Between(0, 3) // 0=up, 1=right, 2=down, 3=left

        configs.push({ row, col, pattern, direction })
        placed++
      }
      attempts++
    }

    return configs
  }

  createGuard(row, col, pattern, direction) {
    const x = this.gridOffsetX + col * this.cellSize + this.cellSize / 2
    const y = this.gridOffsetY + row * this.cellSize + this.cellSize / 2

    const guard = this.add.container(x, y)

    // Guard body
    const body = this.add.rectangle(0, 0, this.cellSize - 12, this.cellSize - 12, COLORS.status.danger, 0.8)
      .setStrokeStyle(2, 0xb91c1c, 0.9)
    guard.add(body)

    // Guard icon
    const icon = this.add.text(0, -2, '👁', { fontSize: '22px' }).setOrigin(0.5)
    guard.add(icon)

    // Vision cone
    const visionCone = this.createVisionCone(direction)
    guard.add(visionCone)

    // Store guard data
    guard.setData('row', row)
    guard.setData('col', col)
    guard.setData('startRow', row)
    guard.setData('startCol', col)
    guard.setData('pattern', pattern)
    guard.setData('direction', direction)
    guard.setData('patrolStep', 0)
    guard.setData('patrolPhase', 0)
    guard.setData('visionCone', visionCone)
    guard.setData('body', body)

    this.guards.push(guard)
  }

  createVisionCone(direction) {
    const coneLength = this.cellSize * 1.5
    const coneWidth = this.cellSize * 0.8

    // Calculate cone points based on direction
    let points = []
    const offset = this.cellSize / 2 - 5

    switch (direction) {
      case 0: // Up
        points = [0, -offset, -coneWidth / 2, -offset - coneLength, coneWidth / 2, -offset - coneLength]
        break
      case 1: // Right
        points = [offset, 0, offset + coneLength, -coneWidth / 2, offset + coneLength, coneWidth / 2]
        break
      case 2: // Down
        points = [0, offset, -coneWidth / 2, offset + coneLength, coneWidth / 2, offset + coneLength]
        break
      case 3: // Left
        points = [-offset, 0, -offset - coneLength, -coneWidth / 2, -offset - coneLength, coneWidth / 2]
        break
    }

    const cone = this.add.triangle(0, 0, points[0], points[1], points[2], points[3], points[4], points[5], COLORS.status.danger, 0.25)
    cone.setStrokeStyle(1, COLORS.status.danger, 0.4)

    return cone
  }

  updateVisionCone(guard) {
    const direction = guard.getData('direction')
    const oldCone = guard.getData('visionCone')

    // Remove old cone
    if (oldCone) {
      oldCone.destroy()
    }

    // Create new cone
    const newCone = this.createVisionCone(direction)
    guard.add(newCone)
    guard.setData('visionCone', newCone)
  }

  createPlayer() {
    const x = this.gridOffsetX + this.playerCol * this.cellSize + this.cellSize / 2
    const y = this.gridOffsetY + this.playerRow * this.cellSize + this.cellSize / 2

    this.player = this.add.container(x, y)

    // Player body
    const body = this.add.rectangle(0, 0, this.cellSize - 16, this.cellSize - 16, COLORS.network.primary, 0.9)
      .setStrokeStyle(2, COLORS.network.glow, 0.9)
    this.player.add(body)

    // Player icon
    const icon = this.add.text(0, 0, '🥷', { fontSize: '20px' }).setOrigin(0.5)
    this.player.add(icon)

    this.player.setData('body', body)
    this.player.setData('icon', icon)
    this.player.setDepth(10)
  }

  createGoal() {
    const x = this.gridOffsetX + this.goalCol * this.cellSize + this.cellSize / 2
    const y = this.gridOffsetY + this.goalRow * this.cellSize + this.cellSize / 2

    // Goal icon
    const goal = this.add.text(x, y, '💎', { fontSize: '28px' }).setOrigin(0.5)

    // Pulsing animation
    this.tweens.add({
      targets: goal,
      scale: { from: 0.9, to: 1.1 },
      alpha: { from: 0.8, to: 1 },
      duration: 800,
      yoyo: true,
      repeat: -1
    })

    // Goal label
    this.add.text(this.gameWidth - this.gridOffsetX + 15, y, 'GOAL', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.status.warning)
    }).setOrigin(0.5)
  }

  setupInput() {
    if (this.input.keyboard) {
      // Arrow keys
      this.input.keyboard.on('keydown-UP', () => this.tryMove(0, -1))
      this.input.keyboard.on('keydown-DOWN', () => this.tryMove(0, 1))
      this.input.keyboard.on('keydown-LEFT', () => this.tryMove(-1, 0))
      this.input.keyboard.on('keydown-RIGHT', () => this.tryMove(1, 0))

      // WASD
      this.input.keyboard.on('keydown-W', () => this.tryMove(0, -1))
      this.input.keyboard.on('keydown-S', () => this.tryMove(0, 1))
      this.input.keyboard.on('keydown-A', () => this.tryMove(-1, 0))
      this.input.keyboard.on('keydown-D', () => this.tryMove(1, 0))

      // Space to hide (if on cover)
      this.input.keyboard.on('keydown-SPACE', () => this.toggleHide())
    }

    // Touch controls
    this.createTouchControls()
  }

  createTouchControls() {
    const btnSize = 44
    const centerX = this.gameWidth / 2
    const baseY = this.gameHeight - 80

    // D-pad layout
    this.createTouchButton(centerX, baseY - 35, '↑', () => this.tryMove(0, -1))
    this.createTouchButton(centerX, baseY + 35, '↓', () => this.tryMove(0, 1))
    this.createTouchButton(centerX - 50, baseY, '←', () => this.tryMove(-1, 0))
    this.createTouchButton(centerX + 50, baseY, '→', () => this.tryMove(1, 0))

    // Hide button
    const hideBtn = this.add.rectangle(this.gameWidth - 60, baseY, btnSize + 10, btnSize, COLORS.bg.card)
      .setStrokeStyle(2, COLORS.network.primary)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        hideBtn.setFillStyle(COLORS.network.dark)
        this.toggleHide()
      })
      .on('pointerup', () => hideBtn.setFillStyle(COLORS.bg.card))

    this.add.text(this.gameWidth - 60, baseY, 'HIDE', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5)
  }

  createTouchButton(x, y, text, callback) {
    const btn = this.add.rectangle(x, y, 40, 40, COLORS.bg.card)
      .setStrokeStyle(2, COLORS.text.muted)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        btn.setFillStyle(COLORS.bg.elevated)
        callback()
      })
      .on('pointerup', () => btn.setFillStyle(COLORS.bg.card))
      .on('pointerout', () => btn.setFillStyle(COLORS.bg.card))

    this.add.text(x, y, text, {
      fontSize: '18px',
      color: toHexString(COLORS.text.primary)
    }).setOrigin(0.5)
  }

  createInstructions() {
    this.add.text(this.gameWidth / 2, this.gameHeight - 25,
      'Arrow keys/WASD to move | SPACE to hide in cover', {
        ...getTerminalStyle('xs'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)
  }

  tryMove(dx, dy) {
    if (this.isMoving || this.isPaused || this.isGameOver || this.isHidden) return

    // Apply control reversal curveball if active
    const adjusted = this.getAdjustedDirection(dx, dy)
    dx = adjusted.dx
    dy = adjusted.dy

    const newCol = this.playerCol + dx
    const newRow = this.playerRow + dy

    // Check bounds
    if (newCol < 0 || newCol >= this.gridCols) return
    if (newRow < 0 || newRow >= this.gridRows) return

    // Execute move
    this.movePlayer(newCol, newRow)
  }

  movePlayer(newCol, newRow) {
    this.isMoving = true
    this.playerCol = newCol
    this.playerRow = newRow

    const newX = this.gridOffsetX + newCol * this.cellSize + this.cellSize / 2
    const newY = this.gridOffsetY + newRow * this.cellSize + this.cellSize / 2

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

    // Score for movement
    this.addScore(5)

    // Update status
    this.updateStatus()
  }

  toggleHide() {
    if (this.isPaused || this.isGameOver || this.isMoving) return

    // Check if player is on a cover spot
    const onCover = this.coverSpots.some(
      spot => spot.row === this.playerRow && spot.col === this.playerCol
    )

    if (!onCover) {
      this.statusText.setText(`${SYMBOLS.alert} No cover here!`)
      this.statusText.setColor(toHexString(COLORS.status.warning))

      // Reset status after delay
      this.time.delayedCall(1000, () => {
        if (!this.isGameOver) {
          this.updateStatus()
        }
      })
      return
    }

    this.isHidden = !this.isHidden

    const body = this.player.getData('body')
    const icon = this.player.getData('icon')

    if (this.isHidden) {
      // Hide effect
      body.setFillStyle(COLORS.bg.elevated, 0.5)
      body.setStrokeStyle(2, COLORS.text.muted, 0.5)
      icon.setAlpha(0.4)
      this.player.setDepth(5) // Below guards

      this.statusText.setText(`${SYMBOLS.system} HIDDEN`)
      this.statusText.setColor(toHexString(COLORS.network.dim))

      audioManager.playClick()
    } else {
      // Unhide
      body.setFillStyle(COLORS.network.primary, 0.9)
      body.setStrokeStyle(2, COLORS.network.glow, 0.9)
      icon.setAlpha(1)
      this.player.setDepth(10)

      this.updateStatus()
      audioManager.playClick()
    }
  }

  updateStatus() {
    const distance = Math.abs(this.goalCol - this.playerCol) + Math.abs(this.goalRow - this.playerRow)
    this.statusText.setText(`${SYMBOLS.system} Distance to goal: ${distance}`)
    this.statusText.setColor(toHexString(COLORS.network.primary))
  }

  checkPosition() {
    // Check if reached goal
    if (this.playerRow === this.goalRow && this.playerCol === this.goalCol) {
      this.handleSuccess()
      return
    }

    // Check if detected by guard
    if (!this.isHidden) {
      this.checkDetection()
    }
  }

  startGuardPatrols() {
    // Guards move every 1.5 seconds
    const patrolInterval = 1500 - (this.gameData.difficulty || 1) * 100 // Faster at higher difficulty

    this.guardMoveTimer = this.time.addEvent({
      delay: Math.max(800, patrolInterval),
      callback: () => this.moveGuards(),
      loop: true
    })
  }

  moveGuards() {
    if (this.isPaused || this.isGameOver) return

    this.guards.forEach(guard => {
      const pattern = guard.getData('pattern')
      const step = guard.getData('patrolStep')
      const phase = guard.getData('patrolPhase')

      let newDirection = guard.getData('direction')
      let moveX = 0
      let moveY = 0

      switch (pattern) {
        case PATROL_PATTERNS.HORIZONTAL:
          moveX = phase === 0 ? 1 : -1
          newDirection = phase === 0 ? 1 : 3
          break

        case PATROL_PATTERNS.VERTICAL:
          moveY = phase === 0 ? 1 : -1
          newDirection = phase === 0 ? 2 : 0
          break

        case PATROL_PATTERNS.SQUARE:
          // Move in a square pattern
          const squarePhases = [
            { dx: 1, dy: 0, dir: 1 },
            { dx: 0, dy: 1, dir: 2 },
            { dx: -1, dy: 0, dir: 3 },
            { dx: 0, dy: -1, dir: 0 }
          ]
          const current = squarePhases[phase % 4]
          moveX = current.dx
          moveY = current.dy
          newDirection = current.dir
          break

        case PATROL_PATTERNS.STATIONARY:
          // Just rotate
          newDirection = (guard.getData('direction') + 1) % 4
          break
      }

      // Calculate new position
      const currentCol = guard.getData('col')
      const currentRow = guard.getData('row')
      let newCol = currentCol + moveX
      let newRow = currentRow + moveY

      // Check bounds and reverse if needed
      if (pattern !== PATROL_PATTERNS.STATIONARY) {
        if (newCol < 0 || newCol >= this.gridCols || newRow < 0 || newRow >= this.gridRows) {
          // Reverse direction
          guard.setData('patrolPhase', (phase + 1) % (pattern === PATROL_PATTERNS.SQUARE ? 4 : 2))
          newCol = currentCol
          newRow = currentRow
        } else {
          // Update position
          guard.setData('col', newCol)
          guard.setData('row', newRow)
          guard.setData('patrolStep', step + 1)

          // Change phase after enough steps
          if (step > 0 && step % 2 === 0 && pattern !== PATROL_PATTERNS.SQUARE) {
            guard.setData('patrolPhase', (phase + 1) % 2)
          } else if (pattern === PATROL_PATTERNS.SQUARE && step > 0 && step % 1 === 0) {
            guard.setData('patrolPhase', (phase + 1) % 4)
          }

          // Animate movement
          const newX = this.gridOffsetX + newCol * this.cellSize + this.cellSize / 2
          const newY = this.gridOffsetY + newRow * this.cellSize + this.cellSize / 2

          this.tweens.add({
            targets: guard,
            x: newX,
            y: newY,
            duration: 300,
            ease: 'Linear'
          })
        }
      }

      // Update direction and vision cone
      if (newDirection !== guard.getData('direction')) {
        guard.setData('direction', newDirection)
        this.updateVisionCone(guard)
      }
    })

    // Check detection after guards move
    if (!this.isHidden) {
      this.time.delayedCall(350, () => {
        if (!this.isGameOver && !this.isHidden) {
          this.checkDetection()
        }
      })
    }
  }

  checkDetection() {
    for (const guard of this.guards) {
      if (this.isPlayerInVision(guard)) {
        this.handleCaught()
        return
      }
    }
  }

  isPlayerInVision(guard) {
    const guardCol = guard.getData('col')
    const guardRow = guard.getData('row')
    const direction = guard.getData('direction')

    // Direct collision
    if (guardCol === this.playerCol && guardRow === this.playerRow) {
      return true
    }

    // Vision cone detection (2 cells range)
    const visionRange = 2

    switch (direction) {
      case 0: // Up
        if (this.playerCol === guardCol && this.playerRow < guardRow && this.playerRow >= guardRow - visionRange) {
          return true
        }
        break
      case 1: // Right
        if (this.playerRow === guardRow && this.playerCol > guardCol && this.playerCol <= guardCol + visionRange) {
          return true
        }
        break
      case 2: // Down
        if (this.playerCol === guardCol && this.playerRow > guardRow && this.playerRow <= guardRow + visionRange) {
          return true
        }
        break
      case 3: // Left
        if (this.playerRow === guardRow && this.playerCol < guardCol && this.playerCol >= guardCol - visionRange) {
          return true
        }
        break
    }

    return false
  }

  handleCaught() {
    if (this.caughtHandled) return
    this.caughtHandled = true

    // Visual feedback
    try {
      this.cameras.main.shake(400, 0.04)
      this.cameras.main.flash(300, 255, 0, 0)
    } catch (e) {}

    // Change player appearance
    const body = this.player.getData('body')
    if (body) body.setFillStyle(COLORS.status.danger)

    // Alert text
    const alertText = this.add.text(this.gameWidth / 2, this.gameHeight / 2 - 50,
      `${SYMBOLS.alert} DETECTED! ${SYMBOLS.alert}`, {
        ...getTerminalStyle('xxl'),
        color: toHexString(COLORS.status.danger)
      }).setOrigin(0.5).setDepth(100)

    this.tweens.add({
      targets: alertText,
      scale: { from: 0.5, to: 1.3 },
      duration: 300
    })

    audioManager.playError()

    // End game
    this.endGame(false)
  }

  handleSuccess() {
    if (this.successHandled) return
    this.successHandled = true

    // Visual feedback
    try {
      this.cameras.main.flash(200, 0, 255, 65)
    } catch (e) {}

    // Success text
    const successText = this.add.text(this.gameWidth / 2, this.gameHeight / 2 - 50,
      `${SYMBOLS.system} INFILTRATION COMPLETE!`, {
        ...getTerminalStyle('xl'),
        color: toHexString(COLORS.network.primary)
      }).setOrigin(0.5).setDepth(100)

    this.tweens.add({
      targets: successText,
      scale: { from: 0.5, to: 1.2 },
      duration: 300
    })

    audioManager.playHit()

    // Bonus for time remaining
    this.addScore(Math.floor(this.timeRemaining * 10))

    // Bonus for not being detected
    this.addScore(50)

    // End game
    this.endGame(true)
  }

  update(time, delta) {
    super.update(time, delta)

    if (this.isPaused || this.isGameOver) return

    // Continuous detection check (in case player stands still and guard walks into them)
    if (!this.isHidden && !this.isMoving) {
      this.checkDetection()
    }
  }

  shutdown() {
    // Clean up patrol timer
    if (this.guardMoveTimer) {
      this.guardMoveTimer.destroy()
      this.guardMoveTimer = null
    }

    super.shutdown()
  }
}

export default StealthGame
