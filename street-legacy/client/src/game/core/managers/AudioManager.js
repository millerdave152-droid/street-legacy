/**
 * CoreAudioManager - Generic audio system for Phaser games
 *
 * Core engine component - no game-specific logic.
 *
 * Features:
 * - Background music with crossfade
 * - Sound effects with config-injectable keys
 * - Volume controls (persisted to localStorage)
 * - Mute toggles for music and SFX
 * - Config-injectable audio key mappings
 *
 * Usage:
 *   const audioManager = new CoreAudioManager({
 *     storageKey: 'myGame_audioSettings',
 *     audioKeys: { BGM: {...}, SFX: {...} },
 *     gameTypeBGMMap: { 'chase': 'bgm_chase', ... }
 *   })
 *   audioManager.init(scene)
 *   audioManager.playBGM('menu_music')
 *   audioManager.playSFX('click')
 */
export class CoreAudioManager {
  constructor(config = {}) {
    this.scene = null
    this.bgm = null
    this.currentBgmKey = ''
    this.fadeTween = null

    // Sound effect pools for frequently used sounds
    this.sfxPools = {}
    this.poolSize = 3

    // Settings (loaded from localStorage)
    this.sfxEnabled = true
    this.musicEnabled = true
    this.sfxVolume = 0.7
    this.musicVolume = 0.5
    this.masterVolume = 1.0

    // Audio unlock state (for browser autoplay policy)
    this.isUnlocked = false
    this.pendingBGM = null

    // Tension music state
    this.tensionActive = false

    // Config injection
    this.storageKey = config.storageKey || 'game_audioSettings'
    this.audioKeys = config.audioKeys || { BGM: {}, SFX: {} }
    this.gameTypeBGMMap = config.gameTypeBGMMap || {}
    this.sceneBGMMap = config.sceneBGMMap || {}
    this.gameTypeSoundMap = config.gameTypeSoundMap || {}

    // Track missing audio warnings
    this._missingAudioWarned = {}

    // Load saved settings
    this.loadSettings()
  }

  /**
   * Initialize the audio manager with a Phaser scene
   * @param {Phaser.Scene} scene
   */
  init(scene) {
    this.scene = scene

    // Apply saved volume settings
    if (this.scene.sound) {
      this.scene.sound.volume = this.masterVolume
    }
  }

  /**
   * Set the current scene (call when switching scenes)
   * @param {Phaser.Scene} scene
   */
  setScene(scene) {
    this.scene = scene
  }

  /**
   * Unlock audio (call on user interaction to bypass autoplay policy)
   * Browsers require user gesture before playing audio
   */
  unlock() {
    if (this.isUnlocked) return

    this.isUnlocked = true
    console.log('[AudioManager] Audio unlocked')

    // Resume Web Audio context if suspended
    if (this.scene?.sound?.context?.state === 'suspended') {
      this.scene.sound.context.resume().then(() => {
        console.log('[AudioManager] Audio context resumed')
      })
    }

    // Play any pending BGM
    if (this.pendingBGM && this.musicEnabled) {
      console.log('[AudioManager] Playing pending BGM:', this.pendingBGM)
      this.playBGM(this.pendingBGM)
      this.pendingBGM = null
    }
  }

  /**
   * Check if audio is unlocked
   * @returns {boolean}
   */
  isAudioUnlocked() {
    return this.isUnlocked
  }

  // ==========================================================================
  // SETTINGS PERSISTENCE
  // ==========================================================================

  /**
   * Load audio settings from localStorage
   */
  loadSettings() {
    try {
      const saved = localStorage.getItem(this.storageKey)
      if (saved) {
        const settings = JSON.parse(saved)
        this.sfxEnabled = settings.sfxEnabled ?? true
        this.musicEnabled = settings.musicEnabled ?? true
        this.sfxVolume = settings.sfxVolume ?? 0.7
        this.musicVolume = settings.musicVolume ?? 0.5
        this.masterVolume = settings.masterVolume ?? 1.0
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
        sfxEnabled: this.sfxEnabled,
        musicEnabled: this.musicEnabled,
        sfxVolume: this.sfxVolume,
        musicVolume: this.musicVolume,
        masterVolume: this.masterVolume
      }
      localStorage.setItem(this.storageKey, JSON.stringify(settings))
    } catch (error) {
      console.error('Failed to save audio settings:', error)
    }
  }

  // ==========================================================================
  // BACKGROUND MUSIC
  // ==========================================================================

  /**
   * Play background music
   * @param {string} key - Audio key
   * @param {boolean} loop - Whether to loop (default: true)
   */
  playBGM(key, loop = true) {
    if (!this.scene || !this.scene.sound) return
    if (!this.musicEnabled) return

    // If audio not unlocked yet, store as pending
    if (!this.isUnlocked) {
      console.log('[AudioManager] Audio locked, storing pending BGM:', key)
      this.pendingBGM = key
      return
    }

    // Don't restart if same track
    if (this.currentBgmKey === key && this.bgm && this.bgm.isPlaying) {
      return
    }

    // Check if audio exists
    if (!this.scene.cache.audio.exists(key)) {
      console.warn(`BGM not found: ${key}`)
      return
    }

    // Stop current BGM
    this.stopBGM()

    // Play new BGM
    this.bgm = this.scene.sound.add(key, {
      volume: this.musicVolume * this.masterVolume,
      loop: loop
    })

    this.bgm.play()
    this.currentBgmKey = key
  }

  /**
   * Stop background music immediately
   */
  stopBGM() {
    if (this.fadeTween) {
      this.fadeTween.stop()
      this.fadeTween = null
    }

    if (this.bgm) {
      this.bgm.stop()
      this.bgm.destroy()
      this.bgm = null
    }

    this.currentBgmKey = ''
  }

  /**
   * Pause background music
   */
  pauseBGM() {
    if (this.bgm && this.bgm.isPlaying) {
      this.bgm.pause()
    }
  }

  /**
   * Resume background music
   */
  resumeBGM() {
    if (this.bgm && this.bgm.isPaused && this.musicEnabled) {
      this.bgm.resume()
    }
  }

  /**
   * Fade out background music
   * @param {number} duration - Fade duration in ms
   * @param {Function} onComplete - Callback when fade completes
   */
  fadeOutBGM(duration = 1000, onComplete = null) {
    if (!this.bgm || !this.scene) return

    if (this.fadeTween) {
      this.fadeTween.stop()
    }

    this.fadeTween = this.scene.tweens.add({
      targets: this.bgm,
      volume: 0,
      duration: duration,
      ease: 'Linear',
      onComplete: () => {
        this.stopBGM()
        if (onComplete) onComplete()
      }
    })
  }

  /**
   * Fade in background music
   * @param {string} key - Audio key
   * @param {number} duration - Fade duration in ms
   */
  fadeInBGM(key, duration = 1000) {
    if (!this.scene || !this.scene.sound) return
    if (!this.musicEnabled) return

    if (!this.scene.cache.audio.exists(key)) {
      console.warn(`BGM not found: ${key}`)
      return
    }

    // Stop current
    this.stopBGM()

    // Start new track at volume 0
    this.bgm = this.scene.sound.add(key, {
      volume: 0,
      loop: true
    })

    this.bgm.play()
    this.currentBgmKey = key

    // Fade in
    this.fadeTween = this.scene.tweens.add({
      targets: this.bgm,
      volume: this.musicVolume * this.masterVolume,
      duration: duration,
      ease: 'Linear'
    })
  }

  /**
   * Crossfade to new background music
   * @param {string} newKey - New audio key
   * @param {number} duration - Total crossfade duration in ms
   */
  crossfadeBGM(newKey, duration = 2000) {
    if (!this.scene || !this.scene.sound) return
    if (!this.musicEnabled) return

    // Same track, do nothing
    if (this.currentBgmKey === newKey) return

    if (!this.scene.cache.audio.exists(newKey)) {
      console.warn(`BGM not found: ${newKey}`)
      return
    }

    const halfDuration = duration / 2

    // If there's current BGM, fade it out
    if (this.bgm && this.bgm.isPlaying) {
      const oldBgm = this.bgm

      // Fade out old
      this.scene.tweens.add({
        targets: oldBgm,
        volume: 0,
        duration: halfDuration,
        ease: 'Linear',
        onComplete: () => {
          oldBgm.stop()
          oldBgm.destroy()
        }
      })
    }

    // Start new track
    this.bgm = this.scene.sound.add(newKey, {
      volume: 0,
      loop: true
    })

    this.bgm.play()
    this.currentBgmKey = newKey

    // Fade in new
    this.fadeTween = this.scene.tweens.add({
      targets: this.bgm,
      volume: this.musicVolume * this.masterVolume,
      duration: halfDuration,
      delay: halfDuration / 2, // Slight overlap
      ease: 'Linear'
    })
  }

  // ==========================================================================
  // SOUND EFFECTS
  // ==========================================================================

  /**
   * Play a sound effect (safe - never throws)
   * @param {string} key - Audio key
   * @param {Object} config - Optional config (volume, rate, detune)
   */
  playSFX(key, config = {}) {
    try {
      if (!this.scene || !this.scene.sound) return
      if (!this.sfxEnabled) return

      if (!this.scene.cache.audio.exists(key)) {
        // Log missing sounds once
        if (!this._missingAudioWarned[key]) {
          this._missingAudioWarned[key] = true
          console.warn(`[AudioManager] Missing sound effect: ${key}`)
        }
        return
      }

      const volume = (config.volume ?? 1) * this.sfxVolume * this.masterVolume

      this.scene.sound.play(key, {
        volume: volume,
        rate: config.rate ?? 1,
        detune: config.detune ?? 0
      })
    } catch (error) {
      // Audio errors should never crash the game
      if (typeof import.meta !== 'undefined' && !import.meta.env?.PROD) {
        console.warn(`[AudioManager] Failed to play SFX: ${key}`, error)
      }
    }
  }

  /**
   * Play a sound effect with random pitch variation
   * @param {string} key - Audio key
   * @param {number} variance - Pitch variance in cents (default: 100)
   */
  playSFXVaried(key, variance = 100) {
    const detune = (Math.random() - 0.5) * 2 * variance
    this.playSFX(key, { detune })
  }

  // ==========================================================================
  // GENERIC HELPERS
  // ==========================================================================

  /**
   * Play a keyed sound from audioKeys.SFX
   * @param {string} sfxKey - Key in audioKeys.SFX
   * @param {Object} config - Optional config
   */
  playSFXByKey(sfxKey, config = {}) {
    const audioKey = this.audioKeys.SFX?.[sfxKey]
    if (audioKey) {
      this.playSFX(audioKey, config)
    }
  }

  /**
   * Play a keyed BGM from audioKeys.BGM
   * @param {string} bgmKey - Key in audioKeys.BGM
   * @param {boolean} loop - Whether to loop
   */
  playBGMByKey(bgmKey, loop = true) {
    const audioKey = this.audioKeys.BGM?.[bgmKey]
    if (audioKey) {
      this.playBGM(audioKey, loop)
    }
  }

  // ==========================================================================
  // TENSION MUSIC
  // ==========================================================================

  /**
   * Start tension music when time is running low
   * @param {number} secondsRemaining - Seconds left
   * @param {string} tensionBGMKey - BGM key for tension music
   */
  startTensionMusic(secondsRemaining = 10, tensionBGMKey = null) {
    if (secondsRemaining <= 10 && !this.tensionActive) {
      this.tensionActive = true
      const tensionKey = tensionBGMKey || this.audioKeys.BGM?.TENSION
      if (tensionKey && this.scene?.cache?.audio?.exists(tensionKey)) {
        this.crossfadeBGM(tensionKey, 500)
      } else if (this.bgm) {
        // Speed up current music slightly
        this.bgm.setRate(1.15)
      }
    }
  }

  /**
   * Stop tension music and return to normal
   */
  stopTensionMusic() {
    this.tensionActive = false
    if (this.bgm) {
      this.bgm.setRate(1.0)
    }
  }

  // ==========================================================================
  // COMBO SOUNDS
  // ==========================================================================

  /**
   * Play combo sound with escalating pitch based on combo count
   * @param {number} comboCount - Current combo count
   */
  playComboSound(comboCount) {
    const comboKeys = this.audioKeys.SFX
    if (comboCount >= 10 && comboKeys?.COMBO_MAX) {
      this.playSFX(comboKeys.COMBO_MAX, { volume: 1.2 })
    } else if (comboCount >= 7 && comboKeys?.COMBO_4) {
      this.playSFX(comboKeys.COMBO_4)
    } else if (comboCount >= 5 && comboKeys?.COMBO_3) {
      this.playSFX(comboKeys.COMBO_3)
    } else if (comboCount >= 3 && comboKeys?.COMBO_2) {
      this.playSFX(comboKeys.COMBO_2)
    } else if (comboCount >= 2 && comboKeys?.COMBO_1) {
      this.playSFX(comboKeys.COMBO_1)
    }
  }

  /**
   * Play escalating combo sound using pitch variation (fallback)
   * @param {number} comboCount - Current combo count
   */
  playComboSoundEscalating(comboCount) {
    const pitchBonus = Math.min(comboCount, 10) * 50
    const hitKey = this.audioKeys.SFX?.HIT || 'hit'
    this.playSFX(hitKey, {
      detune: pitchBonus,
      volume: 0.8 + (Math.min(comboCount, 10) * 0.02)
    })
  }

  // ==========================================================================
  // VICTORY FANFARE
  // ==========================================================================

  /**
   * Play victory fanfare based on performance tier
   * @param {string} tier - 'bronze', 'silver', 'gold', or 'perfect'
   */
  playVictoryFanfare(tier = 'bronze') {
    const sfxKeys = this.audioKeys.SFX || {}
    const fanfares = {
      'failed': sfxKeys.GAME_LOSE,
      'bronze': sfxKeys.VICTORY_BRONZE,
      'silver': sfxKeys.VICTORY_SILVER,
      'gold': sfxKeys.VICTORY_GOLD,
      'perfect': sfxKeys.VICTORY_PERFECT
    }

    const fanfareKey = fanfares[tier?.toLowerCase()] || fanfares.bronze

    if (fanfareKey && this.scene?.cache?.audio?.exists(fanfareKey)) {
      this.playSFX(fanfareKey)
    } else {
      // Fallback: modify generic win sound
      const volumeBoost = { bronze: 0.8, silver: 0.9, gold: 1.0, perfect: 1.2 }
      const pitchMod = { bronze: -100, silver: 0, gold: 100, perfect: 200 }
      const winKey = sfxKeys.GAME_WIN || 'game_win'
      this.playSFX(winKey, {
        volume: volumeBoost[tier] || 0.8,
        detune: pitchMod[tier] || 0
      })
    }
  }

  // ==========================================================================
  // GAME TYPE BGM
  // ==========================================================================

  /**
   * Play background music appropriate for game type
   * @param {string} gameType - The game type
   */
  playGameTypeBGM(gameType) {
    const bgmKey = this.gameTypeBGMMap[gameType?.toLowerCase()]
    const fallbackKey = this.audioKeys.BGM?.ACTION || 'bgm_action'

    if (bgmKey && this.scene?.cache?.audio?.exists(bgmKey)) {
      this.fadeInBGM(bgmKey, 500)
    } else if (this.scene?.cache?.audio?.exists(fallbackKey)) {
      this.fadeInBGM(fallbackKey, 500)
    }
  }

  /**
   * Play scene-specific BGM
   * @param {string} sceneName - Scene key
   */
  playSceneBGM(sceneName) {
    const bgmKey = this.sceneBGMMap[sceneName]
    if (bgmKey) {
      this.playBGM(bgmKey)
    }
  }

  // ==========================================================================
  // VOLUME CONTROLS
  // ==========================================================================

  setSFXVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, vol))
    this.saveSettings()
  }

  getSFXVolume() {
    return this.sfxVolume
  }

  setMusicVolume(vol) {
    this.musicVolume = Math.max(0, Math.min(1, vol))
    if (this.bgm) {
      this.bgm.setVolume(this.musicVolume * this.masterVolume)
    }
    this.saveSettings()
  }

  getMusicVolume() {
    return this.musicVolume
  }

  setMasterVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol))
    if (this.scene && this.scene.sound) {
      this.scene.sound.volume = this.masterVolume
    }
    if (this.bgm) {
      this.bgm.setVolume(this.musicVolume * this.masterVolume)
    }
    this.saveSettings()
  }

  getMasterVolume() {
    return this.masterVolume
  }

  // ==========================================================================
  // MUTE TOGGLES
  // ==========================================================================

  toggleSFX() {
    this.sfxEnabled = !this.sfxEnabled
    this.saveSettings()
    return this.sfxEnabled
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled
    if (!this.musicEnabled) {
      this.stopBGM()
    }
    this.saveSettings()
    return this.musicEnabled
  }

  setSFXEnabled(enabled) {
    this.sfxEnabled = enabled
    this.saveSettings()
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = enabled
    if (!enabled) {
      this.stopBGM()
    }
    this.saveSettings()
  }

  isSFXEnabled() {
    return this.sfxEnabled
  }

  isMusicEnabled() {
    return this.musicEnabled
  }

  muteAll() {
    if (this.scene && this.scene.sound) {
      this.scene.sound.mute = true
    }
  }

  unmuteAll() {
    if (this.scene && this.scene.sound) {
      this.scene.sound.mute = false
    }
  }

  toggleMute() {
    if (this.scene && this.scene.sound) {
      this.scene.sound.mute = !this.scene.sound.mute
      return this.scene.sound.mute
    }
    return false
  }

  isMuted() {
    return this.scene?.sound?.mute ?? false
  }

  // ==========================================================================
  // SETTINGS OBJECT
  // ==========================================================================

  getSettings() {
    return {
      sfxEnabled: this.sfxEnabled,
      musicEnabled: this.musicEnabled,
      sfxVolume: this.sfxVolume,
      musicVolume: this.musicVolume,
      masterVolume: this.masterVolume
    }
  }

  applySettings(settings) {
    if (settings.sfxEnabled !== undefined) this.sfxEnabled = settings.sfxEnabled
    if (settings.musicEnabled !== undefined) {
      this.musicEnabled = settings.musicEnabled
      if (!this.musicEnabled) this.stopBGM()
    }
    if (settings.sfxVolume !== undefined) this.sfxVolume = settings.sfxVolume
    if (settings.musicVolume !== undefined) {
      this.musicVolume = settings.musicVolume
      if (this.bgm) this.bgm.setVolume(this.musicVolume * this.masterVolume)
    }
    if (settings.masterVolume !== undefined) {
      this.masterVolume = settings.masterVolume
      if (this.scene?.sound) this.scene.sound.volume = this.masterVolume
    }
    this.saveSettings()
  }
}

export default CoreAudioManager
