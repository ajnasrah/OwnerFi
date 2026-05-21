/**
 * Unit Tests for POST /api/auth/mobile-token
 *
 * The endpoint bridges existing NextAuth+bcrypt users (Firestore
 * `users` collection) to Firebase Auth sessions for mobile, by
 * re-verifying credentials (Twilio OTP for phone, bcrypt for email)
 * and minting a Firebase custom token. These tests pin the success
 * contracts AND every failure mode so regressions surface fast.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// --- Mocks -----------------------------------------------------------------

const mockCreateCustomToken = jest.fn<(uid: string, claims?: Record<string, unknown>) => Promise<string>>();
const mockGetAdminAuth = jest.fn();
const mockGetAdminDb = jest.fn();

jest.mock('@/lib/firebase-admin', () => ({
  getAdminAuth: (...args: unknown[]) => mockGetAdminAuth(...args),
  getAdminDb: (...args: unknown[]) => mockGetAdminDb(...args),
}));

const mockFindByPhone = jest.fn();
const mockFindByEmail = jest.fn();

jest.mock('@/lib/unified-db', () => ({
  unifiedDb: {
    users: {
      findByPhone: (...args: unknown[]) => mockFindByPhone(...args),
      findByEmail: (...args: unknown[]) => mockFindByEmail(...args),
    },
  },
}));

const mockCheckRateLimit = jest.fn();
jest.mock('@/lib/rate-limit-firestore', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

const mockCompare = jest.fn();
jest.mock('bcryptjs', () => ({
  compare: (...args: unknown[]) => mockCompare(...args),
}));

// `normalizePhone` is pure — let the real impl run so test phones go
// through the same E.164 canonicalization the production path uses.

// --- Helpers ---------------------------------------------------------------

const HTTP_LOCAL = 'http://localhost:3000';

function jsonPost(body: unknown): NextRequest {
  return new NextRequest(new URL('/api/auth/mobile-token', HTTP_LOCAL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function stubRateLimitAllowed() {
  mockCheckRateLimit.mockResolvedValue({ allowed: true, retryAfterSecs: 0 } as never);
}

function stubAdminAuth({ token = 'custom-token-xyz' }: { token?: string } = {}) {
  mockCreateCustomToken.mockResolvedValue(token);
  mockGetAdminAuth.mockResolvedValue({ createCustomToken: mockCreateCustomToken } as never);
}

function stubAdminDbAvailable() {
  mockGetAdminDb.mockResolvedValue({
    collection: () => ({
      doc: () => ({ update: jest.fn().mockResolvedValue(undefined as never) }),
    }),
  } as never);
}

const buyerRecord = {
  id: 'user-1',
  email: 'buyer@example.com',
  name: 'Demo Buyer',
  phone: '+15551234567',
  role: 'buyer' as const,
  password: 'bcrypt-hashed',
  isInvestor: false,
};

// --- Tests -----------------------------------------------------------------

describe('POST /api/auth/mobile-token', () => {
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    jest.clearAllMocks();
    stubRateLimitAllowed();
    stubAdminAuth();
    stubAdminDbAvailable();

    // Force a fresh module so `process.env` overrides (TWILIO_*, etc.)
    // are picked up per-test rather than captured once at import time.
    jest.resetModules();
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token_test';
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VA_test';
    process.env.ADMIN_PHONE_NUMBERS = '';
    process.env.TEST_PHONE_NUMBERS = '';

    const mod = await import('@/app/api/auth/mobile-token/route');
    POST = mod.POST;
  });

  // ---------- input validation ----------

  describe('input validation', () => {
    it('rejects empty body with 400', async () => {
      const res = await POST(jsonPost({}));
      expect(res.status).toBe(400);
    });

    it('rejects both credential sets with 400', async () => {
      const res = await POST(
        jsonPost({
          phone: '+15551234567',
          code: '000000',
          email: 'a@b.com',
          password: 'pw',
        })
      );
      expect(res.status).toBe(400);
    });

    it('rejects invalid phone format with 400', async () => {
      const res = await POST(jsonPost({ phone: '12345', code: '000000' }));
      expect(res.status).toBe(400);
    });

    it('rejects OTP not 6 digits with 400', async () => {
      const res = await POST(
        jsonPost({ phone: '+15551234567', code: '123' })
      );
      expect(res.status).toBe(400);
    });
  });

  // ---------- phone path ----------

  describe('phone path', () => {
    it('mints a custom token + returns shaped user on valid OTP', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'approved' }),
      } as never) as never;
      mockFindByPhone.mockResolvedValue(buyerRecord as never);

      const res = await POST(
        jsonPost({ phone: '+15551234567', code: '123456' })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.customToken).toBe('custom-token-xyz');
      expect(data.user).toEqual({
        id: 'user-1',
        role: 'buyer',
        phone: '+15551234567',
        email: 'buyer@example.com',
        name: 'Demo Buyer',
        isInvestor: false,
      });

      expect(mockCreateCustomToken).toHaveBeenCalledWith('user-1', {
        role: 'buyer',
        phone: '+15551234567',
        isInvestor: false,
      });
    });

    it('returns 401 when Twilio reports invalid code', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'pending' }),
      } as never) as never;
      mockFindByPhone.mockResolvedValue(buyerRecord as never);

      const res = await POST(
        jsonPost({ phone: '+15551234567', code: '999999' })
      );

      expect(res.status).toBe(401);
      expect(mockCreateCustomToken).not.toHaveBeenCalled();
    });

    it('returns 401 when no user is found for the phone', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'approved' }),
      } as never) as never;
      mockFindByPhone.mockResolvedValue(null);

      const res = await POST(
        jsonPost({ phone: '+15551234567', code: '123456' })
      );

      expect(res.status).toBe(401);
      expect(mockCreateCustomToken).not.toHaveBeenCalled();
    });

    it('rejects deleted accounts with 401', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'approved' }),
      } as never) as never;
      mockFindByPhone.mockResolvedValue({
        ...buyerRecord,
        role: 'deleted',
      } as never);

      const res = await POST(
        jsonPost({ phone: '+15551234567', code: '123456' })
      );

      expect(res.status).toBe(401);
      expect(mockCreateCustomToken).not.toHaveBeenCalled();
    });

    it('applies admin-phone override when the env var matches', async () => {
      process.env.ADMIN_PHONE_NUMBERS = '+15551234567';
      jest.resetModules();
      const mod = await import('@/app/api/auth/mobile-token/route');
      const POST2 = mod.POST;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'approved' }),
      } as never) as never;
      mockFindByPhone.mockResolvedValue(buyerRecord as never);

      const res = await POST2(
        jsonPost({ phone: '+15551234567', code: '123456' })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.user.role).toBe('admin');
      expect(mockCreateCustomToken).toHaveBeenCalledWith('user-1', {
        role: 'admin',
        phone: '+15551234567',
        isInvestor: false,
      });
    });

    it('returns 429 when the per-phone rate limit is exhausted', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        retryAfterSecs: 42,
      } as never);

      const res = await POST(
        jsonPost({ phone: '+15551234567', code: '123456' })
      );

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('42');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // ---------- email path ----------

  describe('email path', () => {
    it('mints a custom token + returns shaped user on valid credentials', async () => {
      mockFindByEmail.mockResolvedValue(buyerRecord as never);
      mockCompare.mockResolvedValue(true as never);

      const res = await POST(
        jsonPost({ email: 'Buyer@Example.com', password: 'hunter2' })
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.customToken).toBe('custom-token-xyz');
      expect(data.user.id).toBe('user-1');
      expect(mockFindByEmail).toHaveBeenCalledWith('buyer@example.com'); // lowercased
      expect(mockCompare).toHaveBeenCalledWith('hunter2', 'bcrypt-hashed');
    });

    it('returns 401 on wrong password (does not leak which field was wrong)', async () => {
      mockFindByEmail.mockResolvedValue(buyerRecord as never);
      mockCompare.mockResolvedValue(false as never);

      const res = await POST(
        jsonPost({ email: 'buyer@example.com', password: 'wrong' })
      );
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Invalid email or password');
      expect(mockCreateCustomToken).not.toHaveBeenCalled();
    });

    it('returns 401 on unknown email with the same generic error', async () => {
      mockFindByEmail.mockResolvedValue(null);

      const res = await POST(
        jsonPost({ email: 'ghost@example.com', password: 'whatever' })
      );
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Invalid email or password');
      expect(mockCompare).not.toHaveBeenCalled();
    });

    it('returns 401 when the user has no stored password', async () => {
      mockFindByEmail.mockResolvedValue({
        ...buyerRecord,
        password: undefined,
      } as never);

      const res = await POST(
        jsonPost({ email: 'buyer@example.com', password: 'hunter2' })
      );

      expect(res.status).toBe(401);
      expect(mockCompare).not.toHaveBeenCalled();
    });

    it('returns 429 when the per-email rate limit is exhausted', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        retryAfterSecs: 17,
      } as never);

      const res = await POST(
        jsonPost({ email: 'buyer@example.com', password: 'hunter2' })
      );

      expect(res.status).toBe(429);
      expect(mockFindByEmail).not.toHaveBeenCalled();
    });
  });

  // ---------- token mint failure ----------

  it('returns 500 when Firebase Admin Auth is unavailable', async () => {
    mockGetAdminAuth.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(buyerRecord as never);
    mockCompare.mockResolvedValue(true as never);

    const res = await POST(
      jsonPost({ email: 'buyer@example.com', password: 'hunter2' })
    );

    expect(res.status).toBe(500);
  });
});
