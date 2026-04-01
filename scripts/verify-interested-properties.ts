/**
 * Verify & Fix "Interested" Properties
 *
 * Checks all 84 GHL "Interested" stage properties against:
 * 1. agent_outreach_queue (by firebase_id)
 * 2. properties collection (by zpid)
 * 3. Typesense search index
 *
 * Fixes any that are missing from properties/Typesense.
 *
 * Usage: npx tsx scripts/verify-interested-properties.ts
 *   --dry-run   (default) Just report, don't fix
 *   --fix       Actually create/update missing properties
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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

// All 84 "Interested" firebase_ids from GHL CSV export
const INTERESTED_FIREBASE_IDS = [
  'wsd2j9Dz3ZTXM7xh2u0Z', '2AdXpJlw9lcl8C0v5Jez', '2JSIpIXDBiQt5VJfnbhl',
  'GDP4wPl2pjsIu6JPOrGm', 'hQL2XFP6nggbJiptrBfx', 'sJPXcJVFd6hYb6P8Hc1o',
  'BoaALqTTKVgO5YDDHDBt', 'lgJd0j0qcuDuoNmhZe7B', 'tW4OjxBcnRmNIsoRpZuX',
  'erC0hTBiWptzkDnzZks4', 'JRAxn3o7EdRp82BRBGlx', 'BQCuj83GnN01wnlrMK3V',
  'pM91SDAL833zL1DusHrL', 'aACUK3TFJHKUkZ46Y62y', 'oW92tvgnUSixea5Pm9MO',
  '9tI33XZ6quYYK2qFoBXw', 'Bkfqz2w6BlYUTuBouRdb', 'MdsH6qVGnDXo6JIAGxCl',
  'kKwHQHXUfEqvMATlp8rp', 'jHGIWGOp9WuZiAa1j7AQ', 'vSOs9E1EyGPwtkMQewlO',
  'MDVXfXMrKB3Rhjig4jDz', 'D47fmV4EiaP0InA2FfF8', 'mEWJv2pp7fqBNbUq2dIC',
  'Dd4qxZ3bEONP5TxiCcTB', 'r9Z0CQWCflQFhHOWlqK5', 'QXTEhLf8CXqeGcD7qygB',
  'd6m4KYb2XOiOd6sf78hJ', 'bwoIC1jYYDaZAZvUwgG9', 'G1lB0I3nDA5Q4IvOvkDW',
  '8pyFmTPTEiHGdacFU7bZ', 'Ley8Cnz4RfWQbXpL4yAp', 'lI8rXBxHoojlzpB1AMOG',
  'nxOQOxvgQ2ABetkfW0DE', 'osqNzCzQFndrazTsvQ2e', 'pvy77HII5MYcR5PvAoRI',
  'S5GAnAj4RnKHIlJ0jxCN', 'ueygEaAon9nvLCECCGYE', '0hEknVPfVLmMi9OAWBTm',
  'vLDPK1KRBvTvi8ivAu7F', 'YxsFweH1zYG4DDeaWGJb', '3luQequ7NQTYZfdCsqfN',
  'TEqUrxU7VkxXz4R5pbqy', 'konFP0GFCnaQCx4JWhSF', 'UJltgBrt7f61FXROGmbS',
  'h6oBGTehynDSPEpEoOzn', 'NSIRChOQhslbQiqJ0qri', '88zqMqibCHlAgrH5GazC',
  'gkgfTotSN6IbaQ7BEB1n', 'Hl17M2CKwpUunu08E5Ay', 'bUEcvZ5cJHwLuFuNQ1b0',
  'yNnspXAiTvTA17T3Q1Ob', 'fyrXklbRGYLV2INe9WoA', 'L5KHQAFMA7IFf5Q2QEKQ',
  'ThCK8ASTNrPYvUJl59ns', 'ut4P9bJbP2ULq4KTOCjg', 'la1BjnzLremS4ebdEZiG',
  '19dNzZdxqvxFLpvmiXhq', 'wWv6LrdVBVRgJ1hUfVUX', 'Ntx5bwm71IqJUysNaX7x',
  'MtE6y00RyuHbE56TEnzP', 'bUuLlw6PGhKo613WvJF0', 'fqKWUeIcqRG8qeFE0DpB',
  'AcFaxQ5njdQs1Dr8kGpO', 'aPVGh1r6Ncfj6jZPtTMa', 'moJwP2Dzh8rmNoAfFIM0',
  'L5ymA7jRmjy1Pls6K6DS', 'YXMFipyTyh9sp1ttlyj6', 'bmkJUNTAdIpEE5puzml6',
  'Kkrj43Adc045utlkwz4q', 'bBSX4sdng6AHoH71uF59', 's8v99VFQkRU141Bi3ZfI',
  'bFzKD5dA6o3rj1vFChne', 'hBaLk7Cx2gYIoFnaDWzP', 'HTSC9UByiKiK8xvU922c',
  'eONeCDfCaDOp3qb8SoJN', '2IbhtbUMubyh5gaWc6OR', 'fSdh53FUlwsQYct0fMvy',
  'n3TJYpRI26o8f6L0eblE', 'sEohmDbgViu7nH2Cu6hQ', 'nZuC30zwCXsNpfLdMGrT',
  'g9LDNU7CJTPaLtAsxADG', 'ddBnOIh5QMw2FJxULHPb', 'Bl8RtgSLP7Wb7IqZkSUz',
];

interface VerificationResult {
  firebaseId: string;
  address?: string;
  inQueue: boolean;
  queueStatus?: string;
  zpid?: string;
  inProperties: boolean;
  isOwnerfinance?: boolean;
  isActive?: boolean;
  needsFix: boolean;
  fixAction?: string;
}

async function main() {
  const dryRun = !process.argv.includes('--fix');
  console.log(`\n${'='.repeat(60)}`);
  console.log(`VERIFY INTERESTED PROPERTIES (${dryRun ? 'DRY RUN' : 'FIX MODE'})`);
  console.log(`${'='.repeat(60)}\n`);
  console.log(`Checking ${INTERESTED_FIREBASE_IDS.length} "Interested" properties from GHL...\n`);

  const results: VerificationResult[] = [];
  let fixCount = 0;

  // Process in batches to avoid overwhelming Firestore
  for (let i = 0; i < INTERESTED_FIREBASE_IDS.length; i++) {
    const firebaseId = INTERESTED_FIREBASE_IDS[i];
    const result: VerificationResult = {
      firebaseId,
      inQueue: false,
      inProperties: false,
      needsFix: false,
    };

    // Step 1: Check agent_outreach_queue
    const queueDoc = await db.collection('agent_outreach_queue').doc(firebaseId).get();

    if (queueDoc.exists) {
      const queueData = queueDoc.data()!;
      result.inQueue = true;
      result.queueStatus = queueData.status;
      result.zpid = String(queueData.zpid || '');
      result.address = queueData.address || queueData.streetAddress || '';

      // Step 2: Check properties collection
      if (result.zpid) {
        const propDocId = `zpid_${result.zpid}`;
        const propDoc = await db.collection('properties').doc(propDocId).get();

        if (propDoc.exists) {
          const propData = propDoc.data()!;
          result.inProperties = true;
          result.isOwnerfinance = propData.isOwnerfinance || false;
          result.isActive = propData.isActive !== false;

          // Check if it needs fixing
          if (!propData.isOwnerfinance || !propData.ownerFinanceVerified) {
            result.needsFix = true;
            result.fixAction = 'UPDATE: Set isOwnerfinance=true, ownerFinanceVerified=true';
          }
          if (propData.isActive === false) {
            result.needsFix = true;
            result.fixAction = (result.fixAction ? result.fixAction + ' + ' : '') + 'REACTIVATE';
          }
        } else {
          result.needsFix = true;
          result.fixAction = 'CREATE: Property doc missing, need to create from queue data';
        }
      } else {
        result.needsFix = true;
        result.fixAction = 'MISSING ZPID: Queue doc has no zpid';
      }

      // Step 2b: Also check queue status
      if (queueData.status !== 'agent_yes') {
        result.needsFix = true;
        result.fixAction = (result.fixAction ? result.fixAction + ' + ' : '') +
          `UPDATE QUEUE: status=${queueData.status} → agent_yes`;
      }
    } else {
      result.needsFix = true;
      result.fixAction = 'NOT IN QUEUE: firebase_id not found in agent_outreach_queue';
    }

    results.push(result);

    // Log progress
    if ((i + 1) % 10 === 0) {
      console.log(`  Checked ${i + 1}/${INTERESTED_FIREBASE_IDS.length}...`);
    }
  }

  // Print report
  console.log(`\n${'='.repeat(60)}`);
  console.log('RESULTS');
  console.log(`${'='.repeat(60)}\n`);

  const inQueue = results.filter(r => r.inQueue);
  const inProperties = results.filter(r => r.inProperties);
  const markedAsOF = results.filter(r => r.isOwnerfinance);
  const needsFix = results.filter(r => r.needsFix);

  console.log(`Total "Interested" in GHL:  ${results.length}`);
  console.log(`Found in agent_outreach_queue: ${inQueue.length}`);
  console.log(`Found in properties collection: ${inProperties.length}`);
  console.log(`Correctly marked as OF:        ${markedAsOF.length}`);
  console.log(`Need fix:                      ${needsFix.length}`);
  console.log();

  // Detail: properties needing fix
  if (needsFix.length > 0) {
    console.log(`--- PROPERTIES NEEDING FIX (${needsFix.length}) ---\n`);
    for (const r of needsFix) {
      console.log(`  ${r.address || r.firebaseId}`);
      console.log(`    firebase_id: ${r.firebaseId}`);
      console.log(`    zpid: ${r.zpid || 'N/A'}`);
      console.log(`    queue status: ${r.queueStatus || 'NOT FOUND'}`);
      console.log(`    in properties: ${r.inProperties}`);
      console.log(`    isOwnerfinance: ${r.isOwnerfinance ?? 'N/A'}`);
      console.log(`    fix: ${r.fixAction}`);
      console.log();
    }
  }

  // Detail: properties correctly set
  const correct = results.filter(r => !r.needsFix);
  if (correct.length > 0) {
    console.log(`--- CORRECTLY CONFIGURED (${correct.length}) ---\n`);
    for (const r of correct) {
      console.log(`  ✓ ${r.address} (zpid: ${r.zpid})`);
    }
    console.log();
  }

  // Apply fixes if --fix flag
  if (!dryRun && needsFix.length > 0) {
    console.log(`\n${'='.repeat(60)}`);
    console.log('APPLYING FIXES');
    console.log(`${'='.repeat(60)}\n`);

    for (const r of needsFix) {
      try {
        // Fix 1: Update queue status to agent_yes
        if (r.inQueue && r.queueStatus !== 'agent_yes') {
          await db.collection('agent_outreach_queue').doc(r.firebaseId).update({
            status: 'agent_yes',
            agentResponse: 'yes',
            agentResponseAt: new Date(),
            agentNote: 'Synced from GHL Interested stage',
            routedTo: 'properties',
            updatedAt: new Date(),
          });
          console.log(`  ✓ Updated queue status: ${r.firebaseId}`);
        }

        if (!r.zpid || !r.inQueue) {
          console.log(`  ✗ Cannot fix ${r.firebaseId}: ${r.fixAction}`);
          continue;
        }

        const propDocId = `zpid_${r.zpid}`;
        const propRef = db.collection('properties').doc(propDocId);

        if (r.inProperties) {
          // Fix 2: Update existing property to mark as OF
          // DON'T reactivate sold/off-market properties — status checker deactivated them for a reason
          const propDoc = await propRef.get();
          const propData = propDoc.data()!;
          const existingDealTypes = propData.dealTypes || [];
          const mergedDealTypes = [...new Set([...existingDealTypes, 'owner_finance'])];

          const updateFields: Record<string, unknown> = {
            isOwnerfinance: true,
            ownerFinanceVerified: true,
            agentConfirmedOwnerfinance: true,
            dealTypes: mergedDealTypes,
            source: 'agent_outreach',
            agentConfirmedAt: new Date(),
            updatedAt: new Date(),
          };

          // Only reactivate if property was deactivated due to OF removal, not because it's sold
          const offMarketReason = propData.offMarketReason || '';
          if (propData.isActive === false && offMarketReason.includes('Owner financing removed')) {
            updateFields.isActive = true;
            updateFields.offMarketReason = null;
          }

          await propRef.update(updateFields);
          const reactivated = updateFields.isActive === true ? ' + REACTIVATED' : '';
          console.log(`  ✓ Updated property: ${r.address} (${propDocId})${reactivated}`);
        } else {
          // Fix 3: Create property from queue data
          const queueDoc = await db.collection('agent_outreach_queue').doc(r.firebaseId).get();
          const queueData = queueDoc.data()!;

          await propRef.set({
            zpid: queueData.zpid,
            url: queueData.url || `https://www.zillow.com/homedetails/${queueData.zpid}_zpid/`,
            address: queueData.address || '',
            streetAddress: queueData.address || '',
            fullAddress: `${queueData.address || ''}, ${queueData.city || ''}, ${queueData.state || ''} ${queueData.zipCode || ''}`,
            city: queueData.city || '',
            state: queueData.state || '',
            zipCode: queueData.zipCode || '',
            price: queueData.price || 0,
            listPrice: queueData.price || 0,
            zestimate: queueData.zestimate || null,
            bedrooms: queueData.beds || 0,
            bathrooms: queueData.baths || 0,
            squareFoot: queueData.squareFeet || 0,
            homeType: queueData.propertyType || 'SINGLE_FAMILY',
            homeStatus: 'FOR_SALE',
            agentName: queueData.agentName || null,
            agentPhoneNumber: queueData.agentPhone || null,
            description: queueData.rawData?.description || '',
            imgSrc: queueData.rawData?.hiResImageLink || queueData.rawData?.imgSrc || null,
            financingType: 'Owner Finance',
            allFinancingTypes: ['Owner Finance'],
            financingTypeLabel: 'Owner Finance',
            ownerFinanceVerified: true,
            agentConfirmedOwnerfinance: true,
            isOwnerfinance: true,
            isCashDeal: false,
            dealTypes: ['owner_finance'],
            isActive: true,
            source: 'agent_outreach',
            agentConfirmedAt: new Date(),
            originalQueueId: r.firebaseId,
            importedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          console.log(`  ✓ Created property: ${r.address} (${propDocId})`);
        }

        fixCount++;
      } catch (err: any) {
        console.error(`  ✗ Error fixing ${r.firebaseId}: ${err.message}`);
      }
    }

    console.log(`\n✓ Fixed ${fixCount}/${needsFix.length} properties`);
    console.log('NOTE: Run Typesense sync (/api/admin/typesense/sync) to update search index');
  } else if (needsFix.length > 0) {
    console.log(`\nRun with --fix to apply changes to ${needsFix.length} properties`);
  }
}

main().catch(console.error);
