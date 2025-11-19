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

async function checkPropertiesToDelete() {
  console.log('\n🔍 Checking Sample Properties That Will Be Deleted\n');
  console.log('='.repeat(80));

  const snapshot = await db.collection('zillow_imports').get();

  let checked = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const result = hasOwnerFinancing(data.description);

    if (!result.shouldSend && checked < 5) {
      console.log('\n' + '━'.repeat(80));
      console.log(`\n📍 Property: ${data.fullAddress || data.streetAddress}`);
      console.log(`\n📝 Description: ${data.description?.substring(0, 400) || 'NO DESCRIPTION'}...`);
      console.log(`\n❌ Filter Decision: Will be DELETED`);
      console.log(`Reason: ${result.reason}`);
      console.log(`Confidence: ${result.confidence}`);
      checked++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\nShowed ${checked} sample properties that will be deleted.\n`);
}

checkPropertiesToDelete()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
