/**
 * AudioManager - Singleton audio system for Street Legacy
 *
 * Features:
 * - Background music with crossfade
 * - Sound effects with pooling
 * - Volume controls (persisted to localStorage)
 * - Mute toggles for music and SFX
 * - Scene-specific ambient sounds
 *
 * Usage:
 *   import { audioManager } from '../managers/AudioManager'
 *   audioManager.init(scene)
 *   audioManager.playBGM('menu_music')
 *   audioManager.playSFX('click')
 */

// Audio keys for the game
export const AUDIO_KEYS = {
  // Background music
  BGM: {
    MENU: 'bgm_menu',           // Main menu (chill, atmospheric)
    GAME: 'bgm_game',           // Main game (urban, ambient)
    CRIME: 'bgm_crime',         // Crime scene (tense, suspenseful)
    ACTION: 'bgm_action',       // Mini-games (upbeat, energetic)
    VICTORY: 'bgm_victory',     // Success screen (triumphant)
    TENSION: 'bgm_tension',     // P64: Countdown tension music
    HEIST: 'bgm_heist',         // P68: Heist-specific action
    CHASE: 'bgm_chase'          // P68: Chase game music
  },
  // Sound effects
  SFX: {
    // UI sounds
    CLICK: 'click',             // Button press
    HOVER: 'hover',             // Button hover (subtle)
    TAB: 'tab',                 // Tab switch
    MODAL_OPEN: 'modal_open',   // Popup open
    MODAL_CLOSE: 'modal_close', // Popup close
    ERROR: 'error',             // Invalid action buzz

    // Game sounds
    CASH: 'cash',               // Money received (coin sound)
    LEVEL_UP: 'level_up',       // Level up fanfare
    CRIME_SUCCESS: 'crime_success', // Successful crime
    CRIME_FAIL: 'crime_fail',   // Busted/failed
    ACHIEVEMENT: 'achievement', // Achievement unlocked
    NOTIFICATION: 'notification', // Toast notification

    // Mini-game sounds
    COUNTDOWN: 'countdown',     // 3, 2, 1 beeps
    GAME_START: 'game_start',   // Mini-game begins
    GAME_WIN: 'game_win',       // Mini-game victory
    GAME_LOSE: 'game_lose',     // Mini-game fail
    PERFECT: 'perfect',         // Perfect score sparkle
    HIT: 'hit',                 // Positive action
    MISS: 'miss',               // Negative action
    TICK: 'tick',               // Timer tick (last 10 sec)

    // P61: Mini-game specific sounds
    LOCKPICK_CLICK: 'lockpick_click',     // Lock tumbler clicks
    LOCKPICK_SUCCESS: 'lockpick_success', // Lock opens
    WIRE_SPARK: 'wire_spark',             // Wire connection spark
    WIRE_COMPLETE: 'wire_complete',       // All wires connected
    SNAKE_EAT: 'snake_eat',               // Snake eats food
    MEMORY_FLIP: 'memory_flip',           // Card flip
    MEMORY_MATCH: 'memory_match',         // Matching pair
    SAFE_CLICK: 'safe_click',             // Safe dial click
    SAFE_UNLOCK: 'safe_unlock',           // Safe opens
    RHYTHM_HIT: 'rhythm_hit',             // Rhythm note hit
    RHYTHM_MISS: 'rhythm_miss',           // Rhythm note miss
    HACK_TYPE: 'hack_type',               // Hacking typing sound
    HACK_BREACH: 'hack_breach',           // Security breached
    GETAWAY_ENGINE: 'getaway_engine',     // Car engine rev
    GETAWAY_SIREN: 'getaway_siren',       // Police siren
    SNIPER_ZOOM: 'sniper_zoom',           // Scope zoom
    SNIPER_SHOT: 'sniper_shot',           // Rifle fire
    CHASE_FOOTSTEP: 'chase_footstep',     // Running footsteps
    FROGGER_HOP: 'frogger_hop',           // Frog jump
    QTE_PROMPT: 'qte_prompt',             // QTE button appear
    SURVEILLANCE_PING: 'surveillance_ping', // Target spotted
    NEGOTIATION_CHOICE: 'negotiation_choice', // Decision made
    STEADY_WOBBLE: 'steady_wobble',       // Hand shake warning

    // P62: Combo sounds
    COMBO_1: 'combo_1',                   // First combo
    COMBO_2: 'combo_2',                   // Second combo (higher)
    COMBO_3: 'combo_3',                   // Third combo (higher)
    COMBO_4: 'combo_4',                   // Fourth combo
    COMBO_MAX: 'combo_max',               // Max combo sound

    // P63: Victory fanfares
    VICTORY_BRONZE: 'victory_bronze',     // Bronze tier
    VICTORY_SILVER: 'victory_silver',     // Silver tier
    VICTORY_GOLD: 'victory_gold',         // Gold tier
    VICTORY_PERFECT: 'victory_perfect',   // Perfect performance

    // P65: Perfect hit variations
    PERFECT_HIT_1: 'perfect_hit_1',       // Perfect hit variant 1
    PERFECT_HIT_2: 'perfect_hit_2',       // Perfect hit variant 2
    PERFECT_HIT_3: 'perfect_hit_3',       // Perfect hit variant 3

    // P66: Streak milestone sounds
    STREAK_3: 'streak_3',                 // 3 win streak
    STREAK_5: 'streak_5',                 // 5 win streak
    STREAK_10: 'streak_10',               // 10 win streak
    STREAK_BREAK: 'streak_break',         // Streak broken

    // P67: Failure with encouragement
    FAIL_CLOSE: 'fail_close',             // Almost made it
    FAIL_TRY_AGAIN: 'fail_try_again',     // Try again sound

    // P69: Curveball warnings
    CURVEBALL_WARNING: 'curveball_warning', // Curveball incoming
    CURVEBALL_ACTIVE: 'curveball_active',   // Curveball activated

    // P70: Enhanced achievement sounds
    ACHIEVEMENT_RARE: 'achievement_rare',     // Rare achievement
    ACHIEVEMENT_EPIC: 'achievement_epic',     // Epic achievement
    FIRST_WIN_DAY: 'first_win_day'            // First win of day
  }
}

class AudioManagerClass {
  constructor() {
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

    // P64: Tension music state
    this.tensionActive = false

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
      const saved = localStorage.getItem('streetLegacy_audioSettings')
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
      localStorage.setItem('streetLegacy_audioSettings', JSON.stringify(settings))
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
        // Log missing sounds in development to help identify audio issues
        if (!this._missingAudioWarned?.[key]) {
          this._missingAudioWarned = this._missingAudioWarned || {}
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
      // Audio errors should never crash the game - log in debug only
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
  // UI SOUND HELPERS
  // ==========================================================================

  /**
   * Play UI click sound
   */
  playClick() {
    this.playSFX(AUDIO_KEYS.SFX.CLICK)
  }

  /**
   * Play UI hover sound (subtle)
   */
  playHover() {
    this.playSFX(AUDIO_KEYS.SFX.HOVER, { volume: 0.3 })
  }

  /**
   * Play tab switch sound
   */
  playTab() {
    this.playSFX(AUDIO_KEYS.SFX.TAB)
  }

  /**
   * Play modal open sound
   */
  playModalOpen() {
    this.playSFX(AUDIO_KEYS.SFX.MODAL_OPEN)
  }

  /**
   * Play modal close sound
   */
  playModalClose() {
    this.playSFX(AUDIO_KEYS.SFX.MODAL_CLOSE)
  }

  /**
   * Play error sound
   */
  playError() {
    this.playSFX(AUDIO_KEYS.SFX.ERROR)
  }

  // ==========================================================================
  // GAME SOUND HELPERS
  // ==========================================================================

  /**
   * Play notification sound
   */
  playNotification() {
    this.playSFX(AUDIO_KEYS.SFX.NOTIFICATION)
  }

  /**
   * Play cash gained sound
   * @param {number} amount - Amount gained (affects pitch)
   */
  playCashGain(amount = 0) {
    // Higher pitch for larger amounts
    const detune = Math.min(amount / 1000, 200)
    this.playSFX(AUDIO_KEYS.SFX.CASH, { detune })
  }

  /**
   * Play level up sound (more impactful)
   */
  playLevelUp() {
    this.playSFX(AUDIO_KEYS.SFX.LEVEL_UP)
  }

  /**
   * Play achievement unlocked sound
   */
  playAchievement() {
    this.playSFX(AUDIO_KEYS.SFX.ACHIEVEMENT)
  }

  // ==========================================================================
  // CRIME SOUND HELPERS
  // ==========================================================================

  /**
   * Play crime success sound
   */
  playCrimeSuccess() {
    this.playSFX(AUDIO_KEYS.SFX.CRIME_SUCCESS)
  }

  /**
   * Play crime fail sound
   */
  playCrimeFail() {
    this.playSFX(AUDIO_KEYS.SFX.CRIME_FAIL)
  }

  /**
   * Alias for crime fail (busted)
   */
  playJailed() {
    this.playSFX(AUDIO_KEYS.SFX.CRIME_FAIL)
  }

  // ==========================================================================
  // MINI-GAME SOUND HELPERS
  // ==========================================================================

  /**
   * Play countdown beeps (3, 2, 1)
   */
  playCountdown() {
    this.playSFX(AUDIO_KEYS.SFX.COUNTDOWN)
  }

  /**
   * Play mini-game start sound
   */
  playMiniGameStart() {
    this.playSFX(AUDIO_KEYS.SFX.GAME_START)
  }

  /**
   * Play mini-game win sound
   */
  playMiniGameWin() {
    this.playSFX(AUDIO_KEYS.SFX.GAME_WIN)
  }

  /**
   * Play mini-game lose sound
   */
  playMiniGameLose() {
    this.playSFX(AUDIO_KEYS.SFX.GAME_LOSE)
  }

  /**
   * Play perfect score sound
   */
  playPerfect() {
    this.playSFX(AUDIO_KEYS.SFX.PERFECT)
  }

  /**
   * Play positive hit sound
   */
  playHit() {
    this.playSFX(AUDIO_KEYS.SFX.HIT)
  }

  /**
   * Play negative miss sound
   */
  playMiss() {
    this.playSFX(AUDIO_KEYS.SFX.MISS)
  }

  /**
   * Play timer tick sound (for last 10 seconds)
   */
  playTick() {
    this.playSFXVaried(AUDIO_KEYS.SFX.TICK, 50)
  }

  // ==========================================================================
  // P61: MINI-GAME SPECIFIC SOUNDS
  // ==========================================================================

  /**
   * Play mini-game specific sound based on game type
   * @param {string} gameType - The mini-game type
   * @param {string} action - The action (e.g., 'hit', 'success', 'special')
   */
  playMiniGameSound(gameType, action) {
    const sounds = {
      'lockpick': {
        hit: AUDIO_KEYS.SFX.LOCKPICK_CLICK,
        success: AUDIO_KEYS.SFX.LOCKPICK_SUCCESS
      },
      'wire': {
        hit: AUDIO_KEYS.SFX.WIRE_SPARK,
        success: AUDIO_KEYS.SFX.WIRE_COMPLETE
      },
      'snake': {
        hit: AUDIO_KEYS.SFX.SNAKE_EAT,
        success: AUDIO_KEYS.SFX.GAME_WIN
      },
      'memory': {
        hit: AUDIO_KEYS.SFX.MEMORY_FLIP,
        success: AUDIO_KEYS.SFX.MEMORY_MATCH
      },
      'safecrack': {
        hit: AUDIO_KEYS.SFX.SAFE_CLICK,
        success: AUDIO_KEYS.SFX.SAFE_UNLOCK
      },
      'rhythm': {
        hit: AUDIO_KEYS.SFX.RHYTHM_HIT,
        miss: AUDIO_KEYS.SFX.RHYTHM_MISS
      },
      'hacking': {
        hit: AUDIO_KEYS.SFX.HACK_TYPE,
        success: AUDIO_KEYS.SFX.HACK_BREACH
      },
      'getaway': {
        hit: AUDIO_KEYS.SFX.GETAWAY_ENGINE,
        danger: AUDIO_KEYS.SFX.GETAWAY_SIREN
      },
      'sniper': {
        hit: AUDIO_KEYS.SFX.SNIPER_ZOOM,
        success: AUDIO_KEYS.SFX.SNIPER_SHOT
      },
      'chase': {
        hit: AUDIO_KEYS.SFX.CHASE_FOOTSTEP,
        success: AUDIO_KEYS.SFX.GAME_WIN
      },
      'frogger': {
        hit: AUDIO_KEYS.SFX.FROGGER_HOP,
        success: AUDIO_KEYS.SFX.GAME_WIN
      },
      'qte': {
        hit: AUDIO_KEYS.SFX.QTE_PROMPT,
        success: AUDIO_KEYS.SFX.HIT
      },
      'surveillance': {
        hit: AUDIO_KEYS.SFX.SURVEILLANCE_PING,
        success: AUDIO_KEYS.SFX.GAME_WIN
      },
      'negotiation': {
        hit: AUDIO_KEYS.SFX.NEGOTIATION_CHOICE,
        success: AUDIO_KEYS.SFX.GAME_WIN
      },
      'steadyhand': {
        danger: AUDIO_KEYS.SFX.STEADY_WOBBLE,
        success: AUDIO_KEYS.SFX.GAME_WIN
      }
    }

    const gameSound = sounds[gameType?.toLowerCase()]
    if (gameSound && gameSound[action]) {
      this.playSFX(gameSound[action])
    } else {
      // Fallback to generic sound
      if (action === 'hit') this.playHit()
      else if (action === 'success') this.playMiniGameWin()
      else if (action === 'miss') this.playMiss()
    }
  }

  // ==========================================================================
  // P62: COMBO SOUND ESCALATION
  // ==========================================================================

  /**
   * Play combo sound with escalating pitch based on combo count
   * @param {number} comboCount - Current combo count
   */
  playComboSound(comboCount) {
    if (comboCount >= 10) {
      this.playSFX(AUDIO_KEYS.SFX.COMBO_MAX, { volume: 1.2 })
    } else if (comboCount >= 7) {
      this.playSFX(AUDIO_KEYS.SFX.COMBO_4)
    } else if (comboCount >= 5) {
      this.playSFX(AUDIO_KEYS.SFX.COMBO_3)
    } else if (comboCount >= 3) {
      this.playSFX(AUDIO_KEYS.SFX.COMBO_2)
    } else if (comboCount >= 2) {
      this.playSFX(AUDIO_KEYS.SFX.COMBO_1)
    }
  }

  /**
   * Play escalating combo sound using pitch variation (fallback)
   * @param {number} comboCount - Current combo count
   */
  playComboSoundEscalating(comboCount) {
    // Rise in pitch with each combo (max at combo 10)
    const pitchBonus = Math.min(comboCount, 10) * 50
    this.playSFX(AUDIO_KEYS.SFX.HIT, {
      detune: pitchBonus,
      volume: 0.8 + (Math.min(comboCount, 10) * 0.02)
    })
  }

  // ==========================================================================
  // P63: VICTORY FANFARE BY TIER
  // ==========================================================================

  /**
   * Play victory fanfare based on performance tier
   * @param {string} tier - 'bronze', 'silver', 'gold', or 'perfect'
   */
  playVictoryFanfare(tier = 'bronze') {
    const fanfares = {
      'failed': AUDIO_KEYS.SFX.GAME_LOSE,
      'bronze': AUDIO_KEYS.SFX.VICTORY_BRONZE,
      'silver': AUDIO_KEYS.SFX.VICTORY_SILVER,
      'gold': AUDIO_KEYS.SFX.VICTORY_GOLD,
      'perfect': AUDIO_KEYS.SFX.VICTORY_PERFECT
    }

    const fanfareKey = fanfares[tier?.toLowerCase()] || fanfares.bronze

    // Try to play tier-specific, fallback to generic
    if (this.scene?.cache?.audio?.exists(fanfareKey)) {
      this.playSFX(fanfareKey)
    } else {
      // Fallback: modify generic win sound
      const volumeBoost = { bronze: 0.8, silver: 0.9, gold: 1.0, perfect: 1.2 }
      const pitchMod = { bronze: -100, silver: 0, gold: 100, perfect: 200 }
      this.playSFX(AUDIO_KEYS.SFX.GAME_WIN, {
        volume: volumeBoost[tier] || 0.8,
        detune: pitchMod[tier] || 0
      })
    }
  }

  // ==========================================================================
  // P64: TENSION MUSIC FOR COUNTDOWN
  // ==========================================================================

  /**
   * Start tension music when time is running low
   * @param {number} secondsRemaining - Seconds left
   */
  startTensionMusic(secondsRemaining = 10) {
    if (secondsRemaining <= 10 && !this.tensionActive) {
      this.tensionActive = true
      // Try tension BGM, else speed up current music
      if (this.scene?.cache?.audio?.exists(AUDIO_KEYS.BGM.TENSION)) {
        this.crossfadeBGM(AUDIO_KEYS.BGM.TENSION, 500)
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
  // P65: PERFECT HIT SOUNDS
  // ==========================================================================

  /**
   * Play a random perfect hit sound with sparkle effect
   */
  playPerfectHit() {
    const variants = [
      AUDIO_KEYS.SFX.PERFECT_HIT_1,
      AUDIO_KEYS.SFX.PERFECT_HIT_2,
      AUDIO_KEYS.SFX.PERFECT_HIT_3
    ]
    const randomVariant = variants[Math.floor(Math.random() * variants.length)]

    // Try specific sound, fallback to generic
    if (this.scene?.cache?.audio?.exists(randomVariant)) {
      this.playSFX(randomVariant, { volume: 1.1 })
    } else {
      this.playSFX(AUDIO_KEYS.SFX.PERFECT, {
        detune: Math.random() * 100,
        volume: 1.1
      })
    }
  }

  // ==========================================================================
  // P66: STREAK MILESTONE SOUNDS
  // ==========================================================================

  /**
   * Play streak milestone sound
   * @param {number} streak - Current win streak
   */
  playStreakMilestone(streak) {
    const milestones = {
      3: AUDIO_KEYS.SFX.STREAK_3,
      5: AUDIO_KEYS.SFX.STREAK_5,
      10: AUDIO_KEYS.SFX.STREAK_10
    }

    if (milestones[streak]) {
      // Try milestone sound, fallback to achievement
      if (this.scene?.cache?.audio?.exists(milestones[streak])) {
        this.playSFX(milestones[streak], { volume: 1.2 })
      } else {
        // Escalating achievement sounds
        this.playSFX(AUDIO_KEYS.SFX.ACHIEVEMENT, {
          detune: streak * 20,
          volume: 1.0 + (streak * 0.02)
        })
      }
    }
  }

  /**
   * Play streak broken sound (sad trombone effect)
   * @param {number} lostStreak - The streak that was lost
   */
  playStreakBreak(lostStreak) {
    if (lostStreak >= 3) {
      if (this.scene?.cache?.audio?.exists(AUDIO_KEYS.SFX.STREAK_BREAK)) {
        this.playSFX(AUDIO_KEYS.SFX.STREAK_BREAK)
      } else {
        // Descending tone fallback
        this.playSFX(AUDIO_KEYS.SFX.GAME_LOSE, { detune: -200, volume: 0.7 })
      }
    }
  }

  // ==========================================================================
  // P67: FAILURE SOUNDS WITH ENCOURAGEMENT
  // ==========================================================================

  /**
   * Play failure sound with context-aware encouragement
   * @param {number} scorePercent - How close player was to winning (0-100)
   */
  playFailure(scorePercent = 0) {
    if (scorePercent >= 80) {
      // So close! Play encouraging sound
      if (this.scene?.cache?.audio?.exists(AUDIO_KEYS.SFX.FAIL_CLOSE)) {
        this.playSFX(AUDIO_KEYS.SFX.FAIL_CLOSE)
      } else {
        this.playSFX(AUDIO_KEYS.SFX.GAME_LOSE, { detune: 100, volume: 0.8 })
      }
    } else {
      // Standard failure
      if (this.scene?.cache?.audio?.exists(AUDIO_KEYS.SFX.FAIL_TRY_AGAIN)) {
        this.playSFX(AUDIO_KEYS.SFX.FAIL_TRY_AGAIN)
      } else {
        this.playMiniGameLose()
      }
    }
  }

  // ==========================================================================
  // P68: MINI-GAME SPECIFIC BACKGROUND MUSIC
  // ==========================================================================

  /**
   * Play background music appropriate for mini-game type
   * @param {string} gameType - The mini-game type
   */
  playMiniGameBGM(gameType) {
    const bgmMap = {
      // High intensity games
      'chase': AUDIO_KEYS.BGM.CHASE,
      'getaway': AUDIO_KEYS.BGM.CHASE,
      'qte': AUDIO_KEYS.BGM.ACTION,
      'rhythm': AUDIO_KEYS.BGM.ACTION,

      // Heist/stealth games
      'lockpick': AUDIO_KEYS.BGM.HEIST,
      'safecrack': AUDIO_KEYS.BGM.HEIST,
      'wire': AUDIO_KEYS.BGM.HEIST,
      'surveillance': AUDIO_KEYS.BGM.HEIST,
      'hacking': AUDIO_KEYS.BGM.HEIST,

      // Focus games
      'sniper': AUDIO_KEYS.BGM.TENSION,
      'steadyhand': AUDIO_KEYS.BGM.TENSION,
      'memory': AUDIO_KEYS.BGM.CRIME,

      // Default
      'snake': AUDIO_KEYS.BGM.ACTION,
      'frogger': AUDIO_KEYS.BGM.ACTION,
      'negotiation': AUDIO_KEYS.BGM.CRIME
    }

    const bgmKey = bgmMap[gameType?.toLowerCase()] || AUDIO_KEYS.BGM.ACTION

    // Try game-specific, fallback to action
    if (this.scene?.cache?.audio?.exists(bgmKey)) {
      this.fadeInBGM(bgmKey, 500)
    } else {
      this.fadeInBGM(AUDIO_KEYS.BGM.ACTION, 500)
    }
  }

  // ==========================================================================
  // P69: CURVEBALL WARNING SOUNDS
  // ==========================================================================

  /**
   * Play curveball incoming warning
   */
  playCurveballWarning() {
    if (this.scene?.cache?.audio?.exists(AUDIO_KEYS.SFX.CURVEBALL_WARNING)) {
      this.playSFX(AUDIO_KEYS.SFX.CURVEBALL_WARNING, { volume: 0.9 })
    } else {
      // Fallback: warning buzz
      this.playSFX(AUDIO_KEYS.SFX.ERROR, { detune: -200, volume: 0.7 })
    }
  }

  /**
   * Play curveball activation sound
   * @param {string} curveballType - Type of curveball
   */
  playCurveballActive(curveballType) {
    if (this.scene?.cache?.audio?.exists(AUDIO_KEYS.SFX.CURVEBALL_ACTIVE)) {
      this.playSFX(AUDIO_KEYS.SFX.CURVEBALL_ACTIVE)
    } else {
      // Fallback: modulated error sound
      this.playSFX(AUDIO_KEYS.SFX.ERROR, { detune: 100, volume: 0.6 })
    }
  }

  // ==========================================================================
  // P70: ENHANCED ACHIEVEMENT SOUNDS
  // ==========================================================================

  /**
   * Play achievement sound based on rarity
   * @param {string} rarity - 'common', 'rare', 'epic', 'legendary'
   */
  playAchievementByRarity(rarity = 'common') {
    const sounds = {
      common: AUDIO_KEYS.SFX.ACHIEVEMENT,
      rare: AUDIO_KEYS.SFX.ACHIEVEMENT_RARE,
      epic: AUDIO_KEYS.SFX.ACHIEVEMENT_EPIC,
      legendary: AUDIO_KEYS.SFX.ACHIEVEMENT_EPIC
    }

    const soundKey = sounds[rarity?.toLowerCase()] || sounds.common

    if (this.scene?.cache?.audio?.exists(soundKey)) {
      this.playSFX(soundKey, { volume: rarity === 'legendary' ? 1.3 : 1.0 })
    } else {
      // Fallback with pitch variation
      const detuneMap = { common: 0, rare: 100, epic: 200, legendary: 300 }
      this.playSFX(AUDIO_KEYS.SFX.ACHIEVEMENT, {
        detune: detuneMap[rarity] || 0,
        volume: 1.0 + ((detuneMap[rarity] || 0) / 300) * 0.3
      })
    }
  }

  /**
   * Play first win of day celebration sound
   */
  playFirstWinOfDay() {
    if (this.scene?.cache?.audio?.exists(AUDIO_KEYS.SFX.FIRST_WIN_DAY)) {
      this.playSFX(AUDIO_KEYS.SFX.FIRST_WIN_DAY, { volume: 1.2 })
    } else {
      // Fallback: double sound for emphasis
      this.playSFX(AUDIO_KEYS.SFX.LEVEL_UP)
      this.scene?.time?.delayedCall(300, () => {
        this.playSFX(AUDIO_KEYS.SFX.CASH, { detune: 200 })
      })
    }
  }

  // ==========================================================================
  // EVENT SOUND HELPERS (using notification)
  // ==========================================================================

  /**
   * Play event popup sound
   */
  playEventPopup() {
    this.playSFX(AUDIO_KEYS.SFX.NOTIFICATION)
  }

  /**
   * Play opportunity event sound
   */
  playOpportunity() {
    this.playSFX(AUDIO_KEYS.SFX.CASH)
  }

  /**
   * Play threat event sound
   */
  playThreat() {
    this.playSFX(AUDIO_KEYS.SFX.ERROR)
  }

  // ==========================================================================
  // VOLUME CONTROLS
  // ==========================================================================

  /**
   * Set SFX volume
   * @param {number} vol - Volume 0-1
   */
  setSFXVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, vol))
    this.saveSettings()
  }

  /**
   * Get current SFX volume
   * @returns {number}
   */
  getSFXVolume() {
    return this.sfxVolume
  }

  /**
   * Set music volume
   * @param {number} vol - Volume 0-1
   */
  setMusicVolume(vol) {
    this.musicVolume = Math.max(0, Math.min(1, vol))

    // Apply to current BGM
    if (this.bgm) {
      this.bgm.setVolume(this.musicVolume * this.masterVolume)
    }

    this.saveSettings()
  }

  /**
   * Get current music volume
   * @returns {number}
   */
  getMusicVolume() {
    return this.musicVolume
  }

  /**
   * Set master volume
   * @param {number} vol - Volume 0-1
   */
  setMasterVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol))

    if (this.scene && this.scene.sound) {
      this.scene.sound.volume = this.masterVolume
    }

    // Apply to current BGM
    if (this.bgm) {
      this.bgm.setVolume(this.musicVolume * this.masterVolume)
    }

    this.saveSettings()
  }

  /**
   * Get current master volume
   * @returns {number}
   */
  getMasterVolume() {
    return this.masterVolume
  }

  // ==========================================================================
  // MUTE TOGGLES
  // ==========================================================================

  /**
   * Toggle SFX on/off
   * @returns {boolean} New state
   */
  toggleSFX() {
    this.sfxEnabled = !this.sfxEnabled
    this.saveSettings()
    return this.sfxEnabled
  }

  /**
   * Toggle music on/off
   * @returns {boolean} New state
   */
  toggleMusic() {
    this.musicEnabled = !this.musicEnabled

    if (!this.musicEnabled) {
      this.stopBGM()
    }

    this.saveSettings()
    return this.musicEnabled
  }

  /**
   * Set SFX enabled state
   * @param {boolean} enabled
   */
  setSFXEnabled(enabled) {
    this.sfxEnabled = enabled
    this.saveSettings()
  }

  /**
   * Set music enabled state
   * @param {boolean} enabled
   */
  setMusicEnabled(enabled) {
    this.musicEnabled = enabled

    if (!enabled) {
      this.stopBGM()
    }

    this.saveSettings()
  }

  /**
   * Check if SFX is enabled
   * @returns {boolean}
   */
  isSFXEnabled() {
    return this.sfxEnabled
  }

  /**
   * Check if music is enabled
   * @returns {boolean}
   */
  isMusicEnabled() {
    return this.musicEnabled
  }

  /**
   * Mute all audio
   */
  muteAll() {
    if (this.scene && this.scene.sound) {
      this.scene.sound.mute = true
    }
  }

  /**
   * Unmute all audio
   */
  unmuteAll() {
    if (this.scene && this.scene.sound) {
      this.scene.sound.mute = false
    }
  }

  /**
   * Toggle mute state
   * @returns {boolean} New mute state
   */
  toggleMute() {
    if (this.scene && this.scene.sound) {
      this.scene.sound.mute = !this.scene.sound.mute
      return this.scene.sound.mute
    }
    return false
  }

  /**
   * Check if audio is muted
   * @returns {boolean}
   */
  isMuted() {
    return this.scene?.sound?.mute ?? false
  }

  // ==========================================================================
  // SCENE-SPECIFIC AUDIO
  // ==========================================================================

  /**
   * Play appropriate BGM for a scene
   * @param {string} sceneName - Scene key
   */
  playSceneBGM(sceneName) {
    const sceneBGM = {
      'MainMenuScene': AUDIO_KEYS.BGM.MENU,
      'GameScene': AUDIO_KEYS.BGM.GAME,
      'CrimeScene': AUDIO_KEYS.BGM.CRIME,
      'MapScene': AUDIO_KEYS.BGM.GAME,
      'PropertyScene': AUDIO_KEYS.BGM.GAME,
      'BankScene': AUDIO_KEYS.BGM.GAME,
      'CrewScene': AUDIO_KEYS.BGM.GAME,
      'AchievementsScene': AUDIO_KEYS.BGM.GAME,
      'EventsScene': AUDIO_KEYS.BGM.GAME,
      'LeaderboardScene': AUDIO_KEYS.BGM.GAME
    }

    const bgmKey = sceneBGM[sceneName]
    if (bgmKey) {
      this.playBGM(bgmKey)
    }
  }

  /**
   * Get all current settings
   * @returns {Object}
   */
  getSettings() {
    return {
      sfxEnabled: this.sfxEnabled,
      musicEnabled: this.musicEnabled,
      sfxVolume: this.sfxVolume,
      musicVolume: this.musicVolume,
      masterVolume: this.masterVolume
    }
  }

  /**
   * Apply settings object
   * @param {Object} settings
   */
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

// Singleton instance
export const audioManager = new AudioManagerClass()
export default audioManager
