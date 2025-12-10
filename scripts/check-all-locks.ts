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
  console.log('=== CHECKING ALL CRON LOCKS ===\n');

  const locks = await db.collection('cron_locks').get();

  if (locks.empty) {
    console.log('No cron locks found in database');
  } else {
    const now = Date.now();

    for (const doc of locks.docs) {
      const data = doc.data();
      const expiresAt = data.expiresAt;
      const isExpired = expiresAt < now;
      const acquiredAt = data.acquiredAt ? new Date(data.acquiredAt).toISOString() : 'N/A';
      const expiresAtStr = expiresAt ? new Date(expiresAt).toISOString() : 'N/A';

      console.log(`Lock: ${doc.id}`);
      console.log(`  Instance ID: ${data.instanceId || 'N/A'}`);
      console.log(`  Acquired At: ${acquiredAt}`);
      console.log(`  Expires At: ${expiresAtStr}`);
      console.log(`  Is Expired: ${isExpired ? 'YES (can be released)' : 'NO (still active)'}`);
      console.log(`  Is Running: ${data.isRunning || 'N/A'}`);
      console.log('');
    }
  }

  // Also check for run-search-scraper specifically in a different format
  console.log('\n=== CHECKING run-search-scraper LOCK ===');
  const searchLock = await db.collection('cron_locks').doc('run-search-scraper').get();
  if (searchLock.exists) {
    console.log('Lock exists:', JSON.stringify(searchLock.data(), null, 2));
  } else {
    console.log('No lock found for run-search-scraper');
  }
}

main().then(() => process.exit(0));
