// Property Enhancement Service - Adds nearby cities for similar property searches
// Only modifies property data, does not touch buyer or realtor modules

import { getCitiesWithinRadius, calculateDistance, getCityCoordinates } from './cities';
import { queueNearbyCitiesJob } from './background-jobs';
import { getNearbyCitiesUltraFast } from './cities-service-v2';
import { getCitiesNearProperty } from './comprehensive-us-cities';
import { PropertyListing } from './property-schema';

/**
 * FAST: Queue nearby cities population for background processing
 * Property creation no longer blocks on external API calls
 */
export function queueNearbyCitiesForProperty(
  propertyId: string,
  propertyCity: string,
  propertyState: string
): void {
  queueNearbyCitiesJob(propertyId, propertyCity, propertyState);
}

/**
 * COMPREHENSIVE: Get nearby cities using complete US database
 * Works for ANY city in America - no manual curation needed
 */
export async function populateNearbyCitiesForPropertyFast(
  propertyCity: string,
  propertyState: string,
  radiusMiles: number = 30
): Promise<string[]> {
  // Use comprehensive database first (covers all US cities)
  try {
    const comprehensiveResults = await getCitiesNearProperty(propertyCity, propertyState, radiusMiles);
    if (comprehensiveResults.length > 0) {
      return comprehensiveResults;
    }
  } catch (error) {
    
  }
  
  // Fallback to limited database if needed
  const nearbyCities = await getNearbyCitiesUltraFast(propertyCity, propertyState, radiusMiles);
  return nearbyCities.map(city => city.name);
}

/**
 * LEGACY: Old slow method - use populateNearbyCitiesForPropertyFast instead
 */
export async function populateNearbyCitiesForProperty(
  propertyCity: string,
  propertyState: string,
  radiusMiles: number = 30
): Promise<string[]> {
  return populateNearbyCitiesForPropertyFast(propertyCity, propertyState, radiusMiles);
}

export interface NearbyCity {
  name: string;
  state: string;
  distance: number;
}

/**
 * Get cities within 30-mile radius of a property location
 * Uses existing cities database for fast lookups
 */
export function getNearbyCitiesForProperty(
  propertyCity: string, 
  propertyState: string,
  radiusMiles: number = 30
): string[] {
  try {
    const nearbyCities = getCitiesWithinRadius(propertyCity, propertyState, radiusMiles);
    
    // Return just city names (excluding the property's own city)
    return nearbyCities
      .filter(city => !(city.name.toLowerCase() === propertyCity.toLowerCase() && city.state === propertyState))
      .map(city => city.name)
      .slice(0, 20); // Limit to 20 nearby cities
      
  } catch {
    return [];
  }
}

/**
 * Get detailed nearby cities with distances for display
 */
export function getNearbyCitiesWithDistance(
  propertyCity: string,
  propertyState: string,
  radiusMiles: number = 30
): NearbyCity[] {
  try {
    const nearbyCities = getCitiesWithinRadius(propertyCity, propertyState, radiusMiles);
    
    return nearbyCities
      .filter(city => !(city.name.toLowerCase() === propertyCity.toLowerCase() && city.state === propertyState))
      .map(city => ({
        name: city.name,
        state: city.state,
        distance: calculateDistance(
          city.lat, city.lng,
          nearbyCities.find(c => c.name.toLowerCase() === propertyCity.toLowerCase())?.lat || 0,
          nearbyCities.find(c => c.name.toLowerCase() === propertyCity.toLowerCase())?.lng || 0
        )
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);
      
  } catch {
    return [];
  }
}

/**
 * Enhance property with nearby cities data
 * This function only adds data to property objects, doesn't modify storage
 */
export function enhancePropertyWithNearbyCities(property: PropertyListing & { id: string }): PropertyListing & { id: string } {
  if (!property.city || !property.state) {
    return property;
  }

  // Add nearby cities array if not already present
  if (!property.nearbyCities) {
    property.nearbyCities = getNearbyCitiesForProperty(property.city as string, property.state as string);
  }

  return property;
}

/**
 * Bulk enhance multiple properties with nearby cities
 */
export function enhancePropertiesWithNearbyCities(properties: (PropertyListing & { id: string })[]): (PropertyListing & { id: string })[] {
  return properties.map(property => enhancePropertyWithNearbyCities(property));
}

/**
 * Get properties for "similar/nearby" search based on property location
 * This extends search beyond just the property's city to include nearby cities
 * Uses comprehensive city lookup via API instead of limited cities database
 */
export async function expandSearchToNearbyCitiesAPI(
  propertyCity: string,
  propertyState: string,
  radiusMiles: number = 30
): Promise<string[]> {
  try {
    // Get coordinates for the property city first
    const cityCoords = getCityCoordinates(propertyCity, propertyState);
    if (!cityCoords) {
      return [propertyCity];
    }

    // Call the comprehensive within-radius API
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
    const response = await fetch(`${baseUrl}/api/cities/within-radius?lat=${cityCoords.lat}&lng=${cityCoords.lng}&radius=${radiusMiles}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch nearby cities');
    }
    
    const data = await response.json() as { cities: Array<{ name: string }> };
    
    // Extract city names from the comprehensive results
    const allCityNames = data.cities
      .map((city) => city.name)
      .filter((name: string) => name && name.trim().length > 0);
    
    // Remove duplicates and include original city
    const uniqueCities = Array.from(new Set([propertyCity, ...allCityNames]));
    
    
    return uniqueCities;
    
  } catch {
    // Fallback to limited database
    return expandSearchToNearbyCities(propertyCity, propertyState, radiusMiles);
  }
}

/**
 * Synchronous version using limited cities database (fallback)
 */
export function expandSearchToNearbyCities(
  propertyCity: string,
  propertyState: string,
  radiusMiles: number = 30
): string[] {
  const nearbyCities = getNearbyCitiesForProperty(propertyCity, propertyState, radiusMiles);
  
  // Include the original city plus nearby cities
  return [propertyCity, ...nearbyCities];
}