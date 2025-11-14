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

async function analyzeFlaggedProperties() {
  console.log('🔍 Analyzing flagged properties to understand validation issues...\n');

  // Get properties flagged for review
  const flaggedQuery = await db.collection('properties')
    .where('needsReview', '==', true)
    .limit(20)
    .get();

  console.log(`Found ${flaggedQuery.size} flagged properties\n`);
  console.log('='.repeat(100));

  let paymentIssueCount = 0;
  let likelyTaxesInsurance = 0;
  let zeroInterestRate = 0;
  let hasAmortizationSchedule = 0;

  flaggedQuery.docs.forEach((doc, idx) => {
    const data = doc.data();

    console.log(`\n${idx + 1}. ${data.address}, ${data.city}, ${data.state}`);
    console.log(`   Source: ${data.source || 'unknown'}`);
    console.log(`   Price: $${(data.listPrice || data.price)?.toLocaleString()}`);
    console.log(`   Down Payment: $${data.downPaymentAmount?.toLocaleString()} (${data.downPaymentPercent?.toFixed(1)}%)`);
    console.log(`   Monthly Payment: $${data.monthlyPayment?.toLocaleString()}`);
    console.log(`   Interest Rate: ${data.interestRate}%`);
    console.log(`   Term Years: ${data.termYears}`);

    // Check for amortization schedule field
    if (data.amortizationSchedule) {
      console.log(`   Amortization Schedule: ${data.amortizationSchedule}`);
      hasAmortizationSchedule++;
    }

    // Check for balloon payment
    if (data.balloonYears || data.balloonPayment) {
      console.log(`   Balloon: ${data.balloonYears} years, Payment: $${data.balloonPayment?.toLocaleString()}`);
    }

    // Calculate expected P&I
    const price = data.listPrice || data.price || 0;
    const downPayment = data.downPaymentAmount || 0;
    const loanAmount = price - downPayment;
    const rate = data.interestRate || 0;
    const term = data.termYears || 0;

    if (loanAmount > 0 && rate > 0 && term > 0) {
      const monthlyRate = rate / 100 / 12;
      const numPayments = term * 12;
      const calculatedPI = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
                          (Math.pow(1 + monthlyRate, numPayments) - 1);

      const actualPayment = data.monthlyPayment || 0;
      const diff = actualPayment - calculatedPI;
      const percentDiff = (diff / calculatedPI) * 100;

      console.log(`   Calculated P&I: $${calculatedPI.toFixed(0)}`);
      console.log(`   Difference: $${diff.toFixed(0)} (${percentDiff.toFixed(1)}% higher)`);

      if (percentDiff > 10 && percentDiff <= 50) {
        console.log(`   ✓ Likely includes taxes/insurance (${percentDiff.toFixed(0)}% higher)`);
        likelyTaxesInsurance++;
      } else if (percentDiff > 50) {
        console.log(`   ⚠️  WAY too high - possible data error (${percentDiff.toFixed(0)}% higher)`);
        paymentIssueCount++;
      }
    } else if (rate === 0) {
      console.log(`   ⚠️  Interest rate is 0% - cannot calculate P&I`);
      zeroInterestRate++;
    }

    // Show first 3 validation issues
    if (data.reviewReasons && data.reviewReasons.length > 0) {
      console.log(`   Issues (${data.reviewReasons.length} total):`);
      data.reviewReasons.slice(0, 3).forEach((reason: any) => {
        const icon = reason.severity === 'error' ? '❌' : reason.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`     ${icon} ${reason.field}: ${reason.issue}`);
      });
      if (data.reviewReasons.length > 3) {
        console.log(`     ... and ${data.reviewReasons.length - 3} more`);
      }
    }
  });

  console.log('\n' + '='.repeat(100));
  console.log('SUMMARY');
  console.log('='.repeat(100));
  console.log(`Total flagged: ${flaggedQuery.size}`);
  console.log(`Properties with 0% interest rate: ${zeroInterestRate}`);
  console.log(`Properties likely including taxes/insurance: ${likelyTaxesInsurance}`);
  console.log(`Properties with payment issues: ${paymentIssueCount}`);
  console.log(`Properties with amortizationSchedule field: ${hasAmortizationSchedule}`);
}

analyzeFlaggedProperties().catch(console.error);
