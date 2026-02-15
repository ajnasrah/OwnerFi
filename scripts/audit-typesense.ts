/**
 * Typesense Audit: Cross-reference Typesense index against Firestore
 *
 * Fetches ALL documents from the Typesense 'properties' collection
 * and checks each one against Firestore to find stale/invalid entries.
 *
 * This is READ-ONLY — no modifications are made.
 *
 * Usage: npx tsx scripts/audit-typesense.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');

dotenv.config({ path: '.env.local' });

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

// Initialize Typesense
const typesenseClient = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST,
    port: 443,
    protocol: 'https',
  }],
  apiKey: process.env.TYPESENSE_API_KEY || process.env.NEXT_PUBLIC_TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 10,
});

// ============================================
// Types
// ============================================
interface Finding {
  typesenseId: string;
  address: string;
  listPrice: number;
  dealType: string;
  reason: string;
  severity: 'REMOVE' | 'WARNING' | 'INFO';
  detail: string;
}

// ============================================
// Fetch ALL Typesense documents with pagination
// ============================================
async function fetchAllTypesenseDocs(): Promise<any[]> {
  const allDocs: any[] = [];
  const PER_PAGE = 250;
  let page = 1;
  let totalFound = 0;

  console.log('Fetching all documents from Typesense...');

  while (true) {
    const result = await typesenseClient.collections('properties').documents().search({
      q: '*',
      query_by: 'address',
      per_page: PER_PAGE,
      page,
    });

    if (page === 1) {
      totalFound = result.found;
      console.log(`  Total documents in Typesense: ${totalFound}`);
    }

    const hits = result.hits || [];
    if (hits.length === 0) break;

    for (const hit of hits) {
      allDocs.push(hit.document);
    }

    console.log(`  Fetched page ${page} (${allDocs.length}/${totalFound})`);

    if (allDocs.length >= totalFound) break;
    page++;
  }

  console.log(`  Done. Fetched ${allDocs.length} documents total.\n`);
  return allDocs;
}

// ============================================
// Look up Firestore docs in batches
// ============================================
async function batchGetFirestoreDocs(ids: string[]): Promise<Map<string, any>> {
  const result = new Map<string, any>();
  const BATCH_SIZE = 100; // Firestore getAll limit is ~100 at a time for safety

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const refs = chunk.map((id: string) => db.collection('properties').doc(id));
    const snapshots = await db.getAll(...refs);

    for (const snap of snapshots) {
      if (snap.exists) {
        result.set(snap.id, snap.data());
      }
      // If it doesn't exist, it won't be in the map
    }
  }

  return result;
}

// ============================================
// Main audit
// ============================================
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('TYPESENSE AUDIT: Cross-referencing index against Firestore');
  console.log('Mode: READ-ONLY (no modifications)');
  console.log('='.repeat(70) + '\n');

  // Step 1: Fetch all Typesense docs
  const tsDocs = await fetchAllTypesenseDocs();

  if (tsDocs.length === 0) {
    console.log('No documents in Typesense. Nothing to audit.');
    return;
  }

  // Step 2: Get all corresponding Firestore docs
  const tsIds = tsDocs.map((d: any) => d.id);
  console.log('Looking up corresponding Firestore documents...');
  const firestoreDocs = await batchGetFirestoreDocs(tsIds);
  console.log(`  Found ${firestoreDocs.size} of ${tsIds.length} in Firestore.\n`);

  // Step 3: Audit each Typesense doc
  const findings: Finding[] = [];
  let checkedCount = 0;

  // Stats
  let statMissingFromFirestore = 0;
  let statInactive = 0;
  let statNoDealType = 0;
  let statLowPrice = 0;
  let statNoAddress = 0;
  let statSuspiciousDiscount = 0;
  let statClean = 0;

  for (const tsDoc of tsDocs) {
    const id = tsDoc.id;
    const tsAddress = tsDoc.address || '(no address in Typesense)';
    const tsListPrice = tsDoc.listPrice || 0;
    const tsDealType = tsDoc.dealType || '(none)';
    checkedCount++;

    const fsDoc = firestoreDocs.get(id);
    let hasIssue = false;

    // Check 1: Does the Firestore doc exist?
    if (!fsDoc) {
      statMissingFromFirestore++;
      findings.push({
        typesenseId: id,
        address: tsAddress,
        listPrice: tsListPrice,
        dealType: tsDealType,
        reason: 'MISSING_FROM_FIRESTORE',
        severity: 'REMOVE',
        detail: 'Typesense doc has no corresponding Firestore document — orphaned index entry',
      });
      continue; // No point checking further if Firestore doc is gone
    }

    // Check 2: Is it active?
    if (fsDoc.isActive === false) {
      statInactive++;
      findings.push({
        typesenseId: id,
        address: tsAddress,
        listPrice: tsListPrice,
        dealType: tsDealType,
        reason: 'INACTIVE',
        severity: 'REMOVE',
        detail: `Firestore doc has isActive=false — should not be in search index`,
      });
      hasIssue = true;
    }

    // Check 3: Does it have a deal type?
    if (!fsDoc.isOwnerFinance && !fsDoc.isCashDeal) {
      statNoDealType++;
      findings.push({
        typesenseId: id,
        address: tsAddress,
        listPrice: tsListPrice,
        dealType: tsDealType,
        reason: 'NO_DEAL_TYPE',
        severity: 'REMOVE',
        detail: `Neither isOwnerFinance nor isCashDeal is true — not a valid deal`,
      });
      hasIssue = true;
    }

    // Check 4: Is the price >= $10,000?
    const fsPrice = fsDoc.price || fsDoc.listPrice || 0;
    if (fsPrice < 10_000) {
      statLowPrice++;
      findings.push({
        typesenseId: id,
        address: tsAddress,
        listPrice: tsListPrice,
        dealType: tsDealType,
        reason: 'LOW_PRICE',
        severity: 'REMOVE',
        detail: `Firestore price is $${fsPrice.toLocaleString()} (< $10,000) — garbage/placeholder`,
      });
      hasIssue = true;
    }

    // Check 5: Does it have an address?
    const fsAddress = fsDoc.streetAddress || fsDoc.address || fsDoc.fullAddress || '';
    if (!fsAddress || fsAddress.trim() === '' || fsAddress.trim() === ', ,') {
      statNoAddress++;
      findings.push({
        typesenseId: id,
        address: tsAddress,
        listPrice: tsListPrice,
        dealType: tsDealType,
        reason: 'NO_ADDRESS',
        severity: 'REMOVE',
        detail: `Firestore doc has no valid address`,
      });
      hasIssue = true;
    }

    // Check 6: Is it flagged suspiciousDiscount?
    if (fsDoc.suspiciousDiscount) {
      statSuspiciousDiscount++;
      findings.push({
        typesenseId: id,
        address: tsAddress,
        listPrice: tsListPrice,
        dealType: tsDealType,
        reason: 'SUSPICIOUS_DISCOUNT',
        severity: 'WARNING',
        detail: `Firestore doc flagged suspiciousDiscount=true (price=$${fsPrice.toLocaleString()}, zestimate=$${(fsDoc.zestimate || 0).toLocaleString()})`,
      });
      hasIssue = true;
    }

    if (!hasIssue) {
      statClean++;
    }
  }

  // ============================================
  // Report
  // ============================================
  console.log('='.repeat(70));
  console.log('AUDIT RESULTS');
  console.log('='.repeat(70));
  console.log(`\nTotal Typesense documents checked: ${checkedCount}`);
  console.log(`Total Firestore matches found:     ${firestoreDocs.size}`);
  console.log('');
  console.log('--- STATS ---');
  console.log(`  Clean (no issues):            ${statClean}`);
  console.log(`  Missing from Firestore:       ${statMissingFromFirestore}`);
  console.log(`  Inactive in Firestore:        ${statInactive}`);
  console.log(`  No deal type:                 ${statNoDealType}`);
  console.log(`  Low price (< $10k):           ${statLowPrice}`);
  console.log(`  No address:                   ${statNoAddress}`);
  console.log(`  Suspicious discount:          ${statSuspiciousDiscount}`);

  // Group findings by reason
  const byReason = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!byReason.has(f.reason)) byReason.set(f.reason, []);
    byReason.get(f.reason)!.push(f);
  }

  // Sort: REMOVE first, then WARNING, then INFO
  const severityOrder: Record<string, number> = { REMOVE: 0, WARNING: 1, INFO: 2 };
  const sortedReasons = [...byReason.entries()].sort((a, b) => {
    const aSev = severityOrder[a[1][0].severity] ?? 9;
    const bSev = severityOrder[b[1][0].severity] ?? 9;
    return aSev - bSev || b[1].length - a[1].length;
  });

  for (const [reason, items] of sortedReasons) {
    const sev = items[0].severity;
    console.log(`\n${'='.repeat(70)}`);
    console.log(`[${sev}] ${reason} (${items.length} documents)`);
    console.log('='.repeat(70));

    // Show up to 20 per category
    const SHOW_MAX = 20;
    for (const item of items.slice(0, SHOW_MAX)) {
      const priceStr = item.listPrice ? `$${item.listPrice.toLocaleString()}` : '$0';
      console.log(`  ${item.typesenseId}`);
      console.log(`    Address: ${item.address}`);
      console.log(`    Price: ${priceStr} | Deal: ${item.dealType}`);
      console.log(`    ${item.detail}`);
    }
    if (items.length > SHOW_MAX) {
      console.log(`  ... and ${items.length - SHOW_MAX} more`);
    }
  }

  // Final summary
  const removeCount = findings.filter(f => f.severity === 'REMOVE').length;
  const warningCount = findings.filter(f => f.severity === 'WARNING').length;
  const infoCount = findings.filter(f => f.severity === 'INFO').length;

  // Deduplicate: a single doc may have multiple findings, count unique IDs for REMOVE
  const uniqueRemoveIds = new Set(
    findings.filter(f => f.severity === 'REMOVE').map(f => f.typesenseId)
  );

  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Typesense documents:    ${checkedCount}`);
  console.log(`Clean documents:              ${statClean}`);
  console.log(`Findings (REMOVE):            ${removeCount} (${uniqueRemoveIds.size} unique docs)`);
  console.log(`Findings (WARNING):           ${warningCount}`);
  console.log(`Findings (INFO):              ${infoCount}`);
  console.log(`Total findings:               ${findings.length}`);
  console.log('');
  if (uniqueRemoveIds.size > 0) {
    console.log(`ACTION NEEDED: ${uniqueRemoveIds.size} documents should be removed from Typesense.`);
    console.log('These are orphaned, inactive, missing deal type, low price, or missing address.');
  } else {
    console.log('No documents need removal. Typesense index looks clean!');
  }
  console.log('='.repeat(70) + '\n');
}

main().catch(console.error).finally(() => process.exit(0));
