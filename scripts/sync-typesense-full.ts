#!/usr/bin/env tsx
/**
 * Full Typesense Sync Script (v3 - Unified Properties Collection)
 *
 * Syncs all properties from the unified 'properties' Firestore collection to Typesense.
 * Uses isOwnerFinance and isCashDeal flags to determine dealType.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Typesense from 'typesense';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

// Initialize Typesense
const typesense = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST!,
    port: 443,
    protocol: 'https'
  }],
  apiKey: process.env.TYPESENSE_API_KEY!,
  connectionTimeoutSeconds: 10
});

interface TypesenseDoc {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  description?: string;
  location?: [number, number];
  dealType: 'owner_finance' | 'cash_deal' | 'both';
  listPrice: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  yearBuilt?: number;
  isActive: boolean;
  propertyType: string;
  primaryImage?: string;
  createdAt: number;
  nearbyCities?: string[];
  ownerFinanceKeywords?: string[];
  monthlyPayment?: number;
  downPaymentAmount?: number;
  zpid?: string;
  zestimate?: number;
  rentEstimate?: number;
  percentOfArv?: number;
  needsWork?: boolean;
  manuallyVerified?: boolean;
  sourceType?: string;
}

interface RawPropertyData {
  streetAddress?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  zipcode?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  price?: number;
  listPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFoot?: number;
  squareFeet?: number;
  yearBuilt?: number;
  homeType?: string;
  propertyType?: string;
  firstPropertyImage?: string;
  imgSrc?: string;
  imageUrl?: string;
  primaryImage?: string;
  importedAt?: FirebaseFirestore.Timestamp;
  createdAt?: FirebaseFirestore.Timestamp;
  nearbyCities?: string[];
  matchedKeywords?: string[];
  monthlyPayment?: number;
  downPaymentAmount?: number;
  status?: string;
  isActive?: boolean;
  isOwnerFinance?: boolean;
  isCashDeal?: boolean;
  dealTypes?: string[];
  ownerFinanceVerified?: boolean;
  manuallyVerified?: boolean;
  zpid?: string | number;
  zestimate?: number;
  estimate?: number;
  rentEstimate?: number;
  rentZestimate?: number;
  percentOfArv?: number;
  needsWork?: boolean;
  source?: string;
}

/**
 * Transform Firestore doc to Typesense doc
 */
function transformDoc(docId: string, data: RawPropertyData): TypesenseDoc | null {
  // Skip inactive/sold properties
  if (data.isActive === false) return null;
  if (data.status === 'sold' || data.status === 'off_market' || data.status === 'inactive') return null;

  const address = data.streetAddress || data.address?.split(',')[0]?.trim() || '';
  const city = data.city || '';
  const state = data.state || '';

  // Skip if missing essential location data
  if (!address || !city || !state) return null;

  // Determine dealType from flags
  let dealType: 'owner_finance' | 'cash_deal' | 'both' = 'owner_finance';
  const isOwnerFinance = data.isOwnerFinance === true;
  const isCashDeal = data.isCashDeal === true;

  if (isOwnerFinance && isCashDeal) {
    dealType = 'both';
  } else if (isCashDeal) {
    dealType = 'cash_deal';
  } else if (isOwnerFinance) {
    dealType = 'owner_finance';
  } else {
    // If neither flag is set, skip (shouldn't happen in unified collection)
    return null;
  }

  const lat = data.latitude || data.lat;
  const lng = data.longitude || data.lng;

  // Use createdAt, fallback to importedAt, then use current time
  const timestamp = data.createdAt?.toMillis?.() || data.importedAt?.toMillis?.() || Date.now();

  // Calculate percentOfArv if not set
  const zestimate = data.zestimate || data.estimate || 0;
  const price = data.price || data.listPrice || 0;
  const percentOfArv = data.percentOfArv || (zestimate > 0 ? Math.round((price / zestimate) * 100) : undefined);

  // Ensure rentEstimate is a number
  let rentEstimate = data.rentEstimate || data.rentZestimate;
  if (typeof rentEstimate === 'string') {
    rentEstimate = parseInt(rentEstimate, 10) || undefined;
  }

  return {
    id: docId,
    zpid: data.zpid ? String(data.zpid) : undefined,
    address,
    city,
    state,
    zipCode: data.zipCode || data.zipcode || '',
    description: data.description || '',
    location: lat && lng ? [lat, lng] : undefined,
    dealType,
    listPrice: price,
    bedrooms: data.bedrooms || 0,
    bathrooms: data.bathrooms || 0,
    squareFeet: data.squareFoot || data.squareFeet,
    yearBuilt: data.yearBuilt,
    isActive: true,
    propertyType: data.homeType || data.propertyType || 'single-family',
    primaryImage: data.primaryImage || data.firstPropertyImage || data.imgSrc || data.imageUrl || '',
    createdAt: timestamp,
    nearbyCities: data.nearbyCities || [],
    ownerFinanceKeywords: data.matchedKeywords || [],
    monthlyPayment: data.monthlyPayment,
    downPaymentAmount: data.downPaymentAmount,
    zestimate: zestimate || undefined,
    rentEstimate,
    percentOfArv,
    needsWork: data.needsWork,
    manuallyVerified: data.manuallyVerified,
    sourceType: data.source,
  };
}

async function syncToTypesense(docs: TypesenseDoc[]): Promise<{ success: number; failed: number }> {
  if (docs.length === 0) {
    return { success: 0, failed: 0 };
  }

  const BATCH_SIZE = 100;
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);

    try {
      const results = await typesense.collections('properties').documents().import(batch, { action: 'upsert' });

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.success) {
          success++;
        } else {
          failed++;
          if (errors.length < 10) {
            const failedDoc = batch[j];
            errors.push(`${result.error} | Doc: ${failedDoc?.address}, ${failedDoc?.city}`);
          }
        }
      }

      // Progress indicator
      const progress = Math.min(i + BATCH_SIZE, docs.length);
      const percent = Math.round((progress / docs.length) * 100);
      process.stdout.write(`   Progress: ${progress}/${docs.length} (${percent}%)\r`);

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`\n   Batch error: ${errorMsg}`);
      failed += batch.length;
    }
  }

  console.log(''); // New line after progress

  if (errors.length > 0) {
    console.log(`\n   Sample errors (${errors.length}):`);
    errors.forEach(e => console.log(`     - ${e}`));
  }

  return { success, failed };
}

async function main() {
  console.log('='.repeat(60));
  console.log('TYPESENSE FULL SYNC (v3 - Unified Properties Collection)');
  console.log('='.repeat(60));

  // Step 1: Load all properties from unified collection
  console.log('\n📦 Loading properties collection...');

  const snapshot = await db.collection('properties').get();
  console.log(`   Found ${snapshot.size} documents`);

  const docs: TypesenseDoc[] = [];
  let skipped = 0;
  let ownerFinanceCount = 0;
  let cashDealCount = 0;
  let bothCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() as RawPropertyData;
    const transformed = transformDoc(doc.id, data);

    if (!transformed) {
      skipped++;
      continue;
    }

    docs.push(transformed);

    if (transformed.dealType === 'owner_finance') ownerFinanceCount++;
    else if (transformed.dealType === 'cash_deal') cashDealCount++;
    else if (transformed.dealType === 'both') bothCount++;
  }

  console.log(`   Valid: ${docs.length}, Skipped: ${skipped}`);
  console.log(`   Owner Finance: ${ownerFinanceCount}`);
  console.log(`   Cash Deal: ${cashDealCount}`);
  console.log(`   Both: ${bothCount}`);

  // Step 2: Recreate Typesense collection
  console.log('\n📝 Recreating Typesense collection...');

  try {
    const collections = await typesense.collections().retrieve();
    const exists = collections.some(c => c.name === 'properties');

    if (exists) {
      console.log('   Deleting existing collection...');
      await typesense.collections('properties').delete();
    }

    await typesense.collections().create({
      name: 'properties',
      fields: [
        { name: 'address', type: 'string' },
        { name: 'city', type: 'string', facet: true },
        { name: 'state', type: 'string', facet: true },
        { name: 'zipCode', type: 'string' },
        { name: 'description', type: 'string', optional: true },
        { name: 'location', type: 'geopoint', optional: true },
        { name: 'dealType', type: 'string', facet: true },
        { name: 'listPrice', type: 'int32', facet: true },
        { name: 'bedrooms', type: 'int32', facet: true },
        { name: 'bathrooms', type: 'float', facet: true },
        { name: 'squareFeet', type: 'int32', optional: true },
        { name: 'yearBuilt', type: 'int32', optional: true },
        { name: 'isActive', type: 'bool', facet: true },
        { name: 'propertyType', type: 'string', facet: true },
        { name: 'primaryImage', type: 'string', optional: true },
        { name: 'createdAt', type: 'int64' },
        { name: 'nearbyCities', type: 'string[]', optional: true },
        { name: 'ownerFinanceKeywords', type: 'string[]', optional: true },
        { name: 'monthlyPayment', type: 'int32', optional: true },
        { name: 'downPaymentAmount', type: 'int32', optional: true },
        { name: 'zpid', type: 'string', optional: true },
        { name: 'zestimate', type: 'int32', optional: true },
        { name: 'rentEstimate', type: 'int32', optional: true },
        { name: 'percentOfArv', type: 'float', optional: true },
        { name: 'needsWork', type: 'bool', optional: true },
        { name: 'manuallyVerified', type: 'bool', optional: true },
        { name: 'sourceType', type: 'string', facet: true, optional: true },
      ],
      default_sorting_field: 'createdAt'
    });
    console.log('   ✅ Collection created');
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('   ❌ Schema error:', errorMsg);
    process.exit(1);
  }

  // Step 3: Sync to Typesense
  console.log('\n📤 Uploading to Typesense...');
  const result = await syncToTypesense(docs);

  // Step 4: Verify
  const collection = await typesense.collections('properties').retrieve();

  console.log('\n' + '='.repeat(60));
  console.log('SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${result.success}`);
  console.log(`❌ Failed: ${result.failed}`);
  console.log(`📊 Total in Typesense: ${collection.num_documents}`);
  console.log('\nBy Deal Type:');
  console.log(`   owner_finance: ${ownerFinanceCount}`);
  console.log(`   cash_deal: ${cashDealCount}`);
  console.log(`   both: ${bothCount}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
