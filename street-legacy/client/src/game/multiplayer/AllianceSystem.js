/**
 * AllianceSystem - Phase 30: Cross-Player Interactions (Alliances)
 *
 * Alliance functionality between players.
 *
 * Features:
 * - Alliance formation
 * - Shared territory/info benefits
 * - Alliance obligations
 * - Betrayal mechanics
 * - Territory disputes
 * - Cooperative heists
 */

import { messageBroker } from './MessageBroker'
import { playerMessaging } from './PlayerMessaging'
import { MESSAGE_TYPES, MESSAGE_PRIORITY } from './MessageProtocol'
import { reputationPropagator, REPUTATION_ASPECTS } from '../world/ReputationPropagator'

const STORAGE_KEY = 'alliance_system_data'

// Alliance states
export const ALLIANCE_STATES = {
  PROPOSED: 'proposed',
  ACTIVE: 'active',
  STRAINED: 'strained',
  BROKEN: 'broken',
  ENDED: 'ended',
}

// Alliance types
export const ALLIANCE_TYPES = {
  MUTUAL_DEFENSE: 'mutual_defense',    // Help when attacked
  INFORMATION: 'information',           // Share intel
  TERRITORY: 'territory',               // Share territory control
  BUSINESS: 'business',                 // Share profits
  FULL: 'full',                         // All of the above
}

// Alliance benefits
const ALLIANCE_BENEFITS = {
  [ALLIANCE_TYPES.MUTUAL_DEFENSE]: {
    description: 'Allies come to your defense when attacked',
    effects: ['defense_bonus', 'backup_available'],
  },
  [ALLIANCE_TYPES.INFORMATION]: {
    description: 'Share intel on opportunities and threats',
    effects: ['shared_intel', 'early_warning'],
  },
  [ALLIANCE_TYPES.TERRITORY]: {
    description: 'Access to allied territories',
    effects: ['territory_access', 'shared_heat'],
  },
  [ALLIANCE_TYPES.BUSINESS]: {
    description: 'Share profits from joint ventures',
    effects: ['profit_sharing', 'joint_opportunities'],
  },
  [ALLIANCE_TYPES.FULL]: {
    description: 'Complete partnership with all benefits',
    effects: ['all'],
  },
}

/**
 * AllianceSystem class
 */
class AllianceSystemClass {
  constructor() {
    this.alliances = new Map()
    this.pendingProposals = new Map()
    this.allianceHistory = []
    this.listeners = []
  }

  /**
   * Initialize alliance system
   */
  initialize() {
    this.loadState()

    // Listen for alliance-related messages
    messageBroker.subscribe((message) => {
      if (message.metadata?.type === 'alliance_proposal') {
        this.handleAllianceProposal(message)
      } else if (message.metadata?.type === 'alliance_response') {
        this.handleAllianceResponse(message)
      } else if (message.metadata?.type === 'alliance_action') {
        this.handleAllianceAction(message)
      }
    })

    // Check alliance health periodically
    setInterval(() => this.checkAllianceHealth(), 60000)

    console.log('[AllianceSystem] Initialized')
  }

  /**
   * Propose an alliance
   */
  proposeAlliance(playerName, type = ALLIANCE_TYPES.MUTUAL_DEFENSE, terms = '') {
    const player = playerMessaging.findPlayer(playerName)
    if (!player) {
      return { success: false, error: 'Player not found' }
    }

    // Check if already allied
    if (this.isAllied(player.id)) {
      return { success: false, error: 'Already in alliance with this player' }
    }

    const proposal = {
      id: `alliance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      initiator: messageBroker.player.getReference(),
      recipient: {
        id: player.id,
        name: player.name,
        type: 'player',
      },
      type,
      terms,
      benefits: ALLIANCE_BENEFITS[type],
      state: ALLIANCE_STATES.PROPOSED,
      createdAt: Date.now(),
      expiresAt: Date.now() + 600000,  // 10 minutes
    }

    this.pendingProposals.set(proposal.id, proposal)

    // Send proposal message
    playerMessaging.sendMessage(playerName, this.formatProposalMessage(proposal), {
      metadata: {
        type: 'alliance_proposal',
        proposalId: proposal.id,
        allianceType: type,
        terms,
      },
      priority: MESSAGE_PRIORITY.NORMAL,
    })

    this.saveState()

    console.log(`[AllianceSystem] Alliance proposed to ${playerName}`)

    return { success: true, proposal }
  }

  /**
   * Format proposal message
   */
  formatProposalMessage(proposal) {
    return `ALLIANCE PROPOSAL\n` +
           `Type: ${proposal.type}\n` +
           `Benefits: ${proposal.benefits.description}\n` +
           `Terms: ${proposal.terms || 'Standard terms'}\n` +
           `Expires: ${new Date(proposal.expiresAt).toLocaleTimeString()}\n\n` +
           `Use: alliance accept ${proposal.id} or alliance decline ${proposal.id}`
  }

  /**
   * Handle incoming alliance proposal
   */
  handleAllianceProposal(message) {
    const { proposalId, allianceType, terms } = message.metadata

    const proposal = {
      id: proposalId,
      initiator: message.sender,
      recipient: messageBroker.player.getReference(),
      type: allianceType,
      terms,
      benefits: ALLIANCE_BENEFITS[allianceType],
      state: ALLIANCE_STATES.PROPOSED,
      receivedAt: Date.now(),
      expiresAt: message.expiresAt || Date.now() + 600000,
    }

    this.pendingProposals.set(proposalId, proposal)
    this.saveState()

    this.notifyListeners('proposal_received', { proposal })
  }

  /**
   * Accept alliance proposal
   */
  acceptAlliance(proposalId) {
    const proposal = this.pendingProposals.get(proposalId)
    if (!proposal) {
      return { success: false, error: 'Proposal not found' }
    }

    if (Date.now() > proposal.expiresAt) {
      this.pendingProposals.delete(proposalId)
      this.saveState()
      return { success: false, error: 'Proposal expired' }
    }

    // Create the alliance
    const alliance = {
      id: `active_${proposalId}`,
      members: [proposal.initiator, proposal.recipient],
      type: proposal.type,
      terms: proposal.terms,
      benefits: proposal.benefits,
      state: ALLIANCE_STATES.ACTIVE,
      formedAt: Date.now(),
      trust: 50,  // Starting trust level
      contributions: {
        [proposal.initiator.id]: 0,
        [proposal.recipient.id]: 0,
      },
      sharedAchievements: [],
    }

    this.alliances.set(alliance.id, alliance)
    this.pendingProposals.delete(proposalId)

    // Notify initiator
    playerMessaging.sendMessage(proposal.initiator.name, `Alliance accepted! We are now allied.`, {
      metadata: {
        type: 'alliance_response',
        proposalId,
        accepted: true,
        allianceId: alliance.id,
      },
    })

    // Update reputation
    reputationPropagator.recordEvent({
      aspect: REPUTATION_ASPECTS.LOYALTY,
      value: 10,
      witnesses: [proposal.initiator.id],
    })

    this.saveState()

    this.notifyListeners('alliance_formed', { alliance })

    console.log(`[AllianceSystem] Alliance formed: ${alliance.id}`)

    return { success: true, alliance }
  }

  /**
   * Decline alliance proposal
   */
  declineAlliance(proposalId, reason = '') {
    const proposal = this.pendingProposals.get(proposalId)
    if (!proposal) {
      return { success: false, error: 'Proposal not found' }
    }

    this.pendingProposals.delete(proposalId)

    // Notify initiator
    playerMessaging.sendMessage(proposal.initiator.name, `Alliance declined.${reason ? ' Reason: ' + reason : ''}`, {
      metadata: {
        type: 'alliance_response',
        proposalId,
        accepted: false,
        reason,
      },
    })

    this.saveState()

    return { success: true }
  }

  /**
   * Handle alliance response
   */
  handleAllianceResponse(message) {
    const { proposalId, accepted, allianceId, reason } = message.metadata

    if (accepted) {
      // They accepted our proposal
      const proposal = this.pendingProposals.get(proposalId)
      if (proposal) {
        // Alliance should already be created by them, just update our records
        this.pendingProposals.delete(proposalId)
        this.notifyListeners('alliance_accepted', { proposalId, allianceId })
      }
    } else {
      // They declined
      this.pendingProposals.delete(proposalId)
      this.notifyListeners('alliance_declined', { proposalId, reason })
    }

    this.saveState()
  }

  /**
   * Handle alliance action (contribution, request, etc.)
   */
  handleAllianceAction(message) {
    const { allianceId, action, data } = message.metadata
    const alliance = this.alliances.get(allianceId)

    if (!alliance) return

    switch (action) {
      case 'contribution':
        this.recordContribution(allianceId, message.sender.id, data.amount)
        break
      case 'request_help':
        this.notifyListeners('help_requested', { alliance, requester: message.sender, data })
        break
      case 'share_intel':
        this.notifyListeners('intel_shared', { alliance, sharer: message.sender, intel: data })
        break
    }
  }

  /**
   * Check if player is allied
   */
  isAllied(playerId) {
    for (const alliance of this.alliances.values()) {
      if (alliance.state === ALLIANCE_STATES.ACTIVE) {
        if (alliance.members.some(m => m.id === playerId)) {
          return true
        }
      }
    }
    return false
  }

  /**
   * Get alliance with player
   */
  getAllianceWith(playerId) {
    for (const alliance of this.alliances.values()) {
      if (alliance.state === ALLIANCE_STATES.ACTIVE) {
        if (alliance.members.some(m => m.id === playerId)) {
          return alliance
        }
      }
    }
    return null
  }

  /**
   * Get all active alliances
   */
  getActiveAlliances() {
    return Array.from(this.alliances.values())
      .filter(a => a.state === ALLIANCE_STATES.ACTIVE)
  }

  /**
   * Record contribution to alliance
   */
  recordContribution(allianceId, playerId, amount) {
    const alliance = this.alliances.get(allianceId)
    if (!alliance) return

    if (!alliance.contributions[playerId]) {
      alliance.contributions[playerId] = 0
    }
    alliance.contributions[playerId] += amount

    // Increase trust
    alliance.trust = Math.min(100, alliance.trust + (amount / 100))

    this.saveState()

    this.notifyListeners('contribution_recorded', { allianceId, playerId, amount })
  }

  /**
   * Request help from allies
   */
  requestHelp(type, details) {
    const alliances = this.getActiveAlliances()
    const myId = messageBroker.player.id

    for (const alliance of alliances) {
      const ally = alliance.members.find(m => m.id !== myId)
      if (ally) {
        playerMessaging.sendMessage(ally.name, `HELP REQUEST: ${type}\n${details}`, {
          metadata: {
            type: 'alliance_action',
            allianceId: alliance.id,
            action: 'request_help',
            data: { type, details },
          },
          priority: MESSAGE_PRIORITY.HIGH,
        })
      }
    }

    return { success: true, allianceCount: alliances.length }
  }

  /**
   * Share intel with allies
   */
  shareIntel(intel) {
    const alliances = this.getActiveAlliances()
    const myId = messageBroker.player.id
    let shared = 0

    for (const alliance of alliances) {
      // Check if this alliance type allows intel sharing
      if (alliance.type === ALLIANCE_TYPES.INFORMATION ||
          alliance.type === ALLIANCE_TYPES.FULL) {
        const ally = alliance.members.find(m => m.id !== myId)
        if (ally) {
          playerMessaging.sendMessage(ally.name, `INTEL: ${intel}`, {
            metadata: {
              type: 'alliance_action',
              allianceId: alliance.id,
              action: 'share_intel',
              data: intel,
            },
          })
          shared++
        }
      }
    }

    return { success: true, sharedWith: shared }
  }

  /**
   * Betray an alliance
   */
  betray(allianceId, reason = '') {
    const alliance = this.alliances.get(allianceId)
    if (!alliance) {
      return { success: false, error: 'Alliance not found' }
    }

    const myId = messageBroker.player.id
    const ally = alliance.members.find(m => m.id !== myId)

    alliance.state = ALLIANCE_STATES.BROKEN
    alliance.brokenAt = Date.now()
    alliance.brokenBy = myId
    alliance.betrayalReason = reason

    // Massive reputation hit
    reputationPropagator.recordEvent({
      aspect: REPUTATION_ASPECTS.LOYALTY,
      value: -50,
      witnesses: [ally.id],
      isPublic: true,  // Everyone hears about betrayals
    })

    // Notify the betrayed
    playerMessaging.sendMessage(ally.name, `Our alliance has been BETRAYED.`, {
      metadata: {
        type: 'alliance_betrayed',
        allianceId,
        reason,
      },
      priority: MESSAGE_PRIORITY.URGENT,
    })

    // Move to history
    this.allianceHistory.push({
      ...alliance,
      endedBy: 'betrayal',
    })

    this.saveState()

    this.notifyListeners('alliance_betrayed', { alliance, ally })

    console.log(`[AllianceSystem] Alliance betrayed: ${allianceId}`)

    return { success: true }
  }

  /**
   * End an alliance amicably
   */
  endAlliance(allianceId, reason = '') {
    const alliance = this.alliances.get(allianceId)
    if (!alliance) {
      return { success: false, error: 'Alliance not found' }
    }

    const myId = messageBroker.player.id
    const ally = alliance.members.find(m => m.id !== myId)

    alliance.state = ALLIANCE_STATES.ENDED
    alliance.endedAt = Date.now()
    alliance.endReason = reason

    // Notify ally
    playerMessaging.sendMessage(ally.name, `Our alliance has ended.${reason ? ' Reason: ' + reason : ''}`, {
      metadata: {
        type: 'alliance_ended',
        allianceId,
        reason,
      },
    })

    // Move to history
    this.allianceHistory.push({
      ...alliance,
      endedBy: 'mutual',
    })

    this.alliances.delete(allianceId)
    this.saveState()

    this.notifyListeners('alliance_ended', { alliance })

    return { success: true }
  }

  /**
   * Check alliance health
   */
  checkAllianceHealth() {
    for (const alliance of this.alliances.values()) {
      if (alliance.state !== ALLIANCE_STATES.ACTIVE) continue

      // Check for imbalanced contributions
      const contributions = Object.values(alliance.contributions)
      if (contributions.length === 2) {
        const [a, b] = contributions
        if (Math.abs(a - b) > 1000) {
          alliance.trust = Math.max(0, alliance.trust - 5)

          if (alliance.trust < 20) {
            alliance.state = ALLIANCE_STATES.STRAINED
            this.notifyListeners('alliance_strained', { alliance })
          }
        }
      }
    }

    this.saveState()
  }

  /**
   * Get pending proposals
   */
  getPendingProposals() {
    const now = Date.now()
    return Array.from(this.pendingProposals.values())
      .filter(p => p.expiresAt > now)
  }

  /**
   * Format alliance for terminal
   */
  formatAllianceForTerminal(alliance) {
    const myId = messageBroker.player.id
    const ally = alliance.members.find(m => m.id !== myId)

    const lines = [
      `=== ALLIANCE ===`,
      `ID: ${alliance.id}`,
      `Allied with: ${ally?.name || 'Unknown'}`,
      `Type: ${alliance.type}`,
      `State: ${alliance.state}`,
      `Trust: ${alliance.trust}%`,
      `Formed: ${new Date(alliance.formedAt).toLocaleDateString()}`,
      ``,
      `Benefits: ${alliance.benefits.description}`,
    ]

    return lines.join('\n')
  }

  /**
   * Get alliance stats
   */
  getStats() {
    return {
      activeAlliances: this.getActiveAlliances().length,
      pendingProposals: this.pendingProposals.size,
      totalFormed: this.allianceHistory.length + this.alliances.size,
      betrayals: this.allianceHistory.filter(a => a.endedBy === 'betrayal').length,
    }
  }

  /**
   * Add listener
   */
  addListener(callback) {
    this.listeners.push(callback)
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index !== -1) this.listeners.splice(index, 1)
    }
  }

  /**
   * Notify listeners
   */
  notifyListeners(event, data) {
    for (const listener of this.listeners) {
      listener(event, data)
    }
  }

  /**
   * Save state
   */
  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        alliances: Array.from(this.alliances.entries()),
        pendingProposals: Array.from(this.pendingProposals.entries()),
        allianceHistory: this.allianceHistory.slice(-50),
      }))
    } catch (e) {
      console.warn('[AllianceSystem] Failed to save:', e)
    }
  }

  /**
   * Load state
   */
  loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        this.alliances = new Map(data.alliances || [])
        this.pendingProposals = new Map(data.pendingProposals || [])
        this.allianceHistory = data.allianceHistory || []
      }
    } catch (e) {
      console.warn('[AllianceSystem] Failed to load:', e)
    }
  }

  /**
   * Clear all
   */
  clear() {
    this.alliances.clear()
    this.pendingProposals.clear()
    this.allianceHistory = []
    localStorage.removeItem(STORAGE_KEY)
  }
}

// Export singleton
export const allianceSystem = new AllianceSystemClass()
export default allianceSystem
