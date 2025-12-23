import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getTypesenseSearchClient, TYPESENSE_COLLECTIONS } from '@/lib/typesense/client';
import { getCitiesWithinRadiusComprehensive, getCityCoordinatesComprehensive } from '@/lib/comprehensive-cities';

// Cache for states list (refresh every 5 minutes)
let statesCache: { states: string[]; timestamp: number } | null = null;
const STATES_CACHE_TTL = 5 * 60 * 1000;

// Cache for deals data (refresh every 5 minutes - increased from 2min for better performance)
interface NormalizedProperty {
  id: string;
  address: string;
  streetAddress: string;
  city: string;
  state: string;
  zipcode: string;
  latitude: number | null;
  longitude: number | null;
  price: number;
  arv: number;
  percentOfArv: number | null;
  discount: number | null;
  beds: number;
  baths: number;
  sqft: number;
  imgSrc: string;
  url: string;
  zpid: string;
  source: string;
  status?: string;
  addedAt?: unknown;
  ownerFinanceVerified?: boolean;
  matchedKeywords?: string[];
  financingType?: string;
  description?: string;
  monthlyPayment?: number;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  interestRate?: number;
  termYears?: number;
  balloonYears?: number;
  rentEstimate: number;
  annualTax: number;
  monthlyHoa: number;
  missingFields: string[];
  cashFlow: unknown;
  sentToGHL: unknown;
}

interface DealsCache {
  data: NormalizedProperty[];
  timestamp: number;
  key: string;
}
let dealsCache: DealsCache | null = null;
const DEALS_CACHE_TTL = 5 * 60 * 1000;

// Calculate distance between two points using Haversine formula (returns miles)
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate monthly mortgage payment
// Formula: P = L[c(1+c)^n]/[(1+c)^n-1]
function calculateMonthlyMortgage(loanAmount: number, annualRate: number, years: number): number {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  if (monthlyRate === 0) return loanAmount / numPayments;
  const x = Math.pow(1 + monthlyRate, numPayments);
  return loanAmount * (monthlyRate * x) / (x - 1);
}

// Calculate cash flow analysis
// Uses standard real estate investor assumptions
function calculateCashFlow(price: number, rentEstimate: number, annualTax: number, monthlyHoa: number, useEstimatedTax: boolean = false) {
  // Financing assumptions
  const DOWN_PAYMENT_PERCENT = 0.10; // 10% down
  const CLOSING_COSTS_PERCENT = 0.03; // 3% closing costs
  const INTEREST_RATE = 0.06; // 6% annual
  const LOAN_TERM_YEARS = 20;

  // Operating expense rates
  const INSURANCE_RATE = 0.01; // 1% of price annually
  const PROPERTY_MGMT_RATE = 0.10; // 10% of rent
  const VACANCY_RATE = 0.08; // 8% vacancy allowance
  const MAINTENANCE_RATE = 0.05; // 5% of rent for repairs
  const CAPEX_RATE = 0.05; // 5% of rent for capital expenditures (roof, HVAC, etc)

  // Estimate tax as 1.2% of price if not provided (US average is ~1.1%)
  const ESTIMATED_TAX_RATE = 0.012;

  // Use estimated tax if actual tax is missing
  const effectiveTax = annualTax > 0 ? annualTax : (useEstimatedTax ? price * ESTIMATED_TAX_RATE : 0);

  // Investment calculation (includes closing costs for accurate CoC)
  const downPayment = price * DOWN_PAYMENT_PERCENT;
  const closingCosts = price * CLOSING_COSTS_PERCENT;
  const totalInvestment = downPayment + closingCosts;

  const loanAmount = price - downPayment;

  // Monthly calculations
  const monthlyMortgage = calculateMonthlyMortgage(loanAmount, INTEREST_RATE, LOAN_TERM_YEARS);
  const monthlyInsurance = (price * INSURANCE_RATE) / 12;
  const monthlyTax = effectiveTax / 12;
  const monthlyMgmt = rentEstimate * PROPERTY_MGMT_RATE;

  // Additional operating expenses that investors always account for
  const monthlyVacancy = rentEstimate * VACANCY_RATE;
  const monthlyMaintenance = rentEstimate * MAINTENANCE_RATE;
  const monthlyCapex = rentEstimate * CAPEX_RATE;

  // Total monthly expenses
  const monthlyExpenses = monthlyMortgage + monthlyInsurance + monthlyTax + monthlyHoa + monthlyMgmt + monthlyVacancy + monthlyMaintenance + monthlyCapex;

  // Monthly cash flow
  const monthlyCashFlow = rentEstimate - monthlyExpenses;

  // Annual cash flow
  const annualCashFlow = monthlyCashFlow * 12;

  // CoC uses total investment (down payment + closing costs)
  const cocReturn = totalInvestment > 0 ? (annualCashFlow / totalInvestment) * 100 : 0;

  return {
    downPayment: Math.round(downPayment),
    totalInvestment: Math.round(totalInvestment),
    monthlyMortgage: Math.round(monthlyMortgage),
    monthlyInsurance: Math.round(monthlyInsurance),
    monthlyTax: Math.round(monthlyTax),
    monthlyHoa: Math.round(monthlyHoa),
    monthlyMgmt: Math.round(monthlyMgmt),
    monthlyExpenses: Math.round(monthlyExpenses),
    monthlyCashFlow: Math.round(monthlyCashFlow),
    annualCashFlow: Math.round(annualCashFlow),
    cocReturn: Math.round(cocReturn * 10) / 10, // 1 decimal place
    usedEstimatedTax: useEstimatedTax,
  };
}

// Normalize data from different collections to a common format
function normalizeProperty(doc: FirebaseFirestore.DocumentSnapshot, source: string): NormalizedProperty {
  const data = doc.data() || {};

  // Calculate percentOfArv if not present
  const price = data.price || data.listPrice || 0;
  const arv = data.arv || data.estimate || data.zestimate || 0;
  // Use stored percentOfArv, or calculate from ARV if available, otherwise null (not 100!)
  const percentOfArv = data.percentOfArv ?? (arv > 0 ? Math.round((price / arv) * 100 * 10) / 10 : null);
  const discount = data.discount ?? (arv > 0 ? Math.round((1 - price / arv) * 100 * 10) / 10 : null);

  // Cash flow inputs - check multiple field names
  const rentEstimate = data.rentEstimate || data.rentalEstimate || data.rentZestimate || data.rentCastEstimate || 0;
  const annualTax = data.annualTaxAmount || data.taxAmount || 0;
  const monthlyHoa = data.hoa || data.hoaFees || 0;

  // Track missing fields for warnings
  const missingFields: string[] = [];
  if (!rentEstimate) missingFields.push('rent');
  if (!annualTax) missingFields.push('tax');

  // Use stored cashFlow if available (from backfill), otherwise calculate on-the-fly
  let cashFlowData = data.cashFlow || null;
  if (!cashFlowData && price > 0 && rentEstimate > 0) {
    // Fallback: calculate if not stored
    const useEstimatedTax = !annualTax;
    cashFlowData = calculateCashFlow(price, rentEstimate, annualTax, monthlyHoa, useEstimatedTax);
  }

  // Extract just the street address (remove city, state, zip if included)
  const rawAddress = data.streetAddress || data.address || '';
  const streetOnly = rawAddress.includes(',') ? rawAddress.split(',')[0].trim() : rawAddress;

  return {
    id: doc.id,
    // Address fields - use street only to avoid duplication with city/state columns
    address: streetOnly || `${data.city}, ${data.state}`,
    streetAddress: streetOnly,
    city: data.city,
    state: data.state,
    zipcode: data.zipCode || data.zipcode,
    // Coordinates for geo search
    latitude: data.latitude || data.lat || null,
    longitude: data.longitude || data.lng || null,
    // Price fields
    price,
    arv,
    percentOfArv,
    discount,
    // Property details
    beds: data.beds || data.bedrooms,
    baths: data.baths || data.bathrooms,
    sqft: data.sqft || data.squareFoot,
    // Images
    imgSrc: data.primaryImage || data.imgSrc || data.firstPropertyImage || data.imageUrl || (data.imageUrls?.[0]),
    // Metadata
    // Extract zpid from doc.id (format: "zpid_12345" or just "12345")
    url: data.url || data.hdpUrl || `https://www.zillow.com/homedetails/${doc.id.replace('zpid_', '')}_zpid/`,
    zpid: data.zpid || doc.id,
    source: data.source || source,
    status: data.status || data.homeStatus,
    addedAt: data.addedAt || data.importedAt || data.scrapedAt,
    // Owner finance fields
    ownerFinanceVerified: data.ownerFinanceVerified,
    matchedKeywords: data.matchedKeywords,
    financingType: data.financingType,
    description: data.description,
    // Owner finance terms (the seller's actual terms)
    monthlyPayment: data.monthlyPayment,
    downPaymentAmount: data.downPaymentAmount,
    downPaymentPercent: data.downPaymentPercent,
    interestRate: data.interestRate,
    termYears: data.termYears,
    balloonYears: data.balloonYears,
    // Cash flow fields
    rentEstimate,
    annualTax,
    monthlyHoa,
    missingFields,
    cashFlow: cashFlowData,
    // GHL tracking
    sentToGHL: data.sentToGHL || null,
  };
}

// Try Typesense search first (fast)
async function searchWithTypesense(params: {
  city?: string;
  state?: string;
  radius?: number;
  sortBy: string;
  sortOrder: string;
  limit: number;
  collection?: string;
}): Promise<{ deals: NormalizedProperty[]; states: string[] } | null> {
  const client = getTypesenseSearchClient();
  if (!client) return null;

  try {
    const filters: string[] = ['isActive:=true'];

    // Geo search if city + radius provided
    if (params.city && params.radius && params.radius > 0) {
      const centerCoords = getCityCoordinatesComprehensive(params.city, params.state || '');
      if (centerCoords) {
        // Use Typesense geo filter - much faster than Firestore
        filters.push(`location:(${centerCoords.lat}, ${centerCoords.lng}, ${params.radius} mi)`);
        // Don't filter by state when doing radius search (for tri-state areas)
      } else if (params.state) {
        // No coordinates found, fall back to state filter
        filters.push(`state:=${params.state}`);
      }
    } else if (params.state) {
      // No radius, just filter by state
      filters.push(`state:=${params.state}`);
    }

    // Deal type filter based on collection
    if (params.collection === 'cash_houses') {
      filters.push('dealType:=[cash_deal, both]');
    } else if (params.collection === 'zillow_imports') {
      filters.push('dealType:=[owner_finance, both]');
    }
    // No collection filter = show all deal types

    // Map sort fields
    const sortFieldMap: Record<string, string> = {
      'percentOfArv': 'listPrice:asc', // Approximate - sort by price
      'price': 'listPrice',
      'discount': 'listPrice:asc',
      'rentEstimate': 'listPrice:asc',
    };
    const sortField = sortFieldMap[params.sortBy] || 'listPrice:asc';
    const sortDirection = params.sortOrder === 'desc' ? ':desc' : ':asc';
    const sortBy = sortField.includes(':') ? sortField : `${sortField}${sortDirection}`;

    // When doing geo/radius search, use '*' to search all and rely on geo filter
    // This ensures surrounding cities within the radius are included
    const hasGeoFilter = params.city && params.radius && params.radius > 0 &&
      getCityCoordinatesComprehensive(params.city, params.state || '');
    const searchQuery = hasGeoFilter ? '*' : (params.city || '*');

    const result = await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
      .documents()
      .search({
        q: searchQuery,
        query_by: 'city,address,nearbyCities',
        filter_by: filters.join(' && '),
        sort_by: sortBy,
        per_page: Math.min(params.limit, 250), // Typesense max per page
        facet_by: 'state',
      });

    // Transform Typesense results to match expected format
    const deals = (result.hits || []).map((hit: Record<string, unknown>) => {
      const doc = hit.document;
      const price = doc.listPrice || 0;
      // ARV is zestimate - DON'T fall back to price (that would make %ARV = 100%)
      const arv = doc.zestimate || 0;

      // Use stored discountPercent if available, otherwise calculate
      // discountPercent in Typesense is (arv - price) / arv * 100 (positive = below ARV)
      let percentOfArv: number | null = null;
      let discount: number = 0;

      if (doc.discountPercent !== undefined && doc.discountPercent !== null) {
        // discountPercent is stored as (arv - price) / arv * 100
        // So percentOfArv = 100 - discountPercent
        percentOfArv = Math.round((100 - doc.discountPercent) * 10) / 10;
        discount = doc.discountPercent;
      } else if (arv > 0) {
        // Calculate from ARV
        percentOfArv = Math.round((price / arv) * 100 * 10) / 10;
        discount = Math.round((1 - price / arv) * 100 * 10) / 10;
      }
      // If no ARV data, percentOfArv stays null (will show as "N/A" in UI)

      return {
        id: doc.id,
        address: doc.address || '',
        streetAddress: doc.address || '',
        city: doc.city || '',
        state: doc.state || '',
        zipcode: doc.zipCode || '',
        latitude: doc.location?.[0] || null,
        longitude: doc.location?.[1] || null,
        price,
        arv,
        percentOfArv,
        discount,
        beds: doc.bedrooms || 0,
        baths: doc.bathrooms || 0,
        sqft: doc.squareFeet || 0,
        imgSrc: doc.primaryImage || '',
        url: doc.url || `https://www.zillow.com/homedetails/${String(doc.id).replace('zpid_', '')}_zpid/`,
        zpid: doc.zpid || doc.id,
        source: doc.dealType === 'owner_finance' ? 'zillow_imports' : doc.dealType === 'cash_deal' ? 'cash_houses' : 'both',
        ownerFinanceVerified: doc.dealType === 'owner_finance' || doc.dealType === 'both',
        // Cash flow fields - now indexed in Typesense
        rentEstimate: doc.rentEstimate || 0,
        annualTax: doc.annualTaxAmount || 0,
        monthlyHoa: doc.monthlyHoa || 0,
        // Status fields
        status: doc.homeStatus || null,
        daysOnZillow: doc.daysOnZillow || null,
        // These are still calculated on-demand if needed
        cashFlow: null,
        sentToGHL: null,
      };
    });

    // Deduplicate by address + city + state (same property in multiple collections)
    const seen = new Map<string, NormalizedProperty>();
    for (const deal of deals) {
      const key = `${deal.address?.toLowerCase()}_${deal.city?.toLowerCase()}_${deal.state}`;
      if (!seen.has(key)) {
        seen.set(key, deal);
      } else {
        // Prefer owner_finance or both over cash_deal
        const existing = seen.get(key);
        if (deal.ownerFinanceVerified && !existing.ownerFinanceVerified) {
          seen.set(key, deal);
        }
      }
    }
    const deduplicatedDeals = Array.from(seen.values());

    // Extract states from facets
    const stateFacet = result.facet_counts?.find((f: Record<string, unknown>) => f.field_name === 'state');
    const states = stateFacet?.counts.map((c: Record<string, unknown>) => c.value).sort() || [];

    console.log(`[cash-deals] Typesense returned ${deals.length} deals, ${deduplicatedDeals.length} after dedup`);
    return { deals: deduplicatedDeals, states };

  } catch (error) {
    console.warn('[cash-deals] Typesense search failed:', error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const startTime = Date.now();

    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city')?.toLowerCase();
    const state = searchParams.get('state')?.toUpperCase();
    const radius = parseInt(searchParams.get('radius') || '0');
    const sortBy = searchParams.get('sortBy') || 'percentOfArv';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const limit = parseInt(searchParams.get('limit') || '2000');
    const collectionFilter = searchParams.get('collection');

    // Try Typesense first for fast results (including geo/radius searches)
    const typesenseResult = await searchWithTypesense({
      city,
      state,
      radius,
      sortBy,
      sortOrder,
      limit,
      collection: collectionFilter || undefined,
    });

    if (typesenseResult) {
      // Use states from Typesense facets, or cached states
      let states = typesenseResult.states;
      if (states.length === 0 && statesCache && Date.now() - statesCache.timestamp < STATES_CACHE_TTL) {
        states = statesCache.states;
      } else if (states.length > 0) {
        statesCache = { states, timestamp: Date.now() };
      }

      console.log(`[cash-deals] Typesense: ${typesenseResult.deals.length} deals in ${Date.now() - startTime}ms`);
      return NextResponse.json({
        deals: typesenseResult.deals,
        total: typesenseResult.deals.length,
        states,
        engine: 'typesense',
      });
    }

    // Fallback to Firestore with caching (for radius searches or if Typesense fails)
    // NOW: Query single unified 'properties' collection - investors see ALL properties
    const cacheKey = 'all_deals';

    let allDeals: NormalizedProperty[] = [];
    const now = Date.now();

    if (dealsCache && dealsCache.key === cacheKey && (now - dealsCache.timestamp) < DEALS_CACHE_TTL) {
      // Use cached data
      allDeals = [...dealsCache.data];
      console.log(`[cash-deals] Using cached data (${allDeals.length} deals)`);
    } else {
      // Fetch fresh data from unified properties collection
      const db = await getAdminDb();
      if (!db) {
        return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
      }

      // Fetch ALL properties from unified collection (investors see everything)
      const propertiesSnapshot = await db.collection('properties').get();

      // Process properties - normalize for display
      propertiesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Skip if not active
        if (data.isActive === false) return;

        // Determine source tag for display (based on dealTypes)
        let source = 'unified';
        if (data.isOwnerFinance && data.isCashDeal) {
          source = 'both';
        } else if (data.isOwnerFinance) {
          source = 'owner_finance';
        } else if (data.isCashDeal) {
          source = 'cash_deal';
        }

        allDeals.push(normalizeProperty(doc, source));
      });

      // Filter out properties without price
      allDeals = allDeals.filter((deal: NormalizedProperty) => deal.price > 0);

      // Update cache
      dealsCache = { data: [...allDeals], timestamp: now, key: cacheKey };
      console.log(`[cash-deals] Fetched and cached ${allDeals.length} deals from unified collection in ${Date.now() - startTime}ms`);
    }

    // Apply collection/dealType filter in memory (for backwards compatibility)
    if (collectionFilter) {
      if (collectionFilter === 'cash_houses') {
        allDeals = allDeals.filter((deal: NormalizedProperty) => deal.source === 'cash_deal' || deal.source === 'both');
      } else if (collectionFilter === 'zillow_imports') {
        allDeals = allDeals.filter((deal: NormalizedProperty) => deal.source === 'owner_finance' || deal.source === 'both');
      }
    }

    // Filter by city/radius - use coordinates when available for accuracy
    // IMPORTANT: When radius is used, we search ACROSS ALL STATES (for tri-state areas like Memphis)
    if (city) {
      const searchState = state || '';

      // Get center city coordinates
      const centerCoords = getCityCoordinatesComprehensive(city, searchState);

      if (centerCoords && radius > 0) {
        // RADIUS SEARCH: Search across ALL states within radius (for tri-state cities like Memphis)
        // Get all cities within radius (includes cities from ALL states)
        const nearbyCities = getCitiesWithinRadiusComprehensive(city, searchState, radius);
        const cityNames = new Set(nearbyCities.map(c => c.name.toLowerCase()));
        cityNames.add(city.toLowerCase());

        // Also get the states that are included in the radius for logging
        const statesInRadius = new Set(nearbyCities.map(c => c.state));
        if (searchState) statesInRadius.add(searchState);
        console.log(`[cash-deals] Radius search: ${city} + ${radius}mi includes states: ${[...statesInRadius].join(', ')}`);

        allDeals = allDeals.filter((deal: NormalizedProperty) => {
          // If property has coordinates, use actual distance calculation
          if (deal.latitude && deal.longitude) {
            const dist = haversineDistance(centerCoords.lat, centerCoords.lng, deal.latitude, deal.longitude);
            return dist <= radius;
          }
          // Fallback: Check if city name matches any city in radius (across all states)
          return cityNames.has(deal.city?.toLowerCase());
        });
      } else {
        // No radius - filter by exact city match AND state if provided
        allDeals = allDeals.filter((deal: NormalizedProperty) => {
          const cityMatch = deal.city?.toLowerCase().includes(city);
          const stateMatch = state ? deal.state === state : true;
          return cityMatch && stateMatch;
        });
      }
    } else if (state) {
      // No city search, just state filter
      allDeals = allDeals.filter((deal: NormalizedProperty) => deal.state === state);
    }

    // Sort - handle nested cashFlow fields
    allDeals.sort((a: NormalizedProperty, b: NormalizedProperty) => {
      let aVal, bVal;

      // Handle cash flow sorting
      if (sortBy === 'monthlyCashFlow' || sortBy === 'cocReturn') {
        aVal = a.cashFlow?.[sortBy] ?? (sortOrder === 'asc' ? Infinity : -Infinity);
        bVal = b.cashFlow?.[sortBy] ?? (sortOrder === 'asc' ? Infinity : -Infinity);
      } else {
        aVal = a[sortBy] ?? (sortOrder === 'asc' ? Infinity : -Infinity);
        bVal = b[sortBy] ?? (sortOrder === 'asc' ? Infinity : -Infinity);
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const total = allDeals.length;

    // Limit results
    allDeals = allDeals.slice(0, limit);

    // Get states from cache or from current deals
    let states: string[] = [];
    if (statesCache && Date.now() - statesCache.timestamp < STATES_CACHE_TTL) {
      states = statesCache.states;
    } else {
      // Extract states from current deals
      const allStates = new Set<string>();
      allDeals.forEach(d => d.state && allStates.add(d.state));
      states = [...allStates].sort();
      // Update cache
      statesCache = { states, timestamp: Date.now() };
    }

    console.log(`[cash-deals] Fetched ${total} deals in ${Date.now() - startTime}ms`);

    return NextResponse.json({
      deals: allDeals,
      total,
      states
    });
  } catch (error) {
    console.error('Error fetching cash deals:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Bulk delete properties from unified collection
export async function DELETE(request: Request) {
  try {
    const db = await getAdminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const { ids } = await request.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    console.log(`[cash-deals] Deleting ${ids.length} properties from unified collection...`);

    let deleted = 0;
    const batch = db.batch();

    for (const id of ids) {
      // Delete from unified properties collection
      const propertyRef = db.collection('properties').doc(id);
      const propertyDoc = await propertyRef.get();

      if (propertyDoc.exists) {
        batch.delete(propertyRef);
        deleted++;
      }
    }

    await batch.commit();

    // Invalidate cache
    dealsCache = null;

    console.log(`[cash-deals] Deleted ${deleted} properties`);

    return NextResponse.json({ deleted, success: true });
  } catch (error) {
    console.error('Error deleting properties:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
