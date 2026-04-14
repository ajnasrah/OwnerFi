import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import {
  getSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
} from '@/lib/saved-searches-store';
import { logError } from '@/lib/logger';

/**
 * GET    /api/user/saved-searches/:id    read one (must own it)
 * PUT    /api/user/saved-searches/:id    rename or replace { name?, filter? }
 * DELETE /api/user/saved-searches/:id    delete
 */

async function requireUser(): Promise<ExtendedSession | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = (await getServerSession(authOptions as any)) as ExtendedSession | null;
  if (!session?.user?.id) return null;
  return session;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  try {
    const { id } = await params;
    const search = await getSavedSearch(session.user.id, id);
    if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ search });
  } catch (error) {
    await logError('GET /api/user/saved-searches/[id] failed', {}, error as Error);
    return NextResponse.json({ error: 'Failed to read saved search' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const updated = await updateSavedSearch(session.user.id, id, {
      name: body.name,
      filter: body.filter,
    });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ search: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update';
    if (/required|empty/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    await logError('PUT /api/user/saved-searches/[id] failed', {}, error as Error);
    return NextResponse.json({ error: 'Failed to update saved search' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  try {
    const { id } = await params;
    const ok = await deleteSavedSearch(session.user.id, id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    await logError('DELETE /api/user/saved-searches/[id] failed', {}, error as Error);
    return NextResponse.json({ error: 'Failed to delete saved search' }, { status: 500 });
  }
}
