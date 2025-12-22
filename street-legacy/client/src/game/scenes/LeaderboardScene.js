import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { COLORS } from '../../utils/constants'
import { aiPlayerManager } from '../managers/AIPlayerManager.js'
import { getPersonality } from '../data/AIPersonalities.js'
import { DEPTH } from '../ui/NetworkTheme'

// Local storage helpers
const getPlayerData = () => {
  try {
    const data = localStorage.getItem('street_legacy_player')
    return data ? JSON.parse(data) : null
  } catch (e) {
    return null
  }
}

/**
 * LeaderboardScene - Global player rankings
 *
 * Categories:
 * - Respect: Total respect/reputation earned
 * - Wealth: Total cash + bank balance
 * - Level: Player level and XP
 *
 * Features:
 * - Tab navigation for categories
 * - Scrollable list of top 50 players
 * - Current player highlighted with gold border
 * - Player rank shown if not in top 50
 * - Pull-to-refresh functionality
 * - Local storage with persistent NPC players
 */
export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LeaderboardScene' })
    // Leaderboard now uses AI players from AIPlayerManager
  }

  async create() {
    const { width, height } = this.cameras.main

    // Constants
    this.ENTRY_HEIGHT = 60
    this.ENTRY_PADDING = 8
    this.SCROLL_START_Y = 145
    this.SCROLL_END_Y = height - 70

    // Category configuration
    this.CATEGORIES = {
      respect: {
        label: 'Respect',
        icon: '⭐',
        color: 0xf59e0b,
        valueKey: 'respect',
        format: (val) => (val || 0).toLocaleString()
      },
      wealth: {
        label: 'Wealth',
        icon: '💰',
        color: 0x22c55e,
        valueKey: 'wealth',
        format: (val) => formatMoney(val || 0)
      },
      level: {
        label: 'Level',
        icon: '📈',
        color: 0x3b82f6,
        valueKey: 'level',
        format: (val) => `Lv.${val || 1}`
      }
    }

    // Rank icons for top 3
    this.RANK_ICONS = {
      1: '👑',
      2: '🥈',
      3: '🥉'
    }

    // State
    this.entries = []
    this.playerRank = null
    this.contentItems = []
    this.scrollOffset = 0
    this.activeCategory = 'respect'
    this.isLoading = true
    this.isRefreshing = false

    // FULL opaque background - covers everything underneath
    this.add.rectangle(0, 0, width, height, 0x0a0a15, 1).setOrigin(0).setDepth(100).setInteractive()

    // Create UI
    this.createHeader()
    this.createTabs()
    this.createCloseButton()
    this.createRefreshButton()
    this.setupScrolling()

    // Loading spinner
    this.createLoadingSpinner()

    // Load data
    await this.loadLeaderboardData()
  }

  createHeader() {
    const { width } = this.cameras.main

    // Title
    this.add.text(width / 2, 30, '🏆 LEADERBOARDS', {
      fontSize: '24px',
      color: '#f59e0b',
      fontFamily: 'Arial Black, Arial'
    }).setOrigin(0.5)

    // Subtitle
    this.subtitleText = this.add.text(width / 2, 58, 'Top players by Respect', {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(0.5)

    // Horizontal divider
    this.add.rectangle(width / 2, 78, width - 40, 1, 0x333333)
  }

  createTabs() {
    const { width } = this.cameras.main
    const tabY = 105
    const tabWidth = 100
    const tabSpacing = 10

    this.tabs = {}

    const categories = Object.keys(this.CATEGORIES)
    const totalWidth = categories.length * tabWidth + (categories.length - 1) * tabSpacing
    const startX = width / 2 - totalWidth / 2 + tabWidth / 2

    categories.forEach((key, index) => {
      const config = this.CATEGORIES[key]
      const x = startX + index * (tabWidth + tabSpacing)
      const isActive = key === this.activeCategory

      const bg = this.add.rectangle(x, tabY, tabWidth, 32, isActive ? config.color : 0x2a2a4a, 0.95)
        .setInteractive({ useHandCursor: true })

      const text = this.add.text(x, tabY, `${config.icon} ${config.label}`, {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: isActive ? 'bold' : 'normal'
      }).setOrigin(0.5)

      bg.on('pointerover', () => {
        if (this.activeCategory !== key) {
          bg.setFillStyle(0x3a4a5a, 0.95)
        }
      })

      bg.on('pointerout', () => {
        if (this.activeCategory !== key) {
          bg.setFillStyle(0x2a2a4a, 0.95)
        }
      })

      bg.on('pointerdown', () => {
        if (!this.isLoading) {
          this.switchCategory(key)
        }
      })

      this.tabs[key] = { bg, text, config }
    })
  }

  switchCategory(category) {
    if (this.activeCategory === category) return

    this.activeCategory = category
    this.scrollOffset = 0

    // Update tab styles
    Object.keys(this.tabs).forEach(key => {
      const isActive = key === category
      const config = this.CATEGORIES[key]
      this.tabs[key].bg.setFillStyle(isActive ? config.color : 0x2a2a4a, 0.95)
      this.tabs[key].text.setStyle({ fontStyle: isActive ? 'bold' : 'normal' })
    })

    // Update subtitle
    this.subtitleText.setText(`Top players by ${this.CATEGORIES[category].label}`)

    // Reload data
    this.loadLeaderboardData()
  }

  createCloseButton() {
    const { width } = this.cameras.main

    const closeBtn = this.add.text(width - 25, 25, '✕', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial'
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.CLOSE_BUTTON)
    .setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => {
      closeBtn.setColor('#ef4444')
      closeBtn.setScale(1.2)
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor('#ffffff')
      closeBtn.setScale(1)
    })
    closeBtn.on('pointerdown', () => {
      console.log('[LeaderboardScene] Close button clicked')
      this.closeScene()
    })
  }

  createRefreshButton() {
    const { width, height } = this.cameras.main

    // Refresh button at bottom
    const refreshBg = this.add.rectangle(width / 2, height - 35, 120, 36, 0x2a2a4a, 0.95)
      .setInteractive({ useHandCursor: true })

    this.refreshText = this.add.text(width / 2, height - 35, '🔄 Refresh', {
      fontSize: '13px',
      color: '#ffffff'
    }).setOrigin(0.5)

    refreshBg.on('pointerover', () => refreshBg.setFillStyle(0x3a4a5a, 0.95))
    refreshBg.on('pointerout', () => refreshBg.setFillStyle(0x2a2a4a, 0.95))
    refreshBg.on('pointerdown', () => {
      if (!this.isLoading && !this.isRefreshing) {
        this.refreshLeaderboard()
      }
    })

    this.refreshBg = refreshBg
  }

  createLoadingSpinner() {
    const { width, height } = this.cameras.main
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    // Loading container
    this.loadingContainer = this.add.container(width / 2, centerY)

    // Spinner circle
    this.spinner = this.add.circle(0, -20, 20, 0x333333, 0)
    this.spinner.setStrokeStyle(3, 0xf59e0b)
    this.loadingContainer.add(this.spinner)

    // Loading text
    this.loadingText = this.add.text(0, 20, 'Loading...', {
      fontSize: '14px',
      color: '#888888'
    }).setOrigin(0.5)
    this.loadingContainer.add(this.loadingText)

    // Spin animation
    this.tweens.add({
      targets: this.spinner,
      angle: 360,
      duration: 1000,
      repeat: -1
    })
  }

  hideLoadingSpinner() {
    if (this.loadingContainer) {
      this.loadingContainer.setVisible(false)
    }
  }

  showLoadingSpinner() {
    if (this.loadingContainer) {
      this.loadingContainer.setVisible(true)
    }
  }

  setupScrolling() {
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.isLoading) {
        this.scrollOffset = Math.max(0, this.scrollOffset + deltaY * 0.5)
        this.renderContent()
      }
    })

    // Touch scrolling
    let startY = 0
    let startOffset = 0

    this.input.on('pointerdown', (pointer) => {
      if (pointer.y > this.SCROLL_START_Y && pointer.y < this.SCROLL_END_Y) {
        startY = pointer.y
        startOffset = this.scrollOffset
      }
    })

    this.input.on('pointermove', (pointer) => {
      if (pointer.isDown && startY > 0 && !this.isLoading) {
        const deltaY = startY - pointer.y
        this.scrollOffset = Math.max(0, startOffset + deltaY)
        this.renderContent()
      }
    })

    this.input.on('pointerup', () => {
      startY = 0
    })
  }

  async loadLeaderboardData() {
    this.isLoading = true
    this.showLoadingSpinner()
    this.clearContent()

    try {
      // Try to load from backend
      let result
      try {
        result = await gameManager.getLeaderboard(this.activeCategory, 50)
      } catch (e) {
        // Generate mock data if backend not available
        result = this.generateMockData()
      }

      this.entries = result.entries || result || []
      this.playerRank = result.player_rank || null

      // If player not in entries, try to get their rank
      const player = gameManager.player
      const playerInList = this.entries.find(e => e.player_id === player?.id || e.username === player?.username)

      if (!playerInList && player) {
        try {
          const rankResult = await gameManager.getPlayerRank(this.activeCategory)
          this.playerRank = rankResult?.rank || null
        } catch (e) {
          // Calculate approximate rank from mock data
          this.playerRank = Math.floor(Math.random() * 450) + 51
        }
      }

      this.isLoading = false
      this.hideLoadingSpinner()
      this.renderContent()
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
      this.isLoading = false
      this.hideLoadingSpinner()
      this.renderError()
    }
  }

  generateMockData() {
    const player = gameManager.player || getPlayerData() || {}

    // Ensure AI players are initialized
    aiPlayerManager.initialize()

    // Get AI players for leaderboard
    const aiPlayers = aiPlayerManager.getAll()

    // Get player's value for current category
    const playerValue = this.getPlayerValue()
    const playerLevel = player.level || 1

    // Build entries list with AI players
    const entries = aiPlayers.map(ai => {
      const personality = getPersonality(ai.personality)
      let value = 0

      // Get value based on category
      switch (this.activeCategory) {
        case 'respect':
          value = ai.respect || 0
          break
        case 'wealth':
          value = (ai.cash || 0) + (ai.bank || 0)
          break
        case 'level':
          value = ai.level || 1
          break
      }

      return {
        player_id: ai.id,
        username: ai.username,
        level: ai.level || 1,
        value: value,
        crew_name: ai.crew_name || null,
        isAI: true,
        personality: ai.personality,
        personalityIcon: personality?.icon || '👤'
      }
    })

    // Add player to entries
    entries.push({
      player_id: player.id || 'local_player',
      username: player.username || player.name || 'You',
      level: playerLevel,
      value: playerValue,
      crew_name: player.crew_name || null,
      isAI: false
    })

    // Sort by value descending
    entries.sort((a, b) => b.value - a.value)

    // Reassign ranks after sorting
    entries.forEach((e, i) => e.rank = i + 1)

    // Get player's rank
    const playerEntry = entries.find(e =>
      e.player_id === (player.id || 'local_player') ||
      e.username === (player.username || player.name || 'You')
    )
    const playerRank = playerEntry ? playerEntry.rank : null

    // Return top 50
    return {
      entries: entries.slice(0, 50),
      player_rank: playerRank > 50 ? playerRank : null
    }
  }

  getPlayerValue() {
    const player = gameManager.player || getPlayerData() || {}

    switch (this.activeCategory) {
      case 'respect':
        return player.respect || player.reputation || player.rep || 0
      case 'wealth':
        return (player.cash || 0) + (player.bank || player.bankBalance || 0)
      case 'level':
        return player.level || 1
      default:
        return 0
    }
  }

  async refreshLeaderboard() {
    this.isRefreshing = true
    this.refreshText.setText('🔄 ...')

    await this.loadLeaderboardData()

    this.isRefreshing = false
    this.refreshText.setText('🔄 Refresh')
  }

  clearContent() {
    this.contentItems.forEach(item => item.destroy())
    this.contentItems = []

    // Clean up player glow tween
    if (this.playerGlowTween) {
      this.playerGlowTween.stop()
      this.playerGlowTween = null
    }
  }

  renderContent() {
    this.clearContent()

    if (this.isLoading) return

    if (this.entries.length === 0) {
      this.renderEmptyState()
      return
    }

    this.renderEntries()
    this.renderPlayerRankBar()
  }

  renderEntries() {
    const { width } = this.cameras.main
    const player = gameManager.player

    let y = this.SCROLL_START_Y - this.scrollOffset

    this.entries.forEach((entry, index) => {
      const entryY = y + index * (this.ENTRY_HEIGHT + this.ENTRY_PADDING)

      // Only render visible entries
      if (entryY + this.ENTRY_HEIGHT > this.SCROLL_START_Y - 20 && entryY < this.SCROLL_END_Y + 20) {
        const isCurrentPlayer = entry.player_id === player?.id ||
          entry.username === player?.username ||
          entry.username === 'You'

        this.renderEntry(entry, entryY, isCurrentPlayer)
      }
    })
  }

  renderEntry(entry, y, isCurrentPlayer) {
    const { width } = this.cameras.main
    const config = this.CATEGORIES[this.activeCategory]

    // Determine background color
    // Top 3 get special colored backgrounds
    // Others alternate between darker/lighter
    let bgColor, bgAlpha = 0.98
    const rankBgColors = {
      1: 0x4a3a00, // Gold-tinted background
      2: 0x3a3a3a, // Silver-tinted background
      3: 0x3a2a1a  // Bronze-tinted background
    }

    if (entry.rank <= 3) {
      bgColor = rankBgColors[entry.rank]
    } else if (isCurrentPlayer) {
      bgColor = 0x3a3a1a // Golden tint for current player
    } else {
      // Alternating row colors
      bgColor = entry.rank % 2 === 0 ? 0x1e1e2e : 0x252535
    }

    // Entry background
    const entryBg = this.add.rectangle(width / 2, y + this.ENTRY_HEIGHT / 2,
      width - 40, this.ENTRY_HEIGHT - 5, bgColor, bgAlpha)

    // Border styles
    if (isCurrentPlayer) {
      // Gold border with glow effect for current player
      entryBg.setStrokeStyle(2, 0xf59e0b)
    } else if (entry.rank <= 3) {
      const rankColors = { 1: 0xffd700, 2: 0xc0c0c0, 3: 0xcd7f32 }
      entryBg.setStrokeStyle(2, rankColors[entry.rank], 0.9)
    }

    this.contentItems.push(entryBg)

    // Glow effect for current player - outer glow
    if (isCurrentPlayer) {
      const glowOuter = this.add.rectangle(width / 2, y + this.ENTRY_HEIGHT / 2,
        width - 30, this.ENTRY_HEIGHT + 5, 0xf59e0b, 0.15)
      glowOuter.setDepth(-1)
      this.contentItems.push(glowOuter)

      // Animated pulse for current player
      if (!this.playerGlowTween) {
        this.playerGlowTween = this.tweens.add({
          targets: glowOuter,
          alpha: { from: 0.15, to: 0.3 },
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        })
      }
    }

    // Glow effect for top 3
    if (entry.rank <= 3 && !isCurrentPlayer) {
      const glowColors = { 1: 0xffd700, 2: 0xc0c0c0, 3: 0xcd7f32 }
      const glowAlphas = { 1: 0.12, 2: 0.08, 3: 0.08 }
      const glow = this.add.rectangle(width / 2, y + this.ENTRY_HEIGHT / 2,
        width - 32, this.ENTRY_HEIGHT + 2, glowColors[entry.rank], glowAlphas[entry.rank])
      glow.setDepth(-1)
      this.contentItems.push(glow)
    }

    // Rank number or icon
    const rankX = 40
    if (this.RANK_ICONS[entry.rank]) {
      const rankIcon = this.add.text(rankX, y + this.ENTRY_HEIGHT / 2, this.RANK_ICONS[entry.rank], {
        fontSize: '24px'
      }).setOrigin(0.5)
      this.contentItems.push(rankIcon)
    } else {
      const rankText = this.add.text(rankX, y + this.ENTRY_HEIGHT / 2, `#${entry.rank}`, {
        fontSize: '14px',
        color: entry.rank <= 10 ? '#ffffff' : '#888888',
        fontStyle: entry.rank <= 10 ? 'bold' : 'normal'
      }).setOrigin(0.5)
      this.contentItems.push(rankText)
    }

    // Username with AI indicator
    const nameX = 75
    const username = entry.username || 'Unknown'
    const displayName = username.length > 12 ? username.substring(0, 12) + '...' : username

    // Show AI personality icon before name for AI players
    if (entry.isAI && entry.personalityIcon) {
      const aiIcon = this.add.text(nameX, y + 15, entry.personalityIcon, {
        fontSize: '12px'
      })
      this.contentItems.push(aiIcon)
    }

    const nameTextX = entry.isAI && entry.personalityIcon ? nameX + 20 : nameX
    const nameText = this.add.text(nameTextX, y + 15, displayName, {
      fontSize: '14px',
      color: isCurrentPlayer ? '#f59e0b' : '#ffffff',
      fontStyle: isCurrentPlayer || entry.rank <= 3 ? 'bold' : 'normal'
    })
    this.contentItems.push(nameText)

    // "YOU" label if current player
    if (isCurrentPlayer) {
      const youBadge = this.add.rectangle(nameTextX + nameText.width + 12, y + 15, 35, 16, 0xf59e0b, 0.9)
      this.contentItems.push(youBadge)

      const youText = this.add.text(nameTextX + nameText.width + 12, y + 15, 'YOU', {
        fontSize: '9px',
        color: '#000000',
        fontStyle: 'bold'
      }).setOrigin(0.5)
      this.contentItems.push(youText)
    }

    // Crew name (if exists)
    if (entry.crew_name) {
      const crewText = this.add.text(nameX, y + 35, `[${entry.crew_name}]`, {
        fontSize: '10px',
        color: '#06b6d4'
      })
      this.contentItems.push(crewText)
    } else {
      // Show level if no crew
      const levelInfoText = this.add.text(nameX, y + 35, `Level ${entry.level || 1}`, {
        fontSize: '10px',
        color: '#888888'
      })
      this.contentItems.push(levelInfoText)
    }

    // Level badge
    const levelX = width - 130
    const levelBadge = this.add.rectangle(levelX, y + this.ENTRY_HEIGHT / 2, 45, 22, 0x3b82f6, 0.8)
    this.contentItems.push(levelBadge)

    const levelText = this.add.text(levelX, y + this.ENTRY_HEIGHT / 2, `Lv.${entry.level || 1}`, {
      fontSize: '10px',
      color: '#ffffff'
    }).setOrigin(0.5)
    this.contentItems.push(levelText)

    // Score value
    const valueX = width - 50
    const formattedValue = config.format(entry.value)

    // Get color for value based on rank
    let valueColor = '#ffffff'
    if (entry.rank === 1) valueColor = '#ffd700'
    else if (entry.rank === 2) valueColor = '#c0c0c0'
    else if (entry.rank === 3) valueColor = '#cd7f32'

    const valueText = this.add.text(valueX, y + this.ENTRY_HEIGHT / 2, formattedValue, {
      fontSize: '14px',
      color: valueColor,
      fontStyle: entry.rank <= 3 ? 'bold' : 'normal'
    }).setOrigin(1, 0.5)
    this.contentItems.push(valueText)

    // Category icon for top 3
    if (entry.rank <= 3) {
      const iconText = this.add.text(valueX - valueText.width - 8, y + this.ENTRY_HEIGHT / 2, config.icon, {
        fontSize: '12px'
      }).setOrigin(1, 0.5)
      this.contentItems.push(iconText)
    }
  }

  renderPlayerRankBar() {
    const { width, height } = this.cameras.main
    const player = gameManager.player

    // Check if player is in the displayed list
    const playerInList = this.entries.find(e =>
      e.player_id === player?.id ||
      e.username === player?.username ||
      e.username === 'You'
    )

    // If player not in list and we have their rank, show it
    if (!playerInList && this.playerRank && player) {
      const barY = this.SCROLL_END_Y + 5
      const barHeight = 35

      // Background bar
      const barBg = this.add.rectangle(width / 2, barY + barHeight / 2, width - 40, barHeight, 0x2a2a3a, 0.98)
      barBg.setStrokeStyle(1, 0xf59e0b, 0.5)
      this.contentItems.push(barBg)

      // Your rank text
      const rankText = this.add.text(30, barY + barHeight / 2, `Your Rank: #${this.playerRank}`, {
        fontSize: '13px',
        color: '#f59e0b',
        fontStyle: 'bold'
      }).setOrigin(0, 0.5)
      this.contentItems.push(rankText)

      // Your value
      const config = this.CATEGORIES[this.activeCategory]
      const playerValue = this.getPlayerValue()
      const valueText = this.add.text(width - 50, barY + barHeight / 2, config.format(playerValue), {
        fontSize: '13px',
        color: '#ffffff'
      }).setOrigin(1, 0.5)
      this.contentItems.push(valueText)
    }
  }

  renderEmptyState() {
    const { width } = this.cameras.main
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    const iconText = this.add.text(width / 2, centerY - 40, '🏆', {
      fontSize: '56px'
    }).setOrigin(0.5)
    this.contentItems.push(iconText)

    const titleText = this.add.text(width / 2, centerY + 20, 'No Rankings Yet', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(titleText)

    const msgText = this.add.text(width / 2, centerY + 55, 'Be the first to climb the ranks!', {
      fontSize: '13px',
      color: '#888888'
    }).setOrigin(0.5)
    this.contentItems.push(msgText)
  }

  renderError() {
    const { width } = this.cameras.main
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    const iconText = this.add.text(width / 2, centerY - 30, '⚠️', {
      fontSize: '48px'
    }).setOrigin(0.5)
    this.contentItems.push(iconText)

    const titleText = this.add.text(width / 2, centerY + 20, 'Failed to Load', {
      fontSize: '18px',
      color: '#ef4444'
    }).setOrigin(0.5)
    this.contentItems.push(titleText)

    const msgText = this.add.text(width / 2, centerY + 50, 'Tap refresh to try again', {
      fontSize: '13px',
      color: '#888888'
    }).setOrigin(0.5)
    this.contentItems.push(msgText)
  }

  closeScene() {
    this.scene.stop()
    this.scene.resume('GameScene')
  }
}
