import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { detectNegativeFinancing } from '../src/lib/negative-financing-detector';
import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';

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

// Check specific problem properties from the audit report
const problemIds = [
  'IEkJ0xU7XKDkAubepVRo', // "no owner-carry"
  'S9gVOzfGWDzrR2y6jfuz', // "no wholesalers or seller financing"
  'jEXDiHo8D3dkup4bakss', // "no wholesalers or seller financing"
  'oXtrHmD6b82YdDWVtBWX', // "no seller-financing offered"
  'ounsULsNmvCvPNf1k5S4', // "no wholesalers or owner-financing"
];

async function checkProblemProperties() {
  console.log('Checking specific problem properties from audit report...\n');

  for (const id of problemIds) {
    const doc = await db.collection('zillow_imports').doc(id).get();

    if (!doc.exists) {
      console.log(`❌ ${id}: NOT FOUND (may have been deleted)`);
      continue;
    }

    const data = doc.data()!;
    console.log(`📍 ${data.fullAddress || data.address}`);
    console.log(`   ID: ${id}`);
    console.log(`   ownerFinanceVerified: ${data.ownerFinanceVerified}`);
    console.log(`   isActive: ${data.isActive}`);

    const negResult = detectNegativeFinancing(data.description);
    console.log(`   Negative detection: ${negResult.isNegative ? 'YES - ' + negResult.reason : 'NO'}`);

    const filterResult = hasStrictOwnerFinancing(data.description);
    console.log(`   Strict filter passes: ${filterResult.passes}`);

    if (data.description) {
      console.log(`   Description (first 200 chars): ${data.description.substring(0, 200)}...`);
    }
    console.log('');
  }
}

checkProblemProperties()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
