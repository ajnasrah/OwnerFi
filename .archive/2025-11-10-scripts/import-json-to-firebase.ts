#!/usr/bin/env npx tsx

/**
 * FAST import script - imports already-scraped Apify JSON directly to Firebase
 * No API calls, no delays - just pure data transformation and upload
 */

import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

const app = initializeApp({
  credential: cert(serviceAccount as any),
});

const db = getFirestore(app);

interface PropertyData {
  url: string;
  hdpUrl: string;
  virtualTourUrl: string;
  fullAddress: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  subdivision: string;
  neighborhood: string;
  zpid: number;
  parcelId: string;
  mlsId: string;
  bedrooms: number;
  bathrooms: number;
  squareFoot: number;
  buildingType: string;
  homeType: string;
  homeStatus: string;
  yearBuilt: number;
  lotSquareFoot: number;
  latitude: number;
  longitude: number;
  price: number;
  firstPropertyImage: string;
  estimate: number;
  rentEstimate: number;
  hoa: number;
  annualTaxAmount: number;
  recentPropertyTaxes: number;
  propertyTaxRate: number;
  annualHomeownersInsurance: number;
  daysOnZillow: number;
  datePostedString: string;
  listingDataSource: string;
  description: string;
  agentName: string;
  agentPhoneNumber: string;
  agentEmail: string;
  agentLicenseNumber: string;
  brokerName: string;
  brokerPhoneNumber: string;
  propertyImages: string[];
  source: string;
  importedAt: Date;
  scrapedAt: Date;
}

function transformProperty(apifyData: any): PropertyData | null {
  const timestamp = new Date();

  // Parse address
  const addressObj = apifyData.address || {};
  const streetAddress = addressObj.streetAddress || apifyData.streetAddress || '';
  const city = addressObj.city || apifyData.city || '';
  const state = addressObj.state || apifyData.state || '';
  const zipCode = addressObj.zipcode || apifyData.zipcode || addressObj.zip || '';
  const county = apifyData.county || '';
  const subdivision = addressObj.subdivision || '';
  const neighborhood = addressObj.neighborhood || '';
  const fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`.trim();

  const zpid = apifyData.zpid || 0;
  const parcelId = apifyData.parcelId || '';
  const mlsId = apifyData.attributionInfo?.mlsId || apifyData.mlsid || '';

  const hdpUrl = apifyData.hdpUrl || '';
  const fullUrl = hdpUrl ? `https://www.zillow.com${hdpUrl}` : (apifyData.url || apifyData.addressOrUrlFromInput || '');

  // Extract phone numbers
  const agentPhone = apifyData.attributionInfo?.agentPhoneNumber || apifyData.agentPhoneNumber || apifyData.agentPhone || '';
  const brokerPhone = apifyData.attributionInfo?.brokerPhoneNumber || apifyData.brokerPhoneNumber || apifyData.brokerPhone || '';

  // VALIDATION: Skip if no phone
  if (!agentPhone && !brokerPhone) {
    console.log(`   ⚠️  SKIPPED: No phone for ${streetAddress || 'property'} (ZPID: ${zpid})`);
    return null;
  }

  const finalAgentPhone = agentPhone || brokerPhone;

  return {
    url: fullUrl,
    hdpUrl: hdpUrl,
    virtualTourUrl: apifyData.virtualTourUrl || '',
    fullAddress: fullAddress || apifyData.fullAddress || '',
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
    bedrooms: apifyData.bedrooms || apifyData.beds || 0,
    bathrooms: apifyData.bathrooms || apifyData.baths || 0,
    squareFoot: apifyData.livingArea || apifyData.squareFoot || apifyData.livingAreaValue || 0,
    buildingType: apifyData.propertyTypeDimension || apifyData.buildingType || '',
    homeType: apifyData.homeType || '',
    homeStatus: apifyData.homeStatus || '',
    yearBuilt: apifyData.yearBuilt || 0,
    lotSquareFoot: apifyData.lotSize || apifyData.lotAreaValue || apifyData.lotSquareFoot || 0,
    latitude: apifyData.latitude || 0,
    longitude: apifyData.longitude || 0,
    price: apifyData.price || apifyData.listPrice || 0,
    estimate: apifyData.zestimate || apifyData.homeValue || apifyData.estimate || 0,
    rentEstimate: apifyData.rentZestimate || 0,
    hoa: apifyData.monthlyHoaFee || apifyData.hoa || 0,
    annualTaxAmount: (Array.isArray(apifyData.taxHistory) && apifyData.taxHistory.find((t: any) => t.taxPaid)?.taxPaid) || 0,
    recentPropertyTaxes: (Array.isArray(apifyData.taxHistory) && apifyData.taxHistory[0]?.value) || 0,
    propertyTaxRate: apifyData.propertyTaxRate || 0,
    annualHomeownersInsurance: apifyData.annualHomeownersInsurance || 0,
    daysOnZillow: apifyData.daysOnZillow || 0,
    datePostedString: apifyData.datePostedString || '',
    listingDataSource: apifyData.listingDataSource || '',
    description: apifyData.description || '',
    agentName: apifyData.attributionInfo?.agentName || apifyData.agentName || apifyData.listingAgent || '',
    agentPhoneNumber: finalAgentPhone,
    agentEmail: apifyData.attributionInfo?.agentEmail || '',
    agentLicenseNumber: apifyData.attributionInfo?.agentLicenseNumber || '',
    brokerName: apifyData.attributionInfo?.brokerName || apifyData.brokerName || apifyData.brokerageName || '',
    brokerPhoneNumber: brokerPhone,
    propertyImages: Array.isArray(apifyData.responsivePhotos)
      ? apifyData.responsivePhotos.map((p: any) => p.url).filter(Boolean)
      : Array.isArray(apifyData.photos)
      ? apifyData.photos.map((p: any) => typeof p === 'string' ? p : p.url || p.href).filter(Boolean)
      : Array.isArray(apifyData.images)
      ? apifyData.images
      : [],
    firstPropertyImage: apifyData.desktopWebHdpImageLink
      || apifyData.hiResImageLink
      || apifyData.mediumImageLink
      || (Array.isArray(apifyData.responsivePhotos) && apifyData.responsivePhotos[0]?.url)
      || (Array.isArray(apifyData.photos) && apifyData.photos[0] && (typeof apifyData.photos[0] === 'string' ? apifyData.photos[0] : apifyData.photos[0]?.url))
      || (Array.isArray(apifyData.images) && apifyData.images[0])
      || '',
    source: 'apify-zillow',
    importedAt: timestamp,
    scrapedAt: timestamp,
  };
}

async function importJsonToFirebase(jsonFilePath: string, batchSize: number = 500) {
  console.log(`\n⚡ FAST Firebase Importer (Direct JSON)`);
  console.log('='.repeat(80));
  console.log(`Input file: ${jsonFilePath}`);
  console.log(`Batch size: ${batchSize}`);
  console.log('='.repeat(80));

  // Read JSON file
  console.log('\n📂 Reading JSON file...');
  const rawData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
  console.log(`✓ Loaded ${rawData.length} properties\n`);

  // Transform and validate
  console.log('🔄 Transforming and validating...');
  const properties: PropertyData[] = [];
  let skippedCount = 0;

  for (const raw of rawData) {
    const transformed = transformProperty(raw);
    if (transformed) {
      properties.push(transformed);
    } else {
      skippedCount++;
    }
  }

  console.log(`✓ Valid properties: ${properties.length}`);
  console.log(`✓ Skipped (no phone): ${skippedCount}\n`);

  // Import to Firebase in batches
  console.log(`💾 Importing to Firebase (zillow_imports collection)...`);

  let importedCount = 0;
  const batches = Math.ceil(properties.length / batchSize);

  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = db.batch();
    const batchProperties = properties.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    console.log(`   Batch ${batchNum}/${batches}: Processing ${batchProperties.length} properties...`);

    for (const property of batchProperties) {
      const docRef = db.collection('zillow_imports').doc();
      batch.set(docRef, property);
    }

    await batch.commit();
    importedCount += batchProperties.length;
    console.log(`   ✓ Batch ${batchNum}/${batches}: Saved ${batchProperties.length} properties (Total: ${importedCount}/${properties.length})`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Import Complete!');
  console.log('='.repeat(80));
  console.log(`Total imported: ${importedCount}`);
  console.log(`Total skipped: ${skippedCount}`);
  console.log(`\nView in Firebase Console: Firestore > zillow_imports`);
  console.log('\n');
}

// Run
const jsonFile = process.argv[2];
if (!jsonFile) {
  console.error('❌ Error: Please provide a JSON file path');
  console.error('Usage: npx tsx scripts/import-json-to-firebase.ts <path-to-json>');
  process.exit(1);
}

importJsonToFirebase(jsonFile).catch(console.error);
