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

async function checkUrls() {
  console.log('Checking zillow_imports for URLs...\n');

  const snapshot = await db.collection('zillow_imports')
    .limit(10)
    .get();

  console.log(`Found ${snapshot.size} properties\n`);
  console.log('Sample properties with URLs:\n');

  snapshot.docs.forEach((doc, index) => {
    const data = doc.data();
    console.log(`${index + 1}. ZPID: ${doc.id}`);
    console.log(`   URL: ${data.url || 'NO URL'}`);
    console.log(`   hdpUrl: ${data.hdpUrl || 'NO hdpUrl'}`);
    console.log(`   Address: ${data.fullAddress || data.streetAddress || 'N/A'}`);
    console.log(`   Home Status: ${data.homeStatus || 'N/A'}`);
    console.log();
  });

  // Get a random property with URL to test
  const randomSnapshot = await db.collection('zillow_imports')
    .where('url', '>', '')
    .limit(1)
    .get();

  if (!randomSnapshot.empty) {
    const randomDoc = randomSnapshot.docs[0];
    const randomData = randomDoc.data();

    console.log('\n=== RANDOM PROPERTY TO TEST ===');
    console.log(`ZPID: ${randomDoc.id}`);
    console.log(`URL: ${randomData.url}`);
    console.log(`hdpUrl: ${randomData.hdpUrl || 'N/A'}`);
    console.log(`Address: ${randomData.fullAddress}`);
    console.log(`Home Status: ${randomData.homeStatus}`);
    console.log(`Price: $${randomData.price?.toLocaleString() || 'N/A'}`);
    console.log('\nYou can visit this URL to verify the listing status\n');
  }
}

checkUrls().then(() => process.exit(0)).catch(console.error);
