import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function checkWebhookLogs() {
  try {
    console.log('\n📋 Checking Webhook Logs');
    console.log('='.repeat(80));

    // Get today's webhook logs
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logsSnapshot = await db.collection('webhookLogs')
      .limit(100)
      .get();

    console.log(`Total webhook logs: ${logsSnapshot.size}\n`);

    const todaysLogs = logsSnapshot.docs
      .map(doc => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate?.() || data.createdAt?.toDate?.() || new Date();
        return { id: doc.id, data, timestamp };
      })
      .filter(log => log.timestamp >= today)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    console.log(`Logs from today: ${todaysLogs.length}\n`);

    todaysLogs.forEach((log, i) => {
      console.log(`\n${i + 1}. [${log.timestamp.toLocaleString()}]`);
      console.log(`   Type: ${log.data.type || log.data.action || 'unknown'}`);
      console.log(`   Status: ${log.data.status || log.data.success}`);

      if (log.data.propertyId) {
        console.log(`   Property ID: ${log.data.propertyId}`);
      }
      if (log.data.address) {
        console.log(`   Address: ${log.data.address}`);
      }
      if (log.data.matchedBuyers !== undefined) {
        console.log(`   Matched Buyers: ${log.data.matchedBuyers}`);
      }
      if (log.data.notificationsSent !== undefined) {
        console.log(`   Notifications Sent: ${log.data.notificationsSent}`);
      }
      if (log.data.error) {
        console.log(`   ❌ Error: ${log.data.error}`);
      }
      if (log.data.message) {
        console.log(`   Message: ${log.data.message}`);
      }

      // Print full data for debugging
      console.log(`   Raw data keys: ${Object.keys(log.data).join(', ')}`);
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkWebhookLogs();
