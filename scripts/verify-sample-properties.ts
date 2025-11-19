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

async function verifySampleProperties() {
  console.log('\n🔍 Verifying Sample Properties\n');
  console.log('='.repeat(80));

  // Sample IDs from the output
  const sampleIds = [
    '0F8STOZL9OutF9intXWO', // 2842 LUCOMA Drive
    '0UdpxBW8Vkudft2T5OqQ', // 1011 Runyon Dr
    '0V0HLvGitdK3480Rv1tW', // 12001 Vista Parke Dr (should have OF)
    '0QHeRknFHBHgsQSjNKkI', // 716 N Joplin Ave (should have OF)
  ];

  for (const id of sampleIds) {
    const doc = await db.collection('zillow_imports').doc(id).get();
    if (!doc.exists) {
      console.log(`\n❌ Property ${id} not found`);
      continue;
    }

    const data = doc.data();
    const result = hasOwnerFinancing(data?.description);

    console.log('\n' + '━'.repeat(80));
    console.log(`\n📍 Property: ${data?.fullAddress || data?.streetAddress}`);
    console.log(`ID: ${id}`);
    console.log(`\n📝 Description:\n${data?.description || 'NO DESCRIPTION'}\n`);
    console.log(`Filter Result: ${result.shouldSend ? '✅ HAS' : '❌ NO'} Owner Financing`);
    console.log(`Reason: ${result.reason}`);
    console.log(`Confidence: ${result.confidence}`);
  }

  console.log('\n' + '='.repeat(80));
}

verifySampleProperties()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
