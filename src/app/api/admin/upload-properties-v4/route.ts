import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
  doc,
  serverTimestamp,
  writeBatch,
  collection,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';

// ==================== DATA NORMALIZATION FUNCTIONS ====================

/**
 * Normalize lot size to square feet
 * Handles: "10019", "1 acre", "0.5 acres", "43560 sqft", etc.
 */
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

/**
 * Normalize state codes to 2-letter uppercase
 */
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

/**
 * Clean and normalize city names
 */
function normalizeCity(city: string): string {
  if (!city) return '';

  // Fix common typos and normalize
  const cityFixes: Record<string, string> = {
    'bartlettt': 'Bartlett',
    'memphis': 'Memphis',
    'dallas': 'Dallas',
    'houston': 'Houston',
    'austin': 'Austin',
    'little rock': 'Little Rock',
    'fort worth': 'Fort Worth',
    'san antonio': 'San Antonio',
    'el paso': 'El Paso',
    'new york': 'New York',
    'los angeles': 'Los Angeles',
    'las vegas': 'Las Vegas',
    'san diego': 'San Diego',
    'san francisco': 'San Francisco',
    'san jose': 'San Jose',
    'corpus christi': 'Corpus Christi',
    'port arthur': 'Port Arthur',
    'grand prairie': 'Grand Prairie',
    'round rock': 'Round Rock',
    'cedar park': 'Cedar Park',
    'college station': 'College Station',
    'cape coral': 'Cape Coral',
    'st petersburg': 'St. Petersburg',
    'st. petersburg': 'St. Petersburg',
    'fort lauderdale': 'Fort Lauderdale',
    'west palm beach': 'West Palm Beach',
    'palm beach': 'Palm Beach',
    'miami beach': 'Miami Beach',
    'daytona beach': 'Daytona Beach',
    'panama city beach': 'Panama City Beach',
    'north port': 'North Port',
    'port charlotte': 'Port Charlotte',
    'punta gorda': 'Punta Gorda',
    'lake havasu city': 'Lake Havasu City'
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

/**
 * Format street address with proper capitalization
 * Examples:
 * - "123 main st" -> "123 Main St"
 * - "456 OAK AVE APT 2B" -> "456 Oak Ave Apt 2B"
 */
function formatStreetAddress(address: string): string {
  if (!address) return '';

  // Common abbreviations that should stay uppercase
  const keepUppercase = new Set(['NE', 'NW', 'SE', 'SW', 'N', 'S', 'E', 'W', 'APT', 'STE', 'UNIT']);

  // Common street suffixes and their proper format
  const streetSuffixes: Record<string, string> = {
    'street': 'St',
    'st': 'St',
    'avenue': 'Ave',
    'ave': 'Ave',
    'road': 'Rd',
    'rd': 'Rd',
    'boulevard': 'Blvd',
    'blvd': 'Blvd',
    'drive': 'Dr',
    'dr': 'Dr',
    'court': 'Ct',
    'ct': 'Ct',
    'circle': 'Cir',
    'cir': 'Cir',
    'lane': 'Ln',
    'ln': 'Ln',
    'place': 'Pl',
    'pl': 'Pl',
    'parkway': 'Pkwy',
    'pkwy': 'Pkwy',
    'highway': 'Hwy',
    'hwy': 'Hwy'
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

/**
 * Parse CSV line handling quoted fields properly
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote within quoted field
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add the last field
  result.push(current.trim());
  return result;
}

/**
 * Parse full address string and extract components
 * Examples:
 * - "123 Main St, Dallas, TX 75201" -> { street: "123 Main St", city: "Dallas", state: "TX", zip: "75201" }
 * - "456 Oak Ave" -> { street: "456 Oak Ave", city: "", state: "", zip: "" }
 */
function parseFullAddress(fullAddress: string): {
  street: string;
  city: string;
  state: string;
  zip: string;
} {
  if (!fullAddress) {
    return { street: '', city: '', state: '', zip: '' };
  }

  // Try to match pattern: "Street, City, State Zip"
  const pattern = /^([^,]+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?$/i;
  const match = fullAddress.match(pattern);

  if (match) {
    return {
      street: match[1].trim(),
      city: match[2].trim(),
      state: match[3].trim(),
      zip: match[4]?.trim() || ''
    };
  }

  // Try pattern without zip: "Street, City, State"
  const pattern2 = /^([^,]+),\s*([^,]+),\s*([A-Z]{2})$/i;
  const match2 = fullAddress.match(pattern2);

  if (match2) {
    return {
      street: match2[1].trim(),
      city: match2[2].trim(),
      state: match2[3].trim(),
      zip: ''
    };
  }

  // Try pattern with just city: "Street, City"
  const pattern3 = /^([^,]+),\s*([^,]+)$/;
  const match3 = fullAddress.match(pattern3);

  if (match3) {
    return {
      street: match3[1].trim(),
      city: match3[2].trim(),
      state: '',
      zip: ''
    };
  }

  // If no pattern matches, return the whole string as street
  return {
    street: fullAddress.trim(),
    city: '',
    state: '',
    zip: ''
  };
}

// ==================== FLEXIBLE COLUMN MAPPING ====================

interface PropertyData {
  id: string;
  opportunityName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  listPrice: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  yearBuilt: number;
  lotSize: number;
  propertyType: string;
  description: string;
  monthlyPayment: number;
  downPaymentAmount: number;
  downPaymentPercent: number;
  interestRate: number;
  termYears: number;
  balloonYears: number | null;
  balloonPayment?: number;
  imageUrl: string;
  source: string;
  status: string;
  isActive: boolean;
  featured: boolean;
  priority: number;
}

interface FailedRow {
  row: number;
  data: string[];
  reason: string;
  attemptedAddress?: string;
  attemptedCity?: string;
  attemptedState?: string;
  attemptedPrice?: string;
}

/**
 * Get column value by trying multiple possible header names
 */
function getColumnValue(
  row: Record<string, string>,
  possibleNames: string[]
): string {
  for (const name of possibleNames) {
    // Try exact match
    if (row[name] !== undefined) return row[name];

    // Try with trimmed spaces
    const trimmedName = name.trim();
    if (row[trimmedName] !== undefined) return row[trimmedName];

    // Try lowercase
    const lowerName = name.toLowerCase();
    if (row[lowerName] !== undefined) return row[lowerName];

    // Try with various combinations
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().trim() === lowerName ||
          key.toLowerCase().replace(/\s+/g, '') === lowerName.replace(/\s+/g, '')) {
        return row[key];
      }
    }
  }
  return '';
}

/**
 * Get numeric value with fallback to 0
 */
function getNumericValue(
  row: Record<string, string>,
  possibleNames: string[]
): number {
  const value = getColumnValue(row, possibleNames);
  if (!value) return 0;

  const cleaned = value.replace(/[,$]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Map CSV row to property data using flexible header mapping
 */
function mapRowToProperty(
  values: string[],
  headers: string[],
  rowNum: number
): { property: PropertyData | null; failedRow?: FailedRow } {
  // Create row object by mapping headers to values
  const row: Record<string, string> = {};

  // Map headers to values - NO NUMBERS, ONLY HEADER NAMES
  headers.forEach((header, index) => {
    const value = values[index]?.trim() || '';
    row[header] = value;  // Store with exact header name
    row[header.trim()] = value;  // Also store trimmed version for safety
  });

  // Extract values - headers may have trailing spaces
  let address = getColumnValue(row, [
    'Property Address'
  ]);

  let city = getColumnValue(row, [
    'Property city'
  ]);

  let state = getColumnValue(row, [
    'State ', 'state'  // New export uses 'State ' with capital and space
  ]);

  let zipCode = getColumnValue(row, [
    'zip code ', 'Zip code'  // New export uses 'zip code ' lowercase with space
  ]);

  // Check if address contains full address (street, city, state, zip)
  if (address && address.includes(',')) {
    const parsed = parseFullAddress(address);
    if (parsed.city || parsed.state || parsed.zip) {
      // Use parsed values, preferring them over separate columns if they exist
      address = parsed.street;
      city = city || parsed.city;
      state = state || parsed.state;
      zipCode = zipCode || parsed.zip;
    }
  }

  const price = getNumericValue(row, [
    'Price ', 'price'  // New export uses 'Price ' with capital and space
  ]);

  // Create failed row data for reporting
  const failedRowData: FailedRow = {
    row: rowNum,
    data: values,
    reason: '',
    attemptedAddress: address,
    attemptedCity: city,
    attemptedState: state,
    attemptedPrice: price.toString()
  };

  // Validation: Skip invalid rows
  if (!address || address.length === 0 ||
      address.includes('L0rztbd5CWyRY0Z2zXkT') ||
      (address.includes('-') && address.length === 36)) {
    failedRowData.reason = 'Invalid or missing address';
    return { property: null, failedRow: failedRowData };
  }

  if (!city || city === 'open' ||
      city.includes('L0rztbd5CWyRY0Z2zXkT') ||
      (city.includes('-') && city.length === 36)) {
    failedRowData.reason = 'Invalid or missing city';
    return { property: null, failedRow: failedRowData };
  }

  if (price <= 0) {
    failedRowData.reason = 'Invalid or missing price';
    return { property: null, failedRow: failedRowData };
  }

  // Generate or use existing ID and preserve Opportunity Name for GoHighLevel sync
  const opportunityId = getColumnValue(row, ['Opportunity ID', 'opportunity id', 'ID']);
  const opportunityName = getColumnValue(row, ['Opportunity Name', 'opportunity name']);
  const propertyId = opportunityId || `prop_${Date.now()}_${rowNum}_${Math.random().toString(36).substring(2, 11)}`;

  // Get all other fields
  // Match exact CSV column names (no trailing spaces on these)
  const bedrooms = Math.round(getNumericValue(row, ['bedrooms']));
  const bathrooms = getNumericValue(row, ['bathrooms']);

  const squareFeet = Math.round(getNumericValue(row, ['livingArea']));
  const yearBuilt = Math.round(getNumericValue(row, ['yearBuilt']));
  const lotSizeStr = getColumnValue(row, ['lot sizes', 'lot sizes ']);  // With trailing space
  // Skip description field to avoid CSV parsing issues
  // const description = getColumnValue(row, ['description', 'Description', 'notes']);
  // zipCode already declared above after address parsing

  // Financial fields
  // Financial fields - no trailing spaces after you fix headers
  let downPaymentAmount = getNumericValue(row, ['down payment amount']);
  const downPaymentPercent = getNumericValue(row, ['down payment']);
  const interestRate = getNumericValue(row, ['Interest rate']);
  const monthlyPayment = getNumericValue(row, ['Monthly payment']);
  const balloonYears = getNumericValue(row, ['Balloon']);

  // Calculate down payment amount from percentage if amount is missing
  if (!downPaymentAmount && downPaymentPercent && price) {
    downPaymentAmount = Math.round((downPaymentPercent / 100) * price);
  }

  // Calculate monthly payment if missing
  let calculatedMonthlyPayment = monthlyPayment;
  if (!calculatedMonthlyPayment && interestRate && downPaymentAmount && price) {
    const loanAmount = price - downPaymentAmount;
    const monthlyRate = interestRate / 100 / 12;
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

  // Get image URL or generate Street View URL
  let imageUrl = getColumnValue(row, ['Image link', 'image_link', 'imageUrl', 'photo']);
  if (!imageUrl || !imageUrl.startsWith('http')) {
    const fullAddress = `${address}, ${city}, ${state}`;
    imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encodeURIComponent(fullAddress)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  }

  // No balloon payment calculation - just store years until refinance

  // Determine property type
  const homeType = getColumnValue(row, ['homeType', 'Home Type', 'propertyType']).toLowerCase();
  let propertyType = 'single-family';
  if (homeType.includes('condo')) propertyType = 'condo';
  else if (homeType.includes('townhouse')) propertyType = 'townhouse';
  else if (homeType.includes('multi')) propertyType = 'multi-family';

  return {
    property: {
      id: propertyId,
      opportunityName: opportunityName || address, // Preserve for GoHighLevel sync
      address: formatStreetAddress(address),
      city: normalizeCity(city),
      state: normalizeState(state),
      zipCode: zipCode.trim(),
      price,
      listPrice: price,  // Component expects listPrice, not price!
      bedrooms,
      bathrooms,
      squareFeet,
      yearBuilt,
      lotSize: normalizeLotSize(lotSizeStr),
      propertyType,
      description: '', // Removed to avoid CSV parsing issues
      monthlyPayment: calculatedMonthlyPayment,
      downPaymentAmount,
      downPaymentPercent: downPaymentPercent || (downPaymentAmount && price ? (downPaymentAmount / price) * 100 : 0),
      interestRate,
      termYears: 20,
      balloonYears: balloonYears > 0 ? balloonYears : null,
      balloonPayment: null, // No longer calculated - just store years until refinance
      imageUrl,
      source: 'import',
      status: 'active',
      isActive: true,
      featured: false,
      priority: 1
    }
  };
}

/**
 * Generate simplified CSV with just failed addresses and reasons
 */
function generateFailureCSV(headers: string[], failedRows: FailedRow[]): string {
  // Simple headers - just what's needed
  const simpleHeaders = ['Row', 'Address', 'City', 'State', 'Zip', 'Price', 'Reason'];

  // Helper function to properly escape CSV fields
  const escapeCSVField = (field: any): string => {
    if (field === null || field === undefined) {
      return '';
    }

    const str = String(field);

    // Always quote fields that contain commas, quotes, or newlines
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      // Escape internal quotes by doubling them
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  };

  // Create CSV header
  let csv = simpleHeaders.map(escapeCSVField).join(',') + '\n';

  // Add failed rows with just essential info
  for (const failed of failedRows) {
    const rowArray: string[] = [];

    // Row number
    rowArray.push(escapeCSVField(failed.row));

    // Address info - try to extract from data
    const address = failed.attemptedAddress || '';
    const city = failed.attemptedCity || '';
    const state = failed.attemptedState || '';
    const zip = '';
    const price = failed.attemptedPrice || '';

    // Extract from already parsed attempted values
    // We already have these from the failed row data

    // Add the values
    rowArray.push(escapeCSVField(address));
    rowArray.push(escapeCSVField(city));
    rowArray.push(escapeCSVField(state));
    rowArray.push(escapeCSVField(zip));
    rowArray.push(escapeCSVField(price));
    rowArray.push(escapeCSVField(failed.reason));

    csv += rowArray.join(',') + '\n';
  }

  return csv;
}

// ==================== MAIN ROUTE HANDLER ====================

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Check admin access
    const session = await getServerSession(authOptions as unknown as Parameters<typeof getServerSession>[0]) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    if (!file.name.match(/\.(csv)$/i)) {
      return NextResponse.json(
        { error: 'File must be a CSV file (.csv)' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const csvText = buffer.toString('utf-8');
    const lines = csvText.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file is empty or has no data rows' },
        { status: 400 }
      );
    }

    // Parse headers
    const headers = parseCSVLine(lines[0]);

    await logInfo('Processing CSV file with failure tracking', {
      action: 'upload_properties_v4',
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        totalLines: lines.length,
        headerCount: headers.length
      }
    });

    // Process results
    const results = {
      success: [] as PropertyData[],
      errors: [] as FailedRow[],
      skipped: [] as FailedRow[],
      duplicates: [] as { row: number; id: string; data: string[] }[]
    };

    // Get existing property IDs to check for duplicates
    const existingIds = new Set<string>();
    try {
      const propertiesSnapshot = await getDocs(collection(db, 'properties'));
      propertiesSnapshot.forEach(doc => existingIds.add(doc.id));
    } catch (error) {
      console.error('Error fetching existing properties:', error);
    }

    // Process each row (skip header)
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);

        // Skip empty lines
        if (values.length < 10 || values.every(v => !v.trim())) {
          results.skipped.push({
            row: i,
            data: values,
            reason: 'Empty row'
          });
          continue;
        }

        // Map to property data
        const { property, failedRow } = mapRowToProperty(values, headers, i);

        if (!property) {
          if (failedRow) {
            results.skipped.push(failedRow);
          }
          continue;
        }

        // Check for duplicates
        if (existingIds.has(property.id)) {
          results.duplicates.push({
            row: i,
            id: property.id,
            data: values
          });
          continue;
        }

        // Final validation
        if (!property.address || !property.city || property.price <= 0) {
          results.errors.push({
            row: i,
            data: values,
            reason: `Invalid data: address="${property.address}", city="${property.city}", price=${property.price}`,
            attemptedAddress: property.address,
            attemptedCity: property.city,
            attemptedState: property.state,
            attemptedPrice: property.price.toString()
          });
          continue;
        }

        results.success.push(property);
        existingIds.add(property.id); // Prevent duplicates within same upload

      } catch (error) {
        results.errors.push({
          row: i,
          data: parseCSVLine(lines[i]),
          reason: (error as Error).message
        });
      }
    }

    // Insert properties into Firebase using batch writes
    const insertedProperties = [];
    const insertErrors = [];
    const BATCH_SIZE = 500; // Firebase limit

    for (let batchStart = 0; batchStart < results.success.length; batchStart += BATCH_SIZE) {
      const batch = writeBatch(db);
      const batchEnd = Math.min(batchStart + BATCH_SIZE, results.success.length);
      const batchProperties = results.success.slice(batchStart, batchEnd);
      const batchNumber = Math.floor(batchStart / BATCH_SIZE) + 1;


      try {
        for (const property of batchProperties) {
          const docRef = doc(db, 'properties', property.id);

          // Remove null/undefined values
          const cleanedProperty = Object.fromEntries(
            Object.entries(property).filter(([_, value]) => value !== null && value !== undefined)
          );


          // Convert to Firebase format with arrays for imageUrls
          const firebaseProperty = {
            ...cleanedProperty,
            imageUrls: property.imageUrl ? [property.imageUrl] : [],
            nearbyCities: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            dateAdded: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          };

          // Remove the single imageUrl field
          delete (firebaseProperty as any).imageUrl;

          batch.set(docRef, firebaseProperty);

          insertedProperties.push({
            id: property.id,
            address: property.address,
            city: property.city,
            state: property.state,
            price: property.price
          });
        }

        await batch.commit();

        // Skip nearby cities and image analysis for bulk uploads
        // This speeds up the upload process significantly

      } catch (error) {
        await logError(`Failed to insert batch starting at ${batchStart}`, {
          action: 'insert_property_batch_v4',
          metadata: {
            batchStart,
            batchEnd,
            error: (error as Error).message
          }
        }, error as Error);

        for (const property of batchProperties) {
          insertErrors.push({
            property: property.address,
            id: property.id,
            error: (error as Error).message
          });
        }
      }
    }

    // Generate failure report CSV including duplicates
    let failureReportUrl = null;

    // Convert duplicates to FailedRow format
    const duplicateFailures: FailedRow[] = results.duplicates.map(dup => ({
      row: dup.row,
      data: dup.data,
      reason: 'Duplicate - Property already exists with this ID',
      attemptedAddress: dup.data[18] || '',
      attemptedCity: dup.data[19] || '',
      attemptedState: dup.data[28] || '',
      attemptedPrice: dup.data[20] || ''
    }));

    const allFailures = [...results.skipped, ...results.errors, ...duplicateFailures];

    if (allFailures.length > 0) {
      const failureCSV = generateFailureCSV(headers, allFailures);
      const failureBuffer = Buffer.from(failureCSV, 'utf-8');
      const failureBase64 = failureBuffer.toString('base64');
      failureReportUrl = `data:text/csv;base64,${failureBase64}`;
    }

    await logInfo('CSV upload completed with failure report', {
      action: 'upload_properties_v4',
      metadata: {
        fileName: file.name,
        totalRows: lines.length - 1,
        successfulParsing: results.success.length,
        successfulInserts: insertedProperties.length,
        errors: results.errors.length,
        skipped: results.skipped.length,
        duplicates: results.duplicates.length,
        insertErrors: insertErrors.length,
        failureReportGenerated: failureReportUrl !== null
      }
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalRows: lines.length - 1,
        successfulParsing: results.success.length,
        successfulInserts: insertedProperties.length,
        errors: results.errors.length,
        skipped: results.skipped.length,
        duplicates: results.duplicates.length,
        insertErrors: insertErrors.length
      },
      details: {
        errors: results.errors.slice(0, 20),
        skipped: results.skipped.slice(0, 20),
        duplicates: results.duplicates.slice(0, 20),
        insertErrors: insertErrors.slice(0, 20),
        insertedProperties: insertedProperties.slice(0, 10)
      },
      failureReportUrl,
      failureReportFileName: allFailures.length > 0
        ? `failed_properties_${new Date().toISOString().split('T')[0]}.csv`
        : null
    });

  } catch (error) {
    await logError('CSV upload failed', {
      action: 'upload_properties_v4'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to process upload', details: (error as Error).message },
      { status: 500 }
    );
  }
}