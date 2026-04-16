/**
 * One-off: find any user/buyerProfile matching "ghena".
 * Deleted after use.
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function main() {
  const { db } = getFirebaseAdmin();
  if (!db) throw new Error('no db');

  console.log('Searching buyerProfiles + users for "ghena"...\n');

  const bpSnap = await db.collection('buyerProfiles').get();
  console.log('--- buyerProfiles matches ---');
  for (const doc of bpSnap.docs) {
    const d = doc.data();
    if (d.deleted === true) continue;
    const blob = `${d.firstName || ''} ${d.lastName || ''} ${d.email || ''}`.toLowerCase();
    if (blob.includes('ghena')) {
      console.log(`  ${doc.id} | ${d.firstName} ${d.lastName} | ${d.email} | ${d.phone} | ${d.city}, ${d.state}`);
    }
  }

  const usersSnap = await db.collection('users').get();
  console.log('\n--- users matches ---');
  for (const doc of usersSnap.docs) {
    const d = doc.data();
    if (d.deleted === true) continue;
    const rd = d.realtorData || {};
    const blob = `${d.name || ''} ${rd.firstName || ''} ${rd.lastName || ''} ${d.email || ''}`.toLowerCase();
    if (blob.includes('ghena')) {
      console.log(`  ${doc.id} | role=${d.role} | ${d.name || `${rd.firstName} ${rd.lastName}`} | ${d.email || rd.email} | ${d.phone || rd.phone}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
