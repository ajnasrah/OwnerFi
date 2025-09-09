import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSessionWithRole } from '@/lib/auth-utils';
import UnifiedMatchingService from '@/lib/unified-matching-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get realtor profile
    const realtorQuery = query(
      collection(db, 'realtors'),
      where('userId', '==', session.user.id!)
    );
    const realtorDocs = await getDocs(realtorQuery);
    
    if (realtorDocs.empty) {
      return NextResponse.json({ error: 'Realtor profile not found' }, { status: 404 });
    }

    const realtorProfile = realtorDocs.docs[0].data();
    
    // Build realtor location from profile
    const realtorLocation = {
      centerCity: realtorProfile?.primaryCity || 'Dallas',
      centerState: realtorProfile?.primaryState || 'TX', 
      searchRadius: realtorProfile?.serviceRadius || 40,
      serviceCities: parseServiceCities(realtorProfile?.serviceCities) || [realtorProfile?.primaryCity || 'Dallas']
    };

    // Get purchased buyer IDs
    const purchasedQuery = query(
      collection(db, 'buyerLeadPurchases'),
      where('realtorId', '==', realtorDocs.docs[0].id)
    );
    const purchasedDocs = await getDocs(purchasedQuery);
    const purchasedBuyerIds = purchasedDocs.docs.map(doc => doc.data().buyerId);

    // Use unified service to find matching buyers
    const matchingBuyers = await UnifiedMatchingService.findBuyersForRealtor(realtorLocation);

    const availableLeads = [];
    const purchasedLeads = [];

    // Separate into available vs purchased
    for (const buyer of matchingBuyers) {
      const leadData = {
        id: buyer.id,
        firstName: buyer.firstName || 'Unknown',
        lastName: buyer.lastName || 'Buyer',
        phone: buyer.phone || 'No phone',
        email: buyer.email || 'No email',
        maxMonthlyPayment: buyer.searchCriteria?.maxMonthlyPayment || 0,
        maxDownPayment: buyer.searchCriteria?.maxDownPayment || 0,
        preferredCity: buyer.searchCriteria?.cities?.[0] || 'Unknown',
        preferredState: buyer.searchCriteria?.state || 'Unknown',
        searchRadius: buyer.searchCriteria?.searchRadius || 25,
        minBedrooms: buyer.searchCriteria?.minBedrooms,
        minBathrooms: buyer.searchCriteria?.minBathrooms,
        matchedProperties: buyer.matchedProperties,
        perfectMatches: buyer.exactCityMatches,
        goodMatches: buyer.nearbyMatches,
        matchPercentage: 75,
        languages: buyer.languages || ['English'],
        createdAt: buyer.createdAt?.toDate ? buyer.createdAt.toDate().toISOString() : new Date().toISOString()
      };

      const alreadyPurchased = purchasedBuyerIds.includes(buyer.id);
      
      if (alreadyPurchased) {
        purchasedLeads.push(leadData);
      } else {
        availableLeads.push(leadData);
      }
    }

    return NextResponse.json({
      availableLeads,
      purchasedLeads,
      credits: realtorProfile?.credits || 0,
      serviceArea: {
        city: realtorLocation.centerCity,
        state: realtorLocation.centerState,
        cities: realtorLocation.serviceCities
      }
    });

  } catch (error) {
    console.error('Leads API error:', error);
    return NextResponse.json({ error: 'Failed to load leads' }, { status: 500 });
  }
}

// Helper function to parse service cities from profile
function parseServiceCities(serviceCitiesData: any): string[] | null {
  if (!serviceCitiesData) return null;
  
  try {
    if (Array.isArray(serviceCitiesData)) {
      return serviceCitiesData;
    } else if (typeof serviceCitiesData === 'string') {
      return JSON.parse(serviceCitiesData);
    }
  } catch (error) {
    console.warn('Error parsing service cities:', error);
  }
  
  return null;
}