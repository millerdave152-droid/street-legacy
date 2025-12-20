// Mini-Game Effects Utility
// Provides visual "juice" for mini-games: particles, screen effects, celebrations

import { COLORS } from '../ui/NetworkTheme'
import { audioManager } from '../managers/AudioManager'

/**
 * Mini-Game Effects Manager
 * Call these methods from mini-games to add visual polish
 */
export class MiniGameEffects {
  constructor(scene) {
    this.scene = scene
    this.particles = []
    this.screenEffects = []
  }

  // ==========================================================================
  // PARTICLE EFFECTS
  // ==========================================================================

  /**
   * Coin/money burst effect when scoring points
   */
  coinBurst(x, y, count = 8, options = {}) {
    const { color = 0xffd700, spread = 60, duration = 600 } = options

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const coin = this.scene.add.circle(x, y, 4, color, 0.9).setDepth(100)

      this.scene.tweens.add({
        targets: coin,
        x: x + Math.cos(angle) * spread,
        y: y + Math.sin(angle) * spread * 0.7,
        alpha: 0,
        scale: 0.3,
        duration: duration,
        delay: i * 20,
        ease: 'Quad.out',
        onComplete: () => coin.destroy()
      })

      this.particles.push(coin)
    }
  }

  /**
   * Spark effect on successful hit/action
   */
  sparkEffect(x, y, options = {}) {
    const { color = COLORS.network.primary, count = 6, size = 3 } = options

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
      const spark = this.scene.add.circle(x, y, size, color, 1).setDepth(100)

      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * 30,
        y: y + Math.sin(angle) * 30,
        alpha: 0,
        scale: 0.1,
        duration: 300,
        ease: 'Quad.out',
        onComplete: () => spark.destroy()
      })

      this.particles.push(spark)
    }
  }

  /**
   * Smoke puff effect (for lockpick success, etc.)
   */
  smokePuff(x, y, options = {}) {
    const { color = 0x888888, count = 5 } = options

    for (let i = 0; i < count; i++) {
      const smoke = this.scene.add.circle(
        x + Phaser.Math.Between(-10, 10),
        y + Phaser.Math.Between(-10, 10),
        Phaser.Math.Between(8, 15),
        color,
        0.4
      ).setDepth(95)

      this.scene.tweens.add({
        targets: smoke,
        y: smoke.y - 40,
        scaleX: 2,
        scaleY: 2,
        alpha: 0,
        duration: 800,
        delay: i * 50,
        ease: 'Quad.out',
        onComplete: () => smoke.destroy()
      })

      this.particles.push(smoke)
    }
  }

  /**
   * Electric sparks for wire/hacking games
   */
  electricSpark(x, y, options = {}) {
    const { color = 0x00aaff, intensity = 'medium' } = options
    const counts = { low: 4, medium: 8, high: 12 }
    const count = counts[intensity] || 8

    for (let i = 0; i < count; i++) {
      const dx = Phaser.Math.Between(-40, 40)
      const dy = Phaser.Math.Between(-40, 40)
      const line = this.scene.add.graphics().setDepth(100)

      line.lineStyle(2, color, 1)
      line.beginPath()
      line.moveTo(x, y)

      // Jagged lightning path
      let px = x, py = y
      for (let j = 0; j < 3; j++) {
        const nx = px + dx / 3 + Phaser.Math.Between(-10, 10)
        const ny = py + dy / 3 + Phaser.Math.Between(-10, 10)
        line.lineTo(nx, ny)
        px = nx
        py = ny
      }
      line.strokePath()

      this.scene.tweens.add({
        targets: line,
        alpha: 0,
        duration: 200,
        delay: i * 30,
        onComplete: () => line.destroy()
      })
    }

    // Glow effect
    const glow = this.scene.add.circle(x, y, 20, color, 0.5).setDepth(99)
    this.scene.tweens.add({
      targets: glow,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 300,
      onComplete: () => glow.destroy()
    })
  }

  /**
   * Confetti celebration effect
   */
  confetti(width, height, options = {}) {
    const { count = 40, colors = [0xff0040, 0x00ff41, 0xffd700, 0x00aaff, 0xff88ff] } = options

    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(20, width - 20)
      const color = colors[Math.floor(Math.random() * colors.length)]
      const size = Phaser.Math.Between(4, 10)
      const isRect = Math.random() > 0.5

      const confetti = isRect
        ? this.scene.add.rectangle(x, -20, size, size * 2, color, 0.9)
        : this.scene.add.circle(x, -20, size / 2, color, 0.9)

      confetti.setDepth(110)
      confetti.setRotation(Math.random() * Math.PI * 2)

      const fallDuration = Phaser.Math.Between(2000, 4000)
      const swayAmount = Phaser.Math.Between(30, 80)

      this.scene.tweens.add({
        targets: confetti,
        y: height + 50,
        rotation: confetti.rotation + Phaser.Math.Between(3, 6) * (Math.random() > 0.5 ? 1 : -1),
        duration: fallDuration,
        ease: 'Linear',
        onComplete: () => confetti.destroy()
      })

      this.scene.tweens.add({
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

  /**
   * Money rain effect
   */
  moneyRain(width, height, options = {}) {
    const { count = 20, duration = 3000 } = options

    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(20, width - 20)
      const emoji = Math.random() > 0.5 ? '💵' : '💰'
      const money = this.scene.add.text(x, -30, emoji, { fontSize: '20px' })
        .setDepth(105)

      const fallDuration = Phaser.Math.Between(duration * 0.7, duration * 1.3)

      this.scene.tweens.add({
        targets: money,
        y: height + 50,
        rotation: Math.random() * Math.PI * 2,
        duration: fallDuration,
        delay: i * 100,
        ease: 'Linear',
        onComplete: () => money.destroy()
      })

      this.scene.tweens.add({
        targets: money,
        x: x + Phaser.Math.Between(-40, 40),
        duration: fallDuration / 2,
        yoyo: true,
        ease: 'Sine.inOut'
      })

      this.particles.push(money)
    }
  }

  /**
   * Trail effect following a moving object
   */
  trail(x, y, options = {}) {
    const { color = COLORS.network.primary, size = 6, duration = 300 } = options

    const trail = this.scene.add.circle(x, y, size, color, 0.6).setDepth(50)

    this.scene.tweens.add({
      targets: trail,
      scale: 0.2,
      alpha: 0,
      duration: duration,
      onComplete: () => trail.destroy()
    })

    this.particles.push(trail)
  }

  // ==========================================================================
  // SCREEN EFFECTS
  // ==========================================================================

  /**
   * Screen shake effect
   */
  shake(options = {}) {
    const { intensity = 0.01, duration = 200 } = options
    this.scene.cameras.main.shake(duration, intensity)
  }

  /**
   * Flash effect (success/failure)
   */
  flash(options = {}) {
    const { color = 0xffffff, duration = 200, alpha = 0.3 } = options

    const flash = this.scene.add.rectangle(
      this.scene.scale.width / 2,
      this.scene.scale.height / 2,
      this.scene.scale.width,
      this.scene.scale.height,
      color,
      alpha
    ).setDepth(200)

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: duration,
      onComplete: () => flash.destroy()
    })
  }

  /**
   * Success flash (green)
   */
  successFlash(duration = 200) {
    this.flash({ color: COLORS.network.primary, duration, alpha: 0.25 })
  }

  /**
   * Failure flash (red)
   */
  failureFlash(duration = 200) {
    this.flash({ color: COLORS.status.danger, duration, alpha: 0.3 })
  }

  /**
   * Warning flash (amber)
   */
  warningFlash(duration = 200) {
    this.flash({ color: COLORS.status.warning, duration, alpha: 0.25 })
  }

  /**
   * Zoom pulse effect
   */
  zoomPulse(options = {}) {
    const { scale = 1.05, duration = 200 } = options

    this.scene.cameras.main.zoomTo(scale, duration / 2, 'Quad.out', false, (cam, progress) => {
      if (progress === 1) {
        this.scene.cameras.main.zoomTo(1, duration / 2, 'Quad.in')
      }
    })
  }

  /**
   * Vignette darkening effect
   */
  vignette(options = {}) {
    const { intensity = 0.5, duration = 500 } = options
    const { width, height } = this.scene.scale

    const vignette = this.scene.add.graphics().setDepth(180)
    vignette.fillStyle(0x000000, 0)
    vignette.fillRect(0, 0, width, height)

    // Create radial gradient effect with circles
    for (let i = 0; i < 10; i++) {
      const ring = this.scene.add.circle(
        width / 2,
        height / 2,
        width * 0.4 + i * 30,
        0x000000,
        0
      ).setDepth(180)

      this.scene.tweens.add({
        targets: ring,
        alpha: intensity * (i / 10) * 0.3,
        duration: duration,
        yoyo: true,
        onComplete: () => ring.destroy()
      })
    }
  }

  /**
   * Slow motion effect (visual only - slows tweens)
   */
  slowMotion(duration = 1000) {
    this.scene.tweens.timeScale = 0.3

    this.scene.time.delayedCall(duration * 0.3, () => {
      this.scene.tweens.timeScale = 1
    })
  }

  // ==========================================================================
  // COMBO/SCORE EFFECTS
  // ==========================================================================

  /**
   * Floating score text that rises and fades
   */
  floatingScore(x, y, text, options = {}) {
    const { color = '#00ff41', size = '18px', duration = 800 } = options

    const scoreText = this.scene.add.text(x, y, text, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: size,
      color: color,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(120)

    this.scene.tweens.add({
      targets: scoreText,
      y: y - 50,
      alpha: 0,
      scale: 1.5,
      duration: duration,
      ease: 'Quad.out',
      onComplete: () => scoreText.destroy()
    })
  }

  /**
   * Combo indicator with growing effect
   */
  comboIndicator(x, y, comboCount, options = {}) {
    const { baseColor = COLORS.status.warning } = options

    // Color intensifies with combo
    const color = comboCount >= 10 ? COLORS.cred.gold :
                  comboCount >= 5 ? COLORS.status.warning :
                  COLORS.network.primary

    const text = `${comboCount}x COMBO!`
    const comboText = this.scene.add.text(x, y, text, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: comboCount >= 10 ? '28px' : comboCount >= 5 ? '24px' : '20px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(125)

    // Pop in and out
    comboText.setScale(0)
    this.scene.tweens.add({
      targets: comboText,
      scale: 1.2,
      duration: 150,
      ease: 'Back.out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: comboText,
          scale: 0,
          alpha: 0,
          y: y - 30,
          duration: 500,
          delay: 300,
          ease: 'Quad.in',
          onComplete: () => comboText.destroy()
        })
      }
    })

    // Sparks for high combos
    if (comboCount >= 5) {
      this.sparkEffect(x, y, { color, count: comboCount >= 10 ? 12 : 6 })
    }
  }

  /**
   * Perfect timing indicator
   */
  perfectHit(x, y) {
    const perfect = this.scene.add.text(x, y, 'PERFECT!', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '22px',
      color: '#ffd700',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(130)

    perfect.setScale(0)
    this.scene.tweens.add({
      targets: perfect,
      scale: 1.3,
      duration: 200,
      ease: 'Back.out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: perfect,
          scale: 0.8,
          alpha: 0,
          y: y - 40,
          duration: 400,
          ease: 'Quad.out',
          onComplete: () => perfect.destroy()
        })
      }
    })

    // Golden sparkles
    this.coinBurst(x, y, 12, { color: 0xffd700, spread: 50 })

    // Sound
    try {
      audioManager.playPerfect()
    } catch (e) {}
  }

  // ==========================================================================
  // DANGER/WARNING EFFECTS
  // ==========================================================================

  /**
   * Danger warning border flash
   */
  dangerBorder(options = {}) {
    const { duration = 500, pulses = 2 } = options
    const { width, height } = this.scene.scale

    const border = this.scene.add.graphics().setDepth(190)
    border.lineStyle(8, COLORS.status.danger, 0.8)
    border.strokeRect(4, 4, width - 8, height - 8)
    border.setAlpha(0)

    this.scene.tweens.add({
      targets: border,
      alpha: { from: 0, to: 0.8 },
      duration: duration / (pulses * 2),
      yoyo: true,
      repeat: pulses - 1,
      onComplete: () => border.destroy()
    })
  }

  /**
   * Time warning effect (screen tint red)
   */
  timeWarning() {
    const { width, height } = this.scene.scale

    const tint = this.scene.add.rectangle(
      width / 2, height / 2, width, height,
      COLORS.status.danger, 0
    ).setDepth(185)

    this.scene.tweens.add({
      targets: tint,
      alpha: 0.15,
      duration: 300,
      yoyo: true,
      repeat: 2,
      onComplete: () => tint.destroy()
    })
  }

  // ==========================================================================
  // ADVANCED VISUAL POLISH (P51-P60)
  // ==========================================================================

  /**
   * P51: Crime-themed visual skin overlay
   */
  applyCrimeTheme(theme = 'default') {
    const themes = {
      cyber: { primary: 0x00ff41, secondary: 0x003300, accent: 0x00ffaa },
      heist: { primary: 0xffd700, secondary: 0x1a1a00, accent: 0xffaa00 },
      street: { primary: 0xff4444, secondary: 0x1a0000, accent: 0xff8888 },
      stealth: { primary: 0x4488ff, secondary: 0x001133, accent: 0x88aaff },
      chase: { primary: 0xff8800, secondary: 0x1a0800, accent: 0xffaa44 }
    }

    const colors = themes[theme] || themes.default || themes.cyber
    const { width, height } = this.scene.scale

    // Subtle gradient overlay
    const overlay = this.scene.add.graphics().setDepth(1).setAlpha(0.1)
    overlay.fillGradientStyle(colors.primary, colors.primary, colors.secondary, colors.secondary, 0.2)
    overlay.fillRect(0, 0, width, height)

    this.screenEffects.push(overlay)
    return colors
  }

  /**
   * P52: Animated icon pulse effect
   */
  pulseIcon(icon, options = {}) {
    const { scale = 1.15, duration = 400, repeat = -1 } = options

    this.scene.tweens.add({
      targets: icon,
      scale: { from: 1, to: scale },
      duration: duration,
      yoyo: true,
      repeat: repeat,
      ease: 'Sine.inOut'
    })
  }

  /**
   * P53: Victory background animation
   */
  victoryBackground(width, height) {
    // Radial burst lines
    const center = { x: width / 2, y: height / 2 }
    const rays = []

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2
      const ray = this.scene.add.graphics().setDepth(5)
      ray.lineStyle(3, 0xffd700, 0)
      ray.lineBetween(center.x, center.y,
                      center.x + Math.cos(angle) * width,
                      center.y + Math.sin(angle) * height)
      rays.push(ray)

      this.scene.tweens.add({
        targets: ray,
        alpha: { from: 0, to: 0.4 },
        duration: 300,
        delay: i * 50,
        yoyo: true,
        repeat: 2,
        onComplete: () => ray.destroy()
      })
    }

    // Rotating halo
    const halo = this.scene.add.circle(center.x, center.y, 100, 0xffd700, 0)
      .setStrokeStyle(4, 0xffd700, 0.6).setDepth(6)

    this.scene.tweens.add({
      targets: halo,
      scale: { from: 0.5, to: 2 },
      alpha: { from: 0.6, to: 0 },
      duration: 1000,
      onComplete: () => halo.destroy()
    })

    // Star burst
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const star = this.scene.add.text(
        center.x + Math.cos(angle) * 50,
        center.y + Math.sin(angle) * 50,
        '✨', { fontSize: '24px' }
      ).setOrigin(0.5).setDepth(10).setAlpha(0)

      this.scene.tweens.add({
        targets: star,
        x: center.x + Math.cos(angle) * 150,
        y: center.y + Math.sin(angle) * 150,
        alpha: { from: 1, to: 0 },
        scale: { from: 0.5, to: 1.5 },
        duration: 800,
        delay: 200 + i * 50,
        onComplete: () => star.destroy()
      })
    }
  }

  /**
   * P54: Defeat screen with encouragement
   */
  defeatEffect(width, height, options = {}) {
    const { message = 'TRY AGAIN!' } = options
    const center = { x: width / 2, y: height / 2 }

    // Screen crack effect
    const cracks = this.scene.add.graphics().setDepth(150)
    cracks.lineStyle(2, 0xff0040, 0.6)

    for (let i = 0; i < 5; i++) {
      const startX = center.x + Phaser.Math.Between(-50, 50)
      const startY = center.y + Phaser.Math.Between(-50, 50)
      cracks.moveTo(startX, startY)

      let x = startX, y = startY
      for (let j = 0; j < 4; j++) {
        x += Phaser.Math.Between(-40, 40)
        y += Phaser.Math.Between(20, 60)
        cracks.lineTo(x, y)
      }
    }
    cracks.strokePath()

    this.scene.tweens.add({
      targets: cracks,
      alpha: 0,
      duration: 2000,
      delay: 500,
      onComplete: () => cracks.destroy()
    })

    // Encouraging message
    const tryAgain = this.scene.add.text(center.x, center.y + 100, message, {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '24px',
      color: '#ff8844',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(155).setAlpha(0)

    this.scene.tweens.add({
      targets: tryAgain,
      alpha: 1,
      y: center.y + 80,
      duration: 500,
      delay: 300,
      ease: 'Back.out'
    })

    // Pulse the message
    this.scene.tweens.add({
      targets: tryAgain,
      scale: { from: 1, to: 1.1 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    })

    this.screenEffects.push(tryAgain)
  }

  /**
   * P55: Progress bar glow effect
   */
  progressGlow(bar, options = {}) {
    const { color = 0x00ff41, intensity = 0.5 } = options

    // Create glow behind bar
    const glow = this.scene.add.graphics().setDepth(bar.depth - 1)

    const updateGlow = () => {
      glow.clear()
      glow.fillStyle(color, intensity * 0.3)
      glow.fillRoundedRect(bar.x - 4, bar.y - 4, bar.width + 8, bar.height + 8, 6)
    }

    updateGlow()

    this.scene.tweens.add({
      targets: { intensity: 0 },
      intensity: { from: 0.3, to: 0.8 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      onUpdate: (tween) => {
        glow.setAlpha(tween.getValue())
      }
    })

    this.screenEffects.push(glow)
    return glow
  }

  /**
   * P56: Screen border pulse on danger
   */
  dangerPulse(options = {}) {
    const { color = 0xff0040, duration = 1000, pulses = 3 } = options
    const { width, height } = this.scene.scale

    const border = this.scene.add.graphics().setDepth(195)

    const drawBorder = (alpha) => {
      border.clear()
      border.lineStyle(6, color, alpha)
      border.strokeRect(3, 3, width - 6, height - 6)
    }

    drawBorder(0)

    this.scene.tweens.add({
      targets: { value: 0 },
      value: { from: 0, to: 0.8 },
      duration: duration / pulses / 2,
      yoyo: true,
      repeat: pulses - 1,
      onUpdate: (tween) => drawBorder(tween.getValue()),
      onComplete: () => border.destroy()
    })
  }

  /**
   * P58: Slow motion with visual effect
   */
  slowMotionVisual(duration = 1500) {
    const { width, height } = this.scene.scale

    // Slow down tweens
    this.scene.tweens.timeScale = 0.25

    // Visual blur effect
    const blur = this.scene.add.rectangle(
      width / 2, height / 2, width, height, 0x000000, 0.2
    ).setDepth(175)

    // Add motion lines
    const lines = []
    for (let i = 0; i < 8; i++) {
      const y = height * 0.2 + (height * 0.6) * (i / 7)
      const line = this.scene.add.rectangle(width / 2, y, width - 40, 2, 0xffffff, 0.1)
        .setDepth(176)
      lines.push(line)

      this.scene.tweens.add({
        targets: line,
        x: width / 2 - 20,
        alpha: 0.3,
        duration: duration * 0.25,
        yoyo: true,
        repeat: 2
      })
    }

    // Restore normal speed
    this.scene.time.delayedCall(duration * 0.25, () => {
      this.scene.tweens.timeScale = 1
      blur.destroy()
      lines.forEach(l => l.destroy())
    })
  }

  /**
   * P59: Camera zoom on critical moments
   */
  dramaticZoom(targetX, targetY, options = {}) {
    const { zoom = 1.3, duration = 400, holdTime = 200 } = options

    const camera = this.scene.cameras.main
    const originalScroll = { x: camera.scrollX, y: camera.scrollY }

    // Zoom in on target
    camera.pan(targetX, targetY, duration / 2, 'Quad.out')
    camera.zoomTo(zoom, duration / 2, 'Quad.out', false, (cam, progress) => {
      if (progress === 1) {
        // Hold, then zoom out
        this.scene.time.delayedCall(holdTime, () => {
          camera.zoomTo(1, duration / 2, 'Quad.in')
          camera.pan(originalScroll.x + camera.width / 2,
                    originalScroll.y + camera.height / 2,
                    duration / 2, 'Quad.in')
        })
      }
    })
  }

  /**
   * P60: Enhanced particle trail with color
   */
  colorTrail(x, y, options = {}) {
    const { colors = [0x00ff41, 0x00ffaa, 0xffd700], size = 8, duration = 400 } = options

    colors.forEach((color, i) => {
      const trail = this.scene.add.circle(x, y, size - i * 2, color, 0.7 - i * 0.2)
        .setDepth(50 - i)

      this.scene.tweens.add({
        targets: trail,
        scale: 0.1,
        alpha: 0,
        duration: duration + i * 100,
        delay: i * 30,
        onComplete: () => trail.destroy()
      })

      this.particles.push(trail)
    })
  }

  /**
   * Shatter effect for failures
   */
  shatterEffect(x, y, options = {}) {
    const { color = 0xff0040, pieces = 12, size = 15 } = options

    for (let i = 0; i < pieces; i++) {
      const angle = (i / pieces) * Math.PI * 2 + Math.random() * 0.5
      const piece = this.scene.add.polygon(x, y, [
        0, 0,
        Phaser.Math.Between(5, size), Phaser.Math.Between(-5, 5),
        Phaser.Math.Between(-5, size), Phaser.Math.Between(5, size)
      ], color, 0.8).setDepth(100)

      const distance = Phaser.Math.Between(60, 120)

      this.scene.tweens.add({
        targets: piece,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance + 50,
        rotation: Phaser.Math.Between(2, 6),
        alpha: 0,
        duration: 800,
        delay: i * 20,
        ease: 'Quad.out',
        onComplete: () => piece.destroy()
      })

      this.particles.push(piece)
    }

    this.shake({ intensity: 0.02, duration: 300 })
  }

  /**
   * Countdown timer visual effect
   */
  countdownPulse(timerText, secondsLeft) {
    if (secondsLeft <= 5) {
      // Red pulse for danger
      this.scene.tweens.add({
        targets: timerText,
        scale: { from: 1, to: 1.3 },
        duration: 200,
        yoyo: true,
        ease: 'Quad.out'
      })

      if (secondsLeft <= 3) {
        timerText.setColor('#ff0040')
        this.dangerBorder({ duration: 200, pulses: 1 })
      }
    }
  }

  /**
   * Bonus collected effect
   */
  bonusCollected(x, y, bonusType = 'cash') {
    const icons = { cash: '💰', xp: '⚡', time: '⏱️', multiplier: '✖️' }
    const colors = { cash: 0xffd700, xp: 0x00ff41, time: 0x00aaff, multiplier: 0xff88ff }

    const icon = this.scene.add.text(x, y, icons[bonusType] || '✨', {
      fontSize: '32px'
    }).setOrigin(0.5).setDepth(120)

    // Pop and rise
    icon.setScale(0)
    this.scene.tweens.add({
      targets: icon,
      scale: { from: 0, to: 1.5 },
      y: y - 60,
      alpha: { from: 1, to: 0 },
      duration: 800,
      ease: 'Back.out',
      onComplete: () => icon.destroy()
    })

    // Burst particles
    this.coinBurst(x, y, 8, { color: colors[bonusType] || 0xffffff })
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  /**
   * Clean up all active particles and effects
   */
  cleanup() {
    this.particles.forEach(p => {
      if (p && p.destroy) p.destroy()
    })
    this.particles = []

    this.screenEffects.forEach(e => {
      if (e && e.destroy) e.destroy()
    })
    this.screenEffects = []

    // Reset camera
    if (this.scene?.cameras?.main) {
      this.scene.cameras.main.zoomTo(1, 100)
    }

    // Reset tween timescale
    if (this.scene?.tweens) {
      this.scene.tweens.timeScale = 1
    }
  }
}

// Export singleton factory
export function createMiniGameEffects(scene) {
  return new MiniGameEffects(scene)
}

export default MiniGameEffects
