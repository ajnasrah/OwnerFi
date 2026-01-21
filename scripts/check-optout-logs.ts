/**
 * Script to check buyer opt-out webhook logs and find failed lookups
 * Run with: npx tsx scripts/check-optout-logs.ts
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
  });
}

const db = admin.firestore();

async function checkLogs() {
  console.log('\n=== Checking ALL Webhook Idempotency Records ===\n');

  // Check ALL webhook_idempotency records
  const idempotencySnapshot = await db.collection('webhook_idempotency')
    .orderBy('processedAt', 'desc')
    .limit(50)
    .get();

  console.log(`Found ${idempotencySnapshot.size} total idempotency records:\n`);

  idempotencySnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log('---');
    console.log('DocID:', doc.id);
    console.log('Service:', data.service);
    console.log('WebhookId:', data.webhookId);
    console.log('Response:', JSON.stringify(data.response, null, 2));
    if (data.processedAt) {
      console.log('ProcessedAt:', new Date(data.processedAt).toISOString());
    }
  });

  // Also check webhookLogs collection
  console.log('\n\n=== Checking webhookLogs Collection ===\n');

  const webhookLogsSnapshot = await db.collection('webhookLogs')
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  console.log(`Found ${webhookLogsSnapshot.size} webhook log entries:\n`);

  webhookLogsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log('---');
    console.log('Type:', data.type);
    console.log('Status:', data.status);
    console.log('BuyerId:', data.buyerId);
    console.log('BuyerPhone:', data.buyerPhone);
  });

  // Also check buyerOptOutLogs collection
  console.log('\n\n=== Checking buyerOptOutLogs Collection ===\n');

  const optoutLogsSnapshot = await db.collection('buyerOptOutLogs')
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  console.log(`Found ${optoutLogsSnapshot.size} opt-out log entries:\n`);

  optoutLogsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log('---');
    console.log('BuyerId:', data.buyerId);
    console.log('BuyerPhone:', data.buyerPhone);
    console.log('Reason:', data.reason);
    console.log('Status:', data.status);
  });
}

checkLogs()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
