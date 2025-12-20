/**
 * Jest test setup for Street Legacy server
 * This file runs before each test file
 */

import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Mock database pool
jest.mock('../db/connection.js', () => ({
  default: {
    query: jest.fn(),
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn()
    })),
    on: jest.fn(),
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0
  },
  queryWithRetry: jest.fn((fn: () => any) => fn()),
  getPoolHealth: jest.fn(() => ({
    healthy: true,
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0,
    totalConnections: 10,
    activeQueries: 2,
    errors: 0
  })),
  closePool: jest.fn()
}));

// Mock cache
jest.mock('../utils/cache.js', () => ({
  cache: {
    get: jest.fn(() => Promise.resolve(null)),
    set: jest.fn(() => Promise.resolve()),
    delete: jest.fn(() => Promise.resolve()),
    deletePattern: jest.fn(() => Promise.resolve()),
    exists: jest.fn(() => Promise.resolve(false)),
    mget: jest.fn(() => Promise.resolve([])),
    mset: jest.fn(() => Promise.resolve()),
    getOrSet: jest.fn((key: string, callback: () => any) => callback()),
    isConnected: jest.fn(() => true)
  },
  cacheKeys: {
    player: (id: number) => `player:${id}`,
    playerStats: (id: number) => `player:${id}:stats`,
    allDistricts: () => 'static:districts',
    allCrimes: () => 'static:crimes',
    leaderboardEarnings: () => 'leaderboard:earnings',
    leaderboardLevel: () => 'leaderboard:level',
    leaderboardCrew: () => 'leaderboard:crews'
  },
  cacheTTL: {
    veryShort: 10,
    short: 30,
    medium: 300,
    long: 3600,
    veryLong: 86400
  },
  cacheInvalidation: {
    invalidatePlayer: jest.fn(),
    invalidateCrew: jest.fn(),
    invalidateLeaderboards: jest.fn(),
    invalidateTerritory: jest.fn(),
    invalidateStatic: jest.fn()
  },
  default: {
    get: jest.fn(() => Promise.resolve(null)),
    set: jest.fn(() => Promise.resolve()),
    getOrSet: jest.fn((key: string, callback: () => any) => callback())
  }
}));

// Global test timeout
jest.setTimeout(10000);

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Clean up after all tests
afterAll(async () => {
  // Give time for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Helper function to create mock request
export function mockRequest(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    player: { id: 1, username: 'testuser' },
    ...overrides
  };
}

// Helper function to create mock response
export function mockResponse() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

// Helper function to create mock next function
export function mockNext() {
  return jest.fn();
}
