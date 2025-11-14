import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import admin from 'firebase-admin';
import { validatePropertyFinancials, calculateMissingFinancials } from '@/lib/property-validation';

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (projectId && privateKey && clientEmail) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        privateKey,
        clientEmail,
      })
    });
  }
}

interface CSVRow {
  'Opportunity Name': string;
  'Property Address': string;
  'Property city': string;
  'State ': string;
  'zip code ': string;
  'yearBuilt': string;
  'bedrooms': string;
  'bathrooms': string;
  'livingArea': string;
  'homeType': string;
  'Price ': string;
  'Interest rate ': string;
  'down payment amount ': string;
  'down payment %': string;
  'Monthly payment': string;
  'description ': string;
  'New Description ': string;
  'Image link': string;
  'Amortization schedule months ': string;
  'Balloon ': string;
  'stage': string;
  'Tax amount ': string;
  'hoa ': string;
  'lot sizes': string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const text = await file.text();
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CSVRow[];

    // Filter for "exported to website" stage
    const exportedProperties = records.filter(row =>
      row.stage && row.stage.toLowerCase().includes('exported to website')
    );

    const db = admin.firestore();

    // Get existing properties to check for duplicates
    const existingSnapshot = await db.collection('properties').get();
    const existingAddresses = new Set(
      existingSnapshot.docs.map(doc => {
        const data = doc.data();
        return `${data.address}|${data.city}|${data.state}`.toLowerCase();
      })
    );

    let imported = 0;
    let skipped = 0;
    let alreadyExists = 0;

    for (const row of exportedProperties) {
      try {
        // Skip if no address
        if (!row['Property Address'] || !row['Property city']) {
          skipped++;
          continue;
        }

        // Helper to clean GoHighLevel's "undefined" strings
        const cleanString = (val: string) => {
          if (!val || val === 'undefined' || val.trim() === '') return '';
          return val.trim();
        };

        const cleanNumber = (val: string) => {
          if (!val || val === 'undefined' || val.trim() === '') return '0';
          return val;
        };

        const address = row['Property Address'].trim();
        const city = row['Property city'].trim();
        const state = cleanString(row['State ']);
        const zipCode = cleanString(row['zip code ']);

        // Check if property already exists
        const addressKey = `${address}|${city}|${state}`.toLowerCase();
        if (existingAddresses.has(addressKey)) {
          alreadyExists++;
          continue;
        }

        // Parse financial fields
        const listPrice = parseFloat(cleanNumber(row['Price ']).replace(/[,$]/g, '')) || 0;
        const monthlyPayment = parseFloat(cleanNumber(row['Monthly payment']).replace(/[,$]/g, '')) || 0;
        const downPaymentAmount = parseFloat(cleanNumber(row['down payment amount ']).replace(/[,$]/g, '')) || 0;
        const downPaymentPercent = parseFloat(cleanNumber(row['down payment %']).replace(/[%]/g, '')) || 0;
        const interestRate = parseFloat(cleanNumber(row['Interest rate ']).replace(/[%]/g, '')) || 0;
        // Note: User confirmed "Amortization schedule months" is actually in years, not months
        const termYears = parseFloat(cleanNumber(row['Amortization schedule months '])) || 30;
        const balloonYears = parseFloat(cleanNumber(row['Balloon '])) || undefined;

        // Property details
        const bedrooms = parseInt(cleanNumber(row['bedrooms'])) || 0;
        const bathrooms = parseFloat(cleanNumber(row['bathrooms'])) || 0;
        const squareFeet = parseInt(cleanNumber(row['livingArea']).replace(/[,]/g, ''));
        const lotSize = parseInt(cleanNumber(row['lot sizes']).replace(/[,]/g, ''));
        const yearBuilt = parseInt(cleanNumber(row['yearBuilt']));

        // Description
        const description = cleanString(row['New Description '] || row['description ']);

        // Images
        const imageLink = cleanString(row['Image link']);
        const imageUrls = imageLink ? [imageLink] : [];

        // Additional fields
        const annualTaxes = parseFloat(cleanNumber(row['Tax amount ']).replace(/[,$]/g, ''));
        const hoaFee = parseFloat(cleanNumber(row['hoa ']).replace(/[,$]/g, ''));

        // Property type mapping
        const homeTypeMap: Record<string, any> = {
          'Single Family': 'single-family',
          'Condo': 'condo',
          'Townhouse': 'townhouse',
          'Mobile Home': 'mobile-home',
          'Multi Family': 'multi-family',
          'Land': 'land'
        };
        const propertyType = homeTypeMap[row['homeType']] || 'single-family';

        // Calculate missing financial fields BEFORE validation
        let calculatedFinancials = calculateMissingFinancials({
          listPrice,
          monthlyPayment,
          downPaymentAmount,
          downPaymentPercent,
          interestRate,
          termYears
        });

        // Use calculated values
        const finalListPrice = calculatedFinancials.listPrice;
        const finalMonthlyPayment = calculatedFinancials.monthlyPayment;
        const finalDownPaymentAmount = calculatedFinancials.downPaymentAmount;
        const finalDownPaymentPercent = calculatedFinancials.downPaymentPercent;
        const finalInterestRate = calculatedFinancials.interestRate;
        const finalTermYears = calculatedFinancials.termYears;

        // Run validation if we have financial data
        let validation = null;
        if (finalListPrice > 0 && finalMonthlyPayment > 0) {
          validation = validatePropertyFinancials({
            listPrice: finalListPrice,
            monthlyPayment: finalMonthlyPayment,
            downPaymentAmount: finalDownPaymentAmount,
            downPaymentPercent: finalDownPaymentPercent,
            interestRate: finalInterestRate,
            termYears: finalTermYears,
            address,
            city,
            state
          });
        }

        // Create property document
        const propertyDoc: any = {
          address,
          city,
          state,
          zipCode,
          propertyType,
          bedrooms,
          bathrooms,
          ...(squareFeet ? { squareFeet } : {}),
          ...(lotSize ? { lotSize } : {}),
          ...(yearBuilt ? { yearBuilt } : {}),
          listPrice: finalListPrice,
          downPaymentAmount: finalDownPaymentAmount,
          downPaymentPercent: finalDownPaymentPercent,
          monthlyPayment: finalMonthlyPayment,
          interestRate: finalInterestRate,
          termYears: finalTermYears,
          ...(balloonYears ? { balloonYears } : {}),
          description,
          imageUrls,
          ...(annualTaxes ? { taxes: { annualAmount: annualTaxes } } : {}),
          ...(hoaFee ? { hoa: { hasHOA: true, monthlyFee: hoaFee } } : {}),
          needsReview: validation?.needsReview || false,
          ...(validation?.issues && validation.issues.length > 0 ? {
            reviewReasons: validation.issues.map(issue => ({
              field: issue.field,
              issue: issue.issue,
              severity: issue.severity,
              ...(issue.expectedRange ? { expectedRange: issue.expectedRange } : {}),
              ...(issue.actualValue !== undefined ? { actualValue: issue.actualValue } : {}),
              ...(issue.suggestion ? { suggestion: issue.suggestion } : {})
            }))
          } : {}),
          isActive: validation?.needsReview ? false : true,
          status: validation?.needsReview ? 'pending' : 'active',
          source: 'import',
          featured: false,
          priority: 5,
          dateAdded: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('properties').add(propertyDoc);
        imported++;

      } catch (error) {
        console.error('Error importing property:', error);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalRows: records.length,
        exportedToWebsite: exportedProperties.length,
        imported,
        alreadyExists,
        skipped
      }
    });

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync properties' },
      { status: 500 }
    );
  }
}
