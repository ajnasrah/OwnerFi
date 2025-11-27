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

async function findMissing() {
  // Get all zillow_imports
  const importsSnap = await db.collection('zillow_imports').get();
  console.log('Total zillow_imports:', importsSnap.size);
  
  // Count unique zpids
  const zpids = new Set<number>();
  const duplicateZpids: number[] = [];
  
  importsSnap.docs.forEach(doc => {
    const zpid = doc.data().zpid;
    if (zpid) {
      if (zpids.has(zpid)) {
        duplicateZpids.push(zpid);
      }
      zpids.add(zpid);
    }
  });
  
  console.log('Unique zpids:', zpids.size);
  console.log('Duplicate zpids in DB:', duplicateZpids.length);
  
  // Check validation/filter failures by looking at properties without ownerFinanceVerified
  const verifiedSnap = await db.collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .count().get();
  console.log('\nWith ownerFinanceVerified=true:', verifiedSnap.data().count);
  
  const notVerifiedSnap = await db.collection('zillow_imports')
    .where('ownerFinanceVerified', '==', false)
    .count().get();
  console.log('With ownerFinanceVerified=false:', notVerifiedSnap.data().count);
  
  // Check for properties with status
  const statusCounts: Record<string, number> = {};
  importsSnap.docs.forEach(doc => {
    const status = doc.data().status || 'null';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  console.log('\nBy status:', statusCounts);
  
  // Check scraper_queue for failed items
  const failedQueueSnap = await db.collection('scraper_queue')
    .where('status', '==', 'failed')
    .get();
  console.log('\nFailed queue items:', failedQueueSnap.size);
  
  // Sample a failed item to see why
  if (failedQueueSnap.size > 0) {
    const sample = failedQueueSnap.docs[0].data();
    console.log('Sample failed reason:', sample.failureReason);
  }
}

findMissing();
