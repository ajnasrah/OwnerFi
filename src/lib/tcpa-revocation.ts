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
import { normalizePhone, getAllPhoneFormats } from './phone-utils';

export type RevocationChannel =
  | 'sms-stop'        // user replied STOP to one of our SMS
  | 'email'           // REVOKE CONSENT email processed
  | 'admin'           // admin-initiated scrub
  | 'agent-relayed'   // agent reported the buyer asked them to stop
  | 'ghl-webhook'     // GHL buyer-optout webhook (funnel opt-out, not SMS STOP)
  | 'ccpa'            // /api/do-not-sell CCPA opt-out — CA law strongly implies consent withdrawal
  | 'unknown';

export interface RevocationResult {
  phone: string;
  buyerProfilesUpdated: number;
  channel: RevocationChannel;
  revokedAt: Date;
  caseId: string;
}

/** Random suffix to defuse caseId collisions when two scrubs happen in the same ms. */
function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Look up every buyerProfiles doc that matches any historical phone format for
 * `phone`. Legacy profiles were stored in 10-digit, 11-digit, formatted, and
 * E.164 — we have to check them all or we silently miss buyers and scrub
 * nothing. Dedupes by doc id.
 */
async function findBuyerProfilesByPhone(
  db: FirebaseFirestore.Firestore,
  phone: string,
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const formats = getAllPhoneFormats(phone);
  if (formats.length === 0) return [];

  // Firestore `in` supports up to 30 values — we have at most 4 formats.
  const snap = await db.collection('buyerProfiles').where('phone', 'in', formats).get();
  // Dedupe by id (a single buyer cannot appear twice with different ids per
  // format query when using `in`, but defensive belt for future format growth).
  const seen = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const d of snap.docs) seen.set(d.id, d);
  return Array.from(seen.values());
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
  metadata: {
    actor?: string;
    note?: string;
    inboundMessageSid?: string;
    inboundBody?: string;
    twilioNumber?: string;
  } = {},
): Promise<RevocationResult> {
  if (!phone) throw new Error('phone is required');
  const { db } = getFirebaseAdmin();
  if (!db) throw new Error('Firestore admin unavailable');

  const normalizedPhone = normalizePhone(phone);
  const revokedAt = new Date();
  const caseId = `tcpa_${normalizedPhone}_${revokedAt.getTime()}_${randomSuffix()}`;

  const profiles = await findBuyerProfilesByPhone(db, phone);

  const batch = db.batch();
  for (const doc of profiles) {
    batch.update(doc.ref, {
      smsNotifications: false,
      marketingOptOut: true,
      tcpaRevokedAt: revokedAt,
      tcpaRevokedVia: channel,
    });
  }

  // Audit record (separate collection — easy to query for compliance).
  const auditRef = db.collection('tcpa_revocations').doc(caseId);
  batch.set(auditRef, {
    caseId,
    phone: normalizedPhone,
    phoneFormatsChecked: getAllPhoneFormats(phone),
    channel,
    revokedAt,
    actor: metadata.actor || null,
    note: metadata.note || null,
    inboundMessageSid: metadata.inboundMessageSid || null,
    inboundBody: metadata.inboundBody ? metadata.inboundBody.slice(0, 500) : null,
    twilioNumber: metadata.twilioNumber || null,
    buyerProfilesUpdated: profiles.length,
    profileIds: profiles.map(d => d.id),
    retentionCategory: 'tcpa-compliance',
  });

  await batch.commit();

  // Propagate DND to GoHighLevel contacts. Best-effort — failures are
  // queued for later sync rather than blocking the local scrub.
  try {
    const { setGHLContactDND } = await import('./gohighlevel-api');
    const ghlResult = await setGHLContactDND(
      normalizedPhone,
      `TCPA revocation case ${caseId}`,
    );
    if (!ghlResult.success && ghlResult.queued) {
      // GHL not configured — write a pending doc so a future cron / operator
      // can drain the backlog when keys are added.
      await db.collection('tcpa_ghl_dnd_pending').doc(caseId).set({
        caseId,
        phone: normalizedPhone,
        channel,
        revokedAt,
        reason: ghlResult.error || 'GHL not configured',
        retryCount: 0,
        createdAt: new Date(),
      });
    } else if (!ghlResult.success) {
      // Real API failure — also queue for retry.
      await db.collection('tcpa_ghl_dnd_pending').doc(caseId).set({
        caseId,
        phone: normalizedPhone,
        channel,
        revokedAt,
        reason: ghlResult.error || 'GHL DND update failed',
        retryCount: 0,
        createdAt: new Date(),
      });
    } else {
      // Annotate the audit record with what GHL did.
      await auditRef.update({
        ghlDndContactsUpdated: ghlResult.contactsUpdated,
        ghlDndContactIds: ghlResult.contactIds,
      });
    }
  } catch (ghlError) {
    // Same fallback — never let GHL hiccup block the local scrub from
    // being considered successful.
    try {
      await db.collection('tcpa_ghl_dnd_pending').doc(caseId).set({
        caseId,
        phone: normalizedPhone,
        channel,
        revokedAt,
        reason: ghlError instanceof Error ? ghlError.message : String(ghlError),
        retryCount: 0,
        createdAt: new Date(),
      });
    } catch {
      // Last-resort path failed; the audit doc itself still records the
      // revocation, just without GHL annotation.
    }
  }

  // Notify downstream agents who already received this buyer's contact
  // (signed or pending referral agreements). Without this, the agent keeps
  // calling a STOP'd buyer → vicarious TCPA liability for the platform.
  // We do NOT auto-send SMS/email here — that would itself be a call to a
  // person who has potentially opted out of a platform channel. Instead, we
  // queue notification tasks that an operator or a downstream cron drains.
  try {
    const agents = await findAgentsToNotifyOnRevocation(phone);
    const notifyBatch = db.batch();
    for (const agent of agents) {
      // Flag the agreement with revocation metadata so the agent dashboard
      // + admin UI can surface a "buyer revoked" banner.
      const agreementRef = db.collection('referralAgreements').doc(agent.agreementId);
      notifyBatch.update(agreementRef, {
        buyerRevokedAt: revokedAt,
        buyerRevocationCaseId: caseId,
        buyerRevocationChannel: channel,
      });
      // Queue a notification task for the ops/drainer to send.
      const notifRef = db.collection('tcpa_agent_notifications_pending').doc(`${caseId}_${agent.agentId || agent.agreementId}`);
      notifyBatch.set(notifRef, {
        caseId,
        agreementId: agent.agreementId,
        agentId: agent.agentId || null,
        agentName: agent.agentName || null,
        agentEmail: agent.agentEmail || null,
        agentPhone: agent.agentPhone || null,
        channel,
        revokedAt,
        notificationSent: false,
        createdAt: new Date(),
        retentionCategory: 'tcpa-compliance',
      });
    }
    if (agents.length > 0) await notifyBatch.commit();
  } catch {
    // Do not let notification-queue failure undo the revocation itself.
  }

  return {
    phone: normalizedPhone,
    buyerProfilesUpdated: profiles.length,
    channel,
    revokedAt,
    caseId,
  };
}

/**
 * Look up the active referral agreements involving this buyer (by phone), so
 * the caller can notify each agent. Returns the agent IDs + contact info.
 *
 * Uses the actual schema field names from src/lib/firebase-models.ts:
 *   - referralAgreements.buyerId (NOT buyerProfileId)
 *   - referralAgreements.realtorName / realtorEmail / realtorPhone
 *   - status one of: 'pending' | 'signed' | 'expired' | 'voided' | 'completed'
 *     "active" (= agent currently has the buyer's contact and may still
 *     call/text) is the union of pending + signed.
 *
 * Does NOT void the agreements — that is a per-case decision (buyer may want
 * a mid-transaction agreement to continue).
 */
export async function findAgentsToNotifyOnRevocation(phone: string): Promise<Array<{
  agreementId: string;
  agentId: string;
  agentName?: string;
  agentEmail?: string;
  agentPhone?: string;
  status?: string;
}>> {
  if (!phone) return [];
  const { db } = getFirebaseAdmin();
  if (!db) return [];

  // A single phone may map to multiple buyerProfiles (legacy duplicates).
  // Each may have its own agreements. Iterate all profile ids.
  const profiles = await findBuyerProfilesByPhone(db, phone);
  if (profiles.length === 0) return [];
  const profileIds = profiles.map(d => d.id);

  const out = new Map<string, {
    agreementId: string;
    agentId: string;
    agentName?: string;
    agentEmail?: string;
    agentPhone?: string;
    status?: string;
  }>();

  for (const buyerProfileId of profileIds) {
    const snap = await db
      .collection('referralAgreements')
      .where('buyerId', '==', buyerProfileId)
      .where('status', 'in', ['pending', 'signed'])
      .get();

    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>;
      out.set(doc.id, {
        agreementId: doc.id,
        agentId: String(data.realtorId || data.agentId || ''),
        agentName: (data.realtorName as string) || (data.agentName as string) || undefined,
        agentEmail: (data.realtorEmail as string) || (data.agentEmail as string) || undefined,
        agentPhone: (data.realtorPhone as string) || (data.agentPhone as string) || undefined,
        status: (data.status as string) || undefined,
      });
    }
  }

  return Array.from(out.values());
}
