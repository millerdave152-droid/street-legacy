/**
 * AdminScene - Master Admin Debug Control Panel
 *
 * Provides admin controls for:
 * - Player stats modification (cash, energy, heat, XP, level)
 * - Player search and lookup
 * - Jail/release controls
 * - Ban/unban controls
 * - Item granting
 * - Teleport to district
 * - Cooldown reset
 * - Admin action logs
 *
 * Only accessible to players with is_admin = true
 */

import { BaseScene } from './BaseScene'
import { gameManager } from '../GameManager'
import { adminService } from '../../services/admin.service'
import { formatMoney } from '../../utils/formatters'
import { COLORS, COLORS_HEX, DEBUG } from '../config/Constants'
import { audioManager } from '../managers/AudioManager'

export class AdminScene extends BaseScene {
  constructor() {
    super('AdminScene')
  }

  init(data) {
    super.init(data)
    this.targetPlayer = null
    this.targetPlayerId = null
    this.currentSection = 'stats'
    this.logs = []
    this.scrollY = 0
    this.maxScrollY = 0

    // Debug toggles state (persisted in localStorage)
    this.debugToggles = this.loadDebugToggles()
  }

  loadDebugToggles() {
    try {
      const saved = localStorage.getItem('admin_debug_toggles')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.warn('Failed to load debug toggles:', e)
    }
    return {
      infiniteEnergy: false,
      noCooldowns: false,
      instantCrime: false,
      godMode: false,
      showFPS: DEBUG.SHOW_FPS || false,
      logAPICalls: DEBUG.LOG_API_CALLS || false,
      skipAuth: false,
      instantTravel: false
    }
  }

  saveDebugToggles() {
    try {
      localStorage.setItem('admin_debug_toggles', JSON.stringify(this.debugToggles))
    } catch (e) {
      console.warn('Failed to save debug toggles:', e)
    }
  }

  create() {
    super.create()

    // Dark overlay background
    this.bg = this.add.rectangle(0, 0, this.width, this.height, 0x000000, 0.95)
      .setOrigin(0)
      .setDepth(0)

    // Admin Panel title
    this.createHeader()

    // Navigation tabs
    this.createNavTabs()

    // Content area
    this.contentContainer = this.add.container(0, 140)
    this.contentContainer.setDepth(10)

    // Load current player as default target
    this.targetPlayer = { ...gameManager.player }
    this.targetPlayerId = gameManager.player?.id

    // Show stats section by default
    this.showSection('stats')

    // Enable scrolling
    this.setupScrolling()
  }

  createHeader() {
    // Header background
    this.add.rectangle(0, 0, this.width, 60, 0x1a1a2e)
      .setOrigin(0)
      .setDepth(5)

    // Title
    this.add.text(this.centerX, 30, '🛡️ ADMIN PANEL', {
      fontSize: '24px',
      color: '#ef4444',
      fontFamily: 'Arial Black, Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(10)

    // Close button
    this.createCloseButton(() => this.closeOverlay())
  }

  createNavTabs() {
    const tabs = [
      { key: 'stats', label: '📊', x: 30 },
      { key: 'player', label: '👤', x: 75 },
      { key: 'actions', label: '⚡', x: 120 },
      { key: 'debug', label: '🔧', x: 165 },
      { key: 'database', label: '🗄️', x: 210 },
      { key: 'logs', label: '📋', x: 255 }
    ]

    this.tabButtons = {}

    // Tab bar background
    this.add.rectangle(0, 70, this.width, 50, 0x1e293b)
      .setOrigin(0)
      .setDepth(5)

    tabs.forEach(tab => {
      const isActive = tab.key === this.currentSection

      // Tab container
      const tabContainer = this.add.container(tab.x, 95).setDepth(10)

      // Background for tab
      const tabBg = this.add.rectangle(0, 0, 40, 40, isActive ? 0x2a2a4a : 0x1e293b, isActive ? 1 : 0.5)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(isActive ? 2 : 0, 0xef4444)

      // Icon
      const icon = this.add.text(0, 0, tab.label, {
        fontSize: '20px'
      }).setOrigin(0.5)

      tabContainer.add([tabBg, icon])

      tabBg.on('pointerover', () => {
        if (tab.key !== this.currentSection) {
          tabBg.setFillStyle(0x2a2a4a, 0.8)
        }
        audioManager.playHover()
      })

      tabBg.on('pointerout', () => {
        if (tab.key !== this.currentSection) {
          tabBg.setFillStyle(0x1e293b, 0.5)
        }
      })

      tabBg.on('pointerdown', () => {
        audioManager.playClick()
        this.showSection(tab.key)
      })

      this.tabButtons[tab.key] = { container: tabContainer, bg: tabBg, icon }
    })
  }

  updateTabStyles() {
    Object.entries(this.tabButtons).forEach(([key, { bg }]) => {
      const isActive = key === this.currentSection
      bg.setFillStyle(isActive ? 0x2a2a4a : 0x1e293b, isActive ? 1 : 0.5)
      bg.setStrokeStyle(isActive ? 2 : 0, 0xef4444)
    })
  }

  showSection(section) {
    this.currentSection = section
    this.updateTabStyles()

    // Clear content
    this.contentContainer.removeAll(true)
    this.scrollY = 0

    switch (section) {
      case 'stats':
        this.createStatsSection()
        break
      case 'player':
        this.createPlayerSection()
        break
      case 'actions':
        this.createActionsSection()
        break
      case 'debug':
        this.createDebugSection()
        break
      case 'database':
        this.createDatabaseSection()
        break
      case 'logs':
        this.createLogsSection()
        break
    }
  }

  // ==========================================================================
  // STATS SECTION - Modify player stats
  // ==========================================================================

  createStatsSection() {
    const startY = 20
    let y = startY

    // Target player info
    this.add.text(this.centerX, y, `Target: ${this.targetPlayer?.username || 'Self'}`, {
      fontSize: '16px',
      color: '#8b5cf6',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentContainer.add(this.contentContainer.last)
    y += 40

    // Stats controls
    const stats = [
      { key: 'cash', label: 'Cash', icon: '💰', current: this.targetPlayer?.cash || 0, format: formatMoney },
      { key: 'bank_balance', label: 'Bank', icon: '🏦', current: this.targetPlayer?.bank_balance || 0, format: formatMoney },
      { key: 'energy', label: 'Energy', icon: '⚡', current: this.targetPlayer?.energy || 0, max: 100 },
      { key: 'heat', label: 'Heat', icon: '🔥', current: this.targetPlayer?.heat || 0, max: 100 },
      { key: 'xp', label: 'XP', icon: '✨', current: this.targetPlayer?.xp || 0 },
      { key: 'level', label: 'Level', icon: '📈', current: this.targetPlayer?.level || 1, max: 100 },
      { key: 'respect', label: 'Respect', icon: '⭐', current: this.targetPlayer?.respect || 0 }
    ]

    stats.forEach(stat => {
      this.createStatControl(stat, y)
      y += 70
    })

    // Quick actions
    y += 20
    this.createButton(this.centerX - 90, y, 'Max All', () => this.maxAllStats(), 0x22c55e, 80)
    this.createButton(this.centerX + 10, y, 'Reset All', () => this.resetAllStats(), 0xef4444, 80)
    y += 50

    // Set max scroll
    this.maxScrollY = Math.max(0, y - (this.height - 180))
  }

  createStatControl(stat, y) {
    const container = this.add.container(0, y)

    // Background
    const bg = this.add.rectangle(this.centerX, 0, this.width - 40, 60, 0x1e293b, 0.8)
    bg.setStrokeStyle(1, 0x333333)
    container.add(bg)

    // Icon and label
    const label = this.add.text(30, -10, `${stat.icon} ${stat.label}`, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    container.add(label)

    // Current value
    const valueText = stat.format
      ? stat.format(stat.current)
      : stat.max ? `${stat.current}/${stat.max}` : stat.current.toLocaleString()

    const value = this.add.text(30, 10, valueText, {
      fontSize: '12px',
      color: '#888888'
    })
    container.add(value)

    // Adjustment buttons
    const amounts = stat.key === 'level' ? [1, 5, 10] : [100, 1000, 10000]

    amounts.forEach((amount, index) => {
      const x = this.width - 180 + index * 55

      // Minus button
      const minusBtn = this.add.text(x, -12, `-${this.formatAmount(amount)}`, {
        fontSize: '11px',
        color: '#ef4444',
        backgroundColor: '#2a2a4a',
        padding: { x: 4, y: 3 }
      }).setInteractive({ useHandCursor: true })

      minusBtn.on('pointerdown', () => {
        audioManager.playClick()
        this.adjustStat(stat.key, -amount)
      })

      container.add(minusBtn)

      // Plus button
      const plusBtn = this.add.text(x, 10, `+${this.formatAmount(amount)}`, {
        fontSize: '11px',
        color: '#22c55e',
        backgroundColor: '#2a2a4a',
        padding: { x: 4, y: 3 }
      }).setInteractive({ useHandCursor: true })

      plusBtn.on('pointerdown', () => {
        audioManager.playClick()
        this.adjustStat(stat.key, amount)
      })

      container.add(plusBtn)
    })

    this.contentContainer.add(container)
  }

  formatAmount(amount) {
    if (amount >= 10000) return `${amount / 1000}K`
    if (amount >= 1000) return `${amount / 1000}K`
    return amount.toString()
  }

  async adjustStat(statKey, amount) {
    try {
      this.showLoading('Adjusting...')

      // Call admin API
      await adminService.adjustPlayerCurrency(
        this.targetPlayerId,
        statKey,
        amount,
        'Admin adjustment'
      )

      // Update local state
      if (this.targetPlayer) {
        this.targetPlayer[statKey] = (this.targetPlayer[statKey] || 0) + amount
        if (this.targetPlayer[statKey] < 0) this.targetPlayer[statKey] = 0
      }

      // If adjusting self, update gameManager
      if (this.targetPlayerId === gameManager.player?.id) {
        gameManager.player[statKey] = this.targetPlayer[statKey]
        gameManager.emit('playerUpdated', gameManager.player)
      }

      this.hideLoading()
      this.showSection('stats') // Refresh
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  async maxAllStats() {
    try {
      this.showLoading('Maxing stats...')

      const maxValues = {
        cash: 10000000,
        bank_balance: 10000000,
        energy: 100,
        heat: 0, // Heat should be 0 for "max"
        xp: 1000000,
        level: 100,
        respect: 1000000
      }

      for (const [key, value] of Object.entries(maxValues)) {
        const diff = value - (this.targetPlayer?.[key] || 0)
        if (diff !== 0) {
          await adminService.adjustPlayerCurrency(
            this.targetPlayerId,
            key,
            diff,
            'Admin max all'
          )
          if (this.targetPlayer) {
            this.targetPlayer[key] = value
          }
        }
      }

      // Update gameManager if self
      if (this.targetPlayerId === gameManager.player?.id) {
        Object.assign(gameManager.player, maxValues)
        gameManager.emit('playerUpdated', gameManager.player)
      }

      this.hideLoading()
      this.showSection('stats')
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  async resetAllStats() {
    try {
      this.showLoading('Resetting stats...')

      await adminService.resetPlayerStats(this.targetPlayerId)

      // Refresh player data
      if (this.targetPlayerId === gameManager.player?.id) {
        await gameManager.refreshGameState()
        this.targetPlayer = { ...gameManager.player }
      }

      this.hideLoading()
      this.showSection('stats')
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  // ==========================================================================
  // PLAYER SECTION - Search and select players
  // ==========================================================================

  createPlayerSection() {
    let y = 20

    // Search input
    const searchContainer = this.add.container(0, y)

    this.add.text(30, 0, '🔍 Search Player:', {
      fontSize: '14px',
      color: '#ffffff'
    })
    searchContainer.add(this.children.list[this.children.list.length - 1])

    // DOM input for search
    this.searchInput = this.add.dom(this.centerX, 40).createFromHTML(`
      <input type="text" id="admin-search" placeholder="Username or ID"
        style="width: 200px; padding: 10px; font-size: 14px; border: none; border-radius: 8px; background: #2a2a4a; color: #ffffff;">
    `)
    this.contentContainer.add(this.searchInput)

    // Search button
    this.createButton(this.width - 80, 40, 'Search', () => this.searchPlayer(), 0x3b82f6, 70)

    y += 80

    // Current target display
    this.add.text(30, y, 'Current Target:', {
      fontSize: '12px',
      color: '#888888'
    })
    this.contentContainer.add(this.children.list[this.children.list.length - 1])
    y += 20

    this.createPlayerCard(this.targetPlayer, y)
    y += 100

    // Quick select buttons
    this.add.text(30, y, 'Quick Select:', {
      fontSize: '12px',
      color: '#888888'
    })
    this.contentContainer.add(this.children.list[this.children.list.length - 1])
    y += 30

    this.createButton(this.centerX - 100, y, 'Select Self', () => this.selectSelf(), 0x8b5cf6, 90)
    this.createButton(this.centerX + 10, y, 'Top Player', () => this.selectTopPlayer(), 0x6366f1, 90)

    this.maxScrollY = 0
  }

  createPlayerCard(player, y) {
    if (!player) {
      const noPlayer = this.add.text(this.centerX, y + 30, 'No player selected', {
        fontSize: '14px',
        color: '#888888'
      }).setOrigin(0.5)
      this.contentContainer.add(noPlayer)
      return
    }

    const card = this.add.container(0, y)

    // Card background
    const cardBg = this.add.rectangle(this.centerX, 40, this.width - 40, 80, 0x1e293b)
    cardBg.setStrokeStyle(1, 0x8b5cf6)
    card.add(cardBg)

    // Player info
    const username = this.add.text(40, 15, player.username || 'Unknown', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    card.add(username)

    const level = this.add.text(40, 40, `Level ${player.level || 1} | ${formatMoney(player.cash || 0)}`, {
      fontSize: '12px',
      color: '#888888'
    })
    card.add(level)

    const status = this.add.text(40, 58, this.getPlayerStatus(player), {
      fontSize: '11px',
      color: player.is_banned ? '#ef4444' : player.is_jailed ? '#f59e0b' : '#22c55e'
    })
    card.add(status)

    // Player ID (for debugging)
    const idText = this.add.text(this.width - 50, 20, `ID: ${(player.id || '').substring(0, 8)}...`, {
      fontSize: '10px',
      color: '#4a5568'
    }).setOrigin(1, 0)
    card.add(idText)

    this.contentContainer.add(card)
  }

  getPlayerStatus(player) {
    if (player.is_banned) return '🚫 BANNED'
    if (player.is_jailed) return '⛓️ JAILED'
    if (player.is_admin) return '🛡️ ADMIN'
    if (player.is_moderator) return '⚔️ MODERATOR'
    return '✅ Active'
  }

  async searchPlayer() {
    const searchTerm = this.searchInput?.getChildByID('admin-search')?.value
    if (!searchTerm) return

    try {
      this.showLoading('Searching...')

      // Try to find player by username or ID
      const players = await adminService.getPlayers({ search: searchTerm, limit: 1 })

      if (players && players.length > 0) {
        this.targetPlayer = players[0]
        this.targetPlayerId = players[0].id
        this.showSection('player')
      } else {
        this.showError('Player not found')
      }

      this.hideLoading()
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  selectSelf() {
    this.targetPlayer = { ...gameManager.player }
    this.targetPlayerId = gameManager.player?.id
    this.showSection('player')
  }

  async selectTopPlayer() {
    try {
      this.showLoading('Loading...')
      const players = await adminService.getPlayers({ sort: 'respect', limit: 1 })
      if (players && players.length > 0) {
        this.targetPlayer = players[0]
        this.targetPlayerId = players[0].id
      }
      this.hideLoading()
      this.showSection('player')
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  // ==========================================================================
  // ACTIONS SECTION - Quick admin actions
  // ==========================================================================

  createActionsSection() {
    let y = 20

    // Target info
    this.add.text(this.centerX, y, `Target: ${this.targetPlayer?.username || 'None'}`, {
      fontSize: '14px',
      color: '#8b5cf6'
    }).setOrigin(0.5)
    this.contentContainer.add(this.children.list[this.children.list.length - 1])
    y += 50

    // Jail/Release
    this.add.text(30, y, '⛓️ Jail Controls', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    this.contentContainer.add(this.children.list[this.children.list.length - 1])
    y += 30

    this.createButton(60, y, 'Jail (1hr)', () => this.jailPlayer(60), 0xf59e0b, 90)
    this.createButton(160, y, 'Jail (24hr)', () => this.jailPlayer(1440), 0xf59e0b, 90)
    this.createButton(260, y, 'Release', () => this.releasePlayer(), 0x22c55e, 80)
    y += 60

    // Ban/Unban
    this.add.text(30, y, '🚫 Ban Controls', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    this.contentContainer.add(this.children.list[this.children.list.length - 1])
    y += 30

    this.createButton(60, y, 'Ban (Temp)', () => this.showBanDialog(false), 0xef4444, 90)
    this.createButton(160, y, 'Ban (Perm)', () => this.showBanDialog(true), 0x991b1b, 90)
    this.createButton(260, y, 'Unban', () => this.unbanPlayer(), 0x22c55e, 80)
    y += 60

    // Teleport
    this.add.text(30, y, '🗺️ Teleport', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    this.contentContainer.add(this.children.list[this.children.list.length - 1])
    y += 30

    this.createButton(60, y, 'District 1', () => this.teleportPlayer(1), 0x3b82f6, 90)
    this.createButton(160, y, 'District 2', () => this.teleportPlayer(2), 0x3b82f6, 90)
    this.createButton(260, y, 'District 3', () => this.teleportPlayer(3), 0x3b82f6, 80)
    y += 60

    // Cooldowns
    this.add.text(30, y, '⏱️ Cooldowns', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    this.contentContainer.add(this.children.list[this.children.list.length - 1])
    y += 30

    this.createButton(100, y, 'Reset All Cooldowns', () => this.resetCooldowns(), 0x8b5cf6, 150)
    y += 60

    // Items
    this.add.text(30, y, '🎁 Give Items', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    this.contentContainer.add(this.children.list[this.children.list.length - 1])
    y += 30

    this.createButton(60, y, 'Weapon', () => this.giveItem('weapon'), 0x6366f1, 80)
    this.createButton(150, y, 'Armor', () => this.giveItem('armor'), 0x6366f1, 80)
    this.createButton(240, y, 'Tool', () => this.giveItem('tool'), 0x6366f1, 70)
    this.createButton(320, y, 'All', () => this.giveItem('all'), 0x22c55e, 50)

    this.maxScrollY = Math.max(0, y + 60 - (this.height - 180))
  }

  async jailPlayer(minutes) {
    if (!this.targetPlayerId) return

    try {
      this.showLoading('Jailing...')
      await adminService.adjustPlayerCurrency(
        this.targetPlayerId,
        'jail',
        minutes,
        `Admin jailed for ${minutes} minutes`
      )
      this.hideLoading()
      this.showSuccess(`Player jailed for ${minutes} minutes`)
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  async releasePlayer() {
    if (!this.targetPlayerId) return

    try {
      this.showLoading('Releasing...')
      await adminService.adjustPlayerCurrency(
        this.targetPlayerId,
        'jail',
        -99999,
        'Admin released from jail'
      )
      this.hideLoading()
      this.showSuccess('Player released')
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  showBanDialog(permanent) {
    // Simple confirmation for now
    this.banPlayer(permanent ? null : 24, 'Admin ban')
  }

  async banPlayer(hours, reason) {
    if (!this.targetPlayerId) return

    try {
      this.showLoading('Banning...')
      await adminService.banPlayer(this.targetPlayerId, reason, hours)
      this.hideLoading()
      this.showSuccess(hours ? `Player banned for ${hours} hours` : 'Player permanently banned')
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  async unbanPlayer() {
    if (!this.targetPlayerId) return

    try {
      this.showLoading('Unbanning...')
      await adminService.unbanPlayer(this.targetPlayerId)
      this.hideLoading()
      this.showSuccess('Player unbanned')
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  async teleportPlayer(districtId) {
    if (!this.targetPlayerId) return

    try {
      this.showLoading('Teleporting...')
      await adminService.adjustPlayerCurrency(
        this.targetPlayerId,
        'district',
        districtId,
        `Admin teleport to district ${districtId}`
      )
      this.hideLoading()
      this.showSuccess(`Player teleported to district ${districtId}`)
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  async resetCooldowns() {
    if (!this.targetPlayerId) return

    try {
      this.showLoading('Resetting cooldowns...')

      // Clear local cooldowns if targeting self
      if (this.targetPlayerId === gameManager.player?.id) {
        gameManager.cooldowns.clear()
      }

      // Also call API if available
      await adminService.adjustPlayerCurrency(
        this.targetPlayerId,
        'cooldowns',
        0,
        'Admin cooldown reset'
      )

      this.hideLoading()
      this.showSuccess('Cooldowns reset')
    } catch (error) {
      this.hideLoading()
      // Fallback success for local cooldowns
      if (this.targetPlayerId === gameManager.player?.id) {
        this.showSuccess('Local cooldowns reset')
      } else {
        this.showError(error.message)
      }
    }
  }

  async giveItem(itemType) {
    if (!this.targetPlayerId) return

    try {
      this.showLoading('Giving item...')
      await adminService.adjustPlayerCurrency(
        this.targetPlayerId,
        'item',
        itemType === 'all' ? 999 : 1,
        `Admin gave ${itemType} item`
      )
      this.hideLoading()
      this.showSuccess(`${itemType} item given`)
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  // ==========================================================================
  // DEBUG SECTION - Toggle debug controls
  // ==========================================================================

  createDebugSection() {
    let y = 20

    // Section title
    const title = this.add.text(this.centerX, y, '🔧 DEBUG CONTROLS', {
      fontSize: '16px',
      color: '#f59e0b',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentContainer.add(title)
    y += 40

    // Warning
    const warning = this.add.text(this.centerX, y, '⚠️ For testing only - use with caution', {
      fontSize: '11px',
      color: '#888888'
    }).setOrigin(0.5)
    this.contentContainer.add(warning)
    y += 35

    // Debug toggles
    const toggles = [
      { key: 'infiniteEnergy', label: 'Infinite Energy', icon: '⚡', desc: 'Never run out of energy' },
      { key: 'noCooldowns', label: 'No Cooldowns', icon: '⏱️', desc: 'Remove all action cooldowns' },
      { key: 'instantCrime', label: 'Instant Crime', icon: '🔫', desc: 'Crimes complete instantly' },
      { key: 'godMode', label: 'God Mode', icon: '🛡️', desc: 'Cannot be jailed or killed' },
      { key: 'showFPS', label: 'Show FPS', icon: '📊', desc: 'Display framerate counter' },
      { key: 'logAPICalls', label: 'Log API Calls', icon: '📡', desc: 'Log all API requests to console' },
      { key: 'skipAuth', label: 'Skip Auth', icon: '🔓', desc: 'Bypass authentication checks' },
      { key: 'instantTravel', label: 'Instant Travel', icon: '🗺️', desc: 'No travel cooldown' }
    ]

    toggles.forEach(toggle => {
      this.createToggle(toggle, y)
      y += 55
    })

    // Quick actions
    y += 15
    this.createButton(this.centerX - 90, y, 'Enable All', () => this.setAllToggles(true), 0x22c55e, 85)
    this.createButton(this.centerX + 10, y, 'Disable All', () => this.setAllToggles(false), 0xef4444, 85)

    this.maxScrollY = Math.max(0, y + 60 - (this.height - 180))
  }

  createToggle(toggle, y) {
    const container = this.add.container(0, y)

    // Background
    const bg = this.add.rectangle(this.centerX, 0, this.width - 40, 48, 0x1e293b, 0.8)
    bg.setStrokeStyle(1, 0x333333)
    container.add(bg)

    // Icon and label
    const label = this.add.text(35, -8, `${toggle.icon} ${toggle.label}`, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    container.add(label)

    // Description
    const desc = this.add.text(35, 10, toggle.desc, {
      fontSize: '11px',
      color: '#666666'
    })
    container.add(desc)

    // Toggle switch
    const isOn = this.debugToggles[toggle.key]
    const switchBg = this.add.rectangle(this.width - 70, 0, 50, 26, isOn ? 0x22c55e : 0x4a5568)
      .setInteractive({ useHandCursor: true })

    const switchKnob = this.add.circle(isOn ? this.width - 55 : this.width - 85, 0, 10, 0xffffff)

    // ON/OFF text
    const statusText = this.add.text(this.width - 70, 0, isOn ? 'ON' : 'OFF', {
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    container.add([switchBg, switchKnob, statusText])

    // Toggle interaction
    switchBg.on('pointerdown', () => {
      audioManager.playClick()
      this.debugToggles[toggle.key] = !this.debugToggles[toggle.key]
      this.saveDebugToggles()
      this.applyDebugToggle(toggle.key, this.debugToggles[toggle.key])
      this.showSection('debug') // Refresh
    })

    this.contentContainer.add(container)
  }

  setAllToggles(value) {
    Object.keys(this.debugToggles).forEach(key => {
      this.debugToggles[key] = value
      this.applyDebugToggle(key, value)
    })
    this.saveDebugToggles()
    this.showSection('debug')
    this.showSuccess(value ? 'All debug modes enabled' : 'All debug modes disabled')
  }

  applyDebugToggle(key, value) {
    // Apply the toggle effect
    switch (key) {
      case 'infiniteEnergy':
        // Set player energy to max if enabled
        if (value && gameManager.player) {
          gameManager.player.energy = 100
          gameManager.emit('playerUpdated', gameManager.player)
        }
        break

      case 'noCooldowns':
        // Clear all cooldowns if enabled
        if (value) {
          gameManager.cooldowns.clear()
        }
        break

      case 'showFPS':
        // Toggle FPS display (would need to be implemented in game loop)
        if (this.scene.get('GameScene')) {
          // Could set a debug flag here
        }
        break

      case 'logAPICalls':
        // This would be checked in the API service
        window.__DEBUG_LOG_API = value
        break

      default:
        // Store in gameManager for other systems to check
        if (!gameManager.debugFlags) gameManager.debugFlags = {}
        gameManager.debugFlags[key] = value
        break
    }
  }

  // ==========================================================================
  // DATABASE SECTION - Database actions and management
  // ==========================================================================

  createDatabaseSection() {
    let y = 20

    // Section title
    const title = this.add.text(this.centerX, y, '🗄️ DATABASE ACTIONS', {
      fontSize: '16px',
      color: '#3b82f6',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentContainer.add(title)
    y += 50

    // View All Players
    this.createActionCard(y, {
      icon: '👥',
      title: 'VIEW ALL PLAYERS',
      desc: 'Browse and search all registered players',
      action: () => this.viewAllPlayers()
    })
    y += 80

    // Trigger Event
    this.createActionCard(y, {
      icon: '🎉',
      title: 'TRIGGER EVENT',
      desc: 'Manually trigger a game-wide event',
      action: () => this.showEventTriggerDialog()
    })
    y += 80

    // Broadcast Message
    this.createActionCard(y, {
      icon: '📢',
      title: 'BROADCAST MESSAGE',
      desc: 'Send a message to all online players',
      action: () => this.showBroadcastDialog()
    })
    y += 80

    // Refresh Data
    this.createActionCard(y, {
      icon: '🔄',
      title: 'REFRESH DATA',
      desc: 'Force refresh all cached game data',
      action: () => this.refreshAllData()
    })
    y += 80

    // Game Stats
    this.createActionCard(y, {
      icon: '📈',
      title: 'GAME STATISTICS',
      desc: 'View overall game stats and metrics',
      action: () => this.showGameStats()
    })
    y += 80

    // Economy Report
    this.createActionCard(y, {
      icon: '💰',
      title: 'ECONOMY REPORT',
      desc: 'View economy health and balance report',
      action: () => this.showEconomyReport()
    })

    this.maxScrollY = Math.max(0, y + 80 - (this.height - 180))
  }

  createActionCard(y, { icon, title, desc, action }) {
    const card = this.add.container(0, y)

    // Card background
    const bg = this.add.rectangle(this.centerX, 25, this.width - 40, 65, 0x1e293b)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(1, 0x333333)

    // Icon
    const iconText = this.add.text(40, 25, icon, {
      fontSize: '28px'
    }).setOrigin(0.5)

    // Title
    const titleText = this.add.text(75, 12, title, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    })

    // Description
    const descText = this.add.text(75, 32, desc, {
      fontSize: '11px',
      color: '#888888'
    })

    // Arrow indicator
    const arrow = this.add.text(this.width - 50, 25, '→', {
      fontSize: '20px',
      color: '#4a5568'
    }).setOrigin(0.5)

    card.add([bg, iconText, titleText, descText, arrow])

    // Hover effects
    bg.on('pointerover', () => {
      bg.setFillStyle(0x2a2a4a)
      arrow.setColor('#ffffff')
      audioManager.playHover()
    })

    bg.on('pointerout', () => {
      bg.setFillStyle(0x1e293b)
      arrow.setColor('#4a5568')
    })

    bg.on('pointerdown', () => {
      audioManager.playClick()
      action()
    })

    this.contentContainer.add(card)
  }

  async viewAllPlayers() {
    try {
      this.showLoading('Loading players...')
      const players = await adminService.getPlayers({ limit: 50 })
      this.hideLoading()

      // Show players modal
      this.showPlayersListModal(players || [])
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  showPlayersListModal(players) {
    // Create modal overlay
    const modal = this.add.container(this.centerX, this.centerY).setDepth(3000)

    // Dark background
    const overlay = this.add.rectangle(0, 0, this.width * 2, this.height * 2, 0x000000, 0.9)
      .setInteractive()
    modal.add(overlay)

    // Modal box
    const modalBg = this.add.rectangle(0, 0, this.width - 30, this.height - 100, 0x1a1a2e)
      .setStrokeStyle(2, 0x3b82f6)
    modal.add(modalBg)

    // Title
    const title = this.add.text(0, -this.height / 2 + 80, `👥 All Players (${players.length})`, {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    modal.add(title)

    // Close button
    const closeBtn = this.add.text(this.width / 2 - 40, -this.height / 2 + 80, '✕', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => modal.destroy())
    modal.add(closeBtn)

    // Players list
    let listY = -this.height / 2 + 120
    players.slice(0, 10).forEach((player, index) => {
      const row = this.add.text(-(this.width / 2) + 40, listY,
        `${index + 1}. ${player.username} - Lv${player.level} - ${formatMoney(player.cash || 0)}`, {
        fontSize: '12px',
        color: player.is_banned ? '#ef4444' : '#ffffff'
      })
      modal.add(row)
      listY += 30
    })

    if (players.length > 10) {
      const more = this.add.text(0, listY + 10, `... and ${players.length - 10} more`, {
        fontSize: '11px',
        color: '#888888'
      }).setOrigin(0.5)
      modal.add(more)
    }

    // Click outside to close
    overlay.on('pointerdown', () => modal.destroy())
  }

  showEventTriggerDialog() {
    const events = [
      { type: 'double_xp', name: '2x XP Event' },
      { type: 'double_cash', name: '2x Cash Event' },
      { type: 'heat_wave', name: 'Heat Wave (Police Crackdown)' },
      { type: 'black_market', name: 'Black Market Opens' }
    ]

    // Create modal
    const modal = this.add.container(this.centerX, this.centerY).setDepth(3000)

    const overlay = this.add.rectangle(0, 0, this.width * 2, this.height * 2, 0x000000, 0.9)
      .setInteractive()
    modal.add(overlay)

    const modalBg = this.add.rectangle(0, 0, 280, 250, 0x1a1a2e)
      .setStrokeStyle(2, 0xf59e0b)
    modal.add(modalBg)

    const title = this.add.text(0, -100, '🎉 Trigger Event', {
      fontSize: '18px',
      color: '#f59e0b',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    modal.add(title)

    let btnY = -50
    events.forEach(event => {
      const btn = this.add.rectangle(0, btnY, 200, 35, 0x2a2a4a)
        .setInteractive({ useHandCursor: true })
      const label = this.add.text(0, btnY, event.name, {
        fontSize: '13px',
        color: '#ffffff'
      }).setOrigin(0.5)

      btn.on('pointerover', () => btn.setFillStyle(0x3b82f6))
      btn.on('pointerout', () => btn.setFillStyle(0x2a2a4a))
      btn.on('pointerdown', async () => {
        modal.destroy()
        await this.triggerEvent(event.type)
      })

      modal.add([btn, label])
      btnY += 45
    })

    overlay.on('pointerdown', () => modal.destroy())
  }

  async triggerEvent(eventType) {
    try {
      this.showLoading('Triggering event...')
      await adminService.broadcastMessage(`Event triggered: ${eventType}`, 'event')
      this.hideLoading()
      this.showSuccess(`${eventType} event triggered!`)
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  showBroadcastDialog() {
    // Create modal
    const modal = this.add.container(this.centerX, this.centerY).setDepth(3000)

    const overlay = this.add.rectangle(0, 0, this.width * 2, this.height * 2, 0x000000, 0.9)
      .setInteractive()
    modal.add(overlay)

    const modalBg = this.add.rectangle(0, 0, 300, 200, 0x1a1a2e)
      .setStrokeStyle(2, 0x22c55e)
    modal.add(modalBg)

    const title = this.add.text(0, -70, '📢 Broadcast Message', {
      fontSize: '18px',
      color: '#22c55e',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    modal.add(title)

    // Input field
    const input = this.add.dom(0, -10).createFromHTML(`
      <input type="text" id="broadcast-msg" placeholder="Enter message..."
        style="width: 240px; padding: 12px; font-size: 14px; border: none; border-radius: 8px; background: #2a2a4a; color: #ffffff;">
    `)
    modal.add(input)

    // Send button
    const sendBtn = this.add.rectangle(0, 60, 120, 40, 0x22c55e)
      .setInteractive({ useHandCursor: true })
    const sendLabel = this.add.text(0, 60, 'Send', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    sendBtn.on('pointerdown', async () => {
      const msg = input.getChildByID('broadcast-msg')?.value
      if (msg) {
        modal.destroy()
        await this.broadcastMessage(msg)
      }
    })

    modal.add([sendBtn, sendLabel])
    overlay.on('pointerdown', () => modal.destroy())
  }

  async broadcastMessage(message) {
    try {
      this.showLoading('Broadcasting...')
      await adminService.broadcastMessage(message, 'info')
      this.hideLoading()
      this.showSuccess('Message broadcast sent!')
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  async refreshAllData() {
    try {
      this.showLoading('Refreshing data...')
      await gameManager.refreshGameState()
      this.targetPlayer = { ...gameManager.player }
      this.hideLoading()
      this.showSuccess('All data refreshed!')
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  async showGameStats() {
    try {
      this.showLoading('Loading stats...')
      const stats = await adminService.getGameStats()
      this.hideLoading()

      // Show stats modal
      const modal = this.add.container(this.centerX, this.centerY).setDepth(3000)

      const overlay = this.add.rectangle(0, 0, this.width * 2, this.height * 2, 0x000000, 0.9)
        .setInteractive()
        .on('pointerdown', () => modal.destroy())
      modal.add(overlay)

      const modalBg = this.add.rectangle(0, 0, 280, 300, 0x1a1a2e)
        .setStrokeStyle(2, 0x8b5cf6)
      modal.add(modalBg)

      const title = this.add.text(0, -120, '📈 Game Statistics', {
        fontSize: '18px',
        color: '#8b5cf6',
        fontStyle: 'bold'
      }).setOrigin(0.5)
      modal.add(title)

      // Stats display
      const statsList = [
        { label: 'Total Players', value: stats?.total_players || '---' },
        { label: 'Active Today', value: stats?.active_today || '---' },
        { label: 'Online Now', value: stats?.online_now || '---' },
        { label: 'Total Crimes', value: stats?.total_crimes || '---' },
        { label: 'Total Cash', value: formatMoney(stats?.total_cash || 0) }
      ]

      let statY = -70
      statsList.forEach(stat => {
        const row = this.add.text(-100, statY, `${stat.label}:`, {
          fontSize: '13px',
          color: '#888888'
        })
        const val = this.add.text(100, statY, `${stat.value}`, {
          fontSize: '13px',
          color: '#ffffff',
          fontStyle: 'bold'
        }).setOrigin(1, 0)
        modal.add([row, val])
        statY += 35
      })

    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  async showEconomyReport() {
    try {
      this.showLoading('Loading economy...')
      const report = await adminService.getEconomyReport()
      this.hideLoading()

      // Show report modal
      const modal = this.add.container(this.centerX, this.centerY).setDepth(3000)

      const overlay = this.add.rectangle(0, 0, this.width * 2, this.height * 2, 0x000000, 0.9)
        .setInteractive()
        .on('pointerdown', () => modal.destroy())
      modal.add(overlay)

      const modalBg = this.add.rectangle(0, 0, 300, 320, 0x1a1a2e)
        .setStrokeStyle(2, 0xf59e0b)
      modal.add(modalBg)

      const title = this.add.text(0, -130, '💰 Economy Report', {
        fontSize: '18px',
        color: '#f59e0b',
        fontStyle: 'bold'
      }).setOrigin(0.5)
      modal.add(title)

      const metrics = [
        { label: 'Total Cash in Game', value: formatMoney(report?.total_cash || 0), color: '#22c55e' },
        { label: 'Total Bank Deposits', value: formatMoney(report?.total_bank || 0), color: '#3b82f6' },
        { label: 'Cash Sinks (24h)', value: formatMoney(report?.cash_sinks_24h || 0), color: '#ef4444' },
        { label: 'Cash Sources (24h)', value: formatMoney(report?.cash_sources_24h || 0), color: '#22c55e' },
        { label: 'Avg Player Cash', value: formatMoney(report?.avg_player_cash || 0), color: '#8b5cf6' },
        { label: 'Economy Health', value: report?.health || 'Unknown', color: '#f59e0b' }
      ]

      let metricY = -80
      metrics.forEach(m => {
        const label = this.add.text(-120, metricY, m.label, {
          fontSize: '12px',
          color: '#888888'
        })
        const val = this.add.text(120, metricY, m.value, {
          fontSize: '12px',
          color: m.color,
          fontStyle: 'bold'
        }).setOrigin(1, 0)
        modal.add([label, val])
        metricY += 32
      })

    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  // ==========================================================================
  // LOGS SECTION - View admin action logs
  // ==========================================================================

  createLogsSection() {
    let y = 20

    // Refresh button
    this.createButton(this.width - 80, y, 'Refresh', () => this.loadLogs(), 0x3b82f6, 70)

    // Title
    this.add.text(30, y + 5, '📋 Recent Admin Actions', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    this.contentContainer.add(this.children.list[this.children.list.length - 1])
    y += 50

    // Load and display logs
    this.logsContainer = this.add.container(0, y)
    this.contentContainer.add(this.logsContainer)

    this.loadLogs()
  }

  async loadLogs() {
    try {
      this.showLoading('Loading logs...')
      this.logs = await adminService.getActivityLogs({ limit: 20 })
      this.hideLoading()
      this.displayLogs()
    } catch (error) {
      this.hideLoading()

      // Show mock logs for demo
      this.logs = [
        { action: 'adjust_stat', target: 'Player1', details: '+$10,000 cash', timestamp: new Date() },
        { action: 'jail', target: 'Player2', details: 'Jailed for 60 min', timestamp: new Date(Date.now() - 3600000) },
        { action: 'ban', target: 'Player3', details: 'Permanent ban - cheating', timestamp: new Date(Date.now() - 86400000) }
      ]
      this.displayLogs()
    }
  }

  displayLogs() {
    this.logsContainer.removeAll(true)

    if (!this.logs || this.logs.length === 0) {
      const noLogs = this.add.text(this.centerX, 30, 'No logs found', {
        fontSize: '14px',
        color: '#888888'
      }).setOrigin(0.5)
      this.logsContainer.add(noLogs)
      return
    }

    let y = 0
    this.logs.forEach((log, index) => {
      const logContainer = this.add.container(0, y)

      // Background
      const bg = this.add.rectangle(this.centerX, 25, this.width - 40, 50, index % 2 === 0 ? 0x1e293b : 0x2a2a4a, 0.8)
      logContainer.add(bg)

      // Action type
      const actionIcon = this.getActionIcon(log.action)
      const action = this.add.text(30, 10, `${actionIcon} ${log.action}`, {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold'
      })
      logContainer.add(action)

      // Details
      const details = this.add.text(30, 30, `${log.target || 'Unknown'}: ${log.details || ''}`, {
        fontSize: '11px',
        color: '#888888'
      })
      logContainer.add(details)

      // Timestamp
      const time = this.add.text(this.width - 50, 20, this.formatTimestamp(log.timestamp), {
        fontSize: '10px',
        color: '#4a5568'
      }).setOrigin(1, 0.5)
      logContainer.add(time)

      this.logsContainer.add(logContainer)
      y += 55
    })

    this.maxScrollY = Math.max(0, y - (this.height - 220))
  }

  getActionIcon(action) {
    const icons = {
      adjust_stat: '📊',
      jail: '⛓️',
      release: '🔓',
      ban: '🚫',
      unban: '✅',
      teleport: '🗺️',
      give_item: '🎁',
      reset: '🔄'
    }
    return icons[action] || '⚡'
  }

  formatTimestamp(timestamp) {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
  }

  // ==========================================================================
  // UI HELPERS
  // ==========================================================================

  createButton(x, y, text, callback, color = 0x4a4a6a, width = 100) {
    const btn = this.add.rectangle(x, y, width, 35, color)
      .setInteractive({ useHandCursor: true })

    btn.on('pointerover', () => {
      btn.setFillStyle(Phaser.Display.Color.ValueToColor(color).lighten(20).color)
      audioManager.playHover()
    })
    btn.on('pointerout', () => btn.setFillStyle(color))
    btn.on('pointerdown', () => {
      audioManager.playClick()
      callback()
    })

    const label = this.add.text(x, y, text, {
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5)

    this.contentContainer.add([btn, label])
    return btn
  }

  showSuccess(message) {
    const toast = this.add.rectangle(this.centerX, this.height - 100, 300, 40, 0x22c55e, 0.95)
      .setDepth(2000)

    const text = this.add.text(this.centerX, this.height - 100, message, {
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(2001)

    this.time.delayedCall(2000, () => {
      toast.destroy()
      text.destroy()
    })
  }

  showError(message) {
    const toast = this.add.rectangle(this.centerX, this.height - 100, 300, 40, 0xef4444, 0.95)
      .setDepth(2000)

    const text = this.add.text(this.centerX, this.height - 100, message, {
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(2001)

    this.time.delayedCall(3000, () => {
      toast.destroy()
      text.destroy()
    })
  }

  // ==========================================================================
  // SCROLLING
  // ==========================================================================

  setupScrolling() {
    // Enable drag scrolling on content area
    this.input.on('pointermove', (pointer) => {
      if (pointer.isDown && this.maxScrollY > 0) {
        const dy = pointer.prevPosition.y - pointer.y
        this.scrollY = Phaser.Math.Clamp(this.scrollY + dy, 0, this.maxScrollY)
        this.contentContainer.y = 140 - this.scrollY
      }
    })

    // Mouse wheel support
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (this.maxScrollY > 0) {
        this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScrollY)
        this.contentContainer.y = 140 - this.scrollY
      }
    })
  }

  shutdown() {
    super.shutdown()
    this.contentContainer?.removeAll(true)
    this.logsContainer?.removeAll(true)
  }
}

export default AdminScene
