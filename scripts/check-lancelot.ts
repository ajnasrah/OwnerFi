import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function check() {
  console.log('=== Searching for 665 Lancelot across all collections ===\n');

  // Check zillow_imports
  const zillowImports = await db.collection('zillow_imports').get();
  const zillowMatch = zillowImports.docs.find(doc => {
    const data = doc.data();
    const addr = (data.fullAddress || data.address || data.streetAddress || '').toLowerCase();
    return addr.includes('lancelot');
  });

  if (zillowMatch) {
    const data = zillowMatch.data();
    console.log('✅ FOUND IN zillow_imports:');
    console.log('   ID:', zillowMatch.id);
    console.log('   Address:', data.fullAddress || data.address);
    console.log('   Source:', data.source);
    console.log('   homeStatus:', data.homeStatus);
    console.log('   ownerFinanceVerified:', data.ownerFinanceVerified);
    console.log('   agentConfirmedOwnerFinance:', data.agentConfirmedOwnerFinance);
    console.log('   lastStatusCheck:', data.lastStatusCheck?.toDate?.());
    console.log('   zpid:', data.zpid);
    console.log('   url:', data.url);
  } else {
    console.log('❌ NOT in zillow_imports');
  }

  // Check agent_outreach_queue
  const outreachQueue = await db.collection('agent_outreach_queue').get();
  const outreachMatch = outreachQueue.docs.find(doc => {
    const data = doc.data();
    const addr = (data.address || data.fullAddress || '').toLowerCase();
    return addr.includes('lancelot');
  });

  if (outreachMatch) {
    const data = outreachMatch.data();
    console.log('\n✅ FOUND IN agent_outreach_queue:');
    console.log('   ID:', outreachMatch.id);
    console.log('   Address:', data.address);
    console.log('   Status:', data.status);
    console.log('   dealType:', data.dealType);
    console.log('   agentResponse:', data.agentResponse);
    console.log('   routedTo:', data.routedTo);
    console.log('   addedAt:', data.addedAt?.toDate?.());
    console.log('   zpid:', data.zpid);
    console.log('   url:', data.url);
  } else {
    console.log('\n❌ NOT in agent_outreach_queue');
  }

  // Check cash_houses
  const cashHouses = await db.collection('cash_houses').get();
  const cashMatch = cashHouses.docs.find(doc => {
    const data = doc.data();
    const addr = (data.fullAddress || data.address || data.streetAddress || '').toLowerCase();
    return addr.includes('lancelot');
  });

  if (cashMatch) {
    const data = cashMatch.data();
    console.log('\n✅ FOUND IN cash_houses:');
    console.log('   ID:', cashMatch.id);
    console.log('   Address:', data.fullAddress || data.address);
    console.log('   homeStatus:', data.homeStatus);
    console.log('   lastStatusCheck:', data.lastStatusCheck?.toDate?.());
  } else {
    console.log('\n❌ NOT in cash_houses');
  }

  // Check cash_deals
  const cashDeals = await db.collection('cash_deals').get();
  const cashDealsMatch = cashDeals.docs.find(doc => {
    const data = doc.data();
    const addr = (data.fullAddress || data.address || data.streetAddress || '').toLowerCase();
    return addr.includes('lancelot');
  });

  if (cashDealsMatch) {
    const data = cashDealsMatch.data();
    console.log('\n✅ FOUND IN cash_deals:');
    console.log('   ID:', cashDealsMatch.id);
    console.log('   Address:', data.fullAddress || data.address);
    console.log('   homeStatus:', data.homeStatus);
    console.log('   lastStatusCheck:', data.lastStatusCheck?.toDate?.());
  } else {
    console.log('\n❌ NOT in cash_deals');
  }

  // Check contacted_agents
  const contactedAgents = await db.collection('contacted_agents').get();
  const contactedMatch = contactedAgents.docs.find(doc => {
    const data = doc.data();
    const addr = (data.propertyAddress || '').toLowerCase();
    return addr.includes('lancelot');
  });

  if (contactedMatch) {
    const data = contactedMatch.data();
    console.log('\n✅ FOUND IN contacted_agents:');
    console.log('   ID:', contactedMatch.id);
    console.log('   Address:', data.propertyAddress);
    console.log('   stage:', data.stage);
    console.log('   status:', data.status);
  } else {
    console.log('\n❌ NOT in contacted_agents');
  }

  // Show summary of agent_outreach_queue statuses
  console.log('\n=== agent_outreach_queue STATUS SUMMARY ===');
  const statuses: Record<string, number> = {};
  const agentYes: any[] = [];
  const pending: any[] = [];

  for (const doc of outreachQueue.docs) {
    const data = doc.data();
    const status = data.status || 'unknown';
    statuses[status] = (statuses[status] || 0) + 1;

    if (status === 'agent_yes') {
      agentYes.push({
        id: doc.id,
        address: data.address,
        dealType: data.dealType,
        routedTo: data.routedTo,
        responseAt: data.agentResponseAt?.toDate?.(),
      });
    }

    if (status === 'pending') {
      pending.push({
        id: doc.id,
        address: data.address,
        dealType: data.dealType,
        addedAt: data.addedAt?.toDate?.(),
      });
    }
  }

  console.log('Totals by status:', statuses);

  if (agentYes.length > 0) {
    console.log('\n=== AGENT YES PROPERTIES (should be in zillow_imports) ===');
    agentYes.slice(0, 10).forEach((p, i) => {
      console.log((i+1) + '. ' + p.address);
      console.log('   Deal Type:', p.dealType);
      console.log('   Routed To:', p.routedTo);
      console.log('   Response At:', p.responseAt);
    });
  }

  if (pending.length > 0) {
    console.log('\n=== PENDING PROPERTIES (waiting in queue) ===');
    console.log('Count:', pending.length);
    pending.slice(0, 10).forEach((p, i) => {
      console.log((i+1) + '. ' + p.address);
      console.log('   Deal Type:', p.dealType);
      console.log('   Added At:', p.addedAt);
    });
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
