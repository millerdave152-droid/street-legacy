/**
 * Health Check Routes
 *
 * Provides endpoints for monitoring service health, readiness, and liveness.
 * Used by load balancers, Kubernetes, and monitoring systems.
 */

import { Router, Request, Response } from 'express';
import pool from '../db/connection.js';
import { cache } from '../utils/cache.js';
import { getOnlineCount } from '../websocket/index.js';

const router = Router();

// Server start time for uptime calculation
const startTime = Date.now();

// Package version (fallback if not available)
const version = process.env.npm_package_version || '1.0.0';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  components: {
    database: 'up' | 'down';
    redis: 'up' | 'down' | 'not_configured';
    websocket: 'up' | 'down';
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  connections: {
    database: {
      total: number;
      idle: number;
      waiting: number;
    };
    websocket: number;
  };
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<{ up: boolean; poolStats?: any }> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    return {
      up: true,
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
  } catch (error) {
    return { up: false };
  }
}

/**
 * Check Redis connectivity (if configured)
 */
async function checkRedis(): Promise<'up' | 'down' | 'not_configured'> {
  if (!process.env.REDIS_URL) {
    return 'not_configured';
  }

  try {
    // Try to use cache - if Redis is configured it will use Redis
    const testKey = '__health_check__';
    await cache.set(testKey, 'ok', 1);
    const result = await cache.get(testKey);
    return result === 'ok' ? 'up' : 'down';
  } catch (error) {
    return 'down';
  }
}

/**
 * GET /api/health/detailed
 * Comprehensive health check with component status
 */
router.get('/detailed', async (_req: Request, res: Response) => {
  const [dbStatus, redisStatus] = await Promise.all([
    checkDatabase(),
    checkRedis()
  ]);

  const memory = process.memoryUsage();
  const wsConnections = getOnlineCount();

  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (!dbStatus.up) {
    status = 'unhealthy';
  } else if (redisStatus === 'down') {
    status = 'degraded';
  }

  const health: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version,
    components: {
      database: dbStatus.up ? 'up' : 'down',
      redis: redisStatus,
      websocket: 'up' // WebSocket is always up if server is running
    },
    memory: {
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      rss: memory.rss,
      external: memory.external
    },
    connections: {
      database: dbStatus.poolStats || { total: 0, idle: 0, waiting: 0 },
      websocket: wsConnections
    }
  };

  const statusCode = status === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json({
    success: status !== 'unhealthy',
    data: health
  });
});

/**
 * GET /api/health/ready
 * Kubernetes-style readiness probe
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const dbStatus = await checkDatabase();

  if (dbStatus.up) {
    res.json({ ready: true });
  } else {
    res.status(503).json({
      ready: false,
      reason: 'Database connection not established'
    });
  }
});

/**
 * GET /api/health/live
 * Kubernetes-style liveness probe
 */
router.get('/live', (_req: Request, res: Response) => {
  // If we can respond, we're alive
  res.json({ alive: true });
});

/**
 * GET /api/health/metrics
 * Prometheus-style metrics (simple text format)
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  const memory = process.memoryUsage();
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const wsConnections = getOnlineCount();

  const dbStatus = await checkDatabase();

  const metrics = [
    `# HELP process_uptime_seconds Process uptime in seconds`,
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds ${uptime}`,
    ``,
    `# HELP nodejs_heap_size_bytes Node.js heap size`,
    `# TYPE nodejs_heap_size_bytes gauge`,
    `nodejs_heap_size_bytes{type="used"} ${memory.heapUsed}`,
    `nodejs_heap_size_bytes{type="total"} ${memory.heapTotal}`,
    ``,
    `# HELP nodejs_external_memory_bytes External memory in bytes`,
    `# TYPE nodejs_external_memory_bytes gauge`,
    `nodejs_external_memory_bytes ${memory.external}`,
    ``,
    `# HELP process_resident_memory_bytes Resident memory size in bytes`,
    `# TYPE process_resident_memory_bytes gauge`,
    `process_resident_memory_bytes ${memory.rss}`,
    ``,
    `# HELP websocket_connections_total Current WebSocket connections`,
    `# TYPE websocket_connections_total gauge`,
    `websocket_connections_total ${wsConnections}`,
    ``,
    `# HELP database_connections Database connection pool stats`,
    `# TYPE database_connections gauge`,
    `database_connections{state="total"} ${dbStatus.poolStats?.total || 0}`,
    `database_connections{state="idle"} ${dbStatus.poolStats?.idle || 0}`,
    `database_connections{state="waiting"} ${dbStatus.poolStats?.waiting || 0}`,
    ``,
    `# HELP database_up Database availability`,
    `# TYPE database_up gauge`,
    `database_up ${dbStatus.up ? 1 : 0}`,
    ``
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(metrics);
});

export default router;
