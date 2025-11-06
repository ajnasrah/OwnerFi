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

const FAILED_TITLES = [
  'Mindset to Millions',
  'Work Smarter, Not Harder',
  'Dreams to Reality',
  'Escape 9-5'
];

async function fixAbdullahFailedWorkflows() {
  console.log('🔧 Fixing failed Abdullah workflows...\n');

  for (const title of FAILED_TITLES) {
    console.log(`\n🔍 Searching for: ${title}`);

    const snapshot = await db.collection('abdullah_content_queue')
      .where('title', '==', title)
      .where('status', '==', 'failed')
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log(`   ⚠️ Not found or already fixed`);
      continue;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    console.log(`   Found: ${doc.id}`);
    console.log(`   HeyGen: ${data.heygenVideoId}`);
    console.log(`   Submagic: ${data.submagicVideoId}`);
    console.log(`   Error: ${data.error}`);

    // Check if video is actually ready
    if (data.submagicVideoId) {
      console.log(`   🔄 Checking if video is ready for posting...`);

      try {
        // Check Submagic status
        const submagicResponse = await fetch(`https://api.submagic.co/api/v1/caption/${data.submagicVideoId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.SUBMAGIC_API_KEY}`,
          }
        });

        if (submagicResponse.ok) {
          const submagicResult = await submagicResponse.json();
          console.log(`   Submagic status: ${submagicResult.status}`);

          if (submagicResult.status === 'completed' || submagicResult.status === 'success') {
            const videoUrl = submagicResult.data?.video_url || submagicResult.video_url;

            if (videoUrl) {
              console.log(`   ✅ Video is ready! Attempting to post to Late...`);

              // Update to posting status and trigger posting
              await doc.ref.update({
                status: 'posting',
                finalVideoUrl: videoUrl,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                error: admin.firestore.FieldValue.delete()
              });

              console.log(`   ✅ Updated to posting status - Late API will pick it up`);

              // Trigger the posting endpoint
              const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.ownerfi.com'}/api/workflow/post-to-late`;

              try {
                const response = await fetch(webhookUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-cron-secret': process.env.CRON_SECRET || ''
                  },
                  body: JSON.stringify({
                    workflowId: doc.id,
                    brand: 'abdullah',
                    videoUrl: videoUrl
                  })
                });

                if (response.ok) {
                  console.log(`   ✅ Triggered posting webhook successfully`);
                } else {
                  const text = await response.text();
                  console.log(`   ⚠️ Posting webhook failed: ${response.status} - ${text}`);
                }
              } catch (error) {
                console.log(`   ⚠️ Error triggering posting: ${error}`);
              }
            }
          }
        }
      } catch (error) {
        console.log(`   ⚠️ Error checking video: ${error}`);
      }
    } else {
      console.log(`   ❌ Missing Submagic ID - cannot recover`);
    }
  }

  console.log('\n✅ Done fixing Abdullah workflows!');
}

fixAbdullahFailedWorkflows().catch(console.error);
