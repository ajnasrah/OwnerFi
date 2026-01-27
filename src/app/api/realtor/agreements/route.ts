// LIST REFERRAL AGREEMENTS API
// Returns all agreements for the authenticated realtor

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { FirebaseDB } from '@/lib/firebase-db';
import { logError } from '@/lib/logger';
import { COLLECTIONS, ReferralAgreement } from '@/lib/firebase-models';
import {
  generateAgreementText,
  generateAgreementHTML,
  REFERRING_COMPANY_DEFAULTS,
  AgreementTemplateData
} from '@/lib/referral-agreement-template';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionWithRole('realtor');

    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get optional status filter from query params
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const agreementId = searchParams.get('id');

    // If specific agreement ID requested, return just that one with full details
    if (agreementId) {
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

      // Verify ownership
      if (agreement.realtorUserId !== session.user.id) {
        return NextResponse.json(
          { error: 'You do not have permission to view this agreement' },
          { status: 403 }
        );
      }

      // Generate agreement text - use stored RF-701 fields or defaults
      const templateData: AgreementTemplateData = {
        agreementNumber: agreement.agreementNumber,
        effectiveDate: (agreement.effectiveDate as unknown as { toDate: () => Date }).toDate().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        expirationDate: (agreement.expirationDate as unknown as { toDate: () => Date }).toDate().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        timeZone: (agreement as unknown as { timeZone?: string }).timeZone || REFERRING_COMPANY_DEFAULTS.TIME_ZONE,

        // Section 1: Referring Company (Realtor - refers the buyer to OwnerFi)
        referringCompanyName: agreement.realtorCompany || 'Independent Agent',
        referringCompanyAddress: '',
        referringCompanyPhone: agreement.realtorPhone,
        referringCompanyLicense: agreement.realtorLicenseNumber || '',
        referringCompanyFederalId: '',
        referringLicenseeName: agreement.realtorName,
        referringLicenseePhone: agreement.realtorPhone,
        referringLicenseeEmail: agreement.realtorEmail,
        referringRelocationDirector: 'N/A',
        referringRelocationEmail: 'N/A',

        // Section 2: Receiving Company / Paying Referral Fee (OwnerFi)
        receivingCompanyName: REFERRING_COMPANY_DEFAULTS.COMPANY_NAME,
        receivingCompanyAddress: REFERRING_COMPANY_DEFAULTS.COMPANY_ADDRESS,
        receivingCompanyPhone: REFERRING_COMPANY_DEFAULTS.COMPANY_PHONE,
        receivingCompanyLicense: REFERRING_COMPANY_DEFAULTS.COMPANY_LICENSE,
        receivingLicenseeName: REFERRING_COMPANY_DEFAULTS.LICENSEE_NAME,
        receivingLicenseePhone: REFERRING_COMPANY_DEFAULTS.LICENSEE_PHONE,
        receivingLicenseeEmail: REFERRING_COMPANY_DEFAULTS.LICENSEE_EMAIL,
        receivingRelocationDirector: REFERRING_COMPANY_DEFAULTS.RELOCATION_DIRECTOR,
        receivingRelocationEmail: REFERRING_COMPANY_DEFAULTS.RELOCATION_EMAIL,

        // Section 3: Prospect (Buyer)
        prospectName: [agreement.buyerFirstName, agreement.buyerLastName].filter(Boolean).join(' ') || 'Unknown',
        referralType: 'buyer',
        prospectAgreedToReferral: true,

        // Section 4: Referral Fee
        referralFeeFixed: '',
        referralFeePercent: String(agreement.referralFeePercent),

        // Contact info (shown if released)
        prospectCurrentAddress: [agreement.buyerCity, agreement.buyerState].filter(Boolean).join(', ') || 'Unknown',
        prospectHomePhone: '',
        prospectWorkPhone: '',
        prospectCellPhone: agreement.leadInfoReleased ? (agreement.buyerPhone || '') : '',
        prospectEmail: agreement.leadInfoReleased ? (agreement.buyerEmail || '') : '',
        prospectBestTimeToCall: '',
        prospectRemarks: '',
        otherTerms: 'Owner Finance Property Buyer Lead via OwnerFi.com'
      };

      return NextResponse.json({
        success: true,
        agreement: {
          id: agreementId,
          ...agreement,
          effectiveDate: (agreement.effectiveDate as unknown as { toDate: () => Date }).toDate().toISOString(),
          expirationDate: (agreement.expirationDate as unknown as { toDate: () => Date }).toDate().toISOString(),
          signedAt: agreement.signedAt ? (agreement.signedAt as unknown as { toDate: () => Date }).toDate().toISOString() : null,
          createdAt: (agreement.createdAt as unknown as { toDate: () => Date }).toDate().toISOString(),
          updatedAt: (agreement.updatedAt as unknown as { toDate: () => Date }).toDate().toISOString()
        },
        agreementText: generateAgreementText(templateData),
        agreementHTML: generateAgreementHTML(templateData)
      });
    }

    // Build query for listing all agreements
    const queries: Array<{ field: string; operator: string; value: unknown }> = [
      { field: 'realtorUserId', operator: '==', value: session.user.id }
    ];

    if (statusFilter && ['pending', 'signed', 'expired', 'voided', 'completed'].includes(statusFilter)) {
      queries.push({ field: 'status', operator: '==', value: statusFilter });
    }

    const agreementsData = await FirebaseDB.queryDocuments(
      COLLECTIONS.REFERRAL_AGREEMENTS,
      queries as Array<{ field: string; operator: '==' | 'in' | '!=' | '<' | '<=' | '>' | '>='; value: unknown }>
    );

    // Transform and sort agreements
    const agreements = agreementsData
      .map((doc) => {
        const agreement = doc as ReferralAgreement & { id: string };
        return {
          id: agreement.id,
          agreementNumber: agreement.agreementNumber,
          status: agreement.status,
          buyerFirstName: agreement.buyerFirstName,
          buyerLastName: agreement.buyerLastName,
          buyerCity: agreement.buyerCity,
          buyerState: agreement.buyerState,
          // Only include contact info if lead was released
          buyerEmail: agreement.leadInfoReleased ? agreement.buyerEmail : null,
          buyerPhone: agreement.leadInfoReleased ? agreement.buyerPhone : null,
          referralFeePercent: agreement.referralFeePercent,
          leadInfoReleased: agreement.leadInfoReleased,
          effectiveDate: (agreement.effectiveDate as unknown as { toDate: () => Date }).toDate().toISOString(),
          expirationDate: (agreement.expirationDate as unknown as { toDate: () => Date }).toDate().toISOString(),
          signedAt: agreement.signedAt ? (agreement.signedAt as unknown as { toDate: () => Date }).toDate().toISOString() : null,
          createdAt: (agreement.createdAt as unknown as { toDate: () => Date }).toDate().toISOString(),
          // Re-referral fields
          isReReferral: agreement.isReReferral || false,
          canBeReReferred: agreement.canBeReReferred !== false, // Default to true if not set
          // Active invite info (for UI to show "View Invite" vs "Create Invite")
          hasActiveInvite: !!(
            agreement.referralInviteToken &&
            agreement.referralInviteExpiresAt &&
            (agreement.referralInviteExpiresAt as unknown as { toDate: () => Date }).toDate() > new Date()
          ),
          referralInviteFeePercent: (agreement as unknown as { referralInviteFeePercent?: number }).referralInviteFeePercent
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Get counts by status
    const statusCounts = {
      pending: 0,
      signed: 0,
      expired: 0,
      voided: 0,
      completed: 0,
      total: agreements.length
    };

    agreements.forEach((a) => {
      if (a.status in statusCounts) {
        statusCounts[a.status as keyof typeof statusCounts]++;
      }
    });

    return NextResponse.json({
      success: true,
      agreements,
      counts: statusCounts
    });

  } catch (error) {
    await logError('List agreements failed', {
      action: 'list_agreements_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to load agreements. Please try again.' },
      { status: 500 }
    );
  }
}
