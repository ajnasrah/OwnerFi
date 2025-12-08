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

async function debugAgentYes() {
  console.log('='.repeat(80));
  console.log('DEBUGGING "agent_yes" STATUS');
  console.log('='.repeat(80));

  // Get all agent_yes items
  const agentYes = await db.collection('agent_outreach_queue')
    .where('status', '==', 'agent_yes')
    .get();

  console.log(`\nTotal items with status "agent_yes": ${agentYes.size}\n`);

  // Analyze a sample
  console.log('SAMPLE OF 10 "agent_yes" ITEMS:');
  console.log('-'.repeat(80));

  const sample = agentYes.docs.slice(0, 10);
  for (const doc of sample) {
    const d = doc.data();
    console.log(`\nID: ${doc.id}`);
    console.log(`Address: ${d.address}, ${d.city} ${d.state}`);
    console.log(`Agent: ${d.agentName} | Phone: ${d.agentPhone}`);
    console.log(`Status: ${d.status}`);
    console.log(`Added At: ${d.addedAt?.toDate?.()}`);
    console.log(`Sent to GHL At: ${d.sentToGHLAt?.toDate?.() || 'N/A'}`);
    console.log(`Updated At: ${d.updatedAt?.toDate?.() || 'N/A'}`);
    console.log(`Source: ${d.source}`);

    // Check all fields that might indicate how this became agent_yes
    const allKeys = Object.keys(d);
    const interestingKeys = allKeys.filter(k =>
      k.includes('response') ||
      k.includes('Response') ||
      k.includes('yes') ||
      k.includes('agent') ||
      k.includes('ghl') ||
      k.includes('webhook')
    );
    if (interestingKeys.length > 0) {
      console.log(`Interesting fields: ${interestingKeys.join(', ')}`);
    }
  }

  // Check if there's a pattern - when were these set to agent_yes?
  console.log('\n' + '='.repeat(80));
  console.log('TIMELINE ANALYSIS');
  console.log('='.repeat(80));

  const byDate: Record<string, number> = {};
  agentYes.docs.forEach(doc => {
    const d = doc.data();
    const updatedAt = d.updatedAt?.toDate?.() || d.addedAt?.toDate?.();
    if (updatedAt) {
      const dateKey = updatedAt.toLocaleDateString();
      byDate[dateKey] = (byDate[dateKey] || 0) + 1;
    }
  });

  console.log('\nItems by date (updatedAt or addedAt):');
  Object.entries(byDate)
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    .slice(0, 10)
    .forEach(([date, count]) => {
      console.log(`  ${date}: ${count}`);
    });

  // Check contacted_agents for comparison
  console.log('\n' + '='.repeat(80));
  console.log('CONTACTED_AGENTS STATUS BREAKDOWN');
  console.log('='.repeat(80));

  const contacted = await db.collection('contacted_agents').get();
  const contactedByStatus: Record<string, number> = {};
  contacted.docs.forEach(doc => {
    const d = doc.data();
    const status = d.status || d.stage || 'unknown';
    contactedByStatus[status] = (contactedByStatus[status] || 0) + 1;
  });

  console.log('\nBy status:');
  Object.entries(contactedByStatus)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

  // Search for webhook or API that sets agent_yes
  console.log('\n' + '='.repeat(80));
  console.log('LOOKING FOR HOW agent_yes GETS SET');
  console.log('='.repeat(80));

  // Check one doc's full data
  if (agentYes.docs.length > 0) {
    const fullDoc = agentYes.docs[0].data();
    console.log('\nFull data of first agent_yes doc:');
    console.log(JSON.stringify(fullDoc, (key, value) => {
      if (value?.toDate) return value.toDate().toISOString();
      if (typeof value === 'object' && value !== null && Object.keys(value).length > 20) {
        return '[large object omitted]';
      }
      return value;
    }, 2));
  }
}

debugAgentYes()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
