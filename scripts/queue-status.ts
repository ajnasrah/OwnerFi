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
  const queue = await db.collection('scraper_queue').get();

  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  queue.docs.forEach(doc => {
    const d = doc.data();
    byStatus[d.status || 'unknown'] = (byStatus[d.status || 'unknown'] || 0) + 1;
    bySource[d.source || 'unknown'] = (bySource[d.source || 'unknown'] || 0) + 1;
  });

  console.log('Total queue items:', queue.size);
  console.log('\nBy Status:', byStatus);
  console.log('\nBy Source:', bySource);
}

main().then(() => process.exit(0));
