/**
 * Post completed property videos to Late.dev
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const workflows = [
  {
    id: 'property_15sec_1761445132537_l7582',
    downloadUrl: 'https://dqu1p08d61fh.cloudfront.net/api/f15734f9-5a75-4659-bc6a-cc97b3197e76/af998ae2-b2ad-493e-9743-118ff319e9a1/video.mp4-download.mp4'
  },
  {
    id: 'property_15sec_1761443694311_23s4a',
    downloadUrl: 'https://dqu1p08d61fh.cloudfront.net/api/f15734f9-5a75-4659-bc6a-cc97b3197e76/abbf4210-1cde-4256-9491-2cc555cdfc5c/video.mp4-download.mp4'
  }
];

async function postToLate() {
  console.log('📱 Posting Property Videos to Late.dev\n');
  console.log('='.repeat(70));

  const { uploadSubmagicVideo } = await import('../src/lib/video-storage.js');
  const { postToLate: latePost } = await import('../src/lib/late-api.js');

  for (const workflow of workflows) {
    console.log(`\n📹 Workflow: ${workflow.id}`);

    try {
      // Get workflow
      const workflowRef = doc(db, 'property_videos', workflow.id);
      const workflowSnap = await getDoc(workflowRef);

      if (!workflowSnap.exists()) {
        console.log(`   ❌ Not found`);
        continue;
      }

      const data = workflowSnap.data();
      console.log(`   Property: ${data.address}`);

      // Upload to R2
      console.log(`   ☁️  Uploading to R2...`);
      const publicVideoUrl = await uploadSubmagicVideo(workflow.downloadUrl);
      console.log(`   ✅ R2: ${publicVideoUrl.substring(0, 60)}...`);

      // Post to Late
      console.log(`   📱 Posting to Late.dev...`);

      const postResult = await latePost({
        videoUrl: publicVideoUrl,
        caption: data.caption || `🏡 Property in ${data.city}!`,
        title: data.title || `Property Video`,
        platforms: ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'threads', 'twitter', 'bluesky'],
        useQueue: true,
        brand: 'property'
      });

      if (postResult.success) {
        console.log(`   ✅ Posted! Late ID: ${postResult.postId}`);

        await updateDoc(workflowRef, {
          submagicVideoUrl: workflow.downloadUrl,
          finalVideoUrl: publicVideoUrl,
          latePostId: postResult.postId,
          status: 'completed',
          completedAt: Date.now(),
          updatedAt: Date.now()
        });

        console.log(`   ✅ Workflow COMPLETED!`);
      } else {
        console.log(`   ❌ Failed: ${postResult.error}`);
      }

    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Done!\n');
}

postToLate().catch(console.error);
