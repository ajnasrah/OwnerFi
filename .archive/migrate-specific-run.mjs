import { ApifyClient } from 'apify-client';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = getFirestore(app);

console.log('\n🔄 Migrating run BPSgbePtBUgkXYQl0 (13:59:25)...\n');

const runId = 'BPSgbePtBUgkXYQl0';

const run = await apify.run(runId).get();
const { items } = await apify.dataset(run.defaultDatasetId).listItems({
  fields: ['streetAddress', 'attributionInfo', 'url'],
  limit: 1000
});

console.log(`Found ${items.length} items in Apify run`);

let updated = 0;

for (const item of items) {
  if (!item.streetAddress) continue;

  const snapshot = await db
    .collection('zillow_imports')
    .where('streetAddress', '==', item.streetAddress)
    .limit(1)
    .get();

  if (snapshot.empty) continue;

  const doc = snapshot.docs[0];
  const data = doc.data();

  // Build update object
  const updates = {};

  if (item.attributionInfo) {
    if (item.attributionInfo.agentName) updates.agentName = item.attributionInfo.agentName;
    if (item.attributionInfo.agentPhoneNumber) updates.agentPhoneNumber = item.attributionInfo.agentPhoneNumber;
    if (item.attributionInfo.agentEmail) updates.agentEmail = item.attributionInfo.agentEmail;
    if (item.attributionInfo.agentLicenseNumber) updates.agentLicenseNumber = item.attributionInfo.agentLicenseNumber;
    if (item.attributionInfo.brokerName) updates.brokerName = item.attributionInfo.brokerName;
    if (item.attributionInfo.brokerPhoneNumber) updates.brokerPhoneNumber = item.attributionInfo.brokerPhoneNumber;
  }

  if (item.url && !data.url) updates.url = item.url;

  if (Object.keys(updates).length > 0) {
    await doc.ref.update(updates);
    updated++;
    console.log(`✓ Updated ${item.streetAddress}:`, updates);
  }
}

console.log(`\n✅ Updated ${updated} properties from run ${runId}`);

process.exit(0);
