import { NextRequest, NextResponse } from 'next/server';
import { mockBuyers } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      buyers: mockBuyers,
      count: mockBuyers.length
    });

  } catch (error) {
    console.error('Failed to fetch mock buyers:', error);

    return NextResponse.json(
      { error: 'Failed to fetch buyers' },
      { status: 500 }
    );
  }
}