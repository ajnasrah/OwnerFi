import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
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

async function investigateMissingProperties() {
  console.log('🔍 Investigating why 10 properties failed to import...\n');

  // Check different collections for these properties
  for (const oppId of missingOpportunityIds) {
    console.log(`\n--- Checking: ${oppId} ---`);

    // Check if there are any webhook logs (simple query without orderBy)
    const logsQuery = await db.collection('webhook-logs')
      .where('opportunityId', '==', oppId)
      .limit(10)
      .get();

    if (logsQuery.empty) {
      console.log('  ❌ No webhook logs found');
    } else {
      console.log(`  ✅ Found ${logsQuery.size} webhook log(s):`);
      logsQuery.forEach(doc => {
        const log = doc.data();
        console.log(`     - Timestamp: ${log.timestamp?.toDate?.() || log.createdAt?.toDate?.() || 'N/A'}`);
        console.log(`     - Status: ${log.status || 'N/A'}`);
        console.log(`     - Event: ${log.event || log.type || 'N/A'}`);
        if (log.error) {
          console.log(`     - Error: ${log.error}`);
        }
      });
    }

    // Check property-errors collection (simple query)
    const errorQuery = await db.collection('property-errors')
      .where('opportunityId', '==', oppId)
      .limit(5)
      .get();

    if (!errorQuery.empty) {
      console.log(`  ⚠️  Found ${errorQuery.size} error(s):`);
      errorQuery.forEach(doc => {
        const error = doc.data();
        console.log(`     - Error: ${error.error || error.message}`);
        console.log(`     - Timestamp: ${error.timestamp?.toDate?.() || 'N/A'}`);
      });
    }

    // Check archived properties
    const archivedQuery = await db.collection('archived-properties')
      .where('opportunityId', '==', oppId)
      .limit(1)
      .get();

    if (!archivedQuery.empty) {
      console.log('  📦 Found in archived-properties');
    }

    // Check if it's in properties but with wrong status
    const propQuery = await db.collection('properties')
      .where('opportunityId', '==', oppId)
      .limit(1)
      .get();

    if (!propQuery.empty) {
      const prop = propQuery.docs[0].data();
      console.log(`  ✅ FOUND IN PROPERTIES!`);
      console.log(`     - Status: ${prop.status}`);
      console.log(`     - isActive: ${prop.isActive}`);
    }
  }

  // Check for general webhook issues around the time properties were created
  console.log('\n\n📊 Checking for general webhook issues...\n');

  const recentErrors = await db.collection('webhook-logs')
    .where('status', '==', 'error')
    .orderBy('timestamp', 'desc')
    .limit(20)
    .get();

  if (!recentErrors.empty) {
    console.log(`Found ${recentErrors.size} recent webhook errors:`);
    const errorCounts: Record<string, number> = {};

    recentErrors.forEach(doc => {
      const log = doc.data();
      const errorType = log.error || log.errorMessage || 'Unknown error';
      errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
    });

    console.log('\nError summary:');
    Object.entries(errorCounts).forEach(([error, count]) => {
      console.log(`  - ${error}: ${count} occurrences`);
    });
  } else {
    console.log('No recent webhook errors found');
  }
}

investigateMissingProperties().catch(console.error);
