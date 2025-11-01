import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { sanitizeDescription } from '../src/lib/description-sanitizer';

config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

// Helper to parse number safely
function parseNumber(value: any): number {
  if (!value) return 0;
  const parsed = parseFloat(String(value).replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

// Helper to normalize state
function normalizeState(state: string): string {
  if (!state) return '';
  const normalized = state.trim().toUpperCase();
  return normalized.length === 2 ? normalized : normalized.substring(0, 2);
}

// Calculate financial terms
function calculateFinancials(price: number, downPaymentPercent: number, downPaymentAmount: number, interestRate: number, termYears: number) {
  // Use provided down payment amount or calculate from percent
  let finalDownPayment = downPaymentAmount;
  if (!finalDownPayment && downPaymentPercent && price) {
    finalDownPayment = Math.round((downPaymentPercent / 100) * price);
  }

  // Calculate monthly payment if we have interest rate
  let monthlyPayment = 0;
  if (interestRate > 0 && finalDownPayment >= 0 && price) {
    const loanAmount = price - finalDownPayment;
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = termYears * 12;

    if (monthlyRate > 0 && loanAmount > 0) {
      monthlyPayment = Math.round(
        loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)
      );
    }
  }

  return {
    downPaymentAmount: finalDownPayment,
    downPaymentPercent: finalDownPayment && price ? (finalDownPayment / price) * 100 : downPaymentPercent,
    monthlyPayment
  };
}

async function addMissingProperties() {
  console.log('🏠 Adding missing "exported to website" properties to Firebase...\n');

  // Read the JSON file with missing properties
  const jsonPath = path.join(process.cwd(), 'scripts', 'missing-exported-properties.json');
  const properties = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  console.log(`📋 Found ${properties.length} properties to add\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const prop of properties) {
    const opportunityId = prop['Opportunity ID'];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${prop['Property Address']}`);
    console.log(`Opportunity ID: ${opportunityId}`);

    try {
      // Parse property data
      const price = parseNumber(prop['Price']);
      const bedrooms = parseNumber(prop['bedrooms']);
      const bathrooms = parseNumber(prop['bathrooms']);
      const squareFeet = parseNumber(prop['livingArea']);
      const yearBuilt = parseNumber(prop['yearBuilt']);
      const lotSize = parseNumber(prop['lot sizes']);
      const downPaymentPercent = parseNumber(prop['down payment %']);
      const downPaymentAmount = parseNumber(prop['down payment amount']);
      const interestRate = parseNumber(prop['Interest rate']);
      const monthlyPaymentProvided = parseNumber(prop['Monthly payment']);
      const balloonYears = parseNumber(prop['Balloon']);

      // Dynamic amortization based on price
      const getDefaultTermYears = (listPrice: number): number => {
        if (listPrice < 150000) return 15;
        if (listPrice < 300000) return 20;
        if (listPrice < 600000) return 25;
        return 30;
      };
      const termYears = getDefaultTermYears(price);

      // Calculate financials
      const financials = calculateFinancials(price, downPaymentPercent, downPaymentAmount, interestRate, termYears);

      // Use provided monthly payment if available, otherwise use calculated
      const finalMonthlyPayment = monthlyPaymentProvided || financials.monthlyPayment;

      // Normalize state
      const state = normalizeState(prop['State']);

      // Sanitize description
      const cleanDescription = sanitizeDescription(prop['description']);

      // Prepare property data
      const propertyData = {
        id: opportunityId,
        opportunityId: opportunityId,
        opportunityName: prop['Opportunity Name'] || prop['Property Address'],

        // Location
        address: prop['Property Address'],
        city: prop['Property city'],
        state: state,
        zipCode: prop['zip code'] || '',

        // Pricing
        price: price,
        listPrice: price,

        // Property Details
        bedrooms: bedrooms,
        beds: bedrooms,
        bathrooms: bathrooms,
        baths: bathrooms,
        squareFeet: squareFeet,
        yearBuilt: yearBuilt,
        lotSize: lotSize,
        propertyType: prop['homeType']?.toLowerCase().includes('family') ? 'single-family' : 'single-family',
        description: cleanDescription,

        // Financial Details
        monthlyPayment: finalMonthlyPayment,
        downPaymentAmount: financials.downPaymentAmount,
        downPaymentPercent: financials.downPaymentPercent,
        interestRate: interestRate,
        termYears: termYears,
        balloonYears: balloonYears > 0 ? balloonYears : null,
        balloonPayment: null,

        // Images
        imageUrls: prop['Image link'] ? [prop['Image link']] : [],

        // Meta
        source: 'gohighlevel',
        status: 'active',
        isActive: true,
        featured: false,
        priority: 1,
        nearbyCities: [],

        // Timestamps
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        dateAdded: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      // Add to Firestore
      await db.collection('properties').doc(opportunityId).set(propertyData);

      console.log(`✅ Successfully added to Firebase`);
      console.log(`   Price: $${price.toLocaleString()}`);
      console.log(`   Beds/Baths: ${bedrooms}/${bathrooms}`);
      console.log(`   Monthly Payment: $${finalMonthlyPayment}`);

      successCount++;

      // Small delay to avoid overwhelming Firebase
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`❌ Error adding property:`, error);
      errorCount++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('\n📊 SUMMARY:\n');
  console.log(`Total: ${properties.length}`);
  console.log(`✅ Successfully added: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('');
}

addMissingProperties()
  .then(() => {
    console.log('✅ Process complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
