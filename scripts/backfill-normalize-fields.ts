/**
 * Backfill script to normalize field names and recalculate cashFlow
 * Run with: npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-normalize-fields.ts
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

function calculateCashFlow(price: number, rentEstimate: number, annualTax: number = 0, monthlyHoa: number = 0) {
  if (!price || price <= 0 || !rentEstimate || rentEstimate <= 0) return null;

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

async function normalizeCollection(collectionName: string) {
  console.log(`\n=== Processing ${collectionName} ===`);

  const snapshot = await db.collection(collectionName).get();
  console.log(`Found ${snapshot.size} documents`);

  let normalized = 0;
  let cashFlowAdded = 0;
  let skipped = 0;

  const batches: FirebaseFirestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates: Record<string, any> = {};

    // Normalize estimate field (use zestimate if estimate is missing)
    if ((!data.estimate || data.estimate === 0) && data.zestimate && data.zestimate > 0) {
      updates.estimate = data.zestimate;
      console.log(`  Normalizing estimate from zestimate: ${data.streetAddress || data.fullAddress}`);
    }

    // Normalize rentEstimate field
    const rentFromAltFields = data.rentalEstimate || data.rentZestimate || data.rentCastEstimate || 0;
    if ((!data.rentEstimate || data.rentEstimate === 0) && rentFromAltFields > 0) {
      updates.rentEstimate = rentFromAltFields;
      console.log(`  Normalizing rentEstimate: ${data.streetAddress || data.fullAddress}`);
    }

    // Get final values for cashFlow calculation
    const price = data.price || data.listPrice || 0;
    const estimate = updates.estimate || data.estimate || data.zestimate || 0;
    const rentEstimate = updates.rentEstimate || data.rentEstimate || rentFromAltFields || 0;
    const annualTax = data.annualTaxAmount || data.taxAmount || 0;
    const monthlyHoa = data.hoa || data.hoaFees || 0;

    // Calculate percentOfArv if we have estimate now
    if (estimate > 0 && price > 0) {
      const percentOfArv = Math.round((price / estimate) * 100 * 10) / 10;
      const discount = Math.round((1 - price / estimate) * 100 * 10) / 10;
      if (!data.percentOfArv) updates.percentOfArv = percentOfArv;
      if (!data.discount) updates.discount = discount;
    }

    // Recalculate cashFlow if missing or if we normalized rent/estimate
    if ((!data.cashFlow || Object.keys(updates).length > 0) && rentEstimate > 0 && price > 0) {
      const cashFlow = calculateCashFlow(price, rentEstimate, annualTax, monthlyHoa);
      if (cashFlow) {
        updates.cashFlow = cashFlow;
        cashFlowAdded++;
      }
    }

    if (Object.keys(updates).length > 0) {
      currentBatch.update(doc.ref, updates);
      batchCount++;
      normalized++;

      if (batchCount >= 450) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        batchCount = 0;
      }
    } else {
      skipped++;
    }
  }

  if (batchCount > 0) {
    batches.push(currentBatch);
  }

  console.log(`Committing ${batches.length} batches...`);
  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit();
    console.log(`  Committed batch ${i + 1}/${batches.length}`);
  }

  console.log(`\n${collectionName} Results:`);
  console.log(`  Normalized/Updated: ${normalized}`);
  console.log(`  CashFlow Added: ${cashFlowAdded}`);
  console.log(`  Skipped (no changes): ${skipped}`);
}

async function main() {
  console.log('=== NORMALIZING FIELD NAMES & RECALCULATING CASHFLOW ===\n');

  await normalizeCollection('cash_houses');
  await normalizeCollection('zillow_imports');

  console.log('\n=== NORMALIZATION COMPLETE ===');
}

main().catch(console.error);
