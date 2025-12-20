import Phaser from 'phaser'
import { authService } from '../../services/auth.service'
import { audioManager, AUDIO_KEYS } from '../managers/AudioManager'
import { audioPlaceholder } from '../managers/AudioPlaceholder'
import { VERSION, DEBUG } from '../config/Constants'
import { adminManager } from '../managers/AdminManager'

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' })
  }

  init(data) {
    this.needsAuth = data?.needsAuth || false
    this.needsCharacterCreation = data?.needsCharacterCreation || false
    this.needsEmailVerification = data?.needsEmailVerification || false
    this.needsForgotPassword = data?.needsForgotPassword || false
    this.needsResetPassword = data?.needsResetPassword || false
    this.verificationEmail = data?.verificationEmail || null
    this.verificationToken = data?.verificationToken || null
    this.resetToken = data?.resetToken || null
    this.errorMessage = data?.error || null
    this.successMessage = data?.success || null

    // Secret admin access - tap version 10 times
    this.versionTapCount = 0
    this.lastTapTime = 0
  }

  create() {
    const { width, height } = this.cameras.main

    // Initialize audio manager
    audioManager.setScene(this)

    // Background
    this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0)

    // Check if audio needs to be unlocked
    if (!audioManager.isAudioUnlocked()) {
      this.showAudioUnlockOverlay()
      return
    }

    // Play menu BGM if audio is already unlocked
    audioManager.playBGM(AUDIO_KEYS.BGM.MENU)

    // Continue with normal create
    this.createMainContent()
  }

  /**
   * Show overlay to unlock audio (required by browser autoplay policy)
   */
  showAudioUnlockOverlay() {
    const { width, height } = this.cameras.main

    // Dark overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x0a0a15, 0.95).setOrigin(0)

    // Title
    this.add.text(width / 2, height / 3, 'STREET LEGACY', {
      fontSize: '36px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5)

    this.add.text(width / 2, height / 3 + 45, 'Toronto Underground', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#888888'
    }).setOrigin(0.5)

    // Tap to start button
    const tapText = this.add.text(width / 2, height / 2 + 30, '🔊 TAP TO START', {
      fontSize: '24px',
      fontFamily: 'Arial Black, Arial',
      color: '#f59e0b'
    }).setOrigin(0.5)

    // Pulse animation
    this.tweens.add({
      targets: tapText,
      alpha: 0.5,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    // Sound note
    this.add.text(width / 2, height / 2 + 80, 'Enable sound for the best experience', {
      fontSize: '12px',
      color: '#666666'
    }).setOrigin(0.5)

    // Make entire screen clickable
    overlay.setInteractive({ useHandCursor: true })
    overlay.on('pointerdown', () => {
      // Unlock audio (both systems)
      audioManager.unlock()
      audioPlaceholder.resume()

      // Play menu BGM
      audioManager.playBGM(AUDIO_KEYS.BGM.MENU)

      // Clear and recreate scene content
      this.children.removeAll()
      this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0)
      this.createMainContent()
    })
  }

  /**
   * Create the main menu content (called after audio unlock)
   */
  createMainContent() {
    const { width, height } = this.cameras.main

    // Title - positioned for 400x700 viewport
    this.add.text(width / 2, 60, 'STREET LEGACY', {
      fontSize: '36px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5)

    this.add.text(width / 2, 100, 'Toronto Underground', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#888888'
    }).setOrigin(0.5)

    if (this.errorMessage) {
      this.add.text(width / 2, 135, this.errorMessage, {
        fontSize: '14px',
        color: '#ff4444'
      }).setOrigin(0.5)
    }

    if (this.successMessage) {
      this.add.text(width / 2, 135, this.successMessage, {
        fontSize: '14px',
        color: '#22c55e'
      }).setOrigin(0.5)
    }

    // Handle verification token from URL
    if (this.verificationToken) {
      this.handleEmailVerification(this.verificationToken)
    } else if (this.resetToken) {
      this.createResetPasswordUI()
    } else if (this.needsEmailVerification) {
      this.createVerificationUI()
    } else if (this.needsForgotPassword) {
      this.createForgotPasswordUI()
    } else if (this.needsResetPassword) {
      this.createResetPasswordUI()
    } else if (this.needsAuth) {
      this.createAuthUI()
    } else if (this.needsCharacterCreation) {
      this.createCharacterUI()
    } else {
      this.createMainMenu()
    }

    // Version display - tappable for secret admin access
    const versionY = DEBUG.ENABLED ? height - 25 : height - 15
    this.versionText = this.add.text(width / 2, versionY, `v${VERSION.STRING}`, {
      fontSize: '11px',
      color: '#4b5563'
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: false })
      .on('pointerdown', () => this.handleVersionTap())

    // Debug indicator
    if (DEBUG.ENABLED) {
      this.add.text(width / 2, height - 10, '[DEBUG MODE]', {
        fontSize: '10px',
        color: '#ef4444'
      }).setOrigin(0.5)
    }

    // Secret admin indicator (hidden by default)
    this.adminIndicator = this.add.text(width / 2, height - 10, '🛡️ ADMIN MODE', {
      fontSize: '10px',
      color: '#ef4444'
    }).setOrigin(0.5).setVisible(false)
  }

  /**
   * Handle version text tap for secret admin access
   * Tap 10 times within 5 seconds to toggle admin mode
   */
  handleVersionTap() {
    const now = Date.now()

    // Reset count if more than 2 seconds since last tap
    if (now - this.lastTapTime > 2000) {
      this.versionTapCount = 0
    }

    this.lastTapTime = now
    this.versionTapCount++

    // Visual feedback - subtle color change
    if (this.versionTapCount >= 5) {
      this.versionText.setColor('#8b5cf6')
    }

    // After 10 taps, toggle admin mode
    if (this.versionTapCount >= 10) {
      this.toggleSecretAdminMode()
      this.versionTapCount = 0
    }
  }

  /**
   * Toggle secret admin mode
   */
  toggleSecretAdminMode() {
    // Check if there's a stored secret admin flag
    const isSecretAdmin = localStorage.getItem('secret_admin_mode') === 'true'

    if (isSecretAdmin) {
      // Disable secret admin mode
      localStorage.removeItem('secret_admin_mode')
      adminManager.isAdmin = false
      this.adminIndicator.setVisible(false)
      this.versionText.setColor('#4b5563')

      // Show confirmation
      this.showTempMessage('Admin mode disabled', '#888888')
    } else {
      // Enable secret admin mode
      localStorage.setItem('secret_admin_mode', 'true')
      adminManager.isAdmin = true
      this.adminIndicator.setVisible(true)
      this.versionText.setColor('#ef4444')

      // Show confirmation
      this.showTempMessage('🛡️ Admin mode enabled!', '#ef4444')
    }

    audioManager.playClick()
  }

  /**
   * Show a temporary message
   */
  showTempMessage(message, color) {
    const { width, height } = this.cameras.main

    const msg = this.add.text(width / 2, height / 2, message, {
      fontSize: '18px',
      color: color,
      backgroundColor: '#000000',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setDepth(100)

    // Fade out and destroy
    this.tweens.add({
      targets: msg,
      alpha: 0,
      y: height / 2 - 50,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => msg.destroy()
    })
  }

  createAuthUI() {
    const { width } = this.cameras.main
    const centerX = width / 2
    // Layout for 400x700 viewport - form starts below title area
    const formStartY = 180

    // Email input - direct input element, properly centered
    this.emailInput = this.add.dom(centerX, formStartY).createFromHTML(`
      <input type="email" id="email" placeholder="Email"
        style="width: 220px; padding: 10px; font-size: 14px; border: none; border-radius: 6px; background: #2a2a4a; color: #ffffff; text-align: center;">
    `).setOrigin(0.5)

    // Password input - direct input element, properly centered
    this.passwordInput = this.add.dom(centerX, formStartY + 50).createFromHTML(`
      <input type="password" id="password" placeholder="Password"
        style="width: 220px; padding: 10px; font-size: 14px; border: none; border-radius: 6px; background: #2a2a4a; color: #ffffff; text-align: center;">
    `).setOrigin(0.5)

    // Sign In button
    this.createButton(centerX, formStartY + 120, 'Sign In', async () => {
      const email = this.emailInput.getChildByID('email').value
      const password = this.passwordInput.getChildByID('password').value
      if (email && password) {
        await this.handleSignIn(email, password)
      } else {
        this.showError('Please enter email and password')
      }
    })

    // Sign Up button - wrap callback to handle async properly
    this.createButton(centerX, formStartY + 180, 'Create Account', () => {
      const email = this.emailInput.getChildByID('email').value
      const password = this.passwordInput.getChildByID('password').value
      console.log('Create Account clicked - Email:', email, 'Password length:', password?.length)
      if (email && password) {
        this.handleSignUp(email, password).catch(err => {
          console.error('SignUp error:', err)
          this.showError(err.message)
        })
      } else {
        this.showError('Please enter email and password')
      }
    }, 0x22c55e)

    // Guest mode button
    this.createButton(centerX, formStartY + 240, 'Play as Guest', () => {
      this.handleGuestSignIn().catch(err => {
        console.error('Guest sign in error:', err)
        this.showError(err.message)
      })
    }, 0x6b7280)

    // Forgot password link
    this.add.text(centerX, formStartY + 290, 'Forgot Password?', {
      fontSize: '12px',
      color: '#6b7280'
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', function() { this.setColor('#3b82f6') })
      .on('pointerout', function() { this.setColor('#6b7280') })
      .on('pointerdown', () => {
        audioManager.playClick()
        this.scene.restart({ needsForgotPassword: true })
      })
  }

  createForgotPasswordUI() {
    const { width } = this.cameras.main
    const centerX = width / 2
    const formStartY = 160

    // Icon
    this.add.text(centerX, formStartY, '🔐', {
      fontSize: '48px'
    }).setOrigin(0.5)

    this.add.text(centerX, formStartY + 60, 'Reset Password', {
      fontSize: '22px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5)

    this.add.text(centerX, formStartY + 95, 'Enter your email address to receive\na password reset link.', {
      fontSize: '12px',
      color: '#aaaaaa',
      align: 'center'
    }).setOrigin(0.5)

    // Email input - direct input element, properly centered
    this.resetEmailInput = this.add.dom(centerX, formStartY + 145).createFromHTML(`
      <input type="email" id="reset-email" placeholder="Email address"
        style="width: 220px; padding: 10px; font-size: 14px; border: none; border-radius: 6px; background: #2a2a4a; color: #ffffff; text-align: center;">
    `).setOrigin(0.5)

    // Send reset link button
    this.createButton(centerX, formStartY + 210, 'Send Reset Link', async () => {
      const email = this.resetEmailInput.getChildByID('reset-email').value
      if (email) {
        await this.handleForgotPassword(email)
      } else {
        this.showError('Please enter your email address')
      }
    }, 0xff6600)

    // Back to login
    this.createButton(centerX, formStartY + 270, 'Back to Login', () => {
      this.scene.restart({ needsAuth: true })
    }, 0x6b7280)
  }

  createResetPasswordUI() {
    const { width } = this.cameras.main
    const centerX = width / 2
    const formStartY = 140

    // Icon
    this.add.text(centerX, formStartY, '🔑', {
      fontSize: '48px'
    }).setOrigin(0.5)

    this.add.text(centerX, formStartY + 60, 'Create New Password', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5)

    this.add.text(centerX, formStartY + 90, 'Password must be 8+ characters with\nuppercase, lowercase, and number.', {
      fontSize: '11px',
      color: '#aaaaaa',
      align: 'center'
    }).setOrigin(0.5)

    // New password input - direct input element, properly centered
    this.newPasswordInput = this.add.dom(centerX, formStartY + 140).createFromHTML(`
      <input type="password" id="new-password" placeholder="New password"
        style="width: 220px; padding: 10px; font-size: 14px; border: none; border-radius: 6px; background: #2a2a4a; color: #ffffff; text-align: center;">
    `).setOrigin(0.5)

    // Confirm password input - direct input element, properly centered
    this.confirmPasswordInput = this.add.dom(centerX, formStartY + 190).createFromHTML(`
      <input type="password" id="confirm-password" placeholder="Confirm password"
        style="width: 220px; padding: 10px; font-size: 14px; border: none; border-radius: 6px; background: #2a2a4a; color: #ffffff; text-align: center;">
    `).setOrigin(0.5)

    // Reset password button
    this.createButton(centerX, formStartY + 260, 'Reset Password', async () => {
      const newPassword = this.newPasswordInput.getChildByID('new-password').value
      const confirmPassword = this.confirmPasswordInput.getChildByID('confirm-password').value

      if (!newPassword || !confirmPassword) {
        this.showError('Please fill in both password fields')
        return
      }

      if (newPassword !== confirmPassword) {
        this.showError('Passwords do not match')
        return
      }

      if (newPassword.length < 8) {
        this.showError('Password must be at least 8 characters')
        return
      }

      await this.handleResetPassword(newPassword)
    }, 0x22c55e)

    // Back to login
    this.createButton(centerX, formStartY + 320, 'Back to Login', () => {
      this.scene.restart({ needsAuth: true })
    }, 0x6b7280)
  }

  async handleForgotPassword(email) {
    try {
      this.showLoading('Sending reset link...')
      await authService.forgotPassword(email)
      this.hideLoading()

      // Show success screen
      this.scene.restart({
        needsAuth: true,
        success: 'If an account exists, a reset link has been sent to your email.'
      })
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  async handleResetPassword(newPassword) {
    if (!this.resetToken) {
      this.showError('Invalid reset link')
      return
    }

    try {
      this.showLoading('Resetting password...')
      await authService.resetPassword(this.resetToken, newPassword)
      this.hideLoading()

      // Auto-login happened, go to game
      if (authService.hasPlayer) {
        this.scene.start('PreloadScene')
      } else {
        this.scene.restart({ needsCharacterCreation: true })
      }
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  createCharacterUI() {
    const { width } = this.cameras.main
    const centerX = width / 2
    // Layout for 400x700 viewport
    const startY = 140

    this.add.text(centerX, startY, 'Create Your Character', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5)

    // Username input - direct input element, properly centered
    this.usernameInput = this.add.dom(centerX, startY + 45).createFromHTML(`
      <input type="text" id="username" placeholder="Username (3-20 characters)"
        style="width: 220px; padding: 10px; font-size: 14px; border: none; border-radius: 6px; background: #2a2a4a; color: #ffffff; text-align: center;">
    `).setOrigin(0.5)

    // Starter Build selection
    this.add.text(centerX, startY + 95, 'Choose Your Path:', {
      fontSize: '14px',
      color: '#888888'
    }).setOrigin(0.5)

    const builds = [
      { id: 'hustler', name: 'Hustler', desc: '+Crime' },
      { id: 'entrepreneur', name: 'Entrepreneur', desc: '+Cash' },
      { id: 'community_kid', name: 'Community', desc: '+Rep' }
    ]
    this.selectedBuild = 'hustler'
    this.buildButtons = []

    builds.forEach((build, index) => {
      const x = centerX - 90 + (index * 90)
      const y = startY + 130

      const btn = this.add.rectangle(x, y, 80, 35, build.id === this.selectedBuild ? 0x3b82f6 : 0x4a4a6a)
        .setInteractive({ useHandCursor: true })

      this.add.text(x, y - 5, build.name, {
        fontSize: '10px',
        color: '#ffffff'
      }).setOrigin(0.5)

      this.add.text(x, y + 10, build.desc, {
        fontSize: '8px',
        color: '#aaaaaa'
      }).setOrigin(0.5)

      btn.on('pointerdown', () => {
        this.selectedBuild = build.id
        this.buildButtons.forEach((b, i) => {
          b.setFillStyle(builds[i].id === build.id ? 0x3b82f6 : 0x4a4a6a)
        })
      })

      this.buildButtons.push(btn)
    })

    // District selection
    this.add.text(centerX, startY + 175, 'Starting District:', {
      fontSize: '14px',
      color: '#888888'
    }).setOrigin(0.5)

    // Default districts - will be overwritten when loaded from DB
    // Using null as default since old schema uses UUID ids
    this.districts = [
      { id: null, name: 'Default' }
    ]
    this.selectedDistrict = null
    this.districtButtons = []

    this.loadStarterDistricts()

    // Create district buttons
    this.createDistrictButtons(startY + 205)

    // Create character button
    this.createButton(centerX, startY + 270, 'Start Your Legacy', async () => {
      const username = this.usernameInput.getChildByID('username').value
      if (!username || username.length < 3 || username.length > 20) {
        this.showError('Username must be 3-20 characters')
        return
      }
      await this.handleCreateCharacter(username)
    }, 0x22c55e)
  }

  createDistrictButtons(startY) {
    const { width } = this.cameras.main
    const centerX = width / 2

    this.districts.forEach((district, index) => {
      const x = centerX - 80 + (index * 80)

      const btn = this.add.text(x, startY, district.name.substring(0, 8), {
        fontSize: '12px',
        color: district.id === this.selectedDistrict ? '#22c55e' : '#ffffff',
        backgroundColor: '#333333',
        padding: { x: 8, y: 6 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })

      btn.on('pointerdown', () => {
        this.selectedDistrict = district.id
        this.districtButtons.forEach((b, i) => {
          b.setColor(this.districts[i].id === district.id ? '#22c55e' : '#ffffff')
        })
      })

      this.districtButtons.push(btn)
    })
  }

  async loadStarterDistricts() {
    try {
      const districts = await authService.getStarterDistricts()
      if (districts && districts.length > 0) {
        this.districts = districts
        this.selectedDistrict = districts[0].id
        // Update button text if already created
        this.districtButtons.forEach((btn, i) => {
          if (this.districts[i]) {
            btn.setText(this.districts[i].name.substring(0, 8))
          }
        })
      }
    } catch (error) {
      console.warn('Could not load starter districts:', error)
    }
  }

  createMainMenu() {
    const { width } = this.cameras.main
    const centerX = width / 2
    // Layout for 400x700 viewport
    const menuY = 280

    this.createButton(centerX, menuY, 'Continue Game', () => {
      this.scene.start('PreloadScene')
    })

    this.createButton(centerX, menuY + 60, 'Sign Out', async () => {
      await authService.signOut()
      this.scene.restart({ needsAuth: true })
    }, 0x6b7280)
  }

  createVerificationUI() {
    const { width } = this.cameras.main
    const centerX = width / 2
    const formStartY = 160

    // Verification icon
    this.add.text(centerX, formStartY, '📧', {
      fontSize: '48px'
    }).setOrigin(0.5)

    this.add.text(centerX, formStartY + 60, 'Verify Your Email', {
      fontSize: '22px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5)

    const email = this.verificationEmail || authService.pendingVerificationEmail || 'your email'
    this.add.text(centerX, formStartY + 95, `We sent a verification link to:`, {
      fontSize: '12px',
      color: '#888888'
    }).setOrigin(0.5)

    this.add.text(centerX, formStartY + 115, email, {
      fontSize: '14px',
      color: '#22c55e'
    }).setOrigin(0.5)

    this.add.text(centerX, formStartY + 150, 'Click the link in the email to activate\nyour account and start playing.', {
      fontSize: '12px',
      color: '#aaaaaa',
      align: 'center'
    }).setOrigin(0.5)

    // Resend button
    this.createButton(centerX, formStartY + 220, 'Resend Email', async () => {
      await this.handleResendVerification()
    }, 0x3b82f6)

    // Back to login
    this.createButton(centerX, formStartY + 280, 'Back to Login', () => {
      this.scene.restart({ needsAuth: true })
    }, 0x6b7280)
  }

  async handleEmailVerification(token) {
    const { width } = this.cameras.main
    const centerX = width / 2
    const centerY = 300

    // Show verifying message
    this.add.text(centerX, centerY - 50, '⏳', {
      fontSize: '48px'
    }).setOrigin(0.5)

    const statusText = this.add.text(centerX, centerY + 20, 'Verifying your email...', {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5)

    try {
      const result = await authService.verifyEmail(token)

      // Success - redirect to game
      statusText.setText('Email verified!')
      this.add.text(centerX, centerY + 60, 'Welcome to Street Legacy!', {
        fontSize: '14px',
        color: '#22c55e'
      }).setOrigin(0.5)

      // Auto-navigate to game after delay
      this.time.delayedCall(2000, () => {
        if (authService.hasPlayer) {
          this.scene.start('PreloadScene')
        } else {
          this.scene.restart({ needsCharacterCreation: true })
        }
      })
    } catch (error) {
      statusText.setText('Verification failed')
      this.add.text(centerX, centerY + 60, error.message, {
        fontSize: '14px',
        color: '#ff4444',
        wordWrap: { width: 300 }
      }).setOrigin(0.5)

      // Show retry options
      this.createButton(centerX, centerY + 140, 'Back to Login', () => {
        this.scene.restart({ needsAuth: true })
      }, 0x6b7280)
    }
  }

  async handleResendVerification() {
    try {
      this.showLoading('Sending verification email...')
      await authService.resendVerificationEmail()
      this.hideLoading()
      this.showSuccess('Verification email sent!')
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  createButton(x, y, text, callback, color = 0x4a4a6a) {
    const button = this.add.rectangle(x, y, 200, 44, color, 1)
      .setDepth(10) // Ensure button is above DOM elements
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        button.setFillStyle(Phaser.Display.Color.ValueToColor(color).lighten(20).color)
        audioManager.playHover()
      })
      .on('pointerout', () => button.setFillStyle(color))
      .on('pointerdown', () => {
        console.log('Button clicked:', text)
        audioManager.playClick()
        callback()
      })

    this.add.text(x, y, text, {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5).setDepth(11)

    return button
  }

  async handleSignIn(email, password) {
    try {
      this.showLoading('Signing in...')
      await authService.signIn(email, password)

      if (authService.hasPlayer) {
        this.scene.start('PreloadScene')
      } else {
        this.scene.restart({ needsCharacterCreation: true })
      }
    } catch (error) {
      this.hideLoading()

      // Check if email verification is needed
      if (error.requiresVerification) {
        this.scene.restart({
          needsEmailVerification: true,
          verificationEmail: error.email
        })
        return
      }

      this.showError(error.message)
    }
  }

  async handleSignUp(email, password) {
    console.log('handleSignUp called with email:', email)
    try {
      this.showLoading('Creating account...')
      console.log('Calling authService.signUp...')
      const result = await authService.signUp(email, password)
      console.log('signUp result:', result)
      this.hideLoading()

      // Check if email verification is required
      if (result.requiresVerification) {
        console.log('Email verification required')
        this.scene.restart({
          needsEmailVerification: true,
          verificationEmail: result.email
        })
        return
      }

      // Check if player was auto-created by trigger (old schema)
      if (authService.hasPlayer) {
        console.log('Player exists, going to PreloadScene')
        this.scene.start('PreloadScene')
      } else {
        console.log('No player, going to character creation')
        this.scene.restart({ needsCharacterCreation: true })
      }
    } catch (error) {
      console.error('handleSignUp error:', error)
      this.hideLoading()
      this.showError(error.message)
    }
  }

  async handleGuestSignIn() {
    try {
      this.showLoading('Starting guest session...')
      await authService.signInAnonymously()

      // Try to load existing player profile
      try {
        await authService.loadPlayerProfile()
      } catch (e) {
        // No player yet
      }

      this.hideLoading()

      // Check if player exists (old schema auto-creates)
      if (authService.hasPlayer) {
        this.scene.start('PreloadScene')
      } else {
        this.scene.restart({ needsCharacterCreation: true })
      }
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  async handleCreateCharacter(username) {
    try {
      // Check username availability
      this.showLoading('Checking username...')
      const available = await authService.checkUsername(username)
      if (!available) {
        this.hideLoading()
        this.showError('Username is already taken')
        return
      }

      this.showLoading('Creating character...')
      await authService.createPlayer(username, this.selectedDistrict, this.selectedBuild)
      this.hideLoading()
      this.scene.start('PreloadScene')
    } catch (error) {
      this.hideLoading()
      this.showError(error.message)
    }
  }

  showLoading(message) {
    const { width, height } = this.cameras.main

    if (this.loadingOverlay) this.loadingOverlay.destroy()
    if (this.loadingText) this.loadingText.destroy()

    this.loadingOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    this.loadingText = this.add.text(width / 2, height / 2, message, {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0.5)
  }

  hideLoading() {
    if (this.loadingOverlay) this.loadingOverlay.destroy()
    if (this.loadingText) this.loadingText.destroy()
  }

  showError(message) {
    const { width } = this.cameras.main

    if (this.errorText) this.errorText.destroy()

    this.errorText = this.add.text(width / 2, 155, message, {
      fontSize: '13px',
      color: '#ff4444'
    }).setOrigin(0.5)

    this.time.delayedCall(4000, () => {
      if (this.errorText) this.errorText.destroy()
    })
  }

  showSuccess(message) {
    const { width } = this.cameras.main

    if (this.successText) this.successText.destroy()

    this.successText = this.add.text(width / 2, 155, message, {
      fontSize: '13px',
      color: '#22c55e'
    }).setOrigin(0.5)

    this.time.delayedCall(4000, () => {
      if (this.successText) this.successText.destroy()
    })
  }
}
