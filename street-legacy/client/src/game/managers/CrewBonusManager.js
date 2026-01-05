/**
 * CrewBonusManager - Integrates crew bonuses with mini-games
 *
 * Maps crew roles to game types and calculates bonuses during gameplay.
 * Provides passive bonuses (automatic) and active abilities (player-triggered).
 */

import { gameManager } from '../GameManager'

// Crew role definitions (mirrors CrewScene.ROLE_CONFIG)
export const CREW_ROLES = {
  ENFORCER: 'enforcer',
  HACKER: 'hacker',
  DRIVER: 'driver',
  LOOKOUT: 'lookout',
  MUSCLE: 'muscle',
  INSIDER: 'insider'
}

// Map mini-game types to relevant crew roles
const GAME_ROLE_MAPPINGS = {
  // Combat/Violence games
  'QTEGame': [CREW_ROLES.ENFORCER, CREW_ROLES.MUSCLE],
  'ChaseGame': [CREW_ROLES.DRIVER, CREW_ROLES.LOOKOUT],

  // Stealth/Precision games
  'LockPickGame': [CREW_ROLES.HACKER, CREW_ROLES.INSIDER],
  'SteadyHandGame': [CREW_ROLES.HACKER],
  'StealthGame': [CREW_ROLES.LOOKOUT, CREW_ROLES.INSIDER],

  // Tech/Hacking games
  'HackingGame': [CREW_ROLES.HACKER],
  'WireGame': [CREW_ROLES.HACKER],
  'SafeCrackGame': [CREW_ROLES.HACKER, CREW_ROLES.INSIDER],

  // Vehicle games
  'GetawayGame': [CREW_ROLES.DRIVER],
  'FroggerGame': [CREW_ROLES.DRIVER, CREW_ROLES.LOOKOUT],

  // Social/Intel games
  'NegotiationGame': [CREW_ROLES.INSIDER, CREW_ROLES.MUSCLE],
  'DisguiseGame': [CREW_ROLES.INSIDER],
  'SurveillanceGame': [CREW_ROLES.LOOKOUT, CREW_ROLES.INSIDER],

  // Memory/Pattern games
  'MemoryGame': [CREW_ROLES.INSIDER],
  'RhythmGame': [CREW_ROLES.ENFORCER],

  // Other games
  'SnakeGame': [CREW_ROLES.DRIVER],
  'SniperGame': [CREW_ROLES.ENFORCER, CREW_ROLES.LOOKOUT],
  'AuctionGame': [CREW_ROLES.INSIDER],
  'CrowdBlendGame': [CREW_ROLES.LOOKOUT]
}

// Active abilities that can be triggered during games
const ACTIVE_ABILITIES = {
  [CREW_ROLES.HACKER]: {
    name: 'Backdoor',
    description: 'Skip one obstacle or puzzle step',
    cooldown: 0, // One-time use per game
    effect: 'skip_obstacle'
  },
  [CREW_ROLES.DRIVER]: {
    name: 'Nitro Boost',
    description: 'Temporary speed increase',
    cooldown: 0,
    effect: 'speed_boost'
  },
  [CREW_ROLES.LOOKOUT]: {
    name: 'Heads Up',
    description: 'Preview next obstacle or pattern',
    cooldown: 0,
    effect: 'preview'
  },
  [CREW_ROLES.ENFORCER]: {
    name: 'Intimidate',
    description: 'Reduce target score requirement',
    cooldown: 0,
    effect: 'reduce_target'
  },
  [CREW_ROLES.MUSCLE]: {
    name: 'Tank',
    description: 'Block one curveball or penalty',
    cooldown: 0,
    effect: 'block_curveball'
  },
  [CREW_ROLES.INSIDER]: {
    name: 'Intel',
    description: 'Reveal hidden game pattern',
    cooldown: 0,
    effect: 'reveal_pattern'
  }
}

// Role bonus values (percentage improvements)
const ROLE_BONUS_VALUES = {
  [CREW_ROLES.ENFORCER]: { violence: 15, intimidation: 10 },
  [CREW_ROLES.HACKER]: { cooldown: 20, security: 15 },
  [CREW_ROLES.DRIVER]: { vehicle: 20, escape: 10, travel: 15 },
  [CREW_ROLES.LOOKOUT]: { heat: 25, warning: 20 },
  [CREW_ROLES.MUSCLE]: { intimidation: 20, protection: 15 },
  [CREW_ROLES.INSIDER]: { intel: 15, access: 20 }
}

class CrewBonusManagerClass {
  constructor() {
    this.initialized = false
  }

  initialize() {
    if (this.initialized) return
    this.initialized = true
    console.log('[CrewBonusManager] Initialized')
  }

  /**
   * Get the player's current crew
   */
  getPlayerCrew() {
    const player = gameManager.player
    if (!player || !player.crew) {
      return []
    }
    return player.crew.filter(m => m && m.role)
  }

  /**
   * Get crew members relevant to a specific game type
   */
  getRelevantCrewForGame(gameType) {
    const crew = this.getPlayerCrew()
    const relevantRoles = GAME_ROLE_MAPPINGS[gameType] || []

    return crew.filter(member => relevantRoles.includes(member.role))
  }

  /**
   * Calculate total bonuses for a game based on crew composition
   */
  getGameBonuses(gameType) {
    const relevantCrew = this.getRelevantCrewForGame(gameType)

    if (relevantCrew.length === 0) {
      return {
        hasBonus: false,
        timeExtension: 0,
        targetReduction: 0,
        curveballImmunity: false,
        activeAbility: null,
        crewMembers: [],
        bonusDescription: null
      }
    }

    // Calculate bonuses based on crew skill and loyalty
    let totalSkillBonus = 0
    let totalLoyaltyBonus = 0
    const abilities = []
    const memberNames = []

    relevantCrew.forEach(member => {
      const skillFactor = (member.skill || 50) / 100
      const loyaltyFactor = (member.loyalty || 50) / 100

      totalSkillBonus += skillFactor * 0.1 // Up to 10% per member
      totalLoyaltyBonus += loyaltyFactor * 0.05 // Up to 5% per member

      // Add active ability if high loyalty
      if (member.loyalty >= 60 && ACTIVE_ABILITIES[member.role]) {
        abilities.push({
          ...ACTIVE_ABILITIES[member.role],
          memberName: member.name,
          role: member.role
        })
      }

      memberNames.push(member.name)
    })

    // Cap bonuses at reasonable levels
    const timeExtension = Math.min(totalSkillBonus * 10, 5) // Up to 5 seconds
    const targetReduction = Math.min(totalSkillBonus + totalLoyaltyBonus, 0.2) // Up to 20%
    const curveballImmunity = relevantCrew.some(m => m.role === CREW_ROLES.MUSCLE && m.loyalty >= 70)

    return {
      hasBonus: true,
      timeExtension: Math.round(timeExtension * 10) / 10,
      targetReduction: Math.round(targetReduction * 100), // As percentage
      curveballImmunity,
      activeAbility: abilities.length > 0 ? abilities[0] : null,
      allAbilities: abilities,
      crewMembers: memberNames,
      bonusDescription: this.formatBonusDescription(timeExtension, targetReduction, curveballImmunity, memberNames)
    }
  }

  /**
   * Format bonus description for UI display
   */
  formatBonusDescription(timeExt, targetRed, curveballImmune, members) {
    const parts = []

    if (timeExt > 0) {
      parts.push(`+${timeExt.toFixed(1)}s time`)
    }
    if (targetRed > 0) {
      parts.push(`-${Math.round(targetRed * 100)}% target`)
    }
    if (curveballImmune) {
      parts.push('Curveball shield')
    }

    if (parts.length === 0) return null

    return `Crew bonus (${members.join(', ')}): ${parts.join(', ')}`
  }

  /**
   * Apply pre-game bonuses to game configuration
   */
  applyPreGameBonuses(gameConfig, gameType) {
    const bonuses = this.getGameBonuses(gameType)

    if (!bonuses.hasBonus) {
      return gameConfig
    }

    const modifiedConfig = { ...gameConfig }

    // Apply time extension
    if (bonuses.timeExtension > 0 && modifiedConfig.timeLimit) {
      modifiedConfig.timeLimit += bonuses.timeExtension
      modifiedConfig.crewTimeBonus = bonuses.timeExtension
    }

    // Apply target reduction
    if (bonuses.targetReduction > 0 && modifiedConfig.targetScore) {
      const reduction = 1 - (bonuses.targetReduction / 100)
      modifiedConfig.targetScore = Math.floor(modifiedConfig.targetScore * reduction)
      modifiedConfig.crewTargetReduction = bonuses.targetReduction
    }

    // Store curveball immunity flag
    if (bonuses.curveballImmunity) {
      modifiedConfig.curveballImmunity = true
    }

    // Store active ability for use during game
    if (bonuses.activeAbility) {
      modifiedConfig.crewAbility = bonuses.activeAbility
    }

    // Store crew info for display
    modifiedConfig.crewBonuses = bonuses

    return modifiedConfig
  }

  /**
   * Execute an active crew ability during gameplay
   */
  executeAbility(ability, gameState) {
    if (!ability || !ability.effect) return null

    switch (ability.effect) {
      case 'skip_obstacle':
        return {
          type: 'skip_obstacle',
          message: `${ability.memberName} bypassed the obstacle!`
        }

      case 'speed_boost':
        return {
          type: 'speed_boost',
          duration: 3000, // 3 seconds
          multiplier: 1.5,
          message: `${ability.memberName} hit the nitro!`
        }

      case 'preview':
        return {
          type: 'preview',
          duration: 2000, // 2 seconds preview
          message: `${ability.memberName} spotted what's coming!`
        }

      case 'reduce_target':
        return {
          type: 'reduce_target',
          reduction: 0.15, // 15% reduction
          message: `${ability.memberName} intimidated the target!`
        }

      case 'block_curveball':
        return {
          type: 'block_curveball',
          message: `${ability.memberName} blocked the interference!`
        }

      case 'reveal_pattern':
        return {
          type: 'reveal_pattern',
          duration: 3000,
          message: `${ability.memberName} revealed the pattern!`
        }

      default:
        return null
    }
  }

  /**
   * Get bonus for specific crime type based on crew
   */
  getCrimeBonuses(crimeType) {
    const crew = this.getPlayerCrew()

    // Map crime types to relevant roles
    const crimeRoleMappings = {
      // Violent crimes
      'mugging': [CREW_ROLES.ENFORCER, CREW_ROLES.MUSCLE],
      'armed_robbery': [CREW_ROLES.ENFORCER, CREW_ROLES.MUSCLE],
      'assault': [CREW_ROLES.ENFORCER, CREW_ROLES.MUSCLE],

      // Stealth crimes
      'pickpocket': [CREW_ROLES.LOOKOUT],
      'burglary': [CREW_ROLES.HACKER, CREW_ROLES.LOOKOUT],
      'shoplifting': [CREW_ROLES.LOOKOUT],

      // Vehicle crimes
      'carjacking': [CREW_ROLES.DRIVER],
      'car_theft': [CREW_ROLES.DRIVER, CREW_ROLES.HACKER],
      'getaway': [CREW_ROLES.DRIVER],

      // Tech crimes
      'hacking': [CREW_ROLES.HACKER],
      'identity_theft': [CREW_ROLES.HACKER, CREW_ROLES.INSIDER],
      'crypto_scam': [CREW_ROLES.HACKER],

      // Social crimes
      'fraud': [CREW_ROLES.INSIDER],
      'extortion': [CREW_ROLES.MUSCLE, CREW_ROLES.INSIDER],
      'smuggling': [CREW_ROLES.DRIVER, CREW_ROLES.INSIDER]
    }

    const relevantRoles = crimeRoleMappings[crimeType.toLowerCase()] || []
    const relevantCrew = crew.filter(m => relevantRoles.includes(m.role))

    if (relevantCrew.length === 0) {
      return { successBonus: 0, heatReduction: 0, rewardBonus: 0 }
    }

    // Calculate bonuses
    let successBonus = 0
    let heatReduction = 0
    let rewardBonus = 0

    relevantCrew.forEach(member => {
      const effectiveness = ((member.skill || 50) * (member.loyalty || 50)) / 10000

      successBonus += 5 * effectiveness
      heatReduction += member.role === CREW_ROLES.LOOKOUT ? 10 * effectiveness : 0
      rewardBonus += member.role === CREW_ROLES.INSIDER ? 5 * effectiveness : 0
    })

    return {
      successBonus: Math.round(successBonus),
      heatReduction: Math.round(heatReduction),
      rewardBonus: Math.round(rewardBonus),
      crewMembers: relevantCrew.map(m => m.name)
    }
  }

  /**
   * Get overall crew synergy bonus
   */
  getCrewSynergy() {
    const crew = this.getPlayerCrew()

    if (crew.length === 0) return { level: 0, bonus: 0, description: 'No crew' }

    // Calculate role diversity
    const uniqueRoles = new Set(crew.map(m => m.role))
    const diversityScore = uniqueRoles.size / Object.keys(CREW_ROLES).length

    // Calculate average loyalty
    const avgLoyalty = crew.reduce((sum, m) => sum + (m.loyalty || 50), 0) / crew.length

    // Calculate synergy score
    const synergy = (diversityScore * 0.4 + avgLoyalty / 100 * 0.6) * 100

    if (synergy >= 80) {
      return { level: 4, bonus: 25, description: 'Elite Synergy', score: synergy }
    } else if (synergy >= 60) {
      return { level: 3, bonus: 15, description: 'Strong Synergy', score: synergy }
    } else if (synergy >= 40) {
      return { level: 2, bonus: 10, description: 'Moderate Synergy', score: synergy }
    } else if (synergy >= 20) {
      return { level: 1, bonus: 5, description: 'Weak Synergy', score: synergy }
    } else {
      return { level: 0, bonus: 0, description: 'No Synergy', score: synergy }
    }
  }
}

// Singleton export
export const crewBonusManager = new CrewBonusManagerClass()
export default crewBonusManager
