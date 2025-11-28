/**
 * Verify that recently imported properties have nearbyCities populated correctly
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
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

async function main() {
  console.log('Checking recently imported properties for nearbyCities...\n');

  // Get the 20 most recent zillow_imports
  const recent = await db.collection('zillow_imports')
    .orderBy('foundAt', 'desc')
    .limit(20)
    .get();

  console.log(`Found ${recent.size} recent imports:\n`);

  let withNearbyCities = 0;
  let withoutNearbyCities = 0;

  recent.docs.forEach(doc => {
    const data = doc.data();
    const nearbyCities = data.nearbyCities || [];
    const foundAt = data.foundAt?.toDate?.()?.toISOString?.()?.split('T')[0] || 'unknown';

    if (nearbyCities.length > 0) {
      withNearbyCities++;
      console.log(`✅ ${data.city}, ${data.state} (${foundAt}): ${nearbyCities.length} nearby cities`);
      console.log(`   Source: ${data.nearbyCitiesSource || 'unknown'}`);
      console.log(`   First 3: ${nearbyCities.slice(0, 3).join(', ')}`);
    } else {
      withoutNearbyCities++;
      console.log(`❌ ${data.city}, ${data.state} (${foundAt}): NO nearby cities`);
    }
  });

  console.log(`\n📊 Summary:`);
  console.log(`   With nearbyCities: ${withNearbyCities}`);
  console.log(`   Without nearbyCities: ${withoutNearbyCities}`);

  // Check if any have nearbyCitiesSource = 'import-auto' (from the new scraper code)
  const autoImported = recent.docs.filter(doc => doc.data().nearbyCitiesSource === 'import-auto');
  console.log(`   Auto-populated during import: ${autoImported.length}`);
}

main().catch(console.error);
