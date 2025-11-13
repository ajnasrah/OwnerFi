/**
 * Blog Queue Stats API
 *
 * Get queue statistics for all brands
 */

import { NextRequest, NextResponse } from 'next/server';
import { Brand } from '@/config/constants';
import { getBlogQueueStats } from '@/lib/blog-queue';

export async function GET(request: NextRequest) {
  try {
    const brands: Brand[] = ['ownerfi', 'carz', 'abdullah', 'vassdistro'];

    const stats: Record<string, any> = {};

    for (const brand of brands) {
      stats[brand] = await getBlogQueueStats(brand);
    }

    const totals = {
      total: Object.values(stats).reduce((sum: number, s: any) => sum + s.total, 0),
      pending: Object.values(stats).reduce((sum: number, s: any) => sum + s.pending, 0),
      generating: Object.values(stats).reduce((sum: number, s: any) => sum + s.generating, 0),
      generated: Object.values(stats).reduce((sum: number, s: any) => sum + s.generated, 0),
      scheduled: Object.values(stats).reduce((sum: number, s: any) => sum + s.scheduled, 0),
      posted: Object.values(stats).reduce((sum: number, s: any) => sum + s.posted, 0),
      failed: Object.values(stats).reduce((sum: number, s: any) => sum + s.failed, 0),
    };

    return NextResponse.json({
      success: true,
      byBrand: stats,
      totals,
    });
  } catch (error) {
    console.error('Error getting blog queue stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to get blog queue stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
