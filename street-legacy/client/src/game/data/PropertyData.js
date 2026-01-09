/**
 * PropertyData.js - Pure data module for property system
 *
 * This module contains all property definitions, types, and helper functions.
 * No game logic, no state mutation - just data and pure functions.
 */

// ============================================================================
// PROPERTY TYPES
// ============================================================================

export const PROPERTY_TYPES = {
  SAFEHOUSE: 'safehouse',
  BUSINESS: 'business',
  FRONT: 'front'
}

// Type display configuration
export const PROPERTY_TYPE_CONFIG = {
  [PROPERTY_TYPES.SAFEHOUSE]: {
    label: 'Safehouse',
    icon: '\uD83C\uDFE0',        // house emoji
    color: 0x3b82f6,             // blue
    description: 'Reduces your heat passively and provides extra storage.',
    benefits: { label: 'Heat Reduction', icon: '\uD83D\uDD25' }
  },
  [PROPERTY_TYPES.BUSINESS]: {
    label: 'Business',
    icon: '\uD83C\uDFEA',        // convenience store emoji
    color: 0x22c55e,             // green
    description: 'Generates passive cash income every hour.',
    benefits: { label: 'Passive Income', icon: '\uD83D\uDCB0' }
  },
  [PROPERTY_TYPES.FRONT]: {
    label: 'Front',
    icon: '\uD83C\uDFB0',        // slot machine emoji
    color: 0x8b5cf6,             // purple
    description: 'Launders dirty money, converting heat to clean cash.',
    benefits: { label: 'Money Laundering', icon: '\uD83D\uDCB8' }
  },
  default: {
    label: 'Property',
    icon: '\uD83C\uDFE2',        // office building emoji
    color: 0x6b7280,             // gray
    description: 'A property in the city.',
    benefits: null
  }
}

// ============================================================================
// PROPERTY DEFINITIONS
// ============================================================================

export const PROPERTIES = [
  // === SAFEHOUSES ===
  {
    id: 'apt_parkdale_small',
    name: 'Small Parkdale Apartment',
    type: PROPERTY_TYPES.SAFEHOUSE,
    description: 'A modest apartment to lay low',
    price: 5000,
    income_per_hour: 0,
    heat_reduction: 5,
    storage_slots: 2,
    district: 'parkdale',
    district_name: 'Parkdale',
    min_level: 1,
    max_level: 5,
    upkeep_per_hour: 10
  },
  {
    id: 'apt_etobicoke_medium',
    name: 'Etobicoke Townhouse',
    type: PROPERTY_TYPES.SAFEHOUSE,
    description: 'A quiet townhouse in the suburbs',
    price: 20000,
    income_per_hour: 0,
    heat_reduction: 12,
    storage_slots: 5,
    district: 'etobicoke',
    district_name: 'Etobicoke',
    min_level: 8,
    max_level: 8,
    upkeep_per_hour: 35
  },
  {
    id: 'safehouse_portlands',
    name: 'Portlands Hideout',
    type: PROPERTY_TYPES.SAFEHOUSE,
    description: 'Industrial area hideout with good escape routes',
    price: 45000,
    income_per_hour: 0,
    heat_reduction: 20,
    storage_slots: 10,
    district: 'portlands',
    district_name: 'Portlands',
    min_level: 15,
    max_level: 10,
    upkeep_per_hour: 75
  },
  {
    id: 'penthouse_yorkville',
    name: 'Yorkville Penthouse',
    type: PROPERTY_TYPES.SAFEHOUSE,
    description: 'Luxury penthouse with maximum security',
    price: 250000,
    income_per_hour: 0,
    heat_reduction: 35,
    storage_slots: 20,
    district: 'yorkville',
    district_name: 'Yorkville',
    min_level: 25,
    max_level: 15,
    upkeep_per_hour: 200
  },

  // === BUSINESSES ===
  {
    id: 'garage_parkdale',
    name: 'Parkdale Auto Garage',
    type: PROPERTY_TYPES.BUSINESS,
    description: 'Repair shop generating steady income',
    price: 15000,
    income_per_hour: 25,
    heat_reduction: 0,
    storage_slots: 0,
    district: 'parkdale',
    district_name: 'Parkdale',
    min_level: 5,
    max_level: 10,
    upkeep_per_hour: 5
  },
  {
    id: 'warehouse_portlands',
    name: 'Portlands Warehouse',
    type: PROPERTY_TYPES.BUSINESS,
    description: 'Large storage and distribution facility',
    price: 50000,
    income_per_hour: 75,
    heat_reduction: 0,
    storage_slots: 15,
    district: 'portlands',
    district_name: 'Portlands',
    min_level: 10,
    max_level: 10,
    upkeep_per_hour: 20
  },
  {
    id: 'nightclub_downtown',
    name: 'Downtown Nightclub',
    type: PROPERTY_TYPES.BUSINESS,
    description: 'Popular club generating high income',
    price: 100000,
    income_per_hour: 150,
    heat_reduction: 0,
    storage_slots: 0,
    district: 'downtown',
    district_name: 'Downtown',
    min_level: 15,
    max_level: 10,
    upkeep_per_hour: 50
  },
  {
    id: 'hotel_yorkville',
    name: 'Yorkville Boutique Hotel',
    type: PROPERTY_TYPES.BUSINESS,
    description: 'Upscale hotel with premium clientele',
    price: 200000,
    income_per_hour: 300,
    heat_reduction: 0,
    storage_slots: 5,
    district: 'yorkville',
    district_name: 'Yorkville',
    min_level: 22,
    max_level: 15,
    upkeep_per_hour: 100
  },

  // === FRONTS ===
  {
    id: 'laundromat_parkdale',
    name: 'Parkdale Laundromat',
    type: PROPERTY_TYPES.FRONT,
    description: 'Classic front for cleaning dirty money',
    price: 25000,
    income_per_hour: 15,
    heat_reduction: 8,
    storage_slots: 0,
    district: 'parkdale',
    district_name: 'Parkdale',
    min_level: 7,
    max_level: 8,
    upkeep_per_hour: 15,
    launder_rate: 0.05     // 5% of dirty money per hour
  },
  {
    id: 'restaurant_downtown',
    name: 'Downtown Restaurant',
    type: PROPERTY_TYPES.FRONT,
    description: 'Upscale restaurant hiding shady dealings',
    price: 75000,
    income_per_hour: 40,
    heat_reduction: 10,
    storage_slots: 3,
    district: 'downtown',
    district_name: 'Downtown',
    min_level: 12,
    max_level: 10,
    upkeep_per_hour: 35,
    launder_rate: 0.10     // 10% of dirty money per hour
  },
  {
    id: 'casino_yorkville',
    name: 'Yorkville Casino',
    type: PROPERTY_TYPES.FRONT,
    description: 'High-end casino for maximum laundering',
    price: 300000,
    income_per_hour: 100,
    heat_reduction: 15,
    storage_slots: 5,
    district: 'yorkville',
    district_name: 'Yorkville',
    min_level: 30,
    max_level: 15,
    upkeep_per_hour: 150,
    launder_rate: 0.20     // 20% of dirty money per hour
  }
]

// ============================================================================
// UPGRADE CONFIGURATION
// ============================================================================

export const UPGRADE_CONFIG = {
  // Cost multiplier per level (base_price * multiplier * level)
  costMultiplier: 0.5,

  // Benefit increase per level
  incomePerLevelMultiplier: 0.15,      // +15% income per level
  heatReductionPerLevel: 2,            // +2% heat reduction per level
  storagePerLevel: 1,                  // +1 storage slot per level

  // Upkeep increase per level
  upkeepPerLevelMultiplier: 0.10       // +10% upkeep per level
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get property definition by ID
 * @param {string} id - Property ID
 * @returns {Object|undefined} Property definition
 */
export function getPropertyById(id) {
  return PROPERTIES.find(p => p.id === id)
}

/**
 * Get all properties of a specific type
 * @param {string} type - Property type from PROPERTY_TYPES
 * @returns {Array} Properties of that type
 */
export function getPropertiesByType(type) {
  return PROPERTIES.filter(p => p.type === type)
}

/**
 * Get all properties in a specific district
 * @param {string} district - District ID
 * @returns {Array} Properties in that district
 */
export function getPropertiesByDistrict(district) {
  return PROPERTIES.filter(p => p.district === district)
}

/**
 * Get properties available to a player based on level
 * @param {number} playerLevel - Player's current level
 * @returns {Array} Properties the player can purchase
 */
export function getAvailableProperties(playerLevel) {
  return PROPERTIES.filter(p => playerLevel >= (p.min_level || 1))
}

/**
 * Calculate upgrade cost for a property
 * @param {Object} property - Property definition or owned property
 * @returns {number} Cost to upgrade to next level
 */
export function calculateUpgradeCost(property) {
  const basePrice = property.price || 10000
  const currentLevel = property.level || 1
  return Math.floor(basePrice * UPGRADE_CONFIG.costMultiplier * currentLevel)
}

/**
 * Calculate stats for a property at a given level
 * @param {Object} propertyDef - Base property definition
 * @param {number} level - Property level
 * @returns {Object} Calculated stats at that level
 */
export function calculatePropertyStats(propertyDef, level = 1) {
  const levelMultiplier = 1 + (UPGRADE_CONFIG.incomePerLevelMultiplier * (level - 1))

  return {
    income_per_hour: Math.floor((propertyDef.income_per_hour || 0) * levelMultiplier),
    heat_reduction: (propertyDef.heat_reduction || 0) + (UPGRADE_CONFIG.heatReductionPerLevel * (level - 1)),
    storage_slots: (propertyDef.storage_slots || 0) + (UPGRADE_CONFIG.storagePerLevel * (level - 1)),
    upkeep_per_hour: Math.floor((propertyDef.upkeep_per_hour || 0) * (1 + UPGRADE_CONFIG.upkeepPerLevelMultiplier * (level - 1)))
  }
}

/**
 * Get type configuration for a property
 * @param {string} type - Property type
 * @returns {Object} Type configuration (icon, color, description)
 */
export function getTypeConfig(type) {
  const key = (type || 'default').toLowerCase()
  return PROPERTY_TYPE_CONFIG[key] || PROPERTY_TYPE_CONFIG.default
}

/**
 * Calculate pending income for a property based on time since last collection
 * @param {Object} property - Owned property with last_collected timestamp
 * @param {number} maxHours - Maximum hours of income to accumulate (default 24)
 * @returns {number} Pending income amount
 */
export function calculatePendingIncome(property, maxHours = 24) {
  if (!property.last_collected || !property.income_per_hour) return 0

  const lastCollected = new Date(property.last_collected)
  const now = new Date()
  const hoursSince = (now - lastCollected) / (1000 * 60 * 60)

  const cappedHours = Math.min(hoursSince, maxHours)
  return Math.floor(cappedHours * property.income_per_hour)
}

/**
 * Calculate sell value for a property (50% of current value)
 * @param {Object} property - Property to sell
 * @returns {number} Sell value
 */
export function calculateSellValue(property) {
  const basePrice = property.price || 10000
  const level = property.level || 1
  // Value increases slightly with level
  const leveledValue = basePrice * (1 + 0.1 * (level - 1))
  return Math.floor(leveledValue * 0.5)
}

/**
 * Calculate total portfolio income per hour
 * @param {Array} ownedProperties - Array of owned properties
 * @returns {number} Total income per hour
 */
export function calculateTotalIncome(ownedProperties) {
  return (ownedProperties || []).reduce((sum, p) => sum + (p.income_per_hour || 0), 0)
}

/**
 * Calculate total heat reduction from properties
 * @param {Array} ownedProperties - Array of owned properties
 * @returns {number} Total heat reduction percentage
 */
export function calculateTotalHeatReduction(ownedProperties) {
  return (ownedProperties || []).reduce((sum, p) => sum + (p.heat_reduction || 0), 0)
}

/**
 * Calculate total storage from properties
 * @param {Array} ownedProperties - Array of owned properties
 * @returns {number} Total extra storage slots
 */
export function calculateTotalStorage(ownedProperties) {
  return (ownedProperties || []).reduce((sum, p) => sum + (p.storage_slots || 0), 0)
}

/**
 * Calculate total upkeep per hour
 * @param {Array} ownedProperties - Array of owned properties
 * @returns {number} Total upkeep cost per hour
 */
export function calculateTotalUpkeep(ownedProperties) {
  return (ownedProperties || []).reduce((sum, p) => sum + (p.upkeep_per_hour || 0), 0)
}

// Default export for convenience
export default {
  PROPERTY_TYPES,
  PROPERTY_TYPE_CONFIG,
  PROPERTIES,
  UPGRADE_CONFIG,
  getPropertyById,
  getPropertiesByType,
  getPropertiesByDistrict,
  getAvailableProperties,
  calculateUpgradeCost,
  calculatePropertyStats,
  getTypeConfig,
  calculatePendingIncome,
  calculateSellValue,
  calculateTotalIncome,
  calculateTotalHeatReduction,
  calculateTotalStorage,
  calculateTotalUpkeep
}
