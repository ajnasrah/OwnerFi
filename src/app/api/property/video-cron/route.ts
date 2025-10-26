// Property Video Cron Job
// Automatically finds eligible properties and generates videos
// Runs 3x daily: 11 AM, 5 PM, 11 PM EST

import { NextRequest, NextResponse } from 'next/server';
import { isEligibleForVideo } from '@/lib/property-video-generator';
import type { PropertyListing } from '@/lib/property-schema';

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_VIDEOS_PER_RUN = 1; // 1 per run × 5 runs = 5 per day

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

    console.log('🏡 Property video cron job triggered');
    console.log(`📊 Using rotating property queue system`);

    // Import rotation queue functions
    const {
      getNextPropertyFromRotation,
      markPropertyCompleted,
      resetPropertyQueueCycle,
      getPropertyRotationStats
    } = await import('@/lib/feed-store-firestore');

    // Get queue stats
    const stats = await getPropertyRotationStats();
    console.log(`📋 Queue stats: ${stats.queued} queued, ${stats.processing} processing, ${stats.total} total`);

    if (stats.nextProperty) {
      console.log(`   Next property: ${stats.nextProperty.address} (cycle ${stats.nextProperty.currentCycleCount + 1})`);
    }

    // Get next property from rotation queue
    let queueItem = await getNextPropertyFromRotation();

    // If queue empty, reset cycle and try again
    if (!queueItem) {
      console.log('⚠️  All properties completed this cycle!');
      console.log('🔄 Resetting queue for fresh cycle...');

      const resetCount = await resetPropertyQueueCycle();

      if (resetCount > 0) {
        console.log(`✅ Queue reset - ${resetCount} properties ready for new cycle`);
        // Try again after reset
        queueItem = await getNextPropertyFromRotation();
      } else {
        console.log('⚠️  Queue is empty - run populate endpoint first');
        return NextResponse.json({
          success: true,
          message: 'Queue empty - populate via /api/property/populate-queue',
          generated: 0
        });
      }
    }

    if (!queueItem) {
      return NextResponse.json({
        success: true,
        message: 'No properties available after reset',
        generated: 0
      });
    }

    console.log(`\n🎥 Generating video for: ${queueItem.address}`);
    console.log(`   City: ${queueItem.city}, ${queueItem.state}`);
    console.log(`   Down payment: $${queueItem.downPayment.toLocaleString()}`);
    console.log(`   Times shown: ${queueItem.videoCount}`);
    console.log(`   Queue position: ${queueItem.position}`);

    const results = [];

    try {
      // Generate 15-second video using shared service (no HTTP fetch needed)
      const { generatePropertyVideo } = await import('@/lib/property-video-service');
      const result = await generatePropertyVideo(queueItem.propertyId, '15');

      if (result.success) {
        console.log(`✅ Video generation started for ${queueItem.address}`);

        // Mark property as completed for this cycle
        await markPropertyCompleted(queueItem.propertyId);

        results.push({
          propertyId: queueItem.propertyId,
          address: queueItem.address,
          variant: '15sec',
          success: true,
          workflowId: result.workflowId,
          timesShown: queueItem.videoCount + 1,
          cycleComplete: true
        });
      } else {
        const isValidationError = result.error === 'Property not eligible' || result.error === 'Invalid property data';
        const errorDetails = result.message || result.error;

        console.error(`❌ Failed: ${result.error}`);
        if (result.message) {
          console.error(`   Details: ${result.message}`);
        }

        // For validation errors, don't mark as completed - reset to queued for manual fix
        // For other errors (HeyGen API, etc.), mark as completed to avoid infinite retries
        if (!isValidationError) {
          await markPropertyCompleted(queueItem.propertyId);
        } else {
          console.warn(`⚠️  Property ${queueItem.propertyId} skipped due to validation errors`);
          console.warn(`   Property will be reset to queued - fix the data and try again`);

          // Reset back to queued status so it doesn't block the queue
          const { resetPropertyToQueued } = await import('@/lib/feed-store-firestore');
          await resetPropertyToQueued(queueItem.propertyId);
        }

        results.push({
          propertyId: queueItem.propertyId,
          address: queueItem.address,
          variant: '15sec',
          success: false,
          error: result.error,
          errorDetails: errorDetails,
          skipped: isValidationError // Flag validation errors as skipped
        });
      }

    } catch (error) {
      console.error(`❌ Error for ${queueItem.address}:`, error);

      // Still mark as completed (system errors shouldn't block queue)
      await markPropertyCompleted(queueItem.propertyId);

      results.push({
        propertyId: queueItem.propertyId,
        address: queueItem.address,
        variant: '15sec',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    const successCount = results.filter(r => r.success).length;

    // Get updated stats after processing
    const updatedStats = await getPropertyRotationStats();

    const skippedCount = results.filter((r: any) => r.skipped).length;

    console.log(`\n📊 Property video cron summary:`);
    console.log(`   Queue total: ${stats.total} properties`);
    console.log(`   Remaining this cycle: ${updatedStats.queued}`);
    console.log(`   Video generated: ${successCount > 0 ? 'Yes' : 'No'}`);
    if (skippedCount > 0) {
      console.log(`   ⚠️  Skipped due to validation: ${skippedCount} (fix property data)`);
    }
    console.log(`   Property status: ${successCount > 0 ? 'Completed' : skippedCount > 0 ? 'Skipped (in queue)' : 'Failed'}`);

    return NextResponse.json({
      success: successCount > 0,
      variant: '15sec',
      generated: successCount,
      skipped: skippedCount,
      property: results[0],
      queueStats: updatedStats,
      cycleProgress: {
        completed: stats.total - updatedStats.queued,
        remaining: updatedStats.queued,
        total: stats.total
      },
      message: successCount > 0
        ? `Video generated successfully`
        : skippedCount > 0
        ? `Property skipped due to validation errors: ${results[0].errorDetails || results[0].error}`
        : `Failed to generate video: ${results[0].error}`,
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

export async function POST(request: NextRequest) {
  return GET(request);
}
