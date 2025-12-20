import Phaser from 'phaser'

/**
 * AudioManager - Manages all game audio including BGM and SFX
 * Supports muting, volume control, and settings persistence
 */
class AudioManagerClass {
  constructor() {
    this.scene = null
    this.isInitialized = false

    // Audio state
    this.bgm = null
    this.currentBgmKey = null
    this.bgmVolume = 0.5
    this.sfxVolume = 0.7
    this.isBgmMuted = false
    this.isSfxMuted = false

    // Sound registry
    this.sounds = new Map()

    // BGM tracks configuration
    this.bgmTracks = {
      menu: { key: 'bgm_menu', loop: true, volume: 0.4 },
      game: { key: 'bgm_game', loop: true, volume: 0.3 },
      crime: { key: 'bgm_crime', loop: true, volume: 0.4 },
      heist: { key: 'bgm_heist', loop: true, volume: 0.5 },
      chase: { key: 'bgm_chase', loop: true, volume: 0.5 }
    }

    // SFX configuration
    this.sfxConfig = {
      // UI sounds
      click: { key: 'sfx_click', volume: 0.5 },
      hover: { key: 'sfx_hover', volume: 0.3 },
      success: { key: 'sfx_success', volume: 0.6 },
      error: { key: 'sfx_error', volume: 0.5 },
      notification: { key: 'sfx_notification', volume: 0.4 },

      // Game sounds
      cash: { key: 'sfx_cash', volume: 0.6 },
      levelup: { key: 'sfx_levelup', volume: 0.7 },
      achievement: { key: 'sfx_achievement', volume: 0.7 },
      crime_success: { key: 'sfx_crime_success', volume: 0.6 },
      crime_fail: { key: 'sfx_crime_fail', volume: 0.5 },
      jail: { key: 'sfx_jail', volume: 0.5 },
      travel: { key: 'sfx_travel', volume: 0.4 },
      purchase: { key: 'sfx_purchase', volume: 0.5 },

      // Mini-game sounds
      minigame_start: { key: 'sfx_minigame_start', volume: 0.5 },
      minigame_win: { key: 'sfx_minigame_win', volume: 0.7 },
      minigame_lose: { key: 'sfx_minigame_lose', volume: 0.5 },
      timer_tick: { key: 'sfx_timer_tick', volume: 0.3 },
      timer_warning: { key: 'sfx_timer_warning', volume: 0.5 }
    }

    // Load saved settings
    this.loadSettings()
  }

  /**
   * Initialize the audio manager with a Phaser scene
   */
  initialize(scene) {
    this.scene = scene
    this.isInitialized = true

    // Pre-register sounds if they exist in cache
    this.registerSounds()
  }

  /**
   * Register sounds from the scene's audio cache
   */
  registerSounds() {
    if (!this.scene || !this.scene.sound) return

    // Register BGM tracks
    Object.values(this.bgmTracks).forEach(track => {
      if (this.scene.cache.audio.exists(track.key)) {
        // Sound exists in cache
        console.log(`BGM registered: ${track.key}`)
      }
    })

    // Register SFX
    Object.values(this.sfxConfig).forEach(sfx => {
      if (this.scene.cache.audio.exists(sfx.key)) {
        console.log(`SFX registered: ${sfx.key}`)
      }
    })
  }

  /**
   * Load audio settings from localStorage
   */
  loadSettings() {
    try {
      const settings = localStorage.getItem('streetLegacyAudioSettings')
      if (settings) {
        const parsed = JSON.parse(settings)
        this.bgmVolume = parsed.bgmVolume ?? 0.5
        this.sfxVolume = parsed.sfxVolume ?? 0.7
        this.isBgmMuted = parsed.isBgmMuted ?? false
        this.isSfxMuted = parsed.isSfxMuted ?? false
      }
    } catch (error) {
      console.error('Failed to load audio settings:', error)
    }
  }

  /**
   * Save audio settings to localStorage
   */
  saveSettings() {
    try {
      const settings = {
        bgmVolume: this.bgmVolume,
        sfxVolume: this.sfxVolume,
        isBgmMuted: this.isBgmMuted,
        isSfxMuted: this.isSfxMuted
      }
      localStorage.setItem('streetLegacyAudioSettings', JSON.stringify(settings))
    } catch (error) {
      console.error('Failed to save audio settings:', error)
    }
  }

  /**
   * Play background music
   * @param {string} trackName - Name of the track (menu, game, crime, heist, chase)
   * @param {boolean} fade - Whether to fade in
   */
  playBgm(trackName, fade = true) {
    if (!this.scene || !this.scene.sound) return

    const track = this.bgmTracks[trackName]
    if (!track) {
      console.warn(`BGM track not found: ${trackName}`)
      return
    }

    // Don't restart if same track is already playing
    if (this.currentBgmKey === track.key && this.bgm && this.bgm.isPlaying) {
      return
    }

    // Stop current BGM
    if (this.bgm) {
      if (fade) {
        this.fadeBgm(0, 500, () => {
          this.bgm.stop()
          this.startNewBgm(track, fade)
        })
      } else {
        this.bgm.stop()
        this.startNewBgm(track, false)
      }
    } else {
      this.startNewBgm(track, fade)
    }
  }

  startNewBgm(track, fade) {
    // Check if audio exists
    if (!this.scene.cache.audio.exists(track.key)) {
      console.warn(`BGM audio not found in cache: ${track.key}`)
      return
    }

    const volume = this.isBgmMuted ? 0 : this.bgmVolume * track.volume

    this.bgm = this.scene.sound.add(track.key, {
      loop: track.loop,
      volume: fade ? 0 : volume
    })

    this.currentBgmKey = track.key
    this.bgm.play()

    if (fade) {
      this.fadeBgm(volume, 1000)
    }
  }

  /**
   * Fade BGM volume
   */
  fadeBgm(targetVolume, duration, onComplete = null) {
    if (!this.bgm || !this.scene) return

    this.scene.tweens.add({
      targets: this.bgm,
      volume: targetVolume,
      duration: duration,
      ease: 'Linear',
      onComplete: () => {
        if (onComplete) onComplete()
      }
    })
  }

  /**
   * Stop background music
   * @param {boolean} fade - Whether to fade out
   */
  stopBgm(fade = true) {
    if (!this.bgm) return

    if (fade && this.scene) {
      this.fadeBgm(0, 500, () => {
        this.bgm.stop()
        this.bgm = null
        this.currentBgmKey = null
      })
    } else {
      this.bgm.stop()
      this.bgm = null
      this.currentBgmKey = null
    }
  }

  /**
   * Pause background music
   */
  pauseBgm() {
    if (this.bgm && this.bgm.isPlaying) {
      this.bgm.pause()
    }
  }

  /**
   * Resume background music
   */
  resumeBgm() {
    if (this.bgm && this.bgm.isPaused) {
      this.bgm.resume()
    }
  }

  /**
   * Play a sound effect
   * @param {string} sfxName - Name of the sound effect
   */
  playSfx(sfxName) {
    if (!this.scene || !this.scene.sound || this.isSfxMuted) return

    const sfx = this.sfxConfig[sfxName]
    if (!sfx) {
      console.warn(`SFX not found: ${sfxName}`)
      return
    }

    // Check if audio exists
    if (!this.scene.cache.audio.exists(sfx.key)) {
      // Silently fail if audio not loaded (common during development)
      return
    }

    const volume = this.sfxVolume * sfx.volume

    this.scene.sound.play(sfx.key, {
      volume: volume
    })
  }

  /**
   * Play click sound (convenience method)
   */
  playClick() {
    this.playSfx('click')
  }

  /**
   * Play hover sound (convenience method)
   */
  playHover() {
    this.playSfx('hover')
  }

  /**
   * Set BGM volume
   * @param {number} volume - Volume from 0 to 1
   */
  setBgmVolume(volume) {
    this.bgmVolume = Phaser.Math.Clamp(volume, 0, 1)

    if (this.bgm && !this.isBgmMuted) {
      const track = Object.values(this.bgmTracks).find(t => t.key === this.currentBgmKey)
      const trackVolume = track ? track.volume : 1
      this.bgm.setVolume(this.bgmVolume * trackVolume)
    }

    this.saveSettings()
  }

  /**
   * Set SFX volume
   * @param {number} volume - Volume from 0 to 1
   */
  setSfxVolume(volume) {
    this.sfxVolume = Phaser.Math.Clamp(volume, 0, 1)
    this.saveSettings()
  }

  /**
   * Toggle BGM mute
   */
  toggleBgmMute() {
    this.isBgmMuted = !this.isBgmMuted

    if (this.bgm) {
      if (this.isBgmMuted) {
        this.bgm.setVolume(0)
      } else {
        const track = Object.values(this.bgmTracks).find(t => t.key === this.currentBgmKey)
        const trackVolume = track ? track.volume : 1
        this.bgm.setVolume(this.bgmVolume * trackVolume)
      }
    }

    this.saveSettings()
    return this.isBgmMuted
  }

  /**
   * Toggle SFX mute
   */
  toggleSfxMute() {
    this.isSfxMuted = !this.isSfxMuted
    this.saveSettings()
    return this.isSfxMuted
  }

  /**
   * Mute all audio
   */
  muteAll() {
    this.isBgmMuted = true
    this.isSfxMuted = true

    if (this.bgm) {
      this.bgm.setVolume(0)
    }

    this.saveSettings()
  }

  /**
   * Unmute all audio
   */
  unmuteAll() {
    this.isBgmMuted = false
    this.isSfxMuted = false

    if (this.bgm) {
      const track = Object.values(this.bgmTracks).find(t => t.key === this.currentBgmKey)
      const trackVolume = track ? track.volume : 1
      this.bgm.setVolume(this.bgmVolume * trackVolume)
    }

    this.saveSettings()
  }

  /**
   * Get current audio settings
   */
  getSettings() {
    return {
      bgmVolume: this.bgmVolume,
      sfxVolume: this.sfxVolume,
      isBgmMuted: this.isBgmMuted,
      isSfxMuted: this.isSfxMuted
    }
  }

  /**
   * Check if BGM is currently playing
   */
  isBgmPlaying() {
    return this.bgm && this.bgm.isPlaying
  }

  /**
   * Get current BGM track name
   */
  getCurrentBgmTrack() {
    if (!this.currentBgmKey) return null

    const entry = Object.entries(this.bgmTracks).find(([, track]) => track.key === this.currentBgmKey)
    return entry ? entry[0] : null
  }

  /**
   * Play a sequence of sounds
   * @param {string[]} sfxNames - Array of SFX names to play
   * @param {number} delay - Delay between sounds in ms
   */
  playSfxSequence(sfxNames, delay = 200) {
    sfxNames.forEach((sfxName, index) => {
      this.scene.time.delayedCall(index * delay, () => {
        this.playSfx(sfxName)
      })
    })
  }

  /**
   * Clean up audio manager
   */
  cleanup() {
    this.stopBgm(false)
    this.sounds.clear()
    this.scene = null
    this.isInitialized = false
  }
}

// Export singleton instance
export const audioManager = new AudioManagerClass()
export default audioManager
