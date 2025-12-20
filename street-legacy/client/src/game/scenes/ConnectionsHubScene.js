/**
 * ConnectionsHubScene - Consolidated Crew/Travel/Inventory Hub
 *
 * Part of the OS-style dashboard redesign.
 * Combines all "network" operations into a single tabbed interface.
 */

import Phaser from 'phaser'
import { BaseScene } from './BaseScene'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { audioManager } from '../managers/AudioManager'
import { SceneReadinessManager } from '../managers/SceneReadinessManager'
import { CREW_MEMBERS, DISTRICTS, ITEMS, getPlayerData, savePlayerData } from '../data/GameData.js'
import { COLORS, BORDERS, DEPTH, LAYOUT, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'
import { networkTransition } from '../ui/NetworkTransition'

// Role configuration for crew display
const ROLE_CONFIG = {
  enforcer: { icon: '[E]', color: 0xEF4444, bonus: '+15% violent ops' },
  hacker: { icon: '[H]', color: 0x8B5CF6, bonus: '-20% cooldown' },
  driver: { icon: '[D]', color: 0x3B82F6, bonus: '+20% vehicle ops' },
  lookout: { icon: '[L]', color: 0x22C55E, bonus: '-25% heat gain' },
  muscle: { icon: '[M]', color: 0xF97316, bonus: '+20% intimidation' },
  insider: { icon: '[I]', color: 0x06B6D4, bonus: '+15% intel' }
}

export class ConnectionsHubScene extends BaseScene {
  constructor() {
    super('ConnectionsHubScene')
    this.activeTab = 'crew' // 'crew' | 'travel' | 'items'
    this.contentItems = []
    this.tabButtons = []
    this.readiness = null // SceneReadinessManager instance
  }

  init(data) {
    super.init(data)
    console.log('[ConnectionsHubScene] init() called with data:', JSON.stringify(data || {}))
    console.log('[ConnectionsHubScene] returnScene:', data?.returnScene)

    // Create readiness manager for proper lifecycle handling
    this.readiness = new SceneReadinessManager(this)

    if (data?.tab) {
      this.activeTab = data.tab
    }
  }

  async create() {
    console.log('[ConnectionsHubScene] create() started')
    super.create({ skipIntro: true })

    // CRITICAL: Block input until scene is fully ready
    this.readiness.beginCreate()

    // CRITICAL: Bring this scene to top of scene stack for input priority
    this.scene.bringToTop()
    console.log('[ConnectionsHubScene] Brought self to top of scene stack')

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
    networkTransition.playSceneIntro(this, 'ConnectionsHubScene')

    // Header
    this.createHeader()

    // Close button
    this.createCloseButton()

    // Status overview
    this.createStatusOverview()

    // Tab bar
    this.createTabBar()

    // AWAIT content loading (like CrimeScene does)
    try {
      await this.loadContent()
      console.log('[ConnectionsHubScene] Content loaded successfully')
    } catch (error) {
      console.error('[ConnectionsHubScene] Failed to load content:', error)
    }

    // CRITICAL: Mark scene ready - this enables input after a short delay
    await this.readiness.markReady(100)

    // Emit sceneReady for NetworkTransition coordination
    this.events.emit('sceneReady')
    console.log('[ConnectionsHubScene] create() completed, scene fully ready')

    // Handle scene resume/pause for input management
    this.events.on('resume', () => {
      console.log('[ConnectionsHubScene] Scene resumed')
      this.input.enabled = true
    })

    this.events.on('pause', () => {
      console.log('[ConnectionsHubScene] Scene paused')
      this.input.enabled = false
    })
  }

  createBackgroundPattern() {
    const { width, height } = this.cameras.main
    const graphics = this.add.graphics().setDepth(DEPTH.GRID)

    // Grid pattern with blue tint for network
    graphics.lineStyle(1, 0x4488FF, 0.1)
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

    // Blue accent line (network = connections color)
    this.add.rectangle(width / 2, 68, width, 2, 0x4488FF, 0.8)
      .setDepth(DEPTH.CONTENT_BASE)

    // Icon
    const icon = this.add.text(width / 2 - 120, 28, '[@]', {
      ...getTerminalStyle('lg'),
      color: '#4488FF'
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
    this.add.text(width / 2, 28, 'NETWORK TERMINAL', {
      ...getTerminalStyle('xl'),
      color: '#4488FF'
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Subtitle
    this.add.text(width / 2, 52, `${SYMBOLS.system} CREW • TRAVEL • INVENTORY`, {
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
      closeBtn.setColor('#4488FF')
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

  createStatusOverview() {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}

    // Status bar background
    const barY = 85
    this.add.rectangle(width / 2, barY, width - 20, 30, COLORS.bg.panel, 0.9)
      .setStrokeStyle(1, 0x4488FF, 0.3)
      .setDepth(DEPTH.CONTENT_BASE)

    // Current location
    const currentDistrict = player.current_district || player.currentDistrict || 'Downtown'
    this.add.text(25, barY, '[M] LOCATION:', {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(0, 0.5).setDepth(DEPTH.PANEL_CONTENT)

    this.add.text(115, barY, currentDistrict, {
      ...getTerminalStyle('sm'),
      color: '#4488FF'
    }).setOrigin(0, 0.5).setDepth(DEPTH.PANEL_CONTENT)

    // Crew count
    const crewCount = (player.crewMembers || []).length
    this.add.text(width - 25, barY, `[@] ${crewCount}/6 CREW`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setOrigin(1, 0.5).setDepth(DEPTH.PANEL_CONTENT)
  }

  createTabBar() {
    const { width } = this.cameras.main
    const tabY = 118
    const tabWidth = (width - 40) / 3

    const tabs = [
      { key: 'crew', label: 'CREW', icon: '[@]', color: 0x3B82F6 },
      { key: 'travel', label: 'TRAVEL', icon: '[M]', color: 0x4F46E5 },
      { key: 'items', label: 'ITEMS', icon: '[I]', color: 0xEA580C }
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
      case 'crew':
        this.renderCrewContent(startY)
        break
      case 'travel':
        this.renderTravelContent(startY)
        break
      case 'items':
        this.renderItemsContent(startY)
        break
    }
  }

  clearContent() {
    this.contentItems.forEach(item => {
      if (item && item.destroy) item.destroy()
    })
    this.contentItems = []
  }

  renderCrewContent(startY) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}
    const myCrew = player.crewMembers || []

    // Section header
    const headerText = this.add.text(25, startY, `${SYMBOLS.system} YOUR CREW`, {
      ...getTerminalStyle('sm'),
      color: '#3B82F6'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(headerText)

    // Available hires
    const availableText = this.add.text(width - 25, startY, `Available: ${CREW_MEMBERS.length - myCrew.length}`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setOrigin(1, 0).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(availableText)

    const cardHeight = 75
    const cardSpacing = 6

    // Show current crew members
    if (myCrew.length === 0) {
      const noCrewText = this.add.text(width / 2, startY + 60, 'No crew members yet', {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(noCrewText)

      const hireHint = this.add.text(width / 2, startY + 85, 'Tap below to hire your first member', {
        ...getTextStyle('xs', COLORS.text.muted, 'terminal')
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(hireHint)
    } else {
      myCrew.slice(0, 4).forEach((member, index) => {
        const y = startY + 30 + index * (cardHeight + cardSpacing)
        this.createCrewCard(member, y, cardHeight, true)
      })
    }

    // Available for hire section
    const availableY = startY + 30 + Math.max(1, myCrew.length) * (cardHeight + cardSpacing) + 20
    const availableHeader = this.add.text(25, availableY, `${SYMBOLS.system} AVAILABLE FOR HIRE`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(availableHeader)

    const availableHires = CREW_MEMBERS.filter(c => !myCrew.find(m => m.id === c.id))
    availableHires.slice(0, 3).forEach((member, index) => {
      const y = availableY + 25 + index * (cardHeight + cardSpacing)
      if (y < height - 100) {
        this.createCrewCard(member, y, cardHeight, false)
      }
    })

    // View all button
    const btnY = height - 60
    this.createActionButton(width / 2, btnY, 'Manage Crew', 0x3B82F6, () => {
      this.openFullScene('CrewScene')
    })
  }

  createCrewCard(member, y, cardHeight, isHired) {
    const { width } = this.cameras.main
    const roleConfig = ROLE_CONFIG[member.role] || { icon: '[?]', color: 0x666666, bonus: 'Unknown' }

    const card = this.add.rectangle(width / 2, y + cardHeight / 2, width - 30, cardHeight - 4, COLORS.bg.panel, 0.95)
      .setStrokeStyle(1, roleConfig.color, isHired ? 0.6 : 0.3)
      .setDepth(DEPTH.CONTENT_BASE)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(card)

    card.on('pointerover', () => {
      card.setStrokeStyle(2, roleConfig.color, 0.8)
      audioManager.playHover()
    })
    card.on('pointerout', () => {
      card.setStrokeStyle(1, roleConfig.color, isHired ? 0.6 : 0.3)
    })
    card.on('pointerdown', () => {
      audioManager.playClick()
      this.openFullScene('CrewScene')
    })

    // Left accent
    const accent = this.add.rectangle(23, y + cardHeight / 2, 4, cardHeight - 12, roleConfig.color)
      .setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(accent)

    // Role icon
    const iconText = this.add.text(45, y + 18, roleConfig.icon, {
      ...getTerminalStyle('md'),
      color: toHexString(roleConfig.color)
    }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(iconText)

    // Name
    const nameText = this.add.text(65, y + 12, member.name, {
      ...getTextStyle('sm', COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(nameText)

    // Role and bonus
    const roleText = this.add.text(65, y + 30, `${member.role.toUpperCase()} • ${roleConfig.bonus}`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(roleText)

    // Status or cost
    if (isHired) {
      const statusText = this.add.text(width - 40, y + cardHeight / 2, 'HIRED', {
        ...getTextStyle('xs', 0x22C55E, 'terminal'),
        fontStyle: 'bold'
      }).setOrigin(1, 0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(statusText)
    } else {
      const costText = this.add.text(width - 40, y + cardHeight / 2, formatMoney(member.hire_cost || 1000), {
        ...getTextStyle('sm', COLORS.text.gold, 'terminal'),
        fontStyle: 'bold'
      }).setOrigin(1, 0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(costText)
    }
  }

  renderTravelContent(startY) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}
    const currentDistrict = player.current_district || player.currentDistrict || 'Downtown'

    // Section header
    const headerText = this.add.text(25, startY, `${SYMBOLS.system} DESTINATIONS`, {
      ...getTerminalStyle('sm'),
      color: '#4F46E5'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(headerText)

    // Current location
    const locText = this.add.text(width - 25, startY, `From: ${currentDistrict}`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setOrigin(1, 0).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(locText)

    const cardHeight = 65
    const cardSpacing = 6

    // Available districts
    const availableDistricts = DISTRICTS.filter(d => d.id !== currentDistrict && d.id !== player.currentDistrict)

    if (availableDistricts.length === 0) {
      const noDestText = this.add.text(width / 2, height / 2, 'No destinations available', {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(noDestText)
      return
    }

    availableDistricts.slice(0, 6).forEach((district, index) => {
      const y = startY + 30 + index * (cardHeight + cardSpacing)
      if (y < height - 100) {
        this.createDistrictCard(district, y, cardHeight)
      }
    })

    // View all button
    const btnY = height - 60
    this.createActionButton(width / 2, btnY, 'View Map', 0x4F46E5, () => {
      this.openFullScene('TravelScene')
    })
  }

  createDistrictCard(district, y, cardHeight) {
    const { width } = this.cameras.main

    const card = this.add.rectangle(width / 2, y + cardHeight / 2, width - 30, cardHeight - 4, COLORS.bg.panel, 0.95)
      .setStrokeStyle(1, 0x4F46E5, 0.4)
      .setDepth(DEPTH.CONTENT_BASE)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(card)

    card.on('pointerover', () => {
      card.setStrokeStyle(2, 0x4F46E5, 0.7)
      audioManager.playHover()
    })
    card.on('pointerout', () => {
      card.setStrokeStyle(1, 0x4F46E5, 0.4)
    })
    card.on('pointerdown', () => {
      audioManager.playClick()
      this.openFullScene('TravelScene')
    })

    // Left accent
    const accent = this.add.rectangle(23, y + cardHeight / 2, 4, cardHeight - 12, 0x4F46E5)
      .setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(accent)

    // District name
    const nameText = this.add.text(35, y + 12, district.name, {
      ...getTextStyle('sm', COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(nameText)

    // Description
    const descText = this.add.text(35, y + 30, district.description || 'No description', {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(descText)

    // Travel cost
    const cost = district.travel_cost || 0
    const costText = this.add.text(width - 40, y + cardHeight / 2, cost === 0 ? 'FREE' : formatMoney(cost), {
      ...getTextStyle('sm', cost === 0 ? 0x22C55E : COLORS.text.gold, 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(costText)
  }

  renderItemsContent(startY) {
    const { width, height } = this.cameras.main
    const player = gameManager.player || getPlayerData() || {}
    const inventory = player.inventory || []

    // Section header
    const headerText = this.add.text(25, startY, `${SYMBOLS.system} INVENTORY`, {
      ...getTerminalStyle('sm'),
      color: '#EA580C'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(headerText)

    // Item count
    const countText = this.add.text(width - 25, startY, `${inventory.length} items`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setOrigin(1, 0).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(countText)

    const cardHeight = 60
    const cardSpacing = 6

    if (inventory.length === 0) {
      const noItemsText = this.add.text(width / 2, startY + 60, 'No items in inventory', {
        ...getTerminalStyle('md'),
        color: toHexString(COLORS.text.muted)
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(noItemsText)

      const shopHint = this.add.text(width / 2, startY + 85, 'Visit the shop to buy items', {
        ...getTextStyle('xs', COLORS.text.muted, 'terminal')
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(shopHint)
    } else {
      inventory.slice(0, 5).forEach((item, index) => {
        const y = startY + 30 + index * (cardHeight + cardSpacing)
        this.createItemCard(item, y, cardHeight)
      })
    }

    // Quick category buttons
    const catY = startY + 30 + Math.max(1, inventory.length) * (cardHeight + cardSpacing) + 20
    const catHeader = this.add.text(25, catY, `${SYMBOLS.system} CATEGORIES`, {
      ...getTerminalStyle('xs'),
      color: toHexString(COLORS.text.muted)
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(catHeader)

    const categories = [
      { id: 'weapon', icon: '[W]', label: 'Weapons', color: 0xEF4444 },
      { id: 'gear', icon: '[G]', label: 'Gear', color: 0x3B82F6 },
      { id: 'consumable', icon: '[C]', label: 'Items', color: 0x22C55E },
    ]

    const catWidth = (width - 50) / 3
    categories.forEach((cat, index) => {
      const x = 25 + catWidth / 2 + index * (catWidth + 5)
      const catY2 = catY + 30

      const catBtn = this.add.rectangle(x, catY2, catWidth, 35, cat.color, 0.15)
        .setStrokeStyle(1, cat.color, 0.4)
        .setDepth(DEPTH.CONTENT_BASE)
        .setInteractive({ useHandCursor: true })
      this.contentItems.push(catBtn)

      catBtn.on('pointerover', () => {
        catBtn.setFillStyle(cat.color, 0.25)
        audioManager.playHover()
      })
      catBtn.on('pointerout', () => {
        catBtn.setFillStyle(cat.color, 0.15)
      })
      catBtn.on('pointerdown', () => {
        audioManager.playClick()
        this.openFullScene('InventoryScene')
      })

      const catLabel = this.add.text(x, catY2, `${cat.icon} ${cat.label}`, {
        ...getTextStyle('xs', COLORS.text.primary, 'terminal')
      }).setOrigin(0.5).setDepth(DEPTH.PANEL_CONTENT)
      this.contentItems.push(catLabel)
    })

    // View all button
    const btnY = height - 60
    this.createActionButton(width / 2, btnY, 'Full Inventory', 0xEA580C, () => {
      this.openFullScene('InventoryScene')
    })
  }

  createItemCard(item, y, cardHeight) {
    const { width } = this.cameras.main
    const itemData = ITEMS.find(i => i.id === item.id) || item

    const categoryColors = {
      weapon: 0xEF4444,
      gear: 0x3B82F6,
      consumable: 0x22C55E,
      tool: 0xF59E0B,
      electronics: 0xA855F7
    }
    const itemColor = categoryColors[itemData.category] || 0xEA580C

    const card = this.add.rectangle(width / 2, y + cardHeight / 2, width - 30, cardHeight - 4, COLORS.bg.panel, 0.95)
      .setStrokeStyle(1, itemColor, 0.4)
      .setDepth(DEPTH.CONTENT_BASE)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(card)

    card.on('pointerdown', () => {
      audioManager.playClick()
      this.openFullScene('InventoryScene')
    })

    // Left accent
    const accent = this.add.rectangle(23, y + cardHeight / 2, 4, cardHeight - 12, itemColor)
      .setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(accent)

    // Item name
    const nameText = this.add.text(35, y + 12, itemData.name || 'Unknown Item', {
      ...getTextStyle('sm', COLORS.text.primary, 'terminal'),
      fontStyle: 'bold'
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(nameText)

    // Quantity
    const qty = item.quantity || 1
    const qtyText = this.add.text(35, y + 30, `x${qty}`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal')
    }).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(qtyText)

    // Value
    const valueText = this.add.text(width - 40, y + cardHeight / 2, formatMoney(itemData.sell_price || 0), {
      ...getTextStyle('xs', COLORS.text.gold, 'terminal')
    }).setOrigin(1, 0.5).setDepth(DEPTH.PANEL_CONTENT)
    this.contentItems.push(valueText)
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

  openFullScene(sceneName) {
    console.log(`[ConnectionsHubScene] Navigating to ${sceneName}`)

    // Resume UIScene before transitioning - original scenes expect it to be active
    try {
      this.scene.resume('UIScene')
    } catch (e) {
      console.error('[ConnectionsHubScene] Failed to resume UIScene:', e)
    }

    // DO NOT resume GameScene here - keep it paused with input disabled
    // The target scene will handle returning to GameScene when done

    // Use scene.start() for cleaner transition to sub-scenes
    this.scene.start(sceneName)
  }

  closeScene() {
    console.log('[ConnectionsHubScene] closeScene() called')

    const returnScene = this.initData?.returnScene || 'GameScene'
    console.log('[ConnectionsHubScene] Returning to:', returnScene)

    // CRITICAL: Proper order to prevent input conflicts
    // 1. Disable input on THIS scene first
    this.input.enabled = false
    console.log('[ConnectionsHubScene] Disabled input on hub scene')

    // 2. Re-enable input on the RETURN scene BEFORE resuming
    try {
      const gameScene = this.scene.get(returnScene)
      if (gameScene) {
        gameScene.input.enabled = true
        console.log('[ConnectionsHubScene] Re-enabled input on:', returnScene)
      }
    } catch (e) {
      console.error('[ConnectionsHubScene] Failed to re-enable input:', e)
    }

    // 3. Bring return scene to TOP of scene stack (for input priority)
    try {
      this.scene.bringToTop(returnScene)
      console.log('[ConnectionsHubScene] Brought to top:', returnScene)
    } catch (e) {
      console.error('[ConnectionsHubScene] Failed to bring to top:', e)
    }

    // 4. Resume the return scene
    try {
      this.scene.resume(returnScene)
      console.log('[ConnectionsHubScene] Resumed:', returnScene)
    } catch (e) {
      console.error('[ConnectionsHubScene] Failed to resume return scene:', e)
    }

    // 5. Resume UIScene
    this.readiness.resumeUIScene()

    // 5. Stop THIS scene LAST
    this.scene.stop()
    console.log('[ConnectionsHubScene] Scene stopped')
  }

  shutdown() {
    console.log('[ConnectionsHubScene] shutdown() called')

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

export default ConnectionsHubScene
