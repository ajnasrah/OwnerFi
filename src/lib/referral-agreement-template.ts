// RF-701 Referral Agreement Template - Tennessee Association of REALTORS®
// Auto-filled with OwnerFi company data, realtor data, and buyer data
//
// ROLE ASSIGNMENT (Updated January 2025):
// - Section 1 (Referring Company): The Realtor who refers the buyer to OwnerFi
// - Section 2 (Receiving Company / Paying Fee): OwnerFi, who receives the referral and pays the fee

export interface AgreementTemplateData {
  agreementNumber: string;
  effectiveDate: string;
  expirationDate: string;
  timeZone: string;

  // Section 1: COMPANY REFERRING THE BUYER OR SELLER (Realtor's Brokerage)
  referringCompanyName: string;
  referringCompanyAddress: string;
  referringCompanyPhone: string;
  referringCompanyLicense: string;
  referringCompanyFederalId: string;
  referringLicenseeName: string;
  referringLicenseePhone: string;
  referringLicenseeEmail: string;
  referringRelocationDirector: string;
  referringRelocationEmail: string;

  // Section 2: COMPANY AGREEING TO PAY REFERRAL FEE (OwnerFi)
  receivingCompanyName: string;
  receivingCompanyAddress: string;
  receivingCompanyPhone: string;
  receivingCompanyLicense: string;
  receivingLicenseeName: string;
  receivingLicenseePhone: string;
  receivingLicenseeEmail: string;
  receivingRelocationDirector: string;
  receivingRelocationEmail: string;

  // Section 3: NAME OF PARTY BEING REFERRED (Buyer)
  prospectName: string;
  referralType: 'buyer' | 'seller' | 'both';
  prospectAgreedToReferral: boolean;

  // Section 4: REFERRAL FEE
  referralFeeFixed: string;
  referralFeePercent: string;

  // Contact Information of Party Being Referred
  prospectCurrentAddress: string;
  prospectHomePhone: string;
  prospectWorkPhone: string;
  prospectCellPhone: string;
  prospectEmail: string;
  prospectBestTimeToCall: string;
  prospectRemarks: string;
  otherTerms: string;
}

export function generateAgreementText(data: AgreementTemplateData): string {
  return `
TENNESSEE REALTORS® RF-701 REFERRAL AGREEMENT
Agreement Number: ${data.agreementNumber}

1. COMPANY REFERRING THE BUYER OR SELLER:
   A. Name of Company ("Referring Company"): ${data.referringCompanyName}
   B. Company Address: ${data.referringCompanyAddress}
   C. Company Phone Number: ${data.referringCompanyPhone}
   D. Company Real Estate License or Firm #: ${data.referringCompanyLicense}
   E. Company Federal ID # (for tax purposes): ${data.referringCompanyFederalId}
   F. Name of Licensee referring the Buyer or Seller: ${data.referringLicenseeName}
   G. Licensee Phone Number(s) and Email Address: ${data.referringLicenseePhone}, ${data.referringLicenseeEmail}
   H. Relocation Director Name, Contact Info and Email Address: ${data.referringRelocationDirector}, ${data.referringRelocationEmail}

2. COMPANY AGREEING TO PAY REFERRAL FEE:
   A. Name of Company ("Receiving Company"): ${data.receivingCompanyName}
   B. Company Address: ${data.receivingCompanyAddress}
   C. Company Phone Number: ${data.receivingCompanyPhone}
   D. Company Real Estate License or Firm #: ${data.receivingCompanyLicense}
   E. Name of Licensee assigned this referral: ${data.receivingLicenseeName}
   F. Licensee Phone Number(s) and Email Address: ${data.receivingLicenseePhone}, ${data.receivingLicenseeEmail}
   G. Relocation Director Name, Contact Info and Email Address: ${data.receivingRelocationDirector}, ${data.receivingRelocationEmail}

3. NAME OF PARTY BEING REFERRED:
   A. Name: ${data.prospectName} ("Prospect")
      [${data.referralType === 'buyer' ? 'X' : ' '}] Buyer Referral
      [${data.referralType === 'seller' ? 'X' : ' '}] Seller Referral
      [${data.referralType === 'both' ? 'X' : ' '}] Both - Buyer and Seller Referral
   B. Did the Buyer or Seller agree or request to be referred by your Company?
      [${data.prospectAgreedToReferral ? 'X' : ' '}] Yes  [ ] No

4. REFERRAL FEE:
   In consideration of the referral of Prospect, the Receiving Company agrees to pay the Referring Company at closing a fixed sum of $${data.referralFeeFixed} or ${data.referralFeePercent}% of the compensation paid to the Receiving Company as a percentage of the Purchase Price, a flat fee, or combination thereof (i.e., real estate commission) including bonuses, if any, which shall only be paid for the Buyer's side and/or Seller's side actually referred ("Referral Fee") pursuant to Section 3 above. Referral Fee will be paid to the Company referring the Buyer or Seller within seven (7) calendar days of receipt of compensation with a copy of a fully executed settlement statement.

5. EXPIRATION DATE:
   This Agreement begins on the last date signed below, and expires on ${data.expirationDate} at 11:59 p.m., ${data.timeZone} time zone. This Agreement will automatically extend through the term of any agency agreement entered into with the referred Buyer or Seller, or if negotiations have begun, through any closing date(s).

6. ENFORCEMENT / VENUE:
   This Agreement is intended as a contract for the referral of real estate customers. In the event all parties to this Agreement are REALTORS®, any dispute regarding this Agreement shall be governed by and in accordance with the National Association of Realtors® Code of Ethics and Arbitration Manual which is in effect at the time of the execution of this Agreement. Otherwise, any dispute regarding this Agreement shall be governed by and interpreted in accordance with the laws and in the courts of the State of Tennessee.

7. SEVERABILITY:
   If any portion or provision of this Referral Agreement is held or adjudicated to be invalid or unenforceable for any reason, each such portion or provision shall be severed from the remaining portions or provisions of this Referral Agreement, and the remaining portions or provisions shall be unaffected and remain in full force and effect.

================================================================================
                    OWNERFI ADDENDUM - REQUIRED ACKNOWLEDGMENTS
================================================================================

8. INDEMNIFICATION:
   Referring Company agrees to INDEMNIFY, DEFEND, AND HOLD HARMLESS OwnerFi, its affiliates, officers, directors, employees, and contractors from and against any and all claims, damages, fines, penalties, settlements, costs, or expenses (including reasonable attorneys' fees) arising from or related to Referring Company's interactions with the referred Prospect, including but not limited to: (a) TCPA or state telemarketing violations; (b) misrepresentation of property data; (c) transaction failures; (d) failure to verify creative finance risks; (e) any communications made to the Prospect; or (f) any claims by the Prospect arising from services rendered by the Referring Company.

9. TCPA & CONTACT COMPLIANCE:
   Referring Company acknowledges review of and agreement to OwnerFi's TCPA Compliance Agreement (available at ownerfi.ai/tcpa-compliance). Referring Company expressly agrees to: (a) comply with the federal Telephone Consumer Protection Act (TCPA), Telemarketing Sales Rule (TSR), and all applicable state telemarketing laws; (b) honor all opt-out requests within 24 hours; (c) maintain an internal Do Not Call list; (d) properly identify themselves in all communications; (e) use automated dialing/texting only in compliance with applicable laws. All communications to the Prospect are the SOLE RESPONSIBILITY of the Referring Company.

10. RESPA COMPLIANCE:
    Both parties confirm this Referral Fee complies with RESPA Section 8 and represents compensation for actual referral services rendered. Referring Company confirms: (a) no portion of the Referral Fee is passed to or influences the Prospect's selection of settlement services; (b) Referring Company will make required disclosures to the Prospect regarding the referral relationship; (c) this agreement does not constitute a kickback or unearned fee prohibited under federal law.

11. CREATIVE FINANCE ACKNOWLEDGMENT:
    Referring Company acknowledges that referred Prospects may seek owner-financed or creative finance properties. Referring Company has reviewed OwnerFi's Creative Finance Disclaimer (available at ownerfi.ai/creative-finance-disclaimer) and agrees to: (a) direct Prospects to independently verify all property and financing data with licensed professionals; (b) make no representations about creative finance structures on OwnerFi's behalf; (c) assume all liability for any Prospect losses related to creative finance transactions (including due-on-sale triggers, title issues, Dodd-Frank violations). OWNERFI BEARS ZERO LIABILITY FOR CREATIVE FINANCE OUTCOMES.

12. DATA DISCLAIMER & AS-IS ACCEPTANCE:
    Referring Company acknowledges and accepts that: (a) Prospect contact information is provided "AS-IS" from public sources, MLS data, or user submissions without independent verification by OwnerFi; (b) OwnerFi makes no warranties regarding the accuracy, completeness, or reliability of Prospect data; (c) Referring Company will independently confirm all Prospect details before proceeding; (d) OwnerFi is not liable for any inaccuracies in Prospect information or any resulting damages.

By signing this Agreement, Referring Company certifies they have read, understood, and agree to Sections 8-12 above, and have reviewed the referenced compliance documents at ownerfi.ai.

================================================================================

CONTACT INFORMATION OF PARTY BEING REFERRED:
   Name: ${data.prospectName}
   Current Address: ${data.prospectCurrentAddress}
   Home Phone: ${data.prospectHomePhone}
   Work Phone: ${data.prospectWorkPhone}
   Cell Phone: ${data.prospectCellPhone}
   Email Address: ${data.prospectEmail}
   Remarks/Best Time to Call: ${data.prospectBestTimeToCall}
   Other Terms / Relocation Company Info: ${data.otherTerms}

Copyright 2014 © Tennessee Association of Realtors®
RF701 – Referral Agreement
`.trim();
}

export function generateAgreementHTML(data: AgreementTemplateData): string {
  return `
<div style="font-family: Arial, sans-serif; line-height: 1.4; max-width: 850px; margin: 0 auto; padding: 20px; color: #333; font-size: 12px;">
  <div style="text-align: center; margin-bottom: 20px;">
    <div style="display: inline-flex; align-items: center; gap: 8px;">
      <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #34d399, #3b82f6); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
        <span style="color: white; font-weight: bold; font-size: 14px;">O</span>
      </div>
      <span style="font-size: 24px; font-weight: bold; color: #1a365d;">OwnerFi</span>
    </div>
  </div>

  <h1 style="text-align: center; font-size: 18px; font-weight: bold; margin: 10px 0;">REFERRAL AGREEMENT</h1>
  <div style="text-align: right; font-size: 11px; color: #666; margin-bottom: 15px;">Agreement #: ${data.agreementNumber}</div>

  <div style="margin: 15px 0;">
    <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px; text-transform: uppercase;">1. Company Referring the Buyer or Seller:</div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">A. Name of Company referring the Buyer or Seller ("Referring Company"):</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.referringCompanyName}</span>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">B. Company Address:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.referringCompanyAddress}</span>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">C. Company Phone Number:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.referringCompanyPhone}</span>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">D. Company Real Estate License or Firm #:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.referringCompanyLicense}</span>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">E. Company Federal ID # (for tax purposes):</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.referringCompanyFederalId}</span>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">F. Name of Licensee referring the Buyer or Seller:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.referringLicenseeName}</span>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">G. Licensee Phone Number(s) and Email Address:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.referringLicenseePhone} | ${data.referringLicenseeEmail}</span>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">H. Relocation Director Name, Contact Info and Email Address:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.referringRelocationDirector} | ${data.referringRelocationEmail}</span>
    </div>
  </div>

  <div style="margin: 15px 0;">
    <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px; text-transform: uppercase;">2. Company Agreeing to Pay Referral Fee:</div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">A. Name of Company agreeing to pay referral fee ("Receiving Company"):</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.receivingCompanyName}</span>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">B. Company Address:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.receivingCompanyAddress}</span>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">C. Company Phone Number:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.receivingCompanyPhone}</span>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">D. Company Real Estate License or Firm #:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.receivingCompanyLicense}</span>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">E. Name of Licensee assigned this referral:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.receivingLicenseeName}</span>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">F. Licensee Phone Number(s) and Email Address:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.receivingLicenseePhone} | ${data.receivingLicenseeEmail}</span>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">G. Relocation Director Name, Contact Info and Email Address:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.receivingRelocationDirector} | ${data.receivingRelocationEmail}</span>
    </div>
  </div>

  <div style="margin: 15px 0;">
    <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px; text-transform: uppercase;">3. Name of Party Being Referred:</div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">A. Name:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.prospectName}</span>
      <span style="margin-left: 10px;">("Prospect")</span>
    </div>
    <div style="margin: 8px 0; margin-left: 20px;">
      <span style="display: inline-block; width: 14px; height: 14px; border: 1px solid #333; margin-right: 5px; text-align: center; line-height: 12px; font-size: 10px; ${data.referralType === 'buyer' ? 'background: #e8f5e9;' : ''}">${data.referralType === 'buyer' ? 'X' : ''}</span> Buyer Referral
      &nbsp;&nbsp;&nbsp;
      <span style="display: inline-block; width: 14px; height: 14px; border: 1px solid #333; margin-right: 5px; text-align: center; line-height: 12px; font-size: 10px; ${data.referralType === 'seller' ? 'background: #e8f5e9;' : ''}">${data.referralType === 'seller' ? 'X' : ''}</span> Seller Referral
      &nbsp;&nbsp;&nbsp;OR&nbsp;&nbsp;&nbsp;
      <span style="display: inline-block; width: 14px; height: 14px; border: 1px solid #333; margin-right: 5px; text-align: center; line-height: 12px; font-size: 10px; ${data.referralType === 'both' ? 'background: #e8f5e9;' : ''}">${data.referralType === 'both' ? 'X' : ''}</span> Both - Buyer and Seller Referral
    </div>
    <div style="display: flex; margin: 4px 0; margin-top: 10px;">
      <span style="min-width: 280px;">B. Did the Buyer or Seller agree or request to be referred by your Company?</span>
      <span style="display: inline-block; width: 14px; height: 14px; border: 1px solid #333; margin-right: 5px; text-align: center; line-height: 12px; font-size: 10px; ${data.prospectAgreedToReferral ? 'background: #e8f5e9;' : ''}">${data.prospectAgreedToReferral ? 'X' : ''}</span> Yes
      &nbsp;&nbsp;
      <span style="display: inline-block; width: 14px; height: 14px; border: 1px solid #333; margin-right: 5px; text-align: center; line-height: 12px; font-size: 10px; ${!data.prospectAgreedToReferral ? 'background: #e8f5e9;' : ''}">${!data.prospectAgreedToReferral ? 'X' : ''}</span> No
    </div>
  </div>

  <div style="margin: 15px 0;">
    <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px; text-transform: uppercase;">4. Referral Fee:</div>
    <div style="font-size: 11px; line-height: 1.5; margin: 10px 0; text-align: justify;">
      In consideration of the referral of Prospect, the Receiving Company agrees to pay the Referring Company at closing a
      fixed sum of $<span style="border-bottom: 1px solid #333; padding: 0 5px; background: #fffef0;">${data.referralFeeFixed || '___'}</span> or
      <span style="background: #fff3cd; padding: 2px 4px; font-weight: bold;">${data.referralFeePercent}%</span> of the compensation paid to the
      Receiving Company as a percentage of the Purchase Price, a flat fee, or combination thereof (i.e., real estate commission)
      including bonuses, if any, which shall only be paid for the Buyer's side and/or Seller's side actually referred ("Referral
      Fee") pursuant to Section 3 above. Referral Fee will be paid to the Company referring the Buyer or Seller within seven
      (7) calendar days of receipt of compensation with a copy of a fully executed settlement statement.
    </div>
  </div>

  <div style="margin: 15px 0;">
    <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px; text-transform: uppercase;">5. Expiration Date:</div>
    <div style="font-size: 11px; line-height: 1.5; margin: 10px 0; text-align: justify;">
      This Agreement begins on the last date signed below, and expires on <span style="background: #fff3cd; padding: 2px 4px; font-weight: bold;">${data.expirationDate}</span> at 11:59 p.m.,
      <span style="border-bottom: 1px solid #333; padding: 0 5px; background: #fffef0;">${data.timeZone}</span> time zone. This Agreement will automatically extend through the term of any agency agreement entered
      into with the referred Buyer or Seller, or if negotiations have begun, through any closing date(s).
    </div>
  </div>

  <div style="margin: 15px 0;">
    <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px; text-transform: uppercase;">6. Enforcement / Venue:</div>
    <div style="font-size: 11px; line-height: 1.5; margin: 10px 0; text-align: justify;">
      This Agreement is intended as a contract for the referral of real estate customers. In the event all parties to this Agreement
      are REALTORS®, any dispute regarding this Agreement shall be governed by and in accordance with the National
      Association of Realtors® Code of Ethics and Arbitration Manual which is in effect at the time of the execution of this
      Agreement. Otherwise, any dispute regarding this Agreement shall be governed by and interpreted in accordance with the
      laws and in the courts of the State of Tennessee.
    </div>
  </div>

  <div style="margin: 15px 0;">
    <div style="font-weight: bold; font-size: 13px; margin-bottom: 8px; text-transform: uppercase;">7. Severability:</div>
    <div style="font-size: 11px; line-height: 1.5; margin: 10px 0; text-align: justify;">
      If any portion or provision of this Referral Agreement is held or adjudicated to be invalid or unenforceable for any reason,
      each such portion or provision shall be severed from the remaining portions or provisions of this Referral Agreement, and
      the remaining portions or provisions shall be unaffected and remain in full force and effect.
    </div>
  </div>

  <!-- OwnerFi Addendum - Liability & Compliance Provisions -->
  <div style="margin: 25px 0; border: 2px solid #dc2626; border-radius: 8px; padding: 15px; background: #fef2f2;">
    <div style="text-align: center; font-weight: bold; font-size: 14px; color: #dc2626; margin-bottom: 15px; text-transform: uppercase;">
      OwnerFi Addendum - Required Acknowledgments
    </div>

    <div style="margin: 12px 0;">
      <div style="font-weight: bold; font-size: 12px; color: #991b1b; margin-bottom: 6px;">8. INDEMNIFICATION:</div>
      <div style="font-size: 10px; line-height: 1.5; text-align: justify; color: #7f1d1d;">
        Referring Company agrees to <strong>indemnify, defend, and hold harmless</strong> OwnerFi, its affiliates, officers, directors,
        employees, and contractors from and against any and all claims, damages, fines, penalties, settlements, costs, or expenses
        (including reasonable attorneys' fees) arising from or related to Referring Company's interactions with the referred Prospect,
        including but not limited to: (a) TCPA or state telemarketing violations; (b) misrepresentation of property data; (c) transaction
        failures; (d) failure to verify creative finance risks; (e) any communications made to the Prospect; or (f) any claims by the
        Prospect arising from services rendered by the Referring Company.
      </div>
    </div>

    <div style="margin: 12px 0;">
      <div style="font-weight: bold; font-size: 12px; color: #991b1b; margin-bottom: 6px;">9. TCPA & CONTACT COMPLIANCE:</div>
      <div style="font-size: 10px; line-height: 1.5; text-align: justify; color: #7f1d1d;">
        Referring Company acknowledges review of and agreement to OwnerFi's TCPA Compliance Agreement (available at ownerfi.ai/tcpa-compliance).
        Referring Company expressly agrees to: (a) comply with the federal Telephone Consumer Protection Act (TCPA), Telemarketing Sales Rule (TSR),
        and all applicable state telemarketing laws; (b) honor all opt-out requests within 24 hours; (c) maintain an internal Do Not Call list;
        (d) properly identify themselves in all communications; (e) use automated dialing/texting only in compliance with applicable laws.
        All communications to the Prospect are the <strong>sole responsibility of the Referring Company</strong>.
      </div>
    </div>

    <div style="margin: 12px 0;">
      <div style="font-weight: bold; font-size: 12px; color: #991b1b; margin-bottom: 6px;">10. RESPA COMPLIANCE:</div>
      <div style="font-size: 10px; line-height: 1.5; text-align: justify; color: #7f1d1d;">
        Both parties confirm this Referral Fee complies with RESPA Section 8 and represents compensation for actual referral services rendered.
        Referring Company confirms: (a) no portion of the Referral Fee is passed to or influences the Prospect's selection of settlement services;
        (b) Referring Company will make required disclosures to the Prospect regarding the referral relationship; (c) this agreement does not
        constitute a kickback or unearned fee prohibited under federal law.
      </div>
    </div>

    <div style="margin: 12px 0;">
      <div style="font-weight: bold; font-size: 12px; color: #991b1b; margin-bottom: 6px;">11. CREATIVE FINANCE ACKNOWLEDGMENT:</div>
      <div style="font-size: 10px; line-height: 1.5; text-align: justify; color: #7f1d1d;">
        Referring Company acknowledges that referred Prospects may seek owner-financed or creative finance properties. Referring Company
        has reviewed OwnerFi's Creative Finance Disclaimer (available at ownerfi.ai/creative-finance-disclaimer) and agrees to: (a) direct
        Prospects to independently verify all property and financing data with licensed professionals; (b) make no representations about
        creative finance structures on OwnerFi's behalf; (c) assume all liability for any Prospect losses related to creative finance
        transactions (including due-on-sale triggers, title issues, Dodd-Frank violations). <strong>OwnerFi bears ZERO liability for creative
        finance outcomes.</strong>
      </div>
    </div>

    <div style="margin: 12px 0;">
      <div style="font-weight: bold; font-size: 12px; color: #991b1b; margin-bottom: 6px;">12. DATA DISCLAIMER & AS-IS ACCEPTANCE:</div>
      <div style="font-size: 10px; line-height: 1.5; text-align: justify; color: #7f1d1d;">
        Referring Company acknowledges and accepts that: (a) Prospect contact information is provided "AS-IS" from public sources, MLS data,
        or user submissions without independent verification by OwnerFi; (b) OwnerFi makes no warranties regarding the accuracy, completeness,
        or reliability of Prospect data; (c) Referring Company will independently confirm all Prospect details before proceeding; (d) OwnerFi
        is not liable for any inaccuracies in Prospect information or any resulting damages.
      </div>
    </div>

    <div style="margin-top: 15px; padding: 10px; background: #fee2e2; border-radius: 4px;">
      <div style="font-size: 10px; text-align: center; color: #991b1b; font-weight: bold;">
        By signing this Agreement, Referring Company certifies they have read, understood, and agree to Sections 8-12 above,
        and have reviewed the referenced compliance documents at ownerfi.ai.
      </div>
    </div>
  </div>

  <div style="margin-top: 30px; border-top: 2px solid #333; padding-top: 15px;">
    <p style="font-size: 11px; margin-bottom: 15px;"><strong>NOTE:</strong> Any provisions of this Agreement which are preceded by a box "☐" must be marked to be a part of this
    Agreement. By affixing your signature below you also acknowledge that you have reviewed each page and received a
    copy of this Agreement.</p>

    <p style="font-size: 11px; margin-bottom: 20px;">The party(ies) below have signed and acknowledge receipt of a copy.</p>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
      <div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0;"></div>
        <div style="font-size: 10px; color: #666;">BROKER FOR REFERRING COMPANY</div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0; width: 60%;"></div>
        <div style="font-size: 10px; color: #666;">Date</div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0;"></div>
        <div style="font-size: 10px; color: #666;">FIRM/COMPANY</div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0;"></div>
        <div style="font-size: 10px; color: #666;">Phone</div>
      </div>
      <div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0;"></div>
        <div style="font-size: 10px; color: #666;">LICENSEE</div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0; width: 60%;"></div>
        <div style="font-size: 10px; color: #666;">Date</div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0;"></div>
        <div style="font-size: 10px; color: #666;">PRINT/TYPE NAME</div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0;"></div>
        <div style="font-size: 10px; color: #666;">Phone</div>
      </div>
    </div>

    <p style="font-size: 11px; margin: 20px 0;">The party(ies) below have signed and acknowledge receipt of a copy.</p>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
      <div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0;"></div>
        <div style="font-size: 10px; color: #666;">BROKER FOR RECEIVING COMPANY</div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0; width: 60%;"></div>
        <div style="font-size: 10px; color: #666;">Date</div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0;"></div>
        <div style="font-size: 10px; color: #666;">FIRM/COMPANY</div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0;"></div>
        <div style="font-size: 10px; color: #666;">Phone</div>
      </div>
      <div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0;"></div>
        <div style="font-size: 10px; color: #666;">LICENSEE</div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0; width: 60%;"></div>
        <div style="font-size: 10px; color: #666;">Date</div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0;"></div>
        <div style="font-size: 10px; color: #666;">PRINT/TYPE NAME</div>
        <div style="border-bottom: 1px solid #333; height: 25px; margin: 5px 0;"></div>
        <div style="font-size: 10px; color: #666;">Phone</div>
      </div>
    </div>
  </div>

  <div style="margin-top: 25px; border: 2px solid #333; padding: 15px;">
    <div style="text-align: center; font-weight: bold; font-size: 13px; margin-bottom: 15px; text-transform: uppercase;">Contact Information of Party Being Referred<br>To Be Provided Upon Acceptance by Receiving Firm</div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">Name:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.prospectName}</span>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">Current Address:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.prospectCurrentAddress}</span>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <div style="display: flex; margin: 4px 0;">
        <span style="min-width: 100px;">Home Phone:</span>
        <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.prospectHomePhone}</span>
      </div>
      <div style="display: flex; margin: 4px 0;">
        <span style="min-width: 100px;">Work Phone:</span>
        <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.prospectWorkPhone}</span>
      </div>
      <div style="display: flex; margin: 4px 0;">
        <span style="min-width: 100px;">Cell Phone:</span>
        <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.prospectCellPhone}</span>
      </div>
      <div style="display: flex; margin: 4px 0;">
        <span style="min-width: 100px;">Email Address:</span>
        <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.prospectEmail}</span>
      </div>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">Remarks/Best Time to Call:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.prospectBestTimeToCall}</span>
    </div>
    <div style="display: flex; margin: 4px 0;">
      <span style="min-width: 280px;">Other Terms / Relocation Company Info:</span>
      <span style="flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0;">${data.otherTerms}</span>
    </div>
  </div>

  <div style="margin-top: 20px; font-size: 9px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 10px;">
    Copyright 2014 © Tennessee Association of Realtors®<br>
    RF701 – Referral Agreement
  </div>
</div>
`.trim();
}

// OwnerFi company information - Used in Section 2 (Receiving Company / Paying Fee)
// Note: Named OWNERFI_COMPANY_INFO but aliased as REFERRING_COMPANY_DEFAULTS for backwards compatibility
export const OWNERFI_COMPANY_INFO = {
  // Company Info
  COMPANY_NAME: 'OwnerFi',
  COMPANY_ADDRESS: '3401 Mallory Lane #100, Franklin, TN 37067',
  COMPANY_PHONE: '(888) 519-5113',
  COMPANY_LICENSE: '263436', // eXp Realty TN Firm License
  COMPANY_FEDERAL_ID: '',

  // Licensee Info (Abdullah J. Abunasrah)
  LICENSEE_NAME: 'Abdullah J. Abunasrah',
  LICENSEE_PHONE: '(901) 831-9661',
  LICENSEE_EMAIL: 'abdullah@ownerfi.ai',
  LICENSEE_LICENSE: '382400', // TN State License
  LICENSEE_AFFILIATE_ID: '20637', // eXp Affiliate/Agent Number

  // Residential Address
  LICENSEE_RESIDENTIAL_ADDRESS: '1028 Cresthaven Road #1076, Suite 200, Memphis, TN 38119',

  // Relocation Director (optional)
  RELOCATION_DIRECTOR: 'N/A',
  RELOCATION_EMAIL: 'N/A',

  // Agreement Terms
  REFERRAL_FEE_PERCENT: '30',
  REFERRAL_FEE_FIXED: '',
  AGREEMENT_TERM_DAYS: 180,
  TIME_ZONE: 'Central'
} as const;

// Backwards compatibility alias
export const REFERRING_COMPANY_DEFAULTS = OWNERFI_COMPANY_INFO;

// Helper to calculate expiration date
export function calculateExpirationDate(days: number = 180): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Helper to format current date
export function formatCurrentDate(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
