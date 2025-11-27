import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function checkCounts() {
  // Count zillow_imports (properties that passed filter)
  const importsSnap = await db.collection('zillow_imports').count().get();
  console.log('zillow_imports (passed filter):', importsSnap.data().count);
  
  // Count scraper_queue items
  const queueSnap = await db.collection('scraper_queue').count().get();
  console.log('scraper_queue total:', queueSnap.data().count);
  
  // Count by status
  const pendingSnap = await db.collection('scraper_queue').where('status', '==', 'pending').count().get();
  const completedSnap = await db.collection('scraper_queue').where('status', '==', 'completed').count().get();
  const failedSnap = await db.collection('scraper_queue').where('status', '==', 'failed').count().get();
  
  console.log('  - pending:', pendingSnap.data().count);
  console.log('  - completed:', completedSnap.data().count);
  console.log('  - failed:', failedSnap.data().count);
  
  // Check recent imports (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentSnap = await db.collection('zillow_imports')
    .where('foundAt', '>=', weekAgo)
    .count().get();
  console.log('\nRecent imports (last 7 days):', recentSnap.data().count);
}

checkCounts();
