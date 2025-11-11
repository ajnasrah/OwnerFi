/**
 * Manually complete property video workflow
 * Simulates the full pipeline: HeyGen → Submagic → Late.dev
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

const WORKFLOW_ID = 'property_15sec_1761445132537_l7582';
const HEYGEN_VIDEO_URL = 'https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/0bd8a97fb42840aeb00914e09ccf05e3.mp4';

async function completeWorkflow() {
  console.log('🎬 Completing Property Video Workflow Manually\n');
  console.log(`Workflow ID: ${WORKFLOW_ID}\n`);
  console.log('='.repeat(70));

  // Step 1: Get workflow
  const workflowRef = doc(db, 'property_videos', WORKFLOW_ID);
  const workflowSnap = await getDoc(workflowRef);

  if (!workflowSnap.exists()) {
    console.log('❌ Workflow not found in property_videos collection');
    return;
  }

  const workflow = workflowSnap.data();
  console.log('\n📋 Current Status:', workflow.status);

  // Step 2: Upload HeyGen video to R2
  console.log('\n☁️  Step 1: Uploading HeyGen video to R2...');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

  const {downloadAndUploadToR2} = await import('../src/lib/video-storage.js');
  const r2Url = await downloadAndUploadToR2(
    HEYGEN_VIDEO_URL,
    HEYGEN_API_KEY!,
    `property-videos/${WORKFLOW_ID}.mp4`
  );

  console.log(`✅ R2 URL: ${r2Url}`);

  // Update workflow with HeyGen URLs
  await updateDoc(workflowRef, {
    heygenVideoUrl: HEYGEN_VIDEO_URL,
    heygenVideoR2Url: r2Url,
    status: 'heygen_completed',
    updatedAt: Date.now()
  });

  console.log('✅ Updated workflow with HeyGen video URLs');

  // Step 3: Send to Submagic
  console.log('\n✨ Step 2: Sending to Submagic...');

  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
  const submagicWebhookUrl = `${baseUrl}/api/webhooks/submagic/property`;

  const submagicResponse = await fetch('https://api.submagic.co/v1/projects', {
    method: 'POST',
    headers: {
      'x-api-key': SUBMAGIC_API_KEY!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: `${workflow.address} - Property Video`,
      language: 'en',
      videoUrl: r2Url,
      templateName: 'Hormozi 2',
      magicBrolls: true,
      magicBrollsPercentage: 50,
      magicZooms: true,
      webhookUrl: submagicWebhookUrl
    })
  });

  const submagicData = await submagicResponse.json();
  const projectId = submagicData?.id || submagicData?.project_id;

  if (projectId) {
    console.log(`✅ Submagic project created: ${projectId}`);

    await updateDoc(workflowRef, {
      submagicProjectId: projectId,
      submagicVideoId: projectId,
      status: 'submagic_processing',
      updatedAt: Date.now()
    });

    console.log('✅ Updated workflow - now in submagic_processing');
    console.log('\n⏳ Waiting for Submagic webhook to complete...');
    console.log('   This will take 2-5 minutes');
    console.log('   Once complete, Late.dev will automatically post to social media');

  } else {
    console.log('❌ Failed to create Submagic project');
    console.log(JSON.stringify(submagicData, null, 2));
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Workflow manually advanced to Submagic processing!');
  console.log('Monitor progress at: https://ownerfi.ai/dashboard/property-videos');
}

completeWorkflow().catch(console.error);
