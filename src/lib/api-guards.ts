/**
 * API Route Guard Utilities
 *
 * Common validation and security checks for API routes
 */

import { NextResponse } from 'next/server';
import { Firestore } from 'firebase/firestore';
import { rateLimit } from './rate-limiter';

/**
 * Check if database is available
 * Returns error response if not available
 */
export function checkDatabaseAvailable(db: Firestore | null | undefined): NextResponse | null {
  if (!db) {
    console.error('[API Guard] Database not available');
    return NextResponse.json(
      { error: 'Database not available' },
      { status: 500 }
    );
  }
  return null;
}

/**
 * Apply rate limiting to a request
 * Returns error response if rate limit exceeded
 */
export async function applyRateLimit(
  key: string,
  maxRequests: number = 60,
  windowSeconds: number = 60
): Promise<NextResponse | null> {
  const rateLimitResult = await rateLimit(key, maxRequests, windowSeconds);

  if (!rateLimitResult.allowed) {
    console.warn(`[API Guard] Rate limit exceeded for key: ${key}`);
    return NextResponse.json(
      {
        error: 'Too many requests',
        retryAfter: rateLimitResult.retryAfter
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter || windowSeconds),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(Math.floor(rateLimitResult.resetAt / 1000))
        }
      }
    );
  }

  return null;
}

/**
 * Get client IP address from request headers
 */
export function getClientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0].trim() ||
         headers.get('x-real-ip') ||
         headers.get('cf-connecting-ip') || // Cloudflare
         'unknown';
}

/**
 * Validate required query parameters
 * Returns error response if validation fails
 */
export function validateRequiredParams(
  params: Record<string, string | null>,
  required: string[]
): NextResponse | null {
  const missing = required.filter(key => !params[key] || params[key]?.trim() === '');

  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: 'Missing required parameters',
        missing,
        required
      },
      { status: 400 }
    );
  }

  return null;
}

/**
 * Validate numeric parameter
 * Returns error response if invalid
 */
export function validateNumericParam(
  value: string | null,
  paramName: string,
  options: {
    min?: number;
    max?: number;
    integer?: boolean;
  } = {}
): { value: number; error: NextResponse | null } {
  if (!value) {
    return {
      value: 0,
      error: NextResponse.json(
        { error: `Missing required parameter: ${paramName}` },
        { status: 400 }
      )
    };
  }

  const parsed = options.integer ? parseInt(value) : parseFloat(value);

  if (isNaN(parsed)) {
    return {
      value: 0,
      error: NextResponse.json(
        { error: `Invalid ${paramName}: must be a number` },
        { status: 400 }
      )
    };
  }

  if (options.min !== undefined && parsed < options.min) {
    return {
      value: 0,
      error: NextResponse.json(
        { error: `Invalid ${paramName}: must be at least ${options.min}` },
        { status: 400 }
      )
    };
  }

  if (options.max !== undefined && parsed > options.max) {
    return {
      value: 0,
      error: NextResponse.json(
        { error: `Invalid ${paramName}: must be at most ${options.max}` },
        { status: 400 }
      )
    };
  }

  return { value: parsed, error: null };
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  message: string,
  error?: unknown,
  statusCode: number = 500
): NextResponse {
  console.error(`[API Error] ${message}:`, error);

  return NextResponse.json(
    {
      error: message,
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    },
    { status: statusCode }
  );
}
