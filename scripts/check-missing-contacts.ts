import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function checkMissingContacts() {
  console.log('🔍 Analyzing properties WITHOUT contact information...\n');

  // Get properties without contact info
  const snapshot = await db
    .collection('zillow_imports')
    .orderBy('importedAt', 'desc')
    .limit(300)
    .get();

  let withContact = 0;
  let withoutContact = 0;
  const samplesWithout: any[] = [];
  const samplesWith: any[] = [];

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const hasAgentPhone = !!data.agentPhoneNumber;
    const hasBrokerPhone = !!data.brokerPhoneNumber;

    if (hasAgentPhone || hasBrokerPhone) {
      withContact++;
      if (samplesWith.length < 5) {
        samplesWith.push({
          url: data.url,
          address: data.fullAddress || data.streetAddress,
          agentPhone: data.agentPhoneNumber,
          brokerPhone: data.brokerPhoneNumber,
        });
      }
    } else {
      withoutContact++;
      if (samplesWithout.length < 10) {
        samplesWithout.push({
          url: data.url,
          address: data.fullAddress || data.streetAddress,
          source: data.source,
        });
      }
    }
  });

  console.log(`📊 STATISTICS (last ${snapshot.size} imports):\n`);
  console.log(`   ✅ WITH contact info: ${withContact} (${Math.round((withContact / snapshot.size) * 100)}%)`);
  console.log(`   ❌ WITHOUT contact info: ${withoutContact} (${Math.round((withoutContact / snapshot.size) * 100)}%)`);

  console.log(`\n📋 SAMPLES WITH CONTACT INFO (${samplesWith.length}):\n`);
  samplesWith.forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address}`);
    console.log(`   Agent: ${prop.agentPhone || 'N/A'}`);
    console.log(`   Broker: ${prop.brokerPhone || 'N/A'}`);
    console.log(`   URL: ${prop.url}`);
    console.log();
  });

  console.log(`\n📋 SAMPLES WITHOUT CONTACT INFO (${samplesWithout.length}):\n`);
  samplesWithout.forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address}`);
    console.log(`   URL: ${prop.url}`);
    console.log(`   Source: ${prop.source}`);
    console.log();
  });

  if (samplesWithout.length > 0) {
    console.log('\n🔧 NEXT STEP:');
    console.log('Test one of these URLs with debug-apify-extraction.ts to see what Apify actually returns');
    console.log(`\nExample URL to test:\n${samplesWithout[0].url}`);
  }
}

checkMissingContacts()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
