import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { getUserFilter, setUserFilter } from '@/lib/filter-store';
import { isFilterSearchable } from '@/lib/filter-schema';
import { logError } from '@/lib/logger';

/**
 * Admin API to read/write any user's FilterConfig.
 *
 * GET  /api/admin/users/:userId/filters
 * PUT  /api/admin/users/:userId/filters  body: { locations, zips }
 *
 * Guarded: session.user.role === 'admin'.
 */

async function getAdminSession(): Promise<ExtendedSession | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = (await getServerSession(authOptions as any)) as ExtendedSession | null;
  if (!session?.user || session.user.role !== 'admin') return null;
  return session;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    const filter = await getUserFilter(userId);
    return NextResponse.json({
      userId,
      filter,
      searchable: isFilterSearchable(filter),
    });
  } catch (error) {
    await logError('GET /api/admin/users/[userId]/filters failed', {}, error as Error);
    return NextResponse.json({ error: 'Failed to read filter' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const adminId = session.user.id || 'unknown';
    const saved = await setUserFilter(userId, body, `admin:${adminId}`);
    return NextResponse.json({
      userId,
      filter: saved,
      searchable: isFilterSearchable(saved),
    });
  } catch (error) {
    await logError('PUT /api/admin/users/[userId]/filters failed', {}, error as Error);
    return NextResponse.json({ error: 'Failed to save filter' }, { status: 500 });
  }
}
