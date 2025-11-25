/**
 * Delete confirmed false positives from zillow_imports
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

// IDs to delete (from CONFIRMED-FALSE-POSITIVES.xlsx)
const FALSE_POSITIVE_IDS = [
  'V9Ief0n5cPPpB53JNo3F',
  '1srDdbhzT1eYE5QC4o0E',
  '46fDmB6PgQoLXXhM8Miy',
  'kQSmryZ5dYWAtXxYDbUG',
  'p6LsCljV8eGtjhZvgspm',
  'hYJOWYV0Z5XMeE8w5uN9',
  '6eAIjYKAg8ggg1AS235d',
  'tPH65CzSIGhj9LfTcoSF',
];

async function main() {
  console.log('🗑️  Deleting 8 confirmed false positives from zillow_imports...\n');

  let deleted = 0;
  let notFound = 0;

  for (const id of FALSE_POSITIVE_IDS) {
    try {
      const docRef = db.collection('zillow_imports').doc(id);
      const doc = await docRef.get();

      if (doc.exists) {
        const data = doc.data();
        console.log(`✅ Deleting: ${data?.address || data?.streetAddress || id}, ${data?.city}, ${data?.state}`);
        await docRef.delete();
        deleted++;
      } else {
        console.log(`⚠️  Not found: ${id}`);
        notFound++;
      }
    } catch (error) {
      console.error(`❌ Error deleting ${id}:`, error);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Deleted: ${deleted}`);
  console.log(`   ⚠️  Not found: ${notFound}`);
  console.log(`\n✅ Done!`);
}

main().catch(console.error);
