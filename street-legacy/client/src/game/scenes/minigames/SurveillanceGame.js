// SurveillanceGame - Observation/spotting mini-game
// Identify targets in a scene while avoiding decoys

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { audioManager } from '../../managers/AudioManager'
import { COLORS, toHexString, getTerminalStyle } from '../../ui/NetworkTheme'
import { createMiniGameEffects } from '../../utils/MiniGameEffects'

// Target types
const TARGETS = [
  { id: 'briefcase', icon: '💼', name: 'Briefcase', hint: 'Contains the goods' },
  { id: 'suspect', icon: '🕵️', name: 'Suspect', hint: 'Person of interest' },
  { id: 'car', icon: '🚗', name: 'Getaway Car', hint: 'Red sedan, license XXX' },
  { id: 'phone', icon: '📱', name: 'Burner Phone', hint: 'Communication device' },
  { id: 'package', icon: '📦', name: 'Package', hint: 'The delivery' },
  { id: 'key', icon: '🔑', name: 'Key', hint: 'Access to the safe' }
]

// Decoys (wrong clicks)
const DECOYS = [
  { id: 'person', icon: '👤', name: 'Civilian' },
  { id: 'dog', icon: '🐕', name: 'Dog' },
  { id: 'tree', icon: '🌳', name: 'Tree' },
  { id: 'trash', icon: '🗑️', name: 'Trash Can' },
  { id: 'bench', icon: '🪑', name: 'Bench' },
  { id: 'lamp', icon: '💡', name: 'Street Light' },
  { id: 'bag', icon: '👜', name: 'Shopping Bag' },
  { id: 'bike', icon: '🚲', name: 'Bicycle' }
]

export class SurveillanceGame extends BaseMiniGame {
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.SCREEN_SHAKE,
      CURVEBALL_TYPES.BLUR,
      CURVEBALL_TYPES.BLACKOUT
    ]
  }

  constructor() {
    super('SurveillanceGame')

    this.items = []
    this.targets = []
    this.foundTargets = 0
    this.requiredTargets = 0
    this.wrongClicks = 0
    this.maxWrongClicks = 3
    this.effects = null
    this.currentHint = null
    this.scanLines = []
  }

  init(data) {
    super.init(data)
    this.items = []
    this.targets = []
    this.foundTargets = 0
    this.wrongClicks = 0

    // Difficulty scaling
    const tier = data.difficultyTier?.name || 'Novice'
    const configs = {
      Novice: { targets: 3, decoys: 8, maxWrong: 4 },
      Apprentice: { targets: 4, decoys: 10, maxWrong: 4 },
      Skilled: { targets: 5, decoys: 12, maxWrong: 3 },
      Expert: { targets: 6, decoys: 15, maxWrong: 3 },
      Master: { targets: 7, decoys: 18, maxWrong: 2 }
    }
    this.config = configs[tier] || configs.Novice
    this.requiredTargets = this.config.targets
    this.maxWrongClicks = this.config.maxWrong
  }

  create() {
    super.create()

    this.effects = createMiniGameEffects(this)

    const { width, height } = this.scale

    // Surveillance grid background
    this.createSurveillanceGrid(width, height)

    // Target hint display
    this.createHintPanel(width)

    // Progress display
    this.progressText = this.add.text(20, 130, `Found: 0 / ${this.requiredTargets}`, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.network.primary)
    })

    // Wrong clicks display
    this.wrongText = this.add.text(width - 20, 130, '❌❌❌', {
      fontSize: '20px'
    }).setOrigin(1, 0.5)
    this.updateWrongDisplay()

    // Generate scene
    this.generateScene(width, height)

    // Set first target hint
    this.updateHint()

    // Instructions
    this.add.text(width / 2, height - 40, 'Find and click all targets. Avoid civilians!', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)
  }

  createSurveillanceGrid(width, height) {
    // Surveillance camera frame
    const frameTop = 160
    const frameHeight = height - 220

    // Grid background
    this.add.rectangle(width / 2, frameTop + frameHeight / 2, width - 30, frameHeight, COLORS.bg.panel, 0.3)
      .setStrokeStyle(3, COLORS.network.dim, 0.5)

    // Grid lines
    const gridSize = 40
    for (let x = 20; x < width - 20; x += gridSize) {
      this.add.line(0, 0, x, frameTop, x, frameTop + frameHeight, COLORS.network.dim, 0.08).setOrigin(0)
    }
    for (let y = frameTop; y < frameTop + frameHeight; y += gridSize) {
      this.add.line(0, 0, 20, y, width - 20, y, COLORS.network.dim, 0.08).setOrigin(0)
    }

    // Scanning line effect
    const scanLine = this.add.rectangle(width / 2, frameTop, width - 30, 3, COLORS.network.primary, 0.4)

    this.tweens.add({
      targets: scanLine,
      y: frameTop + frameHeight,
      duration: 3000,
      repeat: -1,
      onRepeat: () => {
        scanLine.y = frameTop
      }
    })

    // Camera indicators
    this.add.text(30, frameTop + 10, '● REC', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '10px',
      color: toHexString(COLORS.status.danger)
    })

    const timestamp = this.add.text(width - 30, frameTop + 10, '', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '10px',
      color: toHexString(COLORS.network.dim)
    }).setOrigin(1, 0)

    // Update timestamp
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        const now = new Date()
        timestamp.setText(now.toLocaleTimeString())
      },
      loop: true
    })

    // Blinking REC indicator
    const rec = this.add.circle(35, frameTop + 15, 4, COLORS.status.danger)
    this.tweens.add({
      targets: rec,
      alpha: { from: 1, to: 0.3 },
      duration: 500,
      yoyo: true,
      repeat: -1
    })

    this.gridBounds = {
      left: 40,
      right: width - 40,
      top: frameTop + 30,
      bottom: frameTop + frameHeight - 30
    }
  }

  createHintPanel(width) {
    // Hint panel at top
    const panelY = 120

    this.add.rectangle(width / 2, panelY - 30, 280, 50, COLORS.bg.panel, 0.95)
      .setStrokeStyle(2, COLORS.status.info, 0.5)

    this.add.text(width / 2, panelY - 45, 'CURRENT TARGET:', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.status.info)
    }).setOrigin(0.5)

    this.hintIcon = this.add.text(width / 2 - 60, panelY - 25, '', {
      fontSize: '24px'
    }).setOrigin(0.5)

    this.hintText = this.add.text(width / 2 + 10, panelY - 25, '', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px',
      color: toHexString(COLORS.text.primary)
    }).setOrigin(0, 0.5)
  }

  generateScene(width, height) {
    // Select targets
    const selectedTargets = Phaser.Math.RND.shuffle([...TARGETS]).slice(0, this.config.targets)

    // Select decoys
    const selectedDecoys = Phaser.Math.RND.shuffle([...DECOYS]).slice(0, this.config.decoys)

    // All items to place
    const allItems = [
      ...selectedTargets.map(t => ({ ...t, isTarget: true })),
      ...selectedDecoys.map(d => ({ ...d, isTarget: false }))
    ]

    Phaser.Math.RND.shuffle(allItems)

    // Place items with minimum spacing
    const positions = []
    const minSpacing = 60

    allItems.forEach(item => {
      let attempts = 0
      let pos = null

      while (attempts < 50) {
        const x = Phaser.Math.Between(this.gridBounds.left, this.gridBounds.right)
        const y = Phaser.Math.Between(this.gridBounds.top, this.gridBounds.bottom)

        // Check spacing
        let valid = true
        for (const p of positions) {
          if (Phaser.Math.Distance.Between(x, y, p.x, p.y) < minSpacing) {
            valid = false
            break
          }
        }

        if (valid) {
          pos = { x, y }
          break
        }
        attempts++
      }

      if (!pos) {
        pos = {
          x: this.gridBounds.left + Math.random() * (this.gridBounds.right - this.gridBounds.left),
          y: this.gridBounds.top + Math.random() * (this.gridBounds.bottom - this.gridBounds.top)
        }
      }

      positions.push(pos)
      this.createItem(pos.x, pos.y, item)
    })

    // Store targets for hint system
    this.targets = this.items.filter(i => i.getData('isTarget'))
  }

  createItem(x, y, data) {
    const container = this.add.container(x, y).setDepth(30)

    // Icon background (subtle glow when hovered)
    const glow = this.add.circle(0, 0, 25, COLORS.network.primary, 0).setDepth(29)

    // Item icon
    const icon = this.add.text(0, 0, data.icon, {
      fontSize: '28px'
    }).setOrigin(0.5)

    // Make interactive
    icon.setInteractive({ useHandCursor: true })

    icon.on('pointerover', () => {
      glow.setAlpha(0.2)
      container.setScale(1.2)
    })

    icon.on('pointerout', () => {
      glow.setAlpha(0)
      container.setScale(1)
    })

    icon.on('pointerdown', () => {
      this.handleClick(container)
    })

    container.add([glow, icon])

    container.setData('isTarget', data.isTarget)
    container.setData('id', data.id)
    container.setData('name', data.name)
    container.setData('hint', data.hint || null)
    container.setData('found', false)

    this.items.push(container)

    return container
  }

  handleClick(item) {
    if (item.getData('found') || this.isGameOver || this.isPaused) return

    if (item.getData('isTarget')) {
      // Correct! Found a target
      this.foundTarget(item)
    } else {
      // Wrong! Clicked a decoy
      this.wrongClick(item)
    }
  }

  foundTarget(item) {
    item.setData('found', true)
    this.foundTargets++

    // Visual feedback
    item.disableInteractive()

    // Success ring
    const ring = this.add.circle(item.x, item.y, 30, COLORS.network.primary, 0)
      .setStrokeStyle(3, COLORS.network.primary, 1)
      .setDepth(35)

    this.tweens.add({
      targets: ring,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 400,
      onComplete: () => ring.destroy()
    })

    // Check mark
    const check = this.add.text(item.x + 15, item.y - 15, '✓', {
      fontSize: '20px',
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setDepth(40)

    // Fade item
    this.tweens.add({
      targets: item,
      alpha: 0.4,
      duration: 300
    })

    // Effects
    this.effects.sparkEffect(item.x, item.y, { color: COLORS.network.primary })
    this.effects.floatingScore(item.x, item.y, '+100', { color: '#00ff41' })
    audioManager.playHit()

    // Add score
    this.addScore(100)

    // Update progress
    this.progressText.setText(`Found: ${this.foundTargets} / ${this.requiredTargets}`)

    // Update hint for next target
    this.updateHint()

    // Check win
    if (this.foundTargets >= this.requiredTargets) {
      this.time.delayedCall(500, () => {
        // Bonus for accuracy
        const accuracy = 1 - (this.wrongClicks / this.maxWrongClicks)
        const bonus = Math.floor(accuracy * 200)
        this.addScore(bonus)
        this.endGame(true)
      })
    }
  }

  wrongClick(item) {
    this.wrongClicks++
    this.updateWrongDisplay()

    // Visual feedback
    const x = item.x
    const y = item.y

    // Error indicator
    const error = this.add.text(x, y - 20, '✗ ' + item.getData('name'), {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px',
      color: toHexString(COLORS.status.danger)
    }).setOrigin(0.5).setDepth(50)

    this.tweens.add({
      targets: error,
      y: y - 50,
      alpha: 0,
      duration: 600,
      onComplete: () => error.destroy()
    })

    // Effects
    this.effects.failureFlash(100)
    audioManager.playMiss()

    // Shake the item
    this.tweens.add({
      targets: item,
      x: x - 5,
      duration: 50,
      yoyo: true,
      repeat: 3
    })

    // Score penalty
    this.addScore(-25)

    // Check fail
    if (this.wrongClicks >= this.maxWrongClicks) {
      this.time.delayedCall(500, () => {
        this.endGame(false)
      })
    }
  }

  updateWrongDisplay() {
    const remaining = this.maxWrongClicks - this.wrongClicks
    const display = '❌'.repeat(remaining) + '⭕'.repeat(this.wrongClicks)
    this.wrongText.setText(display)
  }

  updateHint() {
    // Find next unfound target
    const remaining = this.targets.filter(t => !t.getData('found'))

    if (remaining.length > 0) {
      const next = remaining[0]
      this.hintIcon.setText(next.list[1].text) // The icon text
      this.hintText.setText(next.getData('hint') || next.getData('name'))

      // Pulse effect on hint
      this.tweens.add({
        targets: [this.hintIcon, this.hintText],
        scale: { from: 0.9, to: 1.1 },
        duration: 200,
        yoyo: true
      })
    }
  }

  shutdown() {
    if (this.effects) this.effects.cleanup()
    this.items.forEach(i => i.destroy())
    this.items = []
    this.targets = []
  }
}

export default SurveillanceGame
