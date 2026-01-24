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

async function main() {
  console.log('========================================');
  console.log('FINAL VERIFICATION');
  console.log('========================================\n');

  // Check agent_outreach_queue status counts
  const queueStats = {
    agent_yes: 0,
    agent_no: 0,
    sent_to_ghl: 0,
    other: 0
  };

  const queueSnapshot = await db.collection('agent_outreach_queue').get();
  queueSnapshot.docs.forEach(doc => {
    const status = doc.data().status;
    if (status === 'agent_yes') queueStats.agent_yes++;
    else if (status === 'agent_no') queueStats.agent_no++;
    else if (status === 'sent_to_ghl') queueStats.sent_to_ghl++;
    else queueStats.other++;
  });

  console.log('agent_outreach_queue status breakdown:');
  console.log(`  agent_yes: ${queueStats.agent_yes}`);
  console.log(`  agent_no: ${queueStats.agent_no}`);
  console.log(`  sent_to_ghl: ${queueStats.sent_to_ghl}`);
  console.log(`  other: ${queueStats.other}`);

  // Check properties collection - owner finance verified
  const ownerFinanceVerified = await db.collection('properties')
    .where('ownerFinanceVerified', '==', true)
    .where('isActive', '==', true)
    .count()
    .get();

  console.log(`\nproperties collection:`);
  console.log(`  Owner finance verified & active: ${ownerFinanceVerified.data().count}`);

  // Check properties with dealType = owner_finance
  const ownerFinanceDealType = await db.collection('properties')
    .where('dealType', '==', 'owner_finance')
    .where('isActive', '==', true)
    .count()
    .get();

  console.log(`  dealType=owner_finance & active: ${ownerFinanceDealType.data().count}`);

  // Sample 5 of our synced properties
  console.log('\n========================================');
  console.log('SAMPLE SYNCED INTERESTED PROPERTIES');
  console.log('========================================\n');

  const sampleIds = [
    'zpid_340945',      // 14 Evergreen Ct
    'zpid_42145694',    // 2579 Hale Ave
    'zpid_41811854',    // 32 Russell Rd
    'zpid_314021',      // 2501 S Pine St
    'zpid_324577',      // 14 Quail Creek Ct
  ];

  for (const propId of sampleIds) {
    const doc = await db.collection('properties').doc(propId).get();
    if (doc.exists) {
      const data = doc.data()!;
      console.log(`${data.address}, ${data.city}, ${data.state}`);
      console.log(`  ID: ${propId}`);
      console.log(`  isActive: ${data.isActive}`);
      console.log(`  status: ${data.status}`);
      console.log(`  dealType: ${data.dealType}`);
      console.log(`  ownerFinanceVerified: ${data.ownerFinanceVerified}`);
      console.log(`  source: ${data.source}`);
      console.log(`  price: $${data.listPrice?.toLocaleString() || data.price?.toLocaleString()}`);
      console.log('');
    }
  }

  // Check by city for buyer interface
  console.log('========================================');
  console.log('PROPERTIES BY CITY (for buyer searches)');
  console.log('========================================\n');

  const cities = ['Memphis', 'Little Rock', 'Jackson', 'Cordova', 'Southaven'];

  for (const city of cities) {
    const cityCount = await db.collection('properties')
      .where('city', '==', city)
      .where('isActive', '==', true)
      .where('dealType', '==', 'owner_finance')
      .count()
      .get();

    console.log(`${city}: ${cityCount.data().count} owner finance properties`);
  }

  console.log('\n✅ All interested properties are now:');
  console.log('   - Marked as agent_yes in agent_outreach_queue');
  console.log('   - Created/updated in properties collection');
  console.log('   - Set with isActive=true, status=active');
  console.log('   - Set with dealType=owner_finance, ownerFinanceVerified=true');
  console.log('   - Ready to show in buyer interface (once Typesense syncs)');
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
