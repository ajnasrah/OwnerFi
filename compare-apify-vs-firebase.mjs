import { ApifyClient } from 'apify-client';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

const runId = 'BPSgbePtBUgkXYQl0';
const address = '2836 NW 5th Ter';

console.log(`\n📊 Comparing Apify vs Firebase for ${address}...\n`);

// Get from Apify WITH fields
const run = await apify.run(runId).get();
const { items: itemsWithFields } = await apify.dataset(run.defaultDatasetId).listItems({
  fields: ['streetAddress', 'attributionInfo'],
  limit: 100
});

const apifyItem = itemsWithFields.find(item => item.streetAddress === address);

console.log('=== APIFY DATA (with fields parameter) ===');
console.log('  streetAddress:', apifyItem?.streetAddress);
console.log('  attributionInfo:', apifyItem?.attributionInfo ? 'EXISTS' : 'MISSING');
if (apifyItem?.attributionInfo) {
  console.log('  agentName:', apifyItem.attributionInfo.agentName || 'null');
  console.log('  agentPhoneNumber:', apifyItem.attributionInfo.agentPhoneNumber || 'null');
  console.log('  brokerPhoneNumber:', apifyItem.attributionInfo.brokerPhoneNumber || 'null');
}

// Get from Apify WITHOUT fields
const { items: itemsWithoutFields } = await apify.dataset(run.defaultDatasetId).listItems({
  limit: 100
});

const apifyItemNoFields = itemsWithoutFields.find(item => item.streetAddress === address);

console.log('\n=== APIFY DATA (WITHOUT fields parameter) ===');
console.log('  streetAddress:', apifyItemNoFields?.streetAddress);
console.log('  attributionInfo:', apifyItemNoFields?.attributionInfo ? 'EXISTS' : 'MISSING');
console.log('  Top-level keys count:', Object.keys(apifyItemNoFields || {}).length);

// Get from Firebase
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = getFirestore(app);

const snapshot = await db.collection('zillow_imports').where('streetAddress', '==', address).limit(1).get();

if (!snapshot.empty) {
  const fbData = snapshot.docs[0].data();
  console.log('\n=== FIREBASE DATA ===');
  console.log('  streetAddress:', fbData.streetAddress);
  console.log('  agentName:', fbData.agentName || 'MISSING');
  console.log('  agentPhoneNumber:', fbData.agentPhoneNumber || 'MISSING');
  console.log('  importedAt:', fbData.importedAt?.toDate());
}

process.exit(0);
