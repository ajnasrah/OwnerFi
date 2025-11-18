import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { hasOwnerFinancing } from '../src/lib/owner-financing-filter';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

async function deleteRemainingFalsePositives() {
  console.log('\n🗑️  Final Cleanup: Removing All False Positives\n');
  console.log('='.repeat(80));

  const snapshot = await db.collection('zillow_imports').get();

  console.log(`\n📊 Scanning ${snapshot.size} properties with updated filter...\n`);

  const toDelete: Array<{
    id: string;
    address: string;
    description: string;
    reason: string;
  }> = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const description = data.description || '';
    const address = data.fullAddress || data.streetAddress || 'Unknown';

    // Use the updated filter
    const result = hasOwnerFinancing(description);

    if (!result.shouldSend) {
      toDelete.push({
        id: doc.id,
        address,
        description,
        reason: result.reason,
      });
    }
  }

  console.log(`✅ Found ${toDelete.length} properties to delete\n`);

  if (toDelete.length === 0) {
    console.log('✅ No false positives found! Database is clean.\n');
    return;
  }

  console.log('='.repeat(80));
  console.log('\n⚠️  PROPERTIES TO DELETE:\n');

  toDelete.forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address}`);
    console.log(`   ID: ${prop.id}`);
    console.log(`   Reason: ${prop.reason}`);
    console.log(`   Description: ${prop.description.substring(0, 150)}...`);
    console.log();
  });

  // Breakdown by reason
  const reasonCounts = new Map<string, number>();
  toDelete.forEach(prop => {
    const count = reasonCounts.get(prop.reason) || 0;
    reasonCounts.set(prop.reason, count + 1);
  });

  console.log('='.repeat(80));
  console.log('\n📋 BREAKDOWN BY REASON:\n');

  Array.from(reasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, count]) => {
      const percentage = ((count / toDelete.length) * 100).toFixed(1);
      console.log(`  ${reason}: ${count} (${percentage}%)`);
    });

  console.log('\n' + '='.repeat(80));
  console.log(`\n⚠️  About to DELETE ${toDelete.length} properties...\n`);

  // Delete in batches
  let deletedCount = 0;
  const BATCH_SIZE = 500;

  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + BATCH_SIZE);

    chunk.forEach(prop => {
      batch.delete(db.collection('zillow_imports').doc(prop.id));
    });

    await batch.commit();
    deletedCount += chunk.length;
    console.log(`  ✅ Deleted ${chunk.length} properties (${deletedCount}/${toDelete.length} total)`);
  }

  // Verify
  const verifySnapshot = await db.collection('zillow_imports').get();
  console.log(`\n📊 Verification:`);
  console.log(`Original count:  ${snapshot.size}`);
  console.log(`Deleted:         ${deletedCount}`);
  console.log(`Current count:   ${verifySnapshot.size}`);
  console.log(`Expected:        ${snapshot.size - deletedCount}`);

  if (verifySnapshot.size === snapshot.size - deletedCount) {
    console.log('\n✅ Verification successful!\n');
  } else {
    console.log('\n⚠️  Warning: Count mismatch!\n');
  }

  console.log('='.repeat(80));
}

deleteRemainingFalsePositives()
  .then(() => {
    console.log('\n🎉 All false positives removed! Database is now clean.\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
