import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function calculateCycleTime() {
  const { db } = getFirebaseAdmin();
  
  console.log('📊 Calculating cycle time for all properties...\n');
  
  // Get counts
  const [activeSnapshot, inactiveSnapshot] = await Promise.all([
    db.collection('properties').where('isActive', '==', true).count().get(),
    db.collection('properties').where('isActive', '==', false).count().get()
  ]);
  
  const activeCount = activeSnapshot.data().count;
  const inactiveCount = inactiveSnapshot.data().count;
  const totalCount = activeCount + inactiveCount;
  
  console.log(`Active properties: ${activeCount}`);
  console.log(`Inactive properties: ${inactiveCount}`);
  console.log(`Total properties: ${totalCount}\n`);
  
  // Configuration from the fixed cron
  const BATCH_SIZE = 150; // Max properties per run
  const RUNS_PER_DAY = 48; // Every 30 minutes
  const PRIORITY_PERCENTAGE = 0.3; // Assume 30% are priority (never checked, old, problematic)
  
  // Calculate for active properties (primary focus)
  const activePriorityCount = Math.floor(activeCount * PRIORITY_PERCENTAGE);
  const activeRegularCount = activeCount - activePriorityCount;
  
  console.log('=== ACTIVE PROPERTIES CYCLE ===');
  console.log(`Priority properties (need immediate check): ${activePriorityCount}`);
  console.log(`Regular properties: ${activeRegularCount}`);
  
  // Priority properties get checked first
  const runsForPriority = Math.ceil(activePriorityCount / BATCH_SIZE);
  const hoursForPriority = (runsForPriority * 0.5); // 30 min per run
  
  console.log(`\n📍 Priority properties will take:`);
  console.log(`   ${runsForPriority} runs = ${hoursForPriority.toFixed(1)} hours`);
  
  // Regular rotation after priorities are cleared
  const runsForFullCycle = Math.ceil(activeCount / BATCH_SIZE);
  const daysForFullCycle = runsForFullCycle / RUNS_PER_DAY;
  
  console.log(`\n📍 Full cycle for all active properties:`);
  console.log(`   ${runsForFullCycle} runs = ${daysForFullCycle.toFixed(1)} days`);
  
  // At current rate
  const currentBatchSize = 57; // Based on the old logs showing 57 per run
  const runsAtCurrentRate = Math.ceil(activeCount / currentBatchSize);
  const daysAtCurrentRate = runsAtCurrentRate / RUNS_PER_DAY;
  
  console.log(`\n📍 At OLD rate (57 properties/run):`);
  console.log(`   ${runsAtCurrentRate} runs = ${daysAtCurrentRate.toFixed(1)} days`);
  
  // Improvement
  const improvement = ((BATCH_SIZE - currentBatchSize) / currentBatchSize * 100).toFixed(0);
  console.log(`\n✨ Improvement: ${improvement}% faster with new batch size`);
  
  // Backlog clearance estimate
  const neverChecked = 116; // From previous analysis
  const staleOver7Days = 383; // From previous analysis
  const totalBacklog = neverChecked + staleOver7Days;
  const runsToCleanBacklog = Math.ceil(totalBacklog / BATCH_SIZE);
  const hoursToCleanBacklog = runsToCleanBacklog * 0.5;
  
  console.log('\n=== BACKLOG CLEARANCE ===');
  console.log(`Current backlog: ${totalBacklog} properties`);
  console.log(`Will be cleared in: ${runsToCleanBacklog} runs = ${hoursToCleanBacklog.toFixed(1)} hours`);
  
  // Recommendations
  console.log('\n=== RECOMMENDATIONS ===');
  if (daysForFullCycle > 3) {
    const recommendedBatchSize = Math.ceil(activeCount / (3 * RUNS_PER_DAY));
    console.log(`⚠️  To achieve 3-day rotation, increase batch size to: ${recommendedBatchSize}`);
  } else {
    console.log(`✅ Current settings achieve ${daysForFullCycle.toFixed(1)}-day rotation`);
  }
  
  process.exit(0);
}

calculateCycleTime().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});