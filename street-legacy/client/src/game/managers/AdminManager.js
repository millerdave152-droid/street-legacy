/**
 * AdminManager - Singleton manager for admin/debug functionality
 *
 * Handles:
 * - Admin status checking
 * - Debug flags (god mode, free energy, skip cooldowns, etc.)
 * - Stat modifications via admin API
 * - Quick admin actions
 * - Mini-game testing helpers
 *
 * Usage:
 *   import { adminManager } from './managers/AdminManager'
 *
 *   if (adminManager.isAdminUser()) {
 *     // Show admin controls
 *   }
 *
 *   adminManager.setCash(1000000)
 */

import { adminService } from '../../services/admin.service'
import { gameManager } from '../GameManager'

class AdminManagerClass {
  constructor() {
    // Singleton check
    if (AdminManagerClass.instance) {
      return AdminManagerClass.instance
    }
    AdminManagerClass.instance = this

    // Admin status
    this.isAdmin = false
    this.isModerator = false

    // Debug flags (persisted to localStorage)
    this.debugFlags = this.loadDebugFlags()

    // Selected test parameters
    this.selectedDifficulty = 1
    this.selectedDistrict = 1
    this.selectedMiniGame = null
  }

  /**
   * Load debug flags from localStorage
   */
  loadDebugFlags() {
    try {
      const saved = localStorage.getItem('admin_debug_flags')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.warn('Failed to load admin debug flags:', e)
    }

    return {
      godMode: false,
      freeEnergy: false,
      skipCooldowns: false,
      autoWinMiniGames: false,
      instantActions: false,
      noHeat: false,
      unlimitedCash: false,
      showDebugInfo: false,
      logAPIRequests: false
    }
  }

  /**
   * Save debug flags to localStorage
   */
  saveDebugFlags() {
    try {
      localStorage.setItem('admin_debug_flags', JSON.stringify(this.debugFlags))
    } catch (e) {
      console.warn('Failed to save admin debug flags:', e)
    }
  }

  /**
   * Check and set admin status from player data
   * @param {Object} player - Player object with is_admin field
   */
  checkAdminStatus(player) {
    this.isAdmin = player?.is_admin === true
    this.isModerator = player?.is_moderator === true || this.isAdmin

    // Also store in gameManager for easy access
    if (gameManager) {
      gameManager.debugFlags = this.debugFlags
    }
  }

  /**
   * Check if current user is an admin
   * @returns {boolean}
   */
  isAdminUser() {
    return this.isAdmin
  }

  /**
   * Check if current user is a moderator or admin
   * @returns {boolean}
   */
  isModeratorUser() {
    return this.isModerator
  }

  /**
   * Toggle a debug flag
   * @param {string} flag - Flag name
   * @param {boolean} value - New value (optional, toggles if not provided)
   */
  setDebugFlag(flag, value = null) {
    if (value === null) {
      this.debugFlags[flag] = !this.debugFlags[flag]
    } else {
      this.debugFlags[flag] = value
    }
    this.saveDebugFlags()
    this.applyDebugFlag(flag, this.debugFlags[flag])
  }

  /**
   * Apply a debug flag's effect
   * @param {string} flag - Flag name
   * @param {boolean} value - Flag value
   */
  applyDebugFlag(flag, value) {
    switch (flag) {
      case 'freeEnergy':
        if (value && gameManager.player) {
          gameManager.player.energy = gameManager.player.max_energy || 100
          gameManager.emit('playerUpdated', gameManager.player)
        }
        break

      case 'skipCooldowns':
        if (value && gameManager) {
          gameManager.cooldowns.clear()
        }
        break

      case 'noHeat':
        if (value && gameManager.player) {
          gameManager.player.heat = 0
          gameManager.emit('playerUpdated', gameManager.player)
        }
        break

      case 'logAPIRequests':
        window.__DEBUG_LOG_API = value
        break

      default:
        // Store for other systems to check
        if (gameManager) {
          if (!gameManager.debugFlags) gameManager.debugFlags = {}
          gameManager.debugFlags[flag] = value
        }
        break
    }
  }

  /**
   * Enable all debug flags
   */
  enableAllFlags() {
    Object.keys(this.debugFlags).forEach(flag => {
      this.debugFlags[flag] = true
      this.applyDebugFlag(flag, true)
    })
    this.saveDebugFlags()
  }

  /**
   * Disable all debug flags
   */
  disableAllFlags() {
    Object.keys(this.debugFlags).forEach(flag => {
      this.debugFlags[flag] = false
      this.applyDebugFlag(flag, false)
    })
    this.saveDebugFlags()
  }

  // ==========================================================================
  // STAT MODIFICATIONS
  // ==========================================================================

  /**
   * Get current player ID (for self-targeting)
   */
  getPlayerId() {
    return gameManager.player?.id
  }

  /**
   * Set player's cash to exact amount
   * @param {number} amount
   * @param {string} targetId - Target player ID (default: self)
   */
  async setCash(amount, targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      await adminService.adjustPlayerCurrency(id, 'cash', amount, 'Admin set cash')

      if (!targetId && gameManager.player) {
        gameManager.player.cash = amount
        gameManager.emit('playerUpdated', gameManager.player)
      }
      return true
    } catch (error) {
      console.error('Admin setCash failed:', error)
      return false
    }
  }

  /**
   * Add cash to player
   * @param {number} amount - Can be negative
   * @param {string} targetId
   */
  async addCash(amount, targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      await adminService.adjustPlayerCurrency(id, 'cash', amount, 'Admin add cash')

      if (!targetId && gameManager.player) {
        gameManager.player.cash = (gameManager.player.cash || 0) + amount
        gameManager.emit('playerUpdated', gameManager.player)
      }
      return true
    } catch (error) {
      console.error('Admin addCash failed:', error)
      return false
    }
  }

  /**
   * Set player's bank balance
   * @param {number} amount
   * @param {string} targetId
   */
  async setBank(amount, targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      await adminService.adjustPlayerCurrency(id, 'bank_balance', amount, 'Admin set bank')

      if (!targetId && gameManager.player) {
        gameManager.player.bank_balance = amount
        gameManager.emit('playerUpdated', gameManager.player)
      }
      return true
    } catch (error) {
      console.error('Admin setBank failed:', error)
      return false
    }
  }

  /**
   * Set player's energy
   * @param {number} amount
   * @param {string} targetId
   */
  async setEnergy(amount, targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      await adminService.adjustPlayerCurrency(id, 'energy', amount, 'Admin set energy')

      if (!targetId && gameManager.player) {
        gameManager.player.energy = Math.min(amount, gameManager.player.max_energy || 100)
        gameManager.emit('playerUpdated', gameManager.player)
      }
      return true
    } catch (error) {
      console.error('Admin setEnergy failed:', error)
      return false
    }
  }

  /**
   * Set player's health
   * @param {number} amount
   * @param {string} targetId
   */
  async setHealth(amount, targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      await adminService.adjustPlayerCurrency(id, 'health', amount, 'Admin set health')

      if (!targetId && gameManager.player) {
        gameManager.player.health = Math.min(amount, gameManager.player.max_health || 100)
        gameManager.emit('playerUpdated', gameManager.player)
      }
      return true
    } catch (error) {
      console.error('Admin setHealth failed:', error)
      return false
    }
  }

  /**
   * Set player's heat level
   * @param {number} amount
   * @param {string} targetId
   */
  async setHeat(amount, targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      await adminService.adjustPlayerCurrency(id, 'heat', amount, 'Admin set heat')

      if (!targetId && gameManager.player) {
        gameManager.player.heat = Math.max(0, Math.min(amount, 100))
        gameManager.emit('playerUpdated', gameManager.player)
      }
      return true
    } catch (error) {
      console.error('Admin setHeat failed:', error)
      return false
    }
  }

  /**
   * Add XP to player
   * @param {number} amount
   * @param {string} targetId
   */
  async addXP(amount, targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      await adminService.adjustPlayerCurrency(id, 'xp', amount, 'Admin add XP')

      if (!targetId && gameManager.player) {
        gameManager.player.xp = (gameManager.player.xp || 0) + amount
        gameManager.emit('playerUpdated', gameManager.player)
      }
      return true
    } catch (error) {
      console.error('Admin addXP failed:', error)
      return false
    }
  }

  /**
   * Set player's level
   * @param {number} level
   * @param {string} targetId
   */
  async setLevel(level, targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      await adminService.adjustPlayerCurrency(id, 'level', level, 'Admin set level')

      if (!targetId && gameManager.player) {
        gameManager.player.level = Math.max(1, Math.min(level, 100))
        gameManager.emit('playerUpdated', gameManager.player)
      }
      return true
    } catch (error) {
      console.error('Admin setLevel failed:', error)
      return false
    }
  }

  /**
   * Add respect to player
   * @param {number} amount
   * @param {string} targetId
   */
  async addRespect(amount, targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      await adminService.adjustPlayerCurrency(id, 'respect', amount, 'Admin add respect')

      if (!targetId && gameManager.player) {
        gameManager.player.respect = (gameManager.player.respect || 0) + amount
        gameManager.emit('playerUpdated', gameManager.player)
      }
      return true
    } catch (error) {
      console.error('Admin addRespect failed:', error)
      return false
    }
  }

  // ==========================================================================
  // QUICK ACTIONS
  // ==========================================================================

  /**
   * Unlock all districts for player
   * @param {string} targetId
   */
  async unlockAllDistricts(targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      // Set level high enough to unlock all districts
      await this.setLevel(50, id)
      return true
    } catch (error) {
      console.error('Admin unlockAllDistricts failed:', error)
      return false
    }
  }

  /**
   * Give all items to player
   * @param {string} targetId
   */
  async giveAllItems(targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      await adminService.adjustPlayerCurrency(id, 'items', 999, 'Admin give all items')
      return true
    } catch (error) {
      console.error('Admin giveAllItems failed:', error)
      return false
    }
  }

  /**
   * Clear all cooldowns for player
   * @param {string} targetId
   */
  async clearAllCooldowns(targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      // Clear local cooldowns
      if (!targetId) {
        gameManager.cooldowns.clear()
      }

      await adminService.adjustPlayerCurrency(id, 'cooldowns', 0, 'Admin clear cooldowns')
      return true
    } catch (error) {
      // Still clear local cooldowns even if API fails
      if (!targetId) {
        gameManager.cooldowns.clear()
      }
      console.warn('Admin clearAllCooldowns API failed, local cooldowns cleared:', error)
      return true
    }
  }

  /**
   * Unlock all achievements for player
   * @param {string} targetId
   */
  async unlockAllAchievements(targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      await adminService.adjustPlayerCurrency(id, 'achievements', 999, 'Admin unlock all achievements')
      return true
    } catch (error) {
      console.error('Admin unlockAllAchievements failed:', error)
      return false
    }
  }

  /**
   * Reset tutorial for player
   * @param {string} targetId
   */
  async resetTutorial(targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      await adminService.adjustPlayerCurrency(id, 'tutorial', 0, 'Admin reset tutorial')

      if (!targetId && gameManager.player) {
        gameManager.player.tutorial_completed = false
        gameManager.player.tutorial_step = 0
        gameManager.emit('playerUpdated', gameManager.player)
      }
      return true
    } catch (error) {
      console.error('Admin resetTutorial failed:', error)
      return false
    }
  }

  /**
   * Full reset of player data
   * @param {string} targetId
   */
  async resetPlayer(targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      await adminService.resetPlayerStats(id)

      // Refresh game state if resetting self
      if (!targetId) {
        await gameManager.refreshGameState()
      }
      return true
    } catch (error) {
      console.error('Admin resetPlayer failed:', error)
      return false
    }
  }

  /**
   * Max out all stats for player
   * @param {string} targetId
   */
  async maxAllStats(targetId = null) {
    const id = targetId || this.getPlayerId()
    try {
      await this.setCash(10000000, id)
      await this.setBank(10000000, id)
      await this.setEnergy(100, id)
      await this.setHealth(100, id)
      await this.setHeat(0, id)
      await this.setLevel(100, id)
      await this.addRespect(1000000, id)
      return true
    } catch (error) {
      console.error('Admin maxAllStats failed:', error)
      return false
    }
  }

  // ==========================================================================
  // TEST HELPERS
  // ==========================================================================

  /**
   * Launch a specific mini-game for testing
   * @param {Phaser.Scene} scene - Current scene
   * @param {string} gameKey - Mini-game scene key
   * @param {number} difficulty - Difficulty level (1-5)
   */
  launchMiniGame(scene, gameKey, difficulty = 1) {
    this.selectedDifficulty = difficulty
    this.selectedMiniGame = gameKey

    scene.scene.start(gameKey, {
      difficulty: difficulty,
      crimeType: 'test_crime',
      testMode: true,
      onComplete: (success, score) => {
        console.log(`[Admin] Mini-game ${gameKey} completed:`, { success, score })
      }
    })
  }

  /**
   * Get list of available mini-games
   */
  getMiniGameList() {
    return [
      { key: 'SnakeGame', name: 'Snake', icon: '🐍' },
      { key: 'LockPickGame', name: 'Lock Pick', icon: '🔐' },
      { key: 'QTEGame', name: 'QTE', icon: '⚡' },
      { key: 'FroggerGame', name: 'Frogger', icon: '🐸' },
      { key: 'MemoryGame', name: 'Memory', icon: '🧠' },
      { key: 'SteadyHandGame', name: 'Steady Hand', icon: '✋' },
      { key: 'ChaseGame', name: 'Chase', icon: '🏃' },
      { key: 'SniperGame', name: 'Sniper', icon: '🎯' },
      { key: 'SafeCrackGame', name: 'Safe Crack', icon: '🔒' },
      { key: 'WireGame', name: 'Wire Cut', icon: '⚡' }
    ]
  }

  /**
   * Simulate a crime completion (for testing rewards)
   * @param {boolean} success - Whether crime succeeded
   * @param {Object} options - Crime options
   */
  async simulateCrime(success = true, options = {}) {
    const {
      cashReward = 5000,
      xpReward = 100,
      respectReward = 50,
      heatGain = 10
    } = options

    if (success) {
      await this.addCash(cashReward)
      await this.addXP(xpReward)
      await this.addRespect(respectReward)

      if (!this.debugFlags.noHeat) {
        const currentHeat = gameManager.player?.heat || 0
        await this.setHeat(currentHeat + heatGain)
      }
    }

    return {
      success,
      cashReward: success ? cashReward : 0,
      xpReward: success ? xpReward : 0,
      respectReward: success ? respectReward : 0,
      heatGain: success ? heatGain : 0
    }
  }

  /**
   * Log debug info to console
   * @param {string} category
   * @param {string} message
   * @param {Object} data
   */
  log(category, message, data = null) {
    if (this.debugFlags.showDebugInfo || this.isAdmin) {
      const prefix = `[Admin:${category}]`
      if (data) {
        console.log(prefix, message, data)
      } else {
        console.log(prefix, message)
      }
    }
  }
}

// Singleton instance
export const adminManager = new AdminManagerClass()
export default adminManager
