// Check article database stats - all brands

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    const brands = [
      { name: 'ownerfi', collection: 'ownerfi_articles' },
      { name: 'carz', collection: 'carz_articles' },
      { name: 'vassdistro', collection: 'vassdistro_articles' }
    ];

    const stats: any = {};

    for (const brand of brands) {
      const articlesRef = collection(db, brand.collection);

      // Total
      const allSnapshot = await getDocs(articlesRef);

      // Unprocessed
      const unprocessedQuery = query(articlesRef, where('processed', '==', false));
      const unprocessedSnapshot = await getDocs(unprocessedQuery);

      // Get quality stats
      const allArticles = allSnapshot.docs.map(d => d.data());
      const rated = allArticles.filter(a => typeof a.qualityScore === 'number');
      const highQuality = rated.filter(a => a.qualityScore >= 70);
      const availableForVideos = allArticles.filter(a =>
        !a.processed && typeof a.qualityScore === 'number' && a.qualityScore >= 70
      );

      const contentLengths = allArticles.map(a => (a.content || '').length);
      const avgContent = contentLengths.length > 0
        ? Math.round(contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length)
        : 0;

      stats[brand.name] = {
        total: allSnapshot.size,
        unprocessed: unprocessedSnapshot.size,
        processed: allSnapshot.size - unprocessedSnapshot.size,
        rated: rated.length,
        highQuality: highQuality.length,
        availableForVideos: availableForVideos.length,
        avgContentLength: avgContent,
        samples: availableForVideos.slice(0, 3).map(a => ({
          title: a.title,
          score: a.qualityScore,
          contentLength: (a.content || '').length
        }))
      };
    }

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
