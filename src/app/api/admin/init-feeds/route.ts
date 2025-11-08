// Admin endpoint to initialize new feed sources in Firestore
import { NextRequest, NextResponse } from 'next/server';
import { OWNERFI_FEEDS, CARZ_FEEDS, VASSDISTRO_FEEDS } from '@/config/feed-sources';
import { getAdminDb } from '@/lib/firebase-admin';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Verify admin authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🚀 Initializing all feed sources...');

    const adminDb = await getAdminDb();
    const allFeeds = [...OWNERFI_FEEDS, ...CARZ_FEEDS, ...VASSDISTRO_FEEDS];

    let added = 0;
    let updated = 0;
    let existing = 0;

    for (const feed of allFeeds) {
      try {
        const feedRef = adminDb.collection('feed_sources').doc(feed.id);
        const feedSnap = await feedRef.get();

        if (feedSnap.exists()) {
          // Reset lastFetched to 0 so it fetches immediately
          await feedRef.update({
            ...feed,
            lastFetched: 0 // MUST be after spread to ensure it overrides
          });
          console.log(`🔄 ${feed.id} - updated and reset`);
          updated++;
        } else {
          await feedRef.set({
            ...feed,
            articlesProcessed: 0,
            lastFetched: 0,
            createdAt: Date.now()
          });
          console.log(`✅ ${feed.id} - added`);
          added++;
        }
      } catch (error) {
        console.error(`❌ ${feed.id} - error:`, error);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Added: ${added}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Total feeds: ${allFeeds.length}`);

    return NextResponse.json({
      success: true,
      added,
      updated,
      total: allFeeds.length
    });

  } catch (error) {
    console.error('❌ Error initializing feeds:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
