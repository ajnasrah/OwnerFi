import { getFirebaseAdmin } from './src/lib/scraper-v2/firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debugExpenses() {
  const { db } = getFirebaseAdmin();
  
  console.log('=== DEBUGGING EXPENSE CALCULATIONS ===\n');
  
  // Get some owner finance properties to debug
  const snapshot = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .limit(10)
    .get();
  
  let debuggedCount = 0;
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.rentEstimate && data.rentEstimate > 1500 && debuggedCount < 3) {
      debugProperty(data);
      debuggedCount++;
    }
  });
}

function debugProperty(property: any) {
  console.log(`=== PROPERTY DEBUG: ${property.fullAddress || 'Unknown Address'} ===`);
  console.log(`ZPID: ${property.zpid}`);
  console.log(`Price: $${property.price?.toLocaleString()}`);
  console.log(`Rent Estimate: $${property.rentEstimate}`);
  console.log('');
  
  // Raw data from database
  console.log('RAW DATABASE FIELDS:');
  console.log(`  annualTaxAmount: ${property.annualTaxAmount}`);
  console.log(`  annualHomeownersInsurance: ${property.annualHomeownersInsurance}`);
  console.log(`  monthlyHoaFee: ${property.monthlyHoaFee}`);
  console.log(`  hoa: ${property.hoa}`);
  console.log('');
  
  // Calculate loan details
  const downPaymentPercent = 0.10;
  const interestRate = 0.05;
  const loanTermYears = 30;
  const defaultInsurance = 150;
  
  const downPayment = property.price * downPaymentPercent;
  const loanAmount = property.price * (1 - downPaymentPercent);
  
  // Mortgage calculation
  const monthlyRate = interestRate / 12;
  const numPayments = loanTermYears * 12;
  const monthlyMortgage = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                         (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  // Monthly expenses
  const monthlyTax = (property.annualTaxAmount || 0) / 12;
  const monthlyInsurance = property.annualHomeownersInsurance ? property.annualHomeownersInsurance / 12 : defaultInsurance;
  const monthlyHOA = property.monthlyHoaFee || property.hoa || 0;
  
  console.log('CALCULATED MONTHLY EXPENSES:');
  console.log(`  Monthly Mortgage: $${Math.round(monthlyMortgage)}`);
  console.log(`  Monthly Tax: $${Math.round(monthlyTax)} (annual: $${property.annualTaxAmount || 0})`);
  console.log(`  Monthly Insurance: $${Math.round(monthlyInsurance)} (annual: $${property.annualHomeownersInsurance || 'N/A - using $150 default'})`);
  console.log(`  Monthly HOA: $${Math.round(monthlyHOA)}`);
  console.log('');
  
  const totalExpenses = monthlyMortgage + monthlyTax + monthlyInsurance + monthlyHOA;
  const cashFlow = property.rentEstimate - totalExpenses;
  
  console.log('CASH FLOW BREAKDOWN:');
  console.log(`  Rental Income: $${property.rentEstimate}`);
  console.log(`  Total Expenses: $${Math.round(totalExpenses)}`);
  console.log(`    - Mortgage: $${Math.round(monthlyMortgage)}`);
  console.log(`    - Tax: $${Math.round(monthlyTax)}`);
  console.log(`    - Insurance: $${Math.round(monthlyInsurance)}`);
  console.log(`    - HOA: $${Math.round(monthlyHOA)}`);
  console.log(`  NET CASH FLOW: $${Math.round(cashFlow)}`);
  console.log('');
  
  // Check if expenses seem reasonable
  if (monthlyTax < 50 && property.price > 100000) {
    console.log('⚠️  WARNING: Monthly tax seems very low for this price!');
  }
  if (monthlyInsurance < 100 && property.price > 200000) {
    console.log('⚠️  WARNING: Monthly insurance seems very low for this price!');
  }
  if (cashFlow > 1000) {
    console.log('⚠️  WARNING: Cash flow over $1000 - check if expenses are missing!');
  }
}

debugExpenses();