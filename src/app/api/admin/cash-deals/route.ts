import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getCitiesWithinRadiusComprehensive } from '@/lib/comprehensive-cities';

// Cache for states list (refresh every 5 minutes)
let statesCache: { states: string[]; timestamp: number } | null = null;
const STATES_CACHE_TTL = 5 * 60 * 1000;

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
  };
}

export async function GET(request: Request) {
  try {
    const startTime = Date.now();
    const db = await getAdminDb();
    if (!db) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city')?.toLowerCase();
    const state = searchParams.get('state')?.toUpperCase();
    const radius = parseInt(searchParams.get('radius') || '0'); // Radius in miles for surrounding cities
    const sortBy = searchParams.get('sortBy') || 'percentOfArv';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const limit = parseInt(searchParams.get('limit') || '100');
    const collection = searchParams.get('collection'); // 'cash_houses', 'zillow_imports', or null for both

    // Get surrounding cities if radius is specified
    let surroundingCities: Set<string> = new Set();
    if (city && radius > 0) {
      // Find cities within radius (need to find the state for the city first)
      const searchState = state || ''; // Will search all states if not specified
      const nearbyCities = getCitiesWithinRadiusComprehensive(city, searchState, radius);
      surroundingCities = new Set(nearbyCities.map(c => c.name.toLowerCase()));
      surroundingCities.add(city); // Include the searched city itself
      console.log(`[cash-deals] Found ${surroundingCities.size} cities within ${radius} miles of ${city}`);
    }

    let allDeals: any[] = [];

    // Fetch limit per collection (fetch more to allow for filtering)
    const fetchLimit = city ? limit * 3 : limit;

    // Fetch from both collections in parallel
    const fetchPromises: Promise<void>[] = [];

    // Fetch from cash_houses (discount deals) - smaller collection, fetch all
    if (!collection || collection === 'cash_houses') {
      fetchPromises.push((async () => {
        // cash_houses is small (~150), fetch all and filter/sort in memory to avoid index requirements
        const cashSnapshot = await db.collection('cash_houses').get();
        cashSnapshot.docs.forEach(doc => {
          const normalized = normalizeProperty(doc, 'cash_houses');
          // Filter by state in memory if specified
          if (!state || normalized.state === state) {
            allDeals.push(normalized);
          }
        });
      })());
    }

    // Fetch from zillow_imports (owner finance deals) - filter in memory to avoid index requirements
    if (!collection || collection === 'zillow_imports') {
      fetchPromises.push((async () => {
        // Fetch without state filter to avoid index requirements, filter in memory
        const zillowSnapshot = await db.collection('zillow_imports')
          .orderBy('foundAt', 'desc')
          .limit(fetchLimit * 3)
          .get();
        zillowSnapshot.docs.forEach(doc => {
          const normalized = normalizeProperty(doc, 'zillow_imports');
          // Filter by state in memory if specified
          if (!state || normalized.state === state) {
            allDeals.push(normalized);
          }
        });
      })());
    }

    await Promise.all(fetchPromises);

    // Filter out properties without price or ARV (Zestimate) data
    allDeals = allDeals.filter((deal: any) => deal.price > 0 && deal.arv > 0);

    // Filter by city (case-insensitive partial match) or surrounding cities
    if (city) {
      if (surroundingCities.size > 0) {
        // Use surrounding cities set (includes the searched city)
        allDeals = allDeals.filter((deal: any) =>
          surroundingCities.has(deal.city?.toLowerCase())
        );
      } else {
        // Fall back to partial match
        allDeals = allDeals.filter((deal: any) =>
          deal.city?.toLowerCase().includes(city)
        );
      }
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

    // Get states from cache or fetch separately (async, don't block)
    let states: string[] = [];
    if (statesCache && Date.now() - statesCache.timestamp < STATES_CACHE_TTL) {
      states = statesCache.states;
    } else {
      // Return empty states first time, fetch in background
      const allStates = new Set<string>();
      allDeals.forEach(d => d.state && allStates.add(d.state));
      states = [...allStates].sort();
      // Update cache async
      (async () => {
        try {
          const [cashSnap, zillowSnap] = await Promise.all([
            db.collection('cash_houses').select('state').get(),
            db.collection('zillow_imports').select('state').limit(1000).get()
          ]);
          const allS = new Set<string>();
          cashSnap.docs.forEach(d => d.data().state && allS.add(d.data().state));
          zillowSnap.docs.forEach(d => d.data().state && allS.add(d.data().state));
          statesCache = { states: [...allS].sort(), timestamp: Date.now() };
        } catch (e) {
          console.error('Failed to update states cache:', e);
        }
      })();
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
