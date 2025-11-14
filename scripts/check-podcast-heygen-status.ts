/**
 * Check HeyGen status for stuck podcast workflows
 */

import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

if (!HEYGEN_API_KEY) {
  console.error('❌ HEYGEN_API_KEY not found');
  process.exit(1);
}

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
};

initializeApp({
  credential: cert(serviceAccount as any)
});

const db = getFirestore();

async function checkPodcastWorkflows() {
  console.log('🔍 Checking podcast workflows stuck in heygen_processing...\n');

  const snapshot = await db.collection('podcast_workflow_queue')
    .where('status', '==', 'heygen_processing')
    .limit(10)
    .get();

  console.log(`Found ${snapshot.size} workflows\n`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const workflowId = doc.id;
    const videoId = data.heygenVideoId;

    console.log(`📄 Workflow: ${workflowId}`);
    console.log(`   Video ID: ${videoId}`);
    console.log(`   Episode: ${data.episodeTitle || 'Unknown'}`);
    console.log(`   Created: ${new Date(data.createdAt).toISOString()}`);

    if (!videoId) {
      console.log(`   ⚠️  No video ID found`);
      continue;
    }

    try {
      const response = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
        { headers: { 'x-api-key': HEYGEN_API_KEY } }
      );

      if (!response.ok) {
        console.log(`   ❌ API error: ${response.status}`);
        continue;
      }

      const heygenData = await response.json();
      const status = heygenData.data?.status;
      const videoUrl = heygenData.data?.video_url;
      const error = heygenData.data?.error;

      console.log(`   HeyGen Status: ${status}`);
      if (videoUrl) console.log(`   Video URL: ${videoUrl}`);
      if (error) console.log(`   Error: ${error}`);
    } catch (err) {
      console.log(`   ❌ Error checking status:`, err);
    }

    console.log('');
  }
}

checkPodcastWorkflows().catch(console.error);
