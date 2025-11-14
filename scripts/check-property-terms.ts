/**
 * Check Property Terms in Database
 * Verifies what term years are actually stored for properties
 */

import { getAdminDb } from '../src/lib/firebase-admin';

async function checkPropertyTerms() {
  console.log('📊 CHECKING PROPERTY TERMS IN DATABASE\n');
  console.log('='.repeat(80));

  try {
    const firestore = await getAdminDb();

    if (!firestore) {
      console.error('❌ Failed to initialize Firebase Admin SDK');
      console.error('   Make sure FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL are set');
      return;
    }

    const propertiesRef = firestore.collection('properties');

    // Get active properties
    const snapshot = await propertiesRef
      .where('isActive', '==', true)
      .limit(50)
      .get();

    console.log(`\nFound ${snapshot.size} active properties\n`);

    // Analyze term distribution
    const termDistribution: Record<number, number> = {};
    const properties: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const termYears = data.termYears || 0;

      termDistribution[termYears] = (termDistribution[termYears] || 0) + 1;

      properties.push({
        id: doc.id,
        address: data.address,
        city: data.city,
        listPrice: data.listPrice || data.price,
        monthlyPayment: data.monthlyPayment,
        interestRate: data.interestRate,
        termYears: data.termYears,
        downPaymentAmount: data.downPaymentAmount,
        source: data.source || 'unknown'
      });
    });

    // Show term distribution
    console.log('📈 TERM YEARS DISTRIBUTION:');
    console.log('-'.repeat(80));

    const sortedTerms = Object.keys(termDistribution)
      .map(Number)
      .sort((a, b) => a - b);

    sortedTerms.forEach(term => {
      const count = termDistribution[term];
      const percentage = ((count / snapshot.size) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(count / 2));
      console.log(`  ${term.toString().padStart(2)} years: ${count.toString().padStart(3)} properties (${percentage.padStart(5)}%) ${bar}`);
    });

    // Show sample properties
    console.log('\n📋 SAMPLE PROPERTIES:');
    console.log('='.repeat(80));

    properties.slice(0, 10).forEach((prop, index) => {
      console.log(`\n${index + 1}. ${prop.address}, ${prop.city}`);
      console.log(`   Price: $${prop.listPrice?.toLocaleString() || 'N/A'}`);
      console.log(`   Monthly Payment: $${prop.monthlyPayment?.toLocaleString() || 'N/A'}`);
      console.log(`   Interest Rate: ${prop.interestRate || 'N/A'}%`);
      console.log(`   Term: ${prop.termYears || 'N/A'} years`);
      console.log(`   Down Payment: $${prop.downPaymentAmount?.toLocaleString() || 'N/A'}`);
      console.log(`   Source: ${prop.source}`);

      // Verify calculation if we have all data
      if (prop.listPrice && prop.monthlyPayment && prop.interestRate && prop.termYears && prop.downPaymentAmount) {
        const loanAmount = prop.listPrice - prop.downPaymentAmount;
        const monthlyRate = prop.interestRate / 100 / 12;
        const numPayments = prop.termYears * 12;

        const expectedPayment = monthlyRate > 0
          ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
          : loanAmount / numPayments;

        const diff = Math.abs(expectedPayment - prop.monthlyPayment);
        const percentDiff = (diff / prop.monthlyPayment) * 100;

        console.log(`   ✓ Calculated Payment: $${expectedPayment.toFixed(2)}`);
        console.log(`   ✓ Difference: $${diff.toFixed(2)} (${percentDiff.toFixed(1)}%) ${percentDiff < 1 ? '✅' : percentDiff < 5 ? '⚠️' : '❌'}`);
      }
    });

    // Analysis
    console.log('\n\n📊 ANALYSIS:');
    console.log('='.repeat(80));

    const allTwenty = Object.keys(termDistribution).length === 1 && termDistribution[20] === snapshot.size;
    if (allTwenty) {
      console.log('⚠️  ALL properties have 20-year terms!');
      console.log('   This confirms the hardcoded term issue in upload API.');
    } else {
      console.log('✅ Properties have varied term years.');
      console.log('   This suggests the issue may have been fixed or properties were added manually.');
    }

    const twentyPercent = ((termDistribution[20] || 0) / snapshot.size) * 100;
    if (twentyPercent > 80) {
      console.log(`\n⚠️  ${twentyPercent.toFixed(1)}% of properties have 20-year terms.`);
      console.log('   This is unusually high and suggests hardcoded default.');
    }

    console.log('\n' + '='.repeat(80));
    console.log('');

  } catch (error) {
    console.error('Error checking property terms:', error);
  }
}

checkPropertyTerms();
