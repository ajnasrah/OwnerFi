/**
 * Investigate 6710 Blanco St Property
 * Why does it have 94.5 year term when GHL shows 20 years?
 */

import admin from 'firebase-admin';

async function investigateBlancoProperty() {
  console.log('🔍 INVESTIGATING 6710 BLANCO ST PROPERTY\n');
  console.log('='.repeat(80));

  try {
    // Initialize Firebase Admin
    if (admin.apps.length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

      if (!projectId || !privateKey || !clientEmail) {
        console.error('❌ Missing Firebase credentials');
        return;
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey,
          clientEmail,
        })
      });
    }

    const db = admin.firestore();

    console.log('\n🔍 Searching for 6710 Blanco St...\n');

    // Search by address
    const snapshot = await db.collection('properties')
      .where('address', '>=', '6710 Blanco')
      .where('address', '<=', '6710 Blanco\uf8ff')
      .get();

    if (snapshot.empty) {
      console.log('❌ Property not found by address search');
      console.log('   Trying broader search...\n');

      // Try searching in city Edinburg
      const citySnapshot = await db.collection('properties')
        .where('city', '==', 'edinburg')
        .get();

      console.log(`Found ${citySnapshot.size} properties in Edinburg\n`);

      citySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.address?.includes('Blanco')) {
          console.log('✅ FOUND PROPERTY!');
          console.log('='.repeat(80));
          printPropertyDetails(doc.id, data);
        }
      });
    } else {
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('✅ FOUND PROPERTY!');
        console.log('='.repeat(80));
        printPropertyDetails(doc.id, data);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (admin.apps.length > 0) {
      await admin.app().delete();
    }
  }
}

function printPropertyDetails(docId: string, data: any) {
  console.log('\n📋 PROPERTY DETAILS:');
  console.log('-'.repeat(80));
  console.log(`Property ID: ${docId}`);
  console.log(`Address: ${data.address || 'N/A'}`);
  console.log(`City: ${data.city || 'N/A'}`);
  console.log(`State: ${data.state || 'N/A'}`);
  console.log(`Zip: ${data.zipCode || 'N/A'}`);
  console.log(`Status: ${data.isActive ? 'ACTIVE ✅' : 'Inactive'}`);

  console.log('\n💰 FINANCIAL DATA:');
  console.log('-'.repeat(80));
  console.log(`List Price: $${data.listPrice?.toLocaleString() || data.price?.toLocaleString() || 'N/A'}`);
  console.log(`Monthly Payment: $${data.monthlyPayment?.toLocaleString() || 'N/A'}`);
  console.log(`Interest Rate: ${data.interestRate || 'N/A'}%`);
  console.log(`Term Years: ${data.termYears} ⚠️`);
  console.log(`Down Payment: $${data.downPaymentAmount?.toLocaleString() || 'N/A'} (${data.downPaymentPercent?.toFixed(1) || 'N/A'}%)`);
  console.log(`Balloon Years: ${data.balloonYears || 'N/A'}`);

  console.log('\n📊 CALCULATED LOAN INFO:');
  console.log('-'.repeat(80));
  const price = data.listPrice || data.price;
  const downPayment = data.downPaymentAmount;
  const loanAmount = price && downPayment ? price - downPayment : null;
  console.log(`Loan Amount: $${loanAmount?.toLocaleString() || 'N/A'}`);

  console.log('\n🔍 SOURCE & METADATA:');
  console.log('-'.repeat(80));
  console.log(`Source: ${data.source || 'unknown'}`);
  console.log(`Created At: ${data.createdAt?.toDate?.()?.toLocaleString() || 'Unknown'}`);
  console.log(`Updated At: ${data.updatedAt?.toDate?.()?.toLocaleString() || 'Unknown'}`);
  console.log(`Opportunity Name: ${data.opportunityName || 'N/A'}`);

  console.log('\n🧮 AMORTIZATION VERIFICATION:');
  console.log('-'.repeat(80));

  if (data.monthlyPayment && loanAmount && data.interestRate) {
    // Verify what term this monthly payment actually represents
    const monthlyRate = data.interestRate / 100 / 12;
    const payment = data.monthlyPayment;

    console.log(`Given Monthly Payment: $${payment.toLocaleString()}`);
    console.log(`Loan Amount: $${loanAmount.toLocaleString()}`);
    console.log(`Interest Rate: ${data.interestRate}%`);
    console.log(`Stored Term: ${data.termYears} years`);

    // Calculate what the payment SHOULD be for standard terms
    console.log('\n📐 What monthly payment SHOULD be for different terms:');

    const standardTerms = [10, 15, 20, 25, 30];
    standardTerms.forEach(term => {
      const numPayments = term * 12;
      const calculatedPayment = monthlyRate > 0
        ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
        : loanAmount / numPayments;

      const diff = Math.abs(calculatedPayment - payment);
      const match = diff < 10 ? '✅ MATCH!' : '';

      console.log(`   ${term} years: $${calculatedPayment.toFixed(2).padStart(10)} (diff: $${diff.toFixed(2).padStart(8)}) ${match}`);
    });

    // Reverse calculate what term the payment represents
    console.log('\n🔄 REVERSE CALCULATION - What term does this payment represent?');

    if (monthlyRate > 0 && payment > loanAmount * monthlyRate) {
      const numPayments = Math.log(payment / (payment - loanAmount * monthlyRate)) / Math.log(1 + monthlyRate);
      const calculatedTerm = numPayments / 12;

      console.log(`   Based on the $${payment} payment:`);
      console.log(`   Calculated Term: ${calculatedTerm.toFixed(1)} years`);
      console.log(`   Stored Term: ${data.termYears} years`);
      console.log(`   Difference: ${Math.abs(calculatedTerm - data.termYears).toFixed(1)} years`);

      if (Math.abs(calculatedTerm - 20) < 1) {
        console.log('\n   ✅ The payment matches a 20-year term (as GHL says)!');
        console.log(`   ⚠️  But database has ${data.termYears} years stored incorrectly`);
      }
    } else {
      console.log('   ⚠️  Cannot calculate term - payment too low or rate is 0');
    }

    // Check if it was calculated with wrong term
    console.log('\n❓ WHY IS IT WRONG?');
    console.log('-'.repeat(80));

    // Possibility 1: Reverse calculation error
    const reverseCalcTerm = monthlyRate > 0 && payment > loanAmount * monthlyRate
      ? Math.log(payment / (payment - loanAmount * monthlyRate)) / Math.log(1 + monthlyRate) / 12
      : null;

    if (reverseCalcTerm && Math.abs(reverseCalcTerm - data.termYears) < 0.5) {
      console.log('🔴 LIKELY CAUSE: Payment was provided, system tried to reverse-calculate term');
      console.log('   The calculation logic may have an error causing incorrect term calculation');
    }

    // Possibility 2: Data corruption
    if (Math.abs(data.termYears - 20) > 50) {
      console.log('🔴 LIKELY CAUSE: Data corruption or calculation overflow');
      console.log('   Term is way off from any reasonable value');
    }

  }

  console.log('\n' + '='.repeat(80));
}

investigateBlancoProperty();
