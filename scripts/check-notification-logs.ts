/**
 * Check the webhookLogs collection to verify notifications were sent
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
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

async function checkNotificationLogs() {
  console.log('📋 Checking webhook notification logs');
  console.log('=====================================\n');

  try {
    // Get recent webhook logs
    const logsQuery = query(
      collection(db, 'webhookLogs'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const logsSnapshot = await getDocs(logsQuery);

    if (logsSnapshot.empty) {
      console.log('⚠️  No webhook logs found!');
      console.log('   This could mean:');
      console.log('   1. The buyer matching endpoint wasn\'t called');
      console.log('   2. No matching buyers were found');
      console.log('   3. GOHIGHLEVEL_WEBHOOK_URL is not configured\n');
      return;
    }

    console.log(`Found ${logsSnapshot.size} recent webhook logs:\n`);

    let successCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    let floweringPeachCount = 0;

    for (const doc of logsSnapshot.docs) {
      const log = doc.data();
      const logId = doc.id;
      const payload = log.payload || {};

      // Check if this is for the Flowering Peach property
      const isFloweringPeach = payload.propertyAddress?.includes('Flowering Peach');

      if (isFloweringPeach) {
        floweringPeachCount++;
      }

      const statusEmoji = log.status === 'sent' ? '✅' : log.status === 'failed' ? '❌' : '⏳';

      console.log(`${statusEmoji} [${log.status?.toUpperCase()}] ${logId.substring(0, 12)}...`);
      console.log(`   Property: ${payload.propertyAddress || 'Unknown'}, ${payload.propertyCity || 'Unknown'}`);
      console.log(`   Buyer: ${payload.buyerName || 'Unknown'} (${payload.buyerPhone || 'N/A'})`);
      console.log(`   Trigger: ${payload.trigger || 'Unknown'}`);

      if (log.status === 'sent') {
        successCount++;
        console.log(`   ✓ Sent at: ${log.sentAt || 'Unknown'}`);
      } else if (log.status === 'failed') {
        failedCount++;
        console.log(`   ✗ Error: ${log.errorMessage || 'Unknown error'}`);
      } else {
        pendingCount++;
      }

      if (isFloweringPeach) {
        console.log(`   🌸 THIS IS FOR 5284 FLOWERING PEACH!`);
      }

      // Log time info
      if (log.createdAt) {
        const timestamp = log.createdAt.toDate ? log.createdAt.toDate() : new Date(log.createdAt.seconds * 1000);
        const now = new Date();
        const minutesAgo = Math.floor((now.getTime() - timestamp.getTime()) / 1000 / 60);
        console.log(`   Created: ${minutesAgo} minute(s) ago`);
      }

      console.log('');
    }

    console.log('=====================================');
    console.log('📊 Summary:');
    console.log(`   Total logs: ${logsSnapshot.size}`);
    console.log(`   Sent: ${successCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log(`   Pending: ${pendingCount}`);
    console.log(`   For Flowering Peach: ${floweringPeachCount}`);

    if (floweringPeachCount === 0) {
      console.log('\n⚠️  No notifications found for 5284 Flowering Peach!');
      console.log('   Check the server logs to see if buyer matching was triggered.');
    } else if (floweringPeachCount < 6) {
      console.log(`\n⚠️  Expected 6 notifications but found ${floweringPeachCount}!`);
      console.log('   Some buyers may not have been notified.');
    } else {
      console.log('\n✅ All expected notifications were logged!');
    }

    if (failedCount > 0) {
      console.log('\n⚠️  Some notifications failed!');
      console.log('   Common reasons:');
      console.log('   - GOHIGHLEVEL_WEBHOOK_URL not configured');
      console.log('   - GoHighLevel API returned an error');
      console.log('   - Network connectivity issues');
    }

  } catch (error) {
    console.error('❌ Error checking logs:');
    console.error(error);
  }
}

// Run the check
checkNotificationLogs().catch(console.error);
