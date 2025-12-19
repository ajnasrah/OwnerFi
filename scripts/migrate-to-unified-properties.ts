#!/usr/bin/env tsx
/**
 * MIGRATION SCRIPT: Merge zillow_imports + cash_houses → unified properties collection
 *
 * Strategy:
 * 1. Read all properties from both collections
 * 2. Merge by ZPID (unique identifier)
 * 3. Assign dealTypes based on which collection(s) the property was in
 * 4. Write to 'properties' collection
 * 5. Verify migration success
 *
 * Run with: npx -y dotenv-cli -e .env.local -- npx tsx scripts/migrate-to-unified-properties.ts
 * Add --dry-run for testing without writes (default)
 * Add --execute to actually perform the migration
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

const DRY_RUN = !process.argv.includes('--execute');
const BATCH_SIZE = 400;

// Helper to recursively remove undefined values from object (Firestore doesn't accept undefined)
function removeUndefined<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue; // Skip undefined
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp)) {
      // Recursively clean nested objects (but not arrays, null, or Timestamps)
      result[key] = removeUndefined(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

interface SourceProperty {
  id: string;
  zpid?: string | number;
  data: Record<string, any>;
  source: 'zillow_imports' | 'cash_houses';
}

interface UnifiedProperty {
  // Identity
  zpid: string;

  // Deal type tags
  dealTypes: string[];
  isOwnerFinance: boolean;
  isCashDeal: boolean;

  // Why it qualifies
  ownerFinanceVerified?: boolean;
  ownerFinanceKeywords?: string[];
  primaryKeyword?: string;
  cashDealReason?: 'discount' | 'needs_work' | 'both';
  discountPercent?: number;
  needsWork?: boolean;
  needsWorkKeywords?: string[];

  // All existing property fields
  [key: string]: any;
}

async function migrate() {
  console.log('\n' + '='.repeat(60));
  console.log(DRY_RUN ? '🔍 DRY RUN MODE - No writes will occur' : '🚀 EXECUTE MODE - Will write to database');
  console.log('='.repeat(60) + '\n');

  // Step 1: Read all properties from both collections
  console.log('📖 Reading from zillow_imports...');
  const zillowSnap = await db.collection('zillow_imports').get();
  console.log(`   Found ${zillowSnap.size} documents`);

  console.log('📖 Reading from cash_houses...');
  const cashSnap = await db.collection('cash_houses').get();
  console.log(`   Found ${cashSnap.size} documents`);

  // Step 2: Build maps by ZPID
  const zillowByZpid = new Map<string, SourceProperty>();
  const cashByZpid = new Map<string, SourceProperty>();
  const noZpidProperties: SourceProperty[] = [];

  // Process zillow_imports
  for (const doc of zillowSnap.docs) {
    const data = doc.data();
    const zpid = String(data.zpid || '').trim();

    if (!zpid) {
      noZpidProperties.push({ id: doc.id, data, source: 'zillow_imports' });
      continue;
    }

    // If duplicate ZPID in same collection, keep the one with more data
    if (zillowByZpid.has(zpid)) {
      const existing = zillowByZpid.get(zpid)!;
      const existingFields = Object.keys(existing.data).length;
      const newFields = Object.keys(data).length;
      if (newFields > existingFields) {
        zillowByZpid.set(zpid, { id: doc.id, zpid, data, source: 'zillow_imports' });
      }
    } else {
      zillowByZpid.set(zpid, { id: doc.id, zpid, data, source: 'zillow_imports' });
    }
  }

  // Process cash_houses
  for (const doc of cashSnap.docs) {
    const data = doc.data();
    const zpid = String(data.zpid || '').trim();

    if (!zpid) {
      noZpidProperties.push({ id: doc.id, data, source: 'cash_houses' });
      continue;
    }

    if (cashByZpid.has(zpid)) {
      const existing = cashByZpid.get(zpid)!;
      const existingFields = Object.keys(existing.data).length;
      const newFields = Object.keys(data).length;
      if (newFields > existingFields) {
        cashByZpid.set(zpid, { id: doc.id, zpid, data, source: 'cash_houses' });
      }
    } else {
      cashByZpid.set(zpid, { id: doc.id, zpid, data, source: 'cash_houses' });
    }
  }

  console.log(`\n📊 Unique ZPIDs:`);
  console.log(`   zillow_imports: ${zillowByZpid.size}`);
  console.log(`   cash_houses: ${cashByZpid.size}`);
  console.log(`   Properties without ZPID: ${noZpidProperties.length}`);

  // Step 3: Merge properties
  const allZpids = new Set([...zillowByZpid.keys(), ...cashByZpid.keys()]);
  console.log(`   Total unique ZPIDs: ${allZpids.size}`);

  const unifiedProperties: UnifiedProperty[] = [];
  let inBothCount = 0;
  let onlyZillowCount = 0;
  let onlyCashCount = 0;

  for (const zpid of allZpids) {
    const fromZillow = zillowByZpid.get(zpid);
    const fromCash = cashByZpid.get(zpid);

    // Determine deal types
    const dealTypes: string[] = [];
    let isOwnerFinance = false;
    let isCashDeal = false;

    if (fromZillow) {
      // Was in zillow_imports = owner finance
      dealTypes.push('owner_finance');
      isOwnerFinance = true;
    }

    if (fromCash) {
      // Was in cash_houses = cash deal
      dealTypes.push('cash_deal');
      isCashDeal = true;
    }

    // Track stats
    if (fromZillow && fromCash) {
      inBothCount++;
    } else if (fromZillow) {
      onlyZillowCount++;
    } else {
      onlyCashCount++;
    }

    // Merge data (prefer zillow_imports data as primary, then overlay cash_houses)
    const baseData = fromZillow?.data || {};
    const cashData = fromCash?.data || {};

    // Merge: start with cash data, overlay with zillow data (zillow takes precedence)
    const mergedData = { ...cashData, ...baseData };

    // Build unified property (remove undefined values for Firestore compatibility)
    const unified: UnifiedProperty = removeUndefined({
      ...mergedData,
      zpid,
      dealTypes,
      isOwnerFinance,
      isCashDeal,

      // Preserve owner finance verification
      ownerFinanceVerified: isOwnerFinance || mergedData.ownerFinanceVerified || false,

      // Add cash deal metadata if applicable (only if it's a cash deal)
      ...(isCashDeal && { cashDealReason: mergedData.cashDealReason || detectCashDealReason(mergedData) }),

      // Ensure isActive is set
      isActive: mergedData.isActive !== false && mergedData.status !== 'sold',

      // Track migration
      migratedAt: Timestamp.now(),
      migratedFrom: fromZillow && fromCash ? 'both' : (fromZillow ? 'zillow_imports' : 'cash_houses'),
    });

    unifiedProperties.push(unified);
  }

  // Also add properties without ZPIDs (use doc ID as identifier)
  for (const prop of noZpidProperties) {
    const dealTypes: string[] = [];
    const isOwnerFinance = prop.source === 'zillow_imports';
    const isCashDeal = prop.source === 'cash_houses';

    if (isOwnerFinance) dealTypes.push('owner_finance');
    if (isCashDeal) dealTypes.push('cash_deal');

    unifiedProperties.push(removeUndefined({
      ...prop.data,
      zpid: prop.id, // Use doc ID as fallback
      dealTypes,
      isOwnerFinance,
      isCashDeal,
      ownerFinanceVerified: isOwnerFinance,
      isActive: prop.data.isActive !== false && prop.data.status !== 'sold',
      migratedAt: Timestamp.now(),
      migratedFrom: prop.source,
      noOriginalZpid: true,
    }));
  }

  console.log(`\n📈 Migration Summary:`);
  console.log(`   In BOTH collections (will have both tags): ${inBothCount}`);
  console.log(`   Only in zillow_imports (owner_finance only): ${onlyZillowCount}`);
  console.log(`   Only in cash_houses (cash_deal only): ${onlyCashCount}`);
  console.log(`   Properties without ZPID: ${noZpidProperties.length}`);
  console.log(`   Total unified properties: ${unifiedProperties.length}`);

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN - Sample of first 5 properties:');
    for (const prop of unifiedProperties.slice(0, 5)) {
      console.log(`   ZPID: ${prop.zpid}`);
      console.log(`     dealTypes: ${prop.dealTypes.join(', ')}`);
      console.log(`     isOwnerFinance: ${prop.isOwnerFinance}`);
      console.log(`     isCashDeal: ${prop.isCashDeal}`);
      console.log(`     address: ${prop.streetAddress || prop.address}, ${prop.city}, ${prop.state}`);
      console.log('');
    }

    console.log('\n⚠️  DRY RUN COMPLETE - No changes made');
    console.log('   Run with --execute flag to perform migration');
    return;
  }

  // Step 4: Write to properties collection
  console.log(`\n📝 Writing ${unifiedProperties.length} properties to 'properties' collection...`);

  let written = 0;
  for (let i = 0; i < unifiedProperties.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = unifiedProperties.slice(i, i + BATCH_SIZE);

    for (const prop of slice) {
      // Use ZPID as document ID for easy lookup and deduplication
      const docId = `zpid_${prop.zpid}`;
      const docRef = db.collection('properties').doc(docId);
      batch.set(docRef, prop, { merge: true });
    }

    await batch.commit();
    written += slice.length;
    console.log(`   Written ${written}/${unifiedProperties.length}...`);
  }

  // Step 5: Verify
  console.log('\n✅ Migration complete!');

  const propertiesSnap = await db.collection('properties').get();
  console.log(`\n📊 Final counts:`);
  console.log(`   properties collection: ${propertiesSnap.size} documents`);

  // Count by deal type
  let ownerFinanceCount = 0;
  let cashDealCount = 0;
  let bothCount = 0;

  for (const doc of propertiesSnap.docs) {
    const data = doc.data();
    const hasOwnerFinance = data.dealTypes?.includes('owner_finance');
    const hasCashDeal = data.dealTypes?.includes('cash_deal');

    if (hasOwnerFinance && hasCashDeal) bothCount++;
    else if (hasOwnerFinance) ownerFinanceCount++;
    else if (hasCashDeal) cashDealCount++;
  }

  console.log(`   - Owner Finance only: ${ownerFinanceCount}`);
  console.log(`   - Cash Deal only: ${cashDealCount}`);
  console.log(`   - Both: ${bothCount}`);

  console.log('\n🎉 Migration successful!');
  console.log('\nNext steps:');
  console.log('1. Update scrapers to write to "properties" collection');
  console.log('2. Update APIs to read from "properties" collection');
  console.log('3. After verification, delete zillow_imports and cash_houses collections');
}

function detectCashDealReason(data: Record<string, any>): 'discount' | 'needs_work' | 'both' | undefined {
  const price = data.price || data.listPrice || 0;
  const zestimate = data.zestimate || data.estimate || 0;
  const needsWork = data.needsWork || false;

  const hasDiscount = zestimate > 0 && price > 0 && price < (zestimate * 0.8);

  if (hasDiscount && needsWork) return 'both';
  if (hasDiscount) return 'discount';
  if (needsWork) return 'needs_work';
  return undefined;
}

migrate()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  });
