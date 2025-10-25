// Initialize RSS feeds for all brands (run once)
import { NextRequest, NextResponse } from 'next/server';
import { VASSDISTRO_FEEDS } from '@/config/feed-sources';
import { addFeedSource } from '@/lib/feed-store-firestore';

export async function POST(request: NextRequest) {
  try {
    // Simple secret check
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret';

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🚀 Initializing Vass Distro RSS feeds...');

    let count = 0;
    const errors: string[] = [];

    for (const feed of VASSDISTRO_FEEDS) {
      try {
        await addFeedSource(feed);
        count++;
        console.log(`✅ Added: ${feed.name}`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${feed.name}: ${errMsg}`);
        console.error(`❌ Failed to add ${feed.name}:`, errMsg);
      }
    }

    console.log(`✅ Initialized ${count} Vass Distro feeds`);

    return NextResponse.json({
      success: true,
      message: `Initialized ${count} Vass Distro RSS feeds`,
      feeds: VASSDISTRO_FEEDS.map(f => f.name),
      errors: errors.length > 0 ? errors : undefined
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
