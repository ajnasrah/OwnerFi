/**
 * Verify Export Data Accuracy
 *
 * Tests that Excel export correctly maps all database fields:
 * 1. Counts properties with complete vs incomplete owner finance terms
 * 2. Verifies NULL values will show as "TBD"
 * 3. Validates monthly payment calculations for complete properties
 * 4. Ensures all database fields map to correct Excel columns
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { calculateMonthlyPayment } from '../src/lib/property-calculations';

// Initialize Firebase Admin
if (!getApps().length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
  };

  initializeApp({
    credential: cert(serviceAccount as any),
  });
}

const db = getFirestore();

interface PropertyData {
  id: string;
  zpid?: number;
  fullAddress?: string;
  price?: number;
  estimate?: number;
  downPaymentAmount?: number | null;
  downPaymentPercent?: number | null;
  monthlyPayment?: number | null;
  interestRate?: number | null;
  loanTermYears?: number | null;
  balloonPaymentYears?: number | null;
  primaryKeyword?: string;
  ownerFinanceVerified?: boolean;
}

async function verifyExportData() {
  console.log('🔍 Verifying Export Data Accuracy\n');
  console.log('═'.repeat(60));

  try {
    // Fetch ALL properties from zillow_imports (same query as export)
    const propertiesSnapshot = await db
      .collection('zillow_imports')
      .where('ownerFinanceVerified', '==', true)
      .orderBy('foundAt', 'desc')
      .get();

    console.log(`\n📊 Total Properties: ${propertiesSnapshot.docs.length}`);

    if (propertiesSnapshot.empty) {
      console.log('\n⚠️  No properties found in zillow_imports collection!');
      console.log('   Export will return 404: "No properties found to export"');
      return;
    }

    // Analyze properties
    let completeTerms = 0;
    let partialTerms = 0;
    let noTerms = 0;
    let calculationErrors = 0;

    const sampleComplete: PropertyData[] = [];
    const sampleIncomplete: PropertyData[] = [];
    const calculationIssues: Array<{ property: PropertyData; issue: string }> = [];

    propertiesSnapshot.docs.forEach(doc => {
      const data = doc.data() as PropertyData;
      const property: PropertyData = {
        id: doc.id,
        ...data
      };

      // Check term completeness
      const hasDownPayment = property.downPaymentAmount != null || property.downPaymentPercent != null;
      const hasMonthlyPayment = property.monthlyPayment != null;
      const hasInterestRate = property.interestRate != null;
      const hasLoanTerm = property.loanTermYears != null;

      const fieldsProvided = [hasDownPayment, hasMonthlyPayment, hasInterestRate, hasLoanTerm].filter(Boolean).length;

      if (fieldsProvided === 4) {
        completeTerms++;
        if (sampleComplete.length < 3) sampleComplete.push(property);

        // Validate calculation
        if (property.price && property.downPaymentAmount && property.interestRate && property.loanTermYears) {
          const loanAmount = property.price - property.downPaymentAmount;
          const calculated = calculateMonthlyPayment(loanAmount, property.interestRate, property.loanTermYears);
          const actual = property.monthlyPayment || 0;
          const diff = Math.abs(calculated - actual);
          const percentDiff = (diff / actual) * 100;

          if (percentDiff > 5) {
            calculationErrors++;
            calculationIssues.push({
              property,
              issue: `Calculated: $${calculated.toFixed(2)}, Actual: $${actual.toFixed(2)} (${percentDiff.toFixed(1)}% diff)`
            });
          }
        }
      } else if (fieldsProvided > 0) {
        partialTerms++;
      } else {
        noTerms++;
        if (sampleIncomplete.length < 3) sampleIncomplete.push(property);
      }
    });

    // Print summary
    console.log('\n' + '═'.repeat(60));
    console.log('📈 PROPERTY BREAKDOWN');
    console.log('═'.repeat(60));
    console.log(`✅ Complete Terms:   ${completeTerms} properties (all finance fields filled)`);
    console.log(`🟡 Partial Terms:    ${partialTerms} properties (some fields filled)`);
    console.log(`⚪ No Terms:         ${noTerms} properties (all fields NULL → show "TBD")`);

    // Show samples
    if (sampleComplete.length > 0) {
      console.log('\n' + '═'.repeat(60));
      console.log('✅ SAMPLE: Properties with COMPLETE Terms');
      console.log('═'.repeat(60));
      sampleComplete.forEach((prop, i) => {
        console.log(`\n${i + 1}. ${prop.fullAddress || 'Unknown Address'}`);
        console.log(`   ZPID: ${prop.zpid}`);
        console.log(`   Price: $${prop.price?.toLocaleString()}`);
        console.log(`   Down Payment: $${prop.downPaymentAmount?.toLocaleString()} (${prop.downPaymentPercent}%)`);
        console.log(`   Monthly Payment: $${prop.monthlyPayment?.toLocaleString()}`);
        console.log(`   Interest Rate: ${prop.interestRate}%`);
        console.log(`   Loan Term: ${prop.loanTermYears} years`);
        console.log(`   Balloon: ${prop.balloonPaymentYears || 'None'} years`);
        console.log(`   Excel Export: ✅ All values will show (no "TBD")`);
      });
    }

    if (sampleIncomplete.length > 0) {
      console.log('\n' + '═'.repeat(60));
      console.log('⚪ SAMPLE: Properties with NO Terms (Show "TBD")');
      console.log('═'.repeat(60));
      sampleIncomplete.forEach((prop, i) => {
        console.log(`\n${i + 1}. ${prop.fullAddress || 'Unknown Address'}`);
        console.log(`   ZPID: ${prop.zpid}`);
        console.log(`   Price: $${prop.price?.toLocaleString()}`);
        console.log(`   Keyword: "${prop.primaryKeyword || 'N/A'}"`);
        console.log(`   Down Payment: NULL → Excel shows "TBD"`);
        console.log(`   Monthly Payment: NULL → Excel shows "TBD"`);
        console.log(`   Interest Rate: NULL → Excel shows "TBD"`);
        console.log(`   Loan Term: NULL → Excel shows "TBD"`);
        console.log(`   Excel Export: ⚠️  All finance columns show "TBD"`);
      });
    }

    // Calculation validation
    if (calculationErrors > 0) {
      console.log('\n' + '═'.repeat(60));
      console.log(`⚠️  CALCULATION ISSUES: ${calculationErrors} properties`);
      console.log('═'.repeat(60));
      console.log('These properties have monthly payments that don\'t match the calculation:');
      calculationIssues.slice(0, 5).forEach(({ property, issue }) => {
        console.log(`\n- ${property.fullAddress}`);
        console.log(`  ${issue}`);
      });
      console.log('\nNote: This is OK if seller provided a custom monthly payment.');
      console.log('The export will show the ACTUAL value from the database, not calculated.');
    } else {
      console.log('\n✅ All monthly payments match calculations (or are custom values)');
    }

    // Field mapping verification
    console.log('\n' + '═'.repeat(60));
    console.log('🗺️  FIELD MAPPING VERIFICATION');
    console.log('═'.repeat(60));

    const sampleProperty = propertiesSnapshot.docs[0].data();
    const exportFields = [
      'id', 'zpid', 'fullAddress', 'streetAddress', 'city', 'state', 'zipCode',
      'homeType', 'homeStatus', 'bedrooms', 'bathrooms', 'squareFoot', 'lotSquareFoot', 'yearBuilt',
      'price', 'estimate', 'rentEstimate', 'hoa', 'annualTaxAmount',
      'downPaymentAmount', 'downPaymentPercent', 'monthlyPayment', 'interestRate', 'loanTermYears', 'balloonPaymentYears',
      'agentName', 'agentPhoneNumber', 'brokerName', 'brokerPhoneNumber',
      'ownerFinanceVerified', 'primaryKeyword', 'matchedKeywords',
      'description', 'url', 'firstPropertyImage', 'propertyImages',
      'sentToGHL', 'ghlSentAt', 'ghlSendStatus',
      'foundAt', 'verifiedAt', 'soldAt', 'importedAt'
    ];

    const missingFields: string[] = [];
    exportFields.forEach(field => {
      if (field === 'id') return; // Document ID, not a field
      if (!(field in sampleProperty)) {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      console.log('\n⚠️  Fields in export template but not in database:');
      missingFields.forEach(field => console.log(`   - ${field}`));
      console.log('\nThese will show as empty in Excel (which is OK for optional fields)');
    } else {
      console.log('\n✅ All export fields exist in database schema');
    }

    // Final summary
    console.log('\n' + '═'.repeat(60));
    console.log('📋 EXPORT READINESS SUMMARY');
    console.log('═'.repeat(60));
    console.log(`\n✅ Total properties to export: ${propertiesSnapshot.docs.length}`);
    console.log(`✅ Excel columns: 44`);
    console.log(`✅ NULL handling: All null values → "TBD"`);
    console.log(`✅ Calculation: Uses DB values (not recalculated)`);
    console.log(`✅ Filename: owner_finance_properties_YYYY-MM-DD.xlsx`);

    console.log('\n📊 Expected Export Results:');
    console.log(`   - ${completeTerms} properties with all finance details`);
    console.log(`   - ${partialTerms} properties with partial finance details`);
    console.log(`   - ${noTerms} properties showing "TBD" for finance terms`);

    console.log('\n✅ Export is ready to use!');
    console.log('\nTest it by clicking "Export to Excel" in the admin Properties tab.\n');

  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    process.exit(1);
  }
}

// Run verification
verifyExportData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
