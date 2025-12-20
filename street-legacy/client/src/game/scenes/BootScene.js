import Phaser from 'phaser'
import { audioManager, AUDIO_KEYS } from '../managers/AudioManager'
import { getPlayerData, savePlayerData, DISTRICTS } from '../data/GameData.js'
import { VERSION, DEBUG } from '../config/Constants'

/**
 * BootScene - Game Entry Point (Local Data Mode)
 *
 * Features:
 * - Animated background with grid and scan line
 * - Continue screen for existing players
 * - Character creation for new players
 * - No external authentication required
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
    this.audioUnlocked = false
    this.selectedBuild = 'hustler'
    this.selectedDistrict = 'parkdale'
    this.usernameValue = ''
    this.cursorVisible = true
  }

  preload() {
    this.load.on('loaderror', () => {})

    // Load menu background music
    this.load.audio(AUDIO_KEYS.BGM.MENU, 'assets/audio/bgm/menu.mp3')
  }

  create() {
    const { width, height } = this.cameras.main

    // Initialize audio
    audioManager.init(this)
    this.setupAudioUnlock()

    // Background gradient
    this.add.rectangle(0, 0, width, height, 0x08080f).setOrigin(0)

    // Animated grid pattern
    const graphics = this.add.graphics()
    graphics.lineStyle(1, 0x151525, 0.3)
    for (let x = 0; x < width; x += 30) {
      graphics.moveTo(x, 0)
      graphics.lineTo(x, height)
    }
    for (let y = 0; y < height; y += 30) {
      graphics.moveTo(0, y)
      graphics.lineTo(width, y)
    }
    graphics.strokePath()

    // Glowing scan line
    const scanLine = this.add.rectangle(width / 2, 0, width, 2, 0xff3333, 0.1)
    this.tweens.add({
      targets: scanLine,
      y: height,
      duration: 4000,
      repeat: -1
    })

    // City silhouette at bottom
    this.drawCitySilhouette(width, height)

    // LOGO - Compact, positioned at top
    const logoY = 45
    this.add.text(width / 2, logoY, 'STREET', {
      fontSize: '34px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff'
    }).setOrigin(0.5)

    const legacyText = this.add.text(width / 2, logoY + 36, 'LEGACY', {
      fontSize: '34px',
      fontFamily: 'Arial Black, Arial',
      color: '#ff3333'
    }).setOrigin(0.5)

    // Glitch effect on LEGACY
    this.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => {
        legacyText.x += Phaser.Math.Between(-3, 3)
        this.time.delayedCall(50, () => legacyText.x = width / 2)
      }
    })

    this.add.text(width / 2, logoY + 68, 'TORONTO UNDERGROUND', {
      fontSize: '9px',
      color: '#444455',
      letterSpacing: 3
    }).setOrigin(0.5)

    // Version at very bottom
    this.add.text(width / 2, height - 10, `v${VERSION.STRING} • Local Mode`, {
      fontSize: '8px',
      color: '#333333'
    }).setOrigin(0.5)

    if (DEBUG.ENABLED) {
      this.add.text(width / 2, height - 22, '[DEBUG MODE]', {
        fontSize: '8px',
        color: '#ef4444'
      }).setOrigin(0.5)
    }

    // Check for existing player
    const player = getPlayerData()
    const hasExistingPlayer = player.username !== 'Player' && localStorage.getItem('streetLegacyPlayer')

    if (hasExistingPlayer) {
      this.showContinueScreen(player)
    } else {
      this.showNewGameScreen()
    }
  }

  drawCitySilhouette(width, height) {
    const graphics = this.add.graphics()
    graphics.fillStyle(0x0f0f18, 1)

    let x = 0
    while (x < width) {
      const w = Phaser.Math.Between(20, 50)
      const h = Phaser.Math.Between(30, 100)
      graphics.fillRect(x, height - h, w, h)

      // Windows
      graphics.fillStyle(0x222235, 1)
      for (let wy = height - h + 8; wy < height - 5; wy += 12) {
        for (let wx = x + 5; wx < x + w - 5; wx += 10) {
          if (Math.random() > 0.3) {
            graphics.fillRect(wx, wy, 6, 8)
          }
        }
      }
      graphics.fillStyle(0x0f0f18, 1)
      x += w + Phaser.Math.Between(0, 10)
    }
  }

  showContinueScreen(player) {
    const { width, height } = this.cameras.main

    // Panel centered in available space (below logo ~130px, above city ~60px)
    const panelY = 130 + (height - 130 - 60) / 2

    // Panel background - larger
    this.add.rectangle(width / 2, panelY, width - 30, 240, 0x12121a)
      .setStrokeStyle(1, 0x2a2a3a)

    // Welcome back
    this.add.text(width / 2, panelY - 85, 'WELCOME BACK', {
      fontSize: '11px',
      color: '#666666',
      letterSpacing: 2
    }).setOrigin(0.5)

    // Player avatar circle - larger
    this.add.circle(width / 2, panelY - 40, 35, 0x2a2a3a)
    this.add.circle(width / 2, panelY - 40, 35)
      .setStrokeStyle(2, 0xff3333)
    this.add.text(width / 2, panelY - 40, player.username.charAt(0).toUpperCase(), {
      fontSize: '28px',
      color: '#ff3333',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    // Player name
    this.add.text(width / 2, panelY + 15, player.username, {
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    // Level badge
    this.add.rectangle(width / 2, panelY + 45, 80, 24, 0xff3333, 0.2)
      .setStrokeStyle(1, 0xff3333)
    this.add.text(width / 2, panelY + 45, `Level ${player.level}`, {
      fontSize: '12px',
      color: '#ff3333'
    }).setOrigin(0.5)

    // Stats row
    const statsY = panelY + 78
    this.add.text(width / 2 - 70, statsY, `💰 ${(player.cash || 0).toLocaleString()}`, {
      fontSize: '12px',
      color: '#22c55e'
    }).setOrigin(0.5)

    this.add.text(width / 2 + 70, statsY, `🏦 ${(player.bank || 0).toLocaleString()}`, {
      fontSize: '12px',
      color: '#3b82f6'
    }).setOrigin(0.5)

    // Continue button - larger
    const continueBtn = this.add.rectangle(width / 2, panelY + 120, width - 60, 50, 0x22c55e)
      .setInteractive({ useHandCursor: true })

    const continueBtnText = this.add.text(width / 2, panelY + 120, '▶  CONTINUE', {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    continueBtn.on('pointerover', () => {
      continueBtn.setFillStyle(0x16a34a)
      this.tweens.add({ targets: [continueBtn, continueBtnText], scaleX: 1.02, scaleY: 1.02, duration: 100 })
    })
    continueBtn.on('pointerout', () => {
      continueBtn.setFillStyle(0x22c55e)
      this.tweens.add({ targets: [continueBtn, continueBtnText], scaleX: 1, scaleY: 1, duration: 100 })
    })
    continueBtn.on('pointerdown', () => {
      try { audioManager.playClick() } catch (e) {}
      this.cameras.main.fadeOut(400)
      this.time.delayedCall(400, () => this.scene.start('PreloadScene'))
    })

    // New game link
    const newGameText = this.add.text(width / 2, panelY + 165, 'Start New Game', {
      fontSize: '12px',
      color: '#555555'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    newGameText.on('pointerover', () => newGameText.setColor('#ff6666'))
    newGameText.on('pointerout', () => newGameText.setColor('#555555'))
    newGameText.on('pointerdown', () => {
      localStorage.removeItem('streetLegacyPlayer')
      this.scene.restart()
    })

    // Keyboard
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ENTER', () => {
        this.cameras.main.fadeOut(400)
        this.time.delayedCall(400, () => this.scene.start('PreloadScene'))
      })
    }
  }

  showNewGameScreen() {
    const { width, height } = this.cameras.main

    // Panel starts below logo (~130px) and fills available space above city (~60px)
    const panelStartY = 130
    const panelHeight = height - panelStartY - 65
    const panelCenterY = panelStartY + panelHeight / 2

    // Panel background - fills available space
    this.add.rectangle(width / 2, panelCenterY, width - 24, panelHeight, 0x0f0f1a)
      .setStrokeStyle(1, 0x252535)

    // Header
    this.add.text(width / 2, panelStartY + 15, 'CREATE YOUR CHARACTER', {
      fontSize: '13px',
      color: '#888888',
      fontStyle: 'bold',
      letterSpacing: 1
    }).setOrigin(0.5)

    // === NAME INPUT SECTION ===
    const inputY = panelStartY + 55

    this.add.text(width / 2, inputY - 15, 'STREET NAME', {
      fontSize: '10px',
      color: '#555555',
      letterSpacing: 1
    }).setOrigin(0.5)

    // Input box background - larger
    const inputBg = this.add.rectangle(width / 2, inputY + 12, width - 50, 42, 0x1a1a28)
      .setStrokeStyle(2, 0x333344)
      .setInteractive({ useHandCursor: true })

    // Input text display
    this.inputText = this.add.text(width / 2, inputY + 12, '', {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5)

    // Blinking cursor
    const cursor = this.add.text(width / 2 + 5, inputY + 12, '|', {
      fontSize: '18px',
      color: '#ff3333'
    }).setOrigin(0, 0.5)

    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        this.cursorVisible = !this.cursorVisible
        cursor.setVisible(this.cursorVisible)
      }
    })

    // Keyboard input
    this.input.keyboard?.on('keydown', (event) => {
      if (event.key === 'Backspace') {
        this.usernameValue = this.usernameValue.slice(0, -1)
      } else if (event.key === 'Enter') {
        this.startGame(this.usernameValue)
      } else if (event.key.length === 1 && this.usernameValue.length < 12) {
        this.usernameValue += event.key
      }

      if (this.inputText) {
        this.inputText.setText(this.usernameValue)
        cursor.x = width / 2 + this.inputText.width / 2 + 3
      }
    })

    inputBg.on('pointerdown', () => {
      inputBg.setStrokeStyle(2, 0xff3333)
    })

    // === PATH SELECTION ===
    const pathY = panelStartY + 115

    this.add.text(width / 2, pathY, 'CHOOSE YOUR PATH', {
      fontSize: '10px',
      color: '#555555',
      letterSpacing: 1
    }).setOrigin(0.5)

    const builds = [
      { id: 'hustler', name: 'Hustler', desc: '+Crime XP', color: 0xaa3333, icon: '😈' },
      { id: 'entrepreneur', name: 'Business', desc: '+Cash', color: 0x33aa33, icon: '💰' },
      { id: 'community_kid', name: 'Street', desc: '+Rep', color: 0xaa8833, icon: '👊' }
    ]

    this.buildButtons = []
    const btnWidth = (width - 70) / 3
    const buildStartX = 35 + btnWidth / 2
    const pathBtnY = pathY + 45

    builds.forEach((build, i) => {
      const x = buildStartX + i * (btnWidth + 10)
      const isSelected = this.selectedBuild === build.id

      const btn = this.add.rectangle(x, pathBtnY, btnWidth, 65, isSelected ? build.color : 0x1a1a28)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(2, isSelected ? 0xffffff : 0x333344)

      const iconText = this.add.text(x, pathBtnY - 15, build.icon, {
        fontSize: '22px'
      }).setOrigin(0.5)

      const nameText = this.add.text(x, pathBtnY + 10, build.name, {
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5)

      const descText = this.add.text(x, pathBtnY + 26, build.desc, {
        fontSize: '9px',
        color: '#888888'
      }).setOrigin(0.5)

      btn.on('pointerover', () => {
        if (this.selectedBuild !== build.id) btn.setFillStyle(0x252535)
      })
      btn.on('pointerout', () => {
        if (this.selectedBuild !== build.id) btn.setFillStyle(0x1a1a28)
      })
      btn.on('pointerdown', () => {
        this.selectedBuild = build.id
        try { audioManager.playClick() } catch (e) {}
        this.buildButtons.forEach((b, idx) => {
          const sel = builds[idx].id === build.id
          b.btn.setFillStyle(sel ? builds[idx].color : 0x1a1a28)
          b.btn.setStrokeStyle(2, sel ? 0xffffff : 0x333344)
        })
      })

      this.buildButtons.push({ btn, iconText, nameText, descText })
    })

    // === DISTRICT SELECTION ===
    const districtY = pathBtnY + 65

    this.add.text(width / 2, districtY, 'STARTING DISTRICT', {
      fontSize: '10px',
      color: '#555555',
      letterSpacing: 1
    }).setOrigin(0.5)

    const starterDistricts = DISTRICTS.filter(d => d.min_level <= 1).slice(0, 3)
    this.districtButtons = []
    const distBtnWidth = btnWidth
    const distBtnY = districtY + 40

    starterDistricts.forEach((district, i) => {
      const x = buildStartX + i * (distBtnWidth + 10)
      const isSelected = this.selectedDistrict === district.id

      const btn = this.add.rectangle(x, distBtnY, distBtnWidth, 50, isSelected ? 0x3355aa : 0x1a1a28)
        .setInteractive({ useHandCursor: true })
        .setStrokeStyle(2, isSelected ? 0x88aaff : 0x333344)

      this.add.text(x, distBtnY - 8, district.name, {
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5)

      // Danger indicator
      const dangerColor = district.danger_level <= 2 ? '#22c55e' : (district.danger_level <= 4 ? '#f59e0b' : '#ef4444')
      this.add.text(x, distBtnY + 10, `⚡ ${district.danger_level}`, {
        fontSize: '9px',
        color: dangerColor
      }).setOrigin(0.5)

      btn.on('pointerover', () => {
        if (this.selectedDistrict !== district.id) btn.setFillStyle(0x252535)
      })
      btn.on('pointerout', () => {
        if (this.selectedDistrict !== district.id) btn.setFillStyle(0x1a1a28)
      })
      btn.on('pointerdown', () => {
        this.selectedDistrict = district.id
        try { audioManager.playClick() } catch (e) {}
        this.districtButtons.forEach((b, idx) => {
          const sel = starterDistricts[idx].id === district.id
          b.setFillStyle(sel ? 0x3355aa : 0x1a1a28)
          b.setStrokeStyle(2, sel ? 0x88aaff : 0x333344)
        })
      })

      this.districtButtons.push(btn)
    })

    // Error text
    this.errorText = this.add.text(width / 2, distBtnY + 40, '', {
      fontSize: '10px',
      color: '#ef4444'
    }).setOrigin(0.5)

    // === START BUTTON ===
    const startY = distBtnY + 70

    const startBtn = this.add.rectangle(width / 2, startY, width - 50, 52, 0xcc3333)
      .setInteractive({ useHandCursor: true })

    const startBtnText = this.add.text(width / 2, startY, '🔥  START LEGACY', {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    startBtn.on('pointerover', () => {
      startBtn.setFillStyle(0xdd4444)
      this.tweens.add({ targets: [startBtn, startBtnText], scaleX: 1.02, scaleY: 1.02, duration: 80 })
    })
    startBtn.on('pointerout', () => {
      startBtn.setFillStyle(0xcc3333)
      this.tweens.add({ targets: [startBtn, startBtnText], scaleX: 1, scaleY: 1, duration: 80 })
    })
    startBtn.on('pointerdown', () => this.startGame(this.usernameValue))

    // === GUEST BUTTON ===
    const guestY = startY + 55

    const guestBtn = this.add.rectangle(width / 2, guestY, width - 50, 40, 0x252535)
      .setInteractive({ useHandCursor: true })

    this.add.text(width / 2, guestY, '👤  PLAY AS GUEST', {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(0.5)

    guestBtn.on('pointerover', () => guestBtn.setFillStyle(0x353545))
    guestBtn.on('pointerout', () => guestBtn.setFillStyle(0x252535))
    guestBtn.on('pointerdown', () => this.startGame('Guest_' + Math.floor(Math.random() * 9999)))

    // Terms text
    this.add.text(width / 2, guestY + 35, 'By playing, you agree to hustle responsibly.', {
      fontSize: '8px',
      color: '#333344'
    }).setOrigin(0.5)
  }

  startGame(name) {
    const username = name.trim() || ''

    if (username.length < 2 && !username.startsWith('Guest_')) {
      this.errorText.setText('Name must be at least 2 characters')
      this.cameras.main.shake(200, 0.01)
      return
    }

    // Create player
    const player = getPlayerData()
    player.username = username
    player.current_district_id = this.selectedDistrict
    player.current_district = DISTRICTS.find(d => d.id === this.selectedDistrict)

    // Apply build bonuses
    switch (this.selectedBuild) {
      case 'hustler':
        player.stats = { ...player.stats, crime_bonus: 10 }
        break
      case 'entrepreneur':
        player.cash = 1000
        break
      case 'community_kid':
        player.stats = { ...player.stats, rep_bonus: 15 }
        break
    }

    savePlayerData(player)
    localStorage.setItem('username', username)

    try { audioManager.playClick() } catch (e) {}

    // Transition
    this.cameras.main.fadeOut(500, 0, 0, 0)
    this.time.delayedCall(500, () => {
      this.scene.start('PreloadScene')
    })
  }

  setupAudioUnlock() {
    if (this.audioUnlocked) return

    const unlockAudio = () => {
      if (this.audioUnlocked) return

      if (this.sound.context && this.sound.context.state === 'suspended') {
        this.sound.context.resume().then(() => {
          this.audioUnlocked = true
          audioManager.unlock()
          // Play menu BGM after unlocking
          this.playMenuMusic()
        }).catch(() => {})
      } else {
        this.audioUnlocked = true
        audioManager.unlock()
        // Play menu BGM after unlocking
        this.playMenuMusic()
      }

      this.input.off('pointerdown', unlockAudio)
      document.removeEventListener('touchstart', unlockAudio)
      document.removeEventListener('touchend', unlockAudio)
      document.removeEventListener('click', unlockAudio)
    }

    this.input.once('pointerdown', unlockAudio)
    document.addEventListener('touchstart', unlockAudio, { once: true })
    document.addEventListener('touchend', unlockAudio, { once: true })
    document.addEventListener('click', unlockAudio, { once: true })
  }

  playMenuMusic() {
    try {
      // Check if the audio is loaded
      if (this.cache.audio.exists(AUDIO_KEYS.BGM.MENU)) {
        audioManager.playBGM(AUDIO_KEYS.BGM.MENU)
        console.log('[BootScene] Playing menu music')
      } else {
        console.warn('[BootScene] Menu music not loaded yet')
      }
    } catch (e) {
      console.warn('[BootScene] Could not play menu music:', e)
    }
  }
}
