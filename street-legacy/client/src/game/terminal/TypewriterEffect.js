/**
 * TypewriterEffect - Character-by-Character Text Reveal
 *
 * Features:
 * - Configurable typing speed
 * - Optional keystroke sound
 * - Skip on click/keypress
 * - Cursor blink during typing
 * - Callback on completion
 * - Pause/resume support
 */

// Default configuration
const DEFAULT_CONFIG = {
  charDelay: 30,           // ms between characters
  punctuationDelay: 150,   // Extra delay after punctuation
  wordDelay: 0,            // Extra delay after words
  cursorChar: '█',
  cursorBlinkRate: 500,    // ms for cursor blink
  skipOnClick: true,
  skipOnKey: true,
  playSound: false,
  soundKey: 'keystroke',
  onComplete: null,
  onCharacter: null
}

/**
 * TypewriterEffect class for Phaser text objects
 */
export class TypewriterEffect {
  constructor(scene, textObject, options = {}) {
    this.scene = scene
    this.textObject = textObject
    this.config = { ...DEFAULT_CONFIG, ...options }

    this.fullText = ''
    this.currentIndex = 0
    this.isTyping = false
    this.isPaused = false
    this.isComplete = false

    this.typingTimer = null
    this.cursorTimer = null
    this.cursorVisible = true

    // Store original text for reference
    this.originalText = textObject.text || ''

    // Bind skip handlers
    if (this.config.skipOnClick) {
      this.clickHandler = this.scene.input.on('pointerdown', () => this.skip())
    }
    if (this.config.skipOnKey) {
      this.keyHandler = this.scene.input.keyboard?.on('keydown', () => this.skip())
    }
  }

  /**
   * Start typing effect
   * @param {string} text - Text to type
   * @param {boolean} append - Append to existing text
   */
  start(text, append = false) {
    if (this.isTyping) {
      this.stop()
    }

    this.fullText = text
    this.currentIndex = 0
    this.isTyping = true
    this.isPaused = false
    this.isComplete = false

    if (!append) {
      this.textObject.setText('')
    }

    this.startCursorBlink()
    this.typeNextCharacter()
  }

  /**
   * Type the next character
   */
  typeNextCharacter() {
    if (!this.isTyping || this.isPaused || this.currentIndex >= this.fullText.length) {
      if (this.currentIndex >= this.fullText.length) {
        this.complete()
      }
      return
    }

    const char = this.fullText[this.currentIndex]
    const currentText = this.textObject.text.replace(this.config.cursorChar, '')

    // Add character (with cursor)
    this.textObject.setText(currentText + char + this.config.cursorChar)

    // Trigger character callback
    if (this.config.onCharacter) {
      this.config.onCharacter(char, this.currentIndex)
    }

    // Play sound if enabled
    if (this.config.playSound && this.scene.sound?.get) {
      const sound = this.scene.sound.get(this.config.soundKey)
      if (sound) {
        sound.play({ volume: 0.1 })
      }
    }

    this.currentIndex++

    // Calculate delay for next character
    let delay = this.config.charDelay

    // Extra delay for punctuation
    if ('.!?;:'.includes(char)) {
      delay += this.config.punctuationDelay
    } else if (','.includes(char)) {
      delay += this.config.punctuationDelay / 2
    }

    // Extra delay after word
    if (char === ' ' && this.config.wordDelay > 0) {
      delay += this.config.wordDelay
    }

    // Schedule next character
    this.typingTimer = this.scene.time.delayedCall(delay, () => {
      this.typeNextCharacter()
    })
  }

  /**
   * Start cursor blinking
   */
  startCursorBlink() {
    if (this.cursorTimer) {
      this.cursorTimer.remove()
    }

    this.cursorTimer = this.scene.time.addEvent({
      delay: this.config.cursorBlinkRate,
      callback: () => {
        if (!this.isTyping && !this.isComplete) return

        this.cursorVisible = !this.cursorVisible
        const text = this.textObject.text

        if (this.cursorVisible && !text.endsWith(this.config.cursorChar)) {
          this.textObject.setText(text + this.config.cursorChar)
        } else if (!this.cursorVisible && text.endsWith(this.config.cursorChar)) {
          this.textObject.setText(text.slice(0, -1))
        }
      },
      loop: true
    })
  }

  /**
   * Stop cursor blinking
   */
  stopCursorBlink() {
    if (this.cursorTimer) {
      this.cursorTimer.remove()
      this.cursorTimer = null
    }

    // Remove cursor from text
    const text = this.textObject.text
    if (text.endsWith(this.config.cursorChar)) {
      this.textObject.setText(text.slice(0, -1))
    }
  }

  /**
   * Skip to end of typing
   */
  skip() {
    if (!this.isTyping || this.isComplete) return

    // Cancel pending timer
    if (this.typingTimer) {
      this.typingTimer.remove()
    }

    // Show full text immediately
    this.textObject.setText(this.fullText)
    this.currentIndex = this.fullText.length

    this.complete()
  }

  /**
   * Pause typing
   */
  pause() {
    if (!this.isTyping || this.isPaused) return

    this.isPaused = true
    if (this.typingTimer) {
      this.typingTimer.paused = true
    }
  }

  /**
   * Resume typing
   */
  resume() {
    if (!this.isTyping || !this.isPaused) return

    this.isPaused = false
    if (this.typingTimer) {
      this.typingTimer.paused = false
    } else {
      this.typeNextCharacter()
    }
  }

  /**
   * Stop typing completely
   */
  stop() {
    this.isTyping = false
    this.isPaused = false

    if (this.typingTimer) {
      this.typingTimer.remove()
      this.typingTimer = null
    }

    this.stopCursorBlink()
  }

  /**
   * Complete typing
   */
  complete() {
    this.isTyping = false
    this.isComplete = true
    this.stopCursorBlink()

    // Final text without cursor
    const text = this.textObject.text
    if (text.endsWith(this.config.cursorChar)) {
      this.textObject.setText(text.slice(0, -1))
    }

    // Trigger completion callback
    if (this.config.onComplete) {
      this.config.onComplete()
    }
  }

  /**
   * Check if currently typing
   */
  isActive() {
    return this.isTyping && !this.isPaused
  }

  /**
   * Get progress (0-1)
   */
  getProgress() {
    if (this.fullText.length === 0) return 1
    return this.currentIndex / this.fullText.length
  }

  /**
   * Set typing speed
   */
  setSpeed(charDelay) {
    this.config.charDelay = charDelay
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    this.stop()

    if (this.clickHandler) {
      this.scene.input.off('pointerdown', this.clickHandler)
    }
    if (this.keyHandler && this.scene.input.keyboard) {
      this.scene.input.keyboard.off('keydown', this.keyHandler)
    }
  }
}

/**
 * Create a typewriter effect for a Phaser text object
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {Phaser.GameObjects.Text} textObject - Text object to animate
 * @param {string} text - Text to type
 * @param {Object} options - Effect options
 * @returns {TypewriterEffect} The typewriter effect instance
 */
export function createTypewriter(scene, textObject, text, options = {}) {
  const effect = new TypewriterEffect(scene, textObject, options)
  effect.start(text)
  return effect
}

/**
 * Type multiple lines sequentially
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {Phaser.GameObjects.Text} textObject - Text object to animate
 * @param {Array} lines - Array of lines to type
 * @param {Object} options - Effect options
 * @returns {Promise} Resolves when all lines complete
 */
export function typeMultipleLines(scene, textObject, lines, options = {}) {
  return new Promise((resolve) => {
    let currentLine = 0
    const lineDelay = options.lineDelay || 300

    function typeNextLine() {
      if (currentLine >= lines.length) {
        resolve()
        return
      }

      const isFirst = currentLine === 0
      const line = (isFirst ? '' : '\n') + lines[currentLine]

      const effect = new TypewriterEffect(scene, textObject, {
        ...options,
        onComplete: () => {
          currentLine++
          scene.time.delayedCall(lineDelay, typeNextLine)
        }
      })

      effect.start(line, !isFirst)
    }

    typeNextLine()
  })
}

/**
 * Create a dramatic reveal effect
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {Phaser.GameObjects.Text} textObject - Text object to animate
 * @param {string} text - Text to reveal
 * @param {Object} options - Effect options
 * @returns {TypewriterEffect} The typewriter effect instance
 */
export function createDramaticReveal(scene, textObject, text, options = {}) {
  return createTypewriter(scene, textObject, text, {
    charDelay: 80,
    punctuationDelay: 400,
    ...options
  })
}

/**
 * Create a fast terminal output effect
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {Phaser.GameObjects.Text} textObject - Text object to animate
 * @param {string} text - Text to output
 * @param {Object} options - Effect options
 * @returns {TypewriterEffect} The typewriter effect instance
 */
export function createFastOutput(scene, textObject, text, options = {}) {
  return createTypewriter(scene, textObject, text, {
    charDelay: 5,
    punctuationDelay: 20,
    cursorChar: '',
    skipOnClick: false,
    skipOnKey: false,
    ...options
  })
}

export default {
  TypewriterEffect,
  createTypewriter,
  typeMultipleLines,
  createDramaticReveal,
  createFastOutput
}
