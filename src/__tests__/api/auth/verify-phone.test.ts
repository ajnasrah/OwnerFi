/**
 * Unit tests for POST /api/auth/verify-phone.
 *
 * The endpoint flips `users/{uid}.phoneNumberVerified` to true after
 * re-verifying a Twilio OTP code against the caller's session. These
 * tests pin every contract the mobile client reads — status codes,
 * error `code` field values, idempotent re-verify behaviour — so a
 * regression here surfaces fast on the web side rather than silently
 * breaking the mobile verify-phone sheet in production.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';

// --- Mocks -----------------------------------------------------------------

const mockGetAdminDb = jest.fn();
jest.mock('@/lib/firebase-admin', () => ({
  getAdminDb: (...args: unknown[]) => mockGetAdminDb(...args),
}));

const mockFindByPhone = jest.fn();
jest.mock('@/lib/unified-db', () => ({
  unifiedDb: {
    users: {
      findByPhone: (...args: unknown[]) => mockFindByPhone(...args),
    },
  },
}));

const mockCheckRateLimit = jest.fn();
jest.mock('@/lib/rate-limit-firestore', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

const mockRequireAuth = jest.fn();
jest.mock('@/lib/auth-helpers', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// `normalizePhone` / `isValidPhone` are pure helpers — let the real
// impls run so test phones go through the same E.164 canonicalisation
// the production path uses.

// --- Helpers ---------------------------------------------------------------

const HTTP_LOCAL = 'http://localhost:3000';

function jsonPost(body: unknown): NextRequest {
  return new NextRequest(new URL('/api/auth/verify-phone', HTTP_LOCAL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function stubAuth(userId = 'user-1', role: 'buyer' | 'realtor' | 'admin' = 'buyer') {
  mockRequireAuth.mockResolvedValue({
    session: {
      user: { id: userId, email: 'u@example.com', name: 'Demo', role },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  } as never);
}

function stubAuthFailed() {
  mockRequireAuth.mockResolvedValue({
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  } as never);
}

function stubRateLimitAllowed() {
  mockCheckRateLimit.mockResolvedValue({
    allowed: true,
    retryAfterSecs: 0,
  } as never);
}

let mockUpdate: ReturnType<typeof jest.fn>;
function stubAdminDbAvailable() {
  mockUpdate = jest.fn().mockResolvedValue(undefined as never);
  mockGetAdminDb.mockResolvedValue({
    collection: () => ({
      doc: () => ({ update: mockUpdate }),
    }),
  } as never);
}

function stubTwilioApproved() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'approved' }),
  } as never) as never;
}

function stubTwilioRejected() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'pending' }),
  } as never) as never;
}

// --- Tests -----------------------------------------------------------------

describe('POST /api/auth/verify-phone', () => {
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    jest.clearAllMocks();
    stubAuth();
    stubRateLimitAllowed();
    stubAdminDbAvailable();

    // Force a fresh module so the TEST_PHONE_NUMBERS env override gets
    // picked up per-test rather than captured at first import.
    jest.resetModules();
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token_test';
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VA_test';
    process.env.TEST_PHONE_NUMBERS = '';

    const mod = await import('@/app/api/auth/verify-phone/route');
    POST = mod.POST;
  });

  // ---------- auth gate ----------

  describe('auth gate', () => {
    it('returns 401 when requireAuth refuses the request', async () => {
      stubAuthFailed();

      const res = await POST(
        jsonPost({ phone: '+15551234567', code: '123456' })
      );

      expect(res.status).toBe(401);
      // No verification work happens past the auth gate.
      expect(mockFindByPhone).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  // ---------- input validation ----------

  describe('input validation', () => {
    it('rejects malformed JSON with 400 invalid-body', async () => {
      const req = new NextRequest(
        new URL('/api/auth/verify-phone', HTTP_LOCAL),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{not json',
        }
      );
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.code).toBe('invalid-body');
    });

    it('rejects invalid phone with 400 invalid-number', async () => {
      const res = await POST(jsonPost({ phone: '12345', code: '123456' }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.code).toBe('invalid-number');
    });

    it('rejects non-6-digit code with 400 invalid-code', async () => {
      const res = await POST(jsonPost({ phone: '+15551234567', code: '12' }));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.code).toBe('invalid-code');
    });
  });

  // ---------- rate limit ----------

  describe('rate limit', () => {
    it('returns 429 with Retry-After when the per-user limit is exhausted', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        retryAfterSecs: 42,
      } as never);
      // Stub fetch so the "didn't call Twilio" assertion works even
      // though the test never reaches the Twilio branch.
      global.fetch = jest.fn() as never;

      const res = await POST(
        jsonPost({ phone: '+15551234567', code: '123456' })
      );
      const data = await res.json();

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('42');
      expect(data.code).toBe('rate-limited');
      // Importantly: the rate limit fires BEFORE Twilio + Firestore so
      // a brute-force loop can't burn through Verify quota.
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockFindByPhone).not.toHaveBeenCalled();
    });

    it('keys the limiter on the userId (not the phone)', async () => {
      stubTwilioApproved();
      mockFindByPhone.mockResolvedValue(null);

      await POST(jsonPost({ phone: '+15551234567', code: '123456' }));

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({ namespace: 'verify-phone', key: 'user-1' })
      );
    });
  });

  // ---------- phone collision ----------

  describe('phone collision', () => {
    it('returns 409 phone-already-linked when another user owns the phone', async () => {
      mockFindByPhone.mockResolvedValue({
        id: 'someone-else',
        phone: '+15551234567',
      } as never);

      const res = await POST(
        jsonPost({ phone: '+15551234567', code: '123456' })
      );
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.code).toBe('phone-already-linked');
      // Saves a Twilio call by checking the collision first.
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('lets the same user re-verify their own phone (idempotent)', async () => {
      mockFindByPhone.mockResolvedValue({
        id: 'user-1',
        phone: '+15551234567',
      } as never);
      stubTwilioApproved();

      const res = await POST(
        jsonPost({ phone: '+15551234567', code: '123456' })
      );

      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+15551234567',
          phoneNumberVerified: true,
        })
      );
    });
  });

  // ---------- Twilio rejection ----------

  describe('Twilio rejection', () => {
    it('returns 422 invalid-code when Verify reports non-approved status', async () => {
      mockFindByPhone.mockResolvedValue(null);
      stubTwilioRejected();

      const res = await POST(
        jsonPost({ phone: '+15551234567', code: '999999' })
      );
      const data = await res.json();

      expect(res.status).toBe(422);
      expect(data.code).toBe('invalid-code');
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('returns 422 invalid-code when fetch throws (network blip)', async () => {
      mockFindByPhone.mockResolvedValue(null);
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('network down') as never) as never;

      const res = await POST(
        jsonPost({ phone: '+15551234567', code: '123456' })
      );

      expect(res.status).toBe(422);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  // ---------- happy path ----------

  describe('happy path', () => {
    it('writes phone + phoneNumberVerified=true on a clean approve', async () => {
      mockFindByPhone.mockResolvedValue(null);
      stubTwilioApproved();

      const res = await POST(
        jsonPost({ phone: '+15551234567', code: '123456' })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ ok: true });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+15551234567',
          phoneNumberVerified: true,
        })
      );
      // updatedAt is wall-clock; only assert the shape, not the value.
      const updateArg = mockUpdate.mock.calls[0]?.[0] as {
        updatedAt: unknown;
      };
      expect(updateArg.updatedAt).toBeInstanceOf(Date);
    });

    it('TEST_PHONE_NUMBERS bypass accepts code 123456 without Twilio', async () => {
      process.env.TEST_PHONE_NUMBERS = '+15551234567';
      jest.resetModules();
      const mod = await import('@/app/api/auth/verify-phone/route');
      const POST2 = mod.POST;

      mockFindByPhone.mockResolvedValue(null);
      // Spy on fetch to confirm we DON'T call Twilio for test numbers.
      global.fetch = jest.fn() as never;

      const res = await POST2(
        jsonPost({ phone: '+15551234567', code: '123456' })
      );

      expect(res.status).toBe(200);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('TEST_PHONE_NUMBERS bypass rejects non-123456 codes locally', async () => {
      process.env.TEST_PHONE_NUMBERS = '+15551234567';
      jest.resetModules();
      const mod = await import('@/app/api/auth/verify-phone/route');
      const POST2 = mod.POST;

      mockFindByPhone.mockResolvedValue(null);
      global.fetch = jest.fn() as never;

      const res = await POST2(
        jsonPost({ phone: '+15551234567', code: '999999' })
      );

      expect(res.status).toBe(422);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  // ---------- infra failures ----------

  describe('infra failures', () => {
    it('returns 500 when getAdminDb is unavailable', async () => {
      mockFindByPhone.mockResolvedValue(null);
      stubTwilioApproved();
      mockGetAdminDb.mockResolvedValue(null);

      const res = await POST(
        jsonPost({ phone: '+15551234567', code: '123456' })
      );
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.code).toBe('internal');
    });

    it('returns 500 when the Firestore update throws', async () => {
      mockFindByPhone.mockResolvedValue(null);
      stubTwilioApproved();
      mockGetAdminDb.mockResolvedValue({
        collection: () => ({
          doc: () => ({
            update: jest
              .fn()
              .mockRejectedValue(new Error('firestore down') as never),
          }),
        }),
      } as never);

      const res = await POST(
        jsonPost({ phone: '+15551234567', code: '123456' })
      );
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.code).toBe('internal');
    });
  });
});
