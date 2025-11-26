import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = admin.firestore();

async function diagnose() {
  console.log('🔍 DIAGNOSING GHL PIPELINE\n');

  // 1. Check recent contacted_agents entries
  const recentContacted = await db.collection('contacted_agents')
    .orderBy('createdOn', 'desc')
    .limit(10)
    .get();

  console.log('📞 LAST 10 CONTACTED AGENTS:');
  recentContacted.docs.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${data.propertyAddress || 'N/A'}`);
    console.log(`    Agent: ${data.contactName} | ${data.contactPhone}`);
    console.log(`    Contacted: ${data.createdOn}`);
    console.log(`    Stage: ${data.stage} | Status: ${data.status}`);
    console.log('');
  });

  // 2. Check zillow_imports sent to GHL recently
  const recentSentToGHL = await db.collection('zillow_imports')
    .where('sentToGHL', '==', true)
    .orderBy('sentToGHLAt', 'desc')
    .limit(5)
    .get();

  console.log('\n📤 LAST 5 ZILLOW IMPORTS SENT TO GHL:');
  if (recentSentToGHL.empty) {
    console.log('  None found!');
  } else {
    recentSentToGHL.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.fullAddress || data.streetAddress}`);
      console.log(`    Sent at: ${data.sentToGHLAt?.toDate?.() || 'unknown'}`);
    });
  }

  // 3. Check zillow_imports NOT sent to GHL
  const notSentToGHL = await db.collection('zillow_imports')
    .where('sentToGHL', '!=', true)
    .orderBy('foundAt', 'desc')
    .limit(10)
    .get();

  console.log('\n⏳ ZILLOW IMPORTS NOT YET SENT TO GHL:');
  if (notSentToGHL.empty) {
    console.log('  All properties have been sent!');
  } else {
    notSentToGHL.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.fullAddress || data.streetAddress}`);
      console.log(`    Found: ${data.foundAt?.toDate?.() || 'unknown'}`);
      console.log(`    Agent: ${data.agentName || 'N/A'} | ${data.agentPhoneNumber || 'N/A'}`);
      console.log(`    Status: ${data.homeStatus}`);
    });
  }

  // 4. What's missing? Check if agents have contact info
  const noContactInfo = await db.collection('zillow_imports')
    .where('sentToGHL', '!=', true)
    .limit(100)
    .get();

  let withContact = 0;
  let withoutContact = 0;
  let notForSale = 0;

  noContactInfo.docs.forEach(doc => {
    const data = doc.data();
    if (data.homeStatus !== 'FOR_SALE') {
      notForSale++;
    } else if (data.agentPhoneNumber || data.brokerPhoneNumber) {
      withContact++;
    } else {
      withoutContact++;
    }
  });

  console.log('\n📊 UNSENT PROPERTIES ANALYSIS:');
  console.log(`  ✅ Has contact info & FOR_SALE: ${withContact}`);
  console.log(`  ❌ No contact info: ${withoutContact}`);
  console.log(`  ⏸️ Not FOR_SALE: ${notForSale}`);

  process.exit(0);
}

diagnose().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
