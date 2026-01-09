/**
 * OnboardingQuests - Sequential questline for new players
 *
 * Guides players through: First Crime -> Banking -> Building Stake -> Property -> Crew -> Heist
 * Each quest has objectives, rewards, and contextual hints for SARAH
 */

export const ONBOARDING_QUESTS = [
  {
    id: 'FIRST_SCORE',
    title: 'First Score',
    description: 'Every empire starts somewhere. Commit your first crime.',
    objective: {
      type: 'CRIME_COMPLETE',
      count: 1
    },
    rewards: {
      xp: 50,
      cash: 100
    },
    unlocks: 'BANK_YOUR_EARNINGS',
    sarahHint: "Try 'crime list' to see available jobs. Start small - pickpocketing is low risk.",
    terminalHint: "Type 'crime list' to see available crimes, then 'crime <name>' to attempt one."
  },
  {
    id: 'BANK_YOUR_EARNINGS',
    title: 'Bank Your Earnings',
    description: 'Smart criminals protect their money. Open a bank account and make a deposit.',
    objective: {
      type: 'BANK_DEPOSIT',
      minAmount: 100
    },
    rewards: {
      xp: 75
    },
    unlocks: 'BUILD_YOUR_STAKE',
    sarahHint: "Use 'bank open' to set up an account. Banks keep your cash safe from... accidents.",
    terminalHint: "Type 'bank open' to create an account, then 'bank deposit <amount>' to stash cash."
  },
  {
    id: 'BUILD_YOUR_STAKE',
    title: 'Build Your Stake',
    description: 'You need capital to expand. Accumulate $5,000 in total.',
    objective: {
      type: 'CASH_THRESHOLD',
      amount: 5000
    },
    rewards: {
      xp: 150
    },
    unlocks: 'FIRST_PROPERTY',
    sarahHint: "Keep grinding crimes. Check 'crime list' for higher-paying options as you level up.",
    terminalHint: "Keep committing crimes to build your cash. Different crimes have different payouts."
  },
  {
    id: 'FIRST_PROPERTY',
    title: 'First Property',
    description: 'Real estate is how empires are built. Buy your first property.',
    objective: {
      type: 'PROPERTY_PURCHASE',
      count: 1
    },
    rewards: {
      xp: 200,
      cash: 500
    },
    unlocks: 'CREW_UP',
    sarahHint: "Check 'property list' to see what's available. Start with something affordable.",
    terminalHint: "Type 'property list' to browse available properties, 'property buy <id>' to purchase."
  },
  {
    id: 'CREW_UP',
    title: 'Crew Up',
    description: "You can't do this alone. Recruit your first crew member.",
    objective: {
      type: 'CREW_HIRE',
      count: 1
    },
    rewards: {
      xp: 250
    },
    unlocks: 'FIRST_HEIST',
    sarahHint: "Visit the crew hub to find recruits. Look for someone whose skills complement yours.",
    terminalHint: "Type 'crew' to access the crew management system and recruit members.",
    requiresLevel: 10
  },
  {
    id: 'FIRST_HEIST',
    title: 'First Heist',
    description: 'Time for something bigger. Plan and execute your first heist.',
    objective: {
      type: 'HEIST_COMPLETE',
      count: 1
    },
    rewards: {
      xp: 500,
      cash: 2000
    },
    unlocks: null,
    sarahHint: "Heists require planning. Use 'heist list' to see available targets.",
    terminalHint: "Type 'heist list' to see heists, 'heist plan <id>' to start planning.",
    requiresLevel: 5
  }
]

// Objective types for event matching
export const QUEST_OBJECTIVE_TYPES = {
  CRIME_COMPLETE: 'crime:completed',
  BANK_DEPOSIT: 'bank:deposit',
  CASH_THRESHOLD: 'player:cash_changed',
  PROPERTY_PURCHASE: 'property:purchased',
  CREW_HIRE: 'crew:hired',
  HEIST_COMPLETE: 'heist:completed'
}

// Storage key for quest state
export const QUEST_STATE_KEY = 'streetLegacy_questProgress'

/**
 * Get quest by ID
 */
export function getQuestById(questId) {
  return ONBOARDING_QUESTS.find(q => q.id === questId)
}

/**
 * Get the index of a quest in the sequence
 */
export function getQuestIndex(questId) {
  return ONBOARDING_QUESTS.findIndex(q => q.id === questId)
}

/**
 * Check if all quests are complete
 */
export function isOnboardingComplete(completedQuests) {
  return completedQuests.includes('FIRST_HEIST')
}

export default ONBOARDING_QUESTS
