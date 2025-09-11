import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  getDocs,
  query,
  where,
  documentId
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { PropertyListing } from "@/lib/property-schema";

/**
 * BUYER PROPERTY API WITH NEARBY CITIES
 * 
 * Shows properties that match buyer's simple criteria:
 * 1. DIRECT: Properties in the exact search city
 * 2. NEARBY: Properties from nearby cities (within 30 miles) 
 * 3. Budget filters: Monthly payment <= budget, Down payment <= budget
 * 
 * Uses pre-computed nearbyCities data for fast nearby property discovery.
 */

export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const session = await getServerSession(authOptions) as ExtendedSession | null;
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get buyer's search criteria from URL params
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const maxMonthlyPayment = searchParams.get('maxMonthlyPayment');
    const maxDownPayment = searchParams.get('maxDownPayment');
    const pageSize = parseInt(searchParams.get('limit') || '20');
    
    if (!city || !state || !maxMonthlyPayment || !maxDownPayment) {
      return NextResponse.json({ 
        error: 'Missing required parameters: city, state, maxMonthlyPayment, maxDownPayment' 
      }, { status: 400 });
    }

    const maxMonthly = Number(maxMonthlyPayment);
    const maxDown = Number(maxDownPayment);
    const searchCity = city.split(',')[0].trim();
    const searchState = state;

    // Get buyer's liked properties first
    const buyerProfileQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const buyerSnapshot = await getDocs(buyerProfileQuery);
    let likedPropertyIds: string[] = [];
    
    if (!buyerSnapshot.empty) {
      const profile = buyerSnapshot.docs[0].data();
      likedPropertyIds = profile.likedProperties || [];
    }

    // Get ALL properties
    const snapshot = await getDocs(collection(db, 'properties'));
    const allProperties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PropertyListing & { id: string }));
    
    // 1. DIRECT MATCHES: Properties IN the search city AND state
    const directProperties = allProperties.filter((property: PropertyListing & { id: string }) => {
      const propertyCity = property.city?.split(',')[0].trim();
      return propertyCity?.toLowerCase() === searchCity.toLowerCase() && 
             property.state === searchState &&
             property.isActive !== false &&
             property.monthlyPayment <= maxMonthly &&
             property.downPaymentAmount <= maxDown;
    });
    
    // 2. NEARBY MATCHES: Properties FROM other cities IN SAME STATE that consider search city nearby
    const nearbyProperties = allProperties.filter((property: PropertyListing & { id: string }) => {
      const propertyCity = property.city?.split(',')[0].trim();
      
      // Must be different city but SAME STATE
      if (propertyCity?.toLowerCase() === searchCity.toLowerCase()) return false;
      if (property.state !== searchState) return false;
      
      // Must have search city in nearbyCities array
      const considersSearchCityNearby = property.nearbyCities && 
        Array.isArray(property.nearbyCities) &&
        property.nearbyCities.some((nearbyCity: string) => 
          nearbyCity.toLowerCase() === searchCity.toLowerCase()
        );
      
      return considersSearchCityNearby &&
             property.isActive !== false &&
             property.monthlyPayment <= maxMonthly &&
             property.downPaymentAmount <= maxDown;
    });

    // 3. LIKED PROPERTIES: Always include liked properties regardless of search criteria
    const likedProperties = likedPropertyIds.length > 0 ? 
      allProperties.filter((property: PropertyListing & { id: string }) => 
        likedPropertyIds.includes(property.id) && property.isActive !== false
      ) : [];

    // 4. COMBINE AND FORMAT FOR BUYER DASHBOARD WITH SMART DE-DUPLICATION
    const processedResults = new Map();
    
    // First add liked properties (highest priority)
    likedProperties.forEach(property => {
      const propertyCity = property.city?.split(',')[0].trim();
      const isInSearchCity = propertyCity?.toLowerCase() === searchCity.toLowerCase() && property.state === searchState;
      const meetsCurrentBudget = property.monthlyPayment <= maxMonthly && property.downPaymentAmount <= maxDown;
      
      let displayTag = '❤️ Liked';
      let matchReason = 'Previously liked';
      const sortOrder = 0; // Highest priority
      
      if (!meetsCurrentBudget) {
        displayTag = '❤️ Liked (Over Budget)';
        matchReason = 'Previously liked - exceeds current budget';
      } else if (isInSearchCity) {
        displayTag = '❤️ Liked';
        matchReason = `Previously liked - located in ${searchCity}`;
      } else if (property.state !== searchState) {
        displayTag = `❤️ Liked from ${property.city}`;
        matchReason = `Previously liked from ${property.city}, ${property.state}`;
      } else {
        displayTag = `❤️ Liked from ${propertyCity}`;
        matchReason = `Previously liked from ${propertyCity}`;
      }
      
      processedResults.set(property.id, {
        ...property,
        resultType: 'liked',
        displayTag,
        sortOrder,
        matchReason,
        isLiked: true
      });
    });
    
    // Then add direct properties (if not already added as liked)
    directProperties.forEach(property => {
      if (!processedResults.has(property.id)) {
        processedResults.set(property.id, {
          ...property,
          resultType: 'direct',
          displayTag: null,
          sortOrder: 1,
          matchReason: `Located in ${searchCity}`,
          isLiked: false
        });
      } else {
        // If it's already added as liked, update the match reason to show both
        const existing = processedResults.get(property.id);
        existing.matchReason = `❤️ Liked - located in ${searchCity}`;
        existing.displayTag = '❤️ Liked';
      }
    });
    
    // Finally add nearby properties (if not already added)
    nearbyProperties.forEach(property => {
      if (!processedResults.has(property.id)) {
        processedResults.set(property.id, {
          ...property,
          resultType: 'nearby',
          displayTag: 'Nearby',
          sortOrder: 2,
          matchReason: `Near ${searchCity} (in ${property.city?.split(',')[0].trim()})`,
          isLiked: false
        });
      } else {
        // If it's already added as liked, update to show it's also nearby
        const existing = processedResults.get(property.id);
        if (existing.resultType === 'liked') {
          existing.matchReason = `❤️ Liked - near ${searchCity} (in ${property.city?.split(',')[0].trim()})`;
          existing.displayTag = '❤️ Liked • Nearby';
        }
      }
    });

    const allResults = Array.from(processedResults.values())
      .sort((a, b) => {
        // First sort by type (liked -> direct -> nearby), then by monthly payment
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.monthlyPayment - b.monthlyPayment;
      })
      .slice(0, pageSize);


    return NextResponse.json({
      properties: allResults,
      total: allResults.length,
      breakdown: {
        liked: likedProperties.length,
        direct: directProperties.length,
        nearby: nearbyProperties.length,
        totalLikedIncluded: allResults.filter(p => p.resultType === 'liked').length
      },
      searchCriteria: {
        city: searchCity,
        maxMonthlyPayment: maxMonthly,
        maxDownPayment: maxDown
      }
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to load properties',
      properties: [],
      total: 0 
    }, { status: 500 });
  }
}