/**
 * StatBar - Animated stat bar component for Street Legacy
 *
 * Features:
 * - Smooth fill/drain animations
 * - Color transitions based on value
 * - Warning flashes for critical levels
 * - Damage shake effect
 * - Pulsing for full bars
 */

export class StatBar {
  /**
   * Create a new stat bar
   * @param {Phaser.Scene} scene
   * @param {number} x - X position (left edge)
   * @param {number} y - Y position (center)
   * @param {object} options - Configuration options
   */
  constructor(scene, x, y, options = {}) {
    this.scene = scene
    this.x = x
    this.y = y

    // Options with defaults
    const {
      width = 200,
      height = 20,
      maxValue = 100,
      currentValue = 100,
      backgroundColor = 0x1e293b,
      fillColor = 0x22c55e,
      warningColor = 0xf59e0b,
      criticalColor = 0xef4444,
      warningThreshold = 0.3,   // 30% triggers warning color
      criticalThreshold = 0.2,  // 20% triggers critical color + flash
      showLabel = true,
      label = '',
      showValue = true,
      icon = null,
      animationDuration = 300,
      rounded = true
    } = options

    this.width = width
    this.height = height
    this.maxValue = maxValue
    this.currentValue = currentValue
    this.targetValue = currentValue
    this.fillColor = fillColor
    this.warningColor = warningColor
    this.criticalColor = criticalColor
    this.warningThreshold = warningThreshold
    this.criticalThreshold = criticalThreshold
    this.animationDuration = animationDuration

    // Container
    this.container = scene.add.container(x, y)

    // Background bar
    this.bgBar = scene.add.rectangle(0, 0, width, height, backgroundColor)
    if (rounded) {
      this.bgBar.setStrokeStyle(1, 0x374151)
    }

    // Fill bar
    const fillWidth = (currentValue / maxValue) * width
    this.fillBar = scene.add.rectangle(
      -width / 2 + fillWidth / 2,
      0,
      fillWidth,
      height - 4,
      this.getColorForValue(currentValue)
    )

    // Icon (if provided)
    this.iconText = null
    if (icon) {
      this.iconText = scene.add.text(-width / 2 - 20, 0, icon, {
        fontSize: '16px'
      }).setOrigin(0.5)
    }

    // Label (left side)
    this.labelText = null
    if (showLabel && label) {
      this.labelText = scene.add.text(-width / 2 + 8, 0, label, {
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5)
    }

    // Value text (right side)
    this.valueText = null
    if (showValue) {
      this.valueText = scene.add.text(width / 2 - 8, 0, `${currentValue}/${maxValue}`, {
        fontSize: '11px',
        color: '#ffffff'
      }).setOrigin(1, 0.5)
    }

    // Add to container
    this.container.add([this.bgBar, this.fillBar])
    if (this.iconText) this.container.add(this.iconText)
    if (this.labelText) this.container.add(this.labelText)
    if (this.valueText) this.container.add(this.valueText)

    // Flash overlay (for critical warning)
    this.flashOverlay = scene.add.rectangle(0, 0, width, height, criticalColor, 0)
    this.container.add(this.flashOverlay)

    // Current animations
    this.fillTween = null
    this.criticalFlashTween = null
    this.pulseTween = null
  }

  /**
   * Get the appropriate color for a value
   * @param {number} value
   * @returns {number} Color hex value
   */
  getColorForValue(value) {
    const ratio = value / this.maxValue
    if (ratio <= this.criticalThreshold) {
      return this.criticalColor
    } else if (ratio <= this.warningThreshold) {
      return this.warningColor
    }
    return this.fillColor
  }

  /**
   * Set the bar value with animation
   * @param {number} newValue - New value
   * @param {boolean} animate - Whether to animate (default: true)
   * @param {boolean} showDamage - Show damage effect if value decreased (default: true)
   */
  setValue(newValue, animate = true, showDamage = true) {
    const oldValue = this.currentValue
    this.targetValue = Math.max(0, Math.min(this.maxValue, newValue))

    // Stop any existing fill animation
    if (this.fillTween) {
      this.fillTween.stop()
    }

    if (!animate) {
      this.currentValue = this.targetValue
      this.updateFillBar()
      return
    }

    // Calculate new width
    const newWidth = (this.targetValue / this.maxValue) * this.width
    const newColor = this.getColorForValue(this.targetValue)

    // Check if this is damage
    const isDamage = this.targetValue < oldValue

    if (isDamage && showDamage) {
      // Shake effect on damage
      this.shake()
    }

    // Animate the fill bar
    const startWidth = this.fillBar.width
    const startX = this.fillBar.x

    this.fillTween = this.scene.tweens.add({
      targets: { value: oldValue, width: startWidth },
      value: this.targetValue,
      width: newWidth,
      duration: this.animationDuration,
      ease: isDamage ? 'Power2.out' : 'Power2.inOut',
      onUpdate: (tween) => {
        const progress = tween.progress
        const currentWidth = startWidth + (newWidth - startWidth) * progress

        this.fillBar.width = Math.max(0, currentWidth)
        this.fillBar.x = -this.width / 2 + currentWidth / 2

        // Update current value for display
        this.currentValue = Math.floor(oldValue + (this.targetValue - oldValue) * progress)

        // Update value text
        if (this.valueText) {
          this.valueText.setText(`${this.currentValue}/${this.maxValue}`)
        }

        // Interpolate color if needed
        const intermediateColor = this.getColorForValue(this.currentValue)
        this.fillBar.setFillStyle(intermediateColor)
      },
      onComplete: () => {
        this.currentValue = this.targetValue
        this.updateFillBar()
        this.checkCriticalState()
        this.checkFullState()
      }
    })
  }

  /**
   * Update fill bar display (without animation)
   */
  updateFillBar() {
    const width = (this.currentValue / this.maxValue) * this.width
    this.fillBar.width = Math.max(0, width)
    this.fillBar.x = -this.width / 2 + width / 2
    this.fillBar.setFillStyle(this.getColorForValue(this.currentValue))

    if (this.valueText) {
      this.valueText.setText(`${this.currentValue}/${this.maxValue}`)
    }
  }

  /**
   * Check and handle critical state
   */
  checkCriticalState() {
    const ratio = this.currentValue / this.maxValue

    if (ratio <= this.criticalThreshold && ratio > 0) {
      // Start critical flash if not already running
      if (!this.criticalFlashTween || !this.criticalFlashTween.isPlaying()) {
        this.startCriticalFlash()
      }
    } else {
      // Stop critical flash
      this.stopCriticalFlash()
    }
  }

  /**
   * Start critical warning flash
   */
  startCriticalFlash() {
    if (this.criticalFlashTween) {
      this.criticalFlashTween.stop()
    }

    this.criticalFlashTween = this.scene.tweens.add({
      targets: this.flashOverlay,
      alpha: { from: 0, to: 0.3 },
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    })
  }

  /**
   * Stop critical flash
   */
  stopCriticalFlash() {
    if (this.criticalFlashTween) {
      this.criticalFlashTween.stop()
      this.flashOverlay.setAlpha(0)
    }
  }

  /**
   * Check if bar is full and add pulse
   */
  checkFullState() {
    if (this.currentValue >= this.maxValue) {
      // Start pulse if not already
      if (!this.pulseTween || !this.pulseTween.isPlaying()) {
        this.pulseTween = this.scene.tweens.add({
          targets: this.fillBar,
          alpha: { from: 1, to: 0.7 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut'
        })
      }
    } else {
      if (this.pulseTween) {
        this.pulseTween.stop()
        this.fillBar.setAlpha(1)
      }
    }
  }

  /**
   * Shake effect (for damage)
   * @param {number} intensity - Shake intensity (default: 3)
   * @param {number} duration - Shake duration in ms (default: 200)
   */
  shake(intensity = 3, duration = 200) {
    const originalX = this.container.x

    this.scene.tweens.add({
      targets: this.container,
      x: { from: originalX - intensity, to: originalX + intensity },
      duration: 50,
      yoyo: true,
      repeat: Math.floor(duration / 100),
      ease: 'Sine.inOut',
      onComplete: () => {
        this.container.x = originalX
      }
    })
  }

  /**
   * Flash the bar a specific color (for feedback)
   * @param {number} color - Flash color
   * @param {number} duration - Flash duration in ms (default: 200)
   */
  flash(color, duration = 200) {
    this.flashOverlay.setFillStyle(color)

    this.scene.tweens.add({
      targets: this.flashOverlay,
      alpha: { from: 0.5, to: 0 },
      duration,
      ease: 'Power2.out'
    })
  }

  /**
   * Add/subtract from current value
   * @param {number} delta - Amount to add (negative to subtract)
   * @param {boolean} animate - Whether to animate (default: true)
   */
  addValue(delta, animate = true) {
    this.setValue(this.currentValue + delta, animate)
  }

  /**
   * Set the maximum value
   * @param {number} newMax
   */
  setMaxValue(newMax) {
    this.maxValue = newMax
    this.updateFillBar()

    if (this.valueText) {
      this.valueText.setText(`${this.currentValue}/${this.maxValue}`)
    }
  }

  /**
   * Set the label text
   * @param {string} text
   */
  setLabel(text) {
    if (this.labelText) {
      this.labelText.setText(text)
    }
  }

  /**
   * Set visibility
   * @param {boolean} visible
   */
  setVisible(visible) {
    this.container.setVisible(visible)
  }

  /**
   * Set position
   * @param {number} x
   * @param {number} y
   */
  setPosition(x, y) {
    this.container.setPosition(x, y)
  }

  /**
   * Set depth
   * @param {number} depth
   */
  setDepth(depth) {
    this.container.setDepth(depth)
  }

  /**
   * Get the container for adding to other containers
   * @returns {Phaser.GameObjects.Container}
   */
  getContainer() {
    return this.container
  }

  /**
   * Destroy the stat bar
   */
  destroy() {
    if (this.fillTween) this.fillTween.stop()
    if (this.criticalFlashTween) this.criticalFlashTween.stop()
    if (this.pulseTween) this.pulseTween.stop()
    this.container.destroy()
  }
}

export default StatBar
