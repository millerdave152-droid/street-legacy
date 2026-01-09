// Street Legacy - Player Actions Service
// Handles all gameplay actions via Express API

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API_URL = `${BASE_URL}/api`

// Get auth token from localStorage
function getAuthToken() {
  try {
    const authData = localStorage.getItem('auth-storage')
    if (authData) {
      const parsed = JSON.parse(authData)
      return parsed?.state?.token || null
    }
  } catch (e) {
    console.error('Failed to get auth token:', e)
  }
  return null
}

// API request helper
async function apiRequest(endpoint, method = 'GET', data = null) {
  const token = getAuthToken()

  if (!token) {
    throw new Error('Not authenticated')
  }

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data)
  }

  const response = await fetch(`${API_URL}${endpoint}`, options)
  const result = await response.json()

  if (!response.ok || !result.success) {
    throw new Error(result.error || `Request failed: ${response.status}`)
  }

  return result.data || result
}

class PlayerService {
  // ==========================================================================
  // GAME STATE
  // ==========================================================================

  async getGameState() {
    const result = await apiRequest('/game/state')

    // Extract data from response (handles both direct and wrapped responses)
    const data = result.data || result

    return {
      player: data.player,
      currentDistrict: data.currentDistrict || data.district,
      districts: data.districts || [],
      cooldowns: data.cooldowns || {},
      crimes: data.crimes || [],
      jobs: data.jobs || []
    }
  }

  async getStats() {
    return apiRequest('/game/stats')
  }

  // ==========================================================================
  // CRIMES
  // ==========================================================================

  async getAvailableCrimes() {
    try {
      // Try dedicated crimes endpoint first
      const result = await apiRequest('/game/crimes')
      if (result.crimes && result.crimes.length > 0) {
        return result.crimes
      }
    } catch (e) {
      // Endpoint doesn't exist, fall through
    }

    // Fall back to getting crimes from game state
    try {
      const gameState = await this.getGameState()
      if (gameState.crimes && gameState.crimes.length > 0) {
        return gameState.crimes
      }
    } catch (e) {
      console.error('Failed to get crimes from game state:', e)
    }

    // Return default crimes as last fallback
    return this.getDefaultCrimes()
  }

  getDefaultCrimes() {
    return [
      { id: 'pickpocket', name: 'Pickpocket', description: 'Lift wallets from unsuspecting tourists', min_level: 1, energy_cost: 5, base_success_rate: 85, min_payout: 50, max_payout: 150 },
      { id: 'shoplift', name: 'Shoplifting', description: 'Five finger discount at local stores', min_level: 1, energy_cost: 5, base_success_rate: 80, min_payout: 75, max_payout: 200 },
      { id: 'car_break_in', name: 'Car Break-in', description: 'Smash and grab from parked vehicles', min_level: 2, energy_cost: 10, base_success_rate: 75, min_payout: 100, max_payout: 350 },
      { id: 'mugging', name: 'Mugging', description: 'Rob pedestrians in dark alleys', min_level: 3, energy_cost: 15, base_success_rate: 70, min_payout: 200, max_payout: 500 },
      { id: 'drug_deal', name: 'Drug Deal', description: 'Move product on street corners', min_level: 5, energy_cost: 15, base_success_rate: 65, min_payout: 300, max_payout: 800 },
      { id: 'car_theft', name: 'Car Theft', description: 'Steal vehicles for the chop shop', min_level: 7, energy_cost: 20, base_success_rate: 60, min_payout: 500, max_payout: 1500 },
    ]
  }

  /**
   * Commit a crime
   * @param {string|number} crimeTypeId - Crime ID to commit
   * @param {Object} options - Additional options
   * @param {Object} options.miniGameResult - Mini-game result for bonus validation
   * @param {Object} options.offlineSubmission - Offline submission data for sync
   */
  async commitCrime(crimeTypeId, options = {}) {
    const body = { crimeId: crimeTypeId }

    // Add mini-game result if provided
    if (options.miniGameResult) {
      body.miniGameResult = options.miniGameResult
    }

    // Add offline submission if provided
    if (options.offlineSubmission) {
      body.offlineSubmission = options.offlineSubmission
    }

    return apiRequest('/game/crime', 'POST', body)
  }

  // ==========================================================================
  // JOBS
  // ==========================================================================

  async getAvailableJobs() {
    try {
      // Try dedicated jobs endpoint first
      const result = await apiRequest('/jobs')
      if (result.jobs && result.jobs.length > 0) {
        return result.jobs
      }
      if (result.data?.jobs && result.data.jobs.length > 0) {
        return result.data.jobs
      }
    } catch (e) {
      // Endpoint doesn't exist or failed, fall through
    }

    // Return default jobs as fallback
    return this.getDefaultJobs()
  }

  getDefaultJobs() {
    return [
      { id: 'dishwasher', name: 'Dishwasher', description: 'Wash dishes at a local restaurant', min_level: 1, energy_cost: 10, payout: 25, xp_reward: 5 },
      { id: 'delivery', name: 'Delivery Driver', description: 'Deliver packages around the city', min_level: 1, energy_cost: 15, payout: 40, xp_reward: 8 },
      { id: 'bouncer', name: 'Club Bouncer', description: 'Keep the peace at nightclubs', min_level: 3, energy_cost: 20, payout: 60, xp_reward: 12 },
      { id: 'mechanic', name: 'Mechanic', description: 'Fix cars at the auto shop', min_level: 5, energy_cost: 20, payout: 80, xp_reward: 15 },
      { id: 'bartender', name: 'Bartender', description: 'Serve drinks and hear secrets', min_level: 4, energy_cost: 15, payout: 70, xp_reward: 12 },
      { id: 'security', name: 'Security Guard', description: 'Watch over businesses', min_level: 7, energy_cost: 25, payout: 90, xp_reward: 18 },
    ]
  }

  async workJob(jobTypeId) {
    return apiRequest('/jobs/work', 'POST', { jobId: jobTypeId })
  }

  async getJobHistory(limit = 20, offset = 0) {
    const result = await apiRequest(`/jobs/history?limit=${limit}&offset=${offset}`)
    return result.data || result
  }

  async getJobStats() {
    const result = await apiRequest('/jobs/stats')
    return result.data || result
  }

  // ==========================================================================
  // HEISTS (Server-Authoritative)
  // ==========================================================================

  /**
   * Get heist planning configuration from server
   */
  async getHeistConfig() {
    return apiRequest('/ops/heist/config')
  }

  /**
   * Get current planning session for a heist
   * @param {string} heistId - Heist ID
   */
  async getHeistPlanning(heistId) {
    return apiRequest(`/ops/heist/planning/${heistId}`)
  }

  /**
   * Start a new planning session for a heist
   * @param {string} heistId - Heist ID to plan
   */
  async startHeistPlanning(heistId) {
    return apiRequest('/ops/heist/start-planning', 'POST', { heistId })
  }

  /**
   * Perform a planning activity (costs energy/cash, grants bonuses)
   * @param {string} heistId - Heist ID
   * @param {string} activityId - Activity ID to perform
   */
  async performHeistActivity(heistId, activityId) {
    return apiRequest('/ops/heist/activity', 'POST', { heistId, activityId })
  }

  /**
   * Execute a heist (server-side roll with planning bonuses)
   * @param {string} heistId - Heist ID to execute
   * @param {Object} options - Additional options
   * @param {Object} options.offlineSubmission - Offline submission data for sync
   */
  async executeHeist(heistId, options = {}) {
    const body = { heistId }

    if (options.offlineSubmission) {
      body.offlineSubmission = options.offlineSubmission
    }

    return apiRequest('/ops/heist/execute', 'POST', body)
  }

  /**
   * Cancel a planning session
   * @param {string} heistId - Heist ID to cancel planning for
   */
  async cancelHeistPlanning(heistId) {
    return apiRequest(`/ops/heist/cancel/${heistId}`, 'POST')
  }

  // ==========================================================================
  // TRAVEL & LOCATION
  // ==========================================================================

  async travel(districtId) {
    return apiRequest('/game/travel', 'POST', { districtId })
  }

  async getDistricts() {
    const result = await apiRequest('/game/districts')
    return result.districts || result || []
  }

  async getCurrentDistrict() {
    const result = await apiRequest('/game/current-district')
    return result.district || result
  }

  // ==========================================================================
  // BANKING
  // ==========================================================================

  async bankDeposit(amount) {
    return apiRequest('/game/bank/deposit', 'POST', { amount })
  }

  async bankWithdraw(amount) {
    return apiRequest('/game/bank/withdraw', 'POST', { amount })
  }

  // ==========================================================================
  // PROPERTIES
  // ==========================================================================

  async getAllProperties() {
    const result = await apiRequest('/game/properties')
    return result.properties || result || []
  }

  async getMyProperties() {
    const result = await apiRequest('/game/my-properties')
    return result.properties || result || []
  }

  async getOwnedProperties() {
    const result = await apiRequest('/game/owned-properties')
    return result.properties || result || []
  }

  /**
   * Purchase a property
   * @param {string} propertyId - Property ID
   * @param {Object} options - Additional options
   * @param {Object} options.offlineSubmission - Offline submission data
   */
  async purchaseProperty(propertyId, options = {}) {
    const body = { propertyId }
    if (options.offlineSubmission) {
      body.offlineSubmission = options.offlineSubmission
    }
    return apiRequest('/game/property/buy', 'POST', body)
  }

  /**
   * Sell a property
   * @param {string} propertyId - Property ID
   * @param {Object} options - Additional options
   * @param {Object} options.offlineSubmission - Offline submission data
   */
  async sellProperty(propertyId, options = {}) {
    const body = { propertyId }
    if (options.offlineSubmission) {
      body.offlineSubmission = options.offlineSubmission
    }
    return apiRequest('/game/property/sell', 'POST', body)
  }

  /**
   * Collect income from a property
   * @param {string} propertyId - Property ID
   * @param {Object} options - Additional options
   * @param {Object} options.offlineSubmission - Offline submission data
   */
  async collectPropertyIncome(propertyId, options = {}) {
    const body = { propertyId }
    if (options.offlineSubmission) {
      body.offlineSubmission = options.offlineSubmission
    }
    return apiRequest('/game/property/collect', 'POST', body)
  }

  /**
   * Collect all property income
   * @param {Object} options - Additional options
   * @param {Object} options.offlineSubmission - Offline submission data
   */
  async collectAllPropertyIncome(options = {}) {
    const body = {}
    if (options.offlineSubmission) {
      body.offlineSubmission = options.offlineSubmission
    }
    return apiRequest('/game/property/collect-all', 'POST', body)
  }

  /**
   * Upgrade a property
   * @param {string} propertyId - Property ID
   * @param {Object} options - Additional options
   * @param {Object} options.offlineSubmission - Offline submission data
   */
  async upgradeProperty(propertyId, options = {}) {
    const body = { propertyId }
    if (options.offlineSubmission) {
      body.offlineSubmission = options.offlineSubmission
    }
    return apiRequest('/game/property/upgrade', 'POST', body)
  }

  async getTotalPropertyIncome() {
    const result = await apiRequest('/game/property-income')
    return result.total_income || 0
  }

  // ==========================================================================
  // BUSINESSES
  // ==========================================================================

  async getMyBusinesses() {
    const result = await apiRequest('/game/my-businesses')
    return result.businesses || result || []
  }

  async purchaseBusiness(businessId) {
    return apiRequest('/game/business/buy', 'POST', { businessId })
  }

  async collectBusinessIncome(businessId) {
    return apiRequest('/game/business/collect', 'POST', { businessId })
  }

  // ==========================================================================
  // INVENTORY
  // ==========================================================================

  async getInventory() {
    const result = await apiRequest('/game/inventory')
    return result.inventory || result || []
  }

  async useItem(inventoryId) {
    return apiRequest('/game/item/use', 'POST', { inventoryId })
  }

  // ==========================================================================
  // JAIL
  // ==========================================================================

  async getJailStatus() {
    return apiRequest('/game/jail-status')
  }

  async attemptJailbreak() {
    return apiRequest('/game/jailbreak', 'POST')
  }

  async payBail() {
    return apiRequest('/game/bail', 'POST')
  }

  // ==========================================================================
  // NPC CREW MEMBERS
  // ==========================================================================

  async getAvailableCrewMembers() {
    const result = await apiRequest('/game/crew/available')
    return result.crew_members || result || []
  }

  async getPlayerCrewMembers() {
    const result = await apiRequest('/game/crew/mine')
    return result.crew_members || result || []
  }

  async hireCrewMember(memberId) {
    return apiRequest('/game/crew/hire', 'POST', { memberId })
  }

  async fireCrewMember(memberId) {
    return apiRequest('/game/crew/fire', 'POST', { memberId })
  }

  async getCrewBonuses() {
    const result = await apiRequest('/game/crew/bonuses')
    return result.bonuses || { violence: 0, cooldown: 0, escape: 0, heat: 0 }
  }

  async getCrewSlots() {
    return apiRequest('/game/crew/slots')
  }

  // ==========================================================================
  // LEADERBOARDS
  // ==========================================================================

  async getLeaderboard(category = 'respect', limit = 50) {
    return apiRequest(`/game/leaderboard?category=${category}&limit=${limit}`)
  }

  async getWeeklyLeaderboard(category = 'cash', limit = 50) {
    return apiRequest(`/api/leaderboard/weekly/${category}?limit=${limit}`)
  }

  async getPlayerRank(category = 'respect') {
    return apiRequest(`/game/rank?category=${category}`)
  }

  // ==========================================================================
  // ACHIEVEMENTS
  // ==========================================================================

  async getAchievements() {
    return apiRequest('/game/achievements')
  }

  async getPlayerAchievements() {
    const result = await apiRequest('/game/my-achievements')
    return result.achievements || result || []
  }

  async getAchievementStats() {
    return apiRequest('/game/achievement-stats')
  }

  async claimAchievement(achievementId) {
    return apiRequest('/game/achievement/claim', 'POST', { achievementId })
  }

  async getUnclaimedCount() {
    const result = await apiRequest('/game/achievements/unclaimed')
    return result.count || 0
  }

  async checkAchievements() {
    return apiRequest('/game/achievements/check', 'POST')
  }

  async unlockAchievement(achievementId) {
    return apiRequest('/game/achievement/unlock', 'POST', { achievementId })
  }

  // ==========================================================================
  // HEISTS
  // ==========================================================================

  async getHeists() {
    const result = await apiRequest('/heists')
    return result
  }

  async startHeist(heistId) {
    return apiRequest('/heists/start', 'POST', { heistId })
  }

  async joinHeist(activeHeistId) {
    return apiRequest(`/heists/${activeHeistId}/join`, 'POST')
  }

  async leaveHeist(activeHeistId) {
    return apiRequest(`/heists/${activeHeistId}/leave`, 'POST')
  }

  async selectHeistRole(activeHeistId, roleId) {
    return apiRequest(`/heists/${activeHeistId}/role`, 'POST', { roleId })
  }

  async readyHeist(activeHeistId) {
    return apiRequest(`/heists/${activeHeistId}/ready`, 'POST')
  }

  async executeHeist(activeHeistId) {
    return apiRequest(`/heists/${activeHeistId}/execute`, 'POST')
  }

  async cancelHeist(activeHeistId) {
    return apiRequest(`/heists/${activeHeistId}/cancel`, 'POST')
  }

  // ==========================================================================
  // TRADING
  // ==========================================================================

  async getPendingTrades() {
    const result = await apiRequest('/trade/pending')
    return result.trades || []
  }

  async getTradeHistory(limit = 20, offset = 0) {
    const result = await apiRequest(`/trade/history?limit=${limit}&offset=${offset}`)
    return result.history || []
  }

  async createTrade(targetPlayerId, { offeringItems = [], requestingItems = [], offeringCash = 0, requestingCash = 0 }) {
    return apiRequest('/trade/create', 'POST', {
      targetPlayerId,
      offeringItems,
      requestingItems,
      offeringCash,
      requestingCash
    })
  }

  async acceptTrade(tradeId) {
    return apiRequest('/trade/accept', 'POST', { tradeId })
  }

  async declineTrade(tradeId) {
    return apiRequest('/trade/decline', 'POST', { tradeId })
  }

  async cancelTrade(tradeId) {
    return apiRequest('/trade/cancel', 'POST', { tradeId })
  }

  async getNearbyPlayers() {
    const result = await apiRequest('/game/nearby-players')
    return result.players || []
  }

  // ==========================================================================
  // EVENTS
  // ==========================================================================

  async getActiveEvents() {
    const result = await apiRequest('/game/events/active')
    return result.events || result || []
  }

  async getAvailableEvents() {
    const result = await apiRequest('/game/events/available')
    return result.events || result || []
  }

  async respondToEvent(eventId, choice) {
    return apiRequest('/game/event/respond', 'POST', { eventId, choice })
  }

  async dismissEvent(eventId) {
    return apiRequest('/game/event/dismiss', 'POST', { eventId })
  }

  async checkForEvents() {
    return apiRequest('/game/events/check', 'POST')
  }

  async getEventHistory(limit = 20) {
    const result = await apiRequest(`/game/events/history?limit=${limit}`)
    return result.events || result || []
  }

  // ==========================================================================
  // PLAYER DATA UPDATES
  // ==========================================================================

  async updatePlayer(data) {
    return apiRequest('/game/player/update', 'POST', data)
  }

  async addCash(amount) {
    return apiRequest('/game/player/add-cash', 'POST', { amount })
  }

  async addRespect(amount) {
    return apiRequest('/game/player/add-respect', 'POST', { amount })
  }
}

// Export singleton instance
export const playerService = new PlayerService()
export default playerService
