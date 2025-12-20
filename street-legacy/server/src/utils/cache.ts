/**
 * Caching utility for Street Legacy
 * Supports both in-memory cache and Redis for distributed deployments
 */

import Redis from 'ioredis';

// Cache interface that both implementations follow
interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;
  getOrSet<T>(key: string, callback: () => Promise<T>, ttlSeconds?: number): Promise<T>;
  isConnected(): boolean;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory cache implementation (fallback when Redis unavailable)
 */
class MemoryCache implements CacheProvider {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  isConnected(): boolean {
    return true; // Memory cache is always "connected"
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async deletePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl || 300);
    }
  }

  async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await callback();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

/**
 * Redis cache implementation for distributed deployments
 */
class RedisCache implements CacheProvider {
  private client: Redis;
  private connected: boolean = false;
  private fallback: MemoryCache;

  constructor(redisUrl: string) {
    this.fallback = new MemoryCache();

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('[Cache] Redis connection failed, using memory fallback');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000);
      },
      lazyConnect: true
    });

    this.client.on('connect', () => {
      this.connected = true;
      console.log('[Cache] Redis connected');
    });

    this.client.on('error', (err) => {
      console.error('[Cache] Redis error:', err.message);
      this.connected = false;
    });

    this.client.on('close', () => {
      this.connected = false;
      console.log('[Cache] Redis disconnected');
    });

    // Attempt to connect
    this.client.connect().catch((err) => {
      console.warn('[Cache] Redis initial connection failed:', err.message);
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  private useFallback(): boolean {
    return !this.connected;
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.useFallback()) {
      return this.fallback.get<T>(key);
    }

    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('[Cache] Redis get error:', error);
      return this.fallback.get<T>(key);
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    // Always set in fallback for consistency
    await this.fallback.set(key, value, ttlSeconds);

    if (this.useFallback()) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.setex(key, ttlSeconds, serialized);
    } catch (error) {
      console.error('[Cache] Redis set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    await this.fallback.delete(key);

    if (this.useFallback()) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      console.error('[Cache] Redis delete error:', error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    await this.fallback.deletePattern(pattern);

    if (this.useFallback()) {
      return;
    }

    try {
      // Use SCAN for pattern deletion (safer than KEYS for large datasets)
      let cursor = '0';
      do {
        const [newCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = newCursor;

        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      console.error('[Cache] Redis deletePattern error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (this.useFallback()) {
      return this.fallback.exists(key);
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('[Cache] Redis exists error:', error);
      return this.fallback.exists(key);
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (this.useFallback() || keys.length === 0) {
      return this.fallback.mget<T>(keys);
    }

    try {
      const values = await this.client.mget(...keys);
      return values.map(v => (v ? JSON.parse(v) as T : null));
    } catch (error) {
      console.error('[Cache] Redis mget error:', error);
      return this.fallback.mget<T>(keys);
    }
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    // Always set in fallback
    await this.fallback.mset(entries);

    if (this.useFallback() || entries.length === 0) {
      return;
    }

    try {
      const pipeline = this.client.pipeline();
      for (const entry of entries) {
        const serialized = JSON.stringify(entry.value);
        const ttl = entry.ttl || 300;
        pipeline.setex(entry.key, ttl, serialized);
      }
      await pipeline.exec();
    } catch (error) {
      console.error('[Cache] Redis mset error:', error);
    }
  }

  async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await callback();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error) {
      console.error('[Cache] Redis disconnect error:', error);
    }
  }
}

/**
 * Factory function to create the appropriate cache provider
 */
function createCacheProvider(): CacheProvider {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    console.log('[Cache] Using Redis cache');
    return new RedisCache(redisUrl);
  }

  console.log('[Cache] Using in-memory cache');
  return new MemoryCache();
}

// Singleton cache instance
const cacheProvider = createCacheProvider();

// Export cache interface
export const cache = {
  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    return cacheProvider.get<T>(key);
  },

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    return cacheProvider.set(key, value, ttlSeconds);
  },

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<void> {
    return cacheProvider.delete(key);
  },

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    return cacheProvider.deletePattern(pattern);
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    return cacheProvider.exists(key);
  },

  /**
   * Get multiple values at once
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return cacheProvider.mget<T>(keys);
  },

  /**
   * Set multiple values at once
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    return cacheProvider.mset(entries);
  },

  /**
   * Get or set with callback (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    return cacheProvider.getOrSet(key, callback, ttlSeconds);
  },

  /**
   * Check if cache is connected (useful for health checks)
   */
  isConnected(): boolean {
    return cacheProvider.isConnected();
  }
};

// Cache key generators for consistency
export const cacheKeys = {
  // Player data
  player: (id: number) => `player:${id}`,
  playerStats: (id: number) => `player:${id}:stats`,
  playerEquipment: (id: number) => `player:${id}:equipment`,
  playerCooldowns: (id: number) => `player:${id}:cooldowns`,
  playerProperties: (id: number) => `player:${id}:properties`,
  playerBusinesses: (id: number) => `player:${id}:businesses`,
  playerAchievements: (id: number) => `player:${id}:achievements`,
  playerMissions: (id: number) => `player:${id}:missions`,

  // Static/reference data (cache for 24h)
  allDistricts: () => 'static:districts',
  allCrimes: () => 'static:crimes',
  allCrimeTypes: () => 'static:crime_types',
  allAchievements: () => 'static:achievements',
  allMissions: () => 'static:missions',
  allItems: () => 'static:items',
  allBusinessTypes: () => 'static:business_types',
  allJobTypes: () => 'static:job_types',
  allJobs: () => 'static:jobs',

  // District data
  district: (id: string) => `district:${id}`,
  districts: () => 'districts:all',
  districtInfluence: (id: string) => `district:${id}:influence`,

  // Crimes
  crimes: () => 'crimes:all',
  crimesByLevel: (level: number) => `crimes:level:${level}`,

  // Leaderboards
  leaderboard: (type: string) => `leaderboard:${type}`,
  leaderboardCash: () => 'leaderboard:cash',
  leaderboardLevel: () => 'leaderboard:level',
  leaderboardEarnings: () => 'leaderboard:earnings',
  leaderboardCrew: () => 'leaderboard:crews',

  // Crew data
  crew: (id: number) => `crew:${id}`,
  crewMembers: (crewId: number) => `crew:${crewId}:members`,
  crewTerritories: (crewId: number) => `crew:${crewId}:territories`,

  // Territory
  territoryStatus: () => 'territory:status',

  // Chat
  chatMessages: (channel: string) => `chat:${channel}:messages`,

  // Events
  activeEvents: () => 'events:active',

  // Game state
  gameState: (playerId: number) => `game:state:${playerId}`
};

// Cache TTL constants (in seconds)
export const cacheTTL = {
  veryShort: 10,      // 10 seconds - real-time data
  short: 30,          // 30 seconds - frequently changing data
  medium: 300,        // 5 minutes - moderately changing data
  long: 3600,         // 1 hour - rarely changing data
  veryLong: 86400,    // 24 hours - static/reference data
  oneWeek: 604800     // 1 week - truly static data
};

// Cache invalidation helpers
export const cacheInvalidation = {
  /**
   * Invalidate all player-related caches
   */
  async invalidatePlayer(playerId: number): Promise<void> {
    await cache.deletePattern(`player:${playerId}:*`);
    await cache.delete(cacheKeys.player(playerId));
  },

  /**
   * Invalidate crew-related caches
   */
  async invalidateCrew(crewId: number): Promise<void> {
    await cache.deletePattern(`crew:${crewId}:*`);
    await cache.delete(cacheKeys.crew(crewId));
  },

  /**
   * Invalidate leaderboards (call after significant player changes)
   */
  async invalidateLeaderboards(): Promise<void> {
    await cache.deletePattern('leaderboard:*');
  },

  /**
   * Invalidate territory data
   */
  async invalidateTerritory(): Promise<void> {
    await cache.delete(cacheKeys.territoryStatus());
    await cache.deletePattern('district:*:influence');
  },

  /**
   * Invalidate static data (call after admin changes)
   */
  async invalidateStatic(): Promise<void> {
    await cache.deletePattern('static:*');
  }
};

export default cache;
