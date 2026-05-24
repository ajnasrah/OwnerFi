/**
 * Unit tests for getSessionFromBearer — the mobile-auth bridge that
 * lets requireAuth fall back to Firebase ID token verification when
 * the request has no NextAuth session cookie. Pins every negative
 * path collapses to null (the same shape NextAuth's "no session"
 * produces) so route handlers don't have to distinguish.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// --- Mocks -----------------------------------------------------------------

const mockVerifyIdToken =
  jest.fn<(token: string) => Promise<{ uid: string; exp: number }>>();
const mockGetAdminAuth = jest.fn();

jest.mock('@/lib/firebase-admin', () => ({
  getAdminAuth: (...args: unknown[]) => mockGetAdminAuth(...args),
}));

const mockFindById = jest.fn();

jest.mock('@/lib/unified-db', () => ({
  unifiedDb: {
    users: {
      findById: (...args: unknown[]) => mockFindById(...args),
    },
  },
}));

// Imported AFTER the mocks so the SUT picks them up.
import { getSessionFromBearer } from '@/lib/mobile-auth-bridge';

// --- Helpers ---------------------------------------------------------------

function requestWith(headers: Record<string, string>): Request {
  return new Request('http://localhost:3000/api/buyer/profile', {
    method: 'POST',
    headers,
  });
}

function stubAdminAuth() {
  mockGetAdminAuth.mockResolvedValue({
    verifyIdToken: mockVerifyIdToken,
  } as never);
}

const buyerRecord = {
  id: 'user-1',
  email: 'b@example.com',
  name: 'Bob Buyer',
  role: 'buyer' as const,
};

// Token exp: 2026-12-31T00:00:00Z — keeps the ISO assertion stable
// regardless of when the test runs.
const FUTURE_EXP_SECONDS = 1798675200;
const FUTURE_EXP_ISO = '2026-12-31T00:00:00.000Z';

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------

describe('getSessionFromBearer — null paths', () => {
  it('returns null when there is no Authorization header', async () => {
    const result = await getSessionFromBearer(requestWith({}));
    expect(result).toBeNull();
    expect(mockGetAdminAuth).not.toHaveBeenCalled();
  });

  it('returns null when the header is not Bearer-prefixed', async () => {
    const result = await getSessionFromBearer(
      requestWith({ Authorization: 'Basic abc' })
    );
    expect(result).toBeNull();
    expect(mockGetAdminAuth).not.toHaveBeenCalled();
  });

  it('returns null when the Bearer token is empty', async () => {
    const result = await getSessionFromBearer(
      requestWith({ Authorization: 'Bearer ' })
    );
    expect(result).toBeNull();
    expect(mockGetAdminAuth).not.toHaveBeenCalled();
  });

  it('returns null when verifyIdToken throws (expired/revoked/malformed)', async () => {
    stubAdminAuth();
    mockVerifyIdToken.mockRejectedValue(new Error('token expired') as never);

    const result = await getSessionFromBearer(
      requestWith({ Authorization: 'Bearer expired.jwt.here' })
    );

    expect(result).toBeNull();
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it('returns null when getAdminAuth resolves to null (admin SDK not ready)', async () => {
    mockGetAdminAuth.mockResolvedValue(null as never);

    const result = await getSessionFromBearer(
      requestWith({ Authorization: 'Bearer some.jwt.here' })
    );

    expect(result).toBeNull();
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it('returns null when the user row is missing (deleted account)', async () => {
    stubAdminAuth();
    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-1',
      exp: FUTURE_EXP_SECONDS,
    } as never);
    mockFindById.mockResolvedValue(null as never);

    const result = await getSessionFromBearer(
      requestWith({ Authorization: 'Bearer valid.jwt.here' })
    );

    expect(result).toBeNull();
    expect(mockFindById).toHaveBeenCalledWith('user-1');
  });

  it('returns null when the user role is "pending" (not yet onboarded)', async () => {
    stubAdminAuth();
    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-1',
      exp: FUTURE_EXP_SECONDS,
    } as never);
    mockFindById.mockResolvedValue({
      ...buyerRecord,
      role: 'pending',
    } as never);

    const result = await getSessionFromBearer(
      requestWith({ Authorization: 'Bearer valid.jwt.here' })
    );

    expect(result).toBeNull();
  });
});

describe('getSessionFromBearer — happy path', () => {
  it('returns an ExtendedSession for a valid buyer token', async () => {
    stubAdminAuth();
    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-1',
      exp: FUTURE_EXP_SECONDS,
    } as never);
    mockFindById.mockResolvedValue(buyerRecord as never);

    const result = await getSessionFromBearer(
      requestWith({ Authorization: 'Bearer valid.jwt.here' })
    );

    expect(result).toEqual({
      user: {
        id: 'user-1',
        email: 'b@example.com',
        name: 'Bob Buyer',
        role: 'buyer',
      },
      expires: FUTURE_EXP_ISO,
    });
    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid.jwt.here');
  });

  it('works for realtor + admin roles', async () => {
    stubAdminAuth();
    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-2',
      exp: FUTURE_EXP_SECONDS,
    } as never);

    for (const role of ['realtor', 'admin'] as const) {
      mockFindById.mockResolvedValue({
        ...buyerRecord,
        id: 'user-2',
        role,
      } as never);

      const result = await getSessionFromBearer(
        requestWith({ Authorization: 'Bearer valid.jwt.here' })
      );

      expect(result?.user.role).toBe(role);
    }
  });

  it('trims whitespace around the token', async () => {
    stubAdminAuth();
    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-1',
      exp: FUTURE_EXP_SECONDS,
    } as never);
    mockFindById.mockResolvedValue(buyerRecord as never);

    await getSessionFromBearer(
      requestWith({ Authorization: 'Bearer   valid.jwt.here  ' })
    );

    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid.jwt.here');
  });

  it('re-reads the user row on every call (claims are not trusted)', async () => {
    stubAdminAuth();
    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-1',
      exp: FUTURE_EXP_SECONDS,
    } as never);
    mockFindById.mockResolvedValue(buyerRecord as never);

    await getSessionFromBearer(
      requestWith({ Authorization: 'Bearer valid.jwt.here' })
    );
    await getSessionFromBearer(
      requestWith({ Authorization: 'Bearer valid.jwt.here' })
    );

    // Two requests → two DB reads. Caching would compromise the
    // "role change takes effect immediately" guarantee.
    expect(mockFindById).toHaveBeenCalledTimes(2);
  });
});
