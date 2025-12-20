import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { audioManager, AUDIO_KEYS } from '../managers/AudioManager'
import { audioPlaceholder } from '../managers/AudioPlaceholder'

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' })
  }

  preload() {
    const { width, height } = this.cameras.main

    // Create loading bar
    const progressBox = this.add.graphics()
    const progressBar = this.add.graphics()

    progressBox.fillStyle(0x222222, 0.8)
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50)

    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      font: '20px Arial',
      color: '#ffffff'
    }).setOrigin(0.5)

    const percentText = this.add.text(width / 2, height / 2, '0%', {
      font: '18px Arial',
      color: '#ffffff'
    }).setOrigin(0.5)

    const assetText = this.add.text(width / 2, height / 2 + 50, '', {
      font: '14px Arial',
      color: '#888888'
    }).setOrigin(0.5)

    // Update progress bar
    this.load.on('progress', (value) => {
      progressBar.clear()
      progressBar.fillStyle(0x00ff00, 1)
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30)
      percentText.setText(parseInt(value * 100) + '%')
    })

    this.load.on('fileprogress', (file) => {
      assetText.setText('Loading: ' + file.key)
    })

    this.load.on('complete', () => {
      progressBar.destroy()
      progressBox.destroy()
      loadingText.destroy()
      percentText.destroy()
      assetText.destroy()
    })

    // Load game assets - using placeholder paths
    // UI elements
    this.load.image('panel', 'assets/images/ui/panel.png')
    this.load.image('button', 'assets/images/ui/button.png')
    this.load.image('button-hover', 'assets/images/ui/button-hover.png')

    // Icons
    this.load.image('icon-cash', 'assets/images/ui/icon-cash.png')
    this.load.image('icon-health', 'assets/images/ui/icon-health.png')
    this.load.image('icon-energy', 'assets/images/ui/icon-energy.png')
    this.load.image('icon-heat', 'assets/images/ui/icon-heat.png')

    // Map assets
    this.load.image('map-toronto', 'assets/images/map/toronto.png')
    this.load.image('map-marker', 'assets/images/map/marker.png')

    // Action icons
    this.load.image('icon-crime', 'assets/images/icons/crime.png')
    this.load.image('icon-job', 'assets/images/icons/job.png')
    this.load.image('icon-property', 'assets/images/icons/property.png')
    this.load.image('icon-inventory', 'assets/images/icons/inventory.png')
    this.load.image('icon-crew', 'assets/images/icons/crew.png')
    this.load.image('icon-bank', 'assets/images/icons/bank.png')
    this.load.image('icon-map', 'assets/images/icons/map.png')

    // ==========================================================================
    // AUDIO ASSETS
    // ==========================================================================

    // Background Music
    this.load.audio(AUDIO_KEYS.BGM.MENU, 'assets/audio/bgm/menu.mp3')
    this.load.audio(AUDIO_KEYS.BGM.GAME, 'assets/audio/bgm/game.mp3')
    this.load.audio(AUDIO_KEYS.BGM.CRIME, 'assets/audio/bgm/crime.mp3')
    this.load.audio(AUDIO_KEYS.BGM.ACTION, 'assets/audio/bgm/action.mp3')
    this.load.audio(AUDIO_KEYS.BGM.VICTORY, 'assets/audio/bgm/victory.mp3')

    // UI Sound Effects
    this.load.audio(AUDIO_KEYS.SFX.CLICK, 'assets/audio/sfx/click.mp3')
    this.load.audio(AUDIO_KEYS.SFX.HOVER, 'assets/audio/sfx/hover.mp3')
    this.load.audio(AUDIO_KEYS.SFX.TAB, 'assets/audio/sfx/tab.mp3')
    this.load.audio(AUDIO_KEYS.SFX.MODAL_OPEN, 'assets/audio/sfx/modal_open.mp3')
    this.load.audio(AUDIO_KEYS.SFX.MODAL_CLOSE, 'assets/audio/sfx/modal_close.mp3')
    this.load.audio(AUDIO_KEYS.SFX.ERROR, 'assets/audio/sfx/error.mp3')

    // Game Sound Effects
    this.load.audio(AUDIO_KEYS.SFX.CASH, 'assets/audio/sfx/cash.mp3')
    this.load.audio(AUDIO_KEYS.SFX.LEVEL_UP, 'assets/audio/sfx/level_up.mp3')
    this.load.audio(AUDIO_KEYS.SFX.CRIME_SUCCESS, 'assets/audio/sfx/crime_success.mp3')
    this.load.audio(AUDIO_KEYS.SFX.CRIME_FAIL, 'assets/audio/sfx/crime_fail.mp3')
    this.load.audio(AUDIO_KEYS.SFX.ACHIEVEMENT, 'assets/audio/sfx/achievement.mp3')
    this.load.audio(AUDIO_KEYS.SFX.NOTIFICATION, 'assets/audio/sfx/notification.mp3')

    // Mini-game Sound Effects
    this.load.audio(AUDIO_KEYS.SFX.COUNTDOWN, 'assets/audio/sfx/countdown.mp3')
    this.load.audio(AUDIO_KEYS.SFX.GAME_START, 'assets/audio/sfx/game_start.mp3')
    this.load.audio(AUDIO_KEYS.SFX.GAME_WIN, 'assets/audio/sfx/game_win.mp3')
    this.load.audio(AUDIO_KEYS.SFX.GAME_LOSE, 'assets/audio/sfx/game_lose.mp3')
    this.load.audio(AUDIO_KEYS.SFX.PERFECT, 'assets/audio/sfx/perfect.mp3')
    this.load.audio(AUDIO_KEYS.SFX.HIT, 'assets/audio/sfx/hit.mp3')
    this.load.audio(AUDIO_KEYS.SFX.MISS, 'assets/audio/sfx/miss.mp3')
    this.load.audio(AUDIO_KEYS.SFX.TICK, 'assets/audio/sfx/tick.mp3')

    // Suppress load errors for missing assets during development
    this.load.on('loaderror', (file) => {
      console.warn(`Asset not found: ${file.key}`)
    })
  }

  async create() {
    const { width, height } = this.cameras.main

    // Initialize audio manager
    audioManager.init(this)

    // Generate placeholder sounds for any missing audio files
    audioPlaceholder.init()
    audioPlaceholder.generatePlaceholderSounds(this)

    // Show initializing message (local mode)
    const initText = this.add.text(width / 2, height / 2, 'Loading game...', {
      font: '18px Arial',
      color: '#ffffff'
    }).setOrigin(0.5)

    // Initialize game manager (local data mode)
    try {
      await gameManager.initialize()
      initText.destroy()

      // Start THE NETWORK boot sequence (then transitions to GameScene + UIScene)
      this.scene.start('NetworkBootScene')
    } catch (error) {
      console.error('Failed to initialize game:', error)
      initText.destroy()

      // In local mode, still try to start the game through boot sequence
      console.log('[PreloadScene] Starting game despite error')
      this.scene.start('NetworkBootScene')
    }
  }
}
