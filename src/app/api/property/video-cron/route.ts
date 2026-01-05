// Property Video Cron Job (NEW SYSTEM)
// Automatically finds eligible properties and generates videos using propertyShowcaseWorkflows
// Runs 5x daily: 9:40 AM, 12:40 PM, 3:40 PM, 6:40 PM, 9:40 PM CST

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

    console.log('🏡 Property video cron job triggered (English)');
    console.log(`📊 Using NEW propertyShowcaseWorkflows system`);

    // Import NEW system functions
    const {
      getNextPropertyFromQueue,
      completePropertyWorkflow,
      failAndRequeuePropertyWorkflow,
      failPropertyWorkflow,
      resetPropertyQueueCycle,
      getPropertyQueueStats
    } = await import('@/lib/property-workflow');

    // Get queue stats
    const stats = await getPropertyQueueStats();
    console.log(`📋 Queue stats: ${stats.queued} queued, ${stats.processing} processing, ${stats.completed} completed`);

    if (stats.nextProperty) {
      console.log(`   Next property: ${stats.nextProperty.address} (videos generated: ${stats.nextProperty.totalVideosGenerated})`);
    }

    // Get next English property from queue
    let workflow = await getNextPropertyFromQueue('en');

    // If queue empty, reset cycle and try again
    if (!workflow) {
      console.log('⚠️  All properties completed this cycle!');
      console.log('🔄 Resetting queue for fresh cycle...');

      const resetCount = await resetPropertyQueueCycle();

      if (resetCount > 0) {
        console.log(`✅ Queue reset - ${resetCount} properties ready for new cycle`);
        // Try again after reset
        workflow = await getNextPropertyFromQueue('en');
      } else {
        console.log('⚠️  Queue is truly empty - no properties to process');
        return NextResponse.json({
          success: true,
          message: 'No properties available in queue',
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

    console.log(`\n🎥 Generating English video for: ${workflow.address}`);
    console.log(`   City: ${workflow.city}, ${workflow.state}`);
    console.log(`   Down payment: $${workflow.downPayment.toLocaleString()}`);
    console.log(`   Monthly payment: $${workflow.monthlyPayment.toLocaleString()}`);
    console.log(`   Total videos generated: ${workflow.totalVideosGenerated}`);
    console.log(`   Current cycle count: ${workflow.currentCycleCount}`);

    const results = [];

    try {
      // Generate 15-second English video using NEW service
      const { generatePropertyVideoNew } = await import('@/lib/property-video-service-new');
      const result = await generatePropertyVideoNew(workflow.id);

      if (result.success) {
        console.log(`✅ Video generation started for ${workflow.address}`);

        // Mark workflow as completed for this cycle
        await completePropertyWorkflow(workflow.id);

        results.push({
          propertyId: workflow.propertyId,
          workflowId: workflow.id,
          address: workflow.address,
          variant: '15sec',
          language: 'en',
          success: true,
          heygenVideoId: result.workflowId,
          totalVideosGenerated: workflow.totalVideosGenerated + 1,
          cycleComplete: true
        });
      } else {
        const isValidationError = result.error === 'Property not eligible' || result.error === 'Invalid property data';
        const errorDetails = result.message || result.error;

        console.error(`❌ Failed: ${result.error}`);
        if (result.message) {
          console.error(`   Details: ${result.message}`);
        }

        // For validation errors, requeue for manual fix
        // For system errors, permanently fail
        if (isValidationError) {
          console.warn(`⚠️  Property ${workflow.propertyId} requeued due to validation errors`);
          await failAndRequeuePropertyWorkflow(workflow.id, errorDetails);
        } else {
          console.error(`❌ Property ${workflow.propertyId} permanently failed due to system error`);
          await failPropertyWorkflow(workflow.id, errorDetails);
        }

        results.push({
          propertyId: workflow.propertyId,
          workflowId: workflow.id,
          address: workflow.address,
          variant: '15sec',
          language: 'en',
          success: false,
          error: result.error,
          errorDetails: errorDetails,
          skipped: isValidationError
        });
      }

    } catch (error) {
      console.error(`❌ Error for ${workflow.address}:`, error);

      // System error - permanently fail
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await failPropertyWorkflow(workflow.id, errorMessage);

      results.push({
        propertyId: workflow.propertyId,
        workflowId: workflow.id,
        address: workflow.address,
        variant: '15sec',
        language: 'en',
        success: false,
        error: errorMessage
      });
    }

    const successCount = results.filter(r => r.success).length;
    const skippedCount = results.filter((r: any) => r.skipped).length;

    // Get updated stats after processing
    const updatedStats = await getPropertyQueueStats();

    console.log(`\n📊 Property video cron summary:`);
    console.log(`   Queue total: ${stats.total} properties`);
    console.log(`   Remaining this cycle: ${updatedStats.queued}`);
    console.log(`   Video generated: ${successCount > 0 ? 'Yes' : 'No'}`);
    if (skippedCount > 0) {
      console.log(`   ⚠️  Skipped due to validation: ${skippedCount} (fix property data)`);
    }
    console.log(`   Property status: ${successCount > 0 ? 'Completed' : skippedCount > 0 ? 'Requeued' : 'Failed'}`);

    const errorMessage = skippedCount > 0
      ? `Property skipped due to validation errors: ${results[0].errorDetails || results[0].error}`
      : results[0]?.error || 'Unknown error';

    return NextResponse.json({
      success: successCount > 0,
      variant: '15sec',
      language: 'en',
      generated: successCount,
      skipped: skippedCount,
      property: results[0],
      queueStats: updatedStats,
      cycleProgress: {
        completed: updatedStats.completed,
        remaining: updatedStats.queued,
        total: stats.total
      },
      message: successCount > 0
        ? `English video generated successfully`
        : errorMessage,
      error: successCount > 0 ? undefined : errorMessage,
      timestamp: new Date().toISOString()
    });

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
