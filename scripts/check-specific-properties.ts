/**
 * Check specific properties from queue in properties collection
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

// ZPIDs from the recent agent_no entries
const zpidsToCheck = [
  '42212261',  // 1554 Hopewell Rd Memphis TN
  '42125975',  // 533 Rienzi Dr Memphis TN
  '360299',    // 11 Hickory Ct Little Rock AR
  '320647',    // 13 Daven Ct Little Rock AR
  '89319156',  // 816 Accomack Cv Southaven MS
];

async function checkProperties() {
  console.log('\n=== Checking if recent agent_no properties exist in properties collection ===\n');

  for (const zpid of zpidsToCheck) {
    const propertyDocId = `zpid_${zpid}`;
    const propertyDoc = await db.collection('properties').doc(propertyDocId).get();

    if (propertyDoc.exists) {
      const d = propertyDoc.data()!;
      console.log(`✅ FOUND: ${propertyDocId}`);
      console.log(`   Address: ${d.address}`);
      console.log(`   ownerFinanceVerified: ${d.ownerFinanceVerified}`);
      console.log(`   isActive: ${d.isActive}`);
      console.log('');
    } else {
      console.log(`❌ NOT FOUND: ${propertyDocId}`);
    }
  }

  // Also check total count of properties with ownerFinanceVerified: true
  console.log('\n=== Total Count ===\n');
  const verifiedCount = await db.collection('properties')
    .where('ownerFinanceVerified', '==', true)
    .count()
    .get();
  console.log('Total properties with ownerFinanceVerified: true:', verifiedCount.data().count);

  // Check if any of those are from agent_outreach source
  const agentOutreachVerified = await db.collection('properties')
    .where('ownerFinanceVerified', '==', true)
    .where('source', '==', 'agent_outreach')
    .get();
  console.log('From agent_outreach source:', agentOutreachVerified.size);

  for (const doc of agentOutreachVerified.docs) {
    const d = doc.data();
    console.log(`  - ${doc.id}: ${d.address}, ${d.city}`);
  }
}

checkProperties()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
