/**
 * Inspect a specific stuck workflow in detail
 * Run with: npx tsx scripts/inspect-stuck-workflow.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function inspectWorkflow() {
  const workflowId = 'property_15sec_1761450265783_gkbsi'; // Oldest stuck workflow

  console.log(`🔍 Inspecting workflow: ${workflowId}\n`);

  const doc = await db.collection('property_videos').doc(workflowId).get();

  if (!doc.exists) {
    console.log('❌ Workflow not found!');
    return;
  }

  const data = doc.data()!;

  console.log('📄 Full workflow data:');
  console.log(JSON.stringify(data, null, 2));

  console.log('\n📊 Analysis:');
  console.log(`   Status: ${data.status}`);
  console.log(`   Has heygenVideoId: ${!!data.heygenVideoId}`);
  console.log(`   Has heygenVideoUrl: ${!!data.heygenVideoUrl}`);
  console.log(`   Has submagicProjectId: ${!!data.submagicProjectId}`);
  console.log(`   Has submagicVideoId: ${!!data.submagicVideoId}`);
  console.log(`   Has submagicDownloadUrl: ${!!data.submagicDownloadUrl}`);
  console.log(`   Has finalVideoUrl: ${!!data.finalVideoUrl}`);
  console.log(`   Has latePostId: ${!!data.latePostId}`);
  console.log(`   Retry count: ${data.retryCount || 0}`);
  console.log(`   Last retry: ${data.lastRetryAt ? new Date(data.lastRetryAt).toISOString() : 'Never'}`);

  if (data.error) {
    console.log(`   Error: ${data.error}`);
  }

  console.log('\n🔍 DIAGNOSIS:');

  if (data.status === 'posting' && !data.finalVideoUrl) {
    console.log('   ❌ CRITICAL: Workflow is in "posting" status but has NO finalVideoUrl!');
    console.log('   This means:');
    console.log('      1. Submagic completed (has submagicProjectId)');
    console.log('      2. Webhook fired and changed status to "posting"');
    console.log('      3. But /api/process-video NEVER ran or FAILED');
    console.log('      4. R2 video upload never happened');
    console.log('      5. Late API was never called');
    console.log('');
    console.log('   💡 FIX: This workflow should be reverted to "video_processing"');
    console.log('           Then /api/process-video should be triggered to:');
    console.log('           - Download video from Submagic');
    console.log('           - Upload to R2');
    console.log('           - Get finalVideoUrl');
    console.log('           - THEN post to Late API');
  }

  if (data.status === 'posting' && data.finalVideoUrl && !data.latePostId) {
    console.log('   ⚠️  Workflow has finalVideoUrl but no latePostId');
    console.log('   This means Late API call failed or never happened');
  }

  // Check if Submagic project still exists
  if (data.submagicProjectId) {
    console.log(`\n🔗 Submagic Project ID: ${data.submagicProjectId}`);
    console.log('   Check status: https://app.submagic.co/projects/' + data.submagicProjectId);
  }
}

inspectWorkflow().catch(console.error);
