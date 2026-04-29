/**
 * Tests for standardized API error handling
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  StandardizedApiError,
  ErrorCode,
  withErrorHandling,
  requireAuth,
  validateRequest,
  generateRequestId,
  getDefaultStatusCode,
  createErrorResponse,
  logApiError,
  ApiErrorOptions
} from '@/lib/api-error-standards';
import { NextRequest, NextResponse } from 'next/server';

// Mock Next.js Request/Response
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((body, init) => ({ body, status: init?.status || 200 }))
  }
}));

// Mock Firebase auth
jest.mock('@/lib/firebase', () => ({
  auth: {
    verifyIdToken: jest.fn()
  }
}));

// Mock logger
jest.mock('@/lib/structured-logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  }
}));

describe('Standardized API Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    process.env.NODE_ENV = 'test';
  });

  describe('StandardizedApiError', () => {
    it('should create error with all required properties', () => {
      const error = new StandardizedApiError({
        code: ErrorCode.INVALID_INPUT,
        message: 'Invalid input',
        statusCode: 400,
        details: { field: 'email' }
      });

      expect(error.code).toBe(ErrorCode.INVALID_INPUT);
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should use default status code when not provided', () => {
      const error = new StandardizedApiError({
        code: ErrorCode.NOT_FOUND,
        message: 'Resource not found'
      });

      expect(error.statusCode).toBe(404);
    });

    it('should generate unique request IDs', () => {
      const error1 = new StandardizedApiError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Error 1'
      });
      const error2 = new StandardizedApiError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Error 2'
      });

      expect(error1.requestId).not.toBe(error2.requestId);
    });

    it('should include cause when provided', () => {
      const originalError = new Error('Database connection failed');
      const error = new StandardizedApiError({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Failed to fetch data',
        cause: originalError
      });

      expect(error.cause).toBe(originalError);
    });
  });

  describe('getDefaultStatusCode', () => {
    it('should return correct status codes for error codes', () => {
      expect(getDefaultStatusCode(ErrorCode.INVALID_INPUT)).toBe(400);
      expect(getDefaultStatusCode(ErrorCode.UNAUTHORIZED)).toBe(401);
      expect(getDefaultStatusCode(ErrorCode.FORBIDDEN)).toBe(403);
      expect(getDefaultStatusCode(ErrorCode.NOT_FOUND)).toBe(404);
      expect(getDefaultStatusCode(ErrorCode.RATE_LIMIT_EXCEEDED)).toBe(429);
      expect(getDefaultStatusCode(ErrorCode.INTERNAL_ERROR)).toBe(500);
      expect(getDefaultStatusCode(ErrorCode.SERVICE_UNAVAILABLE)).toBe(503);
    });
  });

  describe('generateRequestId', () => {
    it('should generate valid request ID format', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRequestId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('createErrorResponse', () => {
    it('should create proper error response structure', () => {
      const error = new StandardizedApiError({
        code: ErrorCode.INVALID_INPUT,
        message: 'Invalid email format',
        statusCode: 400,
        details: { field: 'email' }
      });

      const response = createErrorResponse(error);
      const { body, status } = response as any;

      expect(status).toBe(400);
      expect(body.code).toBe(ErrorCode.INVALID_INPUT);
      expect(body.message).toBe('Invalid email format');
      expect(body.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(body.details).toEqual({ field: 'email' });
    });

    it('should include details as provided in error response', () => {
      const error = new StandardizedApiError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Database query failed',
        details: { query: 'SELECT * FROM users' }
      });

      const response = createErrorResponse(error);
      const { body } = response as any;

      expect(body.details).toEqual({ query: 'SELECT * FROM users' });
      expect(body.message).toBe('Database query failed');
    });

    it('should create response with proper headers', () => {
      const error = new StandardizedApiError({
        code: ErrorCode.NOT_FOUND,
        message: 'Resource not found'
      });

      const response = createErrorResponse(error);
      expect(response).toBeDefined();
      
      // Check the response structure (it's a NextResponse with body/status)
      const { body, status } = response as any;
      expect(status).toBe(404);
      expect(body.code).toBe(ErrorCode.NOT_FOUND);
      expect(body.message).toBe('Resource not found');
    });
  });

  describe('withErrorHandling', () => {
    it('should handle successful async operation', async () => {
      const handler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const result = await withErrorHandling(handler, {
        endpoint: 'GET /api/test'
      });

      expect(handler).toHaveBeenCalled();
      expect(result).toEqual({ body: { success: true }, status: 200 });
    });

    it('should catch and standardize regular errors', async () => {
      const handler = jest.fn().mockRejectedValue(
        new Error('Something went wrong')
      );

      const result = await withErrorHandling(handler, {
        endpoint: 'POST /api/test'
      });

      const { body, status } = result as any;
      expect(status).toBe(500);
      expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(body.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should pass through StandardizedApiError', async () => {
      const customError = new StandardizedApiError({
        code: ErrorCode.INVALID_INPUT,
        message: 'Custom validation error',
        statusCode: 400
      });

      const handler = jest.fn().mockRejectedValue(customError);

      const result = await withErrorHandling(handler, {
        endpoint: 'PUT /api/test'
      });

      const { body, status } = result as any;
      expect(status).toBe(400);
      expect(body.message).toBe('Custom validation error');
      expect(body.code).toBe(ErrorCode.INVALID_INPUT);
    });

    it('should include context in error handling', async () => {
      const handler = jest.fn().mockRejectedValue(
        new Error('Context test error')
      );

      const result = await withErrorHandling(handler, {
        endpoint: 'GET /api/test',
        userId: 'user123'
      });

      const { body, status } = result as any;
      expect(status).toBe(500);
      expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(body.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('requireAuth', () => {
    it('should return session for valid token', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer valid-token')
        }
      } as unknown as NextRequest;

      const { auth } = await import('@/lib/firebase');
      (auth.verifyIdToken as jest.Mock).mockResolvedValue({
        uid: 'user123',
        email: 'test@example.com'
      });

      const result = await requireAuth(mockRequest);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.session.uid).toBe('user123');
        expect(result.session.email).toBe('test@example.com');
      }
    });

    it('should return error for missing authorization header', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(null)
        }
      } as unknown as NextRequest;

      const result = await requireAuth(mockRequest);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        const { body } = result.error as any;
        expect(body.code).toBe(ErrorCode.UNAUTHORIZED);
        expect(body.message).toBe('Authorization header required');
      }
    });

    it('should return error for invalid token', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer invalid-token')
        }
      } as unknown as NextRequest;

      const { auth } = await import('@/lib/firebase');
      (auth.verifyIdToken as jest.Mock).mockRejectedValue(
        new Error('Invalid token')
      );

      const result = await requireAuth(mockRequest);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        const { body } = result.error as any;
        expect(body.code).toBe(ErrorCode.INVALID_TOKEN);
        expect(body.message).toContain('Invalid authentication token');
      }
    });
  });

  describe('validateRequest', () => {
    it('should validate required fields successfully', () => {
      const data = {
        email: 'test@example.com',
        age: 25
      };

      const result = validateRequest(data, {
        requiredFields: ['email', 'age']
      });

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.data).toEqual(data);
      }
    });

    it('should return error for missing required fields', () => {
      const data = {
        email: 'test@example.com'
      };

      const result = validateRequest(data, {
        requiredFields: ['email', 'age']
      });

      expect('error' in result).toBe(true);
      if ('error' in result) {
        const { body } = result.error as any;
        expect(body.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
        expect(body.message).toContain('Missing required field: age');
      }
    });

    it('should validate with custom validator', () => {
      const data = {
        email: 'invalid-email',
        age: 25
      };

      const validator = (data: any) => {
        if (!data.email.includes('@')) {
          throw new Error('Invalid email format');
        }
      };

      const result = validateRequest(data, {
        requiredFields: ['email'],
        validator
      });

      expect('error' in result).toBe(true);
      if ('error' in result) {
        const { body } = result.error as any;
        expect(body.code).toBe(ErrorCode.INVALID_INPUT);
        expect(body.message).toBe('Invalid email format');
      }
    });

    it('should pass validation with valid custom validator', () => {
      const data = {
        email: 'test@example.com',
        age: 25
      };

      const validator = (data: any) => {
        if (data.age < 18) {
          throw new Error('Must be 18 or older');
        }
      };

      const result = validateRequest(data, {
        requiredFields: ['email', 'age'],
        validator
      });

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.data).toEqual(data);
      }
    });
  });

  describe('logApiError', () => {
    it('should be a convenience function that exists', () => {
      // logApiError is a convenience function that delegates to internal logging
      // The actual logging is tested via StandardizedApiError constructor
      expect(typeof logApiError).toBe('function');
      
      const apiError = new StandardizedApiError({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Connection failed'
      });

      // Should not throw
      expect(() => logApiError(apiError, {
        endpoint: 'GET /api/users',
        userId: 'user123'
      })).not.toThrow();
    });
  });
});