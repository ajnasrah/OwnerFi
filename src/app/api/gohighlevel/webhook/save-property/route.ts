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
const SKIP_SIGNATURE_CHECK = process.env.NODE_ENV === 'development' ||
                              process.env.SKIP_GHL_SIGNATURE === 'true' ||
                              process.env.GHL_BYPASS_SIGNATURE === 'true'; // Same as delete webhook

function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  // Skip signature check in development or if explicitly disabled
  if (SKIP_SIGNATURE_CHECK) {
    logInfo('Skipping webhook signature verification (development mode or explicitly disabled)');
    return true;
  }

  if (!signature || !GHL_WEBHOOK_SECRET) {
    logWarn('Missing webhook signature or secret', {
      action: 'signature_check',
      metadata: {
        hasSignature: !!signature,
        hasSecret: !!GHL_WEBHOOK_SECRET,
        secretLength: GHL_WEBHOOK_SECRET.length
      }
    });
    return false;
  }

  try {
    // Check if GoHighLevel is sending the raw secret as the signature
    if (signature === GHL_WEBHOOK_SECRET) {
      logInfo('GoHighLevel sent raw secret as signature');
      return true;
    }

    // GoHighLevel might send signature in different formats
    // Try HMAC signature verification
    const expectedSignature = crypto
      .createHmac('sha256', GHL_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    // Check if signature matches directly
    if (signature === expectedSignature) {
      return true;
    }

    // Try with sha256= prefix (GitHub style)
    if (signature === `sha256=${expectedSignature}`) {
      return true;
    }

    // Try if GoHighLevel sends with sha256= prefix and we need to remove it
    const signatureWithoutPrefix = signature.replace(/^sha256=/, '');
    if (signatureWithoutPrefix === expectedSignature) {
      return true;
    }

    logWarn('Signature mismatch', {
      action: 'signature_verification',
      metadata: {
        receivedSignatureLength: signature.length,
        expectedSignatureLength: expectedSignature.length,
        receivedPrefix: signature.substring(0, 10),
        expectedPrefix: expectedSignature.substring(0, 10)
      }
    });

    return false;
  } catch (error) {
    logError('Error verifying webhook signature', undefined, error as Error);
    return false;
  }
}

// Normalize lot size to square feet (copied from upload-properties-v4)
function normalizeLotSize(lotSizeStr: string): number {
  if (!lotSizeStr) return 0;

  const str = lotSizeStr.toLowerCase().trim();

  // Check for acres
  if (str.includes('acre')) {
    const acreMatch = str.match(/(\d+\.?\d*)\s*acre/);
    if (acreMatch) {
      const acres = parseFloat(acreMatch[1]);
      return Math.round(acres * 43560); // Convert acres to sq ft
    }
  }

  // Check for square feet
  if (str.includes('sq') || str.includes('sf')) {
    const sqftMatch = str.match(/(\d+)/);
    if (sqftMatch) {
      return parseInt(sqftMatch[1]);
    }
  }

  // Assume raw number is square feet
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

  // Check if it's already a 2-letter code
  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }

  // Check if it's a full state name
  return stateMap[normalized] || normalized.substring(0, 2).toUpperCase();
}

// Clean and normalize city names
function normalizeCity(city: string): string {
  if (!city) return '';

  const cityFixes: Record<string, string> = {
    'bartlettt': 'Bartlett',
    'memphis': 'Memphis',
    'dallas': 'Dallas',
    'houston': 'Houston',
    'austin': 'Austin',
    'little rock': 'Little Rock',
    'fort worth': 'Fort Worth',
    'san antonio': 'San Antonio',
    'el paso': 'El Paso'
  };

  const cleaned = city.trim();
  const lower = cleaned.toLowerCase();

  if (cityFixes[lower]) {
    return cityFixes[lower];
  }

  // Capitalize first letter of each word
  return cleaned.split(' ')
    .map(word => {
      // Handle special cases like "McAllen" or "O'Neill"
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

  // Common abbreviations that should stay uppercase
  const keepUppercase = new Set(['NE', 'NW', 'SE', 'SW', 'N', 'S', 'E', 'W', 'APT', 'STE', 'UNIT']);

  // Common street suffixes and their proper format
  const streetSuffixes: Record<string, string> = {
    'street': 'St', 'st': 'St',
    'avenue': 'Ave', 'ave': 'Ave',
    'road': 'Rd', 'rd': 'Rd',
    'boulevard': 'Blvd', 'blvd': 'Blvd',
    'drive': 'Dr', 'dr': 'Dr',
    'court': 'Ct', 'ct': 'Ct',
    'circle': 'Cir', 'cir': 'Cir',
    'lane': 'Ln', 'ln': 'Ln',
    'place': 'Pl', 'pl': 'Pl',
    'parkway': 'Pkwy', 'pkwy': 'Pkwy',
    'highway': 'Hwy', 'hwy': 'Hwy'
  };

  // Split address into parts
  const parts = address.trim().split(/\s+/);

  return parts.map((part, index) => {
    const lower = part.toLowerCase();

    // Keep numbers as-is
    if (/^\d+/.test(part)) {
      return part;
    }

    // Check for unit/apartment indicators
    if (index > 0 && (lower === 'apt' || lower === 'ste' || lower === 'unit')) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }

    // Check for unit numbers (like "2B", "3A")
    if (/^\d+[A-Za-z]+$/.test(part)) {
      return part.toUpperCase();
    }

    // Check for directional abbreviations
    if (keepUppercase.has(part.toUpperCase())) {
      return part.toUpperCase();
    }

    // Check for street suffixes
    if (streetSuffixes[lower]) {
      return streetSuffixes[lower];
    }

    // Check for possessives or contractions
    if (part.includes("'")) {
      const subParts = part.split("'");
      return subParts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("'");
    }

    // Default: capitalize first letter
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join(' ');
}

// GoHighLevel webhook payload interface
interface GHLPropertyPayload {
  opportunityId: string;
  opportunityName?: string;
  propertyAddress: string;
  propertyCity: string;
  state: string;
  zipCode?: string;
  price: number | string; // Accept both number and string
  bedrooms?: number | string;
  bathrooms?: number | string;
  livingArea?: number | string;
  yearBuilt?: number | string;
  lotSizes?: string;
  homeType?: string;
  imageLink?: string;
  downPaymentAmount?: number | string;
  downPayment?: number | string; // Percentage
  interestRate?: number | string;
  monthlyPayment?: number | string;
  balloon?: number | string; // Years
}

// Helper function to safely parse numbers
function parseNumberField(value: number | string | undefined): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value;

  // Remove common formatting characters
  const cleaned = String(value).replace(/[$,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export async function POST(request: NextRequest) {
  try {
    // Check database availability
    if (!db) {
      logError('Database not available');
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.text();

    // Check multiple possible header names for signature
    const signature = request.headers.get('x-ghl-signature') ||
                     request.headers.get('X-GHL-Signature') ||
                     request.headers.get('x-webhook-signature') ||
                     request.headers.get('X-Webhook-Signature');

    // Log incoming webhook for debugging
    logInfo('Webhook received', {
      action: 'webhook_received_raw',
      metadata: {
        bodyLength: body.length,
        hasSignature: !!signature,
        headers: Object.fromEntries(request.headers.entries())
      }
    });

    // Verify webhook signature for security (can be skipped in development)
    if (!verifyWebhookSignature(body, signature)) {
      logError('Invalid GoHighLevel webhook signature', {
        action: 'webhook_verification_failed',
        metadata: {
          hasSignature: !!signature,
          hasSecret: !!GHL_WEBHOOK_SECRET,
          environment: process.env.NODE_ENV
        }
      });

      // Only reject in production
      if (!SKIP_SIGNATURE_CHECK) {
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        );
      }
    }

    // Parse the payload
    // GoHighLevel sends opportunityId in body (custom data) and property fields in headers
    let bodyData: any = {};
    try {
      bodyData = JSON.parse(body);
    } catch (parseError) {
      logWarn('Failed to parse body as JSON, will use headers only', {
        action: 'webhook_body_parse_warning',
        metadata: {
          error: (parseError as Error).message,
          bodyPreview: body.substring(0, 200)
        }
      });
    }

    // Read opportunityId from body first, fallback to header
    // GoHighLevel sends it as 'id', 'opportunityId', or in custom data
    const opportunityId = bodyData.opportunityId ||
                         bodyData.id ||
                         bodyData.customData?.opportunityId ||
                         request.headers.get('opportunityid') ||
                         request.headers.get('opportunityId');

    if (!opportunityId) {
      logError('No opportunityId found in body or headers', {
        action: 'missing_opportunity_id',
        metadata: {
          bodyKeys: Object.keys(bodyData),
          bodyIdField: bodyData.id,
          bodyOpportunityIdField: bodyData.opportunityId,
          headerKeys: Array.from(request.headers.keys()).slice(0, 20)
        }
      });
      return NextResponse.json(
        { error: 'opportunityId is required (send as id, opportunityId, or customData.opportunityId)' },
        { status: 400 }
      );
    }

    // Read all property data from HEADERS (where GoHighLevel sends it)
    const payload: GHLPropertyPayload = {
      opportunityId: opportunityId,
      opportunityName: request.headers.get('opportunityname') || request.headers.get('opportunityName') || '',
      propertyAddress: request.headers.get('propertyaddress') || request.headers.get('propertyAddress') || '',
      propertyCity: request.headers.get('propertycity') || request.headers.get('propertyCity') || '',
      state: request.headers.get('state') || '',
      zipCode: request.headers.get('zipcode') || request.headers.get('zipCode') || '',
      price: request.headers.get('price') || '0',
      bedrooms: request.headers.get('bedrooms') || '',
      bathrooms: request.headers.get('bathrooms') || '',
      livingArea: request.headers.get('livingarea') || request.headers.get('livingArea') || '',
      yearBuilt: request.headers.get('yearbuilt') || request.headers.get('yearBuilt') || '',
      lotSizes: request.headers.get('lotsizes') || request.headers.get('lotSizes') || '',
      homeType: request.headers.get('hometype') || request.headers.get('homeType') || 'SINGLE_FAMILY',
      imageLink: request.headers.get('imagelink') || request.headers.get('imageLink') || '',
      downPaymentAmount: request.headers.get('downpaymentamount') || request.headers.get('downPaymentAmount') || '',
      downPayment: request.headers.get('downpayment') || request.headers.get('downPayment') || '',
      interestRate: request.headers.get('interestrate') || request.headers.get('interestRate') || '',
      monthlyPayment: request.headers.get('monthlypayment') || request.headers.get('monthlyPayment') || '',
      balloon: request.headers.get('balloon') || ''
    };

    logInfo('GoHighLevel save property webhook parsed', {
      action: 'webhook_parsed',
      metadata: {
        opportunityId: payload.opportunityId,
        address: payload.propertyAddress,
        city: payload.propertyCity,
        price: payload.price
      }
    });

    // Parse numeric fields
    const price = parseNumberField(payload.price);

    // Validate required fields
    const validationErrors: string[] = [];

    if (!payload.opportunityId) {
      validationErrors.push('opportunityId is required');
    }
    if (!payload.propertyAddress || payload.propertyAddress.trim().length === 0) {
      validationErrors.push('propertyAddress is required');
    }
    if (!payload.propertyCity || payload.propertyCity.trim().length === 0) {
      validationErrors.push('propertyCity is required');
    }
    if (!payload.state) {
      validationErrors.push('state is required');
    }
    if (!price || price <= 0) {
      validationErrors.push('price must be greater than 0');
    }

    if (validationErrors.length > 0) {
      logWarn('Webhook validation failed', {
        action: 'webhook_validation_error',
        metadata: {
          errors: validationErrors,
          opportunityId: payload.opportunityId,
          receivedData: {
            opportunityId: payload.opportunityId,
            address: payload.propertyAddress,
            city: payload.propertyCity,
            state: payload.state,
            price: payload.price
          }
        }
      });
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationErrors
        },
        { status: 400 }
      );
    }

    // Use opportunity ID as the property ID to maintain consistency
    const propertyId = payload.opportunityId;

    // Check if property already exists
    let isUpdate = false;
    try {
      const existingDoc = await getDoc(doc(db, 'properties', propertyId));
      if (existingDoc.exists()) {
        isUpdate = true;
        logInfo(`Property with opportunity ID ${propertyId} already exists, updating`, {
          action: 'property_update',
          metadata: { propertyId }
        });
      }
    } catch (checkError) {
      logError('Error checking existing property', {
        action: 'property_check_error',
        metadata: { propertyId, error: (checkError as Error).message }
      }, checkError as Error);
    }

    // Process financial calculations - NO DEFAULTS, only use what's provided
    let downPaymentAmount = parseNumberField(payload.downPaymentAmount);
    let downPaymentPercent = parseNumberField(payload.downPayment);

    // Calculate down payment amount from percentage if percentage is provided
    if (!downPaymentAmount && downPaymentPercent && price) {
      downPaymentAmount = Math.round((downPaymentPercent / 100) * price);
    }

    // Calculate down payment percentage if we have amount but not percentage
    if (downPaymentAmount && !downPaymentPercent && price) {
      downPaymentPercent = (downPaymentAmount / price) * 100;
    }

    // Use provided monthly payment or calculate ONLY if we have interest rate
    let calculatedMonthlyPayment = parseNumberField(payload.monthlyPayment);
    const interestRate = parseNumberField(payload.interestRate);
    const termYears = 20; // Term years is still needed for calculation structure

    // Only calculate monthly payment if we have both interest rate AND down payment info
    if (!calculatedMonthlyPayment && interestRate > 0 && downPaymentAmount >= 0 && price) {
      const loanAmount = price - downPaymentAmount;
      const monthlyRate = interestRate / 100 / 12;
      const numPayments = termYears * 12;

      if (monthlyRate > 0 && loanAmount > 0) {
        calculatedMonthlyPayment = Math.round(
          loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
          (Math.pow(1 + monthlyRate, numPayments) - 1)
        );
      }
    }

    // Calculate balloon payment ONLY if we have balloon years AND interest rate
    let balloonPaymentAmount: number | null = null;
    const balloonYears = parseNumberField(payload.balloon);
    if (balloonYears > 0 && price > 0 && interestRate > 0 && downPaymentAmount >= 0) {
      const loanAmount = price - downPaymentAmount;
      const monthlyRate = interestRate / 100 / 12;
      const totalTermMonths = termYears * 12;
      const balloonMonths = balloonYears * 12;

      if (monthlyRate > 0 && loanAmount > 0 && balloonMonths < totalTermMonths) {
        // Calculate remaining balance after balloon years of payments
        const principalPaid = loanAmount *
          (Math.pow(1 + monthlyRate, balloonMonths) - 1) /
          (Math.pow(1 + monthlyRate, totalTermMonths) - 1);
        balloonPaymentAmount = Math.round(loanAmount - principalPaid);
      }
    }

    // Generate image URL if not provided
    let imageUrl = payload.imageLink || '';
    if (!imageUrl || !imageUrl.startsWith('http')) {
      const fullAddress = `${payload.propertyAddress}, ${payload.propertyCity}, ${payload.state}`;
      const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY || '';
      if (googleMapsKey) {
        imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encodeURIComponent(fullAddress)}&key=${googleMapsKey}`;
      }
    }

    // Determine property type
    const homeType = (payload.homeType || 'single-family').toLowerCase();
    let propertyType = 'single-family';
    if (homeType.includes('condo')) propertyType = 'condo';
    else if (homeType.includes('townhouse') || homeType.includes('town')) propertyType = 'townhouse';
    else if (homeType.includes('multi')) propertyType = 'multi-family';

    // Normalize location data
    const normalizedCity = normalizeCity(payload.propertyCity);
    const normalizedState = normalizeState(payload.state);
    const formattedAddress = formatStreetAddress(payload.propertyAddress);

    // Parse other numeric fields
    const bedrooms = Math.max(0, parseNumberField(payload.bedrooms));
    const bathrooms = Math.max(0, parseNumberField(payload.bathrooms));
    const squareFeet = Math.max(0, parseNumberField(payload.livingArea));
    const yearBuilt = parseNumberField(payload.yearBuilt);

    // Prepare property data for database
    const propertyData = {
      // IDs and Names
      id: propertyId,
      opportunityId: payload.opportunityId,
      opportunityName: payload.opportunityName || formattedAddress,

      // Location - all required fields
      address: formattedAddress,
      city: normalizedCity,
      state: normalizedState,
      zipCode: payload.zipCode?.trim() || '',

      // Pricing - required
      price: price,
      listPrice: price, // Components expect listPrice

      // Property Details - with defaults
      bedrooms: bedrooms,
      beds: bedrooms, // Some components use 'beds'
      bathrooms: bathrooms,
      baths: bathrooms, // Some components use 'baths'
      squareFeet: squareFeet,
      yearBuilt: yearBuilt || 0,
      lotSize: normalizeLotSize(payload.lotSizes || ''),
      propertyType,

      // Financial Details - all calculated
      monthlyPayment: calculatedMonthlyPayment,
      downPaymentAmount,
      downPaymentPercent,
      interestRate,
      termYears,
      balloonYears: balloonYears > 0 ? balloonYears : null,
      balloonPayment: balloonPaymentAmount,

      // Images
      imageUrls: imageUrl ? [imageUrl] : [],

      // Meta - required fields
      source: 'gohighlevel',
      status: 'active',
      isActive: true,
      featured: false,
      priority: 1,
      nearbyCities: [],

      // Timestamps
      updatedAt: serverTimestamp(),
      lastUpdated: new Date().toISOString()
    };

    // Add createdAt only for new properties
    if (!isUpdate) {
      Object.assign(propertyData, {
        createdAt: serverTimestamp(),
        dateAdded: new Date().toISOString()
      });
    }

    // Save to database
    try {
      await setDoc(
        doc(db, 'properties', propertyId),
        propertyData,
        { merge: isUpdate } // Merge for updates, overwrite for new
      );

      // Queue nearby cities calculation
      try {
        queueNearbyCitiesForProperty(propertyId, normalizedCity, normalizedState);
      } catch (queueError) {
        // Don't fail the webhook if queueing fails
        logWarn('Failed to queue nearby cities calculation', {
          action: 'nearby_cities_queue_error',
          metadata: {
            propertyId,
            error: (queueError as Error).message
          }
        });
      }

      logInfo(`Property ${isUpdate ? 'updated' : 'created'} successfully`, {
        action: isUpdate ? 'property_updated' : 'property_created',
        metadata: {
          propertyId,
          address: formattedAddress,
          city: normalizedCity,
          state: normalizedState,
          price: price
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          propertyId,
          address: formattedAddress,
          city: normalizedCity,
          state: normalizedState,
          price: price,
          message: isUpdate ? 'Property updated successfully' : 'Property created successfully'
        }
      });

    } catch (dbError) {
      logError('Failed to save property to database', {
        action: 'property_save_error',
        metadata: {
          propertyId,
          error: (dbError as Error).message
        }
      }, dbError as Error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save property to database',
          details: (dbError as Error).message
        },
        { status: 500 }
      );
    }

  } catch (error) {
    logError('Unexpected error in GoHighLevel save property webhook', {
      action: 'webhook_unexpected_error',
      metadata: {
        error: (error as Error).message,
        stack: (error as Error).stack
      }
    }, error as Error);

    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}