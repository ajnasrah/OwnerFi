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

async function analyzeWebhookLogs() {
  try {
    console.log('\n📋 Analyzing webhookLogs Collection');
    console.log('='.repeat(80));

    const logsSnapshot = await db.collection('webhookLogs')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    console.log(`\nTotal logs found: ${logsSnapshot.size}\n`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    logsSnapshot.docs.forEach((doc, i) => {
      const data = doc.data();
      const timestamp = data.createdAt?.toDate() || data.sentAt?.toDate() || new Date();
      const isToday = timestamp >= today;

      console.log(`\n${i + 1}. ${isToday ? '🆕 TODAY' : '📅 ' + timestamp.toLocaleDateString()}`);
      console.log(`   Time: ${timestamp.toLocaleString()}`);
      console.log(`   Type: ${data.type || 'unknown'}`);
      console.log(`   Status: ${data.status || 'unknown'}`);
      console.log(`   Property ID: ${data.propertyId || 'N/A'}`);
      console.log(`   Buyer Phone: ${data.buyerPhone || 'N/A'}`);

      if (data.goHighLevelResponse) {
        console.log(`   GHL Response: ${JSON.stringify(data.goHighLevelResponse).substring(0, 100)}`);
      }

      if (data.processingTimeMs) {
        console.log(`   Processing Time: ${data.processingTimeMs}ms`);
      }

      // Show all fields for debugging
      console.log(`   All fields: ${Object.keys(data).join(', ')}`);
    });

    // Check today specifically
    const todayLogs = logsSnapshot.docs.filter(doc => {
      const data = doc.data();
      const timestamp = data.createdAt?.toDate() || data.sentAt?.toDate() || new Date();
      return timestamp >= today;
    });

    console.log('\n\n📊 Summary');
    console.log('='.repeat(80));
    console.log(`Total logs: ${logsSnapshot.size}`);
    console.log(`Logs from today: ${todayLogs.length}`);

    if (todayLogs.length === 0) {
      console.log('\n❌ NO LOGS FROM TODAY');
      console.log('\nThis confirms that:');
      console.log('1. The notification sending code in save-property/route.ts does NOT log to webhookLogs');
      console.log('2. OR the notification sending failed before logging');
      console.log('3. OR the webhook logs are created elsewhere in the codebase');
      console.log('\nLet me search the codebase for where webhookLogs are created...');

      // Check where webhookLogs are written
      console.log('\n\n🔍 Checking sample log structure from Nov 12:');
      if (logsSnapshot.size > 0) {
        const sampleLog = logsSnapshot.docs[0].data();
        console.log(JSON.stringify(sampleLog, null, 2).substring(0, 1000));
      }
    }

  } catch (error) {
    console.error('Error:', error);
    if (error instanceof Error && error.message.includes('index')) {
      console.log('\n⚠️  Need to create Firestore index. Retrying without orderBy...');

      // Retry without ordering
      const logsSnapshot = await db.collection('webhookLogs')
        .limit(20)
        .get();

      console.log(`\nFound ${logsSnapshot.size} logs (unordered):`);

      logsSnapshot.docs.forEach((doc, i) => {
        const data = doc.data();
        console.log(`\n${i + 1}. ${doc.id}`);
        console.log(`   Fields: ${Object.keys(data).join(', ')}`);
        if (data.createdAt) {
          console.log(`   Created: ${data.createdAt.toDate?.()?.toLocaleString() || data.createdAt}`);
        }
      });
    } else {
      process.exit(1);
    }
  }
}

analyzeWebhookLogs();
