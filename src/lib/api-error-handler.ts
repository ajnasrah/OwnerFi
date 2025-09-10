import { NextResponse } from 'next/server';
import { adminDb } from './firebase-admin';

/**
 * Global API Error Handler for Firebase and Database Issues
 */

export interface ApiError extends Error {
  code?: string;
  statusCode?: number;
  details?: any;
}

export class DatabaseConnectionError extends Error {
  constructor(message: string = 'Database connection not available') {
    super(message);
    this.name = 'DatabaseConnectionError';
  }
}

export class FirebaseAuthError extends Error {
  constructor(message: string = 'Firebase authentication failed') {
    super(message);
    this.name = 'FirebaseAuthError';
  }
}

/**
 * Check if Firebase Admin is properly initialized
 */
export function checkDatabaseConnection(): boolean {
  return adminDb !== null && adminDb !== undefined;
}

/**
 * Ensure database connection is available, throw error if not
 */
export function ensureDatabaseConnection(): void {
  if (!checkDatabaseConnection()) {
    throw new DatabaseConnectionError();
  }
}

/**
 * Global error handler for API routes
 */
export function handleApiError(error: unknown, context?: string): NextResponse {
  console.error(`❌ API Error${context ? ` in ${context}` : ''}:`, error);

  // Database connection errors
  if (error instanceof DatabaseConnectionError || !checkDatabaseConnection()) {
    return NextResponse.json(
      { 
        error: 'Database service unavailable',
        code: 'DATABASE_UNAVAILABLE',
        details: 'Firebase Admin SDK not properly initialized'
      },
      { status: 503 }
    );
  }

  // Firebase authentication errors
  if (error instanceof FirebaseAuthError) {
    return NextResponse.json(
      { 
        error: 'Authentication failed',
        code: 'AUTH_FAILED'
      },
      { status: 401 }
    );
  }

  // Firebase-specific errors
  if (error && typeof error === 'object' && 'code' in error) {
    const firebaseError = error as ApiError;
    
    switch (firebaseError.code) {
      case 'permission-denied':
        return NextResponse.json(
          { 
            error: 'Access denied',
            code: 'PERMISSION_DENIED',
            details: 'Insufficient permissions for this operation'
          },
          { status: 403 }
        );
        
      case 'not-found':
        return NextResponse.json(
          { 
            error: 'Resource not found',
            code: 'NOT_FOUND'
          },
          { status: 404 }
        );
        
      case 'already-exists':
        return NextResponse.json(
          { 
            error: 'Resource already exists',
            code: 'ALREADY_EXISTS'
          },
          { status: 409 }
        );
        
      case 'invalid-argument':
        return NextResponse.json(
          { 
            error: 'Invalid request data',
            code: 'INVALID_ARGUMENT'
          },
          { status: 400 }
        );
        
      case 'deadline-exceeded':
      case 'unavailable':
        return NextResponse.json(
          { 
            error: 'Service temporarily unavailable',
            code: 'SERVICE_UNAVAILABLE'
          },
          { status: 503 }
        );
        
      case 'quota-exceeded':
        return NextResponse.json(
          { 
            error: 'Service quota exceeded',
            code: 'QUOTA_EXCEEDED'
          },
          { status: 429 }
        );
    }
  }

  // Generic server errors
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  
  return NextResponse.json(
    { 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    },
    { status: 500 }
  );
}

/**
 * Wrapper for API route handlers that provides automatic error handling
 */
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>,
  context?: string
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error, context);
    }
  };
}

/**
 * Database operation wrapper with automatic retry logic
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      ensureDatabaseConnection();
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain error types
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as ApiError;
        if (['permission-denied', 'not-found', 'invalid-argument'].includes(firebaseError.code || '')) {
          throw error; // Don't retry these errors
        }
      }
      
      if (attempt === maxRetries) {
        break; // Last attempt failed
      }
      
      console.warn(`🔄 Database operation failed (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryDelay *= 2; // Exponential backoff
    }
  }
  
  throw lastError;
}