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

async function check() {
  console.log('=== ALL FIRESTORE COLLECTIONS ===\n');

  const collections = await db.listCollections();
  for (const col of collections) {
    try {
      const count = await db.collection(col.id).count().get();
      console.log(`${col.id}: ${count.data().count.toLocaleString()}`);
    } catch (e) {
      console.log(`${col.id}: error counting`);
    }
  }

  // Check scraper_queue in detail
  console.log('\n=== SCRAPER QUEUE BREAKDOWN ===');
  const pending = await db.collection('scraper_queue').where('status', '==', 'pending').count().get();
  const completed = await db.collection('scraper_queue').where('status', '==', 'completed').count().get();
  const failed = await db.collection('scraper_queue').where('status', '==', 'failed').count().get();

  console.log(`  pending: ${pending.data().count.toLocaleString()}`);
  console.log(`  completed: ${completed.data().count.toLocaleString()}`);
  console.log(`  failed: ${failed.data().count.toLocaleString()}`);

  console.log('\n=== WHAT THIS MEANS ===');
  console.log(`
The 18,518 URLs in scraper_queue are JUST URLs - they haven't been scraped yet!

The flow is:
1. Search scraper finds property URLs → adds to scraper_queue (pending)
2. process-scraper-queue takes each URL → calls Apify to get FULL details
3. Applies strict owner finance filter
4. If passes → adds to zillow_imports
5. Marks queue item as "completed"

Right now:
- 18,518 URLs waiting to be scraped (pending)
- 50 were scraped successfully (completed)
- 2 failed
- Apify limit hit → can't process the rest

The $100 was spent getting the 36k URLs, but most haven't been
scraped for their full property details yet.
`);
}

check();
