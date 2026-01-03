/**
 * SystemHubScene - Consolidated Rep/Stats/Events Hub
 *
 * Part of the OS-style dashboard redesign.
 * Combines all status/system operations into a single tabbed interface.
 */

import Phaser from 'phaser'
import { BaseScene } from './BaseScene'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { audioManager } from '../managers/AudioManager'
import { SceneReadinessManager } from '../managers/SceneReadinessManager'
import { getPlayerData, savePlayerData, LAWYERS, getPlayerLawyer, hireLawyer, fireLawyer, getLawyerCaseHistory, HEAT_REDUCTION_METHODS, performHeatReduction, getAllDistrictHeat, DISTRICTS, getEnergyStats, getAllAchievementsWithStatus, markSystemVisited, ACHIEVEMENTS } from '../data/GameData.js'
import { COLORS, BORDERS, DEPTH, LAYOUT, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'
import { networkTransition } from '../ui/NetworkTransition'

// Standing levels based on reputation
const STANDING_LEVELS = [
  { name: 'Unknown', min: -999, max: -50, color: 0x6B7280 },
  { name: 'Hated', min: -50, max: -20, color: 0xEF4444 },
  { name: 'Disliked', min: -20, max: 0, color: 0xF97316 },
  { name: 'Known', min: 0, max: 30, color: 0xFBBF24 },
  { name: 'Respected', min: 30, max: 60, color: 0x22C55E },
  { name: 'Feared', min: 60, max: 80, color: 0xA855F7 },
  { name: 'Trusted', min: 80, max: 100, color: 0x3B82F6 },
  { name: 'Legendary', min: 100, max: 999, color: 0xFBBF24 }
]

// Achievement categories
const ACHIEVEMENT_CATEGORIES = [
  { id: 'crime', icon: '[!]', label: 'Crime', color: 0xEF4444 },
  { id: 'wealth', icon: '[$]', label: 'Wealth', color: 0x22C55E },
  { id: 'social', icon: '[@]', label: 'Social', color: 0x3B82F6 },
  { id: 'progress', icon: '[+]', label: 'Progress', color: 0xA855F7 }
]

export class SystemHubScene extends BaseScene {
  constructor() {
    super('SystemHubScene')
    this.activeTab = 'stats' // 'stats' | 'achieve' | 'rep' | 'legal' | 'heat' | 'events'
    this.contentItems = []
    this.tabButtons = []
    this.readiness = null // SceneReadinessManager instance
  }

  init(data) {
    super.init(data)
    console.log('[SystemHubScene] init() called with data:', JSON.stringify(data || {}))
    console.log('[SystemHubScene] returnScene:', data?.returnScene)

    // Create readiness manager for proper lifecycle handling
    this.readiness = new SceneReadinessManager(this)

    if (data?.tab) {
      this.activeTab = data.tab
    }
  }

  async create() {
    console.log('[SystemHubScene] create() started')
    super.create({ skipIntro: true })

    // CRITICAL: Block input until scene is fully ready
    this.readiness.beginCreate()

    // CRITICAL: Bring this scene to top of scene stack for input priority
    this.scene.bringToTop()
    console.log('[SystemHubScene] Brought self to top of scene stack')

    const { width, height } = this.cameras.main

    // Pause UIScene - we have our own header/UI
    this.readiness.pauseUIScene()

    // Full screen background (NOT interactive - allows clicks to pass through to elements)
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1)
      .setOrigin(0)
      .setDepth(DEPTH.BACKGROUND)

    // Background pattern
    this.createBackgroundPattern()

    // Play scene intro
    networkTransition.playSceneIntro(this, 'SystemHubScene')

    // Header
    this.createHeader()

    // Close button
    this.createCloseButton()

    // Level/XP overview
    this.createLevelOverview()

    // Tab bar
    this.createTabBar()

    // Mark system as visited (clears "new" badge on System module)
    const player = gameManager.player || getPlayerData()
    if (player) {
      markSystemVisited(player)
      if (gameManager.player) {
        gameManager.player.lastSystemVisit = player.lastSystemVisit
      }
    }

    // AWAIT content loading (like CrimeScene does)
    try {
      await this.loadContent()
      console.log('[SystemHubScene] Content loaded successfully')
    } catch (error) {
      console.error('[SystemHubScene] Failed to load content:', error)
    }

    // CRITICAL: Mark scene ready - this enables input after a short delay
    await this.readiness.markReady(100)

    // Emit sceneReady for NetworkTransition coordination
    this.events.emit('sceneReady')
    console.log('[SystemHubScene] create() completed, scene fully ready')

    // Handle scene resume/pause for input management
    this.events.on('resume', () => {
      console.log('[SystemHubScene] Scene resumed')
      this.input.enabled = true
    })

    this.events.on('pause', () => {
      console.log('[SystemHubScene] Scene paused')
      this.input.enabled = false
    })
  }

  createBackgroundPattern() {
    const { width, height } = this.cameras.main
    const graphics = this.add.graphics().setDepth(DEPTH.GRID)

    // Grid pattern with purple tint for system
    graphics.lineStyle(1, 0xAA44FF, 0.08)
    const gridSize = 40
    for (let x = 0; x < width; x += gridSize) {
      graphics.moveTo(x, 0)
      graphics.lineTo(x, height)
    }
    for (let y = 0; y < height; y += gridSize) {
      graphics.moveTo(0, y)
      graphics.lineTo(width, y)
    }
    graphics.strokePath()
  }

  createHeader() {
    const { width } = this.cameras.main

    // Header background
    this.add.rectangle(width / 2, 35, width, 70, COLORS.bg.panel, 0.95)
      .setDepth(DEPTH.CONTENT_BASE)

    // Purple accent line (system = info color)
    this.add.rectangle(width / 2, 68, width, 2, 0xAA44FF, 0.8)
      .setDepth(DEPTH.CONTENT_BASE)

    // Icon
    const icon = this.add.text(width / 2 - 105, 28, '[i]', {
      ...getTerminalStyle('lg'),
      color: '#AA44FF'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Animate icon
    this.tweens.add({
      targets: icon,
      alpha: { from: 1, to: 0.6 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Title
    this.add.text(width / 2, 28, 'SYSTEM STATUS', {
      ...getTerminalStyle('xl'),
      color: '#AA44FF'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Subtitle
    this.add.text(width / 2, 52, `${SYMBOLS.system} REP • STATS • EVENTS`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal'),
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
  }

  createCloseButton() {
    const { width } = this.cameras.main

    const closeBtn = this.add.text(width - 25, 25, SYMBOLS.close, {
      ...getTerminalStyle('xl'),
      color: toHexString(COLORS.text.secondary)
    })
    .setOrigin(0.5)
    .setDepth(DEPTH.CLOSE_BUTTON)
    .setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => {
      closeBtn.setColor('#AA44FF')
      closeBtn.setScale(1.2)
      audioManager.playHover()
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor(toHexString(COLORS.text.secondary))
      closeBtn.setScale(1)
    })
    closeBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.closeScene()
    })
  }

  createLevelOverview() {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}

    // Level bar background
    const barY = 85
    this.add.rectangle(width / 2, barY, width - 20, 30, COLORS.bg.panel, 0.9)
      .setStrokeStyle(1, 0xAA44FF, 0.3)
      .setDepth(DEPTH.CONTENT_BASE)

    // Level
    const level = player.level || 1
    this.add.text(25, barY, `[LV] LEVEL ${level}`, {
      ...getTerminalStyle('sm'),
      color: '#AA44FF'
    }).setOrigin(0, 0.5).setDepth(DEPTH.PANEL_CONTENT)

    // XP progress
    const currentXP = player.xp || 0
    const xpForNext = (level * level) * 100
    const xpProgress = Math.min(100, Math.floor((currentXP % xpForNext) / xpForNext * 100))

    this.add.text(width - 25, barY, `XP: ${currentXP} / ${xpForNext} (${xpProgress}%)`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setOrigin(1, 0.5).setDepth(DEPTH.PANEL_CONTENT)
  }

  createTabBar() {
    const { width } = this.cameras.main
    const tabY = 118
    const tabWidth = (width - 40) / 6

    const tabs = [
      { key: 'stats', label: 'STATS', icon: '[S]', color: 0x22C55E },
      { key: 'achieve', label: 'ACHIEVE', icon: '[A]', color: 0xA855F7 },
      { key: 'rep', label: 'REP', icon: '[R]', color: 0xFBBF24 },
      { key: 'legal', label: 'LEGAL', icon: '[L]', color: 0x3B82F6 },
      { key: 'heat', label: 'HEAT', icon: '[H]', color: 0xF97316 },
      { key: 'events', label: 'NEWS', icon: '[E]', color: 0xEF4444 }
    ]

    // Tab bar background
    this.add.rectangle(width / 2, tabY, width - 20, 32, COLORS.bg.panel, 0.9)
      .setStrokeStyle(1, COLORS.network.dim, 0.3)
      .setDepth(DEPTH.CONTENT_BASE)

    this.tabButtons = []

    tabs.forEach((tab, index) => {
      const x = 20 + tabWidth / 2 + index * tabWidth

      const isActive = this.activeTab === tab.key
      const tabBg = this.add.rectangle(x, tabY, tabWidth - 4, 28,
        isActive ? tab.color : COLORS.bg.card,
        isActive ? 0.3 : 0.6
      )
        .setStrokeStyle(isActive ? 2 : 1, tab.color, isActive ? 0.8 : 0.3)
        .setDepth(DEPTH.PANEL_CONTENT)
        .setInteractive({ useHandCursor: true })

      const tabLabel = this.add.text(x, tabY, `${tab.icon} ${tab.label}`, {
        ...getTextStyle('sm', isActive ? COLORS.text.primary : COLORS.text.muted, 'terminal'),
        fontStyle: isActive ? 'bold' : 'normal'
      }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)

      tabBg.on('pointerover', () => {
        if (this.activeTab !== tab.key) {
          tabBg.setFillStyle(tab.color, 0.15)
          tabLabel.setColor(toHexString(COLORS.text.primary))
          audioManager.playHover()
        }
      })

      tabBg.on('pointerout', () => {
        if (this.activeTab !== tab.key) {
          tabBg.setFillStyle(COLORS.bg.card, 0.6)
          tabLabel.setColor(toHexString(COLORS.text.muted))
        }
      })

      tabBg.on('pointerdown', () => {
        if (this.activeTab !== tab.key) {
          audioManager.playClick()
          this.switchTab(tab.key)
        }
      })

      this.tabButtons.push({ key: tab.key, bg: tabBg, label: tabLabel, color: tab.color })
    })
  }

  switchTab(tabKey) {
    this.activeTab = tabKey

    // Update tab visuals
    this.tabButtons.forEach(tab => {
      const isActive = tab.key === tabKey
      tab.bg.setFillStyle(isActive ? tab.color : COLORS.bg.card, isActive ? 0.3 : 0.6)
      tab.bg.setStrokeStyle(isActive ? 2 : 1, tab.color, isActive ? 0.8 : 0.3)
      tab.label.setColor(toHexString(isActive ? COLORS.text.primary : COLORS.text.muted))
      tab.label.setFontStyle(isActive ? 'bold' : 'normal')
    })

    // Reload content
    this.loadContent()
  }

  async loadContent() {
    // Clear existing content
    this.clearContent()

    const { width, height } = this.cameras.main
    const startY = 150

    // Loading indicator
    const loadingText = this.add.text(width / 2, height / 2, `${SYMBOLS.system} LOADING...`, {
      ...getTerminalStyle('md'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setDepth(150)
    this.contentItems.push(loadingText)

    // Wait a brief moment then render content
    await new Promise(resolve => this.time.delayedCall(100, resolve))

    loadingText.destroy()

    switch (this.activeTab) {
      case 'stats':
        this.renderStatsContent(startY)
        break
      case 'achieve':
        this.renderAchievementsContent(startY)
        break
      case 'rep':
        this.renderRepContent(startY)
        break
      case 'legal':
        this.renderLegalContent(startY)
        break
      case 'heat':
        this.renderHeatContent(startY)
        break
      case 'events':
        this.renderEventsContent(startY)
        break
    }
  }

  clearContent() {
    this.contentItems.forEach(item => {
      if (item && item.destroy) item.destroy()
    })
    this.contentItems = []
  }

  renderRepContent(startY) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}

    // Section header
    const headerText = this.add.text(25, startY, `${SYMBOLS.system} REPUTATION STATUS`, {
      ...getTerminalStyle('sm'),
      color: '#FBBF24'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(headerText)

    // Calculate overall standing
    const repScore = player.reputation || player.respect || 0
    const standing = STANDING_LEVELS.find(s => repScore >= s.min && repScore < s.max) || STANDING_LEVELS[3]

    // Standing card
    const standingY = startY + 50
    const standingCard = this.add.rectangle(width / 2, standingY, width - 30, 80, COLORS.bg.panel, 0.95)
      .setStrokeStyle(2, standing.color, 0.6)
      .setDepth(DEPTH.CONTENT_BASE)
    this.contentItems.push(standingCard)

    const standingLabel = this.add.text(width / 2, standingY - 18, 'CURRENT STANDING', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(standingLabel)

    const standingName = this.add.text(width / 2, standingY + 8, standing.name.toUpperCase(), {
      ...getTerminalStyle('xl'),
      color: toHexString(standing.color)
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(standingName)

    const repLabel = this.add.text(width / 2, standingY + 30, `Rep Score: ${repScore}`, {
      ...getTextStyle('sm', COLORS.text.muted, 'terminal')
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(repLabel)

    // Reputation dimensions
    const dimsY = standingY + 70
    const dimsHeader = this.add.text(25, dimsY, `${SYMBOLS.system} REPUTATION DIMENSIONS`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(dimsHeader)

    const dimensions = [
      { name: 'RESPECT', value: player.respect || 0, color: 0x22C55E },
      { name: 'FEAR', value: player.fear || 0, color: 0xEF4444 },
      { name: 'TRUST', value: player.trust || 0, color: 0x3B82F6 },
      { name: 'HEAT', value: player.heat || 0, color: 0xF97316 }
    ]

    const dimWidth = (width - 50) / 2
    dimensions.forEach((dim, index) => {
      const row = Math.floor(index / 2)
      const col = index % 2
      const x = 25 + col * (dimWidth + 10)
      const y = dimsY + 25 + row * 45

      const dimCard = this.add.rectangle(x + dimWidth / 2, y + 15, dimWidth, 38, COLORS.bg.panel, 0.95)
        .setStrokeStyle(1, dim.color, 0.4)
        .setDepth(DEPTH.CONTENT_BASE)
      this.contentItems.push(dimCard)

      const dimLabel = this.add.text(x + 10, y + 8, dim.name, {
        ...getTextStyle('xs', COLORS.text.muted, 'terminal')
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(dimLabel)

      const dimValue = this.add.text(x + dimWidth - 10, y + 15, `${dim.value}`, {
        ...getTerminalStyle('md'),
        color: toHexString(dim.color)
      }).setOrigin(1, 0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(dimValue)

      // Progress bar
      const barWidth = dimWidth - 20
      const barBg = this.add.rectangle(x + 10 + barWidth / 2, y + 28, barWidth, 4, COLORS.bg.void)
        .setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(barBg)

      const progress = Math.min(100, Math.max(0, dim.value))
      const barFill = this.add.rectangle(x + 10, y + 28, (barWidth * progress) / 100, 4, dim.color)
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(barFill)
    })

    // View all button
    const btnY = height - 60
    this.createActionButton(width / 2, btnY, 'Full Reputation', 0xFBBF24, () => {
      this.openFullScene('ReputationScene')
    })
  }

  renderStatsContent(startY) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}

    // Section header
    const headerText = this.add.text(25, startY, `${SYMBOLS.system} PLAYER STATISTICS`, {
      ...getTerminalStyle('sm'),
      color: '#22C55E'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(headerText)

    // Get energy tier info
    const energyStats = getEnergyStats(player.level || 1)
    const energyTierName = player.level >= 51 ? 'Elite' :
                           player.level >= 41 ? 'Expert' :
                           player.level >= 26 ? 'Veteran' :
                           player.level >= 11 ? 'Skilled' : 'Rookie'

    // Stats grid
    const stats = [
      { label: 'Ops Completed', value: player.crimes_committed || 0, icon: '[!]' },
      { label: 'Contracts Done', value: player.jobs_completed || 0, icon: '[C]' },
      { label: 'Major Ops Done', value: player.heists_completed || 0, icon: '[M]' },
      { label: 'Total Earnings', value: formatMoney(player.totalEarnings || 0), icon: '[$]' },
      { label: 'Energy Tier', value: `${energyTierName} (${energyStats.maxEnergy})`, icon: '[E]', color: 0x3B82F6 },
      { label: 'Regen Rate', value: `${energyStats.regenRate}/min`, icon: '[R]', color: 0x3B82F6 }
    ]

    const cardWidth = (width - 50) / 2
    const cardHeight = 55

    stats.forEach((stat, index) => {
      const row = Math.floor(index / 2)
      const col = index % 2
      const x = 25 + col * (cardWidth + 10)
      const y = startY + 30 + row * (cardHeight + 8)

      const cardColor = stat.color || 0x22C55E
      const statCard = this.add.rectangle(x + cardWidth / 2, y + cardHeight / 2, cardWidth, cardHeight, COLORS.bg.panel, 0.95)
        .setStrokeStyle(1, cardColor, 0.3)
        .setDepth(DEPTH.CONTENT_BASE)
      this.contentItems.push(statCard)

      const statIcon = this.add.text(x + 15, y + cardHeight / 2, stat.icon, {
        ...getTerminalStyle('md'),
        color: toHexString(cardColor)
      }).setOrigin(0, 0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(statIcon)

      const statLabel = this.add.text(x + 45, y + 15, stat.label, {
        ...getTextStyle('xs', COLORS.text.muted, 'terminal')
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(statLabel)

      const statValue = this.add.text(x + 45, y + 35, `${stat.value}`, {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.primary)
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(statValue)
    })

    // Achievements preview
    const achY = startY + 30 + Math.ceil(stats.length / 2) * (cardHeight + 8) + 15
    const achHeader = this.add.text(25, achY, `${SYMBOLS.system} ACHIEVEMENTS`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(achHeader)

    const achievements = player.achievements || []
    const achCount = achievements.length

    const achCard = this.add.rectangle(width / 2, achY + 40, width - 30, 50, COLORS.bg.panel, 0.95)
      .setStrokeStyle(1, 0xA855F7, 0.4)
      .setDepth(DEPTH.CONTENT_BASE)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(achCard)

    achCard.on('pointerdown', () => {
      audioManager.playClick()
      this.openFullScene('AchievementsScene')
    })

    const achIcon = this.add.text(45, achY + 40, '[A]', {
      ...getTerminalStyle('lg'),
      color: '#A855F7'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(achIcon)

    const achText = this.add.text(70, achY + 33, 'ACHIEVEMENTS UNLOCKED', {
      ...getTextStyle('sm', COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(achText)

    const achCountText = this.add.text(70, achY + 48, `${achCount} achievements earned`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(achCountText)

    const achArrow = this.add.text(width - 40, achY + 40, '>', {
      ...getTerminalStyle('lg'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(achArrow)

    // View all button
    const btnY = height - 60
    this.createActionButton(width / 2, btnY, 'All Achievements', 0x22C55E, () => {
      this.openFullScene('AchievementsScene')
    })
  }

  renderAchievementsContent(startY) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}

    // Get all achievements with status
    const achievements = getAllAchievementsWithStatus(player)
    const unlockedCount = achievements.filter(a => a.unlocked).length
    const totalCount = achievements.length

    // Section header with progress
    const headerText = this.add.text(25, startY, `${SYMBOLS.system} ACHIEVEMENTS`, {
      ...getTerminalStyle('sm'),
      color: '#A855F7'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(headerText)

    const progressText = this.add.text(width - 25, startY, `${unlockedCount}/${totalCount}`, {
      ...getTextStyle('sm', COLORS.text.muted, 'terminal')
    }).setOrigin(1, 0).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(progressText)

    // Progress bar
    const barY = startY + 28
    const barBg = this.add.rectangle(width / 2, barY, width - 40, 12, COLORS.bg.void)
      .setStrokeStyle(1, 0xA855F7, 0.3)
      .setDepth(DEPTH.CONTENT_BASE)
    this.contentItems.push(barBg)

    const progressPercent = totalCount > 0 ? (unlockedCount / totalCount) : 0
    if (progressPercent > 0) {
      const barFill = this.add.rectangle(30, barY, (width - 40) * progressPercent, 10, 0xA855F7, 0.8)
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(barFill)
    }

    // Rarity legend
    const legendY = barY + 20
    const rarityColors = {
      common: { color: 0x9CA3AF, label: 'C' },
      rare: { color: 0x3B82F6, label: 'R' },
      epic: { color: 0xA855F7, label: 'E' },
      legendary: { color: 0xFBBF24, label: 'L' }
    }

    let legendX = 25
    Object.entries(rarityColors).forEach(([rarity, config]) => {
      const count = achievements.filter(a => a.rarity === rarity && a.unlocked).length
      const total = achievements.filter(a => a.rarity === rarity).length

      const dot = this.add.circle(legendX, legendY, 6, config.color)
        .setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(dot)

      const label = this.add.text(legendX + 12, legendY, `${count}/${total}`, {
        ...getTextStyle('xs', COLORS.text.muted, 'terminal')
      }).setOrigin(0, 0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(label)

      legendX += 60
    })

    // Achievement list (scrollable area)
    const listY = legendY + 25
    const cardHeight = 58
    const cardSpacing = 6
    const maxVisible = Math.floor((height - listY - 70) / (cardHeight + cardSpacing))

    // Sort: unlocked first, then by rarity (legendary > epic > rare > common), then new first
    const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 }
    const sortedAchievements = [...achievements].sort((a, b) => {
      // Unlocked first
      if (a.unlocked && !b.unlocked) return -1
      if (!a.unlocked && b.unlocked) return 1
      // New achievements first (among unlocked)
      if (a.unlocked && b.unlocked) {
        if (a.isNew && !b.isNew) return -1
        if (!a.isNew && b.isNew) return 1
      }
      // Then by rarity
      return rarityOrder[a.rarity] - rarityOrder[b.rarity]
    })

    sortedAchievements.slice(0, maxVisible).forEach((ach, index) => {
      const y = listY + index * (cardHeight + cardSpacing)
      this.createAchievementCard(ach, y, cardHeight)
    })

    // View all button if more achievements exist
    if (achievements.length > maxVisible) {
      const moreCount = achievements.length - maxVisible
      const btnY = height - 60
      this.createActionButton(width / 2, btnY, `View All (${moreCount} more)`, 0xA855F7, () => {
        this.openFullScene('AchievementsScene')
      })
    }
  }

  createAchievementCard(ach, y, cardHeight) {
    const { width } = this.cameras.main
    const rarityColors = {
      common: 0x9CA3AF,
      rare: 0x3B82F6,
      epic: 0xA855F7,
      legendary: 0xFBBF24
    }
    const borderColor = rarityColors[ach.rarity] || 0x666666

    // Card background
    const card = this.add.rectangle(width / 2, y + cardHeight / 2, width - 30, cardHeight - 4,
      ach.unlocked ? COLORS.bg.panel : COLORS.bg.void, ach.unlocked ? 0.95 : 0.6)
      .setStrokeStyle(ach.unlocked ? 2 : 1, borderColor, ach.unlocked ? 0.8 : 0.3)
      .setDepth(DEPTH.CONTENT_BASE)
    this.contentItems.push(card)

    // NEW badge for recently unlocked
    if (ach.isNew && ach.unlocked) {
      const newBadge = this.add.rectangle(width - 55, y + 12, 36, 16, 0xEF4444, 0.9)
        .setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(newBadge)

      const newText = this.add.text(width - 55, y + 12, 'NEW', {
        ...getTextStyle('xs', COLORS.text.primary, 'terminal'),
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(DEPTH.BUTTONS)
      this.contentItems.push(newText)
    }

    // Icon
    const iconText = this.add.text(35, y + cardHeight / 2 - 5, ach.icon || '🏆', {
      fontSize: '22px'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      .setAlpha(ach.unlocked ? 1 : 0.4)
    this.contentItems.push(iconText)

    // Name
    const nameText = this.add.text(60, y + 12, ach.name, {
      ...getTextStyle('sm', ach.unlocked ? COLORS.text.primary : COLORS.text.muted, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(nameText)

    // Description
    const descText = this.add.text(60, y + 28, ach.description.substring(0, 35) + (ach.description.length > 35 ? '...' : ''), {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(descText)

    // Reward or locked status
    if (ach.unlocked) {
      const rewardText = this.add.text(60, y + 44, `+${formatMoney(ach.reward)} earned`, {
        ...getTextStyle('xs', 0x22C55E, 'terminal')
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(rewardText)
    } else {
      const lockedText = this.add.text(width - 40, y + cardHeight / 2, '🔒', {
        fontSize: '18px'
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT).setAlpha(0.5)
      this.contentItems.push(lockedText)

      // Show potential reward
      const potentialText = this.add.text(60, y + 44, `Reward: ${formatMoney(ach.reward)}`, {
        ...getTextStyle('xs', COLORS.text.muted, 'terminal')
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(potentialText)
    }

    // Rarity indicator
    const rarityDot = this.add.circle(width - 25, y + cardHeight - 12, 5, borderColor, ach.unlocked ? 1 : 0.4)
      .setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(rarityDot)
  }

  renderLegalContent(startY) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}

    // Section header
    const headerText = this.add.text(25, startY, `${SYMBOLS.system} LEGAL REPRESENTATION`, {
      ...getTerminalStyle('sm'),
      color: '#3B82F6'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(headerText)

    // Current lawyer status
    const currentLawyer = getPlayerLawyer(player)
    const lawyerY = startY + 40

    const lawyerCard = this.add.rectangle(width / 2, lawyerY + 25, width - 30, 60, COLORS.bg.panel, 0.95)
      .setStrokeStyle(2, currentLawyer ? 0x3B82F6 : 0x666666, 0.6)
      .setDepth(DEPTH.CONTENT_BASE)
    this.contentItems.push(lawyerCard)

    if (currentLawyer) {
      const lawyerIcon = this.add.text(45, lawyerY + 25, currentLawyer.icon, {
        fontSize: '24px'
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(lawyerIcon)

      const lawyerName = this.add.text(75, lawyerY + 15, currentLawyer.name, {
        ...getTerminalStyle('md'),
        color: '#3B82F6'
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(lawyerName)

      const lawyerBonus = this.add.text(75, lawyerY + 35, `Bail: -${Math.round(currentLawyer.bailReduction * 100)}% | Sentence: -${Math.round(currentLawyer.sentenceReduction * 100)}%`, {
        ...getTextStyle('xs', COLORS.text.muted, 'terminal')
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(lawyerBonus)

      // Fire button
      const fireBtn = this.add.text(width - 50, lawyerY + 25, '[X]', {
        ...getTerminalStyle('md'),
        color: '#EF4444'
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT).setInteractive({ useHandCursor: true })
      this.contentItems.push(fireBtn)

      fireBtn.on('pointerover', () => {
        fireBtn.setScale(1.2)
        audioManager.playHover()
      })
      fireBtn.on('pointerout', () => fireBtn.setScale(1))
      fireBtn.on('pointerdown', () => {
        audioManager.playClick()
        const result = fireLawyer(player)
        if (result.success) {
          gameManager.player = result.player
          this.loadContent()
        }
      })
    } else {
      const noLawyerText = this.add.text(width / 2, lawyerY + 25, 'No Legal Representation', {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(noLawyerText)
    }

    // Case history summary (if has lawyer cases)
    const caseHistory = getLawyerCaseHistory(player)
    let listY = lawyerY + 70

    if (caseHistory.stats.totalCases > 0) {
      const historyHeader = this.add.text(25, listY, `${SYMBOLS.system} CASE HISTORY`, {
        ...getTerminalStyle('xs'),
        color: '#A855F7'
      }).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(historyHeader)

      const historyCard = this.add.rectangle(width / 2, listY + 35, width - 30, 40, COLORS.bg.panel, 0.95)
        .setStrokeStyle(1, 0xA855F7, 0.4)
        .setDepth(DEPTH.CONTENT_BASE)
      this.contentItems.push(historyCard)

      const statsText = `Cases: ${caseHistory.stats.totalCases} | Bails: ${caseHistory.stats.bailCases} | Paroles: ${caseHistory.stats.paroleCases} | Saved: ${formatMoney(caseHistory.stats.totalSaved)}`
      const historyStats = this.add.text(width / 2, listY + 35, statsText, {
        ...getTextStyle('xs', COLORS.text.muted, 'terminal')
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(historyStats)

      listY += 65
    }

    // Available lawyers section
    const listHeader = this.add.text(25, listY, `${SYMBOLS.system} AVAILABLE LAWYERS`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(listHeader)

    const lawyerCardHeight = 65
    LAWYERS.forEach((lawyer, index) => {
      const y = listY + 25 + index * (lawyerCardHeight + 8)
      if (y + lawyerCardHeight < height - 80) {
        this.createLawyerCard(lawyer, y, lawyerCardHeight, player, currentLawyer)
      }
    })
  }

  createLawyerCard(lawyer, y, cardHeight, player, currentLawyer) {
    const { width } = this.cameras.main
    const isCurrentLawyer = currentLawyer && currentLawyer.id === lawyer.id
    const canAfford = player.cash >= lawyer.retainer
    const meetsLevel = player.level >= lawyer.minLevel

    const cardColor = isCurrentLawyer ? 0x3B82F6 : (canAfford && meetsLevel ? 0x22C55E : 0x666666)

    const card = this.add.rectangle(width / 2, y + cardHeight / 2, width - 30, cardHeight - 4, COLORS.bg.panel, 0.95)
      .setStrokeStyle(isCurrentLawyer ? 2 : 1, cardColor, isCurrentLawyer ? 0.8 : 0.4)
      .setDepth(DEPTH.CONTENT_BASE)
    this.contentItems.push(card)

    // Icon
    const icon = this.add.text(35, y + cardHeight / 2, lawyer.icon, {
      fontSize: '20px'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(icon)

    // Name
    const name = this.add.text(60, y + 12, lawyer.name, {
      ...getTextStyle('sm', isCurrentLawyer ? 0x3B82F6 : COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(name)

    // Description
    const desc = this.add.text(60, y + 28, lawyer.description, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(desc)

    // Stats line
    const statsLine = `Bail: -${Math.round(lawyer.bailReduction * 100)}% | Sentence: -${Math.round(lawyer.sentenceReduction * 100)}% | Lvl ${lawyer.minLevel}+`
    const stats = this.add.text(60, y + 44, statsLine, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(stats)

    // Hire button or status
    if (isCurrentLawyer) {
      const activeLabel = this.add.text(width - 45, y + cardHeight / 2, 'ACTIVE', {
        ...getTextStyle('xs', 0x3B82F6, 'terminal'),
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(activeLabel)
    } else if (!meetsLevel) {
      const lockedLabel = this.add.text(width - 45, y + cardHeight / 2, `LV${lawyer.minLevel}`, {
        ...getTextStyle('xs', COLORS.text.muted, 'terminal')
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(lockedLabel)
    } else {
      const priceText = lawyer.retainer > 0 ? formatMoney(lawyer.retainer) : 'FREE'
      const hireBtn = this.add.rectangle(width - 55, y + cardHeight / 2, 70, 28, canAfford ? 0x22C55E : 0x666666, 0.3)
        .setStrokeStyle(1, canAfford ? 0x22C55E : 0x666666, 0.6)
        .setDepth(DEPTH.PANEL_CONTENT)
        .setInteractive({ useHandCursor: canAfford })
      this.contentItems.push(hireBtn)

      const hireBtnLabel = this.add.text(width - 55, y + cardHeight / 2, priceText, {
        ...getTextStyle('xs', canAfford ? 0x22C55E : COLORS.text.muted, 'terminal'),
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(hireBtnLabel)

      if (canAfford) {
        hireBtn.on('pointerover', () => {
          hireBtn.setFillStyle(0x22C55E, 0.5)
          audioManager.playHover()
        })
        hireBtn.on('pointerout', () => hireBtn.setFillStyle(0x22C55E, 0.3))
        hireBtn.on('pointerdown', () => {
          audioManager.playClick()
          const result = hireLawyer(player, lawyer.id)
          if (result.success) {
            gameManager.player = result.player
            this.loadContent()
          }
        })
      }
    }
  }

  renderHeatContent(startY) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}

    // Section header
    const headerText = this.add.text(25, startY, `${SYMBOLS.alert} DISTRICT HEAT MAP`, {
      ...getTerminalStyle('sm'),
      color: '#F97316'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(headerText)

    // Global heat indicator
    const globalHeat = player.heat || 0
    const globalHeatY = startY + 35

    const globalLabel = this.add.text(25, globalHeatY, 'GLOBAL HEAT:', {
      ...getTextStyle('sm', COLORS.text.secondary, 'terminal')
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(globalLabel)

    // Heat bar
    const barWidth = width - 150
    const barBg = this.add.rectangle(110, globalHeatY, barWidth, 16, 0x1f2937, 0.8)
      .setOrigin(0, 0.5)
      .setStrokeStyle(1, COLORS.network.dim, 0.5)
      .setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(barBg)

    const heatColor = globalHeat < 25 ? 0x22c55e : globalHeat < 50 ? 0xfbbf24 : globalHeat < 75 ? 0xf97316 : 0xef4444
    const heatWidth = (globalHeat / 100) * barWidth
    if (heatWidth > 0) {
      const heatBar = this.add.rectangle(110, globalHeatY, heatWidth, 14, heatColor, 0.8)
        .setOrigin(0, 0.5)
        .setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(heatBar)
    }

    const heatValue = this.add.text(width - 25, globalHeatY, `${globalHeat}%`, {
      ...getTextStyle('sm', toHexString(heatColor), 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(heatValue)

    // Heat Reduction Methods Section
    const reductionY = globalHeatY + 35
    const reductionHeader = this.add.text(25, reductionY, `${SYMBOLS.system} HEAT REDUCTION OPTIONS`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(reductionHeader)

    const methodCardHeight = 55
    const methodSpacing = 6
    let methodY = reductionY + 20

    HEAT_REDUCTION_METHODS.forEach((method, index) => {
      const cardY = methodY + index * (methodCardHeight + methodSpacing)

      // Check cooldown
      const cooldowns = player.heatCooldowns || {}
      const lastUsed = cooldowns[method.id] || 0
      const now = Date.now()
      const cooldownRemaining = Math.max(0, (lastUsed + method.cooldown) - now)
      const onCooldown = cooldownRemaining > 0

      // Check requirements
      let canUse = !onCooldown && player.cash >= method.cost
      let requirementText = ''

      if (method.requires === 'lawyer' && !player.lawyer) {
        canUse = false
        requirementText = 'Requires lawyer'
      } else if (method.requires === 'property_safehouse' && !(player.ownedProperties || []).some(p => p.type === 'safehouse')) {
        canUse = false
        requirementText = 'Requires safehouse'
      }

      // Card background
      const cardBg = this.add.rectangle(width / 2, cardY + methodCardHeight / 2, width - 40, methodCardHeight - 4, COLORS.bg.card, 0.9)
        .setStrokeStyle(1, canUse ? 0x22c55e : 0x666666, canUse ? 0.5 : 0.3)
        .setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(cardBg)

      // Method icon
      const methodIcon = this.add.text(35, cardY + methodCardHeight / 2 - 8, method.icon, {
        fontSize: '18px'
      }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(methodIcon)

      // Method name
      const methodName = this.add.text(55, cardY + 10, method.name, {
        ...getTextStyle('sm', canUse ? COLORS.text.primary : COLORS.text.muted, 'terminal'),
        fontStyle: 'bold'
      }).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(methodName)

      // Description
      const descText = method.description.substring(0, 35) + (method.description.length > 35 ? '...' : '')
      const methodDesc = this.add.text(55, cardY + 27, descText, {
        ...getTextStyle('xs', COLORS.text.muted, 'terminal')
      }).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(methodDesc)

      // Stats line (heat reduction, risk)
      const heatReductionRange = Array.isArray(method.heatReduction)
        ? `${method.heatReduction[0]}-${method.heatReduction[1]}`
        : method.heatReduction
      const riskText = method.failChance > 0 ? ` | Risk: ${Math.round(method.failChance * 100)}%` : ''
      const statsLine = `-${heatReductionRange} heat${riskText}`
      const methodStats = this.add.text(55, cardY + 42, statsLine, {
        ...getTextStyle('xs', 0x22c55e, 'terminal')
      }).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(methodStats)

      // Right side: cost or cooldown status
      if (onCooldown) {
        const mins = Math.ceil(cooldownRemaining / 60000)
        const cooldownText = this.add.text(width - 45, cardY + methodCardHeight / 2, `${mins}m`, {
          ...getTextStyle('sm', 0xf59e0b, 'terminal'),
          fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
        this.contentItems.push(cooldownText)

        const waitLabel = this.add.text(width - 45, cardY + methodCardHeight / 2 + 15, 'WAIT', {
          ...getTextStyle('xs', COLORS.text.muted, 'terminal')
        }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
        this.contentItems.push(waitLabel)
      } else if (requirementText) {
        const reqText = this.add.text(width - 45, cardY + methodCardHeight / 2, requirementText, {
          ...getTextStyle('xs', 0xef4444, 'terminal')
        }).setOrigin(0.5).setDepth(DEPTH.LIST_ITEMS)
        this.contentItems.push(reqText)
      } else {
        // Use button
        const useBtn = this.add.rectangle(width - 55, cardY + methodCardHeight / 2, 70, 30,
          canUse ? 0x22c55e : 0x666666, canUse ? 0.3 : 0.1)
          .setStrokeStyle(1, canUse ? 0x22c55e : 0x666666, canUse ? 0.6 : 0.3)
          .setDepth(DEPTH.LIST_ITEMS)
          .setInteractive({ useHandCursor: canUse })
        this.contentItems.push(useBtn)

        const costText = formatMoney(method.cost)
        const useBtnLabel = this.add.text(width - 55, cardY + methodCardHeight / 2, costText, {
          ...getTextStyle('xs', canUse ? 0x22c55e : COLORS.text.muted, 'terminal'),
          fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(104)
        this.contentItems.push(useBtnLabel)

        if (canUse && globalHeat > 0) {
          useBtn.on('pointerover', () => {
            useBtn.setFillStyle(0x22c55e, 0.5)
            audioManager.playHover()
          })
          useBtn.on('pointerout', () => useBtn.setFillStyle(0x22c55e, 0.3))
          useBtn.on('pointerdown', () => {
            audioManager.playClick()
            const result = performHeatReduction(player, method.id)
            if (result.success) {
              gameManager.player = result.player
              // Show feedback
              this.showHeatReductionResult(result, width / 2, cardY + methodCardHeight / 2)
              // Refresh content after delay
              this.time.delayedCall(1500, () => this.loadContent())
            } else {
              // Show failure
              this.showHeatReductionResult(result, width / 2, cardY + methodCardHeight / 2)
            }
          })
        }
      }
    })

    // District list header - adjusted Y position
    const districtHeaderY = methodY + HEAT_REDUCTION_METHODS.length * (methodCardHeight + methodSpacing) + 20
    const districtHeader = this.add.text(25, districtHeaderY, 'DISTRICT HEAT LEVELS:', {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(districtHeader)

    // Get all districts with heat
    const districtHeatData = getAllDistrictHeat(player)

    // Sort by heat (highest first), then by name
    const sortedDistricts = districtHeatData.sort((a, b) => {
      const heatDiff = b.heat - a.heat
      if (heatDiff !== 0) return heatDiff
      return a.name.localeCompare(b.name)
    })

    // Create scrollable district list
    let currentY = districtHeaderY + 25
    const cardHeight = 50
    const cardPadding = 8

    sortedDistricts.forEach((district, index) => {
      const cardY = currentY + index * (cardHeight + cardPadding)

      // Only render if visible
      if (cardY > height - 80) return

      // Card background
      const heat = district.heat
      const cardColor = heat > 0 ? (heat < 25 ? 0x22c55e : heat < 50 ? 0xfbbf24 : heat < 75 ? 0xf97316 : 0xef4444) : 0x374151
      const cardBg = this.add.rectangle(width / 2, cardY + cardHeight / 2, width - 40, cardHeight, COLORS.bg.card, 0.8)
        .setStrokeStyle(1, cardColor, heat > 0 ? 0.6 : 0.2)
        .setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(cardBg)

      // District name
      const nameText = this.add.text(35, cardY + 8, district.name, {
        ...getTextStyle('sm', COLORS.text.primary, 'terminal'),
        fontStyle: heat >= 50 ? 'bold' : 'normal'
      }).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(nameText)

      // Police presence indicator
      const policeStars = '★'.repeat(district.police_presence) + '☆'.repeat(5 - district.police_presence)
      const policeText = this.add.text(35, cardY + 28, `Police: ${policeStars}`, {
        ...getTextStyle('xs', COLORS.text.muted, 'terminal')
      }).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(policeText)

      // Heat level on right side
      const heatText = this.add.text(width - 35, cardY + cardHeight / 2, heat > 0 ? `${heat}%` : 'COLD', {
        ...getTextStyle('md', toHexString(cardColor), 'terminal'),
        fontStyle: 'bold'
      }).setOrigin(1, 0.5).setDepth(DEPTH.LIST_ITEMS)
      this.contentItems.push(heatText)

      // Status indicator
      let statusText = ''
      let statusColor = COLORS.text.muted
      if (heat >= 75) {
        statusText = 'DANGEROUS'
        statusColor = 0xef4444
      } else if (heat >= 50) {
        statusText = 'HOT'
        statusColor = 0xf97316
      } else if (heat >= 25) {
        statusText = 'WARM'
        statusColor = 0xfbbf24
      } else if (heat > 0) {
        statusText = 'COOL'
        statusColor = 0x22c55e
      }

      if (statusText) {
        const status = this.add.text(width - 85, cardY + 8, statusText, {
          ...getTextStyle('xs', toHexString(statusColor), 'terminal')
        }).setOrigin(1, 0).setDepth(DEPTH.LIST_ITEMS)
        this.contentItems.push(status)
      }

      // Effects indicator if heat is high
      if (district.effects.isHot) {
        const effectsText = this.add.text(width - 85, cardY + 28, '-5% success, +15% prices', {
          ...getTextStyle('xs', '#ef4444', 'terminal')
        }).setOrigin(1, 0).setDepth(DEPTH.LIST_ITEMS)
        this.contentItems.push(effectsText)
      }
    })
  }

  renderEventsContent(startY) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}

    // Section header
    const headerText = this.add.text(25, startY, `${SYMBOLS.system} ACTIVE EVENTS`, {
      ...getTerminalStyle('sm'),
      color: '#EF4444'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(headerText)

    // Get active events
    const activeEvents = player.activeEvents || []
    const cardHeight = 70
    const cardSpacing = 8

    if (activeEvents.length === 0) {
      const noEventsText = this.add.text(width / 2, startY + 60, 'No active events', {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(noEventsText)

      const hintText = this.add.text(width / 2, startY + 85, 'Events appear as you play', {
        ...getTextStyle('xs', COLORS.text.muted, 'terminal')
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(hintText)
    } else {
      activeEvents.slice(0, 4).forEach((event, index) => {
        const y = startY + 30 + index * (cardHeight + cardSpacing)
        this.createEventCard(event, y, cardHeight)
      })
    }

    // Sample events section
    const sampleY = startY + 30 + Math.max(1, activeEvents.length) * (cardHeight + cardSpacing) + 20
    const sampleHeader = this.add.text(25, sampleY, `${SYMBOLS.system} RECENT ALERTS`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(sampleHeader)

    // Sample alert cards
    const sampleAlerts = [
      { type: 'warning', title: 'HEAT WARNING', desc: 'Police activity increased' },
      { type: 'opportunity', title: 'HOT TIP', desc: 'New opportunity available' },
      { type: 'info', title: 'SYSTEM', desc: 'Daily rewards ready' }
    ]

    sampleAlerts.forEach((alert, index) => {
      const y = sampleY + 25 + index * 45
      if (y < height - 100) {
        const alertColors = { warning: 0xF59E0B, opportunity: 0x22C55E, info: 0x3B82F6 }
        const color = alertColors[alert.type] || 0x666666

        const alertCard = this.add.rectangle(width / 2, y + 15, width - 30, 38, COLORS.bg.panel, 0.95)
          .setStrokeStyle(1, color, 0.4)
          .setDepth(DEPTH.CONTENT_BASE)
          .setInteractive({ useHandCursor: true })
        this.contentItems.push(alertCard)

        alertCard.on('pointerdown', () => {
          audioManager.playClick()
          this.openFullScene('EventsScene')
        })

        const alertIcon = this.add.rectangle(30, y + 15, 4, 30, color)
          .setDepth(DEPTH.PANEL_CONTENT)
        this.contentItems.push(alertIcon)

        const alertTitle = this.add.text(45, y + 8, alert.title, {
          ...getTextStyle('xs', color, 'terminal'),
          fontStyle: 'bold'
        }).setDepth(DEPTH.PANEL_CONTENT)
        this.contentItems.push(alertTitle)

        const alertDesc = this.add.text(45, y + 22, alert.desc, {
          ...getTextStyle('xs', COLORS.text.muted, 'terminal')
        }).setDepth(DEPTH.PANEL_CONTENT)
        this.contentItems.push(alertDesc)
      }
    })

    // View all button
    const btnY = height - 60
    this.createActionButton(width / 2, btnY, 'View All Events', 0xEF4444, () => {
      this.openFullScene('EventsScene')
    })
  }

  createEventCard(event, y, cardHeight) {
    const { width } = this.cameras.main
    const typeColors = {
      opportunity: 0x22C55E,
      threat: 0xEF4444,
      neutral: 0x3B82F6
    }
    const eventColor = typeColors[event.type] || 0x666666

    const card = this.add.rectangle(width / 2, y + cardHeight / 2, width - 30, cardHeight - 4, COLORS.bg.panel, 0.95)
      .setStrokeStyle(1, eventColor, 0.5)
      .setDepth(DEPTH.CONTENT_BASE)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(card)

    card.on('pointerdown', () => {
      audioManager.playClick()
      this.openFullScene('EventsScene')
    })

    // Left accent
    const accent = this.add.rectangle(23, y + cardHeight / 2, 4, cardHeight - 12, eventColor)
      .setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(accent)

    // Event title
    const titleText = this.add.text(35, y + 15, event.title || 'Unknown Event', {
      ...getTextStyle('sm', COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(titleText)

    // Description
    const descText = this.add.text(35, y + 35, event.description || 'No description', {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(descText)

    // Time remaining
    if (event.expiresAt) {
      const remaining = Math.max(0, event.expiresAt - Date.now())
      const mins = Math.floor(remaining / 60000)
      const timeText = this.add.text(width - 40, y + cardHeight / 2, `${mins}m`, {
        ...getTextStyle('sm', eventColor, 'terminal'),
        fontStyle: 'bold'
      }).setOrigin(1, 0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(timeText)
    }
  }

  createActionButton(x, y, label, color, onClick) {
    const btn = this.add.rectangle(x, y, 200, 40, color, 0.2)
      .setStrokeStyle(2, color, 0.6)
      .setDepth(DEPTH.CONTENT_BASE)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(btn)

    btn.on('pointerover', () => {
      btn.setFillStyle(color, 0.35)
      btn.setStrokeStyle(2, color, 0.9)
      audioManager.playHover()
    })
    btn.on('pointerout', () => {
      btn.setFillStyle(color, 0.2)
      btn.setStrokeStyle(2, color, 0.6)
    })
    btn.on('pointerdown', () => {
      audioManager.playClick()
      onClick()
    })

    const btnLabel = this.add.text(x, y, label, {
      ...getTextStyle('sm', COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(btnLabel)
  }

  showHeatReductionResult(result, x, y) {
    const { width } = this.cameras.main

    // Create overlay for result
    const overlay = this.add.rectangle(width / 2, y, width - 30, 50, 0x000000, 0.9)
      .setDepth(200)
    this.contentItems.push(overlay)

    if (result.success) {
      const successText = this.add.text(width / 2, y - 8, `${SYMBOLS.success} HEAT REDUCED!`, {
        ...getTerminalStyle('md'),
        color: '#22c55e'
      }).setOrigin(0.5).setDepth(201)
      this.contentItems.push(successText)

      const heatReduced = Math.abs(result.heatChange || result.heatReduced || 0)
      const costPaid = result.costPaid || result.cost || 0
      const detailText = this.add.text(width / 2, y + 12, `-${heatReduced} heat | Cost: ${formatMoney(costPaid)}`, {
        ...getTextStyle('sm', COLORS.text.muted, 'terminal')
      }).setOrigin(0.5).setDepth(201)
      this.contentItems.push(detailText)
    } else {
      const backfired = result.heatChange > 0 || result.backfired
      const failColor = backfired ? '#ef4444' : '#f59e0b'
      const failText = this.add.text(width / 2, y - 8, backfired ? `${SYMBOLS.alert} BACKFIRED!` : `${SYMBOLS.alert} FAILED`, {
        ...getTerminalStyle('md'),
        color: failColor
      }).setOrigin(0.5).setDepth(201)
      this.contentItems.push(failText)

      const msgText = result.message || (backfired ? 'Heat increased!' : 'Not enough cash')
      const detailText = this.add.text(width / 2, y + 12, msgText, {
        ...getTextStyle('sm', COLORS.text.muted, 'terminal')
      }).setOrigin(0.5).setDepth(201)
      this.contentItems.push(detailText)
    }

    // Auto fade out
    this.tweens.add({
      targets: [overlay],
      alpha: 0,
      delay: 1200,
      duration: 300
    })
  }

  openFullScene(sceneName) {
    console.log(`[SystemHubScene] Navigating to ${sceneName}`)

    // Validate scene exists before navigation
    if (!this.scene.get(sceneName)) {
      console.error(`[SystemHubScene] Scene not found: ${sceneName}`)
      this.showToast(`Scene "${sceneName}" not available`, 'error')
      return
    }

    // Disable input on this scene first to prevent double-taps
    this.input.enabled = false

    // Stop this scene first, THEN start the new scene
    // This ensures clean transition without race conditions
    this.scene.stop()

    // Start the target scene fresh
    this.scene.start(sceneName, { returnScene: 'GameScene' })
  }

  closeScene() {
    console.log('[SystemHubScene] closeScene() called')

    const returnScene = this.initData?.returnScene || 'GameScene'
    console.log('[SystemHubScene] Returning to:', returnScene)

    // CRITICAL: Proper order to prevent input conflicts
    // 1. Disable input on THIS scene first
    this.input.enabled = false
    console.log('[SystemHubScene] Disabled input on hub scene')

    // 2. Re-enable input on the RETURN scene BEFORE resuming
    try {
      const gameScene = this.scene.get(returnScene)
      if (gameScene) {
        gameScene.input.enabled = true
        console.log('[SystemHubScene] Re-enabled input on:', returnScene)
      }
    } catch (e) {
      console.error('[SystemHubScene] Failed to re-enable input:', e)
    }

    // 3. Bring return scene to TOP of scene stack (for input priority)
    try {
      this.scene.bringToTop(returnScene)
      console.log('[SystemHubScene] Brought to top:', returnScene)
    } catch (e) {
      console.error('[SystemHubScene] Failed to bring to top:', e)
    }

    // 4. Resume the return scene
    try {
      this.scene.resume(returnScene)
      console.log('[SystemHubScene] Resumed:', returnScene)
    } catch (e) {
      console.error('[SystemHubScene] Failed to resume return scene:', e)
    }

    // 5. Resume UIScene
    this.readiness.resumeUIScene()

    // 5. Stop THIS scene LAST
    this.scene.stop()
    console.log('[SystemHubScene] Scene stopped')
  }

  shutdown() {
    console.log('[SystemHubScene] shutdown() called')

    // Safety net: always try to resume UIScene on shutdown
    try {
      this.scene.resume('UIScene')
    } catch (e) {
      // Ignore errors
    }

    super.shutdown()
    this.contentItems = []
    this.tabButtons = []
  }
}

export default SystemHubScene
