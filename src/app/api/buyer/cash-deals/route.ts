import { NextRequest, NextResponse } from 'next/server';
import { getTypesenseSearchClient, TYPESENSE_COLLECTIONS } from '@/lib/typesense/client';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { requireAuth } from '@/lib/auth-helpers';
import { ErrorResponses, logError } from '@/lib/api-error-handler';

/**
 * BUYER CASH DEALS API
 *
 * Returns cash deals (properties < 80% ARV) near the buyer's search location.
 * Uses Typesense for fast search with Firestore fallback.
 */

interface CashDeal {
  id: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  price: number;
  arv: number;
  percentOfArv: number;
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
    const maxPrice = profile.maxPrice || 300000;
    const searchRadius = profile.searchRadius || 30;

    if (!searchCity || !searchState) {
      return NextResponse.json({
        message: 'Please set your preferred city and state in your profile.',
        deals: [],
      });
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

    // Fallback to Firestore if Typesense fails
    if (typesenseError || deals.length === 0) {
      deals = await searchCashDealsFirestore(searchCity, searchState, maxPrice);
    }

    return NextResponse.json({
      deals,
      total: deals.length,
      filters: {
        city: searchCity,
        state: searchState,
        maxPrice,
        maxArvPercent: 80,
        nearbyCitiesCount: 0, // Could expand with radius search
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
  state: string,
  maxPrice: number,
  radius: number
): Promise<CashDeal[]> {
  // Build filter: cash deals OR properties that need work (investor specials)
  // Include properties with: dealType cash_deal/both OR needsWork=true
  const filters = [
    'isActive:=true',
    `state:=${state}`,
    `listPrice:<=${maxPrice}`,
    // Cash deals OR investor/fixer properties
    '(dealType:=[cash_deal, both] || needsWork:=true)',
  ];

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
    const arv = (doc.zestimate as number) || (doc.listPrice as number) || 0;
    const percentOfArv = arv > 0 ? Math.round((price / arv) * 100) : 100;
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
    };
  }).filter((deal: CashDeal) => {
    // Show if: under 80% ARV OR has investor keywords (needsWork)
    return deal.percentOfArv <= 80 || (deal as CashDeal & { needsWork?: boolean }).needsWork;
  });
}

async function searchCashDealsFirestore(
  city: string,
  state: string,
  maxPrice: number
): Promise<CashDeal[]> {
  if (!db) return [];

  try {
    // Query 1: Cash deals
    const cashQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true),
      where('isCashDeal', '==', true),
      where('state', '==', state)
    );

    // Query 2: Properties that need work (investor specials, fixers, etc.)
    const needsWorkQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true),
      where('needsWork', '==', true),
      where('state', '==', state)
    );

    const [cashSnapshot, needsWorkSnapshot] = await Promise.all([
      getDocs(cashQuery),
      getDocs(needsWorkQuery)
    ]);

    // Merge results, deduping by ID
    const seenIds = new Set<string>();
    const deals: CashDeal[] = [];

    const processDoc = (doc: { id: string; data: () => Record<string, unknown> }) => {
      if (seenIds.has(doc.id)) return;
      seenIds.add(doc.id);

      const data = doc.data();
      const price = (data.price as number) || (data.listPrice as number) || 0;
      const arv = (data.estimate as number) || (data.zestimate as number) || (data.arv as number) || 0;
      const needsWork = data.needsWork === true;

      // Skip if over max price
      if (price > maxPrice) return;

      // Calculate ARV percentage
      const percentOfArv = arv > 0 ? Math.round((price / arv) * 100) : 100;

      // Include if: under 80% ARV OR has investor keywords
      if (percentOfArv > 80 && !needsWork) return;

      const discount = arv > 0 ? arv - price : 0;

      // Filter by city (case-insensitive)
      const propCity = ((data.city as string) || '').toLowerCase();
      const searchCityLower = city.toLowerCase();
      const nearbyCities = (data.nearbyCities as string[]) || [];
      if (!propCity.includes(searchCityLower) &&
          !nearbyCities.some((c: string) => c.toLowerCase().includes(searchCityLower))) {
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
