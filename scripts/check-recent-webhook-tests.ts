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

async function checkRecentTests() {
  console.log('\n🔍 Checking Recent Webhook Test Attempts');
  console.log('='.repeat(80));

  // Get logs from last 10 minutes
  const tenMinutesAgo = new Date();
  tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

  const logsSnapshot = await db.collection('systemLogs')
    .limit(100)
    .get();

  const recentLogs: any[] = [];

  logsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const logDate = data.createdAt?.toDate?.() || new Date(0);

    if (logDate >= tenMinutesAgo) {
      let parsedContext: any = {};
      if (data.context) {
        try {
          parsedContext = typeof data.context === 'string'
            ? JSON.parse(data.context)
            : data.context;
        } catch (e) {
          parsedContext = { raw: data.context };
        }
      }

      const isWebhookLog =
        parsedContext.action?.includes('webhook') ||
        parsedContext.action?.includes('property_created') ||
        parsedContext.action?.includes('property_updated') ||
        data.message?.toLowerCase().includes('webhook');

      if (isWebhookLog) {
        recentLogs.push({ ...data, id: doc.id, parsedContext, timestamp: logDate });
      }
    }
  });

  recentLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  console.log(`\nFound ${recentLogs.length} webhook-related logs in the last 10 minutes\n`);

  if (recentLogs.length === 0) {
    console.log('❌ No recent webhook activity detected');
    console.log('\nPossible reasons:');
    console.log('1. The test requests haven\'t reached the server yet');
    console.log('2. The webhook URL is incorrect');
    console.log('3. GoHighLevel couldn\'t connect to the endpoint');
    console.log('4. Requests are being blocked before reaching the handler');
    return;
  }

  console.log('📋 Recent Webhook Activity:');
  console.log('-'.repeat(80));

  recentLogs.forEach((log, i) => {
    const time = log.timestamp.toLocaleTimeString();
    const action = log.parsedContext?.action || 'unknown';
    const level = log.level || 'info';

    const icon = level === 'error' ? '❌' :
                 level === 'warn' ? '⚠️' :
                 action.includes('authenticated') ? '✅' :
                 action.includes('auth_failed') ? '🚫' :
                 action.includes('created') || action.includes('updated') ? '✅' : '📝';

    console.log(`\n${icon} ${i + 1}. ${time} - ${log.message}`);
    console.log(`   Action: ${action}`);
    console.log(`   Level: ${level}`);

    if (log.parsedContext?.metadata) {
      const meta = log.parsedContext.metadata;

      if (meta.ip) console.log(`   IP: ${meta.ip}`);
      if (meta.opportunityId) console.log(`   Opportunity ID: ${meta.opportunityId}`);
      if (meta.address) console.log(`   Address: ${meta.address}`);
      if (meta.city && meta.state) console.log(`   Location: ${meta.city}, ${meta.state}`);
      if (meta.price) console.log(`   Price: $${meta.price}`);
      if (meta.propertyId) console.log(`   Property ID: ${meta.propertyId}`);

      // Authentication details
      if (action.includes('auth_failed') || action.includes('verification_failed')) {
        console.log(`   ⚠️  AUTH FAILURE DETAILS:`);
        console.log(`      Reason: ${meta.reason || 'Unknown'}`);
        console.log(`      Has Signature: ${meta.hasSignature}`);
        console.log(`      Has Secret: ${meta.hasSecret}`);
      }

      if (action === 'webhook_authenticated') {
        console.log(`   ✅ Authentication: PASSED`);
      }
    }
  });

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  const authenticated = recentLogs.filter(l => l.parsedContext?.action === 'webhook_authenticated');
  const authFailed = recentLogs.filter(l =>
    l.parsedContext?.action?.includes('auth_failed') ||
    l.parsedContext?.action?.includes('verification_failed')
  );
  const created = recentLogs.filter(l => l.parsedContext?.action === 'property_created');
  const updated = recentLogs.filter(l => l.parsedContext?.action === 'property_updated');
  const errors = recentLogs.filter(l => l.level === 'error');

  console.log(`\n✅ Successfully authenticated: ${authenticated.length}`);
  console.log(`🚫 Authentication failed: ${authFailed.length}`);
  console.log(`📝 Properties created: ${created.length}`);
  console.log(`📝 Properties updated: ${updated.length}`);
  console.log(`❌ Errors: ${errors.length}`);

  if (authenticated.length > 0) {
    console.log('\n\n🎉 SUCCESS! Your webhook tests are working!');
    console.log('The webhook is receiving and authenticating requests correctly.');
  } else if (authFailed.length > 0) {
    console.log('\n\n⚠️  AUTHENTICATION ISSUES DETECTED');
    console.log('The webhook is receiving requests but signature verification is failing.');
    console.log('\nCheck:');
    console.log('1. The secret in GoHighLevel matches GHL_WEBHOOK_SECRET in .env.local');
    console.log('2. GoHighLevel is sending the X-GHL-Signature header');
    console.log('3. No extra spaces or characters in the secret');
  } else {
    console.log('\n\n⚠️  Webhook received requests but no authentication logs found');
    console.log('The requests may not have reached the authentication step.');
  }

  console.log('\n' + '='.repeat(80));
}

checkRecentTests().catch(console.error);
