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

// Loose regex that causes false positives (matches rent...to...own across sentences)
const LOOSE_RENT_TO_OWN = /rent.*to.*own/i;

// Strict regex - only matches actual 'rent to own' phrase
const STRICT_RENT_TO_OWN = /rent[\s-]+to[\s-]+own/i;

// Other valid owner finance patterns
const OTHER_VALID_PATTERNS = [
  /owner\s*financ/i,
  /seller\s*financ/i,
  /owner\s*carry/i,
  /seller\s*carry/i,
  /owner\s*terms/i,
  /seller\s*terms/i,
  /contract\s*for\s*deed/i,
  /land\s*contract/i,
  /wrap\s*mortgage/i,
  /assumable\s*loan/i,
  /no\s*bank\s*(needed|qualifying|required)/i,
  /lease.*option/i,
  /lease.*purchase/i,
];

async function findFalsePositives() {
  console.log('=== FINDING FALSE "RENT TO OWN" MATCHES ===\n');
  console.log('These are properties that:');
  console.log('  - Matched loose regex: rent.*to.*own (words spread across text)');
  console.log('  - But DON\'T have "rent to own" as an actual phrase');
  console.log('  - And DON\'T have any other valid owner financing keywords\n');

  const allImports = await db.collection('zillow_imports').get();
  console.log('Total properties in zillow_imports:', allImports.size);

  const falsePositives: any[] = [];

  for (const doc of allImports.docs) {
    const data = doc.data();
    const desc = data.description || '';

    // Check if it matched LOOSE rent-to-own but NOT STRICT rent-to-own
    if (LOOSE_RENT_TO_OWN.test(desc) && !STRICT_RENT_TO_OWN.test(desc)) {
      // Check if it has any OTHER valid pattern
      const hasOtherValid = OTHER_VALID_PATTERNS.some(p => p.test(desc));

      if (!hasOtherValid) {
        // This is a TRUE false positive - only matched loose rent-to-own, nothing else
        falsePositives.push({
          docId: doc.id,
          url: data.url,
          address: data.address,
          desc: desc.substring(0, 400),
        });
      }
    }
  }

  console.log('\n❌ FALSE POSITIVES FOUND:', falsePositives.length);
  console.log('(Passed filter but should NOT have)\n');

  for (const fp of falsePositives) {
    console.log('Address:', fp.address || 'Unknown');
    console.log('URL:', fp.url);
    console.log('Description:', fp.desc + '...');
    console.log('---\n');
  }

  // Ask to delete
  if (falsePositives.length > 0) {
    console.log('\n=== DELETING FALSE POSITIVES ===\n');

    for (const fp of falsePositives) {
      await db.collection('zillow_imports').doc(fp.docId).delete();
      console.log('Deleted:', fp.url || fp.docId);
    }

    console.log(`\n✅ Deleted ${falsePositives.length} false positives`);
  }
}

findFalsePositives();
