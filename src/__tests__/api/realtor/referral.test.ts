/**
 * Unit Tests for Referral System APIs
 * Tests: create-invite, accept (GET/POST)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase
const mockGetDocument = jest.fn();
const mockQueryDocuments = jest.fn();
const mockCreateDocument = jest.fn();
const mockUpdateDocument = jest.fn();

jest.mock('@/lib/firebase-db', () => ({
  FirebaseDB: {
    getDocument: (...args: unknown[]) => mockGetDocument(...args),
    queryDocuments: (...args: unknown[]) => mockQueryDocuments(...args),
    createDocument: (...args: unknown[]) => mockCreateDocument(...args),
    updateDocument: (...args: unknown[]) => mockUpdateDocument(...args),
  },
}));

// Mock auth
const mockGetSessionWithRole = jest.fn();
jest.mock('@/lib/auth-utils', () => ({
  getSessionWithRole: (...args: unknown[]) => mockGetSessionWithRole(...args),
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: () => ({
    toString: () => 'a'.repeat(64), // 64 hex chars
  }),
}));

// Helper to create mock Timestamp
const createMockTimestamp = (date: Date = new Date()) => ({
  toDate: () => date,
  _seconds: Math.floor(date.getTime() / 1000),
  _nanoseconds: 0,
});

// Helper to create NextRequest
const createRequest = (url: string, options?: RequestInit) => {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options);
};

describe('Referral System APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/realtor/referral/create-invite', () => {
    // Import the route handler
    let POST: (request: NextRequest) => Promise<Response>;

    beforeEach(async () => {
      const module = await import('@/app/api/realtor/referral/create-invite/route');
      POST = module.POST;
    });

    it('should return 401 if not authenticated', async () => {
      mockGetSessionWithRole.mockResolvedValue(null);

      const request = createRequest('/api/realtor/referral/create-invite', {
        method: 'POST',
        body: JSON.stringify({ agreementId: 'test-id', referralFeePercent: 25 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });

    it('should return 400 if agreementId is missing', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });

      const request = createRequest('/api/realtor/referral/create-invite', {
        method: 'POST',
        body: JSON.stringify({ referralFeePercent: 25 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Agreement ID is required');
    });

    it('should return 400 if referralFeePercent is not a number', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });

      const request = createRequest('/api/realtor/referral/create-invite', {
        method: 'POST',
        body: JSON.stringify({ agreementId: 'test-id', referralFeePercent: '25' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Referral fee must be between 1% and 50%');
    });

    it('should return 400 if referralFeePercent is out of range', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });

      const request = createRequest('/api/realtor/referral/create-invite', {
        method: 'POST',
        body: JSON.stringify({ agreementId: 'test-id', referralFeePercent: 75 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Referral fee must be between 1% and 50%');
    });

    it('should return 400 if referralFeePercent is not an integer', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });

      const request = createRequest('/api/realtor/referral/create-invite', {
        method: 'POST',
        body: JSON.stringify({ agreementId: 'test-id', referralFeePercent: 25.5 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Referral fee must be a whole number');
    });

    it('should return 404 if agreement not found', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });
      mockGetDocument.mockResolvedValue(null);

      const request = createRequest('/api/realtor/referral/create-invite', {
        method: 'POST',
        body: JSON.stringify({ agreementId: 'test-id', referralFeePercent: 25 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Agreement not found');
    });

    it('should return 403 if user does not own the agreement', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });
      mockGetDocument.mockResolvedValue({
        id: 'test-id',
        realtorUserId: 'different-user',
        status: 'signed',
      });

      const request = createRequest('/api/realtor/referral/create-invite', {
        method: 'POST',
        body: JSON.stringify({ agreementId: 'test-id', referralFeePercent: 25 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('You do not have permission to refer this lead');
    });

    it('should return 400 if agreement is not signed', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });
      mockGetDocument.mockResolvedValue({
        id: 'test-id',
        realtorUserId: 'user-123',
        status: 'pending',
      });

      const request = createRequest('/api/realtor/referral/create-invite', {
        method: 'POST',
        body: JSON.stringify({ agreementId: 'test-id', referralFeePercent: 25 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('You can only refer leads from signed agreements');
    });

    it('should return 400 if agreement has expired', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });
      mockGetDocument.mockResolvedValue({
        id: 'test-id',
        realtorUserId: 'user-123',
        status: 'signed',
        expirationDate: createMockTimestamp(new Date('2020-01-01')),
      });

      const request = createRequest('/api/realtor/referral/create-invite', {
        method: 'POST',
        body: JSON.stringify({ agreementId: 'test-id', referralFeePercent: 25 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('This agreement has expired. You cannot refer leads from expired agreements.');
    });

    it('should return 400 if lead is already a re-referral', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });
      mockGetDocument.mockResolvedValue({
        id: 'test-id',
        realtorUserId: 'user-123',
        status: 'signed',
        expirationDate: createMockTimestamp(new Date('2030-01-01')),
        isReReferral: true,
      });

      const request = createRequest('/api/realtor/referral/create-invite', {
        method: 'POST',
        body: JSON.stringify({ agreementId: 'test-id', referralFeePercent: 25 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('This lead has already been re-referred. Triple referrals are not allowed.');
    });

    it('should return 400 if canBeReReferred is false', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });
      mockGetDocument.mockResolvedValue({
        id: 'test-id',
        realtorUserId: 'user-123',
        status: 'signed',
        expirationDate: createMockTimestamp(new Date('2030-01-01')),
        isReReferral: false,
        canBeReReferred: false,
      });

      const request = createRequest('/api/realtor/referral/create-invite', {
        method: 'POST',
        body: JSON.stringify({ agreementId: 'test-id', referralFeePercent: 25 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('This lead has already been referred to another agent.');
    });

    it('should return existing invite if active', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });
      mockGetDocument.mockResolvedValue({
        id: 'test-id',
        realtorUserId: 'user-123',
        status: 'signed',
        expirationDate: createMockTimestamp(new Date('2030-01-01')),
        isReReferral: false,
        canBeReReferred: true,
        referralInviteToken: 'existing-token',
        referralInviteExpiresAt: createMockTimestamp(new Date('2030-01-01')),
        referralInviteFeePercent: 30,
      });

      const request = createRequest('/api/realtor/referral/create-invite', {
        method: 'POST',
        body: JSON.stringify({ agreementId: 'test-id', referralFeePercent: 25 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.existingInvite).toBe(true);
      expect(data.inviteToken).toBe('existing-token');
      expect(data.referralFeePercent).toBe(30); // Uses existing fee, not new one
    });

    it('should create new invite successfully', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });
      mockGetDocument.mockResolvedValue({
        id: 'test-id',
        realtorUserId: 'user-123',
        status: 'signed',
        expirationDate: createMockTimestamp(new Date('2030-01-01')),
        isReReferral: false,
        canBeReReferred: true,
      });
      mockUpdateDocument.mockResolvedValue(undefined);

      const request = createRequest('/api/realtor/referral/create-invite', {
        method: 'POST',
        body: JSON.stringify({ agreementId: 'test-id', referralFeePercent: 25 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.existingInvite).toBe(false);
      expect(data.inviteToken).toBe('a'.repeat(64));
      expect(data.referralFeePercent).toBe(25);
      expect(data.ownerFiCutPercent).toBe(30);
      expect(mockUpdateDocument).toHaveBeenCalled();
    });
  });

  describe('GET /api/realtor/referral/accept', () => {
    let GET: (request: NextRequest) => Promise<Response>;

    beforeEach(async () => {
      const module = await import('@/app/api/realtor/referral/accept/route');
      GET = module.GET;
    });

    it('should return 400 if token is missing', async () => {
      const request = createRequest('/api/realtor/referral/accept');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invite token is required');
    });

    it('should return 400 if token format is invalid', async () => {
      const request = createRequest('/api/realtor/referral/accept?token=invalid');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid invite link');
    });

    it('should return 404 if agreement not found by token', async () => {
      mockQueryDocuments.mockResolvedValue([]);

      const validToken = 'a'.repeat(64);
      const request = createRequest(`/api/realtor/referral/accept?token=${validToken}`);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Invalid or expired invite link');
    });

    it('should return 410 if invite has expired', async () => {
      mockQueryDocuments.mockResolvedValue([{
        id: 'agreement-123',
        realtorUserId: 'user-123',
        referralInviteExpiresAt: createMockTimestamp(new Date('2020-01-01')),
      }]);

      const validToken = 'a'.repeat(64);
      const request = createRequest(`/api/realtor/referral/accept?token=${validToken}`);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe('This invite link has expired');
    });

    it('should return referral details with masked last name', async () => {
      mockQueryDocuments.mockResolvedValue([{
        id: 'agreement-123',
        realtorUserId: 'user-123',
        buyerFirstName: 'John',
        buyerLastName: 'Smith',
        buyerCity: 'Austin',
        buyerState: 'TX',
        referralInviteExpiresAt: createMockTimestamp(new Date('2030-01-01')),
        referralInviteFeePercent: 25,
      }]);
      mockGetDocument.mockResolvedValue({
        email: 'agent@example.com',
        realtorData: {
          firstName: 'Jane',
          lastName: 'Doe',
          company: 'Best Realty',
        },
      });

      const validToken = 'a'.repeat(64);
      const request = createRequest(`/api/realtor/referral/accept?token=${validToken}`);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.referral.buyerFirstName).toBe('John');
      expect(data.referral.buyerLastName).toBe('S***'); // Masked
      expect(data.referral.buyerCity).toBe('Austin');
      expect(data.referral.referringAgentName).toBe('Jane Doe');
      expect(data.referral.referringAgentCompany).toBe('Best Realty');
      expect(data.referral.referralFeePercent).toBe(25);
    });

    it('should handle empty buyer last name', async () => {
      mockQueryDocuments.mockResolvedValue([{
        id: 'agreement-123',
        realtorUserId: 'user-123',
        buyerFirstName: 'John',
        buyerLastName: '',
        referralInviteExpiresAt: createMockTimestamp(new Date('2030-01-01')),
      }]);
      mockGetDocument.mockResolvedValue({
        email: 'agent@example.com',
        realtorData: { firstName: 'Jane', lastName: 'Doe' },
      });

      const validToken = 'a'.repeat(64);
      const request = createRequest(`/api/realtor/referral/accept?token=${validToken}`);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.referral.buyerLastName).toBe('***'); // Empty becomes ***
    });

    it('should handle null referring agent', async () => {
      mockQueryDocuments.mockResolvedValue([{
        id: 'agreement-123',
        realtorUserId: 'user-123',
        buyerFirstName: 'John',
        buyerLastName: 'Smith',
        referralInviteExpiresAt: createMockTimestamp(new Date('2030-01-01')),
      }]);
      mockGetDocument.mockResolvedValue(null); // Agent not found

      const validToken = 'a'.repeat(64);
      const request = createRequest(`/api/realtor/referral/accept?token=${validToken}`);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.referral.referringAgentName).toBe('Agent'); // Default
    });
  });

  describe('POST /api/realtor/referral/accept', () => {
    let POST: (request: NextRequest) => Promise<Response>;

    beforeEach(async () => {
      const module = await import('@/app/api/realtor/referral/accept/route');
      POST = module.POST;
    });

    it('should return 401 if not authenticated', async () => {
      mockGetSessionWithRole.mockResolvedValue(null);

      const request = createRequest('/api/realtor/referral/accept', {
        method: 'POST',
        body: JSON.stringify({
          token: 'a'.repeat(64),
          signatureTypedName: 'John Doe',
          signatureCheckbox: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
    });

    it('should return 400 if token is missing', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });

      const request = createRequest('/api/realtor/referral/accept', {
        method: 'POST',
        body: JSON.stringify({
          signatureTypedName: 'John Doe',
          signatureCheckbox: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invite token is required');
    });

    it('should return 400 if token format is invalid', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });

      const request = createRequest('/api/realtor/referral/accept', {
        method: 'POST',
        body: JSON.stringify({
          token: 'invalid',
          signatureTypedName: 'John Doe',
          signatureCheckbox: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid invite token format');
    });

    it('should return 400 if signatureTypedName is missing', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });

      const request = createRequest('/api/realtor/referral/accept', {
        method: 'POST',
        body: JSON.stringify({
          token: 'a'.repeat(64),
          signatureCheckbox: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Signature is required to accept the referral');
    });

    it('should return 400 if signatureCheckbox is not true', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });

      const request = createRequest('/api/realtor/referral/accept', {
        method: 'POST',
        body: JSON.stringify({
          token: 'a'.repeat(64),
          signatureTypedName: 'John Doe',
          signatureCheckbox: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Signature is required to accept the referral');
    });

    it('should return 400 if signatureCheckbox is string "true" (not boolean)', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });

      const request = createRequest('/api/realtor/referral/accept', {
        method: 'POST',
        body: JSON.stringify({
          token: 'a'.repeat(64),
          signatureTypedName: 'John Doe',
          signatureCheckbox: 'true', // String, not boolean
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Signature is required to accept the referral');
    });

    it('should return 400 if signature name is too short', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });

      const request = createRequest('/api/realtor/referral/accept', {
        method: 'POST',
        body: JSON.stringify({
          token: 'a'.repeat(64),
          signatureTypedName: 'J',
          signatureCheckbox: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Please enter your full name to sign the agreement');
    });

    it('should return 400 if signature is just whitespace', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });

      const request = createRequest('/api/realtor/referral/accept', {
        method: 'POST',
        body: JSON.stringify({
          token: 'a'.repeat(64),
          signatureTypedName: '   ',
          signatureCheckbox: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Please enter your full name to sign the agreement');
    });

    it('should return 400 if user tries to accept own referral', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-123' } });
      mockQueryDocuments.mockResolvedValue([{
        id: 'agreement-123',
        realtorUserId: 'user-123', // Same as session user
        referralInviteExpiresAt: createMockTimestamp(new Date('2030-01-01')),
      }]);

      const request = createRequest('/api/realtor/referral/accept', {
        method: 'POST',
        body: JSON.stringify({
          token: 'a'.repeat(64),
          signatureTypedName: 'John Doe',
          signatureCheckbox: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('You cannot accept your own referral');
    });

    it('should return 409 if referral already accepted by another agent', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-456' } });
      mockQueryDocuments.mockResolvedValue([{
        id: 'agreement-123',
        realtorUserId: 'user-123',
        referralInviteExpiresAt: createMockTimestamp(new Date('2030-01-01')),
        expirationDate: createMockTimestamp(new Date('2030-01-01')),
        canBeReReferred: false, // Already accepted
      }]);

      const request = createRequest('/api/realtor/referral/accept', {
        method: 'POST',
        body: JSON.stringify({
          token: 'a'.repeat(64),
          signatureTypedName: 'John Doe',
          signatureCheckbox: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('This referral has already been accepted by another agent');
    });

    it('should return 400 if Agent B already has agreement with buyer', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-456' } });
      mockQueryDocuments
        .mockResolvedValueOnce([{ // First call - find by token
          id: 'agreement-123',
          realtorUserId: 'user-123',
          buyerId: 'buyer-789',
          referralInviteExpiresAt: createMockTimestamp(new Date('2030-01-01')),
          expirationDate: createMockTimestamp(new Date('2030-01-01')),
          canBeReReferred: true,
        }])
        .mockResolvedValueOnce([{ // Second call - check existing agreements
          id: 'existing-agreement',
        }]);

      const request = createRequest('/api/realtor/referral/accept', {
        method: 'POST',
        body: JSON.stringify({
          token: 'a'.repeat(64),
          signatureTypedName: 'John Doe',
          signatureCheckbox: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('You already have an agreement with this buyer');
    });

    it('should return 400 if Agent B profile is incomplete', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-456' } });
      mockQueryDocuments
        .mockResolvedValueOnce([{
          id: 'agreement-123',
          realtorUserId: 'user-123',
          buyerId: 'buyer-789',
          referralInviteExpiresAt: createMockTimestamp(new Date('2030-01-01')),
          expirationDate: createMockTimestamp(new Date('2030-01-01')),
          canBeReReferred: true,
        }])
        .mockResolvedValueOnce([]); // No existing agreements

      mockGetDocument.mockResolvedValue({
        email: 'agent@example.com',
        realtorData: {
          firstName: '', // Empty
          lastName: 'Doe',
        },
      });

      const request = createRequest('/api/realtor/referral/accept', {
        method: 'POST',
        body: JSON.stringify({
          token: 'a'.repeat(64),
          signatureTypedName: 'John Doe',
          signatureCheckbox: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Please complete your realtor profile before accepting referrals');
    });

    it('should successfully accept referral and create new agreement', async () => {
      mockGetSessionWithRole.mockResolvedValue({ user: { id: 'user-456' } });
      mockQueryDocuments
        .mockResolvedValueOnce([{
          id: 'agreement-123',
          realtorUserId: 'user-123',
          realtorName: 'Agent A',
          realtorEmail: 'agenta@example.com',
          realtorPhone: '555-1234',
          realtorCompany: 'A Realty',
          buyerId: 'buyer-789',
          buyerFirstName: 'John',
          buyerLastName: 'Smith',
          buyerEmail: 'buyer@example.com',
          buyerPhone: '555-5678',
          buyerCity: 'Austin',
          buyerState: 'TX',
          referralInviteExpiresAt: createMockTimestamp(new Date('2030-01-01')),
          referralInviteFeePercent: 25,
          expirationDate: createMockTimestamp(new Date('2030-01-01')),
          canBeReReferred: true,
        }])
        .mockResolvedValueOnce([]); // No existing agreements

      // Agent B profile
      mockGetDocument
        .mockResolvedValueOnce({
          email: 'agentb@example.com',
          realtorData: {
            firstName: 'Jane',
            lastName: 'Doe',
            company: 'B Realty',
            licenseNumber: 'LIC123',
            phone: '555-9999',
          },
        })
        // Agent A profile (for referringAgent details)
        .mockResolvedValueOnce({
          email: 'agenta@example.com',
          realtorData: {
            firstName: 'Agent',
            lastName: 'A',
            company: 'A Realty',
          },
        });

      mockCreateDocument.mockResolvedValue({ id: 'new-agreement-789' });
      mockUpdateDocument.mockResolvedValue(undefined);

      const request = createRequest('/api/realtor/referral/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Test Browser',
        },
        body: JSON.stringify({
          token: 'a'.repeat(64),
          signatureTypedName: 'Jane Doe',
          signatureCheckbox: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.agreementId).toBe('new-agreement-789');
      expect(data.leadDetails.firstName).toBe('John');
      expect(data.leadDetails.lastName).toBe('Smith');
      expect(data.leadDetails.email).toBe('buyer@example.com');

      // Verify create was called with correct data
      expect(mockCreateDocument).toHaveBeenCalledWith(
        'referralAgreements',
        expect.objectContaining({
          realtorUserId: 'user-456',
          buyerId: 'buyer-789',
          isReReferral: true,
          canBeReReferred: false,
          status: 'signed',
          leadInfoReleased: true,
        })
      );

      // Verify original agreement was updated
      expect(mockUpdateDocument).toHaveBeenCalledWith(
        'referralAgreements',
        'agreement-123',
        expect.objectContaining({
          canBeReReferred: false,
          reReferredToAgreementId: 'new-agreement-789',
          referralInviteToken: null,
        })
      );
    });
  });
});
