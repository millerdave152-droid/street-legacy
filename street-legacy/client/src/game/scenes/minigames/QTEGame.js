// QTE (Quick Time Event) Mini-Game
// Press the arrows as they appear for quick heists

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { COLORS, SYMBOLS, getTerminalStyle, toHexString } from '../../ui/NetworkTheme'

export class QTEGame extends BaseMiniGame {
  // Declare supported curveballs (NO control reversal - too unfair for QTE)
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.SCREEN_SHAKE,
      CURVEBALL_TYPES.INPUT_LAG,
      CURVEBALL_TYPES.DISTRACTION,
      CURVEBALL_TYPES.BRIEF_BLACKOUT
    ]
  }

  constructor() {
    super('QTEGame')

    this.buttons = []
    this.currentArrow = null
    this.phase = 0
    this.combo = 0
    this.misses = 0
    this.maxMisses = 3
    this.isWaiting = false
    this.arrowTime = 1200
    this.phaseTimer = null

    this.statusText = null
    this.comboText = null
    this.timerBar = null
    this.missIndicators = []
  }

  create() {
    super.create()

    this.arrowTime = Math.max(500, 1400 - (this.gameData.difficulty - 1) * 200)

    // Icon
    this.add.text(this.gameWidth / 2, 160, this.gameData.theme?.icon || '🎯', { fontSize: '64px' }).setOrigin(0.5)

    // Status with Network styling
    this.statusText = this.add.text(this.gameWidth / 2, 250, `${SYMBOLS.system} GET READY...`, {
      ...getTerminalStyle('xxl'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5)

    // Combo with Network styling
    this.comboText = this.add.text(this.gameWidth / 2, 290, '', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.status.warning)
    }).setOrigin(0.5)

    // Arrow buttons
    this.createButtons()

    // Miss indicators - Network danger color
    this.missIndicators = []
    for (let i = 0; i < this.maxMisses; i++) {
      const ind = this.add.circle(this.gameWidth / 2 - 35 + i * 35, 520, 12, COLORS.status.danger)
      this.missIndicators.push(ind)
    }

    // Timer bar with Network styling
    this.add.rectangle(this.gameWidth / 2, 570, 300, 12, COLORS.bg.panel)
    this.timerBar = this.add.rectangle(this.gameWidth / 2 - 150, 570, 300, 12, COLORS.network.primary)
      .setOrigin(0, 0.5)
    this.timerBar.setVisible(false)

    // Instructions with Network styling
    this.add.text(this.gameWidth / 2, 620, `${SYMBOLS.system} Press the arrow when it lights up!`, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    // Input
    this.setupInput()

    // Start
    this.time.delayedCall(1200, () => this.nextPhase())
  }

  createButtons() {
    const dirs = [
      { dir: 'up', sym: '↑', x: this.gameWidth / 2, y: 350 },
      { dir: 'left', sym: '←', x: this.gameWidth / 2 - 85, y: 430 },
      { dir: 'down', sym: '↓', x: this.gameWidth / 2, y: 430 },
      { dir: 'right', sym: '→', x: this.gameWidth / 2 + 85, y: 430 }
    ]

    this.buttons = []

    dirs.forEach(({ dir, sym, x, y }) => {
      const btn = this.add.rectangle(x, y, 75, 75, COLORS.bg.panel).setStrokeStyle(2, COLORS.network.dim)
      const txt = this.add.text(x, y, sym, {
        ...getTerminalStyle('display'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)

      this.buttons.push({ dir, symbol: sym, btn, txt, x, y })

      // Touch support
      btn.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (this.isWaiting) this.handleInput(dir)
        })
    })
  }

  setupInput() {
    if (!this.input.keyboard) return

    this.input.keyboard.on('keydown-UP', () => this.handleInput('up'))
    this.input.keyboard.on('keydown-DOWN', () => this.handleInput('down'))
    this.input.keyboard.on('keydown-LEFT', () => this.handleInput('left'))
    this.input.keyboard.on('keydown-RIGHT', () => this.handleInput('right'))
    this.input.keyboard.on('keydown-W', () => this.handleInput('up'))
    this.input.keyboard.on('keydown-S', () => this.handleInput('down'))
    this.input.keyboard.on('keydown-A', () => this.handleInput('left'))
    this.input.keyboard.on('keydown-D', () => this.handleInput('right'))
  }

  nextPhase() {
    if (this.phase >= (this.gameData.targetScore || 6)) {
      this.endGame(true)
      return
    }

    this.phase++

    // Random arrow
    const dirs = ['up', 'down', 'left', 'right']
    this.currentArrow = Phaser.Utils.Array.GetRandom(dirs)

    // Highlight with Network primary color
    const btn = this.buttons.find(b => b.dir === this.currentArrow)
    btn.btn.setFillStyle(COLORS.network.primary)
    btn.txt.setColor(toHexString(COLORS.bg.void))

    this.statusText.setText(`HIT ${btn.symbol}!`)
    this.isWaiting = true

    // Timer bar
    this.timerBar.setVisible(true)
    this.timerBar.width = 300

    this.tweens.add({
      targets: this.timerBar,
      width: 0,
      duration: this.arrowTime,
      ease: 'Linear'
    })

    this.phaseTimer = this.time.delayedCall(this.arrowTime, () => {
      if (this.isWaiting) this.handleMiss()
    })
  }

  handleInput(dir) {
    if (!this.isWaiting || this.isPaused || this.isGameOver) return

    this.isWaiting = false
    if (this.phaseTimer) this.phaseTimer.destroy()
    this.tweens.killTweensOf(this.timerBar)
    this.timerBar.setVisible(false)

    if (dir === this.currentArrow) {
      this.handleHit()
    } else {
      this.handleMiss()
    }
  }

  handleHit() {
    this.combo++
    const pts = 100 + (this.combo - 1) * 25
    this.addScore(pts)

    const btn = this.buttons.find(b => b.dir === this.currentArrow)
    btn.btn.setFillStyle(COLORS.network.glow)
    this.statusText.setText(`${SYMBOLS.check} NICE! +${pts}`).setColor(toHexString(COLORS.network.primary))

    if (this.combo > 1) {
      this.comboText.setText(`${this.combo}x COMBO!`)
    }

    // Flash with Network green
    this.cameras.main.flash(80, 0, 255, 65)

    this.time.delayedCall(280, () => {
      this.resetButtons()
      this.statusText.setColor(toHexString(COLORS.network.primary))
      this.nextPhase()
    })
  }

  handleMiss() {
    this.combo = 0
    this.misses++
    this.comboText.setText('')

    this.statusText.setText(`${SYMBOLS.close} MISS!`).setColor(toHexString(COLORS.status.danger))
    this.cameras.main.shake(80, 0.01)

    if (this.misses <= this.maxMisses) {
      this.missIndicators[this.misses - 1].setFillStyle(COLORS.bg.elevated)
    }

    if (this.misses >= this.maxMisses) {
      this.time.delayedCall(400, () => this.endGame(false))
      return
    }

    this.time.delayedCall(280, () => {
      this.resetButtons()
      this.statusText.setColor(toHexString(COLORS.network.primary))
      this.nextPhase()
    })
  }

  resetButtons() {
    this.buttons.forEach(b => {
      b.btn.setFillStyle(COLORS.bg.panel)
      b.txt.setColor(toHexString(COLORS.text.muted))
    })
  }

  update() {
    // Event-driven logic, no update needed
  }
}

export default QTEGame
