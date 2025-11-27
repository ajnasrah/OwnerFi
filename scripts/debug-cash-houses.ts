import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function main() {
  // Get first 5 records to check their fields
  const snapshot = await db.collection('cash_houses').limit(5).get();

  console.log('Found ' + snapshot.size + ' documents\n');

  let idx = 0;
  snapshot.docs.forEach((doc) => {
    idx++;
    const data = doc.data();
    console.log('\n=== Document ' + idx + ' (' + doc.id + ') ===');
    console.log('Fields present:');
    console.log('  - importedAt:', data.importedAt ? 'YES' : 'NO', data.importedAt);
    console.log('  - scrapedAt:', data.scrapedAt ? 'YES' : 'NO', data.scrapedAt);
    console.log('  - foundAt:', data.foundAt ? 'YES' : 'NO', data.foundAt);
    console.log('  - source:', data.source);
    console.log('  - fullAddress:', data.fullAddress);
  });

  // Also try ordering
  try {
    const ordered = await db.collection('cash_houses').orderBy('importedAt', 'desc').limit(5).get();
    console.log('\nOrderBy importedAt DESC returned: ' + ordered.size + ' docs');
    if (ordered.size > 0) {
      console.log('First doc:', ordered.docs[0].data().fullAddress);
    }
  } catch (e: any) {
    console.log('\nOrderBy importedAt failed:', e.message);
  }
}

main().catch(console.error);
