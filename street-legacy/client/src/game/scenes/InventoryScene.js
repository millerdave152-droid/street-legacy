import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney } from '../../utils/formatters'
import { ITEMS, getPlayerData, savePlayerData } from '../data/GameData'
import { audioManager } from '../managers/AudioManager'
import { COLORS, BORDERS, DEPTH, getTextStyle, getTerminalStyle, toHexString, SYMBOLS } from '../ui/NetworkTheme'

/**
 * InventoryScene - Complete inventory management system
 *
 * Features:
 * - Buy items from shop
 * - Store items in stash (protect from theft)
 * - Create/craft items from components
 * - Sell items for cash
 * - Steal items (risky)
 * - Protect valuable items
 */
export class InventoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'InventoryScene' })
    this.inventory = []
    this.stash = []  // Protected storage
    this.contentItems = []
    this.scrollOffset = 0
    this.activeCategory = 'all'
    this.activeTab = 'inventory'  // 'inventory', 'shop', 'stash', 'craft'
  }

  async create() {
    console.log('[InventoryScene] create() started')
    const { width, height } = this.cameras.main

    // CRITICAL: Bring this scene to top of scene stack for input priority
    this.scene.bringToTop()

    // CRITICAL: Ensure GameScene input stays disabled while we're active
    try {
      const gameScene = this.scene.get('GameScene')
      if (gameScene && gameScene.input) {
        gameScene.input.enabled = false
      }
    } catch (e) {}

    // Constants
    this.SCROLL_START_Y = 200  // After main tabs and category tabs
    this.SCROLL_END_Y = height - 20
    this.CARD_WIDTH = width - 40
    this.CARD_HEIGHT = 90

    // Item category config
    this.CATEGORY_CONFIG = {
      all: { icon: '📦', label: 'All', color: '#888888' },
      weapon: { icon: '🔫', label: 'Weapons', color: '#ef4444' },
      gear: { icon: '🛡️', label: 'Gear', color: '#3b82f6' },
      consumable: { icon: '💊', label: 'Items', color: '#22c55e' },
      tool: { icon: '🔧', label: 'Tools', color: '#f59e0b' },
      electronics: { icon: '📱', label: 'Tech', color: '#a855f7' }
    }

    // Shop items available for purchase (with persistence)
    this.shopItems = this.getOrGenerateShopItems()

    // Full screen dark background
    this.add.rectangle(0, 0, width, height, COLORS.bg.screen, 1)
      .setOrigin(0)
      .setDepth(0)

    // Create grid pattern
    this.createGridPattern()

    // Header
    this.createHeader()

    // Main navigation tabs (Inventory, Shop, Stash, Craft)
    this.createMainTabs()

    // Category tabs (shown for inventory tab)
    this.createCategoryTabs()

    // Close button
    this.createCloseButton()

    // Setup scrolling
    this.setupScrolling()

    // Loading text
    this.loadingText = this.add.text(width / 2, height / 2, 'Loading...', {
      fontSize: '16px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(10)

    // Load inventory
    await this.loadInventory()
  }

  createMainTabs() {
    const { width } = this.cameras.main
    const tabY = 110
    const tabs = [
      { id: 'inventory', icon: '[I]', label: 'Inventory' },
      { id: 'shop', icon: '[S]', label: 'Shop' },
      { id: 'stash', icon: '[L]', label: 'Stash' },
      { id: 'craft', icon: '[C]', label: 'Craft' }
    ]
    const gap = 6
    const tabWidth = (width - 40 - (tabs.length - 1) * gap) / tabs.length
    const startX = 20 + tabWidth / 2

    this.mainTabs = {}

    tabs.forEach((tab, i) => {
      const x = startX + i * (tabWidth + gap)
      const isActive = this.activeTab === tab.id

      const bg = this.add.rectangle(x, tabY, tabWidth, 34, isActive ? 0xea580c : COLORS.bg.panel, 0.95)
        .setStrokeStyle(1, isActive ? 0xea580c : COLORS.network.dim)
        .setInteractive({ useHandCursor: true })
        .setDepth(10)

      const text = this.add.text(x, tabY, `${tab.icon}`, {
        ...getTerminalStyle('sm'),
        color: isActive ? '#000000' : toHexString(COLORS.text.muted)
      }).setOrigin(0.5).setDepth(11)

      const label = this.add.text(x, tabY + 22, tab.label, {
        fontSize: '8px',
        color: isActive ? '#000000' : '#6b7280'
      }).setOrigin(0.5).setDepth(11)

      bg.on('pointerover', () => {
        if (this.activeTab !== tab.id) {
          bg.setFillStyle(COLORS.bg.card, 0.95)
          text.setColor(toHexString(COLORS.text.secondary))
        }
      })

      bg.on('pointerout', () => {
        if (this.activeTab !== tab.id) {
          bg.setFillStyle(COLORS.bg.panel, 0.95)
          text.setColor(toHexString(COLORS.text.muted))
        }
      })

      bg.on('pointerdown', () => {
        this.switchMainTab(tab.id)
        try { audioManager.playClick() } catch (e) { /* ignore */ }
      })

      this.mainTabs[tab.id] = { bg, text, label }
    })
  }

  switchMainTab(tabId) {
    if (this.activeTab === tabId) return

    this.activeTab = tabId
    this.scrollOffset = 0

    // Update tab styles
    Object.keys(this.mainTabs).forEach(id => {
      const isActive = id === tabId
      this.mainTabs[id].bg.setFillStyle(isActive ? 0xea580c : COLORS.bg.panel, 0.95)
      this.mainTabs[id].bg.setStrokeStyle(1, isActive ? 0xea580c : COLORS.network.dim)
      this.mainTabs[id].text.setColor(isActive ? '#000000' : toHexString(COLORS.text.muted))
      this.mainTabs[id].label.setColor(isActive ? '#000000' : '#6b7280')
    })

    // Show/hide category tabs (only for inventory)
    Object.values(this.categoryTabs).forEach(tab => {
      tab.bg.setVisible(tabId === 'inventory')
      tab.text.setVisible(tabId === 'inventory')
    })

    // Adjust scroll start based on tab
    this.SCROLL_START_Y = tabId === 'inventory' ? 200 : 165

    this.renderContent()
  }

  createGridPattern() {
    const { width, height } = this.cameras.main
    const graphics = this.add.graphics()
    graphics.setDepth(1)

    // Draw subtle grid
    graphics.lineStyle(1, 0x2a2010, 0.2)
    for (let x = 0; x < width; x += 30) {
      graphics.lineBetween(x, 0, x, height)
    }
    for (let y = 0; y < height; y += 30) {
      graphics.lineBetween(0, y, width, y)
    }
  }

  createHeader() {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData()

    // Header icon with background - terminal style
    const iconBg = this.add.circle(width / 2, 35, 26, COLORS.bg.panel)
      .setStrokeStyle(2, 0xea580c, 0.5)
      .setDepth(9)

    this.add.text(width / 2, 35, '[I]', {
      ...getTerminalStyle('xl'),
      color: '#ea580c'
    }).setOrigin(0.5).setDepth(10)

    // Title with terminal style
    this.add.text(width / 2, 72, 'INVENTORY', {
      ...getTerminalStyle('xl'),
      color: '#ea580c'
    }).setOrigin(0.5).setDepth(10)

    // Stats cards
    const infoY = 100
    const cardWidth = (width - 50) / 2

    // Cash card
    const cashCardX = 20 + cardWidth / 2
    this.add.rectangle(cashCardX, infoY, cardWidth, 32, COLORS.bg.panel)
      .setStrokeStyle(1, COLORS.network.primary, 0.4)
      .setDepth(9)

    this.cashText = this.add.text(cashCardX, infoY, `${SYMBOLS.cash} ${formatMoney(player?.cash || 0)}`, {
      fontSize: '11px',
      color: toHexString(COLORS.network.primary)
    }).setOrigin(0.5).setDepth(10)

    // Items card
    const itemsCardX = width - 20 - cardWidth / 2
    this.add.rectangle(itemsCardX, infoY, cardWidth, 32, COLORS.bg.panel)
      .setStrokeStyle(1, 0xea580c, 0.4)
      .setDepth(9)

    this.itemCountText = this.add.text(itemsCardX, infoY, `${SYMBOLS.system} 0 Items`, {
      fontSize: '11px',
      color: '#ea580c'
    }).setOrigin(0.5).setDepth(10)
  }

  createCategoryTabs() {
    const { width } = this.cameras.main
    const tabY = 165  // Below main tabs
    const categories = ['all', 'weapon', 'consumable', 'tool']
    const gap = 6
    const tabWidth = (width - 40 - (categories.length - 1) * gap) / categories.length
    const startX = 20 + tabWidth / 2

    this.categoryTabs = {}

    categories.forEach((cat, i) => {
      const x = startX + i * (tabWidth + gap)
      const config = this.CATEGORY_CONFIG[cat]
      const isActive = this.activeCategory === cat

      const bg = this.add.rectangle(x, tabY, tabWidth, 26, isActive ? 0x3b82f6 : 0x1e293b, 0.9)
        .setStrokeStyle(1, isActive ? 0x60a5fa : 0x334155)
        .setInteractive({ useHandCursor: true })
        .setDepth(10)

      const text = this.add.text(x, tabY, `${config.icon}`, {
        fontSize: '16px',  // 10% bigger
        color: isActive ? '#ffffff' : '#888888'
      }).setOrigin(0.5).setDepth(11)

      bg.on('pointerover', () => {
        if (this.activeCategory !== cat) {
          bg.setFillStyle(0x3a4a5a, 0.9)
          text.setColor('#ffffff')
        }
      })

      bg.on('pointerout', () => {
        if (this.activeCategory !== cat) {
          bg.setFillStyle(0x1e293b, 0.9)
          text.setColor('#888888')
        }
      })

      bg.on('pointerdown', () => {
        this.switchCategory(cat)
        try { audioManager.playClick() } catch (e) { /* ignore */ }
      })

      this.categoryTabs[cat] = { bg, text }
    })
  }

  switchCategory(category) {
    if (this.activeCategory === category) return

    this.activeCategory = category
    this.scrollOffset = 0

    // Update tab styles
    Object.keys(this.categoryTabs).forEach(cat => {
      const isActive = cat === category
      this.categoryTabs[cat].bg.setFillStyle(isActive ? 0xf59e0b : 0x1e293b, 0.9)
      this.categoryTabs[cat].bg.setStrokeStyle(1, isActive ? 0xfbbf24 : 0x334155)
      this.categoryTabs[cat].text.setColor(isActive ? '#000000' : '#888888')
    })

    this.renderContent()
  }

  createCloseButton() {
    const { width } = this.cameras.main

    const closeBtn = this.add.text(width - 25, 25, '✕', {
      fontSize: '28px',
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
      this.closeScene()
    })
  }

  setupScrolling() {
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      this.scrollOffset = Math.max(0, this.scrollOffset + deltaY * 0.5)
      this.renderContent()
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
      if (pointer.isDown && startY > 0) {
        const deltaY = startY - pointer.y
        this.scrollOffset = Math.max(0, startOffset + deltaY)
        this.renderContent()
      }
    })

    this.input.on('pointerup', () => {
      startY = 0
    })
  }

  async loadInventory() {
    try {
      const player = gameManager.player || getPlayerData()

      // Get inventory from player data
      this.inventory = player.inventory || []

      // If no inventory, create some starter items for demo
      if (this.inventory.length === 0) {
        this.inventory = [
          { id: 'lockpick_1', name: 'Lockpick Set', type: 'tool', quantity: 3, description: 'Basic lockpicking tools', sellPrice: 50 },
          { id: 'bandage_1', name: 'First Aid Kit', type: 'consumable', quantity: 2, description: 'Restores 25 health', sellPrice: 30, effect: { health: 25 } },
          { id: 'energy_drink_1', name: 'Energy Drink', type: 'consumable', quantity: 5, description: 'Restores 20 energy', sellPrice: 15, effect: { energy: 20 } }
        ]
        player.inventory = this.inventory
        savePlayerData(player)
      }

      this.loadingText?.destroy()
      this.updateItemCount()
      this.renderContent()
    } catch (error) {
      console.error('Failed to load inventory:', error)
      this.loadingText?.setText('Failed to load inventory')
    }
  }

  updateItemCount() {
    const count = this.inventory.reduce((sum, item) => sum + (item.quantity || 1), 0)
    if (this.itemCountText) {
      this.itemCountText.setText(`${SYMBOLS.system} ${count} Items`)
    }
  }

  clearContent() {
    this.contentItems.forEach(item => item.destroy())
    this.contentItems = []
  }

  renderContent() {
    this.clearContent()

    switch (this.activeTab) {
      case 'inventory':
        this.renderInventoryTab()
        break
      case 'shop':
        this.renderShopTab()
        break
      case 'stash':
        this.renderStashTab()
        break
      case 'craft':
        this.renderCraftTab()
        break
    }
  }

  renderInventoryTab() {
    // Filter items by category
    let items = this.inventory
    if (this.activeCategory !== 'all') {
      items = this.inventory.filter(item => item.type === this.activeCategory)
    }

    if (items.length === 0) {
      this.renderEmptyState('Your inventory is empty', 'Buy items from the Shop or earn them from crimes!')
      return
    }

    const { width } = this.cameras.main
    let y = this.SCROLL_START_Y - this.scrollOffset

    items.forEach((item, index) => {
      const cardY = y + index * (this.CARD_HEIGHT + 10)

      if (cardY + this.CARD_HEIGHT > this.SCROLL_START_Y - 10 && cardY < this.SCROLL_END_Y) {
        this.renderItemCard(item, cardY)
      }
    })
  }

  renderShopTab() {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData()

    // Shop header with benefits info
    const headerY = this.SCROLL_START_Y - 30
    const headerBg = this.add.rectangle(width / 2, headerY, width - 30, 45, 0x1a2a3a, 0.9)
      .setStrokeStyle(1, 0x3b82f6, 0.4)
      .setDepth(10)
    this.contentItems.push(headerBg)

    this.add.text(30, headerY - 10, '🏪 BLACK MARKET', {
      fontSize: '12px',
      color: '#3b82f6',
      fontStyle: 'bold'
    }).setDepth(11)
    this.contentItems.push(this.children.list[this.children.list.length - 1])

    this.add.text(30, headerY + 8, 'Buy items to boost your op success rate', {
      fontSize: '9px',
      color: '#6b7280'
    }).setDepth(11)
    this.contentItems.push(this.children.list[this.children.list.length - 1])

    // Player cash display
    this.add.text(width - 30, headerY, `💵 ${formatMoney(player.cash || 0)}`, {
      fontSize: '12px',
      color: '#22c55e'
    }).setOrigin(1, 0.5).setDepth(11)
    this.contentItems.push(this.children.list[this.children.list.length - 1])

    // Shop items
    let y = this.SCROLL_START_Y + 25 - this.scrollOffset

    this.shopItems.forEach((item, index) => {
      const cardY = y + index * (this.CARD_HEIGHT + 8)

      if (cardY + this.CARD_HEIGHT > this.SCROLL_START_Y - 10 && cardY < this.SCROLL_END_Y) {
        this.renderShopItem(item, cardY)
      }
    })
  }

  renderShopItem(item, y) {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData()
    const config = this.CATEGORY_CONFIG[item.category] || this.CATEGORY_CONFIG.all
    const canAfford = (player.cash || 0) >= item.price
    const finalPrice = item.discount > 0 ? Math.floor(item.price * (1 - item.discount / 100)) : item.price

    // Card background
    const cardBg = this.add.rectangle(width / 2, y + this.CARD_HEIGHT / 2,
      this.CARD_WIDTH, this.CARD_HEIGHT - 5, 0x1e293b, canAfford && item.inStock ? 0.95 : 0.6)
      .setStrokeStyle(1, canAfford && item.inStock ? 0x3b82f6 : 0x333333)
      .setDepth(10)
    this.contentItems.push(cardBg)

    // Item icon (10% bigger)
    const iconBg = this.add.circle(50, y + this.CARD_HEIGHT / 2 - 5, 22,
      parseInt(config.color.replace('#', '0x')), 0.2)
      .setDepth(11)
    this.contentItems.push(iconBg)

    const icon = this.add.text(50, y + this.CARD_HEIGHT / 2 - 5, config.icon, {
      fontSize: '26px'  // 10% bigger
    }).setOrigin(0.5).setDepth(12)
    this.contentItems.push(icon)

    // Item name
    const name = this.add.text(90, y + 15, item.name, {
      fontSize: '14px',
      color: canAfford && item.inStock ? '#ffffff' : '#555555',
      fontStyle: 'bold'
    }).setDepth(11)
    this.contentItems.push(name)

    // Description
    const desc = this.add.text(90, y + 35, item.description || 'No description', {
      fontSize: '9px',
      color: '#888888'
    }).setDepth(11)
    this.contentItems.push(desc)

    // Effect info
    if (item.effect) {
      const effects = Object.entries(item.effect)
        .map(([k, v]) => `+${v}% ${k.replace(/Bonus|Reduction/, '')}`)
        .join(', ')
      const effectText = this.add.text(90, y + 52, `📈 ${effects}`, {
        fontSize: '9px',
        color: '#4ade80'
      }).setDepth(11)
      this.contentItems.push(effectText)
    }

    // Stock status
    if (!item.inStock) {
      const stockText = this.add.text(90, y + 68, '❌ OUT OF STOCK', {
        fontSize: '9px',
        color: '#ef4444'
      }).setDepth(11)
      this.contentItems.push(stockText)
    }

    // Price display
    const priceX = width - 50
    if (item.discount > 0) {
      // Original price (strikethrough effect)
      const origPrice = this.add.text(priceX, y + 20, formatMoney(item.price), {
        fontSize: '10px',
        color: '#666666'
      }).setOrigin(0.5).setDepth(11)
      this.contentItems.push(origPrice)

      // Discount badge
      const discBadge = this.add.rectangle(priceX, y + 8, 40, 14, 0xef4444, 0.9)
        .setDepth(11)
      this.contentItems.push(discBadge)

      const discText = this.add.text(priceX, y + 8, `-${item.discount}%`, {
        fontSize: '9px',
        color: '#ffffff'
      }).setOrigin(0.5).setDepth(12)
      this.contentItems.push(discText)
    }

    // Final price
    const priceText = this.add.text(priceX, item.discount > 0 ? y + 38 : y + 25, formatMoney(finalPrice), {
      fontSize: '14px',
      color: canAfford ? '#22c55e' : '#ef4444',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11)
    this.contentItems.push(priceText)

    // Buy button
    if (item.inStock) {
      const buyBtn = this.add.rectangle(priceX, y + 60, 60, 24, canAfford ? 0x22c55e : 0x374151)
        .setInteractive({ useHandCursor: canAfford })
        .setDepth(11)
      this.contentItems.push(buyBtn)

      if (canAfford) {
        buyBtn.on('pointerover', () => buyBtn.setFillStyle(0x16a34a))
        buyBtn.on('pointerout', () => buyBtn.setFillStyle(0x22c55e))
        buyBtn.on('pointerdown', () => this.buyItem(item, finalPrice))
      }

      const buyText = this.add.text(priceX, y + 60, 'BUY', {
        fontSize: '10px',
        color: canAfford ? '#ffffff' : '#666666',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(12)
      this.contentItems.push(buyText)
    }
  }

  buyItem(item, price) {
    const player = gameManager.player || getPlayerData()

    if ((player.cash || 0) < price) {
      this.showToast('Not enough cash!', false)
      return
    }

    // Deduct cash
    player.cash = (player.cash || 0) - price

    // Add item to inventory
    const existingItem = this.inventory.find(i => i.id === item.id || i.name === item.name)
    if (existingItem && item.stackable) {
      existingItem.quantity = (existingItem.quantity || 1) + 1
    } else {
      this.inventory.push({
        id: `${item.id}_${Date.now()}`,
        name: item.name,
        type: item.category,
        quantity: 1,
        description: item.description,
        sellPrice: Math.floor(price * 0.6),
        effect: item.effect
      })
    }

    // Save
    player.inventory = this.inventory
    savePlayerData(player)
    gameManager.player = player

    // Update UI
    this.cashText?.setText(`${SYMBOLS.cash} ${formatMoney(player.cash)}`)
    this.showToast(`Bought ${item.name}!`, true)
    try { audioManager.playCashGain(0) } catch (e) { /* ignore */ }
    this.updateItemCount()
    this.renderContent()
  }

  renderStashTab() {
    const { width } = this.cameras.main
    const player = gameManager.player || getPlayerData()
    this.stash = player.stash || []

    // Stash info header
    const headerY = this.SCROLL_START_Y - 30
    const headerBg = this.add.rectangle(width / 2, headerY, width - 30, 55, 0x2a1a3a, 0.9)
      .setStrokeStyle(1, 0xa855f7, 0.4)
      .setDepth(10)
    this.contentItems.push(headerBg)

    this.add.text(30, headerY - 15, '🔒 SECURE STASH', {
      fontSize: '12px',
      color: '#a855f7',
      fontStyle: 'bold'
    }).setDepth(11)
    this.contentItems.push(this.children.list[this.children.list.length - 1])

    this.add.text(30, headerY + 3, 'Protected storage - items here cannot be stolen', {
      fontSize: '9px',
      color: '#6b7280'
    }).setDepth(11)
    this.contentItems.push(this.children.list[this.children.list.length - 1])

    this.add.text(30, headerY + 18, `Capacity: ${this.stash.length}/10 items`, {
      fontSize: '9px',
      color: this.stash.length >= 10 ? '#ef4444' : '#a855f7'
    }).setDepth(11)
    this.contentItems.push(this.children.list[this.children.list.length - 1])

    if (this.stash.length === 0) {
      this.renderEmptyState('Your stash is empty', 'Move valuable items here to protect them from theft!')
      return
    }

    // Stash items
    let y = this.SCROLL_START_Y + 35 - this.scrollOffset

    this.stash.forEach((item, index) => {
      const cardY = y + index * (this.CARD_HEIGHT + 8)

      if (cardY + this.CARD_HEIGHT > this.SCROLL_START_Y - 10 && cardY < this.SCROLL_END_Y) {
        this.renderStashItem(item, cardY, index)
      }
    })
  }

  renderStashItem(item, y, index) {
    const { width } = this.cameras.main
    const config = this.CATEGORY_CONFIG[item.type] || this.CATEGORY_CONFIG.all

    // Card background with purple theme
    const cardBg = this.add.rectangle(width / 2, y + this.CARD_HEIGHT / 2,
      this.CARD_WIDTH, this.CARD_HEIGHT - 5, 0x2a1a3a, 0.95)
      .setStrokeStyle(1, 0xa855f7, 0.4)
      .setDepth(10)
    this.contentItems.push(cardBg)

    // Protected badge
    const protectBadge = this.add.rectangle(width - 45, y + 15, 50, 18, 0xa855f7, 0.3)
      .setDepth(11)
    this.contentItems.push(protectBadge)

    const protectText = this.add.text(width - 45, y + 15, '🔒 SAFE', {
      fontSize: '8px',
      color: '#a855f7'
    }).setOrigin(0.5).setDepth(12)
    this.contentItems.push(protectText)

    // Item icon
    const icon = this.add.text(50, y + this.CARD_HEIGHT / 2 - 5, config.icon, {
      fontSize: '26px'
    }).setOrigin(0.5).setDepth(12)
    this.contentItems.push(icon)

    // Item name
    const name = this.add.text(90, y + 15, item.name, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setDepth(11)
    this.contentItems.push(name)

    // Description
    const desc = this.add.text(90, y + 35, item.description || 'Protected item', {
      fontSize: '9px',
      color: '#888888'
    }).setDepth(11)
    this.contentItems.push(desc)

    // Retrieve button
    const retrieveBtn = this.add.rectangle(width - 45, y + 55, 70, 24, 0x3b82f6)
      .setInteractive({ useHandCursor: true })
      .setDepth(11)
    this.contentItems.push(retrieveBtn)

    retrieveBtn.on('pointerover', () => retrieveBtn.setFillStyle(0x2563eb))
    retrieveBtn.on('pointerout', () => retrieveBtn.setFillStyle(0x3b82f6))
    retrieveBtn.on('pointerdown', () => this.retrieveFromStash(index))

    const retrieveText = this.add.text(width - 45, y + 55, 'RETRIEVE', {
      fontSize: '9px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(12)
    this.contentItems.push(retrieveText)
  }

  retrieveFromStash(index) {
    const player = gameManager.player || getPlayerData()
    const item = this.stash[index]

    if (!item) return

    // Move to inventory
    this.inventory.push(item)
    this.stash.splice(index, 1)

    // Save
    player.inventory = this.inventory
    player.stash = this.stash
    savePlayerData(player)
    gameManager.player = player

    this.showToast(`Retrieved ${item.name}!`, true)
    this.updateItemCount()
    this.renderContent()
  }

  renderCraftTab() {
    const { width } = this.cameras.main

    // Craft info header
    const headerY = this.SCROLL_START_Y - 30
    const headerBg = this.add.rectangle(width / 2, headerY, width - 30, 45, 0x3a2a1a, 0.9)
      .setStrokeStyle(1, 0xf59e0b, 0.4)
      .setDepth(10)
    this.contentItems.push(headerBg)

    this.add.text(30, headerY - 10, '⚒️ CRAFTING', {
      fontSize: '12px',
      color: '#f59e0b',
      fontStyle: 'bold'
    }).setDepth(11)
    this.contentItems.push(this.children.list[this.children.list.length - 1])

    this.add.text(30, headerY + 8, 'Combine items to create powerful gear', {
      fontSize: '9px',
      color: '#6b7280'
    }).setDepth(11)
    this.contentItems.push(this.children.list[this.children.list.length - 1])

    // Crafting recipes
    const recipes = [
      {
        name: 'Upgraded Lockpicks',
        icon: '🔓',
        ingredients: ['Lockpick Set', 'Toolkit'],
        result: 'Master Lockpicks',
        effect: '+25% burglary success'
      },
      {
        name: 'Reinforced Vest',
        icon: '🦺',
        ingredients: ['Kevlar Vest', 'Medkit'],
        result: 'Combat Vest',
        effect: '+40% damage reduction'
      },
      {
        name: 'Encrypted Scanner',
        icon: '📡',
        ingredients: ['Police Scanner', 'Burner Phone'],
        result: 'Stealth Scanner',
        effect: '-50% heat gain'
      },
      {
        name: 'Street Cocktail',
        icon: '⚡',
        ingredients: ['Energy Drink x3'],
        result: 'Power Boost',
        effect: '+50 energy instantly'
      }
    ]

    let y = this.SCROLL_START_Y + 25 - this.scrollOffset

    recipes.forEach((recipe, index) => {
      const cardY = y + index * (this.CARD_HEIGHT + 8)

      if (cardY + this.CARD_HEIGHT > this.SCROLL_START_Y - 10 && cardY < this.SCROLL_END_Y) {
        this.renderCraftRecipe(recipe, cardY)
      }
    })
  }

  renderCraftRecipe(recipe, y) {
    const { width } = this.cameras.main

    // Check if player has ingredients
    const hasIngredients = recipe.ingredients.every(ing => {
      const match = ing.match(/(.+) x(\d+)/)
      if (match) {
        const [, name, qty] = match
        const item = this.inventory.find(i => i.name === name)
        return item && (item.quantity || 1) >= parseInt(qty)
      }
      return this.inventory.some(i => i.name === ing)
    })

    // Card background
    const cardBg = this.add.rectangle(width / 2, y + this.CARD_HEIGHT / 2,
      this.CARD_WIDTH, this.CARD_HEIGHT - 5, hasIngredients ? 0x3a2a1a : 0x1e293b, 0.95)
      .setStrokeStyle(1, hasIngredients ? 0xf59e0b : 0x333333, 0.5)
      .setDepth(10)
    this.contentItems.push(cardBg)

    // Recipe icon
    const icon = this.add.text(50, y + this.CARD_HEIGHT / 2 - 5, recipe.icon, {
      fontSize: '28px'
    }).setOrigin(0.5).setDepth(12)
    this.contentItems.push(icon)

    // Recipe name
    const name = this.add.text(90, y + 12, recipe.name, {
      fontSize: '13px',
      color: hasIngredients ? '#ffffff' : '#666666',
      fontStyle: 'bold'
    }).setDepth(11)
    this.contentItems.push(name)

    // Ingredients
    const ingText = this.add.text(90, y + 30, `Needs: ${recipe.ingredients.join(' + ')}`, {
      fontSize: '9px',
      color: hasIngredients ? '#4ade80' : '#ef4444'
    }).setDepth(11)
    this.contentItems.push(ingText)

    // Result
    const resultText = this.add.text(90, y + 48, `Creates: ${recipe.result}`, {
      fontSize: '9px',
      color: '#f59e0b'
    }).setDepth(11)
    this.contentItems.push(resultText)

    // Effect
    const effectText = this.add.text(90, y + 64, `📈 ${recipe.effect}`, {
      fontSize: '9px',
      color: '#22c55e'
    }).setDepth(11)
    this.contentItems.push(effectText)

    // Craft button
    const craftBtn = this.add.rectangle(width - 45, y + this.CARD_HEIGHT / 2, 60, 28,
      hasIngredients ? 0xf59e0b : 0x374151)
      .setInteractive({ useHandCursor: hasIngredients })
      .setDepth(11)
    this.contentItems.push(craftBtn)

    if (hasIngredients) {
      craftBtn.on('pointerover', () => craftBtn.setFillStyle(0xd97706))
      craftBtn.on('pointerout', () => craftBtn.setFillStyle(0xf59e0b))
      craftBtn.on('pointerdown', () => this.craftItem(recipe))
    }

    const craftText = this.add.text(width - 45, y + this.CARD_HEIGHT / 2, 'CRAFT', {
      fontSize: '10px',
      color: hasIngredients ? '#000000' : '#666666',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(12)
    this.contentItems.push(craftText)
  }

  craftItem(recipe) {
    const player = gameManager.player || getPlayerData()

    // Remove ingredients
    recipe.ingredients.forEach(ing => {
      const match = ing.match(/(.+) x(\d+)/)
      if (match) {
        const [, name, qty] = match
        const idx = this.inventory.findIndex(i => i.name === name)
        if (idx !== -1) {
          this.inventory[idx].quantity = (this.inventory[idx].quantity || 1) - parseInt(qty)
          if (this.inventory[idx].quantity <= 0) {
            this.inventory.splice(idx, 1)
          }
        }
      } else {
        const idx = this.inventory.findIndex(i => i.name === ing)
        if (idx !== -1) {
          this.inventory.splice(idx, 1)
        }
      }
    })

    // Add crafted item
    this.inventory.push({
      id: `crafted_${Date.now()}`,
      name: recipe.result,
      type: 'tool',
      quantity: 1,
      description: recipe.effect,
      sellPrice: 500
    })

    // Save
    player.inventory = this.inventory
    savePlayerData(player)
    gameManager.player = player

    this.showToast(`Crafted ${recipe.result}!`, true)
    this.updateItemCount()
    this.renderContent()
  }

  renderEmptyState(title = 'No Items', message = 'Run ops or buy items to fill your inventory!') {
    const { width } = this.cameras.main
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    const icon = this.add.text(width / 2, centerY - 40, '📦', {
      fontSize: '52px'  // 10% bigger
    }).setOrigin(0.5).setDepth(10)
    this.contentItems.push(icon)

    const titleText = this.add.text(width / 2, centerY + 15, title, {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(10)
    this.contentItems.push(titleText)

    const msg = this.add.text(width / 2, centerY + 45, message, {
      fontSize: '11px',
      color: '#888888',
      align: 'center',
      wordWrap: { width: this.CARD_WIDTH - 40 }
    }).setOrigin(0.5).setDepth(10)
    this.contentItems.push(msg)
  }

  renderItemCard(item, y) {
    const { width } = this.cameras.main
    const config = this.CATEGORY_CONFIG[item.type] || this.CATEGORY_CONFIG.all
    const player = gameManager.player || getPlayerData()
    const stash = player.stash || []
    const canStash = stash.length < 10

    // Card background
    const cardBg = this.add.rectangle(width / 2, y + this.CARD_HEIGHT / 2,
      this.CARD_WIDTH, this.CARD_HEIGHT - 5, 0x1e293b, 0.95)
      .setStrokeStyle(1, 0x334155)
      .setInteractive({ useHandCursor: true })
      .setDepth(10)
    this.contentItems.push(cardBg)

    // Left color accent
    const accentColor = parseInt(config.color.replace('#', '0x'))
    const accent = this.add.rectangle(22, y + this.CARD_HEIGHT / 2, 4, this.CARD_HEIGHT - 15, accentColor)
      .setDepth(11)
    this.contentItems.push(accent)

    // Item icon - 10% bigger
    const iconBg = this.add.circle(50, y + this.CARD_HEIGHT / 2 - 5, 24, accentColor, 0.2)
      .setDepth(11)
    this.contentItems.push(iconBg)

    const iconText = this.add.text(50, y + this.CARD_HEIGHT / 2 - 5, config.icon, {
      fontSize: '28px'  // 10% bigger
    }).setOrigin(0.5).setDepth(12)
    this.contentItems.push(iconText)

    // Item name
    const nameText = this.add.text(90, y + 12, item.name || 'Unknown Item', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setDepth(11)
    this.contentItems.push(nameText)

    // Item type badge
    const typeBadge = this.add.rectangle(90 + nameText.width + 25, y + 17, 45, 14, accentColor, 0.3)
      .setDepth(11)
    this.contentItems.push(typeBadge)

    const typeText = this.add.text(90 + nameText.width + 25, y + 17, item.type?.toUpperCase() || 'ITEM', {
      fontSize: '7px',
      color: config.color
    }).setOrigin(0.5).setDepth(12)
    this.contentItems.push(typeText)

    // Description
    const descText = this.add.text(90, y + 32, item.description || 'No description', {
      fontSize: '9px',
      color: '#888888'
    }).setDepth(11)
    this.contentItems.push(descText)

    // Stats row
    const statsY = y + 50
    let statsX = 90

    // Quantity
    if (item.quantity > 1) {
      const qtyText = this.add.text(statsX, statsY, `x${item.quantity}`, {
        fontSize: '10px',
        color: '#f59e0b'
      }).setDepth(11)
      this.contentItems.push(qtyText)
      statsX += 35
    }

    // Sell price
    if (item.sellPrice) {
      const priceText = this.add.text(statsX, statsY, `💰${formatMoney(item.sellPrice)}`, {
        fontSize: '10px',
        color: '#22c55e'
      }).setDepth(11)
      this.contentItems.push(priceText)
    }

    // Effect indicator
    if (item.effect) {
      const effectStr = Object.entries(item.effect)
        .map(([k, v]) => `+${v}`)
        .join(' ')
      const effectText = this.add.text(90, y + 68, `📈 ${effectStr}`, {
        fontSize: '9px',
        color: '#4ade80'
      }).setDepth(11)
      this.contentItems.push(effectText)
    }

    // Action buttons - right side column
    const btnX = width - 40
    let btnY = y + 18

    // Use button (for consumables)
    if (item.type === 'consumable' && item.effect) {
      const useBtn = this.add.rectangle(btnX, btnY, 50, 22, 0x22c55e)
        .setInteractive({ useHandCursor: true })
        .setDepth(11)
      this.contentItems.push(useBtn)

      useBtn.on('pointerover', () => useBtn.setFillStyle(0x16a34a))
      useBtn.on('pointerout', () => useBtn.setFillStyle(0x22c55e))
      useBtn.on('pointerdown', (pointer, localX, localY, event) => {
        event.stopPropagation()
        this.useItem(item)
      })

      const useBtnText = this.add.text(btnX, btnY, 'USE', {
        fontSize: '9px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(12)
      this.contentItems.push(useBtnText)

      btnY += 26
    }

    // Store to stash button
    if (canStash) {
      const stashBtn = this.add.rectangle(btnX, btnY, 50, 22, 0xa855f7)
        .setInteractive({ useHandCursor: true })
        .setDepth(11)
      this.contentItems.push(stashBtn)

      stashBtn.on('pointerover', () => stashBtn.setFillStyle(0x9333ea))
      stashBtn.on('pointerout', () => stashBtn.setFillStyle(0xa855f7))
      stashBtn.on('pointerdown', (pointer, localX, localY, event) => {
        event.stopPropagation()
        this.storeToStash(item)
      })

      const stashBtnText = this.add.text(btnX, btnY, '🔒', {
        fontSize: '12px'
      }).setOrigin(0.5).setDepth(12)
      this.contentItems.push(stashBtnText)

      btnY += 26
    }

    // Sell button
    if (item.sellPrice) {
      const sellBtn = this.add.rectangle(btnX, btnY, 50, 22, 0xf59e0b)
        .setInteractive({ useHandCursor: true })
        .setDepth(11)
      this.contentItems.push(sellBtn)

      sellBtn.on('pointerover', () => sellBtn.setFillStyle(0xd97706))
      sellBtn.on('pointerout', () => sellBtn.setFillStyle(0xf59e0b))
      sellBtn.on('pointerdown', (pointer, localX, localY, event) => {
        event.stopPropagation()
        this.sellItem(item)
      })

      const sellBtnText = this.add.text(btnX, btnY, 'SELL', {
        fontSize: '9px',
        color: '#000000',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(12)
      this.contentItems.push(sellBtnText)
    }

    // Card tap for details
    cardBg.on('pointerdown', () => this.showItemDetails(item))
  }

  storeToStash(item) {
    const player = gameManager.player || getPlayerData()
    player.stash = player.stash || []

    if (player.stash.length >= 10) {
      this.showToast('Stash is full!', false)
      return
    }

    // Remove from inventory
    const idx = this.inventory.findIndex(i => i.id === item.id)
    if (idx !== -1) {
      this.inventory.splice(idx, 1)
    }

    // Add to stash
    player.stash.push(item)

    // Save
    player.inventory = this.inventory
    savePlayerData(player)
    gameManager.player = player

    this.showToast(`Stored ${item.name} safely!`, true)
    this.updateItemCount()
    this.renderContent()
  }

  showItemDetails(item) {
    const { width, height } = this.cameras.main
    const modalElements = []
    const config = this.CATEGORY_CONFIG[item.type] || this.CATEGORY_CONFIG.all
    const accentColor = parseInt(config.color.replace('#', '0x'))

    // Overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
      .setOrigin(0)
      .setInteractive()
      .setDepth(200)
    modalElements.push(overlay)

    // Modal
    const modalHeight = 280
    const modalWidth = Math.min(300, width - 40)
    const modal = this.add.rectangle(width / 2, height / 2, modalWidth, modalHeight, 0x1a1a3a, 0.98)
      .setStrokeStyle(2, accentColor)
      .setDepth(201)
    modalElements.push(modal)

    // Close button
    const closeBtn = this.add.text(width / 2 + modalWidth / 2 - 20, height / 2 - modalHeight / 2 + 20, '✕', {
      fontSize: '20px',
      color: '#888888'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(202)
    modalElements.push(closeBtn)

    // Icon
    const iconY = height / 2 - modalHeight / 2 + 55
    const icon = this.add.text(width / 2, iconY, config.icon, {
      fontSize: '48px'
    }).setOrigin(0.5).setDepth(202)
    modalElements.push(icon)

    // Name
    const name = this.add.text(width / 2, iconY + 45, item.name || 'Unknown Item', {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(202)
    modalElements.push(name)

    // Type badge
    const typeBadge = this.add.rectangle(width / 2, iconY + 70, 70, 20, accentColor, 0.3)
      .setDepth(202)
    modalElements.push(typeBadge)

    const typeLabel = this.add.text(width / 2, iconY + 70, item.type?.toUpperCase() || 'ITEM', {
      fontSize: '10px',
      color: config.color
    }).setOrigin(0.5).setDepth(203)
    modalElements.push(typeLabel)

    // Description
    const desc = this.add.text(width / 2, iconY + 100, item.description || 'No description available', {
      fontSize: '11px',
      color: '#888888',
      align: 'center',
      wordWrap: { width: modalWidth - 40 }
    }).setOrigin(0.5).setDepth(202)
    modalElements.push(desc)

    // Stats
    const statsY = iconY + 130
    const statsX = width / 2 - modalWidth / 2 + 30

    if (item.quantity) {
      const qtyLabel = this.add.text(statsX, statsY, 'Quantity:', {
        fontSize: '11px',
        color: '#888888'
      }).setDepth(202)
      modalElements.push(qtyLabel)

      const qtyValue = this.add.text(statsX + 70, statsY, `${item.quantity}`, {
        fontSize: '11px',
        color: '#f59e0b'
      }).setDepth(202)
      modalElements.push(qtyValue)
    }

    if (item.sellPrice) {
      const priceLabel = this.add.text(statsX + 120, statsY, 'Value:', {
        fontSize: '11px',
        color: '#888888'
      }).setDepth(202)
      modalElements.push(priceLabel)

      const priceValue = this.add.text(statsX + 160, statsY, formatMoney(item.sellPrice), {
        fontSize: '11px',
        color: '#22c55e'
      }).setDepth(202)
      modalElements.push(priceValue)
    }

    // Effect info for consumables
    if (item.effect) {
      const effectY = statsY + 25
      const effects = []
      if (item.effect.health) effects.push(`+${item.effect.health} Health`)
      if (item.effect.energy) effects.push(`+${item.effect.energy} Energy`)
      if (item.effect.heat) effects.push(`${item.effect.heat > 0 ? '+' : ''}${item.effect.heat} Heat`)

      if (effects.length > 0) {
        const effectText = this.add.text(width / 2, effectY, `Effect: ${effects.join(', ')}`, {
          fontSize: '11px',
          color: '#22c55e'
        }).setOrigin(0.5).setDepth(202)
        modalElements.push(effectText)
      }
    }

    // Buttons
    const btnY = height / 2 + modalHeight / 2 - 45

    if (item.type === 'consumable' && item.effect) {
      // Use button
      const useBtn = this.add.rectangle(width / 2 - 55, btnY, 90, 32, 0x22c55e)
        .setInteractive({ useHandCursor: true }).setDepth(202)
      modalElements.push(useBtn)

      useBtn.on('pointerover', () => useBtn.setFillStyle(0x16a34a))
      useBtn.on('pointerout', () => useBtn.setFillStyle(0x22c55e))
      useBtn.on('pointerdown', () => {
        this.closeModal(modalElements)
        this.useItem(item)
      })

      const useText = this.add.text(width / 2 - 55, btnY, 'Use', {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(203)
      modalElements.push(useText)

      // Sell button
      if (item.sellPrice) {
        const sellBtn = this.add.rectangle(width / 2 + 55, btnY, 90, 32, 0xf59e0b)
          .setInteractive({ useHandCursor: true }).setDepth(202)
        modalElements.push(sellBtn)

        sellBtn.on('pointerover', () => sellBtn.setFillStyle(0xd97706))
        sellBtn.on('pointerout', () => sellBtn.setFillStyle(0xf59e0b))
        sellBtn.on('pointerdown', () => {
          this.closeModal(modalElements)
          this.sellItem(item)
        })

        const sellText = this.add.text(width / 2 + 55, btnY, 'Sell', {
          fontSize: '12px',
          color: '#000000',
          fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(203)
        modalElements.push(sellText)
      }
    } else if (item.sellPrice) {
      // Just sell button
      const sellBtn = this.add.rectangle(width / 2, btnY, 120, 32, 0xf59e0b)
        .setInteractive({ useHandCursor: true }).setDepth(202)
      modalElements.push(sellBtn)

      sellBtn.on('pointerover', () => sellBtn.setFillStyle(0xd97706))
      sellBtn.on('pointerout', () => sellBtn.setFillStyle(0xf59e0b))
      sellBtn.on('pointerdown', () => {
        this.closeModal(modalElements)
        this.sellItem(item)
      })

      const sellText = this.add.text(width / 2, btnY, `Sell ${formatMoney(item.sellPrice)}`, {
        fontSize: '12px',
        color: '#000000',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(203)
      modalElements.push(sellText)
    }

    // Close handlers
    const closeModal = () => this.closeModal(modalElements)
    closeBtn.on('pointerdown', closeModal)
    overlay.on('pointerdown', closeModal)
  }

  closeModal(elements) {
    elements.forEach(el => el.destroy())
  }

  useItem(item) {
    const player = gameManager.player || getPlayerData()

    // Apply effects
    if (item.effect) {
      if (item.effect.health) {
        player.health = Math.min(100, (player.health || 100) + item.effect.health)
      }
      if (item.effect.energy) {
        player.energy = Math.min(100, (player.energy || 100) + item.effect.energy)
      }
      if (item.effect.heat !== undefined) {
        player.heat = Math.max(0, Math.min(100, (player.heat || 0) + item.effect.heat))
      }
    }

    // Remove item from inventory
    const idx = this.inventory.findIndex(i => i.id === item.id)
    if (idx !== -1) {
      if (this.inventory[idx].quantity > 1) {
        this.inventory[idx].quantity--
      } else {
        this.inventory.splice(idx, 1)
      }
    }

    // Save
    player.inventory = this.inventory
    savePlayerData(player)
    gameManager.player = player

    this.showToast(`Used ${item.name}!`, true)
    try { audioManager.playClick() } catch (e) { /* ignore */ }
    this.updateItemCount()
    this.renderContent()
  }

  sellItem(item) {
    const player = gameManager.player || getPlayerData()

    // Add cash
    player.cash = (player.cash || 0) + (item.sellPrice || 0)

    // Remove item
    const idx = this.inventory.findIndex(i => i.id === item.id)
    if (idx !== -1) {
      if (this.inventory[idx].quantity > 1) {
        this.inventory[idx].quantity--
      } else {
        this.inventory.splice(idx, 1)
      }
    }

    // Save
    player.inventory = this.inventory
    savePlayerData(player)
    gameManager.player = player

    // Update UI
    this.cashText.setText(`${SYMBOLS.cash} ${formatMoney(player.cash)}`)
    this.showToast(`Sold for ${formatMoney(item.sellPrice)}!`, true)
    try { audioManager.playCashGain(item.sellPrice) } catch (e) { /* ignore */ }
    this.updateItemCount()
    this.renderContent()
  }

  showToast(message, isSuccess = true) {
    const { width } = this.cameras.main

    const toastBg = this.add.rectangle(width / 2, 170, 220, 36, isSuccess ? 0x22c55e : 0xef4444, 0.95)
      .setDepth(400)
    const toastText = this.add.text(width / 2, 170, message, {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(401)

    // Animate in
    toastBg.setAlpha(0).setY(150)
    toastText.setAlpha(0).setY(150)

    this.tweens.add({
      targets: [toastBg, toastText],
      alpha: 1,
      y: 170,
      duration: 200,
      ease: 'Power2'
    })

    // Animate out
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: [toastBg, toastText],
        alpha: 0,
        y: 150,
        duration: 300,
        onComplete: () => {
          toastBg.destroy()
          toastText.destroy()
        }
      })
    })
  }

  // Get or generate shop items with persistence
  getOrGenerateShopItems() {
    const SHOP_UPDATE_INTERVAL = 3600000 // 1 hour

    // Try to get stored shop data
    let shopData
    try {
      const stored = localStorage.getItem('street_legacy_shop')
      shopData = stored ? JSON.parse(stored) : null
    } catch (e) {
      shopData = null
    }

    const now = Date.now()

    // Check if we need to regenerate shop
    if (!shopData || !shopData.items || (now - shopData.lastUpdate) > SHOP_UPDATE_INTERVAL) {
      // Generate new shop items
      const newItems = ITEMS.map(item => ({
        ...item,
        inStock: Math.random() > 0.3,  // 70% chance item is in stock
        discount: Math.random() > 0.8 ? Math.floor(Math.random() * 20) + 5 : 0  // 20% chance for discount
      }))

      // Save new shop state
      shopData = {
        items: newItems,
        lastUpdate: now
      }
      try {
        localStorage.setItem('street_legacy_shop', JSON.stringify(shopData))
      } catch (e) {
        console.error('[InventoryScene] Failed to save shop state:', e)
      }
    }

    return shopData.items
  }

  closeScene() {
    const sceneManager = this.scene

    // CRITICAL: Re-enable input on GameScene BEFORE resuming
    try {
      const gameScene = sceneManager.get('GameScene')
      if (gameScene) {
        gameScene.input.enabled = true
      }
    } catch (e) {}

    sceneManager.stop()

    // CRITICAL: Bring GameScene to top and resume
    try {
      sceneManager.bringToTop('GameScene')
    } catch (e) {}
    sceneManager.resume('GameScene')
    try {
      sceneManager.resume('UIScene')
    } catch (e) {}
  }
}
