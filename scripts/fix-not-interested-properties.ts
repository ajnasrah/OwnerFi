/**
 * Fix properties marked as "not interested" in agent_outreach_queue
 * but still showing ownerFinanceVerified: true in properties collection
 *
 * Run with: npx tsx scripts/fix-not-interested-properties.ts
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
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

async function fixNotInterestedProperties() {
  console.log('\n=== Finding properties marked as not interested ===\n');

  // Find all queue items with status 'agent_no'
  const queueSnapshot = await db.collection('agent_outreach_queue')
    .where('status', '==', 'agent_no')
    .get();

  console.log(`Found ${queueSnapshot.size} properties marked as agent_no in queue\n`);

  let checked = 0;
  let fixed = 0;
  let notFound = 0;
  let alreadyCorrect = 0;

  for (const queueDoc of queueSnapshot.docs) {
    const queueData = queueDoc.data();
    const zpid = queueData.zpid;

    if (!zpid) {
      console.log(`⚠️  Queue doc ${queueDoc.id} has no zpid - skipping`);
      continue;
    }

    checked++;
    const propertyDocId = `zpid_${zpid}`;
    const propertyRef = db.collection('properties').doc(propertyDocId);
    const propertyDoc = await propertyRef.get();

    if (!propertyDoc.exists) {
      notFound++;
      continue; // Property was never published, nothing to fix
    }

    const propertyData = propertyDoc.data()!;

    // Check if ownerFinanceVerified is still true
    if (propertyData.ownerFinanceVerified === true) {
      console.log(`🔧 Fixing: ${queueData.address}, ${queueData.city} ${queueData.state}`);
      console.log(`   Queue ID: ${queueDoc.id}`);
      console.log(`   Property ID: ${propertyDocId}`);
      console.log(`   Current ownerFinanceVerified: ${propertyData.ownerFinanceVerified}`);

      // Update the property
      await propertyRef.update({
        ownerFinanceVerified: false,
        agentConfirmedOwnerFinance: false,
        agentRejectedAt: new Date(),
        agentRejectionNote: 'Fixed via script - was marked not interested in queue',
        updatedAt: new Date(),
      });

      console.log(`   ✅ Set ownerFinanceVerified: false\n`);
      fixed++;
    } else {
      alreadyCorrect++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Queue items with agent_no: ${queueSnapshot.size}`);
  console.log(`Checked (with zpid): ${checked}`);
  console.log(`Fixed (was true, now false): ${fixed}`);
  console.log(`Already correct (was already false): ${alreadyCorrect}`);
  console.log(`Not in properties collection: ${notFound}`);
}

fixNotInterestedProperties()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
