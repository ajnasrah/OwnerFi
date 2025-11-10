import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

// Initialize Firebase Admin
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

async function checkAbdullahStuck() {
  console.log('🔍 Checking Abdullah daily content stuck in HeyGen...\n');

  try {
    // Check abdullah_queue collection
    const abdullahSnapshot = await db.collection('abdullah_queue')
      .where('status', '==', 'heygen_processing')
      .get();

    console.log(`📹 Abdullah Queue - HeyGen Processing: ${abdullahSnapshot.size} workflows\n`);

    if (abdullahSnapshot.size > 0) {
      abdullahSnapshot.forEach((doc, index) => {
        const data = doc.data();
        const createdDate = data.createdAt ? new Date(data.createdAt).toLocaleString() : 'Unknown';
        const hoursSinceCreated = data.createdAt ? ((Date.now() - data.createdAt) / (1000 * 60 * 60)).toFixed(1) : 'Unknown';

        console.log(`${index + 1}. ${doc.id}`);
        console.log(`   Created: ${createdDate} (${hoursSinceCreated} hours ago)`);
        console.log(`   HeyGen Video ID: ${data.heygenVideoId || 'None'}`);
        console.log(`   Title: ${data.title || 'No title'}`);
        console.log(`   Variant: ${data.variant || 'Unknown'}`);
        console.log('');
      });
    }

    // Also check other potential collections
    const collections = [
      'viral_workflows',
      'carz_workflows',
      'ownerfi_workflows',
      'vassdistro_workflows'
    ];

    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName)
          .where('status', '==', 'heygen_processing')
          .get();

        if (snapshot.size > 0) {
          console.log(`📹 ${collectionName} - HeyGen Processing: ${snapshot.size} workflows`);
          snapshot.forEach((doc, index) => {
            const data = doc.data();
            const createdDate = data.createdAt ? new Date(data.createdAt).toLocaleString() : 'Unknown';
            const hoursSinceCreated = data.createdAt ? ((Date.now() - data.createdAt) / (1000 * 60 * 60)).toFixed(1) : 'Unknown';

            console.log(`   ${index + 1}. ${doc.id} - ${hoursSinceCreated}h ago`);
            console.log(`      HeyGen Video ID: ${data.heygenVideoId || 'None'}`);
          });
          console.log('');
        }
      } catch (error) {
        // Collection might not exist, skip
      }
    }

    // Summary
    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total stuck in HeyGen processing: ${abdullahSnapshot.size}`);

    if (abdullahSnapshot.size > 0) {
      console.log('\n💡 SOLUTIONS:');
      console.log('1. Run unstick script: npx tsx scripts/unstick-workflows.ts');
      console.log('2. Check HeyGen API status manually');
      console.log('3. Check if webhooks are being received');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAbdullahStuck()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
