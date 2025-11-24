import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';
import { hasNegativeKeywords } from '../src/lib/negative-keywords';

// Load environment variables
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

async function deleteWeakFilterProperties() {
  console.log('\n🗑️  DELETING PROPERTIES THAT DON\'T PASS STRICT FILTER\n');
  console.log('='.repeat(80));

  // Get all properties
  const allProperties = await db.collection('zillow_imports').get();
  console.log(`\n📦 Total properties in database: ${allProperties.size}\n`);

  const toDelete: any[] = [];
  const toKeep: any[] = [];

  console.log('🔄 Scanning properties for filter compliance...\n');

  // Check each property
  allProperties.docs.forEach((doc, idx) => {
    const data = doc.data();
    const desc = data.description;

    // Progress indicator
    if ((idx + 1) % 100 === 0) {
      console.log(`   Scanned ${idx + 1}/${allProperties.size} properties...`);
    }

    // Only process properties with valid descriptions
    if (desc && typeof desc === 'string' && desc.trim().length > 0) {
      // Check negative keywords first
      const negativeCheck = hasNegativeKeywords(desc);

      // Check strict filter
      const filterCheck = hasStrictOwnerFinancing(desc);

      if (negativeCheck.hasNegative || !filterCheck.passes) {
        toDelete.push({
          id: doc.id,
          address: data.fullAddress,
          zpid: data.zpid,
          reason: negativeCheck.hasNegative
            ? `Has negative keywords: ${negativeCheck.matches.join(', ')}`
            : 'Does not pass strict filter',
          description: desc.substring(0, 200),
        });
      } else {
        toKeep.push(doc.id);
      }
    }
  });

  console.log('\n✅ Scan complete!\n');
  console.log('='.repeat(80));
  console.log('\n📊 SCAN RESULTS\n');
  console.log(`Properties to DELETE: ${toDelete.length}`);
  console.log(`Properties to KEEP: ${toKeep.length}`);
  console.log(`Total scanned: ${allProperties.size}\n`);

  if (toDelete.length === 0) {
    console.log('✅ No properties need to be deleted!\n');
    return;
  }

  console.log('='.repeat(80));
  console.log('\n🔍 PROPERTIES TO DELETE (First 20):\n');

  toDelete.slice(0, 20).forEach((prop, idx) => {
    console.log(`${idx + 1}. ${prop.address}`);
    console.log(`   ZPID: ${prop.zpid}`);
    console.log(`   Reason: ${prop.reason}`);
    console.log(`   Description: ${prop.description}...`);
    console.log('');
  });

  if (toDelete.length > 20) {
    console.log(`... and ${toDelete.length - 20} more\n`);
  }

  console.log('='.repeat(80));
  console.log('\n🔄 Starting deletion...\n');

  let deletedCount = 0;
  let failedCount = 0;
  const batch = db.batch();
  const BATCH_SIZE = 500; // Firestore batch limit

  for (let i = 0; i < toDelete.length; i++) {
    const property = toDelete[i];

    try {
      const docRef = db.collection('zillow_imports').doc(property.id);
      batch.delete(docRef);
      deletedCount++;

      // Progress indicator
      if ((i + 1) % 100 === 0) {
        console.log(`   Processed ${i + 1}/${toDelete.length} deletions...`);
      }

      // Commit batch every BATCH_SIZE items
      if ((i + 1) % BATCH_SIZE === 0 || i === toDelete.length - 1) {
        await batch.commit();
        console.log(`   ✅ Committed batch (${deletedCount} total deleted)`);
      }

    } catch (error) {
      console.log(`   ❌ Failed to delete ${property.address}: ${error}`);
      failedCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 DELETION SUMMARY\n');
  console.log(`Total properties processed: ${toDelete.length}`);
  console.log(`Successfully deleted: ${deletedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Remaining properties: ${toKeep.length}`);

  const percentDeleted = ((deletedCount / allProperties.size) * 100).toFixed(1);
  const percentRemaining = ((toKeep.length / allProperties.size) * 100).toFixed(1);

  console.log(`\nPercentage deleted: ${percentDeleted}%`);
  console.log(`Percentage remaining: ${percentRemaining}%`);

  if (deletedCount === toDelete.length) {
    console.log('\n✅ All weak filter properties successfully deleted!');
  } else if (deletedCount > 0) {
    console.log('\n⚠️  Some properties were deleted, but some failed.');
  } else {
    console.log('\n❌ No properties were deleted.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Cleanup complete!\n');
}

// Run deletion
deleteWeakFilterProperties()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
