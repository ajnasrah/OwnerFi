/**
 * Backfill script to calculate and store cashFlow data on all properties
 * Run with: npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-cash-flow.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

// Cash flow calculation (inline to avoid import issues in script)
function calculateCashFlow(
  price: number,
  rentEstimate: number,
  annualTax: number = 0,
  monthlyHoa: number = 0
) {
  if (!price || price <= 0 || !rentEstimate || rentEstimate <= 0) {
    return null;
  }

  const DOWN_PAYMENT_PERCENT = 0.10;
  const CLOSING_COSTS_PERCENT = 0.03;
  const INTEREST_RATE = 0.06;
  const LOAN_TERM_YEARS = 20;
  const INSURANCE_RATE = 0.01;
  const PROPERTY_MGMT_RATE = 0.10;
  const VACANCY_RATE = 0.08;
  const MAINTENANCE_RATE = 0.05;
  const CAPEX_RATE = 0.05;
  const ESTIMATED_TAX_RATE = 0.012;

  const useEstimatedTax = !annualTax || annualTax <= 0;
  const effectiveTax = useEstimatedTax ? price * ESTIMATED_TAX_RATE : annualTax;

  const downPayment = price * DOWN_PAYMENT_PERCENT;
  const closingCosts = price * CLOSING_COSTS_PERCENT;
  const totalInvestment = downPayment + closingCosts;
  const loanAmount = price - downPayment;

  // Mortgage calculation
  const monthlyRate = INTEREST_RATE / 12;
  const numPayments = LOAN_TERM_YEARS * 12;
  const x = Math.pow(1 + monthlyRate, numPayments);
  const monthlyMortgage = loanAmount * (monthlyRate * x) / (x - 1);

  const monthlyInsurance = (price * INSURANCE_RATE) / 12;
  const monthlyTax = effectiveTax / 12;
  const monthlyMgmt = rentEstimate * PROPERTY_MGMT_RATE;
  const monthlyVacancy = rentEstimate * VACANCY_RATE;
  const monthlyMaintenance = rentEstimate * MAINTENANCE_RATE;
  const monthlyCapex = rentEstimate * CAPEX_RATE;

  const monthlyExpenses = monthlyMortgage + monthlyInsurance + monthlyTax + monthlyHoa +
                          monthlyMgmt + monthlyVacancy + monthlyMaintenance + monthlyCapex;

  const monthlyCashFlow = rentEstimate - monthlyExpenses;
  const annualCashFlow = monthlyCashFlow * 12;
  const cocReturn = totalInvestment > 0 ? (annualCashFlow / totalInvestment) * 100 : 0;

  return {
    downPayment: Math.round(downPayment),
    totalInvestment: Math.round(totalInvestment),
    monthlyMortgage: Math.round(monthlyMortgage),
    monthlyInsurance: Math.round(monthlyInsurance),
    monthlyTax: Math.round(monthlyTax),
    monthlyHoa: Math.round(monthlyHoa),
    monthlyMgmt: Math.round(monthlyMgmt),
    monthlyExpenses: Math.round(monthlyExpenses),
    monthlyCashFlow: Math.round(monthlyCashFlow),
    annualCashFlow: Math.round(annualCashFlow),
    cocReturn: Math.round(cocReturn * 10) / 10,
    usedEstimatedTax: useEstimatedTax,
    calculatedAt: new Date().toISOString(),
  };
}

async function backfillCollection(collectionName: string) {
  console.log(`\n=== Processing ${collectionName} ===`);

  const snapshot = await db.collection(collectionName).get();
  console.log(`Found ${snapshot.size} documents`);

  let updated = 0;
  let skipped = 0;
  let noRent = 0;
  let alreadyHas = 0;

  const batches: FirebaseFirestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Skip if already has cashFlow with calculatedAt (already processed)
    if (data.cashFlow?.calculatedAt) {
      alreadyHas++;
      continue;
    }

    // Get price and rent
    const price = data.price || data.listPrice || 0;
    const rentEstimate = data.rentEstimate || data.rentZestimate || 0;
    const annualTax = data.annualTaxAmount || data.annualTax || 0;
    const monthlyHoa = data.hoa || data.monthlyHoaFee || 0;

    if (!rentEstimate || rentEstimate <= 0) {
      noRent++;
      continue;
    }

    const cashFlow = calculateCashFlow(price, rentEstimate, annualTax, monthlyHoa);

    if (cashFlow) {
      currentBatch.update(doc.ref, { cashFlow });
      batchCount++;
      updated++;

      // Firestore batch limit is 500
      if (batchCount >= 450) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        batchCount = 0;
      }
    } else {
      skipped++;
    }
  }

  // Add remaining batch
  if (batchCount > 0) {
    batches.push(currentBatch);
  }

  // Commit all batches
  console.log(`Committing ${batches.length} batches...`);
  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit();
    console.log(`  Committed batch ${i + 1}/${batches.length}`);
  }

  console.log(`\n${collectionName} Results:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Already has cashFlow: ${alreadyHas}`);
  console.log(`  No rent estimate: ${noRent}`);
  console.log(`  Skipped (no price/rent): ${skipped}`);
}

async function main() {
  console.log('=== BACKFILLING CASH FLOW DATA ===\n');
  console.log('This will calculate and store cashFlow on all properties');
  console.log('that have both price and rent estimates.\n');

  await backfillCollection('cash_houses');
  await backfillCollection('zillow_imports');

  console.log('\n=== BACKFILL COMPLETE ===');
}

main().catch(console.error);
