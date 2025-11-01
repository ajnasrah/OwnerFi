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

const brands = [
  { name: 'carz', collection: 'carz_workflow_queue' },
  { name: 'ownerfi', collection: 'ownerfi_workflow_queue' },
  { name: 'podcast', collection: 'podcast_workflow_queue' },
  { name: 'benefit', collection: 'benefit_workflow_queue' },
  { name: 'property', collection: 'property_videos' },
  { name: 'vassdistro', collection: 'vassdistro_workflow_queue' },
  { name: 'abdullah', collection: 'abdullah_workflow_queue' }
];

async function checkLastCreated() {
  console.log('🔍 Checking LAST WORKFLOW CREATION for all brands\n');

  const now = Date.now();
  const twelveHoursAgo = now - (12 * 60 * 60 * 1000);

  for (const brand of brands) {
    try {
      const snapshot = await db.collection(brand.collection)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        console.log(`\n❌ ${brand.name.toUpperCase()}: EMPTY COLLECTION`);
        continue;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      const createdAt = data.createdAt;
      const hoursAgo = ((now - createdAt) / (1000 * 60 * 60)).toFixed(1);

      const emoji = createdAt > twelveHoursAgo ? '✅' : '🚨';

      console.log(`\n${emoji} ${brand.name.toUpperCase()}`);
      console.log(`   Last Created: ${new Date(createdAt).toISOString()}`);
      console.log(`   Hours Ago: ${hoursAgo}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   ID: ${doc.id}`);

    } catch (error: any) {
      console.log(`\n⚠️  ${brand.name.toUpperCase()}: Error - ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`⏰ 12 hours ago was: ${new Date(twelveHoursAgo).toISOString()}`);
  console.log('='.repeat(60));
}

checkLastCreated()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
