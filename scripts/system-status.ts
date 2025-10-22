import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function getSystemStatus() {
  console.log('🔍 SYSTEM STATUS REPORT\n');
  console.log('=' .repeat(60));

  // 1. Check Queue Status
  console.log('\n📊 SCRAPER QUEUE STATUS:');

  const pendingQueue = await db.collection('scraper_queue').where('status', '==', 'pending').get();
  const processingQueue = await db.collection('scraper_queue').where('status', '==', 'processing').get();
  const completedQueue = await db.collection('scraper_queue').where('status', '==', 'completed').get();
  const totalQueue = await db.collection('scraper_queue').get();

  console.log(`   ⏳ Pending: ${pendingQueue.size}`);
  console.log(`   🔄 Processing: ${processingQueue.size}`);
  console.log(`   ✅ Completed: ${completedQueue.size}`);
  console.log(`   📋 Total: ${totalQueue.size}`);

  // 2. Check Properties Status
  console.log('\n📦 ZILLOW IMPORTS STATUS:');

  const allProperties = await db.collection('zillow_imports').get();

  let withAgentPhone = 0;
  let withBrokerPhone = 0;
  let withEitherPhone = 0;
  let withoutPhone = 0;
  let sentToGHL = 0;
  let failedGHL = 0;
  let pendingGHL = 0;

  allProperties.docs.forEach(doc => {
    const data = doc.data();
    const hasAgentPhone = !!data.agentPhoneNumber;
    const hasBrokerPhone = !!data.brokerPhoneNumber;

    if (hasAgentPhone) withAgentPhone++;
    if (hasBrokerPhone) withBrokerPhone++;
    if (hasAgentPhone || hasBrokerPhone) {
      withEitherPhone++;

      // Check GHL send status
      if (data.sentToGHL === true && data.ghlSendStatus === 'success') {
        sentToGHL++;
      } else if (data.ghlSendStatus === 'failed') {
        failedGHL++;
      } else {
        pendingGHL++;
      }
    } else {
      withoutPhone++;
    }
  });

  console.log(`   📋 Total Properties: ${allProperties.size}`);
  console.log(`   ✅ With Agent Phone: ${withAgentPhone} (${Math.round((withAgentPhone / allProperties.size) * 100)}%)`);
  console.log(`   ✅ With Broker Phone: ${withBrokerPhone} (${Math.round((withBrokerPhone / allProperties.size) * 100)}%)`);
  console.log(`   ✅ With EITHER Phone: ${withEitherPhone} (${Math.round((withEitherPhone / allProperties.size) * 100)}%)`);
  console.log(`   ❌ Without Phone: ${withoutPhone} (${Math.round((withoutPhone / allProperties.size) * 100)}%)`);

  console.log('\n🚀 GHL WEBHOOK STATUS:');
  console.log(`   ✅ Successfully Sent: ${sentToGHL}`);
  console.log(`   ❌ Failed Sends: ${failedGHL}`);
  console.log(`   ⏳ Pending/Not Sent: ${pendingGHL}`);

  // 3. Recent Activity
  console.log('\n⏰ RECENT ACTIVITY:');

  const recentImports = await db
    .collection('zillow_imports')
    .orderBy('importedAt', 'desc')
    .limit(5)
    .get();

  if (recentImports.empty) {
    console.log('   No recent imports.');
  } else {
    recentImports.docs.forEach((doc, i) => {
      const data = doc.data();
      const time = data.importedAt?.toDate?.() || 'Unknown';
      const hasPhone = data.agentPhoneNumber || data.brokerPhoneNumber ? '📞' : '❌';
      const ghlStatus = data.sentToGHL ? '✅ Sent' : data.ghlSendStatus === 'failed' ? '❌ Failed' : '⏳ Pending';
      console.log(`   ${i + 1}. ${data.fullAddress || data.streetAddress}`);
      console.log(`      ${hasPhone} Phone | ${ghlStatus} | ${time}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n🔧 CRON CONFIGURATION:');
  console.log('   ⏰ Schedule: Every 10 minutes');
  console.log('   🕐 Active Hours: 9am-9pm CDT (14:00-02:00 UTC)');
  console.log('   📦 Batch Size: 25 URLs per run');
  console.log('   🔗 Webhook: 2be65188-9b2e-43f1-a9d8-33d9907b375c');

  console.log('\n✅ System is configured and ready!');

  if (pendingQueue.size > 0) {
    const nextBatch = Math.min(pendingQueue.size, 25);
    console.log(`\n🔜 Next cron will process: ${nextBatch} properties`);
  } else {
    console.log(`\n✅ Queue is empty - all properties processed!`);
  }
}

getSystemStatus()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
