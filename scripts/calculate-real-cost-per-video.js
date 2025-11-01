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

// All workflow queue collections
const WORKFLOW_COLLECTIONS = [
  'carz_workflow_queue',
  'ownerfi_workflow_queue',
  'vassdistro_workflow_queue',
  'podcast_workflow_queue',
  'benefit_workflow_queue',
  'abdullah_workflow_queue'
];

async function calculateRealCostPerVideo() {
  console.log('💰 REAL COST PER VIDEO CALCULATION\n');
  console.log('='.repeat(80));
  console.log('Analyzing completed workflows across ALL brands...\n');

  let totalCompletedWorkflows = 0;
  let workflowsWithCosts = 0;
  let totalCostsFromWorkflows = 0;
  const workflowDetails = [];

  // Get all completed workflows from all collections
  for (const collectionName of WORKFLOW_COLLECTIONS) {
    try {
      const snapshot = await db.collection(collectionName)
        .where('status', '==', 'completed')
        .get();

      console.log(`📋 ${collectionName}: ${snapshot.size} completed workflows`);

      snapshot.forEach(doc => {
        const data = doc.data();
        totalCompletedWorkflows++;

        workflowDetails.push({
          id: doc.id,
          collection: collectionName,
          brand: data.brand,
          workflowId: data.workflowId,
          heygenVideoId: data.heygenVideoId,
          submagicVideoId: data.submagicVideoId,
          completedAt: data.completedAt,
          createdAt: data.createdAt
        });
      });
    } catch (error) {
      console.log(`  ⚠️  Collection ${collectionName} not found or error:`, error.message);
    }
  }

  console.log(`\n✅ Total completed workflows found: ${totalCompletedWorkflows}\n`);
  console.log('='.repeat(80));
  console.log('\n🔍 Matching workflows to actual cost entries...\n');

  // Get ALL cost entries
  const costEntries = await db.collection('cost_entries').get();
  console.log(`📊 Total cost entries in database: ${costEntries.size}\n`);

  // Create a map of workflowId -> costs
  const workflowCostMap = new Map();

  costEntries.forEach(doc => {
    const data = doc.data();
    const workflowId = data.workflowId;

    if (workflowId) {
      if (!workflowCostMap.has(workflowId)) {
        workflowCostMap.set(workflowId, {
          totalCost: 0,
          entries: []
        });
      }

      const current = workflowCostMap.get(workflowId);
      current.totalCost += data.costUSD || 0;
      current.entries.push({
        service: data.service,
        cost: data.costUSD || 0,
        timestamp: data.timestamp
      });
    }
  });

  console.log(`🔗 Cost entries with workflowId: ${workflowCostMap.size}\n`);
  console.log('='.repeat(80));
  console.log('\n📈 DETAILED WORKFLOW COST ANALYSIS:\n');

  // Match workflows to their costs
  const workflowsWithDetailedCosts = [];

  for (const workflow of workflowDetails) {
    const costs = workflowCostMap.get(workflow.workflowId);

    if (costs) {
      workflowsWithCosts++;
      totalCostsFromWorkflows += costs.totalCost;

      workflowsWithDetailedCosts.push({
        ...workflow,
        totalCost: costs.totalCost,
        costBreakdown: costs.entries
      });
    }
  }

  // Sort by cost (highest first) and show top 10
  workflowsWithDetailedCosts.sort((a, b) => b.totalCost - a.totalCost);

  console.log('Top 10 Most Expensive Workflows:');
  console.log('-'.repeat(80));
  workflowsWithDetailedCosts.slice(0, 10).forEach((wf, idx) => {
    console.log(`\n${idx + 1}. ${wf.brand.toUpperCase()} - Workflow ${wf.workflowId}`);
    console.log(`   Total Cost: $${wf.totalCost.toFixed(4)}`);
    console.log(`   Breakdown:`);
    wf.costBreakdown.forEach(entry => {
      console.log(`     - ${entry.service}: $${entry.cost.toFixed(4)}`);
    });
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 AGGREGATE STATISTICS:\n');

  // Calculate by brand
  const brandStats = {};
  workflowsWithDetailedCosts.forEach(wf => {
    if (!brandStats[wf.brand]) {
      brandStats[wf.brand] = { count: 0, totalCost: 0 };
    }
    brandStats[wf.brand].count++;
    brandStats[wf.brand].totalCost += wf.totalCost;
  });

  console.log('Cost Per Video by Brand:');
  Object.entries(brandStats).forEach(([brand, stats]) => {
    const avgCost = stats.totalCost / stats.count;
    console.log(`  ${brand.toUpperCase()}: $${avgCost.toFixed(2)} per video (${stats.count} videos, $${stats.totalCost.toFixed(2)} total)`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 FINAL NUMBERS:\n');
  console.log(`Total Completed Workflows: ${totalCompletedWorkflows}`);
  console.log(`Workflows with Cost Data: ${workflowsWithCosts}`);
  console.log(`Workflows Missing Cost Data: ${totalCompletedWorkflows - workflowsWithCosts}`);
  console.log(`\nTotal Cost (Tracked Workflows): $${totalCostsFromWorkflows.toFixed(2)}`);

  if (workflowsWithCosts > 0) {
    const realAvgCost = totalCostsFromWorkflows / workflowsWithCosts;
    console.log(`\n💵 REAL AVERAGE COST PER COMPLETED VIDEO: $${realAvgCost.toFixed(2)}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n⚠️  NOTE: Workflows without workflowId in cost_entries are NOT tracked.');
  console.log('This might happen if:');
  console.log('  - Costs were tracked before workflowId was implemented');
  console.log('  - Some services did not properly pass workflowId');
  console.log('  - Manual testing/debugging runs\n');

  await admin.app().delete();
}

calculateRealCostPerVideo().catch(console.error);
