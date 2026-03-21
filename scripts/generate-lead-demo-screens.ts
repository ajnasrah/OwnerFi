/**
 * Realtor Lead Demo Screen Generator
 *
 * Generates 5 x 1080x1920 screenshots showing the Ownerfi lead referral flow:
 *   1. Available Leads dashboard (John Doe visible)
 *   2. John Doe card highlighted — about to accept
 *   3. Agreement modal — signing the referral agreement
 *   4. Success — contact info revealed
 *   5. My Leads tab — John Doe as owned lead
 *
 * Uses Puppeteer to render static HTML that looks like the real UI.
 * Uploads PNGs to R2 for use as Creatify video backgrounds.
 *
 * Usage:
 *   npx tsx scripts/generate-lead-demo-screens.ts
 *   npx tsx scripts/generate-lead-demo-screens.ts --dry-run
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// ============================================================================
// R2 Upload
// ============================================================================

function getR2Client() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) throw new Error('R2 credentials not configured');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function uploadToR2(pngBuffer: Buffer, fileName: string): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME || '';
  const publicUrl = process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || '';
  const r2 = getR2Client();
  await r2.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: `lead-demo-screens/${fileName}`,
    Body: pngBuffer,
    ContentType: 'image/png',
  }));
  return `${publicUrl}/lead-demo-screens/${fileName}`;
}

// ============================================================================
// Demo Data
// ============================================================================

interface DemoLead {
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  matchScore: number;
  likedCount: number;
  phone: string;
  email: string;
}

// Primary lead is always John Doe; supporting cast adds realism
const DEMO_LEADS: DemoLead[] = [
  { firstName: 'John', lastName: 'Doe', city: 'Houston', state: 'TX', matchScore: 92, likedCount: 14, phone: '(713) 555-0142', email: 'johndoe@email.com' },
  { firstName: 'Sarah', lastName: 'Martinez', city: 'Dallas', state: 'TX', matchScore: 85, likedCount: 9, phone: '(214) 555-0198', email: 'sarah.m@email.com' },
  { firstName: 'James', lastName: 'Wilson', city: 'Austin', state: 'TX', matchScore: 78, likedCount: 6, phone: '(512) 555-0231', email: 'jwilson@email.com' },
  { firstName: 'Emily', lastName: 'Chen', city: 'San Antonio', state: 'TX', matchScore: 71, likedCount: 4, phone: '(210) 555-0377', email: 'emily.c@email.com' },
];

// ============================================================================
// Shared CSS — matches the real realtor dashboard theme
// ============================================================================

const SHARED_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1080px;
    height: 1920px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    overflow: hidden;
    background: #111625;
    color: #fff;
  }
  .header {
    background: rgba(30,41,59,0.5);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(51,65,85,0.5);
    padding: 40px 48px 32px;
  }
  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .logo-area {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .logo-icon {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, #34d399, #3b82f6);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 800;
    font-size: 32px;
  }
  .logo-text { font-size: 36px; font-weight: 700; }
  .header-links {
    display: flex;
    gap: 24px;
    color: #94a3b8;
    font-size: 24px;
  }
  .header-links span { cursor: pointer; }
  .welcome {
    color: #cbd5e1;
    font-size: 26px;
  }
  .welcome b { color: #fff; font-weight: 600; }

  /* Tabs */
  .tabs-wrapper {
    background: rgba(30,41,59,0.3);
    border-radius: 20px;
    padding: 8px;
    margin: 28px 48px;
  }
  .tabs {
    display: flex;
    gap: 8px;
  }
  .tab {
    flex: 1;
    text-align: center;
    padding: 20px 12px;
    border-radius: 14px;
    font-size: 24px;
    font-weight: 600;
    color: #cbd5e1;
  }
  .tab.active {
    background: #00BC7D;
    color: #fff;
    box-shadow: 0 6px 20px rgba(16,185,129,0.4);
  }

  /* Content area */
  .content {
    margin: 0 48px;
    background: rgba(30,41,59,0.3);
    border-radius: 20px;
    padding: 40px;
  }

  /* Search bar */
  .search-bar {
    display: flex;
    gap: 20px;
    margin-bottom: 32px;
  }
  .search-input {
    width: 100%;
    background: rgba(51,65,85,0.5);
    border: 2px solid #475569;
    border-radius: 16px;
    padding: 22px 24px 22px 60px;
    color: #fff;
    font-size: 26px;
  }
  .search-field {
    position: relative;
    flex: 1;
  }
  .search-field .icon {
    position: absolute;
    left: 20px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 28px;
    z-index: 1;
  }
  .city-field {
    position: relative;
    width: 340px;
  }
  .city-field .icon {
    position: absolute;
    left: 20px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 28px;
    z-index: 1;
  }

  /* Status banner */
  .status-banner {
    background: rgba(51,65,85,0.3);
    border: 2px solid rgba(71,85,105,0.3);
    border-radius: 16px;
    padding: 28px 32px;
    margin-bottom: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .status-label { color: #fff; font-weight: 600; font-size: 26px; }
  .status-count { color: #34d399; font-weight: 700; }
  .status-note { color: #94a3b8; font-size: 22px; margin-top: 6px; }
  .credits-btn {
    background: #475569;
    color: #fff;
    padding: 16px 32px;
    border-radius: 14px;
    font-size: 22px;
    font-weight: 700;
    border: none;
  }

  /* Lead cards grid */
  .leads-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .lead-card {
    background: rgba(30,41,59,0.5);
    border: 2px solid rgba(51,65,85,0.5);
    border-radius: 20px;
    padding: 32px;
  }
  .lead-card.highlight {
    border: 3px solid #34d399;
    box-shadow: 0 0 40px rgba(52,211,153,0.3);
  }
  .lead-card.dimmed {
    opacity: 0.4;
  }
  .lead-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
  }
  .lead-name {
    font-size: 32px;
    font-weight: 800;
    color: #fff;
  }
  .lead-location {
    font-size: 22px;
    color: #94a3b8;
    margin-top: 4px;
  }
  .lead-match {
    font-size: 20px;
    color: #34d399;
    margin-top: 6px;
    font-weight: 600;
  }
  .status-badge {
    padding: 8px 18px;
    border-radius: 10px;
    font-size: 20px;
    font-weight: 700;
  }
  .badge-available {
    background: rgba(16,185,129,0.2);
    color: #34d399;
  }
  .badge-pending {
    background: rgba(234,179,8,0.2);
    color: #facc15;
  }
  .badge-owned {
    background: rgba(59,130,246,0.2);
    color: #60a5fa;
  }
  .accept-btn {
    width: 100%;
    background: #00BC7D;
    color: #fff;
    padding: 20px;
    border-radius: 14px;
    border: none;
    font-size: 26px;
    font-weight: 700;
  }
  .complete-btn {
    width: 100%;
    background: #eab308;
    color: #000;
    padding: 20px;
    border-radius: 14px;
    border: none;
    font-size: 26px;
    font-weight: 700;
  }

  /* Branding footer */
  .branding {
    text-align: center;
    padding: 60px 0;
  }
  .branding-text {
    font-size: 96px;
    font-weight: 900;
    letter-spacing: 4px;
    background: linear-gradient(135deg, #00BC7D, #3b82f6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* Modal overlay */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
  }
  .modal {
    background: #1e293b;
    border: 2px solid #334155;
    border-radius: 24px;
    width: 960px;
    max-height: 1820px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 32px 36px;
    border-bottom: 2px solid #334155;
  }
  .modal-title {
    font-size: 36px;
    font-weight: 800;
  }
  .modal-subtitle {
    font-size: 22px;
    color: #94a3b8;
    margin-top: 4px;
  }
  .modal-close {
    color: #94a3b8;
    font-size: 40px;
    background: none;
    border: none;
  }
  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 36px;
  }
  .modal-footer {
    padding: 24px 36px;
    border-top: 2px solid #334155;
    display: flex;
    gap: 20px;
  }
  .modal-footer .btn-cancel {
    flex: 1;
    background: #334155;
    color: #fff;
    padding: 22px;
    border-radius: 14px;
    border: none;
    font-size: 26px;
    font-weight: 700;
  }
  .modal-footer .btn-sign {
    flex: 1;
    background: #00BC7D;
    color: #fff;
    padding: 22px;
    border-radius: 14px;
    border: none;
    font-size: 26px;
    font-weight: 700;
  }
  .modal-footer .btn-done {
    width: 100%;
    background: #00BC7D;
    color: #fff;
    padding: 22px;
    border-radius: 14px;
    border: none;
    font-size: 26px;
    font-weight: 700;
  }

  /* Agreement preview */
  .agreement-preview {
    background: #fff;
    border-radius: 16px;
    padding: 28px;
    margin-bottom: 28px;
    color: #1e293b;
    font-size: 20px;
    line-height: 1.6;
    max-height: 420px;
    overflow: hidden;
  }
  .agreement-preview h3 {
    font-size: 24px;
    font-weight: 800;
    margin-bottom: 12px;
    text-align: center;
  }
  .agreement-preview p {
    margin-bottom: 10px;
  }

  /* Key terms box */
  .key-terms {
    background: rgba(51,65,85,0.5);
    border-radius: 16px;
    padding: 24px 28px;
    margin-bottom: 28px;
  }
  .key-terms h4 {
    color: #fff;
    font-weight: 700;
    margin-bottom: 14px;
    font-size: 26px;
  }
  .key-terms li {
    color: #cbd5e1;
    font-size: 22px;
    margin-bottom: 8px;
    list-style: none;
  }
  .key-terms .highlight { color: #34d399; font-weight: 700; font-size: 26px; }
  .key-terms .white { color: #fff; font-weight: 600; }

  /* Signature section */
  .sign-section {
    border-top: 2px solid #334155;
    padding-top: 28px;
  }
  .sign-section h4 {
    color: #fff;
    font-weight: 700;
    margin-bottom: 20px;
    font-size: 26px;
  }
  .sign-input-label {
    color: #cbd5e1;
    font-size: 22px;
    margin-bottom: 12px;
    display: block;
  }
  .sign-input {
    width: 100%;
    background: rgba(51,65,85,0.5);
    border: 2px solid #475569;
    border-radius: 14px;
    padding: 20px 24px;
    color: #fff;
    font-size: 26px;
    margin-bottom: 24px;
  }
  .checkbox-row {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 20px;
  }
  .checkbox {
    width: 36px;
    height: 36px;
    min-width: 36px;
    border-radius: 8px;
    margin-top: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
  }
  .checkbox.checked {
    background: #00BC7D;
    color: #fff;
  }
  .checkbox.unchecked {
    background: #334155;
    border: 2px solid #475569;
  }
  .checkbox-text {
    color: #cbd5e1;
    font-size: 20px;
    line-height: 1.4;
  }
  .checkbox-text a {
    color: #34d399;
    text-decoration: none;
  }

  /* Success state */
  .success-icon {
    width: 120px;
    height: 120px;
    background: rgba(16,185,129,0.2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
    font-size: 60px;
    color: #34d399;
  }
  .success-title {
    font-size: 42px;
    font-weight: 800;
    text-align: center;
    margin-bottom: 12px;
  }
  .success-subtitle {
    font-size: 26px;
    color: #94a3b8;
    text-align: center;
    margin-bottom: 40px;
  }
  .contact-card {
    background: rgba(51,65,85,0.5);
    border-radius: 20px;
    padding: 40px;
    max-width: 640px;
    margin: 0 auto;
  }
  .contact-row {
    margin-bottom: 24px;
  }
  .contact-label {
    font-size: 20px;
    color: #94a3b8;
    margin-bottom: 4px;
  }
  .contact-value {
    font-size: 30px;
    font-weight: 600;
    color: #fff;
  }
  .contact-value.green {
    color: #34d399;
  }
  .contact-actions {
    display: flex;
    gap: 16px;
    margin-top: 32px;
  }
  .btn-text-now {
    flex: 1;
    background: #22c55e;
    color: #fff;
    padding: 20px;
    border-radius: 14px;
    border: none;
    font-size: 26px;
    font-weight: 700;
    text-align: center;
  }
  .btn-call-now {
    flex: 1;
    background: #3b82f6;
    color: #fff;
    padding: 20px;
    border-radius: 14px;
    border: none;
    font-size: 26px;
    font-weight: 700;
    text-align: center;
  }

  /* Owned lead card */
  .owned-card {
    background: rgba(30,41,59,0.5);
    border: 2px solid rgba(51,65,85,0.5);
    border-radius: 20px;
    padding: 40px;
  }
  .owned-phone {
    font-size: 26px;
    color: #34d399;
    font-weight: 600;
    margin-top: 8px;
  }
  .owned-email {
    font-size: 26px;
    color: #34d399;
    font-weight: 600;
  }
  .owned-actions {
    display: flex;
    gap: 16px;
    margin-top: 24px;
  }
  .btn-details {
    flex: 1;
    background: rgba(59,130,246,0.2);
    color: #60a5fa;
    padding: 18px;
    border-radius: 14px;
    border: none;
    font-size: 24px;
    font-weight: 700;
    text-align: center;
  }
  .btn-text {
    flex: 1;
    background: rgba(34,197,94,0.2);
    color: #4ade80;
    padding: 18px;
    border-radius: 14px;
    border: none;
    font-size: 24px;
    font-weight: 700;
    text-align: center;
  }
  .btn-dispute {
    width: 100%;
    background: rgba(239,68,68,0.2);
    color: #f87171;
    padding: 18px;
    border-radius: 14px;
    border: none;
    font-size: 24px;
    font-weight: 700;
    margin-top: 12px;
  }
`;

// ============================================================================
// Screen Builders
// ============================================================================

function buildHeader(agentName: string = 'Agent'): string {
  return `
    <div class="header">
      <div class="header-top">
        <div class="logo-area">
          <div class="logo-icon">O</div>
          <span class="logo-text">Ownerfi</span>
        </div>
        <div class="header-links">
          <span>Profile</span>
          <span>Logout</span>
        </div>
      </div>
      <div class="welcome">Welcome back, <b>${agentName}</b></div>
    </div>
  `;
}

function buildTabs(active: 'available' | 'agreements' | 'owned' | 'history', counts: { available: number; agreements: number; owned: number }): string {
  return `
    <div class="tabs-wrapper">
      <div class="tabs">
        <div class="tab ${active === 'available' ? 'active' : ''}">Available (${counts.available})</div>
        <div class="tab ${active === 'agreements' ? 'active' : ''}">Agreements (${counts.agreements})</div>
        <div class="tab ${active === 'owned' ? 'active' : ''}">My Leads (${counts.owned})</div>
        <div class="tab ${active === 'history' ? 'active' : ''}">History</div>
      </div>
    </div>
  `;
}

function buildLeadCard(lead: DemoLead, status: 'available' | 'pending' | 'owned', options?: { highlight?: boolean; dimmed?: boolean }): string {
  const badgeClass = status === 'owned' ? 'badge-owned' : status === 'pending' ? 'badge-pending' : 'badge-available';
  const badgeText = status === 'owned' ? 'Owned' : status === 'pending' ? 'Pending' : 'Available';
  const cardClass = options?.highlight ? 'lead-card highlight' : options?.dimmed ? 'lead-card dimmed' : 'lead-card';

  let actionBtn = `<button class="accept-btn">Accept Lead</button>`;
  if (status === 'pending') actionBtn = `<button class="complete-btn">Complete Signature</button>`;
  if (status === 'owned') actionBtn = `<button class="btn-details" style="width:100%">View Agreement</button>`;

  return `
    <div class="${cardClass}">
      <div class="lead-header">
        <div>
          <div class="lead-name">${lead.firstName} ${lead.lastName}</div>
          <div class="lead-location">${lead.city}, ${lead.state}</div>
          <div class="lead-match">${lead.matchScore}% match &bull; ${lead.likedCount} liked</div>
        </div>
        <span class="status-badge ${badgeClass}">${badgeText}</span>
      </div>
      ${actionBtn}
    </div>
  `;
}

function wrapPage(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>${SHARED_CSS}</style>
</head>
<body>
  ${content}
</body>
</html>`;
}

// ---- Screen 1: Available Leads Dashboard ----
function buildScreen1_AvailableLeads(): string {
  const leads = DEMO_LEADS;
  return wrapPage(`
    ${buildHeader('Agent')}
    ${buildTabs('available', { available: leads.length, agreements: 0, owned: 0 })}
    <div class="content">
      <div class="search-bar">
        <div class="search-field">
          <span class="icon" style="color:#94a3b8">&#128269;</span>
          <input class="search-input" placeholder="Search by name..." value="" readonly />
        </div>
        <div class="city-field">
          <span class="icon" style="color:#94a3b8">&#128205;</span>
          <input class="search-input" placeholder="Filter by city..." value="" readonly />
        </div>
      </div>

      <div class="status-banner">
        <div>
          <div class="status-label">Free Leads: <span class="status-count">0/3 pending</span></div>
          <div class="status-note">You can have up to 3 pending leads at a time</div>
        </div>
        <button class="credits-btn">Get More Leads</button>
      </div>

      <div class="leads-grid">
        ${leads.map(l => buildLeadCard(l, 'available')).join('\n')}
      </div>
    </div>

    <div class="branding">
      <div class="branding-text">www.ownerfi.ai</div>
    </div>
  `);
}

// ---- Screen 2: John Doe Highlighted ----
function buildScreen2_HighlightJohnDoe(): string {
  const leads = DEMO_LEADS;
  return wrapPage(`
    ${buildHeader('Agent')}
    ${buildTabs('available', { available: leads.length, agreements: 0, owned: 0 })}
    <div class="content">
      <div class="search-bar">
        <div class="search-field">
          <span class="icon" style="color:#94a3b8">&#128269;</span>
          <input class="search-input" value="John" readonly style="color:#fff" />
        </div>
        <div class="city-field">
          <span class="icon" style="color:#94a3b8">&#128205;</span>
          <input class="search-input" placeholder="Filter by city..." value="" readonly />
        </div>
      </div>

      <div class="status-banner">
        <div>
          <div class="status-label">Free Leads: <span class="status-count">0/3 pending</span></div>
          <div class="status-note">You can have up to 3 pending leads at a time</div>
        </div>
        <button class="credits-btn">Get More Leads</button>
      </div>

      <div class="leads-grid">
        ${buildLeadCard(leads[0], 'available', { highlight: true })}
        ${leads.slice(1).map(l => buildLeadCard(l, 'available', { dimmed: true })).join('\n')}
      </div>
    </div>

    <div class="branding">
      <div class="branding-text">www.ownerfi.ai</div>
    </div>
  `);
}

// ---- Screen 3: Agreement Modal (signing) ----
function buildScreen3_AgreementModal(): string {
  const today = new Date();
  const expiry = new Date(today);
  expiry.setDate(expiry.getDate() + 180);

  return wrapPage(`
    ${buildHeader('Agent')}
    ${buildTabs('available', { available: 4, agreements: 0, owned: 0 })}
    <div class="content" style="opacity:0.25; pointer-events:none;">
      <div class="leads-grid">
        ${DEMO_LEADS.map(l => buildLeadCard(l, 'available')).join('\n')}
      </div>
    </div>

    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <div>
            <div class="modal-title">Referral Agreement</div>
            <div class="modal-subtitle">#RF701-2026-047</div>
          </div>
          <button class="modal-close">&times;</button>
        </div>

        <div class="modal-body">
          <div class="agreement-preview">
            <h3>REAL ESTATE BUYER REFERRAL AGREEMENT</h3>
            <p><b>Form RF-701</b> &mdash; Ownerfi Standard Referral Agreement</p>
            <p>This Referral Agreement ("Agreement") is entered into as of ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} between the Referring Party and Receiving Party identified below.</p>
            <p><b>Section 1. Referring Party:</b> Ownerfi, Inc.</p>
            <p><b>Section 2. Receiving Party:</b> [Your name and brokerage]</p>
            <p><b>Section 3. Referred Prospect:</b> John Doe &mdash; Houston, TX</p>
            <p><b>Section 4. Referral Fee:</b> 30% of the Receiving Party's gross commission...</p>
          </div>

          <div class="key-terms">
            <h4>Key Terms</h4>
            <ul>
              <li>Referral Fee: <span class="highlight">30%</span> of your commission</li>
              <li>Agreement Valid For: <span class="white">180 days</span></li>
              <li>Expires: <span class="white">${expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></li>
            </ul>
          </div>

          <div class="sign-section">
            <h4>Sign Agreement</h4>
            <label class="sign-input-label">Type your full legal name to sign</label>
            <input class="sign-input" value="Sarah Johnson" readonly />

            <div class="checkbox-row">
              <div class="checkbox checked">&#10003;</div>
              <span class="checkbox-text">I have read and agree to the terms of this Referral Agreement. I understand that by typing my name above and checking this box, I am electronically signing this agreement.</span>
            </div>
            <div class="checkbox-row">
              <div class="checkbox checked">&#10003;</div>
              <span class="checkbox-text">I acknowledge and agree to Ownerfi's <a>TCPA Compliance Agreement</a>.</span>
            </div>
            <div class="checkbox-row">
              <div class="checkbox checked">&#10003;</div>
              <span class="checkbox-text">I acknowledge Ownerfi's <a>Creative Finance Disclaimer</a>.</span>
            </div>
            <div class="checkbox-row">
              <div class="checkbox checked">&#10003;</div>
              <span class="checkbox-text">I accept that lead contact information is provided "as-is" without verification by Ownerfi.</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel">Cancel</button>
          <button class="btn-sign">Sign &amp; Accept Lead</button>
        </div>
      </div>
    </div>
  `);
}

// ---- Screen 4: Success — contact info revealed ----
function buildScreen4_Success(): string {
  const johnDoe = DEMO_LEADS[0];
  return wrapPage(`
    ${buildHeader('Agent')}
    ${buildTabs('available', { available: 3, agreements: 1, owned: 0 })}
    <div class="content" style="opacity:0.15; pointer-events:none;">
      <div class="leads-grid">
        ${DEMO_LEADS.slice(1).map(l => buildLeadCard(l, 'available')).join('\n')}
      </div>
    </div>

    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <div>
            <div class="modal-title">Referral Agreement</div>
          </div>
          <button class="modal-close">&times;</button>
        </div>

        <div class="modal-body" style="text-align:center; padding: 40px 24px;">
          <div class="success-icon">&#10003;</div>
          <div class="success-title">Agreement Signed!</div>
          <div class="success-subtitle">Here is your lead's contact information:</div>

          <div class="contact-card" style="text-align:left;">
            <div class="contact-row">
              <div class="contact-label">Name</div>
              <div class="contact-value">${johnDoe.firstName} ${johnDoe.lastName}</div>
            </div>
            <div class="contact-row">
              <div class="contact-label">Phone</div>
              <div class="contact-value green">${johnDoe.phone}</div>
            </div>
            <div class="contact-row">
              <div class="contact-label">Email</div>
              <div class="contact-value green">${johnDoe.email}</div>
            </div>
            <div class="contact-row">
              <div class="contact-label">Location</div>
              <div class="contact-value">${johnDoe.city}, ${johnDoe.state}</div>
            </div>
            <div class="contact-actions">
              <button class="btn-text-now">Text Now</button>
              <button class="btn-call-now">Call Now</button>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-done">Done</button>
        </div>
      </div>
    </div>
  `);
}

// ---- Screen 5: My Leads tab — John Doe owned ----
function buildScreen5_MyLeads(): string {
  const johnDoe = DEMO_LEADS[0];
  return wrapPage(`
    ${buildHeader('Agent')}
    ${buildTabs('owned', { available: 3, agreements: 1, owned: 1 })}
    <div class="content">
      <div class="leads-grid" style="grid-template-columns: 1fr;">
        <div class="owned-card">
          <div class="lead-header">
            <div>
              <div class="lead-name">${johnDoe.firstName} ${johnDoe.lastName}</div>
              <div class="lead-location">${johnDoe.city}, ${johnDoe.state}</div>
              <div class="owned-phone">${johnDoe.phone}</div>
              <div class="owned-email">${johnDoe.email}</div>
            </div>
            <span class="status-badge badge-owned">Owned</span>
          </div>
          <div class="owned-actions">
            <button class="btn-details">View More Details</button>
            <button class="btn-text">Text</button>
          </div>
          <button class="btn-dispute">Dispute</button>
        </div>
      </div>
    </div>

    <div class="branding">
      <div class="branding-text">www.ownerfi.ai</div>
    </div>
  `);
}

// ============================================================================
// Screen metadata for the pipeline
// ============================================================================

interface ScreenData {
  step: number;
  label: string;
  description: string;
  screenImageUrl: string;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('=== Realtor Lead Demo Screen Generator ===\n');

  const screens = [
    { label: 'Available Leads', builder: buildScreen1_AvailableLeads, description: 'Dashboard showing available buyer leads' },
    { label: 'Highlight John Doe', builder: buildScreen2_HighlightJohnDoe, description: 'John Doe lead highlighted, ready to accept' },
    { label: 'Agreement Modal', builder: buildScreen3_AgreementModal, description: 'Referral agreement with signature and checkboxes' },
    { label: 'Success - Contact Info', builder: buildScreen4_Success, description: 'Agreement signed, buyer contact info revealed' },
    { label: 'My Leads', builder: buildScreen5_MyLeads, description: 'My Leads tab with owned lead and actions' },
  ];

  if (dryRun) {
    console.log('--dry-run: Previewing screens without rendering\n');
    const output: ScreenData[] = screens.map((s, i) => ({
      step: i + 1,
      label: s.label,
      description: s.description,
      screenImageUrl: `(dry-run — not rendered)`,
    }));
    fs.writeFileSync('/tmp/lead-demo-screens.json', JSON.stringify(output, null, 2));
    console.log(`Wrote ${output.length} screen definitions to /tmp/lead-demo-screens.json\n`);
    return;
  }

  // Launch browser
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const output: ScreenData[] = [];

  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i];
    console.log(`\n[${i + 1}/${screens.length}] Rendering: ${screen.label}`);

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

    const html = screen.builder();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });

    // Wait for fonts
    await page.evaluate(() => document.fonts.ready);

    const screenshot = await page.screenshot({ type: 'png' }) as Buffer;
    await page.close();

    // Save locally
    const localPath = `/tmp/lead-demo-screen-${i + 1}.png`;
    fs.writeFileSync(localPath, screenshot);
    console.log(`  Local: ${localPath} (${(screenshot.length / 1024).toFixed(0)} KB)`);

    // Upload to R2
    const fileName = `screen-${i + 1}-${Date.now()}.png`;
    let imageUrl: string;
    try {
      imageUrl = await uploadToR2(screenshot, fileName);
      console.log(`  R2: ${imageUrl}`);
    } catch (err) {
      console.error(`  R2 upload failed:`, err);
      imageUrl = `file://${localPath}`;
    }

    output.push({
      step: i + 1,
      label: screen.label,
      description: screen.description,
      screenImageUrl: imageUrl,
    });
  }

  await browser.close();

  // Write output JSON
  const outputPath = '/tmp/lead-demo-screens.json';
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n=== Generated ${output.length} demo screens ===`);
  console.log(`Output: ${outputPath}\n`);
  for (let i = 0; i < output.length; i++) {
    console.log(`  open /tmp/lead-demo-screen-${i + 1}.png`);
  }
  console.log('');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
