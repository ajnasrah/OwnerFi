import { unifiedDb } from './unified-db';
import { BuyerProfile } from './firebase-models';

// Simplified property interface for matching algorithm
interface PropertyForMatching {
  id: string;
  monthlyPayment: number;
  downPaymentAmount: number;
  latitude?: number;
  longitude?: number;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
}

// Simplified buyer interface for matching algorithm
// Extracted from BuyerProfile (firebase-models.ts)
interface BuyerForMatching {
  id: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
  preferredCity: string;
  preferredState: string;
  searchRadius: number;
  latitude?: number;
  longitude?: number;
  minBedrooms?: number;
  minBathrooms?: number;
}

interface MatchResult {
  matches: boolean;
  score: number;
  matchedOn: {
    monthly_payment: boolean;
    down_payment: boolean;
    location: boolean;
    bedrooms: boolean;
    bathrooms: boolean;
  };
}



// Check if a property matches a buyer's criteria
export function isPropertyMatch(property: PropertyForMatching, buyer: BuyerForMatching): MatchResult {
  const matchedOn = {
    monthly_payment: false,
    down_payment: false,
    location: false,
    bedrooms: false,
    bathrooms: false
  };
  
  let score = 0;
  let totalCriteria = 0;

  // 1. Monthly Payment Check (CRITICAL)
  totalCriteria++;
  if (property.monthlyPayment <= buyer.maxMonthlyPayment) {
    matchedOn.monthly_payment = true;
    score++;
  } else {
    // If monthly payment doesn't match, it's not a valid match
    return { matches: false, score: 0, matchedOn };
  }

  // 2. Down Payment Check (CRITICAL)  
  totalCriteria++;
  if (property.downPaymentAmount <= buyer.maxDownPayment) {
    matchedOn.down_payment = true;
    score++;
  } else {
    // If down payment doesn't match, it's not a valid match
    return { matches: false, score: 0, matchedOn };
  }

  // 3. Location Check (CRITICAL) - Within buyer's search radius
  totalCriteria++;
  // For now, check if property city/state matches buyer's preferred city/state
  // TODO: Add proper geographic distance calculation
  if (property.city === buyer.preferredCity && property.state === buyer.preferredState) {
    matchedOn.location = true;
    score++;
  } else {
    // If location doesn't match, it's not a valid match
    return { matches: false, score: 0, matchedOn };
  }

  // 4. Bedrooms (Optional - if buyer specified)
  if (buyer.minBedrooms) {
    totalCriteria++;
    if (property.bedrooms >= buyer.minBedrooms) {
      matchedOn.bedrooms = true;
      score++;
    }
  }

  // 5. Bathrooms (Optional - if buyer specified)
  if (buyer.minBathrooms) {
    totalCriteria++;
    if (property.bathrooms >= buyer.minBathrooms) {
      matchedOn.bathrooms = true;
      score++;
    }
  }

  const finalScore = score / totalCriteria;
  
  return { 
    matches: true, // All critical criteria passed
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
          withinBudget: true,
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
          withinBudget: true,
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