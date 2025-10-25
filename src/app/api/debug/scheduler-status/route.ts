// Debug endpoint to check scheduler status
import { NextResponse } from 'next/server';
import { getAllFeedSources, getStats } from '@/lib/feed-store-firestore';

export async function GET() {
  try {
    const [feeds, statsCarz, statsOwnerfi, statsVassdistro] = await Promise.all([
      getAllFeedSources(),
      getStats('carz'),
      getStats('ownerfi'),
      getStats('vassdistro')
    ]);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      scheduler: {
        type: 'serverless-cron',
        status: 'Serverless (Vercel Cron)',
        message: 'Running via Vercel cron every 2 hours',
        config: {
          maxVideosPerDay: {
            carz: 5,
            ownerfi: 15,
            vassdistro: 1
          }
        }
      },
      feeds: {
        total: feeds.length,
        carz: feeds.filter(f => f.category === 'carz').length,
        ownerfi: feeds.filter(f => f.category === 'ownerfi').length,
        vassdistro: feeds.filter(f => f.category === 'vassdistro').length,
        list: feeds.map(f => ({ id: f.id, url: f.url, category: f.category, lastFetch: f.lastFetched }))
      },
      stats: {
        carz: statsCarz,
        ownerfi: statsOwnerfi,
        vassdistro: statsVassdistro
      }
    });
  } catch (error) {
    console.error('Error in scheduler-status:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
