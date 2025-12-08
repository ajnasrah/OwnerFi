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

async function debugAgentYesDetails() {
  console.log('='.repeat(80));
  console.log('CHECKING agentResponse AND agentNote FIELDS');
  console.log('='.repeat(80));

  const agentYes = await db.collection('agent_outreach_queue')
    .where('status', '==', 'agent_yes')
    .limit(20)
    .get();

  console.log(`\nSample of ${agentYes.size} agent_yes items:\n`);

  const responseValues = new Set<string>();
  const noteValues = new Set<string>();

  agentYes.docs.forEach(doc => {
    const d = doc.data();
    if (d.agentResponse) responseValues.add(String(d.agentResponse));
    if (d.agentNote) noteValues.add(String(d.agentNote).substring(0, 100));

    console.log(`${d.address}, ${d.city} ${d.state}`);
    console.log(`  agentResponse: "${d.agentResponse || 'N/A'}"`);
    console.log(`  agentNote: "${d.agentNote || 'N/A'}"`);
    console.log(`  agentResponseAt: ${d.agentResponseAt?.toDate?.() || 'N/A'}`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('UNIQUE VALUES FOUND');
  console.log('='.repeat(80));
  console.log('\nagentResponse values:', [...responseValues]);
  console.log('\nagentNote values (first 100 chars):', [...noteValues].slice(0, 5));

  // Search for webhook that sets this
  console.log('\n' + '='.repeat(80));
  console.log('SEARCHING FOR WEBHOOK ENDPOINT');
  console.log('='.repeat(80));
}

debugAgentYesDetails()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
