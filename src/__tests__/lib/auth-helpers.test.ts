/**
 * Unit tests for the requireAuth + requireRole mobile-Bearer fallback.
 * Cookie-only paths already had implicit coverage via the route tests;
 * this file pins the new Bearer-fallback contract end-to-end.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// --- Mocks -----------------------------------------------------------------

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// authOptions is referenced by getTypedSession but never executed in
// tests (we mock getServerSession itself). Stub the module to avoid
// pulling the full NextAuth+Firebase init graph.
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockGetSessionFromBearer = jest.fn();
jest.mock('@/lib/mobile-auth-bridge', () => ({
  getSessionFromBearer: (...args: unknown[]) =>
    mockGetSessionFromBearer(...args),
}));

const mockLogAuthFailure = jest.fn();
jest.mock('@/lib/audit-logger', () => ({
  AuditHelpers: {
    logAuthFailure: (...args: unknown[]) => mockLogAuthFailure(...args),
  },
  extractActorFromRequest: jest.fn(),
}));

// ErrorResponses returns NextResponse instances in production. Stub
// to plain objects so we can assert without depending on Next's runtime.
jest.mock('@/lib/api-error-handler', () => ({
  ErrorResponses: {
    unauthorized: () => ({ kind: 'unauthorized', status: 401 }),
    forbidden: (msg: string) => ({ kind: 'forbidden', status: 403, msg }),
  },
}));

// Imported AFTER the mocks.
import { requireAuth, requireRole } from '@/lib/auth-helpers';

// --- Helpers ---------------------------------------------------------------

function reqFor(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/buyer/profile', {
    method: 'POST',
    headers,
  });
}

const buyerSession = {
  user: {
    id: 'user-1',
    email: 'b@example.com',
    name: 'Bob Buyer',
    role: 'buyer' as const,
  },
  expires: '2026-12-31T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------

describe('requireAuth — Bearer fallback', () => {
  it('returns the NextAuth session when present (Bearer never consulted)', async () => {
    mockGetServerSession.mockResolvedValue(buyerSession as never);

    const result = await requireAuth(reqFor());

    expect('session' in result && result.session).toEqual(buyerSession);
    expect(mockGetSessionFromBearer).not.toHaveBeenCalled();
  });

  it('falls back to getSessionFromBearer when NextAuth has no session', async () => {
    mockGetServerSession.mockResolvedValue(null as never);
    mockGetSessionFromBearer.mockResolvedValue(buyerSession as never);

    const req = reqFor({ Authorization: 'Bearer valid.jwt.here' });
    const result = await requireAuth(req);

    expect('session' in result && result.session).toEqual(buyerSession);
    expect(mockGetSessionFromBearer).toHaveBeenCalledWith(req);
    expect(mockLogAuthFailure).not.toHaveBeenCalled();
  });

  it('returns 401 + audit when both NextAuth and Bearer fail', async () => {
    mockGetServerSession.mockResolvedValue(null as never);
    mockGetSessionFromBearer.mockResolvedValue(null as never);

    const result = await requireAuth(reqFor());

    expect('error' in result).toBe(true);
    expect(
      'error' in result && (result.error as unknown as { kind: string }).kind
    ).toBe('unauthorized');
    expect(mockLogAuthFailure).toHaveBeenCalledTimes(1);
  });
});

describe('requireRole — delegates auth to requireAuth', () => {
  it('returns the session when the Bearer-authenticated user matches the role', async () => {
    mockGetServerSession.mockResolvedValue(null as never);
    mockGetSessionFromBearer.mockResolvedValue(buyerSession as never);

    const result = await requireRole(reqFor(), 'buyer');

    expect('session' in result && result.session).toEqual(buyerSession);
    expect(mockLogAuthFailure).not.toHaveBeenCalled();
  });

  it('returns 403 when authenticated via Bearer but role is wrong', async () => {
    mockGetServerSession.mockResolvedValue(null as never);
    mockGetSessionFromBearer.mockResolvedValue(buyerSession as never);

    const result = await requireRole(reqFor(), 'realtor');

    expect('error' in result).toBe(true);
    expect(
      'error' in result && (result.error as unknown as { kind: string }).kind
    ).toBe('forbidden');
    expect(mockLogAuthFailure).toHaveBeenCalledTimes(1);
  });

  it('accepts an array of acceptable roles', async () => {
    mockGetServerSession.mockResolvedValue(null as never);
    mockGetSessionFromBearer.mockResolvedValue(buyerSession as never);

    const result = await requireRole(reqFor(), ['buyer', 'admin']);

    expect('session' in result).toBe(true);
  });

  it('returns 401 (not 403) when no auth at all — distinct from wrong-role', async () => {
    mockGetServerSession.mockResolvedValue(null as never);
    mockGetSessionFromBearer.mockResolvedValue(null as never);

    const result = await requireRole(reqFor(), 'buyer');

    expect('error' in result).toBe(true);
    expect(
      'error' in result && (result.error as unknown as { kind: string }).kind
    ).toBe('unauthorized');
  });
});
