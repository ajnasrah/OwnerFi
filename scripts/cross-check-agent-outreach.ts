/**
 * Cross-check agent_outreach properties:
 * Find properties in 'properties' collection with source: agent_outreach
 * and check their status in agent_outreach_queue
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

async function crossCheck() {
  console.log('\n=== Cross-checking agent_outreach properties ===\n');

  // Get all properties from agent_outreach with ownerFinanceVerified: true
  const properties = await db.collection('properties')
    .where('ownerFinanceVerified', '==', true)
    .where('source', '==', 'agent_outreach')
    .get();

  console.log(`Found ${properties.size} properties with ownerFinanceVerified: true from agent_outreach\n`);

  let needsFix = 0;
  let correct = 0;
  let noQueueEntry = 0;

  for (const propDoc of properties.docs) {
    const propData = propDoc.data();
    const zpid = propData.zpid;

    if (!zpid) {
      console.log(`⚠️  Property ${propDoc.id} has no zpid`);
      continue;
    }

    // Find corresponding queue entry by zpid
    const queueSnapshot = await db.collection('agent_outreach_queue')
      .where('zpid', '==', String(zpid))
      .limit(1)
      .get();

    if (queueSnapshot.empty) {
      noQueueEntry++;
      continue;
    }

    const queueData = queueSnapshot.docs[0].data();

    if (queueData.status === 'agent_no') {
      console.log(`🔧 NEEDS FIX: ${propData.address}, ${propData.city}`);
      console.log(`   Property ID: ${propDoc.id}`);
      console.log(`   Queue status: ${queueData.status}`);
      console.log(`   ownerFinanceVerified: ${propData.ownerFinanceVerified}`);
      console.log('');
      needsFix++;

      // Fix it
      await db.collection('properties').doc(propDoc.id).update({
        ownerFinanceVerified: false,
        agentConfirmedOwnerFinance: false,
        agentRejectedAt: new Date(),
        agentRejectionNote: 'Fixed via cross-check script - queue shows agent_no',
        updatedAt: new Date(),
      });
      console.log('   ✅ FIXED\n');
    } else {
      correct++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total agent_outreach properties with ownerFinanceVerified: true: ${properties.size}`);
  console.log(`Correct (queue status is agent_yes): ${correct}`);
  console.log(`Fixed (queue was agent_no): ${needsFix}`);
  console.log(`No queue entry found: ${noQueueEntry}`);
}

crossCheck()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch(e => { console.error(e); process.exit(1); });
