import { NextRequest, NextResponse } from 'next/server';
import { getTypesenseSearchClient, TYPESENSE_COLLECTIONS } from '@/lib/typesense/client';
import { collection, getDocs, query, where, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { checkDatabaseAvailable, applyRateLimit, getClientIp } from '@/lib/api-guards';
import { ErrorResponses, createSuccessResponse, logError } from '@/lib/api-error-handler';

/**
 * UNIFIED PROPERTY SEARCH API
 *
 * Uses Typesense for fast search with automatic fallback to Firestore.
 *
 * Query Parameters:
 * - q: Search query (optional, default: *)
 * - city: Filter by city
 * - state: Filter by state (2-letter code)
 * - lat/lng/radius: Geo search (radius in miles)
 * - dealType: owner_finance | cash_deal | both | standard
 * - minPrice/maxPrice: Price range
 * - minBeds/maxBeds: Bedroom range
 * - minBaths/maxBaths: Bathroom range
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 20, max: 100)
 * - sort: Sorting (default: listPrice:asc)
 */

interface SearchParams {
  q?: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  dealType?: string;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  page?: number;
  limit?: number;
  sort?: string;
}

function parseSearchParams(searchParams: URLSearchParams): SearchParams {
  // Parse with validation to prevent NaN issues
  const parseIntSafe = (value: string | null): number | undefined => {
    if (!value) return undefined;
    const parsed = parseInt(value);
    return isNaN(parsed) ? undefined : parsed;
  };

  const parseFloatSafe = (value: string | null): number | undefined => {
    if (!value) return undefined;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  };

  const page = parseIntSafe(searchParams.get('page')) || 1;
  const limit = Math.min(parseIntSafe(searchParams.get('limit')) || 20, 100);

  return {
    q: searchParams.get('q') || undefined,
    city: searchParams.get('city') || undefined,
    state: searchParams.get('state') || undefined,
    lat: parseFloatSafe(searchParams.get('lat')),
    lng: parseFloatSafe(searchParams.get('lng')),
    radius: parseIntSafe(searchParams.get('radius')) || 30,
    dealType: searchParams.get('dealType') || undefined,
    minPrice: parseIntSafe(searchParams.get('minPrice')),
    maxPrice: parseIntSafe(searchParams.get('maxPrice')),
    minBeds: parseIntSafe(searchParams.get('minBeds')),
    maxBeds: parseIntSafe(searchParams.get('maxBeds')),
    minBaths: parseFloatSafe(searchParams.get('minBaths')),
    maxBaths: parseFloatSafe(searchParams.get('maxBaths')),
    page: Math.max(1, page), // Ensure page is at least 1
    limit: Math.max(1, limit), // Ensure limit is at least 1
    sort: searchParams.get('sort') || 'listPrice:asc',
  };
}

// ============================================
// TYPESENSE SEARCH
// ============================================

async function searchWithTypesense(params: SearchParams) {
  const client = getTypesenseSearchClient();

  if (!client) {
    throw new Error('Typesense not available');
  }

  // Build filter string
  const filters: string[] = ['isActive:=true'];

  if (params.state) {
    filters.push(`state:=${params.state}`);
  }

  if (params.city) {
    filters.push(`city:=${params.city}`);
  }

  // Geo search
  if (params.lat && params.lng && params.radius) {
    filters.push(`location:(${params.lat}, ${params.lng}, ${params.radius} mi)`);
  }

  // Deal type filter
  if (params.dealType) {
    if (params.dealType === 'owner_finance') {
      filters.push('dealType:=[owner_finance, both]');
    } else if (params.dealType === 'cash_deal') {
      filters.push('dealType:=[cash_deal, both]');
    } else {
      filters.push(`dealType:=${params.dealType}`);
    }
  }

  // Price filters
  if (params.minPrice) {
    filters.push(`listPrice:>=${params.minPrice}`);
  }
  if (params.maxPrice) {
    filters.push(`listPrice:<=${params.maxPrice}`);
  }

  // Bedroom filters
  if (params.minBeds) {
    filters.push(`bedrooms:>=${params.minBeds}`);
  }
  if (params.maxBeds) {
    filters.push(`bedrooms:<=${params.maxBeds}`);
  }

  // Bathroom filters
  if (params.minBaths) {
    filters.push(`bathrooms:>=${params.minBaths}`);
  }
  if (params.maxBaths) {
    filters.push(`bathrooms:<=${params.maxBaths}`);
  }

  const searchParams = {
    q: params.q || '*',
    query_by: 'address,city,description,nearbyCities',
    filter_by: filters.join(' && '),
    sort_by: params.sort || 'listPrice:asc',
    page: params.page || 1,
    per_page: params.limit || 20,
    facet_by: 'city,state,dealType,bedrooms,propertyType',
    include_fields: '*',
  };

  const startTime = Date.now();
  const result = await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
    .documents()
    .search(searchParams);
  const searchTime = Date.now() - startTime;

  return {
    properties: result.hits?.map(hit => hit.document) || [],
    total: result.found || 0,
    page: params.page || 1,
    totalPages: Math.ceil((result.found || 0) / (params.limit || 20)),
    facets: result.facet_counts?.reduce((acc, facet) => {
      acc[facet.field_name] = facet.counts.map(c => ({
        value: c.value,
        count: c.count
      }));
      return acc;
    }, {} as Record<string, Array<{ value: string; count: number }>>) || {},
    searchTime,
    engine: 'typesense'
  };
}

// ============================================
// FIRESTORE FALLBACK
// ============================================

interface FirestoreProperty {
  id: string;
  address?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  listPrice?: number;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  nearbyCities?: string[];
  ownerFinanceVerified?: boolean;
  dealType?: string;
  [key: string]: unknown;
}

async function queryFirestoreCollection(
  collectionName: string,
  params: SearchParams,
  dealType: 'owner_finance' | 'cash_deal' | 'both'
): Promise<FirestoreProperty[]> {
  if (!db) return [];

  const constraints: ReturnType<typeof where>[] = [];

  // Always filter for active properties
  constraints.push(where('isActive', '==', true));

  if (params.state) {
    constraints.push(where('state', '==', params.state));
  }

  // Filter by deal type using unified collection flags
  if (dealType === 'owner_finance') {
    constraints.push(where('isOwnerFinance', '==', true));
  } else if (dealType === 'cash_deal') {
    constraints.push(where('isCashDeal', '==', true));
  }
  // 'both' doesn't need additional filter - we get all active properties

  // Price filter
  if (params.maxPrice) {
    constraints.push(where('price', '<=', params.maxPrice));
  }

  try {
    const queryConstraints = [
      ...constraints,
      firestoreLimit((params.limit || 20) * 3)
    ];

    const propertiesQuery = query(collection(db, collectionName), ...queryConstraints);
    const snapshot = await getDocs(propertiesQuery);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      // Determine deal type from flags
      let docDealType: 'owner_finance' | 'cash_deal' | 'both' = 'owner_finance';
      if (data.isOwnerFinance && data.isCashDeal) {
        docDealType = 'both';
      } else if (data.isCashDeal) {
        docDealType = 'cash_deal';
      }
      return {
        id: doc.id,
        ...data,
        dealType: docDealType,
      };
    }) as FirestoreProperty[];
  } catch (error) {
    console.warn(`[Firestore] Failed to query ${collectionName}:`, error);
    return [];
  }
}

async function searchWithFirestore(params: SearchParams) {
  if (!db) {
    throw new Error('Firestore not available');
  }

  const startTime = Date.now();

  // Query unified properties collection with dealType filter
  const dealTypeFilter = (params.dealType || 'both') as 'owner_finance' | 'cash_deal' | 'both';

  // Query unified properties collection
  const results = await Promise.all([
    queryFirestoreCollection('properties', params, dealTypeFilter)
  ]);

  // Merge and deduplicate results
  const seen = new Set<string>();
  let properties: FirestoreProperty[] = [];

  for (const collectionResults of results) {
    for (const prop of collectionResults) {
      // Create dedup key from address + city + state
      const address = prop.streetAddress || prop.address || '';
      const city = prop.city || '';
      const state = prop.state || '';
      const dedupKey = `${address}|${city}|${state}`.toLowerCase().replace(/[^a-z0-9|]/g, '');

      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        properties.push(prop);
      }
    }
  }

  // In-memory filtering for constraints Firestore can't handle
  if (params.minPrice) {
    properties = properties.filter(p => ((p.listPrice || p.price) || 0) >= params.minPrice!);
  }

  if (params.minBeds) {
    properties = properties.filter(p => (p.bedrooms || 0) >= params.minBeds!);
  }
  if (params.maxBeds) {
    properties = properties.filter(p => (p.bedrooms || 0) <= params.maxBeds!);
  }

  if (params.minBaths) {
    properties = properties.filter(p => (p.bathrooms || 0) >= params.minBaths!);
  }
  if (params.maxBaths) {
    properties = properties.filter(p => (p.bathrooms || 0) <= params.maxBaths!);
  }

  if (params.city) {
    const cityLower = params.city.toLowerCase();
    properties = properties.filter(p =>
      p.city?.toLowerCase() === cityLower ||
      p.nearbyCities?.some((c: string) => c.toLowerCase() === cityLower)
    );
  }

  // Sort by price
  properties.sort((a, b) => ((a.listPrice || a.price) || 0) - ((b.listPrice || b.price) || 0));

  // Pagination
  const page = params.page || 1;
  const limit = params.limit || 20;
  const startIndex = (page - 1) * limit;
  const paginatedProperties = properties.slice(startIndex, startIndex + limit);

  const searchTime = Date.now() - startTime;

  return {
    properties: paginatedProperties,
    total: properties.length,
    page,
    totalPages: Math.ceil(properties.length / limit),
    facets: {},
    searchTime,
    engine: 'firestore'
  };
}

// ============================================
// API HANDLER
// ============================================

export async function GET(request: NextRequest) {
  // Rate limiting (100 requests per minute per IP)
  const ip = getClientIp(request.headers);
  const rateLimitError = await applyRateLimit(`search:${ip}`, 100, 60);
  if (rateLimitError) return rateLimitError;

  // Check database availability
  const dbError = checkDatabaseAvailable(db);
  if (dbError) return dbError;

  try {
    const { searchParams } = new URL(request.url);
    const params = parseSearchParams(searchParams);

    let result;
    let typesenseError = null;

    // Try Typesense first
    try {
      result = await searchWithTypesense(params);
      console.log(`[Search] Typesense: ${result.total} results in ${result.searchTime}ms`);
    } catch (error) {
      typesenseError = error;
      console.warn('[Search] Typesense failed, falling back to Firestore:', error);
    }

    // Fall back to Firestore if Typesense fails
    if (!result) {
      result = await searchWithFirestore(params);
      console.log(`[Search] Firestore fallback: ${result.total} results in ${result.searchTime}ms`);
    }

    // Add cache headers
    const response = createSuccessResponse({
      ...result,
      params: {
        ...params,
        typesenseAvailable: !typesenseError
      }
    });

    // Cache for 60 seconds
    response.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

    return response;

  } catch (error) {
    logError('GET /api/search/properties', error);
    return ErrorResponses.databaseError('Property search failed', error);
  }
}

// ============================================
// CITY AUTOCOMPLETE
// ============================================

export async function POST(request: NextRequest) {
  try {
    const { query: searchQuery, state } = await request.json();

    if (!searchQuery || searchQuery.length < 2) {
      return NextResponse.json({ cities: [] });
    }

    const client = getTypesenseSearchClient();

    if (!client) {
      // Fallback: return empty for now (could implement Firestore-based city search)
      return NextResponse.json({ cities: [], engine: 'none' });
    }

    const filterBy = state ? `state:=${state}` : '';

    const result = await client.collections(TYPESENSE_COLLECTIONS.CITIES)
      .documents()
      .search({
        q: searchQuery,
        query_by: 'name',
        filter_by: filterBy,
        sort_by: 'population:desc',
        per_page: 10
      });

    const cities = result.hits?.map(hit => ({
      name: (hit.document as { name: string }).name,
      state: (hit.document as { state: string }).state,
      population: (hit.document as { population: number }).population
    })) || [];

    return NextResponse.json({ cities, engine: 'typesense' });

  } catch (error) {
    logError('POST /api/search/properties', error);
    return NextResponse.json({ cities: [], error: 'City search failed' });
  }
}
