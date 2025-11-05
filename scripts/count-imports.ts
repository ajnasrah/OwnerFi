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

async function countImports() {
  console.log('🔍 Checking zillow_imports collection...\n');

  // Get last 50 imports (no time filter)
  const imports = await db
    .collection('zillow_imports')
    .orderBy('importedAt', 'desc')
    .limit(50)
    .get();

  console.log(`📊 Total documents retrieved: ${imports.size}\n`);

  if (imports.empty) {
    console.log('❌ No properties in zillow_imports collection yet.');
    return;
  }

  console.log('📋 MOST RECENT 10 IMPORTS:\n');

  imports.docs.slice(0, 10).forEach((doc, index) => {
    const data = doc.data();
    const hasContact = data.agentPhoneNumber || data.brokerPhoneNumber;

    console.log(`${index + 1}. ${hasContact ? '✅' : '⚠️'} ${data.fullAddress || 'Unknown'}`);
    console.log(`   Imported: ${data.importedAt?.toDate?.() || 'Unknown'}`);
    if (data.agentPhoneNumber) {
      console.log(`   Agent: ${data.agentName || '?'} - ${data.agentPhoneNumber}`);
    }
    if (data.brokerPhoneNumber && !data.agentPhoneNumber) {
      console.log(`   Broker: ${data.brokerName || '?'} - ${data.brokerPhoneNumber}`);
    }
    console.log(`   Price: $${data.price?.toLocaleString() || '?'} | ${data.bedrooms || '?'}bd ${data.bathrooms || '?'}ba`);
    console.log();
  });
}

countImports()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
