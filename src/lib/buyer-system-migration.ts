// BUYER SYSTEM MIGRATION - Consolidate buyerProfiles and buyerLinks into single collection
// This migration preserves all data while eliminating dual-profile complexity

import { FirebaseDB } from './firebase-db';
import { Timestamp } from 'firebase/firestore';
import { LeadPurchase, BuyerProfile } from './firebase-models';

export interface MigrationResult {
  success: boolean;
  profilesEnhanced: number;
  profilesCreated: number;
  purchasesUpdated: number;
  totalProfiles: number;
  errors: string[];
}

export class BuyerSystemMigration {
  
  static async executeMigration(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      profilesEnhanced: 0,
      profilesCreated: 0,
      purchasesUpdated: 0,
      totalProfiles: 0,
      errors: []
    };
    
    
    try {
      // Step 1: Get all existing data
      const [buyerProfilesData, buyerLinksData, leadPurchasesData] = await Promise.all([
        FirebaseDB.queryDocuments('buyerProfiles', []),
        FirebaseDB.queryDocuments('buyerLinks', []),
        FirebaseDB.queryDocuments('leadPurchases', [])
      ]);
      
      const buyerProfiles = buyerProfilesData as BuyerProfile[];
      const buyerLinks = buyerLinksData as BuyerProfile[];
      const leadPurchases = leadPurchasesData as LeadPurchase[];
      
      
      // Step 2: Create mappings
      const linksByUserId = new Map<string, BuyerProfile>();
      const linksById = new Map<string, BuyerProfile>();
      const profilesByUserId = new Map<string, BuyerProfile>();
      
      buyerLinks.forEach((link: BuyerProfile) => {
        linksByUserId.set(link.userId, link);
        linksById.set(link.id, link);
      });
      
      buyerProfiles.forEach((profile: BuyerProfile) => {
        profilesByUserId.set(profile.userId, profile);
      });
      
      // Step 3: Enhance existing buyerProfiles
      for (const profile of buyerProfiles as BuyerProfile[]) {
        try {
          const linkData = linksByUserId.get(profile.userId);
          
          const enhancedData = {
            // Preserve all existing fields
            ...profile,
            
            // Add compatibility fields for API consistency
            city: profile.preferredCity,
            state: profile.preferredState,
            
            // Merge liked properties from both systems
            likedPropertyIds: this.mergeLikedProperties(
              profile.likedPropertyIds || [],
              linkData?.likedPropertyIds || []
            ),
            
            // Add lead selling fields from buyerLink
            isAvailableForPurchase: linkData?.isAvailableForPurchase ?? true,
            purchasedBy: linkData?.purchasedBy,
            purchasedAt: linkData?.purchasedAt ? 
              (linkData.purchasedAt instanceof Timestamp ? 
                linkData.purchasedAt : 
                Timestamp.fromDate(new Date(linkData.purchasedAt as any))
              ) : undefined,
            leadPrice: 1, // Default credit cost
            
            // Ensure required arrays exist
            passedPropertyIds: profile.passedPropertyIds || [],
            matchedPropertyIds: profile.matchedPropertyIds || [],
            languages: profile.languages || linkData?.languages || ['English'],
            
            // Activity tracking
            lastActiveAt: profile.updatedAt || Timestamp.now(),
            
            // Metadata
            updatedAt: Timestamp.now()
          };
          
          await FirebaseDB.updateDocument('buyerProfiles', profile.id, enhancedData);
          result.profilesEnhanced++;
          
          
        } catch (error) {
          const errorMsg = `Failed to enhance profile ${profile.id}: ${(error as Error).message}`;
          result.errors.push(errorMsg);
        }
      }
      
      // Step 4: Create missing profiles from orphaned buyerLinks
      const existingUserIds = new Set((buyerProfiles as BuyerProfile[]).map(p => p.userId));
      
      for (const link of buyerLinks as BuyerProfile[]) {
        if (!existingUserIds.has(link.userId)) {
          try {
            const newProfile = await this.createBuyerProfileFromLink(link);
            result.profilesCreated++;
            
            
          } catch (error) {
            const errorMsg = `Failed to create profile from link ${link.id}: ${(error as Error).message}`;
            result.errors.push(errorMsg);
            }
        }
      }
      
      // Step 5: Update lead purchase references
      for (const purchase of leadPurchases as LeadPurchase[]) {
        try {
          const linkId = purchase.buyerId;
          const linkData = linksById.get(linkId);
          
          if (linkData) {
            // Find the corresponding buyerProfile
            const matchingProfile = profilesByUserId.get(linkData.userId);
            
            if (matchingProfile) {
              await FirebaseDB.updateDocument('leadPurchases', purchase.id, {
                buyerId: matchingProfile.id,
                originalBuyerLinkId: linkId, // Keep reference for audit
                migratedAt: Timestamp.now(),
                updatedAt: Timestamp.now()
              });
              
              result.purchasesUpdated++;
            } else {
              result.errors.push(`No profile found for purchase ${purchase.id} with linkId ${linkId}`);
            }
          }
          
        } catch (error) {
          const errorMsg = `Failed to update purchase ${purchase.id}: ${(error as Error).message}`;
          result.errors.push(errorMsg);
        }
      }
      
      // Step 6: Final verification
      const finalProfiles = await FirebaseDB.queryDocuments('buyerProfiles', []);
      result.totalProfiles = finalProfiles.length;
      
      result.success = result.errors.length === 0;
      
      
      if (result.errors.length > 0) {
      }
      
    } catch (error) {
      result.errors.push(`Migration failed: ${(error as Error).message}`);
    }
    
    return result;
  }
  
  // Helper: Merge liked properties without duplicates
  private static mergeLikedProperties(profileLikes: string[] = [], linkLikes: string[] = []): string[] {
    const combined = [...(profileLikes || []), ...(linkLikes || [])];
    return Array.from(new Set(combined)); // Remove duplicates
  }
  
  // Helper: Create buyer profile from buyerLink data
  private static async createBuyerProfileFromLink(link: BuyerProfile): Promise<BuyerProfile> {
    const profileData = {
      userId: link.userId,
      firstName: link.firstName,
      lastName: link.lastName,
      email: link.email,
      phone: link.phone || '',
      
      // Map link fields to profile fields
      preferredCity: link.city || '',
      preferredState: link.state || '',
      city: link.city,                    // API compatibility
      state: link.state,                  // API compatibility
      
      // Budget from link
      maxMonthlyPayment: link.maxMonthlyPayment || 0,
      maxDownPayment: link.maxDownPayment || 0,
      
      // Defaults for missing fields
      searchRadius: 25,
      minBedrooms: undefined,
      minBathrooms: undefined,
      minSquareFeet: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      
      // Communication
      languages: link.languages || ['English'],
      emailNotifications: true,
      smsNotifications: true,
      
      // System fields
      profileComplete: true,
      isActive: true,
      
      // Property interactions
      likedPropertyIds: link.likedPropertyIds || [],
      passedPropertyIds: [],
      matchedPropertyIds: [],
      
      // Lead selling fields
      isAvailableForPurchase: link.isAvailableForPurchase ?? true,
      purchasedBy: link.purchasedBy,
      purchasedAt: link.purchasedAt ? 
        (link.purchasedAt instanceof Timestamp ? 
          link.purchasedAt : 
          Timestamp.fromDate(new Date(link.purchasedAt as any))
        ) : undefined,
      leadPrice: 1,
      
      // Additional fields
      hasBeenSold: false,
      preferredStates: null,
      preferredCities: null,
      searchCriteria: null,
      lastMatchUpdate: null,
      
      // Activity tracking
      lastActiveAt: Timestamp.now(),
      
      // Timestamps
      createdAt: link.createdAt ? 
        (link.createdAt instanceof Timestamp ? 
          link.createdAt : 
          Timestamp.fromDate(new Date(link.createdAt as any))
        ) : Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    return await FirebaseDB.createDocument('buyerProfiles', profileData);
  }
  
  // Verification method to check migration success
  static async verifyMigration(): Promise<{
    success: boolean;
    issues: string[];
    statistics: {
      totalBuyerProfiles: number;
      availableForPurchase: number;
      purchased: number;
      withLikedProperties: number;
      leadPurchasesReferencing: number;
    };
  }> {
    const issues: string[] = [];
    
    try {
      const [buyerProfilesData, leadPurchasesData] = await Promise.all([
        FirebaseDB.queryDocuments('buyerProfiles', []),
        FirebaseDB.queryDocuments('leadPurchases', [])
      ]);
      
      const buyerProfiles = buyerProfilesData as BuyerProfile[];
      const leadPurchases = leadPurchasesData as LeadPurchase[];
      
      // Check for required fields
      let availableCount = 0;
      let purchasedCount = 0;
      let withLikedPropsCount = 0;
      
      for (const profile of buyerProfiles) {
        const p = profile;
        
        // Check required fields exist
        if (!p.city || !p.state) {
          issues.push(`Profile ${p.id} missing city/state compatibility fields`);
        }
        
        if (!Object.prototype.hasOwnProperty.call(p, 'isAvailableForPurchase')) {
          issues.push(`Profile ${p.id} missing isAvailableForPurchase field`);
        }
        
        if (!Array.isArray(p.likedPropertyIds)) {
          issues.push(`Profile ${p.id} missing likedPropertyIds array`);
        }
        
        // Statistics
        if (p.isAvailableForPurchase) availableCount++;
        if (p.purchasedBy) purchasedCount++;
        if (p.likedPropertyIds && p.likedPropertyIds.length > 0) withLikedPropsCount++;
      }
      
      // Check lead purchases reference buyerProfiles not buyerLinks
      let validPurchaseRefs = 0;
      for (const purchase of leadPurchases) {
        const p = purchase;
        const buyerId = p.buyerId;
        
        // Should reference a buyerProfile, not a buyerLink
        const referencedProfile = buyerProfiles.find((bp) => bp.id === buyerId);
        if (referencedProfile) {
          validPurchaseRefs++;
        } else {
          issues.push(`Purchase ${p.id} references invalid buyerId: ${buyerId}`);
        }
      }
      
      return {
        success: issues.length === 0,
        issues,
        statistics: {
          totalBuyerProfiles: buyerProfiles.length,
          availableForPurchase: availableCount,
          purchased: purchasedCount,
          withLikedProperties: withLikedPropsCount,
          leadPurchasesReferencing: validPurchaseRefs
        }
      };
      
    } catch (error) {
      return {
        success: false,
        issues: [`Verification failed: ${(error as Error).message}`],
        statistics: {
          totalBuyerProfiles: 0,
          availableForPurchase: 0,
          purchased: 0,
          withLikedProperties: 0,
          leadPurchasesReferencing: 0
        }
      };
    }
  }
}