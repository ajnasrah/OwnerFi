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

async function fixAllRemaining() {
  console.log('🔧 Fixing all remaining failures...\n');

  const cutoff24h = Date.now() - (24 * 60 * 60 * 1000);

  // Fix OwnerFi HeyGen failure
  console.log('1️⃣ Fixing OwnerFi HeyGen failure...');
  const ownerfiSnap = await db.collection('ownerfi_workflow_queue')
    .doc('wf_1762441245222_9c4pweufk')
    .get();

  if (ownerfiSnap.exists && ownerfiSnap.data()?.status === 'failed') {
    await ownerfiSnap.ref.update({
      status: 'pending',
      heygenVideoId: admin.firestore.FieldValue.delete(),
      error: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      retryCount: (ownerfiSnap.data()?.retryCount || 0) + 1,
      lockedBy: admin.firestore.FieldValue.delete(),
      lockedAt: admin.firestore.FieldValue.delete()
    });
    console.log('   ✅ Reset to pending\n');
  } else {
    console.log('   ⚠️ Already fixed or not found\n');
  }

  // Fix Podcast Submagic failures
  console.log('2️⃣ Fixing Podcast Submagic failures...');
  const podcastSnap = await db.collection('podcast_workflow_queue')
    .where('status', '==', 'failed')
    .get();

  const podcastFailed = podcastSnap.docs.filter(doc => {
    const data = doc.data();
    const created = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
    return created && created.getTime() > cutoff24h;
  });

  console.log(`   Found ${podcastFailed.length} recent failures`);

  for (const doc of podcastFailed) {
    const data = doc.data();
    console.log(`   Fixing: ${doc.id}`);

    // Check if HeyGen video is ready
    if (data.heygenVideoId && !data.submagicVideoId) {
      console.log(`   Has HeyGen ID, resetting to submagic_processing...`);

      await doc.ref.update({
        status: 'heygen_completed',
        error: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        retryCount: (data.retryCount || 0) + 1
      });

      console.log(`   ✅ Reset to heygen_completed (will retry Submagic)`);
    } else {
      console.log(`   ❌ Missing HeyGen ID, cannot retry`);
    }
  }

  // Check stuck Benefit workflows
  console.log('\n3️⃣ Checking stuck Benefit workflows...');
  const benefitSnap = await db.collection('benefit_workflow_queue')
    .where('status', '==', 'submagic_processing')
    .get();

  const benefitStuck = benefitSnap.docs.filter(doc => {
    const data = doc.data();
    const created = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
    return created && created.getTime() < cutoff24h;
  });

  console.log(`   Found ${benefitStuck.length} workflows stuck >24h`);

  for (const doc of benefitStuck) {
    const data = doc.data();
    const created = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
    const hoursAgo = Math.round((Date.now() - created.getTime()) / (1000 * 60 * 60));

    console.log(`\n   ${doc.id} (${hoursAgo}h)`);
    console.log(`   Submagic ID: ${data.submagicVideoId}`);

    if (data.submagicVideoId) {
      try {
        const response = await fetch(`https://api.submagic.co/api/v1/caption/${data.submagicVideoId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.SUBMAGIC_API_KEY}`,
          }
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`   Submagic status: ${result.status}`);

          if (result.status === 'completed' || result.status === 'success') {
            const videoUrl = result.data?.video_url || result.video_url;
            console.log(`   ✅ Video ready! Updating to completed...`);

            await doc.ref.update({
              status: 'submagic_completed',
              finalVideoUrl: videoUrl,
              submagicStatus: result.status,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`   ✅ Updated to submagic_completed`);
          } else if (result.status === 'failed' || result.status === 'error') {
            console.log(`   ❌ Submagic failed, marking as failed`);

            await doc.ref.update({
              status: 'failed',
              error: `Submagic processing failed: ${result.status}`,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          } else {
            console.log(`   ⏳ Still processing: ${result.status}`);
          }
        } else {
          console.log(`   ⚠️ Submagic API error: ${response.status}`);
        }
      } catch (error) {
        console.log(`   ⚠️ Error checking Submagic: ${error}`);
      }
    }
  }

  console.log('\n✅ Done fixing all remaining issues!');
}

fixAllRemaining().catch(console.error);
