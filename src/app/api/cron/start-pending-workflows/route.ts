// Start Pending Workflows Cron
// Finds workflows stuck in 'pending' status and triggers them to start processing

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;
export const maxDuration = 60; // 1 minute

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 [START-PENDING] Checking for pending workflows...');

    const { db } = await import('@/lib/firebase');
    const { collection, getDocs, query, where, limit: firestoreLimit, orderBy } = await import('firebase/firestore');
    const { getCollectionName } = await import('@/lib/feed-store-firestore');

    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    const pendingWorkflows = [];

    // Check all brand workflows stuck in 'pending'
    for (const brand of ['carz', 'ownerfi', 'vassdistro', 'benefit', 'abdullah'] as const) {
      const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
      console.log(`\n📂 Checking ${collectionName}...`);

      try {
        const q = query(
          collection(db, collectionName),
          where('status', '==', 'pending'),
          orderBy('createdAt', 'asc'),
          firestoreLimit(5) // Start max 5 pending per brand per run
        );

        const snapshot = await getDocs(q);
        console.log(`   Found ${snapshot.size} pending workflows`);

        snapshot.forEach(doc => {
          const data = doc.data();
          const stuckMinutes = Math.round((Date.now() - (data.createdAt || 0)) / 60000);

          console.log(`   📄 Workflow ${doc.id}: pending for ${stuckMinutes} min`);

          // Only start if stuck > 5 minutes (allows for race conditions)
          if (stuckMinutes > 5) {
            pendingWorkflows.push({
              workflowId: doc.id,
              brand,
              articleId: data.articleId,
              articleTitle: data.articleTitle,
              stuckMinutes
            });
          }
        });
      } catch (err) {
        console.error(`   ❌ Error querying ${collectionName}:`, err);
      }
    }

    console.log(`\n📋 Found ${pendingWorkflows.length} workflows to start\n`);

    const results = [];
    const MAX_TO_START = 3; // Only start 3 per cron run to avoid timeout

    // Start each pending workflow
    for (const workflow of pendingWorkflows.slice(0, MAX_TO_START)) {
      console.log(`\n🚀 Starting ${workflow.brand}/${workflow.workflowId}...`);

      try {
        // Trigger the complete-viral workflow endpoint
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

        const response = await fetch(`${baseUrl}/api/workflow/complete-viral`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            brand: workflow.brand,
            platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
            schedule: 'optimal'
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Workflow start failed: ${error}`);
        }

        const result = await response.json();
        console.log(`   ✅ Started: ${result.workflow_id}`);

        results.push({
          workflowId: workflow.workflowId,
          brand: workflow.brand,
          action: 'started',
          newWorkflowId: result.workflow_id
        });
      } catch (error) {
        console.error(`   ❌ Error starting workflow:`, error);
        results.push({
          workflowId: workflow.workflowId,
          brand: workflow.brand,
          action: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const startedCount = results.filter(r => r.action === 'started').length;
    const failedCount = results.filter(r => r.action === 'failed').length;

    console.log(`\n✅ [START-PENDING] Processed ${pendingWorkflows.length} workflows (${startedCount} started, ${failedCount} failed)`);

    return NextResponse.json({
      success: true,
      totalPending: pendingWorkflows.length,
      started: startedCount,
      failed: failedCount,
      results
    });

  } catch (error) {
    console.error('❌ [START-PENDING] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
