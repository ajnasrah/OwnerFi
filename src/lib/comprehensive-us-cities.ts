// COMPREHENSIVE US CITIES DATABASE - State-based lookup for ALL US populated places
// This system provides complete coverage of US cities for property enhancement

interface USCity {
  id: number;
  stateCode: string;
  stateName: string;
  city: string;
  county: string;
  latitude: number;
  longitude: number;
}

interface CityWithDistance extends USCity {
  distance: number;
}

// Complete US cities database (will be populated from USGS/comprehensive source)
const usCitiesDatabase: Map<string, USCity[]> = new Map();
let isDatabaseLoaded = false;

/**
 * Load comprehensive US cities database organized by state
 */
async function loadComprehensiveUSCitiesDatabase(): Promise<void> {
  if (isDatabaseLoaded) return;

  try {
    
    
    // Fetch the complete database from GitHub
    const response = await fetch('https://raw.githubusercontent.com/kelvins/US-Cities-Database/main/csv/us_cities.csv');
    const csvContent = await response.text();
    
    // Parse CSV content
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');
    
    // Clear and rebuild database organized by state
    usCitiesDatabase.clear();
    
    let totalCities = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',');
      if (values.length < 7) continue;
      
      const city: USCity = {
        id: parseInt(values[0]) || 0,
        stateCode: values[1]?.replace(/['"]/g, '') || '',
        stateName: values[2]?.replace(/['"]/g, '') || '',
        city: values[3]?.replace(/['"]/g, '') || '',
        county: values[4]?.replace(/['"]/g, '') || '',
        latitude: parseFloat(values[5]) || 0,
        longitude: parseFloat(values[6]) || 0
      };
      
      // Skip invalid entries
      if (!city.stateCode || !city.city || !city.latitude || !city.longitude) {
        continue;
      }
      
      // Group by state code for efficient lookups
      if (!usCitiesDatabase.has(city.stateCode)) {
        usCitiesDatabase.set(city.stateCode, []);
      }
      
      usCitiesDatabase.get(city.stateCode)!.push(city);
      totalCities++;
    }
    
    
    
    // Log stats by state
    
    Array.from(usCitiesDatabase.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10)
      .forEach(([state, cities]) => {
        
      });
    
    isDatabaseLoaded = true;
    
  } catch (error) {
    
    throw new Error('Could not load US cities database');
  }
}

/**
 * Get ALL cities within radius from any point in the US
 * This is the main function that replaces our limited manual database
 */
export async function getAllUSCitiesWithinRadius(
  centerLat: number,
  centerLng: number,
  radiusMiles: number = 30
): Promise<CityWithDistance[]> {
  
  // Ensure database is loaded
  await loadComprehensiveUSCitiesDatabase();
  
  const nearbyCities: CityWithDistance[] = [];
  
  // Calculate rough bounding box for efficiency (approximate)
  const latRange = radiusMiles / 69; // Rough miles per degree of latitude
  const lngRange = radiusMiles / (69 * Math.cos(centerLat * Math.PI / 180));
  
  const minLat = centerLat - latRange;
  const maxLat = centerLat + latRange;
  const minLng = centerLng - lngRange;
  const maxLng = centerLng + lngRange;
  
  // Search through all states (could be optimized to nearby states only)
  for (const [stateCode, cities] of usCitiesDatabase.entries()) {
    for (const city of cities) {
      // Quick bounding box filter first
      if (city.latitude < minLat || city.latitude > maxLat ||
          city.longitude < minLng || city.longitude > maxLng) {
        continue;
      }
      
      // Precise distance calculation for candidates
      const distance = calculateHaversineDistance(
        centerLat, centerLng, 
        city.latitude, city.longitude
      );
      
      if (distance <= radiusMiles) {
        nearbyCities.push({
          ...city,
          distance: Math.round(distance * 100) / 100
        });
      }
    }
  }
  
  // Sort by distance
  return nearbyCities.sort((a, b) => a.distance - b.distance);
}

/**
 * State-optimized version: Get cities within radius, focusing on specific state first
 */
export async function getCitiesWithinRadiusByState(
  centerLat: number,
  centerLng: number,
  primaryStateCode: string,
  radiusMiles: number = 30
): Promise<CityWithDistance[]> {
  
  await loadComprehensiveUSCitiesDatabase();
  
  const nearbyCities: CityWithDistance[] = [];
  
  // Helper function to search cities in a state
  const searchInState = (stateCode: string) => {
    const cities = usCitiesDatabase.get(stateCode.toUpperCase());
    if (!cities) return;
    
    for (const city of cities) {
      const distance = calculateHaversineDistance(
        centerLat, centerLng,
        city.latitude, city.longitude
      );
      
      if (distance <= radiusMiles) {
        nearbyCities.push({
          ...city,
          distance: Math.round(distance * 100) / 100
        });
      }
    }
  };
  
  // Search primary state first
  searchInState(primaryStateCode);
  
  // Search neighboring states (all states for now, could be optimized)
  for (const [stateCode] of usCitiesDatabase.entries()) {
    if (stateCode !== primaryStateCode.toUpperCase()) {
      searchInState(stateCode);
    }
  }
  
  return nearbyCities.sort((a, b) => a.distance - b.distance);
}

/**
 * Get cities by city name and state (for property enhancement integration)
 */
export async function getCitiesNearProperty(
  propertyCityName: string,
  propertyStateCode: string,
  radiusMiles: number = 30
): Promise<string[]> {
  
  await loadComprehensiveUSCitiesDatabase();
  
  // Find the property's city in our database
  const stateCities = usCitiesDatabase.get(propertyStateCode.toUpperCase());
  if (!stateCities) {
    
    return [];
  }
  
  const propertyCity = stateCities.find(city => 
    city.city.toLowerCase() === propertyCityName.toLowerCase()
  );
  
  if (!propertyCity) {
    
    return [];
  }
  
  // Get all cities within radius
  const nearbyCities = await getAllUSCitiesWithinRadius(
    propertyCity.latitude,
    propertyCity.longitude,
    radiusMiles
  );
  
  // Return just the city names (excluding the property city itself)
  return nearbyCities
    .filter(city => city.city.toLowerCase() !== propertyCityName.toLowerCase())
    .map(city => city.city);
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
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{totalCities: number, stateCount: number, stateStats: {[key: string]: number}}> {
  await loadComprehensiveUSCitiesDatabase();
  
  let totalCities = 0;
  const stateStats: {[key: string]: number} = {};
  
  for (const [stateCode, cities] of usCitiesDatabase.entries()) {
    totalCities += cities.length;
    stateStats[stateCode] = cities.length;
  }
  
  return {
    totalCities,
    stateCount: usCitiesDatabase.size,
    stateStats
  };
}

/**
 * Test function to verify database coverage for a specific location
 */
export async function testLocationCoverage(
  cityName: string,
  stateCode: string,
  radiusMiles: number = 30
): Promise<{
  found: boolean,
  cityCoordinates?: {lat: number, lng: number},
  nearbyCitiesCount: number,
  sampleNearbyCities: string[]
}> {
  
  await loadComprehensiveUSCitiesDatabase();
  
  const stateCities = usCitiesDatabase.get(stateCode.toUpperCase());
  if (!stateCities) {
    return { found: false, nearbyCitiesCount: 0, sampleNearbyCities: [] };
  }
  
  const city = stateCities.find(c => c.city.toLowerCase() === cityName.toLowerCase());
  if (!city) {
    return { found: false, nearbyCitiesCount: 0, sampleNearbyCities: [] };
  }
  
  const nearbyCities = await getAllUSCitiesWithinRadius(
    city.latitude, city.longitude, radiusMiles
  );
  
  return {
    found: true,
    cityCoordinates: { lat: city.latitude, lng: city.longitude },
    nearbyCitiesCount: nearbyCities.length,
    sampleNearbyCities: nearbyCities.slice(0, 10).map(c => `${c.city}, ${c.stateCode}`)
  };
}