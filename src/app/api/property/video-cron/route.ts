// Property Video Cron Job
// Automatically finds eligible properties and generates videos
// Runs 3x daily: 11 AM, 5 PM, 11 PM EST

import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';
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

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const results = [];

    try {
      // Generate 15-second video
      const response = await fetch(`${baseUrl}/api/property/generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          propertyId: queueItem.propertyId,
          variant: '15'
        })
      });

      const result = await response.json();

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
        console.error(`❌ Failed: ${result.error}`);

        // Still mark as completed (don't retry same property forever)
        await markPropertyCompleted(queueItem.propertyId);

        results.push({
          propertyId: queueItem.propertyId,
          address: queueItem.address,
          variant: '15sec',
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error(`❌ Error for ${queueItem.address}:`, error);

      // Still mark as completed
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

    console.log(`\n📊 Property video cron summary:`);
    console.log(`   Queue total: ${stats.total} properties`);
    console.log(`   Remaining this cycle: ${updatedStats.queued}`);
    console.log(`   Video generated: ${successCount > 0 ? 'Yes' : 'No'}`);
    console.log(`   Property status: Completed (will reset when cycle finishes)`);

    return NextResponse.json({
      success: true,
      variant: '15sec',
      generated: successCount,
      property: results[0],
      queueStats: updatedStats,
      cycleProgress: {
        completed: stats.total - updatedStats.queued,
        remaining: updatedStats.queued,
        total: stats.total
      },
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
