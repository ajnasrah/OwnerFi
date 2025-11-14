/**
 * Test import for Tributary property only
 * Debug what's happening during import
 */

import admin from 'firebase-admin';
import * as fs from 'fs';

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

async function testImport() {
  // Read JSON
  const jsonPath = '/Users/abdullahabunasrah/Downloads/opportunities.json';
  const fileContent = fs.readFileSync(jsonPath, 'utf-8');
  const exportedProperties = JSON.parse(fileContent) as CSVRow[];

  // Find Tributary property
  const row = exportedProperties.find(p => p['Property Address']?.includes('6240 Tributary'));

  if (!row) {
    console.log('❌ Property not found in JSON');
    return;
  }

  console.log('✅ Found property in JSON\n');

  // Helper functions
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

  console.log('After cleaning:');
  console.log(`  address: "${address}"`);
  console.log(`  city: "${city}"`);
  console.log(`  state: "${state}"`);
  console.log(`  zipCode: "${zipCode}"`);

  // Parse financial fields
  const listPrice = parseFloat(cleanNumber(row['Price ']).replace(/[,$]/g, '')) || 0;
  const monthlyPayment = parseFloat(cleanNumber(row['Monthly payment']).replace(/[,$]/g, '')) || 0;
  const downPaymentAmount = parseFloat(cleanNumber(row['down payment amount ']).replace(/[,$]/g, '')) || 0;
  const downPaymentPercent = parseFloat(cleanNumber(row['down payment %']).replace(/[%]/g, '')) || 0;
  const interestRate = parseFloat(cleanNumber(row['Interest rate ']).replace(/[%]/g, '')) || 0;
  const termYears = parseFloat(cleanNumber(row['Amortization schedule months '])) || 30;
  const balloonYears = parseFloat(cleanNumber(row['Balloon '])) || undefined;

  console.log('\nAfter parsing:');
  console.log(`  listPrice: ${listPrice}`);
  console.log(`  monthlyPayment: ${monthlyPayment}`);
  console.log(`  downPaymentAmount: ${downPaymentAmount}`);
  console.log(`  downPaymentPercent: ${downPaymentPercent}`);
  console.log(`  interestRate: ${interestRate}`);
  console.log(`  termYears: ${termYears}`);
  console.log(`  balloonYears: ${balloonYears}`);

  // Create property document
  const propertyDoc: any = {
    // Address & Location
    address,
    city,
    state,
    zipCode,

    // Financial Information
    listPrice,
    downPaymentAmount,
    downPaymentPercent,
    monthlyPayment,
    interestRate,
    termYears,
    ...(balloonYears ? { balloonYears } : {}),

    // Status
    isActive: true,
    status: 'active',
    source: 'test-import',

    // Timestamps
    dateAdded: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };

  console.log('\nProperty document to be saved:');
  console.log(JSON.stringify(propertyDoc, null, 2));
}

testImport();
