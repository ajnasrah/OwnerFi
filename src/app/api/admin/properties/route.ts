import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  getCountFromServer,
  getAggregateFromServer,
  count
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';
import { autoCleanPropertyData } from '@/lib/property-auto-cleanup';

// Simple in-memory cache for total count (5 min TTL)
let cachedCount: { value: number; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Calculate monthly mortgage payment
function calculateMonthlyMortgage(loanAmount: number, annualRate: number, years: number): number {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  if (monthlyRate === 0) return loanAmount / numPayments;
  const x = Math.pow(1 + monthlyRate, numPayments);
  return loanAmount * (monthlyRate * x) / (x - 1);
}

// Calculate cash flow analysis for admin view
// Uses standard real estate investor assumptions
function calculateCashFlow(price: number, rentEstimate: number, annualTax: number, monthlyHoa: number, usedEstimatedTax: boolean = false) {
  // Financing assumptions
  const DOWN_PAYMENT_PERCENT = 0.10;
  const CLOSING_COSTS_PERCENT = 0.03; // 3% closing costs
  const INTEREST_RATE = 0.06;
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
  const effectiveTax = annualTax > 0 ? annualTax : (usedEstimatedTax ? price * ESTIMATED_TAX_RATE : 0);

  // Investment calculation (includes closing costs for accurate CoC)
  const downPayment = price * DOWN_PAYMENT_PERCENT;
  const closingCosts = price * CLOSING_COSTS_PERCENT;
  const totalInvestment = downPayment + closingCosts;

  const loanAmount = price - downPayment;
  const monthlyMortgage = calculateMonthlyMortgage(loanAmount, INTEREST_RATE, LOAN_TERM_YEARS);
  const monthlyInsurance = (price * INSURANCE_RATE) / 12;
  const monthlyTax = effectiveTax / 12;
  const monthlyMgmt = rentEstimate * PROPERTY_MGMT_RATE;

  // Additional operating expenses that investors always account for
  const monthlyVacancy = rentEstimate * VACANCY_RATE;
  const monthlyMaintenance = rentEstimate * MAINTENANCE_RATE;
  const monthlyCapex = rentEstimate * CAPEX_RATE;

  const monthlyExpenses = monthlyMortgage + monthlyInsurance + monthlyTax + monthlyHoa + monthlyMgmt + monthlyVacancy + monthlyMaintenance + monthlyCapex;
  const monthlyCashFlow = rentEstimate - monthlyExpenses;
  const annualCashFlow = monthlyCashFlow * 12;

  // CoC uses total investment (down payment + closing costs)
  const cocReturn = totalInvestment > 0 ? (annualCashFlow / totalInvestment) * 100 : 0;

  return {
    downPayment: Math.round(downPayment),
    totalInvestment: Math.round(totalInvestment),
    monthlyMortgage: Math.round(monthlyMortgage),
    monthlyExpenses: Math.round(monthlyExpenses),
    monthlyCashFlow: Math.round(monthlyCashFlow),
    annualCashFlow: Math.round(annualCashFlow),
    cocReturn: Math.round(cocReturn * 10) / 10,
    usedEstimatedTax,
  };
}

// Fast field mapper - only essential fields
function mapPropertyFields(doc: any) {
  const data = doc.data();
  const price = data.price || data.listPrice || 0;
  const rentEstimate = data.rentEstimate || 0;
  const annualTax = data.annualTaxAmount || 0;
  const monthlyHoa = data.hoa || 0;

  // Track missing fields
  const missingFields: string[] = [];
  if (!rentEstimate) missingFields.push('rent');
  if (!annualTax) missingFields.push('tax');

  // Calculate cash flow if we have price and rent
  // Use estimated tax (1.2% of price) when actual tax is missing
  let cashFlow = null;
  if (price > 0 && rentEstimate > 0) {
    const useEstimatedTax = !annualTax;
    cashFlow = calculateCashFlow(price, rentEstimate, annualTax, monthlyHoa, useEstimatedTax);
  }

  return {
    id: doc.id,
    // Core fields only
    fullAddress: data.fullAddress,
    streetAddress: data.streetAddress,
    city: data.city,
    state: data.state,
    zipCode: data.zipCode,
    price,
    squareFoot: data.squareFoot,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    lotSquareFoot: data.lotSquareFoot,
    homeType: data.homeType,
    ownerFinanceVerified: data.ownerFinanceVerified,
    status: data.status,
    // Images
    firstPropertyImage: data.firstPropertyImage,
    propertyImages: data.propertyImages,
    // Timestamps - simplified
    foundAt: data.foundAt?.toDate?.()?.toISOString() || data.foundAt,
    // Financial fields - CRITICAL for buyer-facing display
    monthlyPayment: data.monthlyPayment,
    downPaymentAmount: data.downPaymentAmount,
    downPaymentPercent: data.downPaymentPercent,
    interestRate: data.interestRate,
    termYears: data.termYears,
    balloonYears: data.balloonYears,
    // Admin panel compatibility - use streetAddress (just the street, not full address with city/state/zip)
    address: data.streetAddress || data.fullAddress || data.address,
    squareFeet: data.squareFoot || data.squareFeet,
    imageUrl: data.firstPropertyImage || data.imageUrl,
    imageUrls: data.propertyImages || data.imageUrls || [],
    zillowImageUrl: data.firstPropertyImage || data.zillowImageUrl,
    listPrice: price,
    // Description - important for owner finance details
    description: data.description || '',
    // Owner finance keywords
    primaryKeyword: data.primaryKeyword || null,
    matchedKeywords: data.matchedKeywords || [],
    // Agent/Contact info
    agentName: data.agentName || data.listingAgentName || null,
    agentPhone: data.agentPhoneNumber || data.agentPhone || data.brokerPhoneNumber || null,
    agentEmail: data.agentEmail || data.listingAgentEmail || null,
    // Source tracking - CRITICAL for GHL badge
    source: data.source || null,
    agentConfirmedOwnerFinance: data.agentConfirmedOwnerFinance || false,
    originalQueueId: data.originalQueueId || null,
    // Cash flow fields (admin only)
    rentEstimate,
    annualTax,
    monthlyHoa,
    missingFields,
    cashFlow,
  };
}

// Get all properties for admin management
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Admin access control
    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const countOnly = searchParams.get('countOnly') === 'true';

    // Fetch from BOTH collections - zillow_imports AND properties
    const zillowCollection = collection(db, 'zillow_imports');
    const propertiesCollection = collection(db, 'properties');

    // FAST PATH: Count-only mode for stats
    if (countOnly) {
      const [zillowCount, propertiesCount] = await Promise.all([
        getCountFromServer(query(zillowCollection, where('ownerFinanceVerified', '==', true))),
        getCountFromServer(query(propertiesCollection, where('isActive', '==', true)))
      ]);
      const total = zillowCount.data().count + propertiesCount.data().count;
      return NextResponse.json({
        properties: [],
        count: 0,
        total: total,
        hasMore: false
      });
    }

    let zillowConstraints: any[] = [
      where('ownerFinanceVerified', '==', true),
      orderBy('foundAt', 'desc')
    ];

    // Note: Removed orderBy to avoid requiring composite index (only 5-10 properties typically)
    let propertiesConstraints: any[] = [
      where('isActive', '==', true)
    ];

    // Filter by status if specified (only for zillow_imports)
    if (status !== 'all') {
      if (status === 'null') {
        zillowConstraints = [
          where('ownerFinanceVerified', '==', true),
          where('status', '==', null),
          orderBy('foundAt', 'desc')
        ];
      } else {
        zillowConstraints = [
          where('ownerFinanceVerified', '==', true),
          where('status', '==', status),
          orderBy('foundAt', 'desc')
        ];
      }
    }

    // Execute BOTH queries in parallel
    const [zillowSnapshot, propertiesSnapshot] = await Promise.all([
      getDocs(query(zillowCollection, ...zillowConstraints)),
      getDocs(query(propertiesCollection, ...propertiesConstraints))
    ]);

    // Map both collections
    const zillowProperties = zillowSnapshot.docs.map(mapPropertyFields);
    const ghlProperties = propertiesSnapshot.docs.map(mapPropertyFields);

    // Combine and deduplicate (in case same property exists in both)
    const allProperties = [...zillowProperties, ...ghlProperties];
    const uniqueProperties = Array.from(
      new Map(allProperties.map(p => [p.id, p])).values()
    );

    // Return all properties with caching headers
    const response = NextResponse.json({
      properties: uniqueProperties,
      count: uniqueProperties.length,
      total: uniqueProperties.length,
      hasMore: false,
      nextCursor: null,
      showing: `Showing all ${uniqueProperties.length} properties (${zillowProperties.length} from Zillow, ${ghlProperties.length} from GHL)`
    });
    // PERF: Cache for 30s client-side, 2 min CDN, allows stale for 5 min while revalidating
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=300');
    return response;

  } catch (error) {
    await logError('Failed to fetch admin properties', {
      action: 'admin_properties_fetch'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}

// Update property
export async function PUT(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;
    
    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const { propertyId, updates } = await request.json();

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Auto-cleanup: Clean address and upgrade image URLs if they're being updated
    if (updates.address || updates.imageUrl || updates.imageUrls || updates.zillowImageUrl) {
      const cleanedData = autoCleanPropertyData({
        address: updates.address,
        city: updates.city,
        state: updates.state,
        zipCode: updates.zipCode,
        imageUrl: updates.imageUrl,
        imageUrls: updates.imageUrls,
        zillowImageUrl: updates.zillowImageUrl
      });

      // Apply cleaned data
      if (cleanedData.address) updates.address = cleanedData.address;
      if (cleanedData.imageUrl) updates.imageUrl = cleanedData.imageUrl;
      if (cleanedData.imageUrls) updates.imageUrls = cleanedData.imageUrls;
      if (cleanedData.zillowImageUrl) updates.zillowImageUrl = cleanedData.zillowImageUrl;
    }

    // Update property in Firebase (zillow_imports collection)
    await updateDoc(doc(db, 'zillow_imports', propertyId), {
      ...updates,
      updatedAt: new Date()
    });

    await logInfo('Property updated by admin', {
      action: 'admin_property_update',
      metadata: { 
        propertyId,
        updatedFields: Object.keys(updates)
      }
    });

    return NextResponse.json({ 
      success: true,
      message: 'Property updated successfully' 
    });

  } catch (error) {
    await logError('Failed to update property', {
      action: 'admin_property_update_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to update property' },
      { status: 500 }
    );
  }
}

// Delete property
export async function DELETE(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;
    
    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    
    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Completely delete the property from Firebase (zillow_imports collection)
    await deleteDoc(doc(db, 'zillow_imports', propertyId));

    await logInfo('Property deleted by admin', {
      action: 'admin_property_delete',
      metadata: { propertyId }
    });

    return NextResponse.json({ 
      success: true,
      message: 'Property deleted successfully' 
    });

  } catch (error) {
    await logError('Failed to delete property', {
      action: 'admin_property_delete_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to delete property' },
      { status: 500 }
    );
  }
}