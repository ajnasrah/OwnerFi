/**
 * Fix existing properties in database that have 0 down payment or 0 monthly payment
 * Recalculate missing financial fields using the amortization formula
 */

import admin from 'firebase-admin';
import { calculateMissingFinancials } from '../src/lib/property-validation';

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    console.error('❌ Missing Firebase credentials');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      privateKey,
      clientEmail,
    })
  });
}

async function fixExistingProperties() {
  console.log('🔧 FIXING EXISTING PROPERTIES WITH MISSING FINANCIAL DATA');
  console.log('='.repeat(80));

  const db = admin.firestore();

  // Get all properties
  const snapshot = await db.collection('properties').get();

  console.log(`\n📊 Total properties in database: ${snapshot.size}\n`);

  let fixed = 0;
  let skipped = 0;
  let noChangeNeeded = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      const address = data.address || 'Unknown';
      const city = data.city || '';
      const state = data.state || '';

      // Check if property needs calculation
      const needsMonthlyPayment = (data.monthlyPayment === 0 || !data.monthlyPayment);
      const needsDownPayment = (data.downPaymentAmount === 0 || !data.downPaymentAmount);

      if (!needsMonthlyPayment && !needsDownPayment) {
        noChangeNeeded++;
        continue;
      }

      // Check if we have enough data to calculate
      const hasRequiredFields =
        data.listPrice > 0 &&
        data.interestRate > 0 &&
        data.termYears > 0;

      if (!hasRequiredFields) {
        console.log(`⏭️  Skipped: ${address}, ${city}, ${state} - Missing required fields`);
        skipped++;
        continue;
      }

      // Get current values
      const currentData = {
        listPrice: data.listPrice || 0,
        monthlyPayment: data.monthlyPayment || 0,
        downPaymentAmount: data.downPaymentAmount || 0,
        downPaymentPercent: data.downPaymentPercent || 0,
        interestRate: data.interestRate || 0,
        termYears: data.termYears || 0
      };

      // Calculate missing fields
      const calculatedData = calculateMissingFinancials(currentData);

      // Check if anything changed
      const hasChanges =
        calculatedData.monthlyPayment !== currentData.monthlyPayment ||
        calculatedData.downPaymentAmount !== currentData.downPaymentAmount;

      if (!hasChanges) {
        noChangeNeeded++;
        continue;
      }

      // Update the property
      await doc.ref.update({
        monthlyPayment: calculatedData.monthlyPayment,
        downPaymentAmount: calculatedData.downPaymentAmount,
        downPaymentPercent: calculatedData.downPaymentPercent,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: new Date().toISOString()
      });

      console.log(`✅ Fixed: ${address}, ${city}, ${state}`);
      if (needsMonthlyPayment) {
        console.log(`   - Calculated monthly payment: $${calculatedData.monthlyPayment.toFixed(2)}`);
      }
      if (needsDownPayment) {
        console.log(`   - Calculated down payment: $${calculatedData.downPaymentAmount.toFixed(2)} (${calculatedData.downPaymentPercent.toFixed(1)}%)`);
      }

      fixed++;

    } catch (error) {
      console.error(`❌ Error processing property:`, error);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Properties: ${snapshot.size}`);
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`✓  No changes needed: ${noChangeNeeded}`);
  console.log(`⏭️  Skipped (missing required fields): ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('='.repeat(80));

  await admin.app().delete();
}

fixExistingProperties();
