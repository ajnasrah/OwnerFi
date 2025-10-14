// Complete workflows stuck in 'posting' status with completed Submagic videos
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Finding workflows stuck in posting status...');

    const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
    if (!SUBMAGIC_API_KEY) {
      return NextResponse.json({ error: 'Submagic API key not configured' }, { status: 500 });
    }

    // Import Firebase Admin for direct Firestore access
    const { getFirestore } = await import('firebase-admin/firestore');
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');

    // Initialize Firebase Admin if needed
    if (getApps().length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!projectId || !clientEmail || !privateKey) {
        return NextResponse.json({ error: 'Firebase Admin credentials not configured' }, { status: 500 });
      }

      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey })
      });
    }

    const db = getFirestore();
    const results = [];

    // Check both Carz and OwnerFi collections
    for (const brand of ['carz', 'ownerfi']) {
      const collectionName = brand === 'carz' ? 'carz_workflow_queue' : 'ownerfi_workflow_queue';

      const snapshot = await db.collection(collectionName)
        .where('status', '==', 'posting')
        .get();

      console.log(`📂 ${brand.toUpperCase()}: Found ${snapshot.size} workflows in posting status`);

      for (const doc of snapshot.docs) {
        const workflow = doc.data();
        const submagicProjectId = workflow.submagicVideoId;

        if (!submagicProjectId) {
          console.log(`  ⚠️  ${doc.id}: No Submagic ID`);
          results.push({
            workflowId: doc.id,
            brand,
            articleTitle: workflow.articleTitle,
            action: 'skipped',
            reason: 'no_submagic_id'
          });
          continue;
        }

        console.log(`\n🔍 Checking ${brand} workflow: ${workflow.articleTitle}`);
        console.log(`   Submagic ID: ${submagicProjectId}`);

        // Check Submagic status to see if video is ready
        const response = await fetch(`https://api.submagic.co/v1/projects/${submagicProjectId}`, {
          headers: { 'x-api-key': SUBMAGIC_API_KEY }
        });

        if (!response.ok) {
          console.log(`   ❌ Submagic API error: ${response.status}`);
          results.push({
            workflowId: doc.id,
            brand,
            articleTitle: workflow.articleTitle,
            action: 'api_error',
            error: `API returned ${response.status}`
          });
          continue;
        }

        const projectData = await response.json();
        const status = projectData.status;
        const downloadUrl = projectData.media_url || projectData.video_url || projectData.downloadUrl;

        console.log(`   Submagic Status: ${status}`);

        if (status === 'completed' || status === 'done' || status === 'ready') {
          if (!downloadUrl) {
            console.log(`   ⚠️  Completed but no download URL`);
            results.push({
              workflowId: doc.id,
              brand,
              articleTitle: workflow.articleTitle,
              action: 'no_url',
              status
            });
            continue;
          }

          console.log(`   ✅ Video complete! Re-triggering webhook to retry posting...`);

          // Re-trigger the Submagic webhook to retry posting with fixed code
          const baseUrl = 'https://ownerfi.ai';
          const webhookResponse = await fetch(`${baseUrl}/api/webhooks/submagic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: submagicProjectId,
              status: 'completed',
              downloadUrl: downloadUrl,
              media_url: downloadUrl,
              timestamp: new Date().toISOString()
            })
          });

          const webhookResult = await webhookResponse.json();

          console.log(`   ✅ Webhook triggered:`, webhookResult);

          results.push({
            workflowId: doc.id,
            brand,
            articleTitle: workflow.articleTitle,
            submagicProjectId,
            action: 'retried_posting',
            webhookResult
          });
        } else {
          console.log(`   ⏳ Still processing: ${status}`);
          results.push({
            workflowId: doc.id,
            brand,
            articleTitle: workflow.articleTitle,
            submagicProjectId,
            status,
            action: 'still_processing'
          });
        }
      }
    }

    console.log(`\n✅ Processed ${results.length} workflows in posting status`);

    return NextResponse.json({
      success: true,
      processed: results.length,
      workflows: results
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
