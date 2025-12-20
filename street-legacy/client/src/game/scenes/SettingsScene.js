import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { getPlayerData, savePlayerData, clearPlayerData } from '../data/GameData'
import { audioManager } from '../managers/AudioManager'
import { COLORS, BORDERS, getTerminalStyle, toHexString } from '../ui/NetworkTheme'

/**
 * SettingsScene - Game settings and preferences (Local Data Mode)
 *
 * Features:
 * - Audio settings (music/sfx volume)
 * - Game settings
 * - Account actions (reset progress)
 * - About/Credits
 */
export class SettingsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SettingsScene' })
    this.settings = {
      musicVolume: 0.7,
      sfxVolume: 0.8,
      notifications: true,
      autoSave: true
    }
  }

  create() {
    const { width, height } = this.cameras.main

    // Load settings from localStorage
    this.loadSettings()

    // Full screen dark background
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1)
      .setOrigin(0)
      .setDepth(0)

    // Grid pattern
    this.createGridPattern()

    // Header
    this.createHeader()

    // Close button
    this.createCloseButton()

    // Settings sections
    this.createAudioSection()
    this.createGameSection()
    this.createAccountSection()
    this.createAboutSection()
  }

  createGridPattern() {
    const { width, height } = this.cameras.main
    const graphics = this.add.graphics()
    graphics.setDepth(1)

    graphics.lineStyle(1, COLORS.network.dim, 0.15)
    for (let x = 0; x < width; x += 30) {
      graphics.lineBetween(x, 0, x, height)
    }
    for (let y = 0; y < height; y += 30) {
      graphics.lineBetween(0, y, width, y)
    }
  }

  createHeader() {
    const { width } = this.cameras.main

    // Header icon with background
    const iconBg = this.add.circle(width / 2, 35, 26, COLORS.bg.panel)
      .setStrokeStyle(BORDERS.medium, COLORS.network.primary, 0.5)
      .setDepth(9)

    this.add.text(width / 2, 35, '⚙️', {
      fontSize: '26px'
    }).setOrigin(0.5).setDepth(10)

    // Title
    this.add.text(width / 2, 72, 'SETTINGS', {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setDepth(10)
  }

  createCloseButton() {
    const { width } = this.cameras.main

    const closeBtn = this.add.text(width - 25, 25, '✕', {
      ...getTerminalStyle('xxl'),
      color: toHexString(COLORS.text.primary)
    })
    .setOrigin(0.5)
    .setDepth(999)
    .setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => {
      closeBtn.setColor(toHexString(COLORS.status.danger))
      closeBtn.setScale(1.2)
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor(toHexString(COLORS.text.primary))
      closeBtn.setScale(1)
    })
    closeBtn.on('pointerdown', () => {
      this.saveSettings()
      this.closeScene()
    })
  }

  createAudioSection() {
    const { width } = this.cameras.main
    let y = 100

    // Section header
    this.createSectionHeader(y, '🔊 Audio')
    y += 40

    // Music volume slider
    this.createSlider(y, 'Music Volume', this.settings.musicVolume, (value) => {
      this.settings.musicVolume = value
      try { audioManager.setMusicVolume(value) } catch (e) { /* ignore */ }
    })
    y += 60

    // SFX volume slider
    this.createSlider(y, 'Sound Effects', this.settings.sfxVolume, (value) => {
      this.settings.sfxVolume = value
      try { audioManager.setSFXVolume(value) } catch (e) { /* ignore */ }
    })
    y += 60

    return y
  }

  createGameSection() {
    const { width } = this.cameras.main
    let y = 270

    // Section header
    this.createSectionHeader(y, '🎮 Game')
    y += 40

    // Notifications toggle
    this.createToggle(y, 'Notifications', this.settings.notifications, (value) => {
      this.settings.notifications = value
    })
    y += 50

    // Auto-save toggle
    this.createToggle(y, 'Auto-Save', this.settings.autoSave, (value) => {
      this.settings.autoSave = value
    })

    return y
  }

  createAccountSection() {
    const { width } = this.cameras.main
    let y = 415

    // Section header
    this.createSectionHeader(y, '👤 Account')
    y += 45

    // Reset progress button
    const resetBtn = this.add.rectangle(width / 2, y, width - 60, 44, COLORS.status.danger)
      .setInteractive({ useHandCursor: true })
      .setDepth(10)

    const resetText = this.add.text(width / 2, y, '🗑️ Reset All Progress', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11)

    resetBtn.on('pointerover', () => {
      resetBtn.setFillStyle(0xdc2626)
      resetBtn.setScale(1.02)
      resetText.setScale(1.02)
    })
    resetBtn.on('pointerout', () => {
      resetBtn.setFillStyle(COLORS.status.danger)
      resetBtn.setScale(1)
      resetText.setScale(1)
    })
    resetBtn.on('pointerdown', () => this.showResetConfirmation())

    return y
  }

  createAboutSection() {
    const { width, height } = this.cameras.main
    let y = 520

    // Section header
    this.createSectionHeader(y, 'ℹ️ About')
    y += 35

    // About card
    this.add.rectangle(width / 2, y + 45, width - 40, 95, COLORS.bg.card)
      .setStrokeStyle(BORDERS.thin, COLORS.network.dim)
      .setDepth(10)

    // Version
    this.add.text(width / 2, y + 15, 'Street Legacy v1.0.0', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.network.primary),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11)

    // Local mode indicator
    this.add.text(width / 2, y + 40, '✓ Local Data Mode', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.status.success)
    }).setOrigin(0.5).setDepth(11)

    // Credits
    this.add.text(width / 2, y + 65, 'Built with Phaser 3 • All data stored locally', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setDepth(11)
  }

  createSectionHeader(y, label) {
    const { width } = this.cameras.main

    // Background line
    const line = this.add.rectangle(width / 2, y + 5, width - 40, 1, COLORS.network.dim)
      .setDepth(10)

    // Label
    this.add.text(25, y, label, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.network.primary),
      fontStyle: 'bold'
    }).setDepth(10)
  }

  createSlider(y, label, initialValue, onChange) {
    const { width } = this.cameras.main
    const sliderX = 30
    const sliderWidth = width - 100
    const sliderY = y + 25

    // Label
    this.add.text(sliderX, y, label, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.primary)
    }).setDepth(10)

    // Value display
    const valueText = this.add.text(width - 35, y, `${Math.round(initialValue * 100)}%`, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(1, 0).setDepth(10)

    // Slider background
    const sliderBg = this.add.rectangle(sliderX + sliderWidth / 2, sliderY, sliderWidth, 8, COLORS.bg.elevated)
      .setInteractive({ useHandCursor: true })
      .setDepth(10)

    // Slider fill
    const sliderFill = this.add.rectangle(sliderX, sliderY, sliderWidth * initialValue, 8, COLORS.network.primary)
      .setOrigin(0, 0.5)
      .setDepth(11)

    // Slider handle
    const handle = this.add.circle(sliderX + sliderWidth * initialValue, sliderY, 10, COLORS.network.primary)
      .setInteractive({ useHandCursor: true, draggable: true })
      .setDepth(12)

    // Handle border
    this.add.circle(sliderX + sliderWidth * initialValue, sliderY, 10)
      .setStrokeStyle(BORDERS.medium, COLORS.text.primary)
      .setDepth(13)

    // Drag handling
    let isDragging = false

    handle.on('pointerdown', () => {
      isDragging = true
    })

    this.input.on('pointermove', (pointer) => {
      if (isDragging) {
        const newX = Phaser.Math.Clamp(pointer.x, sliderX, sliderX + sliderWidth)
        const value = (newX - sliderX) / sliderWidth

        handle.x = newX
        sliderFill.width = newX - sliderX
        valueText.setText(`${Math.round(value * 100)}%`)

        onChange(value)
      }
    })

    this.input.on('pointerup', () => {
      if (isDragging) {
        isDragging = false
        try { audioManager.playClick() } catch (e) { /* ignore */ }
      }
    })

    // Click on track to jump
    sliderBg.on('pointerdown', (pointer) => {
      const newX = Phaser.Math.Clamp(pointer.x, sliderX, sliderX + sliderWidth)
      const value = (newX - sliderX) / sliderWidth

      handle.x = newX
      sliderFill.width = newX - sliderX
      valueText.setText(`${Math.round(value * 100)}%`)

      onChange(value)
      try { audioManager.playClick() } catch (e) { /* ignore */ }
    })
  }

  createToggle(y, label, initialValue, onChange) {
    const { width } = this.cameras.main
    const toggleX = width - 70

    // Label
    this.add.text(30, y, label, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.primary)
    }).setDepth(10)

    // Toggle background
    const toggleBg = this.add.rectangle(toggleX, y + 5, 50, 26, initialValue ? COLORS.status.success : COLORS.bg.elevated)
      .setInteractive({ useHandCursor: true })
      .setDepth(10)

    // Toggle handle
    const toggleHandle = this.add.circle(initialValue ? toggleX + 12 : toggleX - 12, y + 5, 10, COLORS.text.primary)
      .setDepth(11)

    // State
    let isOn = initialValue

    toggleBg.on('pointerdown', () => {
      isOn = !isOn

      // Animate
      this.tweens.add({
        targets: toggleHandle,
        x: isOn ? toggleX + 12 : toggleX - 12,
        duration: 150,
        ease: 'Power2'
      })

      toggleBg.setFillStyle(isOn ? COLORS.status.success : COLORS.bg.elevated)

      onChange(isOn)
      try { audioManager.playClick() } catch (e) { /* ignore */ }
    })
  }

  showResetConfirmation() {
    const { width, height } = this.cameras.main
    const modalElements = []

    // Overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.9)
      .setOrigin(0)
      .setInteractive()
      .setDepth(200)
    modalElements.push(overlay)

    // Modal
    const modal = this.add.rectangle(width / 2, height / 2, 280, 200, COLORS.bg.panel, 0.98)
      .setStrokeStyle(BORDERS.medium, COLORS.status.danger)
      .setDepth(201)
    modalElements.push(modal)

    // Warning icon
    const icon = this.add.text(width / 2, height / 2 - 70, '⚠️', {
      fontSize: '40px'
    }).setOrigin(0.5).setDepth(202)
    modalElements.push(icon)

    // Title
    const title = this.add.text(width / 2, height / 2 - 30, 'Reset All Progress?', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.status.danger),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202)
    modalElements.push(title)

    // Warning text
    const warning = this.add.text(width / 2, height / 2 + 5, 'This will delete all your\nsaved data permanently!', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted),
      align: 'center'
    }).setOrigin(0.5).setDepth(202)
    modalElements.push(warning)

    // Buttons
    const btnY = height / 2 + 60

    // Cancel button
    const cancelBtn = this.add.rectangle(width / 2 - 65, btnY, 90, 36, COLORS.bg.elevated)
      .setInteractive({ useHandCursor: true }).setDepth(202)
    modalElements.push(cancelBtn)

    cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(COLORS.bg.card))
    cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(COLORS.bg.elevated))
    cancelBtn.on('pointerdown', () => this.closeModal(modalElements))

    const cancelText = this.add.text(width / 2 - 65, btnY, 'Cancel', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.primary)
    }).setOrigin(0.5).setDepth(203)
    modalElements.push(cancelText)

    // Confirm button
    const confirmBtn = this.add.rectangle(width / 2 + 65, btnY, 90, 36, COLORS.status.danger)
      .setInteractive({ useHandCursor: true }).setDepth(202)
    modalElements.push(confirmBtn)

    confirmBtn.on('pointerover', () => confirmBtn.setFillStyle(0xdc2626))
    confirmBtn.on('pointerout', () => confirmBtn.setFillStyle(COLORS.status.danger))
    confirmBtn.on('pointerdown', () => {
      this.closeModal(modalElements)
      this.resetProgress()
    })

    const confirmText = this.add.text(width / 2 + 65, btnY, 'Reset', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(203)
    modalElements.push(confirmText)
  }

  closeModal(elements) {
    elements.forEach(el => el.destroy())
  }

  resetProgress() {
    // Reset player data
    clearPlayerData()
    gameManager.player = null

    this.showToast('Progress reset!', true)

    // Restart the game after a short delay
    this.time.delayedCall(1500, () => {
      this.scene.stop()
      this.scene.stop('GameScene')
      this.scene.stop('UIScene')
      this.scene.start('BootScene')
    })
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('street_legacy_settings')
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) }
      }
    } catch (e) {
      console.warn('Failed to load settings:', e)
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('street_legacy_settings', JSON.stringify(this.settings))
    } catch (e) {
      console.warn('Failed to save settings:', e)
    }
  }

  showToast(message, isSuccess = true) {
    const { width } = this.cameras.main

    const toastBg = this.add.rectangle(width / 2, 80, 200, 36, isSuccess ? COLORS.status.success : COLORS.status.danger, 0.95)
      .setDepth(400)
    const toastText = this.add.text(width / 2, 80, message, {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(401)

    // Animate in
    toastBg.setAlpha(0).setY(60)
    toastText.setAlpha(0).setY(60)

    this.tweens.add({
      targets: [toastBg, toastText],
      alpha: 1,
      y: 80,
      duration: 200,
      ease: 'Power2'
    })

    // Animate out
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: [toastBg, toastText],
        alpha: 0,
        y: 60,
        duration: 300,
        onComplete: () => {
          toastBg.destroy()
          toastText.destroy()
        }
      })
    })
  }

  closeScene() {
    this.scene.stop()
    this.scene.resume('GameScene')
  }
}
