// SIGN REFERRAL AGREEMENT API
// Handles signature submission and releases lead contact info
// CRITICAL: Includes safety checks to prevent signing for already-purchased leads

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { FirebaseDB } from '@/lib/firebase-db';
import { Timestamp } from 'firebase/firestore';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { COLLECTIONS } from '@/lib/firebase-models';
import {
  generateExpReferralAgreementHTML,
  PLATFORM_ORIGINATING_AGENT,
  PLATFORM_REFERRAL_DEFAULTS,
  formatCurrentDate,
  calculateExpirationDate,
} from '@/lib/referral-agreement-template';

interface SignAgreementRequest {
  agreementId: string;
  typedName: string;           // Realtor types their full legal name
  agreeToTerms: boolean;       // Checkbox: Agree to referral agreement terms
  agreeTCPA: boolean;          // Checkbox: Acknowledge TCPA compliance
  agreeCreativeFinance: boolean; // Checkbox: Acknowledge creative finance disclaimer
  agreeDataAsIs: boolean;      // Checkbox: Accept data as-is
}

export async function POST(request: NextRequest) {
  try {
    let session;
    try {
      session = await getSessionWithRole('realtor');
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : 'Not authenticated';
      return NextResponse.json(
        { error: message },
        { status: 401 }
      );
    }

    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as SignAgreementRequest;
    const { agreementId, typedName, agreeToTerms, agreeTCPA, agreeCreativeFinance, agreeDataAsIs } = body;

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
        { error: 'You must agree to the referral agreement terms to proceed' },
        { status: 400 }
      );
    }

    if (!agreeTCPA) {
      return NextResponse.json(
        { error: 'You must acknowledge the TCPA Compliance Agreement to proceed' },
        { status: 400 }
      );
    }

    if (!agreeCreativeFinance) {
      return NextResponse.json(
        { error: 'You must acknowledge the Creative Finance Disclaimer to proceed' },
        { status: 400 }
      );
    }

    if (!agreeDataAsIs) {
      return NextResponse.json(
        { error: 'You must accept that lead data is provided as-is to proceed' },
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

    // Check if expired - never auto-extend with a fallback date
    const now = new Date();
    let expirationDate: Date | null;
    try {
      expirationDate = agreement.expirationDate?.toDate?.()
        || (agreement.expirationDate instanceof Date ? agreement.expirationDate : null);
    } catch {
      expirationDate = null;
    }

    if (!expirationDate) {
      return NextResponse.json(
        { error: 'Agreement has no valid expiration date' },
        { status: 400 }
      );
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
      isAvailableForPurchase?: boolean;
      purchasedBy?: string;
      profileComplete?: boolean;
      isActive?: boolean;
      tcpaRevokedAt?: unknown;
      optedOutAt?: unknown;
    };

    if (!buyer) {
      return NextResponse.json(
        { error: 'Buyer information not found' },
        { status: 404 }
      );
    }

    // CRITICAL: Check if lead was already purchased by someone else (race condition protection)
    if (buyer.isAvailableForPurchase === false && buyer.purchasedBy && buyer.purchasedBy !== session.user.id) {
      await logWarn('Attempted to sign agreement for already-purchased lead', {
        action: 'sign_agreement_conflict',
        userId: session.user.id,
        metadata: {
          agreementId,
          buyerId: agreement.buyerId,
          purchasedBy: buyer.purchasedBy
        }
      });
      return NextResponse.json(
        { error: 'This lead has already been claimed by another realtor. The agreement cannot be completed.' },
        { status: 409 }
      );
    }

    // Reject sign if buyer profile is incomplete or opted out. Sign reveals
    // buyer contact info, so these guards prevent leaking a half-formed or
    // legally-unavailable lead to a realtor.
    if (buyer.profileComplete !== true) {
      return NextResponse.json(
        { error: 'Buyer profile is incomplete. Agreement cannot be completed.' },
        { status: 400 }
      );
    }
    if (buyer.isActive === false) {
      return NextResponse.json(
        { error: 'Buyer is no longer active. Agreement cannot be completed.' },
        { status: 400 }
      );
    }
    if (buyer.tcpaRevokedAt || buyer.optedOutAt) {
      return NextResponse.json(
        { error: 'Buyer has opted out. Agreement cannot be completed.' },
        { status: 400 }
      );
    }

    // Check for existing leadPurchase to prevent duplicates
    const existingPurchases = await FirebaseDB.queryDocuments(
      'leadPurchases',
      [
        { field: 'buyerId', operator: '==', value: agreement.buyerId },
        { field: 'status', operator: '==', value: 'purchased' }
      ]
    );

    if (existingPurchases.length > 0) {
      const existingPurchase = existingPurchases[0] as { realtorUserId: string };
      if (existingPurchase.realtorUserId !== session.user.id) {
        await logWarn('Attempted to sign agreement for lead with existing purchase record', {
          action: 'sign_agreement_duplicate_purchase',
          userId: session.user.id,
          metadata: {
            agreementId,
            buyerId: agreement.buyerId,
            existingPurchaseOwner: existingPurchase.realtorUserId
          }
        });
        return NextResponse.json(
          { error: 'This lead has already been purchased. The agreement cannot be completed.' },
          { status: 409 }
        );
      }
    }

    // Get IP and user agent for signature record
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const signedAt = Timestamp.now();

    // Render and freeze the signed eXp Referral Agreement HTML so the
    // signed document can be reproduced verbatim later (compliance / disputes).
    // Originating = eXp + Abdullah; Receiving = the realtor signing now.
    const signedAgreementHTML = generateExpReferralAgreementHTML({
      originating: PLATFORM_ORIGINATING_AGENT,
      receiving: {
        brokerageName: (agreement as unknown as { realtorCompany?: string }).realtorCompany || '',
        brokeragePhone: (agreement as unknown as { realtorPhone?: string }).realtorPhone || '',
        brokerageEmail: (agreement as unknown as { realtorEmail?: string }).realtorEmail || '',
        agentName: agreement.realtorName,
        officeAddress: '',
        agentPhone: (agreement as unknown as { realtorPhone?: string }).realtorPhone || '',
        agentEmail: (agreement as unknown as { realtorEmail?: string }).realtorEmail || '',
        managingBrokerName: '',
      },
      client: {
        type: 'buying',
        names: `${buyer.firstName} ${buyer.lastName}`,
        address: `${buyer.preferredCity || buyer.city || ''}${(buyer.preferredState || buyer.state) ? ', ' + (buyer.preferredState || buyer.state) : ''}`,
        phone: buyer.phone,
        email: buyer.email,
      },
      fee: {
        percent: PLATFORM_REFERRAL_DEFAULTS.REFERRAL_FEE_PERCENT,
        scope: PLATFORM_REFERRAL_DEFAULTS.FEE_SCOPE,
        paymentDays: PLATFORM_REFERRAL_DEFAULTS.PAYMENT_DAYS,
        additionalTerms: '',
      },
      period: {
        validTransactions: PLATFORM_REFERRAL_DEFAULTS.VALID_TRANSACTIONS,
        beginDate: formatCurrentDate(),
        expireDate: calculateExpirationDate(PLATFORM_REFERRAL_DEFAULTS.AGREEMENT_TERM_DAYS),
      },
    });

    // Update agreement with signature, platform acknowledgments, and release lead info
    await FirebaseDB.updateDocument(COLLECTIONS.REFERRAL_AGREEMENTS, agreementId, {
      status: 'signed',
      signedAt,
      signatureTypedName: typedName.trim(),
      signatureCheckbox: true,
      signatureIpAddress: ipAddress,
      signatureUserAgent: userAgent,
      signedAgreementHTML,

      // Platform usage acknowledgments — separate from the brokerage agreement.
      // The agreement document itself is the standard eXp Tennessee Referral
      // Agreement (no OwnerFi Addendum). These three flags record consent to
      // platform-level terms (/tcpa-compliance, /creative-finance-disclaimer,
      // and the data-as-is platform term).
      acknowledgeTCPA: true,
      acknowledgeTCPAAt: signedAt,
      acknowledgeCreativeFinance: true,
      acknowledgeCreativeFinanceAt: signedAt,
      acknowledgeDataAsIs: true,
      acknowledgeDataAsIsAt: signedAt,

      // Release full prospect (buyer) contact info
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

    // Create a lead purchase record for tracking (for compatibility) - only if one doesn't already exist
    const myExistingPurchase = existingPurchases.find(
      (p) => (p as { realtorUserId: string }).realtorUserId === session.user.id
    );

    if (!myExistingPurchase) {
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
    }

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
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Sign agreement failed:', errorMessage, '\nStack:', errorStack);

    try {
      await logError('Sign agreement failed', {
        action: 'sign_agreement_error',
        metadata: { errorMessage, errorStack: errorStack?.slice(0, 500) }
      }, error as Error);
    } catch {
      // Don't let logging failure mask the real error
    }

    return NextResponse.json(
      { error: 'Failed to sign agreement. Please try again.', details: errorMessage, stack: errorStack?.slice(0, 500) },
      { status: 500 }
    );
  }
}
