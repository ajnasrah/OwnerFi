import { NextResponse } from 'next/server';
import { startScheduler } from '@/lib/video-scheduler';
import { initializeFeedSources } from '@/config/feed-sources';

// Auto-start scheduler on deployment
let schedulerStarted = false;

export async function GET() {
  try {
    if (!schedulerStarted) {
      console.log('🚀 Auto-starting scheduler on deployment...');

      // Initialize feeds
      initializeFeedSources();

      // Start scheduler
      await startScheduler({
        maxVideosPerDay: {
          carz: 5,
          ownerfi: 5
        },
        feedCheckInterval: 15,
        videoProcessInterval: 5,
        enabled: true
      });

      schedulerStarted = true;
      console.log('✅ Scheduler started successfully!');
    }

    return NextResponse.json({
      success: true,
      message: 'Scheduler is running',
      schedulerStarted: true
    });

  } catch (error) {
    console.error('❌ Error starting scheduler:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also allow POST
export async function POST() {
  return GET();
}
