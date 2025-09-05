// Property matching algorithm - calculates how many properties match each buyer
import { BuyerProfile, Property, PropertyMatch, normalizeState } from './firebase-models';

export interface PropertyMatchResult {
  buyerId: string;
  totalMatches: number;
  perfectMatches: number; // 100% match on all criteria
  goodMatches: number;    // 80%+ match
  fairMatches: number;    // 60%+ match
  matchDetails: {
    withinBudget: number;
    withinLocation: number;
    meetsRoomRequirements: number;
    withinRadius: number;
  };
}

export class PropertyMatcher {
  
  // Calculate property matches for a buyer
  static calculateMatches(buyer: BuyerProfile, properties: Property[]): PropertyMatchResult {
    const result: PropertyMatchResult = {
      buyerId: buyer.id,
      totalMatches: 0,
      perfectMatches: 0,
      goodMatches: 0,
      fairMatches: 0,
      matchDetails: {
        withinBudget: 0,
        withinLocation: 0,
        meetsRoomRequirements: 0,
        withinRadius: 0
      }
    };

    for (const property of properties) {
      if (!property.isActive) continue;

      const matchScore = this.scorePropertyMatch(buyer, property);
      
      if (matchScore.totalScore >= 60) {
        result.totalMatches++;
        
        if (matchScore.totalScore >= 95) {
          result.perfectMatches++;
        } else if (matchScore.totalScore >= 80) {
          result.goodMatches++;
        } else {
          result.fairMatches++;
        }

        // Count specific criteria
        if (matchScore.budgetMatch) result.matchDetails.withinBudget++;
        if (matchScore.locationMatch) result.matchDetails.withinLocation++;
        if (matchScore.roomsMatch) result.matchDetails.meetsRoomRequirements++;
        if (matchScore.radiusMatch) result.matchDetails.withinRadius++;
      }
    }

    return result;
  }

  // Score individual property against buyer criteria
  private static scorePropertyMatch(buyer: BuyerProfile, property: Property): {
    totalScore: number;
    budgetMatch: boolean;
    locationMatch: boolean;
    roomsMatch: boolean;
    radiusMatch: boolean;
    factors: {
      budget: number;
      location: number;
      rooms: number;
      radius: number;
    };
  } {
    const factors = {
      budget: 0,
      location: 0,
      rooms: 0,
      radius: 0
    };

    // 1. Budget matching (40% weight)
    const monthlyAffordable = property.monthlyPayment <= buyer.maxMonthlyPayment;
    const downAffordable = property.downPaymentAmount <= buyer.maxDownPayment;
    
    if (monthlyAffordable && downAffordable) {
      factors.budget = 100;
    } else if (monthlyAffordable || downAffordable) {
      factors.budget = 50;
    }

    // 2. Location matching (30% weight)
    const buyerState = normalizeState(buyer.preferredState);
    const propertyState = normalizeState(property.state);
    
    if (buyer.preferredCity?.toLowerCase() === property.city?.toLowerCase() && 
        buyerState === propertyState) {
      factors.location = 100; // Same city
    } else if (buyerState === propertyState) {
      factors.location = 70; // Same state
    }

    // 3. Room requirements (20% weight)
    const bedroomMatch = !buyer.minBedrooms || property.bedrooms >= buyer.minBedrooms;
    const bathroomMatch = !buyer.minBathrooms || property.bathrooms >= buyer.minBathrooms;
    
    if (bedroomMatch && bathroomMatch) {
      factors.rooms = 100;
    } else if (bedroomMatch || bathroomMatch) {
      factors.rooms = 50;
    }

    // 4. Distance/radius (10% weight)
    if (buyer.preferredCity && property.city && buyer.searchRadius) {
      // Simplified distance check - in real app would use coordinates
      const sameCity = buyer.preferredCity.toLowerCase() === property.city.toLowerCase();
      if (sameCity) {
        factors.radius = 100;
      } else {
        // Could implement actual distance calculation here
        factors.radius = 30; // Assume within reasonable distance for same state
      }
    } else {
      factors.radius = 50; // Neutral if no location data
    }

    // Calculate weighted total score
    const totalScore = 
      (factors.budget * 0.4) + 
      (factors.location * 0.3) + 
      (factors.rooms * 0.2) + 
      (factors.radius * 0.1);

    return {
      totalScore: Math.round(totalScore),
      budgetMatch: factors.budget >= 80,
      locationMatch: factors.location >= 70,
      roomsMatch: factors.rooms >= 80,
      radiusMatch: factors.radius >= 70,
      factors
    };
  }

  // Get match summary for display
  static getMatchSummary(matchResult: PropertyMatchResult): string {
    const { totalMatches, perfectMatches, goodMatches } = matchResult;
    
    if (totalMatches === 0) {
      return 'No matching properties';
    }
    
    if (perfectMatches > 0) {
      return `${totalMatches} matches (${perfectMatches} perfect)`;
    }
    
    if (goodMatches > 0) {
      return `${totalMatches} matches (${goodMatches} excellent)`;
    }
    
    return `${totalMatches} matches`;
  }

  // Generate buyer quality score for realtors
  static getBuyerQualityScore(buyer: BuyerProfile, propertyMatches: PropertyMatchResult): {
    score: number; // 0-100
    level: 'Premium' | 'High Quality' | 'Standard' | 'Low Interest';
    reasoning: string[];
  } {
    const reasoning: string[] = [];
    let score = 50; // Base score

    // Property match quality (30 points possible)
    if (propertyMatches.perfectMatches > 3) {
      score += 30;
      reasoning.push(`🎯 ${propertyMatches.perfectMatches} perfect property matches`);
    } else if (propertyMatches.totalMatches > 5) {
      score += 20;
      reasoning.push(`✅ ${propertyMatches.totalMatches} good property matches`);
    } else if (propertyMatches.totalMatches > 0) {
      score += 10;
      reasoning.push(`👍 ${propertyMatches.totalMatches} property matches`);
    } else {
      score -= 10;
      reasoning.push(`⚠️ No matching properties in system`);
    }

    // Budget level (20 points possible)
    if (buyer.maxMonthlyPayment > 4000) {
      score += 20;
      reasoning.push(`💎 High budget ($${buyer.maxMonthlyPayment}/month)`);
    } else if (buyer.maxMonthlyPayment > 2500) {
      score += 15;
      reasoning.push(`💰 Good budget ($${buyer.maxMonthlyPayment}/month)`);
    } else if (buyer.maxMonthlyPayment > 1500) {
      score += 10;
      reasoning.push(`📊 Standard budget ($${buyer.maxMonthlyPayment}/month)`);
    } else {
      score += 5;
      reasoning.push(`🔍 Starter budget ($${buyer.maxMonthlyPayment}/month)`);
    }

    // Down payment (15 points possible)  
    if (buyer.maxDownPayment > 75000) {
      score += 15;
      reasoning.push(`🏛️ Substantial down payment ($${buyer.maxDownPayment.toLocaleString()})`);
    } else if (buyer.maxDownPayment > 30000) {
      score += 10;
      reasoning.push(`💳 Solid down payment ($${buyer.maxDownPayment.toLocaleString()})`);
    }

    // Profile completeness (10 points possible)
    if (buyer.profileComplete) {
      score += 10;
      reasoning.push(`✅ Complete profile ready to buy`);
    }

    // Requirements specificity (5 points possible)
    if (buyer.minBedrooms && buyer.minBathrooms) {
      score += 5;
      reasoning.push(`🏠 Clear requirements (${buyer.minBedrooms}br/${buyer.minBathrooms}ba)`);
    }

    // Determine level
    let level: 'Premium' | 'High Quality' | 'Standard' | 'Low Interest';
    if (score >= 85) {
      level = 'Premium';
    } else if (score >= 70) {
      level = 'High Quality';
    } else if (score >= 50) {
      level = 'Standard';
    } else {
      level = 'Low Interest';
    }

    return { score: Math.min(score, 100), level, reasoning };
  }
}

// Simple property database for testing (will be replaced with real Firebase data)
export const SAMPLE_PROPERTIES: Property[] = [
  {
    id: '1',
    address: '1234 Memphis St',
    city: 'Memphis',
    state: 'TN',
    zipCode: '38103',
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1450,
    listPrice: 185000,
    downPaymentAmount: 18500,
    monthlyPayment: 1250,
    interestRate: 6.5,
    termYears: 15,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    address: '5678 Nashville Ave',
    city: 'Nashville',
    state: 'TN',
    zipCode: '37203',
    bedrooms: 4,
    bathrooms: 3,
    squareFeet: 2100,
    listPrice: 275000,
    downPaymentAmount: 27500,
    monthlyPayment: 1850,
    interestRate: 6.2,
    termYears: 20,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    address: '9101 Knoxville Rd',
    city: 'Knoxville',
    state: 'TN',
    zipCode: '37920',
    bedrooms: 2,
    bathrooms: 2,
    squareFeet: 1200,
    listPrice: 145000,
    downPaymentAmount: 14500,
    monthlyPayment: 980,
    interestRate: 7.0,
    termYears: 15,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Calculate matches for all properties (to be used by APIs)
export function calculateBuyerPropertyMatches(buyer: BuyerProfile): PropertyMatchResult {
  return PropertyMatcher.calculateMatches(buyer, SAMPLE_PROPERTIES);
}