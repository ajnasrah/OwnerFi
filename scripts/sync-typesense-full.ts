#!/usr/bin/env tsx
/**
 * Full Typesense Sync Script (v2 - Fixed)
 *
 * Syncs all properties from Firestore to Typesense with proper deduplication.
 * Properties existing in both zillow_imports AND cash_houses are merged
 * into dealType: 'both'.
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
  importedAt?: FirebaseFirestore.Timestamp;
  createdAt?: FirebaseFirestore.Timestamp;
  nearbyCities?: string[];
  matchedKeywords?: string[];
  monthlyPayment?: number;
  downPaymentAmount?: number;
  status?: string;
  ownerFinanceVerified?: boolean;
  zpid?: string;
}

/**
 * Create a normalized dedup key from address + city + state
 */
function createDedupKey(address: string, city: string, state: string): string {
  return `${address}|${city}|${state}`
    .toLowerCase()
    .replace(/[^a-z0-9|]/g, '')
    .trim();
}

/**
 * Transform Firestore doc to Typesense doc
 */
function transformDoc(
  docId: string,
  data: RawPropertyData,
  dealType: 'owner_finance' | 'cash_deal'
): TypesenseDoc | null {
  // Skip inactive/sold properties
  if (data.status === 'sold' || data.status === 'off_market') return null;
  if (dealType === 'owner_finance' && data.ownerFinanceVerified === false) return null;

  const address = data.streetAddress || data.address?.split(',')[0]?.trim() || '';
  const city = data.city || '';
  const state = data.state || '';

  // Skip if missing essential location data
  if (!address || !city || !state) return null;

  const lat = data.latitude || data.lat;
  const lng = data.longitude || data.lng;

  // Use importedAt, fallback to createdAt, then use a default timestamp (not 0)
  // Typesense requires valid timestamps for sorting
  const timestamp = data.importedAt?.toMillis?.() || data.createdAt?.toMillis?.() || Date.now();

  return {
    id: docId,
    zpid: data.zpid ? String(data.zpid) : undefined, // Ensure zpid is a string
    address,
    city,
    state,
    zipCode: data.zipCode || data.zipcode || '',
    description: data.description || '',
    location: lat && lng ? [lat, lng] : undefined,
    dealType,
    listPrice: data.price || data.listPrice || 0,
    bedrooms: data.bedrooms || 0,
    bathrooms: data.bathrooms || 0,
    squareFeet: data.squareFoot || data.squareFeet,
    yearBuilt: data.yearBuilt,
    isActive: true,
    propertyType: data.homeType || data.propertyType || 'single-family',
    primaryImage: data.firstPropertyImage || data.imgSrc || data.imageUrl || '',
    createdAt: timestamp,
    nearbyCities: data.nearbyCities || [],
    ownerFinanceKeywords: data.matchedKeywords || [],
    monthlyPayment: data.monthlyPayment,
    downPaymentAmount: data.downPaymentAmount,
  };
}

/**
 * Merge two property records (when same property exists in both collections)
 */
function mergeProperties(existing: TypesenseDoc, incoming: TypesenseDoc): TypesenseDoc {
  return {
    ...existing,
    // Use dealType 'both' when found in both collections
    dealType: 'both',
    // Keep the better data (non-empty values)
    zipCode: existing.zipCode || incoming.zipCode,
    description: existing.description || incoming.description,
    location: existing.location || incoming.location,
    squareFeet: existing.squareFeet || incoming.squareFeet,
    yearBuilt: existing.yearBuilt || incoming.yearBuilt,
    primaryImage: existing.primaryImage || incoming.primaryImage,
    // Use earliest timestamp
    createdAt: Math.min(existing.createdAt || Infinity, incoming.createdAt || Infinity) || Date.now(),
    // Merge arrays
    nearbyCities: [...new Set([...(existing.nearbyCities || []), ...(incoming.nearbyCities || [])])],
    ownerFinanceKeywords: [...new Set([...(existing.ownerFinanceKeywords || []), ...(incoming.ownerFinanceKeywords || [])])],
    // Keep owner finance specific fields if available
    monthlyPayment: existing.monthlyPayment || incoming.monthlyPayment,
    downPaymentAmount: existing.downPaymentAmount || incoming.downPaymentAmount,
  };
}

async function loadCollection(
  collectionName: string,
  dealType: 'owner_finance' | 'cash_deal'
): Promise<Map<string, TypesenseDoc>> {
  console.log(`\n📦 Loading ${collectionName}...`);

  const snapshot = await db.collection(collectionName).get();
  console.log(`   Found ${snapshot.size} documents`);

  const docs = new Map<string, TypesenseDoc>();
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() as RawPropertyData;
    const transformed = transformDoc(doc.id, data, dealType);

    if (!transformed) {
      skipped++;
      continue;
    }

    // Create dedup key from address
    const dedupKey = createDedupKey(transformed.address, transformed.city, transformed.state);

    // Also check by ZPID if available
    const zpidKey = data.zpid ? `zpid:${data.zpid}` : null;

    // Check for existing by address key
    if (docs.has(dedupKey)) {
      // Duplicate within same collection - keep the one with better data
      const existing = docs.get(dedupKey)!;
      if (transformed.createdAt > existing.createdAt) {
        docs.set(dedupKey, transformed);
      }
    } else {
      docs.set(dedupKey, transformed);
    }

    // Also index by ZPID for cross-collection dedup
    if (zpidKey && !docs.has(zpidKey)) {
      docs.set(zpidKey, transformed);
    }
  }

  console.log(`   Valid: ${docs.size}, Skipped: ${skipped}`);
  return docs;
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
            // Include the document that failed for debugging
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

      // Try to get more details from importResults
      if (error && typeof error === 'object' && 'importResults' in error) {
        const importResults = (error as { importResults: Array<{ success: boolean; error?: string }> }).importResults;
        for (let j = 0; j < Math.min(importResults.length, 3); j++) {
          if (!importResults[j].success) {
            const failedDoc = batch[j];
            console.error(`     Failed doc ${j}: ${importResults[j].error} | ${failedDoc?.address}`);
          }
        }
      }

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
  console.log('TYPESENSE FULL SYNC (v2 - With Deduplication)');
  console.log('='.repeat(60));

  // Step 1: Load both collections
  const ownerFinanceProps = await loadCollection('zillow_imports', 'owner_finance');
  const cashDealProps = await loadCollection('cash_houses', 'cash_deal');

  // Step 2: Merge collections with deduplication
  console.log('\n🔄 Merging and deduplicating...');

  const merged = new Map<string, TypesenseDoc>();
  let duplicatesFound = 0;

  // Add all owner finance properties first
  for (const [key, doc] of ownerFinanceProps) {
    if (!key.startsWith('zpid:')) { // Skip ZPID keys, use address keys
      merged.set(key, doc);
    }
  }

  // Merge in cash deal properties
  for (const [key, doc] of cashDealProps) {
    if (key.startsWith('zpid:')) continue; // Skip ZPID keys

    if (merged.has(key)) {
      // Property exists in both collections - merge!
      const existing = merged.get(key)!;
      merged.set(key, mergeProperties(existing, doc));
      duplicatesFound++;
    } else {
      merged.set(key, doc);
    }
  }

  const uniqueDocs = Array.from(merged.values());

  console.log(`   Owner Finance: ${ownerFinanceProps.size}`);
  console.log(`   Cash Deals: ${cashDealProps.size}`);
  console.log(`   Duplicates merged: ${duplicatesFound}`);
  console.log(`   Final unique: ${uniqueDocs.length}`);

  // Step 3: Recreate Typesense collection
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
      ],
      default_sorting_field: 'createdAt'
    });
    console.log('   ✅ Collection created');
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('   ❌ Schema error:', errorMsg);
    process.exit(1);
  }

  // Step 4: Sync to Typesense
  console.log('\n📤 Uploading to Typesense...');
  const result = await syncToTypesense(uniqueDocs);

  // Step 5: Verify
  const collection = await typesense.collections('properties').retrieve();

  // Stats breakdown
  const dealTypeStats = {
    owner_finance: uniqueDocs.filter(d => d.dealType === 'owner_finance').length,
    cash_deal: uniqueDocs.filter(d => d.dealType === 'cash_deal').length,
    both: uniqueDocs.filter(d => d.dealType === 'both').length,
  };

  console.log('\n' + '='.repeat(60));
  console.log('SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${result.success}`);
  console.log(`❌ Failed: ${result.failed}`);
  console.log(`📊 Total in Typesense: ${collection.num_documents}`);
  console.log('\nBy Deal Type:');
  console.log(`   owner_finance: ${dealTypeStats.owner_finance}`);
  console.log(`   cash_deal: ${dealTypeStats.cash_deal}`);
  console.log(`   both: ${dealTypeStats.both}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
