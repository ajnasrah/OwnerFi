import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function checkSources() {
  // Count PENDING items by source
  const pendingSnap = await db.collection('scraper_queue')
    .where('status', '==', 'pending')
    .get();

  const bySource = new Map<string, number>();
  pendingSnap.docs.forEach(doc => {
    const src = doc.data().source || 'unknown';
    bySource.set(src, (bySource.get(src) || 0) + 1);
  });

  console.log('=== PENDING ITEMS BY SOURCE ===');
  [...bySource.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([src, count]) => {
      console.log(`  ${src}: ${count}`);
    });

  console.log('\n=== RECOMMENDATION ===');

  const manualCount = bySource.get('manual_import_11k') || 0;
  const searchCronCount = bySource.get('search_cron') || 0;

  if (manualCount > 0) {
    console.log(`⚠️  ${manualCount} items from 'manual_import_11k' are clogging the queue`);
    console.log('   These are likely NOT owner finance properties');
    console.log('   Consider: DELETE these to let legitimate items process');
  }

  if (searchCronCount > 0) {
    console.log(`✅ ${searchCronCount} items from 'search_cron' are legitimate owner finance URLs`);
  }

  process.exit(0);
}

checkSources();
