import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { revokeBuyerTCPAConsent, findAgentsToNotifyOnRevocation } from '@/lib/tcpa-revocation';
import { logError } from '@/lib/logger';

/**
 * Admin one-click TCPA revocation for a specific buyer.
 *
 * POST /api/admin/users/[id]/revoke-tcpa
 *   Body: { note?: string }
 *   - id is the buyerProfiles doc ID
 *   - Flips smsNotifications/marketingOptOut/tcpaRevokedAt on the profile
 *   - Returns the list of Partner Agents who currently have this buyer's
 *     contact info, so the admin can notify them per the runbook
 *     (notification email itself is sent manually for now — we surface
 *     the list so the admin doesn't have to dig).
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = (await getServerSession(authOptions as any)) as ExtendedSession | null;
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Buyer id is required' }, { status: 400 });

    const { db } = getFirebaseAdmin();
    if (!db) {
      return NextResponse.json({ error: 'Firestore admin unavailable' }, { status: 500 });
    }

    const buyerSnap = await db.collection('buyerProfiles').doc(id).get();
    if (!buyerSnap.exists) {
      return NextResponse.json({ error: 'Buyer not found' }, { status: 404 });
    }
    const buyerData = buyerSnap.data() as Record<string, unknown>;
    const phone = (buyerData.phone as string) || '';
    if (!phone) {
      return NextResponse.json({ error: 'Buyer has no phone on file' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : undefined;

    const result = await revokeBuyerTCPAConsent(phone, 'admin', {
      actor: session.user.id || 'admin:unknown',
      note,
    });

    const agentsToNotify = await findAgentsToNotifyOnRevocation(phone);

    return NextResponse.json({
      success: true,
      result,
      agentsToNotify,
      runbook: 'docs/runbooks/tcpa-consent-revocation.md',
    });
  } catch (error) {
    await logError('POST /api/admin/buyers/[id]/revoke-tcpa failed', {}, error as Error);
    return NextResponse.json({ error: 'Failed to revoke TCPA consent' }, { status: 500 });
  }
}
