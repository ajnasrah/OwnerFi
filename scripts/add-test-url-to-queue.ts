/**
 * Add a test Zillow URL to the scraper queue for testing
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
  // Test URL - a known owner finance property
  // Using a property in "Saint Petersburg, FL" to test fuzzy matching
  const testUrl = process.argv[2];

  if (!testUrl) {
    console.log('Usage: npx tsx scripts/add-test-url-to-queue.ts <zillow-url>');
    console.log('Example: npx tsx scripts/add-test-url-to-queue.ts "https://www.zillow.com/homedetails/..."');
    process.exit(1);
  }

  // Check if URL already exists
  const existing = await db.collection('scraper_queue')
    .where('url', '==', testUrl)
    .limit(1)
    .get();

  if (!existing.empty) {
    console.log('❌ URL already exists in queue');
    const data = existing.docs[0].data();
    console.log(`   Status: ${data.status}`);
    process.exit(1);
  }

  // Add to queue
  const docRef = await db.collection('scraper_queue').add({
    url: testUrl,
    status: 'pending',
    addedAt: new Date(),
    source: 'manual-test'
  });

  console.log('✅ Added to scraper queue:', docRef.id);
  console.log('   URL:', testUrl);
  console.log('\nNow run: curl -s "http://localhost:3000/api/cron/process-scraper-queue" -H "Authorization: Bearer <CRON_SECRET>"');
}

main().catch(console.error);
