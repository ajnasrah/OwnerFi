import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

const MISSING_PROPERTY_IDS = [
  '0ArH54dHdEG7vhelJiLl',
  '0KR5aPdBHGjIYC5lPwQz',
  '50jB1Y0Ut184rkfZ1HBH',
  '5LS9QpKvq2dogsCDKxtM',
  '5fuGUQqCC2JqSSDUBooL',
  '8LmjhU2mC0jrrDwfyjyt',
  'A5v9JXTMfuHS8qEVNNWN',
  'FBuf9AypY4CveWpffcv6',
  'HQlPC5rXh5Dp1qdXZwmI',
  'JihW3dOvW02CzNvhVJFW',
  'LzLPqOLhW9fxENSgAnxy',
  'NZE8BgTzsqzBPjslGAte',
  'PoMY26zeSlrI5eHtg7x0',
  'R3t3zrPDV8Jo4L5ASkIU',
  'SZyaq663vuD1mnUronuu',
  'X4An0vm3MU6FeUTqZKdO',
  'Y7KEK0SpSn5vpCRKR1QK',
  'bertQTtohbTrzQBrvurF',
  'gjcsX9UKkRUOLmTZtVCi',
  'h45p8cPJJ3BaeyvNGnYP',
  'jgB6wZzd70TBqvKyG7tO',
  'kPbZ6aQrUq9FQoirJ9EH',
  'kQQnQGArMr1hf282rWR6',
  'nTuybzVOidhHgL4d8hDN',
  'nV4P39yEL6E23OotguSN',
  'pvo2kPZVAwMFisfL9lR7',
  'rq5u2h5K6qgrTYx2NmYn'
];

async function addMissingToQueue() {
  console.log(`🎥 Adding ${MISSING_PROPERTY_IDS.length} missing properties to queue...\n`);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const webhookSecret = process.env.WEBHOOK_SECRET || process.env.CRON_SECRET;

  let success = 0;
  let failed = 0;

  for (const propertyId of MISSING_PROPERTY_IDS) {
    try {
      const response = await fetch(`${baseUrl}/api/property/add-to-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${webhookSecret}`
        },
        body: JSON.stringify({ propertyId })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${data.address || propertyId}`);
        success++;
      } else {
        const error = await response.text();
        console.log(`❌ ${propertyId}: ${error}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`❌ ${propertyId}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`✅ Successfully added: ${success}`);
  console.log(`❌ Failed: ${failed}`);
}

addMissingToQueue()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
