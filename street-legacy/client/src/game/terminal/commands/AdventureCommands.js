/**
 * AdventureCommands - Commands for opportunities and adventures
 */

import { commandRegistry, CATEGORIES } from '../CommandRegistry'
import { opportunityManager } from '../../opportunity/OpportunityManager'
import { adventureEngine } from '../../adventure/AdventureEngine'
import { adventureRegistry } from '../../adventure/AdventureRegistry'
import { relationshipTracker } from '../../opportunity/RelationshipTracker'

// Register opportunity commands
commandRegistry.register({
  name: 'opportunities',
  aliases: ['opp', 'offers'],
  help: 'View active opportunities from NPCs',
  usage: 'opportunities',
  category: CATEGORIES.SOCIAL,
  handler: async (args, terminal) => {
    const lines = opportunityManager.formatOpportunitiesForTerminal()
    return { output: lines }
  }
})

// Adventure command
commandRegistry.register({
  name: 'adventure',
  aliases: ['adventures', 'story', 'stories'],
  help: 'View available adventures or start one',
  usage: 'adventure [number]',
  category: CATEGORIES.ACTION,
  handler: async (args, terminal) => {
    // Initialize registry if needed
    if (!adventureRegistry.initialized) {
      adventureRegistry.initialize()
    }

    // Check if an adventure is already active
    if (adventureEngine.isActive()) {
      const current = adventureEngine.getCurrentAdventure()
      return {
        output: [
          `Adventure in progress: ${current.name}`,
          `Type your choices or 'quit' to abandon.`,
          '',
          ...adventureEngine.renderCurrentNode()
        ]
      }
    }

    // Check if resuming a paused adventure
    const paused = adventureEngine.adventureState === 'paused'
    if (paused) {
      const result = adventureEngine.resumeAdventure()
      if (result.success) {
        return {
          output: [
            'Resuming adventure...',
            '',
            ...result.output
          ]
        }
      }
    }

    // If a number is provided, start that adventure
    if (args.args && args.args.length > 0) {
      const index = parseInt(args.args[0], 10)

      if (!isNaN(index)) {
        const adventure = adventureRegistry.getAdventureByIndex(index)

        if (!adventure) {
          return { output: [`No adventure #${index} found.`] }
        }

        // Initialize engine if needed
        if (!adventureEngine.initialized) {
          adventureEngine.initialize()
        }

        const result = adventureEngine.startAdventure(adventure.id)

        if (result.success) {
          return { output: result.output }
        } else {
          return { output: [result.error || 'Failed to start adventure.'] }
        }
      }
    }

    // Otherwise, list available adventures
    const lines = adventureRegistry.formatAdventuresForTerminal()
    return { output: lines }
  }
})

// Relationships command
commandRegistry.register({
  name: 'relationships',
  aliases: ['relations', 'trust', 'rep'],
  help: 'View NPC relationship and trust levels',
  usage: 'relationships',
  category: CATEGORIES.SOCIAL,
  handler: async (args, terminal) => {
    // Initialize if needed
    if (!relationshipTracker.initialized) {
      relationshipTracker.initialize()
    }

    const lines = relationshipTracker.formatRelationshipsForTerminal()
    return { output: lines }
  }
})

// Respond command (for opportunities)
commandRegistry.register({
  name: 'respond',
  aliases: ['reply', 'answer'],
  help: 'Respond to an active opportunity',
  usage: 'respond <number> <yes/no>',
  category: CATEGORIES.SOCIAL,
  handler: async (args, terminal) => {
    if (!args.args || args.args.length < 1) {
      return {
        output: [
          'Usage: respond <number> <yes/no>',
          'Example: respond 1 yes',
          '',
          "Type 'opportunities' to see available offers."
        ]
      }
    }

    const index = parseInt(args.args[0], 10)
    const response = args.args[1]

    if (isNaN(index)) {
      return { output: ['Invalid opportunity number.'] }
    }

    const opp = opportunityManager.getOpportunityByIndex(index)

    if (!opp) {
      return {
        output: [
          `No opportunity #${index} found.`,
          "Type 'opportunities' to see available offers."
        ]
      }
    }

    if (!response) {
      // Just viewing the opportunity
      return {
        output: [
          `[${opp.npcName}] "${opp.message}"`,
          '',
          `Type: respond ${index} yes  - to accept`,
          `Type: respond ${index} no   - to decline`
        ]
      }
    }

    // Process the response
    const result = opportunityManager.respond(opp.id, response)

    if (result.success) {
      const output = [result.message || 'Response recorded.']

      // Check if this starts an adventure
      if (result.adventureStart && result.adventureId) {
        if (!adventureEngine.initialized) {
          adventureEngine.initialize()
        }

        const advResult = adventureEngine.startAdventure(result.adventureId)
        if (advResult.success && advResult.output) {
          output.push('')
          output.push(...advResult.output)
        }
      }

      return { output, type: 'success' }
    } else {
      return { output: [result.error || 'Failed to respond.'], type: 'error' }
    }
  }
})

console.log('[AdventureCommands] Registered: opportunities, adventure, relationships, respond')
