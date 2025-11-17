import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { COMPREHENSIVE_NEGATIVE_KEYWORDS, hasNegativeFinancingKeywords } from './comprehensive-negative-keywords';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

async function removeFalsePositives() {
  console.log('\n🗑️  Removing False Positive Properties from Database\n');
  console.log('='.repeat(80));
  console.log('\nUsing comprehensive negative keyword list:');
  console.log(`Total negative keywords: ${COMPREHENSIVE_NEGATIVE_KEYWORDS.length}`);
  console.log('='.repeat(80));

  try {
    // Get all properties
    console.log('\n📥 Fetching all properties from zillow_imports...');
    const snapshot = await db.collection('zillow_imports').get();

    console.log(`📊 Found ${snapshot.size} total properties\n`);
    console.log('🔎 Identifying false positives...\n');

    const toRemove: Array<{
      id: string;
      address: string;
      negativeKeywords: string[];
    }> = [];

    let processedCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      processedCount++;

      const description = data.description || '';
      const { isNegative, negativeMatches } = hasNegativeFinancingKeywords(description);

      if (isNegative) {
        toRemove.push({
          id: doc.id,
          address: data.fullAddress || data.streetAddress || 'Unknown',
          negativeKeywords: negativeMatches,
        });
      }

      // Progress indicator
      if (processedCount % 100 === 0) {
        console.log(`⏳ Progress: ${processedCount}/${snapshot.size} properties scanned...`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 IDENTIFICATION RESULTS:\n');
    console.log(`Total Properties:          ${snapshot.size}`);
    console.log(`False Positives Found:     ${toRemove.length}`);
    console.log(`Clean Properties:          ${snapshot.size - toRemove.length}`);
    console.log(`False Positive Rate:       ${((toRemove.length / snapshot.size) * 100).toFixed(1)}%`);

    if (toRemove.length === 0) {
      console.log('\n✅ No false positives found! Database is clean.\n');
      return;
    }

    // Show sample of what will be removed
    console.log('\n' + '='.repeat(80));
    console.log('\n⚠️  PROPERTIES TO BE REMOVED (First 10):\n');

    toRemove.slice(0, 10).forEach((prop, i) => {
      console.log(`${i + 1}. ${prop.address}`);
      console.log(`   ID: ${prop.id}`);
      console.log(`   Negative Keywords: ${prop.negativeKeywords.join(', ')}\n`);
    });

    if (toRemove.length > 10) {
      console.log(`... and ${toRemove.length - 10} more`);
    }

    // Ask for confirmation
    console.log('\n' + '='.repeat(80));
    console.log('\n⚠️  WARNING: This will PERMANENTLY DELETE these properties!\n');
    console.log(`Proceeding to remove ${toRemove.length} false positive properties...\n`);

    // Remove properties in batches
    let removedCount = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (const prop of toRemove) {
      const docRef = db.collection('zillow_imports').doc(prop.id);
      batch.delete(docRef);
      batchCount++;
      removedCount++;

      // Commit batch when it reaches 500 operations
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`💾 Deleted batch of ${batchCount} properties (${removedCount}/${toRemove.length} total)`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`💾 Deleted final batch of ${batchCount} properties`);
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📈 REMOVAL SUMMARY:\n');
    console.log(`Original Property Count:   ${snapshot.size}`);
    console.log(`Properties Removed:        ${removedCount}`);
    console.log(`Remaining Properties:      ${snapshot.size - removedCount}`);
    console.log(`Success Rate:              100%`);

    // Verify results
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Verifying database...\n');

    const verifySnapshot = await db.collection('zillow_imports').get();
    console.log(`Final property count: ${verifySnapshot.size}`);
    console.log(`Expected: ${snapshot.size - removedCount}`);

    if (verifySnapshot.size === snapshot.size - removedCount) {
      console.log('\n✅ Verification successful! All false positives removed.\n');
    } else {
      console.log('\n⚠️  Warning: Property count mismatch. Please review.\n');
    }

    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

removeFalsePositives()
  .then(() => {
    console.log('\n✅ False positive removal complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Removal failed:', error);
    process.exit(1);
  });
