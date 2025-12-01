import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function findProperty() {
  console.log('Searching for property with "Willey" in address...\n');

  const snapshot = await db.collection('properties').get();

  let found = false;
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.address && data.address.toLowerCase().includes('willey')) {
      console.log('Found property:');
      console.log(JSON.stringify({
        id: doc.id,
        address: data.address,
        city: data.city,
        state: data.state,
        status: data.status,
        isActive: data.isActive,
        source: data.source,
        opportunityId: data.opportunityId,
        createdAt: data.createdAt?._seconds ? new Date(data.createdAt._seconds * 1000).toISOString() : data.createdAt,
        updatedAt: data.updatedAt?._seconds ? new Date(data.updatedAt._seconds * 1000).toISOString() : data.updatedAt,
        price: data.price,
        imageUrls: data.imageUrls
      }, null, 2));
      found = true;
    }
  });

  if (!found) {
    console.log('No property found with "Willey" in address');
    console.log('Total properties in database:', snapshot.size);

    // Check webhook DLQ for failed webhooks
    console.log('\n--- Checking Webhook DLQ ---');
    const dlqSnapshot = await db.collection('webhook_dlq').get();
    console.log('Total items in DLQ:', dlqSnapshot.size);

    dlqSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.payload && JSON.stringify(data.payload).toLowerCase().includes('willey')) {
        console.log('\nFound in DLQ:');
        console.log(JSON.stringify(data, null, 2));
      }
    });

    // Check webhook logs
    console.log('\n--- Checking Webhook Logs ---');
    const logsSnapshot = await db.collection('webhook_logs').orderBy('timestamp', 'desc').limit(50).get();
    console.log('Recent webhook logs:', logsSnapshot.size);

    logsSnapshot.forEach(doc => {
      const data = doc.data();
      if (JSON.stringify(data).toLowerCase().includes('willey')) {
        console.log('\nFound in logs:');
        console.log(JSON.stringify(data, null, 2));
      }
    });
  }
}

findProperty().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
