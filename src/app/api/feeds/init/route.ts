// Initialize RSS feeds for all brands (run once)
import { NextResponse } from 'next/server';
import { VASSDISTRO_FEEDS } from '@/config/feed-sources';
import { addFeedSource } from '@/lib/feed-store-firestore';

export async function POST() {
  try {
    console.log('🚀 Initializing Vass Distro RSS feeds...');

    let count = 0;
    for (const feed of VASSDISTRO_FEEDS) {
      await addFeedSource(feed);
      count++;
      console.log(`✅ Added: ${feed.name}`);
    }

    console.log(`✅ Initialized ${count} Vass Distro feeds`);

    return NextResponse.json({
      success: true,
      message: `Initialized ${count} Vass Distro RSS feeds`,
      feeds: VASSDISTRO_FEEDS.map(f => f.name)
    });

  } catch (error) {
    console.error('❌ Feed initialization error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
