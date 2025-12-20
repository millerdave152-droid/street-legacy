import Phaser from 'phaser'
import { BaseScene } from './BaseScene'
import { narrativeService } from '../../services/narrativeSystems.service'
import { audioManager } from '../managers/AudioManager'
import { notificationManager } from '../managers/NotificationManager'
import { gameManager } from '../GameManager'

// Helper functions for local storage
const getPlayerData = () => {
  try {
    const data = localStorage.getItem('street_legacy_player')
    return data ? JSON.parse(data) : null
  } catch (e) {
    return null
  }
}

const savePlayerData = (data) => {
  try {
    localStorage.setItem('street_legacy_player', JSON.stringify(data))
    return true
  } catch (e) {
    return false
  }
}

/**
 * LifeScene - Character Life & Legacy Management
 *
 * Features:
 * - Age display with progress bar to next chapter
 * - Current chapter info with icon
 * - Unlocked/locked features list
 * - Chapter timeline showing transitions
 * - Succession plan editor
 * - Dynasty tree visualization
 * - "End Character" button with confirmation
 */
export class LifeScene extends BaseScene {
  constructor() {
    super('LifeScene')
  }

  create() {
    super.create()

    // Constants
    this.HEADER_HEIGHT = 80
    this.SCROLL_START_Y = this.HEADER_HEIGHT + 10
    this.SCROLL_END_Y = this.height - 20

    // Life chapter configurations
    this.CHAPTERS = {
      young_hustler: {
        icon: '🌱',
        name: 'Young Hustler',
        ageRange: '18-25',
        color: 0x22c55e,
        description: 'Fresh on the streets, hungry to prove yourself'
      },
      rising_player: {
        icon: '🔥',
        name: 'Rising Player',
        ageRange: '25-35',
        color: 0xf59e0b,
        description: 'Building reputation and making connections'
      },
      established_boss: {
        icon: '👑',
        name: 'Established Boss',
        ageRange: '35-50',
        color: 0x8b5cf6,
        description: 'Running operations and commanding respect'
      },
      aging_legend: {
        icon: '🏛️',
        name: 'Aging Legend',
        ageRange: '50-65',
        color: 0x6b7280,
        description: 'Legacy matters more than power now'
      },
      final_days: {
        icon: '⌛',
        name: 'Final Days',
        ageRange: '65+',
        color: 0x991b1b,
        description: 'Time to secure your dynasty'
      }
    }

    // Ending types
    this.ENDINGS = {
      retirement: { icon: '🏖️', name: 'Retirement', color: 0x22c55e },
      prison: { icon: '⛓️', name: 'Life Sentence', color: 0x6b7280 },
      death: { icon: '💀', name: 'Death', color: 0x991b1b },
      betrayal: { icon: '🗡️', name: 'Betrayed', color: 0xef4444 },
      witness_protection: { icon: '🕵️', name: 'Witness Protection', color: 0x3b82f6 }
    }

    // State
    this.lifeState = null
    this.chapterModifiers = null
    this.successionPlan = null
    this.lineage = null
    this.dynasty = null
    this.contentItems = []
    this.scrollOffset = 0
    this.maxScrollOffset = 0
    this.isLoading = true
    this.activeSection = 'overview' // overview, succession, dynasty

    // Create UI
    this.createBackground()
    this.createHeader()
    this.createCloseButton()
    this.createLoadingSpinner()
    this.setupScrolling()

    // Load data
    this.loadData()
  }

  createBackground() {
    // Gradient-like background
    this.add.rectangle(0, 0, this.width, this.height, 0x0a0a15, 1)
      .setOrigin(0)
      .setDepth(0)
      .setInteractive()

    // Subtle pattern overlay
    for (let i = 0; i < 20; i++) {
      const y = i * (this.height / 20)
      this.add.rectangle(0, y, this.width, 1, 0x1a1a2a, 0.3).setOrigin(0)
    }
  }

  createHeader() {
    // Header background
    this.add.rectangle(0, 0, this.width, this.HEADER_HEIGHT, 0x12121f, 1)
      .setOrigin(0)
      .setDepth(10)

    // Title
    this.add.text(this.centerX, 30, '📜 LIFE & LEGACY', {
      fontSize: '22px',
      color: '#f59e0b',
      fontFamily: 'Arial Black, Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11)

    // Subtitle
    this.subtitleText = this.add.text(this.centerX, 55, 'Loading...', {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(0.5).setDepth(11)

    // Divider
    this.add.rectangle(this.centerX, this.HEADER_HEIGHT - 5, this.width - 40, 1, 0x333333)
      .setDepth(11)
  }

  createCloseButton() {
    const closeBtn = this.add.text(this.width - 25, 30, '✕', {
      fontSize: '28px',
      color: '#ffffff'
    })
      .setOrigin(0.5)
      .setDepth(999)
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

    const loadingText = this.add.text(0, 20, 'Loading life data...', {
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

  setupScrolling() {
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (!this.isLoading) {
        this.scrollOffset = Phaser.Math.Clamp(
          this.scrollOffset + deltaY * 0.5,
          0,
          this.maxScrollOffset
        )
        this.renderContent()
      }
    })

    let startY = 0
    let startOffset = 0
    let velocity = 0
    let lastY = 0

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
        this.scrollOffset = Math.max(0, startOffset + deltaY)
        this.renderContent()
      }
    })

    this.input.on('pointerup', () => {
      if (Math.abs(velocity) > 2) {
        this.applyMomentum(velocity * 5)
      }
      startY = 0
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

  async loadData() {
    this.isLoading = true
    this.clearContent()

    try {
      const [lifeState, modifiers, succession, lineage, dynasty] = await Promise.all([
        narrativeService.getMyLifeState(),
        narrativeService.getChapterModifiers(),
        narrativeService.getSuccessionPlan(),
        narrativeService.getMyLineage(),
        narrativeService.getDynastyInfo()
      ])

      this.lifeState = lifeState
      this.chapterModifiers = modifiers
      this.successionPlan = succession
      this.lineage = lineage
      this.dynasty = dynasty

      this.updateSubtitle()

      this.isLoading = false
      this.hideLoadingSpinner()
      this.renderContent()

    } catch (error) {
      console.log('[LifeScene] API unavailable, using local data')
      this.loadLocalData()
    }
  }

  loadLocalData() {
    const player = getPlayerData() || gameManager.player || {}

    // Initialize or load life state
    if (!player.lifeState) {
      player.lifeState = this.createDefaultLifeState()
      savePlayerData(player)
    }

    // Check for age progression
    this.checkAgeProgression(player)

    this.lifeState = player.lifeState
    this.chapterModifiers = this.calculateChapterModifiers(player.lifeState.chapter)
    this.successionPlan = player.successionPlan || this.createDefaultSuccessionPlan()
    this.lineage = player.lineage || { generation: 1, ancestors: [] }
    this.dynasty = player.dynasty || this.createDefaultDynasty()

    // Save initialized data
    player.successionPlan = this.successionPlan
    player.lineage = this.lineage
    player.dynasty = this.dynasty
    savePlayerData(player)

    this.updateSubtitle()
    this.isLoading = false
    this.hideLoadingSpinner()
    this.renderContent()
  }

  createDefaultLifeState() {
    return {
      age: 18,
      chapter: 'young_hustler',
      lastAgeUpdate: Date.now(),
      totalDaysPlayed: 0,
      characterName: this.generateCharacterName(),
      createdAt: Date.now()
    }
  }

  createDefaultSuccessionPlan() {
    return {
      heirType: 'random',
      cashPercent: 50,
      propertyPercent: 100,
      reputationPercent: 30,
      selectedHeir: null
    }
  }

  createDefaultDynasty() {
    return {
      totalEarnings: 0,
      totalKills: 0,
      totalCrimes: 0,
      achievements: [],
      startedAt: Date.now()
    }
  }

  generateCharacterName() {
    const firstNames = [
      'Tony', 'Vito', 'Marco', 'Angelo', 'Rico', 'Sal', 'Danny', 'Mike',
      'Carmen', 'Rosa', 'Maria', 'Sofia', 'Lucia', 'Nina', 'Gina', 'Bella',
      'Johnny', 'Frankie', 'Tommy', 'Eddie', 'Bobby', 'Vinnie', 'Joey', 'Paulie'
    ]
    const lastNames = [
      'Corleone', 'Gambino', 'Genovese', 'Lucchese', 'Colombo', 'DeCavalcante',
      'Marcello', 'Trafficante', 'Patriarca', 'Bruno', 'Scarfo', 'Castellano',
      'Montana', 'Soprano', 'Mancini', 'Rizzo', 'DeLuca', 'Romano', 'Ferrari'
    ]
    const first = firstNames[Math.floor(Math.random() * firstNames.length)]
    const last = lastNames[Math.floor(Math.random() * lastNames.length)]
    return `${first} ${last}`
  }

  calculateChapterModifiers(chapter) {
    // Different chapters give different bonuses/penalties
    const modifiers = {
      young_hustler: {
        energyRegen: 1.5,    // Young and energetic
        learningRate: 1.5,   // Quick learner
        maxHealth: 100,
        heatGain: 1.2,       // More reckless
        crimeSuccess: -5,    // Inexperienced
        pvpDamage: 0.8       // Less combat power
      },
      rising_player: {
        energyRegen: 1.2,
        learningRate: 1.2,
        maxHealth: 110,
        heatGain: 1.0,
        crimeSuccess: 5,
        pvpDamage: 1.0
      },
      established_boss: {
        energyRegen: 1.0,
        learningRate: 1.0,
        maxHealth: 100,
        heatGain: 0.8,       // More careful
        crimeSuccess: 15,    // Experienced
        pvpDamage: 1.2       // Peak power
      },
      aging_legend: {
        energyRegen: 0.8,    // Slowing down
        learningRate: 0.7,
        maxHealth: 85,
        heatGain: 0.6,       // Very careful
        crimeSuccess: 20,    // Wisdom
        pvpDamage: 1.0
      },
      final_days: {
        energyRegen: 0.5,    // Tired
        learningRate: 0.5,
        maxHealth: 70,
        heatGain: 0.5,       // Too old to care
        crimeSuccess: 25,    // Master
        pvpDamage: 0.7       // Weakened
      }
    }
    return modifiers[chapter] || modifiers.young_hustler
  }

  checkAgeProgression(player) {
    if (!player.lifeState) return

    const now = Date.now()
    const lastUpdate = player.lifeState.lastAgeUpdate || now

    // Age progression: 1 year = 1 real-life day (for testing: 1 minute = 1 year)
    // In production: 1 day = 24 * 60 * 60 * 1000 ms
    const msPerYear = 24 * 60 * 60 * 1000 // 1 day = 1 year
    const elapsed = now - lastUpdate
    const yearsToAdd = Math.floor(elapsed / msPerYear)

    if (yearsToAdd > 0) {
      player.lifeState.age += yearsToAdd
      player.lifeState.lastAgeUpdate = now
      player.lifeState.totalDaysPlayed = (player.lifeState.totalDaysPlayed || 0) + yearsToAdd

      // Check for chapter transitions
      const oldChapter = player.lifeState.chapter
      player.lifeState.chapter = this.getChapterForAge(player.lifeState.age)

      if (oldChapter !== player.lifeState.chapter) {
        const newChapterInfo = this.CHAPTERS[player.lifeState.chapter]
        notificationManager.showToast(
          `${newChapterInfo.icon} New Chapter: ${newChapterInfo.name}!`,
          'info'
        )
      }

      savePlayerData(player)
    }
  }

  getChapterForAge(age) {
    if (age >= 65) return 'final_days'
    if (age >= 50) return 'aging_legend'
    if (age >= 35) return 'established_boss'
    if (age >= 25) return 'rising_player'
    return 'young_hustler'
  }

  updateSubtitle() {
    if (!this.lifeState) return

    const chapter = this.CHAPTERS[this.lifeState.chapter] || this.CHAPTERS.young_hustler
    this.subtitleText.setText(`${chapter.icon} ${chapter.name} • Age ${this.lifeState.age || 18}`)
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
    if (!this.lifeState) {
      this.renderError()
      return
    }

    let y = this.SCROLL_START_Y - this.scrollOffset

    // Section 1: Age & Chapter Display
    y = this.renderAgeSection(y)

    // Section 2: Chapter Modifiers
    y = this.renderModifiersSection(y)

    // Section 3: Features List
    y = this.renderFeaturesSection(y)

    // Section 4: Chapter Timeline
    y = this.renderTimelineSection(y)

    // Section 5: Succession Plan
    y = this.renderSuccessionSection(y)

    // Section 6: Dynasty Tree (if applicable)
    if (this.lineage && this.lineage.generation > 1) {
      y = this.renderDynastySection(y)
    }

    // Section 7: End Character Button
    y = this.renderEndCharacterSection(y)

    // Calculate max scroll
    const totalHeight = y - this.SCROLL_START_Y + this.scrollOffset + 40
    const visibleHeight = this.SCROLL_END_Y - this.SCROLL_START_Y
    this.maxScrollOffset = Math.max(0, totalHeight - visibleHeight)
  }

  renderAgeSection(startY) {
    const cardWidth = this.width - 40
    const x = this.centerX
    let y = startY

    const chapter = this.CHAPTERS[this.lifeState.chapter] || this.CHAPTERS.young_hustler

    // Section card
    const cardHeight = 140
    const cardBg = this.add.rectangle(x, y + cardHeight / 2, cardWidth, cardHeight, 0x1a1a2a, 0.95)
    cardBg.setStrokeStyle(2, chapter.color, 0.8)
    this.contentItems.push(cardBg)

    // Chapter icon (large)
    const iconText = this.add.text(x - cardWidth / 2 + 50, y + cardHeight / 2, chapter.icon, {
      fontSize: '48px'
    }).setOrigin(0.5)
    this.contentItems.push(iconText)

    // Chapter name
    const nameText = this.add.text(x - cardWidth / 2 + 100, y + 25, chapter.name, {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
    this.contentItems.push(nameText)

    // Age range badge
    const rangeBadge = this.add.rectangle(x - cardWidth / 2 + 100 + nameText.width + 15, y + 25, 60, 22, chapter.color, 0.3)
    this.contentItems.push(rangeBadge)

    const rangeText = this.add.text(x - cardWidth / 2 + 100 + nameText.width + 15, y + 25, chapter.ageRange, {
      fontSize: '11px',
      color: `#${chapter.color.toString(16).padStart(6, '0')}`
    }).setOrigin(0.5)
    this.contentItems.push(rangeText)

    // Description
    const descText = this.add.text(x - cardWidth / 2 + 100, y + 52, chapter.description, {
      fontSize: '12px',
      color: '#888888',
      wordWrap: { width: cardWidth - 130 }
    })
    this.contentItems.push(descText)

    // Age display
    const ageX = x + cardWidth / 2 - 50
    const ageLabel = this.add.text(ageX, y + 25, 'AGE', {
      fontSize: '10px',
      color: '#888888'
    }).setOrigin(0.5)
    this.contentItems.push(ageLabel)

    const ageValue = this.add.text(ageX, y + 50, String(this.lifeState.age || 18), {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(ageValue)

    // Progress bar to next chapter
    const progressY = y + cardHeight - 35
    const progressWidth = cardWidth - 40
    const progressX = x - progressWidth / 2

    // Progress background
    const progressBg = this.add.rectangle(x, progressY, progressWidth, 12, 0x333333, 0.8)
    this.contentItems.push(progressBg)

    // Calculate progress
    const currentAge = this.lifeState.age || 18
    const nextChapterAge = this.lifeState.nextChapterAt || this.getNextChapterAge(this.lifeState.chapter)
    const prevChapterAge = this.getPrevChapterAge(this.lifeState.chapter)
    const progress = (currentAge - prevChapterAge) / (nextChapterAge - prevChapterAge)

    // Progress fill
    const fillWidth = Math.max(0, Math.min(1, progress)) * progressWidth
    if (fillWidth > 0) {
      const progressFill = this.add.rectangle(progressX + fillWidth / 2, progressY, fillWidth, 12, chapter.color, 0.9)
      this.contentItems.push(progressFill)
    }

    // Progress label
    const yearsLeft = Math.max(0, nextChapterAge - currentAge)
    const progressLabel = this.add.text(x, progressY + 20,
      yearsLeft > 0 ? `${yearsLeft} years until next chapter` : 'Final chapter', {
        fontSize: '10px',
        color: '#666666'
      }).setOrigin(0.5)
    this.contentItems.push(progressLabel)

    return y + cardHeight + 20
  }

  renderModifiersSection(startY) {
    if (!this.chapterModifiers) return startY

    const cardWidth = this.width - 40
    const x = this.centerX
    let y = startY

    // Section header
    const headerText = this.add.text(x - cardWidth / 2, y, '📊 CHAPTER MODIFIERS', {
      fontSize: '14px',
      color: '#f59e0b',
      fontStyle: 'bold'
    })
    this.contentItems.push(headerText)
    y += 30

    // Modifiers grid
    const modifiers = [
      { key: 'energyRegen', label: 'Energy Regen', icon: '⚡', format: 'x' },
      { key: 'learningRate', label: 'Learning Rate', icon: '📚', format: 'x' },
      { key: 'maxHealth', label: 'Max Health', icon: '❤️', format: '' },
      { key: 'heatGain', label: 'Heat Gain', icon: '🔥', format: 'x', inverse: true },
      { key: 'crimeSuccess', label: 'Crime Bonus', icon: '🎯', format: '%' },
      { key: 'pvpDamage', label: 'Combat Power', icon: '⚔️', format: 'x' }
    ]

    const cols = 2
    const colWidth = (cardWidth - 10) / cols
    const rowHeight = 45

    modifiers.forEach((mod, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      const modX = x - cardWidth / 2 + col * colWidth + colWidth / 2
      const modY = y + row * rowHeight

      const value = this.chapterModifiers[mod.key]
      if (value === undefined) return

      // Modifier card
      const modBg = this.add.rectangle(modX, modY + 18, colWidth - 10, rowHeight - 5, 0x1a1a2a, 0.8)
      this.contentItems.push(modBg)

      // Icon and label
      const labelText = this.add.text(modX - colWidth / 2 + 15, modY + 10, `${mod.icon} ${mod.label}`, {
        fontSize: '11px',
        color: '#888888'
      })
      this.contentItems.push(labelText)

      // Value
      let displayValue = value
      let valueColor = '#ffffff'

      if (mod.format === 'x') {
        displayValue = `${value.toFixed(1)}x`
        valueColor = value > 1 ? '#22c55e' : value < 1 ? '#ef4444' : '#ffffff'
        if (mod.inverse) {
          valueColor = value < 1 ? '#22c55e' : value > 1 ? '#ef4444' : '#ffffff'
        }
      } else if (mod.format === '%') {
        displayValue = `${value >= 0 ? '+' : ''}${value}%`
        valueColor = value > 0 ? '#22c55e' : value < 0 ? '#ef4444' : '#ffffff'
      }

      const valueText = this.add.text(modX + colWidth / 2 - 15, modY + 18, displayValue, {
        fontSize: '14px',
        color: valueColor,
        fontStyle: 'bold'
      }).setOrigin(1, 0.5)
      this.contentItems.push(valueText)
    })

    const totalRows = Math.ceil(modifiers.length / cols)
    return y + totalRows * rowHeight + 20
  }

  renderFeaturesSection(startY) {
    const cardWidth = this.width - 40
    const x = this.centerX
    let y = startY

    // Section header
    const headerText = this.add.text(x - cardWidth / 2, y, '🔓 FEATURES', {
      fontSize: '14px',
      color: '#f59e0b',
      fontStyle: 'bold'
    })
    this.contentItems.push(headerText)
    y += 30

    // Feature definitions by chapter
    const allFeatures = [
      { id: 'petty_crimes', name: 'Petty Crimes', unlockChapter: 'young_hustler' },
      { id: 'crew_join', name: 'Join Crews', unlockChapter: 'young_hustler' },
      { id: 'major_crimes', name: 'Major Crimes', unlockChapter: 'rising_player' },
      { id: 'crew_create', name: 'Create Crew', unlockChapter: 'rising_player' },
      { id: 'territory_control', name: 'Territory Control', unlockChapter: 'established_boss' },
      { id: 'faction_leadership', name: 'Faction Leadership', unlockChapter: 'established_boss' },
      { id: 'succession_plan', name: 'Succession Planning', unlockChapter: 'aging_legend' },
      { id: 'mentor_bonuses', name: 'Mentor Bonuses', unlockChapter: 'aging_legend' },
      { id: 'legacy_actions', name: 'Legacy Actions', unlockChapter: 'final_days' }
    ]

    const chapterOrder = ['young_hustler', 'rising_player', 'established_boss', 'aging_legend', 'final_days']
    const currentChapterIndex = chapterOrder.indexOf(this.lifeState.chapter)

    const unlockedFeatures = allFeatures.filter(f =>
      chapterOrder.indexOf(f.unlockChapter) <= currentChapterIndex
    )
    const lockedFeatures = allFeatures.filter(f =>
      chapterOrder.indexOf(f.unlockChapter) > currentChapterIndex
    )

    // Unlocked features
    const unlockedLabel = this.add.text(x - cardWidth / 2 + 10, y, 'Unlocked:', {
      fontSize: '11px',
      color: '#22c55e'
    })
    this.contentItems.push(unlockedLabel)
    y += 20

    unlockedFeatures.forEach((feature, index) => {
      const featureText = this.add.text(x - cardWidth / 2 + 20, y + index * 22, `✓ ${feature.name}`, {
        fontSize: '12px',
        color: '#cccccc'
      })
      this.contentItems.push(featureText)
    })

    y += unlockedFeatures.length * 22 + 15

    // Locked features
    if (lockedFeatures.length > 0) {
      const lockedLabel = this.add.text(x - cardWidth / 2 + 10, y, 'Locked:', {
        fontSize: '11px',
        color: '#ef4444'
      })
      this.contentItems.push(lockedLabel)
      y += 20

      lockedFeatures.forEach((feature, index) => {
        const chapter = this.CHAPTERS[feature.unlockChapter]
        const featureText = this.add.text(x - cardWidth / 2 + 20, y + index * 22,
          `🔒 ${feature.name} (${chapter?.name || feature.unlockChapter})`, {
            fontSize: '12px',
            color: '#666666'
          })
        this.contentItems.push(featureText)
      })

      y += lockedFeatures.length * 22
    }

    return y + 20
  }

  renderTimelineSection(startY) {
    const cardWidth = this.width - 40
    const x = this.centerX
    let y = startY

    // Section header
    const headerText = this.add.text(x - cardWidth / 2, y, '📅 LIFE TIMELINE', {
      fontSize: '14px',
      color: '#f59e0b',
      fontStyle: 'bold'
    })
    this.contentItems.push(headerText)
    y += 30

    const chapters = Object.entries(this.CHAPTERS)
    const currentChapterIndex = chapters.findIndex(([key]) => key === this.lifeState.chapter)
    const nodeSpacing = (cardWidth - 60) / (chapters.length - 1)

    // Timeline line
    const lineY = y + 25
    const timeline = this.add.rectangle(x, lineY, cardWidth - 40, 4, 0x333333, 0.8)
    this.contentItems.push(timeline)

    // Progress fill
    const progressWidth = currentChapterIndex / (chapters.length - 1) * (cardWidth - 40)
    if (progressWidth > 0) {
      const progressLine = this.add.rectangle(
        x - (cardWidth - 40) / 2 + progressWidth / 2,
        lineY, progressWidth, 4,
        this.CHAPTERS[this.lifeState.chapter]?.color || 0xf59e0b, 0.9
      )
      this.contentItems.push(progressLine)
    }

    // Chapter nodes
    chapters.forEach(([key, chapter], index) => {
      const nodeX = x - (cardWidth - 40) / 2 + index * nodeSpacing
      const isPast = index < currentChapterIndex
      const isCurrent = index === currentChapterIndex
      const isFuture = index > currentChapterIndex

      // Node circle
      const nodeColor = isCurrent ? chapter.color : (isPast ? 0x22c55e : 0x333333)
      const nodeSize = isCurrent ? 18 : 12

      const node = this.add.circle(nodeX, lineY, nodeSize, nodeColor, isFuture ? 0.3 : 1)
      if (isCurrent) {
        node.setStrokeStyle(3, 0xffffff, 0.5)
      }
      this.contentItems.push(node)

      // Icon for current
      if (isCurrent) {
        const nodeIcon = this.add.text(nodeX, lineY, chapter.icon, {
          fontSize: '12px'
        }).setOrigin(0.5)
        this.contentItems.push(nodeIcon)
      }

      // Label below
      const labelText = this.add.text(nodeX, lineY + 30, chapter.name.split(' ')[0], {
        fontSize: '9px',
        color: isCurrent ? '#ffffff' : (isPast ? '#888888' : '#444444')
      }).setOrigin(0.5)
      this.contentItems.push(labelText)
    })

    return y + 80
  }

  renderSuccessionSection(startY) {
    const cardWidth = this.width - 40
    const x = this.centerX
    let y = startY

    // Section header
    const headerText = this.add.text(x - cardWidth / 2, y, '👑 SUCCESSION PLAN', {
      fontSize: '14px',
      color: '#f59e0b',
      fontStyle: 'bold'
    })
    this.contentItems.push(headerText)
    y += 30

    // Succession card
    const cardHeight = 180
    const cardBg = this.add.rectangle(x, y + cardHeight / 2, cardWidth, cardHeight, 0x1a1a2a, 0.95)
    cardBg.setStrokeStyle(1, 0x8b5cf6, 0.6)
    this.contentItems.push(cardBg)

    const plan = this.successionPlan || {}

    // Heir type selector
    const heirTypes = [
      { key: 'random', label: '🎲 Random Heir', desc: 'A new character starts fresh' },
      { key: 'protege', label: '🎓 Protégé', desc: 'Train a successor in your crew' },
      { key: 'family', label: '👨‍👧 Family', desc: 'Pass to a family member' },
      { key: 'chosen', label: '🎯 Chosen One', desc: 'Select a specific player' }
    ]

    const selectedType = plan.heirType || 'random'
    const btnWidth = (cardWidth - 30) / 2
    const btnHeight = 36

    heirTypes.forEach((type, index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const btnX = x - cardWidth / 2 + 20 + col * (btnWidth + 10) + btnWidth / 2
      const btnY = y + 25 + row * (btnHeight + 8) + btnHeight / 2

      const isSelected = selectedType === type.key
      const btnBg = this.add.rectangle(btnX, btnY, btnWidth, btnHeight,
        isSelected ? 0x8b5cf6 : 0x2a2a4a, isSelected ? 0.9 : 0.8)
        .setInteractive({ useHandCursor: true })
      this.contentItems.push(btnBg)

      const btnText = this.add.text(btnX, btnY, type.label, {
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: isSelected ? 'bold' : 'normal'
      }).setOrigin(0.5)
      this.contentItems.push(btnText)

      btnBg.on('pointerover', () => {
        if (!isSelected) btnBg.setFillStyle(0x3a3a5a, 0.9)
        audioManager.playHover()
      })
      btnBg.on('pointerout', () => {
        if (!isSelected) btnBg.setFillStyle(0x2a2a4a, 0.8)
      })
      btnBg.on('pointerdown', () => {
        audioManager.playClick()
        this.updateSuccessionType(type.key)
      })
    })

    // Inheritance percentages (adjustable)
    const percentY = y + 110
    const percents = [
      { key: 'cashPercent', label: '💵 Cash', value: plan.cashPercent ?? 50 },
      { key: 'propertyPercent', label: '🏠 Property', value: plan.propertyPercent ?? 100 },
      { key: 'reputationPercent', label: '⭐ Rep', value: plan.reputationPercent ?? 30 }
    ]

    const percentWidth = (cardWidth - 40) / 3

    percents.forEach((pct, index) => {
      const pctX = x - cardWidth / 2 + 20 + index * percentWidth + percentWidth / 2

      const pctLabel = this.add.text(pctX, percentY, pct.label, {
        fontSize: '10px',
        color: '#888888'
      }).setOrigin(0.5)
      this.contentItems.push(pctLabel)

      // Decrease button
      const minusBtn = this.add.text(pctX - 35, percentY + 20, '−', {
        fontSize: '20px',
        color: '#ef4444',
        fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      this.contentItems.push(minusBtn)
      minusBtn.on('pointerdown', () => {
        audioManager.playClick()
        this.updateInheritancePercent(pct.key, -10)
      })
      minusBtn.on('pointerover', () => minusBtn.setColor('#ff6666'))
      minusBtn.on('pointerout', () => minusBtn.setColor('#ef4444'))

      // Value display
      const pctValue = this.add.text(pctX, percentY + 20, `${pct.value}%`, {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5)
      this.contentItems.push(pctValue)

      // Increase button
      const plusBtn = this.add.text(pctX + 35, percentY + 20, '+', {
        fontSize: '20px',
        color: '#22c55e',
        fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      this.contentItems.push(plusBtn)
      plusBtn.on('pointerdown', () => {
        audioManager.playClick()
        this.updateInheritancePercent(pct.key, 10)
      })
      plusBtn.on('pointerover', () => plusBtn.setColor('#44ff66'))
      plusBtn.on('pointerout', () => plusBtn.setColor('#22c55e'))

      // Progress bar
      const barWidth = percentWidth - 20
      const barBg = this.add.rectangle(pctX, percentY + 42, barWidth, 8, 0x333333, 0.8)
      this.contentItems.push(barBg)

      const fillWidth = (pct.value / 100) * barWidth
      if (fillWidth > 0) {
        const barFill = this.add.rectangle(pctX - barWidth / 2 + fillWidth / 2, percentY + 42, fillWidth, 8, 0x8b5cf6, 0.9)
        this.contentItems.push(barFill)
      }
    })

    // Save button
    const saveBtn = this.createButton(x, y + cardHeight - 25, 120, 32, '💾 Save Plan', 0x22c55e, () => this.saveSuccessionPlan())

    return y + cardHeight + 20
  }

  renderDynastySection(startY) {
    const cardWidth = this.width - 40
    const x = this.centerX
    let y = startY

    // Section header
    const headerText = this.add.text(x - cardWidth / 2, y, '🏛️ DYNASTY TREE', {
      fontSize: '14px',
      color: '#f59e0b',
      fontStyle: 'bold'
    })
    this.contentItems.push(headerText)
    y += 30

    // Dynasty card
    const cardHeight = 200
    const cardBg = this.add.rectangle(x, y + cardHeight / 2, cardWidth, cardHeight, 0x1a1a2a, 0.95)
    cardBg.setStrokeStyle(1, 0xf59e0b, 0.6)
    this.contentItems.push(cardBg)

    // Generation info
    const generation = this.lineage?.generation || 1
    const genText = this.add.text(x, y + 25, `Generation ${generation}`, {
      fontSize: '16px',
      color: '#f59e0b',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(genText)

    // Ancestors (simple vertical tree)
    const ancestors = this.lineage?.ancestors || []
    const nodeSize = 40
    const nodeSpacing = 55
    const treeStartY = y + 60

    // Current character (bottom)
    const currentY = treeStartY + Math.min(ancestors.length, 3) * nodeSpacing

    const currentNode = this.add.circle(x, currentY, nodeSize / 2, 0x8b5cf6, 1)
    currentNode.setStrokeStyle(2, 0xffffff, 0.8)
    this.contentItems.push(currentNode)

    const currentIcon = this.add.text(x, currentY, '👤', {
      fontSize: '20px'
    }).setOrigin(0.5)
    this.contentItems.push(currentIcon)

    const currentLabel = this.add.text(x + nodeSize, currentY, 'You', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5)
    this.contentItems.push(currentLabel)

    // Draw ancestors
    ancestors.slice(0, 3).forEach((ancestor, index) => {
      const ancestorY = currentY - (index + 1) * nodeSpacing

      // Connecting line
      const lineStartY = ancestorY + nodeSize / 2
      const lineEndY = index === 0 ? currentY - nodeSize / 2 : ancestorY + nodeSpacing - nodeSize / 2

      const line = this.add.rectangle(x, (lineStartY + lineEndY) / 2, 2, lineEndY - lineStartY, 0x666666)
      this.contentItems.push(line)

      // Ancestor node
      const ancestorNode = this.add.circle(x, ancestorY, nodeSize / 2 - 5, 0x6b7280, 0.8)
      this.contentItems.push(ancestorNode)

      const ancestorIcon = this.add.text(x, ancestorY, ancestor.endingType ?
        (this.ENDINGS[ancestor.endingType]?.icon || '💀') : '👤', {
        fontSize: '16px'
      }).setOrigin(0.5)
      this.contentItems.push(ancestorIcon)

      const ancestorLabel = this.add.text(x + nodeSize - 10, ancestorY,
        `${ancestor.characterName || 'Ancestor'} (Gen ${generation - index - 1})`, {
          fontSize: '10px',
          color: '#888888'
        }).setOrigin(0, 0.5)
      this.contentItems.push(ancestorLabel)
    })

    // Dynasty stats
    if (this.dynasty) {
      const statsY = y + cardHeight - 35
      const stats = [
        `Total Earnings: $${(this.dynasty.totalEarnings || 0).toLocaleString()}`,
        `Total Kills: ${this.dynasty.totalKills || 0}`,
        `Achievements: ${this.dynasty.achievements?.length || 0}`
      ]

      const statsText = this.add.text(x, statsY, stats.join(' • '), {
        fontSize: '10px',
        color: '#666666'
      }).setOrigin(0.5)
      this.contentItems.push(statsText)
    }

    return y + cardHeight + 20
  }

  renderEndCharacterSection(startY) {
    const cardWidth = this.width - 40
    const x = this.centerX
    let y = startY

    // Warning section
    const warningBg = this.add.rectangle(x, y + 50, cardWidth, 100, 0x2a1a1a, 0.9)
    warningBg.setStrokeStyle(2, 0xef4444, 0.6)
    this.contentItems.push(warningBg)

    const warningIcon = this.add.text(x, y + 25, '⚠️', {
      fontSize: '24px'
    }).setOrigin(0.5)
    this.contentItems.push(warningIcon)

    const warningTitle = this.add.text(x, y + 55, 'End This Character', {
      fontSize: '16px',
      color: '#ef4444',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(warningTitle)

    const warningDesc = this.add.text(x, y + 80, 'Choose how this character\'s story ends.\nYour heir will inherit based on your succession plan.', {
      fontSize: '11px',
      color: '#888888',
      align: 'center'
    }).setOrigin(0.5)
    this.contentItems.push(warningDesc)

    // End character button
    const endBtn = this.createButton(x, y + 120, 160, 40, '💀 End Character', 0xef4444, () => this.showEndCharacterModal())

    return y + 150
  }

  createButton(x, y, width, height, label, color, onClick) {
    const bg = this.add.rectangle(x, y, width, height, color, 0.9)
      .setInteractive({ useHandCursor: true })
    this.contentItems.push(bg)

    const text = this.add.text(x, y, label, {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.contentItems.push(text)

    bg.on('pointerover', () => {
      bg.setFillStyle(color, 1)
      audioManager.playHover()
    })
    bg.on('pointerout', () => bg.setFillStyle(color, 0.9))
    bg.on('pointerdown', () => {
      audioManager.playClick()
      onClick()
    })

    return { bg, text }
  }

  // ============================================================================
  // Actions
  // ============================================================================

  async updateSuccessionType(type) {
    try {
      const updatedPlan = {
        ...this.successionPlan,
        heirType: type
      }

      // Try API first, then fallback to local
      try {
        await narrativeService.updateSuccessionPlan(updatedPlan)
      } catch (e) {
        // Save locally
        this.saveSuccessionPlanLocal(updatedPlan)
      }

      this.successionPlan = updatedPlan
      this.renderContent()
      notificationManager.showToast('Heir type updated', 'success')
    } catch (error) {
      notificationManager.showToast(error.message || 'Failed to update', 'error')
    }
  }

  async saveSuccessionPlan() {
    try {
      try {
        await narrativeService.updateSuccessionPlan(this.successionPlan)
      } catch (e) {
        // Save locally
        this.saveSuccessionPlanLocal(this.successionPlan)
      }

      audioManager.playSuccess()
      notificationManager.showToast('Succession plan saved!', 'success')
    } catch (error) {
      notificationManager.showToast(error.message || 'Failed to save', 'error')
    }
  }

  saveSuccessionPlanLocal(plan) {
    const player = getPlayerData() || {}
    player.successionPlan = plan
    savePlayerData(player)
  }

  updateInheritancePercent(key, delta) {
    const currentValue = this.successionPlan[key] || 50
    const newValue = Math.max(0, Math.min(100, currentValue + delta))
    this.successionPlan[key] = newValue
    this.saveSuccessionPlanLocal(this.successionPlan)
    this.renderContent()
  }

  showEndCharacterModal() {
    // Create modal overlay
    const modalBg = this.add.rectangle(this.centerX, this.centerY, this.width, this.height, 0x000000, 0.9)
      .setInteractive()
      .setDepth(100)
    this.contentItems.push(modalBg)

    const modalWidth = this.width - 50
    const modalHeight = 380
    const modalY = this.centerY

    // Modal
    const modal = this.add.rectangle(this.centerX, modalY, modalWidth, modalHeight, 0x1a1a2a, 0.98)
    modal.setStrokeStyle(2, 0xef4444, 0.8)
    modal.setDepth(101)
    this.contentItems.push(modal)

    // Title
    const title = this.add.text(this.centerX, modalY - modalHeight / 2 + 30, '💀 Choose Your Ending', {
      fontSize: '18px',
      color: '#ef4444',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(102)
    this.contentItems.push(title)

    // Warning
    const warning = this.add.text(this.centerX, modalY - modalHeight / 2 + 60, 'This action cannot be undone!', {
      fontSize: '12px',
      color: '#f59e0b'
    }).setOrigin(0.5).setDepth(102)
    this.contentItems.push(warning)

    // Ending options
    const endings = [
      { key: 'retirement', desc: 'Leave the life behind peacefully' },
      { key: 'prison', desc: 'Caught by the feds, life sentence' },
      { key: 'death', desc: 'Go out in a blaze of glory' },
      { key: 'witness_protection', desc: 'Rat out everyone, disappear' }
    ]

    const btnWidth = modalWidth - 40
    const btnHeight = 50
    const startY = modalY - 70

    endings.forEach((ending, index) => {
      const config = this.ENDINGS[ending.key]
      const btnY = startY + index * (btnHeight + 10)

      const btnBg = this.add.rectangle(this.centerX, btnY, btnWidth, btnHeight, 0x2a2a4a, 0.9)
        .setInteractive({ useHandCursor: true })
        .setDepth(102)
      this.contentItems.push(btnBg)

      const btnIcon = this.add.text(this.centerX - btnWidth / 2 + 30, btnY, config.icon, {
        fontSize: '24px'
      }).setOrigin(0.5).setDepth(103)
      this.contentItems.push(btnIcon)

      const btnLabel = this.add.text(this.centerX - btnWidth / 2 + 60, btnY - 8, config.name, {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setDepth(103)
      this.contentItems.push(btnLabel)

      const btnDesc = this.add.text(this.centerX - btnWidth / 2 + 60, btnY + 10, ending.desc, {
        fontSize: '10px',
        color: '#888888'
      }).setDepth(103)
      this.contentItems.push(btnDesc)

      btnBg.on('pointerover', () => {
        btnBg.setFillStyle(config.color, 0.6)
        audioManager.playHover()
      })
      btnBg.on('pointerout', () => btnBg.setFillStyle(0x2a2a4a, 0.9))
      btnBg.on('pointerdown', () => {
        audioManager.playClick()
        this.confirmEndCharacter(ending.key)
      })
    })

    // Cancel button
    const cancelY = modalY + modalHeight / 2 - 35
    const cancelBtn = this.add.rectangle(this.centerX, cancelY, 120, 36, 0x6b7280, 0.9)
      .setInteractive({ useHandCursor: true })
      .setDepth(102)
    this.contentItems.push(cancelBtn)

    const cancelText = this.add.text(this.centerX, cancelY, 'Cancel', {
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(103)
    this.contentItems.push(cancelText)

    cancelBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.renderContent()
    })

    modalBg.on('pointerdown', () => this.renderContent())
  }

  confirmEndCharacter(endingType) {
    const ending = this.ENDINGS[endingType]

    // Final confirmation
    this.clearContent()

    const modalBg = this.add.rectangle(this.centerX, this.centerY, this.width, this.height, 0x000000, 0.95)
      .setInteractive()
      .setDepth(100)
    this.contentItems.push(modalBg)

    const confirmIcon = this.add.text(this.centerX, this.centerY - 80, ending.icon, {
      fontSize: '64px'
    }).setOrigin(0.5).setDepth(101)
    this.contentItems.push(confirmIcon)

    const confirmTitle = this.add.text(this.centerX, this.centerY - 20, `${ending.name}?`, {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(101)
    this.contentItems.push(confirmTitle)

    const confirmMsg = this.add.text(this.centerX, this.centerY + 20,
      'Your legacy will be passed to your heir.\nThis character\'s story ends here.', {
        fontSize: '14px',
        color: '#888888',
        align: 'center'
      }).setOrigin(0.5).setDepth(101)
    this.contentItems.push(confirmMsg)

    // Final buttons
    const noBtn = this.add.rectangle(this.centerX - 70, this.centerY + 90, 120, 44, 0x6b7280, 0.9)
      .setInteractive({ useHandCursor: true })
      .setDepth(102)
    this.contentItems.push(noBtn)

    const noText = this.add.text(this.centerX - 70, this.centerY + 90, 'Go Back', {
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(103)
    this.contentItems.push(noText)

    const yesBtn = this.add.rectangle(this.centerX + 70, this.centerY + 90, 120, 44, 0xef4444, 0.9)
      .setInteractive({ useHandCursor: true })
      .setDepth(102)
    this.contentItems.push(yesBtn)

    const yesText = this.add.text(this.centerX + 70, this.centerY + 90, 'End It', {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(103)
    this.contentItems.push(yesText)

    noBtn.on('pointerdown', () => {
      audioManager.playClick()
      this.renderContent()
    })

    yesBtn.on('pointerdown', async () => {
      audioManager.playClick()
      await this.executeEndCharacter(endingType)
    })
  }

  async executeEndCharacter(endingType) {
    try {
      // Calculate inheritance
      const inheritance = this.calculateInheritance()

      // Archive current character to lineage
      this.archiveCurrentCharacter(endingType)

      // Create new heir
      this.createNewHeir(inheritance)

      this.clearContent()

      // Show ending screen
      const bgFade = this.add.rectangle(this.centerX, this.centerY, this.width, this.height, 0x000000, 1)
        .setDepth(100)
      this.contentItems.push(bgFade)

      const ending = this.ENDINGS[endingType]

      this.tweens.add({
        targets: bgFade,
        alpha: { from: 0, to: 1 },
        duration: 2000,
        onComplete: () => {
          const endIcon = this.add.text(this.centerX, this.centerY - 70, ending.icon, {
            fontSize: '72px'
          }).setOrigin(0.5).setDepth(101).setAlpha(0)
          this.contentItems.push(endIcon)

          const characterName = this.lifeState?.characterName || 'Your character'
          const endText = this.add.text(this.centerX, this.centerY, ending.name, {
            fontSize: '28px',
            color: '#ffffff',
            fontStyle: 'bold'
          }).setOrigin(0.5).setDepth(101).setAlpha(0)
          this.contentItems.push(endText)

          const nameText = this.add.text(this.centerX, this.centerY + 35, characterName, {
            fontSize: '16px',
            color: '#888888'
          }).setOrigin(0.5).setDepth(101).setAlpha(0)
          this.contentItems.push(nameText)

          // Show inheritance summary
          const inheritText = this.add.text(this.centerX, this.centerY + 80,
            `💵 $${inheritance.cash.toLocaleString()} • ⭐ ${inheritance.reputation} Rep inherited`, {
              fontSize: '12px',
              color: '#22c55e'
            }).setOrigin(0.5).setDepth(101).setAlpha(0)
          this.contentItems.push(inheritText)

          const rip = this.add.text(this.centerX, this.centerY + 115, 'Your legacy lives on...', {
            fontSize: '14px',
            color: '#888888'
          }).setOrigin(0.5).setDepth(101).setAlpha(0)
          this.contentItems.push(rip)

          this.tweens.add({
            targets: [endIcon, endText, nameText, inheritText, rip],
            alpha: 1,
            duration: 1500,
            delay: 500
          })

          // Return to game after delay
          this.createTimeout(() => {
            notificationManager.showToast('New heir starting fresh!', 'info')
            // Reload the scene with new data
            this.loadLocalData()
          }, 5000)
        }
      })

    } catch (error) {
      notificationManager.showToast(error.message || 'Failed to end character', 'error')
      this.renderContent()
    }
  }

  calculateInheritance() {
    const player = getPlayerData() || {}
    const plan = this.successionPlan || this.createDefaultSuccessionPlan()

    // Get current stats
    const currentCash = player.cash || 0
    const currentRep = player.reputation || 0

    // Calculate based on succession percentages
    const inheritedCash = Math.floor(currentCash * (plan.cashPercent / 100))
    const inheritedRep = Math.floor(currentRep * (plan.reputationPercent / 100))

    // Property inheritance (all or nothing for now)
    const inheritProperty = plan.propertyPercent >= 50

    return {
      cash: inheritedCash,
      reputation: inheritedRep,
      properties: inheritProperty ? (player.properties || []) : []
    }
  }

  archiveCurrentCharacter(endingType) {
    const player = getPlayerData() || {}

    // Create ancestor record
    const ancestor = {
      characterName: this.lifeState?.characterName || 'Unknown',
      finalAge: this.lifeState?.age || 18,
      chapter: this.lifeState?.chapter || 'young_hustler',
      endingType: endingType,
      totalEarnings: player.totalEarnings || player.cash || 0,
      totalKills: player.kills || 0,
      totalCrimes: player.crimes_committed || 0,
      endedAt: Date.now()
    }

    // Update lineage
    if (!player.lineage) {
      player.lineage = { generation: 1, ancestors: [] }
    }

    player.lineage.ancestors.unshift(ancestor) // Add to front (most recent first)
    player.lineage.generation = (player.lineage.generation || 1) + 1

    // Keep only last 10 ancestors
    if (player.lineage.ancestors.length > 10) {
      player.lineage.ancestors = player.lineage.ancestors.slice(0, 10)
    }

    // Update dynasty stats
    if (!player.dynasty) {
      player.dynasty = this.createDefaultDynasty()
    }

    player.dynasty.totalEarnings = (player.dynasty.totalEarnings || 0) + (player.totalEarnings || 0)
    player.dynasty.totalKills = (player.dynasty.totalKills || 0) + (player.kills || 0)
    player.dynasty.totalCrimes = (player.dynasty.totalCrimes || 0) + (player.crimes_committed || 0)

    // Add ending achievement
    const endingAchievement = `${this.ENDINGS[endingType]?.icon || '💀'} ${ancestor.characterName} - ${this.ENDINGS[endingType]?.name || endingType}`
    if (!player.dynasty.achievements) player.dynasty.achievements = []
    player.dynasty.achievements.push({
      text: endingAchievement,
      date: Date.now()
    })

    savePlayerData(player)
  }

  createNewHeir(inheritance) {
    const player = getPlayerData() || {}

    // Reset character stats but keep inheritance
    player.cash = inheritance.cash
    player.reputation = inheritance.reputation
    player.properties = inheritance.properties

    // Reset combat/crime stats
    player.health = 100
    player.energy = 100
    player.heat = 0
    player.kills = 0
    player.crimes_committed = 0

    // Create new life state
    player.lifeState = {
      age: 18,
      chapter: 'young_hustler',
      lastAgeUpdate: Date.now(),
      totalDaysPlayed: 0,
      characterName: this.generateCharacterName(),
      createdAt: Date.now()
    }

    // Keep succession plan
    // Keep lineage and dynasty

    savePlayerData(player)

    // Update gameManager if available
    if (gameManager.player) {
      gameManager.player = { ...gameManager.player, ...player }
    }

    // Update local state
    this.lifeState = player.lifeState
    this.lineage = player.lineage
    this.dynasty = player.dynasty
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  getNextChapterAge(chapter) {
    const ages = {
      young_hustler: 25,
      rising_player: 35,
      established_boss: 50,
      aging_legend: 65,
      final_days: 100
    }
    return ages[chapter] || 100
  }

  getPrevChapterAge(chapter) {
    const ages = {
      young_hustler: 18,
      rising_player: 25,
      established_boss: 35,
      aging_legend: 50,
      final_days: 65
    }
    return ages[chapter] || 18
  }

  renderError() {
    const centerY = (this.SCROLL_START_Y + this.SCROLL_END_Y) / 2

    const icon = this.add.text(this.centerX, centerY - 30, '⚠️', {
      fontSize: '48px'
    }).setOrigin(0.5)
    this.contentItems.push(icon)

    const title = this.add.text(this.centerX, centerY + 20, 'Failed to Load Life Data', {
      fontSize: '18px',
      color: '#ef4444'
    }).setOrigin(0.5)
    this.contentItems.push(title)

    this.createButton(this.centerX, centerY + 70, 100, 36, '↻ Retry', 0x3b82f6, () => this.loadData())
  }

  closeScene() {
    this.scene.stop()
    this.scene.resume('GameScene')
  }
}

export default LifeScene
