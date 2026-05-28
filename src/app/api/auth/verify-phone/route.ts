import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { unifiedDb } from '@/lib/unified-db';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';
import { checkRateLimit } from '@/lib/rate-limit-firestore';
import { requireAuth } from '@/lib/auth-helpers';
import { maskPhone } from '@/lib/log-redact';

// Dev / test bypass — accept code "123456" for these phones without
// hitting Twilio (matches /api/auth/mobile-token + /api/auth/verify-otp).
const TEST_PHONES = new Set(
  (process.env.TEST_PHONE_NUMBERS || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
);

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

/**
 * POST /api/auth/verify-phone
 *
 * Post-signup phone verification for users who registered via
 * email/password and never went through the phone-OTP signup flow.
 * Validates a Twilio Verify SMS code against the caller's `users/{uid}`
 * record and flips `phoneNumberVerified: true`, optionally setting
 * `phone` if it wasn't already populated.
 *
 * Auth: Firebase Bearer token (via `requireAuth` → mobile-auth-bridge)
 * OR a NextAuth cookie — same fallback chain every authenticated
 * endpoint uses since 2026-05-25.
 *
 * Body: `{ phone: string, code: string }` — phone in E.164 form, code
 * is the 6-digit string the user just typed in from SMS.
 *
 * Responses:
 *   - 200 `{ ok: true }`
 *   - 400 `{ error, code: 'invalid-number' | 'invalid-code' }`
 *   - 401 (no session) — handled by requireAuth
 *   - 409 `{ error, code: 'phone-already-linked' }` — phone belongs to
 *     a different uid
 *   - 422 `{ error, code: 'invalid-code' }` — Twilio rejected the code
 *   - 429 — rate-limited
 *   - 500 — unexpected error / Firebase Admin unavailable
 *
 * The `code` field on error bodies is the contract the mobile
 * `PhoneVerificationController._errorKey` switch reads off — keep it
 * in sync with that switch when adding new failure modes.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ('error' in auth) return auth.error;
  const { session } = auth;

  let body: { phone?: unknown; code?: unknown };
  try {
    body = (await request.json()) as { phone?: unknown; code?: unknown };
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'invalid-body' },
      { status: 400 }
    );
  }

  const phoneRaw = typeof body.phone === 'string' ? body.phone : '';
  const code = typeof body.code === 'string' ? body.code : '';

  if (!isValidPhone(phoneRaw)) {
    return NextResponse.json(
      { error: 'Invalid phone number', code: 'invalid-number' },
      { status: 400 }
    );
  }
  if (code.length !== 6) {
    return NextResponse.json(
      { error: 'Invalid verification code', code: 'invalid-code' },
      { status: 400 }
    );
  }

  const phone = normalizePhone(phoneRaw);

  // Key on userId — keying on phone would let an attacker who knows a
  // victim's phone lock out the legitimate owner by hammering this
  // endpoint with bad codes. Per-user is the right blast radius.
  const lim = await checkRateLimit({
    namespace: 'verify-phone',
    key: session.user.id,
    maxRequests: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!lim.allowed) {
    return NextResponse.json(
      {
        error: 'Too many attempts. Try again later.',
        code: 'rate-limited',
        retryAfter: lim.retryAfterSecs,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(lim.retryAfterSecs) },
      }
    );
  }

  // Collision check BEFORE Twilio — fails fast on a known conflict and
  // saves a Verify call. The check is "another active user owns this
  // phone"; the same user re-verifying their own already-stored phone
  // is fine (idempotent).
  const existing = await unifiedDb.users.findByPhone(phone);
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json(
      {
        error: 'This phone is already linked to another account.',
        code: 'phone-already-linked',
      },
      { status: 409 }
    );
  }

  const verified = await verifyTwilioCode(phone, code);
  if (!verified.ok) {
    return NextResponse.json(
      {
        error: verified.error ?? 'Invalid or expired code',
        code: 'invalid-code',
      },
      { status: 422 }
    );
  }

  const db = await getAdminDb();
  if (!db) {
    console.error('❌ [VERIFY-PHONE] Firebase Admin DB unavailable');
    return NextResponse.json(
      { error: 'Service temporarily unavailable', code: 'internal' },
      { status: 500 }
    );
  }

  try {
    await db.collection('users').doc(session.user.id).update({
      phone,
      phoneNumberVerified: true,
      updatedAt: new Date(),
    });
  } catch (err) {
    console.error('❌ [VERIFY-PHONE] Firestore update failed:', err);
    return NextResponse.json(
      { error: 'Could not update user', code: 'internal' },
      { status: 500 }
    );
  }

  console.log(
    `✅ [VERIFY-PHONE] User ${session.user.id} verified ${maskPhone(phone)}`
  );
  return NextResponse.json({ ok: true });
}

async function verifyTwilioCode(
  phone: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  if (TEST_PHONES.has(phone)) {
    return code === '123456'
      ? { ok: true }
      : { ok: false, error: 'Invalid code. Use 123456 for test numbers.' };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
  if (!sid || !token || !serviceSid) {
    console.error('❌ [VERIFY-PHONE] Twilio Verify not configured');
    return { ok: false, error: 'Verification service unavailable' };
  }

  try {
    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, Code: code }),
      }
    );
    const result = (await res.json()) as { status?: string };
    return res.ok && result.status === 'approved' ? { ok: true } : { ok: false };
  } catch (err) {
    console.error('❌ [VERIFY-PHONE] Twilio Verify check failed:', err);
    return { ok: false, error: 'Verification failed' };
  }
}
