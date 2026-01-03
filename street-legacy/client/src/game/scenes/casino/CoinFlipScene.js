/**
 * CoinFlipScene - Animated Coin Flip Casino Game
 *
 * Features:
 * - 3D-style coin flip animation using scaleX tweens
 * - Procedural coin rendering (no sprites)
 * - Pick heads or tails before flipping
 * - 2x payout on win
 * - Touch/click support
 */

import Phaser from 'phaser'
import { COLORS, getTerminalStyle, toHexString, FONT_SIZES, DEPTH } from '../../ui/NetworkTheme'
import { audioManager } from '../../managers/AudioManager'
import { gameManager } from '../../GameManager'

export class CoinFlipScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CoinFlipScene' })

    this.betAmount = 0
    this.returnScene = 'BankScene'
    this.selectedSide = null  // 'heads' or 'tails'
    this.isFlipping = false
    this.coin = null
    this.currentSide = 'heads'
  }

  init(data) {
    this.betAmount = data?.betAmount || 100
    this.returnScene = data?.returnScene || 'BankScene'
    this.selectedSide = null
    this.isFlipping = false
    this.currentSide = 'heads'
  }

  create() {
    console.log('[CoinFlipScene] create() started')
    const { width, height } = this.cameras.main

    // CRITICAL: Bring this scene to top for rendering priority
    this.scene.bringToTop()

    // Full screen dark background at lowest depth
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a0a, 1)
      .setDepth(0)

    // Also set camera background as fallback
    this.cameras.main.setBackgroundColor(0x0a0a0a)

    // Add scanlines for CRT effect
    this.createScanlines(width, height)

    console.log('[CoinFlipScene] UI created, betAmount:', this.betAmount)

    // Header
    this.createHeader(width)

    // Bet display
    this.createBetDisplay(width)

    // Create the coin
    this.coin = this.createCoin(width / 2, height / 2 - 30)

    // Side selection buttons
    this.createSideSelection(width, height)

    // Flip button
    this.createFlipButton(width, height)

    // Back button
    this.createBackButton()

    // Result overlay (hidden initially)
    this.resultOverlay = null
  }

  createScanlines(width, height) {
    for (let y = 0; y < height; y += 4) {
      this.add.rectangle(width / 2, y, width, 1, 0x000000, 0.15)
        .setDepth(DEPTH.SCANLINES)
    }
  }

  createHeader(width) {
    // Title
    this.add.text(width / 2, 40, 'COIN FLIP', {
      ...getTerminalStyle('display'),
      fontSize: '28px',
      color: toHexString(COLORS.cred.gold)
    }).setOrigin(0.5).setDepth(DEPTH.CONTENT_BASE)

    // Subtitle
    this.add.text(width / 2, 70, '2x PAYOUT ON WIN', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5).setDepth(DEPTH.CONTENT_BASE)
  }

  createBetDisplay(width) {
    // Bet amount display
    this.add.text(width / 2, 100, `BET: $${this.betAmount.toLocaleString()}`, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setDepth(DEPTH.CONTENT_BASE)
  }

  createCoin(x, y) {
    const container = this.add.container(x, y)
    const radius = 70

    // Coin edge (3D depth effect) - slightly offset down
    const edge = this.add.circle(0, 5, radius, COLORS.cred.bronze)
    edge.setStrokeStyle(3, 0x8b6914)

    // Coin face (front)
    const face = this.add.circle(0, 0, radius, COLORS.cred.gold)
    face.setStrokeStyle(4, COLORS.cred.bronze)

    // Inner ring for detail
    const innerRing = this.add.circle(0, 0, radius - 10, COLORS.cred.gold)
    innerRing.setStrokeStyle(2, 0xb8860b)

    // Heads text
    const headsText = this.add.text(0, 0, 'H', {
      fontFamily: '"Georgia", serif',
      fontSize: '60px',
      color: toHexString(COLORS.cred.bronze),
      fontStyle: 'bold'
    }).setOrigin(0.5)

    // Tails text (hidden initially)
    const tailsText = this.add.text(0, 0, 'T', {
      fontFamily: '"Georgia", serif',
      fontSize: '60px',
      color: toHexString(COLORS.cred.bronze),
      fontStyle: 'bold'
    }).setOrigin(0.5).setVisible(false)

    container.add([edge, face, innerRing, headsText, tailsText])
    container.setDepth(DEPTH.CARDS)

    // Store references
    container.setData('headsText', headsText)
    container.setData('tailsText', tailsText)
    container.setData('face', face)
    container.setData('edge', edge)

    // Add subtle idle animation
    this.tweens.add({
      targets: container,
      y: y - 5,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    })

    return container
  }

  createSideSelection(width, height) {
    const buttonY = height / 2 + 100
    const buttonWidth = 120
    const buttonHeight = 50

    // Heads button
    this.headsBtn = this.createSelectionButton(
      width / 2 - 70, buttonY, buttonWidth, buttonHeight, 'HEADS', 'heads'
    )

    // Tails button
    this.tailsBtn = this.createSelectionButton(
      width / 2 + 70, buttonY, buttonWidth, buttonHeight, 'TAILS', 'tails'
    )

    // Instruction text
    this.instructionText = this.add.text(width / 2, buttonY - 40, 'PICK YOUR SIDE', {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5).setDepth(DEPTH.CONTENT_BASE)
  }

  createSelectionButton(x, y, w, h, label, side) {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, w, h, COLORS.bg.elevated)
      .setStrokeStyle(2, COLORS.network.dim)

    const text = this.add.text(0, 0, label, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.text.primary)
    }).setOrigin(0.5)

    container.add([bg, text])
    container.setSize(w, h)
    container.setDepth(DEPTH.BUTTONS)

    container.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        if (this.selectedSide !== side) {
          bg.setStrokeStyle(2, COLORS.network.primary)
        }
      })
      .on('pointerout', () => {
        if (this.selectedSide !== side) {
          bg.setStrokeStyle(2, COLORS.network.dim)
        }
      })
      .on('pointerdown', () => {
        this.selectSide(side)
        audioManager.playClick()
      })

    container.setData('bg', bg)
    container.setData('text', text)

    return container
  }

  selectSide(side) {
    this.selectedSide = side

    // Update heads button
    const headsBg = this.headsBtn.getData('bg')
    const headsText = this.headsBtn.getData('text')
    if (side === 'heads') {
      headsBg.setFillStyle(COLORS.network.dark)
      headsBg.setStrokeStyle(3, COLORS.network.primary)
      headsText.setColor(toHexString(COLORS.network.primary))
    } else {
      headsBg.setFillStyle(COLORS.bg.elevated)
      headsBg.setStrokeStyle(2, COLORS.network.dim)
      headsText.setColor(toHexString(COLORS.text.primary))
    }

    // Update tails button
    const tailsBg = this.tailsBtn.getData('bg')
    const tailsText = this.tailsBtn.getData('text')
    if (side === 'tails') {
      tailsBg.setFillStyle(COLORS.network.dark)
      tailsBg.setStrokeStyle(3, COLORS.network.primary)
      tailsText.setColor(toHexString(COLORS.network.primary))
    } else {
      tailsBg.setFillStyle(COLORS.bg.elevated)
      tailsBg.setStrokeStyle(2, COLORS.network.dim)
      tailsText.setColor(toHexString(COLORS.text.primary))
    }

    // Enable flip button
    this.updateFlipButton(true)
  }

  createFlipButton(width, height) {
    const y = height / 2 + 180
    const w = 180
    const h = 60

    this.flipContainer = this.add.container(width / 2, y)

    this.flipBg = this.add.rectangle(0, 0, w, h, COLORS.bg.panel)
      .setStrokeStyle(2, COLORS.text.muted)

    this.flipText = this.add.text(0, 0, 'FLIP!', {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    this.flipContainer.add([this.flipBg, this.flipText])
    this.flipContainer.setSize(w, h)
    this.flipContainer.setDepth(DEPTH.BUTTONS)

    this.flipContainer.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        if (this.selectedSide && !this.isFlipping) {
          this.flipBg.setStrokeStyle(3, COLORS.cred.gold)
          this.flipContainer.setScale(1.05)
        }
      })
      .on('pointerout', () => {
        if (this.selectedSide && !this.isFlipping) {
          this.flipBg.setStrokeStyle(2, COLORS.cred.gold)
          this.flipContainer.setScale(1)
        }
      })
      .on('pointerdown', () => {
        if (this.selectedSide && !this.isFlipping) {
          this.executeFlip()
        }
      })
  }

  updateFlipButton(enabled) {
    if (enabled) {
      this.flipBg.setFillStyle(COLORS.cred.bronze)
      this.flipBg.setStrokeStyle(2, COLORS.cred.gold)
      this.flipText.setColor(toHexString(COLORS.text.primary))
    } else {
      this.flipBg.setFillStyle(COLORS.bg.panel)
      this.flipBg.setStrokeStyle(2, COLORS.text.muted)
      this.flipText.setColor(toHexString(COLORS.text.muted))
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
        if (!this.isFlipping) {
          this.returnToBank(false, 0, true)  // Cancelled - refund bet
        }
      })
  }

  executeFlip() {
    if (this.isFlipping || !this.selectedSide) return

    this.isFlipping = true
    audioManager.playClick()

    // Stop idle animation
    this.tweens.killTweensOf(this.coin)

    // Disable buttons
    this.updateFlipButton(false)
    this.headsBtn.disableInteractive()
    this.tailsBtn.disableInteractive()

    // Update instruction text
    this.instructionText.setText('FLIPPING...')
    this.instructionText.setColor(toHexString(COLORS.cred.gold))

    // Determine result (50/50)
    const result = Math.random() < 0.5 ? 'heads' : 'tails'
    const won = result === this.selectedSide

    // Start flip animation
    this.animateFlip(result, () => {
      this.showResult(won, result)
    })
  }

  animateFlip(finalResult, onComplete) {
    const { height } = this.cameras.main
    const startY = this.coin.y
    const peakY = startY - 120  // How high the coin goes
    const flipCount = Phaser.Math.Between(4, 6)  // Random number of flips

    let currentFlip = 0
    const totalFlips = flipCount * 2  // Each full rotation = 2 half-flips

    // Calculate which side should show for final result
    const finalSideIsHeads = finalResult === 'heads'

    // Vertical arc animation
    this.tweens.add({
      targets: this.coin,
      y: peakY,
      duration: 400,
      ease: 'Sine.out',
      onComplete: () => {
        // Fall back down
        this.tweens.add({
          targets: this.coin,
          y: startY + 20,  // Slight overshoot for bounce
          duration: 600,
          ease: 'Bounce.out',
          onComplete: () => {
            // Settle to final position
            this.tweens.add({
              targets: this.coin,
              y: startY,
              duration: 150,
              ease: 'Sine.out'
            })
          }
        })
      }
    })

    // Flip animation (rotation simulation via scaleX)
    const doFlip = () => {
      // Play flip sound
      audioManager.playClick()

      // Shrink (coin turning edge-on)
      this.tweens.add({
        targets: this.coin,
        scaleX: 0.1,
        duration: 80,
        ease: 'Sine.in',
        onComplete: () => {
          currentFlip++

          // Swap visible side
          const showHeads = currentFlip % 2 === 0
          this.swapCoinSide(showHeads)

          // Expand (coin facing viewer)
          this.tweens.add({
            targets: this.coin,
            scaleX: 1,
            duration: 80,
            ease: 'Sine.out',
            onComplete: () => {
              if (currentFlip < totalFlips) {
                // Continue flipping with slight slowdown
                const delay = Math.min(50 + currentFlip * 10, 150)
                this.time.delayedCall(delay, doFlip)
              } else {
                // Ensure final side is correct
                this.swapCoinSide(finalSideIsHeads)

                // Final scale animation for impact
                this.tweens.add({
                  targets: this.coin,
                  scaleX: 1.1,
                  scaleY: 1.1,
                  duration: 100,
                  yoyo: true,
                  ease: 'Back.out',
                  onComplete: () => {
                    onComplete()
                  }
                })
              }
            }
          })
        }
      })
    }

    // Start flipping after slight delay
    this.time.delayedCall(100, doFlip)
  }

  swapCoinSide(showHeads) {
    const headsText = this.coin.getData('headsText')
    const tailsText = this.coin.getData('tailsText')

    if (showHeads) {
      headsText.setVisible(true)
      tailsText.setVisible(false)
      this.currentSide = 'heads'
    } else {
      headsText.setVisible(false)
      tailsText.setVisible(true)
      this.currentSide = 'tails'
    }
  }

  showResult(won, result) {
    const { width, height } = this.cameras.main
    const payout = won ? this.betAmount * 2 : 0

    // Update instruction text
    if (won) {
      this.instructionText.setText(`${result.toUpperCase()}! YOU WIN!`)
      this.instructionText.setColor(toHexString(COLORS.network.primary))

      // Camera flash green
      this.cameras.main.flash(300, 0, 255, 65, true)

      // Win particles
      this.createWinParticles()

      // Play win sound
      audioManager.playMiniGameWin?.() || audioManager.playClick()
    } else {
      this.instructionText.setText(`${result.toUpperCase()}. YOU LOSE.`)
      this.instructionText.setColor(toHexString(COLORS.status.danger))

      // Camera shake
      this.cameras.main.shake(300, 0.02)

      // Play lose sound
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
    const centerY = height / 2 - 30

    // Coin burst particles
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2
      const speed = Phaser.Math.Between(80, 150)
      const size = Phaser.Math.Between(8, 16)

      const particle = this.add.circle(centerX, centerY, size, COLORS.cred.gold, 0.9)
        .setDepth(DEPTH.NOTIFICATIONS)

      this.tweens.add({
        targets: particle,
        x: centerX + Math.cos(angle) * speed,
        y: centerY + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.3,
        duration: 800,
        ease: 'Quad.out',
        onComplete: () => particle.destroy()
      })
    }

    // Dollar sign particles
    for (let i = 0; i < 8; i++) {
      const x = Phaser.Math.Between(centerX - 100, centerX + 100)
      const particle = this.add.text(x, centerY, '$', {
        fontSize: '24px',
        color: toHexString(COLORS.cred.gold)
      }).setOrigin(0.5).setDepth(DEPTH.NOTIFICATIONS)

      this.tweens.add({
        targets: particle,
        y: centerY - 100,
        alpha: 0,
        duration: 1000,
        delay: i * 50,
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
      .setInteractive()  // Block clicks through

    // Result panel
    const panelWidth = 280
    const panelHeight = 220
    const panel = this.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, COLORS.bg.panel)
      .setStrokeStyle(3, won ? COLORS.network.primary : COLORS.status.danger)
      .setDepth(DEPTH.MODAL)

    // Result icon
    const icon = this.add.text(width / 2, height / 2 - 70, won ? '💰' : '💸', {
      fontSize: '48px'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    // Result title
    const title = this.add.text(width / 2, height / 2 - 20, won ? 'YOU WIN!' : 'YOU LOSE', {
      ...getTerminalStyle('xl'),
      fontSize: '24px',
      color: toHexString(won ? COLORS.network.primary : COLORS.status.danger)
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    // Payout text
    const payoutText = this.add.text(width / 2, height / 2 + 20,
      won ? `+$${payout.toLocaleString()}` : `-$${this.betAmount.toLocaleString()}`, {
      ...getTerminalStyle('lg'),
      color: toHexString(won ? COLORS.cred.gold : COLORS.status.danger)
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_CONTENT)

    // Continue button
    const continueBtn = this.add.container(width / 2, height / 2 + 80)
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

    // Animate panel in
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
    console.log('[CoinFlipScene] Returning to bank, won:', won, 'payout:', payout)

    // Stop all tweens
    this.tweens.killAll()

    // Build result data to pass to BankScene
    const resultData = {
      casinoResult: {
        won,
        payout,
        gameType: 'coinflip',
        cancelled,
        betAmount: this.betAmount
      }
    }

    // Start BankScene with result data
    this.scene.start(this.returnScene, resultData)
  }
}

export default CoinFlipScene
