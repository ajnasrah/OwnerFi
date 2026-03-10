/**
 * OwnerFi Product Demo Card Generator
 *
 * Generates 1080x1920 screenshots that look EXACTLY like the buyer swiper UI.
 * Uses Puppeteer to render the real PropertyCard design with actual property data.
 * Uploads to R2 for use as Creatify video backgrounds.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import Typesense from 'typesense';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ============================================================================
// Types
// ============================================================================

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  listPrice: number;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  primaryImage: string;
  galleryImages?: string[];
  monthlyPayment?: number;
  downPaymentAmount?: number;
  dealType?: string[];
  propertyType?: string;
  yearBuilt?: number;
  pricePerSqFt?: number;
}

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
    Key: `property-cards/${fileName}`,
    Body: pngBuffer,
    ContentType: 'image/png',
  }));
  return `${publicUrl}/property-cards/${fileName}`;
}

// ============================================================================
// HTML Template — Exact replica of PropertyCard.tsx + PropertySwiper2.tsx
// ============================================================================

function buildCardHTML(property: Property): string {
  const price = `$${Math.round(property.listPrice).toLocaleString()}`;
  const pricePerSqFt = property.squareFeet && property.listPrice
    ? `$${Math.round(property.listPrice / property.squareFeet).toLocaleString()}/sq ft`
    : null;

  const street = (() => {
    const parts = property.address.split(',');
    return parts[0]?.trim() || property.address;
  })();
  const location = `${property.city}, ${property.state}${property.zipCode ? ' ' + property.zipCode : ''}`;

  const dealTypes = property.dealType || [];
  const isCashDeal = dealTypes.includes('cash_deal');

  // Financing type badge config (matches PropertyCard.tsx exactly)
  const badgeText = isCashDeal ? 'Cash Deal' : 'Owner Finance';
  const badgeBg = isCashDeal ? 'background: #eab308;' : 'background: #059669;';
  const badgeColor = isCashDeal ? 'color: #000;' : 'color: #fff;';
  const badgeIcon = isCashDeal ? '💵' : '💰';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    /* PropertySwiper2 background — the dark gradient behind the card */
    body {
      width: 1080px;
      height: 1920px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      overflow: hidden;
      /* from-indigo-950 via-slate-900 to-emerald-950 */
      background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 50%, #022c22 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
    }

    /* Card centered — slightly narrower than viewport for dark border */
    .card {
      width: 800px;
      height: 1756px;
      position: relative;
      border-radius: 48px;
      overflow: hidden;
      /* from-slate-50 via-blue-50 to-emerald-50 */
      background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 50%, #ecfdf5 100%);
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
    }

    /* Image Section — Top 48% */
    .image-section {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 48%;
      overflow: hidden;
    }
    .property-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    /* from-black/20 via-transparent to-black/90 */
    .image-gradient {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(0,0,0,0.20) 0%,
        transparent 40%,
        rgba(0,0,0,0.90) 100%
      );
    }

    /* Badge — top left, matches bg-emerald-600 backdrop-blur-sm rounded-full */
    .badge {
      position: absolute;
      top: 28px;
      left: 28px;
      ${badgeBg}
      ${badgeColor}
      padding: 14px 28px;
      border-radius: 999px;
      font-size: 24px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
      backdrop-filter: blur(8px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.25);
    }
    .badge-icon { font-size: 22px; }

    /* Swipe instruction — centered at 46%, matches bg-white/95 backdrop-blur-sm rounded-full */
    .swipe-indicator {
      position: absolute;
      top: 46%;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(8px);
      padding: 18px 36px;
      border-radius: 999px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      border: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 20;
    }
    .swipe-arrow { color: #94a3b8; font-size: 26px; }
    .swipe-text { color: #334155; font-weight: 700; font-size: 24px; }

    /* OwnerFi URL — big branding in the gap between swipe indicator and info panel */
    .ownerfi-url {
      position: absolute;
      top: 52%;
      left: 0;
      right: 0;
      text-align: center;
      z-index: 20;
      padding: 20px 0;
    }
    .ownerfi-url-text {
      font-size: 88px;
      font-weight: 900;
      letter-spacing: 4px;
      background: linear-gradient(135deg, #10b981, #3b82f6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Bottom Info Panel — bg-white/98 backdrop-blur-sm rounded-t-3xl */
    .info-panel {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(255,255,255,0.98);
      backdrop-filter: blur(8px);
      border-top-left-radius: 48px;
      border-top-right-radius: 48px;
      padding: 0 44px 40px;
      box-shadow: 0 -15px 40px rgba(0,0,0,0.06);
    }

    /* Handle bar — w-20 h-1.5 bg-slate-300 rounded-full */
    .handle-bar-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 28px 0 16px;
      gap: 16px;
    }
    .handle-bar {
      width: 80px;
      height: 6px;
      border-radius: 999px;
      background: linear-gradient(to right, #94a3b8, #64748b);
    }

    /* "Tap for details" — bg-emerald-500 text-white rounded-full */
    .details-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #10b981;
      color: white;
      padding: 14px 28px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 24px;
      box-shadow: 0 6px 16px rgba(16,185,129,0.35);
    }
    .details-btn svg {
      width: 18px;
      height: 18px;
    }

    /* Price — text-3xl font-black text-slate-900 */
    .price {
      font-size: 52px;
      font-weight: 900;
      color: #0f172a;
      margin-top: 16px;
      margin-bottom: 4px;
    }
    .price-sqft {
      font-size: 22px;
      color: #64748b;
      margin-bottom: 12px;
    }

    /* Address */
    .street {
      font-size: 26px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
      margin-bottom: 4px;
    }
    .location {
      font-size: 20px;
      color: #64748b;
      margin-bottom: 28px;
    }

    /* Quick Stats — flex gap-3, bg-slate-100 rounded-lg px-2 py-1 */
    .stats-row {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 28px;
    }
    .stat {
      background: #f1f5f9;
      border-radius: 14px;
      padding: 14px 22px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .stat-icon { font-size: 20px; }
    .stat-value { font-size: 24px; font-weight: 700; color: #0f172a; }
    .stat-label { font-size: 18px; color: #64748b; }

    /* Action buttons — grid-cols-3 gap-2 */
    .actions {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 14px;
      margin-bottom: 24px;
    }
    .action-btn {
      padding: 18px 12px;
      border-radius: 18px;
      color: white;
      font-weight: 700;
      font-size: 24px;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 6px 16px rgba(0,0,0,0.12);
    }
    .btn-search { background: linear-gradient(to right, #3b82f6, #2563eb); }
    .btn-contact { background: linear-gradient(to right, #10b981, #059669); }
    .btn-share { background: linear-gradient(to right, #8b5cf6, #7c3aed); }
    .btn-icon { font-size: 20px; }

    /* Branding bar */
    .branding {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-top: 20px;
      border-top: 2px solid #f1f5f9;
    }
    .brand-logo {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #10b981, #3b82f6);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      font-weight: 800;
    }
    .brand-name { font-size: 28px; font-weight: 700; color: #0f172a; }
    .brand-url { margin-left: auto; font-size: 22px; color: #94a3b8; }

  </style>
</head>
<body>
  <div class="card">
    <!-- Image Section — Top 48% -->
    <div class="image-section">
      <img class="property-image" src="${property.primaryImage}" alt="Property" />
      <div class="image-gradient"></div>
      <div class="badge">
        <span class="badge-icon">${badgeIcon}</span>
        <span>${badgeText}</span>
      </div>
    </div>

    <!-- Swipe Indicator -->
    <div class="swipe-indicator">
      <span class="swipe-arrow">&larr;</span>
      <span class="swipe-text">Swipe to browse</span>
      <span class="swipe-arrow">&rarr;</span>
    </div>

    <!-- OwnerFi URL Branding -->
    <div class="ownerfi-url">
      <div class="ownerfi-url-text">www.ownerfi.ai</div>
    </div>

    <!-- Bottom Info Panel -->
    <div class="info-panel">
      <div class="handle-bar-wrap">
        <div class="handle-bar"></div>
        <div class="details-btn">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 15l7-7 7 7"/></svg>
          Tap for details
        </div>
      </div>

      <div class="price">${price}</div>
      ${pricePerSqFt ? `<div class="price-sqft">${pricePerSqFt}</div>` : ''}

      <div class="street">${street}</div>
      <div class="location">${location}</div>

      <div class="stats-row">
        <div class="stat">
          <span class="stat-icon">🛏️</span>
          <span class="stat-value">${property.bedrooms}</span>
          <span class="stat-label">beds</span>
        </div>
        <div class="stat">
          <span class="stat-icon">🚿</span>
          <span class="stat-value">${property.bathrooms}</span>
          <span class="stat-label">baths</span>
        </div>
        <div class="stat">
          <span class="stat-icon">📏</span>
          <span class="stat-value">${(property.squareFeet || 0).toLocaleString()}</span>
          <span class="stat-label">sq ft</span>
        </div>
      </div>

      <div class="actions">
        <div class="action-btn btn-search"><span class="btn-icon">🔍</span> Search</div>
        <div class="action-btn btn-contact"><span class="btn-icon">💬</span> Contact</div>
        <div class="action-btn btn-share"><span class="btn-icon">🔗</span> Share</div>
      </div>

      <div class="branding">
        <div class="brand-logo">O</div>
        <span class="brand-name">OwnerFi</span>
        <span class="brand-url">ownerfi.ai</span>
      </div>
    </div>
  </div>

  <!-- Nav buttons removed for clean video background -->
</body>
</html>`;
}

// ============================================================================
// Firestore — rotation state
// ============================================================================

function getDb() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      }),
    });
  }
  return getFirestore(getApps()[0]);
}

interface RotationState {
  usedIds: Record<string, string[]>; // { TX: ['id1','id2'], FL: ['id3'] }
  lastState: string;
  lastRun: string;
}

const ROTATION_DOC = 'system/video-rotation';

async function getRotationState(db: FirebaseFirestore.Firestore): Promise<RotationState> {
  const doc = await db.doc(ROTATION_DOC).get();
  if (doc.exists) return doc.data() as RotationState;
  return { usedIds: {}, lastState: '', lastRun: '' };
}

async function saveRotationState(db: FirebaseFirestore.Firestore, state: RotationState) {
  await db.doc(ROTATION_DOC).set(state);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const manualState = process.argv.find(a => a !== '--dry-run' && process.argv.indexOf(a) >= 2)?.toUpperCase();

  const tsClient = new Typesense.Client({
    nodes: [{ host: process.env.TYPESENSE_HOST || '', port: 443, protocol: 'https' }],
    apiKey: process.env.TYPESENSE_API_KEY || '',
    connectionTimeoutSeconds: 5,
  });

  const db = getDb();
  const rotation = await getRotationState(db);

  // Discover which states have properties
  const allResult = await tsClient.collections('properties').documents().search({
    q: '*',
    query_by: 'address,city,state',
    filter_by: 'isActive:=true && bedrooms:>0 && listPrice:>0 && propertyType:!land && dealType:=[owner_finance, both]',
    facet_by: 'state',
    per_page: 0,
  });

  const stateFacets = (allResult.facet_counts || [])
    .find((f: any) => f.field_name === 'state');
  const availableStates = (stateFacets?.counts || [])
    .filter((c: any) => c.count >= 5) // need at least 5 properties
    .map((c: any) => c.value as string)
    .sort();

  if (availableStates.length === 0) {
    console.error('No states with 5+ properties found.');
    process.exit(1);
  }

  console.log(`States with 5+ properties: ${availableStates.join(', ')} (${availableStates.length} total)\n`);

  // Pick state: manual override or auto-rotate
  // Use lastState name (not index) to find position — immune to states being added/removed
  let targetState: string;
  if (manualState) {
    targetState = manualState;
    console.log(`Manual override: ${targetState}\n`);
  } else {
    let idx = 0;
    if (rotation.lastState) {
      const lastIdx = availableStates.indexOf(rotation.lastState);
      idx = lastIdx === -1 ? 0 : (lastIdx + 1) % availableStates.length;
    }
    targetState = availableStates[idx];
    console.log(`Auto-rotation: ${targetState} (last was ${rotation.lastState || 'none'})\n`);
  }

  console.log(`=== OwnerFi Product Demo Card Generator — ${targetState} ===\n`);

  // Pull properties for this state
  const usedIds = rotation.usedIds[targetState] || [];
  console.log(`Pulling ${targetState} properties (${usedIds.length} already used)...`);

  const result = await tsClient.collections('properties').documents().search({
    q: '*',
    query_by: 'address,city,state',
    filter_by: `isActive:=true && bedrooms:>0 && propertyType:!land && dealType:=[owner_finance, both] && state:=${targetState}`,
    sort_by: 'createdAt:desc',
    per_page: 250,
    include_fields: 'id,address,city,state,zipCode,listPrice,bedrooms,bathrooms,squareFeet,primaryImage,galleryImages,monthlyPayment,downPaymentAmount,dealType,propertyType,yearBuilt',
  });

  let properties = (result.hits || [])
    .map((h: any) => h.document as Property)
    .filter((p: Property) => p.primaryImage && p.listPrice > 0);

  // Filter out already-used properties
  const unusedProperties = properties.filter(p => !usedIds.includes(p.id));
  console.log(`  Total: ${properties.length}, Unused: ${unusedProperties.length}`);

  // If all used up, reset this state's tracker
  if (unusedProperties.length < 5) {
    console.log(`  Resetting ${targetState} — all properties used, starting fresh.`);
    rotation.usedIds[targetState] = [];
    properties = properties.sort(() => Math.random() - 0.5).slice(0, 5);
  } else {
    properties = unusedProperties.sort(() => Math.random() - 0.5).slice(0, 5);
  }

  console.log(`\nSelected ${properties.length} properties:\n`);
  properties.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.address}, ${p.city}, ${p.state} — $${p.listPrice.toLocaleString()} | ${p.bedrooms}bd/${p.bathrooms}ba | ${p.propertyType}`);
  });

  if (properties.length === 0) {
    console.error('No properties found. Check Typesense data.');
    process.exit(1);
  }

  // On dry-run: save rotation state but write output JSON with selected properties (no card rendering)
  if (dryRun) {
    // Save rotation state
    const newUsedIds = [...(rotation.usedIds[targetState] || []), ...properties.map(p => p.id)];
    rotation.usedIds[targetState] = newUsedIds;
    rotation.lastState = targetState;
    rotation.lastRun = new Date().toISOString();
    await saveRotationState(db, rotation);
    const nextIdx = (availableStates.indexOf(targetState) + 1) % availableStates.length;
    console.log(`\nRotation saved. Next auto state: ${availableStates[nextIdx]}`);

    // Write output JSON with primaryImage as cardImageUrl (no rendered cards)
    const output = properties.map(p => ({
      id: p.id, address: p.address, city: p.city, state: p.state,
      price: p.listPrice, beds: p.bedrooms, baths: p.bathrooms, sqft: p.squareFeet,
      monthly: p.monthlyPayment, propertyType: p.propertyType,
      cardImageUrl: p.primaryImage, rawImageUrl: p.primaryImage,
    }));
    fs.writeFileSync('/tmp/ownerfi-cards.json', JSON.stringify(output, null, 2));
    console.log('--dry-run: skipping card rendering. Card data written with raw images.\n');
    return;
  }

  // 2. Launch browser
  console.log('\nLaunching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const cards: Array<{ property: Property; imageUrl: string }> = [];

  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    console.log(`\n[${i + 1}/${properties.length}] Rendering ${p.city}, ${p.state} — $${p.listPrice.toLocaleString()}`);

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

    const html = buildCardHTML(p);
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });

    // Wait for property image to load
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const img = document.querySelector('.property-image') as HTMLImageElement;
        if (img && img.complete) return resolve();
        if (img) img.onload = () => resolve();
        setTimeout(resolve, 3000); // fallback
      });
    });

    const screenshot = await page.screenshot({ type: 'png' }) as Buffer;
    await page.close();

    // Save locally
    const localPath = `/tmp/ownerfi-card-${i + 1}.png`;
    fs.writeFileSync(localPath, screenshot);
    console.log(`  Local: ${localPath} (${(screenshot.length / 1024).toFixed(0)} KB)`);

    // Upload to R2
    const fileName = `card-${p.id}-${Date.now()}.png`;
    try {
      const url = await uploadToR2(screenshot, fileName);
      console.log(`  R2: ${url}`);
      cards.push({ property: p, imageUrl: url });
    } catch (err) {
      console.error(`  R2 upload failed:`, err);
      cards.push({ property: p, imageUrl: p.primaryImage });
    }
  }

  await browser.close();

  // 3. Output JSON for the house demo script
  console.log(`\n=== Generated ${cards.length} product demo cards ===\n`);

  const output = cards.map(c => ({
    id: c.property.id,
    address: c.property.address,
    city: c.property.city,
    state: c.property.state,
    price: c.property.listPrice,
    beds: c.property.bedrooms,
    baths: c.property.bathrooms,
    sqft: c.property.squareFeet,
    monthly: c.property.monthlyPayment,
    propertyType: c.property.propertyType,
    cardImageUrl: c.imageUrl,
    rawImageUrl: c.property.primaryImage,
  }));

  const outputPath = '/tmp/ownerfi-cards.json';
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Card data: ${outputPath}`);
  console.log('\nPreview:');
  for (let i = 0; i < cards.length; i++) {
    console.log(`  open /tmp/ownerfi-card-${i + 1}.png`);
  }

  // Save rotation state AFTER successful card generation (not before)
  const newUsedIds = [...(rotation.usedIds[targetState] || []), ...properties.map(p => p.id)];
  rotation.usedIds[targetState] = newUsedIds;
  rotation.lastState = targetState;
  rotation.lastRun = new Date().toISOString();
  await saveRotationState(db, rotation);
  const nextIdx = (availableStates.indexOf(targetState) + 1) % availableStates.length;
  console.log(`\nRotation saved. Next auto state: ${availableStates[nextIdx]}\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
