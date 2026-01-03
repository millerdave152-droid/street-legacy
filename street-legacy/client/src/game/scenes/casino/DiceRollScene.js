/**
 * DiceRollScene - Animated Dice Roll Casino Game
 *
 * Features:
 * - Procedural dice with dot patterns (1-6)
 * - Rolling animation with blur effect
 * - Multiple game modes: Pick Number, Over/Under
 * - Touch/swipe support
 */

import Phaser from 'phaser'
import { COLORS, getTerminalStyle, toHexString, FONT_SIZES, DEPTH } from '../../ui/NetworkTheme'
import { audioManager } from '../../managers/AudioManager'
import { gameManager } from '../../GameManager'

// Dot positions for each die face (normalized -1 to 1)
const DOT_PATTERNS = {
  1: [[0, 0]],
  2: [[-0.5, -0.5], [0.5, 0.5]],
  3: [[-0.5, -0.5], [0, 0], [0.5, 0.5]],
  4: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]],
  5: [[-0.5, -0.5], [0.5, -0.5], [0, 0], [-0.5, 0.5], [0.5, 0.5]],
  6: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0], [0.5, 0], [-0.5, 0.5], [0.5, 0.5]]
}

// Game modes
const GAME_MODES = {
  PICK_NUMBER: { name: 'Pick Number', payout: 6, description: 'Pick 1-6, 6x payout' },
  OVER_UNDER: { name: 'Over/Under', payout: 2, description: 'High or Low, 2x payout' }
}

export class DiceRollScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DiceRollScene' })

    this.betAmount = 0
    this.returnScene = 'BankScene'
    this.gameMode = 'PICK_NUMBER'
    this.selectedBet = null  // Number 1-6 or 'high'/'low'
    this.isRolling = false
    this.die = null
    this.currentValue = 1
  }

  init(data) {
    this.betAmount = data?.betAmount || 100
    this.returnScene = data?.returnScene || 'BankScene'
    this.gameMode = 'PICK_NUMBER'
    this.selectedBet = null
    this.isRolling = false
    this.currentValue = 1
  }

  create() {
    console.log('[DiceRollScene] create() started')
    const { width, height } = this.cameras.main

    // CRITICAL: Bring this scene to top for rendering priority
    this.scene.bringToTop()

    // Full screen dark background at lowest depth
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a0a, 1)
      .setDepth(0)

    // Also set camera background as fallback
    this.cameras.main.setBackgroundColor(0x0a0a0a)

    // Add scanlines
    this.createScanlines(width, height)

    console.log('[DiceRollScene] UI created, betAmount:', this.betAmount)

    // Header
    this.createHeader(width)

    // Bet display
    this.createBetDisplay(width)

    // Mode toggle
    this.createModeToggle(width)

    // Create the die
    this.die = this.createDie(width / 2, height / 2 - 20, 80)

    // Bet selection (numbers or over/under)
    this.createBetSelection(width, height)

    // Roll button
    this.createRollButton(width, height)

    // Back button
    this.createBackButton()

    // Swipe detection for mobile
    this.setupSwipeInput()
  }

  createScanlines(width, height) {
    for (let y = 0; y < height; y += 4) {
      this.add.rectangle(width / 2, y, width, 1, 0x000000, 0.15)
        .setDepth(DEPTH.SCANLINES)
    }
  }

  createHeader(width) {
    this.add.text(width / 2, 40, 'DICE ROLL', {
      ...getTerminalStyle('display'),
      fontSize: '28px',
      color: toHexString(COLORS.status.danger)
    }).setOrigin(0.5).setDepth(DEPTH.CONTENT_BASE)

    this.payoutText = this.add.text(width / 2, 70, '6x PAYOUT ON CORRECT NUMBER', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5).setDepth(DEPTH.CONTENT_BASE)
  }

  createBetDisplay(width) {
    this.add.text(width / 2, 100, `BET: $${this.betAmount.toLocaleString()}`, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setDepth(DEPTH.CONTENT_BASE)
  }

  createModeToggle(width) {
    const y = 130

    // Mode buttons
    this.pickModeBtn = this.createModeButton(width / 2 - 80, y, 'PICK #', 'PICK_NUMBER')
    this.overUnderBtn = this.createModeButton(width / 2 + 80, y, 'HI/LO', 'OVER_UNDER')

    // Initial selection
    this.updateModeButtons()
  }

  createModeButton(x, y, label, mode) {
    const btn = this.add.text(x, y, label, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5).setDepth(DEPTH.BUTTONS)

    btn.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!this.isRolling && this.gameMode !== mode) {
          this.gameMode = mode
          this.selectedBet = null
          this.updateModeButtons()
          this.updateBetSelection()
          audioManager.playClick()
        }
      })

    btn.setData('mode', mode)
    return btn
  }

  updateModeButtons() {
    // Pick Number mode
    if (this.gameMode === 'PICK_NUMBER') {
      this.pickModeBtn.setColor(toHexString(COLORS.network.primary))
      this.pickModeBtn.setStyle({ fontStyle: 'bold' })
      this.overUnderBtn.setColor(toHexString(COLORS.text.secondary))
      this.overUnderBtn.setStyle({ fontStyle: 'normal' })
      this.payoutText.setText('6x PAYOUT ON CORRECT NUMBER')
    } else {
      this.pickModeBtn.setColor(toHexString(COLORS.text.secondary))
      this.pickModeBtn.setStyle({ fontStyle: 'normal' })
      this.overUnderBtn.setColor(toHexString(COLORS.network.primary))
      this.overUnderBtn.setStyle({ fontStyle: 'bold' })
      this.payoutText.setText('2x PAYOUT ON HIGH (4-6) OR LOW (1-3)')
    }
  }

  createDie(x, y, size) {
    const container = this.add.container(x, y)

    // Die background (white/cream)
    const bg = this.add.rectangle(0, 0, size, size, 0xf5f5dc)
      .setStrokeStyle(4, COLORS.bg.elevated)

    // Rounded corners effect (corner rectangles)
    const cornerSize = 8
    const corners = [
      this.add.rectangle(-size/2 + cornerSize/2, -size/2 + cornerSize/2, cornerSize, cornerSize, 0xf5f5dc),
      this.add.rectangle(size/2 - cornerSize/2, -size/2 + cornerSize/2, cornerSize, cornerSize, 0xf5f5dc),
      this.add.rectangle(-size/2 + cornerSize/2, size/2 - cornerSize/2, cornerSize, cornerSize, 0xf5f5dc),
      this.add.rectangle(size/2 - cornerSize/2, size/2 - cornerSize/2, cornerSize, cornerSize, 0xf5f5dc)
    ]

    container.add([bg, ...corners])

    // Create dot containers for values 1-6
    this.dotContainers = {}
    for (let value = 1; value <= 6; value++) {
      const dotContainer = this.add.container(0, 0)
      DOT_PATTERNS[value].forEach(([dx, dy]) => {
        const dotX = dx * (size * 0.35)
        const dotY = dy * (size * 0.35)
        const dot = this.add.circle(dotX, dotY, 8, COLORS.status.danger)
        dotContainer.add(dot)
      })
      dotContainer.setVisible(value === 1)
      container.add(dotContainer)
      this.dotContainers[value] = dotContainer
    }

    container.setDepth(DEPTH.CARDS)
    container.setData('size', size)
    container.setData('bg', bg)

    // Subtle idle animation
    this.tweens.add({
      targets: container,
      rotation: 0.02,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    })

    return container
  }

  setDieValue(value) {
    // Hide all dot patterns
    for (let i = 1; i <= 6; i++) {
      this.dotContainers[i].setVisible(i === value)
    }
    this.currentValue = value
  }

  createBetSelection(width, height) {
    this.betSelectionContainer = this.add.container(0, 0)
    this.betButtons = []

    this.updateBetSelection()
  }

  updateBetSelection() {
    // Clear existing buttons
    this.betSelectionContainer.removeAll(true)
    this.betButtons = []

    const { width, height } = this.cameras.main
    const y = height / 2 + 90

    if (this.gameMode === 'PICK_NUMBER') {
      // Number buttons 1-6
      const buttonWidth = 45
      const spacing = 55
      const startX = width / 2 - (spacing * 2.5)

      for (let num = 1; num <= 6; num++) {
        const btn = this.createBetButton(startX + (num - 1) * spacing, y, num.toString(), num)
        this.betButtons.push(btn)
        this.betSelectionContainer.add(btn)
      }
    } else {
      // High/Low buttons
      const lowBtn = this.createBetButton(width / 2 - 60, y, 'LOW\n1-3', 'low')
      const highBtn = this.createBetButton(width / 2 + 60, y, 'HIGH\n4-6', 'high')
      this.betButtons.push(lowBtn, highBtn)
      this.betSelectionContainer.add([lowBtn, highBtn])
    }

    // Instruction text
    const instruction = this.add.text(width / 2, y - 35, 'PLACE YOUR BET', {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5).setDepth(DEPTH.CONTENT_BASE)
    this.betSelectionContainer.add(instruction)
    this.instructionText = instruction
  }

  createBetButton(x, y, label, value) {
    const isNumber = typeof value === 'number'
    const w = isNumber ? 45 : 80
    const h = isNumber ? 45 : 55

    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, w, h, COLORS.bg.elevated)
      .setStrokeStyle(2, COLORS.network.dim)

    const text = this.add.text(0, 0, label, {
      ...getTerminalStyle(isNumber ? 'lg' : 'sm'),
      color: toHexString(COLORS.text.primary),
      align: 'center'
    }).setOrigin(0.5)

    container.add([bg, text])
    container.setSize(w, h)
    container.setDepth(DEPTH.BUTTONS)

    container.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        if (this.selectedBet !== value && !this.isRolling) {
          bg.setStrokeStyle(2, COLORS.network.primary)
        }
      })
      .on('pointerout', () => {
        if (this.selectedBet !== value && !this.isRolling) {
          bg.setStrokeStyle(2, COLORS.network.dim)
        }
      })
      .on('pointerdown', () => {
        if (!this.isRolling) {
          this.selectBet(value)
          audioManager.playClick()
        }
      })

    container.setData('bg', bg)
    container.setData('text', text)
    container.setData('value', value)

    return container
  }

  selectBet(value) {
    this.selectedBet = value

    // Update all bet buttons
    this.betButtons.forEach(btn => {
      const bg = btn.getData('bg')
      const text = btn.getData('text')
      const btnValue = btn.getData('value')

      if (btnValue === value) {
        bg.setFillStyle(COLORS.network.dark)
        bg.setStrokeStyle(3, COLORS.network.primary)
        text.setColor(toHexString(COLORS.network.primary))
      } else {
        bg.setFillStyle(COLORS.bg.elevated)
        bg.setStrokeStyle(2, COLORS.network.dim)
        text.setColor(toHexString(COLORS.text.primary))
      }
    })

    // Enable roll button
    this.updateRollButton(true)
  }

  createRollButton(width, height) {
    const y = height / 2 + 170
    const w = 180
    const h = 60

    this.rollContainer = this.add.container(width / 2, y)

    this.rollBg = this.add.rectangle(0, 0, w, h, COLORS.bg.panel)
      .setStrokeStyle(2, COLORS.text.muted)

    this.rollText = this.add.text(0, 0, 'ROLL!', {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    this.rollContainer.add([this.rollBg, this.rollText])
    this.rollContainer.setSize(w, h)
    this.rollContainer.setDepth(DEPTH.BUTTONS)

    this.rollContainer.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        if (this.selectedBet && !this.isRolling) {
          this.rollBg.setStrokeStyle(3, COLORS.status.danger)
          this.rollContainer.setScale(1.05)
        }
      })
      .on('pointerout', () => {
        if (this.selectedBet && !this.isRolling) {
          this.rollBg.setStrokeStyle(2, COLORS.status.danger)
          this.rollContainer.setScale(1)
        }
      })
      .on('pointerdown', () => {
        if (this.selectedBet && !this.isRolling) {
          this.executeRoll()
        }
      })
  }

  updateRollButton(enabled) {
    if (enabled) {
      this.rollBg.setFillStyle(0x660022)
      this.rollBg.setStrokeStyle(2, COLORS.status.danger)
      this.rollText.setColor(toHexString(COLORS.text.primary))
    } else {
      this.rollBg.setFillStyle(COLORS.bg.panel)
      this.rollBg.setStrokeStyle(2, COLORS.text.muted)
      this.rollText.setColor(toHexString(COLORS.text.muted))
    }
  }

  createBackButton() {
    const btn = this.add.text(20, 30, '< BACK', {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.secondary)
    }).setDepth(DEPTH.BUTTONS)

    btn.setInteractive({ useHandCursor: true })
      .on('pointerover', () => btn.setColor(toHexString(COLORS.network.primary)))
      .on('pointerout', () => btn.setColor(toHexString(COLORS.text.secondary)))
      .on('pointerdown', () => {
        if (!this.isRolling) {
          this.returnToBank(false, 0, true)
        }
      })
  }

  setupSwipeInput() {
    let startY = 0

    this.input.on('pointerdown', (pointer) => {
      startY = pointer.y
    })

    this.input.on('pointerup', (pointer) => {
      const dy = startY - pointer.y
      // Swipe up to roll
      if (dy > 60 && this.selectedBet && !this.isRolling) {
        this.executeRoll()
      }
    })
  }

  executeRoll() {
    if (this.isRolling || !this.selectedBet) return

    this.isRolling = true
    audioManager.playClick()

    // Stop idle animation
    this.tweens.killTweensOf(this.die)
    this.die.setRotation(0)

    // Disable buttons
    this.updateRollButton(false)
    this.betButtons.forEach(btn => btn.disableInteractive())

    // Update instruction text
    this.instructionText.setText('ROLLING...')
    this.instructionText.setColor(toHexString(COLORS.status.danger))

    // Determine result (1-6)
    const result = Phaser.Math.Between(1, 6)
    const won = this.checkWin(result)
    const payout = won ? this.betAmount * GAME_MODES[this.gameMode].payout : 0

    // Start roll animation
    this.animateRoll(result, () => {
      this.showResult(won, result, payout)
    })
  }

  checkWin(result) {
    if (this.gameMode === 'PICK_NUMBER') {
      return result === this.selectedBet
    } else {
      if (this.selectedBet === 'low') {
        return result <= 3
      } else {
        return result >= 4
      }
    }
  }

  animateRoll(finalValue, onComplete) {
    const { height } = this.cameras.main
    const startY = this.die.y
    const jumpHeight = 80

    // Shake anticipation
    this.tweens.add({
      targets: this.die,
      x: this.die.x + 5,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        // Jump up
        this.tweens.add({
          targets: this.die,
          y: startY - jumpHeight,
          duration: 200,
          ease: 'Quad.out'
        })
      }
    })

    // Rapid face cycling
    let cycleCount = 0
    const maxCycles = 15
    let cycleDelay = 50

    const cycle = () => {
      // Show random face
      const randomValue = Phaser.Math.Between(1, 6)
      this.setDieValue(randomValue)

      // Rotate die slightly
      this.tweens.add({
        targets: this.die,
        rotation: this.die.rotation + (Math.random() - 0.5) * 0.5,
        duration: cycleDelay,
        ease: 'Linear'
      })

      audioManager.playClick()
      cycleCount++

      if (cycleCount < maxCycles) {
        // Slow down gradually
        cycleDelay = 50 + cycleCount * 15
        this.time.delayedCall(cycleDelay, cycle)
      } else {
        // Set final value
        this.setDieValue(finalValue)

        // Fall and bounce
        this.tweens.add({
          targets: this.die,
          y: startY,
          rotation: 0,
          duration: 400,
          ease: 'Bounce.out',
          onComplete: () => {
            // Highlight die
            this.tweens.add({
              targets: this.die,
              scaleX: 1.15,
              scaleY: 1.15,
              duration: 150,
              yoyo: true,
              ease: 'Back.out',
              onComplete: () => {
                onComplete()
              }
            })
          }
        })
      }
    }

    // Start cycling after shake
    this.time.delayedCall(300, cycle)
  }

  showResult(won, result, payout) {
    const { width, height } = this.cameras.main

    // Update instruction text
    const betLabel = this.gameMode === 'PICK_NUMBER'
      ? this.selectedBet.toString()
      : (this.selectedBet === 'high' ? 'HIGH' : 'LOW')

    if (won) {
      this.instructionText.setText(`ROLLED ${result}! YOU WIN!`)
      this.instructionText.setColor(toHexString(COLORS.network.primary))

      // Camera flash
      this.cameras.main.flash(300, 0, 255, 65, true)

      // Win particles
      this.createWinParticles()

      audioManager.playMiniGameWin?.() || audioManager.playClick()
    } else {
      this.instructionText.setText(`ROLLED ${result}. YOU LOSE.`)
      this.instructionText.setColor(toHexString(COLORS.status.danger))

      // Camera shake
      this.cameras.main.shake(300, 0.02)

      audioManager.playMiniGameLose?.() || audioManager.playClick()
    }

    // Show result overlay after delay
    this.time.delayedCall(1000, () => {
      this.showResultOverlay(won, payout, result)
    })
  }

  createWinParticles() {
    const { width, height } = this.cameras.main
    const centerX = width / 2
    const centerY = height / 2 - 20

    // Dice burst
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2
      const speed = Phaser.Math.Between(60, 120)
      const size = Phaser.Math.Between(6, 12)

      const particle = this.add.rectangle(centerX, centerY, size, size, COLORS.status.danger, 0.9)
        .setDepth(DEPTH.NOTIFICATIONS)

      this.tweens.add({
        targets: particle,
        x: centerX + Math.cos(angle) * speed,
        y: centerY + Math.sin(angle) * speed,
        rotation: Math.PI * 2,
        alpha: 0,
        scale: 0.3,
        duration: 800,
        ease: 'Quad.out',
        onComplete: () => particle.destroy()
      })
    }

    // Dollar signs
    for (let i = 0; i < 6; i++) {
      const x = Phaser.Math.Between(centerX - 80, centerX + 80)
      const particle = this.add.text(x, centerY, '$', {
        fontSize: '20px',
        color: toHexString(COLORS.cred.gold)
      }).setOrigin(0.5).setDepth(DEPTH.NOTIFICATIONS)

      this.tweens.add({
        targets: particle,
        y: centerY - 80,
        alpha: 0,
        duration: 900,
        delay: i * 60,
        ease: 'Quad.out',
        onComplete: () => particle.destroy()
      })
    }
  }

  showResultOverlay(won, payout, result) {
    const { width, height } = this.cameras.main

    // Overlay background
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setDepth(DEPTH.MODAL_BACKDROP)
      .setInteractive()

    // Result panel
    const panelWidth = 280
    const panelHeight = 220
    const panel = this.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, COLORS.bg.panel)
      .setStrokeStyle(3, won ? COLORS.network.primary : COLORS.status.danger)
      .setDepth(DEPTH.MODAL)

    // Result icon
    const icon = this.add.text(width / 2, height / 2 - 70, won ? '🎲💰' : '🎲', {
      fontSize: '40px'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    // Result title
    const title = this.add.text(width / 2, height / 2 - 20, won ? 'YOU WIN!' : 'YOU LOSE', {
      ...getTerminalStyle('xl'),
      fontSize: '24px',
      color: toHexString(won ? COLORS.network.primary : COLORS.status.danger)
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    // Rolled value
    this.add.text(width / 2, height / 2 + 10, `Rolled: ${result}`, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    // Payout text
    const payoutText = this.add.text(width / 2, height / 2 + 40,
      won ? `+$${payout.toLocaleString()}` : `-$${this.betAmount.toLocaleString()}`, {
      ...getTerminalStyle('lg'),
      color: toHexString(won ? COLORS.cred.gold : COLORS.status.danger)
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    // Continue button
    const continueBtn = this.add.container(width / 2, height / 2 + 85)
    const continueBg = this.add.rectangle(0, 0, 150, 45, COLORS.bg.elevated)
      .setStrokeStyle(2, COLORS.network.dim)
    const continueText = this.add.text(0, 0, 'CONTINUE', {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.primary)
    }).setOrigin(0.5)

    continueBtn.add([continueBg, continueText])
    continueBtn.setSize(150, 45)
    continueBtn.setDepth(DEPTH.MODAL_BUTTONS)

    continueBtn.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        continueBg.setStrokeStyle(2, COLORS.network.primary)
        continueBtn.setScale(1.05)
      })
      .on('pointerout', () => {
        continueBg.setStrokeStyle(2, COLORS.network.dim)
        continueBtn.setScale(1)
      })
      .on('pointerdown', () => {
        audioManager.playClick()
        this.returnToBank(won, payout, false)
      })

    // Animate in
    panel.setScale(0.8)
    panel.setAlpha(0)
    this.tweens.add({
      targets: [panel, icon, title, payoutText, continueBtn],
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.out'
    })
  }

  returnToBank(won, payout, cancelled) {
    console.log('[DiceRollScene] Returning to bank, won:', won, 'payout:', payout)

    this.tweens.killAll()

    // Build result data to pass to BankScene
    const resultData = {
      casinoResult: {
        won,
        payout,
        gameType: 'dice',
        cancelled,
        betAmount: this.betAmount
      }
    }

    // Start BankScene with result data
    this.scene.start(this.returnScene, resultData)
  }
}

export default DiceRollScene
