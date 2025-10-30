const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function getCosts() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  console.log('📊 OwnerFi Cost Report - Last 30 Days\n');
  console.log('Period:', thirtyDaysAgo.toLocaleDateString(), 'to', now.toLocaleDateString());
  console.log('='.repeat(80));

  // Get cost entries for last 30 days
  const entries = await db.collection('cost_entries')
    .where('timestamp', '>=', thirtyDaysAgo.getTime())
    .where('brand', '==', 'ownerfi')
    .get();

  console.log(`\nTotal Entries: ${entries.size}`);

  const costs = {
    heygen: { count: 0, cost: 0 },
    submagic: { count: 0, cost: 0 },
    late: { count: 0, cost: 0 },
    openai: { count: 0, cost: 0 },
    r2: { count: 0, cost: 0 }
  };

  entries.forEach(doc => {
    const data = doc.data();
    const service = data.service;
    if (costs[service]) {
      costs[service].count++;
      costs[service].cost += data.costUSD || 0;
    }
  });

  console.log('\n💰 Cost Breakdown:\n');
  let total = 0;
  Object.entries(costs).forEach(([service, data]) => {
    const serviceName = service.toUpperCase();
    console.log(`${serviceName}:`);
    console.log(`  Calls: ${data.count}`);
    console.log(`  Cost: $${data.cost.toFixed(2)}`);
    total += data.cost;
  });

  console.log('\n' + '='.repeat(80));
  console.log(`TOTAL OWNERFI SPEND (30 days): $${total.toFixed(2)}`);
  console.log('='.repeat(80));

  await admin.app().delete();
}

getCosts().catch(console.error);
