import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { 
  doc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { queueNearbyCitiesForProperty } from '@/lib/property-enhancement';
import { ExtendedSession } from '@/types/session';
import { PropertyListing } from '@/lib/property-schema';

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Strict admin access control
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
    
    await logInfo('Starting CSV file processing', {
      action: 'upload_properties',
      metadata: { fileName: file.name, fileSize: file.size }
    });
    
    // Parse CSV data with proper quote handling
    const csvText = buffer.toString('utf-8');
    const lines = csvText.split('\n').filter(line => line.trim());

    // Parse CSV properly handling quoted fields
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]);

    const parseResult: {
      success: PropertyListing[],
      errors: string[],
      totalRows: number,
      duplicates: string[]
    } = { success: [], errors: [], totalRows: lines.length - 1, duplicates: [] };

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};

        headers.forEach((header, index) => {
          row[header.trim()] = values[index]?.trim() || '';
        });

        // Flexible column mapping - handle spaces and case variations
        const getColumnValue = (possibleNames: string[]): string => {
          for (const name of possibleNames) {
            const value = row[name] || row[name.trim()] || row[name + ' '] || row[name.toLowerCase()];
            if (value && value.trim()) return value.trim();
          }
          return '';
        };

        const getNumericValue = (possibleNames: string[]): number => {
          const value = getColumnValue(possibleNames);
          const parsed = parseFloat(value.replace(/[,$]/g, ''));
          return isNaN(parsed) ? 0 : parsed;
        };

        // Map CSV columns to PropertyListing format with flexible column names
        const property: PropertyListing = {
          id: getColumnValue(['Opportunity ID', 'ID', 'Property ID']) || `prop_${Date.now()}_${i}`,
          address: getColumnValue(['Property Address', 'Full Address', 'Address', 'Street Address', 'full_address']),
          city: getColumnValue(['Property city', 'city', 'City', 'Property City']),
          state: getColumnValue(['state', 'State', 'Property State']).toLowerCase(),
          zipCode: getColumnValue(['Zip code', 'ZIP', 'Zip Code', 'zipcode', 'postal_code']),
          propertyType: 'single-family', // Default type
          listPrice: getNumericValue(['price', 'Price', 'List Price', 'listPrice']),
          bedrooms: Math.round(getNumericValue(['bedrooms', 'Bedrooms', 'beds'])),
          bathrooms: getNumericValue(['bathrooms', 'Bathrooms', 'baths']),
          squareFeet: Math.round(getNumericValue(['livingArea', 'Living Area', 'sqft', 'squareFeet', 'Square Feet'])),
          monthlyPayment: getNumericValue(['Monthly payment', 'monthly payment', 'Payment', 'payment']),
          downPaymentAmount: getNumericValue(['down payment amount', 'Down Payment Amount', 'downPayment']),
          downPaymentPercent: getNumericValue(['down payment', 'Down Payment', 'downPaymentPercent']),
          interestRate: getNumericValue(['Interest rate', 'interest rate', 'rate', 'Rate']),
          termYears: 20, // Default amortization term
          balloonYears: getNumericValue(['Balloon', 'balloon', 'Balloon Years', 'balloonYears']) || undefined,
          balloonPayment: undefined, // Will be calculated if balloonYears exists
          yearBuilt: Math.round(getNumericValue(['yearBuilt', 'Year Built', 'year_built', 'built'])),
          lotSize: getNumericValue(['lot sizes', 'Lot Size', 'lot_size', 'lotSize']),
          description: getColumnValue(['description', 'Description', 'desc', 'notes']),
          imageUrls: getColumnValue(['Image link', 'image_link', 'imageUrl', 'photo']) ? [getColumnValue(['Image link', 'image_link', 'imageUrl', 'photo'])] : [],
          source: 'import',
          status: 'active',
          dateAdded: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          priority: 1,
          featured: false,
          isActive: true
        };

        // Calculate missing financial fields
        const loanAmount = property.listPrice - property.downPaymentAmount;

        // Calculate down payment percentage if missing
        if (!property.downPaymentPercent && property.listPrice && property.downPaymentAmount) {
          property.downPaymentPercent = (property.downPaymentAmount / property.listPrice) * 100;
        }

        // Calculate monthly payment if missing but we have interest rate
        if (!property.monthlyPayment && property.interestRate && loanAmount > 0) {
          const monthlyRate = property.interestRate / 100 / 12;
          const numPayments = property.termYears * 12;

          if (monthlyRate > 0) {
            property.monthlyPayment = Math.round(
              loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
              (Math.pow(1 + monthlyRate, numPayments) - 1)
            );
          } else {
            // No interest - simple division
            property.monthlyPayment = Math.round(loanAmount / numPayments);
          }
        }

        // Calculate balloon payment if balloonYears is specified
        if (property.balloonYears && property.balloonYears > 0 && property.monthlyPayment && property.interestRate) {
          const loanAmount = property.listPrice - property.downPaymentAmount;
          const monthlyRate = property.interestRate / 100 / 12;
          const balloonPayments = property.balloonYears * 12;

          if (monthlyRate > 0) {
            // Calculate remaining balance after balloon years of payments
            const remainingBalance = loanAmount * Math.pow(1 + monthlyRate, balloonPayments) -
              property.monthlyPayment * ((Math.pow(1 + monthlyRate, balloonPayments) - 1) / monthlyRate);
            property.balloonPayment = Math.max(0, Math.round(remainingBalance));
          }
        }

        // Validation
        if (!property.address || !property.city || !property.state || property.listPrice <= 0) {
          parseResult.errors.push(`Row ${i}: Missing required fields (address, city, state, price)`);
          continue;
        }

        parseResult.success.push(property);
        
      } catch (error) {
        parseResult.errors.push(`Row ${i}: ${(error as Error).message}`);
      }
    }
    
    if (parseResult.success.length === 0) {
      await logError('No valid properties found in CSV file', {
        action: 'upload_properties',
        metadata: { 
          fileName: file.name,
          totalRows: parseResult.totalRows,
          errorCount: parseResult.errors.length
        }
      });
      
      return NextResponse.json({
        error: 'No valid properties found',
        details: parseResult.errors
      }, { status: 400 });
    }
    
    // Insert properties into Firebase
    const insertedProperties = [];
    const insertErrors = [];
    
    for (const property of parseResult.success) {
      try {
        
        // FAST: Create property immediately without waiting for nearby cities
        await setDoc(doc(db!, 'properties', property.id), {
          ...property,
          nearbyCities: [], // Empty initially, populated by background job
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          status: 'active',
          source: 'import',
          isActive: true // Ensure this flag is set for the matching service
        });
        
        // Queue nearby cities population (non-blocking)
        queueNearbyCitiesForProperty(property.id, property.city, property.state);
        
        
        insertedProperties.push({
          id: property.id,
          address: property.address,
          city: property.city,
          state: property.state
        });
        
      } catch (error) {
        
        await logError('Failed to insert property', {
          action: 'insert_property',
          metadata: { 
            property: property.address,
            propertyId: property.id,
            errorType: (error as Error).name,
            errorMessage: (error as Error).message,
            errorStack: (error as Error).stack
          }
        }, error as Error);
        
        insertErrors.push({
          property: property.address,
          propertyId: property.id,
          error: (error as Error).message,
          errorType: (error as Error).name
        });
      }
    }
    
    await logInfo('Excel upload completed', {
      action: 'upload_properties',
      metadata: {
        fileName: file.name,
        totalProcessed: parseResult.totalRows,
        successfulInserts: insertedProperties.length,
        parseErrors: parseResult.errors.length,
        insertErrors: insertErrors.length
      }
    });
    
    return NextResponse.json({
      success: true,
      summary: {
        totalRows: parseResult.totalRows,
        successfulParsing: parseResult.success.length,
        successfulInserts: insertedProperties.length,
        parseErrors: parseResult.errors.length,
        duplicatesSkipped: parseResult.duplicates?.length || 0,
        insertErrors: insertErrors.length
      },
      parseErrors: parseResult.errors,
      duplicates: parseResult.duplicates || [],
      insertErrors,
      insertedProperties: insertedProperties.map(p => ({
        id: p.id,
        address: p.address,
        city: p.city,
        state: p.state
      }))
    });
    
  } catch (error) {
    await logError('Excel upload failed', {
      action: 'upload_properties'
    }, error as Error);
    
    return NextResponse.json(
      { error: 'Failed to process upload', details: (error as Error).message },
      { status: 500 }
    );
  }
}