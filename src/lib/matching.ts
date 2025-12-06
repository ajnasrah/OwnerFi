import { unifiedDb } from './unified-db';
import { BuyerProfile, normalizeState } from './firebase-models';

// Simplified property interface for matching algorithm
interface PropertyForMatching {
  id: string;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  listPrice?: number;
  latitude?: number;
  longitude?: number;
}

// Simplified buyer interface for matching algorithm
// Extracted from BuyerProfile (firebase-models.ts)
interface BuyerForMatching {
  id: string;
  preferredCity: string;
  preferredState: string;
  searchRadius: number;
  latitude?: number;
  longitude?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  maxBathrooms?: number;
  minSquareFeet?: number;
  maxSquareFeet?: number;
  minPrice?: number;
  maxPrice?: number;
  // Pre-computed filter from buyer profile
  filter?: {
    nearbyCities?: string[];
    boundingBox?: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    };
  };
}

/**
 * Calculate distance between two lat/lng points using Haversine formula
 * Returns distance in miles
 */
function calculateDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Normalize city name for comparison
 * Handles case differences and common variations
 */
function normalizeCity(city: string): string {
  if (!city) return '';
  return city.trim().toLowerCase();
}

interface MatchResult {
  matches: boolean;
  score: number;
  matchedOn: {
    location: boolean;
    bedrooms: boolean;
    bathrooms: boolean;
  };
  distanceMiles?: number;
}

/**
 * Check if property is within buyer's location criteria
 * Uses multiple fallback strategies:
 * 1. Check if property city is in buyer's pre-computed nearbyCities array
 * 2. Check exact city match (preferred city)
 * 3. Calculate distance using lat/lng if available
 * 4. Check bounding box if available
 */
function isLocationMatch(
  property: PropertyForMatching,
  buyer: BuyerForMatching
): { matches: boolean; distanceMiles?: number } {
  const propCity = normalizeCity(property.city);
  const propState = normalizeState(property.state);
  const buyerCity = normalizeCity(buyer.preferredCity);
  const buyerState = normalizeState(buyer.preferredState);

  // Strategy 1: Check if property city is in buyer's nearbyCities array
  if (buyer.filter?.nearbyCities && buyer.filter.nearbyCities.length > 0) {
    const normalizedNearbyCities = buyer.filter.nearbyCities.map(c => normalizeCity(c));
    if (normalizedNearbyCities.includes(propCity)) {
      // City is in the pre-computed list - this is a match!
      // Calculate approximate distance if we have coordinates
      if (property.latitude && property.longitude && buyer.latitude && buyer.longitude) {
        const distance = calculateDistanceMiles(
          buyer.latitude, buyer.longitude,
          property.latitude, property.longitude
        );
        return { matches: true, distanceMiles: distance };
      }
      return { matches: true };
    }
  }

  // Strategy 2: Exact city/state match (always allow preferred city)
  if (propCity === buyerCity && propState === buyerState) {
    return { matches: true, distanceMiles: 0 };
  }

  // Strategy 3: Calculate actual distance if both have lat/lng
  if (property.latitude && property.longitude && buyer.latitude && buyer.longitude) {
    const distance = calculateDistanceMiles(
      buyer.latitude, buyer.longitude,
      property.latitude, property.longitude
    );
    // Check if within search radius (default to 25 miles if not set)
    const radius = buyer.searchRadius || 25;
    if (distance <= radius) {
      return { matches: true, distanceMiles: distance };
    }
  }

  // Strategy 4: Check bounding box if available
  if (buyer.filter?.boundingBox && property.latitude && property.longitude) {
    const { minLat, maxLat, minLng, maxLng } = buyer.filter.boundingBox;
    if (
      property.latitude >= minLat &&
      property.latitude <= maxLat &&
      property.longitude >= minLng &&
      property.longitude <= maxLng
    ) {
      return { matches: true };
    }
  }

  // No match found
  return { matches: false };
}

// Check if a property matches a buyer's criteria
// Uses radius-based matching with nearbyCities fallback
export function isPropertyMatch(property: PropertyForMatching, buyer: BuyerForMatching): MatchResult {
  const matchedOn = {
    location: false,
    bedrooms: false,
    bathrooms: false
  };

  let score = 0;
  let totalCriteria = 0;

  // 1. Location Check (CRITICAL) - Must be within buyer's search area
  totalCriteria++;
  const locationResult = isLocationMatch(property, buyer);
  if (locationResult.matches) {
    matchedOn.location = true;
    score++;
  } else {
    // If location doesn't match, it's not a valid match
    return { matches: false, score: 0, matchedOn };
  }

  // 2. Bedrooms (Optional - if buyer specified)
  if (buyer.minBedrooms !== undefined || buyer.maxBedrooms !== undefined) {
    totalCriteria++;
    const meetsMin = buyer.minBedrooms === undefined || property.bedrooms >= buyer.minBedrooms;
    const meetsMax = buyer.maxBedrooms === undefined || property.bedrooms <= buyer.maxBedrooms;
    if (meetsMin && meetsMax) {
      matchedOn.bedrooms = true;
      score++;
    } else {
      // If bedrooms don't match criteria, it's not a valid match
      return { matches: false, score: 0, matchedOn };
    }
  }

  // 3. Bathrooms (Optional - if buyer specified)
  if (buyer.minBathrooms !== undefined || buyer.maxBathrooms !== undefined) {
    totalCriteria++;
    const meetsMin = buyer.minBathrooms === undefined || property.bathrooms >= buyer.minBathrooms;
    const meetsMax = buyer.maxBathrooms === undefined || property.bathrooms <= buyer.maxBathrooms;
    if (meetsMin && meetsMax) {
      matchedOn.bathrooms = true;
      score++;
    } else {
      // If bathrooms don't match criteria, it's not a valid match
      return { matches: false, score: 0, matchedOn };
    }
  }

  // 4. Square Feet (Optional - if buyer specified and property has sqft data)
  if ((buyer.minSquareFeet !== undefined || buyer.maxSquareFeet !== undefined) && property.squareFeet) {
    totalCriteria++;
    const meetsMin = buyer.minSquareFeet === undefined || property.squareFeet >= buyer.minSquareFeet;
    const meetsMax = buyer.maxSquareFeet === undefined || property.squareFeet <= buyer.maxSquareFeet;
    if (meetsMin && meetsMax) {
      score++;
    } else {
      // If square feet don't match criteria, it's not a valid match
      return { matches: false, score: 0, matchedOn };
    }
  }

  // 5. Asking Price (Optional - if buyer specified and property has price)
  if ((buyer.minPrice !== undefined || buyer.maxPrice !== undefined) && property.listPrice) {
    totalCriteria++;
    const meetsMin = buyer.minPrice === undefined || property.listPrice >= buyer.minPrice;
    const meetsMax = buyer.maxPrice === undefined || property.listPrice <= buyer.maxPrice;
    if (meetsMin && meetsMax) {
      score++;
    } else {
      // If price doesn't match criteria, it's not a valid match
      return { matches: false, score: 0, matchedOn };
    }
  }

  const finalScore = score / totalCriteria;

  return {
    matches: true, // Location matched + optional criteria
    score: finalScore,
    matchedOn,
    distanceMiles: locationResult.distanceMiles
  };
}

// Match a new buyer to all existing properties
export async function matchBuyerToProperties(buyerId: string) {
  try {
    // Get buyer profile
    const buyer = await unifiedDb.buyerProfiles.findById(buyerId);
    if (!buyer) throw new Error('Buyer not found');

    // Get all active properties
    const allProperties = await unifiedDb.properties.findAllActive();
    
    const matches = [];
    
    for (const property of allProperties) {
      const matchResult = isPropertyMatch(property, buyer);
      
      if (matchResult.matches) {
        matches.push({
          propertyId: property.id,
          buyerId: buyerId,
          matchedOn: JSON.stringify(matchResult.matchedOn),
          matchScore: matchResult.score,
          isActive: true,
          matchedAt: new Date().toISOString(),
          withinRadius: true,
          meetsRequirements: true
        });
      }
    }

    // Insert all matches
    if (matches.length > 0) {
      await unifiedDb.propertyBuyerMatches.createMany(matches);
    }

    return { matchedProperties: matches.length, totalProperties: allProperties.length };
  } catch (error) {
    throw new Error(`Failed to match buyer to properties: ${error}`);
  }
}

// Match a new property to all existing buyers
export async function matchPropertyToBuyers(propertyId: string) {
  try {
    // Get property
    const property = await unifiedDb.properties.findById(propertyId);
    if (!property) throw new Error('Property not found');

    // Get all active buyer profiles
    const allBuyers = await unifiedDb.buyerProfiles.findAllActive();
    
    const matches = [];
    
    for (const buyer of allBuyers) {
      const matchResult = isPropertyMatch(property as PropertyForMatching, buyer as BuyerForMatching);
      
      if (matchResult.matches) {
        matches.push({
          propertyId: propertyId,
          buyerId: buyer.id,
          matchedOn: JSON.stringify(matchResult.matchedOn),
          matchScore: matchResult.score,
          isActive: true,
          matchedAt: new Date().toISOString(),
          withinRadius: true,
          meetsRequirements: true
        });
      }
    }

    // Insert all matches
    if (matches.length > 0) {
      await unifiedDb.propertyBuyerMatches.createMany(matches);
    }

    return { matchedBuyers: matches.length, totalBuyers: allBuyers.length };
  } catch (error) {
    throw new Error(`Failed to match property to buyers: ${error}`);
  }
}

// Get all properties matched to a specific buyer
export async function getBuyerMatches(buyerId: string) {
  try {
    const matches = await unifiedDb.propertyBuyerMatches.getBuyerMatches(buyerId);
    return matches;
  } catch (error) {
    throw new Error(`Failed to get buyer matches: ${error}`);
  }
}