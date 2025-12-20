/**
 * Configuration Validation and Management
 *
 * Validates required environment variables on startup and provides
 * typed access to configuration values.
 */

import { logger } from './logger.js';

interface ConfigValidation {
  name: string;
  required: boolean;
  default?: string;
  validator?: (value: string) => boolean;
  description: string;
}

/**
 * Configuration schema defining all environment variables
 */
const configSchema: ConfigValidation[] = [
  // Database
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL connection string'
  },
  {
    name: 'DB_STATEMENT_TIMEOUT',
    required: false,
    default: '30000',
    validator: (v) => !isNaN(parseInt(v)) && parseInt(v) > 0,
    description: 'Database statement timeout in milliseconds'
  },
  {
    name: 'DB_POOL_MAX',
    required: false,
    default: '20',
    validator: (v) => !isNaN(parseInt(v)) && parseInt(v) > 0,
    description: 'Maximum database pool connections'
  },

  // Authentication
  {
    name: 'JWT_SECRET',
    required: true,
    validator: (v) => v.length >= 32,
    description: 'JWT signing secret (minimum 32 characters)'
  },
  {
    name: 'JWT_EXPIRES_IN',
    required: false,
    default: '7d',
    description: 'JWT token expiration time'
  },

  // Server
  {
    name: 'PORT',
    required: false,
    default: '3001',
    validator: (v) => !isNaN(parseInt(v)) && parseInt(v) > 0 && parseInt(v) < 65536,
    description: 'Server port number'
  },
  {
    name: 'NODE_ENV',
    required: false,
    default: 'development',
    validator: (v) => ['development', 'production', 'test'].includes(v),
    description: 'Node environment (development, production, test)'
  },

  // CORS
  {
    name: 'CORS_ORIGIN',
    required: false,
    default: 'http://localhost:5173',
    description: 'Allowed CORS origins (comma-separated)'
  },

  // Redis (optional)
  {
    name: 'REDIS_URL',
    required: false,
    description: 'Redis connection URL for caching and rate limiting'
  },

  // Monitoring
  {
    name: 'LOG_LEVEL',
    required: false,
    default: 'info',
    validator: (v) => ['debug', 'info', 'warn', 'error'].includes(v),
    description: 'Logging level (debug, info, warn, error)'
  }
];

/**
 * Validated configuration values
 */
export interface AppConfig {
  database: {
    url: string;
    statementTimeout: number;
    poolMax: number;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
  };
  server: {
    port: number;
    nodeEnv: 'development' | 'production' | 'test';
  };
  cors: {
    origins: string[];
  };
  redis: {
    url: string | null;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

/**
 * Validate all configuration on startup
 */
export function validateConfig(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const config of configSchema) {
    const value = process.env[config.name];

    // Check required
    if (config.required && !value) {
      errors.push(`Missing required environment variable: ${config.name} - ${config.description}`);
      continue;
    }

    // Apply default if not set
    if (!value && config.default) {
      process.env[config.name] = config.default;
      warnings.push(`Using default value for ${config.name}: ${config.default}`);
    }

    // Run validator if present and value exists
    const finalValue = process.env[config.name];
    if (finalValue && config.validator && !config.validator(finalValue)) {
      errors.push(`Invalid value for ${config.name}: "${finalValue}" - ${config.description}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Get typed configuration object
 */
export function getConfig(): AppConfig {
  return {
    database: {
      url: process.env.DATABASE_URL!,
      statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
      poolMax: parseInt(process.env.DB_POOL_MAX || '20')
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET!,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d'
    },
    server: {
      port: parseInt(process.env.PORT || '3001'),
      nodeEnv: (process.env.NODE_ENV as any) || 'development'
    },
    cors: {
      origins: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(o => o.trim())
    },
    redis: {
      url: process.env.REDIS_URL || null
    },
    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info'
    }
  };
}

/**
 * Print configuration summary (hiding secrets)
 */
export function printConfigSummary(): void {
  const config = getConfig();

  const summary = {
    server: {
      port: config.server.port,
      nodeEnv: config.server.nodeEnv
    },
    database: {
      url: config.database.url.replace(/:[^@]+@/, ':****@'), // Hide password
      statementTimeout: `${config.database.statementTimeout}ms`,
      poolMax: config.database.poolMax
    },
    auth: {
      jwtSecret: '****' + config.auth.jwtSecret.slice(-4), // Show last 4 chars
      jwtExpiresIn: config.auth.jwtExpiresIn
    },
    cors: {
      origins: config.cors.origins
    },
    redis: {
      configured: !!config.redis.url
    },
    logging: {
      level: config.logging.level
    }
  };

  logger.info('Configuration loaded:');
  console.log(JSON.stringify(summary, null, 2));
}

/**
 * Initialize and validate configuration
 * Call this at server startup before other initializations
 */
export function initConfig(): AppConfig {
  const { valid, errors, warnings } = validateConfig();

  // Log warnings
  for (const warning of warnings) {
    logger.warn(warning);
  }

  // Fail on errors
  if (!valid) {
    logger.error('Configuration validation failed:');
    for (const error of errors) {
      logger.error(`  - ${error}`);
    }
    process.exit(1);
  }

  // Print summary in development
  if (process.env.NODE_ENV !== 'production') {
    printConfigSummary();
  }

  return getConfig();
}

export default { initConfig, getConfig, validateConfig };
