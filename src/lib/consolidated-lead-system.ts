// CONSOLIDATED LEAD SYSTEM - Replaces MatchingModule with single buyerProfiles collection
// Handles buyer-realtor lead matching, purchasing, and management

import { FirebaseDB } from './firebase-db';
import { BuyerProfile } from './firebase-models';
import { Timestamp } from 'firebase/firestore';

export interface LeadMatch {
  id: string;                    // buyerProfile id
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  maxMonthlyPayment: number;
  maxDownPayment: number;
  languages: string[];
  matchScore: number;
  matchReasons: string[];
  likedPropertiesCount: number;
  leadPrice: number;
  createdAt: Timestamp;
  lastActiveAt?: Timestamp;
}

export interface RealtorMatchProfile {
  cities: string[];              // Cities realtor serves
  languages: string[];           // Languages realtor speaks
  state: string;                 // Primary state
}

// BuyerDetails is a simplified view for lead display
// Uses fields from BuyerProfile (firebase-models.ts)
export interface BuyerDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;         // Maps to preferredCity from BuyerProfile
  state: string;        // Maps to preferredState from BuyerProfile
  maxMonthlyPayment: number;
  maxDownPayment: number;
}

export class ConsolidatedLeadSystem {
  
  /**
   * Find available buyer leads for a realtor based on location and language matching
   */
  static async findAvailableLeads(realtorProfile: RealtorMatchProfile): Promise<LeadMatch[]> {
    try {

      // Get ALL available buyer profiles (don't filter by state first)
      // We'll filter by city match in the application logic
      const availableBuyers = await FirebaseDB.queryDocuments<BuyerProfile>('buyerProfiles', [
        { field: 'isAvailableForPurchase', operator: '==', value: true },
        { field: 'isActive', operator: '==', value: true },
        { field: 'profileComplete', operator: '==', value: true }
      ]);
      
      
      // Score and filter matches
      const matches: LeadMatch[] = [];
      
      for (const buyer of availableBuyers) {
        const matchResult = this.calculateMatch(buyer, realtorProfile);
        if (matchResult.isMatch) {
          matches.push({
            id: buyer.id,
            firstName: buyer.firstName,
            lastName: buyer.lastName,
            email: buyer.email,
            phone: buyer.phone,
            city: buyer.preferredCity,
            state: buyer.preferredState,
            maxMonthlyPayment: buyer.maxMonthlyPayment,
            maxDownPayment: buyer.maxDownPayment,
            languages: buyer.languages,
            matchScore: matchResult.score,
            matchReasons: matchResult.reasons,
            likedPropertiesCount: buyer.likedPropertyIds?.length || 0,
            leadPrice: buyer.leadPrice || 1,
            createdAt: buyer.createdAt,
            lastActiveAt: buyer.lastActiveAt
          });
        }
      }
      
      // Sort by match score (highest first)
      matches.sort((a, b) => b.matchScore - a.matchScore);
      
      return matches;
      
    } catch {
      return [];
    }
  }
  
  /**
   * Calculate match score between buyer and realtor
   */
  private static calculateMatch(buyer: BuyerProfile, realtor: RealtorMatchProfile): {
    isMatch: boolean;
    score: number;
    reasons: string[];
  } {
    let score = 0;
    const reasons: string[] = [];
    
    // Geographic match (required) - Does realtor serve buyer's city?
    const buyerCity = buyer.preferredCity || buyer.city || '';
    const realtorCities = realtor.cities.map(c => c.toLowerCase());
    const cityMatch = realtorCities.includes(buyerCity.toLowerCase());
    
    if (!cityMatch) {
      return { isMatch: false, score: 0, reasons: ['No geographic overlap'] };
    }
    
    score += 50;
    reasons.push(`Serves ${buyerCity}`);
    
    // Language match (required) - At least 1 common language
    const buyerLanguages = buyer.languages || ['English'];
    const languageMatch = buyerLanguages.some(lang => 
      realtor.languages.map(rl => rl.toLowerCase()).includes(lang.toLowerCase())
    );
    
    if (!languageMatch) {
      return { isMatch: false, score: 0, reasons: ['No language match'] };
    }
    
    score += 50;
    const commonLangs = buyerLanguages.filter(lang => 
      realtor.languages.map(rl => rl.toLowerCase()).includes(lang.toLowerCase())
    );
    reasons.push(`Common languages: ${commonLangs.join(', ')}`);
    
    // Bonus scoring
    
    // Activity bonus - Buyer has liked properties
    if (buyer.likedPropertyIds && buyer.likedPropertyIds.length > 0) {
      score += 10;
      reasons.push(`Active buyer (${buyer.likedPropertyIds.length} liked properties)`);
    }
    
    // Recent activity bonus
    if (buyer.lastActiveAt) {
      const daysSinceActive = (Date.now() - buyer.lastActiveAt.toMillis()) / (1000 * 60 * 60 * 24);
      if (daysSinceActive <= 7) {
        score += 15;
        reasons.push('Active within last week');
      } else if (daysSinceActive <= 30) {
        score += 5;
        reasons.push('Active within last month');
      }
    }
    
    // Budget reasonableness bonus (buyers with realistic budgets)
    if (buyer.maxMonthlyPayment >= 800 && buyer.maxDownPayment >= 5000) {
      score += 10;
      reasons.push('Realistic budget');
    }
    
    return {
      isMatch: true,
      score: Math.min(score, 100), // Cap at 100
      reasons: reasons
    };
  }
  
  /**
   * Purchase a buyer lead (mark as unavailable)
   */
  static async purchaseLead(buyerProfileId: string, realtorUserId: string): Promise<{
    success: boolean;
    error?: string;
    buyerDetails?: BuyerDetails;
  }> {
    try {
      // Get buyer profile
      const buyer = await FirebaseDB.getDocument<BuyerProfile>('buyerProfiles', buyerProfileId);
      
      if (!buyer) {
        return { success: false, error: 'Buyer not found' };
      }
      
      if (!buyer.isAvailableForPurchase) {
        return { success: false, error: 'Buyer lead no longer available' };
      }
      
      // Mark as purchased
      await FirebaseDB.updateDocument('buyerProfiles', buyerProfileId, {
        isAvailableForPurchase: false,
        purchasedBy: realtorUserId,
        purchasedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      
      return {
        success: true,
        buyerDetails: {
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          email: buyer.email,
          phone: buyer.phone,
          city: buyer.preferredCity,
          state: buyer.preferredState,
          maxMonthlyPayment: buyer.maxMonthlyPayment,
          maxDownPayment: buyer.maxDownPayment
        }
      };
      
    } catch {
      return { success: false, error: 'Purchase failed' };
    }
  }
  
  /**
   * Get purchased leads for a realtor
   */
  static async getPurchasedLeads(realtorUserId: string): Promise<BuyerProfile[]> {
    try {
      const purchasedBuyers = await FirebaseDB.queryDocuments<BuyerProfile>('buyerProfiles', [
        { field: 'purchasedBy', operator: '==', value: realtorUserId }
      ]);
      
      return purchasedBuyers;
      
    } catch {
      return [];
    }
  }
  
  /**
   * Update buyer when they like properties (for activity scoring)
   */
  static async updateBuyerActivity(userId: string, likedPropertyIds: string[]): Promise<void> {
    try {
      const buyers = await FirebaseDB.queryDocuments<BuyerProfile>('buyerProfiles', [
        { field: 'userId', operator: '==', value: userId }
      ]);
      
      if (buyers.length > 0) {
        await FirebaseDB.updateDocument('buyerProfiles', buyers[0].id, {
          likedPropertyIds: likedPropertyIds,
          lastActiveAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        
      }
      
    } catch {
    }
  }
  
  /**
   * Create a new buyer profile (replaces createBuyerLinkProfile)
   */
  static async createBuyerProfile(data: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
    maxMonthlyPayment: number;
    maxDownPayment: number;
    languages?: string[];
  }): Promise<string> {
    try {
      // Parse location
      const cityParts = data.city.split(',');
      const city = cityParts[0]?.trim();
      const state = cityParts[1]?.trim() || 'TX';
      
      
      const profileData: Omit<BuyerProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: data.userId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        
        // Location
        preferredCity: city,
        preferredState: state,
        city: city,                    // API compatibility
        state: state,                  // API compatibility
        searchRadius: 25,
        
        // Budget
        maxMonthlyPayment: data.maxMonthlyPayment,
        maxDownPayment: data.maxDownPayment,
        
        // Defaults
        languages: data.languages || ['English'],
        emailNotifications: true,
        smsNotifications: true,
        profileComplete: true,
        isActive: true,
        
        // Arrays
        matchedPropertyIds: [],
        likedPropertyIds: [],
        passedPropertyIds: [],
        
        // Lead selling
        isAvailableForPurchase: true,
        leadPrice: 1,
        
        // Activity
        lastActiveAt: Timestamp.now()
      };
      
      const profile = await FirebaseDB.createDocument<BuyerProfile>('buyerProfiles', profileData);
      
      return profile.id;
      
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Debug: Get statistics about the lead system
   */
  static async getSystemStatistics(): Promise<{
    totalBuyerProfiles: number;
    availableForPurchase: number;
    purchased: number;
    activeInLastWeek: number;
    byState: Record<string, number>;
    byCity: Record<string, number>;
  }> {
    try {
      const allBuyers = await FirebaseDB.queryDocuments<BuyerProfile>('buyerProfiles', []);
      
      const stats = {
        totalBuyerProfiles: allBuyers.length,
        availableForPurchase: 0,
        purchased: 0,
        activeInLastWeek: 0,
        byState: {} as Record<string, number>,
        byCity: {} as Record<string, number>
      };
      
      const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      for (const buyer of allBuyers) {
        if (buyer.isAvailableForPurchase) stats.availableForPurchase++;
        if (buyer.purchasedBy) stats.purchased++;
        
        if (buyer.lastActiveAt && buyer.lastActiveAt.toMillis() > weekAgo) {
          stats.activeInLastWeek++;
        }
        
        const state = buyer.preferredState || buyer.state || 'Unknown';
        const city = buyer.preferredCity || buyer.city || 'Unknown';
        
        stats.byState[state] = (stats.byState[state] || 0) + 1;
        stats.byCity[`${city}, ${state}`] = (stats.byCity[`${city}, ${state}`] || 0) + 1;
      }
      
      return stats;
      
    } catch (error) {
      throw error;
    }
  }
}