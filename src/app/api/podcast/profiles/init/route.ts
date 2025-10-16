// Initialize Podcast Config in Firestore
// One-time migration from local JSON file to Firestore

import { NextRequest, NextResponse } from 'next/server';
import { initializePodcastConfigFromFile } from '@/lib/feed-store-firestore';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Initializing podcast config from file...');
    await initializePodcastConfigFromFile();

    return NextResponse.json({
      success: true,
      message: 'Podcast config initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error initializing podcast config:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
