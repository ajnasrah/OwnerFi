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
    console.log('\n🔍 Analyzing save-property webhook logs');
    console.log('='.repeat(80));
    console.log('Note: Fetching logs without date filter due to potential index limitations');

    // Calculate date range - last 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    console.log(`\nTarget date range: ${oneWeekAgo.toLocaleString()} to ${new Date().toLocaleString()}`);

    // Query systemLogs without date filter (to avoid index requirement)
    // Limit to recent logs
    console.log('\nFetching recent logs from Firestore...\n');
    const logsSnapshot = await db.collection('systemLogs')
      .limit(5000)  // Get last 5000 logs
      .get();

    console.log(`Total logs fetched: ${logsSnapshot.size}\n`);

    // Filter and analyze
    const webhookLogs: LogEntry[] = [];
    const allLogs: LogEntry[] = [];

    logsSnapshot.docs.forEach(doc => {
      const data = doc.data() as LogEntry;
      data.id = doc.id;

      // Check if within our date range
      const logDate = data.createdAt?.toDate?.() || new Date(0);
      if (logDate < oneWeekAgo) {
        return; // Skip logs older than a week
      }

      allLogs.push(data);

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
        data.message?.toLowerCase().includes('gohighlevel') ||
        data.message?.toLowerCase().includes('save property');

      if (isWebhookLog) {
        webhookLogs.push({ ...data, parsedContext });
      }
    });

    console.log(`Logs within date range: ${allLogs.length}`);
    console.log(`Webhook-related logs: ${webhookLogs.length}\n`);
    console.log('='.repeat(80));

    if (webhookLogs.length === 0) {
      console.log('\n❌ No webhook logs found in the last week!');
      console.log('This could mean:');
      console.log('1. The webhook has not been called');
      console.log('2. Logging is not working properly');
      console.log('3. Logs are stored elsewhere');
      console.log('\nLet me check if there are ANY recent logs at all...\n');

      if (allLogs.length === 0) {
        console.log('❌ No logs found in the last week - logging system may not be working!');
      } else {
        console.log(`✅ Found ${allLogs.length} other logs, so logging is working`);
        console.log('\nSample of recent log messages:');
        allLogs.slice(0, 10).forEach((log, i) => {
          const timestamp = log.createdAt?.toDate?.() || new Date();
          console.log(`${i + 1}. ${timestamp.toLocaleString()}: ${log.message.substring(0, 80)}`);
        });
      }
      return;
    }

    // Group by action type
    const logsByAction: Record<string, LogEntry[]> = {};
    const ipAddresses = new Set<string>();
    const opportunityIds = new Set<string>();
    const failedAttempts: LogEntry[] = [];
    const malformedRequests: LogEntry[] = [];
    const verificationPassed: LogEntry[] = [];

    webhookLogs.forEach(log => {
      const action = log.parsedContext?.action || 'unknown';

      if (!logsByAction[action]) {
        logsByAction[action] = [];
      }
      logsByAction[action].push(log);

      // Collect IP addresses if available
      if (log.parsedContext?.metadata?.headers) {
        const headers = log.parsedContext.metadata.headers;
        const ip = headers['x-forwarded-for'] || headers['x-real-ip'] || headers['x-forwarded-for'];
        if (ip) ipAddresses.add(ip);
      }

      // Collect opportunity IDs
      if (log.parsedContext?.metadata?.opportunityId) {
        opportunityIds.add(log.parsedContext.metadata.opportunityId);
      }

      // Flag failed signature verifications
      if (action === 'webhook_verification_failed') {
        failedAttempts.push(log);
      }

      // Track successful webhook receives
      if (action === 'webhook_received_raw') {
        verificationPassed.push(log);
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
            console.log(`     Price: ${log.parsedContext.metadata.price || 'N/A'}`);
          }
        });
      });

    // Analyze for suspicious patterns
    console.log('\n\n🚨 SUSPICIOUS ACTIVITY ANALYSIS');
    console.log('='.repeat(80));

    let suspiciousCount = 0;
    const findings: string[] = [];

    // 1. Check for unusual number of requests
    const requestsPerDay: Record<string, number> = {};
    const requestsByHour: Record<string, number> = {};

    webhookLogs.forEach(log => {
      const date = log.createdAt?.toDate?.();
      if (date) {
        const dateStr = date.toLocaleDateString();
        const hourStr = `${date.toLocaleDateString()} ${date.getHours()}:00`;
        requestsPerDay[dateStr] = (requestsPerDay[dateStr] || 0) + 1;
        requestsByHour[hourStr] = (requestsByHour[hourStr] || 0) + 1;
      }
    });

    console.log('\n1. Requests per day:');
    Object.entries(requestsPerDay)
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .forEach(([date, count]) => {
        const isUnusual = count > 100; // Flag if more than 100 requests per day
        console.log(`   ${date}: ${count} requests ${isUnusual ? '⚠️  UNUSUALLY HIGH' : ''}`);
        if (isUnusual) {
          suspiciousCount++;
          findings.push(`Unusually high traffic on ${date}: ${count} requests`);
        }
      });

    // Check for rapid bursts (many requests in same hour)
    const burstyHours = Object.entries(requestsByHour).filter(([_, count]) => count > 50);
    if (burstyHours.length > 0) {
      console.log('\n   ⚠️  High-traffic hours detected:');
      burstyHours.forEach(([hour, count]) => {
        console.log(`   - ${hour}: ${count} requests`);
      });
      suspiciousCount++;
      findings.push(`Detected ${burstyHours.length} hours with >50 requests (possible automated attack)`);
    }

    // 2. Failed signature verifications
    console.log(`\n2. Failed signature verifications: ${failedAttempts.length}`);
    if (failedAttempts.length > 0) {
      suspiciousCount++;
      findings.push(`${failedAttempts.length} unauthorized webhook attempts with invalid signatures`);
      console.log('   ⚠️  SUSPICIOUS: Unauthorized webhook attempts detected');
      failedAttempts.slice(0, 10).forEach((log, i) => {
        const timestamp = log.createdAt?.toDate?.() || new Date();
        console.log(`   ${i + 1}. ${timestamp.toLocaleString()}`);
        console.log(`      Message: ${log.message}`);
        if (log.parsedContext?.metadata?.headers) {
          const headers = log.parsedContext.metadata.headers;
          console.log(`      IP: ${headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown'}`);
          console.log(`      User-Agent: ${headers['user-agent'] || 'unknown'}`);
          console.log(`      Has Signature: ${log.parsedContext.metadata.hasSignature}`);
          console.log(`      Has Secret: ${log.parsedContext.metadata.hasSecret}`);
        }
      });
    } else {
      console.log('   ✅ No failed signature verifications');
    }

    // 3. Malformed requests
    console.log(`\n3. Malformed/Invalid requests: ${malformedRequests.length}`);
    if (malformedRequests.length > 10) {
      suspiciousCount++;
      findings.push(`${malformedRequests.length} malformed requests (possible scanning/probing)`);
      console.log('   ⚠️  SUSPICIOUS: High number of malformed requests');
      malformedRequests.slice(0, 10).forEach((log, i) => {
        const timestamp = log.createdAt?.toDate?.() || new Date();
        console.log(`   ${i + 1}. ${timestamp.toLocaleString()}: ${log.message}`);
        if (log.parsedContext?.metadata?.errors) {
          console.log(`      Errors: ${log.parsedContext.metadata.errors.join(', ')}`);
        }
      });
    } else if (malformedRequests.length > 0) {
      console.log(`   ⚠️  Some malformed requests found (${malformedRequests.length} - may be normal)`);
    } else {
      console.log('   ✅ No malformed requests');
    }

    // 4. Check for rapid-fire requests (same IP within short time)
    console.log(`\n4. Source IP Analysis:`);
    console.log(`   Unique IP addresses: ${ipAddresses.size}`);
    if (ipAddresses.size > 0) {
      console.log('   Top IPs:');
      const ipCounts = new Map<string, number>();
      webhookLogs.forEach(log => {
        if (log.parsedContext?.metadata?.headers) {
          const headers = log.parsedContext.metadata.headers;
          const ip = headers['x-forwarded-for'] || headers['x-real-ip'];
          if (ip) {
            ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
          }
        }
      });
      Array.from(ipCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([ip, count]) => {
          const isUnusual = count > 20;
          console.log(`   - ${ip}: ${count} requests ${isUnusual ? '⚠️' : ''}`);
          if (isUnusual) {
            findings.push(`IP ${ip} made ${count} requests (possible automated caller)`);
          }
        });
    } else {
      console.log('   ℹ️  No IP information in headers');
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

    if (updateToCreateRatio > 20) {
      suspiciousCount++;
      findings.push(`Very high update-to-create ratio (${updateToCreateRatio.toFixed(1)}x) - possible spam`);
      console.log(`   ⚠️  SUSPICIOUS: Very high update-to-create ratio (${updateToCreateRatio.toFixed(1)}x)`);
    }

    // 6. Look for error patterns
    const errorLogs = webhookLogs.filter(log => log.level === 'error');
    console.log(`\n6. Error logs: ${errorLogs.length}`);
    if (errorLogs.length > 20) {
      suspiciousCount++;
      findings.push(`${errorLogs.length} errors (possible attack causing errors)`);
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
      console.log(`   Some errors found (${errorLogs.length} - may be normal)`);
    } else {
      console.log('   ✅ No errors');
    }

    // 7. Check for unusual data patterns
    console.log(`\n7. Data Pattern Analysis:`);
    const addresses = new Set<string>();
    const cities = new Set<string>();
    const states = new Set<string>();
    const prices: number[] = [];

    [...propertiesCreated, ...propertiesUpdated].forEach(log => {
      const metadata = log.parsedContext?.metadata;
      if (metadata) {
        if (metadata.address) addresses.add(metadata.address);
        if (metadata.city) cities.add(metadata.city);
        if (metadata.state) states.add(metadata.state);
        if (metadata.price) prices.push(Number(metadata.price));
      }
    });

    console.log(`   Unique addresses: ${addresses.size}`);
    console.log(`   Unique cities: ${cities.size}`);
    console.log(`   Unique states: ${states.size}`);

    // If we see many properties but few unique addresses, might be spam
    const totalProperties = propertiesCreated.length + propertiesUpdated.length;
    if (totalProperties > 20 && addresses.size < 5) {
      suspiciousCount++;
      findings.push(`${totalProperties} property operations but only ${addresses.size} unique addresses (possible duplicate spam)`);
      console.log('   ⚠️  SUSPICIOUS: Many property operations but few unique addresses');
    }

    // Check for unrealistic prices
    if (prices.length > 0) {
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      console.log(`   Price range: $${minPrice.toLocaleString()} - $${maxPrice.toLocaleString()}`);
      console.log(`   Average price: $${avgPrice.toLocaleString()}`);

      const unrealisticPrices = prices.filter(p => p < 1000 || p > 50000000);
      if (unrealisticPrices.length > 0) {
        suspiciousCount++;
        findings.push(`${unrealisticPrices.length} properties with unrealistic prices (<$1K or >$50M)`);
        console.log(`   ⚠️  ${unrealisticPrices.length} properties with unrealistic prices`);
      }
    }

    // Final summary
    console.log('\n\n' + '='.repeat(80));
    console.log('🎯 FINAL ASSESSMENT');
    console.log('='.repeat(80));

    if (suspiciousCount === 0) {
      console.log('\n✅ NO SUSPICIOUS ACTIVITY DETECTED');
      console.log('All webhook activity appears normal.');
      console.log(`\nStats:`);
      console.log(`- Total webhook calls: ${verificationPassed.length}`);
      console.log(`- Properties created: ${propertiesCreated.length}`);
      console.log(`- Properties updated: ${propertiesUpdated.length}`);
      console.log(`- Failed authentications: 0`);
      console.log(`- Validation errors: ${malformedRequests.length}`);
    } else {
      console.log(`\n⚠️  ${suspiciousCount} SUSPICIOUS PATTERNS DETECTED\n`);
      console.log('Key Findings:');
      findings.forEach((finding, i) => {
        console.log(`${i + 1}. ${finding}`);
      });
      console.log('\n📋 Recommendations:');
      console.log('1. Review the IP addresses making failed authentication attempts');
      console.log('2. Consider rate limiting on the webhook endpoint');
      console.log('3. Ensure GHL_WEBHOOK_SECRET is properly configured');
      console.log('4. Monitor for continued unusual activity');
      console.log('5. Consider implementing IP allowlisting if source IPs are known');
    }

    console.log(`\n\n📈 Summary Statistics:`);
    console.log('='.repeat(80));
    console.log(`Total webhook logs analyzed: ${webhookLogs.length}`);
    console.log(`Date range: ${oneWeekAgo.toLocaleDateString()} - ${new Date().toLocaleDateString()}`);
    console.log(`Total properties affected: ${opportunityIds.size}`);
    console.log(`Unique source IPs: ${ipAddresses.size}`);

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
