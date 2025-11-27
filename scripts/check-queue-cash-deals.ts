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

async function checkQueueForCashDeals() {
  console.log('=== CHECKING 18K QUEUE DATA STRUCTURE ===\n');

  // Get all recovered properties
  const allSnap = await db.collection('scraper_queue')
    .where('source', '==', 'recovered_apify')
    .get();

  console.log(`Total recovered properties: ${allSnap.size}\n`);

  // Analyze what fields we have
  const fieldCounts: Record<string, number> = {};
  let withZestimate = 0;
  let withDescription = 0;

  for (const doc of allSnap.docs) {
    const data = doc.data();
    for (const key of Object.keys(data)) {
      fieldCounts[key] = (fieldCounts[key] || 0) + 1;
    }
    if (data.zestimate) withZestimate++;
    if (data.description) withDescription++;
  }

  console.log('Fields available in queue:');
  for (const [field, count] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${field}: ${count} (${((count/allSnap.size)*100).toFixed(1)}%)`);
  }

  console.log(`\nWith zestimate: ${withZestimate}`);
  console.log(`With description: ${withDescription}`);

  // Show a sample
  console.log('\n=== SAMPLE ITEMS ===\n');
  for (const doc of allSnap.docs.slice(0, 3)) {
    console.log(JSON.stringify(doc.data(), null, 2));
    console.log('---');
  }
}

checkQueueForCashDeals().catch(console.error);
