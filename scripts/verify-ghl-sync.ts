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
  console.log('='.repeat(60));
  console.log('GHL OUTREACH SYSTEM STATUS VERIFICATION');
  console.log('='.repeat(60));
  console.log('');

  // Get all status counts from agent_outreach_queue
  const queueDocs = await db.collection('agent_outreach_queue').get();

  const statusCounts: Record<string, number> = {};
  const statusSamples: Record<string, Array<{address: string, id: string}>> = {};

  queueDocs.forEach((doc: any) => {
    const data = doc.data();
    const status = data.status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    if (!statusSamples[status]) {
      statusSamples[status] = [];
    }
    if (statusSamples[status].length < 3) {
      statusSamples[status].push({ address: data.address, id: doc.id });
    }
  });

  console.log('Agent Outreach Queue Status Distribution:');
  console.log('-'.repeat(40));

  const sortedStatuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
  for (const [status, count] of sortedStatuses) {
    console.log(`  ${status}: ${count}`);
  }

  console.log('');
  console.log('Total in queue:', queueDocs.size);

  // Check properties collection
  console.log('\n' + '='.repeat(60));
  console.log('PROPERTIES COLLECTION STATUS');
  console.log('='.repeat(60));
  console.log('');

  const propsDocs = await db.collection('properties')
    .where('source', '==', 'agent_outreach')
    .get();

  let activeCount = 0;
  let inactiveCount = 0;
  let verifiedCount = 0;

  propsDocs.forEach((doc: any) => {
    const data = doc.data();
    if (data.isActive) activeCount++;
    else inactiveCount++;
    if (data.ownerFinanceVerified) verifiedCount++;
  });

  console.log('Properties from agent outreach:');
  console.log(`  Total: ${propsDocs.size}`);
  console.log(`  Active: ${activeCount}`);
  console.log(`  Inactive: ${inactiveCount}`);
  console.log(`  Owner Finance Verified: ${verifiedCount}`);

  // Sample verification - check if agent_yes properties are in properties collection
  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION SAMPLES');
  console.log('='.repeat(60));
  console.log('');

  console.log('Sample agent_yes properties:');
  const agentYesSample = await db.collection('agent_outreach_queue')
    .where('status', '==', 'agent_yes')
    .limit(5)
    .get();

  for (const doc of agentYesSample.docs) {
    const data = doc.data();
    const propertyId = `zpid_${data.zpid}`;
    const propDoc = await db.collection('properties').doc(propertyId).get();

    if (propDoc.exists) {
      const propData = propDoc.data();
      console.log(`  ✓ ${data.address}`);
      console.log(`    Queue: ${data.status}, Properties: active=${propData.isActive}, verified=${propData.ownerFinanceVerified}`);
    } else {
      console.log(`  ✗ ${data.address} - NOT FOUND in properties`);
    }
  }

  console.log('\nSample agent_no properties (should not be active):');
  const agentNoSample = await db.collection('agent_outreach_queue')
    .where('status', '==', 'agent_no')
    .limit(5)
    .get();

  for (const doc of agentNoSample.docs) {
    const data = doc.data();
    const propertyId = `zpid_${data.zpid}`;
    const propDoc = await db.collection('properties').doc(propertyId).get();

    if (propDoc.exists) {
      const propData = propDoc.data();
      const status = propData.isActive ? '⚠️ STILL ACTIVE' : '✓ inactive';
      console.log(`  ${status} ${data.address}`);
    } else {
      console.log(`  ✓ ${data.address} - correctly not in properties`);
    }
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
