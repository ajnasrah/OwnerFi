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
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

async function checkHeyGenStatus(videoId: string) {
  const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
    method: 'GET',
    headers: {
      'X-Api-Key': HEYGEN_API_KEY!,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HeyGen API error: ${response.status}`);
  }

  return await response.json();
}

async function unstickPropertyVideo() {
  console.log('🔧 Unsticking property video workflow...\n');

  const workflowId = 'property_15sec_1761849626785_nka7i';
  const heygenVideoId = '4bc6df9b488b4a61a6c8d7fb43cd81fc';

  try {
    // Get current status from HeyGen
    console.log(`📞 Checking HeyGen status for video: ${heygenVideoId}`);
    const heygenStatus = await checkHeyGenStatus(heygenVideoId);

    console.log('\n📊 HeyGen Status:');
    console.log(JSON.stringify(heygenStatus, null, 2));
    console.log('');

    if (heygenStatus.data) {
      const status = heygenStatus.data.status;
      const videoUrl = heygenStatus.data.video_url;

      console.log(`Status: ${status}`);

      if (status === 'completed' && videoUrl) {
        console.log(`✅ Video is completed! URL: ${videoUrl}`);
        console.log('\n🔄 Updating workflow status to completed...');

        // Update Firestore
        await db.collection('property_videos').doc(workflowId).update({
          status: 'completed',
          heygenVideoUrl: videoUrl,
          updatedAt: Date.now()
        });

        console.log('✅ Workflow updated to completed status!');
        console.log('\n💡 Now the video can proceed to Submagic for captions');

      } else if (status === 'processing') {
        console.log('⏳ Video is still processing in HeyGen - wait a bit longer');
      } else if (status === 'failed') {
        console.log('❌ Video failed in HeyGen');
        console.log(`Error: ${heygenStatus.data.error || 'Unknown error'}`);

        // Update to failed
        await db.collection('property_videos').doc(workflowId).update({
          status: 'failed',
          error: heygenStatus.data.error || 'HeyGen video generation failed',
          updatedAt: Date.now()
        });

        console.log('✅ Workflow marked as failed');
      } else {
        console.log(`⚠️  Unknown status: ${status}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

unstickPropertyVideo()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
