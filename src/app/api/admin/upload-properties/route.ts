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
    
    // Parse CSV data
    const csvText = buffer.toString('utf-8');
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    const parseResult: { 
      success: PropertyListing[], 
      errors: string[], 
      totalRows: number, 
      duplicates: string[] 
    } = { success: [], errors: [], totalRows: lines.length - 1, duplicates: [] };

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        // Map CSV columns to PropertyListing format
        const property: PropertyListing = {
          id: row['Opportunity ID'] || `prop_${Date.now()}_${i}`,
          address: row['Property Address'] || row['Full Address'] || '',
          city: row['Property city'] || row['city'] || '',
          state: (row['state'] || '').toLowerCase(),
          zipCode: row['Zip code'] || '',
          propertyType: 'single-family', // Default type
          listPrice: parseFloat(row['price']) || 0,
          bedrooms: parseInt(row['bedrooms']) || 0,
          bathrooms: parseFloat(row['bathrooms']) || 0,
          squareFeet: parseInt(row['livingArea']) || 0,
          monthlyPayment: parseFloat(row['Monthly payment']) || 0,
          downPaymentAmount: parseFloat(row['down payment amount']) || 0,
          downPaymentPercent: parseFloat(row['down payment']) || 0,
          interestRate: parseFloat(row['Interest rate']) || 0,
          termYears: parseFloat(row['Balloon']) || 30,
          yearBuilt: parseInt(row['yearBuilt']) || 0,
          lotSize: parseFloat(row['lot sizes']) || 0,
          description: row['description'] || '',
          imageUrls: row['Image link'] ? [row['Image link']] : [],
          source: 'import',
          status: 'active',
          dateAdded: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          priority: 'normal',
          featured: false,
          isActive: true
        };

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