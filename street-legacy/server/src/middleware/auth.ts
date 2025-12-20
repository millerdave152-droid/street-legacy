import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../db/connection.js';

export interface PlayerPayload {
  id: number;
  username: string;
  current_district?: number;
  iat?: number; // JWT issued at timestamp
}

export interface AuthRequest extends Request {
  player?: PlayerPayload;
  sessionId?: string; // Current session UUID
  tokenHash?: string; // Hash of current token for session tracking
}

// Validate JWT_SECRET at module load
const JWT_SECRET: string = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

// Enable/disable session validation (can be disabled for development)
const VALIDATE_SESSIONS = process.env.VALIDATE_SESSIONS !== 'false';

/**
 * Generate a hash of the token for session tracking
 * Uses first 32 chars of SHA256 hash
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
}

/**
 * Check if a session has been invalidated
 * Returns true if session is valid, false if invalidated
 */
async function isSessionValid(playerId: number, tokenIssuedAt: number): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT sessions_invalidated_at FROM players WHERE id = $1`,
      [playerId]
    );

    if (result.rows.length === 0) {
      return false; // Player doesn't exist
    }

    const invalidatedAt = result.rows[0].sessions_invalidated_at;

    // If no invalidation timestamp, session is valid
    if (!invalidatedAt) {
      return true;
    }

    // Convert invalidation timestamp to seconds for comparison with JWT iat
    const invalidatedAtSeconds = Math.floor(new Date(invalidatedAt).getTime() / 1000);

    // Session is valid if it was issued after the invalidation
    return tokenIssuedAt > invalidatedAtSeconds;
  } catch (error) {
    console.error('Session validation error:', error);
    // Fail open in case of DB error (could change to fail closed for higher security)
    return true;
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);

  // Validate token format (basic check)
  if (!token || token.split('.').length !== 3) {
    res.status(401).json({ success: false, error: 'Invalid token format' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as PlayerPayload;

    // Validate decoded payload has required fields
    if (!decoded.id || typeof decoded.id !== 'number') {
      res.status(401).json({ success: false, error: 'Invalid token payload' });
      return;
    }

    // Store token hash for session tracking
    req.tokenHash = hashToken(token);

    // Check session validity if enabled
    if (VALIDATE_SESSIONS && decoded.iat) {
      isSessionValid(decoded.id, decoded.iat).then(valid => {
        if (!valid) {
          res.status(401).json({
            success: false,
            error: 'Session has been invalidated. Please log in again.',
            code: 'SESSION_INVALIDATED'
          });
          return;
        }

        req.player = decoded;
        next();
      }).catch(error => {
        console.error('Session check error:', error);
        // Continue anyway on error (fail open)
        req.player = decoded;
        next();
      });
    } else {
      req.player = decoded;
      next();
    }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, error: 'Token expired' });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, error: 'Invalid token' });
    } else {
      console.error('Auth middleware error:', error);
      res.status(500).json({ success: false, error: 'Authentication error' });
    }
  }
}

// Export JWT_SECRET for use in auth routes
export { JWT_SECRET };

export async function getPlayerById(id: number) {
  const result = await pool.query(
    `SELECT id, username, email, level, xp, cash, bank, energy, nerve,
            current_district, in_jail, jail_release_at, created_at, last_seen
     FROM players WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}
