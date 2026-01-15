/**
 * CREATE REFERRAL INVITE API
 *
 * Agent A (who has a signed agreement) creates an invite link to refer the lead to Agent B.
 * The link contains a token that Agent B can use to view the lead and sign their own agreement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { FirebaseDB } from '@/lib/firebase-db';
import { COLLECTIONS, ReferralAgreement, generateAgreementNumber } from '@/lib/firebase-models';
import { Timestamp } from 'firebase/firestore';
import { logInfo, logError } from '@/lib/logger';
import crypto from 'crypto';

const OWNERFI_CUT_PERCENT = 30; // OwnerFi gets 30% of what referring agent makes
const INVITE_EXPIRY_DAYS = 30; // Invite link valid for 30 days

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionWithRole('realtor');

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      agreementId,           // The original agreement Agent A has
      referralFeePercent,    // What Agent A wants to charge Agent B (e.g., 25%)
      agentBEmail            // Optional: Agent B's email to send invite
    } = body;

    if (!agreementId) {
      return NextResponse.json(
        { error: 'Agreement ID is required' },
        { status: 400 }
      );
    }

    if (!referralFeePercent || referralFeePercent < 1 || referralFeePercent > 50) {
      return NextResponse.json(
        { error: 'Referral fee must be between 1% and 50%' },
        { status: 400 }
      );
    }

    // Get the original agreement
    const agreementData = await FirebaseDB.getDocument(
      COLLECTIONS.REFERRAL_AGREEMENTS,
      agreementId
    );

    if (!agreementData) {
      return NextResponse.json(
        { error: 'Agreement not found' },
        { status: 404 }
      );
    }

    const agreement = agreementData as ReferralAgreement & { id: string };

    // Verify Agent A owns this agreement
    if (agreement.realtorUserId !== session.user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to refer this lead' },
        { status: 403 }
      );
    }

    // Verify agreement is signed
    if (agreement.status !== 'signed') {
      return NextResponse.json(
        { error: 'You can only refer leads from signed agreements' },
        { status: 400 }
      );
    }

    // Check if this is already a re-referral (no triple referrals)
    if (agreement.isReReferral) {
      return NextResponse.json(
        { error: 'This lead has already been re-referred. Triple referrals are not allowed.' },
        { status: 400 }
      );
    }

    // Check if already has an active invite
    if (agreement.referralInviteToken && agreement.referralInviteExpiresAt) {
      const expiresAt = agreement.referralInviteExpiresAt as unknown as { toDate: () => Date };
      if (expiresAt.toDate() > new Date()) {
        // Return existing invite
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ownerfi.com';
        return NextResponse.json({
          success: true,
          inviteUrl: `${baseUrl}/referral/accept/${agreement.referralInviteToken}`,
          existingInvite: true,
          expiresAt: expiresAt.toDate().toISOString()
        });
      }
    }

    // Generate unique invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromDate(
      new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    );

    // Update the original agreement with invite info
    await FirebaseDB.updateDocument(COLLECTIONS.REFERRAL_AGREEMENTS, agreementId, {
      referralInviteToken: inviteToken,
      referralInviteCreatedAt: now,
      referralInviteExpiresAt: expiresAt,
      referralInviteFeePercent: referralFeePercent,
      referralInviteAgentBEmail: agentBEmail || null,
      canBeReReferred: false, // Mark as being referred
      updatedAt: now
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ownerfi.com';
    const inviteUrl = `${baseUrl}/referral/accept/${inviteToken}`;

    // If Agent B email provided, send email (in background)
    if (agentBEmail) {
      // TODO: Send email to Agent B with invite link
      // For now, just log it
      console.log(`📧 Would send referral invite to ${agentBEmail}: ${inviteUrl}`);
    }

    await logInfo('Referral invite created', {
      action: 'referral_invite_created',
      userId: session.user.id,
      metadata: {
        agreementId,
        referralFeePercent,
        agentBEmail: agentBEmail || 'not provided',
        inviteToken: inviteToken.substring(0, 8) + '...'
      }
    });

    return NextResponse.json({
      success: true,
      inviteUrl,
      inviteToken,
      referralFeePercent,
      ownerFiCutPercent: OWNERFI_CUT_PERCENT,
      expiresAt: expiresAt.toDate().toISOString(),
      message: agentBEmail
        ? `Invite link created and will be emailed to ${agentBEmail}`
        : 'Invite link created. Share it with the agent you want to refer this lead to.'
    });

  } catch (error) {
    await logError('Failed to create referral invite', {
      action: 'referral_invite_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to create referral invite' },
      { status: 500 }
    );
  }
}
