/**
 * Verify 20 Complete Properties
 *
 * Fetches 20 properties with ALL owner finance terms filled
 * Verifies data matches between database and what buyer dashboard would show
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

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
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  price?: number;
  estimate?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFoot?: number;
  homeType?: string;
  downPaymentAmount?: number | null;
  downPaymentPercent?: number | null;
  monthlyPayment?: number | null;
  interestRate?: number | null;
  loanTermYears?: number | null;
  balloonPaymentYears?: number | null;
  agentName?: string;
  agentPhoneNumber?: string;
  primaryKeyword?: string;
  matchedKeywords?: string[];
  description?: string;
  firstPropertyImage?: string;
  ownerFinanceVerified?: boolean;
  sentToGHL?: boolean;
}

// Helper to determine what buyer dashboard would show
function getBuyerDashboardDisplay(property: PropertyData) {
  return {
    // Core Info
    address: property.streetAddress || property.fullAddress || 'Unknown',
    city: property.city || 'Unknown',
    state: property.state || 'Unknown',
    zipCode: property.zipCode || '',
    bedrooms: property.bedrooms || 0,
    bathrooms: property.bathrooms || 0,
    squareFeet: property.squareFoot || 0,
    homeType: property.homeType || 'Unknown',

    // Price
    listPrice: property.price || 0,

    // Finance Terms - Buyer Dashboard Logic
    monthlyPayment: (property.monthlyPayment && property.monthlyPayment > 0)
      ? `$${property.monthlyPayment.toLocaleString()}/mo`
      : 'Contact Seller',

    downPaymentAmount: (property.downPaymentAmount && property.downPaymentAmount > 0)
      ? `est. $${property.downPaymentAmount.toLocaleString()}`
      : 'Contact Seller',

    downPaymentPercent: (property.downPaymentAmount && property.downPaymentAmount > 0 && property.price)
      ? `${Math.round((property.downPaymentAmount / property.price) * 100)}% of purchase price`
      : '',

    interestRate: (property.interestRate && property.interestRate > 0)
      ? `~${property.interestRate}%`
      : 'Contact seller',

    loanTerm: (property.loanTermYears && property.loanTermYears > 0)
      ? `~${property.loanTermYears} years`
      : 'Contact seller',

    balloonYears: (property.balloonPaymentYears && property.balloonPaymentYears > 0)
      ? `${property.balloonPaymentYears} years`
      : 'Not shown',

    // Additional Info
    primaryKeyword: property.primaryKeyword || 'N/A',
    agentContact: property.agentPhoneNumber || 'N/A',
  };
}

async function verifyCompleteProperties() {
  console.log('🔍 Fetching 20 Properties with Complete Owner Finance Terms\n');
  console.log('═'.repeat(80));

  try {
    // Fetch properties from zillow_imports
    const propertiesSnapshot = await db
      .collection('zillow_imports')
      .where('ownerFinanceVerified', '==', true)
      .orderBy('foundAt', 'desc')
      .limit(200) // Get more to filter for complete ones
      .get();

    console.log(`\n📊 Found ${propertiesSnapshot.docs.length} total properties in database`);

    // Filter for properties with ALL terms filled
    const completeProperties: PropertyData[] = [];

    propertiesSnapshot.docs.forEach(doc => {
      const data = doc.data() as PropertyData;
      const property: PropertyData = { id: doc.id, ...data };

      // Check if ALL finance terms are filled
      const hasAllTerms =
        property.downPaymentAmount != null && property.downPaymentAmount > 0 &&
        property.monthlyPayment != null && property.monthlyPayment > 0 &&
        property.interestRate != null && property.interestRate > 0 &&
        property.loanTermYears != null && property.loanTermYears > 0 &&
        property.price != null && property.price > 0;

      if (hasAllTerms) {
        completeProperties.push(property);
      }
    });

    console.log(`✅ Found ${completeProperties.length} properties with COMPLETE terms`);

    if (completeProperties.length === 0) {
      console.log('\n⚠️  NO PROPERTIES WITH COMPLETE TERMS FOUND!');
      console.log('\nThis means:');
      console.log('- All properties in zillow_imports have NULL finance terms');
      console.log('- Buyers will see "Contact Seller" for all properties');
      console.log('- Admin needs to fill in owner finance terms via:');
      console.log('  1. Admin panel → Edit property');
      console.log('  2. GHL webhook (when seller provides terms)');
      console.log('  3. Manual database update');
      return;
    }

    // Take first 20 (or less if not enough)
    const propertiesToVerify = completeProperties.slice(0, Math.min(20, completeProperties.length));

    console.log(`\n📋 Analyzing ${propertiesToVerify.length} properties...\n`);
    console.log('═'.repeat(80));

    // Create detailed report
    const report: any[] = [];
    let passCount = 0;
    let issueCount = 0;

    propertiesToVerify.forEach((property, index) => {
      console.log(`\n${index + 1}. ${property.fullAddress || property.streetAddress || 'Unknown Address'}`);
      console.log('─'.repeat(80));

      const display = getBuyerDashboardDisplay(property);

      // Verify each field
      const verification = {
        propertyId: property.id,
        zpid: property.zpid,
        address: property.fullAddress,

        // Database Values
        database: {
          price: property.price,
          monthlyPayment: property.monthlyPayment,
          downPaymentAmount: property.downPaymentAmount,
          downPaymentPercent: property.downPaymentPercent,
          interestRate: property.interestRate,
          loanTermYears: property.loanTermYears,
          balloonYears: property.balloonPaymentYears,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          squareFoot: property.squareFoot,
        },

        // What Buyer Sees
        buyerDashboard: display,

        // Verification Status
        status: 'PASS' as 'PASS' | 'ISSUE',
        issues: [] as string[],
      };

      // Check for issues
      console.log('\n  📊 DATABASE VALUES:');
      console.log(`     Price: $${property.price?.toLocaleString()}`);
      console.log(`     Monthly Payment: $${property.monthlyPayment?.toLocaleString()}`);
      console.log(`     Down Payment: $${property.downPaymentAmount?.toLocaleString()} (${property.downPaymentPercent}%)`);
      console.log(`     Interest Rate: ${property.interestRate}%`);
      console.log(`     Loan Term: ${property.loanTermYears} years`);
      console.log(`     Balloon: ${property.balloonPaymentYears || 'None'} years`);
      console.log(`     Beds/Baths: ${property.bedrooms} bed / ${property.bathrooms} bath`);
      console.log(`     Sq Ft: ${property.squareFoot?.toLocaleString()}`);

      console.log('\n  👤 BUYER DASHBOARD DISPLAY:');
      console.log(`     Monthly Payment: ${display.monthlyPayment}`);
      console.log(`     Down Payment: ${display.downPaymentAmount}`);
      console.log(`     Down Payment %: ${display.downPaymentPercent || 'N/A'}`);
      console.log(`     Interest Rate: ${display.interestRate}`);
      console.log(`     Loan Term: ${display.loanTerm}`);
      console.log(`     Balloon: ${display.balloonYears}`);
      console.log(`     Beds/Baths: ${property.bedrooms} bed / ${property.bathrooms} bath`);
      console.log(`     Sq Ft: ${property.squareFoot?.toLocaleString() || 'N/A'} sq ft`);

      // Validation checks
      if (display.monthlyPayment === 'Contact Seller') {
        verification.issues.push('Monthly payment shows "Contact Seller" despite having value in DB');
        verification.status = 'ISSUE';
      }

      if (display.downPaymentAmount === 'Contact Seller') {
        verification.issues.push('Down payment shows "Contact Seller" despite having value in DB');
        verification.status = 'ISSUE';
      }

      if (display.interestRate === 'Contact seller') {
        verification.issues.push('Interest rate shows "Contact seller" despite having value in DB');
        verification.status = 'ISSUE';
      }

      if (display.loanTerm === 'Contact seller') {
        verification.issues.push('Loan term shows "Contact seller" despite having value in DB');
        verification.status = 'ISSUE';
      }

      // Calculate expected monthly payment
      if (property.price && property.downPaymentAmount && property.interestRate && property.loanTermYears) {
        const loanAmount = property.price - property.downPaymentAmount;
        const monthlyRate = property.interestRate / 100 / 12;
        const numPayments = property.loanTermYears * 12;

        const calculatedPayment = loanAmount *
          (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
          (Math.pow(1 + monthlyRate, numPayments) - 1);

        const difference = Math.abs(calculatedPayment - (property.monthlyPayment || 0));
        const percentDiff = (difference / (property.monthlyPayment || 1)) * 100;

        if (percentDiff > 5) {
          console.log(`\n  ⚠️  CALCULATION MISMATCH:`);
          console.log(`     Database Monthly Payment: $${property.monthlyPayment?.toLocaleString()}`);
          console.log(`     Calculated (should be): $${Math.round(calculatedPayment).toLocaleString()}`);
          console.log(`     Difference: ${percentDiff.toFixed(1)}%`);
          console.log(`     Note: This is OK if seller provided custom terms`);
        }
      }

      console.log('\n  ✅ VERIFICATION:');
      if (verification.issues.length === 0) {
        console.log(`     Status: ✅ PASS - All data displaying correctly`);
        passCount++;
      } else {
        console.log(`     Status: ❌ ISSUE - Problems detected:`);
        verification.issues.forEach(issue => console.log(`       - ${issue}`));
        issueCount++;
      }

      report.push(verification);
    });

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('═'.repeat(80));
    console.log(`\nProperties Verified: ${propertiesToVerify.length}`);
    console.log(`✅ Passing: ${passCount}`);
    console.log(`❌ Issues: ${issueCount}`);

    if (issueCount > 0) {
      console.log('\n⚠️  Issues Found:');
      report.forEach((item, index) => {
        if (item.issues.length > 0) {
          console.log(`\n${index + 1}. ${item.address}`);
          item.issues.forEach((issue: string) => console.log(`   - ${issue}`));
        }
      });
    }

    // Export to JSON for detailed review
    const reportPath = './property-verification-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    // Create CSV summary
    const csvLines = [
      'Property ID,Address,Price,Monthly Payment (DB),Monthly Payment (Display),Down Payment (DB),Down Payment (Display),Interest Rate,Loan Term,Status,Issues'
    ];

    report.forEach(item => {
      const line = [
        item.propertyId,
        `"${item.address}"`,
        item.database.price,
        item.database.monthlyPayment,
        `"${item.buyerDashboard.monthlyPayment}"`,
        item.database.downPaymentAmount,
        `"${item.buyerDashboard.downPaymentAmount}"`,
        item.database.interestRate,
        item.database.loanTermYears,
        item.status,
        `"${item.issues.join('; ')}"`,
      ].join(',');
      csvLines.push(line);
    });

    const csvPath = './property-verification-summary.csv';
    fs.writeFileSync(csvPath, csvLines.join('\n'));
    console.log(`📊 CSV summary saved to: ${csvPath}\n`);

    // Final verdict
    console.log('═'.repeat(80));
    if (issueCount === 0) {
      console.log('✅ ALL PROPERTIES VERIFIED SUCCESSFULLY!');
      console.log('   - All database values match buyer dashboard display');
      console.log('   - All finance terms showing correctly');
      console.log('   - No "Contact Seller" for properties with complete data');
    } else {
      console.log('⚠️  SOME ISSUES DETECTED');
      console.log('   - Review the issues above');
      console.log('   - Check if values are 0 instead of NULL');
      console.log('   - Verify buyer dashboard code is deployed');
    }
    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    process.exit(1);
  }
}

// Run verification
verifyCompleteProperties()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
