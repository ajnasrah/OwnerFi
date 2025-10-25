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
      sendPropertyToBackOfQueue,
      getPropertyRotationStats
    } = await import('@/lib/feed-store-firestore');

    // Get queue stats
    const stats = await getPropertyRotationStats();
    console.log(`📋 Rotation queue stats: ${stats.queued} queued, ${stats.processing} processing, ${stats.total} total`);

    if (stats.nextProperty) {
      console.log(`   Next property: ${stats.nextProperty.address} (shown ${stats.nextProperty.videoCount} times)`);
    }

    // Get next property from rotation queue
    const queueItem = await getNextPropertyFromRotation();

    if (!queueItem) {
      console.log('⚠️  Rotation queue is empty!');
      console.log('   Run: npx tsx scripts/populate-property-rotation-queue.ts');
      return NextResponse.json({
        success: true,
        message: 'Rotation queue is empty - populate queue first',
        generated: 0,
        queueStats: stats
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

        // Send property to back of queue (for next rotation)
        await sendPropertyToBackOfQueue(queueItem.propertyId);

        results.push({
          propertyId: queueItem.propertyId,
          address: queueItem.address,
          variant: '15sec',
          success: true,
          workflowId: result.workflowId,
          timesShown: queueItem.videoCount + 1
        });
      } else {
        console.error(`❌ Failed: ${result.error}`);

        // Still send to back of queue (don't block rotation)
        await sendPropertyToBackOfQueue(queueItem.propertyId);

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

      // Still send to back of queue
      await sendPropertyToBackOfQueue(queueItem.propertyId);

      results.push({
        propertyId: queueItem.propertyId,
        address: queueItem.address,
        variant: '15sec',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    const successCount = results.filter(r => r.success).length;

    console.log(`\n📊 Property video cron summary:`);
    console.log(`   Queue total: ${stats.total} properties`);
    console.log(`   Video generated: ${successCount > 0 ? 'Yes' : 'No'}`);
    console.log(`   Property re-queued at position: ${stats.total + 1}`);

    return NextResponse.json({
      success: true,
      variant: '15sec',
      generated: successCount,
      property: results[0],
      queueStats: stats,
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
