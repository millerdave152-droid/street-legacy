// Memory Mini-Game
// Match pairs of cards to crack security codes

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { audioManager } from '../../managers/AudioManager'
import { COLORS, SYMBOLS, getTerminalStyle, toHexString, BORDERS } from '../../ui/NetworkTheme'

export class MemoryGame extends BaseMiniGame {
  // Memory game supports limited curveballs (turn-based, so no control reversal/input lag)
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.VISUAL_BLUR,
      CURVEBALL_TYPES.DISTRACTION,
      CURVEBALL_TYPES.BRIEF_BLACKOUT
    ]
  }

  constructor() {
    super('MemoryGame')

    this.cards = []
    this.flippedCards = []
    this.matchedPairs = 0
    this.totalPairs = 6
    this.canFlip = true
    this.moves = 0
    this.gridCols = 4
    this.gridRows = 3

    // Card symbols for matching
    this.symbols = ['🔐', '💰', '💎', '🔑', '📱', '💳', '🎰', '🃏']
  }

  create() {
    super.create()

    // Difficulty scaling
    if (this.gameData.difficulty >= 4) {
      this.gridCols = 5
      this.gridRows = 4
      this.totalPairs = 10
    } else if (this.gameData.difficulty >= 2) {
      this.gridCols = 4
      this.gridRows = 4
      this.totalPairs = 8
    } else {
      this.gridCols = 4
      this.gridRows = 3
      this.totalPairs = 6
    }

    // Create card grid
    this.createCards()

    // Moves counter with Network styling
    this.movesText = this.add.text(this.gameWidth / 2, this.gameHeight - 60,
      `${SYMBOLS.system} MOVES: ${this.moves}`, {
        ...getTerminalStyle('xl'),
        color: toHexString(COLORS.network.primary)
      }).setOrigin(0.5)

    // Instructions with Network styling
    this.add.text(this.gameWidth / 2, this.gameHeight - 25,
      `${SYMBOLS.system} Match all pairs to crack the code`, {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)

    // Brief peek at cards then hide
    this.time.delayedCall(1500, () => {
      this.hideAllCards()
    })
  }

  createCards() {
    // Calculate card dimensions
    const cardWidth = 70
    const cardHeight = 90
    const padding = 10
    const gridWidth = this.gridCols * (cardWidth + padding) - padding
    const gridHeight = this.gridRows * (cardHeight + padding) - padding
    const startX = (this.gameWidth - gridWidth) / 2 + cardWidth / 2
    const startY = 180

    // Create pairs of symbols
    const selectedSymbols = Phaser.Utils.Array.Shuffle([...this.symbols]).slice(0, this.totalPairs)
    const cardSymbols = Phaser.Utils.Array.Shuffle([...selectedSymbols, ...selectedSymbols])

    // Create card objects
    let symbolIndex = 0
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < this.gridCols; col++) {
        const x = startX + col * (cardWidth + padding)
        const y = startY + row * (cardHeight + padding)

        const card = this.createCard(x, y, cardWidth, cardHeight, cardSymbols[symbolIndex])
        this.cards.push(card)
        symbolIndex++
      }
    }
  }

  createCard(x, y, width, height, symbol) {
    const container = this.add.container(x, y)

    // Card back (hidden state) - Network themed
    const back = this.add.rectangle(0, 0, width, height, COLORS.bg.panel)
      .setStrokeStyle(BORDERS.medium, COLORS.network.dim)
    const backPattern = this.add.text(0, 0, SYMBOLS.encrypted, {
      ...getTerminalStyle('display'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5)

    // Card front (revealed state) - Network themed
    const front = this.add.rectangle(0, 0, width, height, COLORS.bg.elevated)
      .setStrokeStyle(BORDERS.medium, COLORS.network.primary)
      .setVisible(false)
    const symbolText = this.add.text(0, 0, symbol, {
      fontSize: '40px'
    }).setOrigin(0.5).setVisible(false)

    container.add([back, backPattern, front, symbolText])

    // Store references
    container.setData('symbol', symbol)
    container.setData('isFlipped', true) // Start flipped for peek
    container.setData('isMatched', false)
    container.setData('back', back)
    container.setData('backPattern', backPattern)
    container.setData('front', front)
    container.setData('symbolText', symbolText)

    // Initially show front (peek)
    front.setVisible(true)
    symbolText.setVisible(true)
    back.setVisible(false)
    backPattern.setVisible(false)

    // Make interactive with Network hover effect
    container.setSize(width, height)
    container.setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.flipCard(container))
      .on('pointerover', () => {
        if (!container.getData('isFlipped') && !container.getData('isMatched')) {
          back.setFillStyle(COLORS.network.dark)
          back.setStrokeStyle(BORDERS.medium, COLORS.network.primary)
        }
      })
      .on('pointerout', () => {
        if (!container.getData('isFlipped') && !container.getData('isMatched')) {
          back.setFillStyle(COLORS.bg.panel)
          back.setStrokeStyle(BORDERS.medium, COLORS.network.dim)
        }
      })

    return container
  }

  hideAllCards() {
    this.cards.forEach(card => {
      if (!card.getData('isMatched')) {
        this.hideCard(card)
      }
    })
  }

  hideCard(card) {
    card.setData('isFlipped', false)
    card.getData('front').setVisible(false)
    card.getData('symbolText').setVisible(false)
    card.getData('back').setVisible(true)
    card.getData('backPattern').setVisible(true)
  }

  showCard(card) {
    card.setData('isFlipped', true)
    card.getData('front').setVisible(true)
    card.getData('symbolText').setVisible(true)
    card.getData('back').setVisible(false)
    card.getData('backPattern').setVisible(false)
  }

  flipCard(card) {
    if (this.isPaused || this.isGameOver) return
    if (!this.canFlip) return
    if (card.getData('isFlipped')) return
    if (card.getData('isMatched')) return

    // Flip animation
    this.tweens.add({
      targets: card,
      scaleX: 0,
      duration: 100,
      ease: 'Power2',
      onComplete: () => {
        this.showCard(card)
        this.tweens.add({
          targets: card,
          scaleX: 1,
          duration: 100,
          ease: 'Power2'
        })
      }
    })

    audioManager.playClick()
    this.flippedCards.push(card)

    // Check for match when 2 cards flipped
    if (this.flippedCards.length === 2) {
      this.moves++
      this.movesText.setText(`${SYMBOLS.system} MOVES: ${this.moves}`)
      this.canFlip = false
      this.checkMatch()
    }
  }

  checkMatch() {
    const [card1, card2] = this.flippedCards
    const symbol1 = card1.getData('symbol')
    const symbol2 = card2.getData('symbol')

    if (symbol1 === symbol2) {
      // Match found!
      this.time.delayedCall(300, () => {
        this.handleMatch(card1, card2)
      })
    } else {
      // No match
      this.time.delayedCall(800, () => {
        this.handleNoMatch(card1, card2)
      })
    }
  }

  handleMatch(card1, card2) {
    card1.setData('isMatched', true)
    card2.setData('isMatched', true)

    // Match visual effect - Network glow green
    const front1 = card1.getData('front')
    const front2 = card2.getData('front')
    front1.setStrokeStyle(3, COLORS.network.glow)
    front2.setStrokeStyle(3, COLORS.network.glow)

    // Pulse animation
    this.tweens.add({
      targets: [card1, card2],
      scale: { from: 1, to: 1.1 },
      duration: 150,
      yoyo: true
    })

    // Flash with Network green
    this.cameras.main.flash(100, 0, 255, 65)
    audioManager.playHit()

    this.matchedPairs++
    this.addScore(100 + Math.max(0, 50 - this.moves * 2)) // Bonus for fewer moves

    this.flippedCards = []
    this.canFlip = true

    // Check win
    if (this.matchedPairs >= this.totalPairs) {
      this.time.delayedCall(500, () => {
        // Bonus for remaining time
        this.addScore(this.timeRemaining * 10)
        this.endGame(true)
      })
    }
  }

  handleNoMatch(card1, card2) {
    // Flip back animation
    [card1, card2].forEach(card => {
      this.tweens.add({
        targets: card,
        scaleX: 0,
        duration: 100,
        ease: 'Power2',
        onComplete: () => {
          this.hideCard(card)
          this.tweens.add({
            targets: card,
            scaleX: 1,
            duration: 100,
            ease: 'Power2'
          })
        }
      })
    })

    this.cameras.main.shake(100, 0.005)

    this.flippedCards = []
    this.canFlip = true
  }

  update(time, delta) {
    if (this.isPaused || this.isGameOver) return
    // Memory game is turn-based, no continuous update needed
  }
}

export default MemoryGame
