import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  orderBy,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { getSessionWithRole } from '@/lib/auth-utils';
import { MatchingEngine, SAMPLE_REALTOR_ENHANCEMENTS } from '@/lib/matching-algorithm';
import { PropertyMatcher, calculateBuyerPropertyMatches } from '@/lib/property-matcher';

export async function GET(request: NextRequest) {
  try {
    // Enforce realtor role only
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get realtor profile
    const realtorsQuery = query(
      collection(db, 'realtors'),
      where('userId', '==', session.user.id!)
    );
    const realtorDocs = await getDocs(realtorsQuery);

    if (realtorDocs.empty) {
      return NextResponse.json(
        { error: 'Realtor profile not found' },
        { status: 400 }
      );
    }

    const realtorDoc = realtorDocs.docs[0];
    const realtorProfile = { id: realtorDoc.id, ...realtorDoc.data() };

    if (!realtorProfile.profileComplete) {
      return NextResponse.json(
        { error: 'Realtor profile not complete' },
        { status: 400 }
      );
    }

    // Get purchased leads for this realtor (for reference, not exclusion)
    const purchasedLeadsQuery = query(
      collection(db, 'buyerLeadPurchases'),
      where('realtorId', '==', realtorDoc.id)
    );
    const purchasedDocs = await getDocs(purchasedLeadsQuery);
    const purchasedBuyerIds = purchasedDocs.docs.map(doc => doc.data().buyerId);

    // Get available buyer profiles (not purchased by this realtor)
    const buyersQuery = query(
      collection(db, 'buyerProfiles'),
      where('profileComplete', '==', true),
      firestoreLimit(50) // Removed problematic orderBy
    );
    const buyerDocs = await getDocs(buyersQuery);
    
    const availableLeads = [];
    
    for (const buyerDoc of buyerDocs.docs) {
      const buyer = { id: buyerDoc.id, ...buyerDoc.data() };
      
      // Fix realtor profile data if primaryCity is missing
      let fixedRealtorProfile = { ...realtorProfile };
      
      // If primaryCity/primaryState are null, try to extract from serviceArea or other fields
      if (!fixedRealtorProfile.primaryCity && fixedRealtorProfile.serviceArea) {
        // Parse "Memphis, TN (25 mi)" format
        const match = fixedRealtorProfile.serviceArea.match(/^(.+?),\s*([A-Z]{2})/);
        if (match) {
          fixedRealtorProfile.primaryCity = match[1].trim();
          fixedRealtorProfile.primaryState = match[2].trim();
        }
      }
      
      const enhancedRealtor = { ...fixedRealtorProfile, ...SAMPLE_REALTOR_ENHANCEMENTS };
      const matchResult = MatchingEngine.calculateMatch(buyer, enhancedRealtor);
      
      // Only show leads with at least 30% match
      if (matchResult.matchPercentage >= 30) {
        // Calculate property matches for this buyer
        const propertyMatches = calculateBuyerPropertyMatches(buyer);
        
        // Determine if already purchased by this realtor
        const alreadyPurchased = purchasedBuyerIds.includes(buyerDoc.id);
        
        availableLeads.push({
          id: buyer.id,
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          phone: buyer.phone,
          email: buyer.email,
          maxMonthlyPayment: buyer.maxMonthlyPayment,
          maxDownPayment: buyer.maxDownPayment,
          preferredCity: buyer.preferredCity,
          preferredState: buyer.preferredState,
          searchRadius: buyer.searchRadius,
          minBedrooms: buyer.minBedrooms,
          minBathrooms: buyer.minBathrooms,
          matchedProperties: propertyMatches.totalMatches,
          perfectMatches: propertyMatches.perfectMatches,
          goodMatches: propertyMatches.goodMatches,
          createdAt: buyer.createdAt?.toDate?.()?.toISOString() || buyer.createdAt,
          // Match percentage and reasoning
          matchPercentage: matchResult.matchPercentage,
          matchReasoning: matchResult.reasoning,
          languages: buyer.languages || ['English'],
          // Purchase status for this realtor
          alreadyPurchased: alreadyPurchased,
          propertyMatchSummary: PropertyMatcher.getMatchSummary(propertyMatches)
        });
      }
    }
    
    // Sort by match percentage (highest first)
    availableLeads.sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0));

    // Get purchased leads with details
    const purchasedLeads = [];
    for (const purchaseDoc of purchasedDocs.docs) {
      const purchase = purchaseDoc.data();
      
      // Get buyer details
      const buyerDoc = await getDoc(doc(db, 'buyerProfiles', purchase.buyerId));
      if (buyerDoc.exists()) {
        const buyer = buyerDoc.data();
        
        purchasedLeads.push({
          id: buyer.id || buyerDoc.id,
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          phone: buyer.phone,
          email: buyer.email,
          maxMonthlyPayment: buyer.maxMonthlyPayment,
          maxDownPayment: buyer.maxDownPayment,
          preferredCity: buyer.preferredCity,
          preferredState: buyer.preferredState,
          searchRadius: buyer.searchRadius,
          minBedrooms: buyer.minBedrooms,
          minBathrooms: buyer.minBathrooms,
          purchasedAt: purchase.createdAt?.toDate?.()?.toISOString() || purchase.createdAt,
          status: purchase.status || 'active',
          notes: purchase.notes
        });
      }
    }

    await logInfo('Realtor leads fetched', {
      action: 'realtor_leads_fetch',
      userId: session.user.id,
      userType: 'realtor',
      metadata: {
        availableLeads: availableLeads.length,
        purchasedLeads: purchasedLeads.length,
        realtorId: realtorDoc.id
      }
    });

    return NextResponse.json({
      availableLeads,
      purchasedLeads,
      credits: realtorProfile.credits || 0
    });

  } catch (error) {
    // Handle role validation errors
    if ((error as Error).message.includes('Access denied') || (error as Error).message.includes('Not authenticated')) {
      return NextResponse.json(
        { error: 'Access denied. Realtor access required.' },
        { status: 403 }
      );
    }

    await logError('Failed to fetch realtor leads', error, {
      action: 'realtor_leads_fetch_error'
    });

    return NextResponse.json(
      { error: 'Failed to load leads. Please try again.' },
      { status: 500 }
    );
  }
}

// Helper function to check if buyer is in realtor's service area
function isInServiceArea(buyer: any, realtor: any): boolean {
  // More flexible matching to handle state abbreviations and variations
  
  // Normalize state names for comparison
  const stateAbbrevs = {
    'Texas': 'TX', 'Florida': 'FL', 'Georgia': 'GA',
    'Tennessee': 'TN', 'California': 'CA', 'New York': 'NY'
  };
  
  const normalizeState = (state: string) => {
    return stateAbbrevs[state] || state || '';
  };
  
  const buyerState = normalizeState(buyer.preferredState);
  const realtorState = normalizeState(realtor.primaryState);
  
  // Primary city match (exact city + normalized state)
  if (buyer.preferredCity?.toLowerCase() === realtor.primaryCity?.toLowerCase() && 
      buyerState === realtorState) {
    return true;
  }
  
  // Check if buyer's state is in realtor's service states
  if (realtor.serviceStates && Array.isArray(realtor.serviceStates)) {
    const buyerStateFull = Object.keys(stateAbbrevs).find(key => stateAbbrevs[key] === buyerState) || buyer.preferredState;
    if (realtor.serviceStates.includes(buyerStateFull) || realtor.serviceStates.includes(buyerState)) {
      return true; // Realtor serves this entire state
    }
  }
  
  // Check service cities with flexible matching
  if (realtor.serviceCities && Array.isArray(realtor.serviceCities)) {
    const buyerLocation = `${buyer.preferredCity}, ${buyer.preferredState}`;
    const buyerLocationAbbrev = `${buyer.preferredCity}, ${buyerState}`;
    
    return realtor.serviceCities.some((serviceCity: string) => 
      serviceCity.toLowerCase().includes(buyer.preferredCity?.toLowerCase()) ||
      serviceCity === buyerLocation ||
      serviceCity === buyerLocationAbbrev
    );
  }
  
  return false;
}