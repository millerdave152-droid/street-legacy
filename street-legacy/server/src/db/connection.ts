import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Validate DATABASE_URL exists
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Parse pool configuration from environment
const poolConfig = {
  connectionString: process.env.DATABASE_URL,

  // Connection pool sizing
  max: parseInt(process.env.DB_POOL_MAX || '20'),       // Maximum connections
  min: parseInt(process.env.DB_POOL_MIN || '2'),        // Minimum connections to maintain

  // Timeout configuration
  idleTimeoutMillis: 30000,                             // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000,                         // Return error after 5 seconds if cannot connect

  // Statement timeout to prevent runaway queries (10 seconds default)
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '10000'),

  // Keep connections alive
  allowExitOnIdle: false
};

const pool = new Pool(poolConfig);

// Track pool statistics
let totalConnections = 0;
let activeQueries = 0;
let poolErrors = 0;

// Handle pool errors
pool.on('error', (err, client) => {
  poolErrors++;
  console.error('[DB] Unexpected pool error:', err.message);

  // Log pool status on errors
  console.error('[DB] Pool status - Total:', pool.totalCount, 'Idle:', pool.idleCount, 'Waiting:', pool.waitingCount);
});

// Connection validation on checkout
pool.on('connect', async (client) => {
  totalConnections++;

  try {
    // Validate connection is alive
    await client.query('SELECT 1');
  } catch (err) {
    console.error('[DB] Connection validation failed:', err);
    throw err;
  }
});

pool.on('acquire', () => {
  activeQueries++;
});

pool.on('release', () => {
  activeQueries--;
});

pool.on('remove', () => {
  console.log('[DB] Connection removed from pool');
});

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => {
    console.log('[DB] Database connection established');
    console.log('[DB] Pool config - Max:', poolConfig.max, 'Min:', poolConfig.min);
  })
  .catch((err) => {
    console.error('[DB] Failed to connect to database:', err.message || err);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('[DB] Server will continue without database - some features may not work');
    }
  });

/**
 * Execute a query with retry logic for transient errors
 */
export async function queryWithRetry<T>(
  queryFn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error: any) {
      lastError = error;

      // Only retry on connection errors, not query errors
      const retryableCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', '57P01'];
      if (!retryableCodes.includes(error.code)) {
        throw error;
      }

      console.warn(`[DB] Query failed (attempt ${attempt + 1}/${maxRetries}):`, error.code);

      // Exponential backoff with jitter
      const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 100, 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Get pool health status (useful for health checks)
 */
export function getPoolHealth(): {
  healthy: boolean;
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  totalConnections: number;
  activeQueries: number;
  errors: number;
} {
  const healthy = pool.totalCount > 0 && pool.waitingCount < pool.totalCount;

  return {
    healthy,
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    totalConnections,
    activeQueries,
    errors: poolErrors
  };
}

/**
 * Graceful shutdown - drain pool connections
 */
export async function closePool(): Promise<void> {
  console.log('[DB] Closing database pool...');
  await pool.end();
  console.log('[DB] Database pool closed');
}

// Handle process termination
process.on('SIGTERM', async () => {
  await closePool();
});

process.on('SIGINT', async () => {
  await closePool();
});

export default pool;
