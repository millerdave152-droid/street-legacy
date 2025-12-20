/**
 * Simple logging utility for Street Legacy
 * Can be extended to use Winston or other logging libraries
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatLog(entry: LogEntry): string {
  const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${contextStr}`;
}

function createLogEntry(level: LogLevel, message: string, context?: Record<string, any>): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context
  };
}

export const logger = {
  debug(message: string, context?: Record<string, any>) {
    if (shouldLog('debug')) {
      console.debug(formatLog(createLogEntry('debug', message, context)));
    }
  },

  info(message: string, context?: Record<string, any>) {
    if (shouldLog('info')) {
      console.info(formatLog(createLogEntry('info', message, context)));
    }
  },

  warn(message: string, context?: Record<string, any>) {
    if (shouldLog('warn')) {
      console.warn(formatLog(createLogEntry('warn', message, context)));
    }
  },

  error(message: string, error?: Error | any, context?: Record<string, any>) {
    if (shouldLog('error')) {
      const errorContext = error instanceof Error
        ? { ...context, errorMessage: error.message, stack: error.stack }
        : { ...context, error };
      console.error(formatLog(createLogEntry('error', message, errorContext)));
    }
  },

  // Specialized loggers for common operations
  api: {
    request(method: string, path: string, userId?: number) {
      logger.info(`API Request: ${method} ${path}`, { userId });
    },

    response(method: string, path: string, statusCode: number, duration: number) {
      const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
      logger[level](`API Response: ${method} ${path} ${statusCode} (${duration}ms)`);
    },

    error(method: string, path: string, error: Error, userId?: number) {
      logger.error(`API Error: ${method} ${path}`, error, { userId });
    }
  },

  db: {
    query(query: string, duration: number) {
      if (duration > 100) {
        logger.warn(`Slow DB Query (${duration}ms)`, { query: query.substring(0, 200) });
      } else {
        logger.debug(`DB Query (${duration}ms)`, { query: query.substring(0, 100) });
      }
    },

    error(operation: string, error: Error) {
      logger.error(`DB Error: ${operation}`, error);
    }
  },

  game: {
    action(playerId: number, action: string, details?: Record<string, any>) {
      logger.info(`Game Action: ${action}`, { playerId, ...details });
    },

    crime(playerId: number, crimeId: number, success: boolean, cashGained: number) {
      logger.info('Crime committed', { playerId, crimeId, success, cashGained });
    },

    levelUp(playerId: number, newLevel: number) {
      logger.info('Player leveled up', { playerId, newLevel });
    }
  },

  auth: {
    login(userId: number, username: string) {
      logger.info('User logged in', { userId, username });
    },

    logout(userId: number) {
      logger.info('User logged out', { userId });
    },

    register(userId: number, username: string) {
      logger.info('New user registered', { userId, username });
    },

    failedLogin(username: string, reason: string) {
      logger.warn('Failed login attempt', { username, reason });
    }
  },

  security: {
    rateLimit(ip: string, path: string) {
      logger.warn('Rate limit exceeded', { ip, path });
    },

    suspiciousActivity(userId: number, activity: string, details?: Record<string, any>) {
      logger.warn('Suspicious activity detected', { userId, activity, ...details });
    }
  }
};

export default logger;
