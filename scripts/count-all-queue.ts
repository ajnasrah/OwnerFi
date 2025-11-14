import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
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

async function countAll() {
  console.log('\n🔍 Counting ALL items in cash_deals_queue...\n');

  // Get count using aggregation query
  const collectionRef = db.collection('cash_deals_queue');
  const snapshot = await collectionRef.count().get();

  console.log(`📊 Total items in cash_deals_queue: ${snapshot.data().count}\n`);

  // Also check by fetching all
  let allDocs: any[] = [];
  let lastDoc: any = null;
  let hasMore = true;

  while (hasMore) {
    let query = collectionRef.limit(1000);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const batch = await query.get();

    if (batch.empty) {
      hasMore = false;
    } else {
      allDocs.push(...batch.docs);
      lastDoc = batch.docs[batch.docs.length - 1];

      if (batch.docs.length < 1000) {
        hasMore = false;
      }
    }
  }

  console.log(`📋 Verified by fetching: ${allDocs.length} documents\n`);

  const statusCounts: any = {
    pending: 0,
    processing: 0,
    completed: 0,
  };

  allDocs.forEach(doc => {
    const data = doc.data();
    if (statusCounts[data.status] !== undefined) {
      statusCounts[data.status]++;
    }
  });

  console.log('Status breakdown:');
  console.log(`  Pending: ${statusCounts.pending}`);
  console.log(`  Processing: ${statusCounts.processing}`);
  console.log(`  Completed: ${statusCounts.completed}\n`);
}

countAll().catch(console.error);
