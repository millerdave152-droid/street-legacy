// Street Legacy - Admin Service
// Handles admin API calls for player management

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

class AdminService {
  // ==========================================================================
  // PLAYER CURRENCY/STAT ADJUSTMENTS
  // ==========================================================================

  /**
   * Adjust a player's currency or stat
   * @param {string} playerId - Target player ID
   * @param {string} field - Field to adjust (cash, bank_balance, energy, health, heat, xp, level, respect)
   * @param {number} value - New value or amount to add
   * @param {string} reason - Reason for adjustment
   */
  async adjustPlayerCurrency(playerId, field, value, reason = 'Admin adjustment') {
    return apiRequest('/admin/adjust-currency', 'POST', {
      playerId,
      field,
      value,
      reason
    })
  }

  /**
   * Set player's cash to exact amount
   */
  async setCash(playerId, amount, reason = 'Admin set cash') {
    return this.adjustPlayerCurrency(playerId, 'cash', amount, reason)
  }

  /**
   * Set player's bank balance
   */
  async setBank(playerId, amount, reason = 'Admin set bank') {
    return this.adjustPlayerCurrency(playerId, 'bank_balance', amount, reason)
  }

  /**
   * Set player's energy
   */
  async setEnergy(playerId, amount, reason = 'Admin set energy') {
    return this.adjustPlayerCurrency(playerId, 'energy', amount, reason)
  }

  /**
   * Set player's health
   */
  async setHealth(playerId, amount, reason = 'Admin set health') {
    return this.adjustPlayerCurrency(playerId, 'health', amount, reason)
  }

  /**
   * Set player's heat
   */
  async setHeat(playerId, amount, reason = 'Admin set heat') {
    return this.adjustPlayerCurrency(playerId, 'heat', amount, reason)
  }

  /**
   * Set player's XP
   */
  async addXP(playerId, amount, reason = 'Admin add XP') {
    return this.adjustPlayerCurrency(playerId, 'xp', amount, reason)
  }

  /**
   * Set player's level
   */
  async setLevel(playerId, level, reason = 'Admin set level') {
    return this.adjustPlayerCurrency(playerId, 'level', level, reason)
  }

  /**
   * Add respect to player
   */
  async addRespect(playerId, amount, reason = 'Admin add respect') {
    return this.adjustPlayerCurrency(playerId, 'respect', amount, reason)
  }

  // ==========================================================================
  // PLAYER MANAGEMENT
  // ==========================================================================

  /**
   * Reset all player stats to defaults
   */
  async resetPlayerStats(playerId) {
    return apiRequest('/admin/reset-player', 'POST', { playerId })
  }

  /**
   * Ban a player
   */
  async banPlayer(playerId, reason = 'Banned by admin', duration = null) {
    return apiRequest('/admin/ban', 'POST', { playerId, reason, duration })
  }

  /**
   * Unban a player
   */
  async unbanPlayer(playerId) {
    return apiRequest('/admin/unban', 'POST', { playerId })
  }

  /**
   * Get player info for admin view
   */
  async getPlayerInfo(playerId) {
    return apiRequest(`/admin/player/${playerId}`)
  }

  /**
   * Search players
   */
  async searchPlayers(query, limit = 20) {
    return apiRequest(`/admin/players/search?q=${encodeURIComponent(query)}&limit=${limit}`)
  }

  // ==========================================================================
  // GAME MANAGEMENT
  // ==========================================================================

  /**
   * Get server stats
   */
  async getServerStats() {
    return apiRequest('/admin/stats')
  }

  /**
   * Get active players count
   */
  async getActivePlayers() {
    return apiRequest('/admin/active-players')
  }

  /**
   * Send server announcement
   */
  async sendAnnouncement(message, type = 'info') {
    return apiRequest('/admin/announce', 'POST', { message, type })
  }

  /**
   * Trigger server event
   */
  async triggerEvent(eventType, options = {}) {
    return apiRequest('/admin/trigger-event', 'POST', { eventType, ...options })
  }
}

// Export singleton instance
export const adminService = new AdminService()
export default adminService
