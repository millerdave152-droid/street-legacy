/**
 * Error Handler Middleware Tests
 * Tests for global error handling
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import {
  ApiError,
  Errors,
  globalErrorHandler,
  notFoundHandler,
  asyncHandler,
} from '../../middleware/errorHandler.js';

// Mock logger to prevent console output during tests
jest.unstable_mockModule('../utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Helper to create mock request
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    path: '/test',
    method: 'GET',
    headers: {},
    ...overrides,
  } as Request;
}

// Helper to create mock response
function createMockResponse(): Response & { jsonData?: any; statusCode?: number } {
  const res: any = {};
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((data: any) => {
    res.jsonData = data;
    return res;
  });
  return res;
}

describe('ApiError Class', () => {
  it('should create an error with default values', () => {
    const error = new ApiError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.isOperational).toBe(true);
  });

  it('should create an error with custom values', () => {
    const error = new ApiError('Not found', 404, 'NOT_FOUND', { id: 123 });
    expect(error.message).toBe('Not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.details).toEqual({ id: 123 });
  });

  it('should be an instance of Error', () => {
    const error = new ApiError('Test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
  });

  it('should have a stack trace', () => {
    const error = new ApiError('Test');
    expect(error.stack).toBeDefined();
  });
});

describe('Errors Factory', () => {
  describe('Client Errors (4xx)', () => {
    it('should create badRequest error', () => {
      const error = Errors.badRequest('Invalid data');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Invalid data');
    });

    it('should create validationFailed error', () => {
      const error = Errors.validationFailed('Validation failed', { field: 'email' });
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should create unauthorized error', () => {
      const error = Errors.unauthorized();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should create invalidCredentials error', () => {
      const error = Errors.invalidCredentials();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should create tokenExpired error', () => {
      const error = Errors.tokenExpired();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('TOKEN_EXPIRED');
    });

    it('should create forbidden error', () => {
      const error = Errors.forbidden();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should create accountBanned error with reason', () => {
      const error = Errors.accountBanned('Cheating detected');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('ACCOUNT_BANNED');
      expect(error.message).toBe('Cheating detected');
    });

    it('should create notFound error', () => {
      const error = Errors.notFound('Player');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Player not found');
    });

    it('should create conflict error', () => {
      const error = Errors.conflict('Already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });

    it('should create alreadyExists error', () => {
      const error = Errors.alreadyExists('Username');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('ALREADY_EXISTS');
      expect(error.message).toBe('Username already exists');
    });

    it('should create rateLimitExceeded error', () => {
      const error = Errors.rateLimitExceeded(60);
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.details).toEqual({ retryAfter: 60 });
    });
  });

  describe('Game-Specific Errors (422)', () => {
    it('should create insufficientFunds error', () => {
      const error = Errors.insufficientFunds(1000, 500);
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('INSUFFICIENT_FUNDS');
      expect(error.details).toEqual({ required: 1000, available: 500 });
    });

    it('should create insufficientEnergy error', () => {
      const error = Errors.insufficientEnergy(10, 5);
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('INSUFFICIENT_ENERGY');
      expect(error.details).toEqual({ required: 10, available: 5 });
    });

    it('should create insufficientNerve error', () => {
      const error = Errors.insufficientNerve(5, 2);
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('INSUFFICIENT_NERVE');
      expect(error.details).toEqual({ required: 5, available: 2 });
    });

    it('should create cooldownActive error', () => {
      const error = Errors.cooldownActive(30);
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('COOLDOWN_ACTIVE');
      expect(error.message).toContain('30 seconds');
    });

    it('should create levelTooLow error', () => {
      const error = Errors.levelTooLow(10, 5);
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('LEVEL_TOO_LOW');
      expect(error.details).toEqual({ required: 10, current: 5 });
    });

    it('should create inJail error', () => {
      const error = Errors.inJail();
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('IN_JAIL');
    });
  });

  describe('Server Errors (5xx)', () => {
    it('should create internal error', () => {
      const error = Errors.internal();
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('should create databaseError', () => {
      const error = Errors.databaseError();
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('DATABASE_ERROR');
    });

    it('should create serviceUnavailable error', () => {
      const error = Errors.serviceUnavailable();
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should create maintenanceMode error', () => {
      const error = Errors.maintenanceMode();
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('MAINTENANCE_MODE');
    });
  });
});

describe('Global Error Handler', () => {
  let mockReq: Request;
  let mockRes: Response & { jsonData?: any; statusCode?: number };
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = jest.fn() as NextFunction;
  });

  it('should handle ApiError', () => {
    const error = Errors.notFound('Player');

    globalErrorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.jsonData).toEqual({
      success: false,
      error: 'Player not found',
      code: 'NOT_FOUND',
      details: undefined,
      requestId: undefined,
    });
  });

  it('should handle ZodError', () => {
    const schema = z.object({ name: z.string().min(3) });
    let zodError: ZodError | null = null;

    try {
      schema.parse({ name: 'ab' });
    } catch (e) {
      zodError = e as ZodError;
    }

    globalErrorHandler(zodError!, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.jsonData.success).toBe(false);
    expect(mockRes.jsonData.code).toBe('VALIDATION_FAILED');
    expect(mockRes.jsonData.details.fields).toBeDefined();
  });

  it('should handle PostgreSQL unique violation error', () => {
    const pgError: any = new Error('duplicate key');
    pgError.code = '23505';

    globalErrorHandler(pgError, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(409);
    expect(mockRes.jsonData.code).toBe('DUPLICATE_KEY');
  });

  it('should handle PostgreSQL foreign key violation', () => {
    const pgError: any = new Error('foreign key violation');
    pgError.code = '23503';

    globalErrorHandler(pgError, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(422);
    expect(mockRes.jsonData.code).toBe('FOREIGN_KEY_VIOLATION');
  });

  it('should handle PostgreSQL not null violation', () => {
    const pgError: any = new Error('not null violation');
    pgError.code = '23502';

    globalErrorHandler(pgError, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.jsonData.code).toBe('REQUIRED_FIELD_MISSING');
  });

  it('should handle JSON syntax errors', () => {
    const syntaxError: any = new SyntaxError('Unexpected token');
    syntaxError.body = 'invalid json';

    globalErrorHandler(syntaxError, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.jsonData.code).toBe('INVALID_JSON');
  });

  it('should handle unknown errors with 500 status', () => {
    const unknownError = new Error('Something went wrong');

    globalErrorHandler(unknownError, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.jsonData.code).toBe('INTERNAL_ERROR');
  });

  it('should hide error details in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Secret error details');
    globalErrorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.jsonData.error).toBe('Internal server error');

    process.env.NODE_ENV = originalEnv;
  });

  it('should include request ID from headers', () => {
    mockReq = createMockRequest({
      headers: { 'x-request-id': 'req-123' },
    });

    const error = Errors.badRequest('Test');
    globalErrorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.jsonData.requestId).toBe('req-123');
  });
});

describe('Not Found Handler', () => {
  it('should return 404 with route info', () => {
    const mockReq = createMockRequest({
      method: 'GET',
      path: '/api/nonexistent',
    });
    const mockRes = createMockResponse();

    notFoundHandler(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.jsonData).toEqual({
      success: false,
      error: 'Route GET /api/nonexistent not found',
      code: 'ROUTE_NOT_FOUND',
    });
  });
});

describe('Async Handler Wrapper', () => {
  it('should pass successful results through', async () => {
    const handler = asyncHandler(async (req, res) => {
      res.json({ success: true });
    });

    const mockReq = createMockRequest() as any;
    const mockRes = createMockResponse() as any;
    const mockNext = jest.fn() as NextFunction;

    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should catch errors and pass to next', async () => {
    const testError = new Error('Test error');
    const handler = asyncHandler(async () => {
      throw testError;
    });

    const mockReq = createMockRequest() as any;
    const mockRes = createMockResponse() as any;
    const mockNext = jest.fn() as NextFunction;

    await handler(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(testError);
  });

  it('should handle async rejections', async () => {
    const testError = new Error('Async error');
    const handler = asyncHandler(async () => {
      throw testError;
    });

    const mockReq = createMockRequest() as any;
    const mockRes = createMockResponse() as any;
    const mockNext = jest.fn() as NextFunction;

    await handler(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(testError);
  });
});
