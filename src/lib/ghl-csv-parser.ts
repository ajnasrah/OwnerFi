// CSV Parser for GoHighLevel Property Template
// Maps your exact CSV columns to property data

import { Property } from './mock-data';
import { 
  calculatePropertyFinancials, 
  validatePropertyFinancials 
} from './property-calculations';
import { 
  parseAddress, 
  getStreetViewImageByAddress,
  enhancePropertyWithGoogleMaps 
} from './google-maps-service';

export interface GHLCSVRow {
  'Opportunity Name': string;
  'Contact Name': string;
  phone: string;
  email: string;
  pipeline: string;
  stage: string;
  'Lead Value': string;
  source: string;
  assigned: string;
  'Created on': string;
  'Updated on': string;
  'lost reason ID': string;
  'lost reason name': string;
  Followers: string;
  Notes: string;
  tags: string;
  'Engagement Score': string;
  status: string;
  'Property Address ': string;
  'Property city ': string;
  'price ': string;
  'description ': string;
  yearBuilt: string;
  bedrooms: string;
  bathrooms: string;
  livingArea: string;
  homeType: string;
  daysOnZillow: string;
  state: string;
  'Balloon ': string;
  'Interest rate ': string;
  'down payment amount ': string;
  'down payment ': string;
  'Monthly payment ': string;
  'Zip code ': string;
  'lot sizes ': string;
  'Buyers Compensation ': string;
  'Image link ': string;
  'Opportunity ID': string;
  'Contact ID': string;
  'Pipeline Stage ID': string;
  'Pipeline ID': string;
  'Days Since Last Stage Change Date ': string;
  'Days Since Last Status Change Date ': string;
  'Days Since Last Updated ': string;
}

export async function parseGHLCSV(csvContent: string): Promise<{
  success: Property[];
  errors: string[];
  totalRows: number;
}> {
  const success: Property[] = [];
  const errors: string[] = [];
  
  // Parse CSV content handling multi-line descriptions
  const allRows = parseCSVContent(csvContent);
  
  if (allRows.length < 2) {
    return { success, errors: ['CSV file is empty or has no data rows'], totalRows: 0 };
  }

  // Get headers and clean them
  const headers = allRows[0].map(h => h.trim().replace(/\s+/g, ' '));
  
  console.log('CSV Headers found:', headers);
  
  // Validate required columns - only need address and price
  const requiredColumnPatterns = [
    /Property Address/i,
    /price/i
  ];
  
  const missingColumns = [];
  requiredColumnPatterns.forEach((pattern, index) => {
    const found = headers.some(header => pattern.test(header));
    if (!found) {
      const columnNames = ['Property Address', 'price'];
      missingColumns.push(columnNames[index]);
    }
  });
  
  if (missingColumns.length > 0) {
    return { 
      success, 
      errors: [`Missing required columns: ${missingColumns.join(', ')}`], 
      totalRows: allRows.length - 1 
    };
  }

  // Process each data row (skip header row)
  for (let i = 1; i < allRows.length; i++) {
    try {
      const values = allRows[i];
      const rowData: any = {};
      
      // Map values to headers
      headers.forEach((header, index) => {
        rowData[header] = values[index] || '';
      });

      // Skip completely empty rows
      const hasAnyData = values.some(val => val && val.trim());
      if (!hasAnyData) {
        continue;
      }

      // Extract and validate property data (now async)
      const propertyData = await mapGHLRowToProperty(rowData, i + 1, headers);
      if (propertyData) {
        success.push(propertyData);
      }
    } catch (error) {
      // Log error but continue processing - don't stop for individual failures
      errors.push(`Row ${i + 1}: ${(error as Error).message}`);
      console.warn(`Skipping row ${i + 1}:`, error);
    }
  }

  return { success, errors, totalRows: allRows.length - 1 };
}

function parseCSVContent(csvContent: string): string[][] {
  const lines = [];
  let currentLine = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  
  // Add the last line
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }
  
  // Parse each line into values
  return lines.map(line => parseCSVLine(line));
}

function parseCSVLine(line: string): string[] {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, '')); // Remove surrounding quotes
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim().replace(/^"|"$/g, ''));
  return values;
}

async function mapGHLRowToProperty(row: any, rowNumber: number, headers: string[]): Promise<Property | null> {
  // Find the address column (flexible matching)
  const addressColumn = headers.find(h => /Property Address/i.test(h));
  const cityColumn = headers.find(h => /Property city/i.test(h));
  const stateColumn = headers.find(h => /^state$/i.test(h));
  const priceColumn = headers.find(h => /price/i.test(h));
  const zipColumn = headers.find(h => /Zip code/i.test(h));
  const imageColumn = headers.find(h => /Image link/i.test(h));
  
  // Extract the complete address - this is the full address string
  const fullAddress = addressColumn ? (row[addressColumn] || '').trim() : '';
  
  // Skip rows without address (but don't error)
  if (!fullAddress) {
    console.log(`Skipping row ${rowNumber}: No address found`);
    return null;
  }

  console.log(`Processing row ${rowNumber}: ${fullAddress}`);

  // Extract price
  const listPrice = parseFloat(priceColumn ? (row[priceColumn] || '0') : '0');
  
  // Skip rows without price (but don't error)
  if (listPrice <= 0) {
    console.log(`Skipping row ${rowNumber}: Invalid price "${priceColumn ? row[priceColumn] : 'N/A'}" for ${fullAddress}`);
    return null;
  }

  // Use Google Maps to parse the complete address (non-blocking)
  let address = fullAddress;
  let city = cityColumn ? (row[cityColumn] || '').trim() : '';
  let state = stateColumn ? (row[stateColumn] || '').trim() : '';
  let zipCode = zipColumn ? (row[zipColumn] || '').trim() : '';
  let latitude: number | undefined;
  let longitude: number | undefined;

  try {
    const addressResult = await parseAddress(fullAddress);
    if (addressResult.success && addressResult.address) {
      // Use Google Maps parsed data if successful
      address = addressResult.address.fullStreetAddress || fullAddress;
      city = addressResult.address.city || city;
      state = addressResult.address.state || state;
      zipCode = addressResult.address.zipCode || zipCode;
      latitude = addressResult.address.latitude;
      longitude = addressResult.address.longitude;
    }
  } catch (error) {
    console.warn(`Google Maps failed for ${fullAddress}, using fallback data`);
  }

  // Smart defaults for missing data
  if (!city) {
    // Try to extract city from address string
    const addressParts = fullAddress.split(',');
    if (addressParts.length >= 2) {
      city = addressParts[1].trim();
    } else {
      city = 'Unknown City';
    }
  }

  if (!state) {
    // Extract state from address or default to FL (your main market)
    const addressParts = fullAddress.split(',');
    if (addressParts.length >= 3) {
      const lastPart = addressParts[addressParts.length - 1].trim();
      const stateMatch = lastPart.match(/\b[A-Z]{2}\b/);
      state = stateMatch ? stateMatch[0] : 'FL';
    } else {
      state = 'FL';
    }
  }

  // Extract other fields with N/A defaults if missing
  const bedrooms = parseInt(row.bedrooms || '0') || 0;
  const bathrooms = parseFloat(row.bathrooms || '0') || 0;
  const squareFeet = parseInt(row.livingArea || '0') || 0;
  const yearBuilt = parseInt(row.yearBuilt || '0') || 0;

  // Financial calculations - handle your exact format
  const rawFinancials = {
    listPrice,
    downPaymentAmount: parseFloat(row['down payment amount '] || '0'),
    downPaymentPercent: parseFloat(row['down payment '] || '0'),
    monthlyPayment: parseFloat(row['Monthly payment '] || '0'),
    interestRate: parseFloat(row['Interest rate '] || '6.0'), // Default to 6% for owner financing
    termYears: 30, // Default to 30 years
    balloonPayment: parseFloat(row['Balloon '] || '0') || undefined
  };

  // Calculate missing financial fields
  const financials = calculatePropertyFinancials(rawFinancials);
  
  // Validate the calculations - be more lenient for initial uploads
  const validation = validatePropertyFinancials(financials);
  if (!validation.valid) {
    console.warn(`Property ${address}: ${validation.errors.join(', ')}`);
    // Don't throw error, just log warnings and continue
  }

  // Handle image URLs - Priority: Zillow image > Google Street View
  let imageUrl = imageColumn ? (row[imageColumn] || '').trim() : '';
  
  if (imageUrl) {
    // Use Zillow image if available (priority #1)
    console.log(`Using Zillow image for ${address}: ${imageUrl}`);
  } else {
    // Generate Google Street View image if no Zillow image (priority #2)
    if (latitude && longitude) {
      imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${latitude},${longitude}&heading=0&fov=90&pitch=10&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      console.log(`Generated Street View for ${address}: ${imageUrl}`);
    } else {
      // Fallback: use address string for Street View
      const encodedAddress = encodeURIComponent(fullAddress);
      imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encodedAddress}&heading=0&fov=90&pitch=10&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      console.log(`Generated Street View by address for ${address}: ${imageUrl}`);
    }
  }

  // Create the property object - handle your actual CSV structure
  return {
    id: `ghl_${row['Contact ID'] || Date.now()}_${rowNumber}`,
    address: address || fullAddress,
    city,
    state: state || 'FL',
    zipCode: zipCode || 'N/A',
    bedrooms: bedrooms || 0, // Show 0 if missing, don't force minimum
    bathrooms: bathrooms || 0, // Show 0 if missing, don't force minimum  
    squareFeet: squareFeet || 0, // Show 0 if missing
    listPrice: financials.listPrice,
    downPaymentAmount: financials.downPaymentAmount,
    monthlyPayment: financials.monthlyPayment,
    interestRate: financials.interestRate,
    termYears: financials.termYears,
    description: (row['description '] || '').trim() || `Beautiful ${bedrooms} bedroom, ${bathrooms} bathroom home in ${city}`,
    imageUrl: imageUrl || undefined,
    distance: 0 // Will be calculated based on user location later
  };
}

// Function to generate a sample row for testing
export function generateSampleGHLRow(): any {
  return {
    'Opportunity Name': 'Sample Property Listing',
    'Contact Name': 'John Seller',
    phone: '555-123-4567',
    email: 'john@email.com',
    'Property Address ': '123 Main Street',
    'Property city ': 'Memphis',
    state: 'TN',
    'Zip code ': '38104',
    'price ': '185000',
    bedrooms: '3',
    bathrooms: '2',
    livingArea: '1450',
    yearBuilt: '1995',
    homeType: 'single-family',
    'description ': 'Beautiful 3-bedroom home with updated kitchen',
    'down payment amount ': '18500',
    'down payment ': '10',
    'Monthly payment ': '1250',
    'Interest rate ': '7.5',
    'Balloon ': '',
    'lot sizes ': '0.25',
    'Buyers Compensation ': '3%',
    'Image link ': 'https://example.com/house.jpg'
  };
}