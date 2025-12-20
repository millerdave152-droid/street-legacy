import Phaser from 'phaser'

/**
 * AnimationHelper - Utility class for common game animations
 * Provides button effects, transitions, particle effects, and UI polish
 */
class AnimationHelperClass {
  constructor() {
    this.scene = null
  }

  /**
   * Set the current scene context
   */
  setScene(scene) {
    this.scene = scene
  }

  // ============================================================================
  // BUTTON EFFECTS
  // ============================================================================

  /**
   * Add hover and click effects to a button
   * @param {Phaser.GameObjects.Rectangle|Phaser.GameObjects.Image} button - The button object
   * @param {Object} options - Animation options
   */
  addButtonEffects(button, options = {}) {
    const {
      scaleOnHover = 1.05,
      scaleOnClick = 0.95,
      hoverTint = null,
      clickTint = null,
      originalScale = 1,
      duration = 100
    } = options

    const originalTint = button.tintTopLeft || 0xffffff

    button.setInteractive({ useHandCursor: true })

    // Hover effects
    button.on('pointerover', () => {
      this.scene.tweens.add({
        targets: button,
        scaleX: scaleOnHover,
        scaleY: scaleOnHover,
        duration: duration,
        ease: 'Power2'
      })
      if (hoverTint) {
        button.setTint(hoverTint)
      }
    })

    button.on('pointerout', () => {
      this.scene.tweens.add({
        targets: button,
        scaleX: originalScale,
        scaleY: originalScale,
        duration: duration,
        ease: 'Power2'
      })
      button.clearTint()
    })

    // Click effect
    button.on('pointerdown', () => {
      this.scene.tweens.add({
        targets: button,
        scaleX: scaleOnClick,
        scaleY: scaleOnClick,
        duration: 50,
        ease: 'Power2'
      })
      if (clickTint) {
        button.setTint(clickTint)
      }
    })

    button.on('pointerup', () => {
      this.scene.tweens.add({
        targets: button,
        scaleX: scaleOnHover,
        scaleY: scaleOnHover,
        duration: 50,
        ease: 'Power2'
      })
      if (hoverTint) {
        button.setTint(hoverTint)
      }
    })
  }

  /**
   * Add a pulsing glow effect to a button
   */
  addPulseEffect(target, options = {}) {
    const {
      minAlpha = 0.5,
      maxAlpha = 1,
      duration = 800,
      minScale = 1,
      maxScale = 1.1
    } = options

    return this.scene.tweens.add({
      targets: target,
      alpha: { from: maxAlpha, to: minAlpha },
      scaleX: { from: minScale, to: maxScale },
      scaleY: { from: minScale, to: maxScale },
      duration: duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }

  // ============================================================================
  // SCENE TRANSITIONS
  // ============================================================================

  /**
   * Fade in transition
   */
  fadeIn(targets, options = {}) {
    const { duration = 300, delay = 0, from = 0, to = 1, ease = 'Power2', onComplete = null } = options

    if (Array.isArray(targets)) {
      targets.forEach(t => t.setAlpha(from))
    } else {
      targets.setAlpha(from)
    }

    return this.scene.tweens.add({
      targets: targets,
      alpha: to,
      duration: duration,
      delay: delay,
      ease: ease,
      onComplete: onComplete
    })
  }

  /**
   * Fade out transition
   */
  fadeOut(targets, options = {}) {
    const { duration = 300, delay = 0, from = 1, to = 0, ease = 'Power2', onComplete = null } = options

    return this.scene.tweens.add({
      targets: targets,
      alpha: to,
      duration: duration,
      delay: delay,
      ease: ease,
      onComplete: onComplete
    })
  }

  /**
   * Slide in from direction
   */
  slideIn(targets, direction, options = {}) {
    const { duration = 300, delay = 0, ease = 'Power2', distance = 100, onComplete = null } = options

    let offsetX = 0
    let offsetY = 0

    switch (direction) {
      case 'left': offsetX = -distance; break
      case 'right': offsetX = distance; break
      case 'up': offsetY = -distance; break
      case 'down': offsetY = distance; break
    }

    if (Array.isArray(targets)) {
      targets.forEach(t => {
        t.setAlpha(0)
        t.x += offsetX
        t.y += offsetY
      })
    } else {
      targets.setAlpha(0)
      targets.x += offsetX
      targets.y += offsetY
    }

    return this.scene.tweens.add({
      targets: targets,
      x: `-=${offsetX}`,
      y: `-=${offsetY}`,
      alpha: 1,
      duration: duration,
      delay: delay,
      ease: ease,
      onComplete: onComplete
    })
  }

  /**
   * Slide out to direction
   */
  slideOut(targets, direction, options = {}) {
    const { duration = 300, delay = 0, ease = 'Power2', distance = 100, onComplete = null } = options

    let offsetX = 0
    let offsetY = 0

    switch (direction) {
      case 'left': offsetX = -distance; break
      case 'right': offsetX = distance; break
      case 'up': offsetY = -distance; break
      case 'down': offsetY = distance; break
    }

    return this.scene.tweens.add({
      targets: targets,
      x: `+=${offsetX}`,
      y: `+=${offsetY}`,
      alpha: 0,
      duration: duration,
      delay: delay,
      ease: ease,
      onComplete: onComplete
    })
  }

  /**
   * Pop in effect (scale from 0)
   */
  popIn(targets, options = {}) {
    const { duration = 200, delay = 0, ease = 'Back.easeOut', onComplete = null } = options

    if (Array.isArray(targets)) {
      targets.forEach(t => {
        t.setScale(0)
        t.setAlpha(0)
      })
    } else {
      targets.setScale(0)
      targets.setAlpha(0)
    }

    return this.scene.tweens.add({
      targets: targets,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: duration,
      delay: delay,
      ease: ease,
      onComplete: onComplete
    })
  }

  /**
   * Pop out effect (scale to 0)
   */
  popOut(targets, options = {}) {
    const { duration = 150, delay = 0, ease = 'Back.easeIn', onComplete = null } = options

    return this.scene.tweens.add({
      targets: targets,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: duration,
      delay: delay,
      ease: ease,
      onComplete: onComplete
    })
  }

  // ============================================================================
  // PARTICLE EFFECTS
  // ============================================================================

  /**
   * Create a cash particle burst effect
   */
  cashBurst(x, y, amount = 10) {
    if (!this.scene) return

    const particles = []
    const symbols = ['$', '💰', '💵']

    for (let i = 0; i < amount; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)]
      const particle = this.scene.add.text(x, y, symbol, {
        fontSize: '20px'
      }).setOrigin(0.5).setDepth(9998)

      const angle = Phaser.Math.Between(0, 360) * Math.PI / 180
      const speed = Phaser.Math.Between(100, 250)
      const vx = Math.cos(angle) * speed
      const vy = Math.sin(angle) * speed

      this.scene.tweens.add({
        targets: particle,
        x: x + vx,
        y: y + vy - 50,
        alpha: 0,
        scale: 0.5,
        duration: Phaser.Math.Between(600, 1000),
        ease: 'Quad.easeOut',
        delay: i * 30,
        onComplete: () => particle.destroy()
      })

      particles.push(particle)
    }

    return particles
  }

  /**
   * Create an XP gain particle effect
   */
  xpGain(x, y, amount) {
    if (!this.scene) return

    const text = this.scene.add.text(x, y, `+${amount} XP`, {
      fontSize: '24px',
      fontFamily: 'Arial Black, Arial',
      color: '#8b5cf6',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(9998)

    this.scene.tweens.add({
      targets: text,
      y: y - 80,
      alpha: 0,
      duration: 1200,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy()
    })

    return text
  }

  /**
   * Create a damage/hit number effect
   */
  damageNumber(x, y, amount, isHealing = false) {
    if (!this.scene) return

    const color = isHealing ? '#22c55e' : '#ef4444'
    const prefix = isHealing ? '+' : '-'

    const text = this.scene.add.text(x, y, `${prefix}${amount}`, {
      fontSize: '28px',
      fontFamily: 'Arial Black, Arial',
      color: color,
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(9998)

    // Slight random horizontal offset
    const offsetX = Phaser.Math.Between(-20, 20)

    this.scene.tweens.add({
      targets: text,
      x: x + offsetX,
      y: y - 60,
      scale: 1.2,
      duration: 200,
      ease: 'Quad.easeOut',
      yoyo: false,
      onComplete: () => {
        this.scene.tweens.add({
          targets: text,
          y: y - 100,
          alpha: 0,
          duration: 600,
          ease: 'Quad.easeIn',
          onComplete: () => text.destroy()
        })
      }
    })

    return text
  }

  /**
   * Create a sparkle/star burst effect
   */
  sparkleBurst(x, y, color = 0xffd700, count = 8) {
    if (!this.scene) return

    const particles = []

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const distance = Phaser.Math.Between(40, 80)

      const star = this.scene.add.text(x, y, '✦', {
        fontSize: '16px',
        color: `#${color.toString(16).padStart(6, '0')}`
      }).setOrigin(0.5).setDepth(9998)

      this.scene.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0,
        rotation: Math.PI,
        duration: 500,
        ease: 'Quad.easeOut',
        delay: i * 30,
        onComplete: () => star.destroy()
      })

      particles.push(star)
    }

    return particles
  }

  // ============================================================================
  // UI POLISH
  // ============================================================================

  /**
   * Shake effect (for errors, damage, etc.)
   */
  shake(target, options = {}) {
    const { intensity = 5, duration = 200, direction = 'horizontal' } = options

    const originalX = target.x
    const originalY = target.y

    const shake = {
      x: direction !== 'vertical' ? intensity : 0,
      y: direction !== 'horizontal' ? intensity : 0
    }

    return this.scene.tweens.add({
      targets: target,
      x: { from: originalX - shake.x, to: originalX + shake.x },
      y: { from: originalY - shake.y, to: originalY + shake.y },
      duration: 50,
      repeat: Math.floor(duration / 50),
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        target.x = originalX
        target.y = originalY
      }
    })
  }

  /**
   * Bounce effect
   */
  bounce(target, options = {}) {
    const { height = 20, duration = 400 } = options

    const originalY = target.y

    return this.scene.tweens.add({
      targets: target,
      y: originalY - height,
      duration: duration / 2,
      ease: 'Quad.easeOut',
      yoyo: true,
      repeat: 0
    })
  }

  /**
   * Flash effect
   */
  flash(target, options = {}) {
    const { color = 0xffffff, duration = 100, repeat = 2 } = options

    return this.scene.tweens.add({
      targets: target,
      alpha: 0.3,
      duration: duration,
      yoyo: true,
      repeat: repeat,
      ease: 'Sine.easeInOut',
      onStart: () => target.setTint(color),
      onComplete: () => target.clearTint()
    })
  }

  /**
   * Create a typewriter text effect
   */
  typewriter(textObject, fullText, options = {}) {
    const { speed = 50, onComplete = null } = options

    textObject.setText('')
    let i = 0

    const timer = this.scene.time.addEvent({
      delay: speed,
      callback: () => {
        textObject.setText(fullText.substring(0, i + 1))
        i++

        if (i >= fullText.length) {
          timer.remove()
          if (onComplete) onComplete()
        }
      },
      repeat: fullText.length - 1
    })

    return timer
  }

  /**
   * Create a counting number animation
   */
  countTo(textObject, startValue, endValue, options = {}) {
    const { duration = 1000, prefix = '', suffix = '', onComplete = null } = options

    const counter = { value: startValue }

    return this.scene.tweens.add({
      targets: counter,
      value: endValue,
      duration: duration,
      ease: 'Power2',
      onUpdate: () => {
        textObject.setText(`${prefix}${Math.floor(counter.value).toLocaleString()}${suffix}`)
      },
      onComplete: onComplete
    })
  }

  /**
   * Staggered animation for lists
   */
  staggerIn(targets, options = {}) {
    const { delay = 50, duration = 200, from = 'left', distance = 50 } = options

    const tweens = []
    const startOffset = from === 'left' ? -distance : from === 'right' ? distance : 0
    const yOffset = from === 'top' ? -distance : from === 'bottom' ? distance : 0

    targets.forEach((target, index) => {
      target.setAlpha(0)
      target.x += startOffset
      target.y += yOffset

      tweens.push(
        this.scene.tweens.add({
          targets: target,
          x: `-=${startOffset}`,
          y: `-=${yOffset}`,
          alpha: 1,
          duration: duration,
          delay: index * delay,
          ease: 'Power2'
        })
      )
    })

    return tweens
  }
}

// Export singleton instance
export const animationHelper = new AnimationHelperClass()
export default animationHelper
