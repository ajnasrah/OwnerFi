// SIGN REFERRAL AGREEMENT API
// Handles signature submission and releases lead contact info

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { FirebaseDB } from '@/lib/firebase-db';
import { Timestamp } from 'firebase/firestore';
import { logError, logInfo } from '@/lib/logger';
import { COLLECTIONS } from '@/lib/firebase-models';

interface SignAgreementRequest {
  agreementId: string;
  typedName: string;      // Realtor types their full legal name
  agreeToTerms: boolean;  // Checkbox confirmation
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionWithRole('realtor');

    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as SignAgreementRequest;
    const { agreementId, typedName, agreeToTerms } = body;

    // Validate input
    if (!agreementId) {
      return NextResponse.json(
        { error: 'Agreement ID is required' },
        { status: 400 }
      );
    }

    if (!typedName || typedName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Please type your full legal name to sign' },
        { status: 400 }
      );
    }

    if (!agreeToTerms) {
      return NextResponse.json(
        { error: 'You must agree to the terms to proceed' },
        { status: 400 }
      );
    }

    // Get the agreement
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

    const agreement = agreementData as {
      realtorUserId: string;
      buyerId: string;
      realtorName: string;
      status: string;
      expirationDate: { toDate: () => Date };
    };

    // Verify ownership
    if (agreement.realtorUserId !== session.user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to sign this agreement' },
        { status: 403 }
      );
    }

    // Check status
    if (agreement.status !== 'pending') {
      return NextResponse.json(
        { error: `This agreement is already ${agreement.status}` },
        { status: 400 }
      );
    }

    // Check if expired (handle missing expirationDate for older agreements)
    const now = new Date();
    let expirationDate: Date;
    try {
      expirationDate = agreement.expirationDate?.toDate?.()
        || (agreement.expirationDate instanceof Date ? agreement.expirationDate : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // Default 30 days if missing
    } catch {
      // If expirationDate parsing fails, default to 30 days from now
      expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    if (now > expirationDate) {
      // Update status to expired
      await FirebaseDB.updateDocument(COLLECTIONS.REFERRAL_AGREEMENTS, agreementId, {
        status: 'expired',
        updatedAt: Timestamp.now()
      });

      return NextResponse.json(
        { error: 'This agreement has expired' },
        { status: 400 }
      );
    }

    // Get the buyer's full contact info to release
    const buyerData = await FirebaseDB.getDocument('buyerProfiles', agreement.buyerId);
    const buyer = buyerData as {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      preferredCity?: string;
      city?: string;
      preferredState?: string;
      state?: string;
    };

    if (!buyer) {
      return NextResponse.json(
        { error: 'Buyer information not found' },
        { status: 404 }
      );
    }

    // Get IP and user agent for signature record
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const signedAt = Timestamp.now();

    // Update agreement with signature and release lead info
    await FirebaseDB.updateDocument(COLLECTIONS.REFERRAL_AGREEMENTS, agreementId, {
      status: 'signed',
      signedAt,
      signatureTypedName: typedName.trim(),
      signatureCheckbox: true,
      signatureIpAddress: ipAddress,
      signatureUserAgent: userAgent,

      // Release full prospect (buyer) contact info - RF-701 fields
      prospectEmail: buyer.email,
      prospectPhone: buyer.phone,
      prospectCellPhone: buyer.phone,

      // Release buyer contact info - interface fields
      buyerEmail: buyer.email,
      buyerPhone: buyer.phone,

      leadInfoReleased: true,
      leadReleasedAt: signedAt,

      updatedAt: signedAt
    });

    // Mark buyer as no longer available for purchase
    await FirebaseDB.updateDocument('buyerProfiles', agreement.buyerId, {
      isAvailableForPurchase: false,
      purchasedBy: session.user.id,
      purchasedAt: signedAt,
      updatedAt: signedAt
    });

    // Create a lead purchase record for tracking (for compatibility)
    const purchaseData = {
      realtorUserId: session.user.id,
      buyerId: agreement.buyerId,
      buyerName: `${buyer.firstName} ${buyer.lastName}`,
      buyerCity: buyer.preferredCity || buyer.city,
      buyerState: buyer.preferredState || buyer.state,
      creditsCost: 0, // No credits used - agreement based
      purchasePrice: 0,
      status: 'purchased',
      agreementId, // Link to the referral agreement
      purchasedAt: signedAt,
      createdAt: signedAt
    };

    await FirebaseDB.createDocument('leadPurchases', purchaseData);

    // Create transaction record
    const transactionData = {
      realtorUserId: session.user.id,
      type: 'agreement_signed',
      description: `Signed referral agreement for ${buyer.firstName} ${buyer.lastName}`,
      creditsChange: 0,
      runningBalance: 0, // Will be updated if credits system still used
      relatedId: agreementId,
      details: {
        buyerName: `${buyer.firstName} ${buyer.lastName}`,
        buyerCity: buyer.preferredCity || buyer.city,
        agreementId
      },
      createdAt: signedAt
    };

    await FirebaseDB.createDocument('realtorTransactions', transactionData);

    await logInfo('Referral agreement signed', {
      action: 'agreement_signed',
      userId: session.user.id,
      metadata: {
        agreementId,
        buyerId: agreement.buyerId,
        buyerName: `${buyer.firstName} ${buyer.lastName}`,
        typedName,
        ipAddress
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Agreement signed successfully! Lead contact information has been released.',
      agreementId,
      buyerDetails: {
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        email: buyer.email,
        phone: buyer.phone,
        city: buyer.preferredCity || buyer.city,
        state: buyer.preferredState || buyer.state
      },
      signedAt: signedAt.toDate().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Sign agreement failed:', errorMessage, error);

    await logError('Sign agreement failed', {
      action: 'sign_agreement_error',
      metadata: { errorMessage }
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to sign agreement. Please try again.', details: errorMessage },
      { status: 500 }
    );
  }
}
