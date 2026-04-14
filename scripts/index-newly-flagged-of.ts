/**
 * Index newly-flagged OF properties into Typesense. These properties
 * were previously saved to Firestore as stubs (filter failed at save
 * time) but the current filter flags them as owner-finance, so they
 * need to show up in the UI.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { runUnifiedFilter } from '../src/lib/scraper-v2/unified-filter';
import { indexPropertiesBatch } from '../src/lib/typesense/sync';
import { UnifiedProperty } from '../src/lib/unified-property-schema';
import { TARGETED_CASH_ZIPS } from '../src/lib/scraper-v2/search-config';

async function main() {
  const { db } = getFirebaseAdmin();
  const chunks: string[][] = [];
  for (let i = 0; i < TARGETED_CASH_ZIPS.length; i += 30) {
    chunks.push(TARGETED_CASH_ZIPS.slice(i, i + 30));
  }

  const toIndex: UnifiedProperty[] = [];

  for (const chunk of chunks) {
    const snap = await db.collection('properties')
      .where('zipCode', 'in', chunk)
      .where('isOwnerfinance', '==', true)
      .get();

    snap.forEach(doc => {
      const d = doc.data();

      // Skip non-active listings — don't resurrect PENDING/SOLD into Typesense
      const hs = String(d.homeStatus || '').toUpperCase();
      const allowed = new Set(['FOR_SALE','FOR_AUCTION','FORECLOSURE','FORECLOSED','PRE_FORECLOSURE']);
      if (d.isActive === false) return;
      if (hs && !allowed.has(hs)) return;

      const fr = runUnifiedFilter(
        d.description || '',
        d.listPrice ?? d.price,
        d.zestimate ?? d.estimate,
        d.propertyType || d.homeType,
        { isAuction: d.isAuction, isForeclosure: d.isForeclosure, isBankOwned: d.isBankOwned }
      );

      const dealType: any = fr.isOwnerfinance && fr.isCashDeal
        ? 'both' : fr.isOwnerfinance ? 'owner_finance' : 'cash_deal';

      toIndex.push({
        id: doc.id,
        zpid: String(d.zpid),
        address: d.streetAddress || d.fullAddress || '',
        city: d.city || '',
        state: d.state || '',
        zipCode: d.zipCode || '',
        latitude: d.latitude,
        longitude: d.longitude,
        propertyType: (d.propertyType || d.homeType || 'other') as any,
        isLand: fr.isLand || false,
        isAuction: d.isAuction || false,
        isForeclosure: d.isForeclosure || false,
        isBankOwned: d.isBankOwned || false,
        listingSubType: d.listingSubType || '',
        bedrooms: d.bedrooms || 0,
        bathrooms: d.bathrooms || 0,
        squareFeet: d.squareFoot,
        yearBuilt: d.yearBuilt,
        listPrice: d.listPrice ?? d.price ?? 0,
        zestimate: d.zestimate ?? d.estimate,
        dealType,
        status: 'active',
        isActive: true, // filtered above — only active FOR_SALE reaches here
        nearbyCities: d.nearbyCities || [],
        ownerFinance: fr.isOwnerfinance ? {
          verified: true,
          financingType: 'owner_finance' as const,
          primaryKeyword: fr.primaryOwnerfinanceKeyword || 'owner financing',
          matchedKeywords: fr.ownerFinanceKeywords || [],
        } : undefined,
        cashDeal: fr.isCashDeal ? {
          reason: fr.cashDealReason || 'discount',
          discountPercent: fr.discountPercentage,
          needsWork: fr.needsWork,
          needsWorkKeywords: fr.needsWorkKeywords,
        } : undefined,
        source: { type: 'scraper', provider: 'apify', importedAt: new Date().toISOString() },
        verification: { autoVerified: true, manuallyVerified: false, needsReview: false },
        images: { primary: d.firstPropertyImage || d.images?.primary || '', gallery: d.propertyImages || d.images?.gallery || [] },
        description: d.description || '',
        contact: { agentName: d.agentName, agentPhone: d.agentPhoneNumber },
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as UnifiedProperty);
    });
  }

  console.log(`Indexing ${toIndex.length} OF properties to Typesense...`);
  const r = await indexPropertiesBatch(toIndex, { batchSize: 100 });
  console.log(`Success: ${r.success}, Failed: ${r.failed}`);
}

main().catch(e => { console.error(e); process.exit(1); });
