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

async function checkValidationFlags() {
  console.log('🔍 Checking properties for validation flags...\n');

  // Check for properties with needsReview flag
  const needsReviewQuery = await db.collection('properties')
    .where('needsReview', '==', true)
    .limit(100)
    .get();

  console.log(`Properties flagged for review: ${needsReviewQuery.size}`);

  if (needsReviewQuery.size > 0) {
    console.log('\nSample properties needing review:');
    needsReviewQuery.docs.slice(0, 5).forEach(doc => {
      const data = doc.data();
      console.log(`\n- ${data.address}, ${data.city}, ${data.state}`);
      console.log(`  Price: $${data.listPrice?.toLocaleString()}`);
      console.log(`  Monthly: $${data.monthlyPayment?.toLocaleString()}`);
      if (data.reviewReasons) {
        console.log('  Issues:', data.reviewReasons);
      }
    });
  }

  // Check failed_properties collection
  const failedQuery = await db.collection('failed_properties')
    .orderBy('attemptedAt', 'desc')
    .limit(100)
    .get();

  console.log(`\n\nFailed properties in database: ${failedQuery.size}`);

  if (failedQuery.size > 0) {
    console.log('\nRecent failures:');

    // Group by failure reason
    const reasonCounts: Record<string, number> = {};

    failedQuery.docs.forEach(doc => {
      const data = doc.data();
      const reason = data.reason || 'Unknown';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });

    console.log('\nFailure reasons breakdown:');
    Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        console.log(`  ${reason}: ${count}`);
      });
  }

  // Sample some regular properties to check their financial data
  console.log('\n\n📊 Sampling regular properties to check financial validity...\n');

  const sampleQuery = await db.collection('properties')
    .limit(20)
    .get();

  let suspiciousCount = 0;
  const suspiciousProps: any[] = [];

  sampleQuery.docs.forEach(doc => {
    const data = doc.data();

    // Check for suspicious patterns
    const hasFinancials = data.monthlyPayment && data.listPrice && data.downPaymentPercent;

    if (hasFinancials) {
      const downPct = data.downPaymentPercent || 0;
      const rate = data.interestRate || 0;
      const payment = data.monthlyPayment || 0;
      const price = data.listPrice || 0;

      // Flag suspicious patterns
      if (downPct < 1 || downPct > 75 || rate < 3 || rate > 15 || payment <= 0) {
        suspiciousCount++;
        suspiciousProps.push({
          address: `${data.address}, ${data.city}, ${data.state}`,
          price: price,
          downPct: downPct,
          rate: rate,
          payment: payment,
          needsReview: data.needsReview || false
        });
      }
    }
  });

  console.log(`Suspicious properties found in sample: ${suspiciousCount}/${sampleQuery.size}`);

  if (suspiciousProps.length > 0) {
    console.log('\nSuspicious properties (should have been flagged):');
    suspiciousProps.forEach(prop => {
      console.log(`\n- ${prop.address}`);
      console.log(`  Price: $${prop.price.toLocaleString()}`);
      console.log(`  Down: ${prop.downPct}%`);
      console.log(`  Rate: ${prop.rate}%`);
      console.log(`  Payment: $${prop.payment}`);
      console.log(`  Flagged for review: ${prop.needsReview ? 'YES ✓' : 'NO ✗'}`);
    });
  }
}

checkValidationFlags().catch(console.error);
