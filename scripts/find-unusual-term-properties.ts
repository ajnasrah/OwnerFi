/**
 * Find Properties with Unusual Term Years
 * Identifies properties with non-standard term years (not 15, 20, 25, 30)
 */

import admin from 'firebase-admin';

async function findUnusualTermProperties() {
  console.log('🔍 FINDING PROPERTIES WITH UNUSUAL TERM YEARS\n');
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

    console.log('\n📊 Querying ALL properties (not just active)...\n');

    // Get ALL properties
    const snapshot = await db.collection('properties').get();

    console.log(`Found ${snapshot.size} total properties\n`);

    // Standard term years (whole numbers)
    const standardTerms = [10, 15, 20, 25, 30, 40];

    // Find properties with unusual terms
    const unusualProperties: any[] = [];
    const termCounts: Record<number, number> = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      const termYears = data.termYears;

      // Count all terms
      if (termYears !== undefined && termYears !== null) {
        termCounts[termYears] = (termCounts[termYears] || 0) + 1;

        // Check if term is unusual
        // Unusual = has decimal places OR not in standard list
        const isDecimal = termYears % 1 !== 0;
        const isNonStandard = !standardTerms.includes(Math.floor(termYears));
        const isVeryHigh = termYears > 40;
        const isVeryLow = termYears < 10;

        if (isDecimal || isNonStandard || isVeryHigh || isVeryLow) {
          unusualProperties.push({
            id: doc.id,
            address: data.address || 'Unknown',
            city: data.city || 'Unknown',
            state: data.state || 'Unknown',
            price: data.listPrice || data.price,
            monthlyPayment: data.monthlyPayment,
            interestRate: data.interestRate,
            termYears: termYears,
            downPayment: data.downPaymentAmount,
            downPaymentPercent: data.downPaymentPercent,
            source: data.source || 'unknown',
            isActive: data.isActive,
            createdAt: data.createdAt?.toDate?.() || null,
            isDecimal,
            isNonStandard,
            isVeryHigh,
            isVeryLow
          });
        }
      }
    });

    // Sort by term years (highest to lowest)
    unusualProperties.sort((a, b) => b.termYears - a.termYears);

    // Show all term years distribution
    console.log('📈 ALL TERM YEARS IN DATABASE:');
    console.log('-'.repeat(80));

    const sortedTerms = Object.keys(termCounts)
      .map(Number)
      .sort((a, b) => a - b);

    sortedTerms.forEach(term => {
      const count = termCounts[term];
      const percentage = ((count / snapshot.size) * 100).toFixed(1);
      const isStandard = standardTerms.includes(term);
      const marker = isStandard ? ' ' : '⚠️';
      console.log(`  ${marker} ${term.toString().padStart(6)} years: ${count.toString().padStart(4)} properties (${percentage.padStart(5)}%)`);
    });

    // Show unusual properties
    console.log(`\n\n🚨 PROPERTIES WITH UNUSUAL TERM YEARS (${unusualProperties.length} found):`);
    console.log('='.repeat(80));

    if (unusualProperties.length === 0) {
      console.log('\n✅ No properties with unusual term years found!');
      console.log('   All properties have standard terms (10, 15, 20, 25, 30, 40 years)');
    } else {
      unusualProperties.forEach((prop, index) => {
        console.log(`\n${index + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
        console.log(`   Property ID: ${prop.id}`);
        console.log(`   Status: ${prop.isActive ? 'ACTIVE ✅' : 'Inactive'}`);
        console.log(`   Price: $${prop.price?.toLocaleString() || 'N/A'}`);
        console.log(`   Monthly Payment: $${prop.monthlyPayment?.toLocaleString() || 'N/A'}`);
        console.log(`   Interest Rate: ${prop.interestRate || 'N/A'}%`);
        console.log(`   Term Years: ${prop.termYears} ⚠️`);
        console.log(`   Down Payment: $${prop.downPayment?.toLocaleString() || 'N/A'} (${prop.downPaymentPercent?.toFixed(1) || 'N/A'}%)`);
        console.log(`   Source: ${prop.source}`);
        console.log(`   Created: ${prop.createdAt ? prop.createdAt.toLocaleString() : 'Unknown'}`);

        // Show why it's unusual
        const reasons: string[] = [];
        if (prop.isDecimal) reasons.push('Has decimal places');
        if (prop.isVeryHigh) reasons.push('Unusually high (>40 years)');
        if (prop.isVeryLow) reasons.push('Unusually low (<10 years)');
        if (prop.isNonStandard && !prop.isVeryHigh && !prop.isVeryLow) {
          reasons.push('Non-standard term');
        }
        console.log(`   Issue: ${reasons.join(', ')}`);

        // Calculate what term SHOULD be if recalculated
        if (prop.monthlyPayment && prop.price && prop.downPayment && prop.interestRate) {
          const loanAmount = prop.price - prop.downPayment;
          const monthlyRate = prop.interestRate / 100 / 12;

          // Reverse calculate term from payment
          if (monthlyRate > 0 && prop.monthlyPayment > 0) {
            const numPayments = Math.log(prop.monthlyPayment / (prop.monthlyPayment - loanAmount * monthlyRate)) / Math.log(1 + monthlyRate);
            const calculatedTerm = numPayments / 12;

            if (Math.abs(calculatedTerm - prop.termYears) > 1) {
              console.log(`   ⚠️  Calculated term from payment: ${calculatedTerm.toFixed(1)} years (${Math.abs(calculatedTerm - prop.termYears).toFixed(1)} year difference)`);
            }
          }
        }
      });
    }

    // Summary
    console.log('\n\n📊 SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total Properties: ${snapshot.size}`);
    console.log(`Unusual Terms: ${unusualProperties.length} (${((unusualProperties.length / snapshot.size) * 100).toFixed(1)}%)`);
    console.log(`Standard Terms: ${snapshot.size - unusualProperties.length} (${(((snapshot.size - unusualProperties.length) / snapshot.size) * 100).toFixed(1)}%)`);

    const activeUnusual = unusualProperties.filter(p => p.isActive).length;
    if (activeUnusual > 0) {
      console.log(`\n⚠️  ${activeUnusual} unusual term properties are ACTIVE and visible to users`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (admin.apps.length > 0) {
      await admin.app().delete();
    }
  }
}

findUnusualTermProperties();
