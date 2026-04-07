/**
 * Database Audit: Find weird/broken property data
 *
 * Usage: npx tsx scripts/audit-properties.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

interface Issue {
  id: string;
  address: string;
  category: string;
  detail: string;
  price?: number;
  severity: 'critical' | 'warning' | 'info';
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('DATABASE AUDIT: Scanning all properties...');
  console.log('='.repeat(60) + '\n');

  const snapshot = await db.collection('properties').get();
  console.log(`Total properties in database: ${snapshot.size}\n`);

  const issues: Issue[] = [];
  const addressMap = new Map<string, string[]>(); // address -> [docIds]
  const zpidMap = new Map<string, string[]>(); // zpid -> [docIds]

  let totalActive = 0;
  let totalInactive = 0;
  let totalOwnerFinance = 0;
  let totalCashDeal = 0;
  let totalBoth = 0;
  let totalNoDealType = 0;

  for (const doc of snapshot.docs) {
    const d = doc.data();
    const id = doc.id;
    const addr = d.streetAddress || d.address || d.fullAddress || '(no address)';
    const price = d.price || d.listPrice || 0;
    const zestimate = d.zestimate || d.estimate || d.estimatedValue || 0;

    // === STATS ===
    if (d.isActive !== false) totalActive++;
    else totalInactive++;
    if (d.isOwnerfinance && d.isCashDeal) totalBoth++;
    else if (d.isOwnerfinance) totalOwnerFinance++;
    else if (d.isCashDeal) totalCashDeal++;
    else totalNoDealType++;

    // === MISSING/BROKEN ADDRESS ===
    if (!d.city || !d.state) {
      issues.push({ id, address: addr, category: 'MISSING_LOCATION', detail: `city="${d.city || ''}" state="${d.state || ''}"`, price, severity: 'critical' });
    }
    if (!addr || addr === '(no address)' || addr.trim() === '' || addr.trim() === ', ,') {
      issues.push({ id, address: addr, category: 'MISSING_ADDRESS', detail: 'No address data', price, severity: 'critical' });
    } else if (/\b(undisclosed|hidden|private|not\s*disclosed|no\s+address|confidential|unlisted|restricted)\b/i.test(addr)) {
      issues.push({ id, address: addr, category: 'MISSING_ADDRESS', detail: `Placeholder address: "${addr}"`, price, severity: 'critical' });
    }

    // === PRICE ANOMALIES ===
    if (price > 5_000_000) {
      issues.push({ id, address: addr, category: 'EXTREME_HIGH_PRICE', detail: `$${price.toLocaleString()}`, price, severity: 'warning' });
    }
    if (price >= 10000 && price < 20000) {
      issues.push({ id, address: addr, category: 'VERY_LOW_PRICE', detail: `$${price.toLocaleString()} — borderline, may be garbage`, price, severity: 'info' });
    }

    // === ZESTIMATE ANOMALIES ===
    if (d.isCashDeal && (!zestimate || zestimate <= 0)) {
      issues.push({ id, address: addr, category: 'CASH_DEAL_NO_ZESTIMATE', detail: `Cash deal with no Zestimate — discount % is meaningless`, price, severity: 'critical' });
    }
    if (zestimate > 0 && price > 0 && price > zestimate * 2) {
      issues.push({ id, address: addr, category: 'PRICE_ABOVE_2X_ZESTIMATE', detail: `$${price.toLocaleString()} price vs $${zestimate.toLocaleString()} Zestimate (${((price/zestimate)*100).toFixed(0)}%)`, price, severity: 'warning' });
    }
    if (zestimate > 0 && price > 0 && price < zestimate * 0.2) {
      issues.push({ id, address: addr, category: 'SUSPICIOUS_DISCOUNT', detail: `$${price.toLocaleString()} is ${((price/zestimate)*100).toFixed(1)}% of $${zestimate.toLocaleString()} Zestimate — likely bad data`, price, severity: 'critical' });
    }

    // === NO DEAL TYPE ===
    if (!d.isOwnerfinance && !d.isCashDeal) {
      issues.push({ id, address: addr, category: 'NO_DEAL_TYPE', detail: 'Neither owner finance nor cash deal', price, severity: 'warning' });
    }

    // === STATUS ISSUES ===
    const homeStatus = (d.homeStatus || '').toUpperCase();
    if (homeStatus && homeStatus !== 'FOR_SALE' && d.isActive !== false) {
      issues.push({ id, address: addr, category: 'NOT_FOR_SALE_BUT_ACTIVE', detail: `homeStatus="${d.homeStatus}" but isActive=true`, price, severity: 'warning' });
    }

    // === MISSING IMAGES ===
    const hasImage = d.firstPropertyImage || d.imgSrc || (d.propertyImages && d.propertyImages.length > 0) || (d.imageUrls && d.imageUrls.length > 0);
    if (!hasImage && d.isActive !== false) {
      issues.push({ id, address: addr, category: 'NO_IMAGES', detail: 'Active property with no images', price, severity: 'info' });
    }

    // === MISSING ZPID ===
    if (!d.zpid && id.startsWith('zpid_')) {
      issues.push({ id, address: addr, category: 'MISSING_ZPID_FIELD', detail: 'Doc ID starts with zpid_ but zpid field is missing', price, severity: 'info' });
    }

    // === DUPLICATE DETECTION ===
    const normalizedAddr = (addr || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedAddr && normalizedAddr.length > 5) {
      if (!addressMap.has(normalizedAddr)) addressMap.set(normalizedAddr, []);
      addressMap.get(normalizedAddr)!.push(id);
    }

    const zpid = d.zpid ? String(d.zpid) : null;
    if (zpid) {
      if (!zpidMap.has(zpid)) zpidMap.set(zpid, []);
      zpidMap.get(zpid)!.push(id);
    }

    // === MISSING KEY FIELDS ===
    if (!d.bedrooms && !d.beds && d.isActive !== false) {
      const ht = (d.homeType || d.propertyType || '').toLowerCase();
      if (ht !== 'land' && !d.isLand) {
        issues.push({ id, address: addr, category: 'MISSING_BEDROOMS', detail: 'No bedroom count (non-land)', price, severity: 'info' });
      }
    }

    // === OWNER FINANCE WITH NO TERMS ===
    if (d.isOwnerfinance && d.isActive !== false) {
      const hasAnyTerms = d.monthlyPayment || d.downPaymentAmount || d.interestRate;
      if (!hasAnyTerms) {
        issues.push({ id, address: addr, category: 'OF_NO_TERMS', detail: 'Owner finance with no financing terms (no payment/down/rate)', price, severity: 'info' });
      }
    }
  }

  // === DUPLICATE ADDRESSES ===
  for (const [addr, ids] of addressMap) {
    if (ids.length > 1) {
      issues.push({ id: ids.join(', '), address: addr.substring(0, 50), category: 'DUPLICATE_ADDRESS', detail: `${ids.length} docs with same address: ${ids.join(', ')}`, severity: 'warning' });
    }
  }

  // === DUPLICATE ZPIDS ===
  for (const [zpid, ids] of zpidMap) {
    if (ids.length > 1) {
      issues.push({ id: ids.join(', '), address: `zpid=${zpid}`, category: 'DUPLICATE_ZPID', detail: `${ids.length} docs with same zpid: ${ids.join(', ')}`, severity: 'critical' });
    }
  }

  // === PRINT RESULTS ===
  console.log('--- STATS ---');
  console.log(`Active: ${totalActive}`);
  console.log(`Inactive: ${totalInactive}`);
  console.log(`Owner Finance only: ${totalOwnerFinance}`);
  console.log(`Cash Deal only: ${totalCashDeal}`);
  console.log(`Both: ${totalBoth}`);
  console.log(`No deal type: ${totalNoDealType}`);
  console.log('');

  // Group by category
  const byCategory = new Map<string, Issue[]>();
  for (const issue of issues) {
    if (!byCategory.has(issue.category)) byCategory.set(issue.category, []);
    byCategory.get(issue.category)!.push(issue);
  }

  // Sort: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  const sortedCategories = [...byCategory.entries()].sort((a, b) => {
    const aSev = severityOrder[a[1][0].severity];
    const bSev = severityOrder[b[1][0].severity];
    return aSev - bSev || b[1].length - a[1].length;
  });

  for (const [category, catIssues] of sortedCategories) {
    const sev = catIssues[0].severity.toUpperCase();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${sev}] ${category} (${catIssues.length} properties)`);
    console.log('='.repeat(60));
    // Show up to 15 per category
    for (const issue of catIssues.slice(0, 15)) {
      const priceStr = issue.price ? ` ($${issue.price.toLocaleString()})` : '';
      console.log(`  ${issue.id}${priceStr}`);
      console.log(`    ${issue.detail}`);
    }
    if (catIssues.length > 15) {
      console.log(`  ... and ${catIssues.length - 15} more`);
    }
  }

  // Summary
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log('AUDIT SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total properties: ${snapshot.size}`);
  console.log(`Critical issues: ${criticalCount}`);
  console.log(`Warnings: ${warningCount}`);
  console.log(`Info: ${infoCount}`);
  console.log(`Total issues: ${issues.length}`);
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error).finally(() => process.exit(0));
