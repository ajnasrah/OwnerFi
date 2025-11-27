import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

// The FIXED strict regex
const STRICT_RENT_TO_OWN = /rent[\s-]+to[\s-]+own/i;

// The OLD loose regex that caused false positives
const OLD_LOOSE_REGEX = /rent.*to.*own/i;

async function findFalsePositives() {
  console.log('=== FINDING "RENT TO OWN" FALSE POSITIVES ===\n');
  console.log('Looking for properties that:');
  console.log('  - Matched OLD loose regex: /rent.*to.*own/');
  console.log('  - But DON\'T match NEW strict regex: /rent[\\s-]+to[\\s-]+own/\n');

  // Get all properties from zillow_imports
  const allImports = await db.collection('zillow_imports').get();
  console.log(`Total properties in zillow_imports: ${allImports.size}\n`);

  const falsePositives: { url: string; address?: string; description: string; snippet: string }[] = [];

  for (const doc of allImports.docs) {
    const data = doc.data();
    const desc = data.description || '';

    // Check if OLD regex matches but NEW regex doesn't
    if (OLD_LOOSE_REGEX.test(desc) && !STRICT_RENT_TO_OWN.test(desc)) {
      // This is a false positive
      const lowerDesc = desc.toLowerCase();

      // Find where "rent" appears
      const rentIdx = lowerDesc.indexOf('rent');
      if (rentIdx !== -1) {
        const start = Math.max(0, rentIdx - 30);
        const end = Math.min(desc.length, rentIdx + 100);
        const snippet = desc.substring(start, end);

        falsePositives.push({
          url: data.url,
          address: data.address,
          description: desc.substring(0, 300),
          snippet: snippet,
        });
      }
    }
  }

  console.log(`Found ${falsePositives.length} potential false positives:\n`);

  for (const fp of falsePositives) {
    console.log(`Address: ${fp.address || 'Unknown'}`);
    console.log(`URL: ${fp.url}`);
    console.log(`Snippet: "...${fp.snippet}..."`);
    console.log('---\n');
  }

  if (falsePositives.length > 0) {
    console.log('\n=== DELETING FALSE POSITIVES ===\n');

    for (const fp of falsePositives) {
      const snap = await db.collection('zillow_imports').where('url', '==', fp.url).get();
      if (!snap.empty) {
        await snap.docs[0].ref.delete();
        console.log(`Deleted: ${fp.address || fp.url}`);
      }
    }

    console.log(`\n✅ Deleted ${falsePositives.length} false positives`);
  } else {
    console.log('No false positives found!');
  }
}

findFalsePositives();
