import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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

async function checkLatestWebhookActivity() {
  try {
    console.log('\n🔍 Checking LATEST webhook activity (last 10 minutes)...\n');
    console.log('='.repeat(80));

    const tenMinutesAgo = new Date();
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

    console.log(`Current time: ${new Date().toLocaleString()}`);
    console.log(`Looking for logs after: ${tenMinutesAgo.toLocaleString()}\n`);

    const logsSnapshot = await db.collection('systemLogs')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    console.log(`Total logs fetched: ${logsSnapshot.size}\n`);

    const recentLogs: any[] = [];

    logsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const timestamp = data.createdAt?.toDate?.() || new Date(0);

      if (timestamp < tenMinutesAgo) return;

      let parsedContext: any = {};
      if (data.context) {
        try {
          parsedContext = typeof data.context === 'string' ? JSON.parse(data.context) : data.context;
        } catch (e) {}
      }

      recentLogs.push({
        timestamp,
        level: data.level,
        message: data.message,
        action: parsedContext.action,
        metadata: parsedContext.metadata
      });
    });

    if (recentLogs.length === 0) {
      console.log('❌ NO RECENT LOGS found in the last 10 minutes');
      console.log('\nThis means:');
      console.log('1. Your webhook is not reaching the server at all');
      console.log('2. OR logging is broken');
      console.log('3. OR you are using a different endpoint that doesn\'t log');

      console.log('\n📋 Last 5 logs overall:');
      logsSnapshot.docs.slice(0, 5).forEach((doc, i) => {
        const data = doc.data();
        const timestamp = data.createdAt?.toDate?.() || new Date();
        console.log(`${i + 1}. ${timestamp.toLocaleString()}: ${data.message?.substring(0, 80)}`);
      });

      return;
    }

    console.log(`✅ Found ${recentLogs.length} logs in the last 10 minutes\n`);
    console.log('='.repeat(80));

    // Group by action
    const webhookLogs = recentLogs.filter(log =>
      log.action?.includes('webhook') ||
      log.message?.toLowerCase().includes('webhook') ||
      log.message?.toLowerCase().includes('property')
    );

    if (webhookLogs.length > 0) {
      console.log(`\n🎯 WEBHOOK-RELATED LOGS (${webhookLogs.length}):\n`);

      webhookLogs.forEach((log, i) => {
        console.log(`${i + 1}. [${log.timestamp.toLocaleTimeString()}] ${log.level?.toUpperCase()}`);
        console.log(`   Action: ${log.action || 'N/A'}`);
        console.log(`   Message: ${log.message}`);

        if (log.metadata) {
          if (log.metadata.address) console.log(`   Address: ${log.metadata.address}`);
          if (log.metadata.opportunityId) console.log(`   Opportunity ID: ${log.metadata.opportunityId}`);
          if (log.metadata.ip) console.log(`   IP: ${log.metadata.ip}`);
          if (log.metadata.reason) console.log(`   Reason: ${log.metadata.reason}`);
          if (log.metadata.errors) console.log(`   Errors: ${log.metadata.errors.join(', ')}`);
          if (log.metadata.issues) {
            console.log(`   Validation Issues:`);
            log.metadata.issues.slice(0, 3).forEach((issue: any) => {
              console.log(`      - ${issue.field}: ${issue.issue}`);
            });
          }
        }
        console.log('');
      });
    } else {
      console.log('\n📋 NON-WEBHOOK LOGS (last 10):');
      recentLogs.slice(0, 10).forEach((log, i) => {
        console.log(`${i + 1}. [${log.timestamp.toLocaleTimeString()}] ${log.message?.substring(0, 100)}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkLatestWebhookActivity();
