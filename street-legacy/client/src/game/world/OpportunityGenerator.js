/**
 * OpportunityGenerator - Phase 24: Dynamic Opportunity Generation
 *
 * Opportunities emerge from world state rather than random timers.
 *
 * Sources:
 * - NPC needs (from simulation)
 * - Territory conflicts
 * - Player reputation
 * - World events
 * - Consequence chains
 *
 * Each opportunity has:
 * - Who offers
 * - What they want
 * - Why now
 * - What they offer
 * - Hidden conditions
 */

import { worldClock } from './WorldClock'
import { territoryManager, DISTRICTS } from './TerritoryManager'
import { reputationPropagator, REPUTATION_ASPECTS } from './ReputationPropagator'
import { narrativeState } from '../narrative/NarrativeState'

// Opportunity categories
export const OPPORTUNITY_CATEGORIES = {
  HEIST: 'heist',
  THEFT: 'theft',
  SMUGGLING: 'smuggling',
  INFORMATION: 'information',
  PROTECTION: 'protection',
  TERRITORY: 'territory',
  REVENGE: 'revenge',
  RESCUE: 'rescue',
}

// Generation sources
export const GENERATION_SOURCES = {
  NPC_NEED: 'npc_need',
  TERRITORY_CONFLICT: 'territory_conflict',
  REPUTATION: 'reputation',
  WORLD_EVENT: 'world_event',
  CONSEQUENCE: 'consequence',
  RANDOM: 'random',
}

// NPC archetypes and their typical needs
const NPC_NEEDS = {
  marcus_chen: {
    name: 'Marcus Chen',
    needs: ['muscle', 'theft', 'information'],
    payQuality: 'good',
    riskLevel: 'medium',
  },
  vince_romano: {
    name: 'Vince Romano',
    needs: ['smuggling', 'heist', 'collection'],
    payQuality: 'excellent',
    riskLevel: 'high',
  },
  nina_santos: {
    name: 'Nina Santos',
    needs: ['hacking', 'information', 'surveillance'],
    payQuality: 'good',
    riskLevel: 'low',
  },
  ghost: {
    name: 'Ghost',
    needs: ['courier', 'theft', 'wetwork'],
    payQuality: 'variable',
    riskLevel: 'extreme',
  },
  elena_voss: {
    name: 'Elena Voss',
    needs: ['corporate_espionage', 'blackmail', 'sabotage'],
    payQuality: 'excellent',
    riskLevel: 'medium',
  },
  dex_johnson: {
    name: 'Dex Johnson',
    needs: ['car_theft', 'racing', 'chop_shop'],
    payQuality: 'medium',
    riskLevel: 'low',
  },
}

// Opportunity templates by category
const OPPORTUNITY_TEMPLATES = {
  [OPPORTUNITY_CATEGORIES.HEIST]: [
    {
      name: 'Bank Job',
      description: 'A small branch bank with weak security',
      baseReward: { min: 5000, max: 15000 },
      difficulty: 'hard',
      crewRequired: 2,
      timeLimit: 300000,
    },
    {
      name: 'Jewelry Store',
      description: 'High-end store, needs smash and grab',
      baseReward: { min: 3000, max: 8000 },
      difficulty: 'medium',
      crewRequired: 1,
      timeLimit: 180000,
    },
    {
      name: 'Art Gallery',
      description: 'Specific piece needed, buyer waiting',
      baseReward: { min: 8000, max: 20000 },
      difficulty: 'hard',
      crewRequired: 2,
      timeLimit: 600000,
    },
  ],
  [OPPORTUNITY_CATEGORIES.THEFT]: [
    {
      name: 'Car Boost',
      description: 'Specific model needed for export',
      baseReward: { min: 1000, max: 3000 },
      difficulty: 'easy',
      crewRequired: 0,
      timeLimit: 120000,
    },
    {
      name: 'Warehouse Raid',
      description: 'Electronics shipment, security minimal',
      baseReward: { min: 2000, max: 5000 },
      difficulty: 'medium',
      crewRequired: 1,
      timeLimit: 240000,
    },
  ],
  [OPPORTUNITY_CATEGORIES.SMUGGLING]: [
    {
      name: 'Package Run',
      description: 'No questions asked, point A to B',
      baseReward: { min: 500, max: 1500 },
      difficulty: 'easy',
      crewRequired: 0,
      timeLimit: 300000,
    },
    {
      name: 'Border Crossing',
      description: 'High-value cargo, heavy surveillance',
      baseReward: { min: 5000, max: 12000 },
      difficulty: 'hard',
      crewRequired: 1,
      timeLimit: 600000,
    },
  ],
  [OPPORTUNITY_CATEGORIES.INFORMATION]: [
    {
      name: 'Surveillance Job',
      description: 'Watch and report, simple observation',
      baseReward: { min: 300, max: 800 },
      difficulty: 'easy',
      crewRequired: 0,
      timeLimit: 180000,
    },
    {
      name: 'Data Extraction',
      description: 'Get into system, copy files, get out',
      baseReward: { min: 2000, max: 6000 },
      difficulty: 'medium',
      crewRequired: 0,
      timeLimit: 300000,
    },
  ],
  [OPPORTUNITY_CATEGORIES.TERRITORY]: [
    {
      name: 'Turf Defense',
      description: 'Show force, protect the block',
      baseReward: { min: 1000, max: 3000 },
      difficulty: 'medium',
      crewRequired: 2,
      timeLimit: 180000,
    },
    {
      name: 'Expansion Push',
      description: 'Take new ground, establish presence',
      baseReward: { min: 2000, max: 5000 },
      difficulty: 'hard',
      crewRequired: 3,
      timeLimit: 300000,
    },
  ],
}

/**
 * OpportunityGenerator class
 */
class OpportunityGeneratorClass {
  constructor() {
    this.generatedOpportunities = []
    this.lastGeneration = {}  // Track last generation per source
    this.generationCooldowns = {
      [GENERATION_SOURCES.NPC_NEED]: 120000,        // 2 min
      [GENERATION_SOURCES.TERRITORY_CONFLICT]: 180000,  // 3 min
      [GENERATION_SOURCES.REPUTATION]: 300000,      // 5 min
      [GENERATION_SOURCES.WORLD_EVENT]: 60000,      // 1 min (event-driven)
      [GENERATION_SOURCES.RANDOM]: 240000,          // 4 min
    }
    this.intervalId = null
  }

  /**
   * Initialize opportunity generation
   */
  initialize() {
    // Check for generation periodically
    this.intervalId = setInterval(() => {
      this.checkForGeneration()
    }, 30000)  // Every 30 seconds

    // Listen for world events
    window.addEventListener('world_event_start', (e) => {
      this.generateFromWorldEvent(e.detail)
    })

    window.addEventListener('territory_attack', (e) => {
      this.generateFromTerritoryConflict(e.detail)
    })

    console.log('[OpportunityGenerator] Initialized')
  }

  /**
   * Shutdown
   */
  shutdown() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Check if any opportunities should be generated
   */
  checkForGeneration() {
    const now = Date.now()

    // Check each source
    for (const source of Object.values(GENERATION_SOURCES)) {
      const lastGen = this.lastGeneration[source] || 0
      const cooldown = this.generationCooldowns[source] || 60000

      if (now - lastGen >= cooldown) {
        this.tryGenerateFromSource(source)
      }
    }
  }

  /**
   * Try to generate opportunity from specific source
   */
  tryGenerateFromSource(source) {
    let opportunity = null

    switch (source) {
      case GENERATION_SOURCES.NPC_NEED:
        opportunity = this.generateFromNpcNeed()
        break
      case GENERATION_SOURCES.TERRITORY_CONFLICT:
        opportunity = this.generateFromTerritoryState()
        break
      case GENERATION_SOURCES.REPUTATION:
        opportunity = this.generateFromReputation()
        break
      case GENERATION_SOURCES.RANDOM:
        if (Math.random() < 0.3) {  // 30% chance
          opportunity = this.generateRandom()
        }
        break
    }

    if (opportunity) {
      this.lastGeneration[source] = Date.now()
    }

    return opportunity
  }

  /**
   * Generate from NPC need
   */
  generateFromNpcNeed() {
    // Pick a random NPC
    const npcIds = Object.keys(NPC_NEEDS)
    const npcId = npcIds[Math.floor(Math.random() * npcIds.length)]
    const npc = NPC_NEEDS[npcId]

    // Check reputation with this NPC
    const rep = reputationPropagator.getReputation(npcId)
    if (rep.known && rep.overall < -30) {
      // Bad rep, they won't offer work
      return null
    }

    // Pick a need
    const need = npc.needs[Math.floor(Math.random() * npc.needs.length)]

    // Map need to category
    const categoryMap = {
      muscle: OPPORTUNITY_CATEGORIES.PROTECTION,
      theft: OPPORTUNITY_CATEGORIES.THEFT,
      information: OPPORTUNITY_CATEGORIES.INFORMATION,
      smuggling: OPPORTUNITY_CATEGORIES.SMUGGLING,
      heist: OPPORTUNITY_CATEGORIES.HEIST,
      collection: OPPORTUNITY_CATEGORIES.PROTECTION,
      hacking: OPPORTUNITY_CATEGORIES.INFORMATION,
      surveillance: OPPORTUNITY_CATEGORIES.INFORMATION,
      courier: OPPORTUNITY_CATEGORIES.SMUGGLING,
      wetwork: OPPORTUNITY_CATEGORIES.REVENGE,
      corporate_espionage: OPPORTUNITY_CATEGORIES.INFORMATION,
      blackmail: OPPORTUNITY_CATEGORIES.INFORMATION,
      sabotage: OPPORTUNITY_CATEGORIES.HEIST,
      car_theft: OPPORTUNITY_CATEGORIES.THEFT,
      racing: OPPORTUNITY_CATEGORIES.THEFT,
      chop_shop: OPPORTUNITY_CATEGORIES.THEFT,
    }

    const category = categoryMap[need] || OPPORTUNITY_CATEGORIES.THEFT

    return this.createOpportunity({
      source: GENERATION_SOURCES.NPC_NEED,
      category,
      offeredBy: { id: npcId, name: npc.name },
      reason: `${npc.name} needs someone they can trust for a ${need} job`,
      payQuality: npc.payQuality,
      riskLevel: npc.riskLevel,
    })
  }

  /**
   * Generate from territory state
   */
  generateFromTerritoryState() {
    const territories = territoryManager.getAllDistricts()

    // Look for unstable or contested territories
    for (const [districtId, district] of Object.entries(territories)) {
      if (district.stability < 50 || !district.controller) {
        return this.createOpportunity({
          source: GENERATION_SOURCES.TERRITORY_CONFLICT,
          category: OPPORTUNITY_CATEGORIES.TERRITORY,
          offeredBy: { id: 'territory_system', name: 'Local Faction' },
          reason: `${district.name} is unstable - factions are looking for muscle`,
          context: { districtId, district },
          payQuality: 'good',
          riskLevel: 'high',
        })
      }
    }

    return null
  }

  /**
   * Generate from territory conflict event
   */
  generateFromTerritoryConflict(detail) {
    const { districtId, district, attacker } = detail

    return this.createOpportunity({
      source: GENERATION_SOURCES.TERRITORY_CONFLICT,
      category: OPPORTUNITY_CATEGORIES.TERRITORY,
      offeredBy: { id: 'defense_request', name: 'Your Territory' },
      reason: `Your territory in ${district.name} is under attack!`,
      urgent: true,
      context: { districtId, attacker },
      payQuality: 'none',  // Defending your own
      riskLevel: 'high',
      timeLimit: 60000,  // 1 minute to respond
    })
  }

  /**
   * Generate from reputation
   */
  generateFromReputation() {
    const overallRep = reputationPropagator.getOverallReputation()

    // High danger rep = assassination/intimidation jobs
    if (overallRep.aspects[REPUTATION_ASPECTS.DANGER] > 40) {
      return this.createOpportunity({
        source: GENERATION_SOURCES.REPUTATION,
        category: OPPORTUNITY_CATEGORIES.REVENGE,
        offeredBy: { id: 'anonymous', name: 'Unknown Caller' },
        reason: 'Your reputation precedes you. Someone needs a problem solved.',
        payQuality: 'excellent',
        riskLevel: 'extreme',
      })
    }

    // High reliability = trusted jobs
    if (overallRep.aspects[REPUTATION_ASPECTS.RELIABILITY] > 50) {
      return this.createOpportunity({
        source: GENERATION_SOURCES.REPUTATION,
        category: OPPORTUNITY_CATEGORIES.HEIST,
        offeredBy: { id: 'connected_client', name: 'Connected Client' },
        reason: 'Word is you can be trusted. This job requires discretion.',
        payQuality: 'excellent',
        riskLevel: 'medium',
      })
    }

    // High discretion = sensitive jobs
    if (overallRep.aspects[REPUTATION_ASPECTS.DISCRETION] > 50) {
      return this.createOpportunity({
        source: GENERATION_SOURCES.REPUTATION,
        category: OPPORTUNITY_CATEGORIES.INFORMATION,
        offeredBy: { id: 'insider', name: 'Corporate Insider' },
        reason: 'I hear you know how to keep your mouth shut.',
        payQuality: 'excellent',
        riskLevel: 'low',
      })
    }

    return null
  }

  /**
   * Generate from world event
   */
  generateFromWorldEvent(event) {
    const { name, effects } = event

    // Underground Market = fence opportunities
    if (name === 'Underground Market') {
      return this.createOpportunity({
        source: GENERATION_SOURCES.WORLD_EVENT,
        category: OPPORTUNITY_CATEGORIES.THEFT,
        offeredBy: { id: 'market_contact', name: 'Market Contact' },
        reason: 'The market is open. Good time to move merchandise.',
        payQuality: 'good',
        riskLevel: 'low',
        context: { event },
      })
    }

    // Police Patrol Day = lay low opportunities
    if (name === 'Police Patrol Day') {
      return this.createOpportunity({
        source: GENERATION_SOURCES.WORLD_EVENT,
        category: OPPORTUNITY_CATEGORIES.INFORMATION,
        offeredBy: { id: 'careful_client', name: 'Careful Client' },
        reason: 'Heat is up. Need someone for quiet surveillance work.',
        payQuality: 'medium',
        riskLevel: 'low',
        context: { event },
      })
    }

    // Street Racing = car opportunities
    if (name === 'Street Racing') {
      return this.createOpportunity({
        source: GENERATION_SOURCES.WORLD_EVENT,
        category: OPPORTUNITY_CATEGORIES.THEFT,
        offeredBy: { id: 'race_organizer', name: 'Race Organizer' },
        reason: 'Race night. Buyers are looking for specific models.',
        payQuality: 'good',
        riskLevel: 'medium',
        context: { event },
      })
    }

    return null
  }

  /**
   * Generate random opportunity
   */
  generateRandom() {
    const categories = Object.values(OPPORTUNITY_CATEGORIES)
    const category = categories[Math.floor(Math.random() * categories.length)]

    const npcIds = Object.keys(NPC_NEEDS)
    const npcId = npcIds[Math.floor(Math.random() * npcIds.length)]
    const npc = NPC_NEEDS[npcId]

    return this.createOpportunity({
      source: GENERATION_SOURCES.RANDOM,
      category,
      offeredBy: { id: npcId, name: npc.name },
      reason: `${npc.name} has a job that needs doing`,
      payQuality: npc.payQuality,
      riskLevel: npc.riskLevel,
    })
  }

  /**
   * Create a full opportunity object
   */
  createOpportunity(config) {
    const {
      source,
      category,
      offeredBy,
      reason,
      payQuality = 'medium',
      riskLevel = 'medium',
      urgent = false,
      context = {},
      timeLimit = null,
    } = config

    // Get template for category
    const templates = OPPORTUNITY_TEMPLATES[category] || []
    if (templates.length === 0) {
      // Fallback generic template
      templates.push({
        name: 'Generic Job',
        description: 'Standard work, nothing fancy',
        baseReward: { min: 500, max: 2000 },
        difficulty: 'medium',
        crewRequired: 0,
        timeLimit: 300000,
      })
    }

    const template = templates[Math.floor(Math.random() * templates.length)]

    // Calculate reward based on pay quality
    const payMultipliers = {
      poor: 0.5,
      medium: 1.0,
      good: 1.3,
      excellent: 1.8,
      variable: 0.5 + Math.random() * 1.5,
    }
    const payMult = payMultipliers[payQuality] || 1.0

    // Apply time modifiers
    const timeModifiers = worldClock.getModifiers()
    const timeMult = timeModifiers.crimeSuccess || 1

    const reward = Math.floor(
      (template.baseReward.min + Math.random() * (template.baseReward.max - template.baseReward.min))
      * payMult * timeMult
    )

    const opportunity = {
      id: `opp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source,
      category,
      name: template.name,
      description: template.description,
      offeredBy,
      reason,
      reward,
      difficulty: template.difficulty,
      crewRequired: template.crewRequired,
      riskLevel,
      urgent,
      context,
      createdAt: Date.now(),
      expiresAt: Date.now() + (timeLimit || template.timeLimit || 300000),
      status: 'available',
      hiddenConditions: this.generateHiddenConditions(riskLevel),
    }

    this.generatedOpportunities.push(opportunity)

    console.log(`[OpportunityGenerator] Created: ${opportunity.name} from ${source}`)

    // Emit event
    const event = new CustomEvent('opportunity_generated', { detail: opportunity })
    window.dispatchEvent(event)

    return opportunity
  }

  /**
   * Generate hidden conditions (things player doesn't know)
   */
  generateHiddenConditions(riskLevel) {
    const conditions = []

    // Higher risk = more hidden conditions
    const riskChances = {
      low: 0.1,
      medium: 0.3,
      high: 0.5,
      extreme: 0.7,
    }
    const chance = riskChances[riskLevel] || 0.3

    if (Math.random() < chance) {
      const possibleConditions = [
        { type: 'extra_security', description: 'More guards than expected' },
        { type: 'silent_alarm', description: 'Hidden alarm system' },
        { type: 'double_cross', description: 'Client might betray' },
        { type: 'rival_competition', description: 'Others are after same target' },
        { type: 'time_crunch', description: 'Window is shorter than stated' },
        { type: 'heat_magnet', description: 'Job attracts extra police attention' },
      ]

      const numConditions = Math.floor(1 + Math.random() * 2)
      for (let i = 0; i < numConditions && i < possibleConditions.length; i++) {
        const idx = Math.floor(Math.random() * possibleConditions.length)
        conditions.push(possibleConditions.splice(idx, 1)[0])
      }
    }

    return conditions
  }

  /**
   * Get available opportunities
   */
  getAvailable() {
    const now = Date.now()
    return this.generatedOpportunities.filter(o =>
      o.status === 'available' && o.expiresAt > now
    )
  }

  /**
   * Get opportunities by category
   */
  getByCategory(category) {
    return this.getAvailable().filter(o => o.category === category)
  }

  /**
   * Accept an opportunity
   */
  acceptOpportunity(opportunityId) {
    const opp = this.generatedOpportunities.find(o => o.id === opportunityId)
    if (!opp || opp.status !== 'available') {
      return { success: false, error: 'Opportunity not available' }
    }

    if (Date.now() > opp.expiresAt) {
      opp.status = 'expired'
      return { success: false, error: 'Opportunity expired' }
    }

    opp.status = 'accepted'
    opp.acceptedAt = Date.now()

    console.log(`[OpportunityGenerator] Accepted: ${opp.name}`)

    return { success: true, opportunity: opp }
  }

  /**
   * Complete an opportunity
   */
  completeOpportunity(opportunityId, success = true) {
    const opp = this.generatedOpportunities.find(o => o.id === opportunityId)
    if (!opp || opp.status !== 'accepted') {
      return { success: false, error: 'Opportunity not in progress' }
    }

    opp.status = success ? 'completed' : 'failed'
    opp.completedAt = Date.now()

    // Record reputation effect
    if (success && opp.offeredBy.id !== 'territory_system') {
      reputationPropagator.recordEvent({
        aspect: REPUTATION_ASPECTS.RELIABILITY,
        value: 10,
        witnesses: [opp.offeredBy.id],
      })
    } else if (!success) {
      reputationPropagator.recordEvent({
        aspect: REPUTATION_ASPECTS.RELIABILITY,
        value: -15,
        witnesses: [opp.offeredBy.id],
      })
    }

    console.log(`[OpportunityGenerator] ${success ? 'Completed' : 'Failed'}: ${opp.name}`)

    return { success: true, opportunity: opp }
  }

  /**
   * Get generation statistics
   */
  getStats() {
    const available = this.getAvailable()
    return {
      totalGenerated: this.generatedOpportunities.length,
      available: available.length,
      bySource: this.generatedOpportunities.reduce((acc, o) => {
        acc[o.source] = (acc[o.source] || 0) + 1
        return acc
      }, {}),
      byCategory: available.reduce((acc, o) => {
        acc[o.category] = (acc[o.category] || 0) + 1
        return acc
      }, {}),
    }
  }

  /**
   * Force generate for testing
   */
  forceGenerate(source = GENERATION_SOURCES.RANDOM) {
    return this.tryGenerateFromSource(source)
  }
}

// Export singleton
export const opportunityGenerator = new OpportunityGeneratorClass()
export default opportunityGenerator
