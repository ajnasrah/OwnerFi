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

console.log('\n🔄 Migrating Apify data with correct phone numbers to Firebase...\n');

// Get recent successful Apify runs
const runs = await apify.actor('maxcopell/zillow-detail-scraper').runs().list({ limit: 30 });

let updated = 0;
let skipped = 0;
let errors = 0;

for (const run of runs.items) {
  if (run.status !== 'SUCCEEDED') continue;

  console.log(`\nProcessing run ${run.id} (${new Date(run.startedAt).toLocaleString()})`);

  try {
    const { items } = await apify.dataset(run.defaultDatasetId).listItems({
      fields: ['streetAddress', 'attributionInfo'],
      limit: 1000
    });

    for (const item of items) {
      if (!item.attributionInfo || !item.streetAddress) continue;

      const agentPhone = item.attributionInfo.agentPhoneNumber || item.attributionInfo.brokerPhoneNumber;
      if (!agentPhone) continue;

      // Find in Firebase
      const snapshot = await db
        .collection('zillow_imports')
        .where('streetAddress', '==', item.streetAddress)
        .limit(1)
        .get();

      if (snapshot.empty) {
        skipped++;
        continue;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      // Only update if missing phone
      if (data.agentPhoneNumber && data.agentPhoneNumber.trim()) {
        skipped++;
        continue;
      }

      // Update with attribution info
      await doc.ref.update({
        agentName: item.attributionInfo.agentName || '',
        agentPhoneNumber: item.attributionInfo.agentPhoneNumber || item.attributionInfo.brokerPhoneNumber || '',
        agentEmail: item.attributionInfo.agentEmail || '',
        agentLicenseNumber: item.attributionInfo.agentLicenseNumber || '',
        brokerName: item.attributionInfo.brokerName || '',
        brokerPhoneNumber: item.attributionInfo.brokerPhoneNumber || '',
      });

      updated++;
      console.log(`  ✓ Updated ${item.streetAddress} with agent: ${item.attributionInfo.agentName || 'unknown'}, phone: ${agentPhone}`);
    }
  } catch (error) {
    console.error(`  ✗ Error processing run ${run.id}:`, error.message);
    errors++;
  }
}

console.log('\n📊 Migration complete:');
console.log(`  Updated: ${updated}`);
console.log(`  Skipped: ${skipped}`);
console.log(`  Errors: ${errors}`);

process.exit(0);
