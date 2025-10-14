// Failsafe: Check for stuck Submagic workflows every 5 minutes
// If a workflow has been in "submagic_processing" for >5 minutes, check Submagic API
// and complete the workflow if the video is ready (webhook failover)
// Submagic webhooks are unreliable, so this ensures videos complete within 5-10 min max

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;
export const maxDuration = 60; // 1 minute

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
    if (!SUBMAGIC_API_KEY) {
      return NextResponse.json({ error: 'Submagic API key not configured' }, { status: 500 });
    }

    console.log('🔍 [FAILSAFE] Checking for stuck Submagic workflows (>5 min)...');

    // Get workflows in submagic_processing status
    const { db } = await import('@/lib/firebase');
    const { collection, query, where, getDocs } = await import('firebase/firestore');

    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    const results = [];
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000); // 5 minutes ago (reduced from 10 for faster failsafe)

    // Check Carz, OwnerFi, and Podcast collections
    const collections = [
      { name: 'carz_workflow_queue', type: 'social', brand: 'carz' },
      { name: 'ownerfi_workflow_queue', type: 'social', brand: 'ownerfi' },
      { name: 'podcast_workflow_queue', type: 'podcast', brand: 'podcast' }
    ];

    for (const { name: collectionName, type, brand } of collections) {
      const q = query(
        collection(db, collectionName),
        where('status', '==', type === 'podcast' ? 'submagic_processing' : 'submagic_processing')
      );

      const snapshot = await getDocs(q);

      for (const doc of snapshot.docs) {
        const workflow = doc.data();
        const submagicProjectId = type === 'podcast' ? workflow.submagicProjectId : workflow.submagicVideoId;
        const updatedAt = workflow.updatedAt || workflow.createdAt || 0;

        if (!submagicProjectId) continue;

        // Only check workflows that have been stuck for >5 minutes
        if (updatedAt > fiveMinutesAgo) {
          console.log(`   ⏭️  Skipping ${doc.id} - updated ${Math.round((Date.now() - updatedAt) / 60000)} min ago`);
          continue;
        }

        console.log(`\n🔍 Checking stuck ${brand} workflow ${doc.id}...`);
        console.log(`   Submagic Project: ${submagicProjectId}`);
        console.log(`   Stuck for: ${Math.round((Date.now() - updatedAt) / 60000)} minutes`);

        // Check Submagic status
        const response = await fetch(`https://api.submagic.co/v1/projects/${submagicProjectId}`, {
          headers: { 'x-api-key': SUBMAGIC_API_KEY }
        });

        if (!response.ok) {
          console.log(`   ❌ API error: ${response.status}`);
          results.push({
            workflowId: doc.id,
            brand,
            submagicProjectId,
            action: 'api_error',
            error: `API returned ${response.status}`
          });
          continue;
        }

        const projectData = await response.json();
        const status = projectData.status;
        const downloadUrl = projectData.media_url || projectData.video_url || projectData.downloadUrl;

        console.log(`   Submagic status: ${status}`);

        if (status === 'completed' || status === 'done' || status === 'ready') {
          if (!downloadUrl) {
            console.log(`   ⚠️  Status is complete but no download URL found`);
            results.push({
              workflowId: doc.id,
              brand,
              submagicProjectId,
              action: 'no_url',
              status
            });
            continue;
          }

          console.log(`   ✅ Video is complete! Triggering webhook manually...`);

          // Manually trigger webhook (failover)
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
          const webhookResponse = await fetch(`${baseUrl}/api/webhooks/submagic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: submagicProjectId,
              id: submagicProjectId,
              status: 'completed',
              downloadUrl: downloadUrl,
              media_url: downloadUrl,
              timestamp: new Date().toISOString()
            })
          });

          const webhookResult = await webhookResponse.json();

          console.log(`   ✅ Webhook triggered successfully!`);

          results.push({
            workflowId: doc.id,
            brand,
            submagicProjectId,
            action: 'completed_via_failsafe',
            webhookResult
          });
        } else {
          console.log(`   ⏳ Still processing (${status})`);
          results.push({
            workflowId: doc.id,
            brand,
            submagicProjectId,
            status,
            action: 'still_processing'
          });
        }
      }
    }

    const completedCount = results.filter(r => r.action === 'completed_via_failsafe').length;

    console.log(`\n✅ [FAILSAFE] Checked ${results.length} stuck workflows (${completedCount} auto-completed)`);

    return NextResponse.json({
      success: true,
      processed: results.length,
      completed: completedCount,
      workflows: results
    });

  } catch (error) {
    console.error('❌ [FAILSAFE] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also support POST for Vercel cron
export async function POST(request: NextRequest) {
  return GET(request);
}
