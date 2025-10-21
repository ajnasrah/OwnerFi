#!/usr/bin/env npx tsx

/**
 * Import Apify CSV export to Firebase
 * Handles slash-separated column names like "attributionInfo/agentName"
 */

import * as fs from 'fs';
import * as XLSX from 'xlsx';
import * as dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

const app = initializeApp({
  credential: cert(serviceAccount as any),
});

const db = getFirestore(app);

function transformCSVRow(row: any): any | null {
  const timestamp = new Date();

  // Extract address
  const streetAddress = row.streetAddress || row['address/streetAddress'] || '';
  const city = row.city || row['address/city'] || '';
  const state = row.state || row['address/state'] || '';
  const zipCode = row.zipcode || row['address/zipcode'] || '';
  const county = row.county || '';
  const subdivision = row['address/subdivision'] || '';
  const neighborhood = row['address/neighborhood'] || '';
  const fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`.trim();

  // Extract IDs
  const zpid = row.zpid || 0;
  const parcelId = row.parcelId || '';
  const mlsId = row['attributionInfo/mlsId'] || row.mlsid || '';

  // URLs
  const hdpUrl = row.hdpUrl || '';
  const fullUrl = hdpUrl ? `https://www.zillow.com${hdpUrl}` : (row.url || '');

  // Extract agent/broker info from CSV columns
  const agentPhone = row['attributionInfo/agentPhoneNumber'] || '';
  const brokerPhone = row['attributionInfo/brokerPhoneNumber'] || '';

  // VALIDATION: Skip if no phone
  if (!agentPhone && !brokerPhone) {
    console.log(`   ⚠️  SKIPPED: No phone for ${streetAddress || 'property'} (ZPID: ${zpid})`);
    return null;
  }

  const finalAgentPhone = agentPhone || brokerPhone;

  // Extract images - look for columns like [Image #1], etc.
  const propertyImages: string[] = [];
  Object.keys(row).forEach(key => {
    if (key.match(/\[Image #\d+\]/)) {
      const imageUrl = row[key];
      if (imageUrl && imageUrl.trim()) {
        propertyImages.push(imageUrl.trim());
      }
    }
  });

  // Extract tax data
  const annualTaxAmount = row.taxAnnualAmount || row['taxHistory/0/taxPaid'] || 0;
  const recentPropertyTaxes = row['taxHistory/0/value'] || 0;

  return {
    url: fullUrl,
    hdpUrl: hdpUrl,
    virtualTourUrl: row.virtualTourUrl || '',
    fullAddress,
    streetAddress,
    city,
    state,
    zipCode,
    county,
    subdivision,
    neighborhood,
    zpid,
    parcelId,
    mlsId,
    bedrooms: row.bedrooms || row.beds || 0,
    bathrooms: row.bathrooms || row.baths || 0,
    squareFoot: row.livingArea || row.livingAreaValue || 0,
    buildingType: row.propertyTypeDimension || row.buildingType || '',
    homeType: row.homeType || '',
    homeStatus: row.homeStatus || '',
    yearBuilt: row.yearBuilt || 0,
    lotSquareFoot: row.lotSize || row.lotAreaValue || 0,
    latitude: row.latitude || 0,
    longitude: row.longitude || 0,
    price: row.price || 0,
    estimate: row.zestimate || 0,
    rentEstimate: row.rentZestimate || 0,
    hoa: row.monthlyHoaFee || 0,
    annualTaxAmount,
    recentPropertyTaxes,
    propertyTaxRate: row.propertyTaxRate || 0,
    annualHomeownersInsurance: row.annualHomeownersInsurance || 0,
    daysOnZillow: row.daysOnZillow || 0,
    datePostedString: row.datePostedString || '',
    listingDataSource: row.listingDataSource || '',
    description: row.description || '',
    agentName: row['attributionInfo/agentName'] || '',
    agentPhoneNumber: finalAgentPhone,
    agentEmail: row['attributionInfo/agentEmail'] || '',
    agentLicenseNumber: row['attributionInfo/agentLicenseNumber'] || '',
    brokerName: row['attributionInfo/brokerName'] || '',
    brokerPhoneNumber: brokerPhone,
    propertyImages,
    source: 'apify-zillow-csv',
    importedAt: timestamp,
    scrapedAt: timestamp,
  };
}

async function importCSV(csvFilePath: string) {
  console.log(`\n⚡ CSV Import to Firebase\n`);
  console.log('='.repeat(80));
  console.log(`Input: ${csvFilePath}\n`);

  // Read CSV
  const workbook = XLSX.readFile(csvFilePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  console.log(`📂 Loaded ${data.length} rows\n`);

  // Show sample columns
  if (data.length > 0) {
    const sampleKeys = Object.keys(data[0]);
    console.log(`Found ${sampleKeys.length} columns`);
    console.log(`Agent phone column: ${sampleKeys.find(k => k.includes('agentPhone')) || 'NOT FOUND'}`);
    console.log(`Broker phone column: ${sampleKeys.find(k => k.includes('brokerPhone')) || 'NOT FOUND'}\n`);
  }

  // Transform
  console.log('🔄 Transforming...');
  const properties: any[] = [];
  let skipped = 0;

  for (const row of data) {
    const transformed = transformCSVRow(row);
    if (transformed) {
      properties.push(transformed);
    } else {
      skipped++;
    }
  }

  console.log(`✓ Valid: ${properties.length}`);
  console.log(`✓ Skipped: ${skipped}\n`);

  // Import
  console.log(`💾 Importing to Firebase...`);
  const batchSize = 500;
  let imported = 0;

  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = db.batch();
    const batchProps = properties.slice(i, i + batchSize);

    for (const prop of batchProps) {
      const docRef = db.collection('zillow_imports').doc();
      batch.set(docRef, prop);
    }

    await batch.commit();
    imported += batchProps.length;
    console.log(`   ✓ Saved ${imported}/${properties.length}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Done!');
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}\n`);
}

const csvFile = process.argv[2];
if (!csvFile) {
  console.error('Usage: npx tsx scripts/import-csv-to-firebase.ts <path-to-csv>');
  process.exit(1);
}

importCSV(csvFile).catch(console.error);
