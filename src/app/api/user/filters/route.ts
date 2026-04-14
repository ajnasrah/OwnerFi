import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { getUserFilter, setUserFilter } from '@/lib/filter-store';
import { isFilterSearchable } from '@/lib/filter-schema';
import { logError } from '@/lib/logger';

/**
 * Self-service filter API — any authenticated user reads/writes their own.
 *
 * GET  /api/user/filters
 * PUT  /api/user/filters  body: { locations, zips }
 */

async function getSessionUser(): Promise<ExtendedSession | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = (await getServerSession(authOptions as any)) as ExtendedSession | null;
  if (!session?.user?.id) return null;
  return session;
}

export async function GET(_request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const filter = await getUserFilter(session.user.id);
    return NextResponse.json({
      userId: session.user.id,
      filter,
      searchable: isFilterSearchable(filter),
    });
  } catch (error) {
    await logError('GET /api/user/filters failed', {}, error as Error);
    return NextResponse.json({ error: 'Failed to read filter' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const saved = await setUserFilter(session.user.id, body, 'self');
    return NextResponse.json({
      userId: session.user.id,
      filter: saved,
      searchable: isFilterSearchable(saved),
    });
  } catch (error) {
    await logError('PUT /api/user/filters failed', {}, error as Error);
    return NextResponse.json({ error: 'Failed to save filter' }, { status: 500 });
  }
}
