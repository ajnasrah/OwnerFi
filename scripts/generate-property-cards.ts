/**
 * Ownerfi Product Demo Card Generator
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

export function buildCardHTML(property: Property): string {
  const price = `$${Math.round(property.listPrice).toLocaleString()}`;
  const monthly = property.monthlyPayment && property.monthlyPayment > 0
    ? `$${Math.round(property.monthlyPayment).toLocaleString()}`
    : null;

  const location = `${property.city}, ${property.state}${property.zipCode ? ' ' + property.zipCode : ''}`;

  // Badge config — video always narrates owner financing, so prioritize OF badge
  // Uses same logic as getVideoBadgeCSS() in src/lib/deal-badge.ts
  const dealTypes = property.dealType || [];
  const isOwnerfinance = dealTypes.includes('owner_finance');
  const isCashDealOnly = !isOwnerfinance && dealTypes.includes('cash_deal');

  const badgeText = isCashDealOnly ? 'Cash Deal' : 'Owner Finance';
  const badgeBg = isCashDealOnly ? 'background: #eab308;' : 'background: #00BC7D;';
  const badgeColor = isCashDealOnly ? 'color: #000;' : 'color: #fff;';
  const badgeIcon = isCashDealOnly ? '💵' : '💰';

  // Stamp — the tilted attention-grabber sticker top-right of photo
  const stampText = isCashDealOnly ? 'BELOW MARKET' : 'NO BANK NEEDED';
  const stampBg = isCashDealOnly ? '#dc2626' : '#dc2626'; // red in both cases — it's the "pay attention" color
  const stampAccent = isCashDealOnly ? '#fbbf24' : '#fef08a'; // yellow secondary line

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
      /* from-indigo-950 via-slate-900 to-cash-green-950 */
      background: linear-gradient(135deg, #1e1b4b 0%, #111625 50%, #022c22 100%);
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
      /* from-slate-50 via-blue-50 to-cash-green-50 */
      background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 50%, #ecfdf5 100%);
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4);
    }

    /* Image Section — Top 58% (taller now that fake UI is gone) */
    .image-section {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 58%;
      overflow: hidden;
    }
    .property-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    /* Strong bottom gradient — guarantees legibility for the info panel seam */
    .image-gradient {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(0,0,0,0.10) 0%,
        transparent 35%,
        rgba(0,0,0,0.55) 85%,
        rgba(0,0,0,0.95) 100%
      );
    }

    /* Brand accent bar — thick green stripe on the left edge of the photo */
    .accent-bar {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 16px;
      background: linear-gradient(to bottom, #00BC7D, #3b82f6);
      z-index: 10;
    }

    /* Badge — top left, bolder + bigger */
    .badge {
      position: absolute;
      top: 36px;
      left: 44px;
      ${badgeBg}
      ${badgeColor}
      padding: 18px 34px;
      border-radius: 999px;
      font-size: 30px;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 12px;
      letter-spacing: 0.5px;
      box-shadow: 0 10px 28px rgba(0,0,0,0.35);
      z-index: 15;
    }
    .badge-icon { font-size: 28px; }

    /* Attention stamp — tilted sticker, top-right of photo */
    .stamp {
      position: absolute;
      top: 52px;
      right: 28px;
      background: ${stampBg};
      color: white;
      padding: 14px 22px;
      border-radius: 10px;
      transform: rotate(-8deg);
      box-shadow: 0 12px 30px rgba(220,38,38,0.5), 0 0 0 4px ${stampAccent};
      z-index: 15;
      text-align: center;
      line-height: 1;
    }
    .stamp-text {
      font-size: 32px;
      font-weight: 900;
      letter-spacing: 1.5px;
      display: block;
    }
    .stamp-sub {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 3px;
      color: ${stampAccent};
      margin-top: 6px;
      text-transform: uppercase;
      display: block;
    }

    /* Corner brand stamp — small, top-right area doesn't conflict with sticker */
    .corner-brand {
      position: absolute;
      bottom: 36px;
      right: 36px;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(10px);
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 22px;
      font-weight: 700;
      color: white;
      letter-spacing: 1px;
      z-index: 15;
    }

    /* Bottom Info Panel */
    .info-panel {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(255,255,255,0.99);
      backdrop-filter: blur(8px);
      border-top-left-radius: 48px;
      border-top-right-radius: 48px;
      padding: 42px 48px 56px;
      box-shadow: 0 -15px 40px rgba(0,0,0,0.08);
    }

    /* Hero monthly payment — THE number people react to */
    .monthly-hero {
      display: flex;
      align-items: baseline;
      gap: 16px;
      margin-bottom: 10px;
    }
    .monthly-number {
      font-size: 110px;
      font-weight: 900;
      line-height: 1;
      background: linear-gradient(135deg, #00BC7D, #16a34a);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -2px;
    }
    .monthly-suffix {
      font-size: 46px;
      font-weight: 800;
      color: #64748b;
    }
    .monthly-label {
      font-size: 22px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 24px;
    }

    /* Secondary: list price (smaller, subdued) */
    .list-price {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #f1f5f9;
      padding: 10px 20px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .list-price-label {
      font-size: 18px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .list-price-value {
      font-size: 28px;
      font-weight: 800;
      color: #334155;
    }

    /* Location pill — city, state */
    .location-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, #ecfdf5, #dbeafe);
      border: 2px solid #00BC7D;
      padding: 12px 22px;
      border-radius: 999px;
      margin-bottom: 32px;
    }
    .location-pin { font-size: 22px; }
    .location-text {
      font-size: 26px;
      font-weight: 800;
      color: #111625;
      letter-spacing: 0.5px;
    }

    /* Quick Stats — bigger, bolder, colored */
    .stats-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 14px;
    }
    .stat {
      background: linear-gradient(135deg, #f0fdf4, #dbeafe);
      border: 2px solid #e2e8f0;
      border-radius: 20px;
      padding: 20px 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.04);
    }
    .stat-icon { font-size: 36px; }
    .stat-value { font-size: 36px; font-weight: 900; color: #111625; line-height: 1; }
    .stat-label { font-size: 18px; font-weight: 700; color: #64748b; letter-spacing: 1px; text-transform: uppercase; }

  </style>
</head>
<body>
  <div class="card">
    <!-- Image Section — Top 52% -->
    <div class="image-section">
      <img class="property-image" src="${property.primaryImage}" alt="Property" />
      <div class="image-gradient"></div>
      <div class="accent-bar"></div>
      <div class="badge">
        <span class="badge-icon">${badgeIcon}</span>
        <span>${badgeText}</span>
      </div>
      <div class="stamp">
        <span class="stamp-text">${stampText}</span>
        <span class="stamp-sub">ownerfi.ai</span>
      </div>
      <div class="corner-brand">ownerfi.ai</div>
    </div>

    <!-- Bottom Info Panel -->
    <div class="info-panel">
      ${monthly ? `
        <div class="monthly-hero">
          <span class="monthly-number">${monthly}</span>
          <span class="monthly-suffix">/mo</span>
        </div>
        <div class="monthly-label">Estimated monthly</div>
        <div class="list-price">
          <span class="list-price-label">List</span>
          <span class="list-price-value">${price}</span>
        </div>
      ` : `
        <div class="monthly-hero">
          <span class="monthly-number">${price}</span>
        </div>
        <div class="monthly-label">List price</div>
      `}

      <div style="height: 8px;"></div>

      <div class="location-pill">
        <span class="location-pin">📍</span>
        <span class="location-text">${location}</span>
      </div>

      <div class="stats-row">
        <div class="stat">
          <span class="stat-icon">🛏️</span>
          <span class="stat-value">${property.bedrooms}</span>
          <span class="stat-label">Beds</span>
        </div>
        <div class="stat">
          <span class="stat-icon">🚿</span>
          <span class="stat-value">${property.bathrooms}</span>
          <span class="stat-label">Baths</span>
        </div>
        <div class="stat">
          <span class="stat-icon">📐</span>
          <span class="stat-value">${(property.squareFeet || 0).toLocaleString()}</span>
          <span class="stat-label">Sq Ft</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// Firestore — rotation state
// ============================================================================

function getDb() {
  if (getApps().length === 0) {
    // Normalize private key: strip wrapping quotes, convert literal \n to newlines
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    privateKey = privateKey.replace(/^["']|["']$/g, ''); // strip wrapping quotes
    privateKey = privateKey.replace(/\\n/g, '\n');        // literal \n → newline

    if (!privateKey.includes('-----BEGIN')) {
      console.error('FIREBASE_PRIVATE_KEY does not look like a valid PEM key');
      console.error('First 40 chars:', privateKey.slice(0, 40));
      process.exit(1);
    }

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        privateKey,
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

  console.log(`=== Ownerfi Product Demo Card Generator — ${targetState} ===\n`);

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

// Only run when invoked directly, not when imported by preview/tests.
if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
