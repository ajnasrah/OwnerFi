/**
 * Check recent queue entries and properties with ownerFinanceVerified: true
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
  });
}

const db = admin.firestore();

async function checkRecent() {
  // Check most recent queue entries
  console.log('\n=== Most Recent Queue Entries (by updatedAt) ===\n');
  const recent = await db.collection('agent_outreach_queue')
    .orderBy('updatedAt', 'desc')
    .limit(10)
    .get();

  for (const doc of recent.docs) {
    const d = doc.data();
    console.log('---');
    console.log('Address:', d.address, d.city, d.state);
    console.log('Status:', d.status);
    console.log('ZPID:', d.zpid);
    const updated = d.updatedAt?.toDate ? d.updatedAt.toDate() : d.updatedAt;
    console.log('Updated:', updated);
  }

  // Also check properties with ownerFinanceVerified: true
  console.log('\n\n=== Properties with ownerFinanceVerified: true ===\n');
  const verified = await db.collection('properties')
    .where('ownerFinanceVerified', '==', true)
    .limit(20)
    .get();

  console.log('Found', verified.size, 'properties with ownerFinanceVerified: true\n');
  for (const doc of verified.docs) {
    const d = doc.data();
    console.log('---');
    console.log('ID:', doc.id);
    console.log('Address:', d.address, d.city, d.state);
  }
}

checkRecent()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
