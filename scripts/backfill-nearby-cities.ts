/**
 * Backfill nearbyCities[] on all properties in:
 * - properties collection
 * - zillow_imports collection
 * - cash_houses collection
 *
 * This enables fast array-contains queries instead of in-memory city filtering.
 *
 * Run with: npx tsx scripts/backfill-nearby-cities.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load env vars
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

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

// Import cities database
import citiesData from 'cities.json';

interface City {
  name: string;
  state: string;
  lat: number;
  lng: number;
}

// Filter to US cities only
const usCities: City[] = (citiesData as Array<{
  name: string;
  country: string;
  admin1: string;
  lat: string;
  lng: string;
}>)
  .filter((city) => city.country === 'US')
  .map((city) => ({
    name: city.name,
    state: city.admin1,
    lat: parseFloat(city.lat),
    lng: parseFloat(city.lng)
  }))
  .filter((city: City) => city.state && city.lat && city.lng);

console.log(`📍 Loaded ${usCities.length} US cities`);

// Haversine distance calculation
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Get city coordinates
function getCityCoordinates(cityName: string, state: string): { lat: number; lng: number } | null {
  const city = usCities.find(c =>
    c.name.toLowerCase() === cityName.toLowerCase() &&
    c.state === state
  );
  return city ? { lat: city.lat, lng: city.lng } : null;
}

// Get nearby city names within radius
function getNearbyCityNames(
  propertyCity: string,
  propertyState: string,
  radiusMiles: number = 35,
  maxCities: number = 100
): string[] {
  const centerCoords = getCityCoordinates(propertyCity, propertyState);
  if (!centerCoords) {
    return [];
  }

  // Calculate distances to all cities in the same state
  const nearbyCities = usCities
    .filter(city => city.state === propertyState)
    .map(city => ({
      name: city.name,
      distance: calculateDistance(centerCoords.lat, centerCoords.lng, city.lat, city.lng)
    }))
    .filter(city => city.distance <= radiusMiles && city.name.toLowerCase() !== propertyCity.toLowerCase())
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxCities)
    .map(city => city.name);

  return nearbyCities;
}

async function backfillCollection(collectionName: string, dryRun: boolean = false): Promise<{ updated: number; skipped: number; failed: number }> {
  console.log(`\n📦 Processing ${collectionName}...`);

  const snapshot = await db.collection(collectionName).get();
  console.log(`   Found ${snapshot.size} documents`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Extract city and state (different field names in different collections)
    const city = data.city?.split(',')[0]?.trim();
    const state = data.state;

    if (!city || !state) {
      console.log(`   ⏭️ Skipping ${doc.id}: Missing city or state`);
      skipped++;
      continue;
    }

    // Check if already has nearbyCities
    if (data.nearbyCities && Array.isArray(data.nearbyCities) && data.nearbyCities.length > 0) {
      console.log(`   ⏭️ Skipping ${doc.id}: Already has ${data.nearbyCities.length} nearby cities`);
      skipped++;
      continue;
    }

    // Calculate nearby cities
    const nearbyCities = getNearbyCityNames(city, state, 35, 100);

    if (nearbyCities.length === 0) {
      console.log(`   ⚠️ No nearby cities found for ${city}, ${state}`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`   🔍 Would update ${doc.id}: ${city}, ${state} → ${nearbyCities.length} nearby cities`);
      updated++;
      continue;
    }

    // Add to batch
    batch.update(doc.ref, {
      nearbyCities: nearbyCities,
      nearbyCitiesSource: 'backfill-script',
      nearbyCitiesUpdatedAt: new Date().toISOString()
    });

    batchCount++;
    updated++;

    // Commit batch when it reaches limit
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`   ✅ Committed batch of ${batchCount} updates`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit remaining batch
  if (batchCount > 0 && !dryRun) {
    await batch.commit();
    console.log(`   ✅ Committed final batch of ${batchCount} updates`);
  }

  return { updated, skipped, failed };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  console.log('🚀 Starting nearbyCities backfill...\n');
  const startTime = Date.now();

  const collections = ['properties', 'zillow_imports', 'cash_houses'];
  const results: Record<string, { updated: number; skipped: number; failed: number }> = {};

  for (const collectionName of collections) {
    try {
      results[collectionName] = await backfillCollection(collectionName, dryRun);
    } catch (error) {
      console.error(`❌ Failed to process ${collectionName}:`, error);
      results[collectionName] = { updated: 0, skipped: 0, failed: 1 };
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n📊 ============ BACKFILL RESULTS ============');
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`🔍 Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const [collection, stats] of Object.entries(results)) {
    console.log(`\n${collection}:`);
    console.log(`   ✅ Updated: ${stats.updated}`);
    console.log(`   ⏭️ Skipped: ${stats.skipped}`);
    totalUpdated += stats.updated;
    totalSkipped += stats.skipped;
  }

  console.log(`\n📈 Total: ${totalUpdated} updated, ${totalSkipped} skipped`);
  console.log('=============================================\n');

  if (dryRun) {
    console.log('💡 Run without --dry-run to apply changes');
  }

  process.exit(0);
}

main().catch(console.error);
