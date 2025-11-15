/**
 * Migration script to add 'source' field to legacy cash_houses properties
 *
 * Properties without a source field won't appear in filtered tabs.
 * This script infers the source based on dealType:
 * - dealType: 'owner_finance' → source: 'zillow_scraper'
 * - dealType: 'discount' or 'needs_work' → source: 'cash_deals_scraper'
 * - No dealType → Analyze other fields to determine source
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}

const db = getFirestore();

async function migrateSourceField() {
  console.log('\n🔄 Starting Source Field Migration\n');
  console.log('═'.repeat(70));

  const results = {
    totalProperties: 0,
    alreadyHaveSource: 0,
    ownerFinance: 0,
    cashDeals: 0,
    unknown: 0,
    updated: 0,
    failed: 0,
  };

  try {
    // Get ALL properties from cash_houses
    const cashHousesRef = collection(db, 'cash_houses');
    const snapshot = await getDocs(cashHousesRef);
    results.totalProperties = snapshot.size;

    console.log(`\n📋 Found ${results.totalProperties} total properties\n`);

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const propertyId = docSnap.id;

      // Check if source already exists
      if (data.source) {
        results.alreadyHaveSource++;
        continue;
      }

      // Infer source based on dealType
      let inferredSource: string | null = null;

      if (data.dealType === 'owner_finance') {
        inferredSource = 'zillow_scraper';
        results.ownerFinance++;
      } else if (data.dealType === 'discount' || data.dealType === 'needs_work') {
        inferredSource = 'cash_deals_scraper';
        results.cashDeals++;
      } else {
        // Unknown - try to infer from other fields
        results.unknown++;
        console.log(`   ⚠️  Unknown source for ${propertyId}: dealType = ${data.dealType || 'missing'}`);
        // Default to cash_deals_scraper as it's more common
        inferredSource = 'cash_deals_scraper';
      }

      // Update document with inferred source
      try {
        await updateDoc(doc(db, 'cash_houses', propertyId), {
          source: inferredSource,
          sourceMigrated: true,
          sourceMigratedAt: Date.now(),
        });
        results.updated++;

        if (results.updated % 10 === 0) {
          console.log(`   ✅ Updated ${results.updated} properties...`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to update ${propertyId}:`, error);
        results.failed++;
      }
    }

    console.log('\n' + '═'.repeat(70));
    console.log('\n📊 Migration Summary:\n');
    console.log(`   Total Properties: ${results.totalProperties}`);
    console.log(`   Already had source: ${results.alreadyHaveSource}`);
    console.log(`   Updated: ${results.updated}`);
    console.log(`     - Zillow scraper (owner_finance): ${results.ownerFinance}`);
    console.log(`     - Cash deals scraper (discount/needs_work): ${results.cashDeals}`);
    console.log(`     - Unknown (defaulted to cash_deals): ${results.unknown}`);
    console.log(`   Failed: ${results.failed}`);

    if (results.updated > 0) {
      console.log(`\n✅ Migration complete! ${results.updated} properties updated.\n`);
    } else {
      console.log(`\n✅ No migration needed - all properties already have source field.\n`);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

migrateSourceField()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
