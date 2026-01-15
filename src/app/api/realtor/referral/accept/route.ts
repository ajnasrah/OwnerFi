/**
 * ACCEPT REFERRAL API
 *
 * Agent B views and accepts a referral from Agent A.
 * Creates a new agreement between Agent B and Agent A (with OwnerFi getting their cut).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { FirebaseDB } from '@/lib/firebase-db';
import { COLLECTIONS, ReferralAgreement, generateAgreementNumber } from '@/lib/firebase-models';
import { Timestamp } from 'firebase/firestore';
import { logInfo, logError } from '@/lib/logger';

const OWNERFI_CUT_PERCENT = 30;
const DEFAULT_AGREEMENT_TERM_DAYS = 180;

// GET: View referral details (can be called without auth to preview)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Invite token is required' },
        { status: 400 }
      );
    }

    // Validate token format (64 hex characters)
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json(
        { error: 'Invalid invite link' },
        { status: 400 }
      );
    }

    // Find the original agreement by invite token
    const agreements = await FirebaseDB.queryDocuments(
      COLLECTIONS.REFERRAL_AGREEMENTS,
      [{ field: 'referralInviteToken', operator: '==', value: token }]
    );

    if (agreements.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired invite link' },
        { status: 404 }
      );
    }

    const originalAgreement = agreements[0] as ReferralAgreement & {
      id: string;
      referralInviteFeePercent?: number;
      referralInviteExpiresAt?: { toDate: () => Date };
    };

    // Check if invite has expired
    if (originalAgreement.referralInviteExpiresAt) {
      const expiresAt = originalAgreement.referralInviteExpiresAt.toDate();
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'This invite link has expired' },
          { status: 410 }
        );
      }
    }

    // Get referring agent (Agent A) details
    const referringAgent = await FirebaseDB.getDocument('users', originalAgreement.realtorUserId);
    const referringAgentData = referringAgent as {
      email: string;
      realtorData?: {
        firstName?: string;
        lastName?: string;
        company?: string;
        licenseNumber?: string;
        phone?: string;
      };
    } | null;

    // Return lead preview (masked contact info for non-authenticated users)
    const maskedLastName = originalAgreement.buyerLastName
      ? originalAgreement.buyerLastName.charAt(0) + '***'
      : '***';

    // Build referring agent name safely (handle null agent or empty names)
    let referringAgentName = 'Agent';
    if (referringAgentData?.realtorData) {
      const firstName = referringAgentData.realtorData.firstName?.trim() || '';
      const lastName = referringAgentData.realtorData.lastName?.trim() || '';
      if (firstName || lastName) {
        referringAgentName = `${firstName} ${lastName}`.trim();
      }
    }

    return NextResponse.json({
      success: true,
      referral: {
        // Lead info (partially masked)
        buyerFirstName: originalAgreement.buyerFirstName || 'Unknown',
        buyerLastName: maskedLastName,
        buyerCity: originalAgreement.buyerCity || 'Unknown',
        buyerState: originalAgreement.buyerState || '',
        // Referring agent info
        referringAgentName,
        referringAgentCompany: referringAgentData?.realtorData?.company || '',
        // Agreement terms
        referralFeePercent: originalAgreement.referralInviteFeePercent || 25,
        ownerFiCutPercent: OWNERFI_CUT_PERCENT,
        agreementTermDays: DEFAULT_AGREEMENT_TERM_DAYS,
        // Invite status
        expiresAt: originalAgreement.referralInviteExpiresAt?.toDate().toISOString() || null
      }
    });

  } catch (error) {
    await logError('Failed to get referral details', {
      action: 'referral_view_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to load referral details' },
      { status: 500 }
    );
  }
}

// POST: Accept the referral and create new agreement
// Agent B must be logged in - their info comes from their profile
export async function POST(request: NextRequest) {
  try {
    // Agent B must be authenticated
    const session = await getSessionWithRole('realtor');

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'You must be logged in as a realtor to accept this referral. Please sign up or log in first.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      token,
      signatureTypedName,
      signatureCheckbox
    } = body;

    // Validate required fields and types
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Invite token is required' },
        { status: 400 }
      );
    }

    // Validate token format (64 hex characters)
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json(
        { error: 'Invalid invite token format' },
        { status: 400 }
      );
    }

    if (!signatureTypedName || typeof signatureTypedName !== 'string' || signatureCheckbox !== true) {
      return NextResponse.json(
        { error: 'Signature is required to accept the referral' },
        { status: 400 }
      );
    }

    // Validate signature name is reasonable (at least 2 characters, not just whitespace)
    const trimmedSignature = signatureTypedName.trim();
    if (trimmedSignature.length < 2) {
      return NextResponse.json(
        { error: 'Please enter your full name to sign the agreement' },
        { status: 400 }
      );
    }

    // Find the original agreement by invite token
    const agreements = await FirebaseDB.queryDocuments(
      COLLECTIONS.REFERRAL_AGREEMENTS,
      [{ field: 'referralInviteToken', operator: '==', value: token }]
    );

    if (agreements.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired invite link' },
        { status: 404 }
      );
    }

    const originalAgreement = agreements[0] as ReferralAgreement & {
      id: string;
      referralInviteFeePercent?: number;
      referralInviteExpiresAt?: { toDate: () => Date };
    };

    // Check expiry
    if (originalAgreement.referralInviteExpiresAt) {
      const expiresAt = originalAgreement.referralInviteExpiresAt.toDate();
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'This invite link has expired' },
          { status: 410 }
        );
      }
    }

    // Prevent self-referral
    if (originalAgreement.realtorUserId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot accept your own referral' },
        { status: 400 }
      );
    }

    // Check if original agreement has expired (can't refer from expired agreement)
    if (originalAgreement.expirationDate) {
      const agreementExpires = (originalAgreement.expirationDate as unknown as { toDate: () => Date }).toDate();
      if (agreementExpires < new Date()) {
        return NextResponse.json(
          { error: 'The original agreement has expired. This referral is no longer valid.' },
          { status: 410 }
        );
      }
    }

    // Check if this referral was already accepted by someone (race condition prevention)
    // Note: We found this agreement by token, but if canBeReReferred is false,
    // someone else already accepted in a race condition scenario
    if (originalAgreement.canBeReReferred === false) {
      return NextResponse.json(
        { error: 'This referral has already been accepted by another agent' },
        { status: 409 }
      );
    }

    // Check if Agent B already has an agreement with this buyer
    const existingAgreements = await FirebaseDB.queryDocuments(
      COLLECTIONS.REFERRAL_AGREEMENTS,
      [
        { field: 'realtorUserId', operator: '==', value: session.user.id },
        { field: 'buyerId', operator: '==', value: originalAgreement.buyerId }
      ]
    );

    if (existingAgreements.length > 0) {
      return NextResponse.json(
        { error: 'You already have an agreement with this buyer' },
        { status: 400 }
      );
    }

    // Get Agent B's info from their profile
    const agentBData = await FirebaseDB.getDocument('users', session.user.id);
    const agentB = agentBData as {
      email: string;
      phone?: string;
      realtorData?: {
        firstName?: string;
        lastName?: string;
        company?: string;
        licenseNumber?: string;
        licenseState?: string;
        phone?: string;
      };
    } | null;

    if (!agentB?.realtorData?.firstName?.trim() || !agentB?.realtorData?.lastName?.trim()) {
      return NextResponse.json(
        { error: 'Please complete your realtor profile before accepting referrals' },
        { status: 400 }
      );
    }

    const agentBUserId = session.user.id;

    // Get Agent A's details
    const agentAData = await FirebaseDB.getDocument('users', originalAgreement.realtorUserId);
    const agentA = agentAData as {
      email: string;
      phone?: string;
      realtorData?: {
        firstName?: string;
        lastName?: string;
        company?: string;
        licenseNumber?: string;
        phone?: string;
      };
    } | null;

    // Build referring agent name safely (handle null agent or empty names)
    let referringAgentNameForAgreement = originalAgreement.realtorName || 'Agent';
    if (agentA?.realtorData) {
      const firstName = agentA.realtorData.firstName?.trim() || '';
      const lastName = agentA.realtorData.lastName?.trim() || '';
      if (firstName || lastName) {
        referringAgentNameForAgreement = `${firstName} ${lastName}`.trim();
      }
    }

    const now = Timestamp.now();
    const effectiveDate = now;
    const expirationDate = Timestamp.fromDate(
      new Date(Date.now() + DEFAULT_AGREEMENT_TERM_DAYS * 24 * 60 * 60 * 1000)
    );

    // Create new agreement for Agent B (re-referral)
    const newAgreement: Omit<ReferralAgreement, 'id'> = {
      agreementNumber: generateAgreementNumber(),

      // Agent B is the realtor on this agreement
      realtorUserId: agentBUserId,
      buyerId: originalAgreement.buyerId,

      // Agent B's details (from their profile)
      realtorName: `${agentB.realtorData.firstName.trim()} ${agentB.realtorData.lastName.trim()}`,
      realtorEmail: agentB.email,
      realtorPhone: agentB.realtorData.phone || agentB.phone || '',
      realtorCompany: agentB.realtorData.company || '',
      realtorLicenseNumber: agentB.realtorData.licenseNumber || '',
      realtorLicenseState: agentB.realtorData.licenseState || '',

      // Buyer/Lead details (from original agreement)
      buyerFirstName: originalAgreement.buyerFirstName,
      buyerLastName: originalAgreement.buyerLastName,
      buyerEmail: originalAgreement.buyerEmail,
      buyerPhone: originalAgreement.buyerPhone,
      buyerCity: originalAgreement.buyerCity,
      buyerState: originalAgreement.buyerState,

      // Agreement terms
      referralFeePercent: originalAgreement.referralInviteFeePercent || 25,
      agreementTermDays: DEFAULT_AGREEMENT_TERM_DAYS,
      effectiveDate,
      expirationDate,

      // Already signed
      status: 'signed',
      signedAt: now,
      signatureTypedName: trimmedSignature,
      signatureCheckbox: true,
      signatureIpAddress: (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim() || 'unknown',
      signatureUserAgent: request.headers.get('user-agent')?.trim() || 'unknown',

      // Lead info released since signing
      leadInfoReleased: true,
      leadReleasedAt: now,

      // Re-referral tracking
      isReReferral: true,
      originalAgreementId: originalAgreement.id,
      referringAgentId: originalAgreement.realtorUserId,
      referringAgentName: referringAgentNameForAgreement,
      referringAgentEmail: agentA?.email || originalAgreement.realtorEmail,
      referringAgentPhone: agentA?.realtorData?.phone || originalAgreement.realtorPhone,
      referringAgentCompany: agentA?.realtorData?.company || originalAgreement.realtorCompany,
      referringAgentLicenseNumber: agentA?.realtorData?.licenseNumber || originalAgreement.realtorLicenseNumber,
      ownerFiCutPercent: OWNERFI_CUT_PERCENT,

      // Cannot be re-referred again
      canBeReReferred: false,

      createdAt: now,
      updatedAt: now
    };

    // Create the new agreement
    const createdAgreement = await FirebaseDB.createDocument(
      COLLECTIONS.REFERRAL_AGREEMENTS,
      newAgreement
    );

    // Update original agreement to mark it as re-referred and clear invite token (single update for efficiency)
    await FirebaseDB.updateDocument(COLLECTIONS.REFERRAL_AGREEMENTS, originalAgreement.id, {
      canBeReReferred: false,
      reReferredToAgreementId: createdAgreement.id,
      reReferredToAgentId: agentBUserId,
      reReferredAt: now,
      referralInviteToken: null, // Clear so it can't be used again
      updatedAt: now
    });

    await logInfo('Referral accepted', {
      action: 'referral_accepted',
      userId: agentBUserId,
      metadata: {
        newAgreementId: createdAgreement.id,
        originalAgreementId: originalAgreement.id,
        referringAgentId: originalAgreement.realtorUserId,
        referralFeePercent: newAgreement.referralFeePercent,
        agentBEmail: agentB.email
      }
    });

    return NextResponse.json({
      success: true,
      agreementId: createdAgreement.id,
      userId: agentBUserId,
      message: 'Referral accepted! The lead has been added to your account.',
      leadDetails: {
        firstName: originalAgreement.buyerFirstName,
        lastName: originalAgreement.buyerLastName,
        email: originalAgreement.buyerEmail,
        phone: originalAgreement.buyerPhone,
        city: originalAgreement.buyerCity,
        state: originalAgreement.buyerState
      }
    });

  } catch (error) {
    await logError('Failed to accept referral', {
      action: 'referral_accept_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to accept referral' },
      { status: 500 }
    );
  }
}
