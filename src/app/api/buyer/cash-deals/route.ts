import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * Cash Deals API for Investors
 *
 * Returns properties from cash_houses that:
 * - Are under 80% of ARV
 * - Are NOT owner finance verified (those go to owner finance tab)
 * - Match the buyer's filter settings (city, budget, beds, baths, sqft)
 */

const MAX_ARV_PERCENT = 80;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getAdminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const userId = session.user.id;

    // Get buyer profile with all filter settings
    const buyerSnapshot = await db.collection('buyerProfiles')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (buyerSnapshot.empty) {
      console.log(`[buyer/cash-deals] No buyer profile found for user ${userId}`);
      return NextResponse.json({
        deals: [],
        total: 0,
        message: 'Please complete your profile to see cash deals in your area'
      });
    }

    const buyerData = buyerSnapshot.docs[0].data();

    // Extract filter settings from buyer profile
    const buyerCity = buyerData.city || buyerData.preferredCity || '';
    const buyerState = buyerData.state || buyerData.preferredState || '';

    // Budget from profile
    const minPrice = buyerData.minPrice || 0;
    const maxPrice = buyerData.maxPrice || 0; // 0 = no limit

    // Property requirements from profile
    const minBedrooms = buyerData.minBedrooms || 0;
    const minBathrooms = buyerData.minBathrooms || 0;
    const minSquareFeet = buyerData.minSquareFeet || 0;

    // Pre-computed nearby cities from filter
    const nearbyCities: string[] = buyerData.filter?.nearbyCities || [];

    console.log(`[buyer/cash-deals] User ${userId} filters:`, {
      city: buyerCity,
      state: buyerState,
      minPrice,
      maxPrice: maxPrice || 'no limit',
      minBedrooms,
      minBathrooms,
      minSquareFeet,
      nearbyCitiesCount: nearbyCities.length,
      hasFilter: !!buyerData.filter,
      sampleNearbyCities: nearbyCities.slice(0, 5)
    });

    // Require city/state to be set
    if (!buyerCity || !buyerState) {
      return NextResponse.json({
        deals: [],
        total: 0,
        message: 'Please set your city in your profile settings to see cash deals'
      });
    }

    // OPTIMIZATION: Use array-contains query instead of fetching all and filtering
    // This is much faster for large collections
    // Query 1: Properties in the buyer's state (for direct city match later)
    // Query 2: Properties whose nearbyCities contains buyer's city (fast geo filter)
    const [directSnapshot, nearbySnapshot] = await Promise.all([
      db.collection('cash_houses')
        .where('state', '==', buyerState)
        .get(),
      db.collection('cash_houses')
        .where('nearbyCities', 'array-contains', buyerCity)
        .get()
    ]);

    // Merge and dedupe by ID
    const docsMap = new Map();
    directSnapshot.docs.forEach(doc => docsMap.set(doc.id, doc));
    nearbySnapshot.docs.forEach(doc => docsMap.set(doc.id, doc));
    const snapshot = { docs: Array.from(docsMap.values()), size: docsMap.size };
    console.log(`[buyer/cash-deals] Query results: ${directSnapshot.size} state-match, ${nearbySnapshot.size} nearby-match, ${snapshot.size} unique`);

    let deals = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        zipcode: data.zipcode || '',
        price: data.price || 0,
        arv: data.arv || 0,
        percentOfArv: data.percentOfArv || 0,
        discount: data.arv && data.price ? data.arv - data.price : 0,
        beds: data.beds || data.bedrooms || 0,
        baths: data.baths || data.bathrooms || 0,
        sqft: data.sqft || data.squareFeet || 0,
        imgSrc: data.imgSrc || data.imageUrl || '',
        url: data.url || '',
        ownerFinanceVerified: data.ownerFinanceVerified || false,
      };
    });

    // Filter: correct state, under 80% ARV, NOT owner finance, has valid ARV
    const beforeStateFilter = deals.length;
    deals = deals.filter(d => d.state === buyerState);
    console.log(`[buyer/cash-deals] After state filter (${buyerState}): ${deals.length} (was ${beforeStateFilter})`);

    const beforeArvFilter = deals.length;
    deals = deals.filter(d => d.arv > 0 && d.percentOfArv > 0 && d.percentOfArv <= MAX_ARV_PERCENT);
    console.log(`[buyer/cash-deals] After ARV filter (<=80%): ${deals.length} (was ${beforeArvFilter})`);

    const beforeOwnerFinFilter = deals.length;
    deals = deals.filter(d => !d.ownerFinanceVerified);
    console.log(`[buyer/cash-deals] After owner finance filter: ${deals.length} (was ${beforeOwnerFinFilter})`);

    // Apply max price filter
    if (maxPrice > 0) {
      deals = deals.filter(d => d.price <= maxPrice);
    }

    // Apply price filter (if min price is set)
    if (minPrice > 0) {
      deals = deals.filter(d => d.price >= minPrice);
    }

    // Apply property requirements
    if (minBedrooms > 0) {
      deals = deals.filter(d => d.beds >= minBedrooms);
    }
    if (minBathrooms > 0) {
      deals = deals.filter(d => d.baths >= minBathrooms);
    }
    if (minSquareFeet > 0) {
      deals = deals.filter(d => d.sqft >= minSquareFeet);
    }

    // Filter by buyer's nearby cities (from pre-computed filter)
    const buyerCityLower = buyerCity.toLowerCase();
    const nearbyCitiesLower = new Set(nearbyCities.map(c => c.toLowerCase()));
    // Include the buyer's main city in the set
    nearbyCitiesLower.add(buyerCityLower);

    const beforeCityFilter = deals.length;
    // Log unique cities in remaining deals for debugging
    const uniqueCitiesInDeals = [...new Set(deals.map(d => d.city))];
    console.log(`[buyer/cash-deals] Cities in remaining deals: ${uniqueCitiesInDeals.slice(0, 10).join(', ')}${uniqueCitiesInDeals.length > 10 ? '...' : ''}`);

    deals = deals.filter(d => {
      const dealCityLower = d.city.toLowerCase();
      // Match exact city or nearby cities
      if (nearbyCitiesLower.has(dealCityLower)) return true;
      // Allow partial match for main city (handles variations)
      if (dealCityLower.includes(buyerCityLower) || buyerCityLower.includes(dealCityLower)) return true;
      return false;
    });
    console.log(`[buyer/cash-deals] After city filter (${buyerCity} + ${nearbyCities.length} nearby): ${deals.length} (was ${beforeCityFilter})`);

    // Sort by best discount (lowest % of ARV first)
    deals.sort((a, b) => a.percentOfArv - b.percentOfArv);

    console.log(`[buyer/cash-deals] Found ${deals.length} deals matching filters`);

    // If no deals in user's area, provide helpful context
    if (deals.length === 0 && beforeCityFilter > 0) {
      console.log(`[buyer/cash-deals] No deals in ${buyerCity} area, but ${beforeCityFilter} deals exist in ${buyerState}`);
      return NextResponse.json({
        deals: [],
        total: 0,
        message: `No cash deals currently available in ${buyerCity} area. ${beforeCityFilter} deals available in other ${buyerState} cities.`,
        filters: {
          city: buyerCity,
          state: buyerState,
          maxArvPercent: MAX_ARV_PERCENT,
          nearbyCitiesCount: nearbyCities.length,
          stateDealsAvailable: beforeCityFilter
        }
      });
    }

    return NextResponse.json({
      deals,
      total: deals.length,
      filters: {
        city: buyerCity,
        state: buyerState,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        minBedrooms: minBedrooms || undefined,
        minBathrooms: minBathrooms || undefined,
        minSquareFeet: minSquareFeet || undefined,
        maxArvPercent: MAX_ARV_PERCENT,
        nearbyCitiesCount: nearbyCities.length
      }
    });

  } catch (error: any) {
    console.error('[buyer/cash-deals] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
