// Property Video Cron Job (New Simplified System)
// Automatically finds eligible properties and generates videos
// Runs 5x daily

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const referer = request.headers.get('referer');
    const userAgent = request.headers.get('user-agent');

    const isFromDashboard = referer && referer.includes(request.headers.get('host') || '');
    const hasValidSecret = authHeader === `Bearer ${CRON_SECRET}`;
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (!isFromDashboard && !hasValidSecret && !isVercelCron) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🏡 Property video cron job triggered (NEW SYSTEM)');

    const {
      getNextPropertyFromQueue,
      completePropertyWorkflow,
      failAndRequeuePropertyWorkflow,
      failPropertyWorkflow,
      resetPropertyQueueCycle,
      getPropertyQueueStats,
      syncPropertyQueue
    } = await import('@/lib/property-workflow');

    const { generatePropertyVideoNew } = await import('@/lib/property-video-service-new');

    // Sync queue with properties database (lightweight operation)
    console.log('🔄 Syncing queue with properties database...');
    const syncResult = await syncPropertyQueue();
    if (syncResult.added > 0 || syncResult.removed > 0) {
      console.log(`   ✅ +${syncResult.added} new, -${syncResult.removed} deleted`);
    }

    // Get queue stats
    const stats = await getPropertyQueueStats();
    console.log(`📋 Queue stats: ${stats.queued} queued, ${stats.processing} processing, ${stats.completed} completed`);

    if (stats.nextProperty) {
      console.log(`   Next: ${stats.nextProperty.address} (cycle ${stats.nextProperty.currentCycleCount + 1})`);
    }

    // Get next property from queue
    let workflow = await getNextPropertyFromQueue();

    // If queue empty, reset cycle and try again
    if (!workflow) {
      console.log('⚠️  All properties completed this cycle!');
      console.log('🔄 Resetting queue for fresh cycle...');

      const resetCount = await resetPropertyQueueCycle();

      if (resetCount > 0) {
        console.log(`✅ Queue reset - ${resetCount} properties ready for new cycle`);
        workflow = await getNextPropertyFromQueue();
      } else {
        return NextResponse.json({
          success: true,
          message: 'Queue empty - no properties to process',
          generated: 0
        });
      }
    }

    if (!workflow) {
      return NextResponse.json({
        success: true,
        message: 'No properties available after reset',
        generated: 0
      });
    }

    console.log(`\n🎥 Generating video for: ${workflow.address}`);
    console.log(`   City: ${workflow.city}, ${workflow.state}`);
    console.log(`   Down payment: $${workflow.downPayment.toLocaleString()}`);
    console.log(`   Times shown: ${workflow.totalVideosGenerated}`);
    console.log(`   Queue position: ${workflow.queuePosition}`);

    // Generate video
    const result = await generatePropertyVideoNew(workflow.id);

    if (result.success) {
      console.log(`✅ Video generation started for ${workflow.address}`);

      // Mark workflow as completed
      await completePropertyWorkflow(workflow.id);

      // Get updated stats
      const updatedStats = await getPropertyQueueStats();

      return NextResponse.json({
        success: true,
        variant: workflow.variant,
        generated: 1,
        workflowId: workflow.id,
        property: {
          propertyId: workflow.propertyId,
          address: workflow.address,
          timesShown: workflow.totalVideosGenerated + 1
        },
        queueStats: updatedStats,
        message: 'Video generated successfully',
        timestamp: new Date().toISOString()
      });

    } else {
      const isValidationError = result.error === 'Property not eligible' || result.error === 'Invalid property data';

      console.error(`❌ Failed: ${result.error}`);
      if (result.message) {
        console.error(`   Details: ${result.message}`);
      }

      // For validation errors, requeue for manual fix
      // For system errors, mark as permanently failed
      if (isValidationError) {
        console.warn(`⚠️  Property ${workflow.propertyId} has validation errors - requeuing`);
        await failAndRequeuePropertyWorkflow(workflow.id, result.error + ': ' + (result.message || ''));
      } else {
        await failPropertyWorkflow(workflow.id, result.error || 'Unknown error');
      }

      const updatedStats = await getPropertyQueueStats();

      return NextResponse.json({
        success: false,
        variant: workflow.variant,
        generated: 0,
        skipped: isValidationError ? 1 : 0,
        workflowId: workflow.id,
        property: {
          propertyId: workflow.propertyId,
          address: workflow.address
        },
        error: result.error,
        message: result.message || result.error,
        queueStats: updatedStats,
        timestamp: new Date().toISOString()
      }, { status: isValidationError ? 400 : 500 });
    }

  } catch (error) {
    console.error('❌ Property video cron error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(_request: NextRequest) {
  return GET(_request);
}
