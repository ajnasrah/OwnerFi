import { NextRequest, NextResponse } from 'next/server';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { queueNearbyCitiesForProperty } from '@/lib/property-enhancement';
import crypto from 'crypto';

const GHL_WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET || '';

function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!signature || !GHL_WEBHOOK_SECRET) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', GHL_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Normalize lot size to square feet (copied from upload-properties-v4)
function normalizeLotSize(lotSizeStr: string): number {
  if (!lotSizeStr) return 0;

  const str = lotSizeStr.toLowerCase().trim();

  if (str.includes('acre')) {
    const acreMatch = str.match(/(\d+\.?\d*)\s*acre/);
    if (acreMatch) {
      const acres = parseFloat(acreMatch[1]);
      return Math.round(acres * 43560);
    }
  }

  if (str.includes('sq') || str.includes('sf')) {
    const sqftMatch = str.match(/(\d+)/);
    if (sqftMatch) {
      return parseInt(sqftMatch[1]);
    }
  }

  const rawNumber = parseFloat(str.replace(/[,$]/g, ''));
  if (!isNaN(rawNumber)) {
    return Math.round(rawNumber);
  }

  return 0;
}

// Normalize state codes to 2-letter uppercase
function normalizeState(state: string): string {
  if (!state) return '';

  const stateMap: Record<string, string> = {
    'tennessee': 'TN', 'arkansas': 'AR', 'texas': 'TX',
    'florida': 'FL', 'georgia': 'GA', 'alabama': 'AL',
    'mississippi': 'MS', 'louisiana': 'LA', 'missouri': 'MO',
    'oklahoma': 'OK', 'kentucky': 'KY', 'north carolina': 'NC',
    'south carolina': 'SC', 'virginia': 'VA', 'west virginia': 'WV',
    'arizona': 'AZ', 'california': 'CA', 'nevada': 'NV',
    'new mexico': 'NM', 'colorado': 'CO', 'utah': 'UT',
    'ohio': 'OH', 'michigan': 'MI', 'illinois': 'IL',
    'indiana': 'IN', 'pennsylvania': 'PA', 'new york': 'NY',
    'new jersey': 'NJ', 'connecticut': 'CT', 'massachusetts': 'MA'
  };

  const normalized = state.toLowerCase().trim();

  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }

  return stateMap[normalized] || normalized.substring(0, 2).toUpperCase();
}

// Clean and normalize city names
function normalizeCity(city: string): string {
  if (!city) return '';

  const cleaned = city.trim();

  // Capitalize first letter of each word
  return cleaned.split(' ')
    .map(word => {
      if (word.toLowerCase().startsWith('mc')) {
        return 'Mc' + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
      }
      if (word.includes("'")) {
        const parts = word.split("'");
        return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("'");
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// Format street address with proper capitalization
function formatStreetAddress(address: string): string {
  if (!address) return '';

  const keepUppercase = new Set(['NE', 'NW', 'SE', 'SW', 'N', 'S', 'E', 'W', 'APT', 'STE', 'UNIT']);

  const streetSuffixes: Record<string, string> = {
    'street': 'St', 'st': 'St', 'avenue': 'Ave', 'ave': 'Ave',
    'road': 'Rd', 'rd': 'Rd', 'boulevard': 'Blvd', 'blvd': 'Blvd',
    'drive': 'Dr', 'dr': 'Dr', 'court': 'Ct', 'ct': 'Ct',
    'circle': 'Cir', 'cir': 'Cir', 'lane': 'Ln', 'ln': 'Ln',
    'place': 'Pl', 'pl': 'Pl', 'parkway': 'Pkwy', 'pkwy': 'Pkwy',
    'highway': 'Hwy', 'hwy': 'Hwy'
  };

  const parts = address.trim().split(/\s+/);

  return parts.map((part, index) => {
    const lower = part.toLowerCase();

    if (/^\d+/.test(part)) {
      return part;
    }

    if (index > 0 && (lower === 'apt' || lower === 'ste' || lower === 'unit')) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }

    if (/^\d+[A-Za-z]+$/.test(part)) {
      return part.toUpperCase();
    }

    if (keepUppercase.has(part.toUpperCase())) {
      return part.toUpperCase();
    }

    if (streetSuffixes[lower]) {
      return streetSuffixes[lower];
    }

    if (part.includes("'")) {
      const subParts = part.split("'");
      return subParts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("'");
    }

    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join(' ');
}

interface GHLPropertyPayload {
  opportunityId: string;
  opportunityName?: string;
  propertyAddress: string;
  propertyCity: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  yearBuilt?: number;
  lotSizes?: string;
  homeType?: string;
  imageLink?: string;
  downPaymentAmount?: number;
  downPayment?: number; // Percentage
  interestRate?: number;
  monthlyPayment?: number;
  balloon?: number; // Years
  contactId?: string;
  locationId?: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get('x-ghl-signature');

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
      logError('Invalid GoHighLevel webhook signature');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const payload: GHLPropertyPayload = JSON.parse(body);
    logInfo('GoHighLevel save property webhook received', payload);

    // Validate required fields
    if (!payload.opportunityId) {
      return NextResponse.json(
        { error: 'Opportunity ID is required' },
        { status: 400 }
      );
    }

    if (!payload.propertyAddress || !payload.propertyCity || !payload.price) {
      return NextResponse.json(
        {
          error: 'Required fields missing',
          details: 'propertyAddress, propertyCity, and price are required'
        },
        { status: 400 }
      );
    }

    // Use opportunity ID as the property ID to maintain consistency
    const propertyId = payload.opportunityId;

    // Check if property already exists
    const existingDoc = await getDoc(doc(db, 'properties', propertyId));
    if (existingDoc.exists()) {
      logWarn(`Property with opportunity ID ${propertyId} already exists, updating instead`);
    }

    // Calculate down payment amount from percentage if needed
    let downPaymentAmount = payload.downPaymentAmount || 0;
    if (!downPaymentAmount && payload.downPayment && payload.price) {
      downPaymentAmount = Math.round((payload.downPayment / 100) * payload.price);
    }

    // Calculate monthly payment if missing
    let calculatedMonthlyPayment = payload.monthlyPayment || 0;
    if (!calculatedMonthlyPayment && payload.interestRate && downPaymentAmount && payload.price) {
      const loanAmount = payload.price - downPaymentAmount;
      const monthlyRate = payload.interestRate / 100 / 12;
      const numPayments = 20 * 12; // Default 20 year term

      if (monthlyRate > 0) {
        calculatedMonthlyPayment = Math.round(
          loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
          (Math.pow(1 + monthlyRate, numPayments) - 1)
        );
      } else {
        calculatedMonthlyPayment = Math.round(loanAmount / numPayments);
      }
    }

    // Calculate balloon payment if balloon years provided
    let balloonPaymentAmount: number | undefined = undefined;
    if (payload.balloon && payload.balloon > 0 && payload.price > 0) {
      const effectiveInterestRate = payload.interestRate || 6;
      const effectiveDownPayment = downPaymentAmount || (payload.price * 0.10);
      const loanAmount = payload.price - effectiveDownPayment;
      const monthlyRate = effectiveInterestRate / 100 / 12;
      const totalTermMonths = 20 * 12;
      const balloonMonths = payload.balloon * 12;

      if (monthlyRate > 0) {
        const principalPaid = loanAmount *
          (Math.pow(1 + monthlyRate, balloonMonths) - 1) /
          (Math.pow(1 + monthlyRate, totalTermMonths) - 1);
        balloonPaymentAmount = Math.round(loanAmount - principalPaid);
      } else {
        const principalPerMonth = loanAmount / totalTermMonths;
        balloonPaymentAmount = Math.round(loanAmount - (principalPerMonth * balloonMonths));
      }
    }

    // Generate image URL if not provided
    let imageUrl = payload.imageLink || '';
    if (!imageUrl || !imageUrl.startsWith('http')) {
      const fullAddress = `${payload.propertyAddress}, ${payload.propertyCity}, ${payload.state}`;
      imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encodeURIComponent(fullAddress)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    }

    // Determine property type
    const homeType = (payload.homeType || '').toLowerCase();
    let propertyType = 'single-family';
    if (homeType.includes('condo')) propertyType = 'condo';
    else if (homeType.includes('townhouse')) propertyType = 'townhouse';
    else if (homeType.includes('multi')) propertyType = 'multi-family';

    // Prepare property data
    const propertyData = {
      // IDs and Names
      id: propertyId,
      opportunityId: payload.opportunityId,
      opportunityName: payload.opportunityName || payload.propertyAddress,

      // Location
      address: formatStreetAddress(payload.propertyAddress),
      city: normalizeCity(payload.propertyCity),
      state: normalizeState(payload.state),
      zipCode: payload.zipCode?.trim() || '',

      // Pricing
      price: payload.price,
      listPrice: payload.price,

      // Property Details
      bedrooms: payload.bedrooms || 0,
      beds: payload.bedrooms || 0, // Some components use 'beds'
      bathrooms: payload.bathrooms || 0,
      baths: payload.bathrooms || 0, // Some components use 'baths'
      squareFeet: payload.livingArea || 0,
      yearBuilt: payload.yearBuilt || 0,
      lotSize: normalizeLotSize(payload.lotSizes || ''),
      propertyType,

      // Financial Details
      monthlyPayment: calculatedMonthlyPayment,
      downPaymentAmount,
      downPaymentPercent: payload.downPayment || (downPaymentAmount && payload.price ? (downPaymentAmount / payload.price) * 100 : 0),
      interestRate: payload.interestRate || 0,
      termYears: 20,
      balloonYears: payload.balloon && payload.balloon > 0 ? payload.balloon : null,
      balloonPayment: balloonPaymentAmount,

      // Images
      imageUrls: imageUrl ? [imageUrl] : [],

      // Meta
      source: 'gohighlevel',
      status: 'active',
      isActive: true,
      featured: false,
      priority: 1,
      nearbyCities: [],

      // GoHighLevel tracking
      contactId: payload.contactId || '',
      locationId: payload.locationId || '',

      // Timestamps
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      dateAdded: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    // Save to database
    await setDoc(doc(db, 'properties', propertyId), propertyData, { merge: true });

    // Queue nearby cities calculation
    queueNearbyCitiesForProperty(propertyId, propertyData.city, propertyData.state);

    logInfo(`Property saved successfully: ${propertyId}`, {
      address: propertyData.address,
      city: propertyData.city,
      state: propertyData.state,
      price: propertyData.price
    });

    return NextResponse.json({
      success: true,
      data: {
        propertyId,
        address: propertyData.address,
        city: propertyData.city,
        state: propertyData.state,
        price: propertyData.price,
        message: existingDoc.exists() ? 'Property updated successfully' : 'Property created successfully'
      }
    });

  } catch (error) {
    logError('Error in GoHighLevel save property webhook:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save property',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}