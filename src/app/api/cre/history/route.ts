/**
 * CRE Analysis History API Endpoint
 *
 * GET /api/cre/history
 * Returns paginated list of previous analyses
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getAnalysisHistory } from '@/lib/cre/cre-analysis-service';

interface ExtendedSession {
  user?: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Auth check - admin only
    const session = await getServerSession(authOptions) as ExtendedSession | null;

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get history
    const { analyses, total } = await getAnalysisHistory(limit, offset);

    return NextResponse.json({
      success: true,
      data: analyses,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + analyses.length < total,
      },
    });

  } catch (error) {
    console.error('[CRE History API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
