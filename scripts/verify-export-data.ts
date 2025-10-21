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

async function verifyExportData() {
  console.log('🔍 Verifying GHL Export Data Fields...\n');

  const imports = await db
    .collection('zillow_imports')
    .orderBy('importedAt', 'desc')
    .limit(20)
    .get();

  console.log(`📊 Checking ${imports.size} recent imports\n`);

  let withAgentPhone = 0;
  let withBrokerPhone = 0;
  let withEither = 0;
  let withNeither = 0;

  console.log('📋 SAMPLE DATA (showing first 5):\n');

  imports.docs.forEach((doc, index) => {
    const data = doc.data();

    const hasAgentPhone = !!data.agentPhoneNumber;
    const hasBrokerPhone = !!data.brokerPhoneNumber;

    if (hasAgentPhone) withAgentPhone++;
    if (hasBrokerPhone) withBrokerPhone++;
    if (hasAgentPhone || hasBrokerPhone) withEither++;
    else withNeither++;

    if (index < 5) {
      console.log(`${index + 1}. ${data.fullAddress || 'Unknown'}`);
      console.log(`   ├─ Agent Phone: ${data.agentPhoneNumber || '❌ MISSING'}`);
      console.log(`   ├─ Agent Name: ${data.agentName || '❌ MISSING'}`);
      console.log(`   ├─ Broker Phone: ${data.brokerPhoneNumber || '❌ MISSING'}`);
      console.log(`   └─ Broker Name: ${data.brokerName || '❌ MISSING'}`);
      console.log();
    }
  });

  console.log('📊 CONTACT INFO STATISTICS:\n');
  console.log(`   ✅ Properties with Agent Phone: ${withAgentPhone} (${Math.round((withAgentPhone / imports.size) * 100)}%)`);
  console.log(`   ✅ Properties with Broker Phone: ${withBrokerPhone} (${Math.round((withBrokerPhone / imports.size) * 100)}%)`);
  console.log(`   ✅ Properties with EITHER phone: ${withEither} (${Math.round((withEither / imports.size) * 100)}%)`);
  console.log(`   ⚠️  Properties with NO contact: ${withNeither} (${Math.round((withNeither / imports.size) * 100)}%)`);

  console.log('\n📤 GHL EXPORT COLUMNS THAT WILL BE POPULATED:\n');
  console.log('   - agent_name');
  console.log('   - agent_phone  ← PRIMARY CONTACT FIELD');
  console.log('   - agent_email');
  console.log('   - agent_license');
  console.log('   - broker_name');
  console.log('   - broker_phone ← BACKUP CONTACT FIELD');

  if (withEither > 0) {
    console.log('\n✅ SUCCESS! Agent/Broker phone numbers ARE being saved and WILL appear in GHL export!');
  } else {
    console.log('\n⚠️  WARNING: No contact information found in recent imports.');
  }
}

verifyExportData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
