// API Route: Get A/B Test Results with Winner Calculation
// GET /api/ab-tests/results?testId=abtest_xxx

import { NextRequest, NextResponse } from 'next/server';
import { getTestResults, calculateWinner } from '@/lib/ab-testing';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testId = searchParams.get('testId');

    if (!testId) {
      return NextResponse.json(
        { error: 'testId parameter required' },
        { status: 400 }
      );
    }

    const results = await getTestResults(testId);
    const winnerAnalysis = await calculateWinner(testId);

    // Format for easier consumption
    const formattedVariants = Array.from(winnerAnalysis.variantStats.entries()).map(([variantId, stats]) => ({
      variantId,
      ...stats,
      isWinner: variantId === winnerAnalysis.winningVariant
    }));

    return NextResponse.json({
      success: true,
      testId,
      results,
      analysis: {
        winningVariant: winnerAnalysis.winningVariant,
        confidenceLevel: winnerAnalysis.confidenceLevel,
        variants: formattedVariants
      },
      summary: {
        totalSamples: results.length,
        totalViews: results.reduce((sum, r) => sum + r.totalViews, 0),
        totalEngagements: results.reduce((sum, r) => sum + r.totalEngagements, 0)
      }
    });

  } catch (error) {
    console.error('Error fetching A/B test results:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch A/B test results',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
