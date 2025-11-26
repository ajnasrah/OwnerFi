import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = admin.firestore();

async function diagnose() {
  console.log('🔍 DIAGNOSING GHL PIPELINE\n');

  // 1. Check zillow_imports with foundAt in last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentImports = await db.collection('zillow_imports')
    .where('foundAt', '>=', weekAgo)
    .orderBy('foundAt', 'desc')
    .limit(20)
    .get();

  console.log('🏠 RECENT ZILLOW IMPORTS (last 7 days):');
  let withGHL = 0;
  let withoutGHL = 0;

  recentImports.docs.forEach(doc => {
    const data = doc.data();
    const sentToGHL = data.sentToGHL === true;
    if (sentToGHL) withGHL++;
    else withoutGHL++;

    console.log(`  - ${data.fullAddress || data.streetAddress}`);
    console.log(`    Found: ${data.foundAt?.toDate?.()?.toLocaleString() || 'unknown'}`);
    console.log(`    Sent to GHL: ${sentToGHL ? '✅' : '❌'}`);
    console.log(`    Agent: ${data.agentName || 'N/A'} | ${data.agentPhoneNumber || 'N/A'}`);
    console.log('');
  });

  console.log(`\n📊 SUMMARY (last 7 days):`);
  console.log(`  ✅ Sent to GHL: ${withGHL}`);
  console.log(`  ❌ Not sent to GHL: ${withoutGHL}`);

  // 2. Check total zillow_imports not sent to GHL
  const allNotSent = await db.collection('zillow_imports')
    .where('homeStatus', '==', 'FOR_SALE')
    .limit(500)
    .get();

  let totalNotSent = 0;
  let hasContactNotSent = 0;

  allNotSent.docs.forEach(doc => {
    const data = doc.data();
    if (data.sentToGHL !== true) {
      totalNotSent++;
      if (data.agentPhoneNumber || data.brokerPhoneNumber) {
        hasContactNotSent++;
      }
    }
  });

  console.log(`\n📤 FOR_SALE PROPERTIES NOT SENT TO GHL:`);
  console.log(`  Total not sent: ${totalNotSent}`);
  console.log(`  With contact info: ${hasContactNotSent}`);
  console.log(`  (These could be sent via admin panel)`);

  // 3. Check scraper_queue pending items
  const pendingQueue = await db.collection('scraper_queue')
    .where('status', '==', 'pending')
    .limit(10)
    .get();

  console.log(`\n📋 SCRAPER QUEUE - PENDING ITEMS: ${pendingQueue.size}`);

  process.exit(0);
}

diagnose().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
