// GetawayGame - Top-down car chase mini-game
// Dodge traffic, collect cash, escape the police

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { audioManager } from '../../managers/AudioManager'
import { COLORS, toHexString, getTerminalStyle } from '../../ui/NetworkTheme'
import { createMiniGameEffects } from '../../utils/MiniGameEffects'

export class GetawayGame extends BaseMiniGame {
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.SCREEN_SHAKE,
      CURVEBALL_TYPES.SPEED_UP,
      CURVEBALL_TYPES.CONTROL_REVERSAL
    ]
  }

  constructor() {
    super('GetawayGame')

    this.player = null
    this.obstacles = []
    this.collectibles = []
    this.chasers = []
    this.roadLines = []
    this.scrollSpeed = 4
    this.lanePositions = []
    this.currentLane = 1
    this.effects = null
    this.isInvulnerable = false
    this.lives = 3
  }

  init(data) {
    super.init(data)
    this.obstacles = []
    this.collectibles = []
    this.chasers = []
    this.roadLines = []
    this.currentLane = 1
    this.isInvulnerable = false
    this.lives = 3

    // Difficulty scaling
    const tier = data.difficultyTier?.name || 'Novice'
    const configs = {
      Novice: { speed: 4, obstacleRate: 1200, chaserCount: 0 },
      Apprentice: { speed: 5, obstacleRate: 1000, chaserCount: 1 },
      Skilled: { speed: 6, obstacleRate: 850, chaserCount: 1 },
      Expert: { speed: 7, obstacleRate: 700, chaserCount: 2 },
      Master: { speed: 8, obstacleRate: 550, chaserCount: 2 }
    }
    this.config = configs[tier] || configs.Novice
    this.scrollSpeed = this.config.speed
  }

  create() {
    super.create()

    this.effects = createMiniGameEffects(this)

    const { width, height } = this.scale

    // Road setup
    const roadWidth = 240
    const roadLeft = (width - roadWidth) / 2
    const roadRight = roadLeft + roadWidth
    const laneWidth = roadWidth / 3

    // Road background
    this.add.rectangle(width / 2, height / 2 + 50, roadWidth, height - 100, 0x333333)
      .setStrokeStyle(4, 0xffff00, 0.8)

    // Lane positions (3 lanes)
    this.lanePositions = [
      roadLeft + laneWidth / 2,
      width / 2,
      roadRight - laneWidth / 2
    ]

    // Lane dividers (animated)
    for (let lane = 0; lane < 2; lane++) {
      const x = roadLeft + laneWidth * (lane + 1)
      for (let y = 130; y < height; y += 60) {
        const line = this.add.rectangle(x, y, 4, 30, 0xffffff, 0.6)
        this.roadLines.push(line)
      }
    }

    // Shoulder lines
    this.add.rectangle(roadLeft + 2, height / 2 + 50, 4, height - 100, 0xffffff, 0.8)
    this.add.rectangle(roadRight - 2, height / 2 + 50, 4, height - 100, 0xffffff, 0.8)

    // Player car
    this.createPlayer(this.lanePositions[1], height - 160)

    // Lives display
    this.livesText = this.add.text(20, 130, '❤️❤️❤️', { fontSize: '20px' })

    // Instructions
    this.add.text(width / 2, height - 40, '← → ARROWS or TAP sides to dodge!', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    // Spawn timers
    this.obstacleTimer = this.time.addEvent({
      delay: this.config.obstacleRate,
      callback: () => this.spawnObstacle(),
      loop: true
    })

    this.collectibleTimer = this.time.addEvent({
      delay: 2000,
      callback: () => this.spawnCollectible(),
      loop: true
    })

    // Spawn chasers
    for (let i = 0; i < this.config.chaserCount; i++) {
      this.time.delayedCall(3000 + i * 2000, () => this.spawnChaser())
    }

    // Input
    this.cursors = this.input.keyboard.createCursorKeys()

    // Touch controls
    this.input.on('pointerdown', (pointer) => {
      if (pointer.x < width / 2) {
        this.moveLeft()
      } else {
        this.moveRight()
      }
    })
  }

  createPlayer(x, y) {
    const container = this.add.container(x, y).setDepth(50)

    // Car body
    const body = this.add.rectangle(0, 0, 35, 55, COLORS.network.primary, 0.95)
    body.setStrokeStyle(2, 0xffffff, 0.5)

    // Windshield
    const windshield = this.add.rectangle(0, -12, 25, 15, 0x333333, 0.9)

    // Headlights
    const leftLight = this.add.circle(-10, -25, 4, 0xffff00, 0.9)
    const rightLight = this.add.circle(10, -25, 4, 0xffff00, 0.9)

    // Taillights
    const leftTail = this.add.circle(-10, 25, 3, 0xff0000, 0.9)
    const rightTail = this.add.circle(10, 25, 3, 0xff0000, 0.9)

    container.add([body, windshield, leftLight, rightLight, leftTail, rightTail])

    // Exhaust particle effect
    this.player = container
    this.player.setData('body', body)
  }

  spawnObstacle() {
    if (this.isPaused || this.isGameOver) return

    const lane = Phaser.Math.Between(0, 2)
    const x = this.lanePositions[lane]
    const y = 100

    // Random obstacle type
    const types = ['car', 'truck', 'barrier']
    const type = Phaser.Math.RND.pick(types)

    const obstacle = this.createObstacle(x, y, type)
    obstacle.setData('lane', lane)
    obstacle.setData('type', type)
    this.obstacles.push(obstacle)
  }

  createObstacle(x, y, type) {
    const container = this.add.container(x, y).setDepth(40)

    if (type === 'car') {
      // Other car (red)
      const body = this.add.rectangle(0, 0, 32, 50, 0xff4444, 0.95)
      body.setStrokeStyle(2, 0x000000, 0.3)
      const windshield = this.add.rectangle(0, 12, 22, 12, 0x222222, 0.9)
      const leftLight = this.add.circle(-8, 22, 3, 0xff0000, 0.9)
      const rightLight = this.add.circle(8, 22, 3, 0xff0000, 0.9)
      container.add([body, windshield, leftLight, rightLight])
    } else if (type === 'truck') {
      // Truck (larger)
      const body = this.add.rectangle(0, 0, 38, 70, 0x666666, 0.95)
      body.setStrokeStyle(2, 0x333333, 0.5)
      const cargo = this.add.rectangle(0, 5, 35, 45, 0x444444, 0.9)
      container.add([body, cargo])
    } else {
      // Barrier
      const body = this.add.rectangle(0, 0, 50, 20, 0xff8800, 0.95)
      body.setStrokeStyle(3, 0xffffff, 0.8)
      const stripe = this.add.rectangle(0, 0, 45, 8, 0xffffff, 0.9)
      container.add([body, stripe])
    }

    return container
  }

  spawnCollectible() {
    if (this.isPaused || this.isGameOver) return

    const lane = Phaser.Math.Between(0, 2)
    const x = this.lanePositions[lane]
    const y = 100

    const collectible = this.add.container(x, y).setDepth(45)

    // Cash bag
    const bag = this.add.circle(0, 0, 18, 0xffd700, 0.9)
    bag.setStrokeStyle(2, 0xffaa00, 1)
    const symbol = this.add.text(0, 0, '$', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    collectible.add([bag, symbol])
    collectible.setData('lane', lane)
    this.collectibles.push(collectible)

    // Pulse animation
    this.tweens.add({
      targets: collectible,
      scale: { from: 0.8, to: 1.2 },
      duration: 300,
      yoyo: true,
      repeat: -1
    })
  }

  spawnChaser() {
    if (this.isPaused || this.isGameOver) return

    const lane = Phaser.Math.Between(0, 2)
    const x = this.lanePositions[lane]
    const y = this.scale.height + 50

    const chaser = this.add.container(x, y).setDepth(55)

    // Police car
    const body = this.add.rectangle(0, 0, 35, 55, 0x0044aa, 0.95)
    body.setStrokeStyle(2, 0xffffff, 0.5)
    const windshield = this.add.rectangle(0, -12, 25, 15, 0x222222, 0.9)

    // Light bar
    const lightBar = this.add.rectangle(0, -20, 30, 6, 0xffffff, 0.9)
    const redLight = this.add.circle(-10, -20, 4, 0xff0000, 1)
    const blueLight = this.add.circle(10, -20, 4, 0x0000ff, 1)

    chaser.add([body, windshield, lightBar, redLight, blueLight])

    chaser.setData('lane', lane)
    chaser.setData('targetLane', lane)
    chaser.setData('redLight', redLight)
    chaser.setData('blueLight', blueLight)

    // Flashing lights
    this.tweens.add({
      targets: redLight,
      alpha: { from: 1, to: 0.2 },
      duration: 200,
      yoyo: true,
      repeat: -1
    })
    this.tweens.add({
      targets: blueLight,
      alpha: { from: 0.2, to: 1 },
      duration: 200,
      yoyo: true,
      repeat: -1
    })

    this.chasers.push(chaser)
  }

  moveLeft() {
    if (this.currentLane > 0) {
      this.currentLane--
      this.movePlayerToLane()
      audioManager.playHover()
    }
  }

  moveRight() {
    if (this.currentLane < 2) {
      this.currentLane++
      this.movePlayerToLane()
      audioManager.playHover()
    }
  }

  movePlayerToLane() {
    // Apply control reversal if active
    let targetLane = this.currentLane
    if (this.controlsReversed) {
      targetLane = 2 - this.currentLane
    }

    const targetX = this.lanePositions[targetLane]

    this.tweens.add({
      targets: this.player,
      x: targetX,
      duration: 150,
      ease: 'Quad.out'
    })

    // Tilt effect
    this.tweens.add({
      targets: this.player,
      angle: targetLane < this.currentLane ? -10 : 10,
      duration: 75,
      yoyo: true
    })
  }

  update(time, delta) {
    super.update(time, delta)

    if (this.isPaused || this.isGameOver) return

    // Apply speed modifier
    const speed = this.scrollSpeed * this.speedMultiplier

    // Keyboard input
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
      this.moveLeft()
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
      this.moveRight()
    }

    // Scroll road lines
    this.roadLines.forEach(line => {
      line.y += speed
      if (line.y > this.scale.height) {
        line.y = 130 - 30
      }
    })

    // Update obstacles
    this.obstacles = this.obstacles.filter(obs => {
      obs.y += speed * 1.2
      if (obs.y > this.scale.height + 50) {
        obs.destroy()
        this.addScore(10) // Points for dodging
        return false
      }

      // Collision check
      if (this.checkCollision(this.player, obs) && !this.isInvulnerable) {
        this.handleCrash(obs)
        return false
      }

      return true
    })

    // Update collectibles
    this.collectibles = this.collectibles.filter(col => {
      col.y += speed

      if (col.y > this.scale.height + 50) {
        col.destroy()
        return false
      }

      // Collection check
      if (this.checkCollision(this.player, col)) {
        this.collectCash(col)
        return false
      }

      return true
    })

    // Update chasers
    this.chasers.forEach(chaser => {
      // Move up (toward player)
      if (chaser.y > this.player.y + 100) {
        chaser.y -= speed * 0.3
      }

      // Try to match player's lane
      const targetLane = this.currentLane
      const currentLane = chaser.getData('lane')

      if (Math.random() < 0.02) {
        if (currentLane < targetLane && currentLane < 2) {
          chaser.setData('lane', currentLane + 1)
          this.tweens.add({
            targets: chaser,
            x: this.lanePositions[currentLane + 1],
            duration: 500
          })
        } else if (currentLane > targetLane && currentLane > 0) {
          chaser.setData('lane', currentLane - 1)
          this.tweens.add({
            targets: chaser,
            x: this.lanePositions[currentLane - 1],
            duration: 500
          })
        }
      }

      // Collision with chaser
      if (this.checkCollision(this.player, chaser) && !this.isInvulnerable) {
        this.handleCrash(chaser)
      }
    })

    // Exhaust trail
    if (Math.random() < 0.3) {
      this.effects.trail(this.player.x, this.player.y + 30, {
        color: 0x666666,
        size: 4,
        duration: 200
      })
    }
  }

  checkCollision(a, b) {
    const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y)
    return dist < 35
  }

  handleCrash(obstacle) {
    this.lives--
    this.updateLives()

    // Effects
    this.effects.shake({ intensity: 0.04, duration: 300 })
    this.effects.failureFlash(200)
    audioManager.playMiss()

    // Destroy obstacle
    obstacle.destroy()

    // Invulnerability frames
    this.isInvulnerable = true
    this.tweens.add({
      targets: this.player,
      alpha: { from: 0.3, to: 1 },
      duration: 100,
      repeat: 10,
      onComplete: () => {
        this.player.setAlpha(1)
        this.isInvulnerable = false
      }
    })

    if (this.lives <= 0) {
      this.endGame(false)
    }
  }

  collectCash(collectible) {
    const points = 50
    this.addScore(points)

    // Effects
    this.effects.coinBurst(collectible.x, collectible.y, 6)
    this.effects.floatingScore(collectible.x, collectible.y, `+${points}`, {
      color: '#ffd700'
    })
    audioManager.playHit()

    collectible.destroy()
  }

  updateLives() {
    const hearts = '❤️'.repeat(this.lives) + '🖤'.repeat(3 - this.lives)
    this.livesText.setText(hearts)
  }

  endGame(success) {
    // Stop timers
    if (this.obstacleTimer) this.obstacleTimer.destroy()
    if (this.collectibleTimer) this.collectibleTimer.destroy()

    super.endGame(success)
  }

  shutdown() {
    if (this.obstacleTimer) this.obstacleTimer.destroy()
    if (this.collectibleTimer) this.collectibleTimer.destroy()
    if (this.effects) this.effects.cleanup()
    this.obstacles.forEach(o => o.destroy())
    this.collectibles.forEach(c => c.destroy())
    this.chasers.forEach(c => c.destroy())
  }
}

export default GetawayGame
