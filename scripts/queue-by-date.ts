import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

async function main() {
  const queue = await db.collection('scraper_queue')
    .orderBy('addedAt', 'desc')
    .limit(2000)
    .get();

  console.log('Total search_cron items:', queue.size);
  console.log('\nGrouped by day:');

  const byDay: Record<string, number> = {};

  queue.docs.forEach(doc => {
    const d = doc.data();
    if (d.source !== 'search_cron') return;
    const date = d.addedAt?.toDate?.();
    if (date) {
      const day = date.toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;
    }
  });

  // Sort by date descending
  Object.entries(byDay)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .forEach(([day, count]) => {
      console.log(`  ${day}: ${count} items`);
    });
}

main().then(() => process.exit(0));
