/**
 * Rate Limiter Middleware
 *
 * Implements comprehensive rate limiting using express-rate-limit
 * with optional Redis backend for distributed environments.
 *
 * Features:
 * - Memory store (default) for single-server deployments
 * - Redis store for distributed/clustered deployments
 * - Per-IP and per-user rate limiting
 * - Different limits for different endpoint categories
 * - Automatic header injection (X-RateLimit-*)
 */

import rateLimit, { Options, RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';
import { rateLimitConfig, RateLimitConfig } from './rateLimiter.config.js';
import { logger } from '../utils/logger.js';

// Extended request type with user info
interface AuthenticatedRequest extends Request {
  player?: {
    id: number;
    username: string;
  };
}

// Redis client type (optional import to avoid hard dependency)
let RedisStore: any = null;
let redisClient: any = null;

/**
 * Initialize Redis connection for distributed rate limiting
 * Falls back to memory store if Redis is unavailable
 */
async function initRedis(): Promise<void> {
  if (!process.env.REDIS_URL) {
    logger.info('REDIS_URL not set, using in-memory rate limit store');
    return;
  }

  try {
    // Dynamic imports to avoid errors when Redis packages aren't installed
    const { default: Redis } = await import('ioredis');
    const RedisStoreModule = await import('rate-limit-redis');
    RedisStore = RedisStoreModule.default;

    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          logger.error('Redis connection failed after 3 retries, falling back to memory store');
          redisClient = null;
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      lazyConnect: true
    });

    redisClient.on('error', (err: Error) => {
      logger.error('Redis error:', err.message);
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected for rate limiting');
    });

    await redisClient.connect();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('Redis initialization failed, using memory store', { error: errorMessage });
    redisClient = null;
  }
}

// Initialize Redis on module load (non-blocking)
initRedis().catch(() => {
  // Error already logged in initRedis
});

/**
 * Create store configuration based on availability
 * Uses Redis if connected, otherwise defaults to memory store
 */
function createStore(): any {
  if (redisClient && RedisStore) {
    try {
      return new RedisStore({
        sendCommand: (...args: string[]) => redisClient.call(...args),
        prefix: 'rl:street-legacy:'
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('Failed to create Redis store, using memory', { error: errorMessage });
      return undefined;
    }
  }
  return undefined; // Uses express-rate-limit's default memory store
}

/**
 * Normalize IPv6 addresses to prevent bypass attacks
 * Converts ::ffff:127.0.0.1 to 127.0.0.1 and normalizes IPv6
 */
function normalizeIp(ip: string | undefined): string {
  if (!ip) return 'unknown';

  // Strip IPv6 prefix for mapped IPv4 addresses
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }

  // Normalize IPv6 - take first 64 bits to group /64 subnets
  if (ip.includes(':') && !ip.includes('.')) {
    const parts = ip.split(':');
    // Keep first 4 segments (64 bits) to prevent per-address bypass
    return parts.slice(0, 4).join(':') + '::';
  }

  return ip;
}

/**
 * Generate a unique key for rate limiting
 * Combines IP address with user ID (if authenticated) for better tracking
 */
function keyGenerator(req: AuthenticatedRequest): string {
  const rawIp = req.ip ||
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.socket.remoteAddress;

  const ip = normalizeIp(rawIp);

  // Include user ID if authenticated for per-user limits
  const userId = req.player?.id ? `user:${req.player.id}` : 'anon';

  return `${ip}:${userId}`;
}

/**
 * Generate IP-only key (for pre-auth endpoints like registration)
 */
function ipKeyGenerator(req: Request): string {
  const rawIp = req.ip ||
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.socket.remoteAddress;

  return normalizeIp(rawIp);
}

/**
 * Custom handler for rate limit exceeded
 * Logs the event and returns a consistent error response
 */
function createHandler(config: RateLimitConfig) {
  return (req: Request, res: Response) => {
    const ip = req.ip || 'unknown';
    logger.warn(`Rate limit exceeded: ${req.method} ${req.path} from ${ip}`);

    res.status(429).json(config.message);
  };
}

/**
 * Factory function to create rate limiters with consistent configuration
 */
function createLimiter(
  config: RateLimitConfig,
  useIpOnly: boolean = false
): RateLimitRequestHandler {
  const options: Partial<Options> = {
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: config.standardHeaders,
    legacyHeaders: config.legacyHeaders,
    store: createStore(),
    keyGenerator: useIpOnly ? ipKeyGenerator : keyGenerator,
    handler: createHandler(config),
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,
    // Disable all validation since we handle IPv6 normalization in normalizeIp()
    validate: false
  };

  return rateLimit(options);
}

// ============================================================================
// Pre-configured Rate Limiters
// ============================================================================

/**
 * Global rate limiter - baseline protection for all routes
 * 100 requests per 15 minutes
 */
export const globalLimiter = createLimiter(rateLimitConfig.global);

/**
 * Authentication rate limiter - strict limits for login
 * 5 attempts per 15 minutes, successful logins don't count
 */
export const authLimiter = createLimiter(rateLimitConfig.auth, true);

/**
 * Registration rate limiter - very strict, IP-only
 * 3 registrations per hour
 */
export const registrationLimiter = createLimiter(rateLimitConfig.registration, true);

/**
 * Game action rate limiter - crimes, travel, attacks
 * 30 actions per minute
 */
export const gameActionLimiter = createLimiter(rateLimitConfig.gameActions);

/**
 * Sensitive operations rate limiter - money, property, trading
 * 10 operations per 5 minutes
 */
export const sensitiveLimiter = createLimiter(rateLimitConfig.sensitive);

/**
 * Heavy operations rate limiter - leaderboards, searches
 * 10 requests per minute
 */
export const heavyLimiter = createLimiter(rateLimitConfig.heavy);

/**
 * Chat rate limiter
 * 20 messages per minute
 */
export const chatLimiter = createLimiter(rateLimitConfig.chat);

/**
 * Admin rate limiter
 * 50 requests per minute
 */
export const adminLimiter = createLimiter(rateLimitConfig.admin);

/**
 * Password reset rate limiter
 * 3 attempts per hour
 */
export const passwordResetLimiter = createLimiter(rateLimitConfig.passwordReset, true);

/**
 * Casino/gambling rate limiter
 * 60 bets per minute
 */
export const casinoLimiter = createLimiter(rateLimitConfig.casino);

/**
 * Crew operations rate limiter
 * 20 operations per minute
 */
export const crewLimiter = createLimiter(rateLimitConfig.crew);

/**
 * Combat/PvP rate limiter
 * 15 actions per minute
 */
export const combatLimiter = createLimiter(rateLimitConfig.combat);

// ============================================================================
// Custom Limiter Factory
// ============================================================================

/**
 * Create a custom rate limiter for specific needs
 *
 * @param windowMs - Time window in milliseconds
 * @param max - Maximum requests allowed in window
 * @param message - Custom error message
 * @param useIpOnly - Use IP-only key generation (default: false)
 *
 * @example
 * const customLimiter = createCustomLimiter(30000, 5, 'Too fast!');
 * router.post('/special', customLimiter, handler);
 */
export function createCustomLimiter(
  windowMs: number,
  max: number,
  message?: string,
  useIpOnly: boolean = false
): RateLimitRequestHandler {
  const config: RateLimitConfig = {
    windowMs,
    max,
    message: {
      success: false,
      error: message || 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false
  };

  return createLimiter(config, useIpOnly);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if Redis is connected and being used for rate limiting
 */
export function isRedisConnected(): boolean {
  return redisClient !== null && redisClient.status === 'ready';
}

/**
 * Get current rate limiter storage type
 */
export function getStorageType(): 'redis' | 'memory' {
  return isRedisConnected() ? 'redis' : 'memory';
}

/**
 * Graceful shutdown - close Redis connection
 */
export async function shutdownRateLimiter(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Rate limiter Redis connection closed');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error closing Redis connection', undefined, { error: errorMessage });
    }
  }
}

// Export config for reference
export { rateLimitConfig } from './rateLimiter.config.js';
