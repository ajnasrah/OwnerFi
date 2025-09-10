// REBUILT realtor leads API with proper Firebase integration
// Fixes all query issues and implements proper matching

import { NextRequest, NextResponse } from 'next/server';
import { FirebaseDB } from '@/lib/firebase-db';
import { BuyerProfile, RealtorProfile, LeadPurchase, normalizeState, formatCityState } from '@/lib/firebase-models';
import { getSessionWithRole } from '@/lib/auth-utils';
import { logError, logInfo } from '@/lib/logger';

interface EnhancedBuyerLead extends BuyerProfile {
  matchPercentage: number;
  matchReasoning: string[];
  distanceMiles?: number;
  propertyMatches: number;
}

export async function GET(request: NextRequest) {
  try {
    // Enforce realtor role only
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get realtor profile
    const realtorProfile = await FirebaseDB.findRealtorByUserId(session.user.id);
    
    if (!realtorProfile) {
      return NextResponse.json(
        { error: 'Realtor profile not found' },
        { status: 400 }
      );
    }

    if (!realtorProfile.profileComplete) {
      return NextResponse.json(
        { error: 'Please complete your realtor profile first' },
        { status: 400 }
      );
    }

    // Get all complete buyer profiles
    const allBuyers = await FirebaseDB.getCompleteBuyers(100);
    
    // Get already purchased leads to filter them out
    const purchasedLeads = await FirebaseDB.getPurchasedLeads(realtorProfile.id);
    const purchasedBuyerIds = purchasedLeads.map(p => p.buyerId);

    // Filter and score available leads
    const availableLeads: EnhancedBuyerLead[] = [];
    
    for (const buyer of allBuyers) {
      // Skip already purchased
      if (purchasedBuyerIds.includes(buyer.id)) {
        continue;
      }

      // Calculate match percentage
      const matchResult = calculateBuyerRealtorMatch(buyer, realtorProfile);
      
      // Only include leads with meaningful matches (30%+)
      if (matchResult.percentage >= 30) {
        // Get property matches for this buyer (simplified count)
        const propertyMatchCount = await getPropertyMatchCount(buyer.id);
        
        availableLeads.push({
          ...buyer,
          matchPercentage: matchResult.percentage,
          matchReasoning: matchResult.reasoning,
          distanceMiles: matchResult.distanceMiles,
          propertyMatches: propertyMatchCount
        });
      }
    }

    // Sort by match percentage (best first)
    availableLeads.sort((a, b) => b.matchPercentage - a.matchPercentage);

    // Get purchased leads with buyer details
    const purchasedLeadsWithDetails = await getPurchasedLeadsWithDetails(realtorProfile.id);

    await logInfo('Realtor leads fetched successfully', {
      action: 'realtor_leads_fetch',
      userId: session.user.id,
      metadata: {
        realtorId: realtorProfile.id,
        availableCount: availableLeads.length,
        purchasedCount: purchasedLeadsWithDetails.length
      }
    });

    return NextResponse.json({
      availableLeads: availableLeads.slice(0, 20), // Return top 20 matches
      purchasedLeads: purchasedLeadsWithDetails,
      realtorProfile: {
        ...realtorProfile,
        createdAt: convertTimestampToDate(realtorProfile.createdAt),
        updatedAt: convertTimestampToDate(realtorProfile.updatedAt),
        trialStartDate: convertTimestampToDate(realtorProfile.trialStartDate),
        trialEndDate: convertTimestampToDate(realtorProfile.trialEndDate)
      }
    });

  } catch (error) {
    await logError('Failed to fetch realtor leads', {
      action: 'realtor_leads_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to load leads' },
      { status: 500 }
    );
  }
}

// CLEAN matching algorithm - city + language only
function calculateBuyerRealtorMatch(
  buyer: BuyerProfile, 
  realtor: RealtorProfile
): { percentage: number; reasoning: string[]; distanceMiles?: number } {
  const reasoning: string[] = [];
  let locationScore = 0;
  let languageScore = 0;

  // 1. Location matching (70% weight)
  const buyerState = normalizeState(buyer.preferredState);
  const realtorState = normalizeState(realtor.primaryState);
  
  // Exact city + state match = perfect
  if (buyer.preferredCity?.toLowerCase() === realtor.primaryCity?.toLowerCase() && 
      buyerState === realtorState) {
    locationScore = 100;
    reasoning.push(`🎯 Perfect location match: ${buyer.preferredCity}, ${buyerState}`);
  }
  // Same state = good
  else if (buyerState === realtorState) {
    locationScore = 80;
    reasoning.push(`📍 Same state: ${buyerState}`);
  }
  // Realtor serves buyer's state
  else if (realtor.serviceStates.some(state => normalizeState(state) === buyerState)) {
    locationScore = 70;
    reasoning.push(`🗺️ Serves your state: ${buyer.preferredState}`);
  }
  // Realtor serves buyer's city
  else if (realtor.serviceCities.some(cityState => {
    const city = cityState.split(',')[0]?.trim().toLowerCase();
    return city === buyer.preferredCity?.toLowerCase();
  })) {
    locationScore = 60;
    reasoning.push(`🏙️ Serves your city: ${buyer.preferredCity}`);
  }
  else {
    locationScore = 0;
    reasoning.push(`❌ Outside service area`);
  }

  // 2. Language matching (30% weight)
  const buyerLanguages = buyer.languages || ['English'];
  const realtorLanguages = realtor.languages || ['English'];
  
  const commonLanguages = buyerLanguages.filter(lang => 
    realtorLanguages.includes(lang)
  );

  if (commonLanguages.length === 0) {
    languageScore = 0;
    reasoning.push(`🚫 Language barrier: No common languages`);
  } else if (commonLanguages.includes('English') || commonLanguages.includes('Spanish')) {
    languageScore = 100;
    reasoning.push(`✅ Perfect communication: ${commonLanguages.join(', ')}`);
  } else {
    languageScore = 80;
    reasoning.push(`🗣️ Good communication: ${commonLanguages.join(', ')}`);
  }

  // Final weighted score
  const percentage = Math.round((locationScore * 0.7) + (languageScore * 0.3));

  return { percentage, reasoning };
}

// Get property match count for buyer (simplified)
async function getPropertyMatchCount(buyerId: string): Promise<number> {
  try {
    const matches = await FirebaseDB.queryDocuments(
      'propertyMatches',
      [{ field: 'buyerId', operator: '==', value: buyerId }],
      50
    );
    return matches.length;
  } catch (error) {
    // If property matches don't exist yet, return 0
    return 0;
  }
}

// Get purchased leads with buyer details
async function getPurchasedLeadsWithDetails(realtorId: string): Promise<any[]> {
  try {
    const purchases = await FirebaseDB.getPurchasedLeads(realtorId);
    const purchasedWithDetails = [];
    
    for (const purchase of purchases) {
      const buyer = await FirebaseDB.getDocument<BuyerProfile>('buyerProfiles', purchase.buyerId);
      
      if (buyer) {
        purchasedWithDetails.push({
          ...buyer,
          purchasedAt: convertTimestampToDate(purchase.purchasedAt),
          status: purchase.status,
          notes: purchase.notes,
          createdAt: convertTimestampToDate(buyer.createdAt),
          updatedAt: convertTimestampToDate(buyer.updatedAt)
        });
      }
    }
    
    return purchasedWithDetails;
  } catch (error) {
    console.error('Error fetching purchased leads:', error);
    return [];
  }
}

function convertTimestampToDate(timestamp: any): string {
  if (!timestamp) return new Date().toISOString();
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  if (typeof timestamp === 'string') return timestamp;
  return new Date().toISOString();
}