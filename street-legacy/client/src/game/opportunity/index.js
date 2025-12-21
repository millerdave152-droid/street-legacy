/**
 * Opportunity System - Index
 */

export { opportunityManager, OPPORTUNITY_TYPES, OPPORTUNITY_STATES } from './OpportunityManager'
export { opportunityScheduler } from './OpportunityScheduler'
export { relationshipTracker, RELATIONSHIP_STATUS } from './RelationshipTracker'

// Initialize function
export function initializeOpportunitySystem() {
  const { opportunityManager } = require('./OpportunityManager')
  const { opportunityScheduler } = require('./OpportunityScheduler')
  const { relationshipTracker } = require('./RelationshipTracker')

  opportunityScheduler.initialize()
  relationshipTracker.initialize()
  opportunityManager.initialize()

  console.log('[OpportunitySystem] All components initialized')
}
