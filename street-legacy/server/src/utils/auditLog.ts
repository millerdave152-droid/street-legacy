/**
 * Street Legacy - Audit Logging Service
 * Comprehensive logging for security-sensitive actions
 */

import pool from '../db/connection.js';
import { Request } from 'express';

// =============================================================================
// TYPES
// =============================================================================

export type AuditCategory =
  | 'auth'
  | 'admin'
  | 'economy'
  | 'security'
  | 'player'
  | 'system';

export type AuditSeverity =
  | 'debug'
  | 'info'
  | 'warning'
  | 'error'
  | 'critical';

export interface AuditLogEntry {
  playerId?: number | null;
  category: AuditCategory;
  action: string;
  severity?: AuditSeverity;
  targetType?: string;
  targetId?: number;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string;
}

export interface AuditLogFilter {
  playerId?: number;
  category?: AuditCategory;
  action?: string;
  severity?: AuditSeverity;
  targetType?: string;
  targetId?: number;
  ipAddress?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Extract client IP address from request
 * Handles proxies via X-Forwarded-For header
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Extract user agent from request
 */
export function getUserAgent(req: Request): string {
  return req.headers['user-agent'] || 'unknown';
}

/**
 * Sanitize details object to remove sensitive data
 */
function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'authorization'];
  const sanitized = { ...details };

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

// =============================================================================
// CORE AUDIT LOGGING
// =============================================================================

/**
 * Log an audit event to the database
 */
export async function logAudit(entry: AuditLogEntry): Promise<number | null> {
  try {
    const sanitizedDetails = entry.details ? sanitizeDetails(entry.details) : {};

    const result = await pool.query(
      `INSERT INTO audit_logs (
        player_id, category, action, severity,
        target_type, target_id,
        ip_address, user_agent,
        details, success, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        entry.playerId || null,
        entry.category,
        entry.action,
        entry.severity || 'info',
        entry.targetType || null,
        entry.targetId || null,
        entry.ipAddress || null,
        entry.userAgent || null,
        JSON.stringify(sanitizedDetails),
        entry.success !== false, // Default to true
        entry.errorMessage || null
      ]
    );

    return result.rows[0]?.id || null;
  } catch (error) {
    // Don't let audit logging failures break the application
    console.error('Audit logging error:', error);
    return null;
  }
}

/**
 * Log audit event with request context
 */
export async function logAuditWithRequest(
  req: Request,
  entry: Omit<AuditLogEntry, 'ipAddress' | 'userAgent'>
): Promise<number | null> {
  return logAudit({
    ...entry,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req)
  });
}

// =============================================================================
// AUTHENTICATION AUDIT HELPERS
// =============================================================================

export const authAudit = {
  async loginSuccess(req: Request, playerId: number, username: string) {
    return logAuditWithRequest(req, {
      playerId,
      category: 'auth',
      action: 'login_success',
      severity: 'info',
      details: { username }
    });
  },

  async loginFailed(req: Request, username: string, reason: string) {
    return logAuditWithRequest(req, {
      category: 'auth',
      action: 'login_failed',
      severity: 'warning',
      success: false,
      errorMessage: reason,
      details: { username }
    });
  },

  async logout(req: Request, playerId: number) {
    return logAuditWithRequest(req, {
      playerId,
      category: 'auth',
      action: 'logout',
      severity: 'info'
    });
  },

  async logoutAll(req: Request, playerId: number, sessionsRevoked: number) {
    return logAuditWithRequest(req, {
      playerId,
      category: 'auth',
      action: 'logout_all',
      severity: 'info',
      details: { sessionsRevoked }
    });
  },

  async register(req: Request, playerId: number, username: string, email: string) {
    return logAuditWithRequest(req, {
      playerId,
      category: 'auth',
      action: 'register',
      severity: 'info',
      details: { username, email: email.substring(0, 3) + '***' }
    });
  },

  async emailVerified(req: Request, playerId: number) {
    return logAuditWithRequest(req, {
      playerId,
      category: 'auth',
      action: 'email_verified',
      severity: 'info'
    });
  },

  async passwordChanged(req: Request, playerId: number) {
    return logAuditWithRequest(req, {
      playerId,
      category: 'auth',
      action: 'password_changed',
      severity: 'info'
    });
  },

  async passwordResetRequested(req: Request, email: string) {
    return logAuditWithRequest(req, {
      category: 'auth',
      action: 'password_reset_requested',
      severity: 'info',
      details: { email: email.substring(0, 3) + '***' }
    });
  },

  async passwordResetCompleted(req: Request, playerId: number) {
    return logAuditWithRequest(req, {
      playerId,
      category: 'auth',
      action: 'password_reset_completed',
      severity: 'info'
    });
  },

  async sessionRevoked(req: Request, playerId: number, sessionId: string) {
    return logAuditWithRequest(req, {
      playerId,
      category: 'auth',
      action: 'session_revoked',
      severity: 'info',
      details: { sessionId: sessionId.substring(0, 8) + '...' }
    });
  }
};

// =============================================================================
// ADMIN AUDIT HELPERS
// =============================================================================

export const adminAudit = {
  async banPlayer(req: Request, adminId: number, targetId: number, reason: string, duration?: string) {
    return logAuditWithRequest(req, {
      playerId: adminId,
      category: 'admin',
      action: 'ban_player',
      severity: 'warning',
      targetType: 'player',
      targetId,
      details: { reason, duration }
    });
  },

  async unbanPlayer(req: Request, adminId: number, targetId: number) {
    return logAuditWithRequest(req, {
      playerId: adminId,
      category: 'admin',
      action: 'unban_player',
      severity: 'info',
      targetType: 'player',
      targetId
    });
  },

  async mutePlayer(req: Request, adminId: number, targetId: number, duration: string, reason?: string) {
    return logAuditWithRequest(req, {
      playerId: adminId,
      category: 'admin',
      action: 'mute_player',
      severity: 'info',
      targetType: 'player',
      targetId,
      details: { duration, reason }
    });
  },

  async unmutePlayer(req: Request, adminId: number, targetId: number) {
    return logAuditWithRequest(req, {
      playerId: adminId,
      category: 'admin',
      action: 'unmute_player',
      severity: 'info',
      targetType: 'player',
      targetId
    });
  },

  async modifyCash(req: Request, adminId: number, targetId: number, amount: number, reason: string) {
    return logAuditWithRequest(req, {
      playerId: adminId,
      category: 'admin',
      action: 'modify_cash',
      severity: 'warning',
      targetType: 'player',
      targetId,
      details: { amount, reason }
    });
  },

  async modifyStats(req: Request, adminId: number, targetId: number, stats: Record<string, unknown>) {
    return logAuditWithRequest(req, {
      playerId: adminId,
      category: 'admin',
      action: 'modify_stats',
      severity: 'warning',
      targetType: 'player',
      targetId,
      details: { stats }
    });
  },

  async forceLogout(req: Request, adminId: number, targetId: number, sessionsRevoked: number) {
    return logAuditWithRequest(req, {
      playerId: adminId,
      category: 'admin',
      action: 'force_logout',
      severity: 'warning',
      targetType: 'player',
      targetId,
      details: { sessionsRevoked }
    });
  },

  async grantAdmin(req: Request, adminId: number, targetId: number) {
    return logAuditWithRequest(req, {
      playerId: adminId,
      category: 'admin',
      action: 'grant_admin',
      severity: 'critical',
      targetType: 'player',
      targetId
    });
  },

  async revokeAdmin(req: Request, adminId: number, targetId: number) {
    return logAuditWithRequest(req, {
      playerId: adminId,
      category: 'admin',
      action: 'revoke_admin',
      severity: 'critical',
      targetType: 'player',
      targetId
    });
  },

  async viewPlayer(req: Request, adminId: number, targetId: number) {
    return logAuditWithRequest(req, {
      playerId: adminId,
      category: 'admin',
      action: 'view_player',
      severity: 'debug',
      targetType: 'player',
      targetId
    });
  }
};

// =============================================================================
// SECURITY AUDIT HELPERS
// =============================================================================

export const securityAudit = {
  async rateLimitHit(req: Request, playerId: number | null, endpoint: string) {
    return logAuditWithRequest(req, {
      playerId,
      category: 'security',
      action: 'rate_limit_hit',
      severity: 'warning',
      details: { endpoint }
    });
  },

  async suspiciousActivity(req: Request, playerId: number | null, description: string, details?: Record<string, unknown>) {
    return logAuditWithRequest(req, {
      playerId,
      category: 'security',
      action: 'suspicious_activity',
      severity: 'warning',
      details: { description, ...details }
    });
  },

  async multipleFailedLogins(req: Request, ip: string, count: number) {
    return logAuditWithRequest(req, {
      category: 'security',
      action: 'multiple_failed_logins',
      severity: 'warning',
      details: { ip, failedAttempts: count }
    });
  },

  async invalidToken(req: Request, reason: string) {
    return logAuditWithRequest(req, {
      category: 'security',
      action: 'invalid_token',
      severity: 'warning',
      success: false,
      errorMessage: reason
    });
  },

  async accountLocked(req: Request, playerId: number, username: string, failedAttempts: number) {
    return logAuditWithRequest(req, {
      playerId,
      category: 'security',
      action: 'account_locked',
      severity: 'warning',
      details: { username, failedAttempts, reason: 'Too many failed login attempts' }
    });
  }
};

// =============================================================================
// ECONOMY AUDIT HELPERS
// =============================================================================

export const economyAudit = {
  async cashTransfer(req: Request, fromPlayerId: number, toPlayerId: number, amount: number) {
    return logAuditWithRequest(req, {
      playerId: fromPlayerId,
      category: 'economy',
      action: 'cash_transfer',
      severity: amount >= 100000 ? 'warning' : 'info',
      targetType: 'player',
      targetId: toPlayerId,
      details: { amount }
    });
  },

  async bankDeposit(req: Request, playerId: number, amount: number) {
    return logAuditWithRequest(req, {
      playerId,
      category: 'economy',
      action: 'bank_deposit',
      severity: 'info',
      details: { amount }
    });
  },

  async bankWithdraw(req: Request, playerId: number, amount: number) {
    return logAuditWithRequest(req, {
      playerId,
      category: 'economy',
      action: 'bank_withdraw',
      severity: 'info',
      details: { amount }
    });
  },

  async largeTransaction(req: Request, playerId: number, type: string, amount: number) {
    return logAuditWithRequest(req, {
      playerId,
      category: 'economy',
      action: 'large_transaction',
      severity: 'warning',
      details: { type, amount }
    });
  }
};

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Get audit logs with filtering
 */
export async function getAuditLogs(filter: AuditLogFilter = {}) {
  const params: unknown[] = [];
  let paramIndex = 1;
  const conditions: string[] = [];

  if (filter.playerId !== undefined) {
    conditions.push(`player_id = $${paramIndex++}`);
    params.push(filter.playerId);
  }
  if (filter.category) {
    conditions.push(`category = $${paramIndex++}`);
    params.push(filter.category);
  }
  if (filter.action) {
    conditions.push(`action = $${paramIndex++}`);
    params.push(filter.action);
  }
  if (filter.severity) {
    conditions.push(`severity = $${paramIndex++}`);
    params.push(filter.severity);
  }
  if (filter.targetType) {
    conditions.push(`target_type = $${paramIndex++}`);
    params.push(filter.targetType);
  }
  if (filter.targetId !== undefined) {
    conditions.push(`target_id = $${paramIndex++}`);
    params.push(filter.targetId);
  }
  if (filter.ipAddress) {
    conditions.push(`ip_address = $${paramIndex++}`);
    params.push(filter.ipAddress);
  }
  if (filter.success !== undefined) {
    conditions.push(`success = $${paramIndex++}`);
    params.push(filter.success);
  }
  if (filter.startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filter.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filter.limit || 100;
  const offset = filter.offset || 0;

  const result = await pool.query(
    `SELECT
      al.id,
      al.created_at,
      al.player_id,
      p.username AS player_username,
      al.category,
      al.action,
      al.severity,
      al.target_type,
      al.target_id,
      al.ip_address,
      al.user_agent,
      al.details,
      al.success,
      al.error_message
    FROM audit_logs al
    LEFT JOIN players p ON al.player_id = p.id
    ${whereClause}
    ORDER BY al.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return result.rows;
}

/**
 * Get security alerts
 */
export async function getSecurityAlerts(hours: number = 24, limit: number = 100) {
  const result = await pool.query(
    `SELECT
      al.id,
      al.created_at,
      al.player_id,
      p.username AS player_username,
      al.category,
      al.action,
      al.severity,
      al.ip_address,
      al.details,
      al.error_message
    FROM audit_logs al
    LEFT JOIN players p ON al.player_id = p.id
    WHERE
      al.created_at >= NOW() - ($1 || ' hours')::INTERVAL
      AND (
        al.success = false
        OR al.severity IN ('warning', 'error', 'critical')
        OR al.category = 'security'
      )
    ORDER BY al.created_at DESC
    LIMIT $2`,
    [hours, limit]
  );

  return result.rows;
}

/**
 * Get login history for a player
 */
export async function getLoginHistory(playerId: number, days: number = 30, limit: number = 50) {
  const result = await pool.query(
    `SELECT
      created_at,
      action,
      ip_address,
      user_agent,
      success
    FROM audit_logs
    WHERE
      player_id = $1
      AND category = 'auth'
      AND action IN ('login_success', 'login_failed', 'logout', 'logout_all')
      AND created_at >= NOW() - ($2 || ' days')::INTERVAL
    ORDER BY created_at DESC
    LIMIT $3`,
    [playerId, days, limit]
  );

  return result.rows;
}

/**
 * Count failed login attempts from an IP
 */
export async function countFailedLogins(ipAddress: string, minutes: number = 15): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count
    FROM audit_logs
    WHERE
      ip_address = $1
      AND category = 'auth'
      AND action = 'login_failed'
      AND created_at >= NOW() - ($2 || ' minutes')::INTERVAL`,
    [ipAddress, minutes]
  );

  return parseInt(result.rows[0]?.count || '0', 10);
}

export default {
  logAudit,
  logAuditWithRequest,
  getClientIp,
  getUserAgent,
  auth: authAudit,
  admin: adminAudit,
  security: securityAudit,
  economy: economyAudit,
  getAuditLogs,
  getSecurityAlerts,
  getLoginHistory,
  countFailedLogins
};
