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

async function investigateHighTrafficDays() {
  try {
    console.log('\n🔍 DETAILED INVESTIGATION: High Traffic Days (Nov 10, 14, 15, 2025)');
    console.log('='.repeat(100));

    // Target dates
    const targetDates = [
      new Date('2025-11-10'),
      new Date('2025-11-14'),
      new Date('2025-11-15')
    ];

    // Fetch logs
    console.log('\nFetching logs...\n');
    const logsSnapshot = await db.collection('systemLogs')
      .limit(5000)
      .get();

    for (const targetDate of targetDates) {
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      console.log('\n' + '='.repeat(100));
      console.log(`📅 ${targetDate.toLocaleDateString()} - DETAILED ANALYSIS`);
      console.log('='.repeat(100));

      // Filter logs for this day
      const dayLogs: any[] = [];
      const webhookLogs: any[] = [];

      logsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const logDate = data.createdAt?.toDate?.() || new Date(0);

        if (logDate >= startOfDay && logDate <= endOfDay) {
          const logEntry = { ...data, id: doc.id };
          dayLogs.push(logEntry);

          // Parse context
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
            webhookLogs.push({ ...logEntry, parsedContext });
          }
        }
      });

      console.log(`\nTotal logs this day: ${dayLogs.length}`);
      console.log(`Webhook logs this day: ${webhookLogs.length}\n`);

      // Analyze by hour
      const hourlyBreakdown: Record<number, any[]> = {};
      webhookLogs.forEach(log => {
        const hour = log.createdAt?.toDate?.()?.getHours() || 0;
        if (!hourlyBreakdown[hour]) {
          hourlyBreakdown[hour] = [];
        }
        hourlyBreakdown[hour].push(log);
      });

      console.log('⏰ Hourly Breakdown:');
      console.log('-'.repeat(100));
      Object.entries(hourlyBreakdown)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .forEach(([hour, logs]) => {
          const hourNum = Number(hour);
          const timeStr = `${hourNum.toString().padStart(2, '0')}:00 - ${(hourNum + 1).toString().padStart(2, '0')}:00`;
          const isHighTraffic = logs.length > 50;
          console.log(`   ${timeStr}: ${logs.length.toString().padStart(4)} requests ${isHighTraffic ? '🔥 HIGH TRAFFIC' : ''}`);
        });

      // Analyze properties created/updated
      const propertiesCreated: any[] = [];
      const propertiesUpdated: any[] = [];
      const opportunityIds = new Set<string>();
      const addresses = new Set<string>();
      const ips = new Map<string, number>();
      const userAgents = new Map<string, number>();

      webhookLogs.forEach(log => {
        const action = log.parsedContext?.action;
        const metadata = log.parsedContext?.metadata;

        if (action === 'property_created') {
          propertiesCreated.push(log);
        } else if (action === 'property_updated') {
          propertiesUpdated.push(log);
        }

        if (metadata?.opportunityId) {
          opportunityIds.add(metadata.opportunityId);
        }
        if (metadata?.address) {
          addresses.add(metadata.address);
        }

        // Track IPs
        if (metadata?.headers) {
          const ip = metadata.headers['x-forwarded-for'] || metadata.headers['x-real-ip'];
          if (ip) {
            ips.set(ip, (ips.get(ip) || 0) + 1);
          }
          const ua = metadata.headers['user-agent'];
          if (ua) {
            userAgents.set(ua, (userAgents.get(ua) || 0) + 1);
          }
        }
      });

      console.log('\n📊 Property Operations:');
      console.log('-'.repeat(100));
      console.log(`   Properties Created: ${propertiesCreated.length}`);
      console.log(`   Properties Updated: ${propertiesUpdated.length}`);
      console.log(`   Unique Opportunity IDs: ${opportunityIds.size}`);
      console.log(`   Unique Addresses: ${addresses.size}`);

      // Show sample of properties created
      if (propertiesCreated.length > 0) {
        console.log('\n   Sample Properties Created:');
        propertiesCreated.slice(0, 10).forEach((log, i) => {
          const time = log.createdAt?.toDate?.()?.toLocaleTimeString() || 'N/A';
          const addr = log.parsedContext?.metadata?.address || 'N/A';
          const city = log.parsedContext?.metadata?.city || 'N/A';
          const state = log.parsedContext?.metadata?.state || 'N/A';
          const price = log.parsedContext?.metadata?.price || 'N/A';
          console.log(`   ${i + 1}. ${time} - ${addr}, ${city}, ${state} - $${price}`);
        });
        if (propertiesCreated.length > 10) {
          console.log(`   ... and ${propertiesCreated.length - 10} more`);
        }
      }

      // Show sample of properties updated
      if (propertiesUpdated.length > 0) {
        console.log('\n   Sample Properties Updated:');
        propertiesUpdated.slice(0, 10).forEach((log, i) => {
          const time = log.createdAt?.toDate?.()?.toLocaleTimeString() || 'N/A';
          const addr = log.parsedContext?.metadata?.address || 'N/A';
          const city = log.parsedContext?.metadata?.city || 'N/A';
          const state = log.parsedContext?.metadata?.state || 'N/A';
          const price = log.parsedContext?.metadata?.price || 'N/A';
          console.log(`   ${i + 1}. ${time} - ${addr}, ${city}, ${state} - $${price}`);
        });
        if (propertiesUpdated.length > 10) {
          console.log(`   ... and ${propertiesUpdated.length - 10} more`);
        }
      }

      // IP Analysis
      console.log('\n🌐 Source IP Analysis:');
      console.log('-'.repeat(100));
      console.log(`   Unique IPs: ${ips.size}`);
      if (ips.size > 0) {
        console.log('   Top 10 IPs:');
        Array.from(ips.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .forEach(([ip, count]) => {
            const percentage = ((count / webhookLogs.length) * 100).toFixed(1);
            const isGoogleCloud = ip.startsWith('34.') || ip.startsWith('35.');
            const isUnusual = count > 50;
            console.log(`   - ${ip}: ${count} requests (${percentage}%) ${isGoogleCloud ? '☁️  GCP' : ''} ${isUnusual ? '⚠️  HIGH' : ''}`);
          });
      }

      // User Agent Analysis
      console.log('\n🖥️  User Agent Analysis:');
      console.log('-'.repeat(100));
      console.log(`   Unique User Agents: ${userAgents.size}`);
      if (userAgents.size > 0) {
        console.log('   Top User Agents:');
        Array.from(userAgents.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([ua, count]) => {
            const uaShort = ua.substring(0, 80);
            console.log(`   - ${uaShort}... (${count} requests)`);
          });
      }

      // Check for patterns suggesting automated bulk operations
      console.log('\n🤖 Automation Pattern Detection:');
      console.log('-'.repeat(100));

      // Check if requests came in rapid succession (within seconds)
      const timestamps = webhookLogs
        .map(log => log.createdAt?.toDate?.()?.getTime())
        .filter(t => t)
        .sort((a, b) => a - b);

      if (timestamps.length > 1) {
        const timeDiffs: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
          timeDiffs.push(timestamps[i] - timestamps[i - 1]);
        }

        const avgTimeDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
        const minTimeDiff = Math.min(...timeDiffs);
        const requestsWithin1Second = timeDiffs.filter(diff => diff < 1000).length;
        const requestsWithin100ms = timeDiffs.filter(diff => diff < 100).length;

        console.log(`   Average time between requests: ${avgTimeDiff.toFixed(0)}ms`);
        console.log(`   Minimum time between requests: ${minTimeDiff.toFixed(0)}ms`);
        console.log(`   Requests within 1 second of each other: ${requestsWithin1Second}`);
        console.log(`   Requests within 100ms of each other: ${requestsWithin100ms}`);

        if (requestsWithin100ms > 10) {
          console.log('   ⚠️  PATTERN: Many requests within 100ms - likely automated bulk operation');
        }
        if (avgTimeDiff < 500) {
          console.log('   ⚠️  PATTERN: Very fast average request rate - automated system');
        }
      }

      // Check for duplicate property submissions
      const duplicateAddresses = new Map<string, number>();
      webhookLogs.forEach(log => {
        const addr = log.parsedContext?.metadata?.address;
        if (addr) {
          duplicateAddresses.set(addr, (duplicateAddresses.get(addr) || 0) + 1);
        }
      });

      const duplicates = Array.from(duplicateAddresses.entries()).filter(([_, count]) => count > 1);
      if (duplicates.length > 0) {
        console.log(`\n   Duplicate property submissions: ${duplicates.length} addresses`);
        console.log('   Top duplicates:');
        duplicates
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([addr, count]) => {
            console.log(`   - ${addr}: ${count} times ${count > 5 ? '⚠️  SUSPICIOUS' : ''}`);
          });
      }

      // Geographic distribution
      const states = new Map<string, number>();
      const cities = new Map<string, number>();
      webhookLogs.forEach(log => {
        const state = log.parsedContext?.metadata?.state;
        const city = log.parsedContext?.metadata?.city;
        if (state) states.set(state, (states.get(state) || 0) + 1);
        if (city) cities.set(city, (cities.get(city) || 0) + 1);
      });

      console.log('\n📍 Geographic Distribution:');
      console.log('-'.repeat(100));
      console.log(`   States: ${states.size}`);
      if (states.size > 0) {
        console.log('   Top states:');
        Array.from(states.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .forEach(([state, count]) => {
            const percentage = ((count / webhookLogs.length) * 100).toFixed(1);
            console.log(`   - ${state}: ${count} properties (${percentage}%)`);
          });
      }

      // Look for errors or suspicious activity
      const errors = webhookLogs.filter(log => log.level === 'error');
      const warnings = webhookLogs.filter(log => log.level === 'warn');
      const validationErrors = webhookLogs.filter(log =>
        log.parsedContext?.action?.includes('validation_error') ||
        log.parsedContext?.action?.includes('validation_rejected')
      );

      console.log('\n⚠️  Issues & Errors:');
      console.log('-'.repeat(100));
      console.log(`   Errors: ${errors.length}`);
      console.log(`   Warnings: ${warnings.length}`);
      console.log(`   Validation Rejections: ${validationErrors.length}`);

      if (errors.length > 0) {
        console.log('\n   Error details:');
        errors.slice(0, 5).forEach((log, i) => {
          const time = log.createdAt?.toDate?.()?.toLocaleTimeString() || 'N/A';
          console.log(`   ${i + 1}. ${time} - ${log.message}`);
        });
      }

      if (validationErrors.length > 0) {
        console.log('\n   Validation rejection details:');
        validationErrors.slice(0, 5).forEach((log, i) => {
          const time = log.createdAt?.toDate?.()?.toLocaleTimeString() || 'N/A';
          const addr = log.parsedContext?.metadata?.address || 'N/A';
          const reason = log.parsedContext?.metadata?.reason || log.message;
          console.log(`   ${i + 1}. ${time} - ${addr}`);
          console.log(`      Reason: ${reason.substring(0, 100)}`);
        });
      }
    }

    // Final Summary
    console.log('\n\n' + '='.repeat(100));
    console.log('🎯 INVESTIGATION SUMMARY');
    console.log('='.repeat(100));
    console.log('\nBased on the detailed analysis of Nov 10, 14, and 15:');
    console.log('\n1. Check if the high-traffic hours correlate with known bulk imports or business operations');
    console.log('2. Verify all source IPs are from expected sources (GoHighLevel = Google Cloud Platform)');
    console.log('3. Review any duplicate property submissions');
    console.log('4. Investigate any validation rejections or errors');
    console.log('5. Consider if the rapid request rate indicates legitimate bulk operations or potential abuse');

  } catch (error) {
    console.error('❌ Error:', error);
    if (error instanceof Error) {
      console.error('Details:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

investigateHighTrafficDays();
