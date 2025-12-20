/**
 * AnimationHelper - Utility class for common animations
 *
 * Provides reusable animation methods for UI polish throughout Street Legacy
 */

export class AnimationHelper {
  /**
   * Fade in an object from 0 to 1 alpha
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {number} duration - Duration in ms (default: 300)
   * @param {Function} onComplete - Callback when complete
   */
  static fadeIn(scene, target, duration = 300, onComplete = null) {
    target.setAlpha(0)
    return scene.tweens.add({
      targets: target,
      alpha: 1,
      duration,
      ease: 'Power2',
      onComplete: onComplete ? () => onComplete() : null
    })
  }

  /**
   * Fade out an object from current alpha to 0
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {number} duration - Duration in ms (default: 300)
   * @param {boolean} destroy - Destroy target after fade (default: false)
   * @param {Function} onComplete - Callback when complete
   */
  static fadeOut(scene, target, duration = 300, destroy = false, onComplete = null) {
    return scene.tweens.add({
      targets: target,
      alpha: 0,
      duration,
      ease: 'Power2',
      onComplete: () => {
        if (destroy && target.destroy) target.destroy()
        if (onComplete) onComplete()
      }
    })
  }

  /**
   * Scale in from 0 to 1 with bounce effect
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {number} duration - Duration in ms (default: 400)
   * @param {Function} onComplete - Callback when complete
   */
  static scaleIn(scene, target, duration = 400, onComplete = null) {
    target.setScale(0)
    return scene.tweens.add({
      targets: target,
      scaleX: 1,
      scaleY: 1,
      duration,
      ease: 'Back.out',
      onComplete: onComplete ? () => onComplete() : null
    })
  }

  /**
   * Scale out from current to 0
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {number} duration - Duration in ms (default: 300)
   * @param {boolean} destroy - Destroy target after scale (default: false)
   * @param {Function} onComplete - Callback when complete
   */
  static scaleOut(scene, target, duration = 300, destroy = false, onComplete = null) {
    return scene.tweens.add({
      targets: target,
      scaleX: 0,
      scaleY: 0,
      duration,
      ease: 'Back.in',
      onComplete: () => {
        if (destroy && target.destroy) target.destroy()
        if (onComplete) onComplete()
      }
    })
  }

  /**
   * Pop in - scale up then back to normal (attention grabber)
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {number} scale - Max scale (default: 1.2)
   * @param {number} duration - Duration in ms (default: 200)
   */
  static popIn(scene, target, scale = 1.2, duration = 200) {
    target.setScale(0)
    return scene.tweens.add({
      targets: target,
      scaleX: { from: 0, to: scale },
      scaleY: { from: 0, to: scale },
      duration: duration * 0.6,
      ease: 'Back.out',
      onComplete: () => {
        scene.tweens.add({
          targets: target,
          scaleX: 1,
          scaleY: 1,
          duration: duration * 0.4,
          ease: 'Sine.out'
        })
      }
    })
  }

  /**
   * Shake effect (for damage, errors, etc.)
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {number} intensity - Shake intensity in pixels (default: 5)
   * @param {number} duration - Duration in ms (default: 300)
   */
  static shake(scene, target, intensity = 5, duration = 300) {
    const originalX = target.x
    const originalY = target.y

    return scene.tweens.add({
      targets: target,
      x: { from: originalX - intensity, to: originalX + intensity },
      duration: 50,
      yoyo: true,
      repeat: Math.floor(duration / 100),
      ease: 'Sine.inOut',
      onComplete: () => {
        target.x = originalX
        target.y = originalY
      }
    })
  }

  /**
   * Pulse effect (for highlighting, attention)
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {number} scale - Max scale (default: 1.1)
   * @param {number} duration - Duration per pulse in ms (default: 500)
   * @param {number} repeat - Number of repeats (-1 for infinite, default: -1)
   */
  static pulse(scene, target, scale = 1.1, duration = 500, repeat = -1) {
    return scene.tweens.add({
      targets: target,
      scaleX: scale,
      scaleY: scale,
      duration,
      yoyo: true,
      repeat,
      ease: 'Sine.inOut'
    })
  }

  /**
   * Float effect (gentle up/down motion)
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {number} distance - Float distance in pixels (default: 8)
   * @param {number} duration - Duration per cycle in ms (default: 1500)
   */
  static float(scene, target, distance = 8, duration = 1500) {
    const originalY = target.y
    return scene.tweens.add({
      targets: target,
      y: originalY - distance,
      duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    })
  }

  /**
   * Slide in from direction
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {string} direction - 'left', 'right', 'top', 'bottom' (default: 'left')
   * @param {number} distance - Slide distance (default: 100)
   * @param {number} duration - Duration in ms (default: 400)
   * @param {Function} onComplete - Callback when complete
   */
  static slideIn(scene, target, direction = 'left', distance = 100, duration = 400, onComplete = null) {
    const originalX = target.x
    const originalY = target.y

    switch (direction) {
      case 'left':
        target.x = originalX - distance
        break
      case 'right':
        target.x = originalX + distance
        break
      case 'top':
        target.y = originalY - distance
        break
      case 'bottom':
        target.y = originalY + distance
        break
    }

    target.setAlpha(0)

    return scene.tweens.add({
      targets: target,
      x: originalX,
      y: originalY,
      alpha: 1,
      duration,
      ease: 'Power3.out',
      onComplete: onComplete ? () => onComplete() : null
    })
  }

  /**
   * Slide out to direction
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {string} direction - 'left', 'right', 'top', 'bottom' (default: 'right')
   * @param {number} distance - Slide distance (default: 100)
   * @param {number} duration - Duration in ms (default: 300)
   * @param {boolean} destroy - Destroy after slide (default: false)
   */
  static slideOut(scene, target, direction = 'right', distance = 100, duration = 300, destroy = false) {
    let targetX = target.x
    let targetY = target.y

    switch (direction) {
      case 'left':
        targetX -= distance
        break
      case 'right':
        targetX += distance
        break
      case 'top':
        targetY -= distance
        break
      case 'bottom':
        targetY += distance
        break
    }

    return scene.tweens.add({
      targets: target,
      x: targetX,
      y: targetY,
      alpha: 0,
      duration,
      ease: 'Power3.in',
      onComplete: () => {
        if (destroy && target.destroy) target.destroy()
      }
    })
  }

  /**
   * Typewriter effect for text
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.Text} textObject
   * @param {string} fullText - The complete text to type
   * @param {number} speed - Characters per second (default: 30)
   * @param {Function} onComplete - Callback when complete
   */
  static typewriter(scene, textObject, fullText, speed = 30, onComplete = null) {
    textObject.setText('')
    let charIndex = 0
    const delayPerChar = 1000 / speed

    const timer = scene.time.addEvent({
      delay: delayPerChar,
      callback: () => {
        charIndex++
        textObject.setText(fullText.substring(0, charIndex))

        if (charIndex >= fullText.length) {
          timer.destroy()
          if (onComplete) onComplete()
        }
      },
      loop: true
    })

    return timer
  }

  /**
   * Count up animation for numbers
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.Text} textObject
   * @param {number} from - Starting value
   * @param {number} to - Ending value
   * @param {number} duration - Duration in ms (default: 1000)
   * @param {string} prefix - Text prefix like '$' (default: '')
   * @param {string} suffix - Text suffix like '%' (default: '')
   * @param {Function} onComplete - Callback when complete
   */
  static countUp(scene, textObject, from, to, duration = 1000, prefix = '', suffix = '', onComplete = null) {
    const startValue = { val: from }

    return scene.tweens.add({
      targets: startValue,
      val: to,
      duration,
      ease: 'Power2.out',
      onUpdate: () => {
        const displayVal = Math.floor(startValue.val)
        textObject.setText(`${prefix}${displayVal.toLocaleString()}${suffix}`)
      },
      onComplete: () => {
        textObject.setText(`${prefix}${to.toLocaleString()}${suffix}`)
        if (onComplete) onComplete()
      }
    })
  }

  /**
   * Stagger in multiple items with delay between each
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject[]} targets - Array of objects
   * @param {number} delay - Delay between items in ms (default: 100)
   * @param {string} animation - Type: 'fade', 'scale', 'slideLeft', 'slideRight', 'slideUp', 'slideDown' (default: 'fade')
   * @param {number} duration - Duration per item in ms (default: 300)
   * @param {Function} onComplete - Callback when all complete
   */
  static staggerIn(scene, targets, delay = 100, animation = 'fade', duration = 300, onComplete = null) {
    // Set initial state for all targets
    targets.forEach(target => {
      target.setAlpha(0)
      if (animation === 'scale') {
        target.setScale(0)
      }
    })

    let completed = 0

    targets.forEach((target, index) => {
      scene.time.delayedCall(index * delay, () => {
        switch (animation) {
          case 'fade':
            this.fadeIn(scene, target, duration, () => {
              completed++
              if (completed >= targets.length && onComplete) onComplete()
            })
            break
          case 'scale':
            this.scaleIn(scene, target, duration, () => {
              completed++
              if (completed >= targets.length && onComplete) onComplete()
            })
            break
          case 'slideLeft':
            this.slideIn(scene, target, 'left', 50, duration, () => {
              completed++
              if (completed >= targets.length && onComplete) onComplete()
            })
            break
          case 'slideRight':
            this.slideIn(scene, target, 'right', 50, duration, () => {
              completed++
              if (completed >= targets.length && onComplete) onComplete()
            })
            break
          case 'slideUp':
            this.slideIn(scene, target, 'bottom', 30, duration, () => {
              completed++
              if (completed >= targets.length && onComplete) onComplete()
            })
            break
          case 'slideDown':
            this.slideIn(scene, target, 'top', 30, duration, () => {
              completed++
              if (completed >= targets.length && onComplete) onComplete()
            })
            break
        }
      })
    })
  }

  /**
   * Float up and fade out (for XP gains, etc.)
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {number} distance - Float distance (default: 50)
   * @param {number} duration - Duration in ms (default: 1000)
   * @param {boolean} destroy - Destroy after animation (default: true)
   */
  static floatUpAndFade(scene, target, distance = 50, duration = 1000, destroy = true) {
    return scene.tweens.add({
      targets: target,
      y: target.y - distance,
      alpha: 0,
      duration,
      ease: 'Power2.out',
      onComplete: () => {
        if (destroy && target.destroy) target.destroy()
      }
    })
  }

  /**
   * Bounce effect
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {number} height - Bounce height (default: 20)
   * @param {number} duration - Duration in ms (default: 400)
   */
  static bounce(scene, target, height = 20, duration = 400) {
    return scene.tweens.add({
      targets: target,
      y: target.y - height,
      duration: duration / 2,
      ease: 'Sine.out',
      yoyo: true
    })
  }

  /**
   * Wobble effect (rotation back and forth)
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {number} angle - Max rotation angle in degrees (default: 5)
   * @param {number} duration - Duration per wobble in ms (default: 100)
   * @param {number} repeat - Number of wobbles (default: 3)
   */
  static wobble(scene, target, angle = 5, duration = 100, repeat = 3) {
    const angleRad = Phaser.Math.DegToRad(angle)
    return scene.tweens.add({
      targets: target,
      rotation: { from: -angleRad, to: angleRad },
      duration,
      yoyo: true,
      repeat,
      ease: 'Sine.inOut',
      onComplete: () => {
        target.rotation = 0
      }
    })
  }

  /**
   * Flash effect (quick alpha toggle)
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {number} times - Number of flashes (default: 3)
   * @param {number} duration - Duration per flash in ms (default: 100)
   */
  static flash(scene, target, times = 3, duration = 100) {
    return scene.tweens.add({
      targets: target,
      alpha: 0,
      duration,
      yoyo: true,
      repeat: times - 1,
      ease: 'Stepped',
      easeParams: [1]
    })
  }

  /**
   * Glow effect using tint
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {number} color - Glow color (default: 0xffffff)
   * @param {number} duration - Duration in ms (default: 500)
   * @param {number} repeat - Number of repeats (-1 for infinite, default: 2)
   */
  static glow(scene, target, color = 0xffffff, duration = 500, repeat = 2) {
    if (target.setTint) {
      target.setTint(color)
      return scene.tweens.add({
        targets: target,
        alpha: { from: 1, to: 0.7 },
        duration,
        yoyo: true,
        repeat,
        ease: 'Sine.inOut',
        onComplete: () => {
          target.clearTint()
          target.setAlpha(1)
        }
      })
    }
    return null
  }

  /**
   * Modal expand from center
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {number} duration - Duration in ms (default: 300)
   * @param {Function} onComplete - Callback when complete
   */
  static expandModal(scene, target, duration = 300, onComplete = null) {
    target.setScale(0)
    target.setAlpha(0)

    return scene.tweens.add({
      targets: target,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration,
      ease: 'Back.out',
      onComplete: onComplete ? () => onComplete() : null
    })
  }

  /**
   * Modal collapse to center
   * @param {Phaser.Scene} scene
   * @param {Phaser.GameObjects.GameObject} target
   * @param {number} duration - Duration in ms (default: 200)
   * @param {boolean} destroy - Destroy after collapse (default: true)
   * @param {Function} onComplete - Callback when complete
   */
  static collapseModal(scene, target, duration = 200, destroy = true, onComplete = null) {
    return scene.tweens.add({
      targets: target,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration,
      ease: 'Back.in',
      onComplete: () => {
        if (destroy && target.destroy) target.destroy()
        if (onComplete) onComplete()
      }
    })
  }

  /**
   * Screen transition - fade out current and start new scene
   * @param {Phaser.Scene} scene
   * @param {string} targetScene - Target scene key
   * @param {object} data - Data to pass to new scene (default: {})
   * @param {number} duration - Fade duration in ms (default: 200)
   */
  static transitionTo(scene, targetScene, data = {}, duration = 200) {
    scene.cameras.main.fadeOut(duration, 0, 0, 0)
    scene.time.delayedCall(duration, () => {
      scene.scene.start(targetScene, data)
    })
  }

  /**
   * Initialize scene with fade in
   * @param {Phaser.Scene} scene
   * @param {number} duration - Fade duration in ms (default: 200)
   */
  static fadeInScene(scene, duration = 200) {
    scene.cameras.main.fadeIn(duration, 0, 0, 0)
  }

  /**
   * Success flash effect on camera
   * @param {Phaser.Scene} scene
   * @param {number} duration - Duration in ms (default: 200)
   */
  static successFlash(scene, duration = 200) {
    scene.cameras.main.flash(duration, 34, 197, 94, false) // Green
  }

  /**
   * Failure flash effect on camera
   * @param {Phaser.Scene} scene
   * @param {number} duration - Duration in ms (default: 200)
   */
  static failureFlash(scene, duration = 200) {
    scene.cameras.main.flash(duration, 239, 68, 68, false) // Red
  }

  /**
   * Warning flash effect on camera
   * @param {Phaser.Scene} scene
   * @param {number} duration - Duration in ms (default: 200)
   */
  static warningFlash(scene, duration = 200) {
    scene.cameras.main.flash(duration, 245, 158, 11, false) // Orange/Amber
  }

  /**
   * Camera shake effect
   * @param {Phaser.Scene} scene
   * @param {number} duration - Duration in ms (default: 200)
   * @param {number} intensity - Shake intensity 0-1 (default: 0.02)
   */
  static cameraShake(scene, duration = 200, intensity = 0.02) {
    scene.cameras.main.shake(duration, intensity)
  }

  /**
   * Zoom in effect on camera
   * @param {Phaser.Scene} scene
   * @param {number} zoom - Zoom level (default: 1.1)
   * @param {number} duration - Duration in ms (default: 300)
   * @param {Function} onComplete - Callback when complete
   */
  static cameraZoomIn(scene, zoom = 1.1, duration = 300, onComplete = null) {
    scene.tweens.add({
      targets: scene.cameras.main,
      zoom,
      duration,
      ease: 'Sine.inOut',
      onComplete: onComplete ? () => onComplete() : null
    })
  }

  /**
   * Reset camera zoom
   * @param {Phaser.Scene} scene
   * @param {number} duration - Duration in ms (default: 300)
   */
  static cameraZoomReset(scene, duration = 300) {
    scene.tweens.add({
      targets: scene.cameras.main,
      zoom: 1,
      duration,
      ease: 'Sine.inOut'
    })
  }

  /**
   * Slow motion effect
   * @param {Phaser.Scene} scene
   * @param {number} scale - Time scale 0-1 (default: 0.3)
   * @param {number} duration - Duration in ms before reset (default: 500)
   */
  static slowMotion(scene, scale = 0.3, duration = 500) {
    scene.time.timeScale = scale
    scene.tweens.timeScale = scale

    scene.time.delayedCall(duration * scale, () => {
      scene.time.timeScale = 1
      scene.tweens.timeScale = 1
    })
  }
}

export default AnimationHelper
