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

async function findNoCreativeOffers() {
  console.log('\n🔍 Finding Properties with "no creative/owner financed offers"\n');
  console.log('='.repeat(80));

  const snapshot = await db.collection('zillow_imports').get();

  console.log(`\n📊 Total properties: ${snapshot.size}\n`);

  const patterns = [
    /no\s+creative\s+(or|and)\s+owner\s+financ/i,
    /no\s+owner\s+financ.*offers/i,
    /no\s+creative.*offers/i,
    /no\s+(creative|owner)\s+financ.*offer/i,
    /cash\s+or\s+conventional\s+only/i,
  ];

  const matches: Array<{
    id: string;
    address: string;
    description: string;
    matchedPattern: string;
  }> = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const description = data.description || '';

    for (const pattern of patterns) {
      if (pattern.test(description)) {
        const match = description.match(pattern);
        matches.push({
          id: doc.id,
          address: data.fullAddress || data.streetAddress || 'Unknown',
          description,
          matchedPattern: match ? match[0] : pattern.source,
        });
        break; // Only count once per property
      }
    }
  }

  console.log(`✅ Found ${matches.length} properties with negative financing patterns\n`);

  if (matches.length === 0) {
    console.log('✅ No properties found with this pattern!\n');
    return;
  }

  console.log('='.repeat(80));
  console.log('\n⚠️  PROPERTIES WITH NEGATIVE PATTERNS:\n');

  matches.slice(0, 20).forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address}`);
    console.log(`   ID: ${prop.id}`);
    console.log(`   Matched: "${prop.matchedPattern}"`);
    console.log(`   Description: ${prop.description.substring(0, 200)}...`);
    console.log();
  });

  if (matches.length > 20) {
    console.log(`... and ${matches.length - 20} more\n`);
  }

  console.log('='.repeat(80));
  console.log(`\n📊 Total properties to remove: ${matches.length}\n`);
}

findNoCreativeOffers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
