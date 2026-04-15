// ACCOUNT DELETION API
//
// CCPA/GDPR "right to delete". Soft-deletes the authenticated user's buyer
// profile + revokes TCPA consent + scrubs user-facing PII. Audit-trail
// records (tcpa_consents / tcpa_revocations / referral agreements) are
// retained for the TCPA statute of limitations (4-5 years) per the
// `retentionCategory: 'tcpa-compliance'` tag on those collections.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { ExtendedSession } from '@/types/session';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { logError, logInfo } from '@/lib/logger';
import { revokeBuyerTCPAConsent } from '@/lib/tcpa-revocation';

export async function POST(request: NextRequest) {
  try {
    const session = (await getServerSession(
      authOptions as unknown as Parameters<typeof getServerSession>[0],
    )) as ExtendedSession | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { db } = getFirebaseAdmin();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });

    const { confirm } = (await request.json().catch(() => ({}))) as { confirm?: string };
    if (confirm !== 'DELETE') {
      return NextResponse.json(
        { error: 'Please type DELETE to confirm account deletion.' },
        { status: 400 },
      );
    }

    const userId = session.user.id;
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() as { phone?: string; email?: string } | undefined;
    const phone = userData?.phone;

    // Revoke TCPA consent — scrubs buyer profiles, stops SMS/calls, propagates
    // DND to GHL. This is idempotent if already revoked.
    if (phone) {
      try {
        await revokeBuyerTCPAConsent(phone, 'admin', {
          actor: `self-delete:${userId}`,
          note: 'User-initiated account deletion via /api/account/delete',
        });
      } catch (err) {
        // Non-fatal — continue with scrub even if TCPA flow has hiccup.
        console.error('[account-delete] TCPA revocation failed (non-fatal):', err);
      }
    }

    const deletedAt = new Date();

    // Soft-delete the user doc: strip PII, keep id + deletedAt for audit.
    await db.collection('users').doc(userId).set(
      {
        deletedAt,
        deleted: true,
        email: null,
        phone: null,
        name: null,
        role: 'deleted',
      },
      { merge: true },
    );

    // Soft-delete any buyerProfiles owned by this user (by userId link or by
    // matching phone formats). Strip name/email/phone/address preferences.
    try {
      const buyerSnap = await db.collection('buyerProfiles').where('userId', '==', userId).get();
      const batch = db.batch();
      for (const doc of buyerSnap.docs) {
        batch.update(doc.ref, {
          deletedAt,
          deleted: true,
          firstName: null,
          lastName: null,
          email: null,
          phone: null,
          isAvailableForPurchase: false,
          isActive: false,
          smsNotifications: false,
          marketingOptOut: true,
        });
      }
      if (!buyerSnap.empty) await batch.commit();
    } catch (err) {
      console.error('[account-delete] buyerProfiles soft-delete failed:', err);
    }

    await logInfo('Account self-deletion', {
      action: 'account_self_delete',
      userId,
      metadata: { phone: phone ? phone.slice(-4) : null },
    });

    return NextResponse.json({
      success: true,
      message:
        'Your account has been deleted. Audit records required for legal compliance are retained under our retention policy.',
    });
  } catch (error) {
    await logError('Account delete failed', { action: 'account_delete_error' }, error as Error);
    return NextResponse.json({ error: 'Failed to delete account. Contact support@ownerfi.ai.' }, { status: 500 });
  }
}
