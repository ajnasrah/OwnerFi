import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

async function checkWebhookPayload() {
  try {
    console.log('\n🔍 Checking actual webhook payload data...\n');
    console.log('='.repeat(80));

    const logsSnapshot = await db.collection('systemLogs')
      .limit(2000)
      .get();

    const webhookParsedLogs: any[] = [];

    logsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      let parsedContext: any = {};

      if (data.context) {
        try {
          parsedContext = typeof data.context === 'string' ? JSON.parse(data.context) : data.context;
        } catch (e) {
          parsedContext = { raw: data.context };
        }
      }

      if (parsedContext.action === 'webhook_parsed') {
        const timestamp = data.createdAt?.toDate?.() || new Date();
        webhookParsedLogs.push({
          timestamp,
          ...parsedContext.metadata
        });
      }
    });

    if (webhookParsedLogs.length === 0) {
      console.log('❌ No webhook_parsed logs found');
      return;
    }

    // Sort by most recent
    webhookParsedLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    console.log(`\n📦 Found ${webhookParsedLogs.length} webhook payloads\n`);
    console.log('='.repeat(80));

    // Show the 5 most recent
    webhookParsedLogs.slice(0, 5).forEach((log, index) => {
      console.log(`\n${index + 1}. WEBHOOK PAYLOAD`);
      console.log('-'.repeat(80));
      console.log(`⏰ Time: ${log.timestamp.toLocaleString()}`);
      console.log(`🏠 Address: ${log.address || 'N/A'}`);
      console.log(`🏙️  City: ${log.city || 'N/A'}`);
      console.log(`💰 Price: ${log.price || 'N/A'}`);
      console.log(`🆔 Opportunity ID: ${log.opportunityId || 'N/A'}`);

      console.log(`\n📊 Financial Data Received:`);
      console.log(`   - Has Description: ${log.hasDescription ? '✅ Yes' : '❌ No'}`);
      console.log(`   - Description Length: ${log.descriptionLength || 0} characters`);
      console.log(`   - Description Source: ${log.descriptionSource || 'N/A'}`);

      // Show all fields in the log
      console.log(`\n📋 All Fields Received:`);
      Object.entries(log)
        .filter(([key]) => !['timestamp'].includes(key))
        .forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
    });

    console.log('\n\n' + '='.repeat(80));
    console.log('🔍 LOOKING FOR VALIDATION REJECTION AFTER PARSING...');
    console.log('='.repeat(80));

    // Now find rejections that match these payloads
    const rejections: any[] = [];
    logsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      let parsedContext: any = {};

      if (data.context) {
        try {
          parsedContext = typeof data.context === 'string' ? JSON.parse(data.context) : data.context;
        } catch (e) {}
      }

      if (parsedContext.action === 'property_validation_rejected') {
        const timestamp = data.createdAt?.toDate?.() || new Date();
        rejections.push({
          timestamp,
          address: parsedContext.metadata?.address,
          opportunityId: parsedContext.metadata?.opportunityId,
          issues: parsedContext.metadata?.issues || []
        });
      }
    });

    if (rejections.length > 0) {
      console.log(`\n❌ Found ${rejections.length} rejections`);

      rejections.slice(0, 3).forEach((rej, i) => {
        console.log(`\n${i + 1}. ${rej.address}`);
        console.log(`   Time: ${rej.timestamp.toLocaleString()}`);
        console.log(`   Issues:`);
        rej.issues.forEach((issue: any) => {
          console.log(`      - ${issue.field}: ${issue.issue} (${issue.actualValue})`);
        });
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkWebhookPayload();
