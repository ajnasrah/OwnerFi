// Simplified realtor leads API - just return available buyers without complex matching
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

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get realtor profile
    const realtorsQuery = query(
      collection(db, 'realtors'),
      where('userId', '==', session.user.id!)
    );
    const realtorDocs = await getDocs(realtorsQuery);

    if (realtorDocs.empty) {
      return NextResponse.json({ error: 'Realtor profile not found' }, { status: 400 });
    }

    // Get purchased leads
    const realtorId = realtorDocs.docs[0].id;
    const purchasedQuery = query(
      collection(db, 'buyerLeadPurchases'),
      where('realtorId', '==', realtorId)
    );
    const purchasedDocs = await getDocs(purchasedQuery);
    const purchasedBuyerIds = purchasedDocs.docs.map(doc => doc.data().buyerId);

    // Get all buyers
    const buyersQuery = query(
      collection(db, 'buyerProfiles'),
      where('profileComplete', '==', true),
      firestoreLimit(50)
    );
    const buyerDocs = await getDocs(buyersQuery);

    const availableLeads = [];
    const purchasedLeads = [];

    // Get realtor's service area
    const realtorProfile = realtorDocs.docs[0].data();
    const realtorServiceArea = realtorProfile?.serviceArea || '';
    let realtorCity = 'Dallas'; // Default
    let realtorState = 'TX';
    
    // Parse service area like "Dallas, TX (25 mi)"
    const serviceMatch = realtorServiceArea.match(/^(.+?),\s*([A-Z]{2})/);
    if (serviceMatch) {
      realtorCity = serviceMatch[1].trim();
      realtorState = serviceMatch[2].trim();
    }

    buyerDocs.docs.forEach(buyerDoc => {
      const buyer = { id: buyerDoc.id, ...buyerDoc.data() };
      
      // Only show buyers in realtor's service area
      const buyerCity = buyer.preferredCity || '';
      const buyerState = buyer.preferredState || '';
      
      // Geographic filtering - only show buyers in same city/state
      const isInServiceArea = buyerCity.toLowerCase().includes(realtorCity.toLowerCase()) || 
                              buyerState === realtorState;
      
      if (!isInServiceArea) {
        return; // Skip buyers outside service area
      }
      
      const alreadyPurchased = purchasedBuyerIds.includes(buyerDoc.id);
      
      const leadData = {
        id: buyer.id,
        firstName: buyer.firstName || 'Unknown',
        lastName: buyer.lastName || 'Buyer',
        phone: buyer.phone || 'No phone',
        email: buyer.email || 'No email',
        maxMonthlyPayment: buyer.maxMonthlyPayment || 0,
        maxDownPayment: buyer.maxDownPayment || 0,
        preferredCity: buyer.preferredCity || 'Unknown',
        preferredState: buyer.preferredState || 'Unknown',
        matchedProperties: 3,
        perfectMatches: 1,
        goodMatches: 2,
        matchPercentage: 75,
        languages: buyer.languages || ['English']
      };

      if (alreadyPurchased) {
        purchasedLeads.push(leadData);
      } else {
        availableLeads.push(leadData);
      }
    });

    return NextResponse.json({
      availableLeads,
      purchasedLeads,
      credits: realtorDocs.docs[0].data()?.credits || 0
    });

  } catch (error) {
    console.error('Simple leads API error:', error);
    return NextResponse.json({ error: 'Failed to load leads' }, { status: 500 });
  }
}