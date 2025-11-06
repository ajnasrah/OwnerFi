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

async function cleanupStuck() {
  console.log('🧹 Cleaning up stuck workflows...\n');

  // Mark old benefit workflows as failed (Submagic videos expired after 7 days)
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  const benefitSnap = await db.collection('benefit_workflow_queue')
    .where('status', '==', 'submagic_processing')
    .get();

  const oldBenefit = benefitSnap.docs.filter(doc => {
    const data = doc.data();
    const created = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
    return created && created.getTime() < sevenDaysAgo;
  });

  console.log(`Found ${oldBenefit.length} Benefit workflows stuck >7 days`);

  for (const doc of oldBenefit) {
    await doc.ref.update({
      status: 'failed',
      error: 'Submagic video expired (>7 days old)',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  if (oldBenefit.length > 0) {
    console.log(`✅ Marked ${oldBenefit.length} old Benefit workflows as failed\n`);
  }

  // Fix podcast workflows - reset to pending to regenerate videos
  const podcastSnap = await db.collection('podcast_workflow_queue')
    .where('status', '==', 'failed')
    .get();

  const recentPodcast = podcastSnap.docs.filter(doc => {
    const data = doc.data();
    const created = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    return created && created.getTime() > oneDayAgo;
  });

  console.log(`Found ${recentPodcast.length} recent Podcast failures`);

  for (const doc of recentPodcast) {
    const data = doc.data();
    console.log(`  Resetting: ${doc.id}`);

    await doc.ref.update({
      status: 'pending',
      heygenVideoId: admin.firestore.FieldValue.delete(),
      submagicVideoId: admin.firestore.FieldValue.delete(),
      error: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      retryCount: (data.retryCount || 0) + 1,
      lockedBy: admin.firestore.FieldValue.delete(),
      lockedAt: admin.firestore.FieldValue.delete()
    });
  }

  if (recentPodcast.length > 0) {
    console.log(`✅ Reset ${recentPodcast.length} Podcast workflows to pending\n`);
  }

  console.log('✅ Cleanup complete!');
}

cleanupStuck().catch(console.error);
