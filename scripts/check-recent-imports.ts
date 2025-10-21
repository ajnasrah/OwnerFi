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

async function checkRecentImports() {
  console.log('🔍 Checking properties imported in the LAST HOUR...\n');

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentImports = await db
    .collection('zillow_imports')
    .where('importedAt', '>', oneHourAgo)
    .get();

  console.log(`📊 Found ${recentImports.size} properties imported in the last hour\n`);

  if (recentImports.empty) {
    console.log('❌ No properties imported in the last hour.');
    console.log('The queue may still be processing or the cron hasn\'t run yet.');
    return;
  }

  let withAgentPhone = 0;
  let withBrokerPhone = 0;
  let withEither = 0;
  let withNeither = 0;

  console.log('📋 SAMPLE DATA (first 10):\n');

  recentImports.docs.forEach((doc, index) => {
    const data = doc.data();

    const hasAgentPhone = !!data.agentPhoneNumber;
    const hasBrokerPhone = !!data.brokerPhoneNumber;

    if (hasAgentPhone) withAgentPhone++;
    if (hasBrokerPhone) withBrokerPhone++;
    if (hasAgentPhone || hasBrokerPhone) withEither++;
    else withNeither++;

    if (index < 10) {
      const importedTime = data.importedAt?.toDate?.() || 'Unknown time';
      console.log(`${index + 1}. ${data.fullAddress || data.streetAddress || 'Unknown'}`);
      console.log(`   Imported: ${importedTime}`);
      console.log(`   Agent Phone: ${data.agentPhoneNumber || '❌ MISSING'}`);
      console.log(`   Broker Phone: ${data.brokerPhoneNumber || '❌ MISSING'}`);
      console.log(`   Status: ${hasAgentPhone || hasBrokerPhone ? '✅ HAS CONTACT' : '⚠️ NO CONTACT'}`);
      console.log();
    }
  });

  console.log('📊 CONTACT INFO STATISTICS (LAST HOUR ONLY):\n');
  console.log(`   Total Imported: ${recentImports.size}`);
  console.log(`   ✅ With Agent Phone: ${withAgentPhone} (${Math.round((withAgentPhone / recentImports.size) * 100)}%)`);
  console.log(`   ✅ With Broker Phone: ${withBrokerPhone} (${Math.round((withBrokerPhone / recentImports.size) * 100)}%)`);
  console.log(`   ✅ With EITHER: ${withEither} (${Math.round((withEither / recentImports.size) * 100)}%)`);
  console.log(`   ⚠️  With NEITHER: ${withNeither} (${Math.round((withNeither / recentImports.size) * 100)}%)`);

  console.log('\n🎯 ACTUAL SUCCESS RATE FROM NEW QUEUE:');
  console.log(`   ${Math.round((withEither / recentImports.size) * 100)}% of properties have usable contact information`);
}

checkRecentImports()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
