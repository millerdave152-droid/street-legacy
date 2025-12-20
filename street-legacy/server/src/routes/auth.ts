import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db/connection.js';
import { authMiddleware, getPlayerById, AuthRequest, JWT_SECRET } from '../middleware/auth.js';
import { validate } from '../validation/validate.middleware.js';
import { loginSchema, registerSchema } from '../validation/schemas/auth.schema.js';
import { z } from 'zod';
import { generateVerificationToken, sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from '../utils/email.js';
import { authAudit, securityAudit, countFailedLogins, getClientIp } from '../utils/auditLog.js';

const router = Router();

// Enhanced registration schema with stronger password requirements
const enhancedRegisterSchema = z.object({
  body: z.object({
    username: z.string()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be at most 20 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string()
      .email('Invalid email address')
      .max(255, 'Email too long')
      .toLowerCase(),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password too long')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
  })
});

// Login schema - less strict since we just need to check credentials
const enhancedLoginSchema = z.object({
  body: z.object({
    username: z.string().min(1, 'Username is required').max(255),
    password: z.string().min(1, 'Password is required').max(128)
  })
});

// Check if email verification is required (disabled by default until email_verified column exists)
const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

// POST /api/auth/register
// Validation middleware ensures username, email, and password meet requirements
router.post('/register', validate(enhancedRegisterSchema), async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert player with minimal required columns - let DB defaults handle the rest
    // Note: email_verified column may not exist in older schemas, so we skip it
    const result = await pool.query(
      `INSERT INTO players (username, email, password_hash, created_at, last_seen)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id, username, email`,
      [username, email, passwordHash]
    );

    const player = result.rows[0];

    // If email verification required, create token and send email
    if (REQUIRE_EMAIL_VERIFICATION) {
      const verificationToken = generateVerificationToken();

      // Store verification token
      await pool.query(
        `INSERT INTO email_verification_tokens (player_id, token, email, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')`,
        [player.id, verificationToken, email]
      );

      // Send verification email
      const emailResult = await sendVerificationEmail(email, username, verificationToken);

      if (!emailResult.success) {
        console.error('[Auth] Failed to send verification email:', emailResult.error);
        // Don't fail registration, but log the issue
      }

      res.status(201).json({
        success: true,
        data: {
          requiresVerification: true,
          message: 'Registration successful. Please check your email to verify your account.',
          player: { id: player.id, username: player.username, email: player.email }
        }
      });
      return;
    }

    // If no verification required, return token immediately
    const token = jwt.sign(
      { id: player.id, username: player.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Audit log: registration
    await authAudit.register(req, player.id, player.username, email);

    res.status(201).json({
      success: true,
      data: { token, player: { id: player.id, username: player.username, email: player.email } }
    });
  } catch (error: any) {
    console.error('Registration error details:', {
      code: error.code,
      message: error.message,
      detail: error.detail,
      constraint: error.constraint,
      column: error.column,
      table: error.table
    });
    if (error.code === '23505') {
      // Unique violation
      const field = error.constraint?.includes('email') ? 'Email' : 'Username';
      res.status(400).json({ success: false, error: `${field} already exists` });
      return;
    }
    res.status(500).json({ success: false, error: 'Registration failed', details: error.message });
  }
});

// Account lockout configuration
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// POST /api/auth/login
// Validation middleware ensures username and password are provided
router.post('/login', validate(enhancedLoginSchema), async (req, res) => {
  const { username, password } = req.body;

  try {
    // Get player by username (could also be email) - simplified query for older schemas
    const result = await pool.query(
      `SELECT id, username, email, password_hash
       FROM players WHERE username = $1 OR email = $1`,
      [username]
    );

    const player = result.rows[0];

    if (!player) {
      // Audit log: failed login (user not found)
      try {
        await authAudit.loginFailed(req, username, 'User not found');
      } catch (e) {
        // Ignore audit errors
      }

      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, player.password_hash);
    if (!passwordValid) {
      // Audit log: failed login (wrong password)
      try {
        await authAudit.loginFailed(req, username, 'Invalid password');
      } catch (e) {
        // Ignore audit errors
      }

      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
      return;
    }

    // Update last seen
    try {
      await pool.query(`UPDATE players SET last_seen = NOW() WHERE id = $1`, [player.id]);
    } catch (e) {
      // Ignore if last_seen column doesn't exist
    }

    // Generate token using exported JWT_SECRET
    const token = jwt.sign(
      { id: player.id, username: player.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Audit log: successful login
    await authAudit.loginSuccess(req, player.id, player.username);

    res.json({
      success: true,
      data: { token, player: { id: player.id, username: player.username, email: player.email } }
    });
  } catch (error: any) {
    console.error('Login error details:', {
      code: error.code,
      message: error.message,
      detail: error.detail,
      column: error.column
    });
    res.status(500).json({ success: false, error: 'Login failed', details: error.message });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const player = await getPlayerById(req.player!.id);

    if (!player) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    res.json({ success: true, data: player });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, error: 'Failed to get player' });
  }
});

// POST /api/auth/verify-email
// Verifies email using the token sent to user's email
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ success: false, error: 'Verification token is required' });
    return;
  }

  try {
    // Use the database function to verify the token
    const result = await pool.query(
      `SELECT * FROM verify_email_token($1)`,
      [token]
    );

    const verification = result.rows[0];

    if (!verification.success) {
      res.status(400).json({ success: false, error: verification.error_message });
      return;
    }

    // Send welcome email
    const playerResult = await pool.query(
      `SELECT username, email FROM players WHERE id = $1`,
      [verification.player_id]
    );

    if (playerResult.rows[0]) {
      const player = playerResult.rows[0];
      await sendWelcomeEmail(player.email, player.username);
    }

    // Generate token for auto-login after verification
    const authToken = jwt.sign(
      { id: verification.player_id, username: playerResult.rows[0]?.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Audit log: email verified
    await authAudit.emailVerified(req, verification.player_id);

    res.json({
      success: true,
      data: {
        message: 'Email verified successfully. Welcome to Street Legacy!',
        token: authToken,
        player: {
          id: verification.player_id,
          email: verification.email
        }
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// POST /api/auth/resend-verification
// Resends verification email to user
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ success: false, error: 'Email is required' });
    return;
  }

  try {
    // Find the player by email
    const playerResult = await pool.query(
      `SELECT id, username, email, email_verified FROM players WHERE email = $1`,
      [email.toLowerCase()]
    );

    const player = playerResult.rows[0];

    if (!player) {
      // Don't reveal if email exists or not for security
      res.json({
        success: true,
        data: { message: 'If an account exists with this email, a verification link has been sent.' }
      });
      return;
    }

    if (player.email_verified) {
      res.status(400).json({ success: false, error: 'Email is already verified' });
      return;
    }

    // Check for recent verification token (prevent spam)
    const recentToken = await pool.query(
      `SELECT id FROM email_verification_tokens
       WHERE player_id = $1 AND created_at > NOW() - INTERVAL '5 minutes' AND used_at IS NULL`,
      [player.id]
    );

    if (recentToken.rows.length > 0) {
      res.status(429).json({
        success: false,
        error: 'Please wait 5 minutes before requesting another verification email'
      });
      return;
    }

    // Invalidate old tokens
    await pool.query(
      `UPDATE email_verification_tokens SET used_at = NOW() WHERE player_id = $1 AND used_at IS NULL`,
      [player.id]
    );

    // Create new verification token
    const verificationToken = generateVerificationToken();

    await pool.query(
      `INSERT INTO email_verification_tokens (player_id, token, email, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')`,
      [player.id, verificationToken, player.email]
    );

    // Send verification email
    const emailResult = await sendVerificationEmail(player.email, player.username, verificationToken);

    if (!emailResult.success) {
      console.error('[Auth] Failed to resend verification email:', emailResult.error);
      res.status(500).json({ success: false, error: 'Failed to send verification email' });
      return;
    }

    res.json({
      success: true,
      data: { message: 'Verification email has been sent. Please check your inbox.' }
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ success: false, error: 'Failed to resend verification email' });
  }
});

// =============================================================================
// PASSWORD RESET ENDPOINTS
// =============================================================================

// POST /api/auth/forgot-password
// Initiates password reset by sending email with reset link
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ success: false, error: 'Email is required' });
    return;
  }

  try {
    // Find player by email
    const playerResult = await pool.query(
      `SELECT id, username, email FROM players WHERE email = $1`,
      [email.toLowerCase()]
    );

    const player = playerResult.rows[0];

    // Always return success to prevent email enumeration attacks
    if (!player) {
      res.json({
        success: true,
        data: { message: 'If an account exists with this email, a password reset link has been sent.' }
      });
      return;
    }

    // Check for recent reset token (prevent spam - 5 minute cooldown)
    const recentToken = await pool.query(
      `SELECT id FROM password_reset_tokens
       WHERE player_id = $1 AND created_at > NOW() - INTERVAL '5 minutes' AND used_at IS NULL`,
      [player.id]
    );

    if (recentToken.rows.length > 0) {
      res.status(429).json({
        success: false,
        error: 'Please wait 5 minutes before requesting another password reset'
      });
      return;
    }

    // Invalidate any existing unused tokens for this player
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE player_id = $1 AND used_at IS NULL`,
      [player.id]
    );

    // Create new reset token
    const resetToken = generateVerificationToken();

    // Get IP and user agent for security logging
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await pool.query(
      `INSERT INTO password_reset_tokens (player_id, token, email, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour', $4, $5)`,
      [player.id, resetToken, player.email, ipAddress, userAgent]
    );

    // Send password reset email
    const emailResult = await sendPasswordResetEmail(player.email, player.username, resetToken);

    if (!emailResult.success) {
      console.error('[Auth] Failed to send password reset email:', emailResult.error);
      // Don't expose email sending failures to prevent enumeration
    }

    // Audit log: password reset requested
    await authAudit.passwordResetRequested(req, email);

    res.json({
      success: true,
      data: { message: 'If an account exists with this email, a password reset link has been sent.' }
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Failed to process password reset request' });
  }
});

// POST /api/auth/validate-reset-token
// Validates a password reset token without consuming it
router.post('/validate-reset-token', async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ success: false, error: 'Reset token is required' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT * FROM validate_password_reset_token($1)`,
      [token]
    );

    const validation = result.rows[0];

    if (!validation.is_valid) {
      res.status(400).json({ success: false, error: validation.error_message });
      return;
    }

    res.json({
      success: true,
      data: { valid: true, email: validation.email }
    });
  } catch (error) {
    console.error('Validate reset token error:', error);
    res.status(500).json({ success: false, error: 'Failed to validate reset token' });
  }
});

// Password reset schema
const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password too long')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
  })
});

// POST /api/auth/reset-password
// Resets password using a valid token
router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
  const { token, password } = req.body;

  try {
    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Execute password reset
    const result = await pool.query(
      `SELECT * FROM execute_password_reset($1, $2)`,
      [token, passwordHash]
    );

    const resetResult = result.rows[0];

    if (!resetResult.success) {
      res.status(400).json({ success: false, error: resetResult.error_message });
      return;
    }

    // Get player info for response
    const playerResult = await pool.query(
      `SELECT id, username, email FROM players WHERE id = $1`,
      [resetResult.player_id]
    );

    const player = playerResult.rows[0];

    // Generate new auth token for auto-login
    const authToken = jwt.sign(
      { id: player.id, username: player.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Audit log: password reset completed
    await authAudit.passwordResetCompleted(req, player.id);

    res.json({
      success: true,
      data: {
        message: 'Password has been reset successfully',
        token: authToken,
        player: { id: player.id, username: player.username, email: player.email }
      }
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

// =============================================================================
// SESSION MANAGEMENT ENDPOINTS
// =============================================================================

// POST /api/auth/logout
// Logs out the current session (client should also clear local storage)
router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Update last_seen timestamp
    await pool.query(
      `UPDATE players SET last_seen = NOW() WHERE id = $1`,
      [req.player!.id]
    );

    // Audit log: logout
    await authAudit.logout(req, req.player!.id);

    res.json({
      success: true,
      data: { message: 'Logged out successfully' }
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

// POST /api/auth/logout-all
// Invalidates all sessions for the current user (logout from all devices)
router.post('/logout-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Set the invalidation timestamp - all tokens issued before this are now invalid
    await pool.query(
      `UPDATE players SET sessions_invalidated_at = NOW() WHERE id = $1`,
      [req.player!.id]
    );

    // Also revoke all session records if using session tracking
    const revokeResult = await pool.query(
      `UPDATE player_sessions
       SET revoked_at = NOW(), revoked_reason = 'logout_all'
       WHERE player_id = $1 AND revoked_at IS NULL`,
      [req.player!.id]
    );

    // Audit log: logout all
    await authAudit.logoutAll(req, req.player!.id, revokeResult.rowCount || 0);

    res.json({
      success: true,
      data: { message: 'All sessions have been invalidated. Please log in again on all devices.' }
    });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ success: false, error: 'Failed to invalidate sessions' });
  }
});

// GET /api/auth/sessions
// Get list of active sessions for the current user
router.get('/sessions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, device_info, ip_address, created_at, last_active_at
       FROM player_sessions
       WHERE player_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY last_active_at DESC
       LIMIT 20`,
      [req.player!.id]
    );

    // Mark the current session
    const sessions = result.rows.map(session => ({
      ...session,
      is_current: session.id === req.sessionId
    }));

    res.json({
      success: true,
      data: { sessions }
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get sessions' });
  }
});

// DELETE /api/auth/sessions/:sessionId
// Revoke a specific session
router.delete('/sessions/:sessionId', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.params;

  try {
    // Verify the session belongs to the current user
    const result = await pool.query(
      `UPDATE player_sessions
       SET revoked_at = NOW(), revoked_reason = 'logout'
       WHERE id = $1 AND player_id = $2 AND revoked_at IS NULL
       RETURNING id`,
      [sessionId, req.player!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    // Audit log: session revoked
    await authAudit.sessionRevoked(req, req.player!.id, sessionId);

    res.json({
      success: true,
      data: { message: 'Session revoked successfully' }
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke session' });
  }
});

// POST /api/auth/change-password
// Change password (also invalidates all other sessions)
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, error: 'Current and new password are required' });
    return;
  }

  // Validate new password strength
  if (newPassword.length < 8) {
    res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    return;
  }

  if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    res.status(400).json({
      success: false,
      error: 'Password must contain uppercase, lowercase, and number'
    });
    return;
  }

  try {
    // Get current password hash
    const playerResult = await pool.query(
      `SELECT password_hash FROM players WHERE id = $1`,
      [req.player!.id]
    );

    if (playerResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Player not found' });
      return;
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, playerResult.rows[0].password_hash);
    if (!validPassword) {
      res.status(401).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password and invalidate all sessions
    await pool.query(
      `UPDATE players
       SET password_hash = $1, sessions_invalidated_at = NOW()
       WHERE id = $2`,
      [newPasswordHash, req.player!.id]
    );

    // Generate new token for current session
    const token = jwt.sign(
      { id: req.player!.id, username: req.player!.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Audit log: password changed
    await authAudit.passwordChanged(req, req.player!.id);

    res.json({
      success: true,
      data: {
        message: 'Password changed successfully. All other sessions have been logged out.',
        token // New token for current session
      }
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

export default router;
