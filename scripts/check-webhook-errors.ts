/**
 * Check webhook logs for detailed error information
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PROPERTY_ID = 'memphis-test-1762987638709';

async function checkWebhookErrors() {
  console.log('🔍 Checking webhook error details');
  console.log('==================================\n');

  try {
    // Get webhook logs for this property
    const logsQuery = query(
      collection(db, 'webhookLogs'),
      where('propertyId', '==', PROPERTY_ID),
      orderBy('createdAt', 'desc')
    );

    const logsSnapshot = await getDocs(logsQuery);

    if (logsSnapshot.empty) {
      console.log('❌ No webhook logs found!');
      return;
    }

    console.log(`Found ${logsSnapshot.size} webhook logs:\n`);

    for (const logDoc of logsSnapshot.docs) {
      const log = logDoc.data();
      const payload = log.payload || {};

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 Log ID: ${logDoc.id}`);
      console.log(`   Status: ${log.status}`);
      console.log(`   Buyer: ${payload.buyerName} (${payload.buyerPhone})`);
      console.log(`   Property: ${payload.propertyAddress}`);

      if (log.createdAt) {
        const timestamp = log.createdAt.toDate ? log.createdAt.toDate() : new Date(log.createdAt.seconds * 1000);
        console.log(`   Created: ${timestamp.toLocaleString()}`);
      }

      if (log.sentAt) {
        console.log(`   Sent: ${log.sentAt}`);
      }

      if (log.errorMessage) {
        console.log(`\n   ❌ ERROR: ${log.errorMessage}`);
      }

      if (log.goHighLevelResponse) {
        console.log(`\n   📤 GoHighLevel Response:`);
        console.log(`   ${JSON.stringify(log.goHighLevelResponse, null, 2)}`);
      }

      if (log.processingTimeMs) {
        console.log(`\n   ⏱️  Processing time: ${log.processingTimeMs}ms`);
      }

      // Show the full payload for debugging
      console.log(`\n   📨 Payload sent to GoHighLevel:`);
      console.log(`      Trigger: ${payload.trigger}`);
      console.log(`      Dashboard URL: ${payload.dashboardUrl}`);
      console.log(`      Buyer Max Monthly: $${payload.buyerMaxMonthlyPayment}`);
      console.log(`      Property Monthly: $${payload.monthlyPayment}`);
      console.log(`      Buyer Max Down: $${payload.buyerMaxDownPayment}`);
      console.log(`      Property Down: $${payload.downPaymentAmount}`);

      console.log('');
    }

    console.log('==================================');
    console.log('\n💡 Next Steps:');

    const allPending = logsSnapshot.docs.every(doc => doc.data().status === 'pending');

    if (allPending) {
      console.log('\n⚠️  All notifications are stuck in "pending" status!');
      console.log('\nThis means the GoHighLevel webhook call was NEVER made.');
      console.log('The notification logic may have an error.\n');
      console.log('Checking the code path...\n');

      // Check if GOHIGHLEVEL_WEBHOOK_URL is set
      const webhookUrl = process.env.GOHIGHLEVEL_WEBHOOK_URL;
      if (!webhookUrl) {
        console.log('❌ GOHIGHLEVEL_WEBHOOK_URL is NOT set in environment!');
        console.log('   Set it in Vercel environment variables.');
      } else {
        console.log(`✅ GOHIGHLEVEL_WEBHOOK_URL is set: ${webhookUrl.substring(0, 50)}...`);
        console.log('\n🔍 The webhook URL is configured, but the status is still pending.');
        console.log('   This means the webhook endpoint may not be updating the status correctly.');
        console.log('\n   Possible causes:');
        console.log('   1. The webhook endpoint code has a bug');
        console.log('   2. The serverTimestamp() may not be working');
        console.log('   3. The updateDoc() call may be failing silently');
      }
    }

  } catch (error) {
    console.error('❌ Error:');
    console.error(error);
  }
}

// Run the check
checkWebhookErrors().catch(console.error);
