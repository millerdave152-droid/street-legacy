import Phaser from 'phaser'
import { audioManager } from '../managers/AudioManager'
import { tutorialManager } from '../managers/TutorialManager'
import { VERSION } from '../config/Constants'
import { COLORS, BORDERS, getTerminalStyle, toHexString } from '../ui/NetworkTheme'

/**
 * AudioSettingsScene - Audio settings overlay
 *
 * Features:
 * - Master volume slider
 * - Music volume slider with toggle
 * - SFX volume slider with toggle
 * - Test sound buttons
 * - Persists settings to localStorage
 */
export class AudioSettingsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'AudioSettingsScene' })
  }

  create() {
    const { width, height } = this.cameras.main

    // Initialize audio manager with this scene
    audioManager.setScene(this)

    // FULL opaque background - covers everything underneath
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1)
      .setOrigin(0)
      .setDepth(100)
      .setInteractive()

    // Modal background
    const modalWidth = Math.min(380, width - 40)
    const modalHeight = 520
    const modalX = width / 2
    const modalY = height / 2

    this.modal = this.add.rectangle(modalX, modalY, modalWidth, modalHeight, COLORS.bg.panel, 0.98)
    this.modal.setStrokeStyle(BORDERS.medium, COLORS.network.primary)

    // Header
    this.add.text(modalX, modalY - modalHeight / 2 + 35, '⚙️ SETTINGS', {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5)

    // Close button
    const closeBtn = this.add.text(modalX + modalWidth / 2 - 20, modalY - modalHeight / 2 + 20, '✕', {
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
      console.log('[AudioSettingsScene] Close button clicked')
      audioManager.playClick()
      this.closeScene()
    })

    // Content start Y
    const contentStartY = modalY - modalHeight / 2 + 80
    const leftX = modalX - modalWidth / 2 + 30
    const rightX = modalX + modalWidth / 2 - 30

    // Create sliders and toggles
    this.createMasterVolumeSlider(leftX, contentStartY, modalWidth - 60)
    this.createMusicControls(leftX, contentStartY + 90, modalWidth - 60)
    this.createSFXControls(leftX, contentStartY + 180, modalWidth - 60)

    // Test buttons
    this.createTestButtons(modalX, contentStartY + 280)

    // Reset buttons section
    this.createResetButtons(modalX, modalY + modalHeight / 2 - 90, modalWidth - 60)

    // Version display
    this.add.text(modalX, modalY + modalHeight / 2 - 20, VERSION.STRING, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)
  }

  shutdown() {
    // Clean up tweens and timers
    this.tweens.killAll()
    this.time.removeAllEvents()
    this.input.removeAllListeners()
  }

  createMasterVolumeSlider(x, y, width) {
    // Label
    this.add.text(x, y, 'Master Volume', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold'
    })

    // Value display
    this.masterValueText = this.add.text(x + width, y, `${Math.round(audioManager.getMasterVolume() * 100)}%`, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.network.primary)
    }).setOrigin(1, 0)

    // Slider track
    const sliderY = y + 35
    const trackWidth = width
    const trackHeight = 8

    this.masterTrack = this.add.rectangle(x + trackWidth / 2, sliderY, trackWidth, trackHeight, COLORS.bg.elevated)
      .setInteractive({ useHandCursor: true })

    // Slider fill
    const fillWidth = audioManager.getMasterVolume() * trackWidth
    this.masterFill = this.add.rectangle(x, sliderY, fillWidth, trackHeight, COLORS.network.primary)
      .setOrigin(0, 0.5)

    // Slider handle
    this.masterHandle = this.add.circle(x + fillWidth, sliderY, 12, COLORS.text.primary)
      .setInteractive({ useHandCursor: true, draggable: true })

    // Drag handling
    this.input.setDraggable(this.masterHandle)

    this.masterHandle.on('drag', (pointer, dragX) => {
      const minX = x
      const maxX = x + trackWidth

      const clampedX = Phaser.Math.Clamp(dragX, minX, maxX)
      this.masterHandle.x = clampedX

      const volume = (clampedX - x) / trackWidth
      this.masterFill.width = clampedX - x

      audioManager.setMasterVolume(volume)
      this.masterValueText.setText(`${Math.round(volume * 100)}%`)
    })

    // Click on track to set position
    this.masterTrack.on('pointerdown', (pointer) => {
      const localX = pointer.x - (this.cameras.main.width / 2) + (trackWidth / 2)
      const volume = Phaser.Math.Clamp(localX / trackWidth, 0, 1)

      this.masterHandle.x = x + volume * trackWidth
      this.masterFill.width = volume * trackWidth

      audioManager.setMasterVolume(volume)
      this.masterValueText.setText(`${Math.round(volume * 100)}%`)
    })
  }

  createMusicControls(x, y, width) {
    // Toggle button
    const toggleSize = 40
    this.musicToggle = this.add.rectangle(x + toggleSize / 2, y + 15, toggleSize, toggleSize,
      audioManager.isMusicEnabled() ? COLORS.status.success : COLORS.bg.elevated)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(BORDERS.medium, audioManager.isMusicEnabled() ? COLORS.status.success : COLORS.network.dim)

    this.musicToggleIcon = this.add.text(x + toggleSize / 2, y + 15,
      audioManager.isMusicEnabled() ? '🎵' : '🔇', {
        fontSize: '20px'
      }).setOrigin(0.5)

    this.musicToggle.on('pointerdown', () => {
      audioManager.playClick()
      const enabled = audioManager.toggleMusic()
      this.musicToggle.setFillStyle(enabled ? COLORS.status.success : COLORS.bg.elevated)
      this.musicToggle.setStrokeStyle(BORDERS.medium, enabled ? COLORS.status.success : COLORS.network.dim)
      this.musicToggleIcon.setText(enabled ? '🎵' : '🔇')
      this.updateMusicSliderState(enabled)
    })

    // Label
    this.add.text(x + toggleSize + 15, y, 'Music', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold'
    })

    // Value display
    this.musicValueText = this.add.text(x + width, y, `${Math.round(audioManager.getMusicVolume() * 100)}%`, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.status.success)
    }).setOrigin(1, 0)

    // Slider track
    const sliderY = y + 35
    const sliderX = x + toggleSize + 15
    const trackWidth = width - toggleSize - 15
    const trackHeight = 8

    this.musicTrack = this.add.rectangle(sliderX + trackWidth / 2, sliderY, trackWidth, trackHeight, COLORS.bg.elevated)
      .setInteractive({ useHandCursor: true })

    // Slider fill
    const fillWidth = audioManager.getMusicVolume() * trackWidth
    this.musicFill = this.add.rectangle(sliderX, sliderY, fillWidth, trackHeight, COLORS.status.success)
      .setOrigin(0, 0.5)

    // Slider handle
    this.musicHandle = this.add.circle(sliderX + fillWidth, sliderY, 10, COLORS.text.primary)
      .setInteractive({ useHandCursor: true, draggable: true })

    this.input.setDraggable(this.musicHandle)

    this.musicHandle.on('drag', (pointer, dragX) => {
      if (!audioManager.isMusicEnabled()) return

      const minX = sliderX
      const maxX = sliderX + trackWidth

      const clampedX = Phaser.Math.Clamp(dragX, minX, maxX)
      this.musicHandle.x = clampedX

      const volume = (clampedX - sliderX) / trackWidth
      this.musicFill.width = clampedX - sliderX

      audioManager.setMusicVolume(volume)
      this.musicValueText.setText(`${Math.round(volume * 100)}%`)
    })

    this.musicTrack.on('pointerdown', (pointer) => {
      if (!audioManager.isMusicEnabled()) return

      const rect = this.musicTrack.getBounds()
      const localX = pointer.x - rect.left
      const volume = Phaser.Math.Clamp(localX / trackWidth, 0, 1)

      this.musicHandle.x = sliderX + volume * trackWidth
      this.musicFill.width = volume * trackWidth

      audioManager.setMusicVolume(volume)
      this.musicValueText.setText(`${Math.round(volume * 100)}%`)
    })

    // Store slider references for state updates
    this.musicSliderX = sliderX
    this.musicSliderWidth = trackWidth
  }

  updateMusicSliderState(enabled) {
    const alpha = enabled ? 1 : 0.4
    this.musicTrack.setAlpha(alpha)
    this.musicFill.setAlpha(alpha)
    this.musicHandle.setAlpha(alpha)
    this.musicValueText.setAlpha(alpha)
  }

  createSFXControls(x, y, width) {
    // Toggle button
    const toggleSize = 40
    this.sfxToggle = this.add.rectangle(x + toggleSize / 2, y + 15, toggleSize, toggleSize,
      audioManager.isSFXEnabled() ? COLORS.status.info : COLORS.bg.elevated)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(BORDERS.medium, audioManager.isSFXEnabled() ? COLORS.status.info : COLORS.network.dim)

    this.sfxToggleIcon = this.add.text(x + toggleSize / 2, y + 15,
      audioManager.isSFXEnabled() ? '🔊' : '🔇', {
        fontSize: '20px'
      }).setOrigin(0.5)

    this.sfxToggle.on('pointerdown', () => {
      const enabled = audioManager.toggleSFX()
      this.sfxToggle.setFillStyle(enabled ? COLORS.status.info : COLORS.bg.elevated)
      this.sfxToggle.setStrokeStyle(BORDERS.medium, enabled ? COLORS.status.info : COLORS.network.dim)
      this.sfxToggleIcon.setText(enabled ? '🔊' : '🔇')
      this.updateSFXSliderState(enabled)

      // Play test sound if enabled
      if (enabled) {
        audioManager.playClick()
      }
    })

    // Label
    this.add.text(x + toggleSize + 15, y, 'Sound Effects', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.text.primary),
      fontStyle: 'bold'
    })

    // Value display
    this.sfxValueText = this.add.text(x + width, y, `${Math.round(audioManager.getSFXVolume() * 100)}%`, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.status.info)
    }).setOrigin(1, 0)

    // Slider track
    const sliderY = y + 35
    const sliderX = x + toggleSize + 15
    const trackWidth = width - toggleSize - 15
    const trackHeight = 8

    this.sfxTrack = this.add.rectangle(sliderX + trackWidth / 2, sliderY, trackWidth, trackHeight, COLORS.bg.elevated)
      .setInteractive({ useHandCursor: true })

    // Slider fill
    const fillWidth = audioManager.getSFXVolume() * trackWidth
    this.sfxFill = this.add.rectangle(sliderX, sliderY, fillWidth, trackHeight, COLORS.status.info)
      .setOrigin(0, 0.5)

    // Slider handle
    this.sfxHandle = this.add.circle(sliderX + fillWidth, sliderY, 10, COLORS.text.primary)
      .setInteractive({ useHandCursor: true, draggable: true })

    this.input.setDraggable(this.sfxHandle)

    this.sfxHandle.on('drag', (pointer, dragX) => {
      if (!audioManager.isSFXEnabled()) return

      const minX = sliderX
      const maxX = sliderX + trackWidth

      const clampedX = Phaser.Math.Clamp(dragX, minX, maxX)
      this.sfxHandle.x = clampedX

      const volume = (clampedX - sliderX) / trackWidth
      this.sfxFill.width = clampedX - sliderX

      audioManager.setSFXVolume(volume)
      this.sfxValueText.setText(`${Math.round(volume * 100)}%`)
    })

    this.sfxHandle.on('dragend', () => {
      // Play test sound after adjusting
      audioManager.playClick()
    })

    this.sfxTrack.on('pointerdown', (pointer) => {
      if (!audioManager.isSFXEnabled()) return

      const rect = this.sfxTrack.getBounds()
      const localX = pointer.x - rect.left
      const volume = Phaser.Math.Clamp(localX / trackWidth, 0, 1)

      this.sfxHandle.x = sliderX + volume * trackWidth
      this.sfxFill.width = volume * trackWidth

      audioManager.setSFXVolume(volume)
      this.sfxValueText.setText(`${Math.round(volume * 100)}%`)

      // Play test sound
      audioManager.playClick()
    })

    // Store slider references
    this.sfxSliderX = sliderX
    this.sfxSliderWidth = trackWidth
  }

  updateSFXSliderState(enabled) {
    const alpha = enabled ? 1 : 0.4
    this.sfxTrack.setAlpha(alpha)
    this.sfxFill.setAlpha(alpha)
    this.sfxHandle.setAlpha(alpha)
    this.sfxValueText.setAlpha(alpha)
  }

  createTestButtons(centerX, y) {
    this.add.text(centerX, y, 'Test Sounds', {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    const buttonY = y + 35
    const buttonWidth = 100
    const buttonHeight = 36
    const spacing = 15

    // Test Music button
    const musicBtn = this.add.rectangle(centerX - buttonWidth / 2 - spacing / 2, buttonY,
      buttonWidth, buttonHeight, COLORS.status.success, 0.8)
      .setInteractive({ useHandCursor: true })

    this.add.text(centerX - buttonWidth / 2 - spacing / 2, buttonY, '🎵 Music', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.primary)
    }).setOrigin(0.5)

    musicBtn.on('pointerover', () => musicBtn.setFillStyle(COLORS.status.success, 1))
    musicBtn.on('pointerout', () => musicBtn.setFillStyle(COLORS.status.success, 0.8))
    musicBtn.on('pointerdown', () => {
      audioManager.playClick()
      // Play a short music preview or toggle current BGM
      if (audioManager.isMusicEnabled()) {
        audioManager.playBGM('bgm_menu')
      }
    })

    // Test SFX button
    const sfxBtn = this.add.rectangle(centerX + buttonWidth / 2 + spacing / 2, buttonY,
      buttonWidth, buttonHeight, COLORS.status.info, 0.8)
      .setInteractive({ useHandCursor: true })

    this.add.text(centerX + buttonWidth / 2 + spacing / 2, buttonY, '🔊 SFX', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.primary)
    }).setOrigin(0.5)

    sfxBtn.on('pointerover', () => sfxBtn.setFillStyle(COLORS.status.info, 1))
    sfxBtn.on('pointerout', () => sfxBtn.setFillStyle(COLORS.status.info, 0.8))
    sfxBtn.on('pointerdown', () => {
      // Play multiple test sounds
      audioManager.playClick()
      this.time.delayedCall(300, () => audioManager.playCashGain(5000))
      this.time.delayedCall(600, () => audioManager.playNotification())
    })
  }

  createResetButtons(centerX, y, width) {
    // Section divider
    this.add.rectangle(centerX, y - 15, width, 1, COLORS.bg.elevated)

    // Section label
    this.add.text(centerX, y + 5, 'Reset Options', {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    const buttonY = y + 45
    const buttonWidth = 140
    const buttonHeight = 36
    const spacing = 20

    // Reset Audio button
    const audioBtn = this.add.rectangle(centerX - buttonWidth / 2 - spacing / 2, buttonY,
      buttonWidth, buttonHeight, COLORS.bg.elevated)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(BORDERS.thin, COLORS.network.dim)

    const audioBtnText = this.add.text(centerX - buttonWidth / 2 - spacing / 2, buttonY, '↺ Reset Audio', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5)

    audioBtn.on('pointerover', () => {
      audioBtn.setFillStyle(COLORS.bg.card)
      audioBtnText.setColor(toHexString(COLORS.text.primary))
    })
    audioBtn.on('pointerout', () => {
      audioBtn.setFillStyle(COLORS.bg.elevated)
      audioBtnText.setColor(toHexString(COLORS.text.muted))
    })
    audioBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.resetToDefaults()
    })

    // Reset Tutorial button
    const tutorialBtn = this.add.rectangle(centerX + buttonWidth / 2 + spacing / 2, buttonY,
      buttonWidth, buttonHeight, COLORS.bg.elevated)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(BORDERS.thin, COLORS.status.warning)

    const tutorialBtnText = this.add.text(centerX + buttonWidth / 2 + spacing / 2, buttonY, '📖 Reset Tutorial', {
      ...getTerminalStyle('sm'),
      color: toHexString(COLORS.status.warning)
    }).setOrigin(0.5)

    tutorialBtn.on('pointerover', () => {
      tutorialBtn.setFillStyle(COLORS.bg.card)
      tutorialBtnText.setColor(toHexString(COLORS.text.gold))
    })
    tutorialBtn.on('pointerout', () => {
      tutorialBtn.setFillStyle(COLORS.bg.elevated)
      tutorialBtnText.setColor(toHexString(COLORS.status.warning))
    })
    tutorialBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.resetTutorial()
    })
  }

  resetTutorial() {
    // Reset tutorial progress
    tutorialManager.resetTutorial()

    // Show confirmation
    const { width, height } = this.cameras.main
    const confirmText = this.add.text(width / 2, height / 2 - 50, 'Tutorial Reset!\nReturn to game to restart.', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.status.success),
      align: 'center'
    }).setOrigin(0.5).setDepth(200)

    // Fade out confirmation
    this.tweens.add({
      targets: confirmText,
      alpha: 0,
      y: confirmText.y - 30,
      duration: 2000,
      delay: 1000,
      onComplete: () => confirmText.destroy()
    })
  }

  resetToDefaults() {
    // Reset all settings
    audioManager.applySettings({
      sfxEnabled: true,
      musicEnabled: true,
      sfxVolume: 0.7,
      musicVolume: 0.5,
      masterVolume: 1.0
    })

    // Refresh UI
    this.scene.restart()
  }

  closeScene() {
    this.scene.stop()
    this.scene.resume('GameScene')
  }
}
