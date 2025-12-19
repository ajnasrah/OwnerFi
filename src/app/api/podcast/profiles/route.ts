// Podcast Guest Profiles API
// Get all guest profiles and host profile

import { NextRequest, NextResponse } from 'next/server';
import { getPodcastConfig } from '@/lib/feed-store-firestore';

export async function GET(_request: NextRequest) {
  try {
    const config = await getPodcastConfig();

    if (!config) {
      return NextResponse.json({
        success: false,
        error: 'Podcast config not found. Run /api/podcast/profiles/init to initialize.'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profiles: config.profiles,
      host: config.host,
      video_settings: config.video_settings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching podcast profiles:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
