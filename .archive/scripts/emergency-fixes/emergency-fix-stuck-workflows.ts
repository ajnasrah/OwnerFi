/**
 * EMERGENCY: Fix all stuck property workflows
 * This script will:
 * 1. Find all workflows stuck in "posting" without finalVideoUrl
 * 2. Manually download videos from Submagic
 * 3. Upload to R2
 * 4. Update workflows with finalVideoUrl
 * 5. Trigger Late API posting
 *
 * Run with: npx tsx scripts/emergency-fix-stuck-workflows.ts
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
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

async function fixStuckWorkflows() {
  console.log('🚨 EMERGENCY FIX: Recovering stuck property workflows\n');
  console.log('='.repeat(80));

  // Find all stuck workflows
  const stuckSnapshot = await db.collection('property_videos')
    .where('status', '==', 'posting')
    .get();

  const stuckWorkflows = stuckSnapshot.docs.filter(doc => {
    const data = doc.data();
    return !data.finalVideoUrl; // Stuck without video URL
  });

  console.log(`\n📊 Found ${stuckWorkflows.length} stuck workflows\n`);

  if (stuckWorkflows.length === 0) {
    console.log('✅ No stuck workflows found!');
    return;
  }

  let fixed = 0;
  let failed = 0;

  for (const doc of stuckWorkflows) {
    const workflowId = doc.id;
    const data = doc.data();

    console.log(`\n${'='.repeat(80)}`);
    console.log(`\n🔧 Processing: ${workflowId}`);
    console.log(`   Property: ${data.address}`);
    console.log(`   Submagic Project: ${data.submagicProjectId || 'N/A'}`);

    try {
      // Trigger process-video endpoint
      console.log(`\n📞 Calling /api/process-video...`);

      const response = await fetch(`${baseUrl}/api/process-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brand: 'property',
          workflowId,
          submagicProjectId: data.submagicProjectId,
          videoUrl: data.submagicDownloadUrl || data.heygenVideoUrl
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log(`   ✅ SUCCESS!`);
        console.log(`   Video URL: ${result.videoUrl || 'N/A'}`);
        console.log(`   Late Post ID: ${result.postId || 'N/A'}`);
        fixed++;
      } else {
        console.log(`   ❌ FAILED: ${result.error || 'Unknown error'}`);
        console.log(`   Response:`, JSON.stringify(result, null, 2));
        failed++;
      }

    } catch (error) {
      console.log(`   ❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }

    // Wait 2 seconds between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`\n📊 RECOVERY COMPLETE:`);
  console.log(`   ✅ Fixed: ${fixed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📝 Total: ${stuckWorkflows.length}`);
  console.log('');
}

fixStuckWorkflows().catch(console.error);
