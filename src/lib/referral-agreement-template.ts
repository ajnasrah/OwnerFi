/**
 * eXp Realty (Tennessee) Referral Agreement template — exact mapping of the
 * 2-page SkySlope® Forms PDF (Revised 5/6/2025).
 *
 * The form is rendered VERBATIM. Only the underlined blanks are populated
 * from system data — every label, paragraph, list item, address, and footer
 * matches the printed form exactly. Do NOT add platform-specific addenda,
 * indemnification clauses, or compliance acknowledgments here. Those live on
 * their own pages (/tcpa-compliance, /creative-finance-disclaimer, /terms)
 * and are agreed to as a condition of using the platform — they are NOT
 * part of this brokerage-to-brokerage referral document.
 *
 * Used for both:
 *   - Initial referral (OwnerFi platform → Agent A): Originating Broker is
 *     eXp Realty (the platform operates under Abdullah's TN eXp affiliate
 *     license).
 *   - Sub-referral (Agent A → Agent B): Originating Broker is Agent A's own
 *     brokerage. Same form, different parties.
 */

// ─── Public types ────────────────────────────────────────────────────────────

export interface BrokerParty {
  brokerageName: string;
  brokerageEmail?: string;
  brokeragePhone?: string;
  agentName: string;
  officeAddress?: string;
  agentPhone?: string;
  agentEmail?: string;
  /** Filled at signing — left blank in the rendered HTML if not provided. */
  managingBrokerName?: string;
}

export interface ClientParty {
  type: 'buying' | 'selling' | 'other';
  /** Free text printed on the "Other:" blank when type === 'other'. */
  otherTypeLabel?: string;
  names: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface FeeTerms {
  /** Percent number for the "__%" blank (e.g. 30). Omit for fixed-fee deals. */
  percent?: number;
  /** Dollar amount for the "or $______" blank. */
  fixedAmount?: number;
  /** Which scope checkbox(es) to mark in "[of the ___ listing ___ buying ___ both]". */
  scope: 'listing' | 'buying' | 'both';
  /** Calendar days for the "within ______ calendar days" blank. */
  paymentDays: number;
  /** Free text rendered under the fee paragraph in italic if present. */
  excludedTerms?: string;
  /** Free text printed in the "Additional Terms:" three-line block. Optional. */
  additionalTerms?: string;
}

export interface AgreementPeriod {
  /** Number for the "valid for ___ transaction(s)" blank. */
  validTransactions: number;
  /** Pre-formatted display dates (e.g. "MM/DD/YYYY"). */
  beginDate: string;
  expireDate: string;
}

export interface ExpAgreementParties {
  /** Internal tracking number — NOT printed on the form (form has no slot for it). */
  agreementNumber?: string;
  originating: BrokerParty;
  receiving: BrokerParty;
  client: ClientParty;
  fee: FeeTerms;
  period: AgreementPeriod;
}

// ─── eXp Tennessee constants — printed verbatim on Page 2 footer ─────────────

/**
 * Static eXp Realty Tennessee data — sourced from the SkySlope PDF footer
 * and from the user's TN affiliate paperwork. These values appear on the
 * "PAYMENT TO EXP REALTY INSTRUCTIONS" block on page 2 and as defaults for
 * the Originating Broker box when OwnerFi is the originator.
 */
export const EXP_BROKERAGE = {
  // No comma — matches the SkySlope PDF payee line "Make all checks payable to:
  // eXp Realty LLC" exactly. Check legends are legally material.
  NAME: 'eXp Realty LLC',
  TN_FIRM_LICENSE: '263436',
  TN_OFFICE_ADDRESS: '3401 Mallory Lane, Suite 100, Franklin, TN 37067',
  PHONE: '888-519-5113',
  TAX_ID: '20-8369429',
  USPS_ADDRESS: 'eXp Realty LLC\nPO Box 603506\nCharlotte, NC 28260-3506',
  OVERNIGHT_ADDRESS:
    'eXp Realty LLC\nLockbox Services 603506\n1525 West WT Harris Blvd\nCharlotte, NC 28262',
} as const;

/** The licensed agent who originates platform referrals (Abdullah). */
export const PLATFORM_ORIGINATING_AGENT: BrokerParty = {
  brokerageName: EXP_BROKERAGE.NAME,
  brokeragePhone: EXP_BROKERAGE.PHONE,
  brokerageEmail: '',
  agentName: 'Abdullah J. Abunasrah',
  officeAddress: EXP_BROKERAGE.TN_OFFICE_ADDRESS,
  agentPhone: '',
  agentEmail: 'abdullah@prosway.com',
  managingBrokerName: '',
};

/** Default deal terms for OwnerFi platform-originated referrals. */
export const PLATFORM_REFERRAL_DEFAULTS = {
  REFERRAL_FEE_PERCENT: 30,
  FEE_SCOPE: 'buying' as const,
  PAYMENT_DAYS: 30,
  AGREEMENT_TERM_DAYS: 180,
  VALID_TRANSACTIONS: 1,
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatCurrentDate(): string {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export function calculateExpirationDate(termDays: number): string {
  const d = new Date(Date.now() + termDays * 24 * 60 * 60 * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Field value or an inline blank line of the given character width. */
function field(v: string | undefined | null, widthCh = 28): string {
  const s = (v ?? '').toString().trim();
  if (s) return `<span style="font-weight:600;color:#000;">${escapeHtml(s)}</span>`;
  return `<span style="display:inline-block;border-bottom:1px solid #000;min-width:${widthCh}ch;">&nbsp;</span>`;
}

/** Underlined short blank for things like "____%" or "______ days". */
function shortBlank(v: string | number | undefined | null, widthCh = 4): string {
  const s = v != null && String(v).trim() ? String(v).trim() : '';
  if (s) return `<span style="font-weight:600;color:#000;">${escapeHtml(s)}</span>`;
  return `<span style="display:inline-block;border-bottom:1px solid #000;min-width:${widthCh}ch;text-align:center;">&nbsp;</span>`;
}

/**
 * Underscore-blank with an optional "X" mark, matching how the PDF is filled
 * by hand. The PDF uses blanks (`______`) for Buying/Selling and for
 * listing/buying/both — not checkboxes — and a person draws an X or
 * checkmark on the chosen blank.
 */
function markedBlank(marked: boolean, widthCh = 4): string {
  if (marked) {
    return `<span style="display:inline-block;border-bottom:1px solid #000;min-width:${widthCh}ch;text-align:center;font-weight:bold;">X</span>`;
  }
  return `<span style="display:inline-block;border-bottom:1px solid #000;min-width:${widthCh}ch;">&nbsp;</span>`;
}

// ─── eXp wordmark (text-based stand-in for the official logo) ────────────────
//
// Replace with the official eXp Realty logo by setting NEXT_PUBLIC_EXP_LOGO_URL
// to the public URL of the asset (e.g. "/exp-logo.png" once added to /public).

function expWordmarkHTML(): string {
  const url = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_EXP_LOGO_URL) || '';
  if (url) {
    return `<img src="${escapeHtml(url)}" alt="eXp Realty" style="height:54px;width:auto;display:block;" />`;
  }
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1;color:#0b3a64;display:inline-block;">
      <div style="font-size:36px;font-weight:900;letter-spacing:-1px;">e<span style="font-style:italic;">X</span>p<sup style="font-size:11px;font-weight:600;vertical-align:super;">&reg;</sup></div>
      <div style="font-size:11px;font-weight:700;letter-spacing:6px;margin-top:2px;">REALTY</div>
    </div>
  `;
}

// ─── HTML renderer — exact mapping of the eXp Tennessee SkySlope PDF ─────────

export function generateExpReferralAgreementHTML(p: ExpAgreementParties): string {
  const { originating, receiving, client, fee, period } = p;

  const isBuying = client.type === 'buying';
  const isSelling = client.type === 'selling';

  const css =
    "font-family:'Helvetica Neue',Arial,sans-serif;color:#000;background:#fff;" +
    'font-size:11.5px;line-height:1.45;max-width:780px;margin:0 auto;padding:24px 28px;';
  const boxCss = 'border:1.5px solid #000;padding:10px 12px;margin:8px 0 14px;';
  const labelW = 'display:inline-block;min-width:170px;color:#000;';
  const sectionTitle =
    'background:#f0f0f0;border:1.5px solid #000;font-weight:bold;text-align:center;padding:5px 0;letter-spacing:0.5px;';

  return `
<div style="${css}">

  <!-- ═══════════════════════════ PAGE 1 ═══════════════════════════ -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;">
    <div>${expWordmarkHTML()}</div>
    <div style="font-size:22px;font-weight:bold;letter-spacing:1px;margin-top:6px;">REFERRAL AGREEMENT</div>
  </div>

  <!-- ORIGINATING BROKER -->
  <div style="${sectionTitle}">ORIGINATING BROKER</div>
  <div style="${boxCss}">
    <div><span style="${labelW}">Brokerage:</span> ${field(originating.brokerageName, 50)}</div>
    <div style="margin-top:6px;">
      <span>Brokerage Email</span> ${field(originating.brokerageEmail, 22)}
      &nbsp;&nbsp;<span>Brokerage Phone #</span> ${field(originating.brokeragePhone, 18)}
    </div>
    <div style="margin-top:6px;"><span style="${labelW}">Referring Agent's Name:</span> ${field(originating.agentName, 38)}</div>
    <div style="margin-top:6px;"><span style="${labelW}">Agent's Office Address:</span> ${field(originating.officeAddress, 48)}</div>
    <div style="margin-top:6px;">
      <span style="${labelW}">Agent's Phone Number:</span> ${field(originating.agentPhone, 18)}
      &nbsp;&nbsp;<span>Email Address:</span> ${field(originating.agentEmail, 26)}
    </div>
  </div>

  <!-- RECEIVING BROKER -->
  <div style="${sectionTitle}">RECEIVING BROKER</div>
  <div style="${boxCss}">
    <div><span style="${labelW}">Brokerage:</span> ${field(receiving.brokerageName, 50)}</div>
    <div style="margin-top:6px;"><span style="${labelW}">Receiving Agent's Name:</span> ${field(receiving.agentName, 38)}</div>
    <div style="margin-top:6px;"><span style="${labelW}">Agent's Office Address:</span> ${field(receiving.officeAddress, 48)}</div>
    <div style="margin-top:6px;">
      <span style="${labelW}">Agent's Phone Number:</span> ${field(receiving.agentPhone, 18)}
      &nbsp;&nbsp;<span>Email Address:</span> ${field(receiving.agentEmail, 26)}
    </div>
  </div>

  <!-- CLIENT INFORMATION -->
  <div style="${sectionTitle}">CLIENT INFORMATION</div>
  <div style="${boxCss}">
    <div>
      <span>Client is:</span>
      &nbsp;${markedBlank(isBuying, 5)} Buying
      &nbsp;&nbsp;${markedBlank(isSelling, 5)} Selling
      &nbsp;&nbsp;Other: ${field(client.type === 'other' ? client.otherTypeLabel : '', 22)}
    </div>
    <div style="margin-top:6px;"><span style="${labelW}">Name(s):</span> ${field(client.names, 48)}</div>
    <div style="margin-top:6px;"><span style="${labelW}">Address:</span> ${field(client.address, 50)}</div>
    <div style="margin-top:6px;">
      <span style="${labelW}">Phone Number:</span> ${field(client.phone, 18)}
      &nbsp;&nbsp;<span>Email Address:</span> ${field(client.email, 26)}
    </div>
  </div>

  <!-- Fee paragraph (verbatim from PDF) -->
  <div style="margin:12px 0;">
    Receiving Brokerage agrees to pay Originating Brokerage a referral fee of
    ${shortBlank(fee.percent != null ? fee.percent : '', 4)}%
    [of the
    &nbsp;${markedBlank(fee.scope === 'listing', 4)} listing
    &nbsp;${markedBlank(fee.scope === 'buying', 4)} buying
    &nbsp;${markedBlank(fee.scope === 'both', 4)} both]
    commission received in connection with the
    referred client only, or $${shortBlank(fee.fixedAmount != null && fee.fixedAmount > 0 ? fee.fixedAmount.toLocaleString() : '', 10)}, at the close of escrow. Referral fee shall be paid to
    Originating Brokerage within ${shortBlank(fee.paymentDays, 6)} calendar days of commission being received by
    Receiving Brokerage. This referral fee shall apply to any compensation earned or received by
    Receiving Brokerage on the transaction side involving the referred client, unless specifically
    excluded below:
  </div>

  ${fee.excludedTerms ? `<div style="margin:6px 0 12px;font-style:italic;">${escapeHtml(fee.excludedTerms)}</div>` : ''}

  <div style="margin-top:14px;">Additional Terms:</div>
  <div style="border-bottom:1px solid #000;min-height:14px;margin-top:4px;">${fee.additionalTerms ? escapeHtml(fee.additionalTerms) : '&nbsp;'}</div>
  <div style="border-bottom:1px solid #000;min-height:14px;">&nbsp;</div>
  <div style="border-bottom:1px solid #000;min-height:14px;">&nbsp;</div>

  <div style="display:flex;justify-content:space-between;margin-top:30px;font-size:10px;color:#555;">
    <span>Page 1 of 2</span>
    <span>Revised 5/6/2025</span>
  </div>

  <!-- ═══════════════════════════ PAGE 2 ═══════════════════════════ -->
  <div style="page-break-before:always;height:0;"></div>

  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin:24px 0 14px;">
    <div>${expWordmarkHTML()}</div>
    <div style="font-size:14px;font-weight:bold;margin-top:18px;">REFERRAL AGREEMENT (continued)</div>
  </div>

  <div style="margin:12px 0;">
    This Referral Agreement is valid for ${shortBlank(period.validTransactions, 6)} transaction(s) with Client placed under contract during the period defined below.
  </div>
  <div style="margin:10px 0;">
    Receiving Agent agrees to notify the Originating Agent of the client entering into contract within 5 days of contract acceptance and estimated closing date.
  </div>
  <div style="margin:10px 0;">
    This Referral Agreement will Begin on ${field(period.beginDate, 16)} and Expire on ${field(period.expireDate, 16)}.
  </div>

  <div style="margin-top:18px;font-weight:bold;text-align:center;letter-spacing:0.5px;">REQUIRED DOCUMENTS</div>
  <ul style="margin:6px 0 14px 22px;padding:0;">
    <li>Originating Brokerage's and Agent's real estate license and Company W9 furnished to Receiving Brokerage.</li>
    <li>Closing Statement/Final Settlement Statement furnished with payment to Originating Brokerage.</li>
  </ul>

  <div style="margin-top:14px;font-weight:bold;">Signatures:</div>
  <div style="margin-top:10px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px;">
      <div style="flex:1;">Originating Agent: ${field('', 30)}</div>
      <div style="margin-left:18px;">Date: ${field('', 16)}</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px;">
      <div style="flex:1;">Originating Managing Broker: ${field('', 24)}</div>
      <div style="margin-left:18px;">Date: ${field('', 16)}</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px;">
      <div style="flex:1;">Receiving Agent: ${field('', 30)}</div>
      <div style="margin-left:18px;">Date: ${field('', 16)}</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px;">
      <div style="flex:1;">Receiving Managing Broker: ${field('', 24)}</div>
      <div style="margin-left:18px;">Date: ${field('', 16)}</div>
    </div>
  </div>

  <div style="margin-top:22px;text-align:center;font-weight:bold;letter-spacing:0.5px;">PAYMENT TO EXP REALTY INSTRUCTIONS</div>
  <div style="text-align:center;font-style:italic;font-size:10.5px;margin-top:2px;">(eXp is NOT set up for wire transfers at the present time.)</div>

  <div style="margin:10px 0;">
    Make all checks payable to: <strong>${escapeHtml(EXP_BROKERAGE.NAME)}</strong> &nbsp;&#124;&nbsp;
    Tax ID#${escapeHtml(EXP_BROKERAGE.TAX_ID)} (W9 Attached) and include a copy of this agreement with payment.
    Email copy of check to the eXp Agent.
  </div>

  <div style="display:flex;gap:14px;margin-top:10px;">
    <div style="flex:1;border:1.5px solid #000;padding:10px;">
      <div style="font-weight:bold;">For Regular U.S. Postal Service (USPS)</div>
      <div style="font-style:italic;font-size:10.5px;margin-top:2px;">Use of this address for payments mailed via the U.S. Postal Service (USPS) will result in delays.</div>
      <div style="font-weight:bold;margin-top:6px;">Mail to:</div>
      <div style="white-space:pre-line;margin-top:2px;">${escapeHtml(EXP_BROKERAGE.USPS_ADDRESS)}</div>
    </div>
    <div style="flex:1;border:1.5px solid #000;padding:10px;">
      <div style="font-weight:bold;">For Overnight Deliveries ONLY (NOT USPS)</div>
      <div style="font-style:italic;font-size:10.5px;margin-top:2px;">This address is to be used for overnight deliveries ONLY!</div>
      <div style="font-weight:bold;margin-top:6px;">Overnight/FedEx:</div>
      <div style="white-space:pre-line;margin-top:2px;">${escapeHtml(EXP_BROKERAGE.OVERNIGHT_ADDRESS)}</div>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;margin-top:24px;font-size:10px;color:#555;">
    <span>Page 2 of 2</span>
    <span>Revised 5/6/2025</span>
  </div>

</div>
  `.trim();
}

// ─── Plain-text renderer (for record-keeping) — same content, no styling ────

export function generateExpReferralAgreementText(p: ExpAgreementParties): string {
  const { originating, receiving, client, fee, period } = p;
  const lines: string[] = [];

  lines.push('eXp REALTY — REFERRAL AGREEMENT');
  lines.push('');

  lines.push('ORIGINATING BROKER');
  lines.push(`  Brokerage:               ${originating.brokerageName}`);
  lines.push(`  Brokerage Email:         ${originating.brokerageEmail || ''}`);
  lines.push(`  Brokerage Phone #:       ${originating.brokeragePhone || ''}`);
  lines.push(`  Referring Agent's Name:  ${originating.agentName}`);
  lines.push(`  Agent's Office Address:  ${originating.officeAddress || ''}`);
  lines.push(`  Agent's Phone Number:    ${originating.agentPhone || ''}`);
  lines.push(`  Email Address:           ${originating.agentEmail || ''}`);
  lines.push('');

  lines.push('RECEIVING BROKER');
  lines.push(`  Brokerage:               ${receiving.brokerageName}`);
  lines.push(`  Receiving Agent's Name:  ${receiving.agentName}`);
  lines.push(`  Agent's Office Address:  ${receiving.officeAddress || ''}`);
  lines.push(`  Agent's Phone Number:    ${receiving.agentPhone || ''}`);
  lines.push(`  Email Address:           ${receiving.agentEmail || ''}`);
  lines.push('');

  const clientType = client.type === 'other' ? `Other (${client.otherTypeLabel || ''})` : client.type;
  lines.push('CLIENT INFORMATION');
  lines.push(`  Client is:               ${clientType}`);
  lines.push(`  Name(s):                 ${client.names}`);
  lines.push(`  Address:                 ${client.address || ''}`);
  lines.push(`  Phone Number:            ${client.phone || ''}`);
  lines.push(`  Email Address:           ${client.email || ''}`);
  lines.push('');

  const scopeStr = fee.scope === 'both' ? 'both listing and buying' : fee.scope;
  lines.push(
    `Receiving Brokerage agrees to pay Originating Brokerage a referral fee of ` +
      `${fee.percent != null ? fee.percent : '___'}% [of the ${scopeStr}] commission received in connection ` +
      `with the referred client only, or $${fee.fixedAmount && fee.fixedAmount > 0 ? fee.fixedAmount.toLocaleString() : '_____'}, ` +
      `at the close of escrow. Referral fee shall be paid to Originating Brokerage within ` +
      `${fee.paymentDays} calendar days of commission being received by Receiving Brokerage. ` +
      `This referral fee shall apply to any compensation earned or received by Receiving Brokerage on the ` +
      `transaction side involving the referred client, unless specifically excluded below:`,
  );
  if (fee.excludedTerms) lines.push(fee.excludedTerms);
  lines.push('');
  lines.push('Additional Terms:');
  lines.push(`  ${fee.additionalTerms || ''}`);
  lines.push('');
  lines.push('Page 1 of 2 — Revised 5/6/2025');
  lines.push('');
  lines.push('--- REFERRAL AGREEMENT (continued) ---');
  lines.push('');
  lines.push(`This Referral Agreement is valid for ${period.validTransactions} transaction(s) with Client placed under contract during the period defined below.`);
  lines.push('Receiving Agent agrees to notify the Originating Agent of the client entering into contract within 5 days of contract acceptance and estimated closing date.');
  lines.push(`This Referral Agreement will Begin on ${period.beginDate} and Expire on ${period.expireDate}.`);
  lines.push('');
  lines.push('REQUIRED DOCUMENTS');
  lines.push("  - Originating Brokerage's and Agent's real estate license and Company W9 furnished to Receiving Brokerage.");
  lines.push('  - Closing Statement/Final Settlement Statement furnished with payment to Originating Brokerage.');
  lines.push('');
  lines.push('Signatures:');
  // All four lines render as blank underscores — the typed signature lives
  // on the Firestore record (signatureTypedName + signedAt), not in the
  // form body. Matches the HTML renderer.
  lines.push('  Originating Agent:           ____________________');
  lines.push('  Originating Managing Broker: ____________________');
  lines.push('  Receiving Agent:             ____________________');
  lines.push('  Receiving Managing Broker:   ____________________');
  lines.push('');
  lines.push('PAYMENT TO EXP REALTY INSTRUCTIONS');
  lines.push('  (eXp is NOT set up for wire transfers at the present time.)');
  lines.push(`  Make all checks payable to: ${EXP_BROKERAGE.NAME}  |  Tax ID#${EXP_BROKERAGE.TAX_ID} (W9 Attached)`);
  lines.push('  USPS:');
  EXP_BROKERAGE.USPS_ADDRESS.split('\n').forEach((l) => lines.push(`    ${l}`));
  lines.push('  Overnight/FedEx:');
  EXP_BROKERAGE.OVERNIGHT_ADDRESS.split('\n').forEach((l) => lines.push(`    ${l}`));
  lines.push('');
  lines.push('Page 2 of 2 — Revised 5/6/2025');

  return lines.join('\n');
}

// ─── Backward-compat shims for legacy callers ────────────────────────────────
//
// Older code paths import `generateAgreementHTML`, `generateAgreementText`,
// `REFERRING_COMPANY_DEFAULTS`, and `AgreementTemplateData` from this file.
// These shims translate old-shape input into the new renderer so existing
// callers keep working while we migrate them. New code should use the
// `Exp*` exports directly.

export interface AgreementTemplateData {
  agreementNumber?: string;
  effectiveDate?: string;
  expirationDate?: string;
  timeZone?: string;
  referringCompanyName?: string;
  referringCompanyAddress?: string;
  referringCompanyPhone?: string;
  referringCompanyLicense?: string;
  referringCompanyFederalId?: string;
  referringLicenseeName?: string;
  referringLicenseePhone?: string;
  referringLicenseeEmail?: string;
  referringRelocationDirector?: string;
  referringRelocationEmail?: string;
  receivingCompanyName?: string;
  receivingCompanyAddress?: string;
  receivingCompanyPhone?: string;
  receivingCompanyLicense?: string;
  receivingLicenseeName?: string;
  receivingLicenseePhone?: string;
  receivingLicenseeEmail?: string;
  receivingRelocationDirector?: string;
  receivingRelocationEmail?: string;
  prospectName?: string;
  referralType?: 'buyer' | 'seller' | 'other' | string;
  prospectAgreedToReferral?: boolean;
  prospectCurrentAddress?: string;
  prospectHomePhone?: string;
  prospectWorkPhone?: string;
  prospectCellPhone?: string;
  prospectEmail?: string;
  prospectBestTimeToCall?: string;
  prospectRemarks?: string;
  referralFeePercent?: string | number;
  referralFeeFixed?: string | number;
  otherTerms?: string;
}

export const REFERRING_COMPANY_DEFAULTS = {
  COMPANY_NAME: EXP_BROKERAGE.NAME,
  COMPANY_ADDRESS: EXP_BROKERAGE.TN_OFFICE_ADDRESS,
  COMPANY_PHONE: EXP_BROKERAGE.PHONE,
  COMPANY_LICENSE: EXP_BROKERAGE.TN_FIRM_LICENSE,
  COMPANY_FEDERAL_ID: EXP_BROKERAGE.TAX_ID,
  LICENSEE_NAME: PLATFORM_ORIGINATING_AGENT.agentName,
  LICENSEE_AFFILIATE_ID: '382400',
  LICENSEE_PHONE: PLATFORM_ORIGINATING_AGENT.agentPhone || '',
  LICENSEE_EMAIL: PLATFORM_ORIGINATING_AGENT.agentEmail || '',
  RELOCATION_DIRECTOR: 'N/A',
  RELOCATION_EMAIL: 'N/A',
  REFERRAL_FEE_PERCENT: String(PLATFORM_REFERRAL_DEFAULTS.REFERRAL_FEE_PERCENT),
  REFERRAL_FEE_FIXED: '',
  AGREEMENT_TERM_DAYS: PLATFORM_REFERRAL_DEFAULTS.AGREEMENT_TERM_DAYS,
  TIME_ZONE: 'America/Chicago',
} as const;

function fromLegacy(d: AgreementTemplateData): ExpAgreementParties {
  const referralType =
    d.referralType === 'seller' ? 'selling' : d.referralType === 'other' ? 'other' : 'buying';
  const percent =
    typeof d.referralFeePercent === 'string'
      ? parseFloat(d.referralFeePercent)
      : (d.referralFeePercent as number | undefined);
  const fixed =
    typeof d.referralFeeFixed === 'string'
      ? d.referralFeeFixed
        ? parseFloat(d.referralFeeFixed)
        : undefined
      : (d.referralFeeFixed as number | undefined);

  // CRITICAL: do NOT default to eXp values when the legacy data is missing —
  // sub-referral agreements have a NON-eXp originating broker (Agent A's own
  // brokerage). Defaulting to eXp would falsely render Agent A's brokerage
  // as eXp on a re-render. Pass through whatever the caller provided; render
  // a blank line when the field is empty.
  return {
    agreementNumber: d.agreementNumber,
    originating: {
      brokerageName: d.referringCompanyName || '',
      brokeragePhone: d.referringCompanyPhone || '',
      brokerageEmail: '',
      agentName: d.referringLicenseeName || '',
      officeAddress: d.referringCompanyAddress || '',
      agentPhone: d.referringLicenseePhone || '',
      agentEmail: d.referringLicenseeEmail || '',
      managingBrokerName: '',
    },
    receiving: {
      brokerageName: d.receivingCompanyName || '',
      brokeragePhone: d.receivingCompanyPhone || '',
      brokerageEmail: '',
      agentName: d.receivingLicenseeName || '',
      officeAddress: d.receivingCompanyAddress || '',
      agentPhone: d.receivingLicenseePhone || '',
      agentEmail: d.receivingLicenseeEmail || '',
      managingBrokerName: '',
    },
    client: {
      type: referralType as ClientParty['type'],
      names: d.prospectName || '',
      address: d.prospectCurrentAddress || '',
      phone: d.prospectCellPhone || d.prospectHomePhone || d.prospectWorkPhone || '',
      email: d.prospectEmail || '',
    },
    fee: {
      percent,
      fixedAmount: fixed,
      scope: 'buying',
      paymentDays: PLATFORM_REFERRAL_DEFAULTS.PAYMENT_DAYS,
      additionalTerms: d.otherTerms || '',
    },
    period: {
      validTransactions: PLATFORM_REFERRAL_DEFAULTS.VALID_TRANSACTIONS,
      beginDate: d.effectiveDate || formatCurrentDate(),
      expireDate: d.expirationDate || calculateExpirationDate(PLATFORM_REFERRAL_DEFAULTS.AGREEMENT_TERM_DAYS),
    },
  };
}

/** @deprecated use generateExpReferralAgreementHTML(parties) directly */
export function generateAgreementHTML(d: AgreementTemplateData): string {
  return generateExpReferralAgreementHTML(fromLegacy(d));
}

/** @deprecated use generateExpReferralAgreementText(parties) directly */
export function generateAgreementText(d: AgreementTemplateData): string {
  return generateExpReferralAgreementText(fromLegacy(d));
}
