/**
 * Backfills missing Zestimates using RentCast Value API
 *
 * This script:
 * 1. Finds properties in zillow_imports with missing/zero estimate
 * 2. Calls RentCast value API for each property
 * 3. Updates the estimate field with RentCast's value estimate
 * 4. Adds rentCastEstimate flag to track which estimates came from RentCast
 *
 * Run with: npx tsx scripts/backfill-missing-zestimates.ts
 *
 * Optional arguments:
 *   --limit N : Process only N properties (for testing)
 *   --dry-run : Don't save to database, just show what would be updated
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { detectNeedsWork, getMatchingKeywords } from '../src/lib/property-needs-work-detector';

dotenv.config({ path: '.env.local' });

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

interface RentCastValueResponse {
  price: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  latitude?: number;
  longitude?: number;
  subjectProperty?: any;
}

interface BackfillMetrics {
  totalProperties: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  apiCallsUsed: number;
  cashDealsFound: number;
  cashDealsAdded: number;
  needsWorkFound: number;
  errors: Array<{ id: string; address: string; error: string }>;
}

async function getRentCastValue(address: string): Promise<RentCastValueResponse | null> {
  const apiKey = process.env.RENTCAST_API_KEY;

  if (!apiKey) {
    throw new Error('RENTCAST_API_KEY not found in environment variables!');
  }

  try {
    const params = new URLSearchParams({ address });
    const url = `https://api.rentcast.io/v1/avm/value?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return {
      price: data.price,
      priceRangeLow: data.priceRangeLow,
      priceRangeHigh: data.priceRangeHigh,
      latitude: data.latitude,
      longitude: data.longitude,
      subjectProperty: data.subjectProperty,
    };

  } catch (error: any) {
    console.error(`   ❌ RentCast API error: ${error.message}`);
    return null;
  }
}

async function backfillMissingZestimates() {
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : undefined;
  const dryRun = args.includes('--dry-run');

  console.log('🏠 RentCast Zestimate Backfill Tool\n');
  console.log('================================================\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No database changes will be made\n');
  }

  if (limit) {
    console.log(`📋 Limit: Processing first ${limit} properties\n`);
  }

  const metrics: BackfillMetrics = {
    totalProperties: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    apiCallsUsed: 0,
    cashDealsFound: 0,
    cashDealsAdded: 0,
    needsWorkFound: 0,
    errors: [],
  };

  const startTime = Date.now();

  console.log('📋 Fetching properties with missing Zestimates...');

  // Query properties where estimate is missing or 0
  let query = db.collection('zillow_imports');

  const propertiesSnapshot = await query.get();

  // Filter in memory since Firestore doesn't support OR queries easily
  const propertiesMissingEstimate = propertiesSnapshot.docs.filter(doc => {
    const data = doc.data();
    const estimate = data.estimate || 0;
    return estimate === 0;
  });

  if (limit) {
    propertiesMissingEstimate.splice(limit);
  }

  metrics.totalProperties = propertiesMissingEstimate.length;

  if (metrics.totalProperties === 0) {
    console.log('✅ No properties found missing Zestimates!');
    return;
  }

  console.log(`✅ Found ${metrics.totalProperties} properties missing Zestimates\n`);

  for (let i = 0; i < propertiesMissingEstimate.length; i++) {
    const doc = propertiesMissingEstimate[i];
    const data = doc.data();
    const address = data.fullAddress || `${data.address}, ${data.city}, ${data.state} ${data.zipCode}`;

    console.log(`\n[${i + 1}/${metrics.totalProperties}] Processing: ${address}`);
    console.log(`   📍 Property ID: ${doc.id}`);

    if (!address || address === 'undefined') {
      console.log(`   ⚠️  Skipping - no valid address`);
      metrics.skipped++;
      continue;
    }

    // Call RentCast API
    const rentCastData = await getRentCastValue(address);
    metrics.apiCallsUsed++;

    if (rentCastData && rentCastData.price > 0) {
      console.log(`   💰 RentCast Value: $${rentCastData.price.toLocaleString()}`);
      console.log(`   📊 Range: $${rentCastData.priceRangeLow.toLocaleString()} - $${rentCastData.priceRangeHigh.toLocaleString()}`);

      // Check if property qualifies for cash deals (80% filter)
      const price = data.price || 0;
      const estimate = rentCastData.price;
      const eightyPercentOfEstimate = estimate * 0.8;
      const meetsDiscountCriteria = price > 0 && price < eightyPercentOfEstimate;

      // Check if property needs work
      const needsWork = detectNeedsWork(data.description || '');
      const matchingKeywords = needsWork ? getMatchingKeywords(data.description || '') : [];
      const meetsNeedsWorkCriteria = needsWork;

      if (meetsDiscountCriteria || meetsNeedsWorkCriteria) {
        const discountPercentage = price > 0 ? ((estimate - price) / estimate * 100).toFixed(2) : '0';

        if (meetsDiscountCriteria) {
          console.log(`   💰 CASH DEAL! Price: $${price.toLocaleString()}, Estimate: $${estimate.toLocaleString()} (${discountPercentage}% discount)`);
          metrics.cashDealsFound++;
        }

        if (meetsNeedsWorkCriteria) {
          console.log(`   🔨 NEEDS WORK! Keywords: ${matchingKeywords.join(', ')}`);
          metrics.needsWorkFound++;
        }
      }

      if (!dryRun) {
        try {
          // Update estimate in zillow_imports
          await doc.ref.update({
            estimate: rentCastData.price,
            estimateRangeLow: rentCastData.priceRangeLow,
            estimateRangeHigh: rentCastData.priceRangeHigh,
            rentCastEstimate: true, // Flag to track RentCast estimates
            estimateSource: 'rentcast',
            estimateUpdatedAt: new Date(),
          });
          console.log(`   ✅ Updated estimate field`);

          // Add to cash_houses if it qualifies
          if (meetsDiscountCriteria || meetsNeedsWorkCriteria) {
            const discountPercentage = price > 0 ? parseFloat(((estimate - price) / estimate * 100).toFixed(2)) : 0;

            // Check if already exists in cash_houses (by zpid)
            const zpid = data.zpid;
            if (zpid) {
              const existingCashHouse = await db.collection('cash_houses')
                .where('zpid', '==', zpid)
                .limit(1)
                .get();

              if (!existingCashHouse.empty) {
                console.log(`   ⏭️  Already exists in cash_houses`);
              } else {
                // Add to cash_houses
                const cashHouseData = {
                  ...data,
                  estimate: rentCastData.price,
                  estimateRangeLow: rentCastData.priceRangeLow,
                  estimateRangeHigh: rentCastData.priceRangeHigh,
                  discountPercentage,
                  eightyPercentOfZestimate: Math.round(eightyPercentOfEstimate),
                  needsWork,
                  needsWorkKeywords: matchingKeywords,
                  source: 'backfill_rentcast',
                  dealType: meetsDiscountCriteria ? 'discount' : 'needs_work',
                  addedAt: new Date(),
                };

                await db.collection('cash_houses').add(cashHouseData);
                console.log(`   ✅ Added to cash_houses collection`);
                metrics.cashDealsAdded++;
              }
            }
          }

          metrics.successful++;
        } catch (error: any) {
          console.error(`   ❌ Failed to update database: ${error.message}`);
          metrics.failed++;
          metrics.errors.push({
            id: doc.id,
            address,
            error: error.message,
          });
        }
      } else {
        console.log(`   🔍 [DRY RUN] Would update estimate to $${rentCastData.price.toLocaleString()}`);
        if (meetsDiscountCriteria || meetsNeedsWorkCriteria) {
          console.log(`   🔍 [DRY RUN] Would add to cash_houses collection`);
        }
        metrics.successful++;
      }
    } else {
      console.log(`   ❌ Failed to get RentCast estimate`);
      metrics.failed++;
      metrics.errors.push({
        id: doc.id,
        address,
        error: 'RentCast API returned null or zero value',
      });
    }

    metrics.processed++;

    // Rate limiting - 500ms delay between calls (120 calls/minute, well under 20 req/sec limit)
    if (i < propertiesMissingEstimate.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n\n📊 ============ BACKFILL RESULTS ============\n');
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`📋 Total Properties Found: ${metrics.totalProperties}`);
  console.log(`✅ Successfully Updated: ${metrics.successful}`);
  console.log(`❌ Failed: ${metrics.failed}`);
  console.log(`⏭️  Skipped: ${metrics.skipped}`);
  console.log(`📡 API Calls Used: ${metrics.apiCallsUsed}`);
  console.log(`📈 Success Rate: ${((metrics.successful / metrics.totalProperties) * 100).toFixed(1)}%`);
  console.log(`\n💰 CASH DEALS:`);
  console.log(`   Found (80% discount): ${metrics.cashDealsFound}`);
  console.log(`   Added to cash_houses: ${metrics.cashDealsAdded}`);
  console.log(`   Needs Work Found: ${metrics.needsWorkFound}`);

  if (metrics.errors.length > 0) {
    console.log(`\n🚨 Errors (${metrics.errors.length}):`);
    metrics.errors.slice(0, 10).forEach(err => {
      console.log(`   ${err.address}: ${err.error}`);
    });
    if (metrics.errors.length > 10) {
      console.log(`   ... and ${metrics.errors.length - 10} more`);
    }
  }

  console.log('\n========================================\n');

  if (dryRun) {
    console.log('🔍 DRY RUN COMPLETE - No changes were made to the database');
    console.log('   Remove --dry-run flag to actually update the database\n');
  } else {
    console.log('✅ Backfill complete!\n');
  }

  // Estimate remaining API credits
  const usedCredits = 77 + metrics.apiCallsUsed; // Previous tests + this run
  console.log(`📊 Estimated API Credits Used:`);
  console.log(`   Previous tests: 77 credits`);
  console.log(`   This run: ${metrics.apiCallsUsed} credits`);
  console.log(`   Total used: ~${usedCredits} credits`);
  console.log(`   Remaining (if on free tier): ${Math.max(0, 50 - usedCredits)} credits\n`);
}

backfillMissingZestimates().catch(console.error);
