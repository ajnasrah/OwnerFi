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
  console.log('=== Full details for 665 Lancelot ===\n');

  // Get full document from contacted_agents
  const doc = await db.collection('contacted_agents').doc('uUs0Mk4rbWJMRLbMMkeC').get();

  if (doc.exists) {
    const data = doc.data();
    console.log('=== contacted_agents document ===');
    console.log(JSON.stringify(data, null, 2));
  }

  // Check all other "Interested" properties in contacted_agents
  console.log('\n=== Other "Interested" properties in contacted_agents ===');
  const interested = await db.collection('contacted_agents')
    .where('stage', '==', 'Interested ')
    .get();

  console.log(`Found ${interested.size} properties with stage "Interested "`);

  interested.docs.slice(0, 5).forEach((doc, i) => {
    const data = doc.data();
    console.log(`\n${i + 1}. ${data.propertyAddress}`);
    console.log('   zpid:', data.zpid);
    console.log('   status:', data.status);
    console.log('   source:', data.source);
    console.log('   contactName:', data.contactName);
  });

  // Also check for any pendingVerification flag
  console.log('\n=== Searching for any pendingVerification properties ===');
  const pendingVerification = await db.collection('contacted_agents')
    .where('pendingVerification', '==', true)
    .get();

  console.log(`Found ${pendingVerification.size} properties with pendingVerification=true`);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
