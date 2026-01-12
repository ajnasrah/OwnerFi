// Google Places API integration for city validation and nearby city discovery
// Designed for scale with proper error handling and rate limiting

import { GooglePlace, ValidatedCity, ServiceArea, REALTOR_CONSTANTS } from './realtor-models';
import { Timestamp } from 'firebase/firestore';

// Google Places API configuration - MUST be set in environment
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_PLACES_API_KEY) {
  console.error('CRITICAL: GOOGLE_PLACES_API_KEY environment variable is not set');
}

export class GooglePlacesService {
  
  // Search for cities using Google Places Autocomplete
  static async searchCities(query: string, limit: number = 5): Promise<ValidatedCity[]> {
    try {
      // Use Google Places Autocomplete API for city search
      const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(cities)&key=${GOOGLE_PLACES_API_KEY}`;
      
      const response = await fetch(autocompleteUrl);
      const data = await response.json();
      
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }
      
      const predictions = data.predictions || [];
      const validatedCities: ValidatedCity[] = [];
      
      // Get detailed information for each city
      for (const prediction of predictions.slice(0, limit)) {
        try {
          const cityDetails = await this.getCityDetails(prediction.place_id);
          if (cityDetails) {
            validatedCities.push(cityDetails);
          }
        } catch (error) {
          // Continue with other cities even if one fails
        }
      }
      
      return validatedCities;
      
    } catch (error) {
      throw new Error(`City search failed: ${error}`);
    }
  }
  
  // Get detailed city information by Place ID
  static async getCityDetails(placeId: string): Promise<ValidatedCity | null> {
    try {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,name,geometry,address_components&key=${GOOGLE_PLACES_API_KEY}`;
      
      const response = await fetch(detailsUrl);
      const data = await response.json();
      
      if (data.status !== 'OK') {
        throw new Error(`Google Places Details API error: ${data.status}`);
      }
      
      const place = data.result;
      return this.parseGooglePlaceToCity(place);
      
    } catch (error) {
      return null;
    }
  }
  
  // Find all cities within radius using Google Places Nearby Search
  static async findNearbyCities(centerCity: ValidatedCity, radiusMiles: number = REALTOR_CONSTANTS.SERVICE_RADIUS_MILES): Promise<ValidatedCity[]> {
    try {
      const radiusMeters = radiusMiles * 1609.34; // Convert miles to meters
      const { lat, lng } = centerCity.coordinates;
      
      // Use Google Places Nearby Search to find cities
      const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&type=locality&key=${GOOGLE_PLACES_API_KEY}`;
      
      const response = await fetch(nearbyUrl);
      const data = await response.json();
      
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places Nearby API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }
      
      const places = data.results || [];
      const nearbyCities: ValidatedCity[] = [];
      
      // Process each nearby place
      for (const place of places) {
        // Skip the center city itself
        if (place.place_id === centerCity.placeId) continue;
        
        try {
          const cityDetails = await this.getCityDetails(place.place_id);
          if (cityDetails && this.isCityInSameCountry(cityDetails, centerCity)) {
            nearbyCities.push(cityDetails);
          }
        } catch (error) {
        }
        
        // Limit results to prevent data bloat
        if (nearbyCities.length >= REALTOR_CONSTANTS.MAX_NEARBY_CITIES) {
          break;
        }
      }
      
      // Sort by distance from center city
      return nearbyCities.sort((a, b) => {
        const distanceA = this.calculateDistance(centerCity.coordinates, a.coordinates);
        const distanceB = this.calculateDistance(centerCity.coordinates, b.coordinates);
        return distanceA - distanceB;
      });
      
    } catch (error) {
      throw new Error(`Nearby cities search failed: ${error}`);
    }
  }
  
  // Create complete service area with primary city + nearby cities
  static async createServiceArea(primaryCityQuery: string): Promise<ServiceArea> {
    try {
      // First, validate and get the primary city
      const searchResults = await this.searchCities(primaryCityQuery, 1);
      
      if (searchResults.length === 0) {
        throw new Error(`No cities found for "${primaryCityQuery}". Please check spelling and try again.`);
      }
      
      const primaryCity = searchResults[0];
      
      // Find nearby cities within 30 miles
      const nearbyCities = await this.findNearbyCities(primaryCity);
      
      return {
        primaryCity,
        nearbyCities,
        radiusMiles: REALTOR_CONSTANTS.SERVICE_RADIUS_MILES,
        totalCitiesServed: 1 + nearbyCities.length,
        lastUpdated: Timestamp.now()
      };
      
    } catch (error) {
      throw error;
    }
  }
  
  // Update existing service area with new primary city
  static async updateServiceArea(currentServiceArea: ServiceArea, newPrimaryCityQuery: string): Promise<ServiceArea> {
    try {
      return await this.createServiceArea(newPrimaryCityQuery);
    } catch (error) {
      throw error;
    }
  }
  
  // Parse Google Place result into our ValidatedCity format
  private static parseGooglePlaceToCity(place: GooglePlace): ValidatedCity | null {
    try {
      // Extract city name and state from address components
      let cityName = '';
      let stateName = '';
      let stateCode = '';
      
      for (const component of place.address_components) {
        if (component.types.includes('locality')) {
          cityName = component.long_name;
        } else if (component.types.includes('administrative_area_level_1')) {
          stateName = component.long_name;
          stateCode = component.short_name;
        }
      }
      
      // Fallback to place name if no locality found
      if (!cityName) {
        cityName = place.name;
      }
      
      if (!cityName || !stateCode) {
        return null;
      }
      
      return {
        name: cityName,
        state: stateName,
        stateCode: stateCode,
        placeId: place.place_id,
        coordinates: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
        },
        formattedAddress: place.formatted_address
      };
      
    } catch (error) {
      return null;
    }
  }
  
  // Check if two cities are in the same country (US focus)
  private static isCityInSameCountry(city1: ValidatedCity, city2: ValidatedCity): boolean {
    // For now, simple check - both should be US cities
    // Could be enhanced to parse country from formatted_address
    return city1.formattedAddress.includes('USA') && city2.formattedAddress.includes('USA');
  }
  
  // Calculate distance between two coordinates (Haversine formula)
  private static calculateDistance(coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(coord2.lat - coord1.lat);
    const dLon = this.toRadians(coord2.lng - coord1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(coord1.lat)) * Math.cos(this.toRadians(coord2.lat)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

// Validation helper functions
export function validateCityQuery(query: string): { isValid: boolean; error?: string } {
  if (!query || query.trim().length < 2) {
    return { isValid: false, error: 'City name must be at least 2 characters long' };
  }
  
  if (query.length > 100) {
    return { isValid: false, error: 'City name is too long' };
  }
  
  // Basic validation - letters, spaces, commas only
  const validCharsRegex = /^[a-zA-Z\s,.-]+$/;
  if (!validCharsRegex.test(query)) {
    return { isValid: false, error: 'City name contains invalid characters' };
  }
  
  return { isValid: true };
}

// Rate limiting helper with automatic cleanup to prevent memory leaks
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private lastCleanup: number = Date.now();
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // Clean up every 5 minutes
  private readonly MAX_ENTRIES = 10000; // Maximum entries before forced cleanup

  // Allow max 10 requests per minute per IP
  canMakeRequest(identifier: string, maxRequests: number = 10, windowMinutes: number = 1): boolean {
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    // Periodic cleanup to prevent memory leaks
    if (now - this.lastCleanup > this.CLEANUP_INTERVAL || this.requests.size > this.MAX_ENTRIES) {
      this.cleanup(windowMs);
    }

    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }

    const requests = this.requests.get(identifier)!;

    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);

    if (validRequests.length >= maxRequests) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);

    return true;
  }

  // Clean up stale entries to prevent memory leaks
  private cleanup(windowMs: number): void {
    const now = Date.now();
    this.lastCleanup = now;

    for (const [identifier, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
      if (validTimestamps.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, validTimestamps);
      }
    }

    console.log(`[RateLimiter] Cleanup complete. ${this.requests.size} active entries.`);
  }
}

export const googlePlacesRateLimiter = new RateLimiter();