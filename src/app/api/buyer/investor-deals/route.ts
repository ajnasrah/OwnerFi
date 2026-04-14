import { NextRequest, NextResponse } from 'next/server';
import { getTypesenseSearchClient, TYPESENSE_COLLECTIONS } from '@/lib/typesense/client';
import { collection, doc, getDoc, getDocs, query, where, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { requireAuth } from '@/lib/auth-helpers';
import { ErrorResponses, logError } from '@/lib/api-error-handler';
import { getCitiesWithinRadiusWithExpansion, getCitiesWithinRadiusComprehensive } from '@/lib/comprehensive-cities';
import { getUserFilter } from '@/lib/filter-store';
import { FilterConfig } from '@/lib/filter-schema';

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
  // Distressed-listing flags — price is NOT a standard asking price
  // (auction opening bid, foreclosure filing price, REO estimate).
  // UI renders "Est." prefix and a badge when any is true.
  isAuction?: boolean;
  isForeclosure?: boolean;
  isBankOwned?: boolean;
  listingSubType?: string;
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

    // Load the user's FilterConfig (locations + zips). userFilters is keyed by
    // auth userId; for admin preview, use the target profile's userId so admins
    // see the filter the buyer actually has.
    const filterUserId: string | undefined =
      previewBuyerId && session.user.role === 'admin'
        ? (profile.userId as string | undefined)
        : session.user.id;
    const userFilter: FilterConfig = filterUserId
      ? await getUserFilter(filterUserId)
      : { locations: [], zips: { mode: 'off', codes: [] } };
    const useNewFilter = userFilter.locations.length > 0 || userFilter.zips.codes.length > 0;

    if (!useNewFilter && (!searchCity || !searchState)) {
      return NextResponse.json({ deals: [], total: 0, message: 'Please set your preferred location.' });
    }
    // URL params override FilterConfig (inline chips are session overrides).
    // If no URL param, fall back to FilterConfig value. If neither, use default.
    const qpDealType = searchParams.get('dealType');
    const dealTypeFilter = (
      qpDealType && ['all', 'owner_finance', 'cash_deal'].includes(qpDealType)
        ? qpDealType
        : userFilter.dealType ?? 'all'
    ) as 'all' | 'owner_finance' | 'cash_deal';

    const rawSortBy = searchParams.get('sortBy') || 'price';
    const sortBy = (['price', 'percentOfArv', 'discount', 'monthlyPayment'].includes(rawSortBy)
      ? rawSortBy : 'price') as SortField;
    const rawSortOrder = searchParams.get('sortOrder') || 'asc';
    const sortOrder = (rawSortOrder === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';

    const readNumQP = (key: string): number | undefined => {
      const v = searchParams.get(key);
      if (v === null || v === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const minPrice = readNumQP('minPrice') ?? userFilter.price?.min;
    const maxPrice = readNumQP('maxPrice') ?? userFilter.price?.max;
    const maxArvPercent = readNumQP('maxArvPercent') ?? userFilter.maxArvPercent;
    const minBeds = readNumQP('minBeds') ?? userFilter.beds;
    const minBaths = readNumQP('minBaths') ?? userFilter.baths;
    const minSqft = readNumQP('minSqft') ?? userFilter.sqft?.min;
    const maxSqft = readNumQP('maxSqft') ?? userFilter.sqft?.max;

    const qpExcludeLand = searchParams.get('excludeLand');
    const excludeLand = qpExcludeLand !== null
      ? qpExcludeLand === 'true'
      : (userFilter.excludeLand ?? false);

    const showHidden = searchParams.get('showHidden') === 'true';
    const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(48, Math.max(1, Number(searchParams.get('pageSize') || '24') || 24));

    // Fetch ALL deals from Typesense (or Firestore fallback) regardless of dealType filter
    // so breakdown counts are always accurate and consistent across filter tabs
    let allDeals: InvestorDeal[] = [];
    let typesenseError = null;

    // Compute nearbyCities/allowedStates — either from new FilterConfig locations
    // (union of per-city radii) or from legacy profile.filter.nearbyCities.
    let nearbyCities: string[] = [];
    let allowedStates: string[] = [];

    if (useNewFilter && userFilter.locations.length > 0) {
      const citySet = new Set<string>();
      const stateSet = new Set<string>();
      for (const loc of userFilter.locations) {
        const cities = getCitiesWithinRadiusComprehensive(loc.city, loc.state, loc.radiusMiles);
        citySet.add(loc.city);
        stateSet.add(loc.state);
        for (const c of cities) {
          citySet.add(c.name);
          stateSet.add(c.state);
        }
      }
      nearbyCities = [...citySet];
      allowedStates = [...stateSet];
      console.log(`✅ [investor-deals] FilterConfig: ${userFilter.locations.length} locations → ${nearbyCities.length} cities, states: [${allowedStates.join(', ')}], zips: ${userFilter.zips.mode} (${userFilter.zips.codes.length})`);
    } else if (profile.filter?.nearbyCities?.length > 0) {
      nearbyCities = profile.filter.nearbyCities;
      if (profile.filter.nearbyStates?.length > 0) {
        allowedStates = profile.filter.nearbyStates;
      } else {
        const citiesWithState = getCitiesWithinRadiusComprehensive(searchCity, searchState, profile.filter.radiusMiles || 30);
        allowedStates = [...new Set(citiesWithState.map(c => c.state))];
        if (allowedStates.length === 0) allowedStates = [searchState];
      }
      console.log(`✅ [investor-deals] Legacy stored filter: ${nearbyCities.length} cities, states: [${allowedStates.join(', ')}]`);
    } else if (searchCity && searchState) {
      const { cities: nearbyCitiesList, radiusUsed } = getCitiesWithinRadiusWithExpansion(searchCity, searchState, 30, 5);
      nearbyCities = nearbyCitiesList.map(city => city.name);
      allowedStates = [...new Set(nearbyCitiesList.map(city => city.state))];
      if (allowedStates.length === 0) allowedStates = [searchState];
      console.log(`⚠️  [investor-deals] Legacy on-the-fly: ${nearbyCities.length} cities (radius: ${radiusUsed}mi)`);
    }

    // Precedence: if zips.include has codes, those zips are THE search set
    // (cities ignored). Otherwise search cities. Exclude zips still subtract
    // from whatever the base set is.
    const zipsOverride = userFilter.zips.mode === 'include' && userFilter.zips.codes.length > 0;

    try {
      const client = getTypesenseSearchClient();
      if (client) {
        if (zipsOverride) {
          // Zip-only mode — cities are ignored entirely.
          allDeals = await searchTypesenseByZips(client, userFilter.zips.codes, {
            minPrice, maxPrice, maxArvPercent, excludeLand,
          });
        } else if (nearbyCities.length > 0) {
          allDeals = await searchTypesense(client, nearbyCities, allowedStates, 'all', {
            minPrice, maxPrice, maxArvPercent, excludeLand,
          });
        }
      } else {
        throw new Error('Typesense not available');
      }
    } catch (error) {
      typesenseError = error;
      console.warn('[investor-deals] Typesense failed, using Firestore fallback:', error);
    }

    if (typesenseError) {
      // In zip-override mode the Firestore fallback can't honor a nationwide
      // zip query (it searches by city), so we'd rather return empty than
      // leak the legacy city results.
      if (zipsOverride) {
        allDeals = [];
      } else {
        allDeals = await searchFirestore(nearbyCities, allowedStates, 'all');
      }
    }

    // Apply include-zip filter as a safety net. Typesense usually enforces it
    // via filter_by, but if the hit comes back from the Firestore fallback or
    // any future code path that bypasses the zip query, we still clamp here.
    if (zipsOverride) {
      const includeSet = new Set(userFilter.zips.codes);
      allDeals = allDeals.filter(d => includeSet.has(d.zipCode));
    }

    // Apply exclude-zip filter (zip codes user wants cut out)
    if (userFilter.zips.mode === 'exclude' && userFilter.zips.codes.length > 0) {
      const excludeSet = new Set(userFilter.zips.codes);
      allDeals = allDeals.filter(d => !excludeSet.has(d.zipCode));
    }

    // Filter by passed status and mark liked properties (O(1) Set lookups)
    allDeals = allDeals
      .filter(deal => showHidden ? passedPropertyIds.has(deal.id) : !passedPropertyIds.has(deal.id))
      .map(deal => ({
        ...deal,
        isLiked: likedPropertyIds.has(deal.id),
      }));

    // Apply client-requested filters
    // Price filters pushed to Typesense query, but needed for Firestore fallback
    if (typesenseError) {
      if (minPrice !== undefined) allDeals = allDeals.filter(d => d.price >= minPrice);
      if (maxPrice !== undefined) allDeals = allDeals.filter(d => d.price <= maxPrice);
    }
    // Land filter applied ALWAYS (not just Firestore fallback) because some land properties
    // lack isLand:true in Typesense but get detected via LAND_TYPES propertyType fallback
    if (excludeLand) {
      allDeals = allDeals.filter(d => !d.isLand);
    }
    // ARV filter always applied client-side (percentOfArv is optional in Typesense,
    // filtering at query level would exclude properties missing the field entirely)
    if (maxArvPercent !== undefined) {
      allDeals = allDeals.filter(d =>
        d.percentOfArv !== null && d.percentOfArv !== undefined && d.percentOfArv <= maxArvPercent
      );
    }
    // Bed/bath/sqft minimums — always post-filter (fast, and handles hits that
    // came from zip-override path which doesn't push these to Typesense).
    if (minBeds !== undefined && minBeds > 0) {
      allDeals = allDeals.filter(d => (d.beds ?? 0) >= minBeds);
    }
    if (minBaths !== undefined && minBaths > 0) {
      allDeals = allDeals.filter(d => (d.baths ?? 0) >= minBaths);
    }
    if (minSqft !== undefined && minSqft > 0) {
      allDeals = allDeals.filter(d => (d.sqft ?? 0) >= minSqft);
    }
    if (maxSqft !== undefined && maxSqft > 0) {
      allDeals = allDeals.filter(d => (d.sqft ?? Infinity) <= maxSqft);
    }

    // Count breakdown by actual qualification (before dealType filtering)
    // Properties qualifying for both are counted in BOTH categories
    let ofCount = 0, cdCount = 0;
    for (const d of allDeals) {
      if (d.qualifiesForBoth) {
        ofCount++;
        cdCount++;
      } else if (d.dealType === 'owner_finance') {
        ofCount++;
      } else {
        cdCount++;
      }
    }
    const breakdown = { ownerFinance: ofCount, cashDeal: cdCount, total: allDeals.length };

    // Now filter by deal type for display
    if (dealTypeFilter === 'owner_finance') {
      allDeals = allDeals.filter(d => d.dealType === 'owner_finance' || d.qualifiesForBoth);
    } else if (dealTypeFilter === 'cash_deal') {
      allDeals = allDeals.filter(d => d.dealType === 'cash_deal' || d.qualifiesForBoth);
      // Reassign display dealType for "both" properties when viewing cash deals
      allDeals = allDeals.map(d => d.qualifiesForBoth ? { ...d, dealType: 'cash_deal' as const } : d);
    }

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

    // When zips are in play, include a per-zip hit count so the UI (and
    // debugging) can see which zips returned deals and which were empty.
    let zipHitCounts: Record<string, number> | undefined;
    if (userFilter.zips.codes.length > 0) {
      zipHitCounts = Object.fromEntries(userFilter.zips.codes.map(z => [z, 0]));
      for (const d of allDeals) {
        if (d.zipCode && zipHitCounts[d.zipCode] !== undefined) {
          zipHitCounts[d.zipCode]++;
        }
      }
    }

    const response = NextResponse.json({
      deals: paginatedDeals,
      total,
      page,
      pageSize,
      totalPages,
      hasMore: startIndex + pageSize < total,
      breakdown,
      searchCriteria: {
        city: searchCity,
        state: searchState,
        allowedStates,
        radiusMiles: profile.filter?.radiusMiles || 30,
        nearbyCitiesCount: nearbyCities.length,
        filterMode: zipsOverride ? 'zips-override' : (userFilter.locations.length > 0 ? 'new-locations' : 'legacy'),
        zipHitCounts,
      },
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
  allowedStates: string[],
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

  // State filter prevents city-name collisions across states (e.g. "Trenton" exists in
  // TN, GA, NJ — without this, a Memphis buyer would see Trenton GA properties).
  // allowedStates is derived from the radius calculation and supports multi-state metros
  // (e.g. Memphis → [TN, AR, MS]).
  const stateFilter = `state:=[${allowedStates.join(',')}]`;

  const filters = [
    'isActive:=true',
    cityFilter,
    stateFilter,
    dealTypeClause,
  ];

  return runTypesenseSearch(client, filters, dealTypeFilter, extraFilters);
}

/**
 * Search Typesense by an explicit zip-code list. Used for FilterConfig
 * zips.include — zips can be anywhere in the US, so we bypass city/state.
 */
async function searchTypesenseByZips(
  client: ReturnType<typeof getTypesenseSearchClient>,
  zipCodes: string[],
  extraFilters?: {
    minPrice?: number;
    maxPrice?: number;
    maxArvPercent?: number;
    excludeLand?: boolean;
  },
): Promise<InvestorDeal[]> {
  if (!client) throw new Error('Typesense client is null');
  if (zipCodes.length === 0) return [];

  // Zips are 5-digit numerics — no backtick escaping needed, and backticks can
  // trip Typesense's filter parser for pure-numeric string fields. Values are
  // already validated by normalizeFilterConfig → ZIP_RE.
  const zipFilter = `zipCode:=[${zipCodes.join(',')}]`;
  const dealTypeClause = '(dealType:=[owner_finance, cash_deal, both] || needsWork:=true)';
  const filters = ['isActive:=true', zipFilter, dealTypeClause];
  return runTypesenseSearch(client, filters, 'all', extraFilters);
}

/**
 * Shared paginated Typesense fetch + hit-to-InvestorDeal mapping.
 */
async function runTypesenseSearch(
  client: ReturnType<typeof getTypesenseSearchClient>,
  baseFilters: string[],
  dealTypeFilter: 'all' | 'owner_finance' | 'cash_deal',
  extraFilters?: {
    minPrice?: number;
    maxPrice?: number;
    maxArvPercent?: number;
    excludeLand?: boolean;
  },
): Promise<InvestorDeal[]> {
  const filters = [...baseFilters];

  // Push filters into Typesense query for accurate results and pagination
  // NOTE: For optional boolean fields, use !=true instead of =false
  // because =false excludes documents where the field is missing/null
  if (extraFilters?.excludeLand) {
    filters.push('isLand:!=true');
  }
  if (extraFilters?.minPrice !== undefined) {
    filters.push(`listPrice:>=${extraFilters.minPrice}`);
  }
  if (extraFilters?.maxPrice !== undefined) {
    filters.push(`listPrice:<=${extraFilters.maxPrice}`);
  }
  // NOTE: percentOfArv is optional — only filter when user explicitly selects <80% Zest.
  // Properties without percentOfArv will be excluded, which is correct behavior
  // (no ARV data = can't confirm it's a deal). Keep as client-side post-filter
  // to avoid dropping properties that have ARV in Firestore but not yet in Typesense.

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
        include_fields: 'id,address,city,state,zipCode,bedrooms,bathrooms,squareFeet,yearBuilt,listPrice,monthlyPayment,downPaymentAmount,downPaymentPercent,interestRate,termYears,balloonYears,propertyType,primaryImage,galleryImages,dealType,zestimate,rentEstimate,needsWork,percentOfArv,isLand,isAuction,isForeclosure,isBankOwned,listingSubType,url,zpid,homeStatus',
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

    // Skip non-FOR_SALE properties (PENDING, SOLD, etc.).
    // Auction / foreclosure / pre-foreclosure stay visible — the UI labels
    // them with a badge + "Est." price prefix so investors see them as deals.
    const ALLOWED_STATUSES_INVESTOR = new Set([
      'FOR_SALE', 'FOR_AUCTION', 'FORECLOSURE', 'FORECLOSED', 'PRE_FORECLOSURE',
    ]);
    const homeStatus = ((doc.homeStatus as string) || '').toUpperCase();
    if (homeStatus && !ALLOWED_STATUSES_INVESTOR.has(homeStatus)) return null;

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
      // Distressed-listing flags
      isAuction: doc.isAuction === true || undefined,
      isForeclosure: doc.isForeclosure === true || undefined,
      isBankOwned: doc.isBankOwned === true || undefined,
      listingSubType: (doc.listingSubType as string) || undefined,
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
  allowedStates: string[],
  _dealTypeFilter: 'all' | 'owner_finance' | 'cash_deal',
): Promise<InvestorDeal[]> {
  if (!db) return [];

  try {
    const queries = [];

    // Always fetch all deal types for accurate breakdown counts
    // NOTE: Firestore queries don't filter by state (no composite index). State filtering
    // is applied in the city+state check below (line ~530) using allowedStatesSet.
    queries.push(
      getDocs(query(
        collection(db, 'properties'),
        where('isActive', '==', true),
        where('isOwnerfinance', '==', true),
        firestoreLimit(200)
      ))
    );

    // Cash deals query
    {
      queries.push(
        getDocs(query(
          collection(db, 'properties'),
          where('isActive', '==', true),
          where('isCashDeal', '==', true),
          firestoreLimit(200)
        ))
      );
      // Also get needs-work properties
      queries.push(
        getDocs(query(
          collection(db, 'properties'),
          where('isActive', '==', true),
          where('needsWork', '==', true),
          firestoreLimit(200)
        ))
      );
    }

    const snapshots = await Promise.all(queries);

    // Merge and dedupe
    const seenIds = new Set<string>();
    const deals: InvestorDeal[] = [];
    const nearbyCitiesSet = new Set(nearbyCities.map(c => c.toLowerCase().trim()));
    const allowedStatesSet = new Set(allowedStates.map(s => s.toUpperCase()));

    for (const snapshot of snapshots) {
      for (const doc of snapshot.docs) {
        if (seenIds.has(doc.id)) continue;
        seenIds.add(doc.id);

        const data = doc.data();

        // Skip non-FOR_SALE properties (PENDING, SOLD, FOR_RENT, etc.).
        // Auction / foreclosure / pre-foreclosure stay visible — UI labels
        // them with a badge + "Est." price prefix.
        const ALLOWED_STATUSES_INVESTOR_FS = new Set([
          'FOR_SALE', 'FOR_AUCTION', 'FORECLOSURE', 'FORECLOSED', 'PRE_FORECLOSURE',
        ]);
        const homeStatus = ((data.homeStatus as string) || '').toUpperCase();
        if (homeStatus && !ALLOWED_STATUSES_INVESTOR_FS.has(homeStatus)) continue;

        const price = (data.price as number) || (data.listPrice as number) || 0;
        const arv = (data.estimate as number) || (data.zestimate as number) || 0;
        const percentOfArv = arv > 0 ? Math.round((price / arv) * 1000) / 10 : null;
        const discount = arv > 0 ? arv - price : 0;
        const needsWork = data.needsWork === true;
        const isOwnerfinance = data.isOwnerfinance === true;

        // Filter by nearby cities AND allowed states to prevent city-name collisions
        // (e.g. "Trenton" in TN vs GA)
        const propCity = ((data.city as string) || '').toLowerCase().trim();
        const propState = ((data.state as string) || '').toUpperCase().trim();
        if (!nearbyCitiesSet.has(propCity) || !allowedStatesSet.has(propState)) {
          continue;
        }

        const isCashDeal = data.isCashDeal === true;
        const qualifiesForBoth = isOwnerfinance && isCashDeal;
        let dealType: 'owner_finance' | 'cash_deal';
        if (qualifiesForBoth) {
          // 'both' — default display as owner_finance (filter reassignment happens in caller)
          dealType = 'owner_finance';
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
          imgSrc: (data.primaryImage as string) || (data.firstPropertyImage as string) || (data.hiResImageLink as string) || (data.mediumImageLink as string) || (data.imgSrc as string) || (data.imageUrl as string) || ((data.propertyImages as string[]) || [])[0] || '',
          galleryImages: (data.propertyImages as string[]) || (data.imageUrls as string[]) || undefined,
          dealType,
          qualifiesForBoth: qualifiesForBoth || undefined,
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
          isAuction: data.isAuction === true || undefined,
          isForeclosure: data.isForeclosure === true || undefined,
          isBankOwned: data.isBankOwned === true || undefined,
          listingSubType: (data.listingSubType as string) || undefined,
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
