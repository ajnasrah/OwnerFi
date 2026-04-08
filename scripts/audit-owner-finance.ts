/**
 * AUDIT SCRIPT: Owner Finance Property Verification
 *
 * Checks EVERY property marked as owner finance in Firestore and verifies it qualifies via:
 * 1. Owner finance keywords detected in description (scraper pipeline)
 * 2. Agent confirmed "Interested" in GHL (agent outreach pipeline)
 * 3. Agent-submitted via GHL (source = 'gohighlevel' with ownerFinanceVerified)
 *
 * Any property that doesn't meet ANY of these criteria is flagged as INVALID
 * and optionally cleaned up (set isOwnerfinance = false, remove from dealTypes).
 *
 * Usage:
 *   npx tsx scripts/audit-owner-finance.ts          # Dry run (report only)
 *   npx tsx scripts/audit-owner-finance.ts --fix     # Fix invalid properties
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { hasStrictOwnerfinancing } from '../src/lib/owner-financing-filter-strict';
import { hasNegativeKeywords } from '../src/lib/negative-keywords';

// GHL "Interested" stage firebase_ids from opportunities.csv export
const GHL_INTERESTED_IDS = new Set([
  'YKyiClrB5wS5ahp0Rgj7', 'wsd2j9Dz3ZTXM7xh2u0Z', '2AdXpJlw9lcl8C0v5Jez',
  '2JSIpIXDBiQt5VJfnbhl', 'GDP4wPl2pjsIu6JPOrGm', 'hQL2XFP6nggbJiptrBfx',
  'sJPXcJVFd6hYb6P8Hc1o', 'BoaALqTTKVgO5YDDHDBt', 'lgJd0j0qcuDuoNmhZe7B',
  'tW4OjxBcnRmNIsoRpZuX', 'erC0hTBiWptzkDnzZks4', 'JRAxn3o7EdRp82BRBGlx',
  'BQCuj83GnN01wnlrMK3V', 'pM91SDAL833zL1DusHrL', 'aACUK3TFJHKUkZ46Y62y',
  'oW92tvgnUSixea5Pm9MO', '9tI33XZ6quYYK2qFoBXw', 'Bkfqz2w6BlYUTuBouRdb',
  'MdsH6qVGnDXo6JIAGxCl', 'kKwHQHXUfEqvMATlp8rp', 'jHGIWGOp9WuZiAa1j7AQ',
  'vSOs9E1EyGPwtkMQewlO', 'MDVXfXMrKB3Rhjig4jDz', 'D47fmV4EiaP0InA2FfF8',
  'mEWJv2pp7fqBNbUq2dIC', 'Dd4qxZ3bEONP5TxiCcTB', 'r9Z0CQWCflQFhHOWlqK5',
  'QXTEhLf8CXqeGcD7qygB', 'd6m4KYb2XOiOd6sf78hJ', 'bwoIC1jYYDaZAZvUwgG9',
  'G1lB0I3nDA5Q4IvOvkDW', '8pyFmTPTEiHGdacFU7bZ', 'Ley8Cnz4RfWQbXpL4yAp',
  'lI8rXBxHoojlzpB1AMOG', 'nxOQOxvgQ2ABetkfW0DE', 'osqNxCzQFndrazTsvQ2e',
  'pvy77HII5MYcR5PvAoRI', 'S5GAnAj4RnKHIlJ0jxCN', 'ueygEaAon9nvLCECCGYE',
  '0hEknVPfVLmMi9OAWBTm', 'vLDPK1KRBvTvi8ivAu7F', 'YxsFweH1zYG4DDeaWGJb',
  '3luQequ7NQTYZfdCsqfN', 'TEqUrxU7VkxXz4R5pbqy', 'konFP0GFCnaQCx4JWhSF',
  'UJltgBrt7f61FXROGmbS', 'h6oBGTehynDSPEpEoOzn', 'NSIRChOQhslbQiqJ0qri',
  '88zqMqibCHlAgrH5GazC', 'gkgfTotSN6IbaQ7BEB1n', 'Hl17M2CKwpUunu08E5Ay',
  'bUEcvZ5cJHwLuFuNQ1b0', 'yNnspXAiTvTA17T3Q1Ob', 'fyrXklbRGYLV2INe9WoA',
  'L5KHQAFMA7IFf5Q2QEKQ', 'ThCK8ASTNrPYvUJl59ns', 'ut4P9bJbP2ULq4KTOCjg',
  'la1BjnzLremS4ebdEZiG', '19dNzZdxqvxFLpvmiXhq', 'wWv6LrdVBVRgJ1hUfVUX',
  'Ntx5bwm71IqJUysNaX7x', 'MtE6y00RyuHbE56TEnzP', 'bUuLlw6PGhKo613WvJF0',
  'fqKWUeIcqRG8qeFE0DpB', 'AcFaxQ5njdQs1Dr8kGpO', 'aPVGh1r6Ncfj6jZPtTMa',
  'moJwP2Dzh8rmNoAfFIM0', 'L5ymA7jRmjy1Pls6K6DS', 'YXMFipyTyh9sp1ttlyj6',
  'bmkJUNTAdIpEE5puzml6', 'Kkrj43Adc045utlkwz4q', 'bBSX4sdng6AHoH71uF59',
  's8v99VFQkRU141Bi3ZfI', 'bFzKD5dA6o3rj1vFChne', 'hBaLk7Cx2gYIoFnaDWzP',
  'HTSC9UByiKiK8xvU922c', 'eONeCDfCaDOp3qb8SoJN', '2IbhtbUMubyh5gaWc6OR',
  'fSdh53FUlwsQYct0fMvy', 'n3TJYpRI26o8f6L0eblE', 'sEohmDbgViu7nH2Cu6hQ',
  'nZuC30zwCXsNpfLdMGrT', 'g9LDNU7CJTPaLtAsxADG', 'ddBnOIh5QMw2FJxULHPb',
  'Bl8RtgSLP7Wb7IqZkSUz',
]);

const FIX_MODE = process.argv.includes('--fix');

async function main() {
  // Init Firebase Admin
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      }),
    });
  }
  const db = getFirestore();

  console.log('=== OWNER FINANCE AUDIT ===');
  console.log(`Mode: ${FIX_MODE ? '🔧 FIX (will update invalid properties)' : '👀 DRY RUN (report only)'}\n`);

  // Fetch ALL active properties
  const allPropsSnap = await db.collection('properties')
    .where('isActive', '==', true)
    .get();

  console.log(`Total active properties: ${allPropsSnap.size}\n`);

  // Categorize
  let totalOwnerFinance = 0;
  let validByKeywords = 0;
  let validByAgentConfirmed = 0;
  let validByGhlInterested = 0;
  let validByGhlSource = 0;
  let invalidCount = 0;
  const invalidProperties: Array<{ id: string; address: string; source: string; reason: string }> = [];

  let totalCashDeal = 0;
  let totalUnknown = 0;
  let totalNoDealType = 0;

  for (const doc of allPropsSnap.docs) {
    const data = doc.data();
    const id = doc.id;
    const address = data.address || data.streetAddress || data.fullAddress || '(no address)';

    // Check if marked as owner finance
    const isMarkedOwnerFinance =
      data.isOwnerfinance === true ||
      data.dealType === 'owner_finance' ||
      data.dealType === 'both' ||
      (Array.isArray(data.dealTypes) && data.dealTypes.includes('owner_finance'));

    if (!isMarkedOwnerFinance) {
      if (data.isCashDeal || data.dealType === 'cash_deal') {
        totalCashDeal++;
      } else if (data.dealType === 'unknown' || !data.dealType) {
        totalNoDealType++;
      } else {
        totalUnknown++;
      }
      continue;
    }

    totalOwnerFinance++;

    // Validate: check all valid reasons for being owner finance
    const description = (data.description || '').toLowerCase();
    let isValid = false;
    let validReason = '';

    // Reason 1: Has owner finance keywords in description (and no negatives)
    if (description.length > 0) {
      const keywordResult = hasStrictOwnerfinancing(description);
      const negativeResult = hasNegativeKeywords(description);
      const hasKeywords = keywordResult && (typeof keywordResult === 'object' ? keywordResult.passes : keywordResult);
      const hasNegatives = negativeResult && (typeof negativeResult === 'object' ? negativeResult.hasNegative : negativeResult);
      if (hasKeywords && !hasNegatives) {
        isValid = true;
        validReason = 'keywords_in_description';
        validByKeywords++;
      }
    }

    // Reason 2: Agent confirmed owner finance (via stage change webhook)
    if (!isValid && data.agentConfirmedOwnerfinance === true) {
      isValid = true;
      validReason = 'agent_confirmed';
      validByAgentConfirmed++;
    }

    // Reason 3: Original queue ID is in GHL "Interested" list
    if (!isValid && data.originalQueueId && GHL_INTERESTED_IDS.has(data.originalQueueId)) {
      isValid = true;
      validReason = 'ghl_interested_stage';
      validByGhlInterested++;
    }

    // Reason 4: Agent-submitted via GHL with verification
    if (!isValid && data.source === 'gohighlevel' && data.ownerFinanceVerified === true) {
      isValid = true;
      validReason = 'ghl_verified_submission';
      validByGhlSource++;
    }

    // Reason 5: Manually verified
    if (!isValid && data.manuallyVerified === true) {
      isValid = true;
      validReason = 'manually_verified';
    }

    if (!isValid) {
      invalidCount++;
      const kwCheck = hasStrictOwnerfinancing(description);
      const kwPasses = kwCheck && (typeof kwCheck === 'object' ? kwCheck.passes : kwCheck);
      const reason = description.length === 0
        ? 'no_description'
        : kwPasses
          ? 'has_keywords_but_negated'
          : 'no_owner_finance_keywords';

      invalidProperties.push({
        id,
        address,
        source: data.source || 'unknown',
        reason,
      });

      if (FIX_MODE) {
        // Remove owner finance status
        const updates: Record<string, any> = {
          isOwnerfinance: false,
          updatedAt: new Date(),
        };

        // Fix dealTypes array
        if (Array.isArray(data.dealTypes)) {
          updates.dealTypes = data.dealTypes.filter((t: string) => t !== 'owner_finance');
        }

        // Fix dealType string
        if (data.dealType === 'owner_finance') {
          updates.dealType = data.isCashDeal ? 'cash_deal' : 'unknown';
        } else if (data.dealType === 'both') {
          updates.dealType = 'cash_deal';
        }

        await doc.ref.update(updates);
      }
    }
  }

  // Report
  console.log('=== RESULTS ===\n');
  console.log(`Active properties total:      ${allPropsSnap.size}`);
  console.log(`  Marked as owner finance:    ${totalOwnerFinance}`);
  console.log(`  Marked as cash deal only:   ${totalCashDeal}`);
  console.log(`  No deal type / unknown:     ${totalNoDealType + totalUnknown}`);
  console.log('');
  console.log(`--- VALID OWNER FINANCE: ${totalOwnerFinance - invalidCount} ---`);
  console.log(`  By keywords in description: ${validByKeywords}`);
  console.log(`  By agent confirmed:         ${validByAgentConfirmed}`);
  console.log(`  By GHL Interested stage:    ${validByGhlInterested}`);
  console.log(`  By GHL verified submission: ${validByGhlSource}`);
  console.log('');
  console.log(`--- INVALID (should NOT be owner finance): ${invalidCount} ---`);

  if (invalidProperties.length > 0) {
    console.log('');
    console.log('Invalid properties:');
    for (const p of invalidProperties) {
      console.log(`  ${FIX_MODE ? '🔧 FIXED' : '❌'} ${p.id} | ${p.address} | source: ${p.source} | reason: ${p.reason}`);
    }
  }

  if (FIX_MODE && invalidCount > 0) {
    console.log(`\n✅ Fixed ${invalidCount} properties — removed owner finance status`);
    console.log('⚠️  Run /api/admin/typesense/sync to re-index Typesense after this');
  } else if (invalidCount > 0) {
    console.log(`\n💡 Run with --fix to clean up: npx tsx scripts/audit-owner-finance.ts --fix`);
  } else {
    console.log('\n✅ All owner finance properties are valid!');
  }
}

main().catch(console.error);
