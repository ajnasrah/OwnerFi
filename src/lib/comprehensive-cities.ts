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

/**
 * Normalize city name to handle common variations
 * - "Saint" ↔ "St." / "St"
 * - "Fort" ↔ "Ft." / "Ft"
 * - "Port" ↔ "Pt." / "Pt"
 * - "Mount" ↔ "Mt." / "Mt"
 * - Handles suffixes like "Beach", "City", "Park", etc.
 */
function normalizeCityName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Normalize "Saint" variations
    .replace(/^saint\s+/i, 'st. ')
    .replace(/^st\s+/i, 'st. ')
    // Normalize "Fort" variations
    .replace(/^fort\s+/i, 'ft. ')
    .replace(/^ft\s+/i, 'ft. ')
    // Normalize "Port" variations
    .replace(/^port\s+/i, 'port ')
    .replace(/^pt\s+/i, 'port ')
    // Normalize "Mount" variations
    .replace(/^mount\s+/i, 'mt. ')
    .replace(/^mt\s+/i, 'mt. ')
    // Normalize "North/South/East/West" abbreviations
    .replace(/^n\s+/i, 'north ')
    .replace(/^s\s+/i, 'south ')
    .replace(/^e\s+/i, 'east ')
    .replace(/^w\s+/i, 'west ')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find city with fuzzy matching for common variations
 */
function findCityFuzzy(cityName: string, state: string): City | null {
  const stateCities = usCities.filter(c => c.state === state);
  const normalizedInput = normalizeCityName(cityName);

  // 1. Try exact match first
  let match = stateCities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
  if (match) return match;

  // 2. Try normalized match
  match = stateCities.find(c => normalizeCityName(c.name) === normalizedInput);
  if (match) return match;

  // 3. Try with/without common suffixes (Beach, City, Park, Heights, etc.)
  const suffixes = ['beach', 'city', 'park', 'heights', 'springs', 'falls', 'lake', 'lakes', 'hills', 'village', 'township'];

  // Try adding suffixes
  for (const suffix of suffixes) {
    match = stateCities.find(c =>
      normalizeCityName(c.name) === `${normalizedInput} ${suffix}`
    );
    if (match) return match;
  }

  // Try removing suffixes from input
  for (const suffix of suffixes) {
    if (normalizedInput.endsWith(` ${suffix}`)) {
      const withoutSuffix = normalizedInput.replace(new RegExp(` ${suffix}$`), '');
      match = stateCities.find(c => normalizeCityName(c.name) === withoutSuffix);
      if (match) return match;
    }
  }

  // 4. Try partial match (input starts with city name or vice versa)
  match = stateCities.find(c => {
    const normalizedDbName = normalizeCityName(c.name);
    return normalizedDbName.startsWith(normalizedInput) || normalizedInput.startsWith(normalizedDbName);
  });
  if (match) return match;

  return null;
}


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
 * Uses fuzzy matching for common variations (Saint/St., Port/Pt., Beach suffix, etc.)
 */
export function getCityCoordinatesComprehensive(cityName: string, state: string): { lat: number; lng: number } | null {
  const city = findCityFuzzy(cityName, state);
  return city ? { lat: city.lat, lng: city.lng } : null;
}

/**
 * FAST: Get all cities within radius using comprehensive database
 * NO EXTERNAL API CALLS - Pure JavaScript calculation
 */
export function getCitiesWithinRadiusComprehensive(
  centerCity: string,
  centerState: string,
  radiusMiles: number = 35
): CityWithDistance[] {
  // Find center city coordinates
  const centerCoords = getCityCoordinatesComprehensive(centerCity, centerState);
  if (!centerCoords) {
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

  return nearbyCities;
}

/**
 * Get all cities within radius using coordinates (for properties where city name isn't in database)
 */
export function getCitiesWithinRadiusByCoordinates(
  centerLat: number,
  centerLng: number,
  centerState: string,
  radiusMiles: number = 35
): CityWithDistance[] {
  // Calculate distances to all cities in the same state
  const nearbyCities = usCities
    .filter(city => city.state === centerState) // Same state only
    .map(city => ({
      ...city,
      distance: calculateDistance(centerLat, centerLng, city.lat, city.lng)
    }))
    .filter(city => city.distance <= radiusMiles)
    .sort((a, b) => a.distance - b.distance);

  return nearbyCities;
}

/**
 * Get nearby city names for property storage (excludes center city)
 * With automatic radius expansion: 35mi → 60mi → 120mi if no cities found
 */
export function getNearbyCityNamesForProperty(
  propertyCity: string,
  propertyState: string,
  radiusMiles: number = 35,
  maxCities: number = 100
): string[] {
  // Try with requested radius first
  let nearbyCities = getCitiesWithinRadiusComprehensive(propertyCity, propertyState, radiusMiles);

  // Failsafe: Expand radius if no nearby cities found
  const radiusSteps = [60, 120];
  let currentRadius = radiusMiles;

  for (const expandedRadius of radiusSteps) {
    if (nearbyCities.length <= 1 && expandedRadius > currentRadius) {
      nearbyCities = getCitiesWithinRadiusComprehensive(propertyCity, propertyState, expandedRadius);
      currentRadius = expandedRadius;
    }
  }

  return nearbyCities
    .filter(city => city.name.toLowerCase() !== propertyCity.toLowerCase()) // Exclude property's own city
    .slice(0, maxCities) // Limit for storage efficiency
    .map(city => city.name);
}

/**
 * Get cities within radius with automatic expansion if needed
 * Expands: 30mi → 60mi → 120mi until at least minCities are found
 */
export function getCitiesWithinRadiusWithExpansion(
  centerCity: string,
  centerState: string,
  initialRadius: number = 30,
  minCities: number = 5
): { cities: CityWithDistance[]; radiusUsed: number } {
  const radiusSteps = [initialRadius, 60, 120, 200];

  for (const radius of radiusSteps) {
    if (radius < initialRadius) continue;

    const cities = getCitiesWithinRadiusComprehensive(centerCity, centerState, radius);

    if (cities.length >= minCities || radius === 200) {
      return { cities, radiusUsed: radius };
    }
  }

  // Fallback - return whatever we got
  return {
    cities: getCitiesWithinRadiusComprehensive(centerCity, centerState, 200),
    radiusUsed: 200
  };
}

/**
 * Get cities with distances for display purposes
 */
export function getCitiesWithDistancesForDisplay(
  centerCity: string,
  centerState: string,
  radiusMiles: number = 35,
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