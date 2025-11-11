import { config } from 'dotenv';

config({ path: '.env.local' });

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const webhookSecret = process.env.WEBHOOK_SECRET || process.env.CRON_SECRET;

const MISSING_IDS = [
  '0yzmsxm1KYSAssosBNdJ',
  'BDWp6DeZZf6JYf4IIWxN',
  'laUqp1xGPIBqjTvCQCWo'
];

async function addMissing() {
  console.log(`🎥 Adding 3 missing properties to queue...\n`);

  for (const propertyId of MISSING_IDS) {
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
      } else {
        const error = await response.text();
        console.log(`❌ ${propertyId}: ${error}`);
      }
    } catch (error: any) {
      console.log(`❌ ${propertyId}: ${error.message}`);
    }
  }

  console.log('\n✅ Done!');
}

addMissing()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
