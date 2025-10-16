// API Route: Create A/B Test
// POST /api/ab-tests/create

import { NextRequest, NextResponse } from 'next/server';
import {
  createABTest,
  createHookTest,
  createCaptionTest,
  createPostingTimeTest,
  type ABTest,
  type TestVariationType
} from '@/lib/ab-testing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      preset, // 'hook', 'caption', 'posting_time', or 'custom'
      brand,
      customTest
    } = body;

    let testId: string;

    // Create preset tests or custom test
    if (preset === 'hook') {
      testId = await createHookTest(brand);
    } else if (preset === 'caption') {
      testId = await createCaptionTest(brand);
    } else if (preset === 'posting_time') {
      testId = await createPostingTimeTest(brand);
    } else if (preset === 'custom' && customTest) {
      testId = await createABTest(customTest);
    } else {
      return NextResponse.json(
        { error: 'Invalid preset or missing customTest' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      testId,
      message: `A/B test created successfully`
    });

  } catch (error) {
    console.error('Error creating A/B test:', error);
    return NextResponse.json(
      {
        error: 'Failed to create A/B test',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
