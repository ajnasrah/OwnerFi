#!/usr/bin/env npx tsx

/**
 * Delete all documents from zillow_imports collection
 * Use this to clear old/corrupt data before reimporting
 */

import * as dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as readline from 'readline';

dotenv.config({ path: '.env.local' });

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

const app = initializeApp({ credential: cert(serviceAccount as any) });
const db = getFirestore();

async function askConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('⚠️  Are you sure you want to DELETE ALL zillow_imports? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function deleteAllZillowImports() {
  console.log('\n🗑️  Delete All Zillow Imports\n');
  console.log('='.repeat(80));

  // Get count
  const snapshot = await db.collection('zillow_imports').get();
  const count = snapshot.size;

  console.log(`Found ${count} documents in zillow_imports collection\n`);

  if (count === 0) {
    console.log('✅ Collection is already empty.\n');
    process.exit(0);
  }

  // Ask for confirmation
  const confirmed = await askConfirmation();

  if (!confirmed) {
    console.log('\n❌ Deletion cancelled.\n');
    process.exit(0);
  }

  console.log('\n🗑️  Deleting...');

  // Delete in batches of 500
  const batchSize = 500;
  let deletedCount = 0;

  while (true) {
    const batch = db.batch();
    const docs = await db.collection('zillow_imports').limit(batchSize).get();

    if (docs.empty) {
      break;
    }

    docs.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    deletedCount += docs.size;

    console.log(`   Deleted ${deletedCount}/${count}...`);
  }

  console.log('\n✅ Deleted all documents from zillow_imports collection');
  console.log(`   Total deleted: ${deletedCount}\n`);
}

deleteAllZillowImports().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
