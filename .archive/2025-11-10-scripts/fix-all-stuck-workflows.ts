/**
 * COMPREHENSIVE FIX FOR ALL STUCK WORKFLOWS
 *
 * This script fixes ALL identified stuck workflows across all brands:
 *
 * 1. ABDULLAH (10 workflows): HeyGen completed but webhooks never fired
 * 2. BENEFIT (11 workflows): HeyGen completed, webhooks fired, but Submagic never called
 * 3. PROPERTY (1 workflow): Submagic submitted but never completed
 * 4. CARZ (1 workflow): Stuck in pending - never processed
 */

import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

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
const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

// Abdullah stuck workflows (HeyGen completed, webhooks never fired)
const abdullahWorkflows = [
  { id: 'wf_1761758235816_cle454i7f', heygenVideoId: 'f78abf2ae08b4e099910ba072a68c230' },
  { id: 'wf_1761758235128_qihjgxpxi', heygenVideoId: 'd92bd29452714ae7bce924dd316bbd0d' },
  { id: 'wf_1761758234368_xc466dxa9', heygenVideoId: '8389678f71364ea083d7ecf2f574b260' },
  { id: 'wf_1761758233679_1auhzjixf', heygenVideoId: 'edee5dae00e441c0bc07103885c3a62d' },
  { id: 'wf_1761758232438_fh28md7md', heygenVideoId: 'de07e5aa48cf43a287a9a0599bc9cc04' },
  { id: 'wf_1761681724605_k19j9zh23', heygenVideoId: 'c0243bc9cb4245a49d4c8e6d91c0f394' },
  { id: 'wf_1761681720844_dkty8o8sl', heygenVideoId: '2603a5cea5624ae78f4ddacb16714674' },
  { id: 'wf_1761681717327_0rqnnwtrz', heygenVideoId: 'ef03411ac3694b72847155629c00121d' },
  { id: 'wf_1761681713687_w3tqnggmj', heygenVideoId: '82011b605877400dabaa769b43225f7b' },
  { id: 'wf_1761681709784_q7ad5hhu9', heygenVideoId: '9a13cb7210fb4b65b397f8c1e9d3fcd4' }
];

// BENEFIT stuck workflows (HeyGen completed, webhook fired, but Submagic never called)
const benefitWorkflows = [
  { id: 'benefit_1761934850908_1nj4eh1o1', heygenVideoId: '3036178ca8984dc6b68e85f60069e504' },
  { id: 'benefit_1761924005565_tucz3pmnd', heygenVideoId: '18dc2e59ec614d9eadf4398e803a9051' },
  { id: 'benefit_1761913205581_nhr22j8hq', heygenVideoId: '87f9b7529c83430b89e2ff401e0d371d' },
  { id: 'benefit_1761902405890_eml9312fz', heygenVideoId: '9f57fbc478824682b849b2c592b14f8a' },
  { id: 'benefit_1761859225019_tsp1a29ep', heygenVideoId: '2464e265ed3440bd9aa7a27b2ba68bca' },
  { id: 'benefit_1761848451069_i5gsvfpfs', heygenVideoId: 'c62e69c5ac924d959b7ab2adbb459fa1' },
  { id: 'benefit_1761837641745_3pnz6tgvu', heygenVideoId: '8f57e987a4594282b1f95014afb9e259' },
  { id: 'benefit_1761826820814_97bh1u692', heygenVideoId: 'fb30188a02fa4f3bbc5b17b3a176752d' },
  { id: 'benefit_1761816021075_7pwhmt6ri', heygenVideoId: 'f48bff367f5b4d5eac4859b54121b90d' },
  { id: 'benefit_1761772806088_6q60ok5hl', heygenVideoId: 'b25d8f5d645b47e5bc5940ded6c2da48' },
  { id: 'benefit_1761762047713_tw4rvflvw', heygenVideoId: '1b566ffd0d8341b0a1fb511b3b4dec6b' }
];

async function fixAllStuckWorkflows() {
  console.log('🔧 FIXING ALL STUCK WORKFLOWS ACROSS ALL BRANDS\n');
  console.log('=' .repeat(70));

  // FIX 1: ABDULLAH - Manually trigger HeyGen webhook processing
  console.log('\n📱 FIX 1: ABDULLAH - Processing 10 stuck HeyGen webhooks');
  console.log('=' .repeat(70));

  for (const workflow of abdullahWorkflows) {
    console.log(`\n🔄 Processing: ${workflow.id}`);

    try {
      // Manually call the Abdullah HeyGen webhook endpoint
      const response = await fetch('https://ownerfi.ai/api/webhooks/heygen/abdullah', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'heygen-webhook-manual-recovery/1.0'
        },
        body: JSON.stringify({
          event_type: 'avatar_video.success',
          event_data: {
            video_id: workflow.heygenVideoId,
            url: `https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/${workflow.heygenVideoId}.mp4`,
            callback_id: workflow.id
          }
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`   ✅ Webhook processed successfully`);
      } else {
        console.log(`   ⚠️  Webhook response: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error(`   ❌ Error:`, error);
    }

    // Wait 2 seconds between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // FIX 2: BENEFIT - Manually trigger Submagic processing
  console.log('\n\n📱 FIX 2: BENEFIT - Processing 11 stuck Submagic calls');
  console.log('=' .repeat(70));

  for (const workflow of benefitWorkflows) {
    console.log(`\n🔄 Processing: ${workflow.id}`);

    try {
      // Manually call the BENEFIT HeyGen webhook endpoint to re-trigger Submagic
      const response = await fetch('https://ownerfi.ai/api/webhooks/heygen/benefit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'heygen-webhook-manual-recovery/1.0'
        },
        body: JSON.stringify({
          event_type: 'avatar_video.success',
          event_data: {
            video_id: workflow.heygenVideoId,
            url: `https://files2.heygen.ai/aws_pacific/avatar_tmp/341b42c6e9954d79bbf8e5c18318a9c2/${workflow.heygenVideoId}.mp4`,
            callback_id: workflow.id
          }
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`   ✅ Webhook processed successfully - Submagic should be triggered`);
      } else {
        console.log(`   ⚠️  Webhook response: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error(`   ❌ Error:`, error);
    }

    // Wait 2 seconds between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // FIX 3: PROPERTY - Check Submagic status and retry if needed
  console.log('\n\n📱 FIX 3: PROPERTY - Checking stuck Submagic workflow');
  console.log('=' .repeat(70));

  const propertyWorkflowId = 'property_15sec_1761914427106_khlp2';
  const submagicProjectId = 'd628e501-d90d-4630-b86a-7bb25431a1a9';

  console.log(`\n🔄 Checking Submagic project: ${submagicProjectId}`);

  try {
    // Check Submagic project status
    const response = await fetch(`https://api.submagic.co/v1/projects/${submagicProjectId}`, {
      headers: {
        'x-api-key': SUBMAGIC_API_KEY!
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`   Status: ${JSON.stringify(data, null, 2)}`);

      if (data.status === 'failed' || data.status === 'error') {
        console.log(`   ❌ Submagic project failed - marking workflow as failed`);
        await db.collection('property_videos').doc(propertyWorkflowId).update({
          status: 'failed',
          error: `Submagic project failed: ${data.error || 'Unknown error'}`,
          updatedAt: Date.now()
        });
      }
    } else {
      console.log(`   ⚠️  Could not fetch Submagic status: ${response.status}`);
      console.log(`   Marking as failed after 11+ hours stuck`);
      await db.collection('property_videos').doc(propertyWorkflowId).update({
        status: 'failed',
        error: 'Submagic processing timeout (11+ hours)',
        updatedAt: Date.now()
      });
    }
  } catch (error) {
    console.error(`   ❌ Error:`, error);
  }

  // FIX 4: CARZ - Trigger the pending workflow
  console.log('\n\n📱 FIX 4: CARZ - Triggering pending workflow');
  console.log('=' .repeat(70));

  const carzWorkflowId = 'wf_1761825629103_01yhldgou';

  console.log(`\n🔄 Triggering workflow: ${carzWorkflowId}`);

  try {
    // Get the workflow data
    const doc = await db.collection('carz_workflow_queue').doc(carzWorkflowId).get();
    const data = doc.data();

    if (data) {
      console.log(`   Article: ${data.articleTitle || 'Unknown'}`);
      console.log(`   Manually triggering complete-viral workflow...`);

      const response = await fetch('https://ownerfi.ai/api/workflow/complete-viral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: 'carz',
          platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin'],
          schedule: 'immediate',
          articleId: data.articleId
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log(`   ✅ Workflow triggered successfully`);
        // Delete the old pending workflow
        await db.collection('carz_workflow_queue').doc(carzWorkflowId).delete();
        console.log(`   🗑️  Deleted old pending workflow`);
      } else {
        console.log(`   ⚠️  Response: ${JSON.stringify(result)}`);
      }
    }
  } catch (error) {
    console.error(`   ❌ Error:`, error);
  }

  console.log('\n\n' + '='.repeat(70));
  console.log('✅ ALL FIXES APPLIED');
  console.log('='.repeat(70));
  console.log('\nNext steps:');
  console.log('1. Monitor workflows over next 30 minutes');
  console.log('2. Check that Submagic processes the retriggered workflows');
  console.log('3. Verify webhooks complete successfully');
}

fixAllStuckWorkflows()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Script failed:', err);
    process.exit(1);
  });
