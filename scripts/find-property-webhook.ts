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

async function main() {
  const searchAddress = '1234 Smith Ave';

  // Find the property in zillow_imports
  console.log('=== ZILLOW_IMPORTS ===');
  const imports = await db.collection('zillow_imports')
    .where('streetAddress', '==', searchAddress)
    .get();

  if (imports.size > 0) {
    const doc = imports.docs[0];
    const d = doc.data();
    console.log('ID:', doc.id);
    console.log('Address:', d.fullAddress);
    console.log('Source:', d.source);
    console.log('ZPID:', d.zpid);
  } else {
    console.log('Not found');
  }

  // Check agent_outreach_queue
  console.log('\n=== AGENT_OUTREACH_QUEUE ===');
  const outreach = await db.collection('agent_outreach_queue')
    .where('address', '==', searchAddress)
    .get();

  if (outreach.size > 0) {
    outreach.docs.forEach(doc => {
      const d = doc.data();
      console.log('ID:', doc.id);
      console.log('Address:', d.address);
      console.log('Status:', d.status);
      console.log('GHL Opportunity ID:', d.ghlOpportunityId);
      console.log('Sent to GHL:', d.sentToGHLAt?.toDate?.());
    });
  } else {
    console.log('Not found by exact match, searching Memphis...');
    const memphis = await db.collection('agent_outreach_queue')
      .where('city', '==', 'Memphis')
      .limit(300)
      .get();

    const match = memphis.docs.find(d =>
      d.data().address?.includes('Smith')
    );

    if (match) {
      const d = match.data();
      console.log('Found:', d.address);
      console.log('ID:', match.id);
      console.log('Status:', d.status);
      console.log('GHL Opportunity ID:', d.ghlOpportunityId);
      console.log('Sent to GHL:', d.sentToGHLAt?.toDate?.());
    } else {
      console.log('Not found in Memphis');
    }
  }

  // Check contacted_agents
  console.log('\n=== CONTACTED_AGENTS ===');
  const contacted = await db.collection('contacted_agents')
    .where('propertyAddress', '==', searchAddress)
    .get();

  if (contacted.size > 0) {
    contacted.docs.forEach(doc => {
      const d = doc.data();
      console.log('ID:', doc.id);
      console.log('Property:', d.propertyAddress);
      console.log('Stage:', d.stage);
      console.log('Status:', d.status);
      console.log('Firebase ID:', d.firebase_id);
      console.log('Opportunity ID:', d.opportunityId);
    });
  } else {
    console.log('Not found by exact match, searching all...');
    const all = await db.collection('contacted_agents')
      .limit(1000)
      .get();

    const match = all.docs.find(d =>
      d.data().propertyAddress?.includes('Smith')
    );

    if (match) {
      const d = match.data();
      console.log('Found:', d.propertyAddress);
      console.log('ID:', match.id);
      console.log('Stage:', d.stage);
      console.log('Status:', d.status);
      console.log('Firebase ID:', d.firebase_id);
      console.log('Opportunity ID:', d.opportunityId);
    } else {
      console.log('Not found');
    }
  }
}

main().then(() => process.exit(0));
