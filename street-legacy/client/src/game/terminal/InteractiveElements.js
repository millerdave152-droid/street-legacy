/**
 * InteractiveElements - Factory for Inline Interactive Terminal Elements
 *
 * Element Types:
 * - ButtonPair: Yes/No buttons with hover effects and callbacks
 * - Slider: Draggable for negotiation amounts
 * - ProgressBar: Animated fill with glow on complete
 * - Countdown: Real-time updating with color transitions
 * - Collapsible: Expandable sections with +/- toggle
 */

import Phaser from 'phaser'

// Color scheme for interactive elements
const COLORS = {
  button: {
    default: 0x333333,
    hover: 0x444444,
    active: 0x00ff41,
    text: 0x00ff41,
    textHover: 0x000000
  },
  slider: {
    track: 0x333333,
    fill: 0x00ff41,
    handle: 0x00ff41,
    handleHover: 0x44ff77
  },
  progress: {
    background: 0x222222,
    fill: 0x00ff41,
    fillWarning: 0xffaa00,
    fillCritical: 0xff4444,
    glow: 0x00ff41
  },
  countdown: {
    normal: 0x00ff41,
    warning: 0xffaa00,
    critical: 0xff4444,
    expired: 0x666666
  }
}

/**
 * ButtonPair - Yes/No interactive buttons
 */
export class ButtonPair extends Phaser.GameObjects.Container {
  constructor(scene, x, y, options = {}) {
    super(scene, x, y)

    this.yesText = options.yesText || 'Yes'
    this.noText = options.noText || 'No'
    this.onYes = options.onYes || (() => {})
    this.onNo = options.onNo || (() => {})
    this.buttonWidth = options.buttonWidth || 60
    this.buttonHeight = options.buttonHeight || 24
    this.spacing = options.spacing || 10

    this.createButtons()
    scene.add.existing(this)
  }

  createButtons() {
    // Yes button
    this.yesButton = this.createButton(0, 0, this.yesText, () => {
      this.onYes()
      this.disable()
    })

    // No button
    this.noButton = this.createButton(
      this.buttonWidth + this.spacing,
      0,
      this.noText,
      () => {
        this.onNo()
        this.disable()
      }
    )

    this.add([this.yesButton, this.noButton])
  }

  createButton(x, y, text, callback) {
    const container = this.scene.add.container(x, y)

    // Background
    const bg = this.scene.add.rectangle(
      this.buttonWidth / 2,
      this.buttonHeight / 2,
      this.buttonWidth,
      this.buttonHeight,
      COLORS.button.default
    )
    bg.setStrokeStyle(1, COLORS.button.active)

    // Text
    const label = this.scene.add.text(
      this.buttonWidth / 2,
      this.buttonHeight / 2,
      text,
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '11px',
        color: '#00ff41'
      }
    ).setOrigin(0.5)

    container.add([bg, label])

    // Interactivity
    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        bg.setFillStyle(COLORS.button.hover)
        label.setColor('#000000')
      })
      .on('pointerout', () => {
        bg.setFillStyle(COLORS.button.default)
        label.setColor('#00ff41')
      })
      .on('pointerdown', () => {
        bg.setFillStyle(COLORS.button.active)
        callback()
      })

    container.bg = bg
    container.label = label
    return container
  }

  disable() {
    [this.yesButton, this.noButton].forEach(btn => {
      btn.bg.disableInteractive()
      btn.bg.setFillStyle(0x222222)
      btn.bg.setStrokeStyle(1, 0x444444)
      btn.label.setColor('#666666')
    })
  }

  getWidth() {
    return (this.buttonWidth * 2) + this.spacing
  }
}

/**
 * Slider - Draggable value selector
 */
export class Slider extends Phaser.GameObjects.Container {
  constructor(scene, x, y, options = {}) {
    super(scene, x, y)

    this.min = options.min || 0
    this.max = options.max || 100
    this.step = options.step || 1
    this.value = options.value || this.min
    this.width = options.width || 150
    this.height = options.height || 20
    this.onChange = options.onChange || (() => {})
    this.showValue = options.showValue !== false
    this.prefix = options.prefix || ''
    this.suffix = options.suffix || ''

    this.isDragging = false

    this.createSlider()
    scene.add.existing(this)
  }

  createSlider() {
    // Track background
    this.track = this.scene.add.rectangle(
      this.width / 2,
      this.height / 2,
      this.width,
      8,
      COLORS.slider.track
    )

    // Fill bar
    this.fill = this.scene.add.rectangle(
      0,
      this.height / 2,
      0,
      8,
      COLORS.slider.fill
    ).setOrigin(0, 0.5)

    // Handle
    this.handle = this.scene.add.circle(
      0,
      this.height / 2,
      8,
      COLORS.slider.handle
    )

    // Value text
    this.valueText = this.scene.add.text(
      this.width + 10,
      this.height / 2,
      this.formatValue(),
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '11px',
        color: '#00ff41'
      }
    ).setOrigin(0, 0.5)

    if (!this.showValue) {
      this.valueText.setVisible(false)
    }

    this.add([this.track, this.fill, this.handle, this.valueText])

    // Update initial position
    this.updateVisual()

    // Interactivity
    this.handle.setInteractive({ useHandCursor: true, draggable: true })
      .on('pointerover', () => {
        this.handle.setFillStyle(COLORS.slider.handleHover)
      })
      .on('pointerout', () => {
        if (!this.isDragging) {
          this.handle.setFillStyle(COLORS.slider.handle)
        }
      })
      .on('dragstart', () => {
        this.isDragging = true
      })
      .on('drag', (pointer, dragX) => {
        this.handleDrag(dragX)
      })
      .on('dragend', () => {
        this.isDragging = false
        this.handle.setFillStyle(COLORS.slider.handle)
      })

    // Track click
    this.track.setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer) => {
        const localX = pointer.x - this.x
        this.handleDrag(localX)
      })
  }

  handleDrag(localX) {
    // Clamp to track bounds
    const clampedX = Phaser.Math.Clamp(localX, 0, this.width)

    // Calculate value
    const ratio = clampedX / this.width
    let newValue = this.min + (ratio * (this.max - this.min))

    // Apply step
    newValue = Math.round(newValue / this.step) * this.step
    newValue = Phaser.Math.Clamp(newValue, this.min, this.max)

    if (newValue !== this.value) {
      this.value = newValue
      this.updateVisual()
      this.onChange(this.value)
    }
  }

  updateVisual() {
    const ratio = (this.value - this.min) / (this.max - this.min)
    const xPos = ratio * this.width

    this.handle.setX(xPos)
    this.fill.setDisplaySize(xPos, 8)
    this.valueText.setText(this.formatValue())
  }

  formatValue() {
    return `${this.prefix}${this.value}${this.suffix}`
  }

  setValue(value) {
    this.value = Phaser.Math.Clamp(value, this.min, this.max)
    this.updateVisual()
  }

  getValue() {
    return this.value
  }

  disable() {
    this.handle.disableInteractive()
    this.track.disableInteractive()
    this.handle.setFillStyle(0x444444)
    this.fill.setFillStyle(0x444444)
  }
}

/**
 * ProgressBar - Animated progress indicator
 */
export class ProgressBar extends Phaser.GameObjects.Container {
  constructor(scene, x, y, options = {}) {
    super(scene, x, y)

    this.width = options.width || 200
    this.height = options.height || 16
    this.value = options.value || 0
    this.max = options.max || 100
    this.showPercent = options.showPercent !== false
    this.animateChanges = options.animateChanges !== false
    this.warningThreshold = options.warningThreshold || 30
    this.criticalThreshold = options.criticalThreshold || 10
    this.invertColors = options.invertColors || false  // For "lower is better" bars
    this.onComplete = options.onComplete || (() => {})

    this.createBar()
    scene.add.existing(this)
  }

  createBar() {
    // Background
    this.background = this.scene.add.rectangle(
      this.width / 2,
      this.height / 2,
      this.width,
      this.height,
      COLORS.progress.background
    )
    this.background.setStrokeStyle(1, 0x444444)

    // Fill bar
    this.fill = this.scene.add.rectangle(
      1,
      1,
      0,
      this.height - 2,
      COLORS.progress.fill
    ).setOrigin(0, 0)

    // Glow effect (hidden by default)
    this.glow = this.scene.add.rectangle(
      this.width / 2,
      this.height / 2,
      this.width + 4,
      this.height + 4,
      COLORS.progress.glow,
      0.3
    )
    this.glow.setVisible(false)

    // Percentage text
    this.percentText = this.scene.add.text(
      this.width / 2,
      this.height / 2,
      '0%',
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '10px',
        color: '#ffffff'
      }
    ).setOrigin(0.5)

    if (!this.showPercent) {
      this.percentText.setVisible(false)
    }

    this.add([this.glow, this.background, this.fill, this.percentText])
    this.updateVisual()
  }

  updateVisual() {
    const percent = (this.value / this.max) * 100
    const fillWidth = Math.max(0, ((this.value / this.max) * (this.width - 2)))

    // Determine color based on value
    let color = COLORS.progress.fill
    if (this.invertColors) {
      if (percent > 100 - this.criticalThreshold) color = COLORS.progress.fillCritical
      else if (percent > 100 - this.warningThreshold) color = COLORS.progress.fillWarning
    } else {
      if (percent < this.criticalThreshold) color = COLORS.progress.fillCritical
      else if (percent < this.warningThreshold) color = COLORS.progress.fillWarning
    }

    this.fill.setFillStyle(color)
    this.fill.setDisplaySize(fillWidth, this.height - 2)
    this.percentText.setText(`${Math.round(percent)}%`)
  }

  setValue(value, animate = true) {
    const targetValue = Phaser.Math.Clamp(value, 0, this.max)

    if (animate && this.animateChanges && this.scene) {
      this.scene.tweens.add({
        targets: this,
        value: targetValue,
        duration: 300,
        ease: 'Power2',
        onUpdate: () => this.updateVisual(),
        onComplete: () => {
          if (targetValue >= this.max) {
            this.showCompletionGlow()
          }
        }
      })
    } else {
      this.value = targetValue
      this.updateVisual()
      if (targetValue >= this.max) {
        this.showCompletionGlow()
      }
    }
  }

  showCompletionGlow() {
    this.glow.setVisible(true)
    this.scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.5, to: 0 },
      duration: 500,
      onComplete: () => {
        this.glow.setVisible(false)
        this.glow.setAlpha(0.3)
        this.onComplete()
      }
    })
  }

  getValue() {
    return this.value
  }
}

/**
 * Countdown - Real-time countdown timer
 */
export class Countdown extends Phaser.GameObjects.Container {
  constructor(scene, x, y, options = {}) {
    super(scene, x, y)

    this.duration = options.duration || 60  // seconds
    this.remaining = this.duration
    this.warningAt = options.warningAt || 30
    this.criticalAt = options.criticalAt || 10
    this.onComplete = options.onComplete || (() => {})
    this.onTick = options.onTick || (() => {})
    this.autoStart = options.autoStart !== false
    this.showBar = options.showBar !== false
    this.barWidth = options.barWidth || 100

    this.isPaused = false
    this.isComplete = false
    this.lastUpdate = 0
    this.pulseActive = false

    this.createCountdown()
    scene.add.existing(this)

    if (this.autoStart) {
      this.start()
    }
  }

  createCountdown() {
    // Time text
    this.timeText = this.scene.add.text(
      0, 0,
      this.formatTime(this.duration),
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '14px',
        color: '#00ff41'
      }
    ).setOrigin(0, 0.5)

    const elements = [this.timeText]

    // Optional progress bar
    if (this.showBar) {
      this.bar = this.scene.add.rectangle(
        this.timeText.width + 10,
        0,
        this.barWidth,
        12,
        0x333333
      ).setOrigin(0, 0.5)
      this.bar.setStrokeStyle(1, 0x444444)

      this.barFill = this.scene.add.rectangle(
        this.timeText.width + 11,
        0,
        this.barWidth - 2,
        10,
        COLORS.countdown.normal
      ).setOrigin(0, 0.5)

      elements.push(this.bar, this.barFill)
    }

    this.add(elements)
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  start() {
    this.lastUpdate = Date.now()
    this.updateTimer = this.scene.time.addEvent({
      delay: 100,
      callback: this.update,
      callbackScope: this,
      loop: true
    })
  }

  update() {
    if (this.isPaused || this.isComplete) return

    const now = Date.now()
    const delta = (now - this.lastUpdate) / 1000
    this.lastUpdate = now

    this.remaining = Math.max(0, this.remaining - delta)

    // Update display
    this.timeText.setText(this.formatTime(this.remaining))

    // Update colors
    let color = COLORS.countdown.normal
    if (this.remaining <= this.criticalAt) {
      color = COLORS.countdown.critical
      this.startPulse()
    } else if (this.remaining <= this.warningAt) {
      color = COLORS.countdown.warning
    }

    this.timeText.setColor(`#${color.toString(16).padStart(6, '0')}`)

    if (this.showBar) {
      const ratio = this.remaining / this.duration
      this.barFill.setDisplaySize((this.barWidth - 2) * ratio, 10)
      this.barFill.setFillStyle(color)
    }

    this.onTick(this.remaining)

    // Check for completion
    if (this.remaining <= 0) {
      this.complete()
    }
  }

  startPulse() {
    if (this.pulseActive) return
    this.pulseActive = true

    this.scene.tweens.add({
      targets: this.timeText,
      alpha: 0.5,
      duration: 250,
      yoyo: true,
      repeat: -1
    })
  }

  stopPulse() {
    if (!this.pulseActive) return
    this.pulseActive = false
    this.scene.tweens.killTweensOf(this.timeText)
    this.timeText.setAlpha(1)
  }

  pause() {
    this.isPaused = true
  }

  resume() {
    this.isPaused = false
    this.lastUpdate = Date.now()
  }

  complete() {
    this.isComplete = true
    this.stopPulse()

    if (this.updateTimer) {
      this.updateTimer.remove()
    }

    this.timeText.setText('0:00')
    this.timeText.setColor(`#${COLORS.countdown.expired.toString(16).padStart(6, '0')}`)

    if (this.showBar) {
      this.barFill.setDisplaySize(0, 10)
    }

    this.onComplete()
  }

  addTime(seconds) {
    this.remaining += seconds
    this.duration += seconds
  }

  getRemaining() {
    return this.remaining
  }

  destroy() {
    if (this.updateTimer) {
      this.updateTimer.remove()
    }
    super.destroy()
  }
}

/**
 * Collapsible - Expandable section
 */
export class Collapsible extends Phaser.GameObjects.Container {
  constructor(scene, x, y, options = {}) {
    super(scene, x, y)

    this.title = options.title || 'Details'
    this.content = options.content || []  // Array of text lines
    this.isExpanded = options.expanded || false
    this.width = options.width || 300
    this.lineHeight = options.lineHeight || 16
    this.onToggle = options.onToggle || (() => {})

    this.createCollapsible()
    scene.add.existing(this)
  }

  createCollapsible() {
    // Header
    this.header = this.scene.add.container(0, 0)

    this.toggle = this.scene.add.text(
      0, 0,
      this.isExpanded ? '[-]' : '[+]',
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '11px',
        color: '#00ff41'
      }
    ).setOrigin(0, 0)

    this.titleText = this.scene.add.text(
      24, 0,
      this.title,
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '11px',
        color: '#00ff41'
      }
    ).setOrigin(0, 0)

    this.header.add([this.toggle, this.titleText])

    // Content container
    this.contentContainer = this.scene.add.container(16, this.lineHeight)
    this.contentTexts = []

    this.content.forEach((line, index) => {
      const text = this.scene.add.text(
        0,
        index * this.lineHeight,
        line,
        {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '11px',
          color: '#aaaaaa'
        }
      ).setOrigin(0, 0)
      this.contentTexts.push(text)
      this.contentContainer.add(text)
    })

    this.contentContainer.setVisible(this.isExpanded)

    this.add([this.header, this.contentContainer])

    // Interactivity
    const hitArea = new Phaser.Geom.Rectangle(0, 0, this.width, this.lineHeight)
    this.header.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains)
      .on('pointerover', () => {
        this.toggle.setColor('#44ff77')
        this.titleText.setColor('#44ff77')
      })
      .on('pointerout', () => {
        this.toggle.setColor('#00ff41')
        this.titleText.setColor('#00ff41')
      })
      .on('pointerdown', () => {
        this.toggleExpanded()
      })
  }

  toggleExpanded() {
    this.isExpanded = !this.isExpanded
    this.toggle.setText(this.isExpanded ? '[-]' : '[+]')
    this.contentContainer.setVisible(this.isExpanded)
    this.onToggle(this.isExpanded)
  }

  setContent(lines) {
    this.content = lines

    // Clear existing
    this.contentTexts.forEach(t => t.destroy())
    this.contentTexts = []

    // Create new
    lines.forEach((line, index) => {
      const text = this.scene.add.text(
        0,
        index * this.lineHeight,
        line,
        {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '11px',
          color: '#aaaaaa'
        }
      ).setOrigin(0, 0)
      this.contentTexts.push(text)
      this.contentContainer.add(text)
    })
  }

  getHeight() {
    if (this.isExpanded) {
      return this.lineHeight + (this.content.length * this.lineHeight)
    }
    return this.lineHeight
  }

  expand() {
    if (!this.isExpanded) this.toggleExpanded()
  }

  collapse() {
    if (this.isExpanded) this.toggleExpanded()
  }
}

/**
 * InteractiveElementsFactory - Creates interactive elements
 */
export const InteractiveElements = {
  createButtonPair: (scene, x, y, options) => new ButtonPair(scene, x, y, options),
  createSlider: (scene, x, y, options) => new Slider(scene, x, y, options),
  createProgressBar: (scene, x, y, options) => new ProgressBar(scene, x, y, options),
  createCountdown: (scene, x, y, options) => new Countdown(scene, x, y, options),
  createCollapsible: (scene, x, y, options) => new Collapsible(scene, x, y, options),

  // Quick inline button for terminal output
  createInlineButton: (scene, x, y, text, callback) => {
    return new ButtonPair(scene, x, y, {
      yesText: text,
      noText: '',
      onYes: callback,
      buttonWidth: text.length * 8 + 16
    })
  }
}

export default InteractiveElements
