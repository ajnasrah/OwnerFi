/**
 * Read-only verification: for every Firestore property with isAuction /
 * isForeclosure / isBankOwned = true, confirm that:
 *   1. It is NOT tagged as owner_finance in Firestore
 *   2. It is NOT tagged as dealType='owner_finance' or 'both' in Typesense
 *   3. Typesense mirror has the correct isAuction/isForeclosure/isBankOwned/listingSubType
 *
 * Prints any drift as a row with a "FIX:" note. Does not write anything.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');

dotenv.config({ path: '.env.local' });

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

async function main() {
  console.log('\n========== DISTRESSED-STATE VERIFICATION ==========\n');

  const fs = db.collection('properties');
  const [a, f, b] = await Promise.all([
    fs.where('isAuction', '==', true).get(),
    fs.where('isForeclosure', '==', true).get(),
    fs.where('isBankOwned', '==', true).get(),
  ]);

  const seen = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const distressed: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [...a.docs, ...f.docs, ...b.docs].forEach((d: any) => {
    if (seen.has(d.id)) return;
    seen.add(d.id);
    distressed.push(d);
  });

  console.log(`Distressed in Firestore: ${distressed.length}`);
  console.log(`  isAuction=true:     ${a.size}`);
  console.log(`  isForeclosure=true: ${f.size}`);
  console.log(`  isBankOwned=true:   ${b.size}\n`);

  let drift = 0;
  let ok = 0;

  // Pull Typesense docs for each distressed id
  for (const doc of distressed) {
    const fs = doc.data();
    const issues: string[] = [];

    // Firestore checks
    if (fs.isOwnerfinance === true) issues.push('FS isOwnerfinance=true (should be false)');
    if (Array.isArray(fs.dealTypes) && fs.dealTypes.includes('owner_finance')) {
      issues.push('FS dealTypes contains "owner_finance"');
    }

    // Typesense mirror check
    let tsDoc: Record<string, unknown> | null = null;
    try {
      tsDoc = await ts.collections('properties').documents(doc.id).retrieve();
    } catch {
      issues.push('Typesense: missing doc');
    }

    if (tsDoc) {
      const tsDealType = tsDoc.dealType as string;
      if (tsDealType === 'owner_finance' || tsDealType === 'both') {
        issues.push(`TS dealType='${tsDealType}' (should be 'cash_deal' or missing)`);
      }
      if (tsDoc.isAuction !== (fs.isAuction === true)) issues.push(`TS isAuction=${tsDoc.isAuction} vs FS ${fs.isAuction}`);
      if (tsDoc.isForeclosure !== (fs.isForeclosure === true)) issues.push(`TS isForeclosure=${tsDoc.isForeclosure} vs FS ${fs.isForeclosure}`);
      if (tsDoc.isBankOwned !== (fs.isBankOwned === true)) issues.push(`TS isBankOwned=${tsDoc.isBankOwned} vs FS ${fs.isBankOwned}`);
      if ((tsDoc.listingSubType || '') !== (fs.listingSubType || '')) issues.push(`TS listingSubType='${tsDoc.listingSubType}' vs FS '${fs.listingSubType}'`);
    }

    const addr = fs.streetAddress || fs.fullAddress || doc.id;
    if (issues.length > 0) {
      drift++;
      console.log(`  ❌ ${addr}`);
      issues.forEach(i => console.log(`     ${i}`));
    } else {
      ok++;
    }
  }

  console.log(`\n========== RESULT ==========`);
  console.log(`OK:    ${ok}`);
  console.log(`DRIFT: ${drift}`);
  console.log('============================\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
