/**
 * Memory-Safe Rate Limiter
 * 
 * Prevents memory leaks from global rate limiters that accumulate entries over time
 * Automatically cleans up old entries and provides consistent rate limiting
 */

import { logger } from './structured-logger';

export interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
  cleanupInterval?: number; // How often to cleanup old entries (default: every hour)
}

export class MemorySafeRateLimiter {
  private calls = new Map<string, number>();
  private lastCleanup = Date.now();
  private config: Required<RateLimiterConfig>;

  constructor(config: RateLimiterConfig) {
    this.config = {
      ...config,
      cleanupInterval: config.cleanupInterval || 60 * 60 * 1000 // Default: 1 hour
    };
  }

  /**
   * Check if a request is allowed under the rate limit
   * @param identifier - Unique identifier for this rate limit bucket
   * @returns true if allowed, false if rate limited
   */
  isAllowed(identifier: string = 'default'): boolean {
    this.performCleanupIfNeeded();

    const now = Date.now();
    const windowKey = Math.floor(now / this.config.windowMs).toString();
    const currentWindowCalls = this.calls.get(windowKey) || 0;

    if (currentWindowCalls >= this.config.maxRequests) {
      logger.warn('Rate limit exceeded', {
        component: 'rate-limiter',
        identifier,
        currentCalls: currentWindowCalls,
        limit: this.config.maxRequests,
        windowMs: this.config.windowMs
      });
      return false;
    }

    // Increment counter
    this.calls.set(windowKey, currentWindowCalls + 1);
    return true;
  }

  /**
   * Record a successful API call (use after making the actual request)
   * @param identifier - Unique identifier for this rate limit bucket
   * @returns current usage stats
   */
  recordCall(identifier: string = 'default'): { current: number; limit: number } {
    const now = Date.now();
    const windowKey = Math.floor(now / this.config.windowMs).toString();
    const current = this.calls.get(windowKey) || 0;

    logger.trace('API call recorded', {
      component: 'rate-limiter',
      identifier,
      current: current + 1,
      limit: this.config.maxRequests
    });

    return { current: current + 1, limit: this.config.maxRequests };
  }

  /**
   * Get current usage stats without modifying the counter
   */
  getUsage(_identifier: string = 'default'): { current: number; limit: number; resetTime: number } {
    const now = Date.now();
    const windowKey = Math.floor(now / this.config.windowMs).toString();
    const current = this.calls.get(windowKey) || 0;
    const resetTime = (parseInt(windowKey) + 1) * this.config.windowMs;

    return { current, limit: this.config.maxRequests, resetTime };
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  private performCleanupIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastCleanup < this.config.cleanupInterval) {
      return; // Not time for cleanup yet
    }

    const currentWindowKey = Math.floor(now / this.config.windowMs);
    const keysToDelete: string[] = [];

    for (const key of this.calls.keys()) {
      const keyWindowNumber = parseInt(key);
      // Keep current window and 1 previous window for edge cases
      if (keyWindowNumber < currentWindowKey - 1) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.calls.delete(key));
    this.lastCleanup = now;

    if (keysToDelete.length > 0) {
      logger.debug('Rate limiter memory cleanup performed', {
        component: 'rate-limiter',
        deletedEntries: keysToDelete.length,
        remainingEntries: this.calls.size
      });
    }
  }

  /**
   * Force cleanup of all old entries (for testing or manual cleanup)
   */
  cleanup(): void {
    const sizeBefore = this.calls.size;
    this.lastCleanup = 0; // Force cleanup
    this.performCleanupIfNeeded();
    
    logger.info('Rate limiter force cleanup', {
      component: 'rate-limiter',
      entriesCleared: sizeBefore - this.calls.size
    });
  }
}

// Pre-configured rate limiters for common use cases
export const createGeocodingRateLimiter = () => 
  new MemorySafeRateLimiter({
    maxRequests: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
    cleanupInterval: 2 * 60 * 60 * 1000 // Clean every 2 hours
  });

export const createAgentSearchRateLimiter = () =>
  new MemorySafeRateLimiter({
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
    cleanupInterval: 60 * 60 * 1000 // Clean every hour
  });

export const createBuyerFilterRateLimiter = () =>
  new MemorySafeRateLimiter({
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    cleanupInterval: 60 * 60 * 1000 // Clean every hour
  });