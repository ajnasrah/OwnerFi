import { NextRequest, NextResponse } from 'next/server';
import { getTypesenseSearchClient, TYPESENSE_COLLECTIONS } from '@/lib/typesense/client';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { requireAuth } from '@/lib/auth-helpers';
import { ErrorResponses, logError } from '@/lib/api-error-handler';
import { getCitiesWithinRadiusWithExpansion } from '@/lib/comprehensive-cities';

/**
 * BUYER CASH DEALS API
 *
 * Returns cash deals (properties < 80% ARV) near the buyer's search location.
 * Uses Typesense for fast search with Firestore fallback.
 */

// All raw Zillow homeType values that represent land
const LAND_TYPES = new Set(['land', 'lot', 'lots', 'vacant_land', 'farm', 'ranch']);

interface CashDeal {
  id: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  price: number;
  arv: number;
  percentOfArv: number | null;
  discount: number;
  beds: number;
  baths: number;
  sqft: number;
  imgSrc: string;
  url: string;
  // Additional details
  description?: string;
  yearBuilt?: number;
  propertyType?: string;
  // Investor flags
  needsWork?: boolean;
  needsWorkKeywords?: string[];
  // Land detection
  isLand?: boolean;
}

export async function GET(request: NextRequest) {
  // Require authentication
  const authResult = await requireAuth(request);
  if ('error' in authResult) return authResult.error;
  const { session } = authResult;

  try {
    // Get buyer's profile for search preferences
    if (!db) {
      return ErrorResponses.databaseError('Database not available');
    }

    const buyerProfileQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const buyerSnapshot = await getDocs(buyerProfileQuery);

    if (buyerSnapshot.empty) {
      return NextResponse.json({
        message: 'Please complete your profile to see cash deals in your area.',
        deals: [],
      });
    }

    const profile = buyerSnapshot.docs[0].data();
    const searchCity = profile.preferredCity || profile.city;
    const searchState = profile.preferredState || profile.state;
    const maxPrice = profile.maxPrice;
    const searchRadius = profile.searchRadius || 30;
    const { searchParams } = new URL(request.url);
    const excludeLand = searchParams.get('excludeLand') === 'true';

    if (!searchCity || !searchState) {
      return NextResponse.json({
        message: 'Please set your preferred city and state in your profile.',
        deals: [],
      });
    }

    // Use buyer's pre-computed nearby cities for radius-based search
    let nearbyCities: string[];
    if (profile.filter?.nearbyCities?.length > 0) {
      nearbyCities = profile.filter.nearbyCities;
      console.log(`✅ [cash-deals] Using stored filter: ${nearbyCities.length} nearby cities`);
    } else {
      // Fallback: Calculate on-the-fly if no filter exists
      // Uses automatic radius expansion: 30mi → 60mi → 120mi if needed
      console.log(`⚠️  [cash-deals] No stored filter found, calculating on-the-fly`);
      const { cities: nearbyCitiesList, radiusUsed } = getCitiesWithinRadiusWithExpansion(searchCity, searchState, 30, 5);
      nearbyCities = nearbyCitiesList.map(city => city.name);
      console.log(`✅ [cash-deals] Calculated ${nearbyCities.length} nearby cities as fallback (radius: ${radiusUsed}mi)`);
    }

    // Try Typesense first
    let deals: CashDeal[] = [];
    let typesenseError = null;

    try {
      const client = getTypesenseSearchClient();
      if (client) {
        deals = await searchCashDealsTypesense(client, searchCity, searchState, maxPrice, searchRadius);
      } else {
        throw new Error('Typesense not available');
      }
    } catch (error) {
      typesenseError = error;
      console.warn('[buyer/cash-deals] Typesense failed, using Firestore fallback:', error);
    }

    // Fallback to Firestore ONLY if Typesense actually failed (not for empty results)
    // Empty results from Typesense are valid - no need to double-query Firestore
    if (typesenseError) {
      deals = await searchCashDealsFirestore(nearbyCities, searchState, maxPrice);
    }

    // Filter out land if requested
    if (excludeLand) {
      deals = deals.filter(d => !d.isLand);
    }

    return NextResponse.json({
      deals,
      total: deals.length,
      filters: {
        city: searchCity,
        state: searchState,
        maxPrice,
        maxArvPercent: 80,
        nearbyCitiesCount: nearbyCities.length,
      },
    });

  } catch (error) {
    logError('GET /api/buyer/cash-deals', error);
    return ErrorResponses.databaseError('Failed to load cash deals', error);
  }
}

async function searchCashDealsTypesense(
  client: any,
  city: string,
  _state: string, // Unused — kept for signature compatibility; city/nearbyCities query handles geography
  maxPrice: number | undefined,
  _radius: number // TODO: Implement geo radius search
): Promise<CashDeal[]> {
  // Build filter: cash deals OR properties that need work (investor specials)
  // Include properties with: dealType cash_deal/both OR needsWork=true
  // NOTE: No state filter — the city query (searching city,nearbyCities fields) already
  // constrains geography. nearbyCities can span multiple states (e.g. Memphis metro
  // includes cities in TN, AR, and MS), so a single-state filter would incorrectly exclude
  // cross-border properties.
  const filters = [
    'isActive:=true',
    // Cash deals OR investor/fixer properties
    '(dealType:=[cash_deal, both] || needsWork:=true)',
  ];
  if (maxPrice !== undefined) {
    filters.push(`listPrice:<=${maxPrice}`);
  }

  const result = await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
    .documents()
    .search({
      q: city,
      query_by: 'city,nearbyCities',
      filter_by: filters.join(' && '),
      sort_by: 'listPrice:asc',
      per_page: 100,
    });

  return (result.hits || []).map((hit: Record<string, unknown>) => {
    const doc = hit.document as Record<string, unknown>;
    const price = (doc.listPrice as number) || 0;
    // DON'T fall back to listPrice - that makes percentOfArv = 100% (defeats the purpose)
    const arv = (doc.zestimate as number) || 0;
    // If no zestimate, percentOfArv is null (will be filtered out unless needsWork)
    const percentOfArv = arv > 0 ? Math.round((price / arv) * 100) : null;
    const discount = arv > 0 ? arv - price : 0;
    const needsWork = doc.needsWork === true;

    return {
      id: doc.id as string,
      address: (doc.address as string) || '',
      city: (doc.city as string) || '',
      state: (doc.state as string) || '',
      zipcode: (doc.zipCode as string) || '',
      price,
      arv,
      percentOfArv,
      discount,
      beds: (doc.bedrooms as number) || 0,
      baths: (doc.bathrooms as number) || 0,
      sqft: (doc.squareFeet as number) || 0,
      imgSrc: (doc.primaryImage as string) || '',
      url: `https://www.zillow.com/homedetails/${doc.id}_zpid/`,
      // Additional details
      description: (doc.description as string) || '',
      yearBuilt: (doc.yearBuilt as number) || 0,
      propertyType: (doc.propertyType as string) || 'SINGLE_FAMILY',
      // Investor flags
      needsWork,
      // Land detection
      isLand: doc.isLand === true || LAND_TYPES.has(((doc.propertyType as string) || '').toLowerCase()),
    };
  }).filter((deal: CashDeal & { needsWork?: boolean }) => {
    // Show if: under 80% ARV OR has investor keywords (needsWork)
    // Properties without zestimate (percentOfArv = null) only show if needsWork is true
    if (deal.percentOfArv === null) {
      return deal.needsWork === true;
    }
    return deal.percentOfArv <= 80 || deal.needsWork === true;
  });
}

async function searchCashDealsFirestore(
  nearbyCities: string[],
  _state: string, // Unused — kept for signature compatibility; city filter handles geography
  maxPrice: number | undefined
): Promise<CashDeal[]> {
  if (!db) return [];

  try {
    // Query 1: Cash deals
    // NOTE: No state filter — nearbyCities can span multiple states (e.g. Memphis metro
    // includes cities in TN, AR, MS). City matching below constrains geography.
    const cashQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true),
      where('isCashDeal', '==', true)
    );

    // Query 2: Properties that need work (investor specials, fixers, etc.)
    const needsWorkQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true),
      where('needsWork', '==', true)
    );

    const [cashSnapshot, needsWorkSnapshot] = await Promise.all([
      getDocs(cashQuery),
      getDocs(needsWorkQuery)
    ]);

    // Merge results, deduping by ID
    const seenIds = new Set<string>();
    const deals: CashDeal[] = [];
    const nearbyCitiesSet = new Set(nearbyCities.map(c => c.toLowerCase().trim()));

    const processDoc = (doc: { id: string; data: () => Record<string, unknown> }) => {
      if (seenIds.has(doc.id)) return;
      seenIds.add(doc.id);

      const data = doc.data();
      const price = (data.price as number) || (data.listPrice as number) || 0;
      const arv = (data.estimate as number) || (data.zestimate as number) || (data.arv as number) || 0;
      const needsWork = data.needsWork === true;

      // Skip if over max price (only if buyer set a max)
      if (maxPrice !== undefined && price > maxPrice) return;

      // Calculate ARV percentage - use null when no ARV data (matches Typesense behavior)
      const percentOfArv = arv > 0 ? Math.round((price / arv) * 100) : null;

      // Include if: under 80% ARV OR has investor keywords
      // Properties without zestimate (percentOfArv = null) only show if needsWork is true
      if (percentOfArv === null) {
        if (!needsWork) return; // Skip properties with no ARV unless they need work
      } else if (percentOfArv > 80 && !needsWork) {
        return; // Skip properties over 80% ARV unless they need work
      }

      const discount = arv > 0 ? arv - price : 0;

      // Filter by nearby cities (case-insensitive exact match against buyer's pre-computed list)
      const propCity = ((data.city as string) || '').toLowerCase().trim();
      if (!nearbyCitiesSet.has(propCity)) {
        return;
      }

      deals.push({
        id: doc.id,
        address: (data.streetAddress as string) || (data.address as string) || '',
        city: (data.city as string) || '',
        state: (data.state as string) || '',
        zipcode: (data.zipCode as string) || (data.zipcode as string) || '',
        price,
        arv,
        percentOfArv,
        discount,
        beds: (data.bedrooms as number) || (data.beds as number) || 0,
        baths: (data.bathrooms as number) || (data.baths as number) || 0,
        sqft: (data.squareFoot as number) || (data.squareFeet as number) || (data.sqft as number) || 0,
        imgSrc: (data.primaryImage as string) || (data.firstPropertyImage as string) || (data.imgSrc as string) || (data.imageUrl as string) || '',
        url: (data.url as string) || (data.hdpUrl as string) || `https://www.zillow.com/homedetails/${doc.id}_zpid/`,
        needsWork,
        needsWorkKeywords: (data.needsWorkKeywords as string[]) || [],
        isLand: data.isLand === true || LAND_TYPES.has(((data.homeType as string) || (data.propertyType as string) || '').toLowerCase()),
      });
    };

    cashSnapshot.docs.forEach(processDoc);
    needsWorkSnapshot.docs.forEach(processDoc);

    // Sort by price ascending
    deals.sort((a, b) => a.price - b.price);

    return deals.slice(0, 100); // Limit to 100 results

  } catch (error) {
    console.error('[buyer/cash-deals] Firestore query failed:', error);
    return [];
  }
}
