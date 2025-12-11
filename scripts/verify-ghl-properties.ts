import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

// These are the 16 GHL Interested properties from the CSV
const interestedProperties = [
  { address: '377 Fountain Lake Dr', firebaseId: 'bmkJUNTAdIpEE5puzml6' },
  { address: '4355 Cleopatra Rd', firebaseId: 'MCRcB8eBSDlsZODHSvgI' },
  { address: '3 Dunfrettin Pl', firebaseId: 'Kkrj43Adc045utlkwz4q' },
  { address: '6905 Petworth Rd #6905', firebaseId: 'bBSX4sdng6AHoH71uF59' },
  { address: '7325 Knollwood Dr', firebaseId: 's8v99VFQkRU141Bi3ZfI' },
  { address: '5908 Glenhaven Pl', firebaseId: 'hBaLk7Cx2gYIoFnaDWzP' },
  { address: '1234 Smith Ave', firebaseId: 'HTSC9UByiKiK8xvU922c' },
  { address: '2217 Scott St', firebaseId: 'eONeCDfCaDOp3qb8SoJN' },
  { address: '124 Glendale St', firebaseId: '2IbhtbUMubyh5gaWc6OR' },
  { address: '300 E 3rd St APT 503', firebaseId: 'fSdh53FUlwsQYct0fMvy' },
  { address: '620 Williams Ave', firebaseId: 'n3TJYpRI26o8f6L0eblE' },
  { address: '207 Ross Ave', firebaseId: 'sEohmDbgViu7nH2Cu6hQ' },
  { address: '1802 N Houston Levee Rd', firebaseId: 'nZuC30zwCXsNpfLdMGrT' },
  { address: '2864 Summer Oaks Pl', firebaseId: 'g9LDNU7CJTPaLtAsxADG' },
  { address: '4843 Verne Rd', firebaseId: 'ddBnOIh5QMw2FJxULHPb' },
  { address: '14 Quail Creek Ct', firebaseId: 'Bl8RtgSLP7Wb7IqZkSUz' },
];

async function main() {
  console.log('=== VERIFYING GHL PROPERTIES IN ZILLOW_IMPORTS ===\n');

  let found = 0;
  let missing = 0;
  let withSource = 0;
  let withAgentConfirmed = 0;
  let needsFix: Array<{ address: string, id: string, firebaseId: string }> = [];

  for (const prop of interestedProperties) {
    console.log(`\n--- ${prop.address} ---`);

    // Look for this property in zillow_imports by originalQueueId
    const byQueueId = await db.collection('zillow_imports')
      .where('originalQueueId', '==', prop.firebaseId)
      .limit(1)
      .get();

    if (!byQueueId.empty) {
      const doc = byQueueId.docs[0];
      const data = doc.data();
      found++;

      console.log(`  Found in zillow_imports: ${doc.id}`);
      console.log(`  source: ${data.source || 'NOT SET'}`);
      console.log(`  agentConfirmedOwnerFinance: ${data.agentConfirmedOwnerFinance || 'NOT SET'}`);

      if (data.source === 'agent_outreach') withSource++;
      if (data.agentConfirmedOwnerFinance === true) withAgentConfirmed++;

      if (data.source !== 'agent_outreach' || !data.agentConfirmedOwnerFinance) {
        needsFix.push({ address: prop.address, id: doc.id, firebaseId: prop.firebaseId });
      }
    } else {
      console.log('  NOT FOUND in zillow_imports');
      missing++;
    }
  }

  console.log('\n\n=== SUMMARY ===');
  console.log(`Found: ${found}/${interestedProperties.length}`);
  console.log(`Missing: ${missing}`);
  console.log(`With source='agent_outreach': ${withSource}`);
  console.log(`With agentConfirmedOwnerFinance=true: ${withAgentConfirmed}`);

  if (needsFix.length > 0) {
    console.log(`\n=== FIXING ${needsFix.length} PROPERTIES ===`);
    for (const prop of needsFix) {
      console.log(`\nFixing: ${prop.address} (${prop.id})`);
      await db.collection('zillow_imports').doc(prop.id).update({
        source: 'agent_outreach',
        agentConfirmedOwnerFinance: true,
        originalQueueId: prop.firebaseId,
      });
      console.log('  Fixed!');
    }
  }
}

main().then(() => process.exit(0));
