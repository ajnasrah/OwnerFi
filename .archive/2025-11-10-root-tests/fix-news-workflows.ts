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

async function fixNewsWorkflows() {
  console.log('🔧 Finding and fixing failed news workflows...\n');

  // Check all brand workflow queues
  const brands = ['ownerfi', 'carz', 'vassdistro'];

  for (const brand of brands) {
    console.log(`\n📰 Checking ${brand}_workflow_queue...`);

    const snapshot = await db.collection(`${brand}_workflow_queue`)
      .where('status', '==', 'failed')
      .limit(10)
      .get();

    console.log(`   Found ${snapshot.size} failed workflows\n`);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const created = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
      const hoursAgo = created ? Math.round((Date.now() - created.getTime()) / (1000 * 60 * 60)) : 0;

      console.log(`   📄 ${data.title || doc.id}`);
      console.log(`      Age: ${hoursAgo}h ago`);
      console.log(`      Error: ${data.error || 'No error message'}`);
      console.log(`      HeyGen ID: ${data.heygenVideoId || 'MISSING'}`);
      console.log(`      Submagic ID: ${data.submagicVideoId || 'MISSING'}`);

      // Only fix recent failures (last 72 hours)
      if (hoursAgo > 72) {
        console.log(`      ⏭️  Too old, skipping\n`);
        continue;
      }

      const errorMsg = data.error?.toLowerCase() || '';

      // Fix HeyGen failures - retry video generation
      if (errorMsg.includes('heygen') && errorMsg.includes('no video id')) {
        console.log(`      🔄 Retrying HeyGen video generation...`);

        try {
          // Reset to pending to trigger regeneration
          await doc.ref.update({
            status: 'pending',
            heygenVideoId: admin.firestore.FieldValue.delete(),
            error: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            retryCount: (data.retryCount || 0) + 1
          });

          console.log(`      ✅ Reset to pending - will retry video generation\n`);
        } catch (error) {
          console.log(`      ❌ Failed to reset: ${error}\n`);
        }
      }
      // Fix Metricool timeout - retry posting
      else if (errorMsg.includes('metricool') && errorMsg.includes('timed out')) {
        console.log(`      🔄 Retrying Metricool posting...`);

        if (data.finalVideoUrl || data.submagicVideoId) {
          try {
            await doc.ref.update({
              status: 'posting',
              error: admin.firestore.FieldValue.delete(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              retryCount: (data.retryCount || 0) + 1
            });

            console.log(`      ✅ Reset to posting - will retry Metricool\n`);
          } catch (error) {
            console.log(`      ❌ Failed to reset: ${error}\n`);
          }
        } else {
          console.log(`      ❌ Missing video URL, cannot retry posting\n`);
        }
      }
      // Fix Late circuit breaker - retry posting
      else if (errorMsg.includes('circuit breaker') || errorMsg.includes('late api')) {
        console.log(`      🔄 Retrying Late posting (circuit breaker reset)...`);

        if (data.finalVideoUrl || data.submagicVideoId) {
          try {
            await doc.ref.update({
              status: 'posting',
              error: admin.firestore.FieldValue.delete(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              retryCount: (data.retryCount || 0) + 1
            });

            console.log(`      ✅ Reset to posting - will retry Late API\n`);
          } catch (error) {
            console.log(`      ❌ Failed to reset: ${error}\n`);
          }
        } else {
          console.log(`      ❌ Missing video URL, cannot retry posting\n`);
        }
      } else {
        console.log(`      ⚠️  Unknown error type, skipping\n`);
      }
    }
  }

  console.log('\n✅ Done fixing news workflows!');
}

fixNewsWorkflows().catch(console.error);
