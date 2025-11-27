import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

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

async function checkCashDeals() {
  console.log('=== CHECKING FALSE POSITIVES AGAINST CASH DEALS FILTER ===\n');

  // Get the 2 false positive properties (no owner finance keywords)
  const falsePositiveAddresses = [
    '514 S San Dario Ave',
    '812 N Main St'
  ];

  const allSnap = await db.collection('zillow_imports').get();

  for (const doc of allSnap.docs) {
    const data = doc.data();
    const address = data.fullAddress || data.streetAddress || '';

    // Check if this is one of our false positives
    const isFalsePositive = falsePositiveAddresses.some(fp => address.includes(fp));
    if (!isFalsePositive) continue;

    console.log(`ID: ${doc.id}`);
    console.log(`Address: ${address}`);
    console.log(`List Price: $${data.price?.toLocaleString() || 'N/A'}`);
    console.log(`Zestimate: $${data.zestimate?.toLocaleString() || 'N/A'}`);

    if (data.price && data.zestimate) {
      const percentOfZestimate = (data.price / data.zestimate) * 100;
      const isUnder70 = percentOfZestimate < 70;

      console.log(`Price/Zestimate: ${percentOfZestimate.toFixed(1)}%`);
      console.log(`Under 70% of Zestimate: ${isUnder70 ? '✅ YES - CASH DEAL!' : '❌ NO'}`);

      if (isUnder70) {
        console.log(`\n💰 This property qualifies as a cash deal!`);
        console.log(`   Discount: ${(100 - percentOfZestimate).toFixed(1)}% below Zestimate`);
      }
    } else {
      console.log('❌ Cannot calculate - missing price or zestimate');
    }
    console.log('---\n');
  }
}

checkCashDeals().catch(console.error);
