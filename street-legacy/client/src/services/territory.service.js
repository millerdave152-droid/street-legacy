// Street Legacy - Territory & Contracts Service
// Handles territory investments and heist contracts via Express API

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
    return { success: false, error: 'Not authenticated' }
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

  try {
    const response = await fetch(`${API_URL}${endpoint}`, options)
    const result = await response.json()

    if (!response.ok) {
      return { success: false, error: result.error || `Request failed: ${response.status}` }
    }

    return result
  } catch (error) {
    console.error('Territory API error:', error)
    return { success: false, error: error.message }
  }
}

class TerritoryService {
  // ==========================================================================
  // TERRITORY INVESTMENTS
  // ==========================================================================

  /**
   * Make an investment in a district
   */
  async invest(districtId, investmentType, amount) {
    return apiRequest('/territory/invest', 'POST', {
      districtId,
      investmentType,
      amount
    })
  }

  /**
   * Get investments for a specific district
   */
  async getDistrictInvestments(districtId) {
    return apiRequest(`/territory/investments/${districtId}`)
  }

  /**
   * Get player's crew investments across all districts
   */
  async getMyInvestments() {
    return apiRequest('/territory/investments/my/all')
  }

  /**
   * Get investor leaderboard for a district
   */
  async getInvestorLeaderboard(districtId, limit = 10) {
    return apiRequest(`/territory/investments/leaderboard/${districtId}?limit=${limit}`)
  }

  /**
   * Get district investment modifiers
   */
  async getDistrictModifiers(districtId) {
    return apiRequest(`/territory/modifiers/${districtId}`)
  }

  // ==========================================================================
  // HEIST CONTRACTS
  // ==========================================================================

  /**
   * Get open contracts
   */
  async getOpenContracts(limit = 20) {
    return apiRequest(`/territory/contracts?limit=${limit}`)
  }

  /**
   * Get player's contracts (funded and accepted)
   */
  async getMyContracts() {
    return apiRequest('/territory/contracts/my')
  }

  /**
   * Create a new contract
   */
  async createContract(targetType, targetDescription, fundedAmount, executorSplit = 70) {
    return apiRequest('/territory/contracts', 'POST', {
      targetType,
      targetDescription,
      fundedAmount,
      executorSplit
    })
  }

  /**
   * Accept a contract
   */
  async acceptContract(contractId) {
    return apiRequest(`/territory/contracts/${contractId}/accept`, 'POST')
  }

  /**
   * Cancel own open contract
   */
  async cancelContract(contractId) {
    return apiRequest(`/territory/contracts/${contractId}/cancel`, 'POST')
  }

  // ==========================================================================
  // TERRITORY STATUS
  // ==========================================================================

  /**
   * Get overall territory status
   */
  async getTerritoryStatus() {
    return apiRequest('/territory')
  }

  /**
   * Get territory leaderboard
   */
  async getTerritoryLeaderboard() {
    return apiRequest('/territory/leaderboard')
  }
}

export const territoryService = new TerritoryService()
export default territoryService
