// Mini-Game Result Scene - Enhanced High-End Version
// Celebratory result screen with particles, animations, and achievements

import Phaser from 'phaser'
import { audioManager, AUDIO_KEYS } from '../../managers/AudioManager'
import { COLORS, SYMBOLS, getTerminalStyle, toHexString, BORDERS, FONT_SIZES } from '../../ui/NetworkTheme'
import { gameManager } from '../../GameManager'

// Performance tier thresholds
const PERFORMANCE_TIERS = {
  FAILED: { name: 'FAILED', threshold: 0, color: 0xff0040, icon: '💀', mult: 0.3 },
  BRONZE: { name: 'BRONZE', threshold: 0.5, color: 0xcd7f32, icon: '🥉', mult: 1.0 },
  SILVER: { name: 'SILVER', threshold: 0.75, color: 0xc0c0c0, icon: '🥈', mult: 1.5 },
  GOLD: { name: 'GOLD', threshold: 1.0, color: 0xffd700, icon: '🥇', mult: 2.0 },
  PERFECT: { name: 'PERFECT', threshold: 1.25, color: 0x00ffaa, icon: '💎', mult: 3.0 }
}

export class MiniGameResult extends Phaser.Scene {
  constructor() {
    super({ key: 'MiniGameResult' })

    this.result = null
    this.gameData = null
    this.particles = []
    this.streakCount = 0
    this.isNewHighScore = false
    this.performanceTier = null
  }

  init(data) {
    console.log('[MiniGameResult] init() called with data:', data)
    this.result = data?.result || null
    this.gameData = data?.gameData || null
    this.isFinishing = false
    this.particles = []
  }

  create() {
    console.log('[MiniGameResult] ========== CREATE STARTED ==========')
    console.log('[MiniGameResult] Result:', this.result)
    console.log('[MiniGameResult] GameData:', this.gameData)

    // CRITICAL: Set up emergency exit IMMEDIATELY before anything else can fail
    // This ensures users can always exit even if something crashes
    this.setupEmergencyExit()

    // VISIBLE DEBUG - Add text at top of screen to confirm scene is running
    try {
      this.cameras.main.setBackgroundColor(0x000000)
      this.debugText = this.add.text(10, 10, 'MiniGameResult loaded - processing...', {
        fontSize: '12px',
        color: '#00ff00',
        backgroundColor: '#000000'
      }).setDepth(9999)
    } catch (e) {
      console.error('[MiniGameResult] Failed to add debug text:', e)
    }

    try {
      this._createInternal()
      // Update debug text on success
      if (this.debugText) {
        this.debugText.setText('Result ready - tap to continue')
      }
    } catch (e) {
      console.error('[MiniGameResult] CRITICAL ERROR IN CREATE:', e)
      // Update debug text to show error
      try {
        if (this.debugText) {
          this.debugText.setText('ERROR: ' + e.message + ' - tap to exit')
          this.debugText.setColor('#ff0000')
        }
      } catch (e2) {}
    }
  }

  setupEmergencyExit() {
    console.log('[MiniGameResult] Setting up emergency exit')

    // Capture game reference immediately
    const game = this.game

    // Helper function to safely exit
    const safeExit = () => {
      console.log('[MiniGameResult] Safe exit triggered')
      if (this.isFinishing) return
      this.isFinishing = true

      try {
        // Try normal scene transition first
        if (game && game.scene) {
          game.scene.stop('MiniGameResult')
          game.scene.start('CrimeScene')
          console.log('[MiniGameResult] Exited via game.scene')
          return
        }
      } catch (e) {
        console.warn('[MiniGameResult] game.scene exit failed:', e)
      }

      try {
        // Try this.scene as fallback
        this.scene.start('CrimeScene')
        console.log('[MiniGameResult] Exited via this.scene')
        return
      } catch (e) {
        console.warn('[MiniGameResult] this.scene exit failed:', e)
      }

      // Last resort - reload the page
      console.log('[MiniGameResult] All exits failed, reloading page')
      window.location.reload()
    }

    // Multiple exit mechanisms for reliability

    // 1. Phaser input (if available)
    try {
      this.input.once('pointerdown', safeExit)
    } catch (e) {
      console.warn('[MiniGameResult] Failed to set up Phaser input:', e)
    }

    // 2. DOM click handler as backup
    const clickHandler = () => {
      console.log('[MiniGameResult] DOM click emergency exit')
      document.removeEventListener('click', clickHandler)
      document.removeEventListener('touchstart', clickHandler)
      safeExit()
    }
    document.addEventListener('click', clickHandler, { once: true })
    document.addEventListener('touchstart', clickHandler, { once: true })

    // 3. Keyboard handler
    const keyHandler = (e) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        console.log('[MiniGameResult] Keyboard emergency exit')
        document.removeEventListener('keydown', keyHandler)
        safeExit()
      }
    }
    document.addEventListener('keydown', keyHandler)

    // 4. Auto-exit after 8 seconds as final failsafe
    this.emergencyTimeout = setTimeout(() => {
      console.log('[MiniGameResult] Auto emergency exit after 8s')
      safeExit()
    }, 8000)
  }

  _createInternal() {
    // CRITICAL: Mark scene as interactive immediately
    this.input.enabled = true
    console.log('[MiniGameResult] Input enabled')

    // CRITICAL: Reset camera state first to prevent colored screen bug
    try {
      this.cameras.main.setZoom(1)
      this.cameras.main.setAlpha(1)
      this.cameras.main.resetFX()
      this.cameras.main.setScroll(0, 0)
      this.tweens.timeScale = 1
      // Stop any lingering camera tweens
      this.tweens.killTweensOf(this.cameras.main)
      console.log('[MiniGameResult] Camera reset done')
    } catch (e) {
      console.warn('[MiniGameResult] Camera reset warning:', e)
    }

    // CRITICAL: Bring this scene to top
    this.scene.bringToTop()
    console.log('[MiniGameResult] Scene brought to top')

    // Stop all other mini-game scenes that might still be running
    try {
      const miniGameScenes = ['SnakeGame', 'LockPickGame', 'QTEGame', 'FroggerGame',
                              'MemoryGame', 'SteadyHandGame', 'ChaseGame', 'SniperGame',
                              'SafeCrackGame', 'WireGame', 'RhythmGame', 'HackingGame',
                              'GetawayGame', 'NegotiationGame', 'SurveillanceGame']
      miniGameScenes.forEach(key => {
        try {
          if (this.scene.isActive(key) || this.scene.isPaused(key)) {
            this.scene.stop(key)
          }
        } catch (e) {}
      })
    } catch (e) {}

    // Disable GameScene input
    try {
      const gameScene = this.scene.get('GameScene')
      if (gameScene && gameScene.input) {
        gameScene.input.enabled = false
      }
    } catch (e) {}

    // Safety defaults
    if (!this.result) {
      this.result = {
        success: false,
        score: 0,
        perfectRun: false,
        timeRemaining: 0,
        bonusMultiplier: 0.3
      }
    }

    if (!this.gameData) {
      this.gameData = {
        returnScene: 'CrimeScene',
        crimeName: 'Unknown'
      }
    }

    const { width, height } = this.scale
    const centerX = width / 2

    // Calculate performance tier
    const targetScore = this.gameData.targetScore || 100
    const scoreRatio = this.result.score / targetScore
    this.performanceTier = this.getPerformanceTier(scoreRatio, this.result.success)

    // Get streak info
    this.streakCount = this.getWinStreak()
    this.isNewHighScore = this.checkHighScore()

    // Create animated background
    this.createAnimatedBackground(width, height)

    // Create celebration particles based on performance
    if (this.result.success) {
      this.createCelebrationParticles(centerX, height)
    }

    // Close button
    this.createCloseButton(width)

    // Animated result icon with effects
    this.createResultIcon(centerX)

    // Title with dramatic reveal
    this.createTitle(centerX)

    // Stats panel with rolling counters
    this.createStatsPanel(centerX, width, height)

    // Achievement notification area
    this.createAchievementDisplay(centerX, height)

    // Continue button with glow
    this.createContinueButton(centerX, height, width)

    // Input handlers
    this.setupInputHandlers(height)

    // Auto-exit failsafe using native setTimeout (more reliable than Phaser's delayedCall)
    // 10 seconds should be enough time to see the results, then auto-exit
    this.autoExitTimeout = setTimeout(() => {
      console.log('[MiniGameResult] Auto-exit timeout triggered after 10s')
      if (!this.isFinishing) {
        this.finish()
      }
    }, 10000)

    // Fade in
    this.cameras.main.fadeIn(300)
    console.log('[MiniGameResult] Fade in started')

    // Play appropriate sound
    console.log('[MiniGameResult] Playing sound...')
    if (this.result.success) {
      if (this.result.perfectRun || this.performanceTier.name === 'PERFECT') {
        audioManager.playPerfect()
      } else {
        audioManager.playMiniGameWin()
      }
    } else {
      audioManager.playMiniGameLose()
    }

    console.log('[MiniGameResult] ========== CREATE COMPLETED ==========')
  }

  getPerformanceTier(scoreRatio, success) {
    if (!success || scoreRatio < PERFORMANCE_TIERS.BRONZE.threshold) {
      return PERFORMANCE_TIERS.FAILED
    }
    if (scoreRatio >= PERFORMANCE_TIERS.PERFECT.threshold) {
      return PERFORMANCE_TIERS.PERFECT
    }
    if (scoreRatio >= PERFORMANCE_TIERS.GOLD.threshold) {
      return PERFORMANCE_TIERS.GOLD
    }
    if (scoreRatio >= PERFORMANCE_TIERS.SILVER.threshold) {
      return PERFORMANCE_TIERS.SILVER
    }
    return PERFORMANCE_TIERS.BRONZE
  }

  getWinStreak() {
    try {
      const player = gameManager.getPlayer()
      return player?.mini_game_streak || 0
    } catch (e) {
      return 0
    }
  }

  checkHighScore() {
    try {
      const player = gameManager.getPlayer()
      const crimeId = this.gameData.crimeId || this.result.crimeId
      if (!crimeId || !player?.mini_game_high_scores) return false
      const previousHigh = player.mini_game_high_scores[crimeId] || 0
      return this.result.score > previousHigh
    } catch (e) {
      return false
    }
  }

  createAnimatedBackground(width, height) {
    // Base dark background
    this.add.rectangle(width / 2, height / 2, width, height, COLORS.bg.void).setDepth(0)

    // Gradient overlay based on result
    const graphics = this.add.graphics().setDepth(1)
    const color = this.performanceTier.color
    graphics.fillGradientStyle(color, color, COLORS.bg.void, COLORS.bg.void, 0.35, 0.35, 0, 0)
    graphics.fillRect(0, 0, width, height / 2)

    // Create floating particles in background
    for (let i = 0; i < 20; i++) {
      const particle = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 3),
        color,
        Phaser.Math.FloatBetween(0.1, 0.3)
      ).setDepth(2)

      this.tweens.add({
        targets: particle,
        y: particle.y - 100,
        alpha: 0,
        duration: Phaser.Math.Between(3000, 6000),
        repeat: -1,
        yoyo: false,
        onRepeat: () => {
          particle.y = height + 20
          particle.x = Phaser.Math.Between(0, width)
          particle.alpha = Phaser.Math.FloatBetween(0.1, 0.3)
        }
      })
      this.particles.push(particle)
    }

    // Scanline effect
    for (let y = 0; y < height; y += 4) {
      this.add.rectangle(width / 2, y, width, 1, 0x000000, 0.1).setDepth(3)
    }

    // Vignette effect using corner rectangles with alpha gradient simulation
    // Top edge
    this.add.rectangle(width / 2, 0, width, 60, 0x000000, 0.4).setOrigin(0.5, 0).setDepth(4)
    // Bottom edge
    this.add.rectangle(width / 2, height, width, 60, 0x000000, 0.4).setOrigin(0.5, 1).setDepth(4)
    // Left edge
    this.add.rectangle(0, height / 2, 40, height, 0x000000, 0.3).setOrigin(0, 0.5).setDepth(4)
    // Right edge
    this.add.rectangle(width, height / 2, 40, height, 0x000000, 0.3).setOrigin(1, 0.5).setDepth(4)
  }

  createCelebrationParticles(centerX, height) {
    const tier = this.performanceTier

    // Different particle counts based on tier
    const particleCounts = {
      BRONZE: 15,
      SILVER: 25,
      GOLD: 40,
      PERFECT: 60
    }
    const count = particleCounts[tier.name] || 10

    // Burst of particles from center
    for (let i = 0; i < count; i++) {
      const delay = i * 20
      this.time.delayedCall(delay, () => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
        const speed = Phaser.Math.Between(100, 250)
        const size = Phaser.Math.Between(3, 8)

        // Random color from tier palette
        const colors = tier.name === 'PERFECT'
          ? [0x00ffaa, 0x00ff88, 0xffd700, 0xff88ff, 0x88ffff]
          : tier.name === 'GOLD'
          ? [0xffd700, 0xffaa00, 0xffff00, 0xffcc00]
          : tier.name === 'SILVER'
          ? [0xc0c0c0, 0xa0a0a0, 0xe0e0e0, 0xffffff]
          : [0xcd7f32, 0xaa6633, 0xcc8844]

        const color = colors[Math.floor(Math.random() * colors.length)]

        const particle = this.add.circle(centerX, 140, size, color, 0.9).setDepth(50)

        this.tweens.add({
          targets: particle,
          x: centerX + Math.cos(angle) * speed,
          y: 140 + Math.sin(angle) * speed * 0.7,
          alpha: 0,
          scale: 0.3,
          duration: 1200,
          ease: 'Quad.out',
          onComplete: () => particle.destroy()
        })

        this.particles.push(particle)
      })
    }

    // Confetti for Gold/Perfect
    if (tier.name === 'GOLD' || tier.name === 'PERFECT') {
      this.time.delayedCall(200, () => this.createConfetti(centerX, height))
    }

    // Rainbow ring for Perfect
    if (tier.name === 'PERFECT') {
      this.createRainbowRing(centerX, 140)
    }
  }

  createConfetti(centerX, height) {
    const confettiColors = [0xff0040, 0x00ff41, 0xffd700, 0x00aaff, 0xff88ff, 0xffaa00]

    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(20, this.scale.width - 20)
      const color = confettiColors[Math.floor(Math.random() * confettiColors.length)]
      const size = Phaser.Math.Between(4, 10)
      const isRect = Math.random() > 0.5

      const confetti = isRect
        ? this.add.rectangle(x, -20, size, size * 2, color, 0.9)
        : this.add.circle(x, -20, size / 2, color, 0.9)

      confetti.setDepth(55)
      confetti.setRotation(Math.random() * Math.PI * 2)

      const fallDuration = Phaser.Math.Between(2000, 4000)
      const swayAmount = Phaser.Math.Between(30, 80)

      // Falling motion with sway
      this.tweens.add({
        targets: confetti,
        y: height + 50,
        rotation: confetti.rotation + Phaser.Math.Between(3, 6) * (Math.random() > 0.5 ? 1 : -1),
        duration: fallDuration,
        ease: 'Linear',
        onComplete: () => confetti.destroy()
      })

      // Sway motion
      this.tweens.add({
        targets: confetti,
        x: x + swayAmount * (Math.random() > 0.5 ? 1 : -1),
        duration: fallDuration / 3,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.inOut'
      })

      this.particles.push(confetti)
    }
  }

  createRainbowRing(x, y) {
    const ringColors = [0xff0040, 0xffaa00, 0xffff00, 0x00ff41, 0x00aaff, 0x8b00ff]

    ringColors.forEach((color, i) => {
      const ring = this.add.circle(x, y, 90 + i * 3, color, 0).setDepth(10)
      ring.setStrokeStyle(2, color, 0.8)

      this.tweens.add({
        targets: ring,
        scaleX: 1.8,
        scaleY: 1.8,
        alpha: 0,
        duration: 1500,
        delay: i * 80,
        ease: 'Quad.out',
        onComplete: () => ring.destroy()
      })
    })
  }

  createCloseButton(width) {
    const closeBtnBg = this.add.circle(width - 30, 30, 22, COLORS.bg.panel, 0.95)
      .setDepth(100)
      .setStrokeStyle(BORDERS.medium, COLORS.network.dim, 0.8)

    const closeBtn = this.add.text(width - 30, 30, SYMBOLS.close, {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.text.secondary)
    }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => {
      closeBtn.setColor(toHexString(COLORS.status.danger))
      closeBtnBg.setFillStyle(COLORS.bg.elevated)
      closeBtnBg.setStrokeStyle(BORDERS.medium, COLORS.status.danger, 1)
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor(toHexString(COLORS.text.secondary))
      closeBtnBg.setFillStyle(COLORS.bg.panel, 0.95)
      closeBtnBg.setStrokeStyle(BORDERS.medium, COLORS.network.dim, 0.8)
    })
    closeBtn.on('pointerdown', () => this.finish())
  }

  createResultIcon(centerX) {
    const tier = this.performanceTier
    const color = tier.color

    // Outer pulsing ring
    const outerRing = this.add.circle(centerX, 140, 85, color, 0.1).setDepth(20)
    if (this.result.success) {
      this.tweens.add({
        targets: outerRing,
        scaleX: 1.3,
        scaleY: 1.3,
        alpha: 0,
        duration: 1200,
        repeat: -1,
        ease: 'Quad.out'
      })
    }

    // Inner glow circle
    const innerGlow = this.add.circle(centerX, 140, 70, color, 0.2).setDepth(21)

    // Main icon background
    const iconBg = this.add.circle(centerX, 140, 60, COLORS.bg.panel, 0.95).setDepth(22)
    iconBg.setStrokeStyle(3, color, 0.9)

    // Icon emoji
    const icon = this.add.text(centerX, 140, tier.icon, {
      fontSize: '48px'
    }).setOrigin(0.5).setDepth(23)

    // Bounce in animation
    icon.setScale(0)
    this.tweens.add({
      targets: icon,
      scale: 1,
      duration: 600,
      ease: 'Back.out',
      delay: 100
    })

    // Spin for perfect
    if (tier.name === 'PERFECT') {
      this.tweens.add({
        targets: icon,
        angle: 360,
        duration: 1000,
        delay: 200,
        ease: 'Quad.out'
      })

      // Sparkle effect around icon
      this.createSparkles(centerX, 140)
    }

    // Glow pulse for success
    if (this.result.success) {
      this.tweens.add({
        targets: innerGlow,
        alpha: { from: 0.2, to: 0.4 },
        scaleX: { from: 1, to: 1.1 },
        scaleY: { from: 1, to: 1.1 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      })
    }
  }

  createSparkles(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const sparkle = this.add.text(
        x + Math.cos(angle) * 75,
        y + Math.sin(angle) * 75,
        '✨',
        { fontSize: '16px' }
      ).setOrigin(0.5).setDepth(25).setAlpha(0)

      this.tweens.add({
        targets: sparkle,
        alpha: { from: 0, to: 1 },
        y: sparkle.y - 10,
        scale: { from: 0.5, to: 1.2 },
        duration: 600,
        delay: i * 100,
        yoyo: true,
        repeat: -1,
        hold: 500
      })
    }
  }

  createTitle(centerX) {
    const tier = this.performanceTier

    // Title text
    const titleTexts = {
      FAILED: `${SYMBOLS.alert} BUSTED`,
      BRONZE: `${SYMBOLS.check} COMPLETED`,
      SILVER: `${SYMBOLS.star} SOLID WORK`,
      GOLD: `${SYMBOLS.star}${SYMBOLS.star} EXCELLENT`,
      PERFECT: `💎 LEGENDARY 💎`
    }

    const title = this.add.text(centerX, 230, titleTexts[tier.name], {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: tier.name === 'PERFECT' ? '26px' : '24px',
      color: toHexString(tier.color),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(30)

    // Pop-in animation
    title.setScale(0)
    this.tweens.add({
      targets: title,
      scale: 1,
      duration: 400,
      delay: 250,
      ease: 'Back.out'
    })

    // Glow for Gold/Perfect
    if (tier.name === 'GOLD' || tier.name === 'PERFECT') {
      const glow = this.add.text(centerX, 230, titleTexts[tier.name], {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: tier.name === 'PERFECT' ? '26px' : '24px',
        color: toHexString(tier.color),
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(29).setAlpha(0.4).setBlendMode('ADD')

      glow.setScale(0)
      this.tweens.add({
        targets: glow,
        scale: 1.05,
        alpha: { from: 0.4, to: 0.6 },
        duration: 800,
        delay: 250,
        yoyo: true,
        repeat: -1
      })
    }

    // Subtitle
    const subtitles = {
      FAILED: ['SIGNAL LOST', 'CONNECTION TERMINATED', 'TRY AGAIN'],
      BRONZE: ['JOB DONE', 'KEEP GRINDING', 'ROOM TO GROW'],
      SILVER: ['NICE MOVES', 'GETTING BETTER', 'SOLID RUN'],
      GOLD: ['ELITE PERFORMANCE', 'IMPRESSIVE SKILLS', 'TOP TIER'],
      PERFECT: ['FLAWLESS EXECUTION', 'MASTERFUL', 'LEGENDARY STATUS']
    }

    const subArray = subtitles[tier.name] || subtitles.BRONZE
    const subtitle = subArray[Math.floor(Math.random() * subArray.length)]

    const subText = this.add.text(centerX, 262, `${SYMBOLS.system} ${subtitle}`, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setDepth(30).setAlpha(0)

    this.tweens.add({
      targets: subText,
      alpha: 1,
      y: 260,
      duration: 300,
      delay: 500
    })
  }

  createStatsPanel(centerX, width, height) {
    const panelY = 310
    const panelWidth = Math.min(340, width - 40)
    const tier = this.performanceTier

    // Panel background with glow
    const panelGlow = this.add.rectangle(centerX, panelY + 85, panelWidth + 8, 220, tier.color, 0.15)
      .setDepth(39)

    const panelBg = this.add.rectangle(centerX, panelY + 85, panelWidth, 216, COLORS.bg.panel, 0.98)
      .setStrokeStyle(2, tier.color, 0.7)
      .setDepth(40)

    // Panel header
    const headerBg = this.add.rectangle(centerX, panelY + 2, panelWidth, 28, COLORS.bg.elevated)
      .setDepth(41)
    this.add.text(centerX, panelY + 2, `${SYMBOLS.system} RESULTS`, {
      ...getTerminalStyle('md'),
      color: toHexString(tier.color)
    }).setOrigin(0.5).setDepth(42)

    // Performance tier badge
    const tierBadgeY = panelY + 30
    const tierBadgeBg = this.add.rectangle(centerX, tierBadgeY, 120, 26, tier.color, 0.2)
      .setStrokeStyle(1, tier.color, 0.8).setDepth(41)
    const tierBadgeText = this.add.text(centerX, tierBadgeY, `${tier.icon} ${tier.name} ${tier.icon}`, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '12px',
      color: toHexString(tier.color),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(42)

    // Pulse animation for badge
    if (tier.name !== 'FAILED') {
      this.tweens.add({
        targets: [tierBadgeBg, tierBadgeText],
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      })
    }

    // Stats rows
    let rowY = panelY + 60

    // Score with rolling counter
    const scoreRow = this.createStatRow(centerX, rowY, '🎯', 'SCORE', '0', toHexString(COLORS.text.primary), panelWidth)
    this.animateCounter(scoreRow.valueText, 0, this.result.score, 800)
    rowY += 32

    // Cash earned
    const baseCash = this.gameData.baseCashReward || 500
    const cashEarned = Math.floor(baseCash * this.result.bonusMultiplier)
    const cashRow = this.createStatRow(centerX, rowY, '💵', 'CASH', '$0', toHexString(COLORS.network.primary), panelWidth)
    this.time.delayedCall(200, () => {
      this.animateCounter(cashRow.valueText, 0, cashEarned, 1000, '$')
      // Cash particle burst
      if (cashEarned > 0) {
        this.createCashBurst(centerX + panelWidth/2 - 30, rowY)
      }
    })
    rowY += 32

    // XP earned
    const baseXp = this.gameData.baseXpReward || 50
    const xpEarned = Math.floor(baseXp * this.result.bonusMultiplier)
    const xpRow = this.createStatRow(centerX, rowY, '⚡', 'EXPERIENCE', '+0', toHexString(COLORS.status.warning), panelWidth)
    this.time.delayedCall(400, () => {
      this.animateCounter(xpRow.valueText, 0, xpEarned, 800, '+', ' XP')
    })
    rowY += 32

    // Bonus multiplier display
    if (this.result.bonusMultiplier > 1) {
      const multBg = this.add.rectangle(centerX, rowY, 140, 26, COLORS.status.info, 0.15)
        .setStrokeStyle(1, COLORS.status.info, 0.6).setDepth(41)
      const multText = this.add.text(centerX, rowY, `${SYMBOLS.transmit} ${this.result.bonusMultiplier.toFixed(2)}x BONUS`, {
        ...getTerminalStyle('sm'),
        color: toHexString(COLORS.status.info),
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(42)

      // Shine effect
      this.tweens.add({
        targets: multBg,
        alpha: { from: 0.15, to: 0.3 },
        duration: 600,
        yoyo: true,
        repeat: -1
      })
      rowY += 32
    }

    // Win streak display
    if (this.result.success && this.streakCount > 1) {
      rowY += 4
      const streakColor = this.streakCount >= 10 ? COLORS.cred.gold :
                          this.streakCount >= 5 ? COLORS.status.warning : COLORS.network.primary
      const streakBg = this.add.rectangle(centerX, rowY, 160, 26, streakColor, 0.15)
        .setStrokeStyle(1, streakColor, 0.6).setDepth(41)

      const fireEmoji = this.streakCount >= 10 ? '🔥🔥' : this.streakCount >= 5 ? '🔥' : '⚡'
      const streakText = this.add.text(centerX, rowY, `${fireEmoji} ${this.streakCount} WIN STREAK ${fireEmoji}`, {
        ...getTerminalStyle('sm'),
        color: toHexString(streakColor),
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(42)

      // Streak pulse
      this.tweens.add({
        targets: [streakBg, streakText],
        scaleX: 1.08,
        scaleY: 1.08,
        duration: 500,
        yoyo: true,
        repeat: -1
      })

      // Streak bonus display
      const streakBonus = this.getStreakBonus(this.streakCount)
      if (streakBonus > 0) {
        rowY += 22
        this.add.text(centerX, rowY, `+${Math.round(streakBonus * 100)}% STREAK BONUS`, {
          ...getTerminalStyle('xs'),
          color: toHexString(streakColor)
        }).setOrigin(0.5).setDepth(42)
      }
    }

    // New high score display
    if (this.isNewHighScore) {
      rowY += 30
      const highScoreBg = this.add.rectangle(centerX, rowY, 180, 28, COLORS.cred.gold, 0.2)
        .setStrokeStyle(2, COLORS.cred.gold, 0.8).setDepth(41)
      const highScoreText = this.add.text(centerX, rowY, `🏆 NEW HIGH SCORE! 🏆`, {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '13px',
        color: toHexString(COLORS.cred.gold),
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(42)

      // Celebrate animation
      this.tweens.add({
        targets: [highScoreBg, highScoreText],
        scaleX: { from: 0, to: 1.1 },
        scaleY: { from: 0, to: 1.1 },
        duration: 400,
        delay: 600,
        ease: 'Back.out',
        onComplete: () => {
          this.tweens.add({
            targets: [highScoreBg, highScoreText],
            scaleX: 1.05,
            scaleY: 1.05,
            alpha: { from: 1, to: 0.9 },
            duration: 500,
            yoyo: true,
            repeat: -1
          })
        }
      })

      // Star burst
      this.time.delayedCall(800, () => this.createStarBurst(centerX, rowY))
    }
  }

  createStatRow(x, y, icon, label, value, valueColor, panelWidth) {
    const leftX = x - panelWidth / 2 + 20
    const rightX = x + panelWidth / 2 - 20

    this.add.text(leftX, y, icon, { fontSize: '18px' }).setOrigin(0, 0.5).setDepth(42)
    this.add.text(leftX + 28, y, label, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0, 0.5).setDepth(42)

    const valueText = this.add.text(rightX, y, value, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '15px',
      color: valueColor,
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(42)

    return { valueText }
  }

  animateCounter(textObject, from, to, duration, prefix = '', suffix = '') {
    const obj = { value: from }
    this.tweens.add({
      targets: obj,
      value: to,
      duration: duration,
      ease: 'Quad.out',
      onUpdate: () => {
        const val = Math.floor(obj.value)
        textObject.setText(`${prefix}${val.toLocaleString()}${suffix}`)
      }
    })
  }

  createCashBurst(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2
      const cash = this.add.text(x, y, '💰', { fontSize: '12px' }).setOrigin(0.5).setDepth(50)

      this.tweens.add({
        targets: cash,
        x: x + Math.cos(angle) * 40,
        y: y + Math.sin(angle) * 30,
        alpha: 0,
        scale: 0.5,
        duration: 600,
        delay: i * 30,
        ease: 'Quad.out',
        onComplete: () => cash.destroy()
      })
    }
  }

  createStarBurst(x, y) {
    const stars = ['⭐', '✨', '🌟']
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2
      const star = this.add.text(x, y, stars[i % 3], { fontSize: '14px' }).setOrigin(0.5).setDepth(60)

      this.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * 80,
        y: y + Math.sin(angle) * 50,
        alpha: 0,
        scale: 0.3,
        rotation: Math.random() * Math.PI,
        duration: 800,
        delay: i * 40,
        ease: 'Quad.out',
        onComplete: () => star.destroy()
      })
    }
  }

  getStreakBonus(streak) {
    if (streak >= 25) return 0.50
    if (streak >= 10) return 0.35
    if (streak >= 5) return 0.20
    if (streak >= 3) return 0.10
    return 0
  }

  createAchievementDisplay(centerX, height) {
    // Check for any new achievements
    const newAchievements = this.checkNewAchievements()

    if (newAchievements.length > 0) {
      let achY = height - 180

      newAchievements.forEach((ach, i) => {
        this.time.delayedCall(1000 + i * 600, () => {
          // Achievement slide-in panel
          const achBg = this.add.rectangle(centerX, achY, 280, 45, COLORS.cred.gold, 0.15)
            .setStrokeStyle(2, COLORS.cred.gold, 0.8).setDepth(70)
          achBg.setScale(0, 1)

          const achIcon = this.add.text(centerX - 120, achY, '🏆', { fontSize: '24px' })
            .setOrigin(0, 0.5).setDepth(71).setAlpha(0)

          const achTitle = this.add.text(centerX - 90, achY - 8, 'ACHIEVEMENT UNLOCKED!', {
            ...getTerminalStyle('xs'),
            color: toHexString(COLORS.cred.gold)
          }).setOrigin(0, 0.5).setDepth(71).setAlpha(0)

          const achName = this.add.text(centerX - 90, achY + 8, ach.name, {
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '12px',
            color: '#ffffff',
            fontStyle: 'bold'
          }).setOrigin(0, 0.5).setDepth(71).setAlpha(0)

          // Slide in animation
          this.tweens.add({
            targets: achBg,
            scaleX: 1,
            duration: 400,
            ease: 'Back.out',
            onComplete: () => {
              this.tweens.add({
                targets: [achIcon, achTitle, achName],
                alpha: 1,
                duration: 200
              })
            }
          })

          // Play achievement sound
          audioManager.playLevelUp()

          achY += 55
        })
      })
    }
  }

  checkNewAchievements() {
    // Check for newly unlocked achievements
    const achievements = []

    try {
      const player = gameManager.getPlayer()
      if (!player) return achievements

      // Check streak achievements
      const streak = player.mini_game_streak || 0
      const streakMilestones = [3, 5, 10, 25, 50]

      streakMilestones.forEach(milestone => {
        if (streak === milestone) {
          achievements.push({
            name: `${milestone} Win Streak!`,
            benefit: `+${milestone >= 10 ? '35' : milestone >= 5 ? '20' : '10'}% rewards`
          })
        }
      })

      // Check perfect run achievements
      if (this.result.perfectRun) {
        const perfectCount = (player.stats?.perfect_runs || 0) + 1
        if ([1, 10, 25, 50].includes(perfectCount)) {
          achievements.push({
            name: `${perfectCount === 1 ? 'First' : perfectCount} Perfect Run${perfectCount > 1 ? 's' : ''}!`,
            benefit: '+15% XP from mini-games'
          })
        }
      }

      // New high score achievement
      if (this.isNewHighScore) {
        achievements.push({
          name: 'New Personal Best!',
          benefit: 'High score recorded'
        })
      }
    } catch (e) {
      console.warn('[MiniGameResult] Achievement check error:', e)
    }

    return achievements.slice(0, 2) // Max 2 achievements shown
  }

  createContinueButton(centerX, height, width) {
    const btnY = height - 60
    const tier = this.performanceTier
    const btnColor = this.result.success ? tier.color : COLORS.status.info

    // Button glow
    const btnGlow = this.add.rectangle(centerX, btnY, 220, 52, btnColor, 0.25).setDepth(80)
    this.tweens.add({
      targets: btnGlow,
      scaleX: 1.2,
      scaleY: 1.4,
      alpha: 0,
      duration: 1200,
      repeat: -1
    })

    // Check if we can replay this activity
    const canPlayAgain = this.gameData?.crimeId || this.gameData?.jobId

    // Button layout - if we can play again, show two buttons side by side
    const btnWidth = canPlayAgain ? 140 : 210
    const continueX = canPlayAgain ? centerX + 75 : centerX
    const playAgainX = centerX - 75

    // Continue/Collect button
    const btn = this.add.rectangle(continueX, btnY, btnWidth, 48, COLORS.bg.panel)
      .setStrokeStyle(3, btnColor, 0.9)
      .setDepth(81)
      .setInteractive({ useHandCursor: true })

    const btnLabel = this.result.success ? 'COLLECT' : 'CONTINUE'
    const btnIcon = this.result.success ? '💰' : SYMBOLS.forward
    const btnText = this.add.text(continueX, btnY, `${btnIcon} ${btnLabel}`, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '13px',
      color: toHexString(btnColor),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(82)

    // Hover effects for continue button
    btn.on('pointerover', () => {
      btn.setFillStyle(btnColor, 0.2)
      btn.setStrokeStyle(4, btnColor, 1)
      this.tweens.add({
        targets: [btn, btnText],
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100
      })
      audioManager.playHover()
    })

    btn.on('pointerout', () => {
      btn.setFillStyle(COLORS.bg.panel)
      btn.setStrokeStyle(3, btnColor, 0.9)
      this.tweens.add({
        targets: [btn, btnText],
        scaleX: 1,
        scaleY: 1,
        duration: 100
      })
    })

    btn.on('pointerdown', () => {
      try {
        audioManager.playClick()
      } catch (e) {}
      this.finish()
    })

    // Play Again button (if applicable)
    if (canPlayAgain) {
      const playAgainColor = 0x8b5cf6 // Purple

      const playAgainBtn = this.add.rectangle(playAgainX, btnY, btnWidth, 48, COLORS.bg.panel)
        .setStrokeStyle(3, playAgainColor, 0.9)
        .setDepth(81)
        .setInteractive({ useHandCursor: true })

      const playAgainText = this.add.text(playAgainX, btnY, '🔄 PLAY AGAIN', {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '13px',
        color: toHexString(playAgainColor),
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(82)

      playAgainBtn.on('pointerover', () => {
        playAgainBtn.setFillStyle(playAgainColor, 0.2)
        playAgainBtn.setStrokeStyle(4, playAgainColor, 1)
        this.tweens.add({
          targets: [playAgainBtn, playAgainText],
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100
        })
        audioManager.playHover()
      })

      playAgainBtn.on('pointerout', () => {
        playAgainBtn.setFillStyle(COLORS.bg.panel)
        playAgainBtn.setStrokeStyle(3, playAgainColor, 0.9)
        this.tweens.add({
          targets: [playAgainBtn, playAgainText],
          scaleX: 1,
          scaleY: 1,
          duration: 100
        })
      })

      playAgainBtn.on('pointerdown', () => {
        try {
          audioManager.playClick()
        } catch (e) {}
        this.playAgain()
      })
    }

    // Tap to continue hint
    const hint = this.add.text(centerX, height - 25, 'Tap anywhere or press SPACE to continue', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setDepth(80)

    this.tweens.add({
      targets: hint,
      alpha: { from: 0.5, to: 1 },
      duration: 800,
      yoyo: true,
      repeat: -1
    })
  }

  setupInputHandlers(height) {
    console.log('[MiniGameResult] Setting up input handlers')

    // CRITICAL: Ensure input is enabled
    this.input.enabled = true

    // Keyboard - with fallback
    try {
      if (this.input.keyboard) {
        this.input.keyboard.on('keydown-SPACE', () => {
          console.log('[MiniGameResult] SPACE pressed')
          this.finish()
        })
        this.input.keyboard.on('keydown-ENTER', () => {
          console.log('[MiniGameResult] ENTER pressed')
          this.finish()
        })
        this.input.keyboard.on('keydown-ESC', () => {
          console.log('[MiniGameResult] ESC pressed')
          this.finish()
        })
        console.log('[MiniGameResult] Keyboard handlers registered')
      } else {
        console.warn('[MiniGameResult] No keyboard available')
      }
    } catch (e) {
      console.error('[MiniGameResult] Keyboard setup error:', e)
    }

    // Tap anywhere - DIRECT handling, no delay needed
    try {
      this.input.on('pointerdown', (pointer) => {
        console.log('[MiniGameResult] Pointer down at y:', pointer.y, 'height:', height)
        // Accept tap anywhere on screen
        if (!this.isFinishing) {
          this.finish()
        }
      })
      console.log('[MiniGameResult] Pointer handler registered')
    } catch (e) {
      console.error('[MiniGameResult] Pointer setup error:', e)
    }

    // Also add a DOM-level click handler as ultimate fallback
    try {
      this.domClickHandler = () => {
        console.log('[MiniGameResult] DOM click detected')
        if (!this.isFinishing) {
          this.finish()
        }
      }
      document.addEventListener('click', this.domClickHandler, { once: true })
      console.log('[MiniGameResult] DOM click handler registered')
    } catch (e) {
      console.error('[MiniGameResult] DOM handler error:', e)
    }
  }

  /**
   * Replay the same crime/job
   */
  playAgain() {
    if (this.isFinishing) return
    this.isFinishing = true

    console.log('[MiniGameResult] playAgain() called')

    // Determine what to replay
    const crimeId = this.gameData?.crimeId
    const jobId = this.gameData?.jobId
    const targetScene = crimeId ? 'CrimeScene' : (jobId ? 'JobScene' : null)

    if (!targetScene) {
      console.warn('[MiniGameResult] No crime/job ID found, using normal finish')
      this.isFinishing = false
      return this.finish()
    }

    // Cleanup
    this.cleanupForTransition()

    // Transition to scene with auto-start flag
    const replayData = {
      autoStart: true,
      crimeId: crimeId,
      jobId: jobId
    }

    console.log('[MiniGameResult] Transitioning to', targetScene, 'with', replayData)

    try {
      this.scene.stop()
      this.scene.start(targetScene, replayData)
    } catch (e) {
      console.error('[MiniGameResult] playAgain transition error:', e)
      // Fallback
      this.scene.stop()
      this.scene.start('GameScene')
    }
  }

  /**
   * Common cleanup for transitions
   */
  cleanupForTransition() {
    // Clear the auto-exit timeout
    if (this.autoExitTimeout) {
      clearTimeout(this.autoExitTimeout)
      this.autoExitTimeout = null
    }

    // Clear DOM click handler
    if (this.domClickHandler) {
      try {
        document.removeEventListener('click', this.domClickHandler)
      } catch (e) {}
      this.domClickHandler = null
    }

    // Cleanup particles
    try {
      this.particles.forEach(p => {
        if (p && p.destroy) p.destroy()
      })
      this.particles = []
    } catch (e) {}

    // Stop tweens and time events
    try { this.tweens.killAll() } catch (e) {}
    try { this.time.removeAllEvents() } catch (e) {}

    // Reset camera
    try {
      this.cameras.main.setZoom(1)
      this.cameras.main.setAlpha(1)
      this.cameras.main.resetFX()
      this.cameras.main.setScroll(0, 0)
      this.tweens.timeScale = 1
    } catch (e) {}

    // Disable input
    try {
      this.input.removeAllListeners()
      if (this.input.keyboard) {
        this.input.keyboard.removeAllListeners()
      }
    } catch (e) {}
  }

  finish() {
    if (this.isFinishing) return
    this.isFinishing = true

    console.log('[MiniGameResult] finish() called - TRANSITIONING OUT')

    // Clear the auto-exit timeout
    if (this.autoExitTimeout) {
      clearTimeout(this.autoExitTimeout)
      this.autoExitTimeout = null
    }

    // Clear DOM click handler
    if (this.domClickHandler) {
      try {
        document.removeEventListener('click', this.domClickHandler)
      } catch (e) {}
      this.domClickHandler = null
    }

    // Cleanup particles
    try {
      this.particles.forEach(p => {
        if (p && p.destroy) p.destroy()
      })
      this.particles = []
    } catch (e) {
      console.warn('[MiniGameResult] Particle cleanup error:', e)
    }

    // Stop all tweens to prevent lingering animations
    try {
      this.tweens.killAll()
    } catch (e) {}

    // Stop all time events
    try {
      this.time.removeAllEvents()
    } catch (e) {}

    // CRITICAL: Reset camera state before transition
    try {
      this.cameras.main.setZoom(1)
      this.cameras.main.setAlpha(1)
      this.cameras.main.resetFX()
      this.cameras.main.setScroll(0, 0)
      this.cameras.main.setBackgroundColor(0x000000)
      this.tweens.timeScale = 1
    } catch (e) {
      console.warn('[MiniGameResult] Camera reset warning:', e)
    }

    // Disable input immediately
    try {
      this.input.removeAllListeners()
      if (this.input.keyboard) {
        this.input.keyboard.removeAllListeners()
      }
    } catch (e) {}

    // Callback
    if (this.gameData?.onComplete) {
      try {
        this.gameData.onComplete(this.result)
      } catch (e) {
        console.error('[MiniGameResult] onComplete error:', e)
      }
    }

    // Crossfade BGM
    try {
      audioManager.crossfadeBGM(AUDIO_KEYS.BGM.CRIME)
    } catch (e) {}

    const returnScene = this.gameData?.returnScene || 'CrimeScene'
    const returnData = this.gameData?.returnData || {}
    const game = this.game
    const result = this.result

    // Stop all mini-game scenes first
    const miniGameScenes = ['SteadyHandGame', 'SnakeGame', 'LockPickGame', 'QTEGame',
                            'HackingGame', 'SafeCrackGame', 'GetawayGame', 'TimingGame', 'MemoryGame',
                            'FroggerGame', 'ChaseGame', 'WireGame', 'SniperGame', 'RhythmGame',
                            'NegotiationGame', 'SurveillanceGame']
    miniGameScenes.forEach(key => {
      try {
        if (game.scene.isActive(key)) {
          game.scene.stop(key)
        }
      } catch (e) {}
    })

    console.log('[MiniGameResult] Preparing transition to:', returnScene)

    // Use native setTimeout to ensure reliable transition
    setTimeout(() => {
      try {
        console.log('[MiniGameResult] Executing transition now')

        // Stop this scene and start the return scene
        game.scene.stop('MiniGameResult')
        game.scene.start(returnScene, { miniGameResult: result, ...returnData })

        console.log('[MiniGameResult] Transition successful')
      } catch (e) {
        console.error('[MiniGameResult] Transition error:', e)

        // Fallback 1: Try GameScene
        try {
          console.log('[MiniGameResult] Trying fallback to GameScene')
          game.scene.stop('MiniGameResult')
          game.scene.start('GameScene')
        } catch (e2) {
          console.error('[MiniGameResult] Fallback to GameScene failed:', e2)

          // Fallback 2: Force restart the game
          try {
            console.log('[MiniGameResult] Forcing game restart')
            window.location.reload()
          } catch (e3) {
            console.error('[MiniGameResult] All fallbacks failed')
          }
        }
      }
    }, 100) // Increased delay for safety
  }

  update(time, delta) {
    // Log every 60 frames (~1 second) to confirm scene is running
    if (!this.frameCount) this.frameCount = 0
    this.frameCount++
    if (this.frameCount % 60 === 0) {
      console.log('[MiniGameResult] update() running, frame:', this.frameCount, 'isFinishing:', this.isFinishing)
    }
  }

  shutdown() {
    console.log('[MiniGameResult] shutdown called')

    // Clear auto-exit timeout
    if (this.autoExitTimeout) {
      clearTimeout(this.autoExitTimeout)
      this.autoExitTimeout = null
    }

    // Clear emergency timeout
    if (this.emergencyTimeout) {
      clearTimeout(this.emergencyTimeout)
      this.emergencyTimeout = null
    }

    // Clear DOM click handler
    if (this.domClickHandler) {
      try {
        document.removeEventListener('click', this.domClickHandler)
      } catch (e) {}
      this.domClickHandler = null
    }

    // Clean up particles
    this.particles.forEach(p => {
      if (p && p.destroy) p.destroy()
    })
    this.particles = []
  }
}

export default MiniGameResult
