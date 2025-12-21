/**
 * TerminalWidget - Interactive terminal UI component
 *
 * Renders an interactive CLI terminal in the game scene
 * Supports keyboard input, scrollable output, and autocomplete
 */

import Phaser from 'phaser'
import { terminalManager, OUTPUT_TYPES } from '../managers/TerminalManager'
import { registerAllCommands } from '../terminal/commands'
import { COLORS, DEPTH, LAYOUT, getTerminalStyle, toHexString, SYMBOLS } from './NetworkTheme'

// Terminal color mapping
const OUTPUT_COLORS = {
  [OUTPUT_TYPES.COMMAND]: 0x00ff41,    // Bright green for commands
  [OUTPUT_TYPES.RESPONSE]: 0xcccccc,   // Light gray for responses
  [OUTPUT_TYPES.ERROR]: 0xff4444,      // Red for errors
  [OUTPUT_TYPES.SYSTEM]: 0x00aaff,     // Blue for system messages
  [OUTPUT_TYPES.SUCCESS]: 0x22c55e,    // Green for success
  [OUTPUT_TYPES.WARNING]: 0xffaa00,    // Amber for warnings
  [OUTPUT_TYPES.HANDLER]: 0x8b5cf6,    // Purple for handler messages
  [OUTPUT_TYPES.SARAH]: 0x06b6d4,      // Cyan for S.A.R.A.H. AI assistant

  // S.A.R.A.H. enhanced colors
  [OUTPUT_TYPES.SARAH_HEADER]: 0x22d3ee,     // Bright cyan for headers
  [OUTPUT_TYPES.SARAH_STAT]: 0x06b6d4,       // Standard cyan for stats
  [OUTPUT_TYPES.SARAH_STAT_GOOD]: 0x22c55e,  // Green for good stats
  [OUTPUT_TYPES.SARAH_STAT_WARN]: 0xfbbf24,  // Amber for warning stats
  [OUTPUT_TYPES.SARAH_STAT_CRIT]: 0xef4444,  // Red for critical stats
  [OUTPUT_TYPES.SARAH_RECOMMEND]: 0x34d399,  // Mint green for recommendations
  [OUTPUT_TYPES.SARAH_WARNING]: 0xf59e0b,    // Orange for warnings
  [OUTPUT_TYPES.SARAH_CRITICAL]: 0xf87171,   // Bright red for critical
  [OUTPUT_TYPES.SARAH_INTEL]: 0xa78bfa,      // Light purple for intel
  [OUTPUT_TYPES.SARAH_THREAT]: 0xfb7185,     // Pink-red for threats
}

export class TerminalWidget {
  constructor(scene, options = {}) {
    this.scene = scene
    this.x = options.x || 20
    this.y = options.y || 400
    this.width = options.width || scene.cameras.main.width - 40
    this.height = options.height || 200
    this.depth = options.depth || DEPTH.CARDS

    // UI elements
    this.container = null
    this.background = null
    this.header = null
    this.outputContainer = null
    this.outputTexts = []
    this.inputLine = null
    this.inputText = null
    this.cursor = null
    this.cursorTween = null
    this.suggestionPanel = null
    this.mobileBar = null

    // State
    this.isFocused = false
    this.visibleLines = 7
    this.lineHeight = 16

    // Listener cleanup
    this.unsubscribe = null
    this.keyboardListener = null
  }

  /**
   * Create the terminal widget
   */
  create() {
    const { width, height } = this.scene.cameras.main

    // Register all commands if not done
    registerAllCommands()

    // Initialize terminal manager
    terminalManager.initialize()
    terminalManager.setCurrentScene(this.scene)

    // Create container
    this.container = this.scene.add.container(0, 0).setDepth(this.depth)

    // Background
    this.background = this.scene.add.rectangle(
      this.x + this.width / 2,
      this.y + this.height / 2,
      this.width,
      this.height,
      COLORS.bg.card,
      0.95
    ).setStrokeStyle(1, COLORS.network.dim, 0.6)
    this.container.add(this.background)

    // Make background interactive to capture focus
    this.background.setInteractive({ useHandCursor: true })
    this.background.on('pointerdown', () => this.focus())

    // Header bar
    const headerHeight = 24
    this.header = this.scene.add.rectangle(
      this.x + this.width / 2,
      this.y + headerHeight / 2,
      this.width,
      headerHeight,
      COLORS.bg.panel,
      0.95
    )
    this.container.add(this.header)

    // Header text
    const headerText = this.scene.add.text(
      this.x + 10,
      this.y + headerHeight / 2,
      `${SYMBOLS.system} THE CONSOLE`,
      {
        fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
        fontSize: '11px',
        color: toHexString(COLORS.network.primary),
        fontStyle: 'bold'
      }
    ).setOrigin(0, 0.5)
    this.container.add(headerText)

    // Connection indicator
    const connIndicator = this.scene.add.text(
      this.x + this.width - 10,
      this.y + headerHeight / 2,
      '● CONNECTED',
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '9px',
        color: toHexString(COLORS.status.success)
      }
    ).setOrigin(1, 0.5)
    this.container.add(connIndicator)

    // Pulse the connection indicator
    this.scene.tweens.add({
      targets: connIndicator,
      alpha: { from: 1, to: 0.5 },
      duration: 1500,
      yoyo: true,
      repeat: -1
    })

    // Output area
    this.createOutputArea(headerHeight)

    // Input line
    this.createInputLine(headerHeight)

    // Mobile command bar
    this.createMobileBar()

    // Subscribe to terminal updates
    this.unsubscribe = terminalManager.addListener((event, data) => {
      this.handleTerminalEvent(event, data)
    })

    // Set up keyboard input
    this.setupKeyboardInput()

    // Initial render
    this.renderOutput()

    return this
  }

  /**
   * Create the output display area
   */
  createOutputArea(headerHeight) {
    const outputY = this.y + headerHeight + 5
    const outputHeight = this.height - headerHeight - 35 // Leave room for input

    // Output container for scrolling
    this.outputContainer = this.scene.add.container(this.x + 8, outputY)
    this.container.add(this.outputContainer)

    // Create text objects for visible lines
    for (let i = 0; i < this.visibleLines; i++) {
      const lineText = this.scene.add.text(
        0,
        i * this.lineHeight,
        '',
        {
          fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
          fontSize: '11px',
          color: '#cccccc',
          wordWrap: { width: this.width - 20, useAdvancedWrap: true }
        }
      )
      this.outputTexts.push(lineText)
      this.outputContainer.add(lineText)
    }

    // Scroll indicator
    this.scrollIndicator = this.scene.add.text(
      this.x + this.width - 15,
      outputY + outputHeight / 2,
      '',
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '10px',
        color: toHexString(COLORS.text.muted)
      }
    ).setOrigin(0.5)
    this.container.add(this.scrollIndicator)
  }

  /**
   * Create the input line
   */
  createInputLine(headerHeight) {
    const inputY = this.y + this.height - 25

    // Input line background
    this.inputLine = this.scene.add.rectangle(
      this.x + this.width / 2,
      inputY,
      this.width - 4,
      20,
      COLORS.bg.void,
      0.8
    ).setStrokeStyle(1, COLORS.network.dim, 0.3)
    this.container.add(this.inputLine)

    // Prompt
    const prompt = this.scene.add.text(
      this.x + 8,
      inputY,
      '>',
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '12px',
        color: toHexString(COLORS.network.primary),
        fontStyle: 'bold'
      }
    ).setOrigin(0, 0.5)
    this.container.add(prompt)

    // Input text
    this.inputText = this.scene.add.text(
      this.x + 22,
      inputY,
      '',
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '11px',
        color: '#ffffff'
      }
    ).setOrigin(0, 0.5)
    this.container.add(this.inputText)

    // Cursor
    this.cursor = this.scene.add.text(
      this.x + 22,
      inputY,
      '_',
      {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '11px',
        color: toHexString(COLORS.network.primary)
      }
    ).setOrigin(0, 0.5)
    this.container.add(this.cursor)

    // Cursor blink animation
    this.cursorTween = this.scene.tweens.add({
      targets: this.cursor,
      alpha: { from: 1, to: 0 },
      duration: 500,
      yoyo: true,
      repeat: -1
    })
  }

  /**
   * Create mobile command bar
   */
  createMobileBar() {
    const barY = this.y + this.height + 5
    const buttonWidth = 55
    const gap = 8
    const buttons = [
      { label: 'MSG', command: 'msg ' },
      { label: 'STATUS', command: 'status' },
      { label: 'GO', command: 'go ' },
      { label: 'HELP', command: 'help' },
      { label: 'CLEAR', command: 'clear' },
    ]

    this.mobileBar = this.scene.add.container(this.x, barY)
    this.container.add(this.mobileBar)

    buttons.forEach((btn, i) => {
      const x = i * (buttonWidth + gap) + buttonWidth / 2

      const bg = this.scene.add.rectangle(
        x, 0,
        buttonWidth, 22,
        COLORS.bg.panel, 0.8
      ).setStrokeStyle(1, COLORS.network.dim, 0.4)
        .setInteractive({ useHandCursor: true })

      const text = this.scene.add.text(
        x, 0,
        btn.label,
        {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '9px',
          color: toHexString(COLORS.network.primary)
        }
      ).setOrigin(0.5)

      // Hover effects
      bg.on('pointerover', () => {
        bg.setFillStyle(COLORS.bg.elevated)
        bg.setStrokeStyle(1, COLORS.network.primary, 0.6)
      })
      bg.on('pointerout', () => {
        bg.setFillStyle(COLORS.bg.panel, 0.8)
        bg.setStrokeStyle(1, COLORS.network.dim, 0.4)
      })

      // Click - either set partial command or execute
      bg.on('pointerdown', () => {
        this.focus()
        if (btn.command.endsWith(' ')) {
          // Partial command - put in input
          terminalManager.inputBuffer = btn.command
          terminalManager.cursorPosition = btn.command.length
          this.updateInput()
        } else {
          // Full command - execute
          terminalManager.executeCommand(btn.command)
        }
      })

      this.mobileBar.add(bg)
      this.mobileBar.add(text)
    })
  }

  /**
   * Set up keyboard input handling
   */
  setupKeyboardInput() {
    // Listen for keyboard events when focused
    this.keyboardListener = (event) => {
      if (!this.isFocused) return

      // Prevent default for most keys when focused
      if (event.key !== 'F5' && event.key !== 'F12') {
        event.preventDefault()
      }

      terminalManager.processInput(event.key, event)
    }

    // Add keyboard listener
    if (this.scene.input.keyboard) {
      this.scene.input.keyboard.on('keydown', this.keyboardListener)
    }

    // Also listen for scroll wheel
    this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (this.isPointerOver(pointer)) {
        const scrollAmount = deltaY > 0 ? 1 : -1
        terminalManager.scrollOutput(scrollAmount)
      }
    })

    // Click outside to blur
    this.scene.input.on('pointerdown', (pointer) => {
      if (!this.isPointerOver(pointer)) {
        this.blur()
      }
    })
  }

  /**
   * Check if pointer is over the terminal
   */
  isPointerOver(pointer) {
    return pointer.x >= this.x &&
           pointer.x <= this.x + this.width &&
           pointer.y >= this.y &&
           pointer.y <= this.y + this.height
  }

  /**
   * Focus the terminal
   */
  focus() {
    this.isFocused = true
    terminalManager.focus()

    // Visual feedback
    this.background.setStrokeStyle(2, COLORS.network.primary, 0.8)
    this.inputLine.setStrokeStyle(1, COLORS.network.primary, 0.5)

    // Show cursor
    this.cursor.setVisible(true)
    if (this.cursorTween) {
      this.cursorTween.resume()
    }
  }

  /**
   * Blur the terminal
   */
  blur() {
    this.isFocused = false
    terminalManager.blur()

    // Visual feedback
    this.background.setStrokeStyle(1, COLORS.network.dim, 0.6)
    this.inputLine.setStrokeStyle(1, COLORS.network.dim, 0.3)

    // Hide cursor
    this.cursor.setVisible(false)
    if (this.cursorTween) {
      this.cursorTween.pause()
    }
  }

  /**
   * Handle terminal manager events
   */
  handleTerminalEvent(event, data) {
    switch (event) {
      case 'output':
      case 'clear':
      case 'scroll':
        this.renderOutput()
        break

      case 'input':
      case 'cursor':
        this.updateInput()
        break

      case 'suggestions':
        this.showSuggestions(data.suggestions)
        break

      case 'focus':
        this.focus()
        break

      case 'blur':
        this.blur()
        break
    }
  }

  /**
   * Render output lines
   */
  renderOutput() {
    const visibleOutput = terminalManager.getVisibleOutput(this.visibleLines)

    // Update text objects
    for (let i = 0; i < this.visibleLines; i++) {
      const textObj = this.outputTexts[i]
      const line = visibleOutput[i]

      if (line) {
        textObj.setText(line.text)
        textObj.setColor(toHexString(OUTPUT_COLORS[line.type] || 0xcccccc))
        textObj.setVisible(true)
      } else {
        textObj.setText('')
        textObj.setVisible(false)
      }
    }

    // Update scroll indicator
    const totalLines = terminalManager.getAllOutput().length
    const scrollOffset = terminalManager.scrollOffset
    if (scrollOffset > 0) {
      this.scrollIndicator.setText('↑')
      this.scrollIndicator.setVisible(true)
    } else if (totalLines > this.visibleLines) {
      this.scrollIndicator.setText('↓')
      this.scrollIndicator.setVisible(true)
    } else {
      this.scrollIndicator.setVisible(false)
    }
  }

  /**
   * Update input display
   */
  updateInput() {
    const input = terminalManager.getInput()
    const cursorPos = terminalManager.getCursorPosition()

    // Update input text
    this.inputText.setText(input)

    // Position cursor
    const textBeforeCursor = input.substring(0, cursorPos)
    const cursorX = this.x + 22 + (textBeforeCursor.length * 6.6) // Approximate char width

    this.cursor.setX(cursorX)
  }

  /**
   * Show autocomplete suggestions
   */
  showSuggestions(suggestions) {
    // Remove existing suggestion panel
    this.hideSuggestions()

    if (!suggestions || suggestions.length === 0) return

    const panelY = this.y + this.height - 50
    const panelHeight = Math.min(suggestions.length * 18 + 10, 80)

    this.suggestionPanel = this.scene.add.container(this.x + 20, panelY - panelHeight)
    this.container.add(this.suggestionPanel)

    // Background
    const bg = this.scene.add.rectangle(
      0, panelHeight / 2,
      150, panelHeight,
      COLORS.bg.elevated, 0.95
    ).setOrigin(0, 0.5)
      .setStrokeStyle(1, COLORS.network.primary, 0.5)
    this.suggestionPanel.add(bg)

    // Suggestion items
    suggestions.slice(0, 4).forEach((suggestion, i) => {
      const text = this.scene.add.text(
        5, 5 + i * 18,
        suggestion,
        {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '10px',
          color: toHexString(COLORS.network.primary)
        }
      ).setInteractive({ useHandCursor: true })

      text.on('pointerdown', () => {
        terminalManager.inputBuffer = suggestion + ' '
        terminalManager.cursorPosition = terminalManager.inputBuffer.length
        this.updateInput()
        this.hideSuggestions()
      })

      this.suggestionPanel.add(text)
    })

    // Auto-hide after delay
    this.scene.time.delayedCall(3000, () => this.hideSuggestions())
  }

  /**
   * Hide suggestions panel
   */
  hideSuggestions() {
    if (this.suggestionPanel) {
      this.suggestionPanel.destroy()
      this.suggestionPanel = null
    }
  }

  /**
   * Get the height of the widget (for positioning other elements)
   */
  getHeight() {
    return this.height + 30 // Include mobile bar
  }

  /**
   * Destroy the widget
   */
  destroy() {
    // Remove listeners
    if (this.unsubscribe) {
      this.unsubscribe()
    }

    if (this.scene.input.keyboard && this.keyboardListener) {
      this.scene.input.keyboard.off('keydown', this.keyboardListener)
    }

    // Destroy container
    if (this.container) {
      this.container.destroy()
    }
  }
}

export default TerminalWidget
