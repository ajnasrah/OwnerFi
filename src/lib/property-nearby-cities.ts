// Property Nearby Cities Service - Automatic population of nearby_cities field
import { getCitiesWithinRadiusComprehensive, getCitiesWithinRadiusByCoordinates } from './comprehensive-cities';

// Get API key dynamically to ensure env vars are loaded
function getGoogleMapsApiKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

interface NearbyCityResult {
  name: string;
  state: string;
  distance: number;
}

/**
 * Get coordinates for an address using Google Geocoding API
 */
async function geocodeAddress(
  address: string,
  city: string,
  state: string,
  zipCode?: string
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    console.error('[nearby-cities] Google Maps API key not configured');
    return null;
  }

  const fullAddress = zipCode
    ? `${address}, ${city}, ${state} ${zipCode}`
    : `${address}, ${city}, ${state}`;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }

    console.error(`[nearby-cities] Geocoding failed for ${fullAddress}: ${data.status}`);
    return null;
  } catch (error) {
    console.error(`[nearby-cities] Error geocoding ${fullAddress}:`, error);
    return null;
  }
}

/**
 * Populate nearby cities for a property
 *
 * This function will:
 * 1. Try to find nearby cities using the property's city name (fastest)
 * 2. If that fails, use existing coordinates if available
 * 3. If no coordinates, geocode the address to get coordinates
 * 4. Return nearby cities within the specified radius
 *
 * @param property - Property data with address, city, state, and optional coordinates
 * @param radiusMiles - Search radius in miles (default: 30)
 * @returns Array of nearby cities with distances, or null if failed
 */
export async function populateNearbyCitiesForProperty(
  property: {
    address: string;
    city: string;
    state: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
  },
  radiusMiles: number = 30
): Promise<{
  nearbyCities: NearbyCityResult[];
  coordinates?: { latitude: number; longitude: number };
  source: 'city-name' | 'existing-coords' | 'geocoded';
} | null> {
  try {
    // Strategy 1: Try city name lookup first (fastest, no API calls)
    console.log(`[nearby-cities] Attempting city name lookup for ${property.city}, ${property.state}`);
    let nearbyCities = getCitiesWithinRadiusComprehensive(
      property.city,
      property.state,
      radiusMiles
    );

    if (nearbyCities.length > 0) {
      console.log(`[nearby-cities] Found ${nearbyCities.length} cities using city name`);
      return {
        nearbyCities: nearbyCities.map(city => ({
          name: city.name,
          state: city.state,
          distance: Math.round(city.distance * 10) / 10
        })),
        source: 'city-name'
      };
    }

    // Strategy 2: Try existing coordinates
    let lat = property.latitude;
    let lng = property.longitude;

    if (lat && lng) {
      console.log(`[nearby-cities] Using existing coordinates: ${lat}, ${lng}`);
      nearbyCities = getCitiesWithinRadiusByCoordinates(lat, lng, property.state, radiusMiles);

      if (nearbyCities.length > 0) {
        console.log(`[nearby-cities] Found ${nearbyCities.length} cities using existing coords`);
        return {
          nearbyCities: nearbyCities.map(city => ({
            name: city.name,
            state: city.state,
            distance: Math.round(city.distance * 10) / 10
          })),
          source: 'existing-coords'
        };
      }
    }

    // Strategy 3: Geocode the address
    console.log(`[nearby-cities] Geocoding address: ${property.address}`);
    const coords = await geocodeAddress(
      property.address,
      property.city,
      property.state,
      property.zipCode
    );

    if (!coords) {
      console.error(`[nearby-cities] Failed to geocode address`);
      return null;
    }

    lat = coords.lat;
    lng = coords.lng;
    console.log(`[nearby-cities] Geocoded to: ${lat}, ${lng}`);

    // Get nearby cities using geocoded coordinates
    nearbyCities = getCitiesWithinRadiusByCoordinates(lat, lng, property.state, radiusMiles);

    if (nearbyCities.length === 0) {
      console.warn(`[nearby-cities] No cities found within ${radiusMiles} miles`);
      return {
        nearbyCities: [],
        coordinates: { latitude: lat, longitude: lng },
        source: 'geocoded'
      };
    }

    console.log(`[nearby-cities] Found ${nearbyCities.length} cities using geocoded coords`);
    return {
      nearbyCities: nearbyCities.map(city => ({
        name: city.name,
        state: city.state,
        distance: Math.round(city.distance * 10) / 10
      })),
      coordinates: { latitude: lat, longitude: lng },
      source: 'geocoded'
    };

  } catch (error) {
    console.error('[nearby-cities] Error populating nearby cities:', error);
    return null;
  }
}

/**
 * Populate nearby cities for a property and return update object
 * Use this in API routes to get the fields to update
 *
 * Includes fallback to 45 miles if no cities found within 30 miles
 */
export async function getNearbyCitiesUpdate(
  property: {
    address: string;
    city: string;
    state: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
  },
  radiusMiles: number = 30
): Promise<Record<string, unknown>> {
  let result = await populateNearbyCitiesForProperty(property, radiusMiles);

  // Fallback: If no cities found within 30 miles, try 45 miles
  if (result && result.nearbyCities.length === 0) {
    console.log(`[nearby-cities] No cities found within ${radiusMiles} miles, trying 45 miles...`);
    result = await populateNearbyCitiesForProperty(property, 45);
  }

  if (!result) {
    // Return empty array if failed - better than null
    return {
      nearbyCities: [],
      nearbyCitiesSource: 'failed',
      nearbyCitiesUpdatedAt: new Date().toISOString()
    };
  }

  const update: Record<string, unknown> = {
    nearbyCities: result.nearbyCities,
    nearbyCitiesSource: result.source,
    nearbyCitiesUpdatedAt: new Date().toISOString()
  };

  // Add coordinates if we geocoded them
  if (result.coordinates) {
    update.latitude = result.coordinates.latitude;
    update.longitude = result.coordinates.longitude;
  }

  return update;
}
