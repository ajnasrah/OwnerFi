#!/usr/bin/env tsx
/**
 * FULL DATABASE REBUILD FROM APIFY
 *
 * 1. Pulls ALL property data from Apify (historical runs)
 * 2. Deduplicates by zpid
 * 3. Runs through unified filter (owner finance + cash deal detection)
 * 4. Clears existing properties collection
 * 5. Imports all filtered/labeled properties
 * 6. Syncs to Typesense
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { ApifyClient } from 'apify-client';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import Typesense from 'typesense';

// Import the filter functions
import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';

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
const apifyClient = new ApifyClient({ token: process.env.APIFY_API_KEY! });

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

interface ApifyProperty {
  zpid?: string | number;
  id?: string;
  streetAddress?: string;
  address?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  price?: number;
  listPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  squareFeet?: number;
  yearBuilt?: number;
  homeType?: string;
  propertyType?: string;
  description?: string;
  // Multiple image fields from Apify
  imgSrc?: string;
  hiResImageLink?: string;
  mediumImageLink?: string;
  responsivePhotos?: Array<{ url?: string }>;
  url?: string;
  hdpUrl?: string;
  latitude?: number;
  longitude?: number;
  zestimate?: number;
  rentZestimate?: number;
  daysOnZillow?: number;
  homeStatus?: string;
  scrapedAt?: string; // ISO timestamp from Apify
  [key: string]: unknown;
}

interface ProcessedProperty {
  id: string;
  zpid: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number | null;
  yearBuilt: number | null;
  propertyType: string;
  description: string;
  primaryImage: string;
  url: string;
  latitude: number | null;
  longitude: number | null;
  zestimate: number | null;
  rentEstimate: number | null;
  daysOnZillow: number | null;
  homeStatus: string;
  // Classification
  isOwnerFinance: boolean;
  isCashDeal: boolean;
  dealTypes: string[];
  matchedKeywords: string[];
  percentOfArv: number | null;
  needsWork: boolean;
  // Metadata
  isActive: boolean;
  source: string;
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

// Keywords that indicate property needs work (for investors)
const NEEDS_WORK_KEYWORDS = [
  'investor special',
  'investor opportunity',
  'handyman special',
  'fixer upper',
  'fixer-upper',
  'needs work',
  'needs updating',
  'needs renovation',
  'needs rehab',
  'needs tlc',
  'as-is',
  'as is',
  'sold as-is',
  'cash only',
  'cash buyers',
  'great potential',
  'bring your vision',
  'diamond in the rough',
  'cosmetic updates needed',
  'priced to sell',
  'below market',
  'estate sale',
  'bank owned',
  'reo',
  'foreclosure',
  'short sale',
];

function detectNeedsWork(description: string): { needsWork: boolean; keywords: string[] } {
  const descLower = description.toLowerCase();
  const matched: string[] = [];

  for (const keyword of NEEDS_WORK_KEYWORDS) {
    if (descLower.includes(keyword)) {
      matched.push(keyword);
    }
  }

  return { needsWork: matched.length > 0, keywords: matched };
}

function processProperty(raw: ApifyProperty): ProcessedProperty | null {
  const zpid = String(raw.zpid || raw.id || '');
  if (!zpid) return null;

  const streetAddress = raw.streetAddress || raw.address?.split(',')[0]?.trim() || '';
  const city = raw.city || '';
  const state = raw.state || '';

  if (!streetAddress || !city || !state) return null;

  const price = raw.price || raw.listPrice || 0;
  if (price <= 0) return null;

  const description = raw.description || '';
  const zestimate = raw.zestimate || 0;

  // Run through owner finance filter (negative keywords already checked inside)
  const ownerFinanceResult = hasStrictOwnerFinancing(description);
  const isOwnerFinance = ownerFinanceResult.passes;

  // Run through cash deal filter
  const percentOfArv = zestimate > 0 ? Math.round((price / zestimate) * 100) : null;
  const isBelowMarket = percentOfArv !== null && percentOfArv <= 80;
  const needsWorkResult = detectNeedsWork(description);
  const isCashDeal = isBelowMarket || needsWorkResult.needsWork;

  // Skip if doesn't pass any filter
  if (!isOwnerFinance && !isCashDeal) return null;

  // Build deal types array
  const dealTypes: string[] = [];
  if (isOwnerFinance) dealTypes.push('owner_finance');
  if (isCashDeal) dealTypes.push('cash_deal');

  return {
    id: `zpid_${zpid}`,
    zpid,
    streetAddress,
    city,
    state,
    zipCode: raw.zipcode || '',
    price,
    bedrooms: raw.bedrooms || 0,
    bathrooms: raw.bathrooms || 0,
    squareFeet: raw.livingArea || raw.squareFeet || null,
    yearBuilt: raw.yearBuilt || null,
    propertyType: raw.homeType || raw.propertyType || 'single-family',
    description,
    primaryImage: raw.hiResImageLink || raw.mediumImageLink || raw.imgSrc || raw.responsivePhotos?.[0]?.url || '',
    url: raw.url || raw.hdpUrl || `https://www.zillow.com/homedetails/${zpid}_zpid/`,
    latitude: raw.latitude || null,
    longitude: raw.longitude || null,
    zestimate: zestimate || null,
    rentEstimate: raw.rentZestimate || null,
    daysOnZillow: raw.daysOnZillow || null,
    homeStatus: raw.homeStatus || 'FOR_SALE',
    // Classification
    isOwnerFinance,
    isCashDeal,
    dealTypes,
    matchedKeywords: ownerFinanceResult.matchedKeywords || [],
    percentOfArv,
    needsWork: needsWorkResult.needsWork,
    // Metadata
    isActive: true,
    source: 'apify-rebuild',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function pullAllApifyData(): Promise<Map<string, ApifyProperty>> {
  console.log('\n📥 STEP 1: Pulling ALL property data from Apify...\n');

  const allProperties = new Map<string, ApifyProperty>();

  // Get ALL runs from both scrapers (paginate through all)
  const allZillowRuns = [];
  const allDetailRuns = [];

  // Fetch all zillow-scraper runs
  let offset = 0;
  while (true) {
    const batch = await apifyClient.actor('maxcopell/zillow-scraper').runs().list({ limit: 100, offset, desc: true });
    allZillowRuns.push(...batch.items);
    if (batch.items.length < 100) break;
    offset += 100;
  }

  // Fetch all zillow-detail-scraper runs
  offset = 0;
  while (true) {
    const batch = await apifyClient.actor('maxcopell/zillow-detail-scraper').runs().list({ limit: 100, offset, desc: true });
    allDetailRuns.push(...batch.items);
    if (batch.items.length < 100) break;
    offset += 100;
  }

  console.log(`Found ${allZillowRuns.length} zillow-scraper runs (all)`);
  console.log(`Found ${allDetailRuns.length} zillow-detail-scraper runs (all)\n`);

  let totalFetched = 0;

  // Process zillow-scraper runs
  for (const run of allZillowRuns) {
    if (!run.defaultDatasetId) continue;

    try {
      const dataset = await apifyClient.dataset(run.defaultDatasetId).listItems({ limit: 10000 });

      if (dataset.items.length > 0) {
        for (const item of dataset.items as ApifyProperty[]) {
          const zpid = String(item.zpid || item.id || '');
          if (zpid && !allProperties.has(zpid)) {
            allProperties.set(zpid, item);
            totalFetched++;
          }
        }
      }
    } catch (e) {
      // Dataset may be deleted
    }
  }

  // Process detail runs (merge with existing, keep most recent)
  let runsProcessed = 0;
  for (const run of allDetailRuns) {
    if (!run.defaultDatasetId) continue;

    try {
      const dataset = await apifyClient.dataset(run.defaultDatasetId).listItems({ limit: 10000 });

      if (dataset.items.length > 0) {
        for (const item of dataset.items as ApifyProperty[]) {
          const zpid = String(item.zpid || item.id || '');
          if (zpid) {
            const existing = allProperties.get(zpid);
            if (existing) {
              // Keep most recent based on scrapedAt timestamp
              const existingTime = existing.scrapedAt ? new Date(existing.scrapedAt).getTime() : 0;
              const newTime = item.scrapedAt ? new Date(item.scrapedAt).getTime() : 0;
              if (newTime >= existingTime) {
                // New is more recent - merge with new taking priority
                allProperties.set(zpid, { ...existing, ...item });
              }
              // else keep existing (it's more recent)
            } else {
              allProperties.set(zpid, item);
              totalFetched++;
            }
          }
        }
      }

      runsProcessed++;
      if (runsProcessed % 100 === 0) {
        console.log(`   Processed ${runsProcessed}/${allDetailRuns.length} detail runs, ${allProperties.size} unique properties...`);
      }
    } catch (e) {
      // Dataset may be deleted
    }
  }

  console.log(`✅ Total unique properties from Apify: ${allProperties.size}\n`);
  return allProperties;
}

async function clearDatabase() {
  console.log('\n🗑️  STEP 2: Clearing existing database...\n');

  // Clear Firestore properties collection
  const propertiesRef = db.collection('properties');
  let deleted = 0;

  let snapshot = await propertiesRef.limit(200).get();
  while (!snapshot.empty) {
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deleted++;
    });
    await batch.commit();

    process.stdout.write(`   Deleted ${deleted} documents...\r`);

    snapshot = await propertiesRef.limit(200).get();  // Re-assign to check next batch
  }

  console.log(`\n   ✅ Deleted ${deleted} documents from Firestore`);

  // Clear Typesense
  try {
    await typesense.collections('properties').delete();
    console.log('   ✅ Deleted Typesense collection');
  } catch (e) {
    console.log('   ⚠️  Typesense collection already empty or not found');
  }

  // Recreate Typesense collection
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
  console.log('   ✅ Recreated Typesense collection\n');
}

async function importProperties(rawProperties: Map<string, ApifyProperty>) {
  console.log('\n📤 STEP 3: Processing and importing properties...\n');

  const processed: ProcessedProperty[] = [];
  let skipped = 0;
  let ownerFinanceCount = 0;
  let cashDealCount = 0;
  let bothCount = 0;

  for (const [zpid, raw] of rawProperties) {
    const property = processProperty(raw);
    if (!property) {
      skipped++;
      continue;
    }

    processed.push(property);

    if (property.isOwnerFinance && property.isCashDeal) bothCount++;
    else if (property.isOwnerFinance) ownerFinanceCount++;
    else if (property.isCashDeal) cashDealCount++;
  }

  console.log(`   Total raw: ${rawProperties.size}`);
  console.log(`   Passed filters: ${processed.length}`);
  console.log(`   Skipped (no filter match): ${skipped}`);
  console.log(`\n   Owner Finance only: ${ownerFinanceCount}`);
  console.log(`   Cash Deal only: ${cashDealCount}`);
  console.log(`   Both: ${bothCount}`);
  console.log(`   Total to import: ${processed.length}\n`);

  // Import to Firestore in batches
  console.log('   Importing to Firestore...');
  const BATCH_SIZE = 500;
  let imported = 0;

  for (let i = 0; i < processed.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchItems = processed.slice(i, i + BATCH_SIZE);

    for (const property of batchItems) {
      const docRef = db.collection('properties').doc(property.id);
      batch.set(docRef, property);
    }

    await batch.commit();
    imported += batchItems.length;
    process.stdout.write(`   Imported ${imported}/${processed.length} to Firestore...\r`);
  }

  console.log(`\n   ✅ Imported ${imported} properties to Firestore\n`);

  // Sync to Typesense
  console.log('   Syncing to Typesense...');
  let typesenseSuccess = 0;
  let typesenseFailed = 0;

  for (let i = 0; i < processed.length; i += 100) {
    const batch = processed.slice(i, i + 100);
    const typesenseDocs = batch.map(p => ({
      id: p.id,
      address: p.streetAddress,
      city: p.city,
      state: p.state,
      zipCode: p.zipCode,
      description: p.description,
      location: p.latitude && p.longitude ? [p.latitude, p.longitude] : undefined,
      dealType: p.isOwnerFinance && p.isCashDeal ? 'both' : p.isOwnerFinance ? 'owner_finance' : 'cash_deal',
      listPrice: p.price,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      squareFeet: p.squareFeet,
      yearBuilt: p.yearBuilt,
      isActive: true,
      propertyType: p.propertyType,
      primaryImage: p.primaryImage,
      createdAt: Date.now(),
      ownerFinanceKeywords: p.matchedKeywords,
      zpid: p.zpid,
      zestimate: p.zestimate,
      rentEstimate: p.rentEstimate,
      percentOfArv: p.percentOfArv,
      needsWork: p.needsWork,
      sourceType: p.source,
    }));

    try {
      const results = await typesense.collections('properties').documents().import(typesenseDocs, { action: 'upsert' });
      typesenseSuccess += results.filter(r => r.success).length;
      typesenseFailed += results.filter(r => !r.success).length;
    } catch (e) {
      typesenseFailed += batch.length;
    }

    process.stdout.write(`   Synced ${typesenseSuccess}/${processed.length} to Typesense...\r`);
  }

  console.log(`\n   ✅ Synced to Typesense: ${typesenseSuccess} success, ${typesenseFailed} failed\n`);

  return { total: processed.length, ownerFinanceCount, cashDealCount, bothCount };
}

async function main() {
  console.log('='.repeat(60));
  console.log('FULL DATABASE REBUILD FROM APIFY');
  console.log('='.repeat(60));

  try {
    // Step 1: Pull all Apify data
    const rawProperties = await pullAllApifyData();

    // Step 2: Clear existing database
    await clearDatabase();

    // Step 3: Process and import
    const stats = await importProperties(rawProperties);

    // Summary
    console.log('='.repeat(60));
    console.log('REBUILD COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total Properties: ${stats.total}`);
    console.log(`Owner Finance: ${stats.ownerFinanceCount}`);
    console.log(`Cash Deal: ${stats.cashDealCount}`);
    console.log(`Both: ${stats.bothCount}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
