// SIMPLIFIED Failsafe: Check Submagic projects directly and complete any that are done
// Runs every 5 minutes - just polls Submagic API for recent projects
// If any are completed, trigger webhook to complete the workflow
// No complex Firestore queries - just check Submagic and complete

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

    console.log('🔍 [FAILSAFE] Polling Submagic for completed projects...');

    // Get list of recent projects from Submagic
    const listResponse = await fetch('https://api.submagic.co/v1/projects?limit=50', {
      headers: { 'x-api-key': SUBMAGIC_API_KEY }
    });

    if (!listResponse.ok) {
      throw new Error(`Submagic list API error: ${listResponse.status}`);
    }

    const listData = await listResponse.json();
    const projects = listData.projects || listData.data || [];

    console.log(`   Found ${projects.length} recent projects`);

    const results = [];
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

    // Check each project
    for (const project of projects) {
      const projectId = project.id || project.project_id;
      const status = project.status;
      const downloadUrl = project.media_url || project.video_url || project.downloadUrl;

      // Only process completed projects
      if (status !== 'completed' && status !== 'done' && status !== 'ready') {
        continue;
      }

      if (!downloadUrl) {
        console.log(`   ⚠️  Project ${projectId}: complete but no download URL`);
        continue;
      }

      console.log(`\n✅ Project ${projectId}: COMPLETED - Triggering webhook...`);

      // Trigger webhook to complete the workflow
      try {
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
          action: 'webhook_triggered',
          webhookResult
        });

        console.log(`   ✅ Webhook triggered for ${projectId}`);
      } catch (webhookError) {
        console.error(`   ❌ Webhook failed for ${projectId}:`, webhookError);
        results.push({
          projectId,
          action: 'webhook_failed',
          error: webhookError instanceof Error ? webhookError.message : 'Unknown error'
        });
      }
    }

    const completedCount = results.filter(r => r.action === 'webhook_triggered').length;

    console.log(`\n✅ [FAILSAFE] Processed ${results.length} completed projects (${completedCount} webhooks sent)`);

    return NextResponse.json({
      success: true,
      totalProjects: projects.length,
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
