import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { PropertyListing } from "@/lib/property-schema";
import { getCitiesWithinRadiusComprehensive } from '@/lib/comprehensive-cities';

/**
 * BUYER PROPERTY API WITH NEARBY CITIES
 *
 * Shows properties that match buyer's simple criteria:
 * 1. DIRECT: Properties in the exact search city
 * 2. NEARBY: Properties IN nearby cities (within 30 miles of buyer's search city)
 * 3. Budget filters: Monthly payment <= budget, Down payment <= budget
 *
 * LOGIC: When buyer searches "Houston", we:
 * - Get list of cities within 30 miles of Houston (Pearland, Sugarland, etc.)
 * - Show properties located IN those nearby cities
 */

export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;
    
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

    // Get cities within 30 miles of the buyer's search city
    const nearbyCitiesList = getCitiesWithinRadiusComprehensive(searchCity, searchState, 30);

    // Create a Set of nearby city names for fast lookup (lowercase for comparison)
    const nearbyCityNames = new Set(
      nearbyCitiesList.map(city => city.name.toLowerCase())
    );

    console.log(`[buyer-search] Buyer searching for ${searchCity}, ${searchState}`);
    console.log(`[buyer-search] Found ${nearbyCityNames.size} nearby cities:`,
      Array.from(nearbyCityNames).slice(0, 10).join(', ') + (nearbyCityNames.size > 10 ? '...' : '')
    );

    // PERFORMANCE FIX: Query only properties in the relevant state
    // NEW: Removed budget filters from query to allow OR logic (show properties matching EITHER budget criterion)
    const propertiesQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true),
      where('state', '==', searchState), // Only properties in buyer's state
      orderBy('monthlyPayment', 'asc'),
      limit(1000) // Increased limit to allow more partial matches
    );

    const snapshot = await getDocs(propertiesQuery);
    const allProperties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PropertyListing & { id: string }));

    // Helper function to determine budget match type
    const getBudgetMatchType = (property: PropertyListing & { id: string }) => {
      const monthlyMatch = property.monthlyPayment <= maxMonthly;
      const downMatch = !property.downPaymentAmount || property.downPaymentAmount <= maxDown;

      if (monthlyMatch && downMatch) return 'both';
      if (monthlyMatch) return 'monthly_only';
      if (downMatch) return 'down_only';
      return 'neither';
    };

    // 1. DIRECT MATCHES: Properties IN the search city AND state that match at least ONE budget criterion
    const directProperties = allProperties.filter((property: PropertyListing & { id: string }) => {
      const propertyCity = property.city?.split(',')[0].trim();
      const budgetMatchType = getBudgetMatchType(property);

      // NEW: Show if city matches AND at least one budget criterion matches
      return propertyCity?.toLowerCase() === searchCity.toLowerCase() && budgetMatchType !== 'neither';
    });

    // 2. NEARBY MATCHES: Properties located IN cities that are within 30 miles that match at least ONE budget criterion
    const nearbyProperties = allProperties.filter((property: PropertyListing & { id: string }) => {
      const propertyCity = property.city?.split(',')[0].trim();

      // Must be different city (state already filtered in query)
      if (propertyCity?.toLowerCase() === searchCity.toLowerCase()) return false;

      // Check if property's city is in the list of nearby cities
      const isInNearbyCity = propertyCity && nearbyCityNames.has(propertyCity.toLowerCase());

      // NEW: Check if at least one budget criterion matches
      const budgetMatchType = getBudgetMatchType(property);

      return isInNearbyCity && budgetMatchType !== 'neither';
    });

    console.log(`[buyer-search] Found ${directProperties.length} direct matches, ${nearbyProperties.length} nearby matches`);

    // 3. LIKED PROPERTIES: Always include liked properties regardless of search criteria
    // Need separate query since liked properties might not be in buyer's state
    let likedProperties: Array<PropertyListing & { id: string }> = [];
    if (likedPropertyIds.length > 0) {
      // First check if any liked properties are in our already-fetched results
      const likedInResults = allProperties.filter(property =>
        likedPropertyIds.includes(property.id)
      );

      // For any liked properties not in results, fetch them separately in batches of 10
      const missingLikedIds = likedPropertyIds.filter(id =>
        !allProperties.some(p => p.id === id)
      );

      if (missingLikedIds.length > 0) {
        // Firestore 'in' operator supports max 10 values
        for (let i = 0; i < missingLikedIds.length; i += 10) {
          const batchIds = missingLikedIds.slice(i, i + 10);
          const { documentId } = await import('firebase/firestore');

          const likedQuery = query(
            collection(db, 'properties'),
            where(documentId(), 'in', batchIds),
            where('isActive', '==', true)
          );

          const likedSnapshot = await getDocs(likedQuery);
          const likedBatch = likedSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as PropertyListing & { id: string }));

          likedInResults.push(...likedBatch);
        }
      }

      likedProperties = likedInResults;
    }

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
        // Handle properties without monthly payment
        const aPayment = a.monthlyPayment || 0;
        const bPayment = b.monthlyPayment || 0;
        return aPayment - bPayment;
      })
      .slice(0, pageSize);

    // Debug logging - Enhanced for debugging low results
    console.log(`Properties API Debug:
      Total properties in DB: ${allProperties.length}
      Search city: ${searchCity}, state: ${searchState}
      Budget: $${maxMonthly}/mo, $${maxDown} down
      Direct matches: ${directProperties.length}
      Nearby matches: ${nearbyProperties.length}
      Liked matches: ${likedProperties.length}
      Total results: ${allResults.length}

      Sample property monthly payments: ${allProperties.slice(0, 5).map(p => p.monthlyPayment).join(', ')}
      Sample property down payments: ${allProperties.slice(0, 5).map(p => p.downPaymentAmount).join(', ')}
      Properties filtered out by down payment: ${allProperties.filter(p => p.downPaymentAmount > maxDown).length}
    `);

    return NextResponse.json({
      properties: allResults,
      total: allResults.length,
      breakdown: {
        liked: likedProperties.length,
        direct: directProperties.length,
        nearby: nearbyProperties.length,
        totalLikedIncluded: allResults.filter(p => p.resultType === 'liked').length,
        totalPropertiesInDB: allProperties.length
      },
      searchCriteria: {
        city: searchCity,
        state: searchState,
        maxMonthlyPayment: maxMonthly,
        maxDownPayment: maxDown
      }
    });

  } catch {
    return NextResponse.json({ 
      error: 'Failed to load properties',
      properties: [],
      total: 0 
    }, { status: 500 });
  }
}