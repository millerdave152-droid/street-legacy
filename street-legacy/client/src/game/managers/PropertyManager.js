/**
 * PropertyManager.js - Business logic for property system
 *
 * Handles all property operations: purchase, upgrade, sell, income collection, upkeep.
 * Works with both API and local storage modes.
 */

import {
  PROPERTIES,
  PROPERTY_TYPES,
  getPropertyById,
  getAvailableProperties,
  calculateUpgradeCost,
  calculatePropertyStats,
  calculatePendingIncome,
  calculateSellValue,
  calculateTotalIncome,
  calculateTotalHeatReduction,
  calculateTotalStorage,
  calculateTotalUpkeep
} from '../data/PropertyData'
import { getPlayerData, savePlayerData } from '../data/GameData'
import { gameManager } from '../GameManager'

// ============================================================================
// PROPERTY MANAGER CLASS
// ============================================================================

class PropertyManagerClass {
  constructor() {
    // No state stored here - all state comes from player data
  }

  // ==========================================================================
  // QUERY METHODS (Pure, no side effects)
  // ==========================================================================

  /**
   * Get all property definitions
   * @returns {Array} All property definitions
   */
  getAllProperties() {
    return PROPERTIES
  }

  /**
   * Get properties available for purchase based on player level
   * @param {Object} player - Player data object
   * @returns {Array} Available property definitions
   */
  getAvailableForPurchase(player) {
    const playerLevel = player?.level || 1
    const ownedIds = new Set((player?.properties || []).map(p => p.id))

    return getAvailableProperties(playerLevel).filter(p => !ownedIds.has(p.id))
  }

  /**
   * Get player's owned properties with calculated stats
   * @param {Object} player - Player data object
   * @returns {Array} Owned properties with current stats and pending income
   */
  getOwnedProperties(player) {
    const owned = player?.properties || []

    return owned.map(p => {
      const def = getPropertyById(p.id) || p
      const level = p.level || 1
      const stats = calculatePropertyStats(def, level)

      return {
        ...def,
        ...p,
        ...stats,
        pending_income: calculatePendingIncome(p)
      }
    })
  }

  /**
   * Check if player can purchase a property
   * @param {Object} propertyDef - Property definition
   * @param {Object} player - Player data object
   * @returns {Object} { canPurchase: boolean, reason?: string }
   */
  canPurchase(propertyDef, player) {
    if (!propertyDef) {
      return { canPurchase: false, reason: 'Property not found' }
    }

    const price = propertyDef.price || 0
    const playerCash = player?.cash || 0
    const playerLevel = player?.level || 1
    const minLevel = propertyDef.min_level || 1

    if (playerLevel < minLevel) {
      return { canPurchase: false, reason: `Requires level ${minLevel}` }
    }

    if (playerCash < price) {
      return { canPurchase: false, reason: 'Not enough cash' }
    }

    const ownedIds = new Set((player?.properties || []).map(p => p.id))
    if (ownedIds.has(propertyDef.id)) {
      return { canPurchase: false, reason: 'Already owned' }
    }

    return { canPurchase: true }
  }

  /**
   * Check if player can upgrade a property
   * @param {Object} property - Owned property
   * @param {Object} player - Player data object
   * @returns {Object} { canUpgrade: boolean, reason?: string, cost?: number }
   */
  canUpgrade(property, player) {
    if (!property) {
      return { canUpgrade: false, reason: 'Property not found' }
    }

    const currentLevel = property.level || 1
    const maxLevel = property.max_level || 10

    if (currentLevel >= maxLevel) {
      return { canUpgrade: false, reason: 'Already at max level' }
    }

    const cost = calculateUpgradeCost(property)
    const playerCash = player?.cash || 0

    if (playerCash < cost) {
      return { canUpgrade: false, reason: 'Not enough cash', cost }
    }

    return { canUpgrade: true, cost }
  }

  /**
   * Calculate portfolio summary
   * @param {Object} player - Player data object
   * @returns {Object} Portfolio summary stats
   */
  getPortfolioSummary(player) {
    const owned = this.getOwnedProperties(player)

    return {
      count: owned.length,
      totalIncome: calculateTotalIncome(owned),
      totalHeatReduction: calculateTotalHeatReduction(owned),
      totalStorage: calculateTotalStorage(owned),
      totalUpkeep: calculateTotalUpkeep(owned),
      totalPendingIncome: owned.reduce((sum, p) => sum + (p.pending_income || 0), 0),
      netIncome: calculateTotalIncome(owned) - calculateTotalUpkeep(owned)
    }
  }

  // ==========================================================================
  // MUTATION METHODS (Modify player state)
  // ==========================================================================

  /**
   * Purchase a property
   * @param {string} propertyId - Property ID to purchase
   * @param {Object} player - Player data object (will be modified)
   * @returns {Object} { success: boolean, property?: Object, error?: string }
   */
  purchaseProperty(propertyId, player) {
    const propertyDef = getPropertyById(propertyId)

    const { canPurchase, reason } = this.canPurchase(propertyDef, player)
    if (!canPurchase) {
      return { success: false, error: reason }
    }

    // Deduct cash
    player.cash = (player.cash || 0) - propertyDef.price

    // Initialize properties array if needed
    if (!player.properties) {
      player.properties = []
    }

    // Create owned property record
    const ownedProperty = {
      id: propertyDef.id,
      name: propertyDef.name,
      type: propertyDef.type,
      price: propertyDef.price,
      district: propertyDef.district,
      district_name: propertyDef.district_name,
      level: 1,
      purchased_at: Date.now(),
      last_collected: Date.now(),
      // Copy base stats
      income_per_hour: propertyDef.income_per_hour,
      heat_reduction: propertyDef.heat_reduction,
      storage_slots: propertyDef.storage_slots,
      upkeep_per_hour: propertyDef.upkeep_per_hour,
      max_level: propertyDef.max_level
    }

    player.properties.push(ownedProperty)

    // Update stats
    player.totalPropertiesPurchased = (player.totalPropertiesPurchased || 0) + 1

    return { success: true, property: ownedProperty }
  }

  /**
   * Upgrade a property
   * @param {string} propertyId - Property ID to upgrade
   * @param {Object} player - Player data object (will be modified)
   * @returns {Object} { success: boolean, property?: Object, error?: string }
   */
  upgradeProperty(propertyId, player) {
    const ownedProperty = (player?.properties || []).find(p => p.id === propertyId)

    if (!ownedProperty) {
      return { success: false, error: 'Property not owned' }
    }

    const { canUpgrade, reason, cost } = this.canUpgrade(ownedProperty, player)
    if (!canUpgrade) {
      return { success: false, error: reason }
    }

    // Deduct cash
    player.cash = (player.cash || 0) - cost

    // Increase level
    ownedProperty.level = (ownedProperty.level || 1) + 1

    // Recalculate stats based on new level
    const def = getPropertyById(propertyId) || ownedProperty
    const newStats = calculatePropertyStats(def, ownedProperty.level)

    // Update property with new stats
    Object.assign(ownedProperty, newStats)

    return { success: true, property: ownedProperty, cost }
  }

  /**
   * Sell a property
   * @param {string} propertyId - Property ID to sell
   * @param {Object} player - Player data object (will be modified)
   * @returns {Object} { success: boolean, amount?: number, error?: string }
   */
  sellProperty(propertyId, player) {
    const propertyIndex = (player?.properties || []).findIndex(p => p.id === propertyId)

    if (propertyIndex === -1) {
      return { success: false, error: 'Property not owned' }
    }

    const property = player.properties[propertyIndex]
    const sellValue = calculateSellValue(property)

    // Add sell value to cash
    player.cash = (player.cash || 0) + sellValue

    // Remove from owned properties
    player.properties.splice(propertyIndex, 1)

    // Update stats
    player.totalPropertiesSold = (player.totalPropertiesSold || 0) + 1

    return { success: true, amount: sellValue, property }
  }

  /**
   * Collect income from a single property
   * @param {string} propertyId - Property ID to collect from
   * @param {Object} player - Player data object (will be modified)
   * @returns {Object} { success: boolean, amount?: number, error?: string }
   */
  collectIncome(propertyId, player) {
    const property = (player?.properties || []).find(p => p.id === propertyId)

    if (!property) {
      return { success: false, error: 'Property not owned' }
    }

    const pendingIncome = calculatePendingIncome(property)

    if (pendingIncome <= 0) {
      return { success: false, error: 'No income to collect' }
    }

    // Add income to cash
    player.cash = (player.cash || 0) + pendingIncome
    player.totalEarnings = (player.totalEarnings || 0) + pendingIncome

    // Update last collected time
    property.last_collected = Date.now()

    return { success: true, amount: pendingIncome }
  }

  /**
   * Collect income from all properties
   * @param {Object} player - Player data object (will be modified)
   * @returns {Object} { success: boolean, totalAmount: number, collected: number }
   */
  collectAllIncome(player) {
    const properties = player?.properties || []
    let totalAmount = 0
    let collected = 0

    for (const property of properties) {
      const pendingIncome = calculatePendingIncome(property)
      if (pendingIncome > 0) {
        totalAmount += pendingIncome
        collected++
        property.last_collected = Date.now()
      }
    }

    if (totalAmount > 0) {
      player.cash = (player.cash || 0) + totalAmount
      player.totalEarnings = (player.totalEarnings || 0) + totalAmount
    }

    return { success: true, totalAmount, collected }
  }

  /**
   * Apply upkeep costs to player
   * @param {Object} player - Player data object (will be modified)
   * @param {number} hours - Number of hours of upkeep to apply (default 1)
   * @returns {Object} { totalUpkeep: number, foreclosed: Array }
   */
  applyUpkeep(player, hours = 1) {
    const properties = player?.properties || []
    let totalUpkeep = 0
    const foreclosed = []

    for (const property of properties) {
      const upkeep = (property.upkeep_per_hour || 0) * hours
      totalUpkeep += upkeep
    }

    // Deduct upkeep from cash
    if (totalUpkeep > 0) {
      if ((player.cash || 0) >= totalUpkeep) {
        player.cash = (player.cash || 0) - totalUpkeep
      } else {
        // Not enough cash - foreclosure logic
        // For now, just drain cash to 0 and mark properties at risk
        player.cash = 0
        player.propertiesAtRisk = true
      }
    }

    return { totalUpkeep, foreclosed }
  }

  /**
   * Calculate total portfolio income with modifiers
   * @param {Object} player - Player data object
   * @param {Object} globalModifiers - Optional modifiers { incomeBonus: 0.1, etc. }
   * @returns {number} Modified total income per hour
   */
  calculatePortfolioIncome(player, globalModifiers = {}) {
    const owned = this.getOwnedProperties(player)
    const baseIncome = calculateTotalIncome(owned)
    const incomeBonus = globalModifiers.incomeBonus || 0

    return Math.floor(baseIncome * (1 + incomeBonus))
  }

  // ==========================================================================
  // PERSISTENCE HELPERS
  // ==========================================================================

  /**
   * Save player data after property operations
   * @param {Object} player - Player data to save
   */
  savePlayer(player) {
    // Update gameManager if available
    if (gameManager.player) {
      Object.assign(gameManager.player, player)
    }
    // Save to local storage
    savePlayerData(player)
  }

  /**
   * Get current player data from gameManager or local storage
   * @returns {Object} Player data
   */
  getPlayer() {
    return gameManager.player || getPlayerData() || {}
  }

  // ==========================================================================
  // HIGH-LEVEL CONVENIENCE METHODS
  // ==========================================================================

  /**
   * Purchase property and save (convenience method)
   * @param {string} propertyId - Property ID
   * @returns {Object} Result with success status
   */
  buyAndSave(propertyId) {
    const player = this.getPlayer()
    const result = this.purchaseProperty(propertyId, player)

    if (result.success) {
      this.savePlayer(player)
    }

    return result
  }

  /**
   * Upgrade property and save (convenience method)
   * @param {string} propertyId - Property ID
   * @returns {Object} Result with success status
   */
  upgradeAndSave(propertyId) {
    const player = this.getPlayer()
    const result = this.upgradeProperty(propertyId, player)

    if (result.success) {
      this.savePlayer(player)
    }

    return result
  }

  /**
   * Sell property and save (convenience method)
   * @param {string} propertyId - Property ID
   * @returns {Object} Result with success status
   */
  sellAndSave(propertyId) {
    const player = this.getPlayer()
    const result = this.sellProperty(propertyId, player)

    if (result.success) {
      this.savePlayer(player)
    }

    return result
  }

  /**
   * Collect income and save (convenience method)
   * @param {string} propertyId - Property ID
   * @returns {Object} Result with success status
   */
  collectAndSave(propertyId) {
    const player = this.getPlayer()
    const result = this.collectIncome(propertyId, player)

    if (result.success) {
      this.savePlayer(player)
    }

    return result
  }

  /**
   * Collect all income and save (convenience method)
   * @returns {Object} Result with success status
   */
  collectAllAndSave() {
    const player = this.getPlayer()
    const result = this.collectAllIncome(player)

    if (result.success && result.totalAmount > 0) {
      this.savePlayer(player)
    }

    return result
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const propertyManager = new PropertyManagerClass()
export default propertyManager
