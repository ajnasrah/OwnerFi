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
let usCitiesDatabase: Map<string, USCity[]> = new Map();
let isDatabaseLoaded = false;

/**
 * Load comprehensive US cities database organized by state
 */
async function loadComprehensiveUSCitiesDatabase(): Promise<void> {
  if (isDatabaseLoaded) return;

  try {
    console.log('Loading comprehensive US cities database...');
    
    // Fetch the complete database from GitHub
    const response = await fetch('https://raw.githubusercontent.com/kelvins/US-Cities-Database/main/csv/us_cities.csv');
    const csvContent = await response.text();
    
    // Parse CSV content
    const lines = csvContent.split('\n');
    
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
    
    console.log(`✅ Loaded ${totalCities} cities across ${usCitiesDatabase.size} states`);
    isDatabaseLoaded = true;
    
  } catch (error) {
    console.error('Failed to load comprehensive cities database:', error);
    throw new Error('Could not load US cities database');
  }
}

/**
 * Get ALL cities within radius from any point in the US
 */
export async function getAllUSCitiesWithinRadius(
  centerLat: number,
  centerLng: number,
  radiusMiles: number = 30
): Promise<CityWithDistance[]> {
  
  await loadComprehensiveUSCitiesDatabase();
  
  const nearbyCities: CityWithDistance[] = [];
  
  // Search through all states
  for (const [, cities] of usCitiesDatabase.entries()) {
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
  
  const stateCities = usCitiesDatabase.get(propertyStateCode.toUpperCase());
  if (!stateCities) {
    console.warn(`State not found: ${propertyStateCode}`);
    return [];
  }
  
  const propertyCity = stateCities.find(city => 
    city.city.toLowerCase() === propertyCityName.toLowerCase()
  );
  
  if (!propertyCity) {
    console.warn(`City not found: ${propertyCityName}, ${propertyStateCode}`);
    return [];
  }
  
  const nearbyCities = await getAllUSCitiesWithinRadius(
    propertyCity.latitude,
    propertyCity.longitude,
    radiusMiles
  );
  
  return nearbyCities
    .filter(city => city.city.toLowerCase() !== propertyCityName.toLowerCase())
    .map(city => city.city);
}

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

export async function getDatabaseStats() {
  await loadComprehensiveUSCitiesDatabase();
  
  let totalCities = 0;
  const stateStats: {[key: string]: number} = {};
  
  for (const [stateCode, cities] of usCitiesDatabase.entries()) {
    totalCities += cities.length;
    stateStats[stateCode] = cities.length;
  }
  
  return { totalCities, stateCount: usCitiesDatabase.size, stateStats };
}