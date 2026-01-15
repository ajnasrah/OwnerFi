/**
 * Distributed rate limiter using Vercel KV (Redis)
 * Falls back to in-memory store in development or if KV is unavailable
 */

import { kv } from '@vercel/kv';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory fallback for development or when KV is unavailable
const rateLimitStore = new Map<string, RateLimitEntry>();

// Check if Vercel KV is configured
function isKVConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// Clean up expired in-memory entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Rate limit using Vercel KV (distributed Redis)
 * Uses atomic INCR to prevent race conditions
 *
 * KV calls per request:
 * - First request: INCR + EXPIRE = 2 calls
 * - Subsequent: INCR + TTL = 2 calls
 */
async function rateLimitWithKV(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number; retryAfter?: number }> {
  const now = Date.now();
  const kvKey = `ratelimit:${key}`;

  try {
    const count = await kv.incr(kvKey);

    let resetAt: number;

    if (count === 1) {
      // First request - set TTL, we know reset time
      await kv.expire(kvKey, windowSeconds);
      resetAt = now + (windowSeconds * 1000);
    } else {
      // Subsequent requests - get TTL to calculate reset time
      const ttl = await kv.ttl(kvKey);
      resetAt = ttl > 0 ? now + (ttl * 1000) : now + (windowSeconds * 1000);
    }

    if (count > maxRequests) {
      const retryAfter = Math.ceil((resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.max(1, retryAfter)
      };
    }

    return {
      allowed: true,
      remaining: maxRequests - count,
      resetAt
    };
  } catch (error) {
    console.error('Vercel KV rate limit error:', error);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + (windowSeconds * 1000)
    };
  }
}

/**
 * Rate limit using in-memory store (development fallback)
 */
function rateLimitInMemory(
  key: string,
  maxRequests: number,
  windowSeconds: number
): { allowed: boolean; remaining: number; resetAt: number; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (entry && entry.resetAt < now) {
    rateLimitStore.delete(key);
  }

  const current = rateLimitStore.get(key);

  if (!current) {
    const resetAt = now + (windowSeconds * 1000);
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (current.count >= maxRequests) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfter
    };
  }

  current.count++;
  return {
    allowed: true,
    remaining: maxRequests - current.count,
    resetAt: current.resetAt
  };
}

/**
 * Rate limit a key. Uses Vercel KV in production, in-memory otherwise.
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number; retryAfter?: number }> {
  if (isKVConfigured() && process.env.NODE_ENV === 'production') {
    return rateLimitWithKV(key, maxRequests, windowSeconds);
  }
  return rateLimitInMemory(key, maxRequests, windowSeconds);
}
