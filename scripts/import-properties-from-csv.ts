/**
 * Import Properties from CSV
 * Imports properties from opportunities.csv where stage = "exported to website"
 */

import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { validatePropertyFinancials, calculateMissingFinancials } from '../src/lib/property-validation';

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

async function importProperties() {
  console.log('📥 IMPORT PROPERTIES FROM CSV');
  console.log('='.repeat(80));

  try {
    // Initialize Firebase Admin
    if (admin.apps.length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

      if (!projectId || !privateKey || !clientEmail) {
        console.error('❌ Missing Firebase credentials');
        return;
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey,
          clientEmail,
        })
      });
    }

    const db = admin.firestore();

    // First, convert CSV to JSON using Python (which handles CSV parsing correctly)
    console.log('\n📝 Converting CSV to JSON with Python...');
    const { execSync } = require('child_process');
    execSync('python3 /Users/abdullahabunasrah/Desktop/ownerfi/scripts/convert-csv-to-json.py');

    const jsonPath = '/Users/abdullahabunasrah/Downloads/opportunities.json';
    console.log(`\n📂 Reading JSON from: ${jsonPath}\n`);

    const fileContent = fs.readFileSync(jsonPath, 'utf-8');
    const exportedProperties = JSON.parse(fileContent) as CSVRow[];

    console.log(`✅ Properties loaded from JSON: ${exportedProperties.length}\n`);

    let imported = 0;
    let skipped = 0;
    let needsReview = 0;

    for (const [index, row] of exportedProperties.entries()) {
      try {
        // Skip if no address
        if (!row['Property Address'] || !row['Property city']) {
          console.log(`[${index + 1}/${exportedProperties.length}] ⏭️  Skipped: Missing address`);
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
          // Address & Location
          address,
          city,
          state,
          zipCode,

          // Property Details
          propertyType,
          bedrooms,
          bathrooms,
          ...(squareFeet ? { squareFeet } : {}),
          ...(lotSize ? { lotSize } : {}),
          ...(yearBuilt ? { yearBuilt } : {}),

          // Financial Information
          listPrice: finalListPrice,
          downPaymentAmount: finalDownPaymentAmount,
          downPaymentPercent: finalDownPaymentPercent,
          monthlyPayment: finalMonthlyPayment,
          interestRate: finalInterestRate,
          termYears: finalTermYears,
          ...(balloonYears ? { balloonYears } : {}),

          // Description & Media
          description,
          imageUrls,

          // Additional Info
          ...(annualTaxes ? { taxes: { annualAmount: annualTaxes } } : {}),
          ...(hoaFee ? { hoa: { hasHOA: true, monthlyFee: hoaFee } } : {}),

          // Validation
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

          // Status
          isActive: validation?.needsReview ? false : true,
          status: validation?.needsReview ? 'pending' : 'active',
          source: 'import',
          featured: false,
          priority: 5,

          // Timestamps
          dateAdded: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('properties').add(propertyDoc);

        if (validation?.needsReview) {
          console.log(`[${index + 1}/${exportedProperties.length}] ⚠️  ${address}, ${city}, ${state} - Needs Review (${validation.issues.length} issues)`);
          needsReview++;
        } else {
          console.log(`[${index + 1}/${exportedProperties.length}] ✅ ${address}, ${city}, ${state}`);
        }

        imported++;

      } catch (error) {
        console.error(`[${index + 1}/${exportedProperties.length}] ❌ Error importing property:`, error);
        skipped++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Properties (exported to website): ${exportedProperties.length}`);
    console.log(`✅ Successfully Imported: ${imported}`);
    console.log(`   - Active: ${imported - needsReview}`);
    console.log(`   - Needs Review: ${needsReview}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (admin.apps.length > 0) {
      await admin.app().delete();
    }
  }
}

importProperties();
