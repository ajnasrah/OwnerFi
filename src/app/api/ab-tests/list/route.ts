// API Route: List A/B Tests
// GET /api/ab-tests/list?brand=carz

import { NextRequest, NextResponse } from 'next/server';
import { getTestsForBrand } from '@/lib/ab-testing';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand') as 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza';

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand parameter required' },
        { status: 400 }
      );
    }

    const tests = await getTestsForBrand(brand);

    return NextResponse.json({
      success: true,
      tests,
      count: tests.length
    });

  } catch (error) {
    console.error('Error listing A/B tests:', error);
    return NextResponse.json(
      {
        error: 'Failed to list A/B tests',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
