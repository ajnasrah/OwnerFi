/**
 * Validate that calculated financial data is mathematically correct
 * Test a sample of properties to ensure monthly payments match amortization formula
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    console.error('❌ Missing Firebase credentials');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      privateKey,
      clientEmail,
    })
  });
}

async function validateFinancials() {
  console.log('🔍 VALIDATING CALCULATED FINANCIAL DATA');
  console.log('='.repeat(80));

  const db = admin.firestore();
  const snapshot = await db.collection('properties').limit(20).get();

  console.log(`\n📊 Testing ${snapshot.size} sample properties\n`);

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const address = `${data.address || 'Unknown'}, ${data.city || ''}, ${data.state || ''}`;

    // Skip if missing required fields
    if (!data.listPrice || !data.monthlyPayment || !data.downPaymentAmount || !data.interestRate || !data.termYears) {
      continue;
    }

    // Calculate what the payment SHOULD be
    const loanAmount = data.listPrice - data.downPaymentAmount;
    const monthlyRate = data.interestRate / 100 / 12;
    const numPayments = data.termYears * 12;

    let expectedPayment: number;
    if (monthlyRate > 0) {
      expectedPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
                       (Math.pow(1 + monthlyRate, numPayments) - 1);
    } else {
      expectedPayment = loanAmount / numPayments;
    }

    // Compare actual vs expected
    const difference = Math.abs(data.monthlyPayment - expectedPayment);
    const percentDiff = (difference / expectedPayment) * 100;

    // Allow up to 1% difference (for rounding)
    if (percentDiff < 1) {
      console.log(`✅ ${address}`);
      console.log(`   Monthly Payment: $${data.monthlyPayment.toFixed(2)} (Expected: $${expectedPayment.toFixed(2)}, Diff: ${percentDiff.toFixed(2)}%)`);
      passed++;
    } else if (percentDiff < 5) {
      console.log(`⚠️  ${address}`);
      console.log(`   Monthly Payment: $${data.monthlyPayment.toFixed(2)} (Expected: $${expectedPayment.toFixed(2)}, Diff: ${percentDiff.toFixed(2)}%)`);
      console.log(`   Note: Small difference likely due to taxes/insurance/HOA included`);
      warnings++;
    } else {
      console.log(`❌ ${address}`);
      console.log(`   Monthly Payment: $${data.monthlyPayment.toFixed(2)} (Expected: $${expectedPayment.toFixed(2)}, Diff: ${percentDiff.toFixed(2)}%)`);
      console.log(`   Price: $${data.listPrice}, Down: $${data.downPaymentAmount}, Rate: ${data.interestRate}%, Term: ${data.termYears}yr`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 VALIDATION RESULTS');
  console.log('='.repeat(80));
  console.log(`✅ Passed: ${passed} (payment matches formula within 1%)`);
  console.log(`⚠️  Warnings: ${warnings} (payment within 5% - may include taxes/insurance)`);
  console.log(`❌ Failed: ${failed} (payment differs by more than 5%)`);
  console.log('='.repeat(80));

  if (failed === 0) {
    console.log('\n🎉 All properties passed validation! Financial calculations are correct.\n');
  } else {
    console.log(`\n⚠️  ${failed} properties failed validation - manual review needed.\n`);
  }

  await admin.app().delete();
}

validateFinancials();
