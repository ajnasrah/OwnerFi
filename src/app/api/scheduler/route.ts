// Scheduler Management API
// Start/stop/status endpoints for the automated video scheduler

import { NextRequest, NextResponse } from 'next/server';
import {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  updateSchedulerConfig
} from '@/lib/video-scheduler';
import { getStats } from '@/lib/feed-store';
import { initializeFeedSources } from '@/config/feed-sources';

// GET /api/scheduler - Get scheduler status
export async function GET() {
  try {
    const status = getSchedulerStatus();
    const carzStats = getStats('carz');
    const ownerfiStats = getStats('ownerfi');

    return NextResponse.json({
      success: true,
      scheduler: status,
      stats: {
        carz: carzStats,
        ownerfi: ownerfiStats
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/scheduler - Control scheduler (start/stop/config)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'start':
        await startScheduler(config);
        return NextResponse.json({
          success: true,
          message: 'Scheduler started',
          status: getSchedulerStatus()
        });

      case 'stop':
        stopScheduler();
        return NextResponse.json({
          success: true,
          message: 'Scheduler stopped',
          status: getSchedulerStatus()
        });

      case 'initialize':
        initializeFeedSources();
        return NextResponse.json({
          success: true,
          message: 'Feed sources initialized',
          stats: {
            carz: getStats('carz'),
            ownerfi: getStats('ownerfi')
          }
        });

      case 'update_config':
        if (!config) {
          return NextResponse.json(
            { success: false, error: 'Config required for update_config action' },
            { status: 400 }
          );
        }
        updateSchedulerConfig(config);
        return NextResponse.json({
          success: true,
          message: 'Configuration updated',
          status: getSchedulerStatus()
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in scheduler API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
