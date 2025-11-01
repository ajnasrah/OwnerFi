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

async function analyzeMismatch() {
  console.log('🔍 ANALYZING COST-TO-WORKFLOW MISMATCH\n');
  console.log('='.repeat(80));

  // Get sample cost entries
  const costEntries = await db.collection('cost_entries')
    .orderBy('timestamp', 'desc')
    .limit(20)
    .get();

  console.log('\n📊 Sample Cost Entries (20 most recent):\n');
  costEntries.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`  Brand: ${data.brand}`);
    console.log(`  Service: ${data.service}`);
    console.log(`  Operation: ${data.operation}`);
    console.log(`  Cost: $${data.costUSD}`);
    console.log(`  WorkflowId: ${data.workflowId || 'NONE'}`);
    console.log(`  Timestamp: ${new Date(data.timestamp).toISOString()}`);
    console.log(`  Metadata: ${JSON.stringify(data.metadata || {})}`);
    console.log('');
  });

  // Get sample workflows
  console.log('='.repeat(80));
  console.log('\n📋 Sample Completed Workflows:\n');

  const workflows = await db.collection('ownerfi_workflow_queue')
    .where('status', '==', 'completed')
    .orderBy('completedAt', 'desc')
    .limit(10)
    .get();

  workflows.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`  Brand: ${data.brand}`);
    console.log(`  WorkflowId: ${data.workflowId || 'NONE'}`);
    console.log(`  HeyGen ID: ${data.heygenVideoId || 'NONE'}`);
    console.log(`  Submagic ID: ${data.submagicVideoId || 'NONE'}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Created: ${new Date(data.createdAt).toISOString()}`);
    console.log(`  Completed: ${data.completedAt ? new Date(data.completedAt).toISOString() : 'NONE'}`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('\n🎯 ANALYSIS:\n');

  // Check if we can match by timestamp
  console.log('Checking if we can match by brand + timestamp proximity...\n');

  const allCosts = await db.collection('cost_entries').get();
  const allWorkflows = await db.collection('ownerfi_workflow_queue')
    .where('status', '==', 'completed')
    .get();

  console.log(`Total cost entries: ${allCosts.size}`);
  console.log(`Total completed workflows (ownerfi): ${allWorkflows.size}`);

  // Group costs by brand and date
  const costsByBrand = {};
  allCosts.forEach(doc => {
    const data = doc.data();
    const brand = data.brand;
    if (!costsByBrand[brand]) {
      costsByBrand[brand] = [];
    }
    costsByBrand[brand].push(data);
  });

  console.log('\nCosts by brand:');
  Object.entries(costsByBrand).forEach(([brand, costs]) => {
    console.log(`  ${brand}: ${costs.length} cost entries`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n💡 SOLUTION OPTIONS:\n');
  console.log('1. Use monthly totals divided by completed videos (current approach)');
  console.log('2. Match by brand + service + timestamp proximity');
  console.log('3. Fix cost tracking to always include workflowId going forward\n');

  // Calculate simple average based on monthly data
  const currentMonth = '2025-10';
  const monthlyCosts = await db.collection('monthly_costs')
    .where('month', '==', currentMonth)
    .get();

  let totalMonthCost = 0;
  monthlyCosts.forEach(doc => {
    const data = doc.data();
    totalMonthCost += data.total || 0;
  });

  const completedThisMonth = [];
  allWorkflows.forEach(doc => {
    const data = doc.data();
    if (data.completedAt) {
      const completedDate = new Date(data.completedAt);
      const completedMonth = `${completedDate.getFullYear()}-${String(completedDate.getMonth() + 1).padStart(2, '0')}`;
      if (completedMonth === currentMonth) {
        completedThisMonth.push(data);
      }
    }
  });

  console.log(`\n📅 October 2025 Analysis:`);
  console.log(`  Total costs: $${totalMonthCost.toFixed(2)}`);
  console.log(`  Completed workflows (ownerfi only): ${completedThisMonth.length}`);

  // Get all brands' workflows
  let totalCompletedOctober = 0;
  const WORKFLOW_COLLECTIONS = [
    'carz_workflow_queue',
    'ownerfi_workflow_queue',
    'vassdistro_workflow_queue',
    'podcast_workflow_queue',
    'benefit_workflow_queue'
  ];

  for (const coll of WORKFLOW_COLLECTIONS) {
    try {
      const snapshot = await db.collection(coll)
        .where('status', '==', 'completed')
        .get();

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.completedAt) {
          const completedDate = new Date(data.completedAt);
          const completedMonth = `${completedDate.getFullYear()}-${String(completedDate.getMonth() + 1).padStart(2, '0')}`;
          if (completedMonth === currentMonth) {
            totalCompletedOctober++;
          }
        }
      });
    } catch (e) {}
  }

  console.log(`  Completed workflows (ALL brands): ${totalCompletedOctober}`);

  if (totalCompletedOctober > 0) {
    const avgCost = totalMonthCost / totalCompletedOctober;
    console.log(`\n💵 REAL AVERAGE COST PER VIDEO (October 2025): $${avgCost.toFixed(2)}`);
  }

  console.log('\n' + '='.repeat(80));

  await admin.app().delete();
}

analyzeMismatch().catch(console.error);
