/**
 * TCPA consent capture.
 *
 * Counterpart to tcpa-revocation.ts — at the point of phone-number
 * collection (signup), we MUST persist evidence that the user saw the
 * consent text and affirmatively agreed. Without this, defending a TCPA
 * suit means saying "trust us, the form had a disclosure" — courts do
 * not accept that. See Van Patten v. Vertical Fitness, FCC 2012 order.
 *
 * Each consent record stores:
 *   - userId / buyerProfileId for join-back
 *   - phone (E.164)
 *   - consentedAt timestamp
 *   - ipAddress + userAgent (request-time fingerprint)
 *   - consentTextVersion + consentTextHash + consentTextFull
 *   - source page URL (where the consent was given)
 *   - channel (phone-otp | email-signup)
 *
 * Versioning: bump CONSENT_TEXT_VERSION whenever the displayed text
 * changes. The hash is computed at runtime from the literal text we
 * stored, so even if the constant drifts, the hash on disk is the
 * source of truth for what was shown to that user.
 */

import { createHash } from 'crypto';
import { getFirebaseAdmin } from './scraper-v2/firebase-admin';
import { normalizePhone } from './phone-utils';

export const CONSENT_TEXT_VERSION = '2026-04-14-v1';

/**
 * The literal text shown on /auth phone-entry. Keep this in sync with the
 * UI copy. When you change the UI, bump CONSENT_TEXT_VERSION and update
 * this constant.
 */
export const PHONE_CONSENT_TEXT_AUTH = `By entering your phone number and tapping Send Verification Code, you give express written consent to receive calls and SMS messages from Ownerfi and from licensed real estate agents we share your information with, including calls/SMS that use auto-dialing systems or pre-recorded messages, at the number you provided, even if it is on a federal or state Do-Not-Call list. Consent is not a condition of any purchase. Message and data rates may apply. Reply STOP to opt out of SMS at any time.`;

/**
 * The literal text in the /auth/setup terms checkbox.
 */
export const PHONE_CONSENT_TEXT_SETUP = `I confirm I am at least 18 years of age and a US resident, and I agree to the Terms and Conditions and Privacy Policy. I understand my contact information will be shared with independent licensed real estate agents who are not employees of Ownerfi, and that Ownerfi receives a referral fee from those agents. I give express written consent to receive calls and text messages from Ownerfi and these agents — including calls and SMS placed using auto-dialing systems or pre-recorded / artificial voice messages — at the number I provided, even if my number is on a federal or state Do-Not-Call list. Consent is not a condition of any purchase. Message and data rates may apply. Reply STOP to any text to opt out.`;

export type ConsentChannel = 'phone-otp' | 'signup-form' | 'profile-update';

export interface RecordConsentInput {
  phone: string;
  consentText: string;
  channel: ConsentChannel;
  userId?: string;
  buyerProfileId?: string;
  pageUrl?: string;
  /** Headers from the request — we extract IP + UA. */
  headers?: Headers | Record<string, string | undefined> | null;
  /** Whether a checkbox was the affirmative act (vs. button-click only). */
  checkboxChecked?: boolean;
  /** Optional: caller-provided metadata stored verbatim. */
  extra?: Record<string, unknown>;
}

function hashText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function readHeader(
  headers: Headers | Record<string, string | undefined> | null | undefined,
  key: string,
): string | null {
  if (!headers) return null;
  if (headers instanceof Headers) {
    const v = headers.get(key);
    return v ?? null;
  }
  // Record case — case-insensitive lookup
  const target = key.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === target) return headers[k] ?? null;
  }
  return null;
}

/**
 * Persist a TCPA consent record. Best-effort — failures throw to caller so
 * the signup flow can decide whether to fail-closed (recommended) or
 * fail-open (acceptable for defensive logging).
 *
 * Doc id format: tcpa_consent_{normalizedPhone}_{timestamp}_{random}
 */
export async function recordTCPAConsent(input: RecordConsentInput): Promise<{
  id: string;
  hash: string;
  storedAt: Date;
}> {
  if (!input.phone) throw new Error('phone is required');
  if (!input.consentText) throw new Error('consentText is required');

  const { db } = getFirebaseAdmin();
  if (!db) throw new Error('Firestore admin unavailable');

  const normalizedPhone = normalizePhone(input.phone);
  const storedAt = new Date();
  const hash = hashText(input.consentText);

  const random = Math.random().toString(36).slice(2, 8);
  const id = `tcpa_consent_${normalizedPhone}_${storedAt.getTime()}_${random}`;

  const ipAddress =
    readHeader(input.headers, 'x-forwarded-for')?.split(',')[0]?.trim() ||
    readHeader(input.headers, 'x-real-ip') ||
    null;
  const userAgent = readHeader(input.headers, 'user-agent');

  await db.collection('tcpa_consents').doc(id).set({
    id,
    phone: normalizedPhone,
    consentedAt: storedAt,
    ipAddress,
    userAgent,
    consentTextVersion: CONSENT_TEXT_VERSION,
    consentTextHash: hash,
    consentTextFull: input.consentText,
    channel: input.channel,
    userId: input.userId || null,
    buyerProfileId: input.buyerProfileId || null,
    pageUrl: input.pageUrl || null,
    checkboxChecked: input.checkboxChecked ?? null,
    extra: input.extra || null,
    retentionCategory: 'tcpa-compliance',
  });

  return { id, hash, storedAt };
}

/**
 * Look up the most recent consent record for a phone. Used when defending
 * a complaint or showing in the admin UI.
 */
export async function getMostRecentConsentForPhone(phone: string): Promise<Record<string, unknown> | null> {
  if (!phone) return null;
  const { db } = getFirebaseAdmin();
  if (!db) return null;
  const normalizedPhone = normalizePhone(phone);
  const snap = await db
    .collection('tcpa_consents')
    .where('phone', '==', normalizedPhone)
    .orderBy('consentedAt', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data() as Record<string, unknown>;
}
