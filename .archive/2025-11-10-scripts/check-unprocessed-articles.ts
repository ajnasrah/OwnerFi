import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function checkUnprocessed() {
  const brands = ['carz', 'ownerfi', 'vassdistro'];

  console.log('📰 Checking unprocessed articles for all brands\n');

  for (const brand of brands) {
    const collection = `${brand}_articles`;

    try {
      const snapshot = await db.collection(collection)
        .where('processed', '==', false)
        .orderBy('rating', 'desc')
        .limit(10)
        .get();

      console.log(`\n${brand.toUpperCase()}: ${snapshot.size} unprocessed articles`);

      if (snapshot.size > 0) {
        console.log('Top 3:');
        snapshot.docs.slice(0, 3).forEach((doc, i) => {
          const data = doc.data();
          console.log(`   ${i + 1}. [Rating: ${data.rating || 'N/A'}] ${data.title?.substring(0, 60)}...`);
        });
      }
    } catch (error: any) {
      console.log(`\n${brand.toUpperCase()}: Error - ${error.message}`);
    }
  }
}

checkUnprocessed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
