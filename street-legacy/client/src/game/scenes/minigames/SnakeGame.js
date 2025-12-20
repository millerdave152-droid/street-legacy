// Snake Mini-Game
// Collect items while avoiding cops in a snake-style game

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { COLORS, SYMBOLS, getTerminalStyle, toHexString, BORDERS } from '../../ui/NetworkTheme'

export class SnakeGame extends BaseMiniGame {
  // Declare supported curveballs for this game
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.CONTROL_REVERSAL,
      CURVEBALL_TYPES.SPEED_BOOST,
      CURVEBALL_TYPES.SPEED_SLOW,
      CURVEBALL_TYPES.VISUAL_BLUR,
      CURVEBALL_TYPES.DISTRACTION,
      CURVEBALL_TYPES.BRIEF_BLACKOUT
    ]
  }

  constructor() {
    super('SnakeGame')

    // Grid settings
    this.GRID_SIZE = 20
    this.GRID_WIDTH = 20
    this.GRID_HEIGHT = 25
    this.GAME_AREA_Y = 110

    // Game state
    this.snake = []
    this.direction = { x: 1, y: 0 }
    this.nextDirection = { x: 1, y: 0 }
    this.items = []
    this.cops = []
    this.moveTimer = 0
    this.moveDelay = 150
    this.baseMoveDelay = 150 // For curveball effects

    // Graphics
    this.graphics = null
  }

  create() {
    super.create()

    this.graphics = this.add.graphics()

    // Initialize snake
    this.snake = [{ x: 10, y: 12 }]
    this.direction = { x: 1, y: 0 }
    this.nextDirection = { x: 1, y: 0 }

    // Difficulty scaling
    this.moveDelay = Math.max(80, 160 - (this.gameData.difficulty - 1) * 20)
    this.baseMoveDelay = this.moveDelay // Store for curveball effects

    // Spawn items
    this.items = []
    for (let i = 0; i < 5; i++) {
      this.spawnItem()
    }

    // Spawn cops based on difficulty
    this.cops = []
    for (let i = 0; i < this.gameData.difficulty; i++) {
      this.spawnCop()
    }

    // Setup controls
    this.setupControls()

    // Instructions
    this.add.text(this.gameWidth / 2, this.gameHeight - 25, `${SYMBOLS.system} Arrow Keys / WASD / Swipe to move • Collect 💰 • Avoid 🚔`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)
  }

  setupControls() {
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-UP', () => this.setDirection(0, -1))
      this.input.keyboard.on('keydown-DOWN', () => this.setDirection(0, 1))
      this.input.keyboard.on('keydown-LEFT', () => this.setDirection(-1, 0))
      this.input.keyboard.on('keydown-RIGHT', () => this.setDirection(1, 0))
      this.input.keyboard.on('keydown-W', () => this.setDirection(0, -1))
      this.input.keyboard.on('keydown-S', () => this.setDirection(0, 1))
      this.input.keyboard.on('keydown-A', () => this.setDirection(-1, 0))
      this.input.keyboard.on('keydown-D', () => this.setDirection(1, 0))
    }

    // Touch/swipe
    let startX = 0
    let startY = 0

    this.input.on('pointerdown', (pointer) => {
      startX = pointer.x
      startY = pointer.y
    })

    this.input.on('pointerup', (pointer) => {
      const dx = pointer.x - startX
      const dy = pointer.y - startY
      const minSwipe = 30

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipe) {
        this.setDirection(dx > 0 ? 1 : -1, 0)
      } else if (Math.abs(dy) > minSwipe) {
        this.setDirection(0, dy > 0 ? 1 : -1)
      }
    })
  }

  setDirection(x, y) {
    // Apply control reversal if active (from curveball)
    const adjusted = this.getAdjustedDirection(x, y)
    x = adjusted.dx
    y = adjusted.dy

    // Prevent 180-degree turns
    if (this.snake.length > 1) {
      if (this.direction.x === -x && x !== 0) return
      if (this.direction.y === -y && y !== 0) return
    }
    this.nextDirection = { x, y }
  }

  // Handle curveball speed changes
  onCurveballStart({ type }) {
    if (type === 'speed_boost' || type === 'speed_slow') {
      // For speed: lower moveDelay = faster snake
      // speedMultiplier > 1 = speed boost, so divide delay
      // speedMultiplier < 1 = slow, so divide makes delay longer
      this.moveDelay = this.baseMoveDelay / this.speedMultiplier
    }
  }

  onCurveballEnd({ type }) {
    if (type === 'speed_boost' || type === 'speed_slow') {
      this.moveDelay = this.baseMoveDelay
    }
  }

  spawnItem() {
    let pos
    let attempts = 0

    do {
      pos = {
        x: Phaser.Math.Between(1, this.GRID_WIDTH - 2),
        y: Phaser.Math.Between(1, this.GRID_HEIGHT - 2)
      }
      attempts++
    } while (
      attempts < 100 &&
      (this.snake.some(s => s.x === pos.x && s.y === pos.y) ||
       this.items.some(i => i.x === pos.x && i.y === pos.y) ||
       this.cops.some(c => c.x === pos.x && c.y === pos.y))
    )

    this.items.push({
      x: pos.x,
      y: pos.y,
      value: Phaser.Math.Between(25, 75)
    })
  }

  spawnCop() {
    const edges = [
      { x: 0, y: Phaser.Math.Between(0, this.GRID_HEIGHT - 1) },
      { x: this.GRID_WIDTH - 1, y: Phaser.Math.Between(0, this.GRID_HEIGHT - 1) },
      { x: Phaser.Math.Between(0, this.GRID_WIDTH - 1), y: 0 },
      { x: Phaser.Math.Between(0, this.GRID_WIDTH - 1), y: this.GRID_HEIGHT - 1 }
    ]
    this.cops.push(Phaser.Utils.Array.GetRandom(edges))
  }

  update(time, delta) {
    // Call base class update for curveball processing
    super.update(time, delta)
    if (this.isPaused || this.isGameOver) return

    this.moveTimer += delta

    if (this.moveTimer >= this.moveDelay) {
      this.moveTimer = 0
      this.moveSnake()
      this.moveCops()
    }

    this.draw()
  }

  moveSnake() {
    this.direction = { ...this.nextDirection }

    const head = this.snake[0]
    const newHead = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y
    }

    // Wall collision
    if (newHead.x < 0 || newHead.x >= this.GRID_WIDTH ||
        newHead.y < 0 || newHead.y >= this.GRID_HEIGHT) {
      this.endGame(false)
      return
    }

    // Self collision
    if (this.snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
      this.endGame(false)
      return
    }

    // Cop collision
    if (this.cops.some(c => c.x === newHead.x && c.y === newHead.y)) {
      this.endGame(false)
      return
    }

    this.snake.unshift(newHead)

    // Item collection
    const itemIdx = this.items.findIndex(i => i.x === newHead.x && i.y === newHead.y)
    if (itemIdx >= 0) {
      const item = this.items[itemIdx]
      this.addScore(item.value)
      this.items.splice(itemIdx, 1)
      this.spawnItem()
      this.cameras.main.flash(80, 0, 255, 65)
    } else {
      this.snake.pop()
    }
  }

  moveCops() {
    if (Math.random() > 0.35) return

    const head = this.snake[0]

    this.cops.forEach(cop => {
      if (Math.random() > 0.5) return

      const dx = head.x - cop.x
      const dy = head.y - cop.y

      if (Math.abs(dx) > Math.abs(dy)) {
        cop.x += Math.sign(dx)
      } else if (dy !== 0) {
        cop.y += Math.sign(dy)
      }

      // Clamp to grid
      cop.x = Phaser.Math.Clamp(cop.x, 0, this.GRID_WIDTH - 1)
      cop.y = Phaser.Math.Clamp(cop.y, 0, this.GRID_HEIGHT - 1)

      // Check if caught player
      if (this.snake.some(s => s.x === cop.x && s.y === cop.y)) {
        this.endGame(false)
      }
    })
  }

  draw() {
    this.graphics.clear()

    const gs = this.GRID_SIZE
    const offsetY = this.GAME_AREA_Y
    const areaWidth = this.GRID_WIDTH * gs
    const areaHeight = this.GRID_HEIGHT * gs

    // Game area background
    this.graphics.fillStyle(COLORS.bg.panel, 1)
    this.graphics.fillRect(0, offsetY, areaWidth, areaHeight)

    // Grid lines
    this.graphics.lineStyle(1, COLORS.bg.card, 0.5)
    for (let x = 0; x <= this.GRID_WIDTH; x++) {
      this.graphics.lineBetween(x * gs, offsetY, x * gs, offsetY + areaHeight)
    }
    for (let y = 0; y <= this.GRID_HEIGHT; y++) {
      this.graphics.lineBetween(0, offsetY + y * gs, areaWidth, offsetY + y * gs)
    }

    // Items
    this.items.forEach(item => {
      const px = item.x * gs + gs / 2
      const py = offsetY + item.y * gs + gs / 2

      // Glow
      this.graphics.fillStyle(COLORS.network.primary, 0.25)
      this.graphics.fillCircle(px, py, 12)

      // Item
      this.graphics.fillStyle(COLORS.network.glow, 1)
      this.graphics.fillCircle(px, py, 7)
    })

    // Cops
    const flashOn = Math.floor(this.time.now / 200) % 2 === 0
    this.cops.forEach(cop => {
      const cx = cop.x * gs + gs / 2
      const cy = offsetY + cop.y * gs + gs / 2

      // Pulse
      if (flashOn) {
        this.graphics.fillStyle(COLORS.status.danger, 0.25)
        this.graphics.fillCircle(cx, cy, 14)
      }

      // Cop
      this.graphics.fillStyle(COLORS.status.danger, 1)
      this.graphics.fillRect(cx - 8, cy - 8, 16, 16)
    })

    // Snake
    this.snake.forEach((seg, i) => {
      const sx = seg.x * gs + gs / 2
      const sy = offsetY + seg.y * gs + gs / 2

      if (i === 0) {
        // Head
        this.graphics.fillStyle(COLORS.text.primary, 1)
        this.graphics.fillCircle(sx, sy, 9)
      } else {
        // Body
        const alpha = 1 - (i / (this.snake.length + 5)) * 0.6
        this.graphics.fillStyle(this.gameData.theme?.primaryColor || COLORS.network.primary, alpha)
        this.graphics.fillCircle(sx, sy, 7)
      }
    })
  }
}

export default SnakeGame
