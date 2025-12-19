// Admin endpoint to manually trigger article rating
// No auth required - for testing/manual triggering

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { rateAndCleanupArticles } from '@/lib/feed-store-firestore';

export const maxDuration = 300; // 5 minutes

export async function GET(_request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    console.log('🤖 Manual article rating triggered at', new Date().toISOString());

    // Rate and cleanup articles (keep top 10 per brand)
    const results = await rateAndCleanupArticles(10);

    const totalRated = results.carz.rated + results.ownerfi.rated;
    const totalKept = results.carz.kept + results.ownerfi.kept;
    const totalDeleted = results.carz.deleted + results.ownerfi.deleted;

    console.log(`✅ Rating complete: ${totalRated} rated, ${totalKept} kept, ${totalDeleted} deleted`);

    return NextResponse.json({
      success: true,
      totalRated,
      totalKept,
      totalDeleted,
      byBrand: results,
      message: `Rated ${totalRated} articles, kept top ${totalKept} (score >= 70)`
    });

  } catch (error) {
    console.error('❌ Article rating error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
