/**
 * Standardized API Error Handling System
 * 
 * Provides consistent error responses, logging, and monitoring across all API endpoints
 */

import { NextResponse } from 'next/server';
import { logger } from './structured-logger';

export enum ErrorCode {
  // Authentication & Authorization (4xx)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  
  // Validation Errors (4xx)
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // Resource Errors (4xx)
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // Rate Limiting (4xx)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // External Service Errors (5xx)
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  FIREBASE_ERROR = 'FIREBASE_ERROR',
  
  // Internal Errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT'
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: any;
  statusCode: number;
  requestId?: string;
  timestamp: string;
}

export interface ApiErrorOptions {
  code: ErrorCode;
  message: string;
  details?: any;
  statusCode?: number;
  cause?: Error;
  context?: Record<string, any>;
}

export class StandardizedApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly requestId: string;
  public readonly timestamp: string;
  public readonly context?: Record<string, any>;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = 'StandardizedApiError';
    this.code = options.code;
    this.details = options.details;
    this.context = options.context;
    this.requestId = generateRequestId();
    this.timestamp = new Date().toISOString();
    
    // Map error codes to HTTP status codes
    this.statusCode = options.statusCode || this.getDefaultStatusCode(options.code);
    
    // Log the error with appropriate level
    this.logError(options.cause);
  }

  private getDefaultStatusCode(code: ErrorCode): number {
    const statusMap: Record<ErrorCode, number> = {
      [ErrorCode.UNAUTHORIZED]: 401,
      [ErrorCode.FORBIDDEN]: 403,
      [ErrorCode.INVALID_TOKEN]: 401,
      [ErrorCode.INVALID_INPUT]: 400,
      [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
      [ErrorCode.INVALID_FORMAT]: 400,
      [ErrorCode.NOT_FOUND]: 404,
      [ErrorCode.ALREADY_EXISTS]: 409,
      [ErrorCode.CONFLICT]: 409,
      [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
      [ErrorCode.QUOTA_EXCEEDED]: 429,
      [ErrorCode.DATABASE_ERROR]: 500,
      [ErrorCode.EXTERNAL_API_ERROR]: 502,
      [ErrorCode.FIREBASE_ERROR]: 500,
      [ErrorCode.INTERNAL_ERROR]: 500,
      [ErrorCode.SERVICE_UNAVAILABLE]: 503,
      [ErrorCode.TIMEOUT]: 504
    };
    return statusMap[code] || 500;
  }

  private logError(cause?: Error): void {
    const logContext = {
      errorCode: this.code,
      statusCode: this.statusCode,
      requestId: this.requestId,
      details: this.details,
      ...this.context
    };

    if (this.statusCode >= 500) {
      // Server errors - log as error with full details
      logger.error(this.message, logContext, cause || this);
    } else if (this.statusCode === 429) {
      // Rate limiting - log as warning
      logger.warn(this.message, logContext);
    } else {
      // Client errors - log as info for monitoring
      logger.info(this.message, logContext);
    }
  }

  public toResponse(): NextResponse {
    const errorResponse: ApiError = {
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
      requestId: this.requestId,
      timestamp: this.timestamp
    };

    return NextResponse.json(errorResponse, { 
      status: this.statusCode,
      headers: {
        'X-Request-ID': this.requestId,
        'Content-Type': 'application/json'
      }
    });
  }
}

/**
 * Generate a unique request ID for error tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Handle unknown errors and convert them to standardized format
 */
export function handleUnknownError(error: unknown, context?: Record<string, any>): StandardizedApiError {
  if (error instanceof StandardizedApiError) {
    return error;
  }

  if (error instanceof Error) {
    // Firebase/Firestore errors
    if (error.message.includes('firestore') || error.message.includes('firebase')) {
      return new StandardizedApiError({
        code: ErrorCode.FIREBASE_ERROR,
        message: 'Database operation failed',
        details: { originalMessage: error.message },
        cause: error,
        context
      });
    }

    // Timeout errors
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return new StandardizedApiError({
        code: ErrorCode.TIMEOUT,
        message: 'Request timeout',
        details: { originalMessage: error.message },
        cause: error,
        context
      });
    }

    // Generic error wrapper
    return new StandardizedApiError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
      details: { originalMessage: error.message },
      cause: error,
      context
    });
  }

  // Unknown error type
  return new StandardizedApiError({
    code: ErrorCode.INTERNAL_ERROR,
    message: 'Unknown error occurred',
    details: { error: String(error) },
    context
  });
}

/**
 * Validation helpers for common scenarios
 */
export const ValidationErrors = {
  missingField: (field: string) => new StandardizedApiError({
    code: ErrorCode.MISSING_REQUIRED_FIELD,
    message: `Missing required field: ${field}`,
    details: { field }
  }),

  invalidFormat: (field: string, expectedFormat: string) => new StandardizedApiError({
    code: ErrorCode.INVALID_FORMAT,
    message: `Invalid format for field: ${field}`,
    details: { field, expectedFormat }
  }),

  unauthorized: (reason?: string) => new StandardizedApiError({
    code: ErrorCode.UNAUTHORIZED,
    message: reason || 'Authentication required',
    details: reason ? { reason } : undefined
  }),

  forbidden: (reason?: string) => new StandardizedApiError({
    code: ErrorCode.FORBIDDEN,
    message: reason || 'Access denied',
    details: reason ? { reason } : undefined
  }),

  notFound: (resource: string, id?: string) => new StandardizedApiError({
    code: ErrorCode.NOT_FOUND,
    message: `${resource} not found`,
    details: id ? { resource, id } : { resource }
  }),

  rateLimitExceeded: (limit: number, window: string) => new StandardizedApiError({
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    message: 'Rate limit exceeded',
    details: { limit, window }
  })
};

/**
 * Wrapper function to handle API endpoint errors consistently
 */
export function withErrorHandling<T>(
  handler: () => Promise<T>,
  context?: Record<string, any>
): Promise<T | NextResponse> {
  return handler().catch(error => {
    const apiError = handleUnknownError(error, context);
    return apiError.toResponse();
  });
}

/**
 * Middleware to add request ID to all API responses
 */
export function addRequestId(response: NextResponse): NextResponse {
  if (!response.headers.get('X-Request-ID')) {
    response.headers.set('X-Request-ID', generateRequestId());
  }
  return response;
}