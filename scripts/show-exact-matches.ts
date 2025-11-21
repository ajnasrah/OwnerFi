import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { getFilterExplanation } from '../src/lib/owner-financing-filter';

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

async function showExactMatches() {
  console.log('\n🎯 EXACT PATTERN MATCHES - First 30 Properties\n');
  console.log('='.repeat(100));

  const snapshot = await db.collection('zillow_imports').limit(30).get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const desc = data.description || '';
    const address = data.fullAddress || data.streetAddress || 'Unknown';

    console.log(`\n📍 ${address}`);
    console.log(`   ${getFilterExplanation(desc)}`);

    // Show snippet of where the match occurred
    const lowerDesc = desc.toLowerCase();
    if (lowerDesc.includes('owner financ') || lowerDesc.includes('seller financ')) {
      const index = Math.max(
        lowerDesc.indexOf('owner financ'),
        lowerDesc.indexOf('seller financ')
      );
      if (index >= 0) {
        const start = Math.max(0, index - 30);
        const end = Math.min(desc.length, index + 50);
        const snippet = desc.substring(start, end);
        console.log(`   Context: "...${snippet}..."`);
      }
    }
    console.log('-'.repeat(100));
  }
}

showExactMatches()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
