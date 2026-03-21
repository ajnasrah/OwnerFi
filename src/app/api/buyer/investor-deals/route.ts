import { NextRequest, NextResponse } from 'next/server';
import { getTypesenseSearchClient, TYPESENSE_COLLECTIONS } from '@/lib/typesense/client';
import { collection, doc, getDoc, getDocs, query, where, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { requireAuth } from '@/lib/auth-helpers';
import { ErrorResponses, logError } from '@/lib/api-error-handler';

/**
 * INVESTOR DEALS API
 *
 * Returns both owner finance AND cash deals for investors.
 * Merges results from both deal types, supports filtering, sorting, and pagination.
 * Uses Typesense for fast search with Firestore fallback.
 */

// All raw Zillow homeType values that represent land (matches property-transformer.ts HOME_TYPE_MAP)
const LAND_TYPES = new Set(['land', 'lot', 'lots', 'vacant_land', 'farm', 'ranch']);

export interface InvestorDeal {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  imgSrc: string;
  galleryImages?: string[];
  dealType: 'owner_finance' | 'cash_deal';
  /** True when property qualifies as BOTH owner finance AND cash deal
   *  (e.g. GHL outreach confirmed OF + price < 80% Zestimate) */
  qualifiesForBoth?: boolean;
  isLiked: boolean;
  // Owner finance specific
  monthlyPayment?: number;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  interestRate?: number;
  termYears?: number;
  balloonYears?: number;
  // Cash deal specific
  percentOfArv?: number | null;
  discount?: number;
  arv?: number;
  needsWork?: boolean;
  // Land detection
  isLand?: boolean;
  // Common
  yearBuilt?: number;
  propertyType?: string;
  zestimate?: number;
  rentEstimate?: number;
  url?: string;
}

type SortField = 'price' | 'percentOfArv' | 'discount' | 'monthlyPayment';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ('error' in authResult) return authResult.error;
  const { session } = authResult;

  try {
    if (!db) {
      return ErrorResponses.databaseError('Database not available');
    }

    // Parse query params once
    const { searchParams } = new URL(request.url);

    // Admin preview: allow loading a specific buyer's profile by document ID
    const previewBuyerId = searchParams.get('previewBuyerId');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let profile: Record<string, any> | undefined;

    if (previewBuyerId && session.user.role === 'admin') {
      // Admin previewing a specific buyer's investor experience — direct doc read
      const docSnap = await getDoc(doc(db, 'buyerProfiles', previewBuyerId));
      if (docSnap.exists()) {
        profile = docSnap.data();
      }
    } else {
      // Normal flow: load the authenticated user's profile
      const buyerSnapshot = await getDocs(query(
        collection(db, 'buyerProfiles'),
        where('userId', '==', session.user.id)
      ));
      if (!buyerSnapshot.empty) {
        profile = buyerSnapshot.docs[0].data();
      }
    }

    if (!profile) {
      return NextResponse.json({ deals: [], total: 0, message: 'Please complete your profile.' });
    }

    const searchCity = profile.preferredCity || profile.city;
    const searchState = profile.preferredState || profile.state;
    const likedPropertyIds = new Set<string>(profile.likedPropertyIds || profile.likedProperties || []);
    const passedPropertyIds = new Set<string>(profile.passedPropertyIds || profile.passedProperties || []);

    if (!searchCity || !searchState) {
      return NextResponse.json({ deals: [], total: 0, message: 'Please set your preferred location.' });
    }
    const rawDealType = searchParams.get('dealType') || 'all';
    const dealTypeFilter = (['all', 'owner_finance', 'cash_deal'].includes(rawDealType)
      ? rawDealType : 'all') as 'all' | 'owner_finance' | 'cash_deal';
    const rawSortBy = searchParams.get('sortBy') || 'price';
    const sortBy = (['price', 'percentOfArv', 'discount', 'monthlyPayment'].includes(rawSortBy)
      ? rawSortBy : 'price') as SortField;
    const rawSortOrder = searchParams.get('sortOrder') || 'asc';
    const sortOrder = (rawSortOrder === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
    const rawMinPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined;
    const minPrice = rawMinPrice !== undefined && isFinite(rawMinPrice) ? rawMinPrice : undefined;
    const rawMaxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined;
    const maxPrice = rawMaxPrice !== undefined && isFinite(rawMaxPrice) ? rawMaxPrice : undefined;
    const rawMaxArvPercent = searchParams.get('maxArvPercent') ? Number(searchParams.get('maxArvPercent')) : undefined;
    const maxArvPercent = rawMaxArvPercent !== undefined && isFinite(rawMaxArvPercent) ? rawMaxArvPercent : undefined;
    const excludeLand = searchParams.get('excludeLand') === 'true';
    const showHidden = searchParams.get('showHidden') === 'true';
    const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(48, Math.max(1, Number(searchParams.get('pageSize') || '24') || 24));

    // Fetch deals from Typesense (or Firestore fallback)
    let allDeals: InvestorDeal[] = [];
    let typesenseError = null;

    // Use buyer's pre-computed nearby cities for radius-based search
    const nearbyCities = (profile.filter?.nearbyCities?.length > 0)
      ? profile.filter.nearbyCities
      : [searchCity];

    try {
      const client = getTypesenseSearchClient();
      if (client) {
        allDeals = await searchTypesense(client, nearbyCities, searchState, dealTypeFilter, {
          minPrice, maxPrice, maxArvPercent, excludeLand,
        });
      } else {
        throw new Error('Typesense not available');
      }
    } catch (error) {
      typesenseError = error;
      console.warn('[investor-deals] Typesense failed, using Firestore fallback:', error);
    }

    if (typesenseError) {
      allDeals = await searchFirestore(nearbyCities, searchState, dealTypeFilter);
    }

    // Filter by passed status and mark liked properties (O(1) Set lookups)
    allDeals = allDeals
      .filter(deal => showHidden ? passedPropertyIds.has(deal.id) : !passedPropertyIds.has(deal.id))
      .map(deal => ({
        ...deal,
        isLiked: likedPropertyIds.has(deal.id),
      }));

    // Apply client-requested filters (needed for Firestore fallback path;
    // Typesense path pushes these into the query for accuracy)
    if (typesenseError) {
      if (minPrice !== undefined) allDeals = allDeals.filter(d => d.price >= minPrice);
      if (maxPrice !== undefined) allDeals = allDeals.filter(d => d.price <= maxPrice);
      if (maxArvPercent !== undefined) {
        allDeals = allDeals.filter(d =>
          d.percentOfArv !== null && d.percentOfArv !== undefined && d.percentOfArv <= maxArvPercent
        );
      }
      if (excludeLand) {
        allDeals = allDeals.filter(d => !d.isLand);
      }
    }

    // Count by deal type in single pass (before sorting/pagination)
    let ofCount = 0, cdCount = 0;
    for (const d of allDeals) {
      if (d.dealType === 'owner_finance') ofCount++;
      else cdCount++;
    }
    const breakdown = { ownerFinance: ofCount, cashDeal: cdCount, total: allDeals.length };

    // Sort
    allDeals.sort((a, b) => {
      let aVal: number;
      let bVal: number;
      const fallback = sortOrder === 'asc' ? Infinity : -Infinity;

      switch (sortBy) {
        case 'percentOfArv':
          aVal = a.percentOfArv ?? fallback;
          bVal = b.percentOfArv ?? fallback;
          break;
        case 'discount':
          aVal = a.discount ?? fallback;
          bVal = b.discount ?? fallback;
          break;
        case 'monthlyPayment':
          aVal = a.monthlyPayment ?? fallback;
          bVal = b.monthlyPayment ?? fallback;
          break;
        default:
          aVal = a.price;
          bVal = b.price;
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Paginate
    const total = allDeals.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedDeals = allDeals.slice(startIndex, startIndex + pageSize);

    const response = NextResponse.json({
      deals: paginatedDeals,
      total,
      page,
      pageSize,
      totalPages,
      hasMore: startIndex + pageSize < total,
      breakdown,
      searchCriteria: { city: searchCity, state: searchState, radiusMiles: profile.filter?.radiusMiles || 30, nearbyCitiesCount: nearbyCities.length },
    });
    // No browser caching — city is determined server-side from the profile,
    // so the URL doesn't change when the user switches cities.
    // Caching would serve stale deals from the old city.
    response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    return response;

  } catch (error) {
    logError('GET /api/buyer/investor-deals', error);
    return ErrorResponses.databaseError('Failed to load investor deals', error);
  }
}

// ─── Typesense Search ─────────────────────────────────────────────────────────

async function searchTypesense(
  client: ReturnType<typeof getTypesenseSearchClient>,
  nearbyCities: string[],
  state: string,
  dealTypeFilter: 'all' | 'owner_finance' | 'cash_deal',
  extraFilters?: {
    minPrice?: number;
    maxPrice?: number;
    maxArvPercent?: number;
    excludeLand?: boolean;
  },
): Promise<InvestorDeal[]> {
  // Build deal type filter
  let dealTypeClause: string;
  switch (dealTypeFilter) {
    case 'owner_finance':
      dealTypeClause = 'dealType:=[owner_finance, both]';
      break;
    case 'cash_deal':
      dealTypeClause = '(dealType:=[cash_deal, both] || needsWork:=true)';
      break;
    default: // 'all'
      dealTypeClause = '(dealType:=[owner_finance, cash_deal, both] || needsWork:=true)';
  }

  // Build exact city filter from buyer's pre-computed nearby cities
  // Use backtick quoting for Typesense to handle city names with special chars
  const escapedCities = nearbyCities.map(c => '`' + c.replace(/`/g, '') + '`');
  const cityFilter = `city:=[${escapedCities.join(',')}]`;

  const filters = [
    'isActive:=true',
    `state:=${state}`,
    cityFilter,
    dealTypeClause,
  ];

  // Push filters into Typesense query for accurate results and pagination
  if (extraFilters?.excludeLand) {
    filters.push('isLand:=false');
  }
  if (extraFilters?.minPrice !== undefined) {
    filters.push(`listPrice:>=${extraFilters.minPrice}`);
  }
  if (extraFilters?.maxPrice !== undefined) {
    filters.push(`listPrice:<=${extraFilters.maxPrice}`);
  }
  if (extraFilters?.maxArvPercent !== undefined) {
    filters.push(`percentOfArv:<=${extraFilters.maxArvPercent}`);
  }

  if (!client) throw new Error('Typesense client is null');

  // Paginate through Typesense to avoid 250 cap silently dropping results
  const perPage = 250;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allHits: any[] = [];
  let page = 1;

  while (allHits.length < 1000) { // Safety cap at 1000
    const result = await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
      .documents()
      .search({
        q: '*',
        query_by: 'city,address',
        filter_by: filters.join(' && '),
        sort_by: 'listPrice:asc',
        per_page: perPage,
        page,
        include_fields: 'id,address,city,state,zipCode,bedrooms,bathrooms,squareFeet,yearBuilt,listPrice,monthlyPayment,downPaymentAmount,downPaymentPercent,interestRate,termYears,balloonYears,propertyType,primaryImage,galleryImages,dealType,zestimate,rentEstimate,needsWork,percentOfArv,isLand,url,zpid,homeStatus',
      });

    const hits = result.hits || [];
    if (hits.length === 0) break;
    allHits = allHits.concat(hits);
    if (hits.length < perPage) break; // Last page
    page++;
    if (page > 4) break; // Safety: max 4 pages (1000 results)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return allHits.map((hit: any) => {
    const doc = hit.document as Record<string, unknown>;

    // Skip non-FOR_SALE properties (PENDING, SOLD, etc.)
    const homeStatus = ((doc.homeStatus as string) || '').toUpperCase();
    if (homeStatus && homeStatus !== 'FOR_SALE') return null;

    const price = (doc.listPrice as number) || 0;
    const arv = (doc.zestimate as number) || 0;
    // Use pre-indexed percentOfArv if available, otherwise compute (1 decimal place)
    const indexedPercent = doc.percentOfArv as number | undefined;
    const percentOfArv = indexedPercent != null ? Math.round(indexedPercent * 10) / 10 : (arv > 0 ? Math.round((price / arv) * 1000) / 10 : null);
    const discount = arv > 0 ? arv - price : 0;
    const rawDealType = (doc.dealType as string) || 'standard';
    const needsWork = doc.needsWork === true;

    // Determine display deal type
    let dealType: 'owner_finance' | 'cash_deal';
    if (rawDealType === 'both') {
      // 'both' deals: show as whatever the user is filtering for, default to owner_finance
      dealType = dealTypeFilter === 'cash_deal' ? 'cash_deal' : 'owner_finance';
    } else if (rawDealType === 'cash_deal' || needsWork) {
      dealType = 'cash_deal';
    } else if (rawDealType === 'owner_finance') {
      dealType = 'owner_finance';
    } else {
      // 'standard' or unknown: classify based on available data
      // If it has monthly payment data, treat as owner_finance; if it has ARV data or needs work, treat as cash_deal
      if ((doc.monthlyPayment as number) > 0) {
        dealType = 'owner_finance';
      } else if (percentOfArv !== null || needsWork) {
        dealType = 'cash_deal';
      } else {
        dealType = 'owner_finance';
      }
    }

    // For cash deals, skip those without ARV unless they need work
    if (dealType === 'cash_deal' && percentOfArv === null && !needsWork) {
      return null;
    }

    return {
      id: doc.id as string,
      address: (doc.address as string) || '',
      city: (doc.city as string) || '',
      state: (doc.state as string) || '',
      zipCode: (doc.zipCode as string) || '',
      price,
      beds: (doc.bedrooms as number) || 0,
      baths: (doc.bathrooms as number) || 0,
      sqft: (doc.squareFeet as number) || 0,
      imgSrc: (doc.primaryImage as string) || '',
      galleryImages: (doc.galleryImages as string[]) || undefined,
      dealType,
      qualifiesForBoth: rawDealType === 'both' || undefined,
      isLiked: false, // Set later after profile lookup
      // Owner finance (use ?? to preserve 0 as a valid value)
      monthlyPayment: (doc.monthlyPayment as number) ?? undefined,
      downPaymentAmount: (doc.downPaymentAmount as number) ?? undefined,
      downPaymentPercent: (doc.downPaymentPercent as number) ?? undefined,
      interestRate: (doc.interestRate as number) ?? undefined,
      termYears: (doc.termYears as number) ?? undefined,
      balloonYears: (doc.balloonYears as number) ?? undefined,
      // Cash deal
      percentOfArv,
      discount: discount > 0 ? discount : undefined,
      arv: arv > 0 ? arv : undefined,
      needsWork,
      // Land detection
      isLand: doc.isLand === true || LAND_TYPES.has((doc.propertyType as string || '').toLowerCase()),
      // Common
      yearBuilt: (doc.yearBuilt as number) || undefined,
      propertyType: (doc.propertyType as string) || undefined,
      zestimate: arv > 0 ? arv : undefined,
      rentEstimate: (doc.rentEstimate as number) || undefined,
      url: (doc.url as string) || (doc.zpid ? `https://www.zillow.com/homedetails/${doc.zpid}_zpid/` : undefined) || undefined,
    } as InvestorDeal;
  }).filter(Boolean) as InvestorDeal[];
}

// ─── Firestore Fallback ───────────────────────────────────────────────────────

async function searchFirestore(
  nearbyCities: string[],
  state: string,
  dealTypeFilter: 'all' | 'owner_finance' | 'cash_deal',
): Promise<InvestorDeal[]> {
  if (!db) return [];

  try {
    const queries = [];

    // Owner finance query
    if (dealTypeFilter !== 'cash_deal') {
      queries.push(
        getDocs(query(
          collection(db, 'properties'),
          where('isActive', '==', true),
          where('isOwnerfinance', '==', true),
          where('state', '==', state),
          firestoreLimit(200)
        ))
      );
    }

    // Cash deals query
    if (dealTypeFilter !== 'owner_finance') {
      queries.push(
        getDocs(query(
          collection(db, 'properties'),
          where('isActive', '==', true),
          where('isCashDeal', '==', true),
          where('state', '==', state),
          firestoreLimit(200)
        ))
      );
      // Also get needs-work properties
      queries.push(
        getDocs(query(
          collection(db, 'properties'),
          where('isActive', '==', true),
          where('needsWork', '==', true),
          where('state', '==', state),
          firestoreLimit(200)
        ))
      );
    }

    const snapshots = await Promise.all(queries);

    // Merge and dedupe
    const seenIds = new Set<string>();
    const deals: InvestorDeal[] = [];
    const nearbyCitiesSet = new Set(nearbyCities.map(c => c.toLowerCase().trim()));

    for (const snapshot of snapshots) {
      for (const doc of snapshot.docs) {
        if (seenIds.has(doc.id)) continue;
        seenIds.add(doc.id);

        const data = doc.data();

        // Skip non-FOR_SALE properties (PENDING, SOLD, FOR_RENT, etc.)
        const homeStatus = ((data.homeStatus as string) || '').toUpperCase();
        if (homeStatus && homeStatus !== 'FOR_SALE') continue;

        const price = (data.price as number) || (data.listPrice as number) || 0;
        const arv = (data.estimate as number) || (data.zestimate as number) || 0;
        const percentOfArv = arv > 0 ? Math.round((price / arv) * 1000) / 10 : null;
        const discount = arv > 0 ? arv - price : 0;
        const needsWork = data.needsWork === true;
        const isOwnerfinance = data.isOwnerfinance === true;

        // Filter by nearby cities (case-insensitive match against buyer's pre-computed list)
        const propCity = ((data.city as string) || '').toLowerCase().trim();
        if (!nearbyCitiesSet.has(propCity)) {
          continue;
        }

        const isCashDeal = data.isCashDeal === true;
        let dealType: 'owner_finance' | 'cash_deal';
        if (isOwnerfinance && isCashDeal) {
          // 'both' — show based on filter preference
          dealType = dealTypeFilter === 'cash_deal' ? 'cash_deal' : 'owner_finance';
        } else if (isOwnerfinance) {
          dealType = 'owner_finance';
        } else if (isCashDeal || needsWork) {
          dealType = 'cash_deal';
        } else if ((data.monthlyPayment as number) > 0) {
          dealType = 'owner_finance';
        } else if (percentOfArv !== null || needsWork) {
          dealType = 'cash_deal';
        } else {
          dealType = 'owner_finance';
        }

        // Skip cash deals without ARV unless they need work (matches Typesense logic)
        if (dealType === 'cash_deal' && percentOfArv === null && !needsWork) {
          continue;
        }

        deals.push({
          id: doc.id,
          address: (data.streetAddress as string) || (data.address as string) || '',
          city: (data.city as string) || '',
          state: (data.state as string) || '',
          zipCode: (data.zipCode as string) || (data.zipcode as string) || '',
          price,
          beds: (data.bedrooms as number) || 0,
          baths: (data.bathrooms as number) || 0,
          sqft: (data.squareFoot as number) || (data.squareFeet as number) || 0,
          imgSrc: (data.primaryImage as string) || (data.firstPropertyImage as string) || (data.hiResImageLink as string) || (data.mediumImageLink as string) || (data.imgSrc as string) || (data.imageUrl as string) || '',
          galleryImages: (data.propertyImages as string[]) || (data.imageUrls as string[]) || undefined,
          dealType,
          isLiked: false,
          monthlyPayment: (data.monthlyPayment as number) ?? undefined,
          downPaymentAmount: (data.downPaymentAmount as number) ?? undefined,
          downPaymentPercent: (data.downPaymentPercent as number) ?? undefined,
          interestRate: (data.interestRate as number) ?? undefined,
          termYears: (data.termYears as number) ?? (data.loanTermYears as number) ?? undefined,
          balloonYears: (data.balloonYears as number) ?? undefined,
          percentOfArv,
          discount: discount > 0 ? discount : undefined,
          arv: arv > 0 ? arv : undefined,
          needsWork,
          isLand: data.isLand === true || LAND_TYPES.has(((data.homeType as string) || (data.propertyType as string) || '').toLowerCase()),
          yearBuilt: (data.yearBuilt as number) || undefined,
          propertyType: (data.homeType as string) || (data.propertyType as string) || undefined,
          zestimate: arv > 0 ? arv : undefined,
          rentEstimate: (data.rentEstimate as number) || undefined,
          url: ((data.url as string)?.startsWith('http') ? data.url as string : data.url ? `https://www.zillow.com${data.url}` : undefined)
            || (data.hdpUrl ? `https://www.zillow.com${data.hdpUrl}` : undefined)
            || undefined,
        });
      }
    }

    deals.sort((a, b) => a.price - b.price);
    return deals;

  } catch (error) {
    console.error('[investor-deals] Firestore query failed:', error);
    return [];
  }
}
