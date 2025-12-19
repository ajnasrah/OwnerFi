/**
 * Populate Blog Queue API
 *
 * Manually populate the blog queue with topics for a brand
 */

import { NextRequest, NextResponse } from 'next/server';
import { Brand } from '@/config/constants';
import { populateBlogQueue } from '@/lib/blog-queue';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brand, count = 10, startDate, daysApart = 2 } = body as {
      brand: Brand;
      count?: number;
      startDate?: string; // ISO date string
      daysApart?: number;
    };

    if (!brand) {
      return NextResponse.json(
        { error: 'Missing required field: brand' },
        { status: 400 }
      );
    }

    const options: Record<string, unknown> = { daysApart };
    if (startDate) {
      options.startDate = new Date(startDate);
    }

    const queueItems = await populateBlogQueue(brand, count, options);

    return NextResponse.json({
      success: true,
      brand,
      count: queueItems.length,
      items: queueItems,
      message: `Added ${queueItems.length} topics to ${brand} blog queue`,
    });
  } catch (error) {
    console.error('Error populating blog queue:', error);
    return NextResponse.json(
      {
        error: 'Failed to populate blog queue',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
