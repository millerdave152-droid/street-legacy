/**
 * CrewMissionManager - Autonomous crew mission system
 *
 * Allows players to send crew members on timed missions that:
 * - Run in real-time (even while offline)
 * - Generate passive income/resources
 * - Risk crew loyalty and injury
 * - Unlock special opportunities
 */

import { gameManager } from '../GameManager'
import { terminalManager, OUTPUT_TYPES } from './TerminalManager'

// Mission types with their configurations
export const MISSION_TYPES = {
  HUSTLE: 'hustle',
  SCOUT: 'scout',
  EXPAND: 'expand',
  PROTECT: 'protect',
  RECRUIT: 'recruit'
}

// Mission configurations
const MISSION_CONFIG = {
  [MISSION_TYPES.HUSTLE]: {
    name: 'Street Hustle',
    description: 'Work the streets for quick cash',
    duration: 30 * 60 * 1000,  // 30 minutes
    minSkill: 20,
    rewards: {
      cash: { min: 100, max: 500 }
    },
    risks: {
      loyaltyLoss: 5,
      injuryChance: 0.05,
      arrestChance: 0.02
    },
    cooldown: 15 * 60 * 1000,  // 15 minute cooldown
    icon: '[H]'
  },
  [MISSION_TYPES.SCOUT]: {
    name: 'Intel Gathering',
    description: 'Gather intel on targets and opportunities',
    duration: 60 * 60 * 1000,  // 1 hour
    minSkill: 40,
    rewards: {
      intel: true,
      opportunityChance: 0.3,
      xp: { min: 25, max: 50 }
    },
    risks: {
      loyaltyLoss: 3,
      injuryChance: 0.03
    },
    cooldown: 30 * 60 * 1000,
    icon: '[S]'
  },
  [MISSION_TYPES.EXPAND]: {
    name: 'Territory Expansion',
    description: 'Claim new territory for the crew',
    duration: 2 * 60 * 60 * 1000,  // 2 hours
    minSkill: 60,
    rewards: {
      respect: { min: 10, max: 25 },
      territoryProgress: true,
      xp: { min: 50, max: 100 }
    },
    risks: {
      loyaltyLoss: 10,
      injuryChance: 0.15,
      heatGain: 15
    },
    cooldown: 60 * 60 * 1000,
    icon: '[E]'
  },
  [MISSION_TYPES.PROTECT]: {
    name: 'Guard Duty',
    description: 'Protect assets and reduce heat',
    duration: 45 * 60 * 1000,  // 45 minutes
    minSkill: 30,
    rewards: {
      heatReduction: { min: 5, max: 15 },
      loyaltyGain: 5
    },
    risks: {
      injuryChance: 0.08
    },
    cooldown: 20 * 60 * 1000,
    icon: '[P]'
  },
  [MISSION_TYPES.RECRUIT]: {
    name: 'Recruitment Drive',
    description: 'Find new crew candidates',
    duration: 90 * 60 * 1000,  // 1.5 hours
    minSkill: 50,
    rewards: {
      recruitChance: 0.4,
      contactsGain: true
    },
    risks: {
      loyaltyLoss: 5,
      cashCost: 100
    },
    cooldown: 2 * 60 * 60 * 1000,
    icon: '[R]'
  }
}

// Storage key for persistence
const STORAGE_KEY = 'street_legacy_crew_missions'

class CrewMissionManagerClass {
  constructor() {
    this.activeMissions = new Map()  // missionId -> mission data
    this.missionHistory = []
    this.cooldowns = new Map()  // memberId -> cooldownEndTime
    this.initialized = false
    this.checkInterval = null
  }

  /**
   * Initialize the mission system
   */
  initialize() {
    if (this.initialized) return

    // Load saved state
    this.loadState()

    // Check for completed missions
    this.checkCompletedMissions()

    // Start periodic check
    this.checkInterval = setInterval(() => {
      this.checkCompletedMissions()
    }, 30000)  // Check every 30 seconds

    this.initialized = true
    console.log('[CrewMissionManager] Initialized with', this.activeMissions.size, 'active missions')
  }

  /**
   * Get available mission types
   */
  getMissionTypes() {
    return Object.entries(MISSION_CONFIG).map(([type, config]) => ({
      type,
      ...config
    }))
  }

  /**
   * Check if a crew member can be deployed
   */
  canDeploy(member) {
    if (!member) return { can: false, reason: 'Invalid crew member' }

    // Check if already on mission
    for (const mission of this.activeMissions.values()) {
      if (mission.memberId === member.id) {
        const remaining = this.getTimeRemaining(mission)
        return {
          can: false,
          reason: `Already on mission (${this.formatTime(remaining)} remaining)`
        }
      }
    }

    // Check cooldown
    const cooldownEnd = this.cooldowns.get(member.id)
    if (cooldownEnd && Date.now() < cooldownEnd) {
      const remaining = cooldownEnd - Date.now()
      return {
        can: false,
        reason: `On cooldown (${this.formatTime(remaining)} remaining)`
      }
    }

    return { can: true }
  }

  /**
   * Deploy a crew member on a mission
   */
  deployMember(memberId, missionType) {
    const player = gameManager.player
    if (!player || !player.crew) {
      return { success: false, error: 'No crew available' }
    }

    // Find the crew member
    const member = player.crew.find(m => m.id === memberId || m.name.toLowerCase() === memberId.toLowerCase())
    if (!member) {
      return { success: false, error: `Crew member "${memberId}" not found` }
    }

    // Validate mission type
    const config = MISSION_CONFIG[missionType]
    if (!config) {
      const validTypes = Object.keys(MISSION_CONFIG).join(', ')
      return { success: false, error: `Unknown mission type. Valid: ${validTypes}` }
    }

    // Check if can deploy
    const deployCheck = this.canDeploy(member)
    if (!deployCheck.can) {
      return { success: false, error: deployCheck.reason }
    }

    // Check skill requirement
    if ((member.skill || 0) < config.minSkill) {
      return {
        success: false,
        error: `${member.name} needs ${config.minSkill}% skill for this mission (has ${member.skill || 0}%)`
      }
    }

    // Pay upfront cost if any
    if (config.risks.cashCost && player.cash < config.risks.cashCost) {
      return {
        success: false,
        error: `Need $${config.risks.cashCost} for mission expenses`
      }
    }
    if (config.risks.cashCost) {
      gameManager.updatePlayerCash(-config.risks.cashCost)
    }

    // Create mission
    const mission = {
      id: `mission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      memberId: member.id,
      memberName: member.name,
      memberRole: member.role,
      type: missionType,
      startTime: Date.now(),
      endTime: Date.now() + config.duration,
      config,
      status: 'active'
    }

    this.activeMissions.set(mission.id, mission)
    this.saveState()

    return {
      success: true,
      mission,
      message: `${member.name} deployed on ${config.name}. ETA: ${this.formatTime(config.duration)}`
    }
  }

  /**
   * Recall a crew member early (with penalties)
   */
  recallMember(memberId) {
    let targetMission = null

    for (const mission of this.activeMissions.values()) {
      if (mission.memberId === memberId || mission.memberName.toLowerCase() === memberId.toLowerCase()) {
        targetMission = mission
        break
      }
    }

    if (!targetMission) {
      return { success: false, error: 'Crew member not on any mission' }
    }

    // Calculate partial completion
    const elapsed = Date.now() - targetMission.startTime
    const progress = elapsed / targetMission.config.duration

    // Apply loyalty penalty for early recall
    const loyaltyPenalty = Math.round(10 * (1 - progress))
    this.applyLoyaltyChange(targetMission.memberId, -loyaltyPenalty)

    // Remove mission
    this.activeMissions.delete(targetMission.id)

    // Set shorter cooldown
    const cooldownDuration = targetMission.config.cooldown * 0.5
    this.cooldowns.set(targetMission.memberId, Date.now() + cooldownDuration)

    this.saveState()

    return {
      success: true,
      message: `${targetMission.memberName} recalled. -${loyaltyPenalty} loyalty.`
    }
  }

  /**
   * Check and complete finished missions
   */
  checkCompletedMissions() {
    const now = Date.now()
    const completed = []

    for (const [id, mission] of this.activeMissions.entries()) {
      if (now >= mission.endTime) {
        const result = this.completeMission(mission)
        completed.push(result)
        this.activeMissions.delete(id)
      }
    }

    if (completed.length > 0) {
      this.saveState()
      this.notifyCompletedMissions(completed)
    }

    return completed
  }

  /**
   * Complete a mission and calculate results
   */
  completeMission(mission) {
    const config = mission.config
    const member = this.getMemberById(mission.memberId)
    const skillFactor = member ? (member.skill || 50) / 100 : 0.5
    const loyaltyFactor = member ? (member.loyalty || 50) / 100 : 0.5

    // Calculate success chance
    const baseSuccess = 0.7
    const successChance = baseSuccess + (skillFactor * 0.2) + (loyaltyFactor * 0.1)
    const isSuccess = Math.random() < successChance

    const result = {
      missionId: mission.id,
      memberName: mission.memberName,
      missionType: mission.type,
      missionName: config.name,
      success: isSuccess,
      rewards: {},
      penalties: {}
    }

    if (isSuccess) {
      // Apply rewards
      if (config.rewards.cash) {
        const amount = this.randomRange(config.rewards.cash.min, config.rewards.cash.max)
        const bonusAmount = Math.round(amount * (1 + skillFactor * 0.3))
        result.rewards.cash = bonusAmount
        gameManager.updatePlayerCash(bonusAmount)
      }

      if (config.rewards.xp) {
        const amount = this.randomRange(config.rewards.xp.min, config.rewards.xp.max)
        result.rewards.xp = amount
        gameManager.addExperience?.(amount)
      }

      if (config.rewards.respect) {
        const amount = this.randomRange(config.rewards.respect.min, config.rewards.respect.max)
        result.rewards.respect = amount
        gameManager.updatePlayerRespect?.(amount)
      }

      if (config.rewards.heatReduction) {
        const amount = this.randomRange(config.rewards.heatReduction.min, config.rewards.heatReduction.max)
        result.rewards.heatReduction = amount
        gameManager.updatePlayerHeat?.(-amount)
      }

      if (config.rewards.loyaltyGain) {
        this.applyLoyaltyChange(mission.memberId, config.rewards.loyaltyGain)
        result.rewards.loyaltyGain = config.rewards.loyaltyGain
      }

      if (config.rewards.opportunityChance && Math.random() < config.rewards.opportunityChance) {
        result.rewards.opportunity = true
        // Trigger opportunity system
        this.triggerMissionOpportunity(mission)
      }

      if (config.rewards.intel) {
        result.rewards.intel = true
        // Could unlock intel in a future system
      }
    } else {
      // Apply failure penalties
      result.penalties.failed = true
    }

    // Apply risks (even on success, some risks remain)
    if (config.risks.loyaltyLoss) {
      const loss = isSuccess ? Math.floor(config.risks.loyaltyLoss / 2) : config.risks.loyaltyLoss
      this.applyLoyaltyChange(mission.memberId, -loss)
      result.penalties.loyaltyLoss = loss
    }

    if (config.risks.injuryChance && Math.random() < config.risks.injuryChance) {
      result.penalties.injured = true
      // Could affect crew member availability
    }

    if (config.risks.heatGain && isSuccess) {
      gameManager.updatePlayerHeat?.(config.risks.heatGain)
      result.penalties.heatGain = config.risks.heatGain
    }

    // Set cooldown
    this.cooldowns.set(mission.memberId, Date.now() + config.cooldown)

    // Add to history
    this.missionHistory.push({
      ...result,
      completedAt: Date.now()
    })
    if (this.missionHistory.length > 50) {
      this.missionHistory = this.missionHistory.slice(-50)
    }

    return result
  }

  /**
   * Notify terminal of completed missions
   */
  notifyCompletedMissions(results) {
    if (!terminalManager) return

    results.forEach(result => {
      const lines = [
        `:: MISSION COMPLETE ::`,
        `  ${result.memberName} returned from ${result.missionName}`,
        result.success ? '  Status: SUCCESS' : '  Status: FAILED'
      ]

      // Add rewards
      if (result.rewards.cash) {
        lines.push(`  +$${result.rewards.cash.toLocaleString()}`)
      }
      if (result.rewards.xp) {
        lines.push(`  +${result.rewards.xp} XP`)
      }
      if (result.rewards.respect) {
        lines.push(`  +${result.rewards.respect} Respect`)
      }
      if (result.rewards.opportunity) {
        lines.push(`  New opportunity discovered!`)
      }

      // Add penalties
      if (result.penalties.loyaltyLoss) {
        lines.push(`  -${result.penalties.loyaltyLoss} Loyalty`)
      }
      if (result.penalties.injured) {
        lines.push(`  ${result.memberName} was injured!`)
      }

      lines.forEach(line => {
        terminalManager.addOutput(line, result.success ? OUTPUT_TYPES.SUCCESS : OUTPUT_TYPES.WARNING)
      })
    })
  }

  /**
   * Get all active missions
   */
  getActiveMissions() {
    const missions = []
    for (const mission of this.activeMissions.values()) {
      missions.push({
        ...mission,
        remaining: this.getTimeRemaining(mission),
        progress: this.getMissionProgress(mission)
      })
    }
    return missions.sort((a, b) => a.endTime - b.endTime)
  }

  /**
   * Get mission progress (0-1)
   */
  getMissionProgress(mission) {
    const elapsed = Date.now() - mission.startTime
    return Math.min(1, elapsed / (mission.endTime - mission.startTime))
  }

  /**
   * Get time remaining for mission
   */
  getTimeRemaining(mission) {
    return Math.max(0, mission.endTime - Date.now())
  }

  /**
   * Format time in human readable form
   */
  formatTime(ms) {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  /**
   * Helper to get random value in range
   */
  randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  /**
   * Get crew member by ID
   */
  getMemberById(memberId) {
    const player = gameManager.player
    if (!player || !player.crew) return null
    return player.crew.find(m => m.id === memberId)
  }

  /**
   * Apply loyalty change to crew member
   */
  applyLoyaltyChange(memberId, change) {
    const player = gameManager.player
    if (!player || !player.crew) return

    const member = player.crew.find(m => m.id === memberId)
    if (member) {
      member.loyalty = Math.max(0, Math.min(100, (member.loyalty || 50) + change))
    }
  }

  /**
   * Trigger opportunity from mission intel
   */
  triggerMissionOpportunity(mission) {
    // Could integrate with OpportunityManager
    console.log('[CrewMissionManager] Intel opportunity from', mission.memberName)
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      const state = {
        activeMissions: Array.from(this.activeMissions.entries()),
        missionHistory: this.missionHistory.slice(-20),
        cooldowns: Array.from(this.cooldowns.entries())
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.warn('[CrewMissionManager] Failed to save state:', e)
    }
  }

  /**
   * Load state from localStorage
   */
  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const state = JSON.parse(saved)
        this.activeMissions = new Map(state.activeMissions || [])
        this.missionHistory = state.missionHistory || []
        this.cooldowns = new Map(state.cooldowns || [])

        // Clean expired cooldowns
        const now = Date.now()
        for (const [id, endTime] of this.cooldowns.entries()) {
          if (endTime < now) {
            this.cooldowns.delete(id)
          }
        }
      }
    } catch (e) {
      console.warn('[CrewMissionManager] Failed to load state:', e)
    }
  }

  /**
   * Shutdown and cleanup
   */
  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
    this.saveState()
    this.initialized = false
  }
}

// Singleton export
export const crewMissionManager = new CrewMissionManagerClass()
export default crewMissionManager
