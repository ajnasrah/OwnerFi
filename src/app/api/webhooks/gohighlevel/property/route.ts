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
import { validatePropertyFinancials, type PropertyFinancialData } from '@/lib/property-validation';
import crypto from 'crypto';

// SECURITY: Webhook secret is REQUIRED - no bypass allowed
const GHL_WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET;

// Simple in-memory rate limiter
const rateLimiter = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests
const RATE_WINDOW = 60 * 1000; // per minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimiter.get(ip);

  if (!record || now > record.resetTime) {
    rateLimiter.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Verify webhook signature using HMAC SHA-256
 * SECURITY: This function does NOT allow bypassing signature verification
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null
): { valid: boolean; reason?: string } {
  // CRITICAL: Secret is required - no production bypass
  if (!GHL_WEBHOOK_SECRET) {
    return {
      valid: false,
      reason: 'Server configuration error: GHL_WEBHOOK_SECRET not set'
    };
  }

  if (!signature) {
    return {
      valid: false,
      reason: 'Missing webhook signature header'
    };
  }

  try {
    // GoHighLevel might send signature in different formats
    const expectedSignature = crypto
      .createHmac('sha256', GHL_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    // Try multiple signature formats
    const validFormats = [
      signature === expectedSignature,
      signature === `sha256=${expectedSignature}`,
      signature.replace(/^sha256=/, '') === expectedSignature,
      signature === GHL_WEBHOOK_SECRET // Raw secret (some systems do this)
    ];

    if (validFormats.some(valid => valid)) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: 'Signature mismatch - invalid authentication'
    };
  } catch (error) {
    logError('Error verifying webhook signature', undefined, error as Error);
    return {
      valid: false,
      reason: 'Signature verification error'
    };
  }
}

// Helper functions from original webhook
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

function formatStreetAddress(address: string): string {
  if (!address) return '';

  const keepUppercase = new Set(['NE', 'NW', 'SE', 'SW', 'N', 'S', 'E', 'W', 'APT', 'STE', 'UNIT']);

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
  zipCode?: string;
  price: number | string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  livingArea?: number | string;
  yearBuilt?: number | string;
  lotSizes?: string;
  homeType?: string;
  imageLink?: string;
  description?: string;
  downPaymentAmount?: number | string;
  downPayment?: number | string;
  interestRate?: number | string;
  monthlyPayment?: number | string;
  termYears?: number | string;
  amortizationSchedule?: number | string;
  balloon?: number | string;
  zestimate?: number | string;
  rentZestimate?: number | string;
}

function parseNumberField(value: number | string | undefined): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value;

  const cleaned = String(value).replace(/[$,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();

  try {
    // 1. SECURITY: Get client IP for rate limiting and logging
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown';

    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 2. SECURITY: Rate limiting
    if (!checkRateLimit(clientIp)) {
      await logWarn('Rate limit exceeded for webhook', {
        action: 'webhook_rate_limit_exceeded',
        metadata: { ip: clientIp, userAgent }
      });

      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': RATE_LIMIT.toString(),
            'X-RateLimit-Window': (RATE_WINDOW / 1000).toString()
          }
        }
      );
    }

    // 3. SECURITY: Check database availability
    if (!db) {
      logError('Database not available', {
        action: 'webhook_db_unavailable',
        metadata: { ip: clientIp }
      });

      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }

    // 4. Parse request body
    const body = await request.text();

    // 5. SECURITY: Verify webhook signature (REQUIRED - NO BYPASS)
    const signature = request.headers.get('x-ghl-signature') ||
                     request.headers.get('X-GHL-Signature') ||
                     request.headers.get('x-webhook-signature') ||
                     request.headers.get('X-Webhook-Signature');

    const verification = verifyWebhookSignature(body, signature);

    if (!verification.valid) {
      await logError('Webhook signature verification failed', {
        action: 'webhook_auth_failed',
        metadata: {
          ip: clientIp,
          userAgent,
          reason: verification.reason,
          hasSignature: !!signature,
          hasSecret: !!GHL_WEBHOOK_SECRET,
          timestamp: new Date().toISOString()
        }
      });

      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Invalid or missing webhook signature',
          detail: verification.reason
        },
        {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Signature realm="GoHighLevel Webhook"'
          }
        }
      );
    }

    // 6. Log successful authentication
    await logInfo('Authenticated webhook request received', {
      action: 'webhook_authenticated',
      metadata: {
        ip: clientIp,
        userAgent,
        bodyLength: body.length
      }
    });

    // 7. Parse the payload
    let bodyData: any = {};
    try {
      bodyData = JSON.parse(body);
    } catch (parseError) {
      await logWarn('Failed to parse webhook body as JSON', {
        action: 'webhook_parse_error',
        metadata: {
          error: (parseError as Error).message,
          bodyPreview: body.substring(0, 200)
        }
      });
    }

    // 8. Extract opportunityId
    const opportunityId = bodyData.opportunityId ||
                         bodyData.id ||
                         bodyData.customData?.opportunityId ||
                         request.headers.get('opportunityid') ||
                         request.headers.get('opportunityId');

    if (!opportunityId) {
      await logError('No opportunityId in webhook payload', {
        action: 'webhook_missing_id',
        metadata: {
          bodyKeys: Object.keys(bodyData),
          ip: clientIp
        }
      });

      return NextResponse.json(
        { error: 'opportunityId is required' },
        { status: 400 }
      );
    }

    // 9. Build payload from headers and body
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

    await logInfo('Webhook payload parsed', {
      action: 'webhook_parsed',
      metadata: {
        opportunityId: payload.opportunityId,
        address: payload.propertyAddress,
        city: payload.propertyCity,
        price: payload.price
      }
    });

    // 10. Validate required fields
    const price = parseNumberField(payload.price);
    const validationErrors: string[] = [];

    if (!payload.opportunityId) validationErrors.push('opportunityId is required');
    if (!payload.propertyAddress || payload.propertyAddress.trim().length === 0) validationErrors.push('propertyAddress is required');
    if (!payload.propertyCity || payload.propertyCity.trim().length === 0) validationErrors.push('propertyCity is required');
    if (!payload.state) validationErrors.push('state is required');
    if (!price || price <= 0) validationErrors.push('price must be greater than 0');

    if (validationErrors.length > 0) {
      await logWarn('Webhook validation failed', {
        action: 'webhook_validation_error',
        metadata: {
          errors: validationErrors,
          opportunityId: payload.opportunityId,
          ip: clientIp
        }
      });

      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      );
    }

    // 11. Process property (rest of the logic from original webhook)
    const propertyId = payload.opportunityId;

    // Check if property exists
    let isUpdate = false;
    try {
      const existingDoc = await getDoc(doc(db, 'properties', propertyId));
      if (existingDoc.exists()) {
        isUpdate = true;
        await logInfo(`Property ${propertyId} already exists, updating`, {
          action: 'property_update_detected',
          metadata: { propertyId }
        });
      }
    } catch (checkError) {
      await logError('Error checking existing property', {
        action: 'property_check_error',
        metadata: { propertyId, error: (checkError as Error).message }
      }, checkError as Error);
    }

    // Process financials
    let downPaymentAmount = parseNumberField(payload.downPaymentAmount);
    let downPaymentPercent = parseNumberField(payload.downPayment);

    if (!downPaymentAmount && downPaymentPercent && price) {
      downPaymentAmount = Math.round((downPaymentPercent / 100) * price);
    }

    if (downPaymentAmount && !downPaymentPercent && price) {
      downPaymentPercent = (downPaymentAmount / price) * 100;
    }

    const providedMonthlyPayment = parseNumberField(payload.monthlyPayment);
    const providedInterestRate = parseNumberField(payload.interestRate);
    const providedTermYears = parseNumberField(payload.termYears || payload.amortizationSchedule);
    const balloonYears = parseNumberField(payload.balloon);

    const getDefaultTermYears = (listPrice: number): number => {
      if (listPrice < 150000) return 15;
      if (listPrice < 300000) return 20;
      if (listPrice < 600000) return 25;
      return 30;
    };

    const loanAmount = price - downPaymentAmount;
    let calculatedMonthlyPayment = 0;
    let calculatedInterestRate = providedInterestRate;
    let termYears = 0;
    let termYearsForCalculation = 0;

    if (providedMonthlyPayment > 0) {
      calculatedMonthlyPayment = providedMonthlyPayment;
      if (providedInterestRate > 0 && loanAmount > 0) {
        calculatedInterestRate = providedInterestRate;
        const { calculateTermYears: calcTermYears } = await import('@/lib/property-calculations');
        termYearsForCalculation = calcTermYears(providedMonthlyPayment, loanAmount, providedInterestRate);
        termYears = providedTermYears > 0 ? providedTermYears : 0;
      } else {
        calculatedInterestRate = 0;
        termYears = providedTermYears > 0 ? providedTermYears : 0;
      }
    } else if (providedInterestRate > 0 && providedTermYears > 0) {
      calculatedInterestRate = providedInterestRate;
      termYears = providedTermYears;
      termYearsForCalculation = providedTermYears;
      if (loanAmount > 0) {
        const monthlyRate = calculatedInterestRate / 100 / 12;
        const numPayments = termYearsForCalculation * 12;
        if (monthlyRate > 0) {
          calculatedMonthlyPayment = Math.round(
            loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
            (Math.pow(1 + monthlyRate, numPayments) - 1)
          );
        }
      }
    } else if (providedInterestRate > 0) {
      calculatedInterestRate = providedInterestRate;
      termYearsForCalculation = providedTermYears > 0 ? providedTermYears : getDefaultTermYears(price);
      termYears = providedTermYears > 0 ? providedTermYears : 0;
      if (loanAmount > 0) {
        const monthlyRate = calculatedInterestRate / 100 / 12;
        const numPayments = termYearsForCalculation * 12;
        if (monthlyRate > 0) {
          calculatedMonthlyPayment = Math.round(
            loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
            (Math.pow(1 + monthlyRate, numPayments) - 1)
          );
        }
      }
    } else {
      calculatedInterestRate = 0;
      termYearsForCalculation = providedTermYears > 0 ? providedTermYears : getDefaultTermYears(price);
      termYears = providedTermYears > 0 ? providedTermYears : 0;
    }

    // Generate image URL if needed
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

    // Parse other fields
    const bedrooms = Math.max(0, parseNumberField(payload.bedrooms));
    const bathrooms = Math.max(0, parseNumberField(payload.bathrooms));
    const squareFeet = Math.max(0, parseNumberField(payload.livingArea));
    const yearBuilt = parseNumberField(payload.yearBuilt);
    const zestimate = parseNumberField(payload.zestimate);
    const rentZestimate = parseNumberField(payload.rentZestimate);

    // Prepare property data
    const propertyData: any = {
      id: propertyId,
      opportunityId: payload.opportunityId,
      opportunityName: payload.opportunityName || formattedAddress,
      address: formattedAddress,
      city: normalizedCity,
      state: normalizedState,
      zipCode: payload.zipCode?.trim() || '',
      price: price,
      listPrice: price,
      bedrooms: bedrooms,
      beds: bedrooms,
      bathrooms: bathrooms,
      baths: bathrooms,
      squareFeet: squareFeet,
      yearBuilt: yearBuilt || 0,
      lotSize: normalizeLotSize(payload.lotSizes || ''),
      propertyType,
      description: sanitizeDescription(payload.description),
      estimatedValue: zestimate > 0 ? zestimate : undefined,
      rentZestimate: rentZestimate > 0 ? rentZestimate : undefined,
      monthlyPayment: calculatedMonthlyPayment,
      downPaymentAmount,
      downPaymentPercent,
      interestRate: calculatedInterestRate,
      termYears,
      balloonYears: balloonYears > 0 ? balloonYears : null,
      balloonPayment: null,
      imageUrls: imageUrl ? [imageUrl] : [],
      source: 'gohighlevel',
      status: 'active',
      isActive: true,
      featured: false,
      priority: 1,
      nearbyCities: [],
      updatedAt: serverTimestamp(),
      lastUpdated: new Date().toISOString()
    };

    if (!isUpdate) {
      Object.assign(propertyData, {
        createdAt: serverTimestamp(),
        dateAdded: new Date().toISOString()
      });
    }

    // Validate financials
    const validationData: PropertyFinancialData = {
      listPrice: price,
      monthlyPayment: calculatedMonthlyPayment,
      downPaymentAmount,
      downPaymentPercent,
      interestRate: calculatedInterestRate,
      termYears,
      address: formattedAddress,
      city: normalizedCity,
      state: normalizedState
    };

    const validation = validatePropertyFinancials(validationData);

    if (validation.needsReview) {
      propertyData.needsReview = true;
      propertyData.reviewReasons = validation.issues.map(issue => {
        const reason: any = {
          field: issue.field,
          issue: issue.issue,
          severity: issue.severity,
          actualValue: issue.actualValue
        };
        if (issue.expectedRange) reason.expectedRange = issue.expectedRange;
        if (issue.suggestion) reason.suggestion = issue.suggestion;
        return reason;
      });

      await logWarn(`Property has validation issues: ${formattedAddress}`, {
        action: 'property_validation_warning',
        metadata: {
          opportunityId: payload.opportunityId,
          address: formattedAddress,
          issues: validation.issues
        }
      });
    } else {
      propertyData.needsReview = false;
      propertyData.reviewReasons = [];
    }

    if (validation.shouldAutoReject) {
      const issueDetails = validation.issues
        .map(i => `${i.field}: ${i.issue}`)
        .join('; ');

      await logError('Property auto-rejected due to validation', {
        action: 'property_validation_rejected',
        metadata: {
          opportunityId: payload.opportunityId,
          address: formattedAddress,
          reason: issueDetails,
          issues: validation.issues
        }
      });

      return NextResponse.json(
        {
          error: 'Property validation failed',
          details: validation.issues,
          message: 'Property has critical financial validation errors and was rejected'
        },
        { status: 400 }
      );
    }

    // Auto-cleanup
    const cleanedData = autoCleanPropertyData({
      address: propertyData.address,
      city: propertyData.city,
      state: propertyData.state,
      zipCode: propertyData.zipCode,
      imageUrls: propertyData.imageUrls
    });

    if (cleanedData.address) {
      propertyData.address = cleanedData.address;
    }
    if (cleanedData.imageUrls && cleanedData.imageUrls.length > 0) {
      propertyData.imageUrls = cleanedData.imageUrls;
    }
    if (cleanedData.imageEnhanced !== undefined) {
      propertyData.imageEnhanced = cleanedData.imageEnhanced;
    }
    if (cleanedData.imageEnhancedAt) {
      propertyData.imageEnhancedAt = cleanedData.imageEnhancedAt;
    }

    // Strip undefined values
    const cleanPropertyData = Object.fromEntries(
      Object.entries(propertyData).filter(([_, value]) => value !== undefined)
    );

    // Save to database
    try {
      await setDoc(
        doc(db, 'properties', propertyId),
        cleanPropertyData,
        { merge: isUpdate }
      );

      // Queue nearby cities calculation
      try {
        queueNearbyCitiesForProperty(propertyId, {
          address: propertyData.address,
          city: propertyData.city,
          state: propertyData.state,
          zipCode: propertyData.zipCode || undefined
        });
      } catch (queueError) {
        await logWarn('Failed to queue nearby cities calculation', {
          action: 'nearby_cities_queue_error',
          metadata: {
            propertyId,
            error: (queueError as Error).message
          }
        });
      }

      await logInfo(`Property ${isUpdate ? 'updated' : 'created'} successfully`, {
        action: isUpdate ? 'property_updated' : 'property_created',
        metadata: {
          propertyId,
          address: formattedAddress,
          city: normalizedCity,
          state: normalizedState,
          price: price,
          processingTimeMs: Date.now() - requestStartTime
        }
      });

      // Auto-add to rotation queue
      if (propertyData.status === 'active' && propertyData.isActive && propertyData.imageUrls && propertyData.imageUrls.length > 0) {
        try {
          const { addToPropertyRotationQueue } = await import('@/lib/feed-store-firestore');
          addToPropertyRotationQueue(propertyId)
            .then(() => {
              console.log(`✅ Added ${propertyId} to rotation queue`);
            })
            .catch(err => {
              console.error(`❌ Failed to add property to queue:`, err);
            });
        } catch (error) {
          console.error('Error triggering auto-add to queue:', error);
        }
      }

      // Trigger buyer matching
      if (propertyData.status === 'active' && propertyData.isActive) {
        try {
          const { collection: firestoreCollection, query: firestoreQuery, where: firestoreWhere, getDocs: firestoreGetDocs, updateDoc, doc: firestoreDoc, arrayUnion, serverTimestamp: firestoreServerTimestamp } = await import('firebase/firestore');

          const relevantBuyersQuery = firestoreQuery(
            firestoreCollection(db, 'buyerProfiles'),
            firestoreWhere('preferredState', '==', cleanPropertyData.state),
            firestoreWhere('isActive', '==', true)
          );

          const buyerDocs = await firestoreGetDocs(relevantBuyersQuery);
          const matchedBuyers: any[] = [];

          for (const buyerDoc of buyerDocs.docs) {
            const buyerData = buyerDoc.data();
            const criteria = buyerData.searchCriteria || {};
            const buyerCities = criteria.cities || [buyerData.preferredCity];

            const locationMatch = buyerCities.some((cityName: string) =>
              cleanPropertyData.city.toLowerCase() === cityName.toLowerCase()
            );

            if (!locationMatch) continue;

            const maxMonthly = criteria.maxMonthlyPayment || buyerData.maxMonthlyPayment || 0;
            const maxDown = criteria.maxDownPayment || buyerData.maxDownPayment || 0;
            const monthlyMatch = cleanPropertyData.monthlyPayment <= maxMonthly;
            const downMatch = cleanPropertyData.downPaymentAmount <= maxDown;
            const budgetMatch = monthlyMatch || downMatch;

            if (!budgetMatch) continue;

            const requirementsMatch =
              (!buyerData.minBedrooms || cleanPropertyData.bedrooms >= buyerData.minBedrooms) &&
              (!buyerData.minBathrooms || cleanPropertyData.bathrooms >= buyerData.minBathrooms);

            if (!requirementsMatch) continue;

            const buyerRef = firestoreDoc(db, 'buyerProfiles', buyerDoc.id);
            await updateDoc(buyerRef, {
              matchedPropertyIds: arrayUnion(propertyId),
              lastMatchUpdate: firestoreServerTimestamp(),
              updatedAt: firestoreServerTimestamp()
            });

            matchedBuyers.push({ ...buyerData, id: buyerDoc.id });
          }

          if (matchedBuyers.length > 0) {
            const ghlWebhookUrl = process.env.GOHIGHLEVEL_WEBHOOK_URL;

            if (ghlWebhookUrl) {
              for (const buyer of matchedBuyers) {
                try {
                  const smsMessage = `🏠 New Property Match!

Hi ${buyer.firstName}! We found a home for you in ${cleanPropertyData.city}, ${cleanPropertyData.state}:

📍 ${cleanPropertyData.address}
🛏️ ${cleanPropertyData.bedrooms} bed, ${cleanPropertyData.bathrooms} bath
💰 $${cleanPropertyData.price?.toLocaleString()} list price
💵 $${cleanPropertyData.monthlyPayment}/mo, $${cleanPropertyData.downPaymentAmount?.toLocaleString()} down

View it now: https://ownerfi.ai/dashboard

Reply STOP to unsubscribe`;

                  await fetch(ghlWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      phone: buyer.phone,
                      message: smsMessage,
                      buyerId: buyer.id,
                      buyerName: `${buyer.firstName} ${buyer.lastName}`,
                      propertyId: propertyId,
                      propertyAddress: cleanPropertyData.address,
                      trigger: isUpdate ? 'buyer_criteria_changed' : 'new_property_added',
                    }),
                  });
                } catch (err) {
                  console.error(`❌ Error sending notification to ${buyer.phone}:`, err);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error in buyer matching:', error);
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          propertyId,
          address: formattedAddress,
          city: normalizedCity,
          state: normalizedState,
          price: price,
          message: isUpdate ? 'Property updated successfully' : 'Property created successfully',
          processingTimeMs: Date.now() - requestStartTime
        }
      }, {
        headers: {
          'X-Processing-Time': `${Date.now() - requestStartTime}ms`,
          'X-Property-Id': propertyId
        }
      });

    } catch (dbError) {
      await logError('Failed to save property to database', {
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
    await logError('Unexpected error in webhook', {
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

// Block all other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405, headers: { 'Allow': 'POST' } }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405, headers: { 'Allow': 'POST' } }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405, headers: { 'Allow': 'POST' } }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405, headers: { 'Allow': 'POST' } }
  );
}
