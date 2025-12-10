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
  console.log('=== CRON LOCKS ===');
  const locks = await db.collection('cron_locks').get();

  if (locks.empty) {
    console.log('No cron locks found');
  } else {
    locks.docs.forEach(doc => {
      const d = doc.data();
      console.log('\nLock:', doc.id);
      console.log('  isRunning:', d.isRunning);
      console.log('  lockedAt:', d.lockedAt?.toDate());
      console.log('  lastRun:', d.lastRun?.toDate());
    });
  }

  // Check scraper_queue stats by source
  console.log('\n=== SCRAPER_QUEUE BY SOURCE ===');
  const allQueue = await db.collection('scraper_queue').get();
  const bySrc: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  allQueue.docs.forEach(doc => {
    const d = doc.data();
    const src = d.source || 'unknown';
    const status = d.status || 'unknown';
    bySrc[src] = (bySrc[src] || 0) + 1;
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  console.log('By Source:', bySrc);
  console.log('By Status:', byStatus);
}

main().then(() => process.exit(0));
