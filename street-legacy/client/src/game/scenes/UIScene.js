import Phaser from 'phaser'
import { gameManager } from '../GameManager'
import { formatMoney, formatNumber } from '../../utils/formatters'
import { notificationManager } from '../managers/NotificationManager'
import { audioManager } from '../managers/AudioManager'
import { AnimationHelper } from '../utils/AnimationHelper'
import { StatBar } from '../utils/StatBar'
import { getWantedLevel, getCurrentTimeModifier } from '../data/GameData'

// Network Theme imports
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  BORDERS,
  DEPTH,
  LAYOUT,
  getTextStyle,
  getTerminalStyle,
  toHexString,
  createRecIndicator,
  createTimestamp,
  createEncryptedIndicator,
  createNodeBadge,
  SYMBOLS
} from '../ui/NetworkTheme'
import { networkEffects } from '../ui/NetworkEffects'
import { networkMessageManager } from '../managers/NetworkMessageManager'

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' })
  }

  create() {
    // Fade in scene
    AnimationHelper.fadeInScene(this, 300)

    // Allow input to pass through to scenes below (GameScene)
    this.input.setTopOnly(false)

    this.createTopBar()
    this.createBottomBar()
    this.setupListeners()
    this.updateUI()

    // Initialize audio and notification managers
    audioManager.setScene(this)
    notificationManager.setScene(this)

    // NOTE: Network visual effects (CRT scanlines) are disabled in UIScene
    // because they run at depth 9999 and can block input to scenes below.
    // Effects should be initialized in the main game scene instead.
    // networkEffects.initialize(this)

    // Handle resize
    this.scale.on('resize', this.handleResize, this)
  }

  createTopBar() {
    const { width } = this.cameras.main
    const player = gameManager.player

    // Top bar - 60px tall for proper spacing
    const topBarHeight = 60
    this.topBarHeight = topBarHeight

    // Background - Network dark panel style
    this.topBar = this.add.rectangle(0, 0, width, topBarHeight, COLORS.bg.screen, 0.98).setOrigin(0)
    this.topBar.setDepth(DEPTH.UI_BAR_BG)

    // Glowing pulsing border line
    this.topBarBorder = this.add.rectangle(0, topBarHeight, width, 2, COLORS.network.primary, 0.8).setOrigin(0)
    this.topBarBorder.setDepth(DEPTH.UI_BAR_BG)
    this.topBarBorderGlow = this.add.rectangle(0, topBarHeight, width, 4, COLORS.network.primary, 0.2).setOrigin(0)
    this.topBarBorderGlow.setDepth(DEPTH.UI_BAR_BG)

    // Pulse animation for border
    this.tweens.add({
      targets: [this.topBarBorder, this.topBarBorderGlow],
      alpha: { from: 0.8, to: 0.4 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // === LEFT SECTION: REC indicator + Level & Username ===
    const level = player?.level || 1

    // REC indicator - surveillance feel
    this.recIndicator = createRecIndicator(this, 12, 12)
    this.recIndicator.setDepth(DEPTH.UI_BAR_CONTENT)

    // Encrypted indicator - secure network identity
    this.encryptedIndicator = createEncryptedIndicator(this, width - 180, 12)
    this.encryptedIndicator.setDepth(DEPTH.UI_BAR_CONTENT)

    // Time-of-day indicator
    const timeMod = getCurrentTimeModifier()
    const timeColors = {
      morning: '#FCD34D', // Yellow
      afternoon: '#F97316', // Orange
      evening: '#8B5CF6', // Purple
      night: '#3B82F6'  // Blue
    }
    this.timeIndicator = this.add.text(width - 95, 12, `${timeMod.icon} ${timeMod.name.toUpperCase()}`, {
      ...getTextStyle('xs', timeColors[timeMod.period] || '#ffffff', 'terminal'),
    }).setOrigin(0.5)
    this.timeIndicator.setDepth(DEPTH.UI_BAR_CONTENT)

    // Level badge - terminal style with high-level glow
    const levelBadgeBg = this.add.rectangle(24, topBarHeight / 2, 40, 28, COLORS.bg.void, 0.95)
    levelBadgeBg.setStrokeStyle(BORDERS.thin, COLORS.network.dim)
    levelBadgeBg.setDepth(DEPTH.UI_BAR_CONTENT)

    // Add glow effect for high-level players (level >= 10)
    if (level >= 10) {
      this.levelBadgeGlow = this.add.rectangle(24, topBarHeight / 2, 44, 32, COLORS.network.primary, 0.15)
      this.levelBadgeGlow.setStrokeStyle(0)
      this.levelBadgeGlow.setDepth(DEPTH.UI_BAR_CONTENT)
      this.tweens.add({
        targets: this.levelBadgeGlow,
        alpha: { from: 0.15, to: 0.3 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    }

    this.levelText = this.add.text(24, topBarHeight / 2, `LV${level}`, {
      ...getTerminalStyle('sm'),
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.levelText.setDepth(DEPTH.UI_BAR_CONTENT)

    // Username - Network terminal style
    this.usernameText = this.add.text(52, topBarHeight / 2 - 6, `${SYMBOLS.connected} ${player?.username || 'AGENT'}`, {
      ...getTerminalStyle('xs'),
    }).setOrigin(0, 0.5)
    this.usernameText.setDepth(DEPTH.UI_BAR_CONTENT)

    // Generate NODE ID from username (last 4 chars or random)
    const username = player?.username || 'AGENT'
    let nodeId = 'NODE-'
    if (username.length >= 4) {
      nodeId += username.slice(-4).toUpperCase()
    } else {
      // Generate random 4-char node ID
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      for (let i = 0; i < 4; i++) {
        nodeId += chars[Math.floor(Math.random() * chars.length)]
      }
    }

    // NODE ID badge below username
    this.nodeBadge = createNodeBadge(this, 97, topBarHeight / 2 + 8, nodeId)
    this.nodeBadge.setDepth(DEPTH.UI_BAR_CONTENT)

    // === CENTER SECTION: Cash & Bank ===
    const centerX = width * 0.42
    const cashY = topBarHeight / 2 - 12
    const bankY = topBarHeight / 2 + 14

    // Cash display - Network green for money
    const cashIcon = this.add.text(centerX - 50, cashY, SYMBOLS.cash, {
      ...getTerminalStyle('md'),
    }).setOrigin(0.5)
    cashIcon.setDepth(DEPTH.UI_BAR_CONTENT)
    this.cashText = this.add.text(centerX + 5, cashY, formatMoney(player?.cash || player?.cash_balance || 0), {
      ...getTextStyle('lg', COLORS.cred.gold, 'stats'),
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.cashText.setDepth(DEPTH.UI_BAR_CONTENT)

    // Bank display - dimmer
    const bankLabel = this.add.text(centerX - 50, bankY, 'BNK', {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal'),
    }).setOrigin(0.5)
    bankLabel.setDepth(DEPTH.UI_BAR_CONTENT)
    this.bankText = this.add.text(centerX + 5, bankY, formatMoney(player?.bank || player?.bank_balance || 0, 'bank'), {
      ...getTextStyle('sm', COLORS.status.info, 'stats'),
    }).setOrigin(0.5)
    this.bankText.setDepth(DEPTH.UI_BAR_CONTENT)

    // === RIGHT SECTION: Stacked Heat & Energy bars (no overlapping) ===
    const rightX = width - 12
    const barWidth = 90
    const barHeight = 14

    // Get player stats
    const heat = player?.heat || player?.heat_level || 0
    const wantedInfo = getWantedLevel(heat)
    const energy = player?.energy || player?.stamina || 100
    const energyMax = player?.staminaMax || 100

    // Heat bar - upper position with integrated wanted level visualization
    const heatY = topBarHeight / 2 - 10

    // Heat bar background
    this.heatBarBg = this.add.rectangle(rightX - barWidth / 2, heatY, barWidth, barHeight, COLORS.bg.void, 0.9).setOrigin(0.5)
    this.heatBarBg.setStrokeStyle(BORDERS.thin, COLORS.text.muted)
    this.heatBarBg.setDepth(DEPTH.UI_BAR_CONTENT)

    // Wanted level segment markers (5 segments inside bar)
    this.wantedSegments = []
    const segmentWidth = barWidth / 5
    for (let i = 0; i < 5; i++) {
      const segmentX = rightX - barWidth + (i * segmentWidth) + segmentWidth / 2
      const isFilled = i < wantedInfo.stars
      const segment = this.add.rectangle(
        segmentX, heatY, segmentWidth - 2, barHeight - 4,
        isFilled ? COLORS.status.danger : COLORS.bg.panel, isFilled ? 0.3 : 0.1
      ).setOrigin(0.5)
      segment.setDepth(DEPTH.UI_BAR_CONTENT)
      this.wantedSegments.push(segment)
    }

    // Heat fill (on top of segments)
    const heatFillColor = this.getHeatColorNetwork(heat)
    this.heatBarFill = this.add.rectangle(rightX - barWidth, heatY, barWidth * (heat / 100), barHeight - 2, heatFillColor, 0.8).setOrigin(0, 0.5)
    this.heatBarFill.setDepth(DEPTH.UI_BAR_CONTENT)

    // Heat text with wanted stars indicator
    const starsText = wantedInfo.stars > 0 ? `${'★'.repeat(wantedInfo.stars)}` : ''
    this.heatText = this.add.text(rightX - barWidth / 2, heatY, `${heat}%`, {
      ...getTextStyle('xs', COLORS.text.primary, 'stats'),
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.heatText.setDepth(DEPTH.UI_BAR_CONTENT)

    // Wanted stars displayed above heat bar (compact)
    this.wantedText = this.add.text(rightX - barWidth / 2, heatY - 12, starsText, {
      fontSize: '8px',
      color: toHexString(COLORS.status.danger)
    }).setOrigin(0.5)
    this.wantedText.setDepth(DEPTH.UI_BAR_CONTENT)

    // Pulsing animation for high wanted levels
    if (wantedInfo.level >= 4) {
      this.tweens.add({
        targets: [this.wantedText, this.heatBarFill],
        alpha: { from: 1, to: 0.5 },
        duration: 400,
        yoyo: true,
        repeat: -1
      })
    }

    // Energy bar - lower position
    const energyY = topBarHeight / 2 + 14

    this.energyBarBg = this.add.rectangle(rightX - barWidth / 2, energyY, barWidth, barHeight, COLORS.bg.void, 0.9).setOrigin(0.5)
    this.energyBarBg.setStrokeStyle(BORDERS.thin, COLORS.text.muted)
    this.energyBarBg.setDepth(DEPTH.UI_BAR_CONTENT)

    const energyPercent = energy / energyMax
    const energyBarColor = energyPercent > 0.5 ? COLORS.network.primary :
                           energyPercent > 0.2 ? COLORS.status.warning : COLORS.status.danger
    this.energyBarFill = this.add.rectangle(rightX - barWidth, energyY, barWidth * energyPercent, barHeight - 2, energyBarColor, 0.8).setOrigin(0, 0.5)
    this.energyBarFill.setDepth(DEPTH.UI_BAR_CONTENT)

    this.energyText = this.add.text(rightX - barWidth / 2, energyY, `${energy}/${energyMax}`, {
      ...getTextStyle('xs', COLORS.text.primary, 'stats'),
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.energyText.setDepth(DEPTH.UI_BAR_CONTENT)

    // Compact labels to left of bars
    const heatIcon = this.add.text(rightX - barWidth - 8, heatY, '🔥', {
      fontSize: '10px'
    }).setOrigin(1, 0.5)
    heatIcon.setDepth(DEPTH.UI_BAR_CONTENT)

    const energyIcon = this.add.text(rightX - barWidth - 8, energyY, '⚡', {
      fontSize: '10px'
    }).setOrigin(1, 0.5)
    energyIcon.setDepth(DEPTH.UI_BAR_CONTENT)

    // Parole indicator (hidden by default)
    this.paroleIndicator = this.add.container(rightX - barWidth / 2, topBarHeight + 8)
    this.paroleIndicator.setVisible(false)
    this.paroleIndicator.setDepth(DEPTH.UI_BAR_CONTENT)

    const paroleBg = this.add.rectangle(0, 0, 70, 14, 0xA855F7, 0.3)
      .setStrokeStyle(1, 0xA855F7, 0.6)
    this.paroleIndicator.add(paroleBg)

    const paroleIcon = this.add.text(-28, 0, '⚖️', { fontSize: '10px' }).setOrigin(0.5)
    this.paroleIndicator.add(paroleIcon)

    this.paroleText = this.add.text(5, 0, 'PAROLE', {
      fontSize: '8px',
      fontFamily: 'monospace',
      color: '#A855F7',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.paroleIndicator.add(this.paroleText)

    // Pulse animation for parole
    this.tweens.add({
      targets: this.paroleIndicator,
      alpha: { from: 1, to: 0.6 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }

  createStatBar(x, y, key, current, max, color) {
    // Use the animated StatBar component
    const barWidth = 120

    this[`${key}StatBar`] = new StatBar(this, x - barWidth / 2, y, {
      width: barWidth,
      height: 12,
      maxValue: max,
      currentValue: current,
      fillColor: color,
      showLabel: false,
      showValue: true,
      animationDuration: 400,
      warningThreshold: 0.3,
      criticalThreshold: 0.2
    })
  }

  createBottomBar() {
    const { width, height } = this.cameras.main
    const player = gameManager.player

    // Compact bottom bar - 55px
    const bottomBarHeight = 55
    this.bottomBarHeight = bottomBarHeight
    this.bottomBar = this.add.rectangle(0, height - bottomBarHeight, width, bottomBarHeight, COLORS.bg.screen, 0.98).setOrigin(0)
    this.bottomBar.setDepth(DEPTH.UI_BAR_BG)

    // Top border - Network green accent
    const bottomBorder = this.add.rectangle(0, height - bottomBarHeight, width, 2, COLORS.network.dim, 0.6).setOrigin(0)
    bottomBorder.setDepth(DEPTH.UI_BAR_BG)

    // Quick action buttons - Network style
    const buttonSize = 36
    const buttonSpacing = 42
    const buttonsStartX = width - 28
    const buttonY = height - bottomBarHeight / 2

    const buttons = [
      { icon: 'CFG', action: 'settings', tooltip: 'Settings' },
      { icon: 'NET', action: 'NetworkInboxScene', tooltip: 'THE NETWORK' },
      { icon: 'INV', action: 'InventoryScene', tooltip: 'Inventory' },
      { icon: 'MAP', action: 'MapScene', tooltip: 'Travel' }
    ]

    this.quickButtons = []
    this.messageBadge = null
    this.messageBadgeText = null

    buttons.forEach((btn, i) => {
      const x = buttonsStartX - (i * buttonSpacing)

      const bg = this.add.rectangle(x, buttonY, buttonSize, buttonSize, COLORS.bg.panel, 0.9)
        .setStrokeStyle(BORDERS.thin, COLORS.network.dim, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          bg.setFillStyle(COLORS.bg.elevated)
          bg.setStrokeStyle(BORDERS.thin, COLORS.network.primary, 0.8)
          icon.setColor(toHexString(COLORS.network.primary))
        })
        .on('pointerout', () => {
          bg.setFillStyle(COLORS.bg.panel, 0.9)
          bg.setStrokeStyle(BORDERS.thin, COLORS.network.dim, 0.5)
          icon.setColor(toHexString(COLORS.text.secondary))
        })
        .on('pointerdown', () => {
          audioManager.playClick()
          if (btn.action === 'settings') {
            this.scene.pause('GameScene')
            this.scene.launch('AudioSettingsScene')
          } else {
            this.scene.pause('GameScene')
            this.scene.launch(btn.action)
          }
        })
      bg.setDepth(DEPTH.UI_BAR_INTERACTIVE)

      const icon = this.add.text(x, buttonY, btn.icon, {
        ...getTextStyle('xs', COLORS.text.secondary, 'terminal'),
        fontStyle: 'bold'
      }).setOrigin(0.5)
      icon.setDepth(DEPTH.UI_BAR_INTERACTIVE)

      // Add message badge for Network Inbox button
      if (btn.action === 'NetworkInboxScene') {
        this.messageBadge = this.add.circle(x + 12, buttonY - 12, 9, COLORS.status.danger)
        this.messageBadge.setVisible(false)
        this.messageBadge.setDepth(DEPTH.UI_BAR_INTERACTIVE)
        this.messageBadgeText = this.add.text(x + 12, buttonY - 12, '0', {
          ...getTextStyle('xs', COLORS.text.primary, 'stats'),
          fontStyle: 'bold'
        }).setOrigin(0.5)
        this.messageBadgeText.setVisible(false)
        this.messageBadgeText.setDepth(DEPTH.UI_BAR_INTERACTIVE)

        this.messageButtonX = x
        this.messageButtonY = buttonY
      }

      this.quickButtons.push({ bg, icon, action: btn.action })
    })

    // Update message badge on create
    this.updateMessageBadge()

    // XP progress bar - Network style
    const xpNeeded = this.xpForLevel(player?.level || 1)
    const currentXp = player?.xp || player?.experience || 0
    const xpPercent = Math.min(1, currentXp / xpNeeded)

    const numButtons = buttons.length
    const xpBarMaxWidth = width - (numButtons * buttonSpacing) - 60
    const xpBarWidth = Math.max(100, xpBarMaxWidth)

    // XP label with Network terminal style
    this.xpText = this.add.text(12, height - bottomBarHeight + 12, `XP: ${formatNumber(currentXp)} / ${formatNumber(xpNeeded)}`, {
      ...getTextStyle('xs', COLORS.text.muted, 'terminal'),
    })
    this.xpText.setDepth(DEPTH.UI_BAR_CONTENT)

    // XP bar - Network style with green fill
    this.xpBarBg = this.add.rectangle(12, height - bottomBarHeight + 34, xpBarWidth, 12, COLORS.bg.void, 0.9).setOrigin(0, 0.5)
    this.xpBarBg.setStrokeStyle(BORDERS.thin, COLORS.text.muted)
    this.xpBarBg.setDepth(DEPTH.UI_BAR_CONTENT)

    this.xpBar = this.add.rectangle(12, height - bottomBarHeight + 34, xpBarWidth * xpPercent, 12, COLORS.network.primary).setOrigin(0, 0.5)
    this.xpBar.setDepth(DEPTH.UI_BAR_CONTENT)

    // Level indicator - Network terminal style
    this.levelIndicator = this.add.text(12 + xpBarWidth + 8, height - bottomBarHeight + 34, `${SYMBOLS.forward} LV${(player?.level || 1) + 1}`, {
      ...getTextStyle('xs', COLORS.network.primary, 'terminal'),
      fontStyle: 'bold'
    }).setOrigin(0, 0.5)
    this.levelIndicator.setDepth(DEPTH.UI_BAR_CONTENT)

    // Signal indicator at bottom left corner
    this.signalText = this.add.text(12, height - 12, `${SYMBOLS.connected} NETWORK ACTIVE`, {
      ...getTextStyle('xs', COLORS.network.dim, 'terminal'),
    }).setOrigin(0, 1)
    this.signalText.setDepth(DEPTH.UI_BAR_CONTENT)

    // Subtle pulse for signal
    this.tweens.add({
      targets: this.signalText,
      alpha: { from: 1, to: 0.5 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Timestamp in bottom right corner (moved from top bar)
    this.timestamp = createTimestamp(this, width - 8, height - 12)
    this.timestamp.setDepth(DEPTH.UI_BAR_CONTENT)
  }

  xpForLevel(level) {
    return Math.floor(100 * Math.pow(1.5, level - 1))
  }

  // Network style heat colors
  getHeatColorNetwork(heat) {
    if (heat < 25) return COLORS.network.primary
    if (heat < 50) return COLORS.status.warning
    if (heat < 75) return 0xff6600
    return COLORS.status.danger
  }

  getHeatColor(heat) {
    if (heat < 25) return '#22c55e'
    if (heat < 50) return '#eab308'
    if (heat < 75) return '#f97316'
    return '#ef4444'
  }

  setupListeners() {
    gameManager.on('playerUpdated', () => {
      this.updateUI()
    })

    gameManager.on('stateRefreshed', () => {
      this.updateUI()
    })

    gameManager.on('crimeCompleted', () => {
      this.updateUI()
    })

    gameManager.on('jobCompleted', () => {
      this.updateUI()
    })

    gameManager.on('bankTransaction', () => {
      this.updateUI()
    })

    gameManager.on('aiMessage', () => {
      this.updateMessageBadge()
      this.pulseMessageButton()
    })

    // Listen for new Network messages (THE NETWORK integration)
    networkMessageManager.addListener((event, data) => {
      if (event === 'new_message' && data) {
        // Update badge
        this.updateMessageBadge()
        this.pulseMessageButton()

        // Show Network-style notification popup for non-welcome messages
        // Skip notifications during boot sequence by checking if we're past initialization
        if (this.scene.isActive('GameScene')) {
          notificationManager.showNetworkMessage(
            data,
            () => {
              // VIEW clicked - open inbox to this message
              this.scene.pause('GameScene')
              this.scene.launch('NetworkInboxScene')
            },
            () => {
              // LATER clicked - just dismiss
            }
          )
        }
      }
    })
  }

  updateMessageBadge() {
    const unreadCount = networkMessageManager.getUnreadCount()

    if (this.messageBadge && this.messageBadgeText) {
      if (unreadCount > 0) {
        this.messageBadge.setVisible(true)
        this.messageBadgeText.setVisible(true)
        this.messageBadgeText.setText(unreadCount > 9 ? '9+' : `${unreadCount}`)
      } else {
        this.messageBadge.setVisible(false)
        this.messageBadgeText.setVisible(false)
      }
    }
  }

  pulseMessageButton() {
    const messageBtn = this.quickButtons.find(btn => btn.action === 'NetworkInboxScene')
    if (!messageBtn) return

    this.tweens.add({
      targets: [messageBtn.bg, messageBtn.icon],
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 150,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut'
    })

    if (this.messageBadge) {
      this.tweens.add({
        targets: this.messageBadge,
        alpha: 0.5,
        duration: 100,
        yoyo: true,
        repeat: 3
      })
    }
  }

  updateUI() {
    const player = gameManager.player
    if (!player) return

    if (this.usernameText) {
      this.usernameText.setText(`${SYMBOLS.connected} ${player.username}`)
    }

    if (this.levelText) {
      this.levelText.setText(`LV${player.level}`)

      // Add or remove glow effect based on level
      if (player.level >= 10 && !this.levelBadgeGlow) {
        // Add glow if player reached level 10+
        this.levelBadgeGlow = this.add.rectangle(24, this.topBarHeight / 2, 44, 32, COLORS.network.primary, 0.15)
        this.levelBadgeGlow.setStrokeStyle(0)
        this.levelBadgeGlow.setDepth(this.levelText.depth - 1)
        this.tweens.add({
          targets: this.levelBadgeGlow,
          alpha: { from: 0.15, to: 0.3 },
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        })
      } else if (player.level < 10 && this.levelBadgeGlow) {
        // Remove glow if somehow player drops below level 10
        this.levelBadgeGlow.destroy()
        this.levelBadgeGlow = null
      }
    }

    if (this.cashText) {
      this.cashText.setText(formatMoney(player.cash || player.cash_balance || 0))
    }

    if (this.bankText) {
      this.bankText.setText(formatMoney(player.bank || player.bank_balance || 0, 'bank'))
    }

    // Update heat display
    const heat = player.heat || player.heat_level || 0
    const heatColor = this.getHeatColorNetwork(heat)
    const barWidth = 70

    if (this.heatText) {
      this.heatText.setText(`${heat}%`)
    }

    if (this.heatBarFill) {
      this.heatBarFill.width = barWidth * (heat / 100)
      this.heatBarFill.setFillStyle(heatColor)
    }

    // Update wanted segments - integrated into heat bar
    if (this.wantedSegments && this.wantedSegments.length > 0) {
      const wantedInfo = getWantedLevel(heat)
      this.wantedSegments.forEach((segment, i) => {
        const isFilled = i < wantedInfo.stars
        segment.setFillStyle(isFilled ? COLORS.status.danger : COLORS.bg.panel, isFilled ? 0.3 : 0.1)
      })
      // Update wanted text
      if (this.wantedText) {
        const starsText = wantedInfo.stars > 0 ? `${'★'.repeat(wantedInfo.stars)}` : ''
        this.wantedText.setText(starsText)
      }
    }

    // Update energy display
    const energy = player.energy || player.stamina || 100
    const energyMax = player.staminaMax || 100

    if (this.energyText) {
      this.energyText.setText(`${energy}/${energyMax}`)
    }

    if (this.energyBarFill) {
      this.energyBarFill.width = barWidth * (energy / energyMax)
      const energyBarColor = energy > 50 ? COLORS.network.primary :
                             energy > 20 ? COLORS.status.warning : COLORS.status.danger
      this.energyBarFill.setFillStyle(energyBarColor)
    }

    if (this.energyStatBar) {
      this.updateStatBar('energy', energy, energyMax)
    }

    if (this.focusStatBar) {
      const focus = player.focus || player.nerve || 100
      const focusMax = player.focusMax || 100
      this.updateStatBar('focus', focus, focusMax)
    }

    // Update parole indicator
    if (this.paroleIndicator) {
      const isOnParole = player.on_parole && player.parole_until
      if (isOnParole) {
        const now = Date.now()
        const paroleEnd = new Date(player.parole_until).getTime()
        const remaining = Math.max(0, paroleEnd - now)

        if (remaining > 0) {
          const hours = Math.floor(remaining / 3600000)
          const mins = Math.floor((remaining % 3600000) / 60000)
          this.paroleText.setText(hours > 0 ? `${hours}h ${mins}m` : `${mins}m`)
          this.paroleIndicator.setVisible(true)
        } else {
          this.paroleIndicator.setVisible(false)
        }
      } else {
        this.paroleIndicator.setVisible(false)
      }
    }

    // Update time-of-day indicator
    if (this.timeIndicator) {
      const timeMod = getCurrentTimeModifier()
      const timeColors = {
        morning: '#FCD34D',
        afternoon: '#F97316',
        evening: '#8B5CF6',
        night: '#3B82F6'
      }
      this.timeIndicator.setText(`${timeMod.icon} ${timeMod.name.toUpperCase()}`)
      this.timeIndicator.setColor(timeColors[timeMod.period] || '#ffffff')
    }

    // Update XP bar
    if (this.xpBar && this.xpText) {
      const { width } = this.cameras.main
      const xpNeeded = this.xpForLevel(player.level)
      const currentXp = player.xp || player.experience || 0
      const xpPercent = Math.min(1, currentXp / xpNeeded)

      const buttonSpacing = 42
      const numButtons = 4
      const xpBarMaxWidth = width - (numButtons * buttonSpacing) - 60
      const xpBarWidth = Math.max(100, xpBarMaxWidth)

      this.xpBar.width = xpBarWidth * xpPercent
      this.xpBarBg.width = xpBarWidth
      this.xpText.setText(`XP: ${formatNumber(currentXp)} / ${formatNumber(xpNeeded)}`)

      if (this.levelIndicator) {
        this.levelIndicator.setText(`${SYMBOLS.forward} LV${player.level + 1}`)
        this.levelIndicator.x = 12 + xpBarWidth + 8
      }
    }
  }

  updateStatBar(key, current, max) {
    const statBar = this[`${key}StatBar`]

    if (statBar) {
      statBar.setMaxValue(max)
      statBar.setValue(current, true, true)
    }
  }

  handleResize(gameSize) {
    const width = gameSize.width
    const height = gameSize.height
    const bottomBarHeight = 55
    const topBarHeight = 60

    if (this.topBar) {
      this.topBar.width = width
    }
    if (this.topBarBorder) {
      this.topBarBorder.width = width
    }
    if (this.topBarBorderGlow) {
      this.topBarBorderGlow.width = width
    }

    // Update encrypted indicator position
    if (this.encryptedIndicator) {
      this.encryptedIndicator.x = width - 180
    }

    const rightX = width - 12
    const barWidth = 90
    if (this.heatText) this.heatText.x = rightX - barWidth / 2
    if (this.energyText) this.energyText.x = rightX - barWidth / 2
    if (this.wantedText) this.wantedText.x = rightX - barWidth / 2

    if (this.bottomBar) {
      this.bottomBar.y = height - bottomBarHeight
      this.bottomBar.width = width
    }

    const buttonSpacing = 42
    const buttonsStartX = width - 28
    const buttonY = height - bottomBarHeight / 2

    if (this.quickButtons) {
      this.quickButtons.forEach((btn, i) => {
        const x = buttonsStartX - (i * buttonSpacing)
        btn.bg.x = x
        btn.icon.x = x
        btn.bg.y = buttonY
        btn.icon.y = buttonY
      })
    }

    const numButtons = 4
    const xpBarMaxWidth = width - (numButtons * buttonSpacing) - 60
    const xpBarWidth = Math.max(100, xpBarMaxWidth)

    if (this.xpBarBg) {
      this.xpBarBg.y = height - bottomBarHeight + 34
      this.xpBarBg.width = xpBarWidth
    }

    if (this.xpBar) {
      this.xpBar.y = height - bottomBarHeight + 34
    }

    if (this.xpText) {
      this.xpText.y = height - bottomBarHeight + 12
    }

    if (this.levelIndicator) {
      this.levelIndicator.x = 12 + xpBarWidth + 8
      this.levelIndicator.y = height - bottomBarHeight + 34
    }

    if (this.signalText) {
      this.signalText.y = height - 12
    }

    // Timestamp in bottom right
    if (this.timestamp) {
      this.timestamp.x = width - 8
      this.timestamp.y = height - 12
    }

    const messageBtn = this.quickButtons.find(btn => btn.action === 'AIMessagesScene')
    if (messageBtn && this.messageBadge && this.messageBadgeText) {
      const msgBtnIdx = this.quickButtons.indexOf(messageBtn)
      const msgBtnX = buttonsStartX - (msgBtnIdx * buttonSpacing)
      this.messageBadge.x = msgBtnX + 12
      this.messageBadge.y = buttonY - 12
      this.messageBadgeText.x = msgBtnX + 12
      this.messageBadgeText.y = buttonY - 12
    }

    // Reinitialize effects on resize
    networkEffects.destroy()
    networkEffects.initialize(this)
  }

  shutdown() {
    gameManager.off('playerUpdated')
    gameManager.off('stateRefreshed')
    gameManager.off('crimeCompleted')
    gameManager.off('jobCompleted')
    gameManager.off('bankTransaction')
    gameManager.off('aiMessage')
    this.scale.off('resize', this.handleResize, this)

    if (this.energyStatBar) this.energyStatBar.destroy()
    if (this.focusStatBar) this.focusStatBar.destroy()

    notificationManager.clearAll()
    networkEffects.destroy()
  }
}
