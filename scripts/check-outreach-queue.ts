import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

// Sample firebase_ids from the CSV (Interested properties)
const sampleIds = [
  '88zqMqibCHlAgrH5GazC',  // 14 Evergreen Ct - Interested
  'gkgfTotSN6IbaQ7BEB1n',  // 35 Whispering Creek Cv - Interested
  'bUEcvZ5cJHwLuFuNQ1b0',  // 2579 Hale Ave - Interested
  'la1BjnzLremS4ebdEZiG',  // 32 Russell Rd - Interested (also found in properties)
  'vi3kx8MmeNnuU66T5mFF',  // 5325 B St - Not Interested
];

async function checkOutreachQueue() {
  console.log('========================================');
  console.log('CHECKING agent_outreach_queue COLLECTION');
  console.log('========================================\n');

  // First check collection count
  const countSnapshot = await db.collection('agent_outreach_queue').count().get();
  console.log(`Total documents in agent_outreach_queue: ${countSnapshot.data().count}\n`);

  console.log('Checking sample firebase_ids from CSV:\n');

  for (const id of sampleIds) {
    const docRef = db.collection('agent_outreach_queue').doc(id);
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data()!;
      console.log(`✓ FOUND: ${id}`);
      console.log(`  Address: ${data.address}, ${data.city}, ${data.state}`);
      console.log(`  zpid: ${data.zpid}`);
      console.log(`  status: ${data.status}`);
      console.log(`  agentResponse: ${data.agentResponse}`);
      console.log(`  ownerFinanceVerified: ${data.ownerFinanceVerified}`);

      // Check if corresponding property exists in properties collection
      if (data.zpid) {
        const propId = `zpid_${data.zpid}`;
        const propDoc = await db.collection('properties').doc(propId).get();
        if (propDoc.exists) {
          const propData = propDoc.data()!;
          console.log(`  → Properties collection (${propId}):`);
          console.log(`    isActive: ${propData.isActive}, status: ${propData.status}`);
          console.log(`    dealType: ${propData.dealType}`);
        } else {
          console.log(`  → NOT in properties collection`);
        }
      }
    } else {
      console.log(`✗ NOT FOUND: ${id}`);
    }
    console.log('');
  }

  // Show the flow
  console.log('========================================');
  console.log('DATA FLOW EXPLANATION');
  console.log('========================================\n');

  console.log('The system works as follows:');
  console.log('');
  console.log('1. Properties scraped from Zillow → agent_outreach_queue');
  console.log('   - Gets a Firebase-generated document ID (e.g., 88zqMqibCHlAgrH5GazC)');
  console.log('   - Has zpid field linking to Zillow property');
  console.log('');
  console.log('2. Properties also stored in "properties" collection');
  console.log('   - Uses zpid_${zpid} as document ID (e.g., zpid_41811854)');
  console.log('   - This is what buyers see');
  console.log('');
  console.log('3. When sent to GHL, the firebase_id is the agent_outreach_queue ID');
  console.log('   - NOT the properties collection ID');
  console.log('');
  console.log('4. GHL stages (Interested/Not Interested) relate to agent_outreach_queue');
  console.log('   - "Interested" = agent said yes to owner financing');
  console.log('   - "Not Interested" = agent said no');
  console.log('');

  // Sample some queue items to show their structure
  console.log('========================================');
  console.log('SAMPLE QUEUE ITEMS STRUCTURE');
  console.log('========================================\n');

  const queueSnapshot = await db.collection('agent_outreach_queue')
    .where('status', '==', 'agent_yes')
    .limit(3)
    .get();

  console.log(`Found ${queueSnapshot.size} items with status=agent_yes:\n`);

  for (const doc of queueSnapshot.docs) {
    const data = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`  Address: ${data.address}, ${data.city}, ${data.state}`);
    console.log(`  zpid: ${data.zpid}`);
    console.log(`  status: ${data.status}`);
    console.log(`  agentResponse: ${data.agentResponse}`);
    console.log(`  ghlContactId: ${data.ghlContactId || 'none'}`);
    console.log(`  ghlOpportunityId: ${data.ghlOpportunityId || 'none'}`);
    console.log('');
  }
}

checkOutreachQueue()
  .then(() => {
    console.log('\nCheck complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
