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

async function check() {
  // Get sample of pending items from manual_import_11k
  const pending = await db.collection('scraper_queue')
    .where('status', '==', 'pending')
    .where('source', '==', 'manual_import_11k')
    .limit(10)
    .get();

  console.log('=== SAMPLE PENDING ITEMS (manual_import_11k) ===\n');
  
  let i = 0;
  for (const doc of pending.docs) {
    i++;
    const d = doc.data();
    console.log(i + '. ' + (d.address || 'No address'));
    console.log('   URL: ' + d.url);
    console.log('   Price: ' + (d.price || 'N/A'));
    console.log('   Added: ' + (d.addedAt?.toDate?.()?.toISOString()?.split('T')[0] || 'N/A'));
    console.log('');
  }

  // Count by source
  const [searchCron, manualImport] = await Promise.all([
    db.collection('scraper_queue').where('source', '==', 'search_cron').count().get(),
    db.collection('scraper_queue').where('source', '==', 'manual_import_11k').count().get()
  ]);

  console.log('=== TOTAL COUNTS BY SOURCE ===');
  console.log('  search_cron: ' + searchCron.data().count);
  console.log('  manual_import_11k: ' + manualImport.data().count);

  process.exit(0);
}
check();
