// Comprehensive US Cities Service - Using cities.json database
import citiesData from 'cities.json';

interface City {
  name: string;
  country: string;
  state: string;
  lat: number;
  lng: number;
}

interface CityWithDistance extends City {
  distance: number;
}

// Filter to get only US cities (admin1 is already state abbreviation)  
const usCities: City[] = (citiesData as Array<{
  name: string;
  country: string;
  admin1: string;
  lat: string;
  lng: string;
}>)
  .filter((city) => city.country === 'US')
  .map((city) => ({
    name: city.name,
    country: city.country,
    state: city.admin1, // admin1 is already the state abbreviation (GA, TX, FL, etc.)
    lat: parseFloat(city.lat),
    lng: parseFloat(city.lng)
  }))
  .filter((city: City) => city.state && city.lat && city.lng); // Valid data only

console.log(`🇺🇸 Loaded ${usCities.length} US cities from comprehensive database`);

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
 * Get coordinates for a city (FAST lookup from comprehensive database)
 */
export function getCityCoordinatesComprehensive(cityName: string, state: string): { lat: number; lng: number } | null {
  const city = usCities.find(c => 
    c.name.toLowerCase() === cityName.toLowerCase() && 
    c.state === state
  );
  
  return city ? { lat: city.lat, lng: city.lng } : null;
}

/**
 * FAST: Get all cities within radius using comprehensive database
 * NO EXTERNAL API CALLS - Pure JavaScript calculation
 */
export function getCitiesWithinRadiusComprehensive(
  centerCity: string, 
  centerState: string, 
  radiusMiles: number = 30
): CityWithDistance[] {
  const startTime = Date.now();
  
  // Find center city coordinates
  const centerCoords = getCityCoordinatesComprehensive(centerCity, centerState);
  if (!centerCoords) {
    console.warn(`Center city not found: ${centerCity}, ${centerState}`);
    return [];
  }

  // Calculate distances to all cities in the same state
  const nearbyCities = usCities
    .filter(city => city.state === centerState) // Same state only
    .map(city => ({
      ...city,
      distance: calculateDistance(centerCoords.lat, centerCoords.lng, city.lat, city.lng)
    }))
    .filter(city => city.distance <= radiusMiles)
    .sort((a, b) => a.distance - b.distance);

  const endTime = Date.now() - startTime;
  console.log(`🚀 FAST: Found ${nearbyCities.length} cities within ${radiusMiles} miles of ${centerCity}, ${centerState} in ${endTime}ms`);

  return nearbyCities;
}

/**
 * Get nearby city names for property storage (excludes center city)
 */
export function getNearbyCityNamesForProperty(
  propertyCity: string,
  propertyState: string,
  radiusMiles: number = 30,
  maxCities: number = 100
): string[] {
  const nearbyCities = getCitiesWithinRadiusComprehensive(propertyCity, propertyState, radiusMiles);
  
  return nearbyCities
    .filter(city => city.name.toLowerCase() !== propertyCity.toLowerCase()) // Exclude property's own city
    .slice(0, maxCities) // Limit for storage efficiency
    .map(city => city.name);
}

/**
 * Get cities with distances for display purposes
 */
export function getCitiesWithDistancesForDisplay(
  centerCity: string,
  centerState: string,
  radiusMiles: number = 30,
  limit: number = 20
): CityWithDistance[] {
  return getCitiesWithinRadiusComprehensive(centerCity, centerState, radiusMiles)
    .slice(0, limit);
}

/**
 * Search cities by name with fuzzy matching
 */
export function searchCitiesComprehensive(
  searchQuery: string, 
  state?: string,
  limit: number = 10
): City[] {
  if (!searchQuery || searchQuery.length < 2) return [];
  
  const queryLower = searchQuery.toLowerCase();
  let searchPool = usCities;
  
  // Filter by state if provided
  if (state) {
    searchPool = usCities.filter(city => city.state === state);
  }
  
  // Exact matches first
  const exactMatches = searchPool.filter(city => 
    city.name.toLowerCase() === queryLower
  );
  
  // Starts with matches
  const startsWithMatches = searchPool.filter(city => 
    city.name.toLowerCase().startsWith(queryLower) && 
    !exactMatches.some(exact => exact.name === city.name && exact.state === city.state)
  );
  
  // Contains matches
  const containsMatches = searchPool.filter(city => 
    city.name.toLowerCase().includes(queryLower) && 
    !exactMatches.some(exact => exact.name === city.name && exact.state === city.state) &&
    !startsWithMatches.some(starts => starts.name === city.name && starts.state === city.state)
  );
  
  return [...exactMatches, ...startsWithMatches, ...containsMatches]
    .slice(0, limit);
}

/**
 * Get database stats for monitoring
 */
export function getCitiesDatabaseStats(): {
  totalCities: number;
  citiesByState: Record<string, number>;
  largestStates: Array<{ state: string; count: number }>;
} {
  const citiesByState: Record<string, number> = {};
  
  usCities.forEach(city => {
    citiesByState[city.state] = (citiesByState[city.state] || 0) + 1;
  });
  
  const largestStates = Object.entries(citiesByState)
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalCities: usCities.length,
    citiesByState,
    largestStates
  };
}