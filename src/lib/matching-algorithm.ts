// Advanced buyer-realtor matching algorithm with percentage scoring

interface BuyerProfile {
  id: string;
  preferredCity: string;
  preferredState: string;
  searchRadius: number;
  languages?: string[];
  maxMonthlyPayment: number;
  maxDownPayment: number;
  minBedrooms?: number;
  minBathrooms?: number;
  profileComplete: boolean;
  createdAt: Date | string;
}

interface RealtorProfile {
  id: string;
  primaryCity: string;
  primaryState: string;
  serviceRadius: number;
  serviceStates?: string[];
  serviceCities?: string[];
  languages?: string[];
  company: string;
  experienceLevel?: 'new' | 'experienced' | 'expert';
  specializations?: string[]; // e.g., ['first-time-buyers', 'luxury', 'investment']
  avgResponseTime?: number; // hours
  successRate?: number; // percentage of closed deals
}

interface MatchResult {
  buyerId: string;
  realtorId: string;
  matchPercentage: number;
  matchFactors: {
    location: number;
    language: number;
    expertise: number;
    responsiveness: number;
    specialization: number;
  };
  reasoning: string[];
}

// Calculate distance between two lat/lng points (Haversine formula)
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

// Normalize state names for consistent comparison
function normalizeState(state: string): string {
  const stateMap: Record<string, string> = {
    'Texas': 'TX', 'Florida': 'FL', 'Georgia': 'GA', 'Tennessee': 'TN',
    'California': 'CA', 'New York': 'NY', 'Illinois': 'IL', 'Ohio': 'OH',
    'Michigan': 'MI', 'Pennsylvania': 'PA', 'North Carolina': 'NC',
    'TX': 'TX', 'FL': 'FL', 'GA': 'GA', 'TN': 'TN',
    'CA': 'CA', 'NY': 'NY', 'IL': 'IL', 'OH': 'OH'
  };
  return stateMap[state] || state;
}

export class MatchingEngine {
  
  // Simple matching: ONLY city overlap + language match
  static calculateMatch(buyer: BuyerProfile, realtor: RealtorProfile): MatchResult {
    const factors = {
      location: 0,
      language: 0,
      expertise: 0,
      responsiveness: 0,
      specialization: 0
    };
    
    const reasoning: string[] = [];

    // 1. CITY MATCHING (70% weight) - Most important
    factors.location = this.calculateCityOverlap(buyer, realtor, reasoning);

    // 2. LANGUAGE MATCHING (30% weight) - Communication is key
    factors.language = this.calculateLanguageMatch(buyer, realtor, reasoning);

    // Simple weighted score: 70% location, 30% language
    const matchPercentage = Math.round(
      (factors.location * 0.7) + (factors.language * 0.3)
    );

    return {
      buyerId: buyer.id,
      realtorId: realtor.id,
      matchPercentage,
      matchFactors: factors,
      reasoning
    };
  }

  // Check for city overlap between buyer search area and realtor service area
  private static calculateCityOverlap(buyer: BuyerProfile, realtor: RealtorProfile, reasoning: string[]): number {
    // Buyer is looking in: Memphis, Oakland, Arlington
    // Realtor serves: Memphis, Oakland, Arlington  
    // = Perfect 100% overlap
    
    const buyerCities = this.extractCities(buyer);
    const realtorCities = this.extractCities(realtor);
    
    // Find overlapping cities
    const overlappingCities = buyerCities.filter(buyerCity => 
      realtorCities.some(realtorCity => 
        this.citiesMatch(buyerCity, realtorCity)
      )
    );
    
    if (overlappingCities.length === 0) {
      reasoning.push(`❌ No overlapping service areas`);
      return 0;
    }
    
    // Calculate percentage based on overlap
    const overlapPercentage = (overlappingCities.length / buyerCities.length) * 100;
    
    if (overlapPercentage === 100) {
      reasoning.push(`🎯 Perfect city match: All your preferred cities (${overlappingCities.join(', ')})`);
      return 100;
    } else if (overlapPercentage >= 50) {
      reasoning.push(`✅ Great coverage: Serves ${overlappingCities.length}/${buyerCities.length} of your cities (${overlappingCities.join(', ')})`);
      return Math.round(overlapPercentage);
    } else {
      reasoning.push(`⚠️ Limited coverage: Only serves ${overlappingCities.join(', ')} from your search area`);
      return Math.round(overlapPercentage);
    }
  }

  // Extract cities from buyer/realtor profiles
  private static extractCities(profile: BuyerProfile | RealtorProfile): string[] {
    const cities: string[] = [];
    
    // Primary city
    if ('preferredCity' in profile) {
      cities.push(profile.preferredCity);
    } else if ('primaryCity' in profile) {
      cities.push(profile.primaryCity);
    }
    
    // Additional service cities for realtors
    if ('serviceCities' in profile && profile.serviceCities) {
      profile.serviceCities.forEach(cityState => {
        // Extract just the city name from "City, State" format
        const city = cityState.split(',')[0]?.trim();
        if (city && !cities.includes(city)) {
          cities.push(city);
        }
      });
    }
    
    return cities.filter(Boolean);
  }

  // Check if two city names match (handles variations)
  private static citiesMatch(city1: string, city2: string): boolean {
    if (!city1 || !city2) return false;
    
    const normalize = (city: string) => city.toLowerCase().trim();
    return normalize(city1) === normalize(city2);
  }

  // Location compatibility (0-100)
  private static calculateLocationMatch(buyer: BuyerProfile, realtor: RealtorProfile, reasoning: string[]): number {
    const buyerState = normalizeState(buyer.preferredState);
    const realtorState = normalizeState(realtor.primaryState);

    // Same city = perfect match
    if (buyer.preferredCity?.toLowerCase() === realtor.primaryCity?.toLowerCase() && 
        buyerState === realtorState) {
      reasoning.push(`🎯 Perfect location match: Same city (${buyer.preferredCity})`);
      return 100;
    }

    // Same state = good match
    if (buyerState === realtorState) {
      reasoning.push(`📍 Good location match: Same state (${buyerState})`);
      return 80;
    }

    // Check if realtor serves buyer's state
    if (realtor.serviceStates?.some(state => 
        normalizeState(state) === buyerState || state.toLowerCase() === buyer.preferredState?.toLowerCase())) {
      reasoning.push(`🗺️ Serves your state: ${buyer.preferredState}`);
      return 70;
    }

    // Check service cities with fuzzy matching
    if (realtor.serviceCities?.some(city => 
        city.toLowerCase().includes(buyer.preferredCity?.toLowerCase() || ''))) {
      reasoning.push(`🏙️ Serves nearby areas including ${buyer.preferredCity}`);
      return 60;
    }

    reasoning.push(`❌ Location mismatch: Different service area`);
    return 0;
  }

  // Language compatibility (0-100)
  private static calculateLanguageMatch(buyer: BuyerProfile, realtor: RealtorProfile, reasoning: string[]): number {
    if (!buyer.languages || !realtor.languages) {
      // If either doesn't specify, assume English and give neutral score
      reasoning.push(`📢 Language: Assuming English communication`);
      return 50;
    }

    const commonLanguages = buyer.languages.filter(lang => 
      realtor.languages?.includes(lang)
    );

    if (commonLanguages.length === 0) {
      reasoning.push(`🚫 Language barrier: No common languages`);
      return 0;
    }

    const matchPercentage = (commonLanguages.length / Math.max(buyer.languages.length, realtor.languages.length)) * 100;
    
    if (commonLanguages.includes('English')) {
      reasoning.push(`✅ Perfect communication: Both speak English`);
      return Math.max(matchPercentage, 90);
    }

    reasoning.push(`🗣️ Communication: ${commonLanguages.length} common language(s) (${commonLanguages.join(', ')})`);
    return matchPercentage;
  }

  // Expertise level matching (0-100)
  private static calculateExpertiseMatch(buyer: BuyerProfile, realtor: RealtorProfile, reasoning: string[]): number {
    // Determine buyer complexity based on budget and requirements
    const isComplexBuyer = buyer.maxMonthlyPayment > 3000 || buyer.maxDownPayment > 75000;
    const isFirstTimeBuyer = buyer.maxDownPayment < 30000; // Assume first-time if low down payment
    
    const realtorExperience = realtor.experienceLevel || 'experienced';
    const realtorSuccess = realtor.successRate || 75;

    // High-budget buyers need experienced realtors
    if (isComplexBuyer) {
      if (realtorExperience === 'expert' && realtorSuccess >= 85) {
        reasoning.push(`💎 Expert realtor perfect for your high-value search`);
        return 95;
      } else if (realtorExperience === 'experienced') {
        reasoning.push(`👍 Experienced realtor suitable for your budget range`);
        return 80;
      } else {
        reasoning.push(`⚠️ New realtor may need support for your budget level`);
        return 40;
      }
    }

    // First-time buyers benefit from patient, experienced realtors
    if (isFirstTimeBuyer) {
      if (realtorExperience === 'expert' || realtorSuccess >= 80) {
        reasoning.push(`🏡 Perfect for first-time buyers - high success rate`);
        return 90;
      } else {
        reasoning.push(`👋 Good fit for first-time buyer needs`);
        return 75;
      }
    }

    // Default matching based on success rate
    if (realtorSuccess >= 85) {
      reasoning.push(`⭐ Excellent track record (${realtorSuccess}% success rate)`);
      return 85;
    } else if (realtorSuccess >= 70) {
      reasoning.push(`✅ Solid track record (${realtorSuccess}% success rate)`);
      return 70;
    } else {
      reasoning.push(`🆕 Building track record (${realtorSuccess}% success rate)`);
      return 50;
    }
  }

  // Response time matching (0-100)
  private static calculateResponsivenessMatch(buyer: BuyerProfile, realtor: RealtorProfile, reasoning: string[]): number {
    const avgResponseTime = realtor.avgResponseTime || 24; // Default to 24 hours

    if (avgResponseTime <= 1) {
      reasoning.push(`🚀 Super responsive: Responds within 1 hour`);
      return 100;
    } else if (avgResponseTime <= 4) {
      reasoning.push(`⚡ Very responsive: Responds within 4 hours`);
      return 85;
    } else if (avgResponseTime <= 12) {
      reasoning.push(`📞 Good response time: Within 12 hours`);
      return 70;
    } else if (avgResponseTime <= 24) {
      reasoning.push(`📅 Standard response: Within 24 hours`);
      return 50;
    } else {
      reasoning.push(`🐌 Slow response time: May take over 24 hours`);
      return 20;
    }
  }

  // Specialization matching (0-100)
  private static calculateSpecializationMatch(buyer: BuyerProfile, realtor: RealtorProfile, reasoning: string[]): number {
    if (!realtor.specializations) {
      reasoning.push(`🔧 General real estate services`);
      return 50;
    }

    const buyerBudget = buyer.maxMonthlyPayment;
    let score = 50;

    // First-time buyer specialization
    if (buyerBudget < 2000 && realtor.specializations.includes('first-time-buyers')) {
      reasoning.push(`🏠 Specializes in helping first-time buyers`);
      score += 30;
    }

    // Luxury specialization for high budgets
    if (buyerBudget > 4000 && realtor.specializations.includes('luxury')) {
      reasoning.push(`💎 Luxury property specialist`);
      score += 25;
    }

    // Owner financing specialization (bonus for everyone)
    if (realtor.specializations.includes('owner-financing')) {
      reasoning.push(`💰 Expert in owner financing deals`);
      score += 20;
    }

    // Investment property specialization
    if (realtor.specializations.includes('investment') && buyerBudget > 3000) {
      reasoning.push(`📈 Investment property expert`);
      score += 15;
    }

    return Math.min(score, 100);
  }

  // Get top matches for a buyer with minimum threshold
  static getTopMatches(buyer: BuyerProfile, realtors: RealtorProfile[], minThreshold = 40): MatchResult[] {
    return realtors
      .map(realtor => this.calculateMatch(buyer, realtor))
      .filter(match => match.matchPercentage >= minThreshold)
      .sort((a, b) => b.matchPercentage - a.matchPercentage);
  }

  // Get quality leads for a realtor (sorted by match percentage)
  static getQualityLeads(realtor: RealtorProfile, buyers: BuyerProfile[], minThreshold = 50): MatchResult[] {
    return buyers
      .map(buyer => this.calculateMatch(buyer, realtor))
      .filter(match => match.matchPercentage >= minThreshold)
      .sort((a, b) => b.matchPercentage - a.matchPercentage);
  }

  // Generate human-readable match explanation
  static explainMatch(matchResult: MatchResult): string {
    const { matchPercentage, reasoning } = matchResult;
    
    let explanation = '';
    
    if (matchPercentage >= 90) {
      explanation = `🎯 Excellent Match (${matchPercentage}%): This realtor is perfect for your needs!\n\n`;
    } else if (matchPercentage >= 75) {
      explanation = `✅ Great Match (${matchPercentage}%): Strong compatibility with this realtor.\n\n`;
    } else if (matchPercentage >= 60) {
      explanation = `👍 Good Match (${matchPercentage}%): This realtor could work well for you.\n\n`;
    } else if (matchPercentage >= 40) {
      explanation = `⚠️ Fair Match (${matchPercentage}%): Some compatibility, but not ideal.\n\n`;
    } else {
      explanation = `❌ Poor Match (${matchPercentage}%): Limited compatibility.\n\n`;
    }
    
    explanation += reasoning.join('\n');
    return explanation;
  }
}

// Enhanced service area checking with distance calculation
export async function isInEnhancedServiceArea(
  buyer: BuyerProfile, 
  realtor: RealtorProfile,
  buyerCoords?: { lat: number; lng: number },
  realtorCoords?: { lat: number; lng: number }
): Promise<{ inArea: boolean; distance?: number; confidence: number }> {
  
  // If we have coordinates, use precise distance calculation
  if (buyerCoords && realtorCoords) {
    const distance = calculateDistance(
      buyerCoords.lat, buyerCoords.lng,
      realtorCoords.lat, realtorCoords.lng
    );
    
    const maxDistance = realtor.serviceRadius || 50;
    const inArea = distance <= maxDistance;
    const confidence = inArea ? Math.max(100 - (distance / maxDistance) * 100, 0) : 0;
    
    return { inArea, distance, confidence };
  }
  
  // Fallback to text-based matching
  const buyerState = normalizeState(buyer.preferredState);
  const realtorState = normalizeState(realtor.primaryState);
  
  // Exact city match
  if (buyer.preferredCity?.toLowerCase() === realtor.primaryCity?.toLowerCase() && 
      buyerState === realtorState) {
    return { inArea: true, confidence: 100 };
  }
  
  // State match
  if (buyerState === realtorState) {
    return { inArea: true, confidence: 70 };
  }
  
  // Service states match
  if (realtor.serviceStates?.some(state => normalizeState(state) === buyerState)) {
    return { inArea: true, confidence: 60 };
  }
  
  return { inArea: false, confidence: 0 };
}

// Sample data enrichment for testing
export const SAMPLE_REALTOR_ENHANCEMENTS = {
  languages: ['English', 'Spanish'],
  experienceLevel: 'experienced' as const,
  specializations: ['first-time-buyers', 'owner-financing'],
  avgResponseTime: 2, // 2 hours average
  successRate: 85 // 85% success rate
};

export const SAMPLE_BUYER_ENHANCEMENTS = {
  languages: ['English']
};