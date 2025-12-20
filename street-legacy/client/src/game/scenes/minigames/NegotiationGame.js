// NegotiationGame - Quick decision making mini-game
// Read situations and make risk/reward choices

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { audioManager } from '../../managers/AudioManager'
import { COLORS, toHexString, getTerminalStyle, BORDERS } from '../../ui/NetworkTheme'
import { createMiniGameEffects } from '../../utils/MiniGameEffects'

// Negotiation scenarios
const SCENARIOS = [
  {
    situation: 'The buyer is nervous and sweating. They keep looking at the door.',
    cue: 'NERVOUS',
    options: [
      { text: 'Lower the price to close quick', risk: 'low', reward: 0.7, success: 0.9 },
      { text: 'Demand full payment now', risk: 'high', reward: 1.3, success: 0.5 },
      { text: 'Walk away - it\'s a setup', risk: 'escape', reward: 0, success: 0.8 }
    ]
  },
  {
    situation: 'Your contact brought extra muscle. They\'re blocking the exit.',
    cue: 'INTIMIDATION',
    options: [
      { text: 'Stand your ground', risk: 'medium', reward: 1.0, success: 0.7 },
      { text: 'Offer a bigger cut', risk: 'low', reward: 0.6, success: 0.9 },
      { text: 'Threaten to expose them', risk: 'high', reward: 1.5, success: 0.4 }
    ]
  },
  {
    situation: 'The cop is asking questions about the package.',
    cue: 'INTERROGATION',
    options: [
      { text: 'Play dumb - "What package?"', risk: 'low', reward: 0.8, success: 0.85 },
      { text: 'Offer a bribe', risk: 'high', reward: 1.4, success: 0.5 },
      { text: 'Create a distraction and run', risk: 'medium', reward: 0.5, success: 0.6 }
    ]
  },
  {
    situation: 'The fence is offering half your asking price.',
    cue: 'LOWBALL',
    options: [
      { text: 'Accept the offer', risk: 'low', reward: 0.5, success: 1.0 },
      { text: 'Counter at 80%', risk: 'medium', reward: 0.8, success: 0.7 },
      { text: 'Threaten to go elsewhere', risk: 'high', reward: 1.0, success: 0.55 }
    ]
  },
  {
    situation: 'Your partner hasn\'t shown up. The client is getting impatient.',
    cue: 'DELAY',
    options: [
      { text: 'Stall with small talk', risk: 'low', reward: 0.7, success: 0.8 },
      { text: 'Handle it solo', risk: 'high', reward: 1.2, success: 0.5 },
      { text: 'Reschedule the meet', risk: 'medium', reward: 0.6, success: 0.75 }
    ]
  },
  {
    situation: 'The client wants to see the goods before payment.',
    cue: 'TRUST TEST',
    options: [
      { text: 'Show a sample only', risk: 'low', reward: 0.9, success: 0.85 },
      { text: 'Demand payment first', risk: 'medium', reward: 1.1, success: 0.6 },
      { text: 'Show everything - build trust', risk: 'high', reward: 1.3, success: 0.5 }
    ]
  },
  {
    situation: 'You recognize an undercover cop in the crowd.',
    cue: 'DANGER',
    options: [
      { text: 'Act natural, finish quick', risk: 'high', reward: 1.0, success: 0.4 },
      { text: 'Signal abort to your crew', risk: 'low', reward: 0.3, success: 0.9 },
      { text: 'Use them as cover', risk: 'medium', reward: 1.2, success: 0.55 }
    ]
  },
  {
    situation: 'The buyer claims they\'re short on cash.',
    cue: 'EXCUSE',
    options: [
      { text: 'Accept what they have', risk: 'low', reward: 0.6, success: 0.95 },
      { text: 'Take collateral instead', risk: 'medium', reward: 0.9, success: 0.7 },
      { text: 'No deal - walk away', risk: 'escape', reward: 0.2, success: 1.0 }
    ]
  }
]

export class NegotiationGame extends BaseMiniGame {
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.SCREEN_SHAKE,
      CURVEBALL_TYPES.BLUR
    ]
  }

  constructor() {
    super('NegotiationGame')

    this.currentScenario = null
    this.scenarioIndex = 0
    this.usedScenarios = []
    this.choiceButtons = []
    this.decisionTimer = null
    this.decisionTimeLeft = 0
    this.effects = null
    this.reputation = 50 // Negotiation reputation
    this.roundsCompleted = 0
    this.requiredRounds = 5
  }

  init(data) {
    super.init(data)
    this.usedScenarios = []
    this.choiceButtons = []
    this.reputation = 50
    this.roundsCompleted = 0

    // Difficulty affects decision time and required rounds
    const tier = data.difficultyTier?.name || 'Novice'
    const configs = {
      Novice: { time: 8, rounds: 4 },
      Apprentice: { time: 7, rounds: 5 },
      Skilled: { time: 6, rounds: 5 },
      Expert: { time: 5, rounds: 6 },
      Master: { time: 4, rounds: 7 }
    }
    this.config = configs[tier] || configs.Novice
    this.requiredRounds = this.config.rounds
    this.decisionTime = this.config.time
  }

  create() {
    super.create()

    this.effects = createMiniGameEffects(this)

    const { width, height } = this.scale

    // Reputation meter
    this.createReputationMeter(width)

    // Round counter
    this.roundText = this.add.text(width - 20, 130, `Round: 1 / ${this.requiredRounds}`, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(1, 0.5)

    // Scenario display area
    this.scenarioPanel = this.add.rectangle(width / 2, 280, width - 40, 180, COLORS.bg.panel, 0.95)
      .setStrokeStyle(2, COLORS.network.dim, 0.5)

    // Cue badge (shows hint about what kind of situation)
    this.cueBadge = this.add.rectangle(width / 2, 200, 150, 30, COLORS.status.warning, 0.2)
      .setStrokeStyle(1, COLORS.status.warning, 0.8)
    this.cueText = this.add.text(width / 2, 200, '', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px',
      color: toHexString(COLORS.status.warning),
      fontStyle: 'bold'
    }).setOrigin(0.5)

    // Situation text
    this.situationText = this.add.text(width / 2, 280, '', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '14px',
      color: toHexString(COLORS.text.primary),
      wordWrap: { width: width - 80 },
      align: 'center'
    }).setOrigin(0.5)

    // Decision timer bar
    this.createTimerBar(width, 360)

    // Options area
    this.optionsContainer = this.add.container(0, 0)

    // Result display
    this.resultText = this.add.text(width / 2, height / 2, '', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '24px',
      color: toHexString(COLORS.network.primary),
      fontStyle: 'bold'
    }).setOrigin(0.5).setAlpha(0).setDepth(100)

    // Start first scenario
    this.showNextScenario()
  }

  createReputationMeter(width) {
    const barY = 130
    const barWidth = 180

    // Background
    this.add.rectangle(80 + barWidth / 2, barY, barWidth + 4, 20, COLORS.bg.void)
      .setStrokeStyle(1, COLORS.network.dim, 0.5)

    // Fill
    this.repBar = this.add.rectangle(80, barY, barWidth * 0.5, 16, COLORS.network.primary, 0.8)
      .setOrigin(0, 0.5)

    // Label
    this.add.text(20, barY, 'REP:', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0, 0.5)

    this.repBarWidth = barWidth
  }

  createTimerBar(width, y) {
    const barWidth = width - 80

    this.add.rectangle(width / 2, y, barWidth + 4, 12, COLORS.bg.void)
      .setStrokeStyle(1, COLORS.status.danger, 0.3)

    this.timerBar = this.add.rectangle(40, y, barWidth, 8, COLORS.status.danger, 0.8)
      .setOrigin(0, 0.5)

    this.timerBarWidth = barWidth
  }

  showNextScenario() {
    // Get unused scenario
    const available = SCENARIOS.filter((_, i) => !this.usedScenarios.includes(i))
    if (available.length === 0) {
      this.usedScenarios = []
    }

    const scenarioPool = available.length > 0 ? available : SCENARIOS
    this.currentScenario = Phaser.Math.RND.pick(scenarioPool)
    const index = SCENARIOS.indexOf(this.currentScenario)
    this.usedScenarios.push(index)

    // Show cue
    this.cueText.setText(`[ ${this.currentScenario.cue} ]`)

    // Show situation with typing effect
    this.situationText.setText('')
    const fullText = this.currentScenario.situation
    let charIndex = 0

    const typingTimer = this.time.addEvent({
      delay: 25,
      callback: () => {
        charIndex++
        this.situationText.setText(fullText.substring(0, charIndex))
        if (charIndex >= fullText.length) {
          typingTimer.destroy()
          this.showOptions()
        }
      },
      loop: true
    })
  }

  showOptions() {
    // Clear old options
    this.optionsContainer.removeAll(true)
    this.choiceButtons = []

    const { width, height } = this.scale
    const options = this.currentScenario.options
    const buttonWidth = width - 60
    const buttonHeight = 50
    let startY = 400

    options.forEach((option, i) => {
      const y = startY + i * (buttonHeight + 10)

      // Risk indicator
      let riskColor = COLORS.network.primary
      let riskLabel = 'LOW RISK'
      if (option.risk === 'medium') {
        riskColor = COLORS.status.warning
        riskLabel = 'MEDIUM RISK'
      } else if (option.risk === 'high') {
        riskColor = COLORS.status.danger
        riskLabel = 'HIGH RISK'
      } else if (option.risk === 'escape') {
        riskColor = COLORS.status.info
        riskLabel = 'ESCAPE'
      }

      // Button background
      const bg = this.add.rectangle(width / 2, y, buttonWidth, buttonHeight, COLORS.bg.panel, 0.95)
        .setStrokeStyle(2, riskColor, 0.7)
        .setInteractive({ useHandCursor: true })

      // Option text
      const text = this.add.text(30, y, option.text, {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '13px',
        color: toHexString(COLORS.text.primary),
        wordWrap: { width: buttonWidth - 120 }
      }).setOrigin(0, 0.5)

      // Risk badge
      const riskBadge = this.add.rectangle(width - 70, y, 80, 22, riskColor, 0.2)
        .setStrokeStyle(1, riskColor, 0.6)
      const riskText = this.add.text(width - 70, y, riskLabel, {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '9px',
        color: toHexString(riskColor),
        fontStyle: 'bold'
      }).setOrigin(0.5)

      // Hover effects
      bg.on('pointerover', () => {
        bg.setFillStyle(riskColor, 0.15)
        bg.setStrokeStyle(3, riskColor, 1)
        audioManager.playHover()
      })
      bg.on('pointerout', () => {
        bg.setFillStyle(COLORS.bg.panel, 0.95)
        bg.setStrokeStyle(2, riskColor, 0.7)
      })
      bg.on('pointerdown', () => {
        this.makeChoice(option, i)
      })

      this.optionsContainer.add([bg, text, riskBadge, riskText])
      this.choiceButtons.push(bg)
    })

    // Start decision timer
    this.startDecisionTimer()
  }

  startDecisionTimer() {
    this.decisionTimeLeft = this.decisionTime
    this.timerBar.width = this.timerBarWidth

    this.decisionTimer = this.time.addEvent({
      delay: 100,
      callback: () => {
        this.decisionTimeLeft -= 0.1
        this.timerBar.width = (this.decisionTimeLeft / this.decisionTime) * this.timerBarWidth

        // Color change
        if (this.decisionTimeLeft <= 2) {
          this.timerBar.setFillStyle(0xff0000, 1)
        } else if (this.decisionTimeLeft <= 4) {
          this.timerBar.setFillStyle(0xff4400, 0.9)
        }

        if (this.decisionTimeLeft <= 0) {
          this.decisionTimer.destroy()
          this.timeOut()
        }
      },
      loop: true
    })
  }

  makeChoice(option, index) {
    // Stop timer
    if (this.decisionTimer) {
      this.decisionTimer.destroy()
    }

    // Disable buttons
    this.choiceButtons.forEach(btn => btn.disableInteractive())

    // Determine success
    const roll = Math.random()
    const success = roll < option.success

    // Calculate points
    let points = 0
    let repChange = 0

    if (success) {
      points = Math.floor(100 * option.reward)
      repChange = option.risk === 'high' ? 15 : option.risk === 'medium' ? 8 : 5

      this.showResult('SUCCESS!', COLORS.network.primary, points)
      this.effects.successFlash(200)
      audioManager.playHit()
    } else {
      points = -25
      repChange = option.risk === 'high' ? -20 : option.risk === 'medium' ? -10 : -5

      this.showResult('FAILED!', COLORS.status.danger, points)
      this.effects.failureFlash(200)
      this.effects.shake({ intensity: 0.02, duration: 200 })
      audioManager.playMiss()
    }

    this.addScore(Math.max(0, points))
    this.updateReputation(repChange)

    // Next round or end
    this.roundsCompleted++
    this.roundText.setText(`Round: ${this.roundsCompleted + 1} / ${this.requiredRounds}`)

    if (this.roundsCompleted >= this.requiredRounds) {
      this.time.delayedCall(1500, () => {
        this.endGame(this.reputation >= 30)
      })
    } else if (this.reputation <= 0) {
      this.time.delayedCall(1500, () => {
        this.endGame(false)
      })
    } else {
      this.time.delayedCall(1500, () => {
        this.optionsContainer.removeAll(true)
        this.showNextScenario()
      })
    }
  }

  timeOut() {
    // Auto-fail with worst outcome
    this.showResult('TOO SLOW!', COLORS.status.danger, -50)
    this.effects.failureFlash(300)
    audioManager.playMiss()

    this.updateReputation(-15)
    this.roundsCompleted++

    if (this.roundsCompleted >= this.requiredRounds || this.reputation <= 0) {
      this.time.delayedCall(1500, () => {
        this.endGame(this.reputation >= 30)
      })
    } else {
      this.time.delayedCall(1500, () => {
        this.optionsContainer.removeAll(true)
        this.showNextScenario()
      })
    }
  }

  showResult(text, color, points) {
    this.resultText.setText(`${text}\n${points > 0 ? '+' : ''}${points} pts`)
    this.resultText.setColor(toHexString(color))
    this.resultText.setAlpha(0)
    this.resultText.setScale(0.5)

    this.tweens.add({
      targets: this.resultText,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Back.out',
      onComplete: () => {
        this.tweens.add({
          targets: this.resultText,
          alpha: 0,
          y: this.resultText.y - 50,
          duration: 500,
          delay: 600,
          onComplete: () => {
            this.resultText.y = this.scale.height / 2
          }
        })
      }
    })
  }

  updateReputation(change) {
    this.reputation = Phaser.Math.Clamp(this.reputation + change, 0, 100)

    // Animate bar
    this.tweens.add({
      targets: this.repBar,
      width: (this.reputation / 100) * this.repBarWidth,
      duration: 300,
      ease: 'Quad.out'
    })

    // Color based on level
    if (this.reputation >= 70) {
      this.repBar.setFillStyle(COLORS.cred.gold, 0.9)
    } else if (this.reputation >= 40) {
      this.repBar.setFillStyle(COLORS.network.primary, 0.8)
    } else {
      this.repBar.setFillStyle(COLORS.status.danger, 0.8)
    }

    // Show change
    const changeText = this.add.text(
      this.repBar.x + this.repBar.width,
      130,
      `${change > 0 ? '+' : ''}${change}`,
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '14px',
        color: change > 0 ? toHexString(COLORS.network.primary) : toHexString(COLORS.status.danger),
        fontStyle: 'bold'
      }
    ).setOrigin(0, 0.5)

    this.tweens.add({
      targets: changeText,
      y: 100,
      alpha: 0,
      duration: 600,
      onComplete: () => changeText.destroy()
    })
  }

  shutdown() {
    if (this.decisionTimer) this.decisionTimer.destroy()
    if (this.effects) this.effects.cleanup()
  }
}

export default NegotiationGame
