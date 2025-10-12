// API Endpoint: Cleanup expired videos from Firebase Storage
// This should be called daily by a cron job (Railway Cron or external service)

import { NextRequest, NextResponse } from 'next/server';
import { deleteExpiredVideos } from '@/lib/video-storage';

export const maxDuration = 300; // 5 minutes max execution time

export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication check
    const authHeader = request.headers.get('Authorization');
    const adminSecret = process.env.ADMIN_SECRET_KEY;

    if (adminSecret && authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🗑️  Starting video cleanup job...');

    const result = await deleteExpiredVideos();

    return NextResponse.json({
      success: true,
      message: 'Video cleanup completed',
      ...result
    });

  } catch (error) {
    console.error('❌ Video cleanup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
