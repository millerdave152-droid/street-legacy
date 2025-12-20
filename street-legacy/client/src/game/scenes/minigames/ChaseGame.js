// Chase Mini-Game
// Escape from cops by dodging traffic and obstacles

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { audioManager } from '../../managers/AudioManager'
import { COLORS, SYMBOLS, getTerminalStyle, toHexString, BORDERS } from '../../ui/NetworkTheme'

export class ChaseGame extends BaseMiniGame {
  // Declare supported curveballs
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.SCREEN_SHAKE,
      CURVEBALL_TYPES.SPEED_BOOST,
      CURVEBALL_TYPES.SPEED_SLOW,
      CURVEBALL_TYPES.VISUAL_BLUR,
      CURVEBALL_TYPES.DISTRACTION
    ]
  }

  constructor() {
    super('ChaseGame')

    this.player = null
    this.playerLane = 1 // 0, 1, 2 for left, middle, right
    this.lanes = [0, 0, 0] // X positions calculated in create
    this.laneWidth = 80

    this.obstacles = []
    this.copCars = []
    this.roadLines = []
    this.roadSpeed = 5
    this.obstacleSpeed = 6
    this.copSpeed = 4

    this.distance = 0
    this.targetDistance = 1000
    this.isChangingLane = false
    this.copCooldown = 0
    this.obstacleTimer = 0
    this.nearMissBonus = 0

    // Road boundaries
    this.roadLeft = 0
    this.roadRight = 0
    this.roadTop = 120

    // Police pursuit mode
    this.isPoliceChase = false
    this.wantedLevel = 0
  }

  create() {
    super.create()

    // Reset game state flags
    this.caughtHandled = false

    // Check if this is a police pursuit
    this.isPoliceChase = this.gameData.isPoliceChase || false
    this.wantedLevel = this.gameData.wantedLevel || 0

    // Difficulty scaling - easier in forgiving mode for police chases
    if (this.isPoliceChase) {
      // Police chase: gentler scaling for forgiving difficulty
      this.roadSpeed = 3.5 + (this.wantedLevel * 0.4)
      this.obstacleSpeed = 4 + (this.wantedLevel * 0.5)
      this.copSpeed = 2.5 + (this.wantedLevel * 0.3)
      this.targetDistance = this.gameData.targetScore || (600 + this.wantedLevel * 100)
    } else {
      // Regular crime chase: original difficulty
      this.roadSpeed = 4 + (this.gameData.difficulty - 1) * 1.5
      this.obstacleSpeed = 5 + (this.gameData.difficulty - 1) * 1.5
      this.copSpeed = 3 + (this.gameData.difficulty - 1) * 1
      this.targetDistance = this.gameData.targetScore || 1000
    }

    // Calculate road dimensions
    this.roadLeft = (this.gameWidth - this.laneWidth * 3) / 2
    this.roadRight = this.roadLeft + this.laneWidth * 3
    this.lanes = [
      this.roadLeft + this.laneWidth * 0.5,
      this.roadLeft + this.laneWidth * 1.5,
      this.roadLeft + this.laneWidth * 2.5
    ]

    // Road background
    this.add.rectangle(this.gameWidth / 2, (this.gameHeight + this.roadTop) / 2,
      this.laneWidth * 3 + 20, this.gameHeight - this.roadTop, 0x2d2d2d)

    // Road edges
    this.add.rectangle(this.roadLeft - 5, (this.gameHeight + this.roadTop) / 2,
      10, this.gameHeight - this.roadTop, 0xffffff)
    this.add.rectangle(this.roadRight + 5, (this.gameHeight + this.roadTop) / 2,
      10, this.gameHeight - this.roadTop, 0xffffff)

    // Lane dividers (animated)
    for (let i = 0; i < 12; i++) {
      const line1 = this.add.rectangle(
        this.roadLeft + this.laneWidth,
        this.roadTop + i * 60,
        4, 30, 0xffff00
      )
      const line2 = this.add.rectangle(
        this.roadLeft + this.laneWidth * 2,
        this.roadTop + i * 60,
        4, 30, 0xffff00
      )
      this.roadLines.push(line1, line2)
    }

    // Player car
    this.player = this.add.container(this.lanes[this.playerLane], this.gameHeight - 150)
    const carBody = this.add.rectangle(0, 0, 50, 80, COLORS.status.info)
    const carTop = this.add.rectangle(0, -10, 40, 40, 0x1d4ed8)
    const wheel1 = this.add.rectangle(-22, -25, 8, 20, 0x1f2937)
    const wheel2 = this.add.rectangle(22, -25, 8, 20, 0x1f2937)
    const wheel3 = this.add.rectangle(-22, 25, 8, 20, 0x1f2937)
    const wheel4 = this.add.rectangle(22, 25, 8, 20, 0x1f2937)
    const headlight1 = this.add.rectangle(-15, -40, 10, 6, 0xfef08a)
    const headlight2 = this.add.rectangle(15, -40, 10, 6, 0xfef08a)
    this.player.add([carBody, carTop, wheel1, wheel2, wheel3, wheel4, headlight1, headlight2])

    // Police pursuit header (if applicable)
    if (this.isPoliceChase) {
      const wantedName = this.gameData.wantedName || 'Wanted'
      const stars = '★'.repeat(this.wantedLevel) + '☆'.repeat(5 - this.wantedLevel)

      // Pulsing siren background
      this.pursuitHeader = this.add.rectangle(this.gameWidth / 2, 25, this.gameWidth, 50, COLORS.bg.panel, 0.9)

      this.add.text(this.gameWidth / 2, 15, `${SYMBOLS.system} POLICE PURSUIT ${SYMBOLS.system}`, {
        ...getTerminalStyle('lg'),
        color: toHexString(COLORS.status.danger)
      }).setOrigin(0.5)

      this.starsText = this.add.text(this.gameWidth / 2, 35, stars, {
        fontSize: '14px',
        color: toHexString(COLORS.status.warning)
      }).setOrigin(0.5)

      // Pulse the header
      this.tweens.add({
        targets: this.pursuitHeader,
        alpha: { from: 0.9, to: 0.5 },
        duration: 500,
        yoyo: true,
        repeat: -1
      })

      // Spawn initial cop cars for police pursuit
      this.time.delayedCall(500, () => this.spawnCopCar())
      if (this.wantedLevel >= 3) {
        this.time.delayedCall(1500, () => this.spawnCopCar())
      }
    }

    // Distance display
    this.distanceText = this.add.text(this.gameWidth / 2, this.gameHeight - 50,
      `${this.distance}m / ${this.targetDistance}m`, {
        ...getTerminalStyle('xl')
      }).setOrigin(0.5)

    // Instructions
    this.add.text(this.gameWidth / 2, this.gameHeight - 20,
      `${SYMBOLS.system} ${SYMBOLS.back} ${SYMBOLS.forward} ARROWS or A/D to change lanes`, {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)

    // Input
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-LEFT', () => this.changeLane(-1))
      this.input.keyboard.on('keydown-RIGHT', () => this.changeLane(1))
      this.input.keyboard.on('keydown-A', () => this.changeLane(-1))
      this.input.keyboard.on('keydown-D', () => this.changeLane(1))
    }

    // Touch/swipe controls
    this.input.on('pointerdown', (pointer) => {
      if (pointer.x < this.gameWidth / 2) {
        this.changeLane(-1)
      } else {
        this.changeLane(1)
      }
    })
  }

  update(time, delta) {
    if (this.isPaused || this.isGameOver) return

    // Animate road lines
    this.roadLines.forEach(line => {
      line.y += this.roadSpeed
      if (line.y > this.gameHeight + 30) {
        line.y = this.roadTop - 30
      }
    })

    // Update distance
    this.distance += this.roadSpeed * 0.2
    const displayDistance = Math.floor(this.distance)
    this.distanceText.setText(`${displayDistance}m / ${this.targetDistance}m`)
    this.setScore(displayDistance)

    // Check win condition
    if (this.distance >= this.targetDistance) {
      this.endGame(true)
      return
    }

    // Spawn obstacles
    this.obstacleTimer += delta
    if (this.obstacleTimer > 800 - (this.gameData.difficulty * 100)) {
      this.obstacleTimer = 0
      this.spawnObstacle()
    }

    // Spawn cop cars - more frequently in police pursuit mode
    this.copCooldown -= delta
    const copSpawnChance = this.isPoliceChase ? 0.015 + (this.wantedLevel * 0.005) : 0.01
    const copCooldownTime = this.isPoliceChase ? 3000 - (this.wantedLevel * 300) : 5000
    if (this.copCooldown <= 0 && Math.random() < copSpawnChance) {
      this.spawnCopCar()
      this.copCooldown = Math.max(1500, copCooldownTime)
    }

    // Update obstacles
    this.updateObstacles()

    // Update cop cars
    this.updateCopCars()

    // Check collisions
    this.checkCollisions()

    // Speed up over time
    this.roadSpeed += delta * 0.0001
    this.obstacleSpeed += delta * 0.0001
  }

  changeLane(direction) {
    if (this.isChangingLane || this.isPaused || this.isGameOver) return

    const newLane = this.playerLane + direction
    if (newLane < 0 || newLane > 2) return

    this.isChangingLane = true
    this.playerLane = newLane

    this.tweens.add({
      targets: this.player,
      x: this.lanes[this.playerLane],
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        this.isChangingLane = false
      }
    })

    audioManager.playClick()
  }

  spawnObstacle() {
    const lane = Phaser.Math.Between(0, 2)
    const obstacleTypes = [
      { emoji: '🚗', color: COLORS.status.danger, width: 45, height: 70 },
      { emoji: '🚕', color: COLORS.status.warning, width: 45, height: 70 },
      { emoji: '🚙', color: COLORS.network.primary, width: 50, height: 75 },
      { emoji: '🛻', color: 0x6366f1, width: 50, height: 80 },
      { emoji: '🚌', color: 0xf97316, width: 55, height: 100 }
    ]
    const type = obstacleTypes[Phaser.Math.Between(0, obstacleTypes.length - 1)]

    const obstacle = this.add.container(this.lanes[lane], this.roadTop - 50)
    const body = this.add.rectangle(0, 0, type.width, type.height, type.color)
    const top = this.add.rectangle(0, -5, type.width - 10, type.height * 0.4, type.color - 0x222222)
    obstacle.add([body, top])

    obstacle.setData('lane', lane)
    obstacle.setData('width', type.width)
    obstacle.setData('height', type.height)
    obstacle.setData('passed', false)

    this.obstacles.push(obstacle)
  }

  spawnCopCar() {
    // Spawn cop behind player
    const lane = Phaser.Math.Between(0, 2)

    const cop = this.add.container(this.lanes[lane], this.gameHeight + 100)
    const body = this.add.rectangle(0, 0, 50, 85, 0x1f2937)
    const top = this.add.rectangle(0, -10, 40, 40, 0x111827)
    const light1 = this.add.rectangle(-12, -35, 10, 8, COLORS.status.danger)
    const light2 = this.add.rectangle(12, -35, 10, 8, COLORS.status.info)
    cop.add([body, top, light1, light2])

    cop.setData('lane', lane)
    cop.setData('lights', [light1, light2])
    cop.setData('flashTimer', 0)

    this.copCars.push(cop)

    // Warning - Network green flash
    this.cameras.main.flash(100, 0, 255, 65)
  }

  updateObstacles() {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obstacle = this.obstacles[i]
      obstacle.y += this.obstacleSpeed

      // Near miss detection
      if (!obstacle.getData('passed') && obstacle.y > this.player.y + 50) {
        obstacle.setData('passed', true)
        if (obstacle.getData('lane') === this.playerLane) {
          // Actually passed through player's lane but survived (near miss)
        }
      }

      // Remove off-screen
      if (obstacle.y > this.gameHeight + 100) {
        obstacle.destroy()
        this.obstacles.splice(i, 1)
      }
    }
  }

  updateCopCars() {
    for (let i = this.copCars.length - 1; i >= 0; i--) {
      const cop = this.copCars[i]

      // Move cop towards player
      if (cop.y > this.player.y + 100) {
        cop.y -= this.copSpeed
      } else {
        // Cop follows player lane
        const targetX = this.lanes[this.playerLane]
        if (Math.abs(cop.x - targetX) > 5) {
          cop.x += (targetX - cop.x) * 0.02
        }
        cop.y -= this.copSpeed * 0.5
      }

      // Flash lights
      const flashTimer = (cop.getData('flashTimer') || 0) + 1
      cop.setData('flashTimer', flashTimer)
      const lights = cop.getData('lights')
      if (flashTimer % 15 === 0) {
        lights[0].setFillStyle(lights[0].fillColor === COLORS.status.danger ? COLORS.status.info : COLORS.status.danger)
        lights[1].setFillStyle(lights[1].fillColor === COLORS.status.info ? COLORS.status.danger : COLORS.status.info)
      }

      // Remove if too far ahead
      if (cop.y < this.roadTop - 100) {
        cop.destroy()
        this.copCars.splice(i, 1)
      }
    }
  }

  checkCollisions() {
    const playerBounds = {
      left: this.player.x - 25,
      right: this.player.x + 25,
      top: this.player.y - 40,
      bottom: this.player.y + 40
    }

    // Check obstacle collisions
    for (const obstacle of this.obstacles) {
      const oWidth = obstacle.getData('width') / 2
      const oHeight = obstacle.getData('height') / 2
      const obstacleBounds = {
        left: obstacle.x - oWidth,
        right: obstacle.x + oWidth,
        top: obstacle.y - oHeight,
        bottom: obstacle.y + oHeight
      }

      if (this.boundsOverlap(playerBounds, obstacleBounds)) {
        this.handleCrash()
        return
      }
    }

    // Check cop collisions
    for (const cop of this.copCars) {
      const copBounds = {
        left: cop.x - 25,
        right: cop.x + 25,
        top: cop.y - 42,
        bottom: cop.y + 42
      }

      if (this.boundsOverlap(playerBounds, copBounds)) {
        this.handleCaught()
        return
      }
    }
  }

  boundsOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  }

  handleCrash() {
    this.cameras.main.shake(300, 0.05)
    this.cameras.main.flash(200, 255, 100, 0)

    // Explosion effect
    const explosion = this.add.text(this.player.x, this.player.y, '💥', { fontSize: '64px' })
      .setOrigin(0.5)

    this.tweens.add({
      targets: explosion,
      scale: { from: 0.5, to: 2 },
      alpha: { from: 1, to: 0 },
      duration: 500
    })

    this.time.delayedCall(300, () => {
      this.endGame(false)
    })
  }

  handleCaught() {
    // Prevent duplicate calls
    if (this.caughtHandled) return
    this.caughtHandled = true

    try {
      this.cameras.main.shake(200, 0.03)
    } catch (e) { /* ignore */ }

    // Add "BUSTED" text
    const busted = this.add.text(this.gameWidth / 2, this.gameHeight / 2, `${SYMBOLS.system} BUSTED! ${SYMBOLS.system}`, {
      ...getTerminalStyle('display'),
      color: toHexString(COLORS.status.danger)
    }).setOrigin(0.5)

    this.tweens.add({
      targets: busted,
      scale: { from: 0.5, to: 1.2 },
      duration: 300
    })

    // Call endGame immediately
    this.endGame(false)
  }
}

export default ChaseGame
