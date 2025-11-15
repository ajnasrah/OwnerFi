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

async function listPropertiesNeedingReview() {
  console.log('📋 Properties needing review:\n');

  const flaggedQuery = await db.collection('properties')
    .where('needsReview', '==', true)
    .get();

  console.log(`Total: ${flaggedQuery.size} properties\n`);
  console.log('='.repeat(100));

  flaggedQuery.docs.forEach((doc, idx) => {
    const data = doc.data();

    console.log(`\n${idx + 1}. ${data.address}, ${data.city}, ${data.state}`);
    console.log(`   Opportunity ID: ${data.opportunityId}`);
    console.log(`   Price: $${(data.listPrice || data.price)?.toLocaleString()}`);
    console.log(`   Down: $${data.downPaymentAmount?.toLocaleString()} (${data.downPaymentPercent?.toFixed(1)}%)`);
    console.log(`   Payment: $${data.monthlyPayment?.toLocaleString()}`);
    console.log(`   Rate: ${data.interestRate}%`);
    console.log(`   Term: ${data.termYears} years`);

    if (data.reviewReasons && data.reviewReasons.length > 0) {
      console.log(`   Issues:`);
      data.reviewReasons.forEach((reason: any) => {
        const icon = reason.severity === 'error' ? '❌' : reason.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`     ${icon} ${reason.field}: ${reason.issue}`);
      });
    }
  });

  console.log('\n' + '='.repeat(100));
}

listPropertiesNeedingReview().catch(console.error);
