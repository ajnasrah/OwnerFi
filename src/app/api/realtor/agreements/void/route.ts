// VOID REFERRAL AGREEMENT API
//
// Lets a realtor void their own signed agreement — they no longer want to
// represent this buyer. Sets status='voided', releases the buyer back into
// the pool, records the void reason.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { FirebaseDB } from '@/lib/firebase-db';
import { Timestamp } from 'firebase/firestore';
import { logError, logInfo } from '@/lib/logger';
import { COLLECTIONS } from '@/lib/firebase-models';

interface VoidRequest {
  agreementId: string;
  reason?: string;
}

export async function POST(request: NextRequest) {
  try {
    let session;
    try {
      session = await getSessionWithRole('realtor');
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : 'Not authenticated';
      return NextResponse.json({ error: message }, { status: 401 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { agreementId, reason } = (await request.json()) as VoidRequest;

    if (!agreementId) {
      return NextResponse.json({ error: 'Agreement ID is required' }, { status: 400 });
    }

    const agreementData = await FirebaseDB.getDocument(COLLECTIONS.REFERRAL_AGREEMENTS, agreementId);
    if (!agreementData) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
    }

    const agreement = agreementData as {
      realtorUserId: string;
      buyerId: string;
      status: string;
    };

    if (agreement.realtorUserId !== session.user.id) {
      return NextResponse.json({ error: 'You do not have permission to void this agreement' }, { status: 403 });
    }

    if (agreement.status === 'voided' || agreement.status === 'expired' || agreement.status === 'completed') {
      return NextResponse.json({ error: `This agreement is already ${agreement.status}` }, { status: 400 });
    }

    const now = Timestamp.now();
    const cleanReason = (reason || '').slice(0, 500);

    await FirebaseDB.updateDocument(COLLECTIONS.REFERRAL_AGREEMENTS, agreementId, {
      status: 'voided',
      voidedAt: now,
      voidedBy: session.user.id,
      voidReason: cleanReason,
      updatedAt: now,
    });

    // Reconcile linked leadPurchases so admin dashboards stop counting this
    // as an active purchase. There should typically be at most one purchase
    // record per (realtor, buyer) from /sign creation.
    try {
      const purchases = await FirebaseDB.queryDocuments(
        'leadPurchases',
        [
          { field: 'realtorUserId', operator: '==', value: session.user.id },
          { field: 'buyerId', operator: '==', value: agreement.buyerId },
        ],
      );
      // Flip any status other than already-terminal ('voided'/'refunded') →
      // 'voided'. Covers the full leadPurchases enum: 'purchased',
      // 'contacted', 'converted'. Otherwise admin dashboards kept showing
      // voided agreements as active purchases.
      const TERMINAL_STATUSES = new Set(['voided', 'refunded']);
      for (const p of purchases) {
        const purchase = p as { id: string; status?: string };
        if (!TERMINAL_STATUSES.has(purchase.status || '')) {
          await FirebaseDB.updateDocument('leadPurchases', purchase.id, {
            status: 'voided',
            voidedAt: now,
            voidReason: cleanReason,
            priorStatus: purchase.status || null,
          });
        }
      }
    } catch (err) {
      // Non-fatal — the agreement is still voided even if reconcile fails.
      console.error('[void-agreement] leadPurchases reconcile failed:', err);
    }

    // Release the buyer back to the available pool so another realtor can
    // claim them. Guard against resurrecting a soft-deleted buyer. Do NOT
    // clear opt-out / revocation flags — if the buyer opted out through
    // ANY channel (Twilio STOP, GHL webhook, /api/do-not-sell, admin
    // revoke), they must stay out of the pool independently of whether
    // this particular agreement voids. Checks both tcpaRevokedAt and
    // optedOutAt since not every opt-out path sets both.
    const buyerDoc = await FirebaseDB.getDocument('buyerProfiles', agreement.buyerId);
    const buyer = buyerDoc as {
      deleted?: boolean;
      tcpaRevokedAt?: unknown;
      optedOutAt?: unknown;
      isActive?: boolean;
    } | null;
    const optedOut = !!(buyer?.tcpaRevokedAt || buyer?.optedOutAt) || buyer?.isActive === false;
    if (buyer && buyer.deleted !== true && !optedOut) {
      await FirebaseDB.updateDocument('buyerProfiles', agreement.buyerId, {
        isAvailableForPurchase: true,
        purchasedBy: null,
        purchasedAt: null,
        reservedBy: null,
        reservedAt: null,
        reservedAgreementId: null,
        updatedAt: now,
      });
    } else if (optedOut) {
      console.log(`[void-agreement] not resurrecting ${agreement.buyerId} — buyer is opted out (tcpa=${!!buyer?.tcpaRevokedAt}, optedOutAt=${!!buyer?.optedOutAt}, isActive=${buyer?.isActive})`);
    }

    await logInfo('Referral agreement voided', {
      action: 'agreement_voided',
      userId: session.user.id,
      metadata: { agreementId, buyerId: agreement.buyerId, reason: cleanReason },
    });

    return NextResponse.json({ success: true, agreementId, status: 'voided' });
  } catch (error) {
    await logError('Void agreement failed', { action: 'void_agreement_error' }, error as Error);
    return NextResponse.json({ error: 'Failed to void agreement. Please try again.' }, { status: 500 });
  }
}
