import * as admin from 'firebase-admin';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function checkPropertiesStatus() {
  const { db } = getFirebaseAdmin();
  
  console.log('Analyzing property status issues...\n');
  
  // Check properties with sold/pending status but still active
  console.log('1. Checking for properties marked as active but with sold/pending status...\n');
  const wrongStatusSnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .limit(100)
    .get();
    
  const problematicProperties = [];
  wrongStatusSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const status = (data.homeStatus || '').toUpperCase();
    if (['SOLD', 'OFF_MARKET', 'PENDING', 'UNDER_CONTRACT', 'CONTINGENT'].includes(status)) {
      problematicProperties.push({
        id: doc.id,
        address: data.fullAddress || data.address,
        status: status,
        lastCheck: data.lastStatusCheck?.toDate?.(),
        url: data.url || data.hdpUrl
      });
    }
  });
  
  if (problematicProperties.length > 0) {
    console.log(`❌ Found ${problematicProperties.length} active properties with inactive statuses:`);
    problematicProperties.slice(0, 10).forEach(prop => {
      const daysSince = prop.lastCheck ? 
        Math.floor((Date.now() - prop.lastCheck.getTime()) / (1000 * 60 * 60 * 24)) : 
        'Never';
      console.log(`  ID: ${prop.id}`);
      console.log(`    Address: ${prop.address}`);
      console.log(`    Status: ${prop.status}`);
      console.log(`    Last Check: ${daysSince === 'Never' ? 'Never' : `${daysSince} days ago`}`);
      console.log(`    URL: ${prop.url}`);
      console.log('---');
    });
  }
  
  // Check properties that haven't been checked in a long time
  console.log('\n2. Checking properties not checked recently...\n');
  const activePropsSnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .limit(500)
    .get();
    
  const staleProperties = [];
  const neverChecked = [];
  activePropsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const lastCheck = data.lastStatusCheck?.toDate?.();
    
    if (!lastCheck) {
      neverChecked.push({
        id: doc.id,
        address: data.fullAddress || data.address,
        status: data.homeStatus
      });
    } else {
      const daysSince = Math.floor((Date.now() - lastCheck.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince > 7) {
        staleProperties.push({
          id: doc.id,
          address: data.fullAddress || data.address,
          status: data.homeStatus,
          daysSince
        });
      }
    }
  });
  
  console.log(`📊 Out of ${activePropsSnapshot.size} active properties:`);
  console.log(`  - Never checked: ${neverChecked.length}`);
  console.log(`  - Not checked in 7+ days: ${staleProperties.length}`);
  
  if (neverChecked.length > 0) {
    console.log('\nNever checked (first 5):');
    neverChecked.slice(0, 5).forEach(prop => {
      console.log(`  ${prop.address} (${prop.status})`);
    });
  }
  
  if (staleProperties.length > 0) {
    console.log('\nStale properties (first 5):');
    staleProperties.sort((a, b) => b.daysSince - a.daysSince).slice(0, 5).forEach(prop => {
      console.log(`  ${prop.address}: ${prop.daysSince} days ago (${prop.status})`);
    });
  }
  
  // Check recent status_change_reports
  console.log('\n3. Checking recent status change reports...\n');
  const reportsSnapshot = await db.collection('status_change_reports')
    .orderBy('date', 'desc')
    .limit(5)
    .get();
    
  if (!reportsSnapshot.empty) {
    console.log(`Found ${reportsSnapshot.size} recent reports:`);
    reportsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const date = data.date?.toDate?.();
      const age = date ? Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60)) : 0;
      console.log(`  Report from ${age} hours ago:`);
      console.log(`    Checked: ${data.totalChecked}, Updated: ${data.updated}`);
      console.log(`    Deleted: ${data.deleted}, Deactivated: ${data.deactivated}`);
      console.log(`    Status Changes: ${data.statusChanges}`);
    });
  } else {
    console.log('❌ No status change reports found');
  }
  
  // Check cron_logs without composite index
  console.log('\n4. Checking most recent cron log...\n');
  try {
    const cronLogsSnapshot = await db.collection('cron_logs')
      .orderBy('startedAt', 'desc')
      .limit(10)
      .get();
      
    const statusLogs = cronLogsSnapshot.docs.filter(doc => doc.data().type === 'refresh-zillow-status');
    
    if (statusLogs.length > 0) {
      const lastRun = statusLogs[0].data();
      const startedAt = lastRun.startedAt?.toDate?.();
      const hoursAgo = startedAt ? 
        Math.floor((Date.now() - startedAt.getTime()) / (1000 * 60 * 60)) : 0;
      
      console.log(`Last cron run: ${hoursAgo} hours ago`);
      console.log(`  Status: ${lastRun.status}`);
      if (lastRun.error) {
        console.log(`  ❌ Error: ${lastRun.error}`);
      }
      if (lastRun.results) {
        console.log(`  Results:`, lastRun.results);
      }
    } else {
      console.log('❌ No refresh-zillow-status cron logs found');
    }
  } catch (error) {
    console.log('⚠️ Could not check cron_logs (may need index)');
  }
  
  console.log('\n5. Summary of Issues Found:\n');
  console.log('=' .repeat(50));
  if (problematicProperties.length > 0) {
    console.log(`❌ ${problematicProperties.length} properties are marked active but have sold/pending status`);
  }
  if (neverChecked.length > 0) {
    console.log(`❌ ${neverChecked.length} properties have never been checked`);
  }
  if (staleProperties.length > 0) {
    console.log(`⚠️ ${staleProperties.length} properties haven't been checked in 7+ days`);
  }
  
  process.exit(0);
}

checkPropertiesStatus().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});