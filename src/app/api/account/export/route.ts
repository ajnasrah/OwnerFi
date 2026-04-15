// DATA EXPORT API
//
// CCPA/GDPR "right to a copy of personal information". Returns a JSON
// snapshot of all records the platform holds about the authenticated user:
//   - users row
//   - buyerProfile (if any)
//   - tcpa_consents (evidence of consent you gave)
//   - tcpa_revocations (any revocation records)
//   - referralAgreements (if realtor)
//
// Response is `application/json` with a Content-Disposition that triggers a
// download on the client.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { ExtendedSession } from '@/types/session';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { logError, logInfo } from '@/lib/logger';

function dateify(v: unknown): string | unknown {
  if (!v) return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof (v as { toDate?: unknown }).toDate === 'function') {
    try { return (v as { toDate: () => Date }).toDate().toISOString(); } catch { return v; }
  }
  return v;
}

function serialize(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = dateify(v);
  }
  return out;
}

export async function GET() {
  try {
    const session = (await getServerSession(
      authOptions as unknown as Parameters<typeof getServerSession>[0],
    )) as ExtendedSession | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { db } = getFirebaseAdmin();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });

    const userId = session.user.id;

    const userSnap = await db.collection('users').doc(userId).get();
    const user = userSnap.exists ? serialize(userSnap.data() || {}) : null;
    const userPhone = (user as { phone?: string } | null)?.phone;

    const buyerSnap = await db.collection('buyerProfiles').where('userId', '==', userId).get();
    const buyerProfiles = buyerSnap.docs.map(d => ({ id: d.id, ...serialize(d.data()) }));

    // TCPA records keyed by phone
    let tcpaConsents: Record<string, unknown>[] = [];
    let tcpaRevocations: Record<string, unknown>[] = [];
    if (userPhone) {
      const consentSnap = await db.collection('tcpa_consents').where('phone', '==', userPhone).get();
      tcpaConsents = consentSnap.docs.map(d => ({ id: d.id, ...serialize(d.data()) }));
      const revokeSnap = await db.collection('tcpa_revocations').where('phone', '==', userPhone).get();
      tcpaRevocations = revokeSnap.docs.map(d => ({ id: d.id, ...serialize(d.data()) }));
    }

    // Referral agreements (realtor-owned + buyer-linked)
    const agreementsAsRealtor = await db
      .collection('referralAgreements')
      .where('realtorUserId', '==', userId)
      .get();
    const buyerIds = buyerProfiles.map(p => p.id);
    let agreementsAsBuyer: Record<string, unknown>[] = [];
    if (buyerIds.length > 0) {
      // Firestore `in` supports up to 30 values; buyerIds list is typically 1-4.
      const snap = await db
        .collection('referralAgreements')
        .where('buyerId', 'in', buyerIds.slice(0, 30))
        .get();
      agreementsAsBuyer = snap.docs.map(d => ({ id: d.id, ...serialize(d.data()) }));
    }

    const payload = {
      exportGeneratedAt: new Date().toISOString(),
      userId,
      user,
      buyerProfiles,
      tcpaConsents,
      tcpaRevocations,
      referralAgreementsAsRealtor: agreementsAsRealtor.docs.map(d => ({ id: d.id, ...serialize(d.data()) })),
      referralAgreementsAsBuyer: agreementsAsBuyer,
    };

    await logInfo('Account data export requested', {
      action: 'account_data_export',
      userId,
    });

    const body = JSON.stringify(payload, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="ownerfi-data-export-${userId}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    await logError('Account export failed', { action: 'account_export_error' }, error as Error);
    return NextResponse.json({ error: 'Failed to export account data. Contact support@ownerfi.ai.' }, { status: 500 });
  }
}
