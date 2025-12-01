import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function checkDuplicatesAndStatus() {
  console.log('=== Checking for duplicates in zillow_imports ===\n');

  const snapshot = await db.collection('zillow_imports').get();
  const addressMap = new Map<string, Array<{ id: string; address: string; source: string; zpid: string }>>();

  snapshot.forEach(doc => {
    const d = doc.data();
    const key = (d.address || '').toLowerCase().trim();
    if (!addressMap.has(key)) {
      addressMap.set(key, []);
    }
    addressMap.get(key)!.push({
      id: doc.id,
      address: d.address,
      source: d.source,
      zpid: d.zpid
    });
  });

  let dupeCount = 0;
  const duplicatesToRemove: string[] = [];

  for (const [addr, docs] of addressMap) {
    if (docs.length > 1) {
      dupeCount++;
      console.log(`Duplicate: ${addr}`);
      // Keep the first one (usually the original), mark others for removal
      docs.forEach((d, i) => {
        const marker = i === 0 ? '(KEEP)' : '(DUPE)';
        console.log(`  ${marker} ${d.id} | source: ${d.source} | zpid: ${d.zpid}`);
        if (i > 0) {
          duplicatesToRemove.push(d.id);
        }
      });
    }
  }

  console.log(`\nTotal duplicate addresses: ${dupeCount}`);
  console.log(`Total zillow_imports: ${snapshot.size}`);
  console.log(`Duplicates to remove: ${duplicatesToRemove.length}`);

  // Check agent_outreach properties specifically
  console.log('\n=== Agent Outreach Properties Status ===\n');

  const agentOutreachSnapshot = await db.collection('zillow_imports')
    .where('source', '==', 'agent_outreach')
    .get();

  console.log(`Total agent_outreach properties: ${agentOutreachSnapshot.size}`);

  let withAgentConfirmed = 0;
  let withoutOwnerFinanceKeywords = 0;

  agentOutreachSnapshot.forEach(doc => {
    const d = doc.data();
    if (d.agentConfirmedOwnerFinance) withAgentConfirmed++;

    const desc = (d.description || '').toLowerCase();
    const hasKeywords = desc.includes('owner financ') ||
                        desc.includes('seller financ') ||
                        desc.includes('land contract') ||
                        desc.includes('rent to own') ||
                        desc.includes('lease option');

    if (!hasKeywords) withoutOwnerFinanceKeywords++;
  });

  console.log(`With agentConfirmedOwnerFinance: ${withAgentConfirmed}`);
  console.log(`Without owner finance keywords in description: ${withoutOwnerFinanceKeywords}`);

  return { duplicatesToRemove, dupeCount };
}

checkDuplicatesAndStatus().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
