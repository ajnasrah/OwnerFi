// Admin endpoint to reset ALL feed lastFetched times to 0 (force immediate fetch)
import { NextRequest, NextResponse } from 'next/server';
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

    console.log('🔄 Resetting ALL feed lastFetched times to 0...');

    const adminDb = await getAdminDb();
    const feedsSnapshot = await adminDb.collection('feed_sources').get();

    console.log(`Found ${feedsSnapshot.size} feeds to reset`);

    const batch = adminDb.batch();
    let count = 0;

    feedsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { lastFetched: 0 });
      console.log(`  Resetting: ${doc.id}`);
      count++;
    });

    await batch.commit();

    console.log(`✅ Reset ${count} feeds - all will fetch on next cron run`);

    return NextResponse.json({
      success: true,
      feedsReset: count
    });

  } catch (error) {
    console.error('❌ Error resetting feed times:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
