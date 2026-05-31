import * as admin from 'firebase-admin';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';

async function checkCronStatus() {
  const { db } = getFirebaseAdmin();
  
  console.log('Checking cron status logs...\n');
  
  // Check recent cron_logs
  const logsSnapshot = await db.collection('cron_logs')
    .where('type', '==', 'refresh-zillow-status')
    .orderBy('startedAt', 'desc')
    .limit(5)
    .get();
  
  if (logsSnapshot.empty) {
    console.log('❌ No cron logs found');
  } else {
    console.log(`Found ${logsSnapshot.size} recent cron runs:\n`);
    logsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`Run ID: ${doc.id}`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Started: ${data.startedAt?.toDate?.()}`);
      console.log(`  Completed: ${data.completedAt?.toDate?.() || 'N/A'}`);
      if (data.error) console.log(`  ❌ Error: ${data.error}`);
      if (data.results) {
        console.log(`  Results:`, data.results);
      }
      console.log('---');
    });
  }
  
  // Check recent status_change_reports
  console.log('\nChecking recent status change reports...\n');
  const reportsSnapshot = await db.collection('status_change_reports')
    .orderBy('date', 'desc')
    .limit(3)
    .get();
    
  if (!reportsSnapshot.empty) {
    reportsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`Report from: ${data.date?.toDate?.()}`);
      console.log(`  Checked: ${data.totalChecked}`);
      console.log(`  Updated: ${data.updated}`);
      console.log(`  Deleted: ${data.deleted}`);
      console.log(`  Deactivated: ${data.deactivated}`);
      console.log(`  Status Changes: ${data.statusChanges}`);
      console.log('---');
    });
  }
  
  // Check sample of properties that should be updated
  console.log('\nChecking properties that haven\'t been checked recently...\n');
  const stalePropertiesSnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .orderBy('lastStatusCheck', 'asc')
    .limit(10)
    .get();
    
  if (!stalePropertiesSnapshot.empty) {
    console.log(`Found ${stalePropertiesSnapshot.size} properties with old/missing status checks:`);
    stalePropertiesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const lastCheck = data.lastStatusCheck?.toDate?.();
      const daysSince = lastCheck ? 
        Math.floor((Date.now() - lastCheck.getTime()) / (1000 * 60 * 60 * 24)) : 
        'Never';
      
      console.log(`  ${data.fullAddress || data.address}`);
      console.log(`    Status: ${data.homeStatus}`);
      console.log(`    Last Check: ${daysSince === 'Never' ? 'Never' : `${daysSince} days ago`}`);
    });
  }
  
  // Check properties with wrong status
  console.log('\nChecking for properties that might have wrong status...\n');
  const suspectPropertiesSnapshot = await db.collection('properties')
    .where('homeStatus', 'in', ['SOLD', 'OFF_MARKET', 'PENDING', 'UNDER_CONTRACT'])
    .where('isActive', '==', true)
    .limit(5)
    .get();
    
  if (!suspectPropertiesSnapshot.empty) {
    console.log(`⚠️ Found ${suspectPropertiesSnapshot.size} active properties with inactive statuses:`);
    suspectPropertiesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  ${data.fullAddress || data.address}`);
      console.log(`    Status: ${data.homeStatus} (but isActive: true)`);
      console.log(`    URL: ${data.url}`);
    });
  }
  
  process.exit(0);
}

checkCronStatus().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});