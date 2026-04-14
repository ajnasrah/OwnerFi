/**
 * TCPA consent revocation — buyer-side.
 *
 * Scrubs a phone number from outbound SMS / call eligibility on Ownerfi's side
 * and writes an audit record. Triggered by:
 *   - Twilio inbound STOP webhook (auto)
 *   - Admin "revoke TCPA" button (manual)
 *   - REVOKE CONSENT email handled by an operator
 *
 * Scope: Ownerfi-owned outbound only. Partner Agents who already received the
 * buyer's contact must be notified separately — see the Agent notification
 * step in /admin/buyers/[id] revoke flow.
 *
 * See docs/runbooks/tcpa-consent-revocation.md for the full operational
 * procedure this file implements.
 */

import { getFirebaseAdmin } from './scraper-v2/firebase-admin';
import { normalizePhone } from './phone-utils';

export type RevocationChannel =
  | 'sms-stop'        // user replied STOP to one of our SMS
  | 'email'           // REVOKE CONSENT email processed
  | 'admin'           // admin-initiated scrub
  | 'agent-relayed'   // agent reported the buyer asked them to stop
  | 'unknown';

export interface RevocationResult {
  phone: string;
  buyerProfilesUpdated: number;
  channel: RevocationChannel;
  revokedAt: Date;
  caseId: string;
}

/**
 * Mark all buyer profiles matching this phone as TCPA-revoked.
 * Idempotent — safe to call repeatedly. Does NOT notify Partner Agents
 * (the caller is responsible for that step, since it requires per-case
 * judgement about active transactions).
 */
export async function revokeBuyerTCPAConsent(
  phone: string,
  channel: RevocationChannel,
  metadata: { actor?: string; note?: string } = {},
): Promise<RevocationResult> {
  if (!phone) throw new Error('phone is required');
  const { db } = getFirebaseAdmin();
  if (!db) throw new Error('Firestore admin unavailable');

  const normalizedPhone = normalizePhone(phone);
  const revokedAt = new Date();
  const caseId = `tcpa_${normalizedPhone}_${revokedAt.getTime()}`;

  // Find every buyer profile with this phone (rare to have multiple, but
  // historical bugs sometimes left dupes — scrub them all).
  const profilesQuery = await db
    .collection('buyerProfiles')
    .where('phone', '==', normalizedPhone)
    .get();

  const batch = db.batch();
  for (const doc of profilesQuery.docs) {
    batch.update(doc.ref, {
      smsNotifications: false,
      marketingOptOut: true,
      tcpaRevokedAt: revokedAt,
      tcpaRevokedVia: channel,
      // Don't overwrite `notifiedPropertyIds`; leaving the dedupe set in
      // place prevents accidental re-notification if the buyer later
      // re-consents and we fail to clear stale state.
    });
  }

  // Audit record (separate collection — easy to query for compliance).
  const auditRef = db.collection('tcpa_revocations').doc(caseId);
  batch.set(auditRef, {
    caseId,
    phone: normalizedPhone,
    channel,
    revokedAt,
    actor: metadata.actor || null,
    note: metadata.note || null,
    buyerProfilesUpdated: profilesQuery.size,
  });

  await batch.commit();

  return {
    phone: normalizedPhone,
    buyerProfilesUpdated: profilesQuery.size,
    channel,
    revokedAt,
    caseId,
  };
}

/**
 * Look up the active referral agreements involving this buyer (by phone),
 * so the caller can notify each agent. Returns the agent IDs + emails.
 *
 * Does NOT void the agreements — that is a separate manual decision per
 * agreement (buyer may want a mid-transaction agreement to continue).
 */
export async function findAgentsToNotifyOnRevocation(phone: string): Promise<Array<{
  agreementId: string;
  agentId: string;
  agentName?: string;
  agentEmail?: string;
  status?: string;
}>> {
  if (!phone) return [];
  const { db } = getFirebaseAdmin();
  if (!db) return [];
  const normalizedPhone = normalizePhone(phone);

  // Look up the buyer profile to get the buyerProfileId/userId so we can
  // find related referral agreements.
  const profile = await db
    .collection('buyerProfiles')
    .where('phone', '==', normalizedPhone)
    .limit(1)
    .get();
  if (profile.empty) return [];
  const buyerProfileId = profile.docs[0].id;

  // Active referral agreements for this buyer.
  const agreementsSnap = await db
    .collection('referralAgreements')
    .where('buyerProfileId', '==', buyerProfileId)
    .get();

  const out: Array<{
    agreementId: string;
    agentId: string;
    agentName?: string;
    agentEmail?: string;
    status?: string;
  }> = [];

  for (const doc of agreementsSnap.docs) {
    const data = doc.data();
    const status = (data.status as string) || 'unknown';
    if (status === 'voided' || status === 'closed' || status === 'expired') continue;
    out.push({
      agreementId: doc.id,
      agentId: String(data.agentId || ''),
      agentName: data.agentName as string | undefined,
      agentEmail: data.agentEmail as string | undefined,
      status,
    });
  }

  return out;
}
