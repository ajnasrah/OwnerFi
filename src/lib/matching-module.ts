// MATCHING MODULE - Completely separate buyer-realtor lead matching system
// Self-contained, no interference with existing property matching

import { FirebaseDB } from './firebase-db';
import { getCitiesWithinRadiusComprehensive } from './comprehensive-cities';

// Separate interfaces for the matching module
export interface BuyerLinkProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string; // Single city only - where buyer wants to live
  state: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
  languages: string[];
  likedPropertyIds: string[];
  isAvailable: boolean; // Can be purchased by realtors
  createdAt: Date;
  updatedAt: Date;
}

export interface RealtorMatchProfile {
  cities: string[];
  languages: string[];
  state: string;
}

export interface LeadMatch {
  buyerLinkId: string;
  buyer: BuyerLinkProfile;
  matchScore: number;
  matchReasons: string[];
}

export class MatchingModule {
  
  // Create buyer lead profile (separate from regular buyer profiles)
  static async createBuyerLinkProfile(data: {
    userId: string;
    firstName: string;
    lastName: string; 
    email: string;
    phone: string;
    city: string;
    maxMonthlyPayment: number;
    maxDownPayment: number;
    languages: string[];
  }): Promise<string> {
    
    try {
      // Parse location
      const cityParts = data.city.split(',');
      const city = cityParts[0]?.trim();
      const state = cityParts[1]?.trim() || 'TX';
      
      
      const profile: Omit<BuyerLinkProfile, 'id'> = {
        userId: data.userId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        city: city,
        state: state,
        maxMonthlyPayment: data.maxMonthlyPayment,
        maxDownPayment: data.maxDownPayment,
        languages: data.languages,
        likedPropertyIds: [],
        isAvailable: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Save with state-based ID for efficient querying
      const linkId = `${state}_${city}_${data.userId}`.replace(/[\s,]/g, '_');
      await FirebaseDB.createDocument('buyerLinks', profile, linkId);
      
      return linkId;
      
    } catch (error) {
      throw error;
    }
  }
  
  // Find matching buyers for realtor
  static async findMatchingBuyers(realtorProfile: RealtorMatchProfile): Promise<LeadMatch[]> {
    try {
      
      // Get all available buyers in realtor's state
      const availableBuyers = await FirebaseDB.queryDocuments<BuyerLinkProfile>(
        'buyerLinks',
        [
          { field: 'state', operator: '==', value: realtorProfile.state },
          { field: 'isAvailable', operator: '==', value: true }
        ]
      );
      
      
      // Score each buyer based on match quality
      const matches: LeadMatch[] = [];
      
      for (const buyer of availableBuyers) {
        const matchResult = this.calculateMatch(buyer, realtorProfile);
        if (matchResult.isMatch) {
          matches.push({
            buyerLinkId: buyer.id,
            buyer: buyer,
            matchScore: matchResult.score,
            matchReasons: matchResult.reasons
          });
        }
      }
      
      // Sort by match score (highest first)
      matches.sort((a, b) => b.matchScore - a.matchScore);
      
      return matches;
      
    } catch (error) {
      return [];
    }
  }
  
  // Calculate match between buyer and realtor
  private static calculateMatch(buyer: BuyerLinkProfile, realtor: RealtorMatchProfile): {
    isMatch: boolean;
    score: number;
    reasons: string[];
  } {
    let score = 0;
    const reasons: string[] = [];
    
    // Geographic match (required) - Does realtor serve buyer's city?
    const cityMatch = realtor.cities.includes(buyer.city);
    
    if (!cityMatch) {
      return { isMatch: false, score: 0, reasons: ['No geographic overlap'] };
    }
    
    score += 50;
    reasons.push('Geographic match');
    
    // Language match (required) - At least 1 common language
    const languageMatch = buyer.languages.some(lang => 
      realtor.languages.includes(lang)
    );
    
    if (!languageMatch) {
      return { isMatch: false, score: 0, reasons: ['No language match'] };
    }
    
    score += 50;
    reasons.push('Language match');
    
    // Bonus scoring - How many common languages
    const commonLanguages = buyer.languages.filter(lang => 
      realtor.languages.includes(lang)
    ).length;
    score += Math.min(commonLanguages * 5, 15); // Max 15 bonus points
    
    if (buyer.likedPropertyIds.length > 0) {
      score += 10;
      reasons.push('Active buyer (has liked properties)');
    }
    
    return {
      isMatch: true,
      score: score,
      reasons: reasons
    };
  }
  
  // Update buyer when they like properties
  static async updateBuyerLikedProperties(userId: string, propertyIds: string[]): Promise<void> {
    try {
      const existingLinks = await FirebaseDB.queryDocuments<BuyerLinkProfile>(
        'buyerLinks',
        [{ field: 'userId', operator: '==', value: userId }]
      );
      
      if (existingLinks.length > 0) {
        await FirebaseDB.updateDocument('buyerLinks', existingLinks[0].id, {
          likedPropertyIds: propertyIds,
          updatedAt: new Date()
        });
        
      }
      
    } catch (error) {
    }
  }
  
  // Mark buyer as purchased by realtor
  static async purchaseBuyerLead(buyerLinkId: string, realtorUserId: string): Promise<boolean> {
    try {
      await FirebaseDB.updateDocument('buyerLinks', buyerLinkId, {
        isAvailable: false,
        purchasedBy: realtorUserId,
        purchasedAt: new Date(),
        updatedAt: new Date()
      });
      
      return true;
      
    } catch (error) {
      return false;
    }
  }
}