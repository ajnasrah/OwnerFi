/**
 * Manually mark 1015 Westlake Blvd, Bessemer AL (zpid 460701363) as
 * owner-finance verified (agent confirmed YES via manual outreach).
 *
 * Mirrors the fields set by the GHL agent-response YES webhook but skips
 * the agent_outreach_queue flow since no queue doc exists.
 *
 * Then re-indexes to Typesense.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as admin from 'firebase-admin';
import { indexRawFirestoreProperty } from '../src/lib/typesense/sync';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();
const DOC_ID = 'zpid_460701363';

async function main() {
  const ref = db.collection('properties').doc(DOC_ID);
  const snap = await ref.get();

  if (!snap.exists) {
    console.error(`Doc ${DOC_ID} not found`);
    process.exit(1);
  }

  const before = snap.data()!;
  console.log('BEFORE:');
  console.log('  dealTypes:', before.dealTypes);
  console.log('  isOwnerfinance:', before.isOwnerfinance);
  console.log('  ownerFinanceVerified:', before.ownerFinanceVerified);
  console.log('  source:', before.source);

  const existingDealTypes: string[] = Array.isArray(before.dealTypes) ? before.dealTypes : [];
  const dealTypes = Array.from(new Set([...existingDealTypes, 'owner_finance']));

  await ref.update({
    dealTypes,
    isOwnerfinance: true,
    ownerFinanceVerified: true,
    agentConfirmedOwnerfinance: true,
    agentConfirmedAt: new Date(),
    financingType: before.financingType || 'Owner Finance',
    allFinancingTypes: Array.isArray(before.allFinancingTypes) && before.allFinancingTypes.length
      ? before.allFinancingTypes
      : ['Owner Finance'],
    financingTypeLabel: before.financingTypeLabel || 'Owner Finance',
    isActive: true,
    verifiedBy: 'manual_admin',
    verifiedNote: 'Agent confirmed YES via manual outreach (not GHL webhook)',
    updatedAt: new Date(),
  });

  const after = (await ref.get()).data()!;
  console.log('\nAFTER:');
  console.log('  dealTypes:', after.dealTypes);
  console.log('  isOwnerfinance:', after.isOwnerfinance);
  console.log('  ownerFinanceVerified:', after.ownerFinanceVerified);
  console.log('  financingType:', after.financingType);
  console.log('  verifiedBy:', after.verifiedBy);

  console.log('\nIndexing to Typesense...');
  const ok = await indexRawFirestoreProperty(DOC_ID, after, 'properties');
  console.log(ok ? '  ✅ Typesense indexed' : '  ⚠️ Typesense index failed');
}

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
