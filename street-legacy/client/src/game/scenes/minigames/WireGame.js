// Wire Mini-Game
// Cut the right wires to hotwire a car or defuse a device

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { audioManager } from '../../managers/AudioManager'
import { COLORS, SYMBOLS, getTerminalStyle, toHexString, BORDERS } from '../../ui/NetworkTheme'

export class WireGame extends BaseMiniGame {
  // Declare supported curveballs
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.VISUAL_BLUR,
      CURVEBALL_TYPES.DISTRACTION,
      CURVEBALL_TYPES.BRIEF_BLACKOUT
    ]
  }

  constructor() {
    super('WireGame')

    this.wires = []
    this.correctWires = []
    this.cutWires = []
    this.totalWires = 6
    this.wiresToCut = 3
    this.wrongCuts = 0
    this.maxWrongCuts = 2
    this.hints = []
    this.hintIndex = 0
  }

  create() {
    super.create()

    // Reset game state flags
    this.successHandled = false
    this.failureHandled = false

    // Difficulty scaling
    if (this.gameData.difficulty >= 4) {
      this.totalWires = 8
      this.wiresToCut = 4
      this.maxWrongCuts = 1
    } else if (this.gameData.difficulty >= 2) {
      this.totalWires = 7
      this.wiresToCut = 4
      this.maxWrongCuts = 2
    } else {
      this.totalWires = 6
      this.wiresToCut = 3
      this.maxWrongCuts = 2
    }

    // Wire colors
    this.wireColors = [
      { name: 'RED', color: COLORS.status.danger, hex: toHexString(COLORS.status.danger) },
      { name: 'BLUE', color: COLORS.status.info, hex: toHexString(COLORS.status.info) },
      { name: 'GREEN', color: COLORS.network.primary, hex: toHexString(COLORS.network.primary) },
      { name: 'YELLOW', color: COLORS.status.warning, hex: toHexString(COLORS.status.warning) },
      { name: 'PURPLE', color: 0xa855f7, hex: '#a855f7' },
      { name: 'ORANGE', color: 0xf97316, hex: '#f97316' },
      { name: 'WHITE', color: COLORS.text.primary, hex: toHexString(COLORS.text.primary) },
      { name: 'CYAN', color: 0x06b6d4, hex: '#06b6d4' }
    ]

    // Setup wires
    this.setupWires()

    // Generate hints
    this.generateHints()

    // Draw interface
    this.drawWirePanel()

    // Create hint display
    this.createHintDisplay()

    // Instructions
    this.add.text(this.gameWidth / 2, this.gameHeight - 40,
      `${SYMBOLS.system} Click wires to cut | Follow the hints`, {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)

    // Wrong cuts display
    this.wrongCutsText = this.add.text(this.gameWidth / 2, this.gameHeight - 60,
      `${SYMBOLS.system} Mistakes: ${this.wrongCuts}/${this.maxWrongCuts}`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.status.danger)
      }).setOrigin(0.5)
  }

  setupWires() {
    // Shuffle colors and pick wires
    const shuffledColors = Phaser.Utils.Array.Shuffle([...this.wireColors]).slice(0, this.totalWires)

    // Assign wire data
    this.wires = shuffledColors.map((color, index) => ({
      index,
      color: color.color,
      colorName: color.name,
      hex: color.hex,
      isCut: false,
      isCorrect: false
    }))

    // Select correct wires to cut
    const correctIndices = []
    while (correctIndices.length < this.wiresToCut) {
      const idx = Phaser.Math.Between(0, this.totalWires - 1)
      if (!correctIndices.includes(idx)) {
        correctIndices.push(idx)
        this.wires[idx].isCorrect = true
      }
    }

    this.correctWires = correctIndices.map(i => this.wires[i])
  }

  generateHints() {
    // Generate cryptic hints about which wires to cut
    this.hints = []

    this.correctWires.forEach((wire, index) => {
      const hintTypes = [
        `Cut the ${wire.colorName} wire`,
        `The ${wire.colorName} one must go`,
        `${wire.colorName} is dangerous - cut it`,
        `Disconnect ${wire.colorName}`
      ]
      this.hints.push(hintTypes[Phaser.Math.Between(0, hintTypes.length - 1)])
    })

    // Shuffle hints so they don't match wire order
    this.hints = Phaser.Utils.Array.Shuffle(this.hints)
  }

  drawWirePanel() {
    const panelX = this.gameWidth / 2
    const panelY = this.gameHeight / 2 + 30
    const panelWidth = 320
    const panelHeight = 200

    // Device/panel background
    this.add.rectangle(panelX, panelY, panelWidth, panelHeight, COLORS.bg.panel)
      .setStrokeStyle(3, COLORS.border.default)

    // Panel label
    this.add.rectangle(panelX, panelY - panelHeight / 2 + 15, panelWidth - 20, 24, COLORS.border.default)
    this.add.text(panelX, panelY - panelHeight / 2 + 15, `${SYMBOLS.system} WIRE ACCESS PANEL`, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    // Left connector panel
    const connectorLeft = panelX - panelWidth / 2 + 30
    const connectorRight = panelX + panelWidth / 2 - 30
    const wireStartY = panelY - 50
    const wireSpacing = 25
    const wireHeight = 8

    // Draw connectors and wires
    this.wireObjects = []

    this.wires.forEach((wire, index) => {
      const y = wireStartY + index * wireSpacing

      // Left connector
      this.add.rectangle(connectorLeft - 15, y, 20, 14, COLORS.text.disabled)
        .setStrokeStyle(1, COLORS.text.muted)

      // Right connector
      this.add.rectangle(connectorRight + 15, y, 20, 14, COLORS.text.disabled)
        .setStrokeStyle(1, COLORS.text.muted)

      // Wire (curved line simulation with multiple segments)
      const wireContainer = this.add.container(0, 0)

      // Create slightly curved wire
      const segments = 8
      const segmentWidth = (connectorRight - connectorLeft) / segments
      const wireGraphics = this.add.graphics()

      wireGraphics.lineStyle(wireHeight, wire.color)
      wireGraphics.beginPath()
      wireGraphics.moveTo(connectorLeft, y)

      for (let i = 1; i <= segments; i++) {
        const segX = connectorLeft + i * segmentWidth
        const waveOffset = Math.sin(i * 0.8 + index) * 3 // Slight wave
        wireGraphics.lineTo(segX, y + waveOffset)
      }
      wireGraphics.strokePath()

      wireContainer.add(wireGraphics)

      // Cut indicator (hidden initially)
      const cutMark = this.add.text(panelX, y, '✂️', {
        fontSize: '24px'
      }).setOrigin(0.5).setVisible(false)

      // Interactive hit area
      const hitArea = this.add.rectangle(panelX, y, panelWidth - 80, wireHeight + 10, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (!wire.isCut) {
            wireGraphics.lineStyle(wireHeight + 2, COLORS.text.primary, 0.3)
            wireGraphics.beginPath()
            wireGraphics.moveTo(connectorLeft, y)
            for (let i = 1; i <= segments; i++) {
              const segX = connectorLeft + i * segmentWidth
              const waveOffset = Math.sin(i * 0.8 + index) * 3
              wireGraphics.lineTo(segX, y + waveOffset)
            }
            wireGraphics.strokePath()
          }
        })
        .on('pointerout', () => {
          // Redraw normal
          if (!wire.isCut) {
            wireGraphics.clear()
            wireGraphics.lineStyle(wireHeight, wire.color)
            wireGraphics.beginPath()
            wireGraphics.moveTo(connectorLeft, y)
            for (let i = 1; i <= segments; i++) {
              const segX = connectorLeft + i * segmentWidth
              const waveOffset = Math.sin(i * 0.8 + index) * 3
              wireGraphics.lineTo(segX, y + waveOffset)
            }
            wireGraphics.strokePath()
          }
        })
        .on('pointerdown', () => this.cutWire(index))

      this.wireObjects.push({
        wire,
        graphics: wireGraphics,
        cutMark,
        hitArea,
        y,
        connectorLeft,
        connectorRight,
        segments,
        segmentWidth
      })
    })

    // Wire color labels on the side
    this.wires.forEach((wire, index) => {
      const y = wireStartY + index * wireSpacing
      this.add.text(connectorLeft - 45, y, wire.colorName.substring(0, 3), {
        fontSize: '10px',
        color: wire.hex
      }).setOrigin(0.5)
    })
  }

  cutWire(index) {
    if (this.isPaused || this.isGameOver) return

    const wireData = this.wires[index]
    const wireObj = this.wireObjects[index]

    if (wireData.isCut) return // Already cut

    wireData.isCut = true
    this.cutWires.push(wireData)

    // Visual cut effect
    const { graphics, cutMark, y, connectorLeft, segments, segmentWidth } = wireObj

    // Redraw wire as cut (two halves with gap)
    graphics.clear()
    graphics.lineStyle(8, wireData.color)

    // Left half
    graphics.beginPath()
    graphics.moveTo(connectorLeft, y)
    for (let i = 1; i <= segments / 2 - 1; i++) {
      const segX = connectorLeft + i * segmentWidth
      const waveOffset = Math.sin(i * 0.8 + index) * 3
      graphics.lineTo(segX, y + waveOffset)
    }
    graphics.strokePath()

    // Right half
    graphics.beginPath()
    graphics.moveTo(connectorLeft + (segments / 2 + 1) * segmentWidth, y)
    for (let i = segments / 2 + 2; i <= segments; i++) {
      const segX = connectorLeft + i * segmentWidth
      const waveOffset = Math.sin(i * 0.8 + index) * 3
      graphics.lineTo(segX, y + waveOffset)
    }
    graphics.strokePath()

    // Show cut mark
    cutMark.setVisible(true)
    this.tweens.add({
      targets: cutMark,
      scale: { from: 1.5, to: 1 },
      duration: 200
    })

    // Check if correct
    if (wireData.isCorrect) {
      this.handleCorrectCut(wireData)
    } else {
      this.handleWrongCut(wireData)
    }
  }

  handleCorrectCut(wire) {
    audioManager.playHit()
    this.cameras.main.flash(100, 0, 255, 65)

    this.addScore(100)

    // Check if all correct wires cut
    const correctCuts = this.cutWires.filter(w => w.isCorrect).length
    if (correctCuts >= this.wiresToCut) {
      this.time.delayedCall(500, () => {
        this.handleSuccess()
      })
    }
  }

  handleWrongCut(wire) {
    this.wrongCuts++
    this.wrongCutsText.setText(`${SYMBOLS.system} Mistakes: ${this.wrongCuts}/${this.maxWrongCuts}`)

    this.cameras.main.shake(200, 0.02)
    this.cameras.main.flash(100, 255, 0, 0)
    audioManager.playMiss()

    // Spark effect
    const spark = this.add.text(this.gameWidth / 2, this.gameHeight / 2, '⚡', {
      fontSize: '48px'
    }).setOrigin(0.5)

    this.tweens.add({
      targets: spark,
      alpha: 0,
      scale: 2,
      duration: 300,
      onComplete: () => spark.destroy()
    })

    if (this.wrongCuts >= this.maxWrongCuts) {
      this.time.delayedCall(300, () => {
        this.handleFailure()
      })
    }
  }

  handleSuccess() {
    // Prevent duplicate calls
    if (this.successHandled) return
    this.successHandled = true

    // Success animation
    try {
      this.cameras.main.flash(200, 0, 255, 65)
    } catch (e) { /* ignore */ }

    const successText = this.add.text(this.gameWidth / 2, this.gameHeight / 2, `${SYMBOLS.system} CONNECTED!`, {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5)

    this.tweens.add({
      targets: successText,
      scale: { from: 0.5, to: 1.2 },
      duration: 300
    })

    // Time bonus
    this.addScore(this.timeRemaining * 5)

    // Call endGame immediately
    this.endGame(true)
  }

  handleFailure() {
    // Prevent duplicate calls
    if (this.failureHandled) return
    this.failureHandled = true

    // Explosion effect
    try {
      this.cameras.main.shake(300, 0.05)
    } catch (e) { /* ignore */ }

    const explosion = this.add.text(this.gameWidth / 2, this.gameHeight / 2, `${SYMBOLS.system} SHORT CIRCUIT!`, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.status.danger)
    }).setOrigin(0.5)

    this.tweens.add({
      targets: explosion,
      scale: { from: 0.5, to: 1.5 },
      duration: 400
    })

    // Call endGame immediately
    this.endGame(false)
  }

  createHintDisplay() {
    const hintY = 125

    this.add.text(this.gameWidth / 2, hintY - 20, `${SYMBOLS.system} INSTRUCTIONS`, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    // Display hints
    this.hints.forEach((hint, index) => {
      this.add.text(this.gameWidth / 2, hintY + index * 18, `${index + 1}. ${hint}`, {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.status.warning)
      }).setOrigin(0.5)
    })
  }

  update(time, delta) {
    if (this.isPaused || this.isGameOver) return
    // Wire game is click-based, no continuous update needed
  }
}

export default WireGame
