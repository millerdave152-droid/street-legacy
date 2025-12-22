// Street Legacy - Game Manager
// Bridges Phaser game engine with Supabase backend
// Supports both local data and Supabase cloud sync

import { playerService } from '../services/player.service'
import { wsService, ConnectionState } from '../services/websocket.service'
import { supabase } from '../services/supabase.js'
import { authService } from '../services/auth.service.js'
import {
  CRIMES, JOBS, DISTRICTS, ITEMS, PROPERTIES, HEISTS, TRADING_GOODS,
  getPlayerData, savePlayerData, checkLevelUp,
  executeCrime, executeJob, travelToDistrict,
  bankDeposit, bankWithdraw, useItem, buyItem,
  payBail, attemptJailbreak, restoreEnergy, reduceHeat, checkJailStatus,
  // Police Heat System
  WANTED_LEVELS, POLICE_CONFIG, LAY_LOW_OPTIONS,
  getWantedLevel, checkPursuitTrigger,
  // Achievement System
  checkLocalAchievements
} from './data/GameData.js'

// AI Player System
import { aiPlayerManager } from './managers/AIPlayerManager.js'
import { aiSimulationManager } from './managers/AISimulationManager.js'
import { aiMessageManager } from './managers/AIMessageManager.js'

// Set to true to ALWAYS use local data (no Supabase sync)
const USE_LOCAL_DATA_ONLY = false

class GameManagerClass {
  constructor() {
    this.scene = null
    this.player = null
    this.gameState = null
    this.isInitialized = false
    this.cooldowns = new Map()
    this.notifications = []
    this.listeners = new Map()
    this.activeEffects = []
    this.wsUnsubscribers = []
    this.useLocalData = USE_LOCAL_DATA_ONLY
  }

  setScene(scene) {
    this.scene = scene
  }

  async initialize() {
    if (this.isInitialized) return this.gameState

    // Check if user is authenticated with Supabase
    const isAuthenticated = authService.isAuthenticated

    if (!USE_LOCAL_DATA_ONLY && isAuthenticated) {
      console.log('[GameManager] Using SUPABASE mode - syncing with cloud')
      try {
        // Try to load player from Supabase
        const supabasePlayer = await this.loadFromSupabase()
        if (supabasePlayer) {
          this.player = supabasePlayer
          // Also save locally for offline fallback
          this.savePlayer()
        } else {
          // No Supabase data, use local and sync up
          this.player = getPlayerData()
          await this.syncToSupabase()
        }
        this.useLocalData = false
      } catch (error) {
        console.warn('[GameManager] Supabase load failed, using local data:', error)
        this.player = getPlayerData()
        this.useLocalData = true
      }
    } else {
      // Local data only mode
      console.log('[GameManager] Using LOCAL DATA mode')
      this.player = getPlayerData()
      this.useLocalData = true
    }

    this.gameState = {
      player: this.player,
      districts: DISTRICTS,
      crimes: CRIMES,
      jobs: JOBS,
      items: ITEMS,
      properties: PROPERTIES,
    }
    this.isInitialized = true
    this.emit('initialized', this.gameState)

    // Start energy/heat regeneration
    this.startRegeneration()

    // Process daily crew payroll on startup
    this.processDailyCrewPayroll()

    // Initialize AI Player System
    this.initializeAISystem()

    return this.gameState
  }

  /**
   * Initialize the AI player system
   * - Creates/loads AI players
   * - Starts simulation loop
   * - Sets up event listeners
   */
  initializeAISystem() {
    try {
      // Initialize AI player manager (loads or creates AI players)
      aiPlayerManager.initialize()

      // Initialize AI message manager
      aiMessageManager.initialize()

      // Start AI simulation loop
      aiSimulationManager.start()

      // Listen for new AI messages
      aiMessageManager.on('newMessage', (message) => {
        this.emit('aiMessage', message)
        this.addNotification('info', `📬 ${message.fromUsername}: ${message.title}`)
      })

      // Listen for AI alliance events
      aiSimulationManager.on('allianceFormed', (data) => {
        console.log('[GameManager] AI alliance formed:', data)
      })

      // Listen for AI rivalry events
      aiSimulationManager.on('rivalryCreated', (data) => {
        console.log('[GameManager] AI rivalry created:', data)
      })

      // Listen for AI betrayal events
      aiSimulationManager.on('betrayal', (data) => {
        console.log('[GameManager] AI betrayal:', data)
      })

      console.log('[GameManager] AI system initialized')
    } catch (error) {
      console.error('[GameManager] Failed to initialize AI system:', error)
    }
  }

  /**
   * Get AI message manager for UI access
   */
  getAIMessageManager() {
    return aiMessageManager
  }

  /**
   * Get AI player manager for leaderboard/UI access
   */
  getAIPlayerManager() {
    return aiPlayerManager
  }

  /**
   * Get unread AI message count
   */
  getUnreadAIMessageCount() {
    return aiMessageManager.getUnreadCount()
  }

  /**
   * Force an AI to contact the player (for testing)
   */
  triggerAIContact(aiId) {
    aiSimulationManager.forcePlayerContact(aiId)
  }

  // Load player data from Supabase
  async loadFromSupabase() {
    if (!authService.userId) return null

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', authService.userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }

    // Map Supabase fields to local player format
    return {
      id: data.id,
      username: data.username,
      level: data.level || 1,
      xp: data.xp || 0,
      cash: data.cash || 500,
      bank: data.bank || 0,
      health: data.health || 100,
      energy: data.energy || 100,
      heat: data.heat || 0,
      respect: data.respect || 0,
      current_district_id: data.current_district_id || 'parkdale',
      stats: data.stats || {},
      inventory: data.inventory || [],
      properties: data.properties || [],
      created_at: data.created_at,
      updated_at: data.updated_at
    }
  }

  // Sync player data to Supabase
  async syncToSupabase() {
    if (!authService.userId || !this.player) return

    try {
      const { error } = await supabase
        .from('players')
        .upsert({
          id: authService.userId,
          username: this.player.username,
          level: this.player.level,
          xp: this.player.xp,
          cash: this.player.cash,
          bank: this.player.bank,
          health: this.player.health,
          energy: this.player.energy,
          heat: this.player.heat,
          respect: this.player.respect,
          current_district_id: this.player.current_district_id,
          stats: this.player.stats,
          inventory: this.player.inventory,
          properties: this.player.properties,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })

      if (error) {
        console.error('[GameManager] Supabase sync failed:', error)
      } else {
        console.log('[GameManager] Synced to Supabase')
      }
    } catch (e) {
      console.error('[GameManager] Supabase sync error:', e)
    }
  }

  // Save player data locally and sync to Supabase if authenticated
  savePlayer() {
    // Always save locally for offline support
    savePlayerData(this.player)

    // Sync to Supabase if authenticated (don't await - fire and forget)
    if (!this.useLocalData && authService.isAuthenticated) {
      this.syncToSupabase().catch(e => console.warn('[GameManager] Background sync failed:', e))
    }
  }

  // Add cash to player (used by TutorialManager)
  addCash(amount) {
    if (!this.player) return
    this.player.cash = (this.player.cash || 0) + amount
    this.savePlayer()
    this.emit('playerUpdated', this.player)
    if (amount > 0) {
      this.addNotification('success', `+$${amount.toLocaleString()}`)
    }
  }

  // Add respect to player (used by TutorialManager)
  addRespect(amount) {
    if (!this.player) return
    this.player.respect = (this.player.respect || 0) + amount
    this.savePlayer()
    this.emit('playerUpdated', this.player)
    if (amount > 0) {
      this.addNotification('success', `+${amount} Respect`)
    }
  }

  // Unlock an achievement (used by TutorialManager)
  async unlockAchievement(achievementId) {
    if (!this.player) return

    // Initialize achievements array if needed
    if (!this.player.achievements) {
      this.player.achievements = []
    }

    // Check if already unlocked
    if (this.player.achievements.includes(achievementId)) {
      return { alreadyUnlocked: true }
    }

    // Add to local achievements
    this.player.achievements.push(achievementId)
    this.savePlayer()
    this.addNotification('success', `Achievement Unlocked: ${achievementId}`)
    this.emit('achievementUnlocked', { id: achievementId })

    return { success: true, achievementId }
  }

  // Update arbitrary player data fields (used by TutorialManager)
  async updatePlayerData(data) {
    if (!this.player) return

    // Update local player state with provided data
    Object.keys(data).forEach(key => {
      if (key === 'stats' && typeof data.stats === 'object') {
        // Merge stats object
        this.player.stats = { ...this.player.stats, ...data.stats }
      } else {
        this.player[key] = data[key]
      }
    })

    this.savePlayer()
    this.emit('playerUpdated', this.player)
    return this.player
  }

  // ============================================
  // MINIGAME STATS & PROGRESSIVE DIFFICULTY
  // ============================================

  /**
   * Get minigame stats for a specific crime type
   * @param {string} crimeId - The crime/minigame identifier
   * @returns {object} Stats including plays, wins, totalScore, highScore
   */
  getMinigameStats(crimeId) {
    if (!this.player) return { plays: 0, wins: 0, totalScore: 0, highScore: 0 }

    // Initialize minigame stats if needed
    if (!this.player.minigameStats) {
      this.player.minigameStats = {}
    }

    return this.player.minigameStats[crimeId] || {
      plays: 0,
      wins: 0,
      totalScore: 0,
      highScore: 0,
      perfectRuns: 0,
      lastPlayed: null
    }
  }

  /**
   * Record a minigame completion
   * @param {string} crimeId - The crime/minigame identifier
   * @param {object} result - Result containing success, score, perfectRun, curveballsSurvived
   */
  recordMinigameResult(crimeId, result) {
    if (!this.player) return

    // Initialize minigame stats if needed
    if (!this.player.minigameStats) {
      this.player.minigameStats = {}
    }

    // Get or create stats for this crime with enhanced tracking
    const stats = this.player.minigameStats[crimeId] || {
      plays: 0,
      wins: 0,
      losses: 0,
      totalScore: 0,
      highScore: 0,
      perfectRuns: 0,
      currentStreak: 0,
      bestStreak: 0,
      averageScore: 0,
      lastPlayed: null,
      tierHistory: [],
      curveballsSurvived: 0
    }

    // Ensure all fields exist (for existing save data)
    if (stats.losses === undefined) stats.losses = 0
    if (stats.currentStreak === undefined) stats.currentStreak = 0
    if (stats.bestStreak === undefined) stats.bestStreak = 0
    if (stats.averageScore === undefined) stats.averageScore = 0
    if (stats.tierHistory === undefined) stats.tierHistory = []
    if (stats.curveballsSurvived === undefined) stats.curveballsSurvived = 0

    // Update basic stats
    stats.plays += 1
    stats.totalScore += result.score || 0
    stats.lastPlayed = new Date().toISOString()
    stats.averageScore = Math.floor(stats.totalScore / stats.plays)

    if (result.success) {
      stats.wins += 1
      stats.currentStreak += 1
      if (stats.currentStreak > stats.bestStreak) {
        stats.bestStreak = stats.currentStreak
      }
    } else {
      stats.losses += 1
      stats.currentStreak = 0
    }

    // Track global high score per crime
    const wasNewHighScore = result.score > stats.highScore
    if (wasNewHighScore) {
      stats.highScore = result.score
      // Also track in global high scores map
      if (!this.player.mini_game_high_scores) {
        this.player.mini_game_high_scores = {}
      }
      this.player.mini_game_high_scores[crimeId] = result.score
    }

    if (result.perfectRun) {
      stats.perfectRuns += 1
      // Track global perfect runs
      if (!this.player.stats) this.player.stats = {}
      this.player.stats.perfect_runs = (this.player.stats.perfect_runs || 0) + 1
    }

    // Track global mini-game win streak (across all mini-games)
    if (result.success) {
      this.player.mini_game_streak = (this.player.mini_game_streak || 0) + 1
      // Track best global streak
      if (!this.player.mini_game_best_streak || this.player.mini_game_streak > this.player.mini_game_best_streak) {
        this.player.mini_game_best_streak = this.player.mini_game_streak
      }
    } else {
      this.player.mini_game_streak = 0
    }

    // Track total mini-games played and won globally
    if (!this.player.stats) this.player.stats = {}
    this.player.stats.total_mini_games = (this.player.stats.total_mini_games || 0) + 1
    if (result.success) {
      this.player.stats.mini_games_won = (this.player.stats.mini_games_won || 0) + 1
    }

    // Track curveballs survived globally
    if (result.curveballsSurvived) {
      this.player.stats.total_curveballs_survived = (this.player.stats.total_curveballs_survived || 0) + result.curveballsSurvived
    }

    // Track curveballs survived
    if (result.curveballsSurvived) {
      stats.curveballsSurvived += result.curveballsSurvived
    }

    // Check for tier advancement
    const currentTierName = stats.tierHistory.length > 0
      ? stats.tierHistory[stats.tierHistory.length - 1].tier
      : 'Novice'

    const newTierData = this.calculateMinigameDifficulty(crimeId, 1)

    if (newTierData.tier.name !== currentTierName) {
      stats.tierHistory.push({
        tier: newTierData.tier.name,
        achievedAt: new Date().toISOString(),
        atPlays: stats.plays,
        atWins: stats.wins
      })

      // Emit tier advancement event
      this.emit('tierAdvanced', {
        crimeId,
        oldTier: currentTierName,
        newTier: newTierData.tier.name
      })

      console.log(`[GameManager] Tier advanced: ${currentTierName} -> ${newTierData.tier.name}`)
    }

    this.player.minigameStats[crimeId] = stats
    this.savePlayer()

    console.log(`[GameManager] Recorded minigame result for ${crimeId}:`, stats)

    return stats
  }

  /**
   * Calculate progressive difficulty for a minigame
   * Based on player level + play count + win rate + wins required
   * @param {string} crimeId - The crime/minigame identifier
   * @param {number} baseDifficulty - Base difficulty from crime mapping
   * @returns {object} Difficulty data including level, tier, multipliers
   */
  calculateMinigameDifficulty(crimeId, baseDifficulty = 1) {
    const playerLevel = this.player?.level || 1
    const stats = this.getMinigameStats(crimeId)

    // Difficulty progression tiers (requires both plays AND wins to advance)
    const tiers = [
      { name: 'Novice',     minPlays: 0,  minWins: 0,  difficultyAdd: 0,   rewardMult: 1.0,  color: '#22c55e' },
      { name: 'Apprentice', minPlays: 3,  minWins: 1,  difficultyAdd: 0.5, rewardMult: 1.15, color: '#60a5fa' },
      { name: 'Skilled',    minPlays: 8,  minWins: 4,  difficultyAdd: 1,   rewardMult: 1.35, color: '#3b82f6' },
      { name: 'Expert',     minPlays: 15, minWins: 8,  difficultyAdd: 2,   rewardMult: 1.6,  color: '#a855f7' },
      { name: 'Master',     minPlays: 25, minWins: 15, difficultyAdd: 3,   rewardMult: 2.0,  color: '#f59e0b' }
    ]

    // Determine tier based on BOTH play count AND win count
    let currentTier = tiers[0]
    for (const tier of tiers) {
      if (stats.plays >= tier.minPlays && stats.wins >= tier.minWins) {
        currentTier = tier
      }
    }

    // Additional difficulty from player level (every 5 levels)
    const levelBonus = Math.floor(playerLevel / 5)

    // Win rate bonus (if winning too much, increase difficulty)
    const winRate = stats.plays > 0 ? stats.wins / stats.plays : 0
    const winRateBonus = winRate > 0.7 ? 1 : 0

    // Streak bonus (hot streak increases difficulty slightly)
    const streakBonus = stats.currentStreak >= 3 ? 0.5 : 0

    // Calculate final difficulty (capped at 10)
    const finalDifficulty = Math.min(10, Math.max(1,
      baseDifficulty + currentTier.difficultyAdd + levelBonus + winRateBonus + streakBonus
    ))

    // Scale targets and time based on difficulty
    const targetMultiplier = 1 + (finalDifficulty - 1) * 0.15  // +15% per difficulty
    const timeReduction = Math.min(15, (finalDifficulty - 1) * 2)  // -2s per difficulty, max -15s

    // Find next tier (must meet both plays AND wins requirement)
    const nextTier = tiers.find(t =>
      t.minPlays > stats.plays || t.minWins > stats.wins
    ) || null

    // Calculate plays/wins needed for next tier
    let playsToNextTier = 0
    let winsToNextTier = 0
    if (nextTier) {
      playsToNextTier = Math.max(0, nextTier.minPlays - stats.plays)
      winsToNextTier = Math.max(0, nextTier.minWins - stats.wins)
    }

    return {
      difficulty: finalDifficulty,
      tier: currentTier,
      stats,
      targetMultiplier,
      timeReduction,
      rewardMultiplier: currentTier.rewardMult * (1 + (finalDifficulty - baseDifficulty) * 0.1),
      nextTier,
      playsToNextTier,
      winsToNextTier
    }
  }

  /**
   * Get all minigame stats (for stats screen)
   */
  getAllMinigameStats() {
    if (!this.player?.minigameStats) return {}
    return this.player.minigameStats
  }

  // Start periodic regeneration of energy and heat decay
  startRegeneration() {
    // Regenerate every 30 seconds
    setInterval(() => {
      if (this.player) {
        restoreEnergy(this.player, 30)
        reduceHeat(this.player, 30)
        checkJailStatus(this.player)
        this.checkLayLowStatus() // Check if laying low period ended
        this.emit('playerUpdated', this.player)
      }
    }, 30000)
  }

  // ==========================================================================
  // WEBSOCKET INTEGRATION
  // ==========================================================================

  initializeWebSocket() {
    // Connect to WebSocket server
    wsService.connect()

    // Subscribe to global chat by default
    wsService.subscribeToChannel('global')

    // Set up WebSocket event listeners
    this.setupWebSocketListeners()

    // Track connection state - only show notifications after initial connection
    this.wsConnectedOnce = false
    this.wsUnsubscribers.push(
      wsService.onStateChange((newState, oldState) => {
        this.emit('wsStateChanged', { newState, oldState })

        if (newState === ConnectionState.CONNECTED) {
          if (this.wsConnectedOnce) {
            // Only show reconnected message if we were previously connected
            this.addNotification('success', 'Reconnected to server')
          }
          this.wsConnectedOnce = true
        } else if (newState === ConnectionState.RECONNECTING && this.wsConnectedOnce) {
          // Only show warning if we previously had a connection
          this.addNotification('warning', 'Connection lost, reconnecting...')
        }
        // Don't show any message on initial connection failure - WebSocket is optional
      })
    )
  }

  setupWebSocketListeners() {
    // Stat updates (cash, health, energy, etc.)
    this.wsUnsubscribers.push(
      wsService.onStatUpdate((data) => {
        // Update local player state
        if (this.player) {
          if (data.stats.cash !== undefined) this.player.cash = data.stats.cash
          if (data.stats.bank !== undefined) this.player.bank = data.stats.bank
          if (data.stats.xp !== undefined) this.player.xp = data.stats.xp
          if (data.stats.energy !== undefined) this.player.energy = data.stats.energy
          if (data.stats.nerve !== undefined) this.player.nerve = data.stats.nerve
          if (data.stats.health !== undefined) this.player.health = data.stats.health
          if (data.stats.heatLevel !== undefined) this.player.heat_level = data.stats.heatLevel
        }
        this.emit('playerUpdated', this.player)
      })
    )

    // Level up events
    this.wsUnsubscribers.push(
      wsService.onLevelUp((data) => {
        if (this.player) {
          this.player.level = data.newLevel
        }
        this.addNotification('success', `Level Up! You are now level ${data.newLevel}`)
        this.emit('levelUp', data)
      })
    )

    // Achievement unlocks
    this.wsUnsubscribers.push(
      wsService.onAchievement((data) => {
        this.addNotification('success', `Achievement Unlocked: ${data.name}`)
        this.emit('achievementUnlocked', data)
      })
    )

    // Incoming attacks
    this.wsUnsubscribers.push(
      wsService.onAttackReceived((data) => {
        this.addNotification('danger', `You were attacked by ${data.attacker.username}! -${data.damage} HP`)
        if (this.player) {
          this.player.health = data.healthRemaining
        }
        this.emit('attackReceived', data)
        this.emit('playerUpdated', this.player)
      })
    )

    // Money transfers
    this.wsUnsubscribers.push(
      wsService.onTransferReceived((data) => {
        this.addNotification('success', `Received $${data.amount.toLocaleString()} from ${data.fromPlayer.username}`)
        if (this.player) {
          this.player.bank = data.newBankBalance
        }
        this.emit('transferReceived', data)
        this.emit('playerUpdated', this.player)
      })
    )

    // Cooldown ready notifications
    this.wsUnsubscribers.push(
      wsService.onCooldownReady((data) => {
        const actionNames = {
          crime: 'commit a crime',
          attack: 'attack',
          heal: 'heal',
          travel: 'travel'
        }
        this.addNotification('info', `You can now ${actionNames[data.action] || data.action}!`)
        this.emit('cooldownReady', data)
      })
    )

    // General notifications from server
    this.wsUnsubscribers.push(
      wsService.onNotification((data) => {
        this.addNotification(data.category, data.message)
        this.emit('serverNotification', data)
      })
    )

    // System notifications
    this.wsUnsubscribers.push(
      wsService.onSystemNotification((data) => {
        const typeMap = { info: 'info', warning: 'warning', critical: 'danger' }
        this.addNotification(typeMap[data.level] || 'info', data.message)
        this.emit('systemNotification', data)
      })
    )

    // Jail release
    this.wsUnsubscribers.push(
      wsService.onJailReleased((data) => {
        const methodMessages = {
          time_served: 'You served your time and are free!',
          bail: 'Bail paid. You are free!',
          bribed: 'Guard bribed successfully!',
          escaped: 'Jailbreak successful!'
        }
        this.addNotification('success', methodMessages[data.method] || 'You are free from jail!')
        if (this.player) {
          this.player.is_jailed = false
          this.player.jail_until = null
        }
        this.emit('jailReleased', data)
        this.emit('playerUpdated', this.player)
      })
    )

    // Territory changes
    this.wsUnsubscribers.push(
      wsService.onTerritoryChange((data) => {
        if (data.newController) {
          this.addNotification('info', `${data.districtName} is now controlled by [${data.newController.crewTag}] ${data.newController.crewName}`)
        } else {
          this.addNotification('info', `${data.districtName} is now unclaimed`)
        }
        this.emit('territoryChanged', data)
      })
    )

    // Trade request received
    this.wsUnsubscribers.push(
      wsService.onTradeRequest((data) => {
        this.addNotification('info', `${data.fromUsername} wants to trade with you!`)
        this.emit('tradeRequest', data)
      })
    )

    // Trade completed
    this.wsUnsubscribers.push(
      wsService.onTradeCompleted((data) => {
        this.addNotification('success', `Trade with ${data.withUsername} completed!`)
        this.emit('tradeCompleted', data)
      })
    )

    // Heist events
    this.wsUnsubscribers.push(
      wsService.onHeistStarted((data) => {
        this.addNotification('info', `A heist is being planned!`)
        this.emit('heistStarted', data)
      })
    )

    this.wsUnsubscribers.push(
      wsService.onHeistExecuted((data) => {
        if (data.success) {
          this.addNotification('success', `Heist successful!`)
        } else {
          this.addNotification('danger', `Heist failed!`)
        }
        this.emit('heistExecuted', data)
      })
    )

    // Bounty placed on you
    this.wsUnsubscribers.push(
      wsService.onBountyPlaced((data) => {
        if (data.targetId === this.player?.id) {
          this.addNotification('danger', `A bounty of $${data.amount.toLocaleString()} has been placed on you!`)
        }
        this.emit('bountyPlaced', data)
      })
    )

    // Chat messages (emit for UI components)
    this.wsUnsubscribers.push(
      wsService.onChatMessage((data) => {
        this.emit('chatMessage', data)
      })
    )

    // Online count updates
    this.wsUnsubscribers.push(
      wsService.onOnlineCountUpdate((data) => {
        this.emit('onlineCountUpdate', data)
      })
    )

    // Crew member online/offline
    this.wsUnsubscribers.push(
      wsService.onCrewMemberOnline((data) => {
        this.addNotification('info', `${data.member.username} is now online`)
        this.emit('crewMemberOnline', data)
      })
    )

    this.wsUnsubscribers.push(
      wsService.onCrewMemberOffline((data) => {
        this.emit('crewMemberOffline', data)
      })
    )

    // Friend online/offline
    this.wsUnsubscribers.push(
      wsService.onFriendOnline((data) => {
        this.addNotification('info', `${data.friend.username} is now online`)
        this.emit('friendOnline', data)
      })
    )

    this.wsUnsubscribers.push(
      wsService.onFriendOffline((data) => {
        this.emit('friendOffline', data)
      })
    )
  }

  // WebSocket helper methods
  sendChatMessage(channel, message) {
    return wsService.sendChatMessage(channel, message)
  }

  subscribeToChat(channel) {
    return wsService.subscribeToChannel(channel)
  }

  unsubscribeFromChat(channel) {
    return wsService.unsubscribeFromChannel(channel)
  }

  isWebSocketConnected() {
    return wsService.isConnected()
  }

  getOnlineCount() {
    return wsService.getOnlineCount()
  }

  // Event emitter pattern
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)
    return () => this.off(event, callback)
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback)
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data)
        } catch (err) {
          console.error(`Error in ${event} listener:`, err)
        }
      })
    }
  }

  // Notification system
  addNotification(type, message) {
    const notification = {
      id: Date.now(),
      type,
      message,
      timestamp: new Date()
    }
    this.notifications.unshift(notification)
    if (this.notifications.length > 50) {
      this.notifications.pop()
    }
    this.emit('notification', notification)
  }

  // Cooldown management
  setCooldown(action, durationMs) {
    this.cooldowns.set(action, Date.now() + durationMs)
  }

  getCooldownRemaining(action) {
    const cooldownEnd = this.cooldowns.get(action)
    if (!cooldownEnd) return 0
    const remaining = cooldownEnd - Date.now()
    return remaining > 0 ? remaining : 0
  }

  isOnCooldown(action) {
    return this.getCooldownRemaining(action) > 0
  }

  // ==========================================================================
  // PLAYER ACTIONS
  // ==========================================================================

  async commitCrime(crimeTypeId) {
    if (this.isOnCooldown('crime')) {
      const remaining = Math.ceil(this.getCooldownRemaining('crime') / 1000)
      throw new Error(`Wait ${remaining}s before committing another crime`)
    }

    // Use local data if enabled
    if (this.useLocalData) {
      const crime = CRIMES.find(c => c.id === crimeTypeId)
      if (!crime) {
        throw new Error('Crime not found')
      }

      const result = executeCrime(this.player, crime)
      this.setCooldown('crime', 30000) // 30 second cooldown

      // Update player reference
      if (result.player) {
        this.player = result.player
        this.savePlayer()
        this.emit('playerUpdated', this.player)
      }

      if (result.success) {
        this.addNotification('success', `Crime successful! Earned $${result.cash_earned?.toLocaleString() || 0}`)
        if (result.leveled_up) {
          this.addNotification('success', `Level Up! Now level ${result.new_level}`)
        }
      } else {
        this.addNotification('danger', result.message || 'Crime failed!')
        if (result.caught) {
          this.addNotification('danger', 'You were caught and sent to jail!')
        }
      }

      this.emit('crimeCompleted', result)
      return result
    }

    try {
      const apiResult = await playerService.commitCrime(crimeTypeId)

      // Normalize the API response (server returns crimeSuccess, cashGained, etc.)
      const result = {
        success: apiResult.crimeSuccess ?? apiResult.success ?? false,
        cash_earned: apiResult.cashGained ?? apiResult.cash_earned ?? 0,
        xp_earned: apiResult.xpGained ?? apiResult.xp_earned ?? 0,
        leveled_up: apiResult.leveledUp ?? apiResult.leveled_up ?? false,
        new_level: apiResult.newLevel ?? apiResult.new_level ?? null,
        jailed: apiResult.caught ?? apiResult.jailed ?? false,
        message: apiResult.message,
        player: apiResult.player,
        heatGained: apiResult.heatGained ?? 0
      }

      this.setCooldown('crime', 30000) // 30 second cooldown

      // Update local player state with server response
      if (result.player) {
        if (result.player.cash !== undefined) this.player.cash = result.player.cash
        if (result.player.xp !== undefined) this.player.xp = result.player.xp
        if (result.player.level !== undefined) this.player.level = result.player.level
        if (result.player.energy !== undefined) this.player.energy = result.player.energy
        if (result.player.stamina !== undefined) this.player.stamina = result.player.stamina
        if (result.player.heat !== undefined) this.player.heat = result.player.heat
        this.emit('playerUpdated', this.player)
      }

      if (result.success) {
        this.addNotification('success', `Crime successful! Earned $${result.cash_earned?.toLocaleString() || 0}`)
        if (result.leveled_up) {
          this.addNotification('success', `Level Up! Now level ${result.new_level}`)
        }
      } else {
        this.addNotification('danger', result.message || 'Crime failed!')
        if (result.jailed) {
          this.addNotification('danger', 'You were caught and sent to jail!')
        }
      }

      this.emit('crimeCompleted', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async workJob(jobTypeId) {
    if (this.isOnCooldown('job')) {
      const remaining = Math.ceil(this.getCooldownRemaining('job') / 1000)
      throw new Error(`Wait ${remaining}s before working another job`)
    }

    // Use local data if enabled
    if (this.useLocalData) {
      const job = JOBS.find(j => j.id === jobTypeId)
      if (!job) {
        throw new Error('Job not found')
      }

      const result = executeJob(this.player, job)

      if (!result.success) {
        this.addNotification('danger', result.message || 'Could not complete job!')
        throw new Error(result.message)
      }

      this.setCooldown('job', (result.cooldown_seconds || 60) * 1000)

      // Update player reference
      if (result.player) {
        this.player = result.player
        this.savePlayer()
        this.emit('playerUpdated', this.player)
      }

      this.addNotification('success', `Job complete! Earned $${result.cash_earned?.toLocaleString() || 0}`)
      if (result.leveled_up) {
        this.addNotification('success', `Level Up! Now level ${result.new_level}`)
      }

      this.emit('jobCompleted', result)
      return result
    }

    try {
      const apiResult = await playerService.workJob(jobTypeId)

      // Normalize the API response
      const result = {
        success: apiResult.success ?? true,
        job_name: apiResult.job_name,
        cash_earned: apiResult.cash_earned ?? 0,
        xp_earned: apiResult.xp_earned ?? 0,
        rep_earned: apiResult.rep_earned ?? 0,
        energy_spent: apiResult.energy_spent ?? 0,
        leveled_up: apiResult.leveled_up ?? false,
        new_level: apiResult.new_level ?? null,
        cooldown_seconds: apiResult.cooldown_seconds ?? 60,
        player: apiResult.player
      }

      this.setCooldown('job', (result.cooldown_seconds || 60) * 1000)

      // Update local player state with server response
      if (result.player) {
        if (result.player.cash !== undefined) this.player.cash = result.player.cash
        if (result.player.xp !== undefined) this.player.xp = result.player.xp
        if (result.player.level !== undefined) this.player.level = result.player.level
        if (result.player.energy !== undefined) this.player.energy = result.player.energy
        if (result.player.stamina !== undefined) this.player.stamina = result.player.stamina
        this.emit('playerUpdated', this.player)
      }

      this.addNotification('success', `Job complete! Earned $${result.cash_earned?.toLocaleString() || 0}`)
      if (result.leveled_up) {
        this.addNotification('success', `Level Up! Now level ${result.new_level}`)
      }

      this.emit('jobCompleted', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async travel(districtId) {
    if (this.isOnCooldown('travel')) {
      const remaining = Math.ceil(this.getCooldownRemaining('travel') / 1000)
      throw new Error(`Wait ${remaining}s before traveling again`)
    }

    // Use local data if enabled
    if (this.useLocalData) {
      const result = travelToDistrict(this.player, districtId)

      if (!result.success) {
        this.addNotification('danger', result.message || 'Cannot travel there!')
        throw new Error(result.message)
      }

      this.setCooldown('travel', 10000) // 10 second cooldown

      // Update player reference
      if (result.player) {
        this.player = result.player
        this.savePlayer()
        this.emit('playerUpdated', this.player)
      }

      this.addNotification('info', `Traveled to ${result.district?.name || 'new district'}`)
      this.emit('traveled', result)
      return result
    }

    try {
      const result = await playerService.travel(districtId)
      this.setCooldown('travel', 10000) // 10 second cooldown

      this.player.current_district_id = districtId

      this.addNotification('info', `Traveled to ${result.district?.name || 'new district'}`)
      this.emit('traveled', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async buyProperty(propertyId) {
    try {
      const result = await playerService.purchaseProperty(propertyId)
      this.addNotification('success', `Purchased property for $${result.price?.toLocaleString() || 0}`)
      this.emit('propertyPurchased', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async collectPropertyIncome(propertyId) {
    try {
      const result = await playerService.collectPropertyIncome(propertyId)
      this.addNotification('success', `Collected $${result.amount?.toLocaleString() || 0} from property`)
      this.emit('propertyIncomeCollected', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async collectAllPropertyIncome() {
    try {
      const result = await playerService.collectAllPropertyIncome()
      this.addNotification('success', `Collected $${result.total?.toLocaleString() || 0} from all properties`)
      this.emit('allPropertyIncomeCollected', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async upgradeProperty(propertyId) {
    try {
      const result = await playerService.upgradeProperty(propertyId)
      this.addNotification('success', `Property upgraded to level ${result.new_level || '?'}`)
      this.emit('propertyUpgraded', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async sellProperty(propertyId) {
    // Handle locally since there's no backend endpoint
    if (!this.player) {
      throw new Error('Player not loaded')
    }

    // Find the property in player's owned properties
    const ownedIndex = this.player.properties?.findIndex(p => p.id === propertyId || p.property_id === propertyId)
    if (ownedIndex === -1 || ownedIndex === undefined) {
      this.addNotification('danger', 'Property not found in inventory')
      throw new Error('Property not found')
    }

    const ownedProperty = this.player.properties[ownedIndex]

    // Calculate sell price (50% of purchase price)
    const purchasePrice = ownedProperty.purchase_price || ownedProperty.price || 5000
    const sellPrice = Math.floor(purchasePrice * 0.5)

    // Add cash and remove property
    this.player.cash = (this.player.cash || 0) + sellPrice
    this.player.properties.splice(ownedIndex, 1)

    // Save changes
    this.savePlayer()
    this.emit('playerUpdated', this.player)
    this.addNotification('success', `Sold property for $${sellPrice.toLocaleString()}`)
    this.emit('propertySold', { propertyId, sellPrice })

    return { success: true, sellPrice, propertyId }
  }

  async useItem(inventoryId) {
    // Use local data if enabled
    if (this.useLocalData) {
      const result = useItem(this.player, inventoryId)

      if (!result.success) {
        this.addNotification('danger', result.message || 'Could not use item!')
        throw new Error(result.message)
      }

      this.player = result.player
      this.savePlayer()
      this.emit('playerUpdated', this.player)
      this.addNotification('info', result.message || 'Item used')
      this.emit('itemUsed', result)
      return result
    }

    try {
      const result = await playerService.useItem(inventoryId)
      this.addNotification('info', result.message || 'Item used')
      this.emit('itemUsed', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async bankDeposit(amount) {
    // Use local data if enabled
    if (this.useLocalData) {
      const result = bankDeposit(this.player, amount)

      if (!result.success) {
        this.addNotification('danger', result.message || 'Could not deposit!')
        throw new Error(result.message)
      }

      this.player = result.player
      this.savePlayer()
      this.emit('playerUpdated', this.player)
      this.addNotification('success', `Deposited $${amount.toLocaleString()}`)
      this.emit('bankTransaction', result)
      return result
    }

    try {
      const result = await playerService.bankDeposit(amount)
      this.addNotification('success', `Deposited $${amount.toLocaleString()}`)
      this.emit('bankTransaction', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async bankWithdraw(amount) {
    // Use local data if enabled
    if (this.useLocalData) {
      const result = bankWithdraw(this.player, amount)

      if (!result.success) {
        this.addNotification('danger', result.message || 'Could not withdraw!')
        throw new Error(result.message)
      }

      this.player = result.player
      this.savePlayer()
      this.emit('playerUpdated', this.player)
      this.addNotification('success', `Withdrew $${amount.toLocaleString()}`)
      this.emit('bankTransaction', result)
      return result
    }

    try {
      const result = await playerService.bankWithdraw(amount)
      this.addNotification('success', `Withdrew $${amount.toLocaleString()}`)
      this.emit('bankTransaction', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async payBail() {
    // Use local data if enabled
    if (this.useLocalData) {
      const result = payBail(this.player)

      if (!result.success) {
        this.addNotification('danger', result.message || 'Could not pay bail!')
        throw new Error(result.message)
      }

      this.player = result.player
      this.savePlayer()
      this.emit('playerUpdated', this.player)
      this.addNotification('success', 'Bail paid! You are now free.')
      this.emit('bailPaid', result)
      return result
    }

    try {
      const result = await playerService.payBail()
      this.addNotification('success', 'Bail paid! You are now free.')
      this.emit('bailPaid', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async attemptJailbreak() {
    // Use local data if enabled
    if (this.useLocalData) {
      const result = attemptJailbreak(this.player)

      this.player = result.player
      this.savePlayer()
      this.emit('playerUpdated', this.player)

      if (result.success) {
        this.addNotification('success', 'Jailbreak successful!')
      } else {
        this.addNotification('danger', 'Jailbreak failed! Time extended.')
      }
      this.emit('jailbreakAttempted', result)
      return result
    }

    try {
      const result = await playerService.attemptJailbreak()
      if (result.success) {
        this.addNotification('success', 'Jailbreak successful!')
      } else {
        this.addNotification('danger', 'Jailbreak failed! Time extended.')
      }
      this.emit('jailbreakAttempted', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  // ==========================================================================
  // POLICE HEAT SYSTEM
  // ==========================================================================

  /**
   * Get current wanted level info
   */
  getWantedLevel() {
    return getWantedLevel(this.player?.heat || 0)
  }

  /**
   * Check if a police pursuit should trigger after a crime
   * @param {object} crimeResult - Result from executeCrime
   * @returns {object} Pursuit info { shouldPursue, wantedLevel, jailTime, reason }
   */
  shouldTriggerPursuit(crimeResult) {
    if (!this.player) return { shouldPursue: false }
    return checkPursuitTrigger(
      this.player,
      crimeResult,
      this.player.current_district_id
    )
  }

  /**
   * Generate chase game data for a police pursuit
   * @returns {object} Chase game configuration
   */
  getPoliceChaseData() {
    const wantedInfo = this.getWantedLevel()

    return {
      crimeId: 'police_chase',
      crimeName: 'Police Pursuit',
      gameType: 'chase',
      difficulty: Math.min(5, wantedInfo.level + 1),
      timeLimit: Math.max(20, 35 - wantedInfo.level * 3),
      targetScore: 600 + (wantedInfo.level * 150),
      perfectScore: 1000 + (wantedInfo.level * 200),
      theme: {
        icon: '🚔',
        backgroundColor: 0x0a0a1a,
        successColor: 0x22c55e,
        failureColor: 0xef4444
      },
      isPoliceChase: true,
      wantedLevel: wantedInfo.level,
      wantedName: wantedInfo.name,
      jailTime: wantedInfo.jailTime
    }
  }

  /**
   * Handle the result of a police chase
   * @param {object} result - Chase game result { success, score, ... }
   */
  handleChaseResult(result) {
    const wantedInfo = this.getWantedLevel()

    if (result.success) {
      // ESCAPED! Reward the player
      const heatReduction = POLICE_CONFIG.escapeHeatReductionMin +
        Math.floor(Math.random() * (POLICE_CONFIG.escapeHeatReductionMax - POLICE_CONFIG.escapeHeatReductionMin))

      const xpReward = POLICE_CONFIG.escapeXPBase + (wantedInfo.level * POLICE_CONFIG.escapeXPPerLevel)

      // Apply rewards
      this.player.heat = Math.max(0, (this.player.heat || 0) - heatReduction)
      this.player.heat_level = this.player.heat
      this.player.xp = (this.player.xp || 0) + xpReward

      // Set grace period - no pursuits for a while
      this.player.policeGraceUntil = Date.now() + POLICE_CONFIG.gracePeriodAfterEscape

      // Track stats
      if (!this.player.stats) this.player.stats = {}
      this.player.stats.chases_escaped = (this.player.stats.chases_escaped || 0) + 1

      this.savePlayer()
      this.emit('playerUpdated', this.player)
      this.emit('pursuitEnded', {
        escaped: true,
        heatReduction,
        xpReward,
        message: `Lost the cops! -${heatReduction} Heat, +${xpReward} XP`
      })

      this.addNotification('success', `Escaped! -${heatReduction} Heat, +${xpReward} XP`)

      // Check for level up
      const levelCheck = checkLevelUp(this.player)
      if (levelCheck.leveledUp) {
        this.addNotification('success', `Level Up! Now level ${levelCheck.newLevel}`)
        this.emit('levelUp', { newLevel: levelCheck.newLevel })
      }

      return { escaped: true, heatReduction, xpReward }
    } else {
      // CAUGHT! Send to jail
      const jailTime = wantedInfo.jailTime || 30
      const cashOnHand = this.player.cash || 0
      const confiscationRate = POLICE_CONFIG.cashConfiscationMin +
        (Math.random() * (POLICE_CONFIG.cashConfiscationMax - POLICE_CONFIG.cashConfiscationMin))
      const cashLost = Math.floor(cashOnHand * confiscationRate)

      // Apply penalties
      this.player.cash = Math.max(0, cashOnHand - cashLost)
      this.player.is_jailed = true
      this.player.jail_until = new Date(Date.now() + jailTime * 1000).toISOString()
      this.player.heat = POLICE_CONFIG.heatResetAfterJail
      this.player.heat_level = this.player.heat

      // Track stats
      if (!this.player.stats) this.player.stats = {}
      this.player.stats.times_jailed = (this.player.stats.times_jailed || 0) + 1
      this.player.stats.chases_failed = (this.player.stats.chases_failed || 0) + 1

      this.savePlayer()
      this.emit('playerUpdated', this.player)
      this.emit('pursuitEnded', {
        escaped: false,
        jailTime,
        cashLost,
        message: `Busted! Lost $${cashLost.toLocaleString()}, Jail: ${jailTime}s`
      })

      this.addNotification('danger', `Arrested! Lost $${cashLost.toLocaleString()}, Jail: ${jailTime}s`)

      return { escaped: false, jailTime, cashLost }
    }
  }

  /**
   * Start laying low to reduce heat
   * @param {string} type - 'quick', 'safe', or 'leave'
   */
  startLayLow(type) {
    const option = LAY_LOW_OPTIONS[type]
    if (!option) {
      return { success: false, message: 'Invalid lay low option' }
    }

    // Check if already laying low
    if (this.player.isLayingLow) {
      return { success: false, message: 'Already laying low!' }
    }

    // Check requirements
    if (option.energyCost > (this.player.energy || 0)) {
      return { success: false, message: 'Not enough energy!' }
    }
    if (option.cashCost > (this.player.cash || 0)) {
      return { success: false, message: `Need $${option.cashCost.toLocaleString()}!` }
    }

    // Deduct costs
    this.player.energy = (this.player.energy || 0) - option.energyCost
    this.player.cash = (this.player.cash || 0) - option.cashCost
    this.player.stamina = this.player.energy

    // Set laying low state
    this.player.isLayingLow = true
    this.player.layLowUntil = Date.now() + option.duration
    this.player.layLowType = type
    this.player.layLowHeatReduction = option.heatReduction

    this.savePlayer()
    this.emit('playerUpdated', this.player)
    this.emit('layingLowStarted', {
      type,
      duration: option.duration,
      heatReduction: option.heatReduction,
      endsAt: this.player.layLowUntil
    })

    const durationMinutes = Math.floor(option.duration / 60000)
    this.addNotification('info', `${option.name} for ${durationMinutes} min...`)

    return { success: true, option, endsAt: this.player.layLowUntil }
  }

  /**
   * Check if laying low period has ended
   * Called periodically by startRegeneration
   */
  checkLayLowStatus() {
    if (!this.player?.isLayingLow) return

    if (Date.now() >= this.player.layLowUntil) {
      // Laying low complete - reduce heat
      const heatReduction = this.player.layLowHeatReduction || 10
      this.player.heat = Math.max(0, (this.player.heat || 0) - heatReduction)
      this.player.heat_level = this.player.heat

      // Clear laying low state
      this.player.isLayingLow = false
      this.player.layLowUntil = null
      this.player.layLowType = null
      this.player.layLowHeatReduction = 0

      this.savePlayer()
      this.emit('playerUpdated', this.player)
      this.emit('layingLowEnded', { heatReduction })

      this.addNotification('success', `Coast is clear! -${heatReduction} Heat`)
    }
  }

  /**
   * Get remaining time for laying low
   * @returns {number} Milliseconds remaining, or 0 if not laying low
   */
  getLayLowRemaining() {
    if (!this.player?.isLayingLow || !this.player.layLowUntil) return 0
    const remaining = this.player.layLowUntil - Date.now()
    return remaining > 0 ? remaining : 0
  }

  /**
   * Check if player is currently laying low
   */
  isLayingLow() {
    return this.player?.isLayingLow && this.getLayLowRemaining() > 0
  }

  /**
   * Get police config for UI display
   */
  getPoliceConfig() {
    return POLICE_CONFIG
  }

  /**
   * Get lay low options for UI display
   */
  getLayLowOptions() {
    return LAY_LOW_OPTIONS
  }

  /**
   * Get all wanted levels for UI display
   */
  getWantedLevels() {
    return WANTED_LEVELS
  }

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  async refreshGameState() {
    // Use local data if enabled
    if (this.useLocalData) {
      this.player = getPlayerData()
      this.gameState = {
        player: this.player,
        districts: DISTRICTS,
        crimes: CRIMES,
        jobs: JOBS,
        items: ITEMS,
        properties: PROPERTIES,
      }
      this.emit('stateRefreshed', this.gameState)
      this.emit('playerUpdated', this.player)
      return this.gameState
    }

    try {
      this.gameState = await playerService.getGameState()
      this.player = this.gameState.player
      this.emit('stateRefreshed', this.gameState)
      this.emit('playerUpdated', this.player)
      return this.gameState
    } catch (error) {
      this.addNotification('danger', 'Failed to refresh game state')
      throw error
    }
  }

  async getAvailableCrimes() {
    // Use local data if enabled
    if (this.useLocalData) {
      return CRIMES.map(crime => ({
        ...crime,
        can_attempt: (crime.min_level || 1) <= (this.player?.level || 1),
        has_energy: (this.player?.energy || 0) >= crime.energy_cost,
      }))
    }

    try {
      return await playerService.getAvailableCrimes()
    } catch (error) {
      console.error('Failed to get crimes:', error)
      return CRIMES // Return local data as fallback
    }
  }

  async getAvailableJobs() {
    // Use local data if enabled
    if (this.useLocalData) {
      return JOBS.map(job => ({
        ...job,
        can_work: (job.min_level || 1) <= (this.player?.level || 1),
        has_energy: (this.player?.energy || 0) >= job.energy_cost,
      }))
    }

    try {
      return await playerService.getAvailableJobs()
    } catch (error) {
      console.error('Failed to get jobs:', error)
      return JOBS // Return local data as fallback
    }
  }

  async getDistricts() {
    // Use local data if enabled
    if (this.useLocalData) {
      return DISTRICTS.map(district => ({
        ...district,
        is_current: district.id === this.player?.current_district_id,
        is_locked: (district.min_level || 1) > (this.player?.level || 1),
      }))
    }

    try {
      return await playerService.getDistricts()
    } catch (error) {
      console.error('Failed to get districts:', error)
      return DISTRICTS // Return local data as fallback
    }
  }

  async getInventory() {
    // Use local data if enabled
    if (this.useLocalData) {
      return this.player?.inventory || []
    }

    try {
      return await playerService.getInventory()
    } catch (error) {
      console.error('Failed to get inventory:', error)
      return []
    }
  }

  // Get available items for shop
  async getShopItems() {
    return ITEMS
  }

  async getMyProperties() {
    // Use local data if enabled
    if (this.useLocalData) {
      return this.player?.properties || []
    }

    try {
      return await playerService.getMyProperties()
    } catch (error) {
      console.error('Failed to get properties:', error)
      return []
    }
  }

  async getOwnedProperties() {
    // Use local data if enabled
    if (this.useLocalData) {
      return this.player?.properties || []
    }

    try {
      return await playerService.getOwnedProperties()
    } catch (error) {
      console.error('Failed to get owned properties:', error)
      return []
    }
  }

  async getAllProperties() {
    // Use local data if enabled
    if (this.useLocalData) {
      return PROPERTIES
    }

    try {
      return await playerService.getAllProperties()
    } catch (error) {
      console.error('Failed to get all properties:', error)
      return PROPERTIES // Return local data as fallback
    }
  }

  async getTotalPropertyIncome() {
    // Use local data if enabled
    if (this.useLocalData) {
      const properties = this.player?.properties || []
      return properties.reduce((sum, p) => sum + (p.income_per_hour || 0), 0)
    }

    try {
      return await playerService.getTotalPropertyIncome()
    } catch (error) {
      console.error('Failed to get total property income:', error)
      return 0
    }
  }

  async getMyBusinesses() {
    // Use local data if enabled
    if (this.useLocalData) {
      return [] // No businesses in local mode
    }

    try {
      return await playerService.getMyBusinesses()
    } catch (error) {
      console.error('Failed to get businesses:', error)
      return []
    }
  }

  // ==========================================================================
  // NPC CREW MEMBERS
  // ==========================================================================

  async getAvailableCrewMembers() {
    // Use local data if enabled
    if (this.useLocalData) {
      return [] // No crew members in local mode
    }

    try {
      return await playerService.getAvailableCrewMembers()
    } catch (error) {
      console.error('Failed to get available crew:', error)
      return []
    }
  }

  async getPlayerCrewMembers() {
    // Use local data if enabled
    if (this.useLocalData) {
      return [] // No crew members in local mode
    }

    try {
      return await playerService.getPlayerCrewMembers()
    } catch (error) {
      console.error('Failed to get player crew:', error)
      return []
    }
  }

  async hireCrewMember(memberId) {
    try {
      const result = await playerService.hireCrewMember(memberId)
      this.addNotification('success', `Hired ${result.member?.name || 'crew member'}!`)
      this.emit('crewMemberHired', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async fireCrewMember(memberId) {
    try {
      const result = await playerService.fireCrewMember(memberId)
      this.addNotification('info', `Fired ${result.member?.name || 'crew member'}`)
      this.emit('crewMemberFired', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async getCrewBonuses() {
    // Use local data if enabled - calculate from player.crew
    if (this.useLocalData) {
      return this.calculateLocalCrewBonuses()
    }

    try {
      return await playerService.getCrewBonuses()
    } catch (error) {
      console.error('Failed to get crew bonuses:', error)
      // Fallback to local calculation
      return this.calculateLocalCrewBonuses()
    }
  }

  /**
   * Calculate crew bonuses from local player data
   * Matches the logic from CrewScene.calculateCrewBonuses()
   */
  calculateLocalCrewBonuses() {
    const bonuses = { violence: 0, cooldown: 0, escape: 0, heat: 0, vehicle: 0, intimidation: 0, intel: 0 }

    const crew = this.player?.crew || []
    if (crew.length === 0) return bonuses

    crew.forEach(member => {
      const effectiveness = (member.skill || 50) / 100
      const loyaltyMultiplier = (member.loyalty || 100) / 100

      switch (member.role) {
        case 'enforcer':
          bonuses.violence += Math.floor(15 * effectiveness * loyaltyMultiplier)
          bonuses.intimidation += Math.floor(10 * effectiveness * loyaltyMultiplier)
          break
        case 'hacker':
          bonuses.cooldown += Math.floor(20 * effectiveness * loyaltyMultiplier)
          break
        case 'driver':
          bonuses.vehicle += Math.floor(20 * effectiveness * loyaltyMultiplier)
          bonuses.escape += Math.floor(10 * effectiveness * loyaltyMultiplier)
          break
        case 'lookout':
          bonuses.heat += Math.floor(25 * effectiveness * loyaltyMultiplier)
          break
        case 'muscle':
          bonuses.intimidation += Math.floor(20 * effectiveness * loyaltyMultiplier)
          break
        case 'insider':
          bonuses.intel += Math.floor(15 * effectiveness * loyaltyMultiplier)
          break
      }
    })

    return bonuses
  }

  /**
   * Process daily crew payroll on game startup
   * Checks if a new day has passed since last payroll and deducts crew costs
   * If player can't afford, crew loyalty decreases
   */
  processDailyCrewPayroll() {
    if (!this.player) return

    const crew = this.player.crew || []
    if (crew.length === 0) return

    const now = new Date()
    const today = now.toDateString()
    const lastPayrollDate = this.player.lastCrewPayrollDate

    // Check if we've already processed payroll today
    if (lastPayrollDate === today) return

    // Calculate total daily cost
    const totalDailyCost = crew.reduce((sum, member) => sum + (member.daily_cost || 50), 0)

    if (totalDailyCost === 0) return

    const playerCash = this.player.cash || 0

    if (playerCash >= totalDailyCost) {
      // Can afford - deduct payroll
      this.player.cash -= totalDailyCost
      this.player.lastCrewPayrollDate = today

      console.log(`[GameManager] Daily crew payroll processed: -$${totalDailyCost}`)
      this.addNotification('info', `💸 Crew payroll: -$${totalDailyCost.toLocaleString()}`)

      // Small loyalty boost for paying crew
      crew.forEach(member => {
        member.loyalty = Math.min(100, (member.loyalty || 100) + 1)
      })
    } else {
      // Can't afford - reduce loyalty
      this.player.lastCrewPayrollDate = today

      console.log(`[GameManager] Can't afford crew payroll! Loyalty decreasing.`)
      this.addNotification('danger', `⚠️ Can't afford crew payroll! Loyalty dropping.`)

      crew.forEach(member => {
        member.loyalty = Math.max(0, (member.loyalty || 100) - 10)

        // If loyalty drops to 0, crew member leaves
        if (member.loyalty <= 0) {
          this.addNotification('danger', `${member.name || 'A crew member'} left due to unpaid wages!`)
        }
      })

      // Remove crew members with 0 loyalty
      this.player.crew = crew.filter(member => member.loyalty > 0)
    }

    // Save updated player data
    this.savePlayer()
    this.emit('playerUpdated', this.player)
  }

  async getCrewSlots() {
    // Use local data if enabled
    if (this.useLocalData) {
      return { current: 0, max: 4 }
    }

    try {
      return await playerService.getCrewSlots()
    } catch (error) {
      console.error('Failed to get crew slots:', error)
      return { current: 0, max: 4 }
    }
  }

  // ==========================================================================
  // LEADERBOARDS
  // ==========================================================================

  async getLeaderboard(category = 'respect', limit = 50) {
    // Use local data if enabled
    if (this.useLocalData) {
      return { entries: [], player_rank: null }
    }

    try {
      return await playerService.getLeaderboard(category, limit)
    } catch (error) {
      console.error('Failed to get leaderboard:', error)
      return { entries: [], player_rank: null }
    }
  }

  async getPlayerRank(category = 'respect') {
    // Use local data if enabled
    if (this.useLocalData) {
      return null
    }

    try {
      return await playerService.getPlayerRank(category)
    } catch (error) {
      console.error('Failed to get player rank:', error)
      return null
    }
  }

  // ==========================================================================
  // ACHIEVEMENTS
  // ==========================================================================

  async getAchievements() {
    // Use local data if enabled
    if (this.useLocalData) {
      return { achievements: [], stats: { total: 0, unlocked: 0, claimed: 0 } }
    }

    try {
      return await playerService.getAchievements()
    } catch (error) {
      console.error('Failed to get achievements:', error)
      return { achievements: [], stats: { total: 0, unlocked: 0, claimed: 0 } }
    }
  }

  async getPlayerAchievements() {
    // Use local data if enabled
    if (this.useLocalData) {
      return []
    }

    try {
      return await playerService.getPlayerAchievements()
    } catch (error) {
      console.error('Failed to get player achievements:', error)
      return []
    }
  }

  async getAchievementStats() {
    // Use local data if enabled
    if (this.useLocalData) {
      return { total: 0, unlocked: 0, claimed: 0 }
    }

    try {
      return await playerService.getAchievementStats()
    } catch (error) {
      console.error('Failed to get achievement stats:', error)
      return { total: 0, unlocked: 0, claimed: 0 }
    }
  }

  async claimAchievement(achievementId) {
    try {
      const result = await playerService.claimAchievement(achievementId)
      this.addNotification('success', `Achievement claimed! +${result.cash_reward?.toLocaleString() || 0} cash, +${result.xp_reward || 0} XP`)
      this.emit('achievementClaimed', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async getUnclaimedCount() {
    // Use local data if enabled
    if (this.useLocalData) {
      return 0
    }

    try {
      return await playerService.getUnclaimedCount()
    } catch (error) {
      console.error('Failed to get unclaimed count:', error)
      return 0
    }
  }

  async checkAchievements() {
    // Use local achievement checker
    if (this.useLocalData) {
      const player = this.player || getPlayerData()
      const newAchievements = checkLocalAchievements(player)

      if (newAchievements.length > 0) {
        // Update player reference
        this.player = player

        // Notify for each achievement
        newAchievements.forEach(achievement => {
          this.addNotification('success', `🏆 Achievement: ${achievement.name}! +$${achievement.reward}`)
        })
        this.emit('achievementsUnlocked', newAchievements)

        return { new_achievements: newAchievements }
      }
      return { new_achievements: [] }
    }

    try {
      const result = await playerService.checkAchievements()
      if (result.new_achievements && result.new_achievements.length > 0) {
        result.new_achievements.forEach(achievement => {
          this.addNotification('success', `Achievement Unlocked: ${achievement.name}!`)
        })
        this.emit('achievementsUnlocked', result.new_achievements)
      }
      return result
    } catch (error) {
      console.error('Failed to check achievements:', error)
      return { new_achievements: [] }
    }
  }

  // ==========================================================================
  // EVENTS & NOTIFICATIONS
  // ==========================================================================

  async getActiveEvents() {
    // Use local data if enabled
    if (this.useLocalData) {
      return []
    }

    try {
      return await playerService.getActiveEvents()
    } catch (error) {
      console.error('Failed to get active events:', error)
      return []
    }
  }

  async getAvailableEvents() {
    // Use local data if enabled
    if (this.useLocalData) {
      return []
    }

    try {
      return await playerService.getAvailableEvents()
    } catch (error) {
      console.error('Failed to get available events:', error)
      return []
    }
  }

  async respondToEvent(eventId, choice) {
    try {
      const result = await playerService.respondToEvent(eventId, choice)
      this.emit('eventResponded', { eventId, choice, result })

      if (result.cash_change) {
        const sign = result.cash_change >= 0 ? '+' : ''
        this.addNotification(
          result.cash_change >= 0 ? 'success' : 'danger',
          `${sign}$${Math.abs(result.cash_change).toLocaleString()}`
        )
      }

      if (result.xp_change && result.xp_change > 0) {
        this.addNotification('info', `+${result.xp_change} XP`)
      }

      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async dismissEvent(eventId) {
    try {
      const result = await playerService.dismissEvent(eventId)
      this.emit('eventDismissed', eventId)
      return result
    } catch (error) {
      console.error('Failed to dismiss event:', error)
      throw error
    }
  }

  async checkForEvents() {
    // Use local data if enabled
    if (this.useLocalData) {
      return { new_events: [] }
    }

    try {
      const result = await playerService.checkForEvents()

      if (result && result.new_events && result.new_events.length > 0) {
        result.new_events.forEach(event => {
          this.emit('newEvent', event)
        })
      }

      return result
    } catch (error) {
      console.error('Failed to check for events:', error)
      return { new_events: [] }
    }
  }

  async getEventHistory(limit = 20) {
    try {
      return await playerService.getEventHistory(limit)
    } catch (error) {
      console.error('Failed to get event history:', error)
      return []
    }
  }

  // ==========================================================================
  // HEISTS
  // ==========================================================================

  async getHeists() {
    // Use local data if enabled
    if (this.useLocalData) {
      const player = this.player || getPlayerData()
      // Filter heists by player level
      const availableHeists = HEISTS.filter(h => player.level >= h.min_level)
      return { heists: availableHeists, activeHeist: player.activeHeist || null }
    }

    try {
      return await playerService.getHeists()
    } catch (error) {
      console.error('Failed to get heists:', error)
      // Fallback to local data
      const player = this.player || getPlayerData()
      const availableHeists = HEISTS.filter(h => player.level >= h.min_level)
      return { heists: availableHeists, activeHeist: player.activeHeist || null }
    }
  }

  async startHeist(heistId) {
    try {
      const result = await playerService.startHeist(heistId)
      this.addNotification('success', `Started planning ${result.heist?.name || 'heist'}!`)
      this.emit('heistStarted', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async joinHeist(activeHeistId) {
    try {
      const result = await playerService.joinHeist(activeHeistId)
      this.addNotification('success', 'Joined heist crew!')
      this.emit('heistJoined', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async leaveHeist(activeHeistId) {
    try {
      const result = await playerService.leaveHeist(activeHeistId)
      this.addNotification('info', 'Left heist crew')
      this.emit('heistLeft', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async selectHeistRole(activeHeistId, roleId) {
    try {
      const result = await playerService.selectHeistRole(activeHeistId, roleId)
      this.addNotification('success', `Selected role: ${result.roleName || 'role'}`)
      this.emit('heistRoleSelected', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async readyHeist(activeHeistId) {
    try {
      const result = await playerService.readyHeist(activeHeistId)
      this.addNotification('info', 'Marked as ready!')
      this.emit('heistReady', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async executeHeist(activeHeistId) {
    try {
      const result = await playerService.executeHeist(activeHeistId)
      if (result.success) {
        this.addNotification('success', `Heist successful! Earned ${result.totalPayout?.toLocaleString() || 0}!`)
      } else {
        this.addNotification('danger', result.message || 'Heist failed!')
      }
      this.emit('heistExecuted', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async cancelHeist(activeHeistId) {
    try {
      const result = await playerService.cancelHeist(activeHeistId)
      this.addNotification('info', 'Heist cancelled')
      this.emit('heistCancelled', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  // ==========================================================================
  // TRADING
  // ==========================================================================

  /**
   * Get available trading goods for buy/sell operations
   * Returns local TRADING_GOODS data with player level filtering
   */
  getTradingGoods() {
    const player = this.player || getPlayerData()
    return TRADING_GOODS.filter(good => player.level >= good.min_level)
  }

  async getPendingTrades() {
    try {
      return await playerService.getPendingTrades()
    } catch (error) {
      console.error('Failed to get pending trades:', error)
      return []
    }
  }

  async getTradeHistory(limit = 20, offset = 0) {
    try {
      return await playerService.getTradeHistory(limit, offset)
    } catch (error) {
      console.error('Failed to get trade history:', error)
      return []
    }
  }

  async createTrade(targetPlayerId, tradeData) {
    try {
      const result = await playerService.createTrade(targetPlayerId, tradeData)
      this.addNotification('success', result.message || 'Trade offer sent!')
      this.emit('tradeCreated', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async acceptTrade(tradeId) {
    try {
      const result = await playerService.acceptTrade(tradeId)
      this.addNotification('success', 'Trade accepted!')
      this.emit('tradeAccepted', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async declineTrade(tradeId) {
    try {
      const result = await playerService.declineTrade(tradeId)
      this.addNotification('info', 'Trade declined')
      this.emit('tradeDeclined', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async cancelTrade(tradeId) {
    try {
      const result = await playerService.cancelTrade(tradeId)
      this.addNotification('info', 'Trade cancelled')
      this.emit('tradeCancelled', result)
      return result
    } catch (error) {
      this.addNotification('danger', error.message)
      throw error
    }
  }

  async getNearbyPlayers() {
    try {
      return await playerService.getNearbyPlayers()
    } catch (error) {
      console.error('Failed to get nearby players:', error)
      return []
    }
  }

  // ==========================================================================
  // ADMIN HELPERS
  // ==========================================================================

  isAdmin() {
    return this.player?.is_admin === true
  }

  isModerator() {
    return this.player?.is_moderator === true || this.isAdmin()
  }

  hasElevatedPermissions() {
    return this.isAdmin() || this.isModerator()
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  cleanup() {
    // Unsubscribe from all WebSocket events
    this.wsUnsubscribers.forEach(unsub => unsub())
    this.wsUnsubscribers = []

    // Disconnect WebSocket
    wsService.disconnect()

    // Stop AI simulation
    aiSimulationManager.stop()

    this.cooldowns.clear()
    this.notifications = []
    this.player = null
    this.gameState = null
    this.isInitialized = false
    this.listeners.clear()
  }
}

// Singleton instance
export const gameManager = new GameManagerClass()
export default gameManager
