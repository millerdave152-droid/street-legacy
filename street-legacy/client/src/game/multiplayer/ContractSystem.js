/**
 * ContractSystem - Client-side heist contract management
 * Handles contract creation, acceptance, and tracking
 */

import { territoryService } from '../../services/territory.service'
import { websocketService } from '../../services/websocket.service'

class ContractSystem {
  constructor() {
    this.contracts = []
    this.myContracts = []
    this.listeners = new Set()
    this.initialized = false
  }

  /**
   * Initialize the contract system
   */
  initialize() {
    if (this.initialized) return

    // Listen for contract-related WebSocket events
    websocketService.on('contract:created', this.handleContractCreated.bind(this))
    websocketService.on('contract:accepted', this.handleContractAccepted.bind(this))
    websocketService.on('contract:completed', this.handleContractCompleted.bind(this))
    websocketService.on('contract:cancelled', this.handleContractCancelled.bind(this))

    this.initialized = true
    console.log('[ContractSystem] Initialized')
  }

  /**
   * Add a listener for contract updates
   */
  addListener(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Notify all listeners of updates
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data)
      } catch (e) {
        console.error('[ContractSystem] Listener error:', e)
      }
    })
  }

  // ===========================================================================
  // CONTRACT OPERATIONS
  // ===========================================================================

  /**
   * Get all open contracts
   */
  async getOpenContracts(forceRefresh = false) {
    if (!forceRefresh && this.contracts.length > 0) {
      return this.contracts
    }

    try {
      const result = await territoryService.getOpenContracts()
      if (result.success) {
        this.contracts = result.data
        return this.contracts
      }
      throw new Error(result.error)
    } catch (error) {
      console.error('[ContractSystem] Failed to get contracts:', error)
      throw error
    }
  }

  /**
   * Get player's contracts (funded and accepted)
   */
  async getMyContracts(forceRefresh = false) {
    if (!forceRefresh && this.myContracts.length > 0) {
      return this.myContracts
    }

    try {
      const result = await territoryService.getMyContracts()
      if (result.success) {
        this.myContracts = result.data
        return this.myContracts
      }
      throw new Error(result.error)
    } catch (error) {
      console.error('[ContractSystem] Failed to get my contracts:', error)
      throw error
    }
  }

  /**
   * Create a new contract
   */
  async createContract(targetType, description, fundedAmount, executorSplit = 70) {
    try {
      const result = await territoryService.createContract(
        targetType,
        description,
        fundedAmount,
        executorSplit
      )

      if (result.success) {
        // Refresh contracts list
        await this.getOpenContracts(true)
        await this.getMyContracts(true)

        this.notifyListeners('created', {
          contractId: result.data.contractId,
          targetType,
          description,
          fundedAmount,
          executorSplit
        })

        return result.data
      }

      throw new Error(result.error)
    } catch (error) {
      console.error('[ContractSystem] Failed to create contract:', error)
      throw error
    }
  }

  /**
   * Accept a contract
   */
  async acceptContract(contractId) {
    try {
      const result = await territoryService.acceptContract(contractId)

      if (result.success) {
        // Refresh contracts lists
        await this.getOpenContracts(true)
        await this.getMyContracts(true)

        this.notifyListeners('accepted', { contractId })

        return true
      }

      throw new Error(result.error)
    } catch (error) {
      console.error('[ContractSystem] Failed to accept contract:', error)
      throw error
    }
  }

  /**
   * Cancel a contract (funder only)
   */
  async cancelContract(contractId) {
    try {
      const result = await territoryService.cancelContract(contractId)

      if (result.success) {
        // Refresh contracts lists
        await this.getOpenContracts(true)
        await this.getMyContracts(true)

        this.notifyListeners('cancelled', {
          contractId,
          refundAmount: result.data.refundAmount
        })

        return result.data
      }

      throw new Error(result.error)
    } catch (error) {
      console.error('[ContractSystem] Failed to cancel contract:', error)
      throw error
    }
  }

  // ===========================================================================
  // WEBSOCKET EVENT HANDLERS
  // ===========================================================================

  handleContractCreated(event) {
    console.log('[ContractSystem] Contract created:', event)
    this.getOpenContracts(true)
    this.notifyListeners('created', event.data)
  }

  handleContractAccepted(event) {
    console.log('[ContractSystem] Contract accepted:', event)
    this.getOpenContracts(true)
    this.getMyContracts(true)
    this.notifyListeners('accepted', event.data)
  }

  handleContractCompleted(event) {
    console.log('[ContractSystem] Contract completed:', event)
    this.getMyContracts(true)
    this.notifyListeners('completed', event.data)
  }

  handleContractCancelled(event) {
    console.log('[ContractSystem] Contract cancelled:', event)
    this.getOpenContracts(true)
    this.getMyContracts(true)
    this.notifyListeners('cancelled', event.data)
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Get a specific contract by ID
   */
  getContract(contractId) {
    return this.contracts.find(c => c.id === contractId) ||
           this.myContracts.find(c => c.id === contractId)
  }

  /**
   * Get contracts by status
   */
  getContractsByStatus(status) {
    return this.myContracts.filter(c => c.status === status)
  }

  /**
   * Get pending contracts I need to complete
   */
  getPendingContracts() {
    return this.myContracts.filter(c =>
      c.status === 'accepted' || c.status === 'in_progress'
    )
  }

  /**
   * Calculate expected payout for a contract
   */
  calculateExpectedPayout(contract, estimatedPayout) {
    const executorAmount = Math.round(estimatedPayout * contract.executorSplitPercent / 100)
    const funderAmount = estimatedPayout - executorAmount

    return {
      totalPayout: estimatedPayout,
      executorPayout: executorAmount + contract.fundedAmount, // Executor gets split + funding
      funderPayout: funderAmount
    }
  }

  /**
   * Format contract for display
   */
  formatContract(contract) {
    const timeRemaining = contract.timeRemainingMs
      ? Math.floor(contract.timeRemainingMs / 3600000) + 'h'
      : 'N/A'

    return {
      ...contract,
      formattedFunding: `$${contract.fundedAmount.toLocaleString()}`,
      formattedSplit: `${contract.executorSplitPercent}%`,
      timeRemaining,
      shortId: contract.id.slice(0, 8)
    }
  }
}

// Export singleton instance
export const contractSystem = new ContractSystem()
export default contractSystem
