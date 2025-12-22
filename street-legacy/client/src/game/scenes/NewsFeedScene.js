import Phaser from 'phaser'
import { BaseScene } from './BaseScene'
import { narrativeService } from '../../services/narrativeSystems.service'
import { audioManager } from '../managers/AudioManager'
import { notificationManager } from '../managers/NotificationManager'
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

const savePlayerData = (player) => {
  try {
    localStorage.setItem('street_legacy_player', JSON.stringify(player))
  } catch (e) {
    console.error('[NewsFeedScene] Failed to save player data:', e)
  }
}

const getNewsData = () => {
  try {
    const data = localStorage.getItem('street_legacy_news')
    return data ? JSON.parse(data) : { feed: [], subscriptions: [], lastGenerated: 0 }
  } catch (e) {
    return { feed: [], subscriptions: [], lastGenerated: 0 }
  }
}

const saveNewsData = (newsData) => {
  try {
    localStorage.setItem('street_legacy_news', JSON.stringify(newsData))
  } catch (e) {
    console.error('[NewsFeedScene] Failed to save news data:', e)
  }
}

/**
 * NewsFeedScene - Street Broadcast News Feed
 *
 * Features:
 * - Scrollable news feed list
 * - Breaking news highlighted in red
 * - Unread indicator dots
 * - Tap to expand full article
 * - Subscribe/unsubscribe per district
 * - Pull to refresh
 * - Mark all read button
 * - Mobile-first touch scrolling
 * - Local storage fallback with dynamic news generation
 */
export class NewsFeedScene extends BaseScene {
  constructor() {
    super('NewsFeedScene')

    // News templates for local generation
    this.NEWS_TEMPLATES = {
      crime: [
        { headline: 'Crime Wave Hits {district}', summary: 'Local authorities report a spike in criminal activity across {district}. Residents advised to stay vigilant.', significance: 5 },
        { headline: 'Police Crackdown in {district}', summary: 'Law enforcement increases patrols in response to recent criminal activity.', significance: 6 },
        { headline: 'Underground Markets Flourish', summary: 'Black market operations continue to expand despite police efforts.', significance: 4 },
        { headline: 'Stolen Goods Ring Busted', summary: 'Authorities seize millions in stolen merchandise from local warehouse.', significance: 7 },
        { headline: 'Pickpocketing on the Rise', summary: 'Downtown areas see increase in petty theft incidents.', significance: 3 }
      ],
      territory: [
        { headline: 'Gang Tensions Rise in {district}', summary: 'Rival crews clash over territorial control. Violence expected to escalate.', significance: 7 },
        { headline: '{district} Under New Control', summary: 'Power shift in the streets as new crew takes over local operations.', significance: 8 },
        { headline: 'Turf War Brewing', summary: 'Multiple crews stake claims to profitable corners in {district}.', significance: 6 },
        { headline: 'Peace Treaty Broken', summary: 'Former allies now enemies as territorial agreements fall apart.', significance: 7 },
        { headline: 'New Crew Emerges', summary: 'Unknown organization makes bold moves in the underworld.', significance: 5 }
      ],
      economy: [
        { headline: 'Drug Prices Spike', summary: 'Street value of common substances reaches all-time high.', significance: 5 },
        { headline: 'Cash Flow Disrupted', summary: 'Major supplier disappearance causes market instability.', significance: 6 },
        { headline: 'Underground Economy Booms', summary: 'Shadow markets report record profits this quarter.', significance: 4 },
        { headline: 'Counterfeit Bills Circulating', summary: 'Fake currency flooding local businesses. Verify your cash.', significance: 5 },
        { headline: 'Fence Operations Expand', summary: 'More outlets available for moving stolen goods.', significance: 4 }
      ],
      player: [
        { headline: 'Rising Star on the Streets', summary: 'Word spreads about a new player making moves in the underworld.', significance: 4, requiresLevel: 5 },
        { headline: 'Notorious Criminal at Large', summary: 'Police seek information on prolific offender.', significance: 6, requiresHeat: 50 },
        { headline: 'Millionaire Hustler', summary: 'Street legend accumulates impressive fortune through illicit means.', significance: 7, requiresCash: 100000 },
        { headline: 'Crime Boss in the Making', summary: 'Ambitious individual rises through criminal ranks.', significance: 8, requiresLevel: 15 },
        { headline: 'Wanted: High Heat Target', summary: 'Law enforcement prioritizes capture of heat-generating criminal.', significance: 9, requiresHeat: 80 }
      ],
      breaking: [
        { headline: 'BREAKING: Major Bust Downtown', summary: 'Coordinated police operation nets dozens of arrests.', significance: 9 },
        { headline: 'BREAKING: Shooting in {district}', summary: 'Multiple casualties reported. Area locked down.', significance: 10 },
        { headline: 'BREAKING: Bank Heist Foiled', summary: 'Armed suspects flee scene after alarm triggered.', significance: 9 },
        { headline: 'BREAKING: Drug Lab Explosion', summary: 'Illegal operation goes wrong. Emergency services respond.', significance: 8 },
        { headline: 'BREAKING: Gang Leader Arrested', summary: 'Top criminal figure taken into custody after lengthy investigation.', significance: 10 }
      ],
      system: [
        { headline: 'New Opportunities Available', summary: 'Fresh jobs and crimes now accessible to skilled operators.', significance: 3 },
        { headline: 'Market Prices Updated', summary: 'Trading values have been adjusted based on supply and demand.', significance: 2 },
        { headline: 'Heat Levels Cooling', summary: 'Police activity decreasing in most districts.', significance: 3 },
        { headline: 'Weekly Reset Complete', summary: 'Jobs and opportunities have been refreshed.', significance: 2 },
        { headline: 'Energy Restored', summary: 'Rest up - new day means new chances to hustle.', significance: 2 }
      ]
    }

    // Districts for news generation
    this.DISTRICTS = ['Downtown', 'Parkdale', 'Scarborough', 'Etobicoke', 'North York', 'Yorkville']
  }

  create() {
    super.create()

    // Constants
    this.CARD_HEIGHT = 100
    this.CARD_PADDING = 8
    this.HEADER_HEIGHT = 130
    this.SCROLL_START_Y = this.HEADER_HEIGHT + 10
    this.SCROLL_END_Y = this.height - 70
    this.PULL_THRESHOLD = 60

    // News category configurations
    this.NEWS_CATEGORIES = {
      breaking: { icon: '🚨', color: 0xef4444, label: 'BREAKING', priority: 1 },
      crime: { icon: '🔫', color: 0xf59e0b, label: 'CRIME', priority: 2 },
      territory: { icon: '🏴', color: 0x8b5cf6, label: 'TERRITORY', priority: 3 },
      economy: { icon: '💰', color: 0x22c55e, label: 'ECONOMY', priority: 4 },
      crew: { icon: '👥', color: 0x3b82f6, label: 'CREW', priority: 5 },
      player: { icon: '👤', color: 0x6b7280, label: 'PLAYER', priority: 6 },
      system: { icon: '📢', color: 0x64748b, label: 'SYSTEM', priority: 7 }
    }

    // State
    this.newsFeed = []
    this.subscriptions = []
    this.contentItems = []
    this.scrollOffset = 0
    this.maxScrollOffset = 0
    this.isLoading = true
    this.isRefreshing = false
    this.expandedNewsId = null
    this.unreadCount = 0

    // Pull to refresh state
    this.pullDistance = 0
    this.isPulling = false

    // Create UI
    this.createBackground()
    this.createHeader()
    this.createActionButtons()
    this.createCloseButton()
    this.createLoadingSpinner()
    this.setupScrolling()
    this.setupPullToRefresh()

    // Load data
    this.loadData()

    // Set up auto-refresh
    this.refreshTimer = this.createInterval(() => {
      if (!this.isLoading && !this.isRefreshing) {
        this.loadData(true) // Silent refresh
      }
    }, 60000) // Refresh every minute
  }

  createBackground() {
    // Full opaque background
    this.add.rectangle(0, 0, this.width, this.height, 0x0a0a15, 1)
      .setOrigin(0)
      .setDepth(0)
      .setInteractive()

    // Scroll area mask
    this.scrollMask = this.add.rectangle(
      this.centerX,
      (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2,
      this.width,
      this.SCROLL_END_Y - this.SCROLL_START_Y,
      0x000000, 0
    )
  }

  createHeader() {
    // Header background
    this.add.rectangle(0, 0, this.width, this.HEADER_HEIGHT, 0x12121f, 1)
      .setOrigin(0)
      .setDepth(10)

    // Title with news icon
    this.add.text(this.centerX, 35, '📰 STREET NEWS', {
      fontSize: '22px',
      color: '#f59e0b',
      fontFamily: 'Arial Black, Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11)

    // Subtitle with unread count
    this.subtitleText = this.add.text(this.centerX, 60, 'Loading...', {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(11)

    // Breaking news ticker area
    this.tickerBg = this.add.rectangle(this.centerX, 90, this.width - 40, 28, 0xef4444, 0.15)
      .setDepth(11)

    this.tickerText = this.add.text(this.centerX, 90, '🔴 Loading breaking news...', {
      fontSize: '11px',
      color: '#ef4444',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11)

    // Divider
    this.add.rectangle(this.centerX, this.HEADER_HEIGHT, this.width - 40, 1, 0x333333)
      .setDepth(11)
  }

  createActionButtons() {
    const btnY = this.height - 40
    const btnWidth = 140
    const btnHeight = 36
    const spacing = 15

    // Mark All Read button
    this.markReadBtn = this.createButton(
      this.centerX - btnWidth / 2 - spacing / 2,
      btnY,
      btnWidth,
      btnHeight,
      '✓ Mark All Read',
      0x3b82f6,
      () => this.markAllRead()
    )

    // Subscriptions button
    this.subsBtn = this.createButton(
      this.centerX + btnWidth / 2 + spacing / 2,
      btnY,
      btnWidth,
      btnHeight,
      '⚙ Subscriptions',
      0x6b7280,
      () => this.showSubscriptionsModal()
    )
  }

  createButton(x, y, width, height, label, color, onClick) {
    const container = this.add.container(x, y).setDepth(20)

    const bg = this.add.rectangle(0, 0, width, height, color, 0.9)
      .setInteractive({ useHandCursor: true })

    const text = this.add.text(0, 0, label, {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    container.add([bg, text])

    bg.on('pointerover', () => {
      bg.setFillStyle(color, 1)
      audioManager.playHover()
    })
    bg.on('pointerout', () => bg.setFillStyle(color, 0.9))
    bg.on('pointerdown', () => {
      audioManager.playClick()
      onClick()
    })

    return container
  }

  createCloseButton() {
    const closeBtn = this.add.text(this.width - 25, 30, '✕', {
      fontSize: '28px',
      color: '#ffffff'
    })
      .setOrigin(0.5)
      .setDepth(DEPTH.CLOSE_BUTTON)
      .setInteractive({ useHandCursor: true })

    closeBtn.on('pointerover', () => {
      closeBtn.setColor('#ef4444')
      closeBtn.setScale(1.1)
    })
    closeBtn.on('pointerout', () => {
      closeBtn.setColor('#ffffff')
      closeBtn.setScale(1)
    })
    closeBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.closeScene()
    })
  }

  createLoadingSpinner() {
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    this.loadingContainer = this.add.container(this.centerX, centerY).setDepth(50)

    const spinner = this.add.circle(0, -20, 20, 0x333333, 0)
    spinner.setStrokeStyle(3, 0xf59e0b)
    this.loadingContainer.add(spinner)

    const loadingText = this.add.text(0, 20, 'Loading news...', {
      fontSize: '14px',
      color: '#888888'
    }).setOrigin(0.5)
    this.loadingContainer.add(loadingText)

    this.tweens.add({
      targets: spinner,
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

  createPullRefreshIndicator() {
    this.pullIndicator = this.add.container(this.centerX, this.SCROLL_START_Y - 30)
      .setDepth(15)
      .setAlpha(0)

    const pullIcon = this.add.text(0, 0, '↓', {
      fontSize: '20px',
      color: '#f59e0b'
    }).setOrigin(0.5)

    const pullText = this.add.text(0, 25, 'Pull to refresh', {
      fontSize: '11px',
      color: '#888888'
    }).setOrigin(0.5)

    this.pullIndicator.add([pullIcon, pullText])
    this.pullIndicatorIcon = pullIcon
    this.pullIndicatorText = pullText
  }

  setupScrolling() {
    // Mouse wheel scrolling
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.isLoading && !this.isPulling) {
        this.scrollOffset = Phaser.Math.Clamp(
          this.scrollOffset + deltaY * 0.5,
          0,
          this.maxScrollOffset
        )
        this.renderContent()
      }
    })

    // Touch/drag scrolling
    let startY = 0
    let startOffset = 0
    let lastY = 0
    let velocity = 0

    this.input.on('pointerdown', (pointer) => {
      if (pointer.y > this.SCROLL_START_Y && pointer.y < this.SCROLL_END_Y) {
        startY = pointer.y
        lastY = pointer.y
        startOffset = this.scrollOffset
        velocity = 0
      }
    })

    this.input.on('pointermove', (pointer) => {
      if (pointer.isDown && startY > 0 && !this.isLoading) {
        const deltaY = startY - pointer.y
        velocity = lastY - pointer.y
        lastY = pointer.y

        // Pull to refresh detection (when scrolled to top)
        if (this.scrollOffset <= 0 && deltaY < 0) {
          this.handlePullToRefresh(-deltaY)
        } else {
          this.isPulling = false
          this.scrollOffset = Math.max(0, startOffset + deltaY)
          this.renderContent()
        }
      }
    })

    this.input.on('pointerup', () => {
      // Check if pull to refresh should trigger
      if (this.isPulling && this.pullDistance >= this.PULL_THRESHOLD) {
        this.triggerRefresh()
      }
      this.resetPullIndicator()

      // Apply momentum scrolling
      if (Math.abs(velocity) > 2) {
        this.applyMomentum(velocity * 5)
      }

      startY = 0
    })
  }

  setupPullToRefresh() {
    this.createPullRefreshIndicator()
  }

  handlePullToRefresh(distance) {
    this.isPulling = true
    this.pullDistance = Math.min(distance, this.PULL_THRESHOLD * 1.5)

    const progress = Math.min(1, this.pullDistance / this.PULL_THRESHOLD)

    if (this.pullIndicator) {
      this.pullIndicator.setAlpha(progress)
      this.pullIndicator.setY(this.SCROLL_START_Y - 30 + this.pullDistance * 0.3)

      // Rotate icon as user pulls
      if (this.pullIndicatorIcon) {
        this.pullIndicatorIcon.setAngle(progress >= 1 ? 180 : 0)
      }

      if (this.pullIndicatorText) {
        this.pullIndicatorText.setText(progress >= 1 ? 'Release to refresh' : 'Pull to refresh')
      }
    }
  }

  resetPullIndicator() {
    this.isPulling = false
    this.pullDistance = 0

    if (this.pullIndicator) {
      this.tweens.add({
        targets: this.pullIndicator,
        alpha: 0,
        y: this.SCROLL_START_Y - 30,
        duration: 200
      })
    }
  }

  triggerRefresh() {
    if (this.isRefreshing) return

    this.isRefreshing = true
    audioManager.playClick()

    if (this.pullIndicatorText) {
      this.pullIndicatorText.setText('Refreshing...')
    }

    // Refresh data
    try {
      narrativeService.clearSystemCache('broadcast')
    } catch (e) {
      // Ignore if service not available
    }

    // Force regenerate local news on refresh
    const newsData = getNewsData()
    newsData.lastGenerated = 0 // Force regeneration
    saveNewsData(newsData)

    this.loadData().finally(() => {
      this.isRefreshing = false
      this.resetPullIndicator()
    })
  }

  applyMomentum(velocity) {
    this.tweens.add({
      targets: { offset: this.scrollOffset },
      offset: Phaser.Math.Clamp(this.scrollOffset + velocity, 0, this.maxScrollOffset),
      duration: 500,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => {
        this.scrollOffset = tween.getValue()
        this.renderContent()
      }
    })
  }

  async loadData(silent = false) {
    if (!silent) {
      this.isLoading = true
      this.clearContent()
    }

    try {
      const [feed, subs] = await Promise.all([
        narrativeService.getNewsFeed(),
        narrativeService.getSubscriptions()
      ])

      this.newsFeed = this.processNewsFeed(feed)
      this.subscriptions = subs || []

      // Count unread
      this.unreadCount = this.newsFeed.filter(n => !n.isRead).length

      // Update UI
      this.updateSubtitle()
      this.updateBreakingTicker()

      this.isLoading = false
      this.hideLoadingSpinner()
      this.renderContent()

    } catch (error) {
      console.error('[NewsFeedScene] API failed, using local storage:', error)
      this.loadLocalData(silent)
    }
  }

  loadLocalData(silent = false) {
    const newsData = getNewsData()
    const player = getPlayerData() || {}
    const now = Date.now()

    // Generate new news if needed (every 5 minutes or first load)
    const newsAge = now - (newsData.lastGenerated || 0)
    if (newsAge > 300000 || newsData.feed.length === 0) {
      const newNews = this.generateLocalNews(player)
      // Keep recent news, add new ones
      const recentNews = (newsData.feed || []).filter(n => now - n.createdAt < 3600000) // 1 hour
      newsData.feed = [...newNews, ...recentNews].slice(0, 30) // Max 30 items
      newsData.lastGenerated = now
      saveNewsData(newsData)
    }

    this.newsFeed = this.processNewsFeed(newsData.feed)
    this.subscriptions = newsData.subscriptions || []

    // Count unread
    this.unreadCount = this.newsFeed.filter(n => !n.isRead).length

    // Update UI
    this.updateSubtitle()
    this.updateBreakingTicker()

    if (!silent) {
      this.isLoading = false
      this.hideLoadingSpinner()
    }
    this.renderContent()
  }

  generateLocalNews(player) {
    const news = []
    const now = Date.now()

    // Generate 3-6 news items per refresh
    const numNews = Phaser.Math.Between(3, 6)
    const categories = ['crime', 'territory', 'economy', 'system']

    // Add player-specific news based on stats
    const playerLevel = player.level || 1
    const playerCash = player.cash || 0
    const playerHeat = player.heat || player.heat_level || 0

    // Check for player news eligibility
    const playerTemplates = this.NEWS_TEMPLATES.player.filter(t => {
      if (t.requiresLevel && playerLevel < t.requiresLevel) return false
      if (t.requiresCash && playerCash < t.requiresCash) return false
      if (t.requiresHeat && playerHeat < t.requiresHeat) return false
      return true
    })

    // 30% chance of player news if eligible
    if (playerTemplates.length > 0 && Math.random() < 0.3) {
      const template = Phaser.Utils.Array.GetRandom(playerTemplates)
      news.push(this.createNewsItem(template, 'player', now))
    }

    // 10% chance of breaking news
    if (Math.random() < 0.1) {
      const template = Phaser.Utils.Array.GetRandom(this.NEWS_TEMPLATES.breaking)
      news.push(this.createNewsItem(template, 'breaking', now - Phaser.Math.Between(0, 300000)))
    }

    // Generate regular news
    for (let i = 0; i < numNews; i++) {
      const category = Phaser.Utils.Array.GetRandom(categories)
      const template = Phaser.Utils.Array.GetRandom(this.NEWS_TEMPLATES[category])
      // Spread news over last hour
      const timeOffset = Phaser.Math.Between(0, 3600000)
      news.push(this.createNewsItem(template, category, now - timeOffset))
    }

    return news
  }

  createNewsItem(template, category, timestamp) {
    const district = Phaser.Utils.Array.GetRandom(this.DISTRICTS)
    const id = `news_${timestamp}_${Math.random().toString(36).substr(2, 9)}`

    return {
      id,
      category,
      headline: template.headline.replace(/{district}/g, district),
      summary: template.summary.replace(/{district}/g, district),
      content: template.summary.replace(/{district}/g, district) + ' More details to follow as the situation develops.',
      significance: template.significance,
      districtName: template.headline.includes('{district}') ? district : null,
      createdAt: timestamp,
      isRead: false,
      readAt: null,
      source: 'Street Wire'
    }
  }

  processNewsFeed(feed) {
    // Sort by priority (breaking first), then by date
    return (feed || []).map(news => ({
      ...news,
      category: news.category || 'system',
      isBreaking: news.significance >= 8 || news.category === 'breaking',
      isRead: news.readAt != null
    })).sort((a, b) => {
      // Breaking news first
      if (a.isBreaking && !b.isBreaking) return -1
      if (!a.isBreaking && b.isBreaking) return 1

      // Then by significance
      if (a.significance !== b.significance) return b.significance - a.significance

      // Then by date
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
  }

  updateSubtitle() {
    const total = this.newsFeed.length
    const unreadText = this.unreadCount > 0 ? ` (${this.unreadCount} unread)` : ''
    this.subtitleText.setText(`${total} news items${unreadText}`)
  }

  updateBreakingTicker() {
    const breakingNews = this.newsFeed.filter(n => n.isBreaking && !n.isRead)

    if (breakingNews.length > 0) {
      const latest = breakingNews[0]
      this.tickerText.setText(`🔴 BREAKING: ${latest.headline || latest.title}`)
      this.tickerBg.setFillStyle(0xef4444, 0.2)

      // Animate ticker
      this.tweens.add({
        targets: this.tickerText,
        alpha: 0.5,
        duration: 500,
        yoyo: true,
        repeat: -1
      })
    } else {
      this.tickerText.setText('📰 No breaking news')
      this.tickerBg.setFillStyle(0x333333, 0.3)
      this.tweens.killTweensOf(this.tickerText)
      this.tickerText.setAlpha(1)
    }
  }

  clearContent() {
    this.contentItems.forEach(item => {
      if (item && item.destroy) item.destroy()
    })
    this.contentItems = []
  }

  renderContent() {
    this.clearContent()

    if (this.isLoading) return

    if (this.newsFeed.length === 0) {
      this.renderEmptyState()
      return
    }

    this.renderNewsFeed()
  }

  renderNewsFeed() {
    let y = this.SCROLL_START_Y - this.scrollOffset

    this.newsFeed.forEach((news, index) => {
      const cardHeight = this.expandedNewsId === news.id ? this.CARD_HEIGHT + 80 : this.CARD_HEIGHT
      const cardY = y

      // Only render visible cards
      if (cardY + cardHeight > this.SCROLL_START_Y - 20 && cardY < this.SCROLL_END_Y + 20) {
        this.renderNewsCard(news, cardY)
      }

      y += cardHeight + this.CARD_PADDING
    })

    // Calculate max scroll
    const totalHeight = this.newsFeed.reduce((sum, news) => {
      return sum + (this.expandedNewsId === news.id ? this.CARD_HEIGHT + 80 : this.CARD_HEIGHT) + this.CARD_PADDING
    }, 0)
    const visibleHeight = this.SCROLL_END_Y - this.SCROLL_START_Y
    this.maxScrollOffset = Math.max(0, totalHeight - visibleHeight + 20)
  }

  renderNewsCard(news, y) {
    const cardWidth = this.width - 30
    const x = this.centerX
    const isExpanded = this.expandedNewsId === news.id
    const cardHeight = isExpanded ? this.CARD_HEIGHT + 80 : this.CARD_HEIGHT

    const config = this.NEWS_CATEGORIES[news.category] || this.NEWS_CATEGORIES.system

    // Card background with breaking highlight
    const bgColor = news.isBreaking ? 0x2a1a1a : 0x1a1a2a
    const strokeColor = news.isBreaking ? 0xef4444 : config.color

    const cardBg = this.add.rectangle(x, y + cardHeight / 2, cardWidth, cardHeight - 4, bgColor, 0.95)
    cardBg.setStrokeStyle(news.isBreaking ? 2 : 1, strokeColor, news.isBreaking ? 1 : 0.6)
    cardBg.setInteractive({ useHandCursor: true })
    this.contentItems.push(cardBg)

    // Unread indicator dot
    if (!news.isRead) {
      const unreadDot = this.add.circle(x - cardWidth / 2 + 12, y + 15, 5, 0x3b82f6)
      this.contentItems.push(unreadDot)

      // Pulse animation for unread
      this.tweens.add({
        targets: unreadDot,
        alpha: 0.4,
        duration: 800,
        yoyo: true,
        repeat: -1
      })
    }

    // Left color bar
    const colorBar = this.add.rectangle(x - cardWidth / 2 + 4, y + cardHeight / 2, 4, cardHeight - 8, config.color)
    this.contentItems.push(colorBar)

    // Category icon
    const iconX = x - cardWidth / 2 + 35
    const icon = this.add.text(iconX, y + 25, config.icon, {
      fontSize: '20px'
    }).setOrigin(0.5)
    this.contentItems.push(icon)

    // Breaking badge
    if (news.isBreaking) {
      const breakingBadge = this.add.rectangle(iconX, y + 50, 50, 16, 0xef4444, 0.9)
      this.contentItems.push(breakingBadge)

      const breakingText = this.add.text(iconX, y + 50, 'BREAKING', {
        fontSize: '8px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5)
      this.contentItems.push(breakingText)
    }

    // Headline
    const textX = x - cardWidth / 2 + 65
    const headline = news.headline || news.title || 'News Update'
    const headlineText = this.add.text(textX, y + 15, headline, {
      fontSize: '14px',
      color: news.isRead ? '#aaaaaa' : '#ffffff',
      fontStyle: 'bold',
      wordWrap: { width: cardWidth - 130 }
    })
    this.contentItems.push(headlineText)

    // Category label
    const labelText = this.add.text(textX + headlineText.width + 8, y + 15, config.label, {
      fontSize: '9px',
      color: `#${config.color.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold'
    })
    this.contentItems.push(labelText)

    // Summary (truncated)
    let summary = news.summary || news.description || ''
    if (!isExpanded && summary.length > 80) {
      summary = summary.substring(0, 80) + '...'
    }

    const summaryText = this.add.text(textX, y + 40, summary, {
      fontSize: '11px',
      color: '#888888',
      wordWrap: { width: cardWidth - 130 }
    })
    this.contentItems.push(summaryText)

    // Time ago
    const timeAgo = this.getTimeAgo(new Date(news.createdAt))
    const timeText = this.add.text(x + cardWidth / 2 - 15, y + 15, timeAgo, {
      fontSize: '10px',
      color: '#666666'
    }).setOrigin(1, 0.5)
    this.contentItems.push(timeText)

    // District tag if applicable
    if (news.districtId || news.districtName) {
      const districtTag = this.add.rectangle(x + cardWidth / 2 - 40, y + 40, 70, 18, 0x333333, 0.8)
      this.contentItems.push(districtTag)

      const districtText = this.add.text(x + cardWidth / 2 - 40, y + 40,
        `📍 ${news.districtName || news.districtId}`, {
          fontSize: '9px',
          color: '#aaaaaa'
        }).setOrigin(0.5)
      this.contentItems.push(districtText)
    }

    // Expanded content
    if (isExpanded) {
      this.renderExpandedContent(news, y + this.CARD_HEIGHT - 10, cardWidth, textX)
    }

    // Tap to expand/collapse
    cardBg.on('pointerdown', () => {
      audioManager.playClick()

      if (this.expandedNewsId === news.id) {
        this.expandedNewsId = null
      } else {
        this.expandedNewsId = news.id
        // Mark as read when expanded
        if (!news.isRead) {
          this.markNewsAsRead(news.id)
        }
      }
      this.renderContent()
    })

    // Hover effect
    cardBg.on('pointerover', () => {
      cardBg.setFillStyle(news.isBreaking ? 0x3a2a2a : 0x2a2a3a, 0.95)
    })
    cardBg.on('pointerout', () => {
      cardBg.setFillStyle(bgColor, 0.95)
    })
  }

  renderExpandedContent(news, y, cardWidth, textX) {
    // Full article text
    const fullText = news.content || news.description || news.summary || ''

    const articleText = this.add.text(textX, y, fullText, {
      fontSize: '11px',
      color: '#cccccc',
      wordWrap: { width: cardWidth - 80 },
      lineSpacing: 4
    })
    this.contentItems.push(articleText)

    // Source/reporter if available
    if (news.source || news.reporter) {
      const sourceText = this.add.text(textX, y + 60, `— ${news.source || news.reporter}`, {
        fontSize: '10px',
        color: '#666666',
        fontStyle: 'italic'
      })
      this.contentItems.push(sourceText)
    }
  }

  async markNewsAsRead(newsId) {
    try {
      await narrativeService.markNewsRead(newsId)

      // Update local state
      const news = this.newsFeed.find(n => n.id === newsId)
      if (news) {
        news.isRead = true
        this.unreadCount = Math.max(0, this.unreadCount - 1)
        this.updateSubtitle()
      }
    } catch (error) {
      console.error('[NewsFeedScene] API failed, marking locally:', error)
      this.markNewsAsReadLocal(newsId)
    }
  }

  markNewsAsReadLocal(newsId) {
    // Update local state
    const news = this.newsFeed.find(n => n.id === newsId)
    if (news) {
      news.isRead = true
      news.readAt = Date.now()
      this.unreadCount = Math.max(0, this.unreadCount - 1)
      this.updateSubtitle()
    }

    // Save to local storage
    const newsData = getNewsData()
    const feedItem = newsData.feed.find(n => n.id === newsId)
    if (feedItem) {
      feedItem.isRead = true
      feedItem.readAt = Date.now()
      saveNewsData(newsData)
    }
  }

  async markAllRead() {
    if (this.unreadCount === 0) {
      notificationManager.showToast('All news already read', 'info')
      return
    }

    try {
      // Mark all unread news as read
      const unreadNews = this.newsFeed.filter(n => !n.isRead)

      await Promise.all(unreadNews.map(n => narrativeService.markNewsRead(n.id)))

      // Update local state
      this.newsFeed.forEach(n => n.isRead = true)
      this.unreadCount = 0

      this.updateSubtitle()
      this.updateBreakingTicker()
      this.renderContent()

      audioManager.playSuccess()
      notificationManager.showToast(`Marked ${unreadNews.length} news as read`, 'success')

    } catch (error) {
      console.error('[NewsFeedScene] API failed, marking all locally:', error)
      this.markAllReadLocal()
    }
  }

  markAllReadLocal() {
    const unreadCount = this.newsFeed.filter(n => !n.isRead).length

    // Update local state
    const now = Date.now()
    this.newsFeed.forEach(n => {
      n.isRead = true
      n.readAt = now
    })
    this.unreadCount = 0

    // Save to local storage
    const newsData = getNewsData()
    newsData.feed.forEach(n => {
      n.isRead = true
      n.readAt = now
    })
    saveNewsData(newsData)

    this.updateSubtitle()
    this.updateBreakingTicker()
    this.renderContent()

    audioManager.playSuccess()
    notificationManager.showToast(`Marked ${unreadCount} news as read`, 'success')
  }

  showSubscriptionsModal() {
    // Create modal overlay
    const modalBg = this.add.rectangle(this.centerX, this.centerY, this.width, this.height, 0x000000, 0.8)
      .setInteractive()
      .setDepth(100)
    this.contentItems.push(modalBg)

    const modalWidth = this.width - 60
    const modalHeight = 400
    const modalY = this.centerY

    // Modal container
    const modal = this.add.rectangle(this.centerX, modalY, modalWidth, modalHeight, 0x1a1a2a, 0.98)
    modal.setStrokeStyle(2, 0x3b82f6, 0.8)
    modal.setDepth(101)
    this.contentItems.push(modal)

    // Modal title
    const modalTitle = this.add.text(this.centerX, modalY - modalHeight / 2 + 30, '⚙ Subscriptions', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102)
    this.contentItems.push(modalTitle)

    // Close modal button
    const closeModal = this.add.text(this.centerX + modalWidth / 2 - 20, modalY - modalHeight / 2 + 20, '✕', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true })
    this.contentItems.push(closeModal)

    closeModal.on('pointerdown', () => {
      audioManager.playClick()
      this.renderContent() // Re-render to remove modal
    })

    // Subscription list
    const districts = [
      { id: 'downtown', name: 'Downtown' },
      { id: 'parkdale', name: 'Parkdale' },
      { id: 'scarborough', name: 'Scarborough' },
      { id: 'etobicoke', name: 'Etobicoke' },
      { id: 'northyork', name: 'North York' },
      { id: 'yorkville', name: 'Yorkville' }
    ]

    const startY = modalY - modalHeight / 2 + 70
    const rowHeight = 45

    districts.forEach((district, index) => {
      const rowY = startY + index * rowHeight
      const isSubscribed = this.subscriptions.some(
        s => s.type === 'district' && s.targetId === district.id
      )

      // District name
      const districtText = this.add.text(this.centerX - modalWidth / 2 + 30, rowY, `📍 ${district.name}`, {
        fontSize: '14px',
        color: '#ffffff'
      }).setDepth(102)
      this.contentItems.push(districtText)

      // Toggle button
      const toggleWidth = 70
      const toggleX = this.centerX + modalWidth / 2 - 50

      const toggleBg = this.add.rectangle(toggleX, rowY, toggleWidth, 28,
        isSubscribed ? 0x22c55e : 0x444444, 0.9)
        .setInteractive({ useHandCursor: true })
        .setDepth(102)
      this.contentItems.push(toggleBg)

      const toggleText = this.add.text(toggleX, rowY, isSubscribed ? 'FOLLOWING' : 'FOLLOW', {
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(102)
      this.contentItems.push(toggleText)

      toggleBg.on('pointerdown', async () => {
        audioManager.playClick()

        try {
          if (isSubscribed) {
            await narrativeService.unsubscribe('district', district.id)
            toggleBg.setFillStyle(0x444444, 0.9)
            toggleText.setText('FOLLOW')
          } else {
            await narrativeService.subscribe('district', district.id)
            toggleBg.setFillStyle(0x22c55e, 0.9)
            toggleText.setText('FOLLOWING')
          }

          // Reload subscriptions
          this.subscriptions = await narrativeService.getSubscriptions()

        } catch (error) {
          // Use local storage fallback
          this.toggleSubscriptionLocal(district.id, !isSubscribed, toggleBg, toggleText)
        }
      })

      // Divider
      if (index < districts.length - 1) {
        const divider = this.add.rectangle(this.centerX, rowY + rowHeight / 2, modalWidth - 40, 1, 0x333333)
          .setDepth(102)
        this.contentItems.push(divider)
      }
    })

    // Close on background tap
    modalBg.on('pointerdown', () => {
      audioManager.playClick()
      this.renderContent()
    })
  }

  getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000)

    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return `${Math.floor(seconds / 604800)}w ago`
  }

  renderEmptyState() {
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    const icon = this.add.text(this.centerX, centerY - 40, '📰', {
      fontSize: '56px'
    }).setOrigin(0.5)
    this.contentItems.push(icon)

    const title = this.add.text(this.centerX, centerY + 20, 'No News Yet', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(title)

    const msg = this.add.text(this.centerX, centerY + 55, 'The streets are quiet... for now', {
      fontSize: '13px',
      color: '#888888'
    }).setOrigin(0.5)
    this.contentItems.push(msg)
  }

  renderError() {
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    const icon = this.add.text(this.centerX, centerY - 30, '⚠️', {
      fontSize: '48px'
    }).setOrigin(0.5)
    this.contentItems.push(icon)

    const title = this.add.text(this.centerX, centerY + 20, 'Failed to Load News', {
      fontSize: '18px',
      color: '#ef4444'
    }).setOrigin(0.5)
    this.contentItems.push(title)

    // Retry button
    const retryBtn = this.createButton(
      this.centerX,
      centerY + 70,
      100,
      36,
      '↻ Retry',
      0x3b82f6,
      () => this.loadData()
    )
    this.contentItems.push(retryBtn)
  }

  toggleSubscriptionLocal(districtId, subscribe, toggleBg, toggleText) {
    const newsData = getNewsData()
    if (!newsData.subscriptions) {
      newsData.subscriptions = []
    }

    if (subscribe) {
      // Add subscription
      const existing = newsData.subscriptions.find(s => s.type === 'district' && s.targetId === districtId)
      if (!existing) {
        newsData.subscriptions.push({
          type: 'district',
          targetId: districtId,
          createdAt: Date.now()
        })
      }
      toggleBg.setFillStyle(0x22c55e, 0.9)
      toggleText.setText('FOLLOWING')
    } else {
      // Remove subscription
      newsData.subscriptions = newsData.subscriptions.filter(
        s => !(s.type === 'district' && s.targetId === districtId)
      )
      toggleBg.setFillStyle(0x444444, 0.9)
      toggleText.setText('FOLLOW')
    }

    saveNewsData(newsData)
    this.subscriptions = newsData.subscriptions
  }

  closeScene() {
    this.scene.stop()
    this.scene.resume('GameScene')
  }
}

export default NewsFeedScene
