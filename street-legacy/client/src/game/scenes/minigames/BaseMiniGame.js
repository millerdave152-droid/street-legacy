// Base Mini-Game Scene
// Abstract base class that all mini-games extend

import Phaser from 'phaser'
import { audioManager, AUDIO_KEYS } from '../../managers/AudioManager'
import { AnimationHelper } from '../../utils/AnimationHelper'
import { ParticleHelper } from '../../utils/ParticleHelper'
import { gameManager } from '../../GameManager'
import { CurveballManager, CURVEBALL_TYPES } from '../../managers/CurveballManager'
import { COLORS, SYMBOLS, getTerminalStyle, toHexString, BORDERS } from '../../ui/NetworkTheme'

export class BaseMiniGame extends Phaser.Scene {
  // Subclasses override this to declare supported curveballs
  static get supportedCurveballs() {
    return [] // Base class supports none - subclasses opt in
  }

  constructor(key) {
    super({ key })

    // Game data from caller
    this.gameData = null

    // Game state
    this.score = 0
    this.timeRemaining = 0
    this.isPaused = false
    this.isGameOver = false

    // UI elements
    this.timerText = null
    this.scoreText = null
    this.timerEvent = null
    this.progressBar = null
    this.progressBarBg = null

    // Pause menu elements
    this.pauseOverlay = null
    this.pauseElements = []

    // Dimensions
    this.gameWidth = 400
    this.gameHeight = 700
    this.hudHeight = 100

    // Curveball system
    this.curveballManager = null
    this.controlsReversed = false
    this.speedMultiplier = 1.0
    this.inputLagDelay = 0
    this.pendingInputs = []
  }

  init(data) {
    this.gameData = data
    this.score = 0
    this.timeRemaining = data.timeLimit || 30
    this.isPaused = false
    this.isGameOver = false

    // Anti-cheat: Track game start time and initial state
    this.gameStartTime = Date.now()
    this.totalPausedTime = 0
    this.lastPauseStart = null
    this.maxScorePerSecond = data.maxScorePerSecond || 50 // Reasonable max score rate

    // Get actual game dimensions
    this.gameWidth = this.scale.width
    this.gameHeight = this.scale.height
  }

  create() {
    console.log('[BaseMiniGame] create() started')

    // CRITICAL: Bring this scene to top of scene stack for input priority
    this.scene.bringToTop()

    // CRITICAL: Ensure GameScene input stays disabled while we're active
    try {
      const gameScene = this.scene.get('GameScene')
      if (gameScene && gameScene.input) {
        gameScene.input.enabled = false
      }
    } catch (e) {}

    // Set background
    this.cameras.main.setBackgroundColor(this.gameData.theme?.backgroundColor || 0x0a0a0a)

    // Initialize audio and play action BGM
    audioManager.setScene(this)
    audioManager.crossfadeBGM(AUDIO_KEYS.BGM.ACTION)

    // Play game start sound
    audioManager.playMiniGameStart()

    // Create HUD
    this.createHUD()

    // Start countdown timer
    this.startTimer()

    // Initialize curveball system
    this.initializeCurveballs()

    // Pause on ESC
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ESC', () => this.togglePause())
    }

    // Fade in
    this.cameras.main.fadeIn(300)
  }

  /**
   * Initialize the curveball system if this game supports curveballs
   */
  initializeCurveballs() {
    const supportedTypes = this.constructor.supportedCurveballs
    if (!supportedTypes || supportedTypes.length === 0) return

    this.curveballManager = new CurveballManager(this)
    this.curveballManager.initialize(
      supportedTypes,
      this.gameData.difficultyTier?.name || 'Novice'
    )

    // Listen for curveball events for game-specific handling
    this.events.on('curveballStart', this.onCurveballStart, this)
    this.events.on('curveballEnd', this.onCurveballEnd, this)
  }

  /**
   * Hook for subclasses to handle curveball start
   * Override in subclasses for game-specific handling
   */
  onCurveballStart(data) {
    // Subclasses can override this
  }

  /**
   * Hook for subclasses to handle curveball end
   * Override in subclasses for game-specific handling
   */
  onCurveballEnd(data) {
    // Subclasses can override this
  }

  /**
   * Process delayed inputs for input lag curveball
   */
  processDelayedInputs() {
    if (this.inputLagDelay === 0 || this.pendingInputs.length === 0) return

    const now = Date.now()
    const ready = this.pendingInputs.filter(p => now >= p.executeAt)

    ready.forEach(pending => {
      pending.callback()
      const idx = this.pendingInputs.indexOf(pending)
      if (idx > -1) this.pendingInputs.splice(idx, 1)
    })
  }

  /**
   * Utility method for subclasses to apply input with potential lag
   */
  applyInput(callback) {
    if (this.inputLagDelay > 0) {
      this.pendingInputs.push({
        executeAt: Date.now() + this.inputLagDelay,
        callback
      })
    } else {
      callback()
    }
  }

  /**
   * Utility to get direction with reversal support
   */
  getAdjustedDirection(dx, dy) {
    if (this.controlsReversed) {
      return { dx: -dx, dy: -dy }
    }
    return { dx, dy }
  }

  createHUD() {
    const theme = this.gameData.theme || {}
    const tier = this.gameData.difficultyTier || { name: 'Novice', color: '#22c55e' }
    const rewardMult = this.gameData.rewardMultiplier || 1

    // HUD Background - Network theme dark panel
    const hudBg = this.add.rectangle(this.gameWidth / 2, 55, this.gameWidth, 110, COLORS.bg.void, 0.95)
    hudBg.setStrokeStyle(BORDERS.thin, COLORS.network.dim, 0.5)

    // Crime Icon + Name with terminal style
    this.add.text(20, 15, theme.icon || '🎯', { fontSize: '28px' })
    this.add.text(55, 12, `${SYMBOLS.system} ${(this.gameData.crimeName || 'MINI-GAME').toUpperCase()}`, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.network.primary)
    })

    // Difficulty tier badge with Network styling
    const tierColor = Phaser.Display.Color.HexStringToColor(tier.color).color
    const tierBadge = this.add.rectangle(55 + 8, 36, 70, 18, tierColor, 0.2)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, tierColor, 0.8)
    this.add.text(55 + 43, 36, tier.name.toUpperCase(), {
      ...getTerminalStyle('xs'),
      color: tier.color,
      fontStyle: 'bold'
    }).setOrigin(0.5)

    // Reward multiplier badge
    if (rewardMult > 1) {
      const multBadge = this.add.rectangle(130, 36, 45, 18, COLORS.status.warning, 0.2)
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, COLORS.status.warning, 0.8)
      this.add.text(152, 36, `${rewardMult.toFixed(1)}x`, {
        ...getTerminalStyle('xs'),
        color: toHexString(COLORS.status.warning),
        fontStyle: 'bold'
      }).setOrigin(0.5)
    }

    // Difficulty stars (smaller, below tier)
    const difficulty = this.gameData.difficulty || 1
    const maxStars = Math.min(difficulty, 10)
    const stars = SYMBOLS.star.repeat(maxStars) + (difficulty > 5 ? '' : SYMBOLS.starEmpty.repeat(5 - maxStars))
    this.add.text(55, 52, stars, {
      fontSize: '11px',
      color: toHexString(COLORS.status.warning)
    })

    // Score display with terminal styling
    this.scoreText = this.add.text(this.gameWidth - 20, 12, `${SYMBOLS.system} SCORE: 0`, {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(1, 0)

    // Target indicator
    this.add.text(this.gameWidth - 20, 32, `TARGET: ${this.gameData.targetScore || 100}`, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(1, 0)

    // High score (if any)
    const playerStats = this.gameData.playerStats
    if (playerStats && playerStats.highScore > 0) {
      this.add.text(this.gameWidth - 20, 48, `${SYMBOLS.star} BEST: ${playerStats.highScore}`, {
        ...getTerminalStyle('xs'),
        color: toHexString(COLORS.cred.gold)
      }).setOrigin(1, 0)
    }

    // Timer with terminal style
    this.timerText = this.add.text(this.gameWidth / 2, 75, this.formatTime(this.timeRemaining), {
      ...getTerminalStyle('xxl'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5)

    // Progress bar background - Network style
    this.progressBarBg = this.add.rectangle(this.gameWidth / 2, 100, this.gameWidth - 40, 8, COLORS.bg.panel)
    this.progressBarBg.setStrokeStyle(1, COLORS.network.dim, 0.5)

    // Progress bar fill
    this.progressBar = this.add.rectangle(20, 100, 0, 8, COLORS.network.primary).setOrigin(0, 0.5)

    // Perfect score marker
    const perfectScore = this.gameData.perfectScore || (this.gameData.targetScore * 1.5)
    const maxScore = Math.max(perfectScore, (this.gameData.targetScore || 100) * 1.5)
    const perfectX = 20 + ((this.gameWidth - 40) * (perfectScore / maxScore))
    this.add.rectangle(perfectX, 100, 2, 14, COLORS.status.warning)

    // Next tier progress (if not max tier)
    if (this.gameData.nextTier && this.gameData.playsToNextTier > 0) {
      this.add.text(this.gameWidth / 2, 112,
        `${this.gameData.playsToNextTier} more plays to ${this.gameData.nextTier.name}`, {
        ...getTerminalStyle('xs'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5)
    }
  }

  startTimer() {
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: () => {
        if (this.isPaused || this.isGameOver) return

        this.timeRemaining--
        this.timerText.setText(this.formatTime(this.timeRemaining))

        // Warning when low time - use Network danger color
        if (this.timeRemaining <= 10) {
          this.timerText.setColor(toHexString(COLORS.status.danger))
          audioManager.playTick() // Play tick sound for last 10 seconds
          this.tweens.add({
            targets: this.timerText,
            scale: { from: 1, to: 1.15 },
            duration: 100,
            yoyo: true
          })
        }

        // Time's up
        if (this.timeRemaining <= 0) {
          this.endGame(this.score >= (this.gameData.targetScore || 0))
        }
      },
      loop: true
    })
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  addScore(points) {
    const oldScore = this.score
    this.score += points
    this.scoreText.setText(`${SYMBOLS.system} SCORE: ${this.score}`)

    // Update progress bar
    const targetScore = this.gameData.targetScore || 100
    const perfectScore = this.gameData.perfectScore || (targetScore * 1.5)
    const maxScore = Math.max(perfectScore, targetScore * 1.5)
    const progress = Math.min(1, this.score / maxScore)
    this.progressBar.width = (this.gameWidth - 40) * progress

    // Color change at target - use Network success color
    if (this.score >= targetScore && oldScore < targetScore) {
      this.progressBar.setFillStyle(COLORS.network.glow)
      // Play success sound and sparkle when reaching target
      audioManager.playHit()
      ParticleHelper.xpSparkle(this, this.gameWidth - 80, 18)
    }
    if (this.score >= perfectScore && oldScore < perfectScore) {
      this.progressBar.setFillStyle(COLORS.cred.gold)
      // Extra celebration for perfect score threshold
      audioManager.playPerfect()
      ParticleHelper.achievementSparkle(this, this.gameWidth / 2, 100)
    }

    // Score pop animation
    AnimationHelper.bounce(this, this.scoreText, 5, 150)

    // Hit spark at score position for positive points - use Network green
    if (points > 0) {
      ParticleHelper.hitSpark(this, this.gameWidth - 80, 25, COLORS.network.primary)
    }
  }

  setScore(newScore) {
    this.score = newScore
    this.scoreText.setText(`${SYMBOLS.system} SCORE: ${this.score}`)

    // Update progress bar
    const targetScore = this.gameData.targetScore || 100
    const perfectScore = this.gameData.perfectScore || (targetScore * 1.5)
    const maxScore = Math.max(perfectScore, targetScore * 1.5)
    const progress = Math.min(1, this.score / maxScore)
    this.progressBar.width = (this.gameWidth - 40) * progress
  }

  togglePause() {
    this.isPaused = !this.isPaused

    if (this.isPaused) {
      // Track pause start for anti-cheat
      this.lastPauseStart = Date.now()
      this.showPauseMenu()
    } else {
      // Add paused time to total
      if (this.lastPauseStart) {
        this.totalPausedTime += Date.now() - this.lastPauseStart
        this.lastPauseStart = null
      }
      this.hidePauseMenu()
    }
  }

  showPauseMenu() {
    // Darken screen with Network theme
    this.pauseOverlay = this.add.rectangle(
      this.gameWidth / 2,
      this.gameHeight / 2,
      this.gameWidth,
      this.gameHeight,
      COLORS.bg.void, 0.92
    ).setDepth(100)

    // Pause panel background
    const pausePanel = this.add.rectangle(
      this.gameWidth / 2,
      this.gameHeight / 2,
      280, 200,
      COLORS.bg.panel, 0.98
    ).setDepth(100).setStrokeStyle(BORDERS.medium, COLORS.network.primary, 0.8)

    // Pause title with terminal styling
    const pauseTitle = this.add.text(this.gameWidth / 2, this.gameHeight / 2 - 60, `${SYMBOLS.system} PAUSED`, {
      ...getTerminalStyle('display'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setDepth(101)

    // Resume button with Network theme
    const resumeBtn = this.add.text(this.gameWidth / 2, this.gameHeight / 2 + 10, `[ ${SYMBOLS.transmit} RESUME ]`, {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => resumeBtn.setColor(toHexString(COLORS.network.glow)))
      .on('pointerout', () => resumeBtn.setColor(toHexString(COLORS.network.primary)))
      .on('pointerdown', () => this.togglePause())

    // Quit button with danger styling
    const quitBtn = this.add.text(this.gameWidth / 2, this.gameHeight / 2 + 60, `[ ${SYMBOLS.close} QUIT ]`, {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.status.danger)
    }).setOrigin(0.5).setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => quitBtn.setColor('#ff3366'))
      .on('pointerout', () => quitBtn.setColor(toHexString(COLORS.status.danger)))
      .on('pointerdown', () => this.endGame(false))

    this.pauseElements = [pausePanel, pauseTitle, resumeBtn, quitBtn]
  }

  hidePauseMenu() {
    if (this.pauseOverlay) {
      this.pauseOverlay.destroy()
      this.pauseOverlay = null
    }
    this.pauseElements.forEach(el => el.destroy())
    this.pauseElements = []
  }

  /**
   * Validate minigame result to detect cheating
   * Returns adjusted score if suspicious, or original score if valid
   */
  validateResult(score, timeRemaining) {
    const timeLimit = this.gameData.timeLimit || 30
    const timePlayed = timeLimit - timeRemaining
    const actualTimePlayed = (Date.now() - this.gameStartTime - this.totalPausedTime) / 1000

    // Check 1: Score rate validation
    // If score/second exceeds reasonable max, cap the score
    const maxPossibleScore = Math.floor(timePlayed * this.maxScorePerSecond)
    if (score > maxPossibleScore && maxPossibleScore > 0) {
      console.warn(`[BaseMiniGame] Suspicious score rate: ${score} in ${timePlayed}s (max: ${maxPossibleScore})`)
      return Math.min(score, maxPossibleScore)
    }

    // Check 2: Time manipulation detection
    // If actual time elapsed is much less than game time, something is wrong
    const timeDifference = Math.abs(timePlayed - actualTimePlayed)
    if (timeDifference > 5 && actualTimePlayed < timePlayed * 0.5) {
      console.warn(`[BaseMiniGame] Time manipulation detected: game=${timePlayed}s, actual=${actualTimePlayed}s`)
      // Cap score based on actual time played
      return Math.min(score, Math.floor(actualTimePlayed * this.maxScorePerSecond))
    }

    // Check 3: Impossibly high score
    // Cap at 3x the perfect score as absolute maximum
    const perfectScore = this.gameData.perfectScore || ((this.gameData.targetScore || 100) * 1.5)
    const absoluteMax = perfectScore * 3
    if (score > absoluteMax) {
      console.warn(`[BaseMiniGame] Score exceeds absolute max: ${score} > ${absoluteMax}`)
      return absoluteMax
    }

    return score
  }

  /**
   * End the mini-game and transition to result screen
   *
   * IMPORTANT FIX NOTE (Dec 2024):
   * - Subclass handleSuccess() methods must NOT set this.isGameOver = true
   * - Only this endGame() method should set isGameOver
   * - Otherwise endGame() will exit early and result screen never appears
   * - Use a separate flag like successHandled in subclasses to prevent duplicate calls
   *
   * @param {boolean} success - Whether player won the mini-game
   */
  endGame(success) {
    console.log('[BaseMiniGame] endGame() called, success:', success)

    // VISIBLE DEBUG
    try {
      this.add.text(10, 50, 'DEBUG: endGame called - transitioning...', {
        fontSize: '14px',
        color: '#ffff00',
        backgroundColor: '#000000'
      }).setDepth(9999)
    } catch (e) {}

    if (this.isGameOver) {
      console.log('[BaseMiniGame] Already game over, ignoring')
      return
    }
    this.isGameOver = true

    // Disable curveball system
    if (this.curveballManager) {
      this.curveballManager.disable()
    }

    // Stop timer
    if (this.timerEvent) {
      this.timerEvent.destroy()
    }

    // Validate and potentially adjust score for anti-cheat
    const validatedScore = this.validateResult(this.score, this.timeRemaining)
    if (validatedScore !== this.score) {
      console.warn(`[BaseMiniGame] Score adjusted from ${this.score} to ${validatedScore}`)
      this.score = validatedScore
    }

    // Calculate result
    const targetScore = this.gameData.targetScore || 100
    const perfectScore = this.gameData.perfectScore || (targetScore * 1.5)
    const perfectRun = this.score >= perfectScore

    // Apply reward multiplier from progressive difficulty
    const difficultyRewardMult = this.gameData.rewardMultiplier || 1

    let bonusMultiplier = 1
    if (success) {
      const scoreRatio = this.score / targetScore
      bonusMultiplier = Math.min(2.5, 1 + (scoreRatio - 1) * 0.5)
      if (perfectRun) {
        bonusMultiplier *= 1.5
      }
      // Apply difficulty reward multiplier
      bonusMultiplier *= difficultyRewardMult
    } else {
      bonusMultiplier = 0.3
    }

    // Track curveballs survived (if player won while facing curveballs)
    const curveballsSurvived = success && this.curveballManager
      ? this.curveballManager.getCurveballCount()
      : 0

    const result = {
      success,
      score: this.score,
      perfectRun,
      timeRemaining: this.timeRemaining,
      bonusMultiplier: Math.round(bonusMultiplier * 100) / 100,
      crimeId: this.gameData.crimeId,
      difficultyTier: this.gameData.difficultyTier,
      rewardMultiplier: difficultyRewardMult,
      validated: true,
      curveballsSurvived // Track curveballs for stats
    }

    // Record minigame result for progressive difficulty tracking
    try {
      gameManager.recordMinigameResult(this.gameData.crimeId, result)
      console.log('[BaseMiniGame] Recorded result to GameManager')
    } catch (e) {
      console.warn('[BaseMiniGame] Failed to record result:', e)
    }

    console.log('[BaseMiniGame] Result calculated:', result)

    // Visual and audio feedback - wrap in try/catch to prevent blocking
    try {
      if (success) {
        AnimationHelper.successFlash(this, 300)
        if (perfectRun) {
          audioManager.playPerfect()
          ParticleHelper.successConfetti(this)
          ParticleHelper.levelUpExplosion(this)
        } else {
          audioManager.playMiniGameWin()
          ParticleHelper.xpSparkle(this, this.gameWidth / 2, this.gameHeight / 2)
        }
        AnimationHelper.cameraZoomIn(this, 1.05, 400)
      } else {
        AnimationHelper.cameraShake(this, 400, 0.03)
        AnimationHelper.failureFlash(this, 200)
        audioManager.playMiniGameLose()
        ParticleHelper.failSmoke(this, this.gameWidth / 2, this.gameHeight / 2)
      }
    } catch (e) {
      console.warn('[BaseMiniGame] Animation/audio error (non-fatal):', e)
    }

    // Capture references before transition
    const game = this.game
    const gameData = this.gameData
    const currentSceneKey = this.scene.key

    console.log('[BaseMiniGame] Game reference:', game ? 'valid' : 'null')
    console.log('[BaseMiniGame] Current scene key:', currentSceneKey)

    // CRITICAL: Reset camera state before transition to prevent colored screen bug
    try {
      this.cameras.main.setZoom(1)
      this.cameras.main.setAlpha(1)
      this.cameras.main.setBackgroundColor(0x000000)
      this.cameras.main.resetFX()
      // Stop any camera tweens
      this.tweens.killTweensOf(this.cameras.main)
      // Reset tween timescale
      this.tweens.timeScale = 1
    } catch (e) {
      console.warn('[BaseMiniGame] Camera reset warning:', e)
    }

    // Transition to result scene
    console.log('[BaseMiniGame] Starting transition to MiniGameResult')
    console.log('[BaseMiniGame] Result object:', JSON.stringify(result))
    console.log('[BaseMiniGame] GameData object:', JSON.stringify(gameData))

    // Use native setTimeout instead of Phaser's delayedCall to avoid race condition
    // (removeAllEvents() would kill the delayedCall before it executes)
    // CRITICAL: Capture scene reference BEFORE the timeout - 'this' may be stale after delay
    const sceneRef = this.scene
    const timeRef = this.time

    setTimeout(() => {
      console.log('[BaseMiniGame] setTimeout fired, attempting transition...')
      try {
        // Now safe to remove all time events
        try {
          if (timeRef && timeRef.removeAllEvents) {
            timeRef.removeAllEvents()
          }
        } catch (e) {
          console.warn('[BaseMiniGame] removeAllEvents error:', e)
        }

        console.log('[BaseMiniGame] Calling scene.start(MiniGameResult)...')
        console.log('[BaseMiniGame] game valid:', !!game)
        console.log('[BaseMiniGame] game.scene valid:', !!(game && game.scene))

        // CRITICAL FIX: Use game.scene instead of this.scene - 'this' may be stale
        if (game && game.scene) {
          // Stop current mini-game scene first
          try {
            game.scene.stop(currentSceneKey)
          } catch (e) {
            console.warn('[BaseMiniGame] Failed to stop current scene:', e)
          }

          // Start the result scene
          game.scene.start('MiniGameResult', {
            result,
            gameData
          })
          console.log('[BaseMiniGame] game.scene.start() completed successfully')
        } else if (sceneRef && sceneRef.start) {
          // Fallback to captured scene reference
          sceneRef.start('MiniGameResult', {
            result,
            gameData
          })
          console.log('[BaseMiniGame] sceneRef.start() completed successfully')
        } else {
          throw new Error('No valid scene reference available')
        }
      } catch (e) {
        console.error('[BaseMiniGame] Transition error:', e)
        this.fallbackTransition(game, result, gameData)
      }
    }, 50)
  }

  /**
   * Fallback transition when normal transition fails
   */
  fallbackTransition(game, result, gameData) {
    try {
      if (game && game.scene) {
        // Stop all mini-game scenes first
        const miniGameScenes = ['SnakeGame', 'LockPickGame', 'QTEGame', 'FroggerGame',
                                'MemoryGame', 'SteadyHandGame', 'ChaseGame', 'SniperGame',
                                'SafeCrackGame', 'WireGame', 'RhythmGame', 'HackingGame',
                                'GetawayGame', 'NegotiationGame', 'SurveillanceGame']
        miniGameScenes.forEach(key => {
          try {
            if (game.scene.isActive(key)) {
              game.scene.stop(key)
            }
          } catch (e) {}
        })

        game.scene.start('MiniGameResult', { result, gameData })
        console.log('[BaseMiniGame] Started MiniGameResult via fallback')
      } else {
        throw new Error('Game reference invalid')
      }
    } catch (e2) {
      console.error('[BaseMiniGame] Fallback failed:', e2)
      // Final fallback - go to GameScene
      try {
        if (game && game.scene) {
          game.scene.start('GameScene')
        }
      } catch (e3) {
        console.error('[BaseMiniGame] All transitions failed:', e3)
      }
    }
  }

  // Override in subclasses - but call super.update() first!
  update(time, delta) {
    if (this.isPaused || this.isGameOver) return

    // Update curveball manager
    if (this.curveballManager) {
      this.curveballManager.update(this.timeRemaining, this.gameData.timeLimit || 30)
    }

    // Process delayed inputs (for input lag curveball)
    this.processDelayedInputs()

    // Subclasses implement additional game logic
  }

  /**
   * Cleanup when scene shuts down
   * Subclasses should call super.shutdown() if they override this
   */
  shutdown() {
    console.log('[BaseMiniGame] shutdown called')

    // Stop timer
    if (this.timerEvent) {
      this.timerEvent.destroy()
      this.timerEvent = null
    }

    // Disable curveball manager
    if (this.curveballManager) {
      try {
        this.curveballManager.disable()
      } catch (e) {}
    }

    // Remove event listeners
    this.events.off('curveballStart', this.onCurveballStart, this)
    this.events.off('curveballEnd', this.onCurveballEnd, this)

    // Clear pending inputs
    this.pendingInputs = []

    // Stop all tweens
    try {
      this.tweens.killAll()
    } catch (e) {}

    // Stop all time events
    try {
      this.time.removeAllEvents()
    } catch (e) {}

    // Reset camera state to ensure clean transition
    try {
      this.cameras.main.setZoom(1)
      this.cameras.main.setAlpha(1)
      this.cameras.main.resetFX()
      this.cameras.main.setScroll(0, 0)
      this.tweens.timeScale = 1
    } catch (e) {}
  }
}

// Export CURVEBALL_TYPES for subclasses to use
export { CURVEBALL_TYPES }
export default BaseMiniGame
