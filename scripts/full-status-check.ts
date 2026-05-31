import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function fullStatusCheck() {
  const { db } = getFirebaseAdmin();
  
  console.log('🔍 COMPREHENSIVE STATUS CRON CHECK');
  console.log('=' .repeat(60) + '\n');
  
  // 1. Overall Property Status Distribution
  console.log('1️⃣ PROPERTY STATUS DISTRIBUTION\n');
  
  const [activeCount, inactiveCount] = await Promise.all([
    db.collection('properties').where('isActive', '==', true).count().get(),
    db.collection('properties').where('isActive', '==', false).count().get()
  ]);
  
  console.log(`📊 Total Properties:`);
  console.log(`   Active:   ${activeCount.data().count}`);
  console.log(`   Inactive: ${inactiveCount.data().count}`);
  console.log(`   Total:    ${activeCount.data().count + inactiveCount.data().count}\n`);
  
  // 2. Check for problematic statuses
  console.log('2️⃣ PROBLEMATIC PROPERTIES (Active but should be inactive)\n');
  
  const problematicStatuses = ['SOLD', 'PENDING', 'OFF_MARKET', 'UNDER_CONTRACT', 'CONTINGENT', 'RECENTLY_SOLD'];
  const problematicCounts = {};
  
  for (const status of problematicStatuses) {
    const snapshot = await db.collection('properties')
      .where('isActive', '==', true)
      .where('homeStatus', '==', status)
      .count().get();
    problematicCounts[status] = snapshot.data().count;
  }
  
  let totalProblematic = 0;
  for (const [status, count] of Object.entries(problematicCounts)) {
    if (count > 0) {
      console.log(`   ❌ ${status}: ${count} properties`);
      totalProblematic += count;
    }
  }
  
  if (totalProblematic === 0) {
    console.log(`   ✅ No problematic properties found!`);
  } else {
    console.log(`   Total problematic: ${totalProblematic}`);
  }
  console.log();
  
  // 3. Check never-checked and stale properties
  console.log('3️⃣ PROPERTY FRESHNESS CHECK\n');
  
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000);
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  
  // Sample active properties to check freshness
  const activeSnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .limit(1000)
    .get();
  
  let neverChecked = 0;
  let checkedLastHour = 0;
  let checkedLastDay = 0;
  let checkedLast3Days = 0;
  let checkedLast7Days = 0;
  let staleOver7Days = 0;
  
  activeSnapshot.docs.forEach(doc => {
    const lastCheck = doc.data().lastStatusCheck?.toDate?.();
    
    if (!lastCheck) {
      neverChecked++;
    } else {
      const checkTime = lastCheck.getTime();
      if (checkTime > oneHourAgo.getTime()) {
        checkedLastHour++;
      } else if (checkTime > oneDayAgo.getTime()) {
        checkedLastDay++;
      } else if (checkTime > threeDaysAgo.getTime()) {
        checkedLast3Days++;
      } else if (checkTime > sevenDaysAgo.getTime()) {
        checkedLast7Days++;
      } else {
        staleOver7Days++;
      }
    }
  });
  
  console.log(`📅 Freshness Distribution (sample of ${activeSnapshot.size} active properties):`);
  console.log(`   ✅ Last hour:    ${checkedLastHour} (${(checkedLastHour/activeSnapshot.size*100).toFixed(1)}%)`);
  console.log(`   ✅ Last 24h:     ${checkedLastDay} (${(checkedLastDay/activeSnapshot.size*100).toFixed(1)}%)`);
  console.log(`   ⚠️  1-3 days:     ${checkedLast3Days} (${(checkedLast3Days/activeSnapshot.size*100).toFixed(1)}%)`);
  console.log(`   ⚠️  3-7 days:     ${checkedLast7Days} (${(checkedLast7Days/activeSnapshot.size*100).toFixed(1)}%)`);
  console.log(`   ❌ Over 7 days:  ${staleOver7Days} (${(staleOver7Days/activeSnapshot.size*100).toFixed(1)}%)`);
  console.log(`   ❌ Never checked: ${neverChecked} (${(neverChecked/activeSnapshot.size*100).toFixed(1)}%)`);
  console.log();
  
  // 4. Recent Cron Execution History
  console.log('4️⃣ CRON EXECUTION HISTORY (Last 10 runs)\n');
  
  const cronLogs = await db.collection('cron_logs')
    .orderBy('startedAt', 'desc')
    .limit(20)
    .get();
    
  const fixedCronLogs = cronLogs.docs.filter(doc => 
    doc.data().type === 'refresh-zillow-status'
  ).slice(0, 10);
  
  let successfulRuns = 0;
  let failedRuns = 0;
  let inProgressRuns = 0;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalDeleted = 0;
  let totalDuration = 0;
  let completedCount = 0;
  
  fixedCronLogs.forEach((doc, index) => {
    const data = doc.data();
    const startedAt = data.startedAt?.toDate?.();
    const minutesAgo = startedAt ? 
      Math.floor((now - startedAt.getTime()) / (1000 * 60)) : 0;
    
    console.log(`   Run #${index + 1} (${minutesAgo} min ago):`);
    console.log(`      Status: ${data.status}`);
    
    if (data.status === 'completed') {
      successfulRuns++;
      completedCount++;
      const duration = data.durationMs / 1000;
      totalDuration += duration;
      console.log(`      Duration: ${duration.toFixed(1)}s`);
      
      if (data.results) {
        totalProcessed += data.results.processed || 0;
        totalUpdated += data.results.updated || 0;
        totalDeleted += data.results.deleted || 0;
        console.log(`      Processed: ${data.results.processed}, Updated: ${data.results.updated}, Deleted: ${data.results.deleted}`);
      }
    } else if (data.status === 'failed') {
      failedRuns++;
      console.log(`      ❌ Error: ${data.error}`);
    } else if (data.status === 'started') {
      inProgressRuns++;
      console.log(`      ⏳ Still running...`);
    }
  });
  
  const avgDuration = completedCount > 0 ? (totalDuration / completedCount).toFixed(1) : 0;
  const successRate = fixedCronLogs.length > 0 ? 
    (successfulRuns / fixedCronLogs.length * 100).toFixed(1) : 0;
  
  console.log(`\n   📊 Summary:`);
  console.log(`      Success Rate: ${successRate}% (${successfulRuns}/${fixedCronLogs.length})`);
  console.log(`      Average Duration: ${avgDuration}s`);
  console.log(`      Total Processed: ${totalProcessed} properties`);
  console.log(`      Total Updated: ${totalUpdated} properties`);
  console.log(`      Total Deleted: ${totalDeleted} properties`);
  console.log();
  
  // 5. Most Recent Status Changes
  console.log('5️⃣ RECENT STATUS CHANGES\n');
  
  const recentReports = await db.collection('status_change_reports')
    .orderBy('date', 'desc')
    .limit(5)
    .get();
    
  if (recentReports.empty) {
    console.log('   No recent status change reports found');
  } else {
    recentReports.docs.forEach((doc, index) => {
      const data = doc.data();
      const date = data.date?.toDate?.();
      const minutesAgo = date ? 
        Math.floor((now - date.getTime()) / (1000 * 60)) : 0;
      
      console.log(`   Report #${index + 1} (${minutesAgo} min ago):`);
      console.log(`      Checked: ${data.totalChecked}, Updated: ${data.updated}`);
      console.log(`      Deleted: ${data.deleted}, Deactivated: ${data.deactivated}`);
      console.log(`      Status Changes: ${data.statusChanges}`);
      
      if (data.changes && data.changes.length > 0) {
        console.log(`      Sample changes:`);
        data.changes.slice(0, 2).forEach(change => {
          console.log(`         • ${change.old} → ${change.new}`);
        });
      }
    });
  }
  console.log();
  
  // 6. Cron Configuration Check
  console.log('6️⃣ CRON CONFIGURATION\n');
  console.log(`   📅 Schedule: Every 30 minutes`);
  console.log(`   🔢 Batch Size: 150 properties per run`);
  console.log(`   ⏱️  Max Duration: 300 seconds (5 minutes)`);
  console.log(`   🔄 Full Cycle Time: ${(activeCount.data().count / 150 / 48).toFixed(1)} days`);
  console.log();
  
  // 7. Next Scheduled Run
  console.log('7️⃣ NEXT SCHEDULED RUN\n');
  
  if (fixedCronLogs.length > 0) {
    const lastRun = fixedCronLogs[0].data().startedAt?.toDate?.();
    if (lastRun) {
      const nextRun = new Date(lastRun.getTime() + 30 * 60 * 1000);
      const minutesUntilNext = Math.max(0, Math.floor((nextRun.getTime() - now) / (1000 * 60)));
      console.log(`   ⏰ Next run in: ${minutesUntilNext} minutes`);
      console.log(`   📅 Next run at: ${nextRun.toLocaleString()}`);
    }
  }
  console.log();
  
  // 8. Overall Health Assessment
  console.log('8️⃣ OVERALL HEALTH ASSESSMENT\n');
  
  const healthScore = {
    cronRunning: successRate > 50,
    noProblematic: totalProblematic === 0,
    freshData: (checkedLastHour + checkedLastDay) > activeSnapshot.size * 0.5,
    lowBacklog: neverChecked < 10 && staleOver7Days < activeSnapshot.size * 0.1,
  };
  
  const healthyCount = Object.values(healthScore).filter(v => v).length;
  const healthPercentage = (healthyCount / Object.keys(healthScore).length * 100).toFixed(0);
  
  console.log(`   Overall Health: ${healthPercentage}%`);
  console.log(`   ${healthScore.cronRunning ? '✅' : '❌'} Cron is running successfully`);
  console.log(`   ${healthScore.noProblematic ? '✅' : '❌'} No problematic statuses`);
  console.log(`   ${healthScore.freshData ? '✅' : '❌'} Data is fresh (>50% checked in 24h)`);
  console.log(`   ${healthScore.lowBacklog ? '✅' : '❌'} Low backlog (<10% stale)`);
  
  if (healthPercentage === '100') {
    console.log(`\n   🎉 System is healthy and running perfectly!`);
  } else if (parseInt(healthPercentage) >= 75) {
    console.log(`\n   ✅ System is mostly healthy with minor issues`);
  } else if (parseInt(healthPercentage) >= 50) {
    console.log(`\n   ⚠️ System has some issues that need attention`);
  } else {
    console.log(`\n   ❌ System has critical issues requiring immediate attention`);
  }
  
  console.log('\n' + '=' .repeat(60));
  
  process.exit(0);
}

fullStatusCheck().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});