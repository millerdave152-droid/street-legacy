/**
 * AudioManager - Street Legacy audio system
 *
 * Extends CoreAudioManager with game-specific audio keys and helpers.
 * Maintains backwards compatibility with existing API.
 */
import { CoreAudioManager } from '../core/managers/AudioManager'

// Audio keys for Street Legacy
export const AUDIO_KEYS = {
  // Background music
  BGM: {
    MENU: 'bgm_menu',
    GAME: 'bgm_game',
    CRIME: 'bgm_crime',
    ACTION: 'bgm_action',
    VICTORY: 'bgm_victory',
    TENSION: 'bgm_tension',
    HEIST: 'bgm_heist',
    CHASE: 'bgm_chase'
  },
  // Sound effects
  SFX: {
    // UI sounds
    CLICK: 'click',
    HOVER: 'hover',
    TAB: 'tab',
    MODAL_OPEN: 'modal_open',
    MODAL_CLOSE: 'modal_close',
    ERROR: 'error',

    // Game sounds
    CASH: 'cash',
    LEVEL_UP: 'level_up',
    CRIME_SUCCESS: 'crime_success',
    CRIME_FAIL: 'crime_fail',
    ACHIEVEMENT: 'achievement',
    NOTIFICATION: 'notification',

    // Mini-game sounds
    COUNTDOWN: 'countdown',
    GAME_START: 'game_start',
    GAME_WIN: 'game_win',
    GAME_LOSE: 'game_lose',
    PERFECT: 'perfect',
    HIT: 'hit',
    MISS: 'miss',
    TICK: 'tick',

    // Mini-game specific sounds
    LOCKPICK_CLICK: 'lockpick_click',
    LOCKPICK_SUCCESS: 'lockpick_success',
    WIRE_SPARK: 'wire_spark',
    WIRE_COMPLETE: 'wire_complete',
    SNAKE_EAT: 'snake_eat',
    MEMORY_FLIP: 'memory_flip',
    MEMORY_MATCH: 'memory_match',
    SAFE_CLICK: 'safe_click',
    SAFE_UNLOCK: 'safe_unlock',
    RHYTHM_HIT: 'rhythm_hit',
    RHYTHM_MISS: 'rhythm_miss',
    HACK_TYPE: 'hack_type',
    HACK_BREACH: 'hack_breach',
    GETAWAY_ENGINE: 'getaway_engine',
    GETAWAY_SIREN: 'getaway_siren',
    SNIPER_ZOOM: 'sniper_zoom',
    SNIPER_SHOT: 'sniper_shot',
    CHASE_FOOTSTEP: 'chase_footstep',
    FROGGER_HOP: 'frogger_hop',
    QTE_PROMPT: 'qte_prompt',
    SURVEILLANCE_PING: 'surveillance_ping',
    NEGOTIATION_CHOICE: 'negotiation_choice',
    STEADY_WOBBLE: 'steady_wobble',

    // Combo sounds
    COMBO_1: 'combo_1',
    COMBO_2: 'combo_2',
    COMBO_3: 'combo_3',
    COMBO_4: 'combo_4',
    COMBO_MAX: 'combo_max',

    // Victory fanfares
    VICTORY_BRONZE: 'victory_bronze',
    VICTORY_SILVER: 'victory_silver',
    VICTORY_GOLD: 'victory_gold',
    VICTORY_PERFECT: 'victory_perfect',

    // Perfect hit variations
    PERFECT_HIT_1: 'perfect_hit_1',
    PERFECT_HIT_2: 'perfect_hit_2',
    PERFECT_HIT_3: 'perfect_hit_3',

    // Streak sounds
    STREAK_3: 'streak_3',
    STREAK_5: 'streak_5',
    STREAK_10: 'streak_10',
    STREAK_BREAK: 'streak_break',

    // Failure sounds
    FAIL_CLOSE: 'fail_close',
    FAIL_TRY_AGAIN: 'fail_try_again',

    // Curveball sounds
    CURVEBALL_WARNING: 'curveball_warning',
    CURVEBALL_ACTIVE: 'curveball_active',

    // Achievement sounds
    ACHIEVEMENT_RARE: 'achievement_rare',
    ACHIEVEMENT_EPIC: 'achievement_epic',
    FIRST_WIN_DAY: 'first_win_day'
  }
}

// Mini-game BGM mapping
const MINI_GAME_BGM_MAP = {
  'chase': AUDIO_KEYS.BGM.CHASE,
  'getaway': AUDIO_KEYS.BGM.CHASE,
  'qte': AUDIO_KEYS.BGM.ACTION,
  'rhythm': AUDIO_KEYS.BGM.ACTION,
  'lockpick': AUDIO_KEYS.BGM.HEIST,
  'safecrack': AUDIO_KEYS.BGM.HEIST,
  'wire': AUDIO_KEYS.BGM.HEIST,
  'surveillance': AUDIO_KEYS.BGM.HEIST,
  'hacking': AUDIO_KEYS.BGM.HEIST,
  'sniper': AUDIO_KEYS.BGM.TENSION,
  'steadyhand': AUDIO_KEYS.BGM.TENSION,
  'memory': AUDIO_KEYS.BGM.CRIME,
  'snake': AUDIO_KEYS.BGM.ACTION,
  'frogger': AUDIO_KEYS.BGM.ACTION,
  'negotiation': AUDIO_KEYS.BGM.CRIME
}

// Scene BGM mapping
const SCENE_BGM_MAP = {
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

// Mini-game specific sound mapping
const GAME_TYPE_SOUND_MAP = {
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

/**
 * Street Legacy AudioManager - extends CoreAudioManager with game-specific helpers
 */
class AudioManagerClass extends CoreAudioManager {
  constructor() {
    super({
      storageKey: 'streetLegacy_audioSettings',
      audioKeys: AUDIO_KEYS,
      gameTypeBGMMap: MINI_GAME_BGM_MAP,
      sceneBGMMap: SCENE_BGM_MAP,
      gameTypeSoundMap: GAME_TYPE_SOUND_MAP
    })
  }

  // ==========================================================================
  // UI SOUND HELPERS
  // ==========================================================================

  playClick() {
    this.playSFX(AUDIO_KEYS.SFX.CLICK)
  }

  playHover() {
    this.playSFX(AUDIO_KEYS.SFX.HOVER, { volume: 0.3 })
  }

  playTab() {
    this.playSFX(AUDIO_KEYS.SFX.TAB)
  }

  playModalOpen() {
    this.playSFX(AUDIO_KEYS.SFX.MODAL_OPEN)
  }

  playModalClose() {
    this.playSFX(AUDIO_KEYS.SFX.MODAL_CLOSE)
  }

  playError() {
    this.playSFX(AUDIO_KEYS.SFX.ERROR)
  }

  // ==========================================================================
  // GAME SOUND HELPERS
  // ==========================================================================

  playNotification() {
    this.playSFX(AUDIO_KEYS.SFX.NOTIFICATION)
  }

  playCashGain(amount = 0) {
    const detune = Math.min(amount / 1000, 200)
    this.playSFX(AUDIO_KEYS.SFX.CASH, { detune })
  }

  playLevelUp() {
    this.playSFX(AUDIO_KEYS.SFX.LEVEL_UP)
  }

  playAchievement() {
    this.playSFX(AUDIO_KEYS.SFX.ACHIEVEMENT)
  }

  // ==========================================================================
  // CRIME SOUND HELPERS
  // ==========================================================================

  playCrimeSuccess() {
    this.playSFX(AUDIO_KEYS.SFX.CRIME_SUCCESS)
  }

  playCrimeFail() {
    this.playSFX(AUDIO_KEYS.SFX.CRIME_FAIL)
  }

  playJailed() {
    this.playSFX(AUDIO_KEYS.SFX.CRIME_FAIL)
  }

  // ==========================================================================
  // MINI-GAME SOUND HELPERS
  // ==========================================================================

  playCountdown() {
    this.playSFX(AUDIO_KEYS.SFX.COUNTDOWN)
  }

  playMiniGameStart() {
    this.playSFX(AUDIO_KEYS.SFX.GAME_START)
  }

  playMiniGameWin() {
    this.playSFX(AUDIO_KEYS.SFX.GAME_WIN)
  }

  playMiniGameLose() {
    this.playSFX(AUDIO_KEYS.SFX.GAME_LOSE)
  }

  playPerfect() {
    this.playSFX(AUDIO_KEYS.SFX.PERFECT)
  }

  playHit() {
    this.playSFX(AUDIO_KEYS.SFX.HIT)
  }

  playMiss() {
    this.playSFX(AUDIO_KEYS.SFX.MISS)
  }

  playTick() {
    this.playSFXVaried(AUDIO_KEYS.SFX.TICK, 50)
  }

  // ==========================================================================
  // MINI-GAME SPECIFIC SOUNDS
  // ==========================================================================

  playMiniGameSound(gameType, action) {
    const gameSound = GAME_TYPE_SOUND_MAP[gameType?.toLowerCase()]
    if (gameSound && gameSound[action]) {
      this.playSFX(gameSound[action])
    } else {
      if (action === 'hit') this.playHit()
      else if (action === 'success') this.playMiniGameWin()
      else if (action === 'miss') this.playMiss()
    }
  }

  playMiniGameBGM(gameType) {
    this.playGameTypeBGM(gameType)
  }

  // ==========================================================================
  // PERFECT HIT SOUNDS
  // ==========================================================================

  playPerfectHit() {
    const variants = [
      AUDIO_KEYS.SFX.PERFECT_HIT_1,
      AUDIO_KEYS.SFX.PERFECT_HIT_2,
      AUDIO_KEYS.SFX.PERFECT_HIT_3
    ]
    const randomVariant = variants[Math.floor(Math.random() * variants.length)]

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
  // STREAK SOUNDS
  // ==========================================================================

  playStreakMilestone(streak) {
    const milestones = {
      3: AUDIO_KEYS.SFX.STREAK_3,
      5: AUDIO_KEYS.SFX.STREAK_5,
      10: AUDIO_KEYS.SFX.STREAK_10
    }

    if (milestones[streak]) {
      if (this.scene?.cache?.audio?.exists(milestones[streak])) {
        this.playSFX(milestones[streak], { volume: 1.2 })
      } else {
        this.playSFX(AUDIO_KEYS.SFX.ACHIEVEMENT, {
          detune: streak * 20,
          volume: 1.0 + (streak * 0.02)
        })
      }
    }
  }

  playStreakBreak(lostStreak) {
    if (lostStreak >= 3) {
      if (this.scene?.cache?.audio?.exists(AUDIO_KEYS.SFX.STREAK_BREAK)) {
        this.playSFX(AUDIO_KEYS.SFX.STREAK_BREAK)
      } else {
        this.playSFX(AUDIO_KEYS.SFX.GAME_LOSE, { detune: -200, volume: 0.7 })
      }
    }
  }

  // ==========================================================================
  // FAILURE SOUNDS
  // ==========================================================================

  playFailure(scorePercent = 0) {
    if (scorePercent >= 80) {
      if (this.scene?.cache?.audio?.exists(AUDIO_KEYS.SFX.FAIL_CLOSE)) {
        this.playSFX(AUDIO_KEYS.SFX.FAIL_CLOSE)
      } else {
        this.playSFX(AUDIO_KEYS.SFX.GAME_LOSE, { detune: 100, volume: 0.8 })
      }
    } else {
      if (this.scene?.cache?.audio?.exists(AUDIO_KEYS.SFX.FAIL_TRY_AGAIN)) {
        this.playSFX(AUDIO_KEYS.SFX.FAIL_TRY_AGAIN)
      } else {
        this.playMiniGameLose()
      }
    }
  }

  // ==========================================================================
  // CURVEBALL SOUNDS
  // ==========================================================================

  playCurveballWarning() {
    if (this.scene?.cache?.audio?.exists(AUDIO_KEYS.SFX.CURVEBALL_WARNING)) {
      this.playSFX(AUDIO_KEYS.SFX.CURVEBALL_WARNING, { volume: 0.9 })
    } else {
      this.playSFX(AUDIO_KEYS.SFX.ERROR, { detune: -200, volume: 0.7 })
    }
  }

  playCurveballActive(curveballType) {
    if (this.scene?.cache?.audio?.exists(AUDIO_KEYS.SFX.CURVEBALL_ACTIVE)) {
      this.playSFX(AUDIO_KEYS.SFX.CURVEBALL_ACTIVE)
    } else {
      this.playSFX(AUDIO_KEYS.SFX.ERROR, { detune: 100, volume: 0.6 })
    }
  }

  // ==========================================================================
  // ACHIEVEMENT SOUNDS
  // ==========================================================================

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
      const detuneMap = { common: 0, rare: 100, epic: 200, legendary: 300 }
      this.playSFX(AUDIO_KEYS.SFX.ACHIEVEMENT, {
        detune: detuneMap[rarity] || 0,
        volume: 1.0 + ((detuneMap[rarity] || 0) / 300) * 0.3
      })
    }
  }

  playFirstWinOfDay() {
    if (this.scene?.cache?.audio?.exists(AUDIO_KEYS.SFX.FIRST_WIN_DAY)) {
      this.playSFX(AUDIO_KEYS.SFX.FIRST_WIN_DAY, { volume: 1.2 })
    } else {
      this.playSFX(AUDIO_KEYS.SFX.LEVEL_UP)
      this.scene?.time?.delayedCall(300, () => {
        this.playSFX(AUDIO_KEYS.SFX.CASH, { detune: 200 })
      })
    }
  }

  // ==========================================================================
  // EVENT SOUND HELPERS
  // ==========================================================================

  playEventPopup() {
    this.playSFX(AUDIO_KEYS.SFX.NOTIFICATION)
  }

  playOpportunity() {
    this.playSFX(AUDIO_KEYS.SFX.CASH)
  }

  playThreat() {
    this.playSFX(AUDIO_KEYS.SFX.ERROR)
  }
}

// Singleton instance
export const audioManager = new AudioManagerClass()
export default audioManager
