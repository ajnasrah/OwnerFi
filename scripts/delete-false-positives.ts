import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

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

async function deleteFalsePositives() {
  console.log('\n🗑️  Deleting False Positive Properties\n');
  console.log('='.repeat(80));

  const snapshot = await db.collection('zillow_imports').get();

  console.log(`\n📊 Scanning ${snapshot.size} properties...\n`);

  // Find properties with negative patterns
  const patterns = [
    /no\s+creative\s+(or|and)\s+owner\s+financ/i,
    /no\s+owner\s+financ.*offers/i,
    /no\s+creative.*financ.*offers/i,
  ];

  const toDelete: Array<{
    id: string;
    address: string;
    description: string;
  }> = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const description = data.description || '';

    for (const pattern of patterns) {
      if (pattern.test(description)) {
        toDelete.push({
          id: doc.id,
          address: data.fullAddress || data.streetAddress || 'Unknown',
          description,
        });
        break;
      }
    }
  }

  console.log(`✅ Found ${toDelete.length} false positive properties\n`);

  if (toDelete.length === 0) {
    console.log('✅ No false positives to delete!\n');
    return;
  }

  console.log('='.repeat(80));
  console.log('\n⚠️  PROPERTIES TO DELETE:\n');

  toDelete.forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address}`);
    console.log(`   ID: ${prop.id}`);
    console.log(`   Description: ${prop.description.substring(0, 150)}...`);
    console.log();
  });

  console.log('='.repeat(80));
  console.log(`\n⚠️  About to DELETE ${toDelete.length} properties...\n`);

  // Delete in batch
  const batch = db.batch();
  toDelete.forEach(prop => {
    batch.delete(db.collection('zillow_imports').doc(prop.id));
  });

  await batch.commit();

  console.log(`✅ Deleted ${toDelete.length} false positive properties\n`);

  // Verify
  const verifySnapshot = await db.collection('zillow_imports').get();
  console.log(`\n📊 Verification:`);
  console.log(`Original count:  ${snapshot.size}`);
  console.log(`Deleted:         ${toDelete.length}`);
  console.log(`Current count:   ${verifySnapshot.size}`);
  console.log(`Expected:        ${snapshot.size - toDelete.length}`);

  if (verifySnapshot.size === snapshot.size - toDelete.length) {
    console.log('\n✅ Verification successful!\n');
  } else {
    console.log('\n⚠️  Warning: Count mismatch!\n');
  }

  console.log('='.repeat(80));
}

deleteFalsePositives()
  .then(() => {
    console.log('\n✅ False positives deleted successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
