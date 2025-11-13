// Spanish Property Queue Stats API
// Returns stats about the Spanish property video queue

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    // Import rotation queue functions
    const { getPropertyRotationStats } = await import('@/lib/feed-store-firestore');

    // Get queue stats (shared queue for both English and Spanish)
    const stats = await getPropertyRotationStats();

    // Calculate rotation days (5 videos per day, total properties in queue)
    const rotationDays = stats.total > 0 ? Math.ceil(stats.total / 5) : 0;

    return NextResponse.json({
      success: true,
      stats: {
        total: stats.total,
        queued: stats.queued,
        processing: stats.processing,
        nextProperty: stats.nextProperty ? {
          address: stats.nextProperty.address,
          city: stats.nextProperty.city,
          state: stats.nextProperty.state,
          videoCount: stats.nextProperty.videoCount || 0
        } : null
      },
      rotationDays,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching Spanish property queue stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
