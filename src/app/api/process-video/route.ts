/**
 * Legacy Video Processing Endpoint - DEPRECATED
 *
 * This endpoint now delegates to the new worker endpoint for better reliability.
 * The worker endpoint (/api/workers/process-video) provides:
 * - Cloud Tasks integration with automatic retries
 * - Better error handling and observability
 * - Isolation from webhook execution
 *
 * This endpoint is kept for backward compatibility with:
 * - Existing cron jobs
 * - Manual triggers
 * - Fallback scenarios
 */

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  console.log('⚠️  DEPRECATED: /api/process-video called - delegating to worker endpoint');

  try {
    const body = await request.json();

    // Delegate to the new worker endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const response = await fetch(`${baseUrl}/api/workers/process-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cloud-Tasks-Worker': process.env.CLOUD_TASKS_SECRET || process.env.CRON_SECRET || 'fallback',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(result, { status: response.status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error delegating to worker:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
