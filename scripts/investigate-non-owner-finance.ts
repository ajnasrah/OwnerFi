import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

async function investigate() {
  console.log('\n🔍 INVESTIGATING NON-OWNER-FINANCE PROPERTIES\n');

  // Get all properties
  const snapshot = await db.collection('zillow_imports').get();

  let noKeywordCount = 0;
  const samples: any[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const desc = data.description || '';

    const filterResult = hasStrictOwnerFinancing(desc);

    if (!filterResult.passes) {
      noKeywordCount++;

      if (samples.length < 20) {
        samples.push({
          id: doc.id,
          address: data.fullAddress || data.address,
          ownerFinanceVerified: data.ownerFinanceVerified,
          isActive: data.isActive,
          source: data.source,
          importSource: data.importSource,
          matchedKeywords: data.matchedKeywords,
          description: desc.substring(0, 300),
          createdAt: data.createdAt,
          importedAt: data.importedAt,
        });
      }
    }
  }

  console.log(`Total properties without owner financing keywords: ${noKeywordCount}\n`);
  console.log('Sample properties:\n');

  for (const s of samples) {
    console.log(`📍 ${s.address}`);
    console.log(`   ID: ${s.id}`);
    console.log(`   ownerFinanceVerified: ${s.ownerFinanceVerified}`);
    console.log(`   isActive: ${s.isActive}`);
    console.log(`   source: ${s.source}`);
    console.log(`   importSource: ${s.importSource}`);
    console.log(`   matchedKeywords: ${JSON.stringify(s.matchedKeywords)}`);
    console.log(`   createdAt: ${s.createdAt}`);
    console.log(`   importedAt: ${s.importedAt}`);
    console.log(`   Description: ${s.description}...`);
    console.log('');
  }
}

investigate()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
