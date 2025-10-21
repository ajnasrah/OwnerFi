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

async function checkImports() {
  console.log('🔍 Checking zillow_imports...\n');

  // Get recent imports (last 10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const recentImports = await db
    .collection('zillow_imports')
    .where('importedAt', '>', tenMinutesAgo)
    .limit(100)
    .get();

  console.log(`📊 Properties imported in last 10 minutes: ${recentImports.size}\n`);

  if (recentImports.empty) {
    console.log('⏳ No properties imported yet. Apify is still scraping...');
    return;
  }

  // Count properties with contact info
  let withAgentPhone = 0;
  let withBrokerPhone = 0;
  let noContact = 0;

  recentImports.forEach((doc, index) => {
    const data = doc.data();

    if (data.agentPhoneNumber) withAgentPhone++;
    else if (data.brokerPhoneNumber) withBrokerPhone++;
    else noContact++;

    // Show first 5
    if (index < 5) {
      const hasContact = data.agentPhoneNumber || data.brokerPhoneNumber;
      console.log(`${hasContact ? '✅' : '⚠️'} ${data.fullAddress || 'Unknown address'}`);
      if (data.agentPhoneNumber) {
        console.log(`   Agent: ${data.agentName || 'Unknown'} - ${data.agentPhoneNumber}`);
      }
      if (data.brokerPhoneNumber) {
        console.log(`   Broker: ${data.brokerName || 'Unknown'} - ${data.brokerPhoneNumber}`);
      }
      console.log(`   Price: $${data.price?.toLocaleString() || 'Unknown'}`);
      console.log(`   Beds: ${data.bedrooms || '?'} | Baths: ${data.bathrooms || '?'} | Sqft: ${data.squareFoot || '?'}`);
      console.log();
    }
  });

  console.log('📊 CONTACT INFO SUMMARY:');
  console.log(`   ✅ With Agent Phone: ${withAgentPhone}`);
  console.log(`   ✅ With Broker Phone: ${withBrokerPhone}`);
  console.log(`   ⚠️  No Contact Info: ${noContact}`);
  console.log(`\n   Success Rate: ${Math.round(((withAgentPhone + withBrokerPhone) / recentImports.size) * 100)}%`);
}

checkImports()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
