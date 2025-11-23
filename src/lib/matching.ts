import { unifiedDb } from './unified-db';
import { BuyerProfile } from './firebase-models';

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
}

interface MatchResult {
  matches: boolean;
  score: number;
  matchedOn: {
    location: boolean;
    bedrooms: boolean;
    bathrooms: boolean;
  };
}



// Check if a property matches a buyer's criteria
// Location-based matching only (NO budget filtering)
export function isPropertyMatch(property: PropertyForMatching, buyer: BuyerForMatching): MatchResult {
  const matchedOn = {
    location: false,
    bedrooms: false,
    bathrooms: false
  };

  let score = 0;
  let totalCriteria = 0;

  // 1. Location Check (CRITICAL) - Must match buyer's preferred city/state
  totalCriteria++;
  if (property.city === buyer.preferredCity && property.state === buyer.preferredState) {
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
    matchedOn
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