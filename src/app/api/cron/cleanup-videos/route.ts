// Video Cleanup Cron Job
// Automatically deletes expired videos from R2 storage
// Runs daily at 3 AM via Vercel Cron

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  console.log('🧹 Starting video cleanup cron job...');

  try {
    // Verify Vercel Cron authentication
    const authHeader = request.headers.get('authorization');
    const CRON_SECRET = process.env.CRON_SECRET;

    // Check if request is from Vercel Cron (has x-vercel-cron header)
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';

    if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Import video storage utilities
    const { deleteExpiredVideos } = await import('@/lib/video-storage');

    // Delete expired videos
    console.log('🗑️  Deleting expired videos (older than 72 hours)...');
    const result = await deleteExpiredVideos();

    console.log(`✅ Cleanup completed!`);
    console.log(`   Deleted: ${result.deleted} videos`);
    console.log(`   Errors: ${result.errors} videos`);
    console.log(`   Freed: ${(result.totalSize / 1024 / 1024).toFixed(2)} MB`);

    // Send alert if cleanup failed for many videos
    if (result.errors > 5) {
      console.error(`⚠️  High error rate: ${result.errors} videos failed to delete`);

      // Import error monitoring
      const { alertSystemError } = await import('@/lib/error-monitoring');
      await alertSystemError(
        'Video Cleanup',
        `High error rate during video cleanup: ${result.errors} videos failed to delete`,
        { deleted: result.deleted, errors: result.errors }
      ).catch(err => {
        console.warn('Failed to send alert:', err.message);
      });
    }

    return NextResponse.json({
      success: true,
      deleted: result.deleted,
      errors: result.errors,
      bytesFreed: result.totalSize,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Video cleanup cron error:', error);

    // Send alert
    const { alertSystemError } = await import('@/lib/error-monitoring');
    await alertSystemError(
      'Video Cleanup Cron',
      error instanceof Error ? error.message : 'Unknown error during video cleanup',
      { error: String(error) }
    );

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
