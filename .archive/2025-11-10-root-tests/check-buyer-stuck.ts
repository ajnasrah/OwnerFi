import admin from 'firebase-admin';
import { config } from 'dotenv';

config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function checkBuyerWorkflows() {
  console.log('🔍 Checking buyer workflows stuck at submagic_processing...\n');

  const snapshot = await db.collection('buyer')
    .where('status', '==', 'submagic_processing')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  console.log(`Found ${snapshot.size} workflows in submagic_processing\n`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const created = data.createdAt?.toDate();
    const hoursAgo = created ? Math.round((Date.now() - created.getTime()) / (1000 * 60 * 60)) : 0;

    console.log(`📄 ${doc.id}`);
    console.log(`   Title: ${data.title}`);
    console.log(`   HeyGen ID: ${data.heygenVideoId}`);
    console.log(`   Submagic ID: ${data.submagicVideoId || 'MISSING'}`);
    console.log(`   Created: ${hoursAgo}h ago`);
    console.log(`   Status: ${data.status}`);
    console.log('');
  }
}

checkBuyerWorkflows().catch(console.error);
