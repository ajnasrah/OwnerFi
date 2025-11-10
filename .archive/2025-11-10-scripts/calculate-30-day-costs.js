#!/usr/bin/env node

const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function calculate30DayCosts() {
  console.log('\n📊 Calculating Last 30 Days Costs...\n');

  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  const snapshot = await db.collection('cost_entries')
    .where('timestamp', '>=', thirtyDaysAgo)
    .get();

  if (snapshot.empty) {
    console.log('❌ No cost entries found in the last 30 days');
    process.exit(0);
  }

  // Aggregate by service
  const costsByService = {
    heygen: 0,
    submagic: 0,
    late: 0,
    openai: 0,
    r2: 0,
  };

  let total = 0;
  const entries = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const cost = data.costUSD || 0;

    entries.push({
      timestamp: data.timestamp,
      service: data.service,
      operation: data.operation,
      cost: cost,
      brand: data.brand,
    });

    costsByService[data.service] = (costsByService[data.service] || 0) + cost;
    total += cost;
  });

  // Sort by timestamp descending
  entries.sort((a, b) => b.timestamp - a.timestamp);

  console.log('📅 Period:', new Date(thirtyDaysAgo).toLocaleDateString(), 'to', new Date().toLocaleDateString());
  console.log('📝 Total Entries:', entries.length);
  console.log('\n💰 Cost Breakdown by Service:\n');

  Object.entries(costsByService).forEach(([service, cost]) => {
    if (cost > 0) {
      console.log(`   ${service.padEnd(10)} : $${cost.toFixed(6)}`);
    }
  });

  console.log('\n' + '─'.repeat(40));
  console.log(`💵 TOTAL COST (30 days): $${total.toFixed(6)}`);
  console.log('─'.repeat(40));

  // Show recent entries
  console.log('\n📋 Most Recent 10 Entries:\n');
  entries.slice(0, 10).forEach(entry => {
    const date = new Date(entry.timestamp).toLocaleString();
    console.log(`   ${date} | ${entry.service.padEnd(8)} | $${entry.cost.toFixed(6).padStart(10)} | ${entry.operation}`);
  });

  process.exit(0);
}

calculate30DayCosts().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
