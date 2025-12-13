/**
 * Trigger Submagic exports for completed projects
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function triggerExports() {
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

  if (!SUBMAGIC_API_KEY) {
    console.error('SUBMAGIC_API_KEY not set');
    process.exit(1);
  }

  // Get all submagic_processing workflows
  const snap = await db.collection('abdullah_workflow_queue')
    .where('status', '==', 'submagic_processing')
    .get();

  console.log(`Found ${snap.docs.length} workflows in submagic_processing`);
  console.log('Triggering exports...\n');

  let success = 0;
  let failed = 0;
  let stillProcessing = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const projectId = d.submagicProjectId || d.submagicVideoId;

    if (!projectId) {
      console.log(`${doc.id}: No project ID, skipping`);
      continue;
    }

    // Check project status
    const statusResp = await fetch(`https://api.submagic.co/v1/projects/${projectId}`, {
      headers: { 'x-api-key': SUBMAGIC_API_KEY }
    });
    const statusData = await statusResp.json();

    if (statusData.status !== 'completed') {
      console.log(`${doc.id.slice(0, 20)}: Still ${statusData.status}`);
      stillProcessing++;
      continue;
    }

    // Trigger export
    console.log(`${doc.id.slice(0, 20)}: Triggering export...`);

    const exportResp = await fetch(`https://api.submagic.co/v1/projects/${projectId}/export`, {
      method: 'POST',
      headers: {
        'x-api-key': SUBMAGIC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhookUrl: 'https://ownerfi.com/api/webhooks/submagic/abdullah'
      })
    });

    if (exportResp.ok) {
      console.log('  ✅ Export triggered');
      success++;
    } else {
      const err = await exportResp.text();
      console.log(`  ❌ Failed: ${err.slice(0, 100)}`);
      failed++;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n========================================');
  console.log(`Exports triggered: ${success}`);
  console.log(`Still processing: ${stillProcessing}`);
  console.log(`Failed: ${failed}`);
  console.log('========================================');
}

triggerExports().catch(console.error);
