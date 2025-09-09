// Unified Cities Service - Direct API calls, no localhost bullshit
import { getCityCoordinates } from './cities';

interface CityWithDistance {
  name: string;
  state: string;
  lat: number;
  lng: number;
  distance: number;
  type: string;
}

// City coordinate cache to avoid repeated lookups
const coordinateCache = new Map<string, { lat: number; lng: number } | null>();

// Rate limiting for Overpass API
let lastOverpassCall = 0;
const OVERPASS_DELAY = 200; // 200ms between calls

/**
 * Get coordinates with caching to avoid redundant lookups
 */
function getCachedCoordinates(cityName: string, state: string): { lat: number; lng: number } | null {
  const key = `${cityName.toLowerCase()}_${state.toUpperCase()}`;
  
  if (coordinateCache.has(key)) {
    return coordinateCache.get(key)!;
  }
  
  const coords = getCityCoordinates(cityName, state);
  coordinateCache.set(key, coords);
  return coords;
}

/**
 * Rate-limited Overpass API call
 */
async function callOverpassAPI(lat: number, lng: number, radius: number): Promise<CityWithDistance[]> {
  // Rate limiting
  const now = Date.now();
  const timeSinceLastCall = now - lastOverpassCall;
  if (timeSinceLastCall < OVERPASS_DELAY) {
    await new Promise(resolve => setTimeout(resolve, OVERPASS_DELAY - timeSinceLastCall));
  }
  lastOverpassCall = Date.now();

  const overpassQuery = `
    [out:json][timeout:25];
    (
      node["place"~"^(city|town|village)$"](around:${radius * 1609.34},${lat},${lng});
      way["place"~"^(city|town|village)$"](around:${radius * 1609.34},${lat},${lng});
      relation["place"~"^(city|town|village)$"](around:${radius * 1609.34},${lat},${lng});
    );
    out center;
  `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: overpassQuery,
      signal: AbortSignal.timeout(30000) // 30s timeout
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.elements
      .filter((element: { tags?: { name?: string } }) => element.tags && element.tags.name)
      .map((element: { 
        tags: { name: string; 'addr:state'?: string; state?: string; place?: string };
        lat?: number;
        center?: { lat: number; lon: number };
        lon?: number;
      }) => {
        const elementLat = element.lat || element.center?.lat;
        const elementLng = element.lon || element.center?.lon;
        
        if (!elementLat || !elementLng) return null;
        
        const distance = calculateDistance(lat, lng, elementLat, elementLng);
        
        return {
          name: element.tags.name,
          state: element.tags['addr:state'] || element.tags.state || 'Unknown',
          lat: elementLat,
          lng: elementLng,
          distance: Math.round(distance * 10) / 10,
          type: element.tags.place
        };
      })
      .filter((city): city is CityWithDistance => city && city.name && city.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

  } catch (error) {
    console.error('Overpass API error:', error);
    throw error;
  }
}

/**
 * FAST: Get nearby cities with caching and fallbacks
 */
export async function getNearbyCitiesDirect(
  cityName: string,
  state: string,
  radiusMiles: number = 30
): Promise<string[]> {
  try {
    // Get cached coordinates
    const coords = getCachedCoordinates(cityName, state);
    if (!coords) {
      console.warn(`No coordinates found for ${cityName}, ${state} - using fallback`);
      return getFallbackCities(cityName, state, radiusMiles);
    }

    // Call Overpass API directly with rate limiting
    const cities = await callOverpassAPI(coords.lat, coords.lng, radiusMiles);
    
    const cityNames = cities
      .filter(city => city.name.toLowerCase() !== cityName.toLowerCase())
      .map(city => city.name)
      .slice(0, 50); // Limit to 50 cities
    
    console.log(`🌍 Found ${cityNames.length} cities within ${radiusMiles} miles of ${cityName}, ${state}`);
    return cityNames;
    
  } catch (error) {
    console.error(`Error getting nearby cities for ${cityName}, ${state}:`, error);
    return getFallbackCities(cityName, state, radiusMiles);
  }
}

/**
 * Fallback to static cities database when API fails
 */
function getFallbackCities(cityName: string, state: string, radiusMiles: number): string[] {
  try {
    const { getCitiesWithinRadius } = await import('./cities');
    const nearbyCities = getCitiesWithinRadius(cityName, state, radiusMiles);
    
    const cityNames = nearbyCities
      .filter((city: { name: string }) => city.name.toLowerCase() !== cityName.toLowerCase())
      .map((city: { name: string }) => city.name)
      .slice(0, 20); // Static DB has fewer cities
    
    console.log(`📍 Fallback: Found ${cityNames.length} cities for ${cityName}, ${state}`);
    return cityNames;
    
  } catch (error) {
    console.error('Fallback cities lookup failed:', error);
    return [];
  }
}

// Haversine distance calculation
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
 * Clear coordinate cache (for testing)
 */
export function clearCoordinateCache(): void {
  coordinateCache.clear();
}