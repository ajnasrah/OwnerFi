import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

async function getExactWebhookData() {
  console.log('Getting EXACT webhook data for save-property calls...\n');

  const logs = await db.collection('systemLogs')
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get();

  let foundSaveWebhook = false;

  logs.forEach(doc => {
    const data = doc.data();

    if (data.message === 'Webhook received' && data.context) {
      const context = JSON.parse(data.context);

      if (context.action === 'webhook_received_raw') {
        foundSaveWebhook = true;

        console.log('=====================================');
        console.log(`Time: ${data.createdAt?.toDate()}`);
        console.log('MESSAGE: Webhook received');
        console.log('\nFULL HEADERS SENT BY GHL:');
        console.log(JSON.stringify(context.metadata.headers, null, 2));
        console.log('\nBODY:');
        console.log(`Length: ${context.metadata.bodyLength}`);
        console.log('=====================================\n');
      }
    }
  });

  if (!foundSaveWebhook) {
    console.log('No save-property webhook calls found in recent logs');
  }
}

getExactWebhookData().catch(console.error);
