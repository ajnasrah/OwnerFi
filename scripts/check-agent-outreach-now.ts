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

async function checkOutreachQueue() {
  console.log('='.repeat(80));
  console.log('AGENT OUTREACH QUEUE STATUS');
  console.log('='.repeat(80));

  // Get all items and group by status
  const allItems = await db.collection('agent_outreach_queue').get();

  const byStatus: Record<string, number> = {};
  const byDealType: Record<string, number> = {};
  let recentItems = 0;

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  allItems.docs.forEach(doc => {
    const d = doc.data();
    const status = d.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;

    const dealType = d.dealType || 'unknown';
    byDealType[dealType] = (byDealType[dealType] || 0) + 1;

    const addedAt = d.addedAt?.toDate?.();
    if (addedAt && addedAt >= threeDaysAgo) {
      recentItems++;
    }
  });

  console.log(`\n📊 TOTAL ITEMS: ${allItems.size}`);
  console.log(`   Added in last 3 days: ${recentItems}`);

  console.log('\n📋 BY STATUS:');
  Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });

  console.log('\n💰 BY DEAL TYPE:');
  Object.entries(byDealType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });

  // Check contacted_agents collection
  const contacted = await db.collection('contacted_agents').get();
  console.log(`\n📞 CONTACTED AGENTS: ${contacted.size}`);

  // Recent sent to GHL
  const recentSent = await db.collection('agent_outreach_queue')
    .where('status', '==', 'sent_to_ghl')
    .orderBy('sentToGHLAt', 'desc')
    .limit(5)
    .get();

  console.log('\n📤 RECENT SENT TO GHL:');
  if (recentSent.empty) {
    console.log('   No items sent to GHL yet');
  } else {
    recentSent.docs.forEach(doc => {
      const d = doc.data();
      console.log(`   - ${d.address}, ${d.city} ${d.state}`);
      console.log(`     Sent: ${d.sentToGHLAt?.toDate?.()}`);
      console.log(`     Deal Type: ${d.dealType}`);
    });
  }

  // Check pending items
  const pending = await db.collection('agent_outreach_queue')
    .where('status', '==', 'pending')
    .limit(5)
    .get();

  console.log('\n⏳ PENDING ITEMS (sample):');
  if (pending.empty) {
    console.log('   No pending items');
  } else {
    pending.docs.forEach(doc => {
      const d = doc.data();
      console.log(`   - ${d.address}, ${d.city} ${d.state}`);
      console.log(`     Price: $${d.price?.toLocaleString()} | Agent: ${d.agentName}`);
      console.log(`     Deal Type: ${d.dealType}`);
    });
  }

  // Check cron schedule
  console.log('\n📅 CRON SCHEDULE (from vercel.json):');
  console.log('   run-agent-outreach-scraper: 0 6,14,22 * * * (6am, 2pm, 10pm)');
  console.log('   process-agent-outreach-queue: 0 8,16,0 * * * (8am, 4pm, midnight)');

  console.log('\n' + '='.repeat(80));
}

checkOutreachQueue()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
