// In-memory cache with TTL for city data
class MemoryCache {
  private cache: Map<string, { data: unknown; expiry: number }> = new Map();
  
  set(key: string, data: unknown, ttlMs: number = 300000) { // Default 5 minutes
    const expiry = Date.now() + ttlMs;
    this.cache.set(key, { data, expiry });
  }
  
  get(key: string): unknown | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  clear() {
    this.cache.clear();
  }
  
  size() {
    return this.cache.size;
  }
}

export const cityCache = new MemoryCache();