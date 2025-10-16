// API Route: Complete A/B Test
// POST /api/ab-tests/complete

import { NextRequest, NextResponse } from 'next/server';
import { completeTest } from '@/lib/ab-testing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testId } = body;

    if (!testId) {
      return NextResponse.json(
        { error: 'testId required' },
        { status: 400 }
      );
    }

    await completeTest(testId);

    return NextResponse.json({
      success: true,
      message: 'A/B test completed and winner determined'
    });

  } catch (error) {
    console.error('Error completing A/B test:', error);
    return NextResponse.json(
      {
        error: 'Failed to complete A/B test',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
