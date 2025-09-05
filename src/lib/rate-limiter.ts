// Simple in-memory rate limiter
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(private maxRequests: number, private windowMs: number) {}
  
  async check(key: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Get existing requests for this key
    let requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    requests = requests.filter(time => time > windowStart);
    
    // Check if we're under the limit
    if (requests.length >= this.maxRequests) {
      return false; // Rate limited
    }
    
    // Add current request
    requests.push(now);
    this.requests.set(key, requests);
    
    return true; // Allowed
  }
  
  reset(key: string) {
    this.requests.delete(key);
  }
  
  cleanup() {
    const now = Date.now();
    for (const [key, requests] of this.requests.entries()) {
      const filtered = requests.filter(time => time > now - this.windowMs);
      if (filtered.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filtered);
      }
    }
  }
}

// External API rate limiter (30 requests per minute)
export const externalApiLimiter = new RateLimiter(30, 60000);

// Cleanup every 5 minutes
setInterval(() => {
  externalApiLimiter.cleanup();
}, 300000);