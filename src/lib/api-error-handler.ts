/**
 * Standardized API Error Handling
 *
 * This module provides consistent error handling across all API routes.
 * All API routes should use these utilities for error responses.
 */

import { NextResponse } from 'next/server';

export enum ErrorCode {
  // Client Errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_REQUEST = 'INVALID_REQUEST',

  // Server Errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
}

export interface ApiError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    timestamp: string;
  };
}

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  statusCode: number,
  details?: unknown
): NextResponse<ApiError> {
  const response: ApiError = {
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      ...(details && process.env.NODE_ENV !== 'production' ? { details } : {})
    }
  };

  return NextResponse.json(response, { status: statusCode });
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({
    success: true,
    data
  }, { status: statusCode });
}

/**
 * Common error responses - ready to use
 */
export const ErrorResponses = {
  // 400 Bad Request
  validationError: (message: string, details?: unknown) =>
    createErrorResponse(ErrorCode.VALIDATION_ERROR, message, 400, details),

  invalidRequest: (message: string = 'Invalid request body') =>
    createErrorResponse(ErrorCode.INVALID_REQUEST, message, 400),

  // 401 Unauthorized
  unauthorized: (message: string = 'Authentication required') =>
    createErrorResponse(ErrorCode.AUTHENTICATION_ERROR, message, 401),

  // 403 Forbidden
  forbidden: (message: string = 'Insufficient permissions') =>
    createErrorResponse(ErrorCode.AUTHORIZATION_ERROR, message, 403),

  // 404 Not Found
  notFound: (resource: string = 'Resource') =>
    createErrorResponse(ErrorCode.NOT_FOUND, `${resource} not found`, 404),

  // 409 Conflict
  conflict: (message: string) =>
    createErrorResponse(ErrorCode.CONFLICT, message, 409),

  // 429 Too Many Requests
  rateLimitExceeded: (message: string = 'Too many requests') =>
    createErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429),

  // 500 Internal Server Error
  internalError: (message: string = 'Internal server error', details?: unknown) =>
    createErrorResponse(ErrorCode.INTERNAL_ERROR, message, 500, details),

  // 500 Database Error
  databaseError: (message: string = 'Database operation failed', details?: unknown) =>
    createErrorResponse(ErrorCode.DATABASE_ERROR, message, 500, details),

  // 500 Config Error
  configError: (message: string) =>
    createErrorResponse(ErrorCode.CONFIG_ERROR, message, 500),

  // 502 External API Error
  externalApiError: (service: string, details?: unknown) =>
    createErrorResponse(
      ErrorCode.EXTERNAL_API_ERROR,
      `External service error: ${service}`,
      502,
      details
    ),

  // 503 Service Unavailable
  serviceUnavailable: (message: string = 'Service temporarily unavailable') =>
    createErrorResponse(ErrorCode.SERVICE_UNAVAILABLE, message, 503),

  // 504 Timeout
  timeout: (operation: string = 'Operation') =>
    createErrorResponse(ErrorCode.TIMEOUT_ERROR, `${operation} timed out`, 504),
};

/**
 * Log error with context
 */
export function logError(
  context: string,
  error: unknown,
  additionalInfo?: Record<string, unknown>
): void {
  const errorInfo = {
    context,
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
    ...additionalInfo,
  };

  console.error(`[API Error] ${context}:`, JSON.stringify(errorInfo, null, 2));

  // TODO: Send to error monitoring service (Sentry, etc.)
  // if (process.env.SENTRY_DSN) {
  //   Sentry.captureException(error, { contexts: { custom: errorInfo } });
  // }
}

/**
 * Handle unknown errors safely
 */
export function handleUnknownError(
  error: unknown,
  context: string,
  additionalInfo?: Record<string, unknown>
): NextResponse<ApiError> {
  logError(context, error, additionalInfo);

  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  return ErrorResponses.internalError(message, error);
}

/**
 * Wrap async route handler with error logging
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  context: string
): T {
  return (async (...args: Parameters<T>): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleUnknownError(error, context);
    }
  }) as T;
}

/**
 * Parse and validate request body with error handling
 */
export async function parseRequestBody<T>(
  request: Request
): Promise<{ success: true; data: T } | { success: false; response: NextResponse<ApiError> }> {
  try {
    const body = await request.json();
    return { success: true, data: body as T };
  } catch (error) {
    return {
      success: false,
      response: ErrorResponses.invalidRequest('Invalid JSON in request body')
    };
  }
}
