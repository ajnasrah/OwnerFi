// Cron Job for Automated Viral Video Generation
// Runs 5 times per day: 9 AM, 11 AM, 2 PM, 6 PM, 8 PM

import { NextRequest, NextResponse } from 'next/server';
import { startScheduler, getSchedulerStatus } from '@/lib/video-scheduler';

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🕐 Cron job triggered - Starting viral video scheduler');

    // Check if scheduler is already running
    const status = getSchedulerStatus();

    if (!status.running) {
      // Start the scheduler
      await startScheduler();
      console.log('✅ Scheduler started by cron job');
    } else {
      console.log('✅ Scheduler already running');
    }

    return NextResponse.json({
      success: true,
      message: 'Viral video scheduler triggered',
      scheduler: getSchedulerStatus(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Cron job error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also support POST for Vercel/Railway cron
export async function POST(request: NextRequest) {
  return GET(request);
}
