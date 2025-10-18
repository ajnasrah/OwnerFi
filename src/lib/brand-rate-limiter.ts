/**
 * Brand-Specific Rate Limiting System
 *
 * Implements per-brand rate limiting to prevent one brand from exhausting shared API quotas.
 * Uses in-memory store with optional Redis backend for distributed deployments.
 */

import { Brand } from '@/config/constants';
import { getBrandRateLimit } from './brand-utils';

// Rate limit window in milliseconds
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

// In-memory store for rate limit tracking
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class BrandRateLimiter {
  private store: Map<string, RateLimitEntry>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.store = new Map();
    this.cleanupInterval = null;

    // Start cleanup interval (every 5 minutes)
    this.startCleanup();
  }

  /**
   * Generate rate limit key
   */
  private getKey(brand: Brand, service: 'lateAPI' | 'heygen' | 'submagic'): string {
    return `${brand}:${service}`;
  }

  /**
   * Check if rate limit is exceeded
   * @param brand - Brand identifier
   * @param service - Service type
   * @returns True if under limit, false if exceeded
   */
  public async checkLimit(
    brand: Brand,
    service: 'lateAPI' | 'heygen' | 'submagic'
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const key = this.getKey(brand, service);
    const limit = getBrandRateLimit(brand, service);
    const now = Date.now();

    let entry = this.store.get(key);

    // If no entry or expired, create new
    if (!entry || now >= entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + RATE_LIMIT_WINDOW,
      };
      this.store.set(key, entry);
    }

    // Check if under limit
    const allowed = entry.count < limit;
    const remaining = Math.max(0, limit - entry.count);

    return {
      allowed,
      remaining,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Increment rate limit counter
   * @param brand - Brand identifier
   * @param service - Service type
   * @returns Updated rate limit status
   */
  public async increment(
    brand: Brand,
    service: 'lateAPI' | 'heygen' | 'submagic'
  ): Promise<{ success: boolean; remaining: number; resetAt: number }> {
    const key = this.getKey(brand, service);
    const limit = getBrandRateLimit(brand, service);
    const now = Date.now();

    let entry = this.store.get(key);

    // If no entry or expired, create new
    if (!entry || now >= entry.resetAt) {
      entry = {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW,
      };
      this.store.set(key, entry);

      return {
        success: true,
        remaining: limit - 1,
        resetAt: entry.resetAt,
      };
    }

    // Increment counter
    entry.count += 1;
    const success = entry.count <= limit;
    const remaining = Math.max(0, limit - entry.count);

    if (!success) {
      console.warn(
        `⚠️ Rate limit exceeded for ${brand}:${service} (${entry.count}/${limit})`
      );
    }

    return {
      success,
      remaining,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Get current rate limit status
   * @param brand - Brand identifier
   * @param service - Service type
   * @returns Current rate limit status
   */
  public async getStatus(
    brand: Brand,
    service: 'lateAPI' | 'heygen' | 'submagic'
  ): Promise<{ used: number; limit: number; remaining: number; resetAt: number }> {
    const key = this.getKey(brand, service);
    const limit = getBrandRateLimit(brand, service);
    const entry = this.store.get(key);
    const now = Date.now();

    if (!entry || now >= entry.resetAt) {
      return {
        used: 0,
        limit,
        remaining: limit,
        resetAt: now + RATE_LIMIT_WINDOW,
      };
    }

    return {
      used: entry.count,
      limit,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.resetAt,
    };
  }

  /**
   * Reset rate limit for a brand/service
   * @param brand - Brand identifier
   * @param service - Service type
   */
  public async reset(brand: Brand, service: 'lateAPI' | 'heygen' | 'submagic'): Promise<void> {
    const key = this.getKey(brand, service);
    this.store.delete(key);
    console.log(`🔄 Reset rate limit for ${key}`);
  }

  /**
   * Get all rate limit statuses for a brand
   * @param brand - Brand identifier
   * @returns Rate limit statuses for all services
   */
  public async getAllStatuses(brand: Brand): Promise<{
    lateAPI: ReturnType<typeof this.getStatus> extends Promise<infer T> ? T : never;
    heygen: ReturnType<typeof this.getStatus> extends Promise<infer T> ? T : never;
    submagic: ReturnType<typeof this.getStatus> extends Promise<infer T> ? T : never;
  }> {
    const [lateAPI, heygen, submagic] = await Promise.all([
      this.getStatus(brand, 'lateAPI'),
      this.getStatus(brand, 'heygen'),
      this.getStatus(brand, 'submagic'),
    ]);

    return { lateAPI, heygen, submagic };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop cleanup interval
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export singleton instance
export const brandRateLimiter = new BrandRateLimiter();

/**
 * Middleware-style rate limit checker
 * @param brand - Brand identifier
 * @param service - Service type
 * @throws Error if rate limit exceeded
 */
export async function checkRateLimit(
  brand: Brand,
  service: 'lateAPI' | 'heygen' | 'submagic'
): Promise<void> {
  const result = await brandRateLimiter.checkLimit(brand, service);

  if (!result.allowed) {
    const resetDate = new Date(result.resetAt);
    throw new Error(
      `Rate limit exceeded for ${brand}:${service}. Resets at ${resetDate.toISOString()}`
    );
  }
}

/**
 * Execute function with rate limiting
 * @param brand - Brand identifier
 * @param service - Service type
 * @param fn - Function to execute
 * @returns Function result
 */
export async function withRateLimit<T>(
  brand: Brand,
  service: 'lateAPI' | 'heygen' | 'submagic',
  fn: () => Promise<T>
): Promise<T> {
  // Check rate limit
  const checkResult = await brandRateLimiter.checkLimit(brand, service);

  if (!checkResult.allowed) {
    const resetDate = new Date(checkResult.resetAt);
    throw new Error(
      `Rate limit exceeded for ${brand}:${service}. Resets at ${resetDate.toISOString()}. ` +
      `Remaining: ${checkResult.remaining}`
    );
  }

  // Increment counter
  const incrementResult = await brandRateLimiter.increment(brand, service);

  if (!incrementResult.success) {
    throw new Error(
      `Rate limit exceeded after increment for ${brand}:${service}`
    );
  }

  // Execute function
  try {
    const result = await fn();
    return result;
  } catch (error) {
    // Don't decrement on error - rate limit still applies
    throw error;
  }
}

/**
 * Get rate limit headers for HTTP responses
 * @param brand - Brand identifier
 * @param service - Service type
 * @returns Rate limit headers
 */
export async function getRateLimitHeaders(
  brand: Brand,
  service: 'lateAPI' | 'heygen' | 'submagic'
): Promise<Record<string, string>> {
  const status = await brandRateLimiter.getStatus(brand, service);

  return {
    'X-RateLimit-Limit': status.limit.toString(),
    'X-RateLimit-Remaining': status.remaining.toString(),
    'X-RateLimit-Reset': new Date(status.resetAt).toISOString(),
    'X-RateLimit-Used': status.used.toString(),
  };
}

/**
 * Batch check rate limits for multiple services
 * @param brand - Brand identifier
 * @param services - Array of services to check
 * @returns Map of service to rate limit status
 */
export async function batchCheckRateLimits(
  brand: Brand,
  services: Array<'lateAPI' | 'heygen' | 'submagic'>
): Promise<Map<string, { allowed: boolean; remaining: number }>> {
  const results = new Map();

  await Promise.all(
    services.map(async (service) => {
      const status = await brandRateLimiter.checkLimit(brand, service);
      results.set(service, {
        allowed: status.allowed,
        remaining: status.remaining,
      });
    })
  );

  return results;
}
