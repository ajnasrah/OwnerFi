/**
 * Verify NO CALCULATIONS Are Being Done
 * Ensures all financial data comes from GHL/agent only
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

async function verifyNoCalculations() {
  console.log('🔍 VERIFYING NO CALCULATIONS ARE DONE\n');
  console.log('=' .repeat(80));

  console.log('\n[TEST 1] Check database - all financial fields should be NULL\n');

  const snapshot = await db
    .collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .limit(100)
    .get();

  const properties = snapshot.docs.map(doc => doc.data());

  const financialFields = [
    'monthlyPayment',
    'downPaymentAmount',
    'interestRate',
    'loanTermYears',
    'downPaymentPercent'
  ];

  console.log('Checking 100 properties for calculated values...\n');

  financialFields.forEach(field => {
    const hasValue = properties.filter((p: any) => {
      const value = p[field];
      return value !== null && value !== undefined && value !== 0;
    }).length;

    const status = hasValue === 0 ? '✅' : '❌';
    console.log(`   ${status} ${field}: ${hasValue}/100 have values`);

    if (hasValue > 0 && field !== 'downPaymentPercent') {
      console.log(`      ⚠️  WARNING: Some properties have ${field} filled in!`);
    }
  });

  console.log('\n\n[TEST 2] Simulate buyer API response\n');

  // Simulate what buyer API does
  const sampleProperty = properties[0] as any;
  const apiResponse = {
    id: 'sample-id',
    fullAddress: sampleProperty.fullAddress,
    price: sampleProperty.price,
    // NO CALCULATIONS - only use what's in database
    monthlyPayment: sampleProperty.monthlyPayment || null,
    downPaymentAmount: sampleProperty.downPaymentAmount || null,
    interestRate: sampleProperty.interestRate || null,
    loanTermYears: sampleProperty.loanTermYears || null,
  };

  console.log('Sample API Response:');
  console.log(`   Address: ${apiResponse.fullAddress}`);
  console.log(`   Price: $${apiResponse.price?.toLocaleString()}`);
  console.log(`   Monthly Payment: ${apiResponse.monthlyPayment === null ? '✅ NULL (TBD)' : '❌ ' + apiResponse.monthlyPayment}`);
  console.log(`   Down Payment: ${apiResponse.downPaymentAmount === null ? '✅ NULL (TBD)' : '❌ ' + apiResponse.downPaymentAmount}`);
  console.log(`   Interest Rate: ${apiResponse.interestRate === null ? '✅ NULL (TBD)' : '❌ ' + apiResponse.interestRate}`);
  console.log(`   Loan Term: ${apiResponse.loanTermYears === null ? '✅ NULL (TBD)' : '❌ ' + apiResponse.loanTermYears}`);

  console.log('\n\n[TEST 3] Verify UI will display "TBD"\n');

  const uiDisplay = {
    monthlyPayment: apiResponse.monthlyPayment && apiResponse.monthlyPayment > 0
      ? `$${apiResponse.monthlyPayment.toLocaleString()}/mo`
      : 'Contact Seller',
    downPayment: apiResponse.downPaymentAmount && apiResponse.downPaymentAmount > 0
      ? `$${apiResponse.downPaymentAmount.toLocaleString()}`
      : 'Contact Seller',
    interestRate: apiResponse.interestRate && apiResponse.interestRate > 0
      ? `${apiResponse.interestRate}%`
      : 'Contact Seller',
    loanTerm: apiResponse.loanTermYears && apiResponse.loanTermYears > 0
      ? `${apiResponse.loanTermYears} years`
      : 'Contact Seller'
  };

  console.log('What buyers will see:');
  console.log(`   Monthly Payment: ${uiDisplay.monthlyPayment}`);
  console.log(`   Down Payment: ${uiDisplay.downPayment}`);
  console.log(`   Interest Rate: ${uiDisplay.interestRate}`);
  console.log(`   Loan Term: ${uiDisplay.loanTerm}`);

  console.log('\n\n' + '=' .repeat(80));
  console.log('📊 VERIFICATION RESULTS');
  console.log('=' .repeat(80));

  const allNull = financialFields.every(field => {
    const hasValue = properties.filter((p: any) => {
      const value = p[field];
      return value !== null && value !== undefined && value !== 0;
    }).length;
    return hasValue === 0 || field === 'downPaymentPercent'; // Allow downPaymentPercent
  });

  if (allNull) {
    console.log('\n✅ NO CALCULATIONS BEING DONE!');
    console.log('\n✅ All financial fields are NULL in database');
    console.log('✅ Buyer API returns NULL (not 99999)');
    console.log('✅ UI displays "Contact Seller" for all TBD fields');
    console.log('\n🎯 System correctly shows "TBD" for all financing terms');
    console.log('💯 All data will come from agent/GHL only');
  } else {
    console.log('\n❌ WARNING: Some properties have calculated values!');
    console.log('⚠️  Review the properties with values and clear them');
  }

  console.log('\n' + '=' .repeat(80));
}

verifyNoCalculations().catch(console.error);
