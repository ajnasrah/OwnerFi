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

async function checkAgentYesStatus() {
  console.log('=== CHECKING AGENT YES PROPERTIES ===\n');

  // Get all agent_yes properties from queue
  const agentYesSnapshot = await db
    .collection('agent_outreach_queue')
    .where('status', '==', 'agent_yes')
    .get();

  console.log(`Found ${agentYesSnapshot.size} properties with agent_yes status\n`);

  let inZillowImports = 0;
  let inZillowImportsVerified = 0;
  let inZillowImportsUnverified = 0;
  let notInZillowImports = 0;

  const notImported: any[] = [];
  const importedButUnverified: any[] = [];

  for (const doc of agentYesSnapshot.docs) {
    const data = doc.data();
    const zpid = data.zpid;

    // Check if this zpid exists in zillow_imports
    const zillowDoc = await db
      .collection('zillow_imports')
      .where('zpid', '==', zpid)
      .limit(1)
      .get();

    if (zillowDoc.empty) {
      notInZillowImports++;
      if (notImported.length < 10) {
        notImported.push({
          queueId: doc.id,
          address: data.address,
          zpid: data.zpid,
          agentResponseAt: data.agentResponseAt?.toDate?.()?.toISOString(),
        });
      }
    } else {
      inZillowImports++;
      const zillowData = zillowDoc.docs[0].data();

      if (zillowData.ownerFinanceVerified === true) {
        inZillowImportsVerified++;
      } else {
        inZillowImportsUnverified++;
        if (importedButUnverified.length < 10) {
          importedButUnverified.push({
            queueId: doc.id,
            zillowId: zillowDoc.docs[0].id,
            address: data.address,
            zpid: data.zpid,
            ownerFinanceVerified: zillowData.ownerFinanceVerified,
            isActive: zillowData.isActive,
          });
        }
      }
    }
  }

  console.log('=== RESULTS ===\n');
  console.log(`Total agent_yes in queue: ${agentYesSnapshot.size}`);
  console.log(`In zillow_imports: ${inZillowImports}`);
  console.log(`  - With ownerFinanceVerified=true: ${inZillowImportsVerified}`);
  console.log(`  - WITHOUT ownerFinanceVerified: ${inZillowImportsUnverified}`);
  console.log(`NOT in zillow_imports at all: ${notInZillowImports}`);

  if (notImported.length > 0) {
    console.log('\n=== NOT IMPORTED (samples) ===');
    notImported.forEach((p, i) => {
      console.log(`${i + 1}. ${p.address}`);
      console.log(`   Queue ID: ${p.queueId}`);
      console.log(`   ZPID: ${p.zpid}`);
      console.log(`   Agent responded: ${p.agentResponseAt}`);
    });
  }

  if (importedButUnverified.length > 0) {
    console.log('\n=== IMPORTED BUT NOT VERIFIED (samples) ===');
    importedButUnverified.forEach((p, i) => {
      console.log(`${i + 1}. ${p.address}`);
      console.log(`   Zillow ID: ${p.zillowId}`);
      console.log(`   ownerFinanceVerified: ${p.ownerFinanceVerified}`);
      console.log(`   isActive: ${p.isActive}`);
    });
  }

  console.log('\n=== RECOMMENDATION ===');
  if (notInZillowImports > 0) {
    console.log(`⚠️  ${notInZillowImports} properties need to be RE-IMPORTED to zillow_imports`);
  }
  if (inZillowImportsUnverified > 0) {
    console.log(`⚠️  ${inZillowImportsUnverified} properties need ownerFinanceVerified=true set`);
  }
  if (notInZillowImports === 0 && inZillowImportsUnverified === 0) {
    console.log('✅ All agent_yes properties are properly imported and verified');
  }
}

checkAgentYesStatus()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
