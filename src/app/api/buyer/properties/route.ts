import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  getDocs,
  query,
  where,
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

    // Get ALL properties
    const snapshot = await getDocs(collection(db, 'properties'));
    const allProperties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PropertyListing & { id: string }));

    // 1. DIRECT MATCHES: Properties IN the search city AND state
    const directProperties = allProperties.filter((property: PropertyListing & { id: string }) => {
      const propertyCity = property.city?.split(',')[0].trim();
      // Show properties if they have no pricing data OR meet both budget criteria
      const meetsbudget = (!property.monthlyPayment || property.monthlyPayment <= maxMonthly) &&
                         (!property.downPaymentAmount || property.downPaymentAmount <= maxDown);
      return propertyCity?.toLowerCase() === searchCity.toLowerCase() &&
             property.state === searchState &&
             property.isActive !== false &&
             meetsbudget;
    });

    // 2. NEARBY MATCHES: Properties located IN cities that are within 30 miles of buyer's search city
    const nearbyProperties = allProperties.filter((property: PropertyListing & { id: string }) => {
      const propertyCity = property.city?.split(',')[0].trim();

      // Must be different city but SAME STATE
      if (propertyCity?.toLowerCase() === searchCity.toLowerCase()) return false;
      if (property.state !== searchState) return false;

      // Check if property's city is in the list of nearby cities
      const isInNearbyCity = propertyCity && nearbyCityNames.has(propertyCity.toLowerCase());

      // Show properties if they have no pricing data OR meet both budget criteria
      const meetsbudget = (!property.monthlyPayment || property.monthlyPayment <= maxMonthly) &&
                         (!property.downPaymentAmount || property.downPaymentAmount <= maxDown);

      return isInNearbyCity &&
             property.isActive !== false &&
             meetsbudget;
    });

    console.log(`[buyer-search] Found ${directProperties.length} direct matches, ${nearbyProperties.length} nearby matches`);

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
        // Handle properties without monthly payment
        const aPayment = a.monthlyPayment || 0;
        const bPayment = b.monthlyPayment || 0;
        return aPayment - bPayment;
      })
      .slice(0, pageSize);

    // Debug logging
    console.log(`Properties API Debug:
      Total properties in DB: ${allProperties.length}
      Search city: ${searchCity}, state: ${searchState}
      Budget: $${maxMonthly}/mo, $${maxDown} down
      Direct matches: ${directProperties.length}
      Nearby matches: ${nearbyProperties.length}
      Liked matches: ${likedProperties.length}
      Total results: ${allResults.length}
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