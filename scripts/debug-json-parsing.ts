/**
 * Debug JSON Parsing
 * Check what's being parsed from the JSON file
 */

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

const jsonPath = '/Users/abdullahabunasrah/Downloads/opportunities.json';
console.log(`Reading JSON from: ${jsonPath}\n`);

const fileContent = fs.readFileSync(jsonPath, 'utf-8');
const exportedProperties = JSON.parse(fileContent) as CSVRow[];

// Find the property with "6240 Tributary"
const property = exportedProperties.find(p => p['Property Address']?.includes('6240 Tributary'));

if (property) {
  console.log('Found property: 6240 Tributary St\n');
  console.log('RAW values from JSON:');
  console.log(`  Property Address: "${property['Property Address']}"`);
  console.log(`  City: "${property['Property city']}"`);
  console.log(`  State : "${property['State ']}"`);
  console.log(`  zip code : "${property['zip code ']}"`);
  console.log(`  Price : "${property['Price ']}"`);
  console.log(`  Interest rate : "${property['Interest rate ']}"`);
  console.log(`  down payment amount : "${property['down payment amount ']}"`);
  console.log(`  Monthly payment: "${property['Monthly payment']}"`);
  console.log(`  Amortization schedule months : "${property['Amortization schedule months ']}"`);

  // Test the cleaning functions
  const cleanString = (val: string) => {
    if (!val || val === 'undefined' || val.trim() === '') return '';
    return val.trim();
  };

  const cleanNumber = (val: string) => {
    if (!val || val === 'undefined' || val.trim() === '') return '0';
    return val;
  };

  console.log('\nAfter cleanString/cleanNumber:');
  console.log(`  State: "${cleanString(property['State '])}"`);
  console.log(`  Zip: "${cleanString(property['zip code '])}"`);
  console.log(`  Price: "${cleanNumber(property['Price '])}"`);
  console.log(`  Interest Rate: "${cleanNumber(property['Interest rate '])}"`);
  console.log(`  Down Payment: "${cleanNumber(property['down payment amount '])}"`);

  console.log('\nAfter parsing:');
  const listPrice = parseFloat(cleanNumber(property['Price ']).replace(/[,$]/g, '')) || 0;
  const interestRate = parseFloat(cleanNumber(property['Interest rate ']).replace(/[%]/g, '')) || 0;
  const downPaymentAmount = parseFloat(cleanNumber(property['down payment amount ']).replace(/[,$]/g, '')) || 0;

  console.log(`  listPrice: ${listPrice}`);
  console.log(`  interestRate: ${interestRate}`);
  console.log(`  downPaymentAmount: ${downPaymentAmount}`);
} else {
  console.log('Property not found!');
}
