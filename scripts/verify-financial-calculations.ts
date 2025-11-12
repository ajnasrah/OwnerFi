/**
 * Verify Financial Calculations
 *
 * Checks all "exported to website" properties to ensure:
 * 1. Financial terms are present and make sense
 * 2. Monthly payment calculations are accurate
 * 3. Interest rates are not 0% when they should have values
 * 4. Down payment amounts/percentages are consistent
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

interface FinancialIssue {
  opportunityId: string;
  address: string;
  issue: string;
  details: any;
}

// Calculate expected monthly payment
function calculateMonthlyPayment(
  loanAmount: number,
  annualRate: number,
  termYears: number
): number {
  if (annualRate === 0 || termYears === 0 || loanAmount === 0) return 0;

  const monthlyRate = annualRate / 100 / 12;
  const numPayments = termYears * 12;

  const monthlyPayment = loanAmount *
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);

  return Math.round(monthlyPayment);
}

async function verifyFinancialCalculations() {
  console.log('🔍 Verifying financial calculations for all exported properties...\n');

  // Read exported opportunity IDs
  const idsPath = '/tmp/exported-opportunity-ids.json';
  if (!fs.existsSync(idsPath)) {
    console.error('❌ Run verify-exported-props.py first to extract IDs');
    process.exit(1);
  }

  const exportedProps = JSON.parse(fs.readFileSync(idsPath, 'utf-8'));
  const exportedIds = exportedProps.map((p: any) => p.id);

  console.log(`📋 Checking ${exportedIds.length} exported properties...\n`);

  // Get all exported properties from database
  const snapshot = await db.collection('properties')
    .where('source', '==', 'gohighlevel')
    .get();

  const exportedDbProps = snapshot.docs
    .filter(doc => exportedIds.includes(doc.data().opportunityId))
    .map(doc => ({ id: doc.id, ...doc.data() }));

  console.log(`📦 Found ${exportedDbProps.length} properties in database\n`);
  console.log('═'.repeat(80) + '\n');

  const issues: FinancialIssue[] = [];
  const stats = {
    total: exportedDbProps.length,
    hasFinancials: 0,
    noFinancials: 0,
    hasMonthlyPayment: 0,
    hasInterestRate: 0,
    hasTermYears: 0,
    calculationMismatch: 0,
    zeroInterestWithPayment: 0,
    downPaymentMismatch: 0
  };

  exportedDbProps.forEach((prop: any) => {
    const hasMonthly = prop.monthlyPayment && prop.monthlyPayment > 0;
    const hasRate = prop.interestRate && prop.interestRate > 0;
    const hasTerm = prop.termYears && prop.termYears > 0;
    const hasDownAmount = prop.downPaymentAmount && prop.downPaymentAmount > 0;
    const hasDownPercent = prop.downPaymentPercent && prop.downPaymentPercent > 0;

    if (hasMonthly || hasRate || hasTerm) {
      stats.hasFinancials++;
    } else {
      stats.noFinancials++;
    }

    if (hasMonthly) stats.hasMonthlyPayment++;
    if (hasRate) stats.hasInterestRate++;
    if (hasTerm) stats.hasTermYears++;

    // Issue 1: Monthly payment but 0% interest rate
    if (hasMonthly && !hasRate) {
      stats.zeroInterestWithPayment++;
      issues.push({
        opportunityId: prop.opportunityId || prop.id,
        address: `${prop.address}, ${prop.city}, ${prop.state}`,
        issue: '0% interest rate with monthly payment',
        details: {
          monthlyPayment: prop.monthlyPayment,
          interestRate: prop.interestRate || 0,
          termYears: prop.termYears
        }
      });
    }

    // Issue 2: Verify calculation accuracy (if we have all three values)
    if (hasMonthly && hasRate && hasTerm && prop.price) {
      const loanAmount = prop.price - (prop.downPaymentAmount || 0);
      const expectedPayment = calculateMonthlyPayment(
        loanAmount,
        prop.interestRate,
        prop.termYears
      );

      const difference = Math.abs(prop.monthlyPayment - expectedPayment);
      const tolerance = Math.max(10, expectedPayment * 0.05); // 5% or $10 tolerance

      if (difference > tolerance) {
        stats.calculationMismatch++;
        issues.push({
          opportunityId: prop.opportunityId || prop.id,
          address: `${prop.address}, ${prop.city}, ${prop.state}`,
          issue: 'Monthly payment calculation mismatch',
          details: {
            storedPayment: prop.monthlyPayment,
            expectedPayment,
            difference,
            loanAmount,
            interestRate: prop.interestRate,
            termYears: prop.termYears
          }
        });
      }
    }

    // Issue 3: Down payment amount/percent mismatch
    if (hasDownAmount && hasDownPercent && prop.price) {
      const expectedAmount = Math.round((prop.downPaymentPercent / 100) * prop.price);
      const tolerance = prop.price * 0.01; // 1% tolerance

      if (Math.abs(prop.downPaymentAmount - expectedAmount) > tolerance) {
        stats.downPaymentMismatch++;
        issues.push({
          opportunityId: prop.opportunityId || prop.id,
          address: `${prop.address}, ${prop.city}, ${prop.state}`,
          issue: 'Down payment amount/percent mismatch',
          details: {
            downPaymentAmount: prop.downPaymentAmount,
            downPaymentPercent: prop.downPaymentPercent,
            expectedAmount,
            difference: prop.downPaymentAmount - expectedAmount,
            price: prop.price
          }
        });
      }
    }
  });

  // Print summary
  console.log('📊 FINANCIAL DATA SUMMARY\n');
  console.log(`Total Properties: ${stats.total}`);
  console.log(`Properties with Financial Data: ${stats.hasFinancials} (${Math.round(stats.hasFinancials / stats.total * 100)}%)`);
  console.log(`Properties without Financial Data: ${stats.noFinancials} (${Math.round(stats.noFinancials / stats.total * 100)}%)`);
  console.log('');
  console.log(`Properties with Monthly Payment: ${stats.hasMonthlyPayment} (${Math.round(stats.hasMonthlyPayment / stats.total * 100)}%)`);
  console.log(`Properties with Interest Rate: ${stats.hasInterestRate} (${Math.round(stats.hasInterestRate / stats.total * 100)}%)`);
  console.log(`Properties with Term Years: ${stats.hasTermYears} (${Math.round(stats.hasTermYears / stats.total * 100)}%)`);
  console.log('\n' + '═'.repeat(80) + '\n');

  // Print issues
  if (issues.length > 0) {
    console.log(`⚠️  FOUND ${issues.length} ISSUES\n`);

    if (stats.zeroInterestWithPayment > 0) {
      console.log(`\n❌ 0% Interest Rate with Monthly Payment (${stats.zeroInterestWithPayment}):\n`);
      issues.filter(i => i.issue === '0% interest rate with monthly payment')
        .slice(0, 10)
        .forEach((issue, idx) => {
          console.log(`${idx + 1}. ${issue.address}`);
          console.log(`   Opportunity ID: ${issue.opportunityId}`);
          console.log(`   Monthly Payment: $${issue.details.monthlyPayment}`);
          console.log(`   Interest Rate: ${issue.details.interestRate}% (should be > 0)`);
          console.log(`   Term: ${issue.details.termYears} years`);
          console.log('');
        });

      if (stats.zeroInterestWithPayment > 10) {
        console.log(`   ... and ${stats.zeroInterestWithPayment - 10} more\n`);
      }
    }

    if (stats.calculationMismatch > 0) {
      console.log(`\n⚠️  Calculation Mismatches (${stats.calculationMismatch}):\n`);
      issues.filter(i => i.issue === 'Monthly payment calculation mismatch')
        .slice(0, 10)
        .forEach((issue, idx) => {
          console.log(`${idx + 1}. ${issue.address}`);
          console.log(`   Stored Payment: $${issue.details.storedPayment}`);
          console.log(`   Expected Payment: $${issue.details.expectedPayment}`);
          console.log(`   Difference: $${Math.round(issue.details.difference)}`);
          console.log(`   Loan: $${issue.details.loanAmount.toLocaleString()} @ ${issue.details.interestRate}% for ${issue.details.termYears} years`);
          console.log('');
        });

      if (stats.calculationMismatch > 10) {
        console.log(`   ... and ${stats.calculationMismatch - 10} more\n`);
      }
    }

    if (stats.downPaymentMismatch > 0) {
      console.log(`\n⚠️  Down Payment Mismatches (${stats.downPaymentMismatch}):\n`);
      issues.filter(i => i.issue === 'Down payment amount/percent mismatch')
        .slice(0, 10)
        .forEach((issue, idx) => {
          console.log(`${idx + 1}. ${issue.address}`);
          console.log(`   Down Payment Amount: $${issue.details.downPaymentAmount.toLocaleString()}`);
          console.log(`   Down Payment Percent: ${issue.details.downPaymentPercent.toFixed(2)}%`);
          console.log(`   Expected Amount: $${issue.details.expectedAmount.toLocaleString()}`);
          console.log(`   Difference: $${Math.abs(Math.round(issue.details.difference)).toLocaleString()}`);
          console.log('');
        });

      if (stats.downPaymentMismatch > 10) {
        console.log(`   ... and ${stats.downPaymentMismatch - 10} more\n`);
      }
    }

    // Save issues to file
    fs.writeFileSync(
      '/tmp/financial-issues.json',
      JSON.stringify(issues, null, 2)
    );
    console.log('💾 Full issues list saved to /tmp/financial-issues.json\n');

  } else {
    console.log('✅ NO ISSUES FOUND! All financial calculations are correct.\n');
  }

  // Print clean examples
  const cleanProps = exportedDbProps.filter((prop: any) => {
    const hasMonthly = prop.monthlyPayment && prop.monthlyPayment > 0;
    const hasRate = prop.interestRate && prop.interestRate > 0;
    const hasTerm = prop.termYears && prop.termYears > 0;

    return hasMonthly && hasRate && hasTerm;
  });

  if (cleanProps.length > 0) {
    console.log('✅ SAMPLE OF PROPERTIES WITH CORRECT FINANCIALS:\n');
    cleanProps.slice(0, 5).forEach((prop: any, idx: number) => {
      console.log(`${idx + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
      console.log(`   Price: $${prop.price?.toLocaleString()}`);
      console.log(`   Down: $${prop.downPaymentAmount?.toLocaleString() || 0} (${prop.downPaymentPercent?.toFixed(2) || 0}%)`);
      console.log(`   Monthly: $${prop.monthlyPayment} @ ${prop.interestRate}% for ${prop.termYears} years`);

      const loanAmount = prop.price - (prop.downPaymentAmount || 0);
      console.log(`   Loan Amount: $${loanAmount.toLocaleString()}`);
      console.log('');
    });
  }
}

// Run the script
verifyFinancialCalculations()
  .then(() => {
    console.log('\n✅ Verification completed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
