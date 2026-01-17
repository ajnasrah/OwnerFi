/**
 * CRE Analysis API Endpoint
 *
 * POST /api/cre/analyze
 * Analyzes a commercial real estate address
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
  analyzeCREAddress,
  getCachedAnalysis,
} from '@/lib/cre/cre-analysis-service';
import { AnalyzeRequest, AnalyzeResponse } from '@/lib/cre/cre-models';

interface ExtendedSession {
  user?: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeResponse>> {
  try {
    // Auth check - admin only
    const session = await getServerSession(authOptions) as ExtendedSession | null;

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin access required.', source: 'fresh' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json() as AnalyzeRequest;
    const { address, forceRefresh = false } = body;

    // Validate address
    if (!address || typeof address !== 'string' || address.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'Valid address is required (minimum 5 characters)', source: 'fresh' },
        { status: 400 }
      );
    }

    const trimmedAddress = address.trim();

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCachedAnalysis(trimmedAddress);
      if (cached) {
        console.log(`[CRE API] Returning cached analysis for: ${trimmedAddress}`);
        return NextResponse.json({
          success: true,
          data: cached,
          source: 'cache',
        });
      }
    }

    // Run fresh analysis
    console.log(`[CRE API] Running fresh analysis for: ${trimmedAddress}`);
    const analysis = await analyzeCREAddress(trimmedAddress, session.user.id || 'unknown');

    if (analysis.status === 'failed') {
      return NextResponse.json({
        success: false,
        error: analysis.errorMessage || 'Analysis failed',
        data: analysis,
        source: 'fresh',
      });
    }

    return NextResponse.json({
      success: true,
      data: analysis,
      source: 'fresh',
    });

  } catch (error) {
    console.error('[CRE API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        source: 'fresh',
      },
      { status: 500 }
    );
  }
}
