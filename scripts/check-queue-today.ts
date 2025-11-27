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

async function check() {
  // Check scraper_queue by source
  const queueSnap = await db.collection('scraper_queue').get();

  const bySource: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  queueSnap.docs.forEach(doc => {
    const data = doc.data();
    bySource[data.source || 'unknown'] = (bySource[data.source || 'unknown'] || 0) + 1;
    byStatus[data.status || 'unknown'] = (byStatus[data.status || 'unknown'] || 0) + 1;
  });

  console.log('scraper_queue total:', queueSnap.size);
  console.log('By source:', bySource);
  console.log('By status:', byStatus);

  // Check how many added today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let addedToday = 0;
  queueSnap.docs.forEach(doc => {
    const addedAt = doc.data().addedAt?.toDate?.();
    if (addedAt && addedAt >= today) addedToday++;
  });
  console.log('Added today:', addedToday);
}

check();
