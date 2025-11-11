import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

const missingOpportunityIds = [
  '9c3qHnG2lETzmufVoU49',
  'sJm3Iz810TxCtV23hu3E',
  'sWCZ6nSSyvi3XwcZ0q4f',
  '8rgerD0FMYeeHsvSI87G',
  '2DAEE31ZHuicwoycrVsy',
  '3UkFKDwjcnzChe75SdHc',
  'zP3LR0AfDySEHcjqxRCC',
  'o7yjrrtBG5eBWa6cUrVF',
  'vjwP7ODxjP8OibXoBY40',
  'aY5NayLNY6rIPHddJ3o7'
];

async function checkWebhookErrors() {
  console.log('🔍 Checking webhook errors and logs from the last 48 hours...\n');

  // Get timestamp for 48 hours ago
  const twoDaysAgo = new Date();
  twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
  const timestampFilter = Timestamp.fromDate(twoDaysAgo);

  // Check all webhook logs from last 48 hours
  console.log('📋 Checking ALL webhook logs from last 48 hours...\n');
  const allLogsQuery = await db.collection('webhook-logs')
    .orderBy('timestamp', 'desc')
    .limit(300)
    .get();

  console.log(`Total webhook logs found: ${allLogsQuery.size}\n`);

  // Count by status
  const statusCounts: Record<string, number> = {};
  const errorLogs: any[] = [];

  allLogsQuery.forEach(doc => {
    const log = doc.data();
    const status = log.status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    if (status === 'error' || log.error) {
      errorLogs.push({
        id: doc.id,
        timestamp: log.timestamp?.toDate?.(),
        error: log.error || log.errorMessage,
        oppId: log.opportunityId,
        data: log
      });
    }
  });

  console.log('Webhook logs by status:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log(`\n❌ Found ${errorLogs.length} webhook errors:\n`);
  errorLogs.slice(0, 20).forEach((log, i) => {
    console.log(`${i + 1}. ${log.timestamp || 'N/A'}`);
    console.log(`   OpportunityId: ${log.oppId || 'N/A'}`);
    console.log(`   Error: ${log.error}`);
  });

  // Check property-errors collection
  console.log('\n\n🔍 Checking property-errors collection...\n');
  const errorsQuery = await db.collection('property-errors')
    .orderBy('timestamp', 'desc')
    .limit(100)
    .get();

  console.log(`Total property errors found: ${errorsQuery.size}\n`);

  const propertyErrors: any[] = [];
  errorsQuery.forEach(doc => {
    const error = doc.data();
    propertyErrors.push({
      timestamp: error.timestamp?.toDate?.(),
      oppId: error.opportunityId,
      error: error.error || error.message,
      details: error.details
    });
  });

  // Show recent errors
  console.log('Recent property errors:');
  propertyErrors.slice(0, 10).forEach((err, i) => {
    console.log(`\n${i + 1}. ${err.timestamp || 'N/A'}`);
    console.log(`   OpportunityId: ${err.oppId || 'N/A'}`);
    console.log(`   Error: ${err.error}`);
    if (err.details) {
      console.log(`   Details: ${JSON.stringify(err.details).substring(0, 200)}`);
    }
  });

  // Check if ANY of our missing properties appear in errors
  console.log('\n\n🎯 Checking if missing properties appear in error logs...\n');
  for (const oppId of missingOpportunityIds) {
    const foundInErrors = propertyErrors.find(e => e.oppId === oppId);
    const foundInWebhookErrors = errorLogs.find(e => e.oppId === oppId);

    if (foundInErrors || foundInWebhookErrors) {
      console.log(`\n✅ FOUND: ${oppId}`);
      if (foundInErrors) {
        console.log(`   Property Error: ${foundInErrors.error}`);
      }
      if (foundInWebhookErrors) {
        console.log(`   Webhook Error: ${foundInWebhookErrors.error}`);
      }
    }
  }

  // Check webhook-dlq (dead letter queue)
  console.log('\n\n💀 Checking dead letter queue...\n');
  const dlqQuery = await db.collection('webhook-dlq')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .get();

  if (!dlqQuery.empty) {
    console.log(`Found ${dlqQuery.size} items in DLQ:\n`);
    dlqQuery.forEach((doc, i) => {
      const dlq = doc.data();
      console.log(`${i + 1}. ${dlq.timestamp?.toDate?.() || 'N/A'}`);
      console.log(`   OpportunityId: ${dlq.opportunityId || 'N/A'}`);
      console.log(`   Error: ${dlq.error || dlq.reason}`);

      // Check if it's one of our missing properties
      if (missingOpportunityIds.includes(dlq.opportunityId)) {
        console.log(`   ⚠️  THIS IS ONE OF THE MISSING PROPERTIES!`);
      }
    });
  } else {
    console.log('No items in DLQ');
  }
}

checkWebhookErrors().catch(console.error);
