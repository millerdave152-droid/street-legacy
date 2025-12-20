/**
 * AudioPlaceholder - Generates procedural placeholder sounds
 *
 * Creates simple synthesized sounds using Web Audio API when actual
 * audio files are not available. These can be replaced with real audio
 * files later.
 */

import { AUDIO_KEYS } from './AudioManager'

class AudioPlaceholderClass {
  constructor() {
    this.audioContext = null
    this.initialized = false
    this.generatedSounds = new Map()
  }

  /**
   * Initialize the audio context
   */
  init() {
    if (this.initialized) return

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this.initialized = true
      console.log('[AudioPlaceholder] Web Audio API initialized')
    } catch (e) {
      console.warn('[AudioPlaceholder] Web Audio API not available:', e)
    }
  }

  /**
   * Resume audio context (required after user interaction)
   */
  resume() {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume()
    }
  }

  /**
   * Generate all placeholder sounds and register them with Phaser
   * @param {Phaser.Scene} scene - The Phaser scene
   */
  generatePlaceholderSounds(scene) {
    if (!this.initialized) {
      this.init()
    }

    if (!this.audioContext) {
      console.warn('[AudioPlaceholder] Cannot generate sounds - no audio context')
      return
    }

    const soundDefinitions = this.getSoundDefinitions()

    soundDefinitions.forEach(def => {
      // Skip if sound already exists in cache
      if (scene.cache.audio.exists(def.key)) {
        return
      }

      try {
        const buffer = this.generateSound(def)
        if (buffer) {
          // Add to Phaser's audio cache
          scene.cache.audio.add(def.key, buffer)
          this.generatedSounds.set(def.key, true)
        }
      } catch (e) {
        console.warn(`[AudioPlaceholder] Failed to generate ${def.key}:`, e)
      }
    })

    console.log(`[AudioPlaceholder] Generated ${this.generatedSounds.size} placeholder sounds`)
  }

  /**
   * Get sound definitions for procedural generation
   */
  getSoundDefinitions() {
    return [
      // UI Sounds
      { key: AUDIO_KEYS.SFX.CLICK, type: 'click', freq: 800, duration: 0.08 },
      { key: AUDIO_KEYS.SFX.HOVER, type: 'hover', freq: 600, duration: 0.04 },
      { key: AUDIO_KEYS.SFX.TAB, type: 'tab', freq: 500, duration: 0.06 },
      { key: AUDIO_KEYS.SFX.MODAL_OPEN, type: 'rise', freq: 400, duration: 0.15 },
      { key: AUDIO_KEYS.SFX.MODAL_CLOSE, type: 'fall', freq: 500, duration: 0.12 },
      { key: AUDIO_KEYS.SFX.ERROR, type: 'buzz', freq: 150, duration: 0.25 },

      // Game Sounds
      { key: AUDIO_KEYS.SFX.CASH, type: 'coin', freq: 1200, duration: 0.2 },
      { key: AUDIO_KEYS.SFX.LEVEL_UP, type: 'fanfare', freq: 523, duration: 0.6 },
      { key: AUDIO_KEYS.SFX.CRIME_SUCCESS, type: 'success', freq: 700, duration: 0.3 },
      { key: AUDIO_KEYS.SFX.CRIME_FAIL, type: 'fail', freq: 200, duration: 0.4 },
      { key: AUDIO_KEYS.SFX.ACHIEVEMENT, type: 'achievement', freq: 880, duration: 0.5 },
      { key: AUDIO_KEYS.SFX.NOTIFICATION, type: 'notify', freq: 660, duration: 0.15 },

      // Mini-game Sounds
      { key: AUDIO_KEYS.SFX.COUNTDOWN, type: 'beep', freq: 880, duration: 0.1 },
      { key: AUDIO_KEYS.SFX.GAME_START, type: 'start', freq: 523, duration: 0.3 },
      { key: AUDIO_KEYS.SFX.GAME_WIN, type: 'win', freq: 784, duration: 0.5 },
      { key: AUDIO_KEYS.SFX.GAME_LOSE, type: 'lose', freq: 220, duration: 0.5 },
      { key: AUDIO_KEYS.SFX.PERFECT, type: 'sparkle', freq: 1500, duration: 0.3 },
      { key: AUDIO_KEYS.SFX.HIT, type: 'hit', freq: 440, duration: 0.08 },
      { key: AUDIO_KEYS.SFX.MISS, type: 'miss', freq: 200, duration: 0.15 },
      { key: AUDIO_KEYS.SFX.TICK, type: 'tick', freq: 1000, duration: 0.03 }
    ]
  }

  /**
   * Generate a sound buffer based on definition
   * @param {Object} def - Sound definition
   * @returns {AudioBuffer}
   */
  generateSound(def) {
    const ctx = this.audioContext
    const sampleRate = ctx.sampleRate
    const duration = def.duration
    const numSamples = Math.floor(sampleRate * duration)
    const buffer = ctx.createBuffer(1, numSamples, sampleRate)
    const data = buffer.getChannelData(0)

    switch (def.type) {
      case 'click':
        this.generateClick(data, sampleRate, def.freq, duration)
        break
      case 'hover':
        this.generateHover(data, sampleRate, def.freq, duration)
        break
      case 'tab':
        this.generateTab(data, sampleRate, def.freq, duration)
        break
      case 'rise':
        this.generateRise(data, sampleRate, def.freq, duration)
        break
      case 'fall':
        this.generateFall(data, sampleRate, def.freq, duration)
        break
      case 'buzz':
        this.generateBuzz(data, sampleRate, def.freq, duration)
        break
      case 'coin':
        this.generateCoin(data, sampleRate, def.freq, duration)
        break
      case 'fanfare':
        this.generateFanfare(data, sampleRate, def.freq, duration)
        break
      case 'success':
        this.generateSuccess(data, sampleRate, def.freq, duration)
        break
      case 'fail':
        this.generateFail(data, sampleRate, def.freq, duration)
        break
      case 'achievement':
        this.generateAchievement(data, sampleRate, def.freq, duration)
        break
      case 'notify':
        this.generateNotify(data, sampleRate, def.freq, duration)
        break
      case 'beep':
        this.generateBeep(data, sampleRate, def.freq, duration)
        break
      case 'start':
        this.generateStart(data, sampleRate, def.freq, duration)
        break
      case 'win':
        this.generateWin(data, sampleRate, def.freq, duration)
        break
      case 'lose':
        this.generateLose(data, sampleRate, def.freq, duration)
        break
      case 'sparkle':
        this.generateSparkle(data, sampleRate, def.freq, duration)
        break
      case 'hit':
        this.generateHit(data, sampleRate, def.freq, duration)
        break
      case 'miss':
        this.generateMiss(data, sampleRate, def.freq, duration)
        break
      case 'tick':
        this.generateTick(data, sampleRate, def.freq, duration)
        break
      default:
        this.generateTone(data, sampleRate, def.freq, duration)
    }

    return buffer
  }

  // ==========================================================================
  // SOUND GENERATORS
  // ==========================================================================

  generateTone(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const envelope = Math.exp(-t * 10)
      data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.3
    }
  }

  generateClick(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const envelope = Math.exp(-t * 50)
      data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.4
    }
  }

  generateHover(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const envelope = Math.exp(-t * 80)
      data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.15
    }
  }

  generateTab(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const envelope = Math.exp(-t * 40)
      data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.25
    }
  }

  generateRise(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const normalizedT = t / duration
      const freqMod = freq + normalizedT * 400
      const envelope = Math.sin(normalizedT * Math.PI)
      data[i] = Math.sin(2 * Math.PI * freqMod * t) * envelope * 0.25
    }
  }

  generateFall(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const normalizedT = t / duration
      const freqMod = freq - normalizedT * 300
      const envelope = 1 - normalizedT
      data[i] = Math.sin(2 * Math.PI * freqMod * t) * envelope * 0.2
    }
  }

  generateBuzz(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const envelope = Math.exp(-t * 8)
      // Saw wave for buzz
      const phase = (freq * t) % 1
      data[i] = (phase * 2 - 1) * envelope * 0.2
    }
  }

  generateCoin(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const normalizedT = t / duration
      // Two-tone coin sound
      const freq1 = freq
      const freq2 = freq * 1.5
      const envelope = Math.exp(-t * 15)
      const tone1 = Math.sin(2 * Math.PI * freq1 * t)
      const tone2 = Math.sin(2 * Math.PI * freq2 * t) * (normalizedT > 0.3 ? 1 : 0)
      data[i] = (tone1 + tone2 * 0.7) * envelope * 0.25
    }
  }

  generateFanfare(data, sampleRate, freq, duration) {
    const numSamples = data.length
    const notes = [1, 1.25, 1.5, 2] // Major chord progression
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const normalizedT = t / duration
      const noteIndex = Math.min(Math.floor(normalizedT * 4), 3)
      const noteFreq = freq * notes[noteIndex]
      const envelope = Math.exp(-((t % (duration / 4)) * 10))
      data[i] = Math.sin(2 * Math.PI * noteFreq * t) * envelope * 0.3
    }
  }

  generateSuccess(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const normalizedT = t / duration
      const freqMod = freq + normalizedT * 200
      const envelope = Math.sin(normalizedT * Math.PI) * Math.exp(-t * 5)
      data[i] = Math.sin(2 * Math.PI * freqMod * t) * envelope * 0.3
    }
  }

  generateFail(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const normalizedT = t / duration
      const freqMod = freq - normalizedT * 100
      const envelope = Math.exp(-t * 5)
      // Slightly detuned for dissonance
      const tone1 = Math.sin(2 * Math.PI * freqMod * t)
      const tone2 = Math.sin(2 * Math.PI * (freqMod * 1.05) * t)
      data[i] = (tone1 + tone2 * 0.5) * envelope * 0.25
    }
  }

  generateAchievement(data, sampleRate, freq, duration) {
    const numSamples = data.length
    const notes = [1, 1.25, 1.5, 2] // Ascending major
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const normalizedT = t / duration
      const noteIndex = Math.min(Math.floor(normalizedT * 4), 3)
      const noteFreq = freq * notes[noteIndex]
      const envelope = Math.exp(-((t % (duration / 4)) * 8)) * (1 - normalizedT * 0.5)
      // Add shimmer
      const shimmer = Math.sin(2 * Math.PI * (noteFreq * 2) * t) * 0.2
      data[i] = (Math.sin(2 * Math.PI * noteFreq * t) + shimmer) * envelope * 0.25
    }
  }

  generateNotify(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const envelope = Math.sin((t / duration) * Math.PI)
      data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.25
    }
  }

  generateBeep(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const envelope = t < duration * 0.8 ? 1 : Math.exp(-(t - duration * 0.8) * 100)
      data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.3
    }
  }

  generateStart(data, sampleRate, freq, duration) {
    const numSamples = data.length
    const notes = [1, 1.5, 2]
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const normalizedT = t / duration
      const noteIndex = Math.min(Math.floor(normalizedT * 3), 2)
      const noteFreq = freq * notes[noteIndex]
      const localT = (t % (duration / 3))
      const envelope = Math.exp(-localT * 15)
      data[i] = Math.sin(2 * Math.PI * noteFreq * t) * envelope * 0.3
    }
  }

  generateWin(data, sampleRate, freq, duration) {
    const numSamples = data.length
    const notes = [1, 1.25, 1.5, 1.25, 1.5, 2]
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const normalizedT = t / duration
      const noteIndex = Math.min(Math.floor(normalizedT * 6), 5)
      const noteFreq = freq * notes[noteIndex]
      const localT = (t % (duration / 6))
      const envelope = Math.exp(-localT * 12)
      data[i] = Math.sin(2 * Math.PI * noteFreq * t) * envelope * 0.3
    }
  }

  generateLose(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const normalizedT = t / duration
      const freqMod = freq * (1 - normalizedT * 0.5)
      const envelope = Math.exp(-t * 4)
      // Wobbly sad trombone effect
      const wobble = Math.sin(t * 20) * 0.1
      data[i] = Math.sin(2 * Math.PI * freqMod * (1 + wobble) * t) * envelope * 0.25
    }
  }

  generateSparkle(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const normalizedT = t / duration
      // Random sparkle frequencies
      const sparkleFreq = freq + Math.sin(t * 100) * 500
      const envelope = Math.exp(-t * 10) * (1 + Math.sin(t * 50) * 0.3)
      data[i] = Math.sin(2 * Math.PI * sparkleFreq * t) * envelope * 0.2
    }
  }

  generateHit(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const envelope = Math.exp(-t * 60)
      data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.4
    }
  }

  generateMiss(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const freqMod = freq * Math.exp(-t * 5)
      const envelope = Math.exp(-t * 15)
      data[i] = Math.sin(2 * Math.PI * freqMod * t) * envelope * 0.3
    }
  }

  generateTick(data, sampleRate, freq, duration) {
    const numSamples = data.length
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate
      const envelope = Math.exp(-t * 150)
      data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.3
    }
  }

  /**
   * Check if a sound was generated as placeholder
   * @param {string} key - Sound key
   * @returns {boolean}
   */
  isPlaceholder(key) {
    return this.generatedSounds.has(key)
  }
}

// Singleton instance
export const audioPlaceholder = new AudioPlaceholderClass()
export default audioPlaceholder
