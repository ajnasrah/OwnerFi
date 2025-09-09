// NEW: Ultra-fast cities service using comprehensive database
import { getCitiesWithinRadiusComprehensive, getNearbyCityNamesForProperty } from './comprehensive-cities';

// Cache for repeated lookups
const nearbyCache = new Map<string, string[]>();

/**
 * ULTRA FAST: Get nearby cities using comprehensive database (NO API CALLS!)
 */
export function getNearbyCitiesUltraFast(
  cityName: string,
  state: string,
  radiusMiles: number = 30
): string[] {
  const cacheKey = `${cityName.toLowerCase()}_${state}_${radiusMiles}`;
  
  // Check cache first
  if (nearbyCache.has(cacheKey)) {
    const cached = nearbyCache.get(cacheKey)!;
    console.log(`⚡ CACHE HIT: ${cityName}, ${state} -> ${cached.length} cities`);
    return cached;
  }
  
  // Calculate using comprehensive database (pure JavaScript, no API calls)
  const nearbyCities = getNearbyCityNamesForProperty(cityName, state, radiusMiles, 100);
  
  // Cache the result
  nearbyCache.set(cacheKey, nearbyCities);
  
  console.log(`🚀 CALCULATED: ${cityName}, ${state} -> ${nearbyCities.length} cities (cached)`);
  return nearbyCities;
}

/**
 * Test the comprehensive database coverage
 */
export function testComprehensiveDatabase(): any {
  const testCities = [
    { city: 'Atlanta', state: 'GA' },
    { city: 'Dallas', state: 'TX' },
    { city: 'Miami', state: 'FL' },
    { city: 'Jacksonville', state: 'FL' },
    { city: 'Austin', state: 'TX' }
  ];
  
  const results = testCities.map(test => {
    const startTime = Date.now();
    const nearbyCities = getNearbyCitiesUltraFast(test.city, test.state, 30);
    const endTime = Date.now() - startTime;
    
    return {
      city: test.city,
      state: test.state,
      nearbyCitiesCount: nearbyCities.length,
      calculationTime: endTime,
      sampleCities: nearbyCities.slice(0, 10)
    };
  });
  
  return {
    testName: 'Comprehensive Database Performance Test',
    results,
    avgTime: Math.round(results.reduce((sum, r) => sum + r.calculationTime, 0) / results.length),
    totalCities: results.reduce((sum, r) => sum + r.nearbyCitiesCount, 0)
  };
}

/**
 * Clear cache for testing
 */
export function clearNearbyCitiesCache(): void {
  nearbyCache.clear();
  console.log('🧹 Cleared nearby cities cache');
}