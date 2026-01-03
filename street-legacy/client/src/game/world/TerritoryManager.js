/**
 * TerritoryManager - Phase 21: Territory and Influence Dynamics
 *
 * Districts have owners, conflicts, and opportunities.
 *
 * Each district has:
 * - Controller (NPC gang or player)
 * - Heat level (police presence)
 * - Prosperity (money flow)
 * - Stability (conflict chance)
 *
 * Territory wars generate opportunities
 */

const STORAGE_KEY = 'world_territories'

// Districts in the game
export const DISTRICTS = {
  DOWNTOWN: 'downtown',
  PARKDALE: 'parkdale',
  SCARBOROUGH: 'scarborough',
  YORKVILLE: 'yorkville',
  KENSINGTON: 'kensington',
  INDUSTRIAL: 'industrial',
  WATERFRONT: 'waterfront',
}

// Default district configurations
const DEFAULT_DISTRICTS = {
  [DISTRICTS.DOWNTOWN]: {
    name: 'Downtown',
    controller: 'corporate_syndicate',
    controllerName: 'Corporate Syndicate',
    heat: 60,
    prosperity: 90,
    stability: 80,
    crimeTypes: ['fraud', 'hacking', 'heist'],
    baseRewards: 1.5,
    policeResponse: 'fast',
  },
  [DISTRICTS.PARKDALE]: {
    name: 'Parkdale',
    controller: null,  // Contested
    controllerName: 'Contested',
    heat: 40,
    prosperity: 50,
    stability: 40,
    crimeTypes: ['burglary', 'mugging', 'carTheft'],
    baseRewards: 1.0,
    policeResponse: 'medium',
  },
  [DISTRICTS.SCARBOROUGH]: {
    name: 'Scarborough',
    controller: 'eastside_crew',
    controllerName: 'Eastside Crew',
    heat: 35,
    prosperity: 45,
    stability: 60,
    crimeTypes: ['carTheft', 'fencing', 'drugs'],
    baseRewards: 0.9,
    policeResponse: 'slow',
  },
  [DISTRICTS.YORKVILLE]: {
    name: 'Yorkville',
    controller: 'old_money',
    controllerName: 'Old Money Families',
    heat: 50,
    prosperity: 95,
    stability: 90,
    crimeTypes: ['burglary', 'identityTheft', 'fraud'],
    baseRewards: 1.8,
    policeResponse: 'fast',
  },
  [DISTRICTS.KENSINGTON]: {
    name: 'Kensington Market',
    controller: null,  // Neutral ground
    controllerName: 'Neutral',
    heat: 25,
    prosperity: 40,
    stability: 70,
    crimeTypes: ['pickpocket', 'shoplifting', 'fencing'],
    baseRewards: 0.7,
    policeResponse: 'medium',
  },
  [DISTRICTS.INDUSTRIAL]: {
    name: 'Industrial District',
    controller: 'dockworkers_union',
    controllerName: "Dockworkers' Union",
    heat: 30,
    prosperity: 55,
    stability: 75,
    crimeTypes: ['theft', 'smuggling', 'fencing'],
    baseRewards: 1.1,
    policeResponse: 'slow',
  },
  [DISTRICTS.WATERFRONT]: {
    name: 'Waterfront',
    controller: 'import_export_gang',
    controllerName: 'Import/Export Gang',
    heat: 45,
    prosperity: 70,
    stability: 55,
    crimeTypes: ['smuggling', 'heist', 'theft'],
    baseRewards: 1.3,
    policeResponse: 'medium',
  },
}

// Territory war states
export const WAR_STATES = {
  PEACE: 'peace',
  TENSION: 'tension',
  CONFLICT: 'conflict',
  WAR: 'war',
  OCCUPATION: 'occupation',
}

/**
 * TerritoryManager class
 */
class TerritoryManagerClass {
  constructor() {
    this.districts = this.load()
    this.activeConflicts = []
    this.playerTerritory = []
    this.intervalId = null
  }

  /**
   * Initialize territory system
   */
  initialize() {
    // Update territories periodically
    this.intervalId = setInterval(() => {
      this.update()
    }, 60000)  // Every minute

    console.log('[TerritoryManager] Initialized')
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
   * Get district info
   */
  getDistrict(districtId) {
    return this.districts[districtId] || null
  }

  /**
   * Get all districts
   */
  getAllDistricts() {
    return { ...this.districts }
  }

  /**
   * Get districts controlled by a specific entity
   */
  getControlledBy(controllerId) {
    return Object.entries(this.districts)
      .filter(([, d]) => d.controller === controllerId)
      .map(([id]) => id)
  }

  /**
   * Get player's territories
   */
  getPlayerTerritories() {
    return this.getControlledBy('player')
  }

  /**
   * Check if player controls a district
   */
  playerControls(districtId) {
    const district = this.districts[districtId]
    return district && district.controller === 'player'
  }

  /**
   * Get territory modifiers for a district
   */
  getDistrictModifiers(districtId) {
    const district = this.districts[districtId]
    if (!district) return {}

    return {
      rewardMultiplier: district.baseRewards * (district.prosperity / 100),
      heatGainModifier: 1 + (district.heat / 100),
      successModifier: district.stability / 100,
      policeResponse: district.policeResponse,
    }
  }

  /**
   * Claim a territory (player attempts to take control)
   */
  claimTerritory(districtId, crewStrength = 1) {
    const district = this.districts[districtId]
    if (!district) return { success: false, error: 'District not found' }

    // Can only claim contested or weakly held territories
    if (district.controller && district.stability > 50) {
      return {
        success: false,
        error: `${district.controllerName} holds this territory firmly`,
      }
    }

    // Calculate success chance
    const baseChance = 0.3
    const stabilityBonus = (100 - district.stability) / 200
    const crewBonus = crewStrength * 0.1
    const successChance = Math.min(0.8, baseChance + stabilityBonus + crewBonus)

    if (Math.random() < successChance) {
      // Success
      const previousController = district.controller
      district.controller = 'player'
      district.controllerName = 'You'
      district.stability = 30  // Starts unstable

      this.playerTerritory.push(districtId)
      this.save()

      console.log(`[TerritoryManager] Player claimed ${district.name}`)

      // Emit event
      const event = new CustomEvent('territory_claimed', {
        detail: { districtId, district, previousController },
      })
      window.dispatchEvent(event)

      return {
        success: true,
        message: `You now control ${district.name}`,
        district,
      }
    } else {
      // Failed
      district.heat += 20
      this.save()

      return {
        success: false,
        error: 'The claim failed. Heat increased.',
        heatGained: 20,
      }
    }
  }

  /**
   * Defend a territory (when challenged)
   */
  defendTerritory(districtId, defenseStrength = 1) {
    const district = this.districts[districtId]
    if (!district || district.controller !== 'player') {
      return { success: false, error: 'Not your territory' }
    }

    // Defense is easier than claiming
    const successChance = 0.5 + (district.stability / 200) + (defenseStrength * 0.1)

    if (Math.random() < successChance) {
      district.stability = Math.min(100, district.stability + 10)
      this.save()

      return { success: true, message: 'Defense successful', stabilityGained: 10 }
    } else {
      // Lost territory
      district.controller = 'rival_gang'
      district.controllerName = 'Rival Gang'
      district.stability = 50

      const index = this.playerTerritory.indexOf(districtId)
      if (index !== -1) this.playerTerritory.splice(index, 1)

      this.save()

      const event = new CustomEvent('territory_lost', {
        detail: { districtId, district },
      })
      window.dispatchEvent(event)

      return { success: false, message: 'Territory lost to rivals' }
    }
  }

  /**
   * Update - check for conflicts, stability changes
   */
  update() {
    for (const [districtId, district] of Object.entries(this.districts)) {
      // Contested territories destabilize
      if (!district.controller) {
        district.stability = Math.max(20, district.stability - 1)
      }

      // Player territories need maintenance
      if (district.controller === 'player') {
        district.stability = Math.max(20, district.stability - 0.5)

        // Low stability = risk of attack
        if (district.stability < 30 && Math.random() < 0.1) {
          this.triggerAttack(districtId)
        }
      }

      // Heat naturally decays
      district.heat = Math.max(0, district.heat - 0.5)
    }

    this.save()
  }

  /**
   * Trigger an attack on player territory
   */
  triggerAttack(districtId) {
    const district = this.districts[districtId]
    if (!district) return

    console.log(`[TerritoryManager] Attack on ${district.name}!`)

    const event = new CustomEvent('territory_attack', {
      detail: {
        districtId,
        district,
        attacker: 'rival_gang',
      },
    })
    window.dispatchEvent(event)
  }

  /**
   * Start a territory war
   */
  startConflict(districtId, attackerId, defenderId) {
    const conflict = {
      id: `conflict_${Date.now()}`,
      districtId,
      attacker: attackerId,
      defender: defenderId,
      state: WAR_STATES.CONFLICT,
      startedAt: Date.now(),
      battles: 0,
    }

    this.activeConflicts.push(conflict)

    const event = new CustomEvent('territory_war_start', { detail: conflict })
    window.dispatchEvent(event)

    return conflict
  }

  /**
   * Get income from player territories
   */
  getPassiveIncome() {
    let income = 0
    for (const districtId of this.playerTerritory) {
      const district = this.districts[districtId]
      if (district) {
        income += (district.prosperity / 100) * 100 * (district.stability / 100)
      }
    }
    return Math.floor(income)
  }

  /**
   * Get territory summary
   */
  getSummary() {
    return {
      playerTerritories: this.playerTerritory.length,
      totalDistricts: Object.keys(this.districts).length,
      passiveIncome: this.getPassiveIncome(),
      activeConflicts: this.activeConflicts.length,
      territories: Object.entries(this.districts).map(([id, d]) => ({
        id,
        name: d.name,
        controller: d.controllerName,
        isPlayer: d.controller === 'player',
        stability: d.stability,
        prosperity: d.prosperity,
      })),
    }
  }

  /**
   * Save to localStorage
   */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        districts: this.districts,
        playerTerritory: this.playerTerritory,
        activeConflicts: this.activeConflicts,
      }))
    } catch (e) {
      console.warn('[TerritoryManager] Failed to save:', e)
    }
  }

  /**
   * Load from localStorage
   */
  load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        this.playerTerritory = data.playerTerritory || []
        this.activeConflicts = data.activeConflicts || []
        return { ...DEFAULT_DISTRICTS, ...data.districts }
      }
    } catch (e) {
      console.warn('[TerritoryManager] Failed to load:', e)
    }
    return { ...DEFAULT_DISTRICTS }
  }

  /**
   * Reset territories
   */
  reset() {
    this.districts = { ...DEFAULT_DISTRICTS }
    this.playerTerritory = []
    this.activeConflicts = []
    localStorage.removeItem(STORAGE_KEY)
  }
}

// Export singleton
export const territoryManager = new TerritoryManagerClass()
export default territoryManager
