const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function checkCosts() {
  // Get ALL entries, sorted by timestamp descending
  const entries = await db.collection('cost_entries')
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();

  console.log(`\nMost recent 10 cost entries:\n`);
  
  entries.forEach(doc => {
    const data = doc.data();
    const date = new Date(data.timestamp).toLocaleString();
    console.log(`${date} | ${data.brand} | ${data.service} | $${data.costUSD?.toFixed(6)} | ${data.operation}`);
  });

  console.log(`\nTotal entries in collection: ${entries.size}`);

  await admin.app().delete();
}

checkCosts().catch(console.error);
