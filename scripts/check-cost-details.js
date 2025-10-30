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

async function checkDetails() {
  const snapshot = await db.collection('cost_entries')
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();

  console.log('\n📋 Most Recent 10 Cost Entries (Full Details):\n');

  snapshot.forEach(doc => {
    const data = doc.data();
    const date = new Date(data.timestamp).toLocaleString();
    console.log(`\n${date}`);
    console.log(`  ID: ${data.id}`);
    console.log(`  Brand: ${data.brand}`);
    console.log(`  Service: ${data.service}`);
    console.log(`  Operation: ${data.operation}`);
    console.log(`  Units: ${data.units}`);
    console.log(`  Cost USD: $${data.costUSD} (raw: ${data.costUSD})`);
    console.log(`  Has workflowId: ${data.workflowId !== undefined}`);
    console.log(`  Has metadata: ${data.metadata !== undefined}`);
  });

  console.log(`\n\nTotal entries: ${snapshot.size}`);

  process.exit(0);
}

checkDetails().catch(console.error);
