// Debug endpoint to check scheduler status
import { NextResponse } from 'next/server';
import { getSchedulerStatus } from '@/lib/video-scheduler';
import { getAllFeedSources, getPendingQueueItems, getStats } from '@/lib/feed-store';

export async function GET() {
  try {
    const schedulerStatus = getSchedulerStatus();
    const feeds = getAllFeedSources();
    const pendingCarz = getPendingQueueItems('carz', 50);
    const pendingOwnerfi = getPendingQueueItems('ownerfi', 50);
    const statsCarz = getStats('carz');
    const statsOwnerfi = getStats('ownerfi');

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      scheduler: schedulerStatus,
      feeds: {
        total: feeds.length,
        carz: feeds.filter(f => f.category === 'carz').length,
        ownerfi: feeds.filter(f => f.category === 'ownerfi').length,
        list: feeds.map(f => ({ id: f.id, url: f.url, category: f.category, lastFetch: f.lastFetch }))
      },
      queue: {
        carz: {
          pending: pendingCarz.length,
          items: pendingCarz.map(q => ({
            id: q.id.substring(0, 8),
            status: q.status,
            scheduledFor: q.scheduledFor ? new Date(q.scheduledFor).toLocaleString() : 'immediately',
            priority: q.priority
          }))
        },
        ownerfi: {
          pending: pendingOwnerfi.length,
          items: pendingOwnerfi.map(q => ({
            id: q.id.substring(0, 8),
            status: q.status,
            scheduledFor: q.scheduledFor ? new Date(q.scheduledFor).toLocaleString() : 'immediately',
            priority: q.priority
          }))
        }
      },
      stats: {
        carz: statsCarz,
        ownerfi: statsOwnerfi
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
