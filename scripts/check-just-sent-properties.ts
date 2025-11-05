import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function checkProperties() {
  const oppIds = [
    { id: 'sJm3Iz810TxCtV23hu3E', name: '1203 Kirkland Ave, Nashville' },
    { id: '9c3qHnG2lETzmufVoU49', name: '349 Cascade Dr, Central Pt' }
  ];

  for (const opp of oppIds) {
    console.log(`\n--- Checking: ${opp.name} (${opp.id}) ---`);

    const propQuery = await db.collection('properties')
      .where('opportunityId', '==', opp.id)
      .limit(1)
      .get();

    if (propQuery.empty) {
      console.log('  ❌ NOT FOUND in properties collection');
    } else {
      const prop = propQuery.docs[0].data();
      console.log('  ✅ FOUND in properties!');
      console.log(`     Address: ${prop.address}, ${prop.city}, ${prop.state}`);
      console.log(`     Status: ${prop.status}`);
      console.log(`     isActive: ${prop.isActive}`);
      console.log(`     Price: $${prop.price?.toLocaleString()}`);
      console.log(`     Created: ${prop.createdAt?.toDate?.()}`);
    }

    // Check webhook logs
    const logsQuery = await db.collection('webhook-logs')
      .where('opportunityId', '==', opp.id)
      .limit(5)
      .get();

    if (!logsQuery.empty) {
      console.log(`  📋 Found ${logsQuery.size} webhook log(s):`);
      logsQuery.forEach(doc => {
        const log = doc.data();
        console.log(`     - Timestamp: ${log.timestamp?.toDate?.() || log.createdAt?.toDate?.() || 'N/A'}`);
        console.log(`     - Status: ${log.status || 'N/A'}`);
        console.log(`     - Event: ${log.event || log.type || 'N/A'}`);
        if (log.error) {
          console.log(`     - Error: ${log.error}`);
        }
      });
    } else {
      console.log('  📋 No webhook logs found');
    }

    // Check property-errors
    const errorQuery = await db.collection('property-errors')
      .where('opportunityId', '==', opp.id)
      .limit(3)
      .get();

    if (!errorQuery.empty) {
      console.log(`  ⚠️  Found ${errorQuery.size} error(s):`);
      errorQuery.forEach(doc => {
        const error = doc.data();
        console.log(`     - Error: ${error.error || error.message}`);
        console.log(`     - Timestamp: ${error.timestamp?.toDate?.() || 'N/A'}`);
      });
    }
  }
}

checkProperties().catch(console.error);
