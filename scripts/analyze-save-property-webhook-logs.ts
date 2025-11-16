import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
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

interface LogEntry {
  id: string;
  level: string;
  message: string;
  context: string;
  createdAt: Timestamp;
  [key: string]: any;
}

async function analyzeSavePropertyWebhookLogs() {
  try {
    console.log('\n🔍 Analyzing save-property webhook logs from the last week');
    console.log('='.repeat(80));

    // Calculate date range - last 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    console.log(`\nQuerying logs from: ${oneWeekAgo.toLocaleString()}`);
    console.log(`                to: ${new Date().toLocaleString()}\n`);

    // Query systemLogs for webhook-related logs
    const logsSnapshot = await db.collection('systemLogs')
      .where('createdAt', '>=', Timestamp.fromDate(oneWeekAgo))
      .get();

    console.log(`Total logs found in last week: ${logsSnapshot.size}\n`);

    // Filter for save-property webhook logs
    const webhookLogs: LogEntry[] = [];
    const suspiciousPatterns: any[] = [];

    logsSnapshot.docs.forEach(doc => {
      const data = doc.data() as LogEntry;
      data.id = doc.id;

      // Parse context if it's a JSON string
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

      // Check if this log is related to save-property webhook
      const isWebhookLog =
        parsedContext.action?.includes('webhook') ||
        parsedContext.action?.includes('property_created') ||
        parsedContext.action?.includes('property_updated') ||
        parsedContext.action?.includes('ghl') ||
        data.message?.toLowerCase().includes('webhook') ||
        data.message?.toLowerCase().includes('gohighlevel');

      if (isWebhookLog) {
        webhookLogs.push({ ...data, parsedContext });
      }
    });

    console.log(`Webhook-related logs: ${webhookLogs.length}\n`);
    console.log('='.repeat(80));

    // Group by action type
    const logsByAction: Record<string, LogEntry[]> = {};
    const ipAddresses = new Set<string>();
    const opportunityIds = new Set<string>();
    const failedAttempts: LogEntry[] = [];
    const malformedRequests: LogEntry[] = [];

    webhookLogs.forEach(log => {
      const action = log.parsedContext?.action || 'unknown';

      if (!logsByAction[action]) {
        logsByAction[action] = [];
      }
      logsByAction[action].push(log);

      // Collect IP addresses if available
      if (log.parsedContext?.metadata?.headers) {
        const headers = log.parsedContext.metadata.headers;
        const ip = headers['x-forwarded-for'] || headers['x-real-ip'];
        if (ip) ipAddresses.add(ip);
      }

      // Collect opportunity IDs
      if (log.parsedContext?.metadata?.opportunityId) {
        opportunityIds.add(log.parsedContext.metadata.opportunityId);
      }

      // Flag failed signature verifications
      if (action === 'webhook_verification_failed' || log.level === 'error') {
        failedAttempts.push(log);
      }

      // Flag validation errors
      if (action === 'webhook_validation_error' || action === 'missing_opportunity_id') {
        malformedRequests.push(log);
      }
    });

    // Print summary by action
    console.log('\n📊 Logs by Action Type:');
    console.log('-'.repeat(80));
    Object.entries(logsByAction)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([action, logs]) => {
        console.log(`\n${action}: ${logs.length} occurrences`);

        // Show first few examples
        logs.slice(0, 3).forEach((log, i) => {
          const timestamp = log.createdAt?.toDate?.() || new Date();
          console.log(`  ${i + 1}. ${timestamp.toLocaleString()} - ${log.message}`);
          if (log.parsedContext?.metadata?.address || log.parsedContext?.metadata?.opportunityId) {
            console.log(`     OpportunityID: ${log.parsedContext.metadata.opportunityId || 'N/A'}`);
            console.log(`     Address: ${log.parsedContext.metadata.address || 'N/A'}`);
          }
        });
      });

    // Analyze for suspicious patterns
    console.log('\n\n🚨 SUSPICIOUS ACTIVITY ANALYSIS');
    console.log('='.repeat(80));

    let suspiciousCount = 0;

    // 1. Check for unusual number of requests
    const requestsPerDay: Record<string, number> = {};
    webhookLogs.forEach(log => {
      const date = log.createdAt?.toDate?.().toLocaleDateString() || 'unknown';
      requestsPerDay[date] = (requestsPerDay[date] || 0) + 1;
    });

    console.log('\n1. Requests per day:');
    Object.entries(requestsPerDay)
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .forEach(([date, count]) => {
        const isUnusual = count > 100; // Flag if more than 100 requests per day
        console.log(`   ${date}: ${count} requests ${isUnusual ? '⚠️  UNUSUALLY HIGH' : ''}`);
        if (isUnusual) suspiciousCount++;
      });

    // 2. Failed signature verifications
    console.log(`\n2. Failed signature verifications: ${failedAttempts.length}`);
    if (failedAttempts.length > 0) {
      suspiciousCount++;
      console.log('   ⚠️  SUSPICIOUS: Unauthorized webhook attempts detected');
      failedAttempts.slice(0, 5).forEach((log, i) => {
        const timestamp = log.createdAt?.toDate?.() || new Date();
        console.log(`   ${i + 1}. ${timestamp.toLocaleString()}`);
        console.log(`      Message: ${log.message}`);
        if (log.parsedContext?.metadata?.headers) {
          const headers = log.parsedContext.metadata.headers;
          console.log(`      IP: ${headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown'}`);
          console.log(`      User-Agent: ${headers['user-agent'] || 'unknown'}`);
        }
      });
    } else {
      console.log('   ✅ No failed signature verifications');
    }

    // 3. Malformed requests
    console.log(`\n3. Malformed/Invalid requests: ${malformedRequests.length}`);
    if (malformedRequests.length > 5) {
      suspiciousCount++;
      console.log('   ⚠️  SUSPICIOUS: High number of malformed requests');
      malformedRequests.slice(0, 5).forEach((log, i) => {
        const timestamp = log.createdAt?.toDate?.() || new Date();
        console.log(`   ${i + 1}. ${timestamp.toLocaleString()}: ${log.message}`);
      });
    } else if (malformedRequests.length > 0) {
      console.log('   ⚠️  Some malformed requests found (may be normal)');
    } else {
      console.log('   ✅ No malformed requests');
    }

    // 4. Check for rapid-fire requests (same IP within short time)
    console.log(`\n4. Unique IP addresses: ${ipAddresses.size}`);
    if (ipAddresses.size > 0) {
      console.log('   IPs detected:');
      Array.from(ipAddresses).slice(0, 10).forEach(ip => {
        console.log(`   - ${ip}`);
      });
    }

    // 5. Check for duplicate/spam properties
    const propertiesCreated = logsByAction['property_created'] || [];
    const propertiesUpdated = logsByAction['property_updated'] || [];
    console.log(`\n5. Property operations:`);
    console.log(`   Properties created: ${propertiesCreated.length}`);
    console.log(`   Properties updated: ${propertiesUpdated.length}`);
    console.log(`   Unique opportunity IDs: ${opportunityIds.size}`);

    const updateToCreateRatio = propertiesCreated.length > 0
      ? propertiesUpdated.length / propertiesCreated.length
      : 0;

    if (updateToCreateRatio > 10) {
      suspiciousCount++;
      console.log(`   ⚠️  SUSPICIOUS: Very high update-to-create ratio (${updateToCreateRatio.toFixed(1)}x)`);
    }

    // 6. Look for error patterns
    const errorLogs = webhookLogs.filter(log => log.level === 'error');
    console.log(`\n6. Error logs: ${errorLogs.length}`);
    if (errorLogs.length > 20) {
      suspiciousCount++;
      console.log('   ⚠️  SUSPICIOUS: High number of errors');
      const errorMessages = new Map<string, number>();
      errorLogs.forEach(log => {
        const msg = log.message.substring(0, 100);
        errorMessages.set(msg, (errorMessages.get(msg) || 0) + 1);
      });
      console.log('   Top errors:');
      Array.from(errorMessages.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([msg, count]) => {
          console.log(`   - ${msg}... (${count}x)`);
        });
    } else if (errorLogs.length > 0) {
      console.log('   Some errors found (may be normal)');
    } else {
      console.log('   ✅ No errors');
    }

    // 7. Check for unusual data patterns
    console.log(`\n7. Checking for unusual data patterns...`);
    const addresses = new Set<string>();
    const cities = new Set<string>();
    const states = new Set<string>();

    [...propertiesCreated, ...propertiesUpdated].forEach(log => {
      const metadata = log.parsedContext?.metadata;
      if (metadata) {
        if (metadata.address) addresses.add(metadata.address);
        if (metadata.city) cities.add(metadata.city);
        if (metadata.state) states.add(metadata.state);
      }
    });

    console.log(`   Unique addresses: ${addresses.size}`);
    console.log(`   Unique cities: ${cities.size}`);
    console.log(`   Unique states: ${states.size}`);

    // If we see many properties but few unique addresses, might be spam
    if (propertiesCreated.length > 20 && addresses.size < 5) {
      suspiciousCount++;
      console.log('   ⚠️  SUSPICIOUS: Many property creations but few unique addresses');
    }

    // Final summary
    console.log('\n\n' + '='.repeat(80));
    console.log('🎯 FINAL ASSESSMENT');
    console.log('='.repeat(80));

    if (suspiciousCount === 0) {
      console.log('\n✅ NO SUSPICIOUS ACTIVITY DETECTED');
      console.log('All webhook activity appears normal.');
    } else {
      console.log(`\n⚠️  ${suspiciousCount} SUSPICIOUS PATTERNS DETECTED`);
      console.log('Review the findings above for potential security issues.');
    }

    console.log(`\nTotal webhook logs analyzed: ${webhookLogs.length}`);
    console.log(`Date range: ${oneWeekAgo.toLocaleDateString()} - ${new Date().toLocaleDateString()}`);

  } catch (error) {
    console.error('❌ Error analyzing logs:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

analyzeSavePropertyWebhookLogs();
