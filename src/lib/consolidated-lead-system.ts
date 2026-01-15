// CONSOLIDATED LEAD SYSTEM - Replaces MatchingModule with single buyerProfiles collection
// Handles buyer-realtor lead matching, purchasing, and management

import { FirebaseDB } from './firebase-db';
import { BuyerProfile } from './firebase-models';
import { Timestamp } from 'firebase/firestore';
import { generateBuyerFilter } from './buyer-filter-service';

export interface LeadMatch {
  id: string;                    // buyerProfile id
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
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
}

export class ConsolidatedLeadSystem {
  
  /**
   * Find available buyer leads for a realtor based on location and language matching
   */
  static async findAvailableLeads(realtorProfile: RealtorMatchProfile, limit = 50): Promise<LeadMatch[]> {
    try {
      console.log(`\n🔍 [LEAD MATCHING] ===== Starting Lead Search =====`);
      console.log(`   Realtor cities: ${realtorProfile.cities.join(', ')}`);
      console.log(`   Realtor state: "${realtorProfile.state}"`);
      console.log(`   Realtor languages: ${realtorProfile.languages.join(', ')}`);

      // Check for invalid state
      if (!realtorProfile.state || realtorProfile.state === 'Not set' || realtorProfile.state === 'Unknown') {
        console.log(`   ❌ Invalid state "${realtorProfile.state}" - realtor profile may be incomplete`);
        console.log(`🔍 [LEAD MATCHING] ===== End Lead Search (no valid state) =====\n`);
        return [];
      }

      // 🚀 PERFORMANCE: Increased limit to 500 to ensure we don't miss qualified leads
      // Filter by state at database level to reduce processing
      const availableBuyers = await FirebaseDB.queryDocuments<BuyerProfile>('buyerProfiles', [
        { field: 'isAvailableForPurchase', operator: '==', value: true },
        { field: 'isActive', operator: '==', value: true },
        { field: 'profileComplete', operator: '==', value: true },
        { field: 'preferredState', operator: '==', value: realtorProfile.state }
      ], 500); // Increased from 100 to 500

      console.log(`   Query returned: ${availableBuyers.length} buyers with state="${realtorProfile.state}"`);
      if (availableBuyers.length > 0) {
        console.log(`   Sample buyers: ${availableBuyers.slice(0, 3).map(b => `${b.firstName} in ${b.preferredCity}`).join(', ')}`);
      } else {
        console.log(`   ⚠️ No buyers found in state "${realtorProfile.state}" with isAvailableForPurchase=true, isActive=true, profileComplete=true`);
      }

      // Get all user IDs with realtor role to filter them out
      const realtorUsers = await FirebaseDB.queryDocuments('users', [
        { field: 'role', operator: '==', value: 'realtor' }
      ]);
      const realtorUserIds = new Set(realtorUsers.map((u: any) => u.id));

      // Score and filter matches
      const matches: LeadMatch[] = [];

      for (const buyer of availableBuyers) {
        // Skip if this buyer profile belongs to a realtor
        if (buyer.userId && realtorUserIds.has(buyer.userId)) {
          continue;
        }

        // Early exit once we have enough matches
        if (matches.length >= limit) break;

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

      console.log(`   Final matches: ${matches.length} buyers`);
      if (matches.length === 0 && availableBuyers.length > 0) {
        console.log(`   ⚠️ Had ${availableBuyers.length} buyers but none matched cities: ${realtorProfile.cities.slice(0, 5).join(', ')}`);
      }
      console.log(`🔍 [LEAD MATCHING] ===== End Lead Search =====\n`);

      // Return top matches only
      return matches.slice(0, limit);

    } catch (error) {
      console.error(`❌ [LEAD MATCHING] Error:`, error);
      return [];
    }
  }
  
  /**
   * Calculate match score between buyer and realtor
   * Matching is now STATE-LEVEL (not city-level) to maximize lead visibility
   */
  private static calculateMatch(buyer: BuyerProfile, realtor: RealtorMatchProfile): {
    isMatch: boolean;
    score: number;
    reasons: string[];
  } {
    let score = 0;
    const reasons: string[] = [];

    // State match is already enforced at the database query level
    // All buyers passed here are in the same state as the realtor
    const buyerCity = buyer.preferredCity || buyer.city || '';
    const buyerState = buyer.preferredState || buyer.state || '';

    // Base score for state match (always true at this point)
    score += 40;
    reasons.push(`Same state: ${buyerState}`);

    // Bonus for city match (buyer is in realtor's service area)
    const realtorCities = realtor.cities.map(c => c.toLowerCase());
    const cityMatch = realtorCities.includes(buyerCity.toLowerCase());

    if (cityMatch) {
      score += 20;
      reasons.push(`In service area: ${buyerCity}`);
    } else {
      reasons.push(`Outside service area: ${buyerCity}`);
    }

    // Language match (bonus, not required)
    const buyerLanguages = buyer.languages || ['English'];
    const languageMatch = buyerLanguages.some(lang =>
      realtor.languages.map(rl => rl.toLowerCase()).includes(lang.toLowerCase())
    );

    if (languageMatch) {
      score += 20;
      const commonLangs = buyerLanguages.filter(lang =>
        realtor.languages.map(rl => rl.toLowerCase()).includes(lang.toLowerCase())
      );
      reasons.push(`Common languages: ${commonLangs.join(', ')}`);
    }

    // Activity bonus - Buyer has liked properties
    if (buyer.likedPropertyIds && buyer.likedPropertyIds.length > 0) {
      score += 10;
      reasons.push(`Active buyer (${buyer.likedPropertyIds.length} liked properties)`);
    }

    // Recent activity bonus
    if (buyer.lastActiveAt) {
      const daysSinceActive = (Date.now() - buyer.lastActiveAt.toMillis()) / (1000 * 60 * 60 * 24);
      if (daysSinceActive <= 7) {
        score += 10;
        reasons.push('Active within last week');
      } else if (daysSinceActive <= 30) {
        score += 5;
        reasons.push('Active within last month');
      }
    }

    // All buyers in the same state are now a match
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
          state: buyer.preferredState
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
    languages?: string[];
  }): Promise<string> {
    try {
      // Parse location
      const cityParts = data.city.split(',');
      const city = cityParts[0]?.trim();
      const state = cityParts[1]?.trim() || 'TX';

      // Generate filter BEFORE creating profile
      let filter = undefined;
      if (city && state) {
        try {
          filter = await generateBuyerFilter(city, state, 30);
        } catch (filterError) {
          console.error('⚠️ [ConsolidatedLeadSystem] Failed to generate filter:', filterError);
        }
      }

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

        // Pre-computed nearby cities filter
        ...(filter && { filter }),

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