/**
 * StoryArcManager - Multi-phase story arcs and major missions
 *
 * Story Arcs:
 * - The Architect's Heist (Level 13+)
 * - Scarlett's Territory War (Level 10+)
 * - The Silkroad Network (Level 5+)
 *
 * Features:
 * - Multi-phase progression
 * - Persistent state across sessions
 * - Real-time scheduled events
 * - Branching outcomes
 */

import { gameManager } from '../GameManager'
import { NPC_CONTACTS } from '../data/NPCContacts'
import { terminalManager, OUTPUT_TYPES } from './TerminalManager'
import { notificationManager } from './NotificationManager'
import { playerReputationManager } from './PlayerReputationManager'
import { progressionManager } from './ProgressionManager'

// Story Arc Phases
export const ARC_PHASES = {
  NOT_STARTED: 'not_started',
  FIRST_CONTACT: 'first_contact',
  PROVING_GROUNDS: 'proving_grounds',
  PLANNING: 'planning',
  EXECUTION: 'execution',
  AFTERMATH: 'aftermath',
  COMPLETED: 'completed',
  FAILED: 'failed'
}

// Story Arc Definitions
const STORY_ARCS = {
  architect_heist: {
    id: 'architect_heist',
    name: 'The Architect\'s Heist',
    npcId: 'the_architect',
    minLevel: 13,
    description: 'A legendary score that will cement your legacy.',
    phases: {
      [ARC_PHASES.FIRST_CONTACT]: {
        title: 'First Contact',
        trigger: 'level_reached',
        message: 'Heard you\'re making moves. Interested in real money?',
        requirements: null,
        nextPhase: ARC_PHASES.PROVING_GROUNDS
      },
      [ARC_PHASES.PROVING_GROUNDS]: {
        title: 'Proving Grounds',
        message: 'Complete 3 high-risk operations without getting busted.',
        requirements: {
          type: 'crimes',
          count: 3,
          category: 'high_risk',
          failCondition: 'busted'
        },
        nextPhase: ARC_PHASES.PLANNING
      },
      [ARC_PHASES.PLANNING]: {
        title: 'The Plan',
        message: 'CN Tower vault. $50,000 per person. Choose your role.',
        roleOptions: ['hacker', 'insider', 'muscle'],
        crewRequired: 2,
        nextPhase: ARC_PHASES.EXECUTION
      },
      [ARC_PHASES.EXECUTION]: {
        title: 'The Heist',
        message: 'Everyone in position. Radio silence until go signal.',
        scheduledEvent: true,
        duration: 15, // minutes
        successRequirements: { minigameScore: 70 },
        nextPhase: ARC_PHASES.AFTERMATH
      },
      [ARC_PHASES.AFTERMATH]: {
        title: 'Aftermath',
        successMessage: 'Clean. Professional. $50,000 wired. Trust earned.',
        failMessage: 'Sloppy. You\'re out. Don\'t contact me again.',
        rewards: { cash: 50000, respect: 500, trustGain: 50 },
        penalties: { trustLoss: -100, blocked: true }
      }
    },
    rewards: {
      unlocks: ['legendary_tier'],
      items: ['master_blueprint'],
      cash: 50000
    }
  },

  scarlett_territory: {
    id: 'scarlett_territory',
    name: 'Territory Wars',
    npcId: 'scarlett',
    minLevel: 10,
    description: 'Help Scarlett\'s crew claim Jane & Finch.',
    phases: {
      [ARC_PHASES.FIRST_CONTACT]: {
        title: 'Crew Initiation',
        message: 'Jane & Finch needs soldiers. You in or out?',
        requirements: null,
        nextPhase: ARC_PHASES.PROVING_GROUNDS
      },
      [ARC_PHASES.PROVING_GROUNDS]: {
        title: 'Earn Your Colors',
        message: 'Run 5 jobs in Jane & Finch without heat going over 50.',
        requirements: {
          type: 'jobs',
          count: 5,
          location: 'janeAndFinch',
          heatLimit: 50
        },
        nextPhase: ARC_PHASES.PLANNING
      },
      [ARC_PHASES.PLANNING]: {
        title: 'War Council',
        message: 'Yorkville thinks they can push into our turf. We hit them first.',
        targetFaction: 'yorkville',
        nextPhase: ARC_PHASES.EXECUTION
      },
      [ARC_PHASES.EXECUTION]: {
        title: 'The Raid',
        message: 'Tonight. Multiple targets. You take the warehouse.',
        duration: 10,
        nextPhase: ARC_PHASES.AFTERMATH
      },
      [ARC_PHASES.AFTERMATH]: {
        title: 'New Order',
        successMessage: 'Jane & Finch is ours. You\'re crew for life.',
        failMessage: 'We lost. Get out of my sight.',
        rewards: { cash: 15000, respect: 300, factionBonus: 30 }
      }
    }
  },

  silkroad_network: {
    id: 'silkroad_network',
    name: 'The Supply Chain',
    npcId: 'silkroad',
    minLevel: 5,
    description: 'Build a distribution network across Toronto.',
    phases: {
      [ARC_PHASES.FIRST_CONTACT]: {
        title: 'Business Proposal',
        message: 'Bulk opportunities for reliable partners. Interested?',
        requirements: null,
        nextPhase: ARC_PHASES.PROVING_GROUNDS
      },
      [ARC_PHASES.PROVING_GROUNDS]: {
        title: 'Reliability Test',
        message: 'Complete 5 successful trades. No failed deliveries.',
        requirements: {
          type: 'trades',
          count: 5,
          successOnly: true
        },
        nextPhase: ARC_PHASES.PLANNING
      },
      [ARC_PHASES.PLANNING]: {
        title: 'Expansion',
        message: 'Ready to set up drops in 3 districts. Choose locations.',
        locationCount: 3,
        nextPhase: ARC_PHASES.EXECUTION
      },
      [ARC_PHASES.EXECUTION]: {
        title: 'Network Launch',
        message: 'Shipments incoming. Manage distribution for 1 week.',
        duration: 10080, // 7 days in minutes
        nextPhase: ARC_PHASES.AFTERMATH
      },
      [ARC_PHASES.AFTERMATH]: {
        title: 'Empire',
        successMessage: 'Network operational. Passive income unlocked.',
        rewards: { passiveIncome: 500, respectBonus: 200 }
      }
    }
  }
}

const STORAGE_KEY = 'streetLegacy_storyArcs'

class StoryArcManager {
  constructor() {
    this.isInitialized = false
    this.activeArcs = new Map() // arcId -> arc state
    this.completedArcs = []
    this.failedArcs = []
    this.arcProgress = {} // Track requirements progress
  }

  /**
   * Initialize the story arc manager
   */
  initialize() {
    if (this.isInitialized) return

    this.loadFromStorage()

    // Listen for level ups to trigger arcs
    gameManager.on('levelUp', (data) => {
      this.checkArcTriggers(data.newLevel)
    })

    // Check triggers on init
    const player = gameManager.player
    if (player?.level) {
      this.checkArcTriggers(player.level)
    }

    this.isInitialized = true
    console.log('[StoryArcManager] Initialized')
  }

  /**
   * Check for arc triggers based on level
   */
  checkArcTriggers(level) {
    for (const [arcId, arc] of Object.entries(STORY_ARCS)) {
      // Skip if already started or completed
      if (this.activeArcs.has(arcId) || this.completedArcs.includes(arcId)) {
        continue
      }

      // Check level requirement
      if (level >= arc.minLevel) {
        // Check NPC is unlocked
        if (progressionManager.isNPCUnlocked(arc.npcId)) {
          this.triggerFirstContact(arcId)
        }
      }
    }
  }

  /**
   * Trigger first contact for an arc
   */
  triggerFirstContact(arcId) {
    const arc = STORY_ARCS[arcId]
    if (!arc) return

    const npc = NPC_CONTACTS[arc.npcId]
    if (!npc) return

    // Start the arc
    const arcState = {
      id: arcId,
      name: arc.name,
      npcId: arc.npcId,
      currentPhase: ARC_PHASES.FIRST_CONTACT,
      startedAt: Date.now(),
      progress: {},
      choices: {},
      phaseStartedAt: Date.now()
    }

    this.activeArcs.set(arcId, arcState)

    // Display first contact message
    const phase = arc.phases[ARC_PHASES.FIRST_CONTACT]

    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`:: NEW STORY ARC ::`, OUTPUT_TYPES.NPC_URGENT)
    terminalManager.addOutput(`${npc.displayPrefix} ${arc.name}`, OUTPUT_TYPES.HANDLER)
    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(phase.message, OUTPUT_TYPES.NPC_JOB)
    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`Type 'arc ${arcId}' for details.`, OUTPUT_TYPES.SYSTEM)

    notificationManager.showToast(`New Story Arc: ${arc.name}`, 'success', 5000)

    this.saveToStorage()

    console.log(`[StoryArcManager] Started arc: ${arc.name}`)
  }

  /**
   * Accept a story arc
   */
  acceptArc(arcId) {
    const arcState = this.activeArcs.get(arcId)
    if (!arcState) return { error: 'Arc not found' }

    const arc = STORY_ARCS[arcId]
    const currentPhase = arc.phases[arcState.currentPhase]

    // Advance to next phase
    if (currentPhase.nextPhase) {
      arcState.currentPhase = currentPhase.nextPhase
      arcState.phaseStartedAt = Date.now()

      const nextPhase = arc.phases[arcState.currentPhase]
      const npc = NPC_CONTACTS[arc.npcId]

      terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
      terminalManager.addOutput(`${npc.displayPrefix}`, OUTPUT_TYPES.NPC_JOB)
      terminalManager.addOutput(nextPhase.message, OUTPUT_TYPES.RESPONSE)

      // Show requirements if any
      if (nextPhase.requirements) {
        this.displayRequirements(nextPhase.requirements, arcState)
      }

      this.saveToStorage()
    }

    return { success: true, newPhase: arcState.currentPhase }
  }

  /**
   * Display phase requirements
   */
  displayRequirements(requirements, arcState) {
    const progress = arcState.progress[requirements.type] || 0

    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`Requirements:`, OUTPUT_TYPES.WARNING)

    switch (requirements.type) {
      case 'crimes':
        terminalManager.addOutput(
          `  Complete ${requirements.count} high-risk crimes: ${progress}/${requirements.count}`,
          OUTPUT_TYPES.SYSTEM
        )
        if (requirements.failCondition === 'busted') {
          terminalManager.addOutput(`  Without getting busted!`, OUTPUT_TYPES.ERROR)
        }
        break

      case 'jobs':
        terminalManager.addOutput(
          `  Complete ${requirements.count} jobs in ${requirements.location}: ${progress}/${requirements.count}`,
          OUTPUT_TYPES.SYSTEM
        )
        if (requirements.heatLimit) {
          terminalManager.addOutput(
            `  Keep heat below ${requirements.heatLimit}%`,
            OUTPUT_TYPES.WARNING
          )
        }
        break

      case 'trades':
        terminalManager.addOutput(
          `  Complete ${requirements.count} successful trades: ${progress}/${requirements.count}`,
          OUTPUT_TYPES.SYSTEM
        )
        break
    }
  }

  /**
   * Track progress for active arcs
   */
  trackProgress(type, details) {
    for (const [arcId, arcState] of this.activeArcs) {
      const arc = STORY_ARCS[arcId]
      const phase = arc.phases[arcState.currentPhase]

      if (!phase.requirements || phase.requirements.type !== type) continue

      const req = phase.requirements

      // Check conditions
      let valid = true

      if (req.category && details.category !== req.category) valid = false
      if (req.location && details.location !== req.location) valid = false
      if (req.successOnly && !details.success) valid = false
      if (req.heatLimit) {
        const player = gameManager.player
        if ((player?.heat || 0) > req.heatLimit) valid = false
      }

      if (valid && details.success !== false) {
        arcState.progress[type] = (arcState.progress[type] || 0) + 1

        // Check if requirements met
        if (arcState.progress[type] >= req.count) {
          this.advancePhase(arcId)
        } else {
          // Progress update
          terminalManager.addOutput(
            `[${arc.name}] Progress: ${arcState.progress[type]}/${req.count}`,
            OUTPUT_TYPES.SUCCESS
          )
        }
      }

      // Check fail conditions
      if (req.failCondition === 'busted' && details.busted) {
        this.failArc(arcId, 'You got busted during the proving grounds.')
      }
    }

    this.saveToStorage()
  }

  /**
   * Advance to next phase
   */
  advancePhase(arcId) {
    const arcState = this.activeArcs.get(arcId)
    if (!arcState) return

    const arc = STORY_ARCS[arcId]
    const currentPhase = arc.phases[arcState.currentPhase]

    if (!currentPhase.nextPhase) {
      // Arc complete
      this.completeArc(arcId, true)
      return
    }

    arcState.currentPhase = currentPhase.nextPhase
    arcState.phaseStartedAt = Date.now()

    const nextPhase = arc.phases[arcState.currentPhase]
    const npc = NPC_CONTACTS[arc.npcId]

    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`:: PHASE COMPLETE ::`, OUTPUT_TYPES.SUCCESS)
    terminalManager.addOutput(`${npc.displayPrefix}`, OUTPUT_TYPES.NPC_JOB)
    terminalManager.addOutput(nextPhase.title, OUTPUT_TYPES.HANDLER)
    terminalManager.addOutput(nextPhase.message, OUTPUT_TYPES.RESPONSE)

    notificationManager.showToast(`${arc.name}: ${nextPhase.title}`, 'success', 4000)

    this.saveToStorage()
  }

  /**
   * Complete an arc
   */
  completeArc(arcId, success) {
    const arcState = this.activeArcs.get(arcId)
    if (!arcState) return

    const arc = STORY_ARCS[arcId]
    const npc = NPC_CONTACTS[arc.npcId]
    const aftermath = arc.phases[ARC_PHASES.AFTERMATH]

    this.activeArcs.delete(arcId)

    if (success) {
      this.completedArcs.push(arcId)

      terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
      terminalManager.addOutput(`:: STORY ARC COMPLETE ::`, OUTPUT_TYPES.SUCCESS)
      terminalManager.addOutput(`${npc.displayPrefix}`, OUTPUT_TYPES.NPC_DEAL)
      terminalManager.addOutput(aftermath.successMessage, OUTPUT_TYPES.SUCCESS)

      // Apply rewards
      if (aftermath.rewards) {
        const player = gameManager.player
        if (aftermath.rewards.cash) {
          gameManager.addCash(aftermath.rewards.cash)
          terminalManager.addOutput(
            `Reward: $${aftermath.rewards.cash.toLocaleString()}`,
            OUTPUT_TYPES.SUCCESS
          )
        }
        if (aftermath.rewards.respect) {
          gameManager.addRespect(aftermath.rewards.respect)
        }
        if (aftermath.rewards.trustGain) {
          playerReputationManager.modifyNPCTrust(arc.npcId, aftermath.rewards.trustGain, 'story arc complete')
        }
      }

      notificationManager.showToast(`Story Complete: ${arc.name}!`, 'success', 5000)
    } else {
      this.failedArcs.push(arcId)
    }

    this.saveToStorage()
  }

  /**
   * Fail an arc
   */
  failArc(arcId, reason) {
    const arcState = this.activeArcs.get(arcId)
    if (!arcState) return

    const arc = STORY_ARCS[arcId]
    const npc = NPC_CONTACTS[arc.npcId]
    const aftermath = arc.phases[ARC_PHASES.AFTERMATH]

    this.activeArcs.delete(arcId)
    this.failedArcs.push(arcId)

    terminalManager.addOutput(``, OUTPUT_TYPES.SYSTEM)
    terminalManager.addOutput(`:: STORY ARC FAILED ::`, OUTPUT_TYPES.ERROR)
    terminalManager.addOutput(`${npc.displayPrefix}`, OUTPUT_TYPES.NPC_URGENT)
    terminalManager.addOutput(aftermath?.failMessage || reason, OUTPUT_TYPES.ERROR)

    // Apply penalties
    if (aftermath?.penalties) {
      if (aftermath.penalties.trustLoss) {
        playerReputationManager.modifyNPCTrust(arc.npcId, aftermath.penalties.trustLoss, 'story arc failed')
      }
    }

    notificationManager.showToast(`Failed: ${arc.name}`, 'error', 5000)

    this.saveToStorage()
  }

  /**
   * Get arc status
   */
  getArcStatus(arcId) {
    if (this.completedArcs.includes(arcId)) {
      return { status: 'completed' }
    }
    if (this.failedArcs.includes(arcId)) {
      return { status: 'failed' }
    }

    const arcState = this.activeArcs.get(arcId)
    if (arcState) {
      const arc = STORY_ARCS[arcId]
      const phase = arc.phases[arcState.currentPhase]
      return {
        status: 'active',
        phase: arcState.currentPhase,
        phaseTitle: phase.title,
        progress: arcState.progress,
        npc: NPC_CONTACTS[arc.npcId]
      }
    }

    // Check if available
    const arc = STORY_ARCS[arcId]
    if (!arc) return { status: 'unknown' }

    const player = gameManager.player
    if ((player?.level || 1) < arc.minLevel) {
      return { status: 'locked', requiredLevel: arc.minLevel }
    }

    return { status: 'available' }
  }

  /**
   * Get all available arcs
   */
  getAllArcs() {
    return Object.entries(STORY_ARCS).map(([id, arc]) => ({
      id,
      ...arc,
      status: this.getArcStatus(id)
    }))
  }

  /**
   * Get active arcs summary
   */
  getActiveArcsSummary() {
    return Array.from(this.activeArcs.entries()).map(([id, state]) => {
      const arc = STORY_ARCS[id]
      const phase = arc.phases[state.currentPhase]
      return {
        id,
        name: arc.name,
        npc: NPC_CONTACTS[arc.npcId]?.name,
        phase: phase.title,
        progress: state.progress
      }
    })
  }

  /**
   * Save to localStorage
   */
  saveToStorage() {
    try {
      const data = {
        arcs: Array.from(this.activeArcs.entries()),
        completed: this.completedArcs,
        failed: this.failedArcs
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('[StoryArcManager] Save error:', e)
    }
  }

  /**
   * Load from localStorage
   */
  loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.arcs) {
          this.activeArcs = new Map(data.arcs)
        }
        if (data.completed) {
          this.completedArcs = data.completed
        }
        if (data.failed) {
          this.failedArcs = data.failed
        }
      }
    } catch (e) {
      console.error('[StoryArcManager] Load error:', e)
    }
  }

  /**
   * Reset arc (for testing)
   */
  resetArc(arcId) {
    this.activeArcs.delete(arcId)
    this.completedArcs = this.completedArcs.filter(id => id !== arcId)
    this.failedArcs = this.failedArcs.filter(id => id !== arcId)
    this.saveToStorage()
  }
}

// Singleton instance
export const storyArcManager = new StoryArcManager()

export default storyArcManager
