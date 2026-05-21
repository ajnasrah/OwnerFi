import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { unifiedDb } from '@/lib/unified-db';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';
import { checkRateLimit } from '@/lib/rate-limit-firestore';
import { maskPhone } from '@/lib/log-redact';

// Same admin-phone override the NextAuth credentials provider applies
// (src/lib/auth.ts) — phones in this env var always resolve to role
// 'admin' regardless of the stored role. Normalized to E.164 once at
// module load so the per-request lookup is a Set check.
const ADMIN_PHONES = new Set(
  (process.env.ADMIN_PHONE_NUMBERS || '')
    .split(',')
    .filter(Boolean)
    .map((p) => {
      try {
        return normalizePhone(p.trim());
      } catch {
        return null;
      }
    })
    .filter((p): p is string => p !== null)
);

// Dev / test bypass — accept code "123456" for these phones without
// hitting Twilio (matches /api/auth/verify-otp).
const TEST_PHONES = new Set(
  (process.env.TEST_PHONE_NUMBERS || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
);

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

type MobileTokenUser = {
  id: string;
  role: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  isInvestor: boolean;
};

/**
 * POST /api/auth/mobile-token
 *
 * Bridges existing NextAuth+bcrypt users (Firestore `users` collection)
 * into Firebase Auth sessions for the mobile app. Accepts either:
 *
 *   - { phone, code }    — post-Twilio-OTP verification; the code is
 *                          re-verified here to prevent replay.
 *   - { email, password } — bcrypt-compared against `users/{uid}.password`.
 *
 * On success mints a Firebase custom token via Admin SDK with the
 * user's role baked into custom claims, so the mobile app's Firestore
 * reads succeed under `firestore.rules` (which key off
 * `request.auth.token.role`).
 *
 * Returns `{ customToken, user: { id, role, phone, email, name, isInvestor } }`
 * — mobile calls `FirebaseAuth.instance.signInWithCustomToken(customToken)`
 * to establish the session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      phone?: string;
      code?: string;
      email?: string;
      password?: string;
    };
    const { phone, code, email, password } = body;

    const hasPhone = Boolean(phone && code);
    const hasEmail = Boolean(email && password);

    if (!hasPhone && !hasEmail) {
      return NextResponse.json(
        { error: 'Provide either { phone, code } or { email, password }' },
        { status: 400 }
      );
    }
    if (hasPhone && hasEmail) {
      return NextResponse.json(
        { error: 'Provide only one credential set, not both' },
        { status: 400 }
      );
    }

    if (hasPhone) {
      return handlePhoneAuth(phone as string, code as string);
    }
    return handleEmailAuth(email as string, password as string);
  } catch (err) {
    console.error('❌ [MOBILE-TOKEN] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePhoneAuth(
  phoneRaw: string,
  code: string
): Promise<NextResponse> {
  if (!isValidPhone(phoneRaw)) {
    return NextResponse.json(
      { error: 'Invalid phone number' },
      { status: 400 }
    );
  }
  if (code.length !== 6) {
    return NextResponse.json(
      { error: 'Invalid verification code' },
      { status: 400 }
    );
  }

  const phone = normalizePhone(phoneRaw);

  const lim = await checkRateLimit({
    namespace: 'mobile-token-phone',
    key: phone,
    maxRequests: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!lim.allowed) {
    return tooManyAttempts(lim.retryAfterSecs);
  }

  const verified = await verifyTwilioCode(phone, code);
  if (!verified.ok) {
    return NextResponse.json(
      { error: verified.error ?? 'Invalid or expired code' },
      { status: 401 }
    );
  }

  const user = await unifiedDb.users.findByPhone(phone);
  if (!user || isAccountDeleted(user)) {
    return NextResponse.json(
      { error: 'No account found for this phone number' },
      { status: 401 }
    );
  }

  const role = ADMIN_PHONES.has(phone) ? 'admin' : user.role;
  const customToken = await mintCustomToken({
    id: user.id,
    role,
    phone: user.phone,
    isInvestor: Boolean((user as { isInvestor?: boolean }).isInvestor),
  });
  if (!customToken) {
    return tokenMintFailed();
  }

  void touchLastSignIn(user.id);
  console.log(
    `✅ [MOBILE-TOKEN] Phone login: ${maskPhone(phone)} role=${role}`
  );
  return NextResponse.json({
    customToken,
    user: shapeUser({ ...user, role }),
  });
}

async function handleEmailAuth(
  emailRaw: string,
  password: string
): Promise<NextResponse> {
  const email = emailRaw.toLowerCase().trim();
  if (!email.includes('@') || password.length === 0) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 400 }
    );
  }

  const lim = await checkRateLimit({
    namespace: 'mobile-token-email',
    key: email,
    maxRequests: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (!lim.allowed) {
    return tooManyAttempts(lim.retryAfterSecs);
  }

  const user = await unifiedDb.users.findByEmail(email);
  // Generic 401 — don't leak whether the email is registered. Same
  // guard as the NextAuth credentials provider in src/lib/auth.ts.
  if (!user || !user.password || isAccountDeleted(user)) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  const passwordValid = await compare(password, user.password);
  if (!passwordValid) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  const customToken = await mintCustomToken({
    id: user.id,
    role: user.role,
    phone: user.phone,
    isInvestor: Boolean((user as { isInvestor?: boolean }).isInvestor),
  });
  if (!customToken) {
    return tokenMintFailed();
  }

  void touchLastSignIn(user.id);
  console.log(`✅ [MOBILE-TOKEN] Email login: user=${user.id} role=${user.role}`);
  return NextResponse.json({
    customToken,
    user: shapeUser(user),
  });
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
    console.error('❌ [MOBILE-TOKEN] Twilio Verify not configured');
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
    console.error('❌ [MOBILE-TOKEN] Twilio Verify check failed:', err);
    return { ok: false, error: 'Verification failed' };
  }
}

async function mintCustomToken(args: {
  id: string;
  role: string;
  phone?: string | null;
  isInvestor?: boolean;
}): Promise<string | null> {
  const auth = await getAdminAuth();
  if (!auth) return null;
  return auth.createCustomToken(args.id, {
    role: args.role,
    phone: args.phone ?? null,
    isInvestor: args.isInvestor ?? false,
  });
}

async function touchLastSignIn(userId: string): Promise<void> {
  const db = await getAdminDb();
  if (!db) return;
  try {
    await db.collection('users').doc(userId).update({ lastSignIn: new Date() });
  } catch {
    // Best-effort: a missing doc or transient failure shouldn't deny
    // a valid login. The lastSignIn field is observational, not gating.
  }
}

function shapeUser(u: {
  id: string;
  role: string;
  phone?: string;
  email?: string;
  name?: string;
  isInvestor?: boolean;
}): MobileTokenUser {
  return {
    id: u.id,
    role: u.role,
    phone: u.phone ?? null,
    email: u.email ?? null,
    name: u.name ?? null,
    isInvestor: Boolean(u.isInvestor),
  };
}

function isAccountDeleted(u: {
  role: string;
  deleted?: boolean;
}): boolean {
  return u.deleted === true || u.role === 'deleted';
}

function tooManyAttempts(retryAfterSecs: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many attempts. Try again later.', retryAfter: retryAfterSecs },
    { status: 429, headers: { 'Retry-After': String(retryAfterSecs) } }
  );
}

function tokenMintFailed(): NextResponse {
  console.error('❌ [MOBILE-TOKEN] Firebase Admin Auth unavailable');
  return NextResponse.json(
    { error: 'Token mint failed' },
    { status: 500 }
  );
}
