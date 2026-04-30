import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/auth/cron-auth';
import { WorkflowMonitor } from '@/lib/workflow-monitor';

/**
 * Workflow Monitoring Cron
 * 
 * Runs every 15 minutes to check for stuck workflows and send alerts
 * Identifies workflows that have been in processing states too long
 */

export async function POST(req: NextRequest) {
  try {
    // Verify cron authentication
    const authResult = await verifyCronSecret(req);
    if (!authResult.success) {
      console.error('[Workflow Monitor] Auth failed:', authResult.error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Workflow Monitor] Starting workflow monitoring check');
    const startTime = Date.now();

    const results = await WorkflowMonitor.checkStuckWorkflows();
    
    const duration = Math.round((Date.now() - startTime) / 1000);

    // Send alerts if stuck workflows found
    if (results.stuckWorkflows.length > 0 && process.env.SLACK_WEBHOOK_URL) {
      try {
        const alertMessage = `🚨 Stuck Workflows Detected\n\n` +
          `Total: ${results.stuckWorkflows.length}\n` +
          results.stuckWorkflows.map(w => 
            `• ${w.brand}/${w.workflowId}: ${w.status} for ${w.stuckDuration}min`
          ).join('\n');

        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: alertMessage })
        });
      } catch (alertError) {
        console.error('[Workflow Monitor] Failed to send alert:', alertError);
      }
    }

    console.log(`[Workflow Monitor] Check completed in ${duration}s`);
    console.log(`[Workflow Monitor] Found ${results.stuckWorkflows.length} stuck workflows`);
    console.log(`[Workflow Monitor] Processed ${results.actionsPerformed.retry} retries`);

    return NextResponse.json({
      success: true,
      duration,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Workflow Monitor] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Monitoring check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const authResult = await verifyCronSecret(req);
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get current workflow stats
  const stats = await WorkflowMonitor.getWorkflowStats();

  return NextResponse.json({
    status: 'healthy',
    endpoint: 'workflow-monitor',
    stats,
    timestamp: new Date().toISOString()
  });
}