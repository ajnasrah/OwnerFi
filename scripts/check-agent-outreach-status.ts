import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function checkAgentOutreach() {
  console.log('=== AGENT OUTREACH STATUS ===\n');

  // Count agent outreach properties
  const outreachSnapshot = await db
    .collection('zillow_imports')
    .where('source', '==', 'agent_outreach')
    .get();

  console.log('Total agent outreach properties: ' + outreachSnapshot.size);

  // Check by verification status
  let verified = 0;
  let unverified = 0;
  let sentToGHL = 0;
  const recentlyAdded: any[] = [];

  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  let lastAddedDate: Date | null = null;
  let lastSentToGHLDate: Date | null = null;

  for (const doc of outreachSnapshot.docs) {
    const data = doc.data();

    if (data.ownerFinanceVerified === true) verified++;
    else unverified++;

    if (data.sentToGHL) sentToGHL++;

    // Check importedAt
    let importDate: Date | null = null;
    if (data.importedAt) {
      if (data.importedAt.toDate) {
        importDate = data.importedAt.toDate();
      } else if (data.importedAt._seconds) {
        importDate = new Date(data.importedAt._seconds * 1000);
      }
    }

    if (importDate) {
      if (lastAddedDate === null || importDate > lastAddedDate) {
        lastAddedDate = importDate;
      }

      if (importDate.getTime() > oneWeekAgo) {
        recentlyAdded.push({
          address: data.fullAddress || data.address,
          date: importDate,
          verified: data.ownerFinanceVerified,
        });
      }
    }

    // Check sentToGHLAt
    let sentDate: Date | null = null;
    if (data.sentToGHLAt) {
      if (data.sentToGHLAt.toDate) {
        sentDate = data.sentToGHLAt.toDate();
      } else if (data.sentToGHLAt._seconds) {
        sentDate = new Date(data.sentToGHLAt._seconds * 1000);
      } else if (typeof data.sentToGHLAt === 'string') {
        sentDate = new Date(data.sentToGHLAt);
      }
    }

    if (sentDate && (lastSentToGHLDate === null || sentDate > lastSentToGHLDate)) {
      lastSentToGHLDate = sentDate;
    }
  }

  console.log('  - Verified (ownerFinanceVerified=true): ' + verified);
  console.log('  - Unverified (pending): ' + unverified);
  console.log('  - Sent to GHL: ' + sentToGHL);
  console.log('');
  console.log('Last property added: ' + (lastAddedDate ? lastAddedDate.toISOString() : 'Unknown'));
  console.log('Last sent to GHL: ' + (lastSentToGHLDate ? lastSentToGHLDate.toISOString() : 'Unknown'));

  console.log('\n=== RECENTLY ADDED (last 7 days) ===');
  console.log('Count: ' + recentlyAdded.length);

  recentlyAdded
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10)
    .forEach((p, i) => {
      console.log(i + 1 + '. ' + p.address);
      console.log('   Added: ' + p.date.toISOString());
      console.log('   Verified: ' + p.verified);
    });

  // Check cron logs
  console.log('\n=== CHECKING CRON/SCRAPER LOGS ===');

  const cronLogs = await db
    .collection('cron_logs')
    .orderBy('timestamp', 'desc')
    .limit(20)
    .get();

  if (cronLogs.empty) {
    console.log('No cron logs found');
  } else {
    console.log('Recent cron runs:');
    cronLogs.docs.forEach((doc, i) => {
      const data = doc.data();
      let ts = 'Unknown';
      if (data.timestamp) {
        if (data.timestamp.toDate) {
          ts = data.timestamp.toDate().toISOString();
        } else if (typeof data.timestamp === 'string') {
          ts = data.timestamp;
        }
      }
      console.log(`${i + 1}. ${data.type || data.job || 'unknown'} - ${ts}`);
      if (data.result) console.log(`   Result: ${JSON.stringify(data.result).substring(0, 100)}`);
    });
  }

  // Check scraper queue
  console.log('\n=== SCRAPER QUEUE STATUS ===');

  const scraperQueue = await db.collection('scraper_queue').get();
  console.log('Items in scraper queue: ' + scraperQueue.size);

  if (scraperQueue.size > 0) {
    const statuses: Record<string, number> = {};
    scraperQueue.docs.forEach(doc => {
      const status = doc.data().status || 'unknown';
      statuses[status] = (statuses[status] || 0) + 1;
    });
    console.log('By status:', statuses);
  }

  // Check agent outreach queue
  console.log('\n=== AGENT OUTREACH QUEUE ===');

  const outreachQueue = await db.collection('agent_outreach_queue').get();
  console.log('Items in agent outreach queue: ' + outreachQueue.size);

  if (outreachQueue.size > 0) {
    const statuses: Record<string, number> = {};
    outreachQueue.docs.forEach(doc => {
      const status = doc.data().status || 'unknown';
      statuses[status] = (statuses[status] || 0) + 1;
    });
    console.log('By status:', statuses);
  }
}

checkAgentOutreach()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
