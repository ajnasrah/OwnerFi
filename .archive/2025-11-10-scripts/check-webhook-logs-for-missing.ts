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
  '9c3qHnG2lETzmufVoU49', // 349 Cascade Dr
  'sJm3Iz810TxCtV23hu3E', // 1203 Kirkland Ave
  'sWCZ6nSSyvi3XwcZ0q4f', // 1422 Benjamin St
  '8rgerD0FMYeeHsvSI87G', // 2305 S County Highway 83
  '2DAEE31ZHuicwoycrVsy', // 6215 Thomas Dr
  '3UkFKDwjcnzChe75SdHc', // 610 E Zion St
  'zP3LR0AfDySEHcjqxRCC', // 309 E Milam St
  'o7yjrrtBG5eBWa6cUrVF', // 9163 Loganberry Ln
  'vjwP7ODxjP8OibXoBY40', // 7427 Sieloff Dr
  'aY5NayLNY6rIPHddJ3o7'  // 9611 Balboa
];

async function checkLogs() {
  console.log('🔍 Checking systemLogs for the 10 missing properties...\\n');

  // Get logs from the last 48 hours
  const twoDaysAgo = new Date();
  twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

  const logsSnapshot = await db.collection('systemLogs')
    .where('createdAt', '>=', Timestamp.fromDate(twoDaysAgo))
    .orderBy('createdAt', 'desc')
    .limit(1000)
    .get();

  console.log(`Total logs in last 48 hours: ${logsSnapshot.size}\\n`);

  let foundCount = 0;

  logsSnapshot.forEach(doc => {
    const data = doc.data();
    let context;

    try {
      context = data.context ? JSON.parse(data.context) : {};
    } catch {
      context = {};
    }

    // Check if this log mentions any of our missing opportunity IDs
    const logText = JSON.stringify(data).toLowerCase();

    for (const oppId of missingOpportunityIds) {
      if (logText.includes(oppId.toLowerCase())) {
        foundCount++;
        console.log(`\\n✅ FOUND LOG for ${oppId}:`);
        console.log(`   Level: ${data.level}`);
        console.log(`   Time: ${data.createdAt?.toDate()}`);
        console.log(`   Message: ${data.message}`);

        if (context.metadata) {
          console.log(`   Metadata: ${JSON.stringify(context.metadata, null, 2).substring(0, 500)}`);
        }

        if (data.stackTrace) {
          console.log(`   Error: ${data.stackTrace.substring(0, 200)}`);
        }
        console.log('');
      }
    }
  });

  if (foundCount === 0) {
    console.log('❌ No logs found for any of the 10 missing opportunity IDs');
    console.log('\\nThis means the webhook was NEVER called for these properties.\\n');
  } else {
    console.log(`\\n✅ Found ${foundCount} log entries for the missing properties`);
  }
}

checkLogs().catch(console.error);
