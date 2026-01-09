/**
 * QuestlineManager - Manages the onboarding questline
 *
 * Tracks active quest, listens for game events, auto-advances on completion,
 * and emits quest:completed events for rewards and notifications.
 */

import { gameManager } from '../GameManager.js'
import { terminalManager, OUTPUT_TYPES } from './TerminalManager.js'
import { notificationManager } from './NotificationManager.js'
import {
  ONBOARDING_QUESTS,
  QUEST_STATE_KEY,
  getQuestById,
  getQuestIndex,
  isOnboardingComplete
} from '../data/OnboardingQuests.js'

class QuestlineManager {
  constructor() {
    this.isInitialized = false
    this.state = null
    this.lastActivityTime = Date.now()
    this.unsubscribers = []
  }

  /**
   * Get default quest state
   */
  getDefaultState() {
    return {
      activeQuest: 'FIRST_SCORE',
      completed: [],
      progress: {},
      lastUpdate: Date.now()
    }
  }

  /**
   * Initialize the questline manager
   */
  initialize() {
    if (this.isInitialized) return

    this.loadState()
    this.setupListeners()

    this.isInitialized = true
    console.log('[QuestlineManager] Initialized, active quest:', this.state.activeQuest)
  }

  /**
   * Shutdown the manager
   */
  shutdown() {
    this.unsubscribers.forEach(unsub => unsub())
    this.unsubscribers = []
    this.saveState()
    this.isInitialized = false
  }

  /**
   * Load quest state from localStorage
   */
  loadState() {
    try {
      const saved = localStorage.getItem(QUEST_STATE_KEY)
      if (saved) {
        this.state = { ...this.getDefaultState(), ...JSON.parse(saved) }
      } else {
        this.state = this.getDefaultState()
      }
    } catch (e) {
      console.error('[QuestlineManager] Load error:', e)
      this.state = this.getDefaultState()
    }
  }

  /**
   * Save quest state to localStorage
   */
  saveState() {
    try {
      this.state.lastUpdate = Date.now()
      localStorage.setItem(QUEST_STATE_KEY, JSON.stringify(this.state))
    } catch (e) {
      console.error('[QuestlineManager] Save error:', e)
    }
  }

  /**
   * Setup event listeners for quest progress
   */
  setupListeners() {
    // Listen for crime completion
    const unsubCrime = gameManager.on('crimeCompleted', (data) => {
      this.checkProgress('CRIME_COMPLETE', data)
    })
    this.unsubscribers.push(unsubCrime)

    // Listen for bank deposits
    const unsubDeposit = gameManager.on('bankDeposit', (data) => {
      this.checkProgress('BANK_DEPOSIT', data)
    })
    this.unsubscribers.push(unsubDeposit)

    // Listen for player updates (for cash threshold)
    const unsubPlayer = gameManager.on('playerUpdated', (player) => {
      this.checkProgress('CASH_THRESHOLD', { cash: player.cash })
    })
    this.unsubscribers.push(unsubPlayer)

    // Listen for property purchase
    const unsubProperty = gameManager.on('propertyPurchased', (data) => {
      this.checkProgress('PROPERTY_PURCHASE', data)
    })
    this.unsubscribers.push(unsubProperty)

    // Listen for crew hire
    const unsubCrew = gameManager.on('crewHired', (data) => {
      this.checkProgress('CREW_HIRE', data)
    })
    this.unsubscribers.push(unsubCrew)

    // Listen for heist completion
    const unsubHeist = gameManager.on('heistCompleted', (data) => {
      this.checkProgress('HEIST_COMPLETE', data)
    })
    this.unsubscribers.push(unsubHeist)
  }

  /**
   * Check if event advances quest progress
   */
  checkProgress(eventType, data) {
    const quest = this.getActiveQuest()
    if (!quest) return

    // Check if this event type matches the active quest objective
    if (quest.objective.type !== eventType) return

    this.lastActivityTime = Date.now()

    // Update progress based on objective type
    const currentProgress = this.state.progress[quest.id] || 0
    let newProgress = currentProgress

    switch (eventType) {
      case 'CRIME_COMPLETE':
      case 'PROPERTY_PURCHASE':
      case 'CREW_HIRE':
      case 'HEIST_COMPLETE':
        newProgress = currentProgress + 1
        break

      case 'BANK_DEPOSIT':
        newProgress = Math.max(currentProgress, data.amount || 0)
        break

      case 'CASH_THRESHOLD':
        newProgress = Math.max(currentProgress, data.cash || 0)
        break
    }

    this.state.progress[quest.id] = newProgress
    this.saveState()

    // Check if quest is complete
    if (this.isQuestComplete(quest)) {
      this.completeQuest(quest)
    }
  }

  /**
   * Check if a quest's objective is met
   */
  isQuestComplete(quest) {
    const progress = this.state.progress[quest.id] || 0
    const obj = quest.objective

    switch (obj.type) {
      case 'CRIME_COMPLETE':
      case 'PROPERTY_PURCHASE':
      case 'CREW_HIRE':
      case 'HEIST_COMPLETE':
        return progress >= obj.count

      case 'BANK_DEPOSIT':
        return progress >= obj.minAmount

      case 'CASH_THRESHOLD':
        return progress >= obj.amount

      default:
        return false
    }
  }

  /**
   * Complete a quest and advance to next
   */
  completeQuest(quest) {
    // Mark completed
    this.state.completed.push(quest.id)
    this.state.activeQuest = quest.unlocks
    delete this.state.progress[quest.id]
    this.saveState()

    // Show completion notification
    this.showQuestComplete(quest)

    // Grant rewards
    this.grantRewards(quest)

    // Emit event for other systems (SARAH, analytics)
    gameManager.emit('questCompleted', {
      questId: quest.id,
      rewards: quest.rewards,
      nextQuest: quest.unlocks
    })
  }

  /**
   * Show quest completion notification
   */
  showQuestComplete(quest) {
    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`:: OBJECTIVE COMPLETE ::`, OUTPUT_TYPES.SUCCESS)
    terminalManager.addOutput(`${quest.title}`, OUTPUT_TYPES.SUCCESS)
    terminalManager.addOutput(`"${quest.description}"`, OUTPUT_TYPES.HANDLER)

    // Show rewards
    if (quest.rewards) {
      const rewardParts = []
      if (quest.rewards.xp) rewardParts.push(`+${quest.rewards.xp} XP`)
      if (quest.rewards.cash) rewardParts.push(`+$${quest.rewards.cash.toLocaleString()}`)
      if (rewardParts.length > 0) {
        terminalManager.addOutput(`Rewards: ${rewardParts.join(', ')}`, OUTPUT_TYPES.NPC_DEAL)
      }
    }

    // Show next quest hint
    const nextQuest = quest.unlocks ? getQuestById(quest.unlocks) : null
    if (nextQuest) {
      terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
      terminalManager.addOutput(`Next: ${nextQuest.title}`, OUTPUT_TYPES.RESPONSE)
      terminalManager.addOutput(`${nextQuest.description}`, OUTPUT_TYPES.SYSTEM)
    } else {
      terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
      terminalManager.addOutput(`Onboarding complete! You've mastered the basics.`, OUTPUT_TYPES.SUCCESS)
    }

    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)

    // Toast notification
    notificationManager.showToast(
      `Quest Complete: ${quest.title}`,
      'success',
      4000
    )
  }

  /**
   * Grant quest rewards to player
   */
  grantRewards(quest) {
    if (!quest.rewards) return

    if (quest.rewards.cash && quest.rewards.cash > 0) {
      const player = gameManager.player
      if (player) {
        player.cash = (player.cash || 0) + quest.rewards.cash
        gameManager.savePlayer()
      }
    }

    if (quest.rewards.xp && quest.rewards.xp > 0) {
      const player = gameManager.player
      if (player) {
        player.xp = (player.xp || 0) + quest.rewards.xp
        gameManager.savePlayer()
        gameManager.emit('playerUpdated', player)
      }
    }
  }

  /**
   * Get the current active quest
   */
  getActiveQuest() {
    if (!this.state.activeQuest) return null

    const quest = getQuestById(this.state.activeQuest)
    if (!quest) return null

    // Check level requirement
    if (quest.requiresLevel) {
      const playerLevel = gameManager.player?.level || 1
      if (playerLevel < quest.requiresLevel) {
        return null
      }
    }

    return quest
  }

  /**
   * Get quest progress info for display
   */
  getQuestProgress() {
    const quest = this.getActiveQuest()
    if (!quest) {
      return {
        hasActiveQuest: false,
        isOnboardingComplete: isOnboardingComplete(this.state.completed)
      }
    }

    const progress = this.state.progress[quest.id] || 0
    const target = quest.objective.count || quest.objective.amount || quest.objective.minAmount

    return {
      hasActiveQuest: true,
      quest,
      progress,
      target,
      percent: Math.min(100, Math.round((progress / target) * 100)),
      isOnboardingComplete: false
    }
  }

  /**
   * Check if onboarding is complete
   */
  isComplete() {
    return isOnboardingComplete(this.state.completed)
  }

  /**
   * Get time since last quest activity
   */
  getTimeSinceActivity() {
    return Date.now() - this.lastActivityTime
  }

  /**
   * Get all completed quests
   */
  getCompletedQuests() {
    return this.state.completed.map(id => getQuestById(id)).filter(Boolean)
  }

  /**
   * Reset questline (for testing)
   */
  reset() {
    this.state = this.getDefaultState()
    this.lastActivityTime = Date.now()
    this.saveState()
    console.log('[QuestlineManager] Reset to default')
  }
}

// Singleton instance
export const questlineManager = new QuestlineManager()

export default questlineManager
