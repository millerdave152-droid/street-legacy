// Disguise Mini-Game
// Social engineering: Memorize a fake identity and answer questions while maintaining composure
// Combines memory recall with quick-time events

import Phaser from 'phaser'
import { BaseMiniGame, CURVEBALL_TYPES } from './BaseMiniGame'
import { audioManager } from '../../managers/AudioManager'
import { COLORS, SYMBOLS, getTerminalStyle, toHexString, BORDERS } from '../../ui/NetworkTheme'

// Persona templates for generating fake identities
const FIRST_NAMES = ['Alex', 'Jordan', 'Morgan', 'Taylor', 'Casey', 'Riley', 'Sam', 'Jamie', 'Quinn', 'Drew']
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez', 'Wilson']
const OCCUPATIONS = ['Consultant', 'Investor', 'Attorney', 'Accountant', 'Engineer', 'Executive', 'Analyst', 'Director']
const COMPANIES = ['Axiom Corp', 'Nexus Holdings', 'Vertex Capital', 'Quantum LLC', 'Pinnacle Inc', 'Atlas Group']
const CITIES = ['New York', 'Los Angeles', 'Chicago', 'Miami', 'Seattle', 'Boston', 'Denver', 'Austin']
const HOBBIES = ['golf', 'sailing', 'wine tasting', 'art collecting', 'tennis', 'skiing', 'photography', 'chess']

// Question types
const QUESTION_TYPES = {
  NAME: 'name',
  OCCUPATION: 'occupation',
  COMPANY: 'company',
  CITY: 'city',
  HOBBY: 'hobby',
  YEARS: 'years'
}

// Composure events (QTEs)
const COMPOSURE_PROMPTS = [
  { text: 'Maintain eye contact!', key: 'E' },
  { text: 'Keep your hands steady!', key: 'S' },
  { text: 'Control your breathing!', key: 'B' },
  { text: 'Stay confident!', key: 'C' },
  { text: 'Hold your posture!', key: 'P' }
]

export class DisguiseGame extends BaseMiniGame {
  static get supportedCurveballs() {
    return [
      CURVEBALL_TYPES.VISUAL_BLUR,
      CURVEBALL_TYPES.DISTRACTION,
      CURVEBALL_TYPES.BRIEF_BLACKOUT,
      CURVEBALL_TYPES.INPUT_LAG
    ]
  }

  constructor() {
    super('DisguiseGame')

    // Persona data
    this.persona = null

    // Game phases
    this.phase = 'memorize' // 'memorize', 'interrogation', 'complete'
    this.memorizeTime = 8000 // Time to memorize (ms)
    this.questionIndex = 0
    this.totalQuestions = 5
    this.correctAnswers = 0

    // Current question state
    this.currentQuestion = null
    this.answerOptions = []
    this.answerButtons = []
    this.questionText = null
    this.canAnswer = false

    // Composure system
    this.composure = 100
    this.composureBar = null
    this.composureEvent = null
    this.composureTimer = null

    // UI elements
    this.personaCard = null
    this.phaseText = null
  }

  create() {
    super.create()

    // Scale difficulty
    this.setupDifficulty()

    // Generate random persona
    this.generatePersona()

    // Create UI
    this.createPhaseIndicator()
    this.createComposureBar()

    // Start memorization phase
    this.startMemorizePhase()
  }

  setupDifficulty() {
    const difficulty = this.gameData.difficulty || 1

    if (difficulty >= 5) {
      this.memorizeTime = 5000
      this.totalQuestions = 7
    } else if (difficulty >= 3) {
      this.memorizeTime = 6000
      this.totalQuestions = 6
    } else {
      this.memorizeTime = 8000
      this.totalQuestions = 5
    }
  }

  generatePersona() {
    this.persona = {
      firstName: Phaser.Utils.Array.GetRandom(FIRST_NAMES),
      lastName: Phaser.Utils.Array.GetRandom(LAST_NAMES),
      occupation: Phaser.Utils.Array.GetRandom(OCCUPATIONS),
      company: Phaser.Utils.Array.GetRandom(COMPANIES),
      city: Phaser.Utils.Array.GetRandom(CITIES),
      hobby: Phaser.Utils.Array.GetRandom(HOBBIES),
      years: Phaser.Math.Between(2, 15)
    }
  }

  createPhaseIndicator() {
    this.phaseText = this.add.text(this.gameWidth / 2, 130,
      `${SYMBOLS.system} PHASE: MEMORIZE`, {
        ...getTerminalStyle('lg'),
        color: toHexString(COLORS.network.primary)
      }).setOrigin(0.5)
  }

  createComposureBar() {
    // Background
    this.add.text(20, this.gameHeight - 60, 'COMPOSURE', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    })

    const barBg = this.add.rectangle(20, this.gameHeight - 40, this.gameWidth - 40, 16, COLORS.bg.panel)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, COLORS.text.muted, 0.5)

    this.composureBar = this.add.rectangle(20, this.gameHeight - 40, this.gameWidth - 40, 16, COLORS.network.primary)
      .setOrigin(0, 0.5)

    this.composureText = this.add.text(this.gameWidth - 20, this.gameHeight - 40, '100%', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(1, 0.5)
  }

  updateComposureBar() {
    const width = (this.gameWidth - 40) * (this.composure / 100)
    this.composureBar.width = Math.max(0, width)

    // Color based on level
    let color = COLORS.network.primary
    if (this.composure < 30) {
      color = COLORS.status.danger
    } else if (this.composure < 60) {
      color = COLORS.status.warning
    }

    this.composureBar.setFillStyle(color)
    this.composureText.setText(`${Math.round(this.composure)}%`)
    this.composureText.setColor(toHexString(color))
  }

  startMemorizePhase() {
    this.phase = 'memorize'

    // Create persona card
    this.createPersonaCard()

    // Timer indicator
    this.memorizeTimer = this.add.text(this.gameWidth / 2, 160,
      `Memorize in: ${(this.memorizeTime / 1000).toFixed(1)}s`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.status.warning)
      }).setOrigin(0.5)

    // Countdown
    const startTime = Date.now()
    this.memorizeCountdown = this.time.addEvent({
      delay: 100,
      callback: () => {
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, (this.memorizeTime - elapsed) / 1000)
        this.memorizeTimer.setText(`Memorize in: ${remaining.toFixed(1)}s`)

        if (remaining <= 0) {
          this.memorizeCountdown.destroy()
          this.startInterrogationPhase()
        }
      },
      loop: true
    })

    // Instructions
    this.memorizeInstructions = this.add.text(this.gameWidth / 2, this.gameHeight - 90,
      'Study your cover identity carefully!', {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)
  }

  createPersonaCard() {
    const cardX = this.gameWidth / 2
    const cardY = 350
    const cardWidth = this.gameWidth - 60
    const cardHeight = 280

    this.personaCard = this.add.container(cardX, cardY)

    // Card background
    const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, COLORS.bg.panel, 0.95)
      .setStrokeStyle(2, COLORS.network.primary, 0.8)
    this.personaCard.add(bg)

    // Header
    const header = this.add.text(0, -cardHeight / 2 + 25, `${SYMBOLS.system} COVER IDENTITY`, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5)
    this.personaCard.add(header)

    // Persona details
    const details = [
      { label: 'NAME', value: `${this.persona.firstName} ${this.persona.lastName}` },
      { label: 'OCCUPATION', value: this.persona.occupation },
      { label: 'COMPANY', value: this.persona.company },
      { label: 'FROM', value: this.persona.city },
      { label: 'YEARS EMPLOYED', value: `${this.persona.years} years` },
      { label: 'HOBBY', value: this.persona.hobby }
    ]

    let yOffset = -cardHeight / 2 + 65
    details.forEach(detail => {
      const label = this.add.text(-cardWidth / 2 + 20, yOffset, detail.label + ':', {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0)
      this.personaCard.add(label)

      const value = this.add.text(-cardWidth / 2 + 140, yOffset, detail.value, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.primary)
      }).setOrigin(0)
      this.personaCard.add(value)

      yOffset += 35
    })

    // Pulsing border effect
    this.tweens.add({
      targets: bg,
      alpha: { from: 0.8, to: 1 },
      duration: 500,
      yoyo: true,
      repeat: -1
    })
  }

  startInterrogationPhase() {
    this.phase = 'interrogation'
    this.phaseText.setText(`${SYMBOLS.alert} PHASE: INTERROGATION`)
    this.phaseText.setColor(toHexString(COLORS.status.warning))

    // Clear memorize UI
    if (this.memorizeTimer) this.memorizeTimer.destroy()
    if (this.memorizeInstructions) this.memorizeInstructions.destroy()

    // Hide persona card with animation
    this.tweens.add({
      targets: this.personaCard,
      alpha: 0,
      y: this.personaCard.y - 50,
      duration: 500,
      onComplete: () => {
        this.personaCard.destroy()
        this.showNextQuestion()
        this.startComposureEvents()
      }
    })
  }

  showNextQuestion() {
    if (this.questionIndex >= this.totalQuestions) {
      this.completeGame()
      return
    }

    // Clear previous question
    this.clearQuestion()

    // Generate question
    this.currentQuestion = this.generateQuestion()

    // Question counter
    this.questionCounter = this.add.text(this.gameWidth / 2, 160,
      `Question ${this.questionIndex + 1}/${this.totalQuestions}`, {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)

    // Question text
    this.questionText = this.add.text(this.gameWidth / 2, 220, this.currentQuestion.text, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.text.primary),
      wordWrap: { width: this.gameWidth - 60 },
      align: 'center'
    }).setOrigin(0.5)

    // Answer options
    this.createAnswerButtons()

    // Enable answering
    this.canAnswer = true

    // Time pressure - lose composure over time
    this.questionTimer = this.time.addEvent({
      delay: 1000,
      callback: () => {
        if (this.canAnswer && this.phase === 'interrogation') {
          this.adjustComposure(-5)
        }
      },
      loop: true
    })
  }

  generateQuestion() {
    const types = Object.values(QUESTION_TYPES)
    const type = types[this.questionIndex % types.length]

    let question = { type, text: '', correct: '', options: [] }

    switch (type) {
      case QUESTION_TYPES.NAME:
        question.text = '"What did you say your name was?"'
        question.correct = `${this.persona.firstName} ${this.persona.lastName}`
        question.options = this.generateNameOptions(question.correct)
        break

      case QUESTION_TYPES.OCCUPATION:
        question.text = '"And what do you do for a living?"'
        question.correct = this.persona.occupation
        question.options = this.generateOptions(question.correct, OCCUPATIONS)
        break

      case QUESTION_TYPES.COMPANY:
        question.text = '"Which company did you say you work for?"'
        question.correct = this.persona.company
        question.options = this.generateOptions(question.correct, COMPANIES)
        break

      case QUESTION_TYPES.CITY:
        question.text = '"Where are you from originally?"'
        question.correct = this.persona.city
        question.options = this.generateOptions(question.correct, CITIES)
        break

      case QUESTION_TYPES.HOBBY:
        question.text = '"What do you like to do in your spare time?"'
        question.correct = this.persona.hobby
        question.options = this.generateOptions(question.correct, HOBBIES)
        break

      case QUESTION_TYPES.YEARS:
        question.text = '"How long have you been with the company?"'
        question.correct = `${this.persona.years} years`
        question.options = this.generateYearOptions(this.persona.years)
        break
    }

    // Shuffle options
    question.options = Phaser.Utils.Array.Shuffle(question.options)

    return question
  }

  generateOptions(correct, pool) {
    const options = [correct]
    const available = pool.filter(item => item !== correct)

    while (options.length < 4 && available.length > 0) {
      const index = Phaser.Math.Between(0, available.length - 1)
      options.push(available.splice(index, 1)[0])
    }

    return options
  }

  generateNameOptions(correct) {
    const options = [correct]

    while (options.length < 4) {
      const name = `${Phaser.Utils.Array.GetRandom(FIRST_NAMES)} ${Phaser.Utils.Array.GetRandom(LAST_NAMES)}`
      if (!options.includes(name)) {
        options.push(name)
      }
    }

    return options
  }

  generateYearOptions(correct) {
    const options = [`${correct} years`]

    while (options.length < 4) {
      const years = Phaser.Math.Between(1, 20)
      const option = `${years} years`
      if (!options.includes(option)) {
        options.push(option)
      }
    }

    return options
  }

  createAnswerButtons() {
    this.answerButtons = []
    const buttonWidth = this.gameWidth - 80
    const buttonHeight = 50
    const startY = 300
    const spacing = 60

    this.currentQuestion.options.forEach((option, index) => {
      const y = startY + index * spacing

      const container = this.add.container(this.gameWidth / 2, y)

      // Button background
      const bg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, COLORS.bg.card)
        .setStrokeStyle(2, COLORS.text.muted)

      // Button text
      const text = this.add.text(0, 0, option, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.primary)
      }).setOrigin(0.5)

      container.add([bg, text])
      container.setSize(buttonWidth, buttonHeight)

      // Interactivity
      container.setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          if (this.canAnswer) {
            bg.setStrokeStyle(2, COLORS.network.primary)
            bg.setFillStyle(COLORS.network.dark)
          }
        })
        .on('pointerout', () => {
          if (this.canAnswer) {
            bg.setStrokeStyle(2, COLORS.text.muted)
            bg.setFillStyle(COLORS.bg.card)
          }
        })
        .on('pointerdown', () => this.selectAnswer(option, container, bg))

      // Keyboard shortcut
      const keyText = this.add.text(-buttonWidth / 2 + 20, 0, `[${index + 1}]`, {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0, 0.5)
      container.add(keyText)

      this.answerButtons.push({ container, bg, option })
    })

    // Keyboard input
    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-ONE', () => this.selectAnswerByIndex(0))
      this.input.keyboard.once('keydown-TWO', () => this.selectAnswerByIndex(1))
      this.input.keyboard.once('keydown-THREE', () => this.selectAnswerByIndex(2))
      this.input.keyboard.once('keydown-FOUR', () => this.selectAnswerByIndex(3))
    }
  }

  selectAnswerByIndex(index) {
    if (!this.canAnswer || index >= this.answerButtons.length) return
    const btn = this.answerButtons[index]
    this.selectAnswer(btn.option, btn.container, btn.bg)
  }

  selectAnswer(answer, container, bg) {
    if (!this.canAnswer) return
    this.canAnswer = false

    // Stop question timer
    if (this.questionTimer) {
      this.questionTimer.destroy()
    }

    const isCorrect = answer === this.currentQuestion.correct

    if (isCorrect) {
      // Correct answer
      bg.setFillStyle(COLORS.status.success)
      bg.setStrokeStyle(2, COLORS.network.glow)

      this.correctAnswers++
      this.addScore(100)
      this.adjustComposure(10)

      audioManager.playHit()

      // Flash green
      this.cameras.main.flash(100, 0, 255, 65)
    } else {
      // Wrong answer
      bg.setFillStyle(COLORS.status.danger)
      bg.setStrokeStyle(2, 0xb91c1c)

      this.adjustComposure(-25)

      audioManager.playError()

      // Show correct answer
      this.answerButtons.forEach(btn => {
        if (btn.option === this.currentQuestion.correct) {
          btn.bg.setFillStyle(COLORS.status.success, 0.5)
          btn.bg.setStrokeStyle(2, COLORS.network.glow)
        }
      })

      // Shake
      this.cameras.main.shake(200, 0.02)
    }

    // Move to next question after delay
    this.time.delayedCall(1000, () => {
      this.questionIndex++
      this.showNextQuestion()
    })
  }

  clearQuestion() {
    if (this.questionText) this.questionText.destroy()
    if (this.questionCounter) this.questionCounter.destroy()
    if (this.questionTimer) this.questionTimer.destroy()

    this.answerButtons.forEach(btn => btn.container.destroy())
    this.answerButtons = []
  }

  startComposureEvents() {
    // Random composure QTE events during interrogation
    const scheduleNext = () => {
      if (this.phase !== 'interrogation' || this.isGameOver) return

      const delay = Phaser.Math.Between(3000, 6000)

      this.composureTimer = this.time.delayedCall(delay, () => {
        this.triggerComposureEvent()
        scheduleNext()
      })
    }

    scheduleNext()
  }

  triggerComposureEvent() {
    if (this.composureEvent || this.phase !== 'interrogation' || this.isGameOver) return

    const prompt = Phaser.Utils.Array.GetRandom(COMPOSURE_PROMPTS)

    // Create QTE overlay
    this.composureEvent = this.add.container(this.gameWidth / 2, this.gameHeight / 2 - 100)

    const bg = this.add.rectangle(0, 0, 280, 100, COLORS.status.warning, 0.95)
      .setStrokeStyle(3, COLORS.cred.gold)
    this.composureEvent.add(bg)

    const text = this.add.text(0, -20, prompt.text, {
      ...getTerminalStyle('md'),
      color: '#000000'
    }).setOrigin(0.5)
    this.composureEvent.add(text)

    const keyText = this.add.text(0, 20, `Press [${prompt.key}] quickly!`, {
      ...getTerminalStyle('lg'),
      color: '#000000',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.composureEvent.add(keyText)

    // Pulsing animation
    this.tweens.add({
      targets: this.composureEvent,
      scale: { from: 0.8, to: 1 },
      duration: 100
    })

    // Listen for key press
    const keyCode = `keydown-${prompt.key}`
    const handleKey = () => {
      this.resolveComposureEvent(true)
    }

    if (this.input.keyboard) {
      this.input.keyboard.once(keyCode, handleKey)
    }

    // Timeout for failure
    this.composureEventTimeout = this.time.delayedCall(2000, () => {
      if (this.input.keyboard) {
        this.input.keyboard.off(keyCode, handleKey)
      }
      this.resolveComposureEvent(false)
    })
  }

  resolveComposureEvent(success) {
    if (!this.composureEvent) return

    // Clear timeout
    if (this.composureEventTimeout) {
      this.composureEventTimeout.destroy()
    }

    if (success) {
      // Success feedback
      this.composureEvent.list[0].setFillStyle(COLORS.status.success)
      audioManager.playClick()
      this.addScore(25)
    } else {
      // Failure feedback
      this.composureEvent.list[0].setFillStyle(COLORS.status.danger)
      this.adjustComposure(-15)
      audioManager.playError()
    }

    // Remove after brief display
    this.time.delayedCall(300, () => {
      if (this.composureEvent) {
        this.composureEvent.destroy()
        this.composureEvent = null
      }
    })
  }

  adjustComposure(amount) {
    this.composure = Phaser.Math.Clamp(this.composure + amount, 0, 100)
    this.updateComposureBar()

    // Check for blown cover
    if (this.composure <= 0) {
      this.blowCover()
    }
  }

  blowCover() {
    if (this.isGameOver) return

    this.phase = 'complete'
    this.phaseText.setText(`${SYMBOLS.alert} COVER BLOWN!`)
    this.phaseText.setColor(toHexString(COLORS.status.danger))

    // Clear ongoing events
    this.clearQuestion()
    if (this.composureTimer) this.composureTimer.destroy()
    if (this.composureEvent) this.composureEvent.destroy()

    // Failure animation
    this.cameras.main.shake(400, 0.04)
    this.cameras.main.flash(300, 255, 0, 0)

    const failText = this.add.text(this.gameWidth / 2, this.gameHeight / 2 - 50,
      `${SYMBOLS.alert} THEY SAW THROUGH YOUR DISGUISE!`, {
        ...getTerminalStyle('lg'),
        color: toHexString(COLORS.status.danger),
        wordWrap: { width: this.gameWidth - 60 },
        align: 'center'
      }).setOrigin(0.5)

    audioManager.playError()

    this.time.delayedCall(1500, () => {
      this.endGame(false)
    })
  }

  completeGame() {
    this.phase = 'complete'
    this.phaseText.setText(`${SYMBOLS.system} INTERROGATION COMPLETE`)
    this.phaseText.setColor(toHexString(COLORS.network.primary))

    // Clear ongoing events
    this.clearQuestion()
    if (this.composureTimer) this.composureTimer.destroy()
    if (this.composureEvent) this.composureEvent.destroy()

    // Calculate success
    const accuracy = this.correctAnswers / this.totalQuestions
    const success = accuracy >= 0.5 && this.composure > 0

    // Bonus for accuracy and composure
    this.addScore(Math.floor(accuracy * 200))
    this.addScore(Math.floor(this.composure * 2))
    this.addScore(this.timeRemaining * 5)

    // Success animation
    this.cameras.main.flash(200, 0, 255, 65)

    const resultText = this.add.text(this.gameWidth / 2, this.gameHeight / 2 - 50,
      success ? `${SYMBOLS.system} COVER MAINTAINED` : `${SYMBOLS.alert} TOO MANY MISTAKES`,
      {
        ...getTerminalStyle('lg'),
        color: toHexString(success ? COLORS.network.primary : COLORS.status.danger)
      }).setOrigin(0.5)

    const statsText = this.add.text(this.gameWidth / 2, this.gameHeight / 2 + 10,
      `Correct: ${this.correctAnswers}/${this.totalQuestions} | Composure: ${Math.round(this.composure)}%`,
      {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)

    audioManager.playHit()

    this.time.delayedCall(2000, () => {
      this.endGame(success)
    })
  }

  update(time, delta) {
    super.update(time, delta)

    if (this.isPaused || this.isGameOver) return

    // Additional update logic if needed
  }

  shutdown() {
    // Clean up timers
    if (this.memorizeCountdown) this.memorizeCountdown.destroy()
    if (this.questionTimer) this.questionTimer.destroy()
    if (this.composureTimer) this.composureTimer.destroy()
    if (this.composureEventTimeout) this.composureEventTimeout.destroy()

    super.shutdown()
  }
}

export default DisguiseGame
