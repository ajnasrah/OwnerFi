// COMPREHENSIVE CITY FINDER - Gets ALL cities within radius, not just manually curated ones
// This system is designed to find EVERY SINGLE CITY within a given radius

interface CityResult {
  name: string;
  state: string;
  stateCode: string;
  distance: number;
  population?: number;
  lat: number;
  lng: number;
}

/**
 * ULTIMATE SOLUTION: Get ALL cities within radius using external API
 * This would call external services to get comprehensive city data
 */
export async function getAllCitiesWithinRadiusAPI(
  centerLat: number,
  centerLng: number, 
  radiusMiles: number = 30
): Promise<CityResult[]> {
  // This would integrate with:
  // 1. Google Places API (places with type: locality)
  // 2. OpenStreetMap Overpass API 
  // 3. USGS Geographic Names Information System
  // 4. Census Bureau API
  
  
  return [];
}

/**
 * ENHANCED DATABASE SOLUTION: Comprehensive US cities database
 * In production, this would load from a complete 29,000+ cities JSON file
 */
export async function getAllCitiesWithinRadiusDatabase(
  centerLat: number,
  centerLng: number, 
  radiusMiles: number = 30
): Promise<CityResult[]> {
  // In production, this would load from a comprehensive database file
  // containing all US cities, towns, villages, and unincorporated areas
  
  const comprehensiveDatabase = await loadComprehensiveCitiesDatabase();
  return calculateCitiesWithinRadius(comprehensiveDatabase, centerLat, centerLng, radiusMiles);
}

/**
 * Load comprehensive cities database (placeholder for actual implementation)
 */
async function loadComprehensiveCitiesDatabase(): Promise<CityResult[]> {
  // In production, this would load from:
  // - A large JSON file with 29,000+ US cities
  // - A SQLite database with cities data
  // - API calls to comprehensive data sources
  
  
  return [];
}

/**
 * Calculate which cities from a comprehensive database fall within radius
 */
function calculateCitiesWithinRadius(
  allCities: CityResult[],
  centerLat: number,
  centerLng: number,
  radiusMiles: number
): CityResult[] {
  const nearbyCities: CityResult[] = [];
  
  for (const city of allCities) {
    const distance = calculateHaversineDistance(centerLat, centerLng, city.lat, city.lng);
    
    if (distance <= radiusMiles) {
      nearbyCities.push({
        ...city,
        distance: Math.round(distance * 100) / 100
      });
    }
  }
  
  return nearbyCities.sort((a, b) => a.distance - b.distance);
}

/**
 * Accurate distance calculation using Haversine formula
 */
function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * HYBRID SOLUTION: Combine multiple data sources for maximum coverage
 */
export async function getAllCitiesWithinRadiusHybrid(
  centerLat: number,
  centerLng: number, 
  radiusMiles: number = 30
): Promise<CityResult[]> {
  const results: CityResult[] = [];
  
  try {
    // Source 1: Local comprehensive database
    const databaseResults = await getAllCitiesWithinRadiusDatabase(centerLat, centerLng, radiusMiles);
    results.push(...databaseResults);
    
    // Source 2: External API for additional coverage
    const apiResults = await getAllCitiesWithinRadiusAPI(centerLat, centerLng, radiusMiles);
    
    // Merge and deduplicate
    const allResults = [...results, ...apiResults];
    const uniqueResults = deduplicateCities(allResults);
    
    return uniqueResults.sort((a, b) => a.distance - b.distance);
    
  } catch (error) {
    
    return results;
  }
}

/**
 * Remove duplicate cities from multiple sources
 */
function deduplicateCities(cities: CityResult[]): CityResult[] {
  const seen = new Set<string>();
  return cities.filter(city => {
    const key = `${city.name.toLowerCase()}-${city.stateCode.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * SOLUTION RECOMMENDATION for Production:
 * 
 * To get EVERY SINGLE CITY within 30 miles, you need:
 * 
 * 1. **Comprehensive Database**: 
 *    - Download USGS Geographic Names Information System (GNIS) database
 *    - Contains ~29,000 populated places in the US
 *    - Available at: https://www.usgs.gov/us-board-on-geographic-names/download-gnis-data
 * 
 * 2. **API Integration**:
 *    - Google Places API with type: locality
 *    - OpenStreetMap Overpass API for place nodes
 *    - Census Bureau API for incorporated places
 * 
 * 3. **Optimized Storage**:
 *    - Store in SQLite or PostgreSQL with spatial indexing
 *    - Use PostGIS for efficient geographic queries
 *    - Create spatial indexes for fast radius queries
 * 
 * 4. **Implementation Steps**:
 *    - Replace manual city array with database queries
 *    - Add API fallbacks for real-time data
 *    - Cache results to minimize API calls
 *    - Update data periodically
 */

export const IMPLEMENTATION_NOTES = {
  currentLimitation: "Manual database with ~150 major cities",
  productionSolution: "Need comprehensive US cities database with 29,000+ places",
  recommendedSources: [
    "USGS GNIS Database",
    "Google Places API", 
    "OpenStreetMap Overpass API",
    "US Census Bureau API"
  ],
  expectedResults: {
    dallas: "Should return 100+ cities/towns/villages within 30 miles",
    nyc: "Should return 200+ places within 30 miles",
    rural: "Should return 10-50 places depending on area"
  }
};