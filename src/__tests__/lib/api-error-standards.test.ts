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
jest.mock('@/lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
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
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid input',
        statusCode: 400,
        details: { field: 'email' }
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.requestId).toMatch(/^req_[a-z0-9]{12}$/);
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
      expect(getDefaultStatusCode(ErrorCode.VALIDATION_ERROR)).toBe(400);
      expect(getDefaultStatusCode(ErrorCode.AUTHENTICATION_REQUIRED)).toBe(401);
      expect(getDefaultStatusCode(ErrorCode.PERMISSION_DENIED)).toBe(403);
      expect(getDefaultStatusCode(ErrorCode.NOT_FOUND)).toBe(404);
      expect(getDefaultStatusCode(ErrorCode.RATE_LIMIT_EXCEEDED)).toBe(429);
      expect(getDefaultStatusCode(ErrorCode.INTERNAL_ERROR)).toBe(500);
      expect(getDefaultStatusCode(ErrorCode.SERVICE_UNAVAILABLE)).toBe(503);
    });
  });

  describe('generateRequestId', () => {
    it('should generate valid request ID format', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^req_[a-z0-9]{12}$/);
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
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid email format',
        statusCode: 400,
        details: { field: 'email' }
      });

      const response = createErrorResponse(error);
      const { body, status } = response as any;

      expect(status).toBe(400);
      expect(body.error).toBe(true);
      expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(body.message).toBe('Invalid email format');
      expect(body.requestId).toMatch(/^req_/);
      expect(body.details).toEqual({ field: 'email' });
    });

    it('should exclude details in production for internal errors', () => {
      process.env.NODE_ENV = 'production';
      
      const error = new StandardizedApiError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Database query failed',
        details: { query: 'SELECT * FROM users' }
      });

      const response = createErrorResponse(error);
      const { body } = response as any;

      expect(body.details).toBeUndefined();
      expect(body.message).toBe('An internal error occurred');
    });

    it('should include details in development', () => {
      process.env.NODE_ENV = 'development';
      
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
      expect(body.error).toBe(true);
      expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(body.requestId).toMatch(/^req_/);
    });

    it('should pass through StandardizedApiError', async () => {
      const customError = new StandardizedApiError({
        code: ErrorCode.VALIDATION_ERROR,
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
      expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should use custom error handler when provided', async () => {
      const customHandler = jest.fn().mockReturnValue(
        NextResponse.json({ custom: true }, { status: 418 })
      );

      const handler = jest.fn().mockRejectedValue(
        new Error('Tea time')
      );

      const result = await withErrorHandling(handler, {
        endpoint: 'GET /api/teapot',
        customErrorHandler: customHandler
      });

      expect(customHandler).toHaveBeenCalled();
      expect(result).toEqual({ body: { custom: true }, status: 418 });
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
        expect(body.code).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
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
        expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
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
        expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
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
    it('should log error with context', () => {
      const { error: logger } = require('@/lib/logger');
      const apiError = new StandardizedApiError({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Connection failed'
      });

      logApiError(apiError, {
        endpoint: 'GET /api/users',
        userId: 'user123'
      });

      expect(logger).toHaveBeenCalledWith(
        expect.stringContaining('API Error'),
        expect.objectContaining({
          code: ErrorCode.DATABASE_ERROR,
          requestId: expect.stringMatching(/^req_/),
          endpoint: 'GET /api/users',
          userId: 'user123'
        })
      );
    });

    it('should include cause in error log', () => {
      const { error: logger } = require('@/lib/logger');
      const originalError = new Error('Connection timeout');
      const apiError = new StandardizedApiError({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Failed to fetch data',
        cause: originalError
      });

      logApiError(apiError, {
        endpoint: 'POST /api/properties'
      });

      expect(logger).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cause: 'Connection timeout'
        })
      );
    });
  });
});