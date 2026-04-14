/**
 * Repair: for every Firestore property with isAuction / isForeclosure /
 * isBankOwned = true, upsert the Typesense mirror with the correct flags,
 * listingSubType, and recomputed dealType.
 *
 * Uses `action: 'upsert'` (not 'update'), so missing docs are recreated.
 * Reads the full Firestore doc to reconstruct a Typesense-shaped record.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');

dotenv.config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();

const ts = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST,
    port: 443,
    protocol: 'https',
  }],
  apiKey: process.env.TYPESENSE_API_KEY || process.env.NEXT_PUBLIC_TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 15,
});

const LAND_TYPES = new Set(['land', 'lot', 'lots', 'vacant_land', 'farm', 'ranch']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toTypesenseDoc(id: string, data: any) {
  const price = data.price || data.listPrice || 0;
  const zest = data.estimate || data.zestimate || 0;
  const percentOfArv = zest > 0 ? Math.round((price / zest) * 1000) / 10 : undefined;

  const isAuction = data.isAuction === true;
  const isForeclosure = data.isForeclosure === true;
  const isBankOwned = data.isBankOwned === true;
  const listingSubType = data.listingSubType || '';

  // Distressed listings are never owner_finance. Preserve cash_deal if set.
  const isDistressed = isAuction || isForeclosure || isBankOwned;
  let dealType: string;
  if (isDistressed) dealType = 'cash_deal';
  else if (data.isOwnerfinance && data.isCashDeal) dealType = 'both';
  else if (data.isOwnerfinance) dealType = 'owner_finance';
  else if (data.isCashDeal) dealType = 'cash_deal';
  else dealType = 'cash_deal';

  const propType = String(data.homeType || data.propertyType || 'other').toLowerCase();
  const isLand = data.isLand === true || LAND_TYPES.has(propType);

  const doc: Record<string, unknown> = {
    id,
    zpid: String(data.zpid || ''),
    address: data.streetAddress || data.address || data.fullAddress || '',
    city: data.city || '',
    state: data.state || '',
    zipCode: data.zipCode || data.zipcode || '',
    propertyType: propType,
    bedrooms: data.bedrooms || 0,
    bathrooms: data.bathrooms || 0,
    squareFeet: data.squareFoot || data.squareFeet || undefined,
    yearBuilt: data.yearBuilt || undefined,
    listPrice: price,
    zestimate: zest || undefined,
    rentEstimate: data.rentEstimate || undefined,
    monthlyPayment: data.monthlyPayment || undefined,
    downPaymentAmount: data.downPaymentAmount || undefined,
    downPaymentPercent: data.downPaymentPercent || undefined,
    interestRate: data.interestRate || undefined,
    termYears: data.termYears || data.loanTermYears || undefined,
    balloonYears: data.balloonYears || undefined,
    dealType,
    isActive: data.isActive !== false,
    isLand,
    isAuction,
    isForeclosure,
    isBankOwned,
    listingSubType,
    needsWork: data.needsWork === true,
    percentOfArv,
    homeStatus: data.homeStatus || '',
    primaryImage: data.firstPropertyImage || data.primaryImage || data.imgSrc || '',
    galleryImages: Array.isArray(data.propertyImages) ? data.propertyImages : undefined,
    financingType: data.financingType || undefined,
    ownerFinanceKeywords: Array.isArray(data.matchedKeywords) ? data.matchedKeywords : undefined,
    sourceType: data.source || 'scraper',
    manuallyVerified: data.manuallyVerified === true,
    nearbyCities: Array.isArray(data.nearbyCities) ? data.nearbyCities : [],
    description: data.description || '',
    url: data.url || `https://www.zillow.com/homedetails/${data.zpid}_zpid/`,
    createdAt: typeof data.createdAt?.toMillis === 'function'
      ? data.createdAt.toMillis()
      : Date.now(),
    updatedAt: Date.now(),
  };

  // Remove undefined so Typesense doesn't complain
  Object.keys(doc).forEach(k => { if (doc[k] === undefined) delete doc[k]; });

  return doc;
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`REPAIR: distressed property Typesense mirrors`);
  console.log(`Mode:   ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  const fs = db.collection('properties');
  const [a, f, b] = await Promise.all([
    fs.where('isAuction', '==', true).get(),
    fs.where('isForeclosure', '==', true).get(),
    fs.where('isBankOwned', '==', true).get(),
  ]);

  const byId = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any
  [...a.docs, ...f.docs, ...b.docs].forEach(d => {
    if (!byId.has(d.id)) byId.set(d.id, d);
  });

  console.log(`Distressed in Firestore: ${byId.size}\n`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docs: any[] = [];
  for (const doc of byId.values()) {
    const data = doc.data();
    const tsDoc = toTypesenseDoc(doc.id, data);
    docs.push(tsDoc);
    console.log(`  ${data.streetAddress || doc.id}  dealType=${tsDoc.dealType} subType="${tsDoc.listingSubType}"`);
  }

  if (DRY_RUN) {
    console.log(`\nDRY RUN — would upsert ${docs.length}\n`);
    return;
  }

  const jsonl = docs.map(d => JSON.stringify(d)).join('\n');
  try {
    const result = await ts.collections('properties').documents().import(jsonl, { action: 'upsert' });
    // Typesense returns newline-separated JSON lines, one per input doc.
    // Parse response and surface any errors.
    const lines = String(result).split('\n');
    let success = 0;
    let failed = 0;
    lines.forEach((line, i) => {
      try {
        const r = JSON.parse(line);
        if (r.success) success++;
        else {
          failed++;
          console.error(`  ✗ Line ${i}: ${line}`);
        }
      } catch {
        // Not JSON — treat as failure
        failed++;
        console.error(`  ✗ Line ${i} not JSON: ${line}`);
      }
    });
    console.log(`\nTypesense upsert: ${success} success, ${failed} failed`);
  } catch (err) {
    console.error('Typesense upsert failed:', err);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
