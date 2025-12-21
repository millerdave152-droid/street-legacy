/**
 * Adventure System - Index
 */

export { adventureEngine, ADVENTURE_STATES, CONSEQUENCE_TYPES } from './AdventureEngine'
export { adventureParser } from './AdventureParser'
export { adventureRegistry, ADVENTURE_CATEGORIES } from './AdventureRegistry'

// Initialize function
export function initializeAdventureSystem() {
  const { adventureRegistry } = require('./AdventureRegistry')
  const { adventureEngine } = require('./AdventureEngine')

  adventureRegistry.initialize()
  adventureEngine.initialize()

  console.log('[AdventureSystem] All components initialized')
}
