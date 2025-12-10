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
  console.log('=== AGENT OUTREACH QUEUE ANALYSIS ===\n');

  const queue = await db.collection('agent_outreach_queue').get();
  console.log(`Total in agent_outreach_queue: ${queue.size}`);

  // Count by status
  const byStatus: Record<string, number> = {};
  const byDealType: Record<string, number> = {};
  const withUrl: number[] = [0, 0]; // [has url, no url]
  const agentYesProperties: any[] = [];

  for (const doc of queue.docs) {
    const data = doc.data();
    const status = data.status || 'unknown';
    const dealType = data.dealType || 'unknown';

    byStatus[status] = (byStatus[status] || 0) + 1;
    byDealType[dealType] = (byDealType[dealType] || 0) + 1;

    if (data.url) {
      withUrl[0]++;
    } else {
      withUrl[1]++;
    }

    // Collect agent_yes properties
    if (status === 'agent_yes') {
      agentYesProperties.push({
        id: doc.id,
        address: data.address,
        dealType: data.dealType,
        url: data.url,
        zpid: data.zpid,
        routedTo: data.routedTo,
        responseAt: data.agentResponseAt?.toDate?.(),
      });
    }
  }

  console.log('\nBy status:');
  Object.entries(byStatus)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

  console.log('\nBy deal type:');
  Object.entries(byDealType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  console.log(`\nWith Zillow URL: ${withUrl[0]}`);
  console.log(`Without URL: ${withUrl[1]}`);

  // Check if agent_yes properties are in zillow_imports
  console.log('\n=== AGENT YES PROPERTIES CHECK ===');
  console.log(`Total agent_yes: ${agentYesProperties.length}`);

  if (agentYesProperties.length > 0) {
    // Get all zpids from zillow_imports
    const zillowImports = await db.collection('zillow_imports').get();
    const zillowZpids = new Set<string>();
    for (const doc of zillowImports.docs) {
      const zpid = doc.data().zpid;
      if (zpid) zillowZpids.add(String(zpid));
    }

    let inZillow = 0;
    let notInZillow = 0;
    const missingFromZillow: any[] = [];

    for (const prop of agentYesProperties) {
      if (prop.zpid && zillowZpids.has(String(prop.zpid))) {
        inZillow++;
      } else {
        notInZillow++;
        missingFromZillow.push(prop);
      }
    }

    console.log(`In zillow_imports: ${inZillow}`);
    console.log(`NOT in zillow_imports: ${notInZillow}`);

    if (missingFromZillow.length > 0) {
      console.log('\n⚠️  Agent YES properties NOT in zillow_imports (should be added):');
      missingFromZillow.slice(0, 10).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.address}`);
        console.log(`     ZPID: ${p.zpid}`);
        console.log(`     URL: ${p.url}`);
        console.log(`     Deal Type: ${p.dealType}`);
        console.log(`     Routed To: ${p.routedTo}`);
      });

      if (missingFromZillow.length > 10) {
        console.log(`  ... and ${missingFromZillow.length - 10} more`);
      }
    }
  }

  // Check sent_to_ghl properties - these are pending agent response
  console.log('\n=== PENDING AGENT RESPONSE (sent_to_ghl) ===');
  const pendingResponse = queue.docs.filter(doc => doc.data().status === 'sent_to_ghl');
  console.log(`Total awaiting response: ${pendingResponse.size}`);

  // These have URLs and could be status checked
  const pendingWithUrl = pendingResponse.filter(doc => doc.data().url);
  console.log(`With Zillow URL (could be status checked): ${pendingWithUrl.length}`);

  // Show sample
  if (pendingWithUrl.length > 0) {
    console.log('\nSample pending properties with URLs:');
    pendingWithUrl.slice(0, 5).forEach((doc, i) => {
      const data = doc.data();
      console.log(`  ${i + 1}. ${data.address}`);
      console.log(`     URL: ${data.url}`);
      console.log(`     Deal Type: ${data.dealType}`);
      console.log(`     Sent to GHL: ${data.sentToGHLAt?.toDate?.()}`);
    });
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
