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
import { autoCleanPropertyData } from '@/lib/property-auto-cleanup';
import { sanitizeDescription } from '@/lib/description-sanitizer';
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
  description?: string;
  downPaymentAmount?: number | string;
  downPayment?: number | string; // Percentage
  interestRate?: number | string;
  monthlyPayment?: number | string;
  termYears?: number | string; // Amortization schedule term in years
  amortizationSchedule?: number | string; // Alternative field name for term years
  balloon?: number | string; // Years
  zestimate?: number | string; // Zillow home value estimate
  rentZestimate?: number | string; // Zillow rental estimate
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
    // BUT ALSO check body for fields that might be there instead (like description)
    const payload: GHLPropertyPayload = {
      opportunityId: opportunityId,
      opportunityName: request.headers.get('opportunityname') || request.headers.get('opportunityName') || bodyData.opportunityName || '',
      propertyAddress: request.headers.get('propertyaddress') || request.headers.get('propertyAddress') || bodyData.propertyAddress || bodyData.address || '',
      propertyCity: request.headers.get('propertycity') || request.headers.get('propertyCity') || bodyData.propertyCity || bodyData.city || '',
      state: request.headers.get('state') || bodyData.state || '',
      zipCode: request.headers.get('zipcode') || request.headers.get('zipCode') || bodyData.zipCode || bodyData.zip || '',
      price: request.headers.get('price') || bodyData.price || '0',
      bedrooms: request.headers.get('bedrooms') || bodyData.bedrooms || bodyData.beds || '',
      bathrooms: request.headers.get('bathrooms') || bodyData.bathrooms || bodyData.baths || '',
      livingArea: request.headers.get('livingarea') || request.headers.get('livingArea') || bodyData.livingArea || bodyData.squareFeet || '',
      yearBuilt: request.headers.get('yearbuilt') || request.headers.get('yearBuilt') || bodyData.yearBuilt || '',
      lotSizes: request.headers.get('lotsizes') || request.headers.get('lotSizes') || bodyData.lotSizes || bodyData.lotSize || '',
      homeType: request.headers.get('hometype') || request.headers.get('homeType') || bodyData.homeType || bodyData.propertyType || 'SINGLE_FAMILY',
      imageLink: request.headers.get('imagelink') || request.headers.get('imageLink') || bodyData.imageLink || bodyData.image || bodyData.imageUrl || '',
      description: request.headers.get('description') || request.headers.get('propertyDescription') || request.headers.get('propertydescription') || bodyData.description || bodyData.propertyDescription || bodyData.notes || '',
      downPaymentAmount: request.headers.get('downpaymentamount') || request.headers.get('downPaymentAmount') || bodyData.downPaymentAmount || '',
      downPayment: request.headers.get('downpayment') || request.headers.get('downPayment') || bodyData.downPayment || bodyData.downPaymentPercent || '',
      interestRate: request.headers.get('interestrate') || request.headers.get('interestRate') || bodyData.interestRate || '',
      monthlyPayment: request.headers.get('monthlypayment') || request.headers.get('monthlyPayment') || bodyData.monthlyPayment || '',
      termYears: request.headers.get('termyears') || request.headers.get('termYears') || bodyData.termYears || '',
      amortizationSchedule: request.headers.get('amortizationschedule') || request.headers.get('amortizationSchedule') || bodyData.amortizationSchedule || '',
      balloon: request.headers.get('balloon') || bodyData.balloon || bodyData.balloonYears || '',
      zestimate: request.headers.get('zestimate') || request.headers.get('propertyZestimate') || bodyData.zestimate || bodyData.estimatedValue || '',
      rentZestimate: request.headers.get('rentzestimate') || request.headers.get('rentZestimate') || request.headers.get('propertyRentZestimate') || bodyData.rentZestimate || bodyData.rent_estimate || ''
    };

    logInfo('GoHighLevel save property webhook parsed', {
      action: 'webhook_parsed',
      metadata: {
        opportunityId: payload.opportunityId,
        address: payload.propertyAddress,
        city: payload.propertyCity,
        price: payload.price,
        hasDescription: !!payload.description,
        descriptionLength: payload.description?.length || 0,
        descriptionSource: payload.description ?
          (request.headers.get('description') ? 'header:description' :
           request.headers.get('propertyDescription') ? 'header:propertyDescription' :
           request.headers.get('propertydescription') ? 'header:propertydescription' :
           bodyData.description ? 'body:description' :
           bodyData.propertyDescription ? 'body:propertyDescription' :
           bodyData.notes ? 'body:notes' : 'unknown') : 'MISSING'
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

    // Process financial calculations with priority logic
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

    // Parse financial fields
    const providedMonthlyPayment = parseNumberField(payload.monthlyPayment);
    const providedInterestRate = parseNumberField(payload.interestRate);
    const providedTermYears = parseNumberField(payload.termYears || payload.amortizationSchedule);
    const balloonYears = parseNumberField(payload.balloon);

    // Dynamic amortization based on price (fallback)
    const getDefaultTermYears = (listPrice: number): number => {
      if (listPrice < 150000) return 15;
      if (listPrice < 300000) return 20;
      if (listPrice < 600000) return 25;
      return 30;
    };

    // Calculate loan amount
    const loanAmount = price - downPaymentAmount;

    // PRIORITY CALCULATION LOGIC
    let calculatedMonthlyPayment = 0;
    let calculatedInterestRate = providedInterestRate; // Track calculated vs provided
    let termYears = 0;

    if (providedMonthlyPayment > 0) {
      // PRIORITY 1: Monthly payment provided - use it directly
      calculatedMonthlyPayment = providedMonthlyPayment;

      if (providedInterestRate > 0 && loanAmount > 0) {
        // If we have interest rate, calculate term from monthly payment
        calculatedInterestRate = providedInterestRate;
        const { calculateTermYears } = await import('@/lib/property-calculations');
        termYears = calculateTermYears(providedMonthlyPayment, loanAmount, providedInterestRate);
      } else {
        // No interest rate provided - leave as 0 (will show as N/A in UI)
        calculatedInterestRate = 0;
        termYears = providedTermYears > 0 ? providedTermYears : getDefaultTermYears(price);
      }

    } else if (providedInterestRate > 0 && providedTermYears > 0) {
      // PRIORITY 2: Interest rate + term years provided - calculate monthly payment
      calculatedInterestRate = providedInterestRate;
      termYears = providedTermYears;
      if (loanAmount > 0) {
        const monthlyRate = calculatedInterestRate / 100 / 12;
        const numPayments = termYears * 12;
        if (monthlyRate > 0) {
          calculatedMonthlyPayment = Math.round(
            loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
            (Math.pow(1 + monthlyRate, numPayments) - 1)
          );
        }
      }

    } else if (providedInterestRate > 0) {
      // PRIORITY 3: Only interest rate provided - use price-based term
      calculatedInterestRate = providedInterestRate;
      termYears = getDefaultTermYears(price);
      if (loanAmount > 0) {
        const monthlyRate = calculatedInterestRate / 100 / 12;
        const numPayments = termYears * 12;
        if (monthlyRate > 0) {
          calculatedMonthlyPayment = Math.round(
            loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
            (Math.pow(1 + monthlyRate, numPayments) - 1)
          );
        }
      }

    } else {
      // PRIORITY 4: Nothing provided - no defaults
      calculatedInterestRate = 0; // Leave as 0 (will show as N/A in UI)
      termYears = providedTermYears > 0 ? providedTermYears : getDefaultTermYears(price);
      // No calculation without provided data
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
    const zestimate = parseNumberField(payload.zestimate);
    const rentZestimate = parseNumberField(payload.rentZestimate);

    // Prepare property data for database
    const propertyData: any = {
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
      description: sanitizeDescription(payload.description), // Sanitize description for safety

      // Market Data
      estimatedValue: zestimate > 0 ? zestimate : undefined,
      rentZestimate: rentZestimate > 0 ? rentZestimate : undefined,

      // Financial Details - all calculated
      monthlyPayment: calculatedMonthlyPayment,
      downPaymentAmount,
      downPaymentPercent,
      interestRate: calculatedInterestRate, // Use calculated value
      termYears,
      balloonYears: balloonYears > 0 ? balloonYears : null,
      balloonPayment: null, // No longer calculated - just store years until refinance

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

    // Auto-cleanup: Clean address and upgrade image URLs
    const cleanedData = autoCleanPropertyData({
      address: propertyData.address,
      city: propertyData.city,
      state: propertyData.state,
      zipCode: propertyData.zipCode,
      imageUrls: propertyData.imageUrls
    });

    // Apply cleaned data
    if (cleanedData.address) {
      propertyData.address = cleanedData.address;
    }
    if (cleanedData.imageUrls && cleanedData.imageUrls.length > 0) {
      propertyData.imageUrls = cleanedData.imageUrls;
    }
    // Mark images as enhanced (set by auto-cleanup)
    if (cleanedData.imageEnhanced !== undefined) {
      propertyData.imageEnhanced = cleanedData.imageEnhanced;
    }
    if (cleanedData.imageEnhancedAt) {
      propertyData.imageEnhancedAt = cleanedData.imageEnhancedAt;
    }

    // Strip undefined values to prevent Firestore errors
    const cleanPropertyData = Object.fromEntries(
      Object.entries(propertyData).filter(([_, value]) => value !== undefined)
    );

    // Save to database
    try {
      await setDoc(
        doc(db, 'properties', propertyId),
        cleanPropertyData,
        { merge: isUpdate } // Merge for updates, overwrite for new
      );

      // Queue nearby cities calculation with full property data
      try {
        queueNearbyCitiesForProperty(propertyId, {
          address: propertyData.address,
          city: propertyData.city,
          state: propertyData.state,
          zipCode: propertyData.zipCode || undefined
          // Note: latitude/longitude not available from GHL webhook - will be geocoded if needed
        });
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

      // Auto-add to property rotation queue (non-blocking)
      // Only if property is active and has images
      if (propertyData.status === 'active' && propertyData.isActive && propertyData.imageUrls && propertyData.imageUrls.length > 0) {
        try {
          // Import the function directly instead of making HTTP call
          const { addToPropertyRotationQueue } = await import('@/lib/feed-store-firestore');

          console.log(`🎥 Auto-adding property ${propertyId} to video queue`);

          // Add to queue directly (non-blocking - don't await)
          addToPropertyRotationQueue(propertyId)
            .then(() => {
              console.log(`   ✅ Successfully added ${propertyId} to rotation queue`);
            })
            .catch(err => {
              console.error(`   ❌ Failed to auto-add property to queue:`, err);
            });
        } catch (error) {
          console.error('Error triggering auto-add to queue:', error);
          // Don't fail property creation if queue add fails
        }
      } else {
        console.log(`   ⏭️  Skipping queue add for ${propertyId}: status=${propertyData.status}, isActive=${propertyData.isActive}, hasImages=${!!(propertyData.imageUrls && propertyData.imageUrls.length > 0)}`);
      }

      // Trigger buyer matching and notifications
      // This will find all buyers that match this property and send SMS notifications
      // IMPORTANT: We MUST await this in serverless to ensure it completes before function terminates
      if (propertyData.status === 'active' && propertyData.isActive) {
        try {
          console.log(`🔔 Triggering buyer matching for ${isUpdate ? 'updated' : 'new'} property ${propertyId}`);

          // Import and call the matching logic directly
          const { collection: firestoreCollection, query: firestoreQuery, where: firestoreWhere, getDocs: firestoreGetDocs, updateDoc, doc: firestoreDoc, arrayUnion, serverTimestamp: firestoreServerTimestamp } = await import('firebase/firestore');

          // Get relevant buyers in the same state
          const relevantBuyersQuery = firestoreQuery(
            firestoreCollection(db, 'buyerProfiles'),
            firestoreWhere('preferredState', '==', cleanPropertyData.state),
            firestoreWhere('isActive', '==', true)
          );

          const buyerDocs = await firestoreGetDocs(relevantBuyersQuery);
          console.log(`   Found ${buyerDocs.size} buyers in ${cleanPropertyData.state}`);

          const matchedBuyers: any[] = [];

          // Check each buyer for match
          for (const buyerDoc of buyerDocs.docs) {
            const buyerData = buyerDoc.data();
            const criteria = buyerData.searchCriteria || {};
            const buyerCities = criteria.cities || [buyerData.preferredCity];

            // Check location match
            const locationMatch = buyerCities.some((cityName: string) =>
              cleanPropertyData.city.toLowerCase() === cityName.toLowerCase()
            );

            if (!locationMatch) continue;

            // Check budget match (OR logic)
            const maxMonthly = criteria.maxMonthlyPayment || buyerData.maxMonthlyPayment || 0;
            const maxDown = criteria.maxDownPayment || buyerData.maxDownPayment || 0;
            const monthlyMatch = cleanPropertyData.monthlyPayment <= maxMonthly;
            const downMatch = cleanPropertyData.downPaymentAmount <= maxDown;
            const budgetMatch = monthlyMatch || downMatch;

            if (!budgetMatch) continue;

            // Check requirements
            const requirementsMatch =
              (!buyerData.minBedrooms || cleanPropertyData.bedrooms >= buyerData.minBedrooms) &&
              (!buyerData.minBathrooms || cleanPropertyData.bathrooms >= buyerData.minBathrooms);

            if (!requirementsMatch) continue;

            // This buyer matches! Add property to their matches
            const buyerRef = firestoreDoc(db, 'buyerProfiles', buyerDoc.id);
            await updateDoc(buyerRef, {
              matchedPropertyIds: arrayUnion(propertyId),
              lastMatchUpdate: firestoreServerTimestamp(),
              updatedAt: firestoreServerTimestamp()
            });

            matchedBuyers.push({ ...buyerData, id: buyerDoc.id });
          }

          console.log(`   ✅ Matched ${matchedBuyers.length} buyers`);

          // Send notifications if we have matches
          if (matchedBuyers.length > 0) {
            console.log(`   📱 Sending SMS notifications to ${matchedBuyers.length} buyers...`);

            const { sendBatchPropertyMatchNotifications } = await import('@/lib/gohighlevel-notifications');
            const result = await sendBatchPropertyMatchNotifications(
              { ...cleanPropertyData, id: propertyId } as any,
              matchedBuyers,
              isUpdate ? 'buyer_criteria_changed' : 'new_property_added'
            );

            console.log(`   ✅ Notifications: ${result.sent} sent, ${result.failed} failed`);
          }

        } catch (error) {
          console.error('Error in buyer matching:', error);
          // Don't fail property creation if matching fails
        }
      } else {
        console.log(`   ⏭️  Skipping buyer matching for ${propertyId}: status=${propertyData.status}, isActive=${propertyData.isActive}`);
      }

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