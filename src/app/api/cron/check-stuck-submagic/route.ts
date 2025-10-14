// ULTRA-SIMPLE Failsafe: Use feed-store-firestore functions to find stuck workflows
// Then check each one's Submagic status and complete if ready
// Force rebuild: v2

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

    console.log('🔍 [FAILSAFE] Checking for stuck Submagic workflows...');

    // Import the feed store functions that already work
    const {
      findWorkflowBySubmagicId,
      getCollectionName
    } = await import('@/lib/feed-store-firestore');

    const { db } = await import('@/lib/firebase');

    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    console.log('✅ Firebase initialized');

    // Try to get workflows using client SDK (same as feed-store uses)
    const { collection, getDocs, query, where } = await import('firebase/firestore');

    const projects = [];

    // Check both carz and ownerfi
    for (const brand of ['carz', 'ownerfi'] as const) {
      const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
      console.log(`\n📂 Checking ${collectionName}...`);

      try {
        const q = query(
          collection(db, collectionName),
          where('status', '==', 'submagic_processing')
        );

        const snapshot = await getDocs(q);
        console.log(`   Found ${snapshot.size} workflows in submagic_processing`);

        snapshot.forEach(doc => {
          const data = doc.data();
          const submagicVideoId = data.submagicVideoId;

          if (submagicVideoId) {
            projects.push({
              projectId: submagicVideoId,
              workflowId: doc.id,
              brand
            });
          }
        });
      } catch (err) {
        console.error(`   ❌ Error querying ${collectionName}:`, err);
      }
    }

    console.log(`\n📋 Found ${projects.length} total stuck workflows`);

    const results = [];
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

    // Check each stuck workflow's Submagic status
    for (const project of projects) {
      const { projectId, workflowId, brand } = project;

      console.log(`\n🔍 Checking Submagic project: ${projectId}`);

      try {
        // Get status from Submagic API
        const submagicResponse = await fetch(`https://api.submagic.co/v1/projects/${projectId}`, {
          headers: { 'x-api-key': SUBMAGIC_API_KEY }
        });

        if (!submagicResponse.ok) {
          console.log(`   ❌ Submagic API error: ${submagicResponse.status}`);
          results.push({
            projectId,
            workflowId,
            action: 'api_error',
            error: `API returned ${submagicResponse.status}`
          });
          continue;
        }

        const submagicData = await submagicResponse.json();
        const status = submagicData.status;
        const downloadUrl = submagicData.media_url || submagicData.video_url || submagicData.downloadUrl;

        console.log(`   Status: ${status}`);

        if (status === 'completed' || status === 'done' || status === 'ready') {
          if (!downloadUrl) {
            console.log(`   ⚠️  Complete but no download URL`);
            results.push({
              projectId,
              workflowId,
              action: 'no_url',
              status
            });
            continue;
          }

          console.log(`   ✅ COMPLETED! Triggering webhook...`);

          // Trigger webhook to complete the workflow
          const webhookResponse = await fetch(`${baseUrl}/api/webhooks/submagic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: projectId,
              id: projectId,
              status: 'completed',
              downloadUrl: downloadUrl,
              media_url: downloadUrl,
              timestamp: new Date().toISOString()
            })
          });

          const webhookResult = await webhookResponse.json();

          results.push({
            projectId,
            workflowId,
            brand,
            action: 'completed_via_failsafe',
            webhookResult
          });

          console.log(`   ✅ Webhook triggered successfully!`);
        } else {
          console.log(`   ⏳ Still processing (${status})`);
          results.push({
            projectId,
            workflowId,
            status,
            action: 'still_processing'
          });
        }
      } catch (error) {
        console.error(`   ❌ Error checking ${projectId}:`, error);
        results.push({
          projectId,
          workflowId,
          action: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const completedCount = results.filter(r => r.action === 'completed_via_failsafe').length;

    console.log(`\n✅ [FAILSAFE] Checked ${projects.length} stuck workflows (${completedCount} completed)`);

    return NextResponse.json({
      success: true,
      totalWorkflows: projects.length,
      processed: results.length,
      completed: completedCount,
      results
    });

  } catch (error) {
    console.error('❌ [FAILSAFE] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

// Also support POST for Vercel cron
export async function POST(request: NextRequest) {
  return GET(request);
}
