/**
 * Check Database Property Terms
 * Verifies what term years are actually stored in production database
 */

import admin from 'firebase-admin';

async function checkDatabaseTerms() {
  console.log('📊 CHECKING DATABASE PROPERTY TERMS\n');
  console.log('='.repeat(80));

  try {
    // Initialize Firebase Admin
    if (admin.apps.length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

      if (!projectId || !privateKey || !clientEmail) {
        console.error('❌ Missing Firebase credentials');
        console.error('   Required: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
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

    // Get active properties
    console.log('\n🔍 Querying active properties...\n');

    const snapshot = await db.collection('properties')
      .where('isActive', '==', true)
      .limit(100)
      .get();

    console.log(`Found ${snapshot.size} active properties\n`);

    // Analyze term distribution
    const termDistribution: Record<number, number> = {};
    const properties: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const termYears = data.termYears || 0;

      termDistribution[termYears] = (termDistribution[termYears] || 0) + 1;

      properties.push({
        id: doc.id,
        address: data.address || 'Unknown',
        city: data.city || 'Unknown',
        price: data.listPrice || data.price,
        monthlyPayment: data.monthlyPayment,
        interestRate: data.interestRate,
        termYears: data.termYears,
        downPayment: data.downPaymentPercent,
        source: data.source || 'unknown',
        createdAt: data.createdAt?.toDate?.() || null
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

    // Show recent properties
    console.log('\n📋 RECENT PROPERTIES (Last 10):');
    console.log('='.repeat(80));

    // Sort by createdAt if available
    const sortedProps = properties
      .filter(p => p.createdAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    if (sortedProps.length === 0) {
      console.log('\n⚠️  No properties with createdAt timestamp found.');
      console.log('   Showing first 10 properties instead:\n');

      properties.slice(0, 10).forEach((prop, index) => {
        console.log(`\n${index + 1}. ${prop.address}, ${prop.city}`);
        console.log(`   Price: $${prop.price?.toLocaleString() || 'N/A'}`);
        console.log(`   Monthly: $${prop.monthlyPayment?.toLocaleString() || 'N/A'}`);
        console.log(`   Rate: ${prop.interestRate || 'N/A'}%`);
        console.log(`   Term: ${prop.termYears || 'N/A'} years`);
        console.log(`   Down: ${prop.downPayment || 'N/A'}%`);
        console.log(`   Source: ${prop.source}`);
      });
    } else {
      sortedProps.forEach((prop, index) => {
        console.log(`\n${index + 1}. ${prop.address}, ${prop.city}`);
        console.log(`   Price: $${prop.price?.toLocaleString() || 'N/A'}`);
        console.log(`   Monthly: $${prop.monthlyPayment?.toLocaleString() || 'N/A'}`);
        console.log(`   Rate: ${prop.interestRate || 'N/A'}%`);
        console.log(`   Term: ${prop.termYears || 'N/A'} years`);
        console.log(`   Down: ${prop.downPayment || 'N/A'}%`);
        console.log(`   Source: ${prop.source}`);
        console.log(`   Created: ${prop.createdAt.toLocaleString()}`);
      });
    }

    // Analysis
    console.log('\n\n📊 ANALYSIS:');
    console.log('='.repeat(80));

    const allTwenty = Object.keys(termDistribution).length === 1 && termDistribution[20] === snapshot.size;
    if (allTwenty) {
      console.log('⚠️  ALL properties have 20-year terms!');
      console.log('   This confirms the hardcoded term issue existed.');
      console.log('   ❗ Fix has been deployed but no new properties uploaded yet.');
    } else {
      console.log('✅ Properties have varied term years.');
      console.log('   The fix is working or properties were added with different terms.');
    }

    const twentyPercent = ((termDistribution[20] || 0) / snapshot.size) * 100;
    if (twentyPercent > 80 && twentyPercent < 100) {
      console.log(`\n⚠️  ${twentyPercent.toFixed(1)}% of properties have 20-year terms.`);
      console.log('   This suggests most properties were uploaded before the fix.');
    }

    console.log('\n📝 NEXT STEPS:');
    console.log('-'.repeat(80));
    console.log('1. Upload a test CSV with different term years (15, 25, 30)');
    console.log('2. Re-run this script to verify new properties have correct terms');
    console.log('3. If needed, re-upload existing properties with correct terms');

    console.log('\n' + '='.repeat(80));
    console.log('');

  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    // Clean up
    if (admin.apps.length > 0) {
      await admin.app().delete();
    }
  }
}

checkDatabaseTerms();
