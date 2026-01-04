/**
 * ContextMemoryManager - Cross-Session Memory & Personalization
 *
 * Tracks:
 * - User profile (sessions, commands, playstyle)
 * - Recent context (last 20 commands, topics, NPCs mentioned)
 * - State patterns (what commands in what game states)
 * - Pronoun resolution ("them" -> last mentioned NPC)
 */

const STORAGE_KEY = 'terminal_context_memory'
const MAX_RECENT_COMMANDS = 20
const MAX_TOPICS = 10

// Default memory schema
const DEFAULT_MEMORY = {
  profile: {
    totalSessions: 0,
    totalCommands: 0,
    firstSeen: null,
    lastSeen: null,
    averageSessionLength: 0,
    commandsPerSession: 0,
    preferredPlayTime: null,
    riskTolerance: 50,
    preferredCrimes: [],
    preferredDistrict: null,
    communicationStyle: 'casual',
    milestones: {}
  },
  recentContext: {
    lastCommands: [],
    lastTopics: [],
    lastMentionedNPCs: [],
    lastMentionedLocations: [],
    pendingQuestions: [],
    lastAdvice: null
  },
  statePatterns: {},
  version: 1
}

class ContextMemoryManagerClass {
  constructor() {
    this.memory = null
    this.session = null
    this.isInitialized = false
  }

  /**
   * Initialize the memory manager
   */
  initialize() {
    if (this.isInitialized) return

    this.memory = this.loadMemory()
    this.session = this.initSession()

    // Update profile
    this.memory.profile.totalSessions++
    this.memory.profile.lastSeen = Date.now()
    if (!this.memory.profile.firstSeen) {
      this.memory.profile.firstSeen = Date.now()
    }

    this.isInitialized = true
    console.log('[ContextMemoryManager] Initialized - Session #' + this.memory.profile.totalSessions)
  }

  /**
   * Initialize session-specific tracking
   */
  initSession() {
    return {
      startTime: Date.now(),
      commandCount: 0,
      errorCount: 0,
      topicsThisSession: [],
      frustrationLevel: 0,
      lastCommandTime: null
    }
  }

  /**
   * Record a command execution
   */
  recordCommand(command, result, gameState) {
    if (!command) return

    const record = {
      command,
      timestamp: Date.now(),
      gameState: gameState ? {
        cash: gameState.player?.cash,
        level: gameState.player?.level,
        heat: gameState.player?.heat,
        energy: gameState.player?.energy,
        location: gameState.player?.location
      } : null,
      success: result?.success !== false
    }

    // Update recent commands (sliding window)
    this.memory.recentContext.lastCommands.unshift(record)
    if (this.memory.recentContext.lastCommands.length > MAX_RECENT_COMMANDS) {
      this.memory.recentContext.lastCommands.pop()
    }

    // Update session stats
    this.session.commandCount++
    this.session.lastCommandTime = Date.now()
    if (!result?.success) {
      this.session.errorCount++
    }

    // Update profile stats
    this.memory.profile.totalCommands++

    // Learn state pattern
    if (gameState) {
      this.learnStatePattern(command.split(' ')[0], gameState)
    }

    // Extract entities from command
    this.extractEntities(command)

    // Learn preferences
    this.learnPreferences(command, gameState)

    // Periodic save
    if (this.session.commandCount % 5 === 0) {
      this.saveMemory()
    }
  }

  /**
   * Learn what commands are used in what game states
   */
  learnStatePattern(command, gameState) {
    const stateKey = this.getStateKey(gameState)

    if (!this.memory.statePatterns[stateKey]) {
      this.memory.statePatterns[stateKey] = {}
    }

    this.memory.statePatterns[stateKey][command] =
      (this.memory.statePatterns[stateKey][command] || 0) + 1
  }

  /**
   * Create a simplified state bucket key
   */
  getStateKey(gameState) {
    if (!gameState?.player) return 'unknown'

    const p = gameState.player
    const cashBucket = p.cash < 500 ? 'low_cash' :
                       p.cash < 5000 ? 'mid_cash' : 'high_cash'
    const heatBucket = p.heat < 30 ? 'low_heat' :
                       p.heat < 70 ? 'mid_heat' : 'high_heat'
    const energyBucket = p.energy < 30 ? 'low_energy' : 'has_energy'

    return `${cashBucket}_${heatBucket}_${energyBucket}`
  }

  /**
   * Extract entities (NPCs, locations) from command
   */
  extractEntities(command) {
    const words = command.toLowerCase().split(/\s+/)

    // Known NPC names
    const npcNames = ['snoop', 'marcus', 'watcher', 'ironman', 'silkroad',
                      'connect', 'pharmacist', 'scarlett', 'architect', 'morgan']

    // Known locations
    const locations = ['downtown', 'yorkville', 'parkdale', 'scarborough',
                       'jane', 'finch', 'bank', 'ops', 'hub']

    // Find mentioned NPCs
    for (const npc of npcNames) {
      if (words.includes(npc)) {
        this.addToRecentList('lastMentionedNPCs', npc)
      }
    }

    // Find mentioned locations
    for (const loc of locations) {
      if (words.includes(loc)) {
        this.addToRecentList('lastMentionedLocations', loc)
      }
    }
  }

  /**
   * Add item to a recent list (with max size)
   */
  addToRecentList(listName, item) {
    const list = this.memory.recentContext[listName]
    if (!list) return

    // Remove if already exists
    const index = list.indexOf(item)
    if (index > -1) {
      list.splice(index, 1)
    }

    // Add to front
    list.unshift(item)

    // Trim to max size
    if (list.length > 5) {
      list.pop()
    }
  }

  /**
   * Learn user preferences from commands
   */
  learnPreferences(command, gameState) {
    const cmdParts = command.toLowerCase().split(/\s+/)
    const baseCmd = cmdParts[0]

    // Track crime preferences
    if (baseCmd === 'crime' && cmdParts[1]) {
      const crimeType = cmdParts[1]
      if (!this.memory.profile.preferredCrimes.includes(crimeType)) {
        this.memory.profile.preferredCrimes.unshift(crimeType)
        if (this.memory.profile.preferredCrimes.length > 5) {
          this.memory.profile.preferredCrimes.pop()
        }
      }
    }

    // Track risk tolerance based on heat level when doing crimes
    if (baseCmd === 'crime' && gameState?.player?.heat > 50) {
      this.memory.profile.riskTolerance = Math.min(100,
        this.memory.profile.riskTolerance + 2
      )
    }
  }

  /**
   * Record a conversation topic
   */
  recordTopic(topic, entities = {}) {
    this.memory.recentContext.lastTopics.unshift({
      topic,
      entities,
      timestamp: Date.now()
    })

    if (this.memory.recentContext.lastTopics.length > MAX_TOPICS) {
      this.memory.recentContext.lastTopics.pop()
    }

    // Track mentioned entities
    if (entities.npcName) {
      this.addToRecentList('lastMentionedNPCs', entities.npcName)
    }
    if (entities.location) {
      this.addToRecentList('lastMentionedLocations', entities.location)
    }
  }

  /**
   * Record an action (crime, job, etc.)
   */
  recordAction(actionType, result) {
    // Record as topic
    this.recordTopic(actionType, {
      success: result?.success,
      reward: result?.reward
    })

    // Track milestones
    if (actionType === 'crime' && !this.memory.profile.milestones.firstCrime) {
      this.memory.profile.milestones.firstCrime = Date.now()
    }
  }

  /**
   * Resolve pronoun references in input
   * "msg them" -> "msg snoop" (if snoop was last mentioned)
   */
  resolveReference(text) {
    let resolved = text

    // "them", "that person" -> last mentioned NPC
    if (/\b(them|that\s+(guy|person|contact))\b/i.test(text)) {
      const lastNPC = this.memory.recentContext.lastMentionedNPCs[0]
      if (lastNPC) {
        resolved = resolved.replace(/\b(them|that\s+(guy|person|contact))\b/gi, lastNPC)
      }
    }

    // "there", "that place" -> last mentioned location
    if (/\b(there|that\s+(place|district|area))\b/i.test(text)) {
      const lastLocation = this.memory.recentContext.lastMentionedLocations[0]
      if (lastLocation) {
        resolved = resolved.replace(/\b(there|that\s+(place|district|area))\b/gi, lastLocation)
      }
    }

    return resolved
  }

  /**
   * Get personalized greeting based on history
   */
  getPersonalizedGreeting() {
    const profile = this.memory.profile

    // First time user
    if (profile.totalSessions <= 1) {
      return null // Use default
    }

    // Return user
    if (profile.totalSessions < 5) {
      return "Welcome back. Ready to get to work?"
    }

    // Time-based greeting
    const hour = new Date().getHours()
    const timeGreeting = hour < 12 ? 'Morning' :
                         hour < 17 ? 'Afternoon' : 'Evening'

    // Personalization based on preferences
    if (profile.riskTolerance > 70) {
      return `${timeGreeting}. Ready for some action?`
    }

    if (profile.preferredCrimes.length > 0) {
      return `${timeGreeting}. Looking for another ${profile.preferredCrimes[0]}?`
    }

    return `${timeGreeting}. What's the play today?`
  }

  /**
   * Get suggestions based on memory and current state
   */
  getPersonalizedSuggestions(currentState) {
    const stateKey = this.getStateKey(currentState)
    const stateCommands = this.memory.statePatterns[stateKey] || {}

    // Sort by frequency in similar state
    return Object.entries(stateCommands)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cmd, count]) => ({
        command: cmd,
        score: count,
        reason: `Used ${count}x in similar situations`
      }))
  }

  /**
   * Get recent commands for learning
   */
  getRecentCommands(limit = 5) {
    return this.memory.recentContext.lastCommands
      .slice(0, limit)
      .map(r => r.command)
  }

  /**
   * Get recent actions for context
   */
  getRecentActions() {
    return this.memory.recentContext.lastCommands.slice(0, 10)
  }

  /**
   * Check if user seems frustrated
   */
  checkFrustration() {
    if (!this.session || this.session.commandCount === 0) return false

    const errorRate = this.session.errorCount / this.session.commandCount

    // Check for repeated failed commands
    const recentCommands = this.memory.recentContext.lastCommands.slice(0, 5)
    const failedCount = recentCommands.filter(c => !c.success).length

    this.session.frustrationLevel = Math.min(100,
      (errorRate * 40) + (failedCount * 15)
    )

    return this.session.frustrationLevel > 50
  }

  /**
   * Get session duration in minutes
   */
  getSessionDuration() {
    if (!this.session) return 0
    return Math.floor((Date.now() - this.session.startTime) / 60000)
  }

  /**
   * End session and update profile
   */
  endSession() {
    if (!this.session) return

    const duration = this.getSessionDuration()

    // Update average session length
    const total = this.memory.profile.averageSessionLength * (this.memory.profile.totalSessions - 1)
    this.memory.profile.averageSessionLength =
      (total + duration) / this.memory.profile.totalSessions

    // Update commands per session
    const totalCmds = this.memory.profile.commandsPerSession * (this.memory.profile.totalSessions - 1)
    this.memory.profile.commandsPerSession =
      (totalCmds + this.session.commandCount) / this.memory.profile.totalSessions

    // Determine preferred play time
    const hour = new Date().getHours()
    this.memory.profile.preferredPlayTime =
      hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

    this.saveMemory()
    console.log('[ContextMemoryManager] Session ended - Duration: ' + duration + 'min')
  }

  /**
   * Save memory to localStorage
   */
  saveMemory() {
    try {
      const data = {
        ...this.memory,
        lastSaved: Date.now()
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('[ContextMemoryManager] Save failed:', e)
    }
  }

  /**
   * Load memory from localStorage
   */
  loadMemory() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        // Merge with defaults to handle schema updates
        return {
          profile: { ...DEFAULT_MEMORY.profile, ...data.profile },
          recentContext: { ...DEFAULT_MEMORY.recentContext, ...data.recentContext },
          statePatterns: data.statePatterns || {},
          version: data.version || 1
        }
      }
    } catch (e) {
      console.warn('[ContextMemoryManager] Load failed:', e)
    }
    return JSON.parse(JSON.stringify(DEFAULT_MEMORY))
  }

  /**
   * Clear all memory (for testing/reset)
   */
  clearMemory() {
    localStorage.removeItem(STORAGE_KEY)
    this.memory = JSON.parse(JSON.stringify(DEFAULT_MEMORY))
    this.session = this.initSession()
    console.log('[ContextMemoryManager] Memory cleared')
  }

  /**
   * Get memory stats for debugging
   */
  getStats() {
    return {
      profile: this.memory.profile,
      recentCommandsCount: this.memory.recentContext.lastCommands.length,
      statePatternCount: Object.keys(this.memory.statePatterns).length,
      sessionDuration: this.getSessionDuration(),
      sessionCommands: this.session?.commandCount || 0
    }
  }
}

// Singleton instance
export const contextMemoryManager = new ContextMemoryManagerClass()
export default contextMemoryManager
