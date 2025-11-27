/**
 * Backfill Financing Types
 *
 * This script adds the financingType field to existing properties
 * that were imported before this feature was added.
 *
 * Run with: npx tsx scripts/backfill-financing-types.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { detectFinancingType } from '../src/lib/financing-type-detector';

// Load env
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

async function backfillFinancingTypes() {
  console.log('🔄 Starting financing type backfill...\n');

  // Get all properties from zillow_imports that don't have financingType set
  const snapshot = await db.collection('zillow_imports').get();

  console.log(`📊 Total properties in zillow_imports: ${snapshot.size}`);

  let updated = 0;
  let skipped = 0;
  let noDescription = 0;
  let alreadyHasType = 0;

  const stats: Record<string, number> = {};

  let batch = db.batch();
  let batchCount = 0;
  const BATCH_LIMIT = 500;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Skip if already has financingType
    if (data.financingType) {
      alreadyHasType++;
      stats[data.financingType] = (stats[data.financingType] || 0) + 1;
      continue;
    }

    // Get description
    const description = data.description || '';

    if (!description) {
      noDescription++;
      skipped++;
      continue;
    }

    // Detect financing type
    const result = detectFinancingType(description);

    if (!result.financingType) {
      // No financing type detected - use matchedKeywords or primaryKeyword if available
      const fallbackType = data.primaryKeyword || data.matchedKeywords?.[0] || null;

      if (fallbackType) {
        // Map common keywords to financing types
        const keywordMapping: Record<string, string> = {
          'owner financing': 'Owner Finance',
          'owner carry': 'Owner Finance',
          'owner terms': 'Owner Finance',
          'seller financing': 'Seller Finance',
          'seller carry': 'Seller Finance',
          'rent to own': 'Rent to Own',
          'lease option': 'Rent to Own',
          'lease purchase': 'Rent to Own',
          'contract for deed': 'Contract for Deed',
          'land contract': 'Contract for Deed',
        };

        const mappedType = keywordMapping[fallbackType.toLowerCase()] || 'Owner Finance';

        batch.update(doc.ref, {
          financingType: mappedType,
          allFinancingTypes: [mappedType],
          financingTypeLabel: mappedType,
        });

        stats[mappedType] = (stats[mappedType] || 0) + 1;
        updated++;
        batchCount++;
      } else {
        // Default to Owner Finance for verified properties without detected type
        if (data.ownerFinanceVerified) {
          batch.update(doc.ref, {
            financingType: 'Owner Finance',
            allFinancingTypes: ['Owner Finance'],
            financingTypeLabel: 'Owner Finance',
          });

          stats['Owner Finance'] = (stats['Owner Finance'] || 0) + 1;
          updated++;
          batchCount++;
        } else {
          skipped++;
        }
      }
    } else {
      // Update with detected financing type
      batch.update(doc.ref, {
        financingType: result.financingType,
        allFinancingTypes: result.allTypes,
        financingTypeLabel: result.displayLabel,
      });

      stats[result.financingType] = (stats[result.financingType] || 0) + 1;
      updated++;
      batchCount++;
    }

    // Commit batch if we hit the limit
    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      console.log(`   ✅ Committed batch of ${batchCount} updates`);
      batch = db.batch(); // Create new batch
      batchCount = 0;
    }
  }

  // Commit remaining updates
  if (batchCount > 0) {
    await batch.commit();
    console.log(`   ✅ Committed final batch of ${batchCount} updates`);
  }

  // Print summary
  console.log('\n📊 ============ BACKFILL COMPLETE ============');
  console.log(`✅ Updated: ${updated}`);
  console.log(`⏭️  Skipped (no description/type): ${skipped}`);
  console.log(`📝 Already had type: ${alreadyHasType}`);
  console.log(`⚠️  No description: ${noDescription}`);

  console.log('\n📈 Financing Type Distribution:');
  Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const percent = ((count / snapshot.size) * 100).toFixed(1);
      console.log(`   ${type}: ${count} (${percent}%)`);
    });

  console.log('\n==========================================');
}

// Run
backfillFinancingTypes()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
