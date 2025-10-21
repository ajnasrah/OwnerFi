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

async function checkPropertyURLs() {
  console.log('🔍 Checking URL storage in zillow_imports...\n');

  const snapshot = await db
    .collection('zillow_imports')
    .orderBy('importedAt', 'desc')
    .limit(5)
    .get();

  snapshot.docs.forEach((doc, i) => {
    const data = doc.data();
    console.log(`\n${i + 1}. ${data.fullAddress || data.streetAddress}`);
    console.log(`   ZPID: ${data.zpid || 'MISSING'}`);
    console.log(`   URL: ${data.url || 'MISSING'}`);
    console.log(`   hdpUrl: ${data.hdpUrl || 'MISSING'}`);
    console.log(`   Agent Phone: ${data.agentPhoneNumber || 'MISSING'}`);
    console.log(`   Broker Phone: ${data.brokerPhoneNumber || 'MISSING'}`);
  });

  // Pick one without contact info
  const withoutContact = snapshot.docs.find(doc => {
    const data = doc.data();
    return !data.agentPhoneNumber && !data.brokerPhoneNumber;
  });

  if (withoutContact) {
    const data = withoutContact.data();
    const zpid = data.zpid;
    const testUrl = data.url || data.hdpUrl || (zpid ? `https://www.zillow.com/homedetails/${zpid}_zpid/` : '');

    console.log('\n\n🔧 TEST THIS URL with debug-apify-extraction.ts:');
    console.log(testUrl);
  }
}

checkPropertyURLs()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
