import { NextRequest, NextResponse } from 'next/server';
import { resetArticleProcessing, getStats } from '@/lib/feed-store';

export async function POST(request: NextRequest) {
  try {
    const resetCount = resetArticleProcessing();
    const stats = getStats();

    return NextResponse.json({
      success: true,
      message: `Reset ${resetCount} articles`,
      stats
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
