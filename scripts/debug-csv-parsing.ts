/**
 * Debug CSV Parsing - Check what we're actually reading from CSV
 */

import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

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

async function debugCSV() {
  console.log('🔍 DEBUG CSV PARSING');
  console.log('='.repeat(80));

  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CSVRow[];

  console.log(`\nTotal rows: ${records.length}\n`);

  // Filter for "exported to website" stage
  const exportedProperties = records.filter(row =>
    row.stage && row.stage.toLowerCase().includes('exported to website')
  );

  console.log(`Properties with "exported to website": ${exportedProperties.length}\n`);

  // Look at first property with data
  const firstProperty = exportedProperties[0];

  console.log('📊 FIRST PROPERTY RAW CSV DATA:');
  console.log('='.repeat(80));
  console.log(`Address: "${firstProperty['Property Address']}"`);
  console.log(`City: "${firstProperty['Property city']}"`);
  console.log(`State: "${firstProperty['State ']}"`);
  console.log(`Zip: "${firstProperty['zip code ']}"`);
  console.log('\n--- FINANCIAL FIELDS (RAW) ---');
  console.log(`Price: "${firstProperty['Price ']}"`);
  console.log(`Interest rate: "${firstProperty['Interest rate ']}"`);
  console.log(`Down payment amount: "${firstProperty['down payment amount ']}"`);
  console.log(`Down payment %: "${firstProperty['down payment %']}"`);
  console.log(`Monthly payment: "${firstProperty['Monthly payment']}"`);
  console.log(`Amortization months: "${firstProperty['Amortization schedule months ']}"`);
  console.log(`Balloon: "${firstProperty['Balloon ']}"`);

  console.log('\n--- PARSED VALUES ---');
  const listPrice = parseFloat((firstProperty['Price '] || '0').replace(/[,$]/g, '')) || 0;
  const interestRate = parseFloat((firstProperty['Interest rate '] || '0').replace(/[%]/g, '')) || 0;
  const downPaymentAmount = parseFloat((firstProperty['down payment amount '] || '0').replace(/[,$]/g, '')) || 0;
  const downPaymentPercent = parseFloat((firstProperty['down payment %'] || '0').replace(/[%]/g, '')) || 0;
  const monthlyPayment = parseFloat((firstProperty['Monthly payment'] || '0').replace(/[,$]/g, '')) || 0;
  const termYears = Math.floor(parseFloat((firstProperty['Amortization schedule months '] || '0')) / 12) || 30;

  console.log(`listPrice: ${listPrice}`);
  console.log(`interestRate: ${interestRate}`);
  console.log(`downPaymentAmount: ${downPaymentAmount}`);
  console.log(`downPaymentPercent: ${downPaymentPercent}`);
  console.log(`monthlyPayment: ${monthlyPayment}`);
  console.log(`termYears: ${termYears}`);

  console.log('\n' + '='.repeat(80));
}

debugCSV();
