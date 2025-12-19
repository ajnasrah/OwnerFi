// GENERATE REFERRAL AGREEMENT API (RF-701)
// Creates an auto-filled Tennessee REALTORS® Referral Agreement when realtor wants to accept a lead

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { FirebaseDB } from '@/lib/firebase-db';
import { Timestamp } from 'firebase/firestore';
import { logError, logInfo } from '@/lib/logger';
import { generateAgreementNumber, COLLECTIONS } from '@/lib/firebase-models';
import {
  generateAgreementText,
  generateAgreementHTML,
  REFERRING_COMPANY_DEFAULTS,
  calculateExpirationDate,
  formatCurrentDate,
  AgreementTemplateData
} from '@/lib/referral-agreement-template';

interface GenerateAgreementRequest {
  leadId: string;
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

    const body = await request.json() as GenerateAgreementRequest;
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    // Get user document with embedded realtor data
    const userData = await FirebaseDB.getDocument('users', session.user.id);
    const user = userData as {
      role: string;
      email: string;
      realtorData?: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        company?: string;
        licenseNumber?: string;
        credits?: number;
        serviceArea?: {
          primaryCity?: {
            stateCode?: string;
          };
        };
      };
    };

    if (!user || user.role !== 'realtor' || !user.realtorData) {
      return NextResponse.json(
        { error: 'Realtor profile not found' },
        { status: 400 }
      );
    }

    // Get buyer details
    const buyerData = await FirebaseDB.getDocument('buyerProfiles', leadId);
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
    };

    if (!buyer) {
      return NextResponse.json(
        { error: 'Buyer lead not found' },
        { status: 404 }
      );
    }

    // Check if buyer is still available
    if (buyer.isAvailableForPurchase === false) {
      return NextResponse.json(
        { error: 'This buyer lead is no longer available' },
        { status: 400 }
      );
    }

    // Check for existing pending or signed agreement for THIS lead from THIS realtor
    const myExistingAgreements = await FirebaseDB.queryDocuments(
      COLLECTIONS.REFERRAL_AGREEMENTS,
      [
        { field: 'realtorUserId', operator: '==', value: session.user.id },
        { field: 'buyerId', operator: '==', value: leadId },
        { field: 'status', operator: 'in', value: ['pending', 'signed'] }
      ]
    );

    if (myExistingAgreements.length > 0) {
      const existing = myExistingAgreements[0] as { id: string; status: string };
      return NextResponse.json(
        {
          error: 'You already have an agreement for this lead',
          existingAgreementId: existing.id,
          status: existing.status
        },
        { status: 400 }
      );
    }

    // CRITICAL: Check if ANY other realtor has already claimed this buyer
    const anyExistingAgreements = await FirebaseDB.queryDocuments(
      COLLECTIONS.REFERRAL_AGREEMENTS,
      [
        { field: 'buyerId', operator: '==', value: leadId },
        { field: 'status', operator: 'in', value: ['pending', 'signed'] }
      ]
    );

    if (anyExistingAgreements.length > 0) {
      return NextResponse.json(
        { error: 'This lead has already been claimed by another realtor' },
        { status: 400 }
      );
    }

    // Check pending agreement limit (3 free pending leads at a time)
    const FREE_PENDING_LIMIT = 3;
    const pendingAgreements = await FirebaseDB.queryDocuments(
      COLLECTIONS.REFERRAL_AGREEMENTS,
      [
        { field: 'realtorUserId', operator: '==', value: session.user.id },
        { field: 'status', operator: '==', value: 'pending' }
      ]
    );

    // Check if user has credits (paid user can bypass limit)
    const hasCredits = (user.realtorData.credits || 0) > 0;

    if (pendingAgreements.length >= FREE_PENDING_LIMIT && !hasCredits) {
      return NextResponse.json(
        {
          error: `You have reached your limit of ${FREE_PENDING_LIMIT} pending leads. Please sign your pending agreements or purchase credits to accept more leads.`,
          pendingCount: pendingAgreements.length,
          limit: FREE_PENDING_LIMIT,
          requiresUpgrade: true
        },
        { status: 400 }
      );
    }

    // Generate agreement details
    const now = Timestamp.now();
    const effectiveDate = formatCurrentDate();
    const expirationDate = calculateExpirationDate(REFERRING_COMPANY_DEFAULTS.AGREEMENT_TERM_DAYS);

    const agreementNumber = generateAgreementNumber();
    const realtorName = `${user.realtorData.firstName} ${user.realtorData.lastName}`;
    const buyerCity = buyer.preferredCity || buyer.city || '';
    const buyerState = buyer.preferredState || buyer.state || '';
    const buyerFullName = `${buyer.firstName} ${buyer.lastName}`;

    // Prepare RF-701 template data
    const templateData: AgreementTemplateData = {
      agreementNumber,
      effectiveDate,
      expirationDate,
      timeZone: REFERRING_COMPANY_DEFAULTS.TIME_ZONE,

      // Section 1: COMPANY REFERRING THE BUYER OR SELLER (eXp Realty / Abdullah)
      referringCompanyName: REFERRING_COMPANY_DEFAULTS.COMPANY_NAME,
      referringCompanyAddress: REFERRING_COMPANY_DEFAULTS.COMPANY_ADDRESS,
      referringCompanyPhone: REFERRING_COMPANY_DEFAULTS.COMPANY_PHONE,
      referringCompanyLicense: REFERRING_COMPANY_DEFAULTS.COMPANY_LICENSE,
      referringCompanyFederalId: REFERRING_COMPANY_DEFAULTS.COMPANY_FEDERAL_ID,
      referringLicenseeName: REFERRING_COMPANY_DEFAULTS.LICENSEE_NAME,
      referringLicenseePhone: REFERRING_COMPANY_DEFAULTS.LICENSEE_PHONE,
      referringLicenseeEmail: REFERRING_COMPANY_DEFAULTS.LICENSEE_EMAIL,
      referringRelocationDirector: REFERRING_COMPANY_DEFAULTS.RELOCATION_DIRECTOR,
      referringRelocationEmail: REFERRING_COMPANY_DEFAULTS.RELOCATION_EMAIL,

      // Section 2: COMPANY AGREEING TO PAY REFERRAL FEE (Realtor accepting the lead)
      receivingCompanyName: user.realtorData.company || 'Independent Agent',
      receivingCompanyAddress: '', // Realtor will fill in when signing
      receivingCompanyPhone: user.realtorData.phone,
      receivingCompanyLicense: user.realtorData.licenseNumber || '',
      receivingLicenseeName: realtorName,
      receivingLicenseePhone: user.realtorData.phone,
      receivingLicenseeEmail: user.realtorData.email,
      receivingRelocationDirector: 'N/A',
      receivingRelocationEmail: 'N/A',

      // Section 3: NAME OF PARTY BEING REFERRED (Buyer)
      prospectName: buyerFullName,
      referralType: 'buyer',
      prospectAgreedToReferral: true,

      // Section 4: REFERRAL FEE
      referralFeeFixed: REFERRING_COMPANY_DEFAULTS.REFERRAL_FEE_FIXED,
      referralFeePercent: REFERRING_COMPANY_DEFAULTS.REFERRAL_FEE_PERCENT,

      // Contact Information of Party Being Referred (hidden until signed)
      prospectCurrentAddress: `${buyerCity}, ${buyerState}`,
      prospectHomePhone: '',
      prospectWorkPhone: '',
      prospectCellPhone: '', // Hidden until signed
      prospectEmail: '', // Hidden until signed
      prospectBestTimeToCall: '',
      prospectRemarks: '',
      otherTerms: 'Owner Finance Property Buyer Lead via OwnerFi.com'
    };

    // Create agreement document in Firestore
    const agreementData = {
      agreementNumber,
      realtorUserId: session.user.id,
      buyerId: leadId,

      // Section 1: Referring Company (eXp Realty / Abdullah)
      referringCompanyName: REFERRING_COMPANY_DEFAULTS.COMPANY_NAME,
      referringCompanyAddress: REFERRING_COMPANY_DEFAULTS.COMPANY_ADDRESS,
      referringCompanyPhone: REFERRING_COMPANY_DEFAULTS.COMPANY_PHONE,
      referringCompanyLicense: REFERRING_COMPANY_DEFAULTS.COMPANY_LICENSE,
      referringLicenseeName: REFERRING_COMPANY_DEFAULTS.LICENSEE_NAME,
      referringLicenseePhone: REFERRING_COMPANY_DEFAULTS.LICENSEE_PHONE,
      referringLicenseeEmail: REFERRING_COMPANY_DEFAULTS.LICENSEE_EMAIL,

      // Section 2: Receiving Company (Realtor) - RF-701 fields
      receivingCompanyName: user.realtorData.company || 'Independent Agent',
      receivingLicenseeName: realtorName,
      receivingLicenseePhone: user.realtorData.phone,
      receivingLicenseeEmail: user.realtorData.email,
      receivingCompanyLicense: user.realtorData.licenseNumber || null,

      // Realtor fields (for interface compatibility)
      realtorName,
      realtorEmail: user.realtorData.email,
      realtorPhone: user.realtorData.phone,
      realtorCompany: user.realtorData.company || 'Independent Agent',
      realtorLicenseNumber: user.realtorData.licenseNumber || null,
      realtorLicenseState: user.realtorData.serviceArea?.primaryCity?.stateCode || 'TN',

      // Section 3: Prospect (Buyer) - RF-701 fields
      prospectName: buyerFullName,
      prospectFirstName: buyer.firstName,
      prospectLastName: buyer.lastName,
      prospectCity: buyerCity,
      prospectState: buyerState,
      prospectEmail: '', // Hidden until signed
      prospectPhone: '', // Hidden until signed
      referralType: 'buyer',

      // Buyer fields (for interface compatibility)
      buyerFirstName: buyer.firstName,
      buyerLastName: buyer.lastName,
      buyerCity: buyerCity,
      buyerState: buyerState,
      buyerEmail: '', // Hidden until signed
      buyerPhone: '', // Hidden until signed

      // Section 4: Referral Fee
      referralFeePercent: parseInt(REFERRING_COMPANY_DEFAULTS.REFERRAL_FEE_PERCENT),
      referralFeeFixed: REFERRING_COMPANY_DEFAULTS.REFERRAL_FEE_FIXED || null,

      // Section 5: Dates
      effectiveDate: now,
      expirationDate: Timestamp.fromDate(new Date(Date.now() + REFERRING_COMPANY_DEFAULTS.AGREEMENT_TERM_DAYS * 24 * 60 * 60 * 1000)),
      agreementTermDays: REFERRING_COMPANY_DEFAULTS.AGREEMENT_TERM_DAYS,
      timeZone: REFERRING_COMPANY_DEFAULTS.TIME_ZONE,

      // Status
      status: 'pending',
      signatureCheckbox: false,
      leadInfoReleased: false,

      // Timestamps
      createdAt: now,
      updatedAt: now
    };

    const agreementId = await FirebaseDB.createDocument(
      COLLECTIONS.REFERRAL_AGREEMENTS,
      agreementData
    );

    // Generate agreement text for display
    const agreementText = generateAgreementText(templateData);
    const agreementHTML = generateAgreementHTML(templateData);

    await logInfo('RF-701 Referral agreement generated', {
      action: 'agreement_generated',
      userId: session.user.id,
      metadata: {
        agreementId,
        agreementNumber,
        leadId,
        buyerName: buyerFullName,
        referralFeePercent: REFERRING_COMPANY_DEFAULTS.REFERRAL_FEE_PERCENT
      }
    });

    return NextResponse.json({
      success: true,
      agreementId,
      agreementNumber,
      agreement: {
        ...agreementData,
        id: agreementId
      },
      agreementText,
      agreementHTML,
      terms: {
        referralFeePercent: parseInt(REFERRING_COMPANY_DEFAULTS.REFERRAL_FEE_PERCENT),
        agreementTermDays: REFERRING_COMPANY_DEFAULTS.AGREEMENT_TERM_DAYS,
        expirationDate
      }
    });

  } catch (error) {
    await logError('Generate agreement failed', {
      action: 'generate_agreement_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to generate agreement. Please try again.' },
      { status: 500 }
    );
  }
}
