const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function main() {
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  console.log('='.repeat(70));
  console.log('NOT INTERESTED WEBHOOK VERIFICATION - LAST 48 HOURS');
  console.log('='.repeat(70));
  console.log(`Checking from: ${fortyEightHoursAgo.toISOString()}`);
  console.log(`To: ${now.toISOString()}`);
  console.log('');

  // 1. Check webhook logs for agent-not-interested
  console.log('1. WEBHOOK LOGS (agent-not-interested / agent-response with NO)');
  console.log('-'.repeat(70));

  const webhookLogs = await db.collection('webhookLogs')
    .where('createdAt', '>=', fortyEightHoursAgo)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  let notInterestedWebhooks = 0;
  let agentResponseWebhooks = 0;

  webhookLogs.forEach((doc: any) => {
    const data = doc.data();
    const type = data.type || data.webhookType || '';

    if (type.includes('not-interested') || type.includes('agent_no')) {
      notInterestedWebhooks++;
      console.log(`  ${data.createdAt?.toDate?.()?.toISOString() || 'unknown'} - ${type}`);
      if (data.payload?.firebaseId) {
        console.log(`    firebaseId: ${data.payload.firebaseId}`);
      }
    }
    if (type.includes('agent-response') && data.payload?.response === 'no') {
      agentResponseWebhooks++;
      console.log(`  ${data.createdAt?.toDate?.()?.toISOString() || 'unknown'} - agent-response (NO)`);
      if (data.payload?.firebaseId) {
        console.log(`    firebaseId: ${data.payload.firebaseId}`);
      }
    }
  });

  console.log(`\nFound: ${notInterestedWebhooks} not-interested webhooks, ${agentResponseWebhooks} agent-response NO webhooks`);

  // 2. Check agent_outreach_queue for recent agent_no updates
  console.log('\n2. RECENT AGENT_NO STATUS UPDATES IN QUEUE');
  console.log('-'.repeat(70));

  const recentAgentNo = await db.collection('agent_outreach_queue')
    .where('status', '==', 'agent_no')
    .where('updatedAt', '>=', fortyEightHoursAgo)
    .orderBy('updatedAt', 'desc')
    .limit(20)
    .get();

  console.log(`Found ${recentAgentNo.size} properties marked as agent_no in last 48 hours:\n`);

  for (const doc of recentAgentNo.docs) {
    const data = doc.data();
    const updatedAt = data.updatedAt?.toDate?.()?.toISOString() || 'unknown';
    const responseAt = data.agentResponseAt?.toDate?.()?.toISOString() || 'not set';
    console.log(`  ${data.address}, ${data.city}, ${data.state}`);
    console.log(`    ID: ${doc.id}`);
    console.log(`    Updated: ${updatedAt}`);
    console.log(`    Agent Response At: ${responseAt}`);
    console.log(`    Agent Response: ${data.agentResponse || 'not set'}`);
    console.log('');
  }

  // 3. CRITICAL CHECK - Make sure agent_no properties are NOT in properties collection as active
  console.log('3. CRITICAL: CHECKING IF AGENT_NO PROPERTIES ARE INCORRECTLY ACTIVE');
  console.log('-'.repeat(70));

  const allAgentNo = await db.collection('agent_outreach_queue')
    .where('status', '==', 'agent_no')
    .get();

  let incorrectlyActive = 0;
  let incorrectlyVerified = 0;
  const problems: Array<{address: string, zpid: string, issue: string}> = [];

  for (const doc of allAgentNo.docs) {
    const data = doc.data();
    if (!data.zpid) continue;

    const propertyId = `zpid_${data.zpid}`;
    const propDoc = await db.collection('properties').doc(propertyId).get();

    if (propDoc.exists) {
      const propData = propDoc.data();

      if (propData.isActive === true) {
        incorrectlyActive++;
        problems.push({
          address: data.address,
          zpid: data.zpid,
          issue: 'isActive=true (should be false or not exist)'
        });
      }

      if (propData.ownerFinanceVerified === true && propData.isActive === true) {
        incorrectlyVerified++;
        problems.push({
          address: data.address,
          zpid: data.zpid,
          issue: 'ownerFinanceVerified=true AND isActive=true'
        });
      }
    }
  }

  if (problems.length === 0) {
    console.log('  ✅ NO PROBLEMS FOUND - All agent_no properties are correctly handled');
    console.log(`     Checked ${allAgentNo.size} agent_no properties`);
  } else {
    console.log(`  ⚠️ PROBLEMS FOUND:`);
    console.log(`     Incorrectly Active: ${incorrectlyActive}`);
    console.log(`     Incorrectly Verified as Owner Finance: ${incorrectlyVerified}`);
    console.log('');
    console.log('  Problem properties:');
    for (const p of problems) {
      console.log(`    - ${p.address} (zpid: ${p.zpid})`);
      console.log(`      Issue: ${p.issue}`);
    }
  }

  // 4. Check the webhook endpoint code
  console.log('\n4. CHECKING GHL STAGE MAPPING IN RECENT CSV SYNC');
  console.log('-'.repeat(70));

  // Check if there are properties that were synced from GHL with "not interested" stage
  // but somehow ended up as active
  const recentSynced = await db.collection('agent_outreach_queue')
    .where('ghlSyncedAt', '>=', fortyEightHoursAgo)
    .orderBy('ghlSyncedAt', 'desc')
    .limit(50)
    .get();

  let syncedToAgentNo = 0;
  let syncedToAgentYes = 0;
  let syncedToSentToGhl = 0;

  recentSynced.forEach((doc: any) => {
    const data = doc.data();
    if (data.status === 'agent_no') syncedToAgentNo++;
    else if (data.status === 'agent_yes') syncedToAgentYes++;
    else if (data.status === 'sent_to_ghl') syncedToSentToGhl++;
  });

  console.log(`  Recently GHL-synced properties (last 48h): ${recentSynced.size}`);
  console.log(`    → agent_no: ${syncedToAgentNo}`);
  console.log(`    → agent_yes: ${syncedToAgentYes}`);
  console.log(`    → sent_to_ghl: ${syncedToSentToGhl}`);

  // 5. Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  console.log(`\nTotal agent_no in queue: ${allAgentNo.size}`);
  console.log(`Properties incorrectly showing as active: ${incorrectlyActive}`);
  console.log(`Properties incorrectly marked as owner finance: ${incorrectlyVerified}`);

  if (incorrectlyActive > 0 || incorrectlyVerified > 0) {
    console.log('\n⚠️ ACTION NEEDED: Some "not interested" properties are incorrectly active!');
    console.log('   Run the fix script to deactivate them.');
  } else {
    console.log('\n✅ All "not interested" properties are correctly handled.');
  }
}

main()
  .then(() => {
    console.log('\nVerification complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
