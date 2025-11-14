// Sync Property Queue Cron (NEW SYSTEM)
// Ensures all active properties with images are in the rotation queue
// Adds new properties, removes deleted/inactive properties
// Runs every 6 hours

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;
export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 [SYNC-QUEUE] Starting property queue sync (NEW SYSTEM)...');

    const { syncPropertyQueue, getPropertyQueueStats } = await import('@/lib/property-workflow');

    // Get stats before sync
    const statsBefore = await getPropertyQueueStats();
    console.log(`📊 Queue before sync:`);
    console.log(`   Total: ${statsBefore.total}`);
    console.log(`   Queued: ${statsBefore.queued}`);
    console.log(`   Processing: ${statsBefore.processing}`);
    console.log(`   Completed: ${statsBefore.completed}`);

    // Run sync (adds new properties, removes deleted ones)
    const result = await syncPropertyQueue();

    // Get stats after sync
    const statsAfter = await getPropertyQueueStats();
    console.log(`\n📊 Queue after sync:`);
    console.log(`   Total: ${statsAfter.total}`);
    console.log(`   Queued: ${statsAfter.queued}`);
    console.log(`   Processing: ${statsAfter.processing}`);
    console.log(`   Completed: ${statsAfter.completed}`);

    console.log(`\n✅ [SYNC-QUEUE] Sync complete: +${result.added} new, -${result.removed} deleted`);

    if (statsAfter.nextProperty) {
      console.log(`\n🎬 Next property in queue:`);
      console.log(`   ${statsAfter.nextProperty.address}`);
      console.log(`   ${statsAfter.nextProperty.city}, ${statsAfter.nextProperty.state}`);
      console.log(`   Position: ${statsAfter.nextProperty.queuePosition}`);
    }

    return NextResponse.json({
      success: true,
      before: statsBefore,
      after: statsAfter,
      changes: {
        added: result.added,
        removed: result.removed,
        netChange: result.added - result.removed
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [SYNC-QUEUE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
