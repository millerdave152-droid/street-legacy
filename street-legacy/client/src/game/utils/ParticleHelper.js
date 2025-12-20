/**
 * ParticleHelper - Utility class for particle effects
 *
 * Creates visual feedback effects for Street Legacy using Phaser's graphics
 * and game objects (no external particle assets required)
 */

export class ParticleHelper {
  /**
   * Cash burst effect - dollar signs flying outward
   * @param {Phaser.Scene} scene
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} amount - Affects particle count (default: 1000)
   */
  static cashBurst(scene, x, y, amount = 1000) {
    // Calculate particle count based on amount
    const count = Math.min(20, Math.max(5, Math.floor(amount / 500)))

    for (let i = 0; i < count; i++) {
      // Create a cash symbol
      const symbol = scene.add.text(x, y, '$', {
        fontSize: `${Phaser.Math.Between(14, 24)}px`,
        color: '#22c55e',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(1000)

      // Random direction
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const distance = Phaser.Math.Between(50, 120)
      const targetX = x + Math.cos(angle) * distance
      const targetY = y + Math.sin(angle) * distance

      // Animate outward
      scene.tweens.add({
        targets: symbol,
        x: targetX,
        y: targetY,
        alpha: 0,
        scale: { from: 1, to: 0.3 },
        duration: Phaser.Math.Between(600, 1000),
        ease: 'Power2.out',
        delay: i * 30,
        onComplete: () => symbol.destroy()
      })
    }
  }

  /**
   * XP sparkle effect - stars floating upward
   * @param {Phaser.Scene} scene
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   */
  static xpSparkle(scene, x, y) {
    const colors = ['#f59e0b', '#fbbf24', '#fcd34d', '#fef3c7']
    const symbols = ['✦', '✧', '★', '⚡']

    for (let i = 0; i < 8; i++) {
      const symbol = scene.add.text(
        x + Phaser.Math.Between(-30, 30),
        y,
        Phaser.Utils.Array.GetRandom(symbols),
        {
          fontSize: `${Phaser.Math.Between(12, 20)}px`,
          color: Phaser.Utils.Array.GetRandom(colors)
        }
      ).setOrigin(0.5).setDepth(1000)

      // Float up and fade
      scene.tweens.add({
        targets: symbol,
        y: y - Phaser.Math.Between(40, 80),
        alpha: 0,
        scale: { from: 1, to: 0.5 },
        rotation: Phaser.Math.FloatBetween(-0.5, 0.5),
        duration: Phaser.Math.Between(800, 1200),
        ease: 'Power2.out',
        delay: i * 50,
        onComplete: () => symbol.destroy()
      })
    }
  }

  /**
   * Level up explosion - big celebratory effect
   * @param {Phaser.Scene} scene
   */
  static levelUpExplosion(scene) {
    const { width, height } = scene.cameras.main
    const centerX = width / 2
    const centerY = height / 2

    // Flash effect
    scene.cameras.main.flash(300, 139, 92, 246) // Purple

    // Expanding ring
    const ring = scene.add.circle(centerX, centerY, 10, 0x8b5cf6, 0.8)
      .setDepth(999)
      .setStrokeStyle(4, 0x8b5cf6)
      .setFillStyle(0x8b5cf6, 0)

    scene.tweens.add({
      targets: ring,
      radius: Math.max(width, height),
      alpha: 0,
      duration: 800,
      ease: 'Power2.out',
      onComplete: () => ring.destroy()
    })

    // Stars bursting outward
    const starColors = [0xf59e0b, 0x8b5cf6, 0x22c55e, 0x3b82f6, 0xffffff]
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2
      const star = scene.add.text(centerX, centerY, '★', {
        fontSize: '28px',
        color: `#${Phaser.Utils.Array.GetRandom(starColors).toString(16).padStart(6, '0')}`
      }).setOrigin(0.5).setDepth(1001)

      const distance = Phaser.Math.Between(150, 300)
      scene.tweens.add({
        targets: star,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        alpha: 0,
        scale: { from: 1.5, to: 0.2 },
        rotation: Phaser.Math.FloatBetween(-2, 2),
        duration: Phaser.Math.Between(700, 1000),
        ease: 'Power2.out',
        delay: i * 20,
        onComplete: () => star.destroy()
      })
    }

    // "LEVEL UP" text pop
    const levelText = scene.add.text(centerX, centerY, 'LEVEL UP!', {
      fontFamily: 'Arial Black, Arial',
      fontSize: '48px',
      color: '#ffffff',
      stroke: '#8b5cf6',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(1002).setScale(0)

    scene.tweens.add({
      targets: levelText,
      scale: { from: 0, to: 1.2 },
      duration: 400,
      ease: 'Back.out',
      onComplete: () => {
        scene.tweens.add({
          targets: levelText,
          scale: 1,
          duration: 200,
          onComplete: () => {
            scene.tweens.add({
              targets: levelText,
              alpha: 0,
              y: centerY - 50,
              duration: 500,
              delay: 300,
              ease: 'Power2.in',
              onComplete: () => levelText.destroy()
            })
          }
        })
      }
    })
  }

  /**
   * Success confetti - particles falling from top
   * @param {Phaser.Scene} scene
   */
  static successConfetti(scene) {
    const { width } = scene.cameras.main
    const colors = ['#22c55e', '#16a34a', '#4ade80', '#fbbf24', '#ffffff']
    const shapes = ['■', '●', '▲', '★', '♦']

    for (let i = 0; i < 30; i++) {
      const startX = Phaser.Math.Between(0, width)
      const confetti = scene.add.text(startX, -20, Phaser.Utils.Array.GetRandom(shapes), {
        fontSize: `${Phaser.Math.Between(12, 20)}px`,
        color: Phaser.Utils.Array.GetRandom(colors)
      }).setOrigin(0.5).setDepth(1000)

      // Falling with horizontal drift
      const duration = Phaser.Math.Between(2000, 3500)
      const drift = Phaser.Math.Between(-100, 100)

      scene.tweens.add({
        targets: confetti,
        y: scene.cameras.main.height + 50,
        x: startX + drift,
        rotation: Phaser.Math.FloatBetween(-3, 3),
        duration,
        delay: i * 50,
        ease: 'Sine.inOut',
        onComplete: () => confetti.destroy()
      })
    }
  }

  /**
   * Fail smoke effect - dark particles rising
   * @param {Phaser.Scene} scene
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   */
  static failSmoke(scene, x, y) {
    const colors = ['#374151', '#4b5563', '#6b7280', '#9ca3af']

    for (let i = 0; i < 12; i++) {
      // Create smoke puff (circle)
      const smoke = scene.add.circle(
        x + Phaser.Math.Between(-20, 20),
        y,
        Phaser.Math.Between(8, 16),
        Phaser.Display.Color.HexStringToColor(Phaser.Utils.Array.GetRandom(colors)).color,
        0.7
      ).setDepth(999)

      // Rise and dissipate
      scene.tweens.add({
        targets: smoke,
        y: y - Phaser.Math.Between(60, 120),
        x: smoke.x + Phaser.Math.Between(-30, 30),
        alpha: 0,
        scale: { from: 1, to: 2 },
        duration: Phaser.Math.Between(800, 1200),
        ease: 'Power2.out',
        delay: i * 40,
        onComplete: () => smoke.destroy()
      })
    }

    // Camera shake
    scene.cameras.main.shake(200, 0.01)
  }

  /**
   * Hit spark effect - quick impact visual
   * @param {Phaser.Scene} scene
   * @param {number} x - Impact X position
   * @param {number} y - Impact Y position
   * @param {number} color - Spark color (default: 0xffffff)
   */
  static hitSpark(scene, x, y, color = 0xffffff) {
    // Central flash
    const flash = scene.add.circle(x, y, 20, color, 0.8)
      .setDepth(1000)

    scene.tweens.add({
      targets: flash,
      scale: { from: 0.5, to: 2 },
      alpha: 0,
      duration: 150,
      ease: 'Power2.out',
      onComplete: () => flash.destroy()
    })

    // Spark lines radiating outward
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const length = Phaser.Math.Between(20, 40)

      const line = scene.add.line(
        x, y,
        0, 0,
        Math.cos(angle) * 5,
        Math.sin(angle) * 5,
        color, 1
      ).setOrigin(0, 0).setDepth(1000).setLineWidth(2)

      scene.tweens.add({
        targets: line,
        x: x + Math.cos(angle) * length,
        y: y + Math.sin(angle) * length,
        alpha: 0,
        duration: 200,
        ease: 'Power2.out',
        onComplete: () => line.destroy()
      })
    }
  }

  /**
   * Achievement sparkle - special unlock effect
   * @param {Phaser.Scene} scene
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   */
  static achievementSparkle(scene, x, y) {
    // Golden ring
    const ring = scene.add.circle(x, y, 30, 0xfbbf24, 0)
      .setDepth(1000)
      .setStrokeStyle(3, 0xfbbf24)

    scene.tweens.add({
      targets: ring,
      radius: 80,
      alpha: 0,
      duration: 600,
      ease: 'Power2.out',
      onComplete: () => ring.destroy()
    })

    // Sparkles
    const colors = ['#fbbf24', '#fcd34d', '#fef3c7', '#ffffff']
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2
      const sparkle = scene.add.text(x, y, '✦', {
        fontSize: '16px',
        color: Phaser.Utils.Array.GetRandom(colors)
      }).setOrigin(0.5).setDepth(1001)

      const distance = Phaser.Math.Between(40, 70)
      scene.tweens.add({
        targets: sparkle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: { from: 1, to: 0.3 },
        duration: 500,
        ease: 'Power2.out',
        delay: i * 30,
        onComplete: () => sparkle.destroy()
      })
    }
  }

  /**
   * Heat wave effect - warning particles
   * @param {Phaser.Scene} scene
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   */
  static heatWave(scene, x, y) {
    const colors = ['#ef4444', '#f97316', '#fbbf24']

    for (let i = 0; i < 8; i++) {
      const flame = scene.add.text(
        x + Phaser.Math.Between(-30, 30),
        y + 10,
        '🔥',
        { fontSize: `${Phaser.Math.Between(16, 24)}px` }
      ).setOrigin(0.5).setDepth(1000).setAlpha(0.8)

      scene.tweens.add({
        targets: flame,
        y: y - Phaser.Math.Between(30, 60),
        alpha: 0,
        scale: { from: 1, to: 0.5 },
        duration: Phaser.Math.Between(600, 1000),
        ease: 'Power2.out',
        delay: i * 60,
        onComplete: () => flame.destroy()
      })
    }
  }

  /**
   * Coin collect effect - coin flying to target
   * @param {Phaser.Scene} scene
   * @param {number} startX - Starting X position
   * @param {number} startY - Starting Y position
   * @param {number} targetX - Target X position
   * @param {number} targetY - Target Y position
   * @param {Function} onComplete - Callback when coin reaches target
   */
  static coinCollect(scene, startX, startY, targetX, targetY, onComplete = null) {
    const coin = scene.add.text(startX, startY, '💰', {
      fontSize: '24px'
    }).setOrigin(0.5).setDepth(1000)

    // Spin while moving
    scene.tweens.add({
      targets: coin,
      rotation: Math.PI * 2,
      duration: 400,
      repeat: 1
    })

    // Arc movement to target
    scene.tweens.add({
      targets: coin,
      x: targetX,
      y: targetY,
      scale: { from: 1, to: 0.5 },
      duration: 600,
      ease: 'Power2.in',
      onComplete: () => {
        coin.destroy()
        // Small flash at target
        this.hitSpark(scene, targetX, targetY, 0x22c55e)
        if (onComplete) onComplete()
      }
    })
  }

  /**
   * Timer warning - pulsing effect around timer
   * @param {Phaser.Scene} scene
   * @param {number} x - Timer X position
   * @param {number} y - Timer Y position
   */
  static timerWarning(scene, x, y) {
    const ring = scene.add.circle(x, y, 25, 0xef4444, 0)
      .setDepth(999)
      .setStrokeStyle(2, 0xef4444)

    scene.tweens.add({
      targets: ring,
      radius: 50,
      alpha: 0,
      duration: 600,
      ease: 'Power2.out',
      onComplete: () => ring.destroy()
    })
  }

  /**
   * Trail effect for fast-moving objects
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target - Object to trail
   * @param {number} color - Trail color (default: 0xffffff)
   * @param {number} duration - Trail duration in ms (default: 200)
   */
  static createTrail(scene, target, color = 0xffffff, duration = 200) {
    const trail = scene.add.circle(target.x, target.y, 5, color, 0.5)
      .setDepth(target.depth - 1)

    scene.tweens.add({
      targets: trail,
      alpha: 0,
      scale: 0.3,
      duration,
      ease: 'Power2.out',
      onComplete: () => trail.destroy()
    })
  }

  /**
   * Screen vignette flash (border effect)
   * @param {Phaser.Scene} scene
   * @param {number} color - Color of vignette (default: 0xef4444 red)
   * @param {number} duration - Duration in ms (default: 300)
   */
  static vignetteFlash(scene, color = 0xef4444, duration = 300) {
    const { width, height } = scene.cameras.main

    // Create border rectangles
    const borderSize = 40
    const borders = [
      scene.add.rectangle(width / 2, borderSize / 2, width, borderSize, color, 0.6), // Top
      scene.add.rectangle(width / 2, height - borderSize / 2, width, borderSize, color, 0.6), // Bottom
      scene.add.rectangle(borderSize / 2, height / 2, borderSize, height, color, 0.6), // Left
      scene.add.rectangle(width - borderSize / 2, height / 2, borderSize, height, color, 0.6) // Right
    ]

    borders.forEach(border => border.setDepth(2000).setAlpha(0))

    // Flash in and out
    scene.tweens.add({
      targets: borders,
      alpha: 0.6,
      duration: duration / 4,
      yoyo: true,
      hold: duration / 2,
      onComplete: () => borders.forEach(b => b.destroy())
    })
  }

  /**
   * Damage numbers - floating damage text
   * @param {Phaser.Scene} scene
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} damage - Damage amount
   * @param {boolean} critical - Is critical hit (default: false)
   */
  static damageNumber(scene, x, y, damage, critical = false) {
    const text = scene.add.text(x, y, `-${damage}`, {
      fontFamily: 'Arial Black, Arial',
      fontSize: critical ? '28px' : '20px',
      color: critical ? '#f59e0b' : '#ef4444',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(1000)

    if (critical) {
      text.setText(`💥 -${damage}`)
    }

    // Pop up and fall
    scene.tweens.add({
      targets: text,
      y: y - 40,
      duration: 300,
      ease: 'Power2.out',
      onComplete: () => {
        scene.tweens.add({
          targets: text,
          y: y + 20,
          alpha: 0,
          duration: 500,
          ease: 'Power2.in',
          onComplete: () => text.destroy()
        })
      }
    })

    // Slight horizontal drift
    scene.tweens.add({
      targets: text,
      x: x + Phaser.Math.Between(-20, 20),
      duration: 800
    })
  }

  /**
   * Heal numbers - floating heal text
   * @param {Phaser.Scene} scene
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} amount - Heal amount
   */
  static healNumber(scene, x, y, amount) {
    const text = scene.add.text(x, y, `+${amount}`, {
      fontFamily: 'Arial Black, Arial',
      fontSize: '20px',
      color: '#22c55e',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(1000)

    // Float up and fade
    scene.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 1000,
      ease: 'Power2.out',
      onComplete: () => text.destroy()
    })
  }
}

export default ParticleHelper
