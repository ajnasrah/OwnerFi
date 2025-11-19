import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

async function checkSpecificFalsePositives() {
  console.log('\n🔍 Checking Properties with "no owner financing" or "no seller financing"\n');
  console.log('='.repeat(80));

  // IDs from previous analysis
  const suspiciousIds = [
    '0vxQcSf3mjEbzXcAQQf9', // 2943 E 130th St - "no wholesalers or owner financing"
    'JWfHTm3iKU8RT5dPLQAz', // 2013 W 99th St - "no wholesalers or owner financing"
    'QXT9H52Lr4pFks61If8J', // 6900 W Franklin Rd - "No contract sales or seller financing"
  ];

  const falsePositives: Array<{
    id: string;
    address: string;
    description: string;
    reason: string;
  }> = [];

  for (const id of suspiciousIds) {
    const doc = await db.collection('zillow_imports').doc(id).get();
    if (!doc.exists) continue;

    const data = doc.data();
    const description = data?.description || '';
    const address = data?.fullAddress || data?.streetAddress || 'Unknown';

    console.log('\n' + '━'.repeat(80));
    console.log(`\n📍 ${address}`);
    console.log(`ID: ${id}`);
    console.log(`\n📝 Full Description:\n${description}\n`);

    // Check if it explicitly says no owner financing
    if (/no\s+(wholesalers|assignments).*or\s+owner\s+financing/i.test(description)) {
      falsePositives.push({ id, address, description, reason: 'Says "no wholesalers or owner financing"' });
      console.log('❌ VERDICT: FALSE POSITIVE - Explicitly says "no owner financing"');
    } else if (/no\s+contract.*or\s+(seller|owner)\s+financing/i.test(description)) {
      falsePositives.push({ id, address, description, reason: 'Says "no contract or seller financing"' });
      console.log('❌ VERDICT: FALSE POSITIVE - Explicitly says "no seller financing"');
    } else if (/no\s+(seller|owner)\s+financing/i.test(description)) {
      falsePositives.push({ id, address, description, reason: 'Says "no seller/owner financing"' });
      console.log('❌ VERDICT: FALSE POSITIVE - Explicitly says "no seller/owner financing"');
    } else {
      console.log('✅ VERDICT: Appears to have owner financing mentioned elsewhere');
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 Found ${falsePositives.length} confirmed false positives\n`);

  if (falsePositives.length > 0) {
    console.log('Properties to delete:');
    falsePositives.forEach((prop, i) => {
      console.log(`${i + 1}. ${prop.address} - ${prop.reason}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  return falsePositives;
}

checkSpecificFalsePositives()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
