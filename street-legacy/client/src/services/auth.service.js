// Street Legacy - Authentication Service
// Direct Supabase authentication - no Express API needed

import { supabase } from './supabase.js'

class AuthService {
  constructor() {
    this.currentUser = null
    this.currentPlayer = null
    this.authListeners = new Set()
  }

  // Initialize auth state
  async init() {
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        this.currentUser = session.user
        await this.loadPlayerProfile()
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        this.currentUser = session?.user || null

        if (session?.user) {
          await this.loadPlayerProfile()
        } else {
          this.currentPlayer = null
        }

        this.notifyListeners(event)
      })
    } catch (e) {
      console.error('Failed to initialize auth:', e)
    }
  }

  // Subscribe to auth changes
  onAuthChange(callback) {
    this.authListeners.add(callback)
    return () => this.authListeners.delete(callback)
  }

  // Notify all listeners
  notifyListeners(event) {
    this.authListeners.forEach(callback => {
      try {
        callback(event, { user: this.currentUser }, this.currentPlayer)
      } catch (err) {
        console.error('Auth listener error:', err)
      }
    })
  }

  // Get current session
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }

  // Get current user
  async getUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }

  // ==========================================================================
  // AUTHENTICATION
  // ==========================================================================

  // Sign in with email and password
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        const err = new Error('Email not verified. Please check your email for a verification link.')
        err.requiresVerification = true
        err.email = email
        throw err
      }
      throw new Error(error.message)
    }

    this.currentUser = data.user
    await this.loadPlayerProfile()

    return { user: this.currentUser }
  }

  // Sign up with email and password
  async signUp(email, password, username = null) {
    const finalUsername = username || email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: finalUsername
        }
      }
    })

    if (error) {
      throw new Error(error.message)
    }

    // Check if email confirmation is required
    if (data.user && !data.session) {
      return {
        requiresVerification: true,
        email,
        message: 'Please check your email to verify your account.'
      }
    }

    this.currentUser = data.user

    // Create player profile
    if (this.currentUser) {
      await this.createPlayerProfile(finalUsername)
    }

    return { user: this.currentUser }
  }

  // Sign in anonymously (guest mode)
  async signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously()

    if (error) {
      throw new Error(error.message)
    }

    this.currentUser = data.user
    await this.createPlayerProfile('Guest_' + Math.random().toString(36).substring(2, 8))

    return { user: this.currentUser }
  }

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Sign out error:', error)
    }

    this.currentUser = null
    this.currentPlayer = null
    this.notifyListeners('SIGNED_OUT')
  }

  // ==========================================================================
  // PASSWORD RESET
  // ==========================================================================

  // Request password reset email
  async forgotPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })

    if (error) {
      throw new Error(error.message)
    }

    return { message: 'Password reset email sent' }
  }

  // Reset password with new password (called after clicking email link)
  async resetPassword(newPassword) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      throw new Error(error.message)
    }

    return { message: 'Password updated successfully' }
  }

  // ==========================================================================
  // PLAYER PROFILE
  // ==========================================================================

  // Create player profile in database
  async createPlayerProfile(username) {
    if (!this.currentUser) return null

    const { data, error } = await supabase
      .from('players')
      .upsert({
        id: this.currentUser.id,
        username: username,
        cash: 500,
        bank: 0,
        level: 1,
        xp: 0,
        health: 100,
        energy: 100,
        heat: 0,
        respect: 0,
        current_district_id: 'parkdale',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating player:', error)
      return null
    }

    this.currentPlayer = data
    return data
  }

  // Load current player profile
  async loadPlayerProfile() {
    if (!this.currentUser) return null

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', this.currentUser.id)
      .single()

    if (error) {
      // Player doesn't exist yet, create one
      if (error.code === 'PGRST116') {
        const username = this.currentUser.user_metadata?.username ||
                        this.currentUser.email?.split('@')[0] ||
                        'Player'
        return await this.createPlayerProfile(username)
      }
      console.error('Error loading player:', error)
      return null
    }

    this.currentPlayer = data
    return data
  }

  // Update player data
  async updatePlayer(updates) {
    if (!this.currentUser) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('players')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', this.currentUser.id)
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    this.currentPlayer = data
    return data
  }

  // ==========================================================================
  // CONVENIENCE GETTERS
  // ==========================================================================

  get isAuthenticated() {
    return !!this.currentUser
  }

  get hasPlayer() {
    return !!this.currentPlayer
  }

  get userId() {
    return this.currentUser?.id
  }

  get playerId() {
    return this.currentPlayer?.id
  }

  get playerName() {
    return this.currentPlayer?.username
  }

  get isAdmin() {
    return this.currentPlayer?.is_admin === true || this.currentPlayer?.is_master === true
  }
}

// Export singleton instance
export const authService = new AuthService()

// Initialize on load
authService.init()

export default authService
