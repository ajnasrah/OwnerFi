import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { listSavedSearches, createSavedSearch } from '@/lib/saved-searches-store';
import { logError } from '@/lib/logger';

/**
 * GET  /api/user/saved-searches       list mine
 * POST /api/user/saved-searches       create { name, filter }
 */

async function requireUser(): Promise<ExtendedSession | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = (await getServerSession(authOptions as any)) as ExtendedSession | null;
  if (!session?.user?.id) return null;
  return session;
}

export async function GET(_request: NextRequest) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  try {
    const searches = await listSavedSearches(session.user.id);
    return NextResponse.json({ searches });
  } catch (error) {
    await logError('GET /api/user/saved-searches failed', {}, error as Error);
    return NextResponse.json({ error: 'Failed to list saved searches' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const saved = await createSavedSearch(session.user.id, { name: body.name, filter: body.filter });
    return NextResponse.json({ search: saved }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save search';
    // User-visible validation errors vs server errors
    if (/required|limit|empty/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    await logError('POST /api/user/saved-searches failed', {}, error as Error);
    return NextResponse.json({ error: 'Failed to save search' }, { status: 500 });
  }
}
