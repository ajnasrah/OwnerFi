/**
 * Admin API: Trigger Cron Jobs Securely
 *
 * Server-side proxy that authenticates admin session and forwards
 * requests to cron endpoints with the real CRON_SECRET.
 * This prevents exposing CRON_SECRET to the browser.
 *
 * POST /api/admin/trigger-cron
 * Body: { "cronPath": "/api/cron/gaza?force=true" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

const CRON_SECRET = process.env.CRON_SECRET;

// Allowlist of cron paths that admins can trigger
const ALLOWED_CRON_PATHS = [
  '/api/cron/gaza',
  '/api/cron/generate-videos',
  '/api/cron/abdullah',
  '/api/benefit/cron',
  '/api/cron/fetch-rss',
  '/api/cron/rate-articles',
  '/api/cron/refill-articles',
  '/api/cron/check-stuck-workflows',
  '/api/cron/daily-maintenance',
];

export async function POST(request: NextRequest) {
  // Admin auth check
  const session = await getServerSession(authOptions as unknown as Parameters<typeof getServerSession>[0]);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  try {
    const { cronPath } = await request.json();

    if (!cronPath || typeof cronPath !== 'string') {
      return NextResponse.json({ error: 'cronPath is required' }, { status: 400 });
    }

    // Validate against allowlist (strip query params for check)
    const pathWithoutQuery = cronPath.split('?')[0];
    if (!ALLOWED_CRON_PATHS.includes(pathWithoutQuery)) {
      return NextResponse.json({ error: 'Cron path not allowed' }, { status: 403 });
    }

    // Build full URL and proxy the request with real CRON_SECRET
    const baseUrl = request.nextUrl.origin;
    const response = await fetch(`${baseUrl}${cronPath}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[TRIGGER-CRON] Error:', error);
    return NextResponse.json({ error: 'Failed to trigger cron' }, { status: 500 });
  }
}
