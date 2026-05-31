import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function checkRecentUpdates() {
  const { db } = getFirebaseAdmin();
  
  console.log('📊 Checking for recent property updates...\n');
  
  // Check cron_logs
  const cronLogsSnapshot = await db.collection('cron_logs')
    .orderBy('startedAt', 'desc')
    .limit(10)
    .get();
    
  const fixedCronLogs = cronLogsSnapshot.docs.filter(doc => 
    doc.data().type === 'refresh-zillow-status' && doc.data().version === 'fixed'
  );
  
  console.log(`Found ${fixedCronLogs.length} runs of the fixed cron:\n`);
  
  fixedCronLogs.forEach(doc => {
    const data = doc.data();
    const startedAt = data.startedAt?.toDate?.();
    const completedAt = data.completedAt?.toDate?.();
    const duration = data.durationMs ? (data.durationMs / 1000).toFixed(1) : 'N/A';
    
    console.log(`Run ID: ${doc.id}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Started: ${startedAt ? startedAt.toISOString() : 'N/A'}`);
    console.log(`  Completed: ${completedAt ? completedAt.toISOString() : 'N/A'}`);
    console.log(`  Duration: ${duration}s`);
    
    if (data.batchSize) {
      console.log(`  Batch Size: ${data.batchSize}`);
      console.log(`  Problematic: ${data.problematicCount || 0}`);
      console.log(`  Never Checked: ${data.neverCheckedCount || 0}`);
      console.log(`  Old Checked: ${data.oldCheckedCount || 0}`);
    }
    
    if (data.results) {
      console.log(`  Results:`, data.results);
    }
    
    if (data.error) {
      console.log(`  ❌ Error: ${data.error}`);
    }
    
    console.log('---');
  });
  
  // Check recent status_change_reports
  console.log('\n📊 Checking recent status change reports...\n');
  const reportsSnapshot = await db.collection('status_change_reports')
    .orderBy('date', 'desc')
    .limit(5)
    .get();
    
  reportsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const date = data.date?.toDate?.();
    const minutesAgo = date ? 
      Math.floor((Date.now() - date.getTime()) / (1000 * 60)) : 0;
    
    console.log(`Report from ${minutesAgo} minutes ago:`);
    console.log(`  Checked: ${data.totalChecked}`);
    console.log(`  Updated: ${data.updated}`);
    console.log(`  Deleted: ${data.deleted}`);
    console.log(`  Deactivated: ${data.deactivated}`);
    console.log(`  Status Changes: ${data.statusChanges}`);
    
    if (data.changes && data.changes.length > 0) {
      console.log(`  Sample changes:`);
      data.changes.slice(0, 3).forEach(change => {
        console.log(`    ${change.address}: ${change.old} → ${change.new}`);
      });
    }
    console.log('---');
  });
  
  // Check properties updated in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentlyUpdatedSnapshot = await db.collection('properties')
    .where('lastStatusCheck', '>', oneHourAgo)
    .limit(10)
    .get();
    
  console.log(`\n📊 Properties updated in last hour: ${recentlyUpdatedSnapshot.size}\n`);
  
  if (recentlyUpdatedSnapshot.size > 0) {
    console.log('Sample of recently updated properties:');
    recentlyUpdatedSnapshot.docs.slice(0, 5).forEach(doc => {
      const data = doc.data();
      const lastCheck = data.lastStatusCheck?.toDate?.();
      const minutesAgo = lastCheck ? 
        Math.floor((Date.now() - lastCheck.getTime()) / (1000 * 60)) : 0;
      
      console.log(`  ${data.fullAddress || data.address}`);
      console.log(`    Status: ${data.homeStatus}`);
      console.log(`    Updated: ${minutesAgo} minutes ago`);
      console.log(`    Active: ${data.isActive}`);
    });
  }
  
  process.exit(0);
}

checkRecentUpdates().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});