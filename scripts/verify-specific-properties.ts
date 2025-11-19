import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { hasOwnerFinancing, getFilterExplanation } from '../src/lib/owner-financing-filter';

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

// Properties that were flagged as suspicious
const suspiciousIds = [
  '2EYo7T3mxGQqODfieB8t', // 132 RENFRO DR - "NOW OFFERING OWNER FINANCE!"
  '2gqJNKiDVunQZ5JVG0Wp', // 414 E Church St - "Owner Financing is available!"
  '33K4Ociike3PRD2dhMr1', // 8603 Northridge Loop - "Owner financing available no banks needed!"
  '1EBpAuHAwP0cewv8PAFS', // 227 E High St - "negotiable and owner financing may be available"
];

async function verifyProperties() {
  console.log('\n🔍 VERIFYING SUSPICIOUS PROPERTIES\n');
  console.log('='.repeat(100));

  for (const id of suspiciousIds) {
    const doc = await db.collection('zillow_imports').doc(id).get();

    if (!doc.exists) {
      console.log(`\n❌ Property ${id} not found\n`);
      continue;
    }

    const data = doc.data();
    const desc = data?.description || '';
    const address = data?.fullAddress || data?.streetAddress || 'Unknown';

    console.log(`\n📍 ${address}`);
    console.log(`   ID: ${id}`);
    console.log(`   ${getFilterExplanation(desc)}`);
    console.log(`\n   Full Description:`);
    console.log(`   "${desc}"`);
    console.log('\n' + '-'.repeat(100));
  }
}

verifyProperties()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
