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

const WORKFLOWS_TO_FIX = [
  { collection: 'ownerfi_workflow_queue', id: 'wf_1762419654957_749ft9vp4', error: 'heygen' },
  { collection: 'ownerfi_workflow_queue', title: '🏡 Your Starter Home is a Myth!', error: 'metricool' },
  { collection: 'ownerfi_workflow_queue', title: '🚨 Federal Shutdown & Housing Crisis', error: 'late' },
  { collection: 'carz_workflow_queue', title: '🚗 Honda Prologue Discounts Uncovered', error: 'late' },
];

async function fixRecentWorkflows() {
  console.log('🔧 Fixing recent failed workflows...\n');

  for (const workflow of WORKFLOWS_TO_FIX) {
    let doc;

    if (workflow.id) {
      console.log(`\n🔍 Finding by ID: ${workflow.id}`);
      const docRef = db.collection(workflow.collection).doc(workflow.id);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        doc = docSnap;
      }
    } else if (workflow.title) {
      console.log(`\n🔍 Finding by title: ${workflow.title}`);
      const snapshot = await db.collection(workflow.collection)
        .where('title', '==', workflow.title)
        .where('status', '==', 'failed')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        doc = snapshot.docs[0];
      }
    }

    if (!doc) {
      console.log(`   ⚠️ Workflow not found or already fixed`);
      continue;
    }

    const data = doc.data();
    console.log(`   Found: ${data.title || doc.id}`);
    console.log(`   Error type: ${workflow.error}`);
    console.log(`   Current status: ${data.status}`);

    try {
      if (workflow.error === 'heygen') {
        console.log(`   🔄 Resetting to pending for HeyGen retry...`);

        await doc.ref.update({
          status: 'pending',
          heygenVideoId: admin.firestore.FieldValue.delete(),
          error: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          retryCount: (data.retryCount || 0) + 1,
          lockedBy: admin.firestore.FieldValue.delete(),
          lockedAt: admin.firestore.FieldValue.delete()
        });

        console.log(`   ✅ Reset to pending - will regenerate video`);

      } else if (workflow.error === 'metricool' || workflow.error === 'late') {
        console.log(`   🔄 Resetting to posting for retry...`);

        // Make sure we have a video URL
        if (!data.finalVideoUrl && !data.submagicVideoId) {
          console.log(`   ❌ No video URL available - checking Submagic...`);

          if (data.submagicVideoId) {
            try {
              const response = await fetch(`https://api.submagic.co/api/v1/caption/${data.submagicVideoId}`, {
                headers: {
                  'Authorization': `Bearer ${process.env.SUBMAGIC_API_KEY}`,
                }
              });

              if (response.ok) {
                const result = await response.json();
                if (result.status === 'completed' || result.status === 'success') {
                  const videoUrl = result.data?.video_url || result.video_url;
                  console.log(`   ✅ Found video URL from Submagic`);

                  await doc.ref.update({
                    status: 'posting',
                    finalVideoUrl: videoUrl,
                    error: admin.firestore.FieldValue.delete(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    retryCount: (data.retryCount || 0) + 1
                  });

                  console.log(`   ✅ Reset to posting with video URL`);
                  continue;
                }
              }
            } catch (error) {
              console.log(`   ⚠️ Could not fetch from Submagic: ${error}`);
            }
          }

          console.log(`   ❌ Cannot retry - no video available`);
          continue;
        }

        await doc.ref.update({
          status: 'posting',
          error: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          retryCount: (data.retryCount || 0) + 1
        });

        console.log(`   ✅ Reset to posting - will retry ${workflow.error}`);
      }

    } catch (error) {
      console.log(`   ❌ Failed to update: ${error}`);
    }
  }

  console.log('\n✅ Done! All recent workflows have been reset for retry.');
}

fixRecentWorkflows().catch(console.error);
