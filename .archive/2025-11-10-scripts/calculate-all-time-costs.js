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

async function calculateAllTimeCosts() {
  console.log('\n📊 Calculating All-Time Costs...\n');

  const snapshot = await db.collection('cost_entries').get();

  if (snapshot.empty) {
    console.log('❌ No cost entries found');
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
  const entryCount = {};

  snapshot.forEach(doc => {
    const data = doc.data();
    const cost = data.costUSD || 0;

    entries.push({
      timestamp: data.timestamp,
      service: data.service,
      operation: data.operation,
      cost: cost,
      brand: data.brand,
      units: data.units,
    });

    costsByService[data.service] = (costsByService[data.service] || 0) + cost;
    entryCount[data.service] = (entryCount[data.service] || 0) + 1;
    total += cost;
  });

  // Sort by timestamp descending
  entries.sort((a, b) => b.timestamp - a.timestamp);

  const oldestEntry = entries[entries.length - 1];
  const newestEntry = entries[0];

  console.log('📅 Period:', new Date(oldestEntry.timestamp).toLocaleDateString(), 'to', new Date(newestEntry.timestamp).toLocaleDateString());
  console.log('📝 Total Entries:', entries.length);
  console.log('\n💰 Cost Breakdown by Service:\n');

  Object.entries(costsByService).forEach(([service, cost]) => {
    if (cost > 0 || entryCount[service] > 0) {
      const count = entryCount[service] || 0;
      console.log(`   ${service.padEnd(10)} : $${cost.toFixed(6).padStart(10)} (${count} entries)`);
    }
  });

  console.log('\n' + '─'.repeat(50));
  console.log(`💵 TOTAL COST (ALL TIME): $${total.toFixed(6)}`);
  console.log('─'.repeat(50));

  // Show entries by month
  console.log('\n📅 Costs by Month:\n');
  const monthlyTotals = {};

  entries.forEach(entry => {
    const date = new Date(entry.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + entry.cost;
  });

  Object.entries(monthlyTotals).sort().forEach(([month, cost]) => {
    console.log(`   ${month}: $${cost.toFixed(6)}`);
  });

  // Show most expensive entries
  console.log('\n💸 Top 10 Most Expensive Operations:\n');
  const sortedByCost = [...entries].sort((a, b) => b.cost - a.cost).slice(0, 10);

  sortedByCost.forEach(entry => {
    const date = new Date(entry.timestamp).toLocaleString();
    console.log(`   ${date} | ${entry.service.padEnd(8)} | $${entry.cost.toFixed(6).padStart(10)} | ${entry.operation} (${entry.units} units)`);
  });

  process.exit(0);
}

calculateAllTimeCosts().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
