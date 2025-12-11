import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getCitiesWithinRadiusComprehensive, getCityCoordinatesComprehensive } from '@/lib/comprehensive-cities';

// Cache for states list (refresh every 5 minutes)
let statesCache: { states: string[]; timestamp: number } | null = null;
const STATES_CACHE_TTL = 5 * 60 * 1000;

// Cache for deals data (refresh every 5 minutes - increased from 2min for better performance)
interface DealsCache {
  data: any[];
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
function normalizeProperty(doc: FirebaseFirestore.DocumentSnapshot, source: string): any {
  const data = doc.data() || {};

  // Calculate percentOfArv if not present
  const price = data.price || data.listPrice || 0;
  const arv = data.arv || data.estimate || data.zestimate || 0;
  const percentOfArv = data.percentOfArv || (arv > 0 ? Math.round((price / arv) * 100 * 10) / 10 : 100);
  const discount = data.discount || (arv > 0 ? Math.round((1 - price / arv) * 100 * 10) / 10 : 0);

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

  return {
    id: doc.id,
    // Address fields
    address: data.address || data.fullAddress || `${data.streetAddress}, ${data.city}, ${data.state} ${data.zipCode || data.zipcode}`,
    streetAddress: data.streetAddress || data.address?.split(',')[0],
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
    imgSrc: data.imgSrc || data.firstPropertyImage || data.imageUrl || (data.imageUrls?.[0]),
    // Metadata
    url: data.url || data.hdpUrl,
    zpid: data.zpid,
    source: data.source || source,
    status: data.status || data.homeStatus,
    addedAt: data.addedAt || data.importedAt || data.scrapedAt,
    // Owner finance fields (from zillow_imports)
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

export async function GET(request: Request) {
  try {
    const startTime = Date.now();

    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city')?.toLowerCase();
    const state = searchParams.get('state')?.toUpperCase();
    const radius = parseInt(searchParams.get('radius') || '0');
    const sortBy = searchParams.get('sortBy') || 'percentOfArv';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const limit = parseInt(searchParams.get('limit') || '100');
    const collection = searchParams.get('collection');

    // Simple cache - fetch ALL data once and filter in memory (avoids index requirements)
    const cacheKey = 'all_deals';

    let allDeals: any[] = [];
    const now = Date.now();

    if (dealsCache && dealsCache.key === cacheKey && (now - dealsCache.timestamp) < DEALS_CACHE_TTL) {
      // Use cached data
      allDeals = [...dealsCache.data];
      console.log(`[cash-deals] Using cached data (${allDeals.length} deals)`);
    } else {
      // Fetch fresh data from both collections
      const db = await getAdminDb();
      if (!db) {
        return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
      }

      // Fetch from both collections in parallel - NO filters to avoid index requirements
      const [cashSnapshot, zillowSnapshot] = await Promise.all([
        db.collection('cash_houses').get(),
        db.collection('zillow_imports').get()
      ]);

      // Process cash_houses
      cashSnapshot.docs.forEach(doc => {
        allDeals.push(normalizeProperty(doc, 'cash_houses'));
      });

      // Process zillow_imports - only owner finance verified
      zillowSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.ownerFinanceVerified === true) {
          allDeals.push(normalizeProperty(doc, 'zillow_imports'));
        }
      });

      // Filter out properties without price or ARV
      allDeals = allDeals.filter((deal: any) => deal.price > 0 && deal.arv > 0);

      // Update cache
      dealsCache = { data: [...allDeals], timestamp: now, key: cacheKey };
      console.log(`[cash-deals] Fetched and cached ${allDeals.length} deals in ${Date.now() - startTime}ms`);
    }

    // Apply collection filter in memory
    if (collection) {
      allDeals = allDeals.filter((deal: any) => deal.source === collection);
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

        allDeals = allDeals.filter((deal: any) => {
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
        allDeals = allDeals.filter((deal: any) => {
          const cityMatch = deal.city?.toLowerCase().includes(city);
          const stateMatch = state ? deal.state === state : true;
          return cityMatch && stateMatch;
        });
      }
    } else if (state) {
      // No city search, just state filter
      allDeals = allDeals.filter((deal: any) => deal.state === state);
    }

    // Sort - handle nested cashFlow fields
    allDeals.sort((a: any, b: any) => {
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
  } catch (error: any) {
    console.error('Error fetching cash deals:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Bulk delete cash deals
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

    console.log(`[cash-deals] Deleting ${ids.length} properties...`);

    let deleted = 0;
    const batch = db.batch();

    for (const id of ids) {
      // Try to delete from both collections
      const cashHouseRef = db.collection('cash_houses').doc(id);
      const zillowRef = db.collection('zillow_imports').doc(id);

      // Check which collection has the doc
      const [cashDoc, zillowDoc] = await Promise.all([
        cashHouseRef.get(),
        zillowRef.get()
      ]);

      if (cashDoc.exists) {
        batch.delete(cashHouseRef);
        deleted++;
      }
      if (zillowDoc.exists) {
        batch.delete(zillowRef);
        deleted++;
      }
    }

    await batch.commit();
    console.log(`[cash-deals] Deleted ${deleted} properties`);

    return NextResponse.json({ deleted, success: true });
  } catch (error: any) {
    console.error('Error deleting cash deals:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
