/**
 * Recover failed Abdullah workflows
 * Re-submits videos to Submagic that failed due to insufficient credits
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function reprocessWorkflows() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  const db = getFirestore();
  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
  const dec6 = new Date('2025-12-06T00:00:00Z').getTime();

  if (!SUBMAGIC_API_KEY) {
    console.error('SUBMAGIC_API_KEY not set');
    process.exit(1);
  }

  // First test if Submagic has credits now
  console.log('Testing Submagic credits...');
  const testResp = await fetch('https://api.submagic.co/v1/projects', {
    method: 'POST',
    headers: {
      'x-api-key': SUBMAGIC_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title: 'test', videoUrl: 'https://example.com/test.mp4' })
  });
  const testResult = await testResp.text();

  if (testResult.includes('INSUFFICIENT_CREDITS')) {
    console.error('❌ STILL NO CREDITS! Please add Submagic credits first.');
    console.error('Response:', testResult);
    process.exit(1);
  }

  console.log('✅ Submagic credits available! Proceeding with recovery...\n');

  // Get all failed workflows with HeyGen URLs
  const snap = await db.collection('abdullah_workflow_queue')
    .where('createdAt', '>=', dec6)
    .orderBy('createdAt', 'asc') // Process oldest first
    .get();

  const recoverable = snap.docs.filter(doc => {
    const d = doc.data();
    return d.heygenVideoUrl && d.status === 'failed';
  });

  console.log(`Found ${recoverable.length} workflows to recover\n`);

  let success = 0;
  let failed = 0;
  let expired = 0;

  for (const doc of recoverable) {
    const d = doc.data();
    const workflowId = doc.id;

    console.log(`Processing: ${workflowId}`);
    console.log(`  Title: ${d.title || 'Unknown'}`);

    // Check if HeyGen URL is still valid (they expire after 7 days)
    try {
      const headResp = await fetch(d.heygenVideoUrl, { method: 'HEAD' });
      if (!headResp.ok) {
        console.log(`  ❌ HeyGen URL expired (status ${headResp.status}), skipping`);
        expired++;
        continue;
      }
    } catch (e) {
      console.log(`  ❌ HeyGen URL check failed, skipping`);
      expired++;
      continue;
    }

    // Submit to Submagic
    const webhookUrl = 'https://ownerfi.com/api/webhooks/submagic/abdullah';
    let title = d.title || 'Abdullah Video';
    if (title.length > 50) title = title.substring(0, 47) + '...';

    const submagicConfig = {
      title,
      language: 'en',
      videoUrl: d.heygenVideoUrl,
      webhookUrl,
      templateName: 'Hormozi 2',
      magicZooms: true,
      magicBrolls: true,
      magicBrollsPercentage: 75,
      removeSilencePace: 'fast',
      removeBadTakes: true
    };

    try {
      const resp = await fetch('https://api.submagic.co/v1/projects', {
        method: 'POST',
        headers: {
          'x-api-key': SUBMAGIC_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submagicConfig)
      });

      const result = await resp.json();

      if (!resp.ok) {
        console.log(`  ❌ Submagic error: ${JSON.stringify(result)}`);
        failed++;
        continue;
      }

      const projectId = result.id || result.project_id || result.projectId;

      if (!projectId) {
        console.log(`  ❌ No project ID in response`);
        failed++;
        continue;
      }

      // Update workflow
      await db.collection('abdullah_workflow_queue').doc(workflowId).update({
        status: 'submagic_processing',
        submagicProjectId: projectId,
        submagicVideoId: projectId,
        error: null,
        recoveredAt: Date.now(),
        updatedAt: Date.now()
      });

      console.log(`  ✅ Submitted to Submagic: ${projectId}`);
      success++;

      // Rate limit - wait 2 seconds between submissions
      await new Promise(r => setTimeout(r, 2000));

    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message}`);
      failed++;
    }
  }

  console.log('\n========================================');
  console.log('Recovery complete!');
  console.log(`  ✅ Success: ${success}`);
  console.log(`  ⏰ Expired URLs: ${expired}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log('========================================');
  console.log('\nSubmagic will process videos and call webhooks.');
  console.log('Videos will auto-post to Late when ready.');
}

reprocessWorkflows().catch(console.error);
