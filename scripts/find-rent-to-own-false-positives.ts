import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';

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

async function findFalsePositives() {
  console.log('=== FINDING PROPERTIES THAT NO LONGER PASS STRICT FILTER ===\n');
  console.log('Looking for properties that:');
  console.log('  - Were imported before the fix');
  console.log('  - But DON\'T pass the UPDATED strict filter\n');

  // Get all properties from zillow_imports
  const allImports = await db.collection('zillow_imports').get();
  console.log(`Total properties in zillow_imports: ${allImports.size}\n`);

  const falsePositives: { docId: string; url: string; address?: string; description: string }[] = [];

  for (const doc of allImports.docs) {
    const data = doc.data();
    const desc = data.description || '';

    // Check if property still passes the UPDATED strict filter
    const result = hasStrictOwnerFinancing(desc);

    if (!result.passes) {
      // This property no longer passes - it's a false positive that slipped through
      falsePositives.push({
        docId: doc.id,
        url: data.url,
        address: data.address,
        description: desc.substring(0, 200),
      });
    }
  }

  console.log(`Found ${falsePositives.length} false positives that no longer pass filter:\n`);

  // Show first 20
  for (const fp of falsePositives.slice(0, 20)) {
    console.log(`Address: ${fp.address || 'Unknown'}`);
    console.log(`URL: ${fp.url || 'undefined'}`);
    console.log(`Description: "${fp.description}..."`);
    console.log('---\n');
  }

  if (falsePositives.length > 20) {
    console.log(`... and ${falsePositives.length - 20} more\n`);
  }

  if (falsePositives.length > 0) {
    console.log('\n=== DELETING FALSE POSITIVES ===\n');

    let deleted = 0;
    for (const fp of falsePositives) {
      try {
        await db.collection('zillow_imports').doc(fp.docId).delete();
        deleted++;
        if (deleted % 50 === 0) {
          console.log(`Deleted ${deleted}/${falsePositives.length}...`);
        }
      } catch (e) {
        console.log(`Error deleting ${fp.docId}: ${e}`);
      }
    }

    console.log(`\n✅ Deleted ${deleted} false positives`);
  } else {
    console.log('No false positives found!');
  }
}

findFalsePositives();
