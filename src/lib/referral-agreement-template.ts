// RF-701 Referral Agreement Template - Tennessee Association of REALTORS®
// Auto-filled with OwnerFi company data, realtor data, and buyer data

export interface AgreementTemplateData {
  agreementNumber: string;
  effectiveDate: string;
  expirationDate: string;
  timeZone: string;

  // Section 1: COMPANY REFERRING THE BUYER OR SELLER (OwnerFi)
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

  // Section 2: COMPANY AGREEING TO PAY REFERRAL FEE (Realtor)
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
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.4; max-width: 850px; margin: 0 auto; padding: 20px; color: #333; font-size: 12px; }
    .header { text-align: center; margin-bottom: 20px; }
    .header img { max-width: 150px; }
    h1 { text-align: center; font-size: 18px; font-weight: bold; margin: 10px 0; }
    .agreement-number { text-align: right; font-size: 11px; color: #666; margin-bottom: 15px; }
    .section { margin: 15px 0; }
    .section-title { font-weight: bold; font-size: 13px; margin-bottom: 8px; text-transform: uppercase; }
    .field-row { display: flex; margin: 4px 0; }
    .field-label { min-width: 280px; }
    .field-value { flex: 1; border-bottom: 1px solid #333; padding-left: 5px; min-height: 18px; background: #fffef0; }
    .checkbox-row { margin: 8px 0; }
    .checkbox { display: inline-block; width: 14px; height: 14px; border: 1px solid #333; margin-right: 5px; text-align: center; line-height: 12px; font-size: 10px; }
    .checkbox.checked { background: #e8f5e9; }
    .terms-text { font-size: 11px; line-height: 1.5; margin: 10px 0; text-align: justify; }
    .signature-section { margin-top: 30px; border-top: 2px solid #333; padding-top: 15px; }
    .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    .signature-box { }
    .signature-box h4 { font-size: 11px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; }
    .sig-line { border-bottom: 1px solid #333; height: 25px; margin: 5px 0; }
    .sig-label { font-size: 10px; color: #666; }
    .contact-section { margin-top: 25px; border: 2px solid #333; padding: 15px; }
    .contact-title { text-align: center; font-weight: bold; font-size: 13px; margin-bottom: 15px; text-transform: uppercase; }
    .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .highlight { background: #fff3cd; padding: 2px 4px; font-weight: bold; }
    .footer { margin-top: 20px; font-size: 9px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size: 24px; font-weight: bold; color: #1a365d;">eXp</div>
    <div style="font-size: 12px; letter-spacing: 3px; color: #666;">R E A L T Y</div>
  </div>

  <h1>REFERRAL AGREEMENT</h1>
  <div class="agreement-number">Agreement #: ${data.agreementNumber}</div>

  <div class="section">
    <div class="section-title">1. Company Referring the Buyer or Seller:</div>
    <div class="field-row">
      <span class="field-label">A. Name of Company referring the Buyer or Seller ("Referring Company"):</span>
      <span class="field-value">${data.referringCompanyName}</span>
    </div>
    <div class="field-row">
      <span class="field-label">B. Company Address:</span>
      <span class="field-value">${data.referringCompanyAddress}</span>
    </div>
    <div class="field-row">
      <span class="field-label">C. Company Phone Number:</span>
      <span class="field-value">${data.referringCompanyPhone}</span>
    </div>
    <div class="field-row">
      <span class="field-label">D. Company Real Estate License or Firm #:</span>
      <span class="field-value">${data.referringCompanyLicense}</span>
    </div>
    <div class="field-row">
      <span class="field-label">E. Company Federal ID # (for tax purposes):</span>
      <span class="field-value">${data.referringCompanyFederalId}</span>
    </div>
    <div class="field-row">
      <span class="field-label">F. Name of Licensee referring the Buyer or Seller:</span>
      <span class="field-value">${data.referringLicenseeName}</span>
    </div>
    <div class="field-row">
      <span class="field-label">G. Licensee Phone Number(s) and Email Address:</span>
      <span class="field-value">${data.referringLicenseePhone} | ${data.referringLicenseeEmail}</span>
    </div>
    <div class="field-row">
      <span class="field-label">H. Relocation Director Name, Contact Info and Email Address:</span>
      <span class="field-value">${data.referringRelocationDirector} | ${data.referringRelocationEmail}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">2. Company Agreeing to Pay Referral Fee:</div>
    <div class="field-row">
      <span class="field-label">A. Name of Company agreeing to pay referral fee ("Receiving Company"):</span>
      <span class="field-value">${data.receivingCompanyName}</span>
    </div>
    <div class="field-row">
      <span class="field-label">B. Company Address:</span>
      <span class="field-value">${data.receivingCompanyAddress}</span>
    </div>
    <div class="field-row">
      <span class="field-label">C. Company Phone Number:</span>
      <span class="field-value">${data.receivingCompanyPhone}</span>
    </div>
    <div class="field-row">
      <span class="field-label">D. Company Real Estate License or Firm #:</span>
      <span class="field-value">${data.receivingCompanyLicense}</span>
    </div>
    <div class="field-row">
      <span class="field-label">E. Name of Licensee assigned this referral:</span>
      <span class="field-value">${data.receivingLicenseeName}</span>
    </div>
    <div class="field-row">
      <span class="field-label">F. Licensee Phone Number(s) and Email Address:</span>
      <span class="field-value">${data.receivingLicenseePhone} | ${data.receivingLicenseeEmail}</span>
    </div>
    <div class="field-row">
      <span class="field-label">G. Relocation Director Name, Contact Info and Email Address:</span>
      <span class="field-value">${data.receivingRelocationDirector} | ${data.receivingRelocationEmail}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. Name of Party Being Referred:</div>
    <div class="field-row">
      <span class="field-label">A. Name:</span>
      <span class="field-value">${data.prospectName}</span>
      <span style="margin-left: 10px;">("Prospect")</span>
    </div>
    <div class="checkbox-row" style="margin-left: 20px;">
      <span class="checkbox ${data.referralType === 'buyer' ? 'checked' : ''}">${data.referralType === 'buyer' ? 'X' : ''}</span> Buyer Referral
      &nbsp;&nbsp;&nbsp;
      <span class="checkbox ${data.referralType === 'seller' ? 'checked' : ''}">${data.referralType === 'seller' ? 'X' : ''}</span> Seller Referral
      &nbsp;&nbsp;&nbsp;OR&nbsp;&nbsp;&nbsp;
      <span class="checkbox ${data.referralType === 'both' ? 'checked' : ''}">${data.referralType === 'both' ? 'X' : ''}</span> Both - Buyer and Seller Referral
    </div>
    <div class="field-row" style="margin-top: 10px;">
      <span class="field-label">B. Did the Buyer or Seller agree or request to be referred by your Company?</span>
      <span class="checkbox ${data.prospectAgreedToReferral ? 'checked' : ''}">${data.prospectAgreedToReferral ? 'X' : ''}</span> Yes
      &nbsp;&nbsp;
      <span class="checkbox ${!data.prospectAgreedToReferral ? 'checked' : ''}">${!data.prospectAgreedToReferral ? 'X' : ''}</span> No
    </div>
  </div>

  <div class="section">
    <div class="section-title">4. Referral Fee:</div>
    <div class="terms-text">
      In consideration of the referral of Prospect, the Receiving Company agrees to pay the Referring Company at closing a
      fixed sum of $<span class="field-value" style="display: inline; min-width: 100px;">${data.referralFeeFixed}</span> or
      <span class="highlight">${data.referralFeePercent}%</span> of the compensation paid to the
      Receiving Company as a percentage of the Purchase Price, a flat fee, or combination thereof (i.e., real estate commission)
      including bonuses, if any, which shall only be paid for the Buyer's side and/or Seller's side actually referred ("Referral
      Fee") pursuant to Section 3 above. Referral Fee will be paid to the Company referring the Buyer or Seller within seven
      (7) calendar days of receipt of compensation with a copy of a fully executed settlement statement.
    </div>
  </div>

  <div class="section">
    <div class="section-title">5. Expiration Date:</div>
    <div class="terms-text">
      This Agreement begins on the last date signed below, and expires on <span class="highlight">${data.expirationDate}</span> at 11:59 p.m.,
      <span class="field-value" style="display: inline; min-width: 80px;">${data.timeZone}</span> time zone. This Agreement will automatically extend through the term of any agency agreement entered
      into with the referred Buyer or Seller, or if negotiations have begun, through any closing date(s).
    </div>
  </div>

  <div class="section">
    <div class="section-title">6. Enforcement / Venue:</div>
    <div class="terms-text">
      This Agreement is intended as a contract for the referral of real estate customers. In the event all parties to this Agreement
      are REALTORS®, any dispute regarding this Agreement shall be governed by and in accordance with the National
      Association of Realtors® Code of Ethics and Arbitration Manual which is in effect at the time of the execution of this
      Agreement. Otherwise, any dispute regarding this Agreement shall be governed by and interpreted in accordance with the
      laws and in the courts of the State of Tennessee.
    </div>
  </div>

  <div class="section">
    <div class="section-title">7. Severability:</div>
    <div class="terms-text">
      If any portion or provision of this Referral Agreement is held or adjudicated to be invalid or unenforceable for any reason,
      each such portion or provision shall be severed from the remaining portions or provisions of this Referral Agreement, and
      the remaining portions or provisions shall be unaffected and remain in full force and effect.
    </div>
  </div>

  <div class="signature-section">
    <p style="font-size: 11px; margin-bottom: 15px;"><strong>NOTE:</strong> Any provisions of this Agreement which are preceded by a box "☐" must be marked to be a part of this
    Agreement. By affixing your signature below you also acknowledge that you have reviewed each page and received a
    copy of this Agreement.</p>

    <p style="font-size: 11px; margin-bottom: 20px;">The party(ies) below have signed and acknowledge receipt of a copy.</p>

    <div class="signature-grid">
      <div class="signature-box">
        <div class="sig-line"></div>
        <div class="sig-label">BROKER FOR REFERRING COMPANY</div>
        <div class="sig-line" style="width: 60%;"></div>
        <div class="sig-label">Date &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; at _______ o'clock ☐ am/ ☐ pm</div>
        <div class="sig-line"></div>
        <div class="sig-label">FIRM/COMPANY</div>
        <div class="sig-line"></div>
        <div class="sig-label">ADDRESS</div>
        <div class="sig-line"></div>
        <div class="sig-label">Phone</div>
      </div>
      <div class="signature-box">
        <div class="sig-line"></div>
        <div class="sig-label">LICENSEE</div>
        <div class="sig-line" style="width: 60%;"></div>
        <div class="sig-label">Date &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; at _______ o'clock ☐ am/ ☐ pm</div>
        <div class="sig-line"></div>
        <div class="sig-label">PRINT/TYPE NAME</div>
        <div class="sig-line"></div>
        <div class="sig-label">ADDRESS</div>
        <div class="sig-line"></div>
        <div class="sig-label">Phone</div>
      </div>
    </div>

    <p style="font-size: 11px; margin: 20px 0;">The party(ies) below have signed and acknowledge receipt of a copy.</p>

    <div class="signature-grid">
      <div class="signature-box">
        <div class="sig-line"></div>
        <div class="sig-label">BROKER FOR RECEIVING COMPANY</div>
        <div class="sig-line" style="width: 60%;"></div>
        <div class="sig-label">Date &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; at _______ o'clock ☐ am/ ☐ pm</div>
        <div class="sig-line"></div>
        <div class="sig-label">FIRM/COMPANY</div>
        <div class="sig-line"></div>
        <div class="sig-label">ADDRESS</div>
        <div class="sig-line"></div>
        <div class="sig-label">Phone</div>
      </div>
      <div class="signature-box">
        <div class="sig-line"></div>
        <div class="sig-label">LICENSEE</div>
        <div class="sig-line" style="width: 60%;"></div>
        <div class="sig-label">Date &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; at _______ o'clock ☐ am/ ☐ pm</div>
        <div class="sig-line"></div>
        <div class="sig-label">PRINT/TYPE NAME</div>
        <div class="sig-line"></div>
        <div class="sig-label">ADDRESS</div>
        <div class="sig-line"></div>
        <div class="sig-label">Phone</div>
      </div>
    </div>
  </div>

  <div class="contact-section">
    <div class="contact-title">Contact Information of Party Being Referred<br>To Be Provided Upon Acceptance by Receiving Firm</div>
    <div class="field-row">
      <span class="field-label">Name:</span>
      <span class="field-value">${data.prospectName}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Current Address:</span>
      <span class="field-value">${data.prospectCurrentAddress}</span>
    </div>
    <div class="contact-grid">
      <div class="field-row">
        <span class="field-label">Home Phone:</span>
        <span class="field-value">${data.prospectHomePhone}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Work Phone:</span>
        <span class="field-value">${data.prospectWorkPhone}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Cell Phone:</span>
        <span class="field-value">${data.prospectCellPhone}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Email Address:</span>
        <span class="field-value">${data.prospectEmail}</span>
      </div>
    </div>
    <div class="field-row">
      <span class="field-label">Remarks/Best Time to Call:</span>
      <span class="field-value">${data.prospectBestTimeToCall}</span>
    </div>
    <div class="field-row">
      <span class="field-label">Other Terms / Relocation Company Info:</span>
      <span class="field-value">${data.otherTerms}</span>
    </div>
  </div>

  <div class="footer">
    Copyright 2014 © Tennessee Association of Realtors®<br>
    RF701 – Referral Agreement, Page 1 of 2 | Version 01/01/2025
  </div>
</body>
</html>
`.trim();
}

// eXp Realty company information for Section 1 (Referring Company)
export const REFERRING_COMPANY_DEFAULTS = {
  // Company Info
  COMPANY_NAME: 'eXp Realty',
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
