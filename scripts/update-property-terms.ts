import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { calculatePropertyFinancials } from '../src/lib/property-calculations';

config({ path: '.env.local' });

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

async function updatePropertyTerms() {
  console.log('🔄 Updating property amortization terms...\n');

  try {
    // Get all properties
    const propertiesSnapshot = await db.collection('properties').get();

    console.log(`Found ${propertiesSnapshot.size} properties\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of propertiesSnapshot.docs) {
      const property = doc.data();
      const address = property.address || property.streetAddress || 'Unknown';

      try {
        // Only update if:
        // 1. Property has a list price
        // 2. Property has interest rate (meaning monthly payment should be calculated)
        // 3. Property doesn't have a manually set termYears

        if (!property.listPrice) {
          console.log(`⏭️  Skipping ${address} - No list price`);
          skipped++;
          continue;
        }

        if (!property.interestRate) {
          console.log(`⏭️  Skipping ${address} - No interest rate (monthly payment likely pre-filled)`);
          skipped++;
          continue;
        }

        // Calculate the correct term years based on price
        const getDefaultTermYears = (listPrice: number): number => {
          if (listPrice < 150000) return 15;
          if (listPrice < 300000) return 20;
          if (listPrice < 600000) return 25;
          return 30;
        };

        const newTermYears = getDefaultTermYears(property.listPrice);
        const oldTermYears = property.termYears || 20;

        if (newTermYears === oldTermYears) {
          console.log(`✓ ${address} - Already correct (${oldTermYears} years, $${property.listPrice?.toLocaleString()})`);
          skipped++;
          continue;
        }

        // Recalculate financials with new term
        const financials = calculatePropertyFinancials({
          listPrice: property.listPrice,
          downPaymentAmount: property.downPaymentAmount,
          downPaymentPercent: property.downPaymentPercent,
          interestRate: property.interestRate,
          termYears: newTermYears, // Use the new calculated term
          monthlyPayment: undefined // Force recalculation
        });

        // Update the property
        await doc.ref.update({
          termYears: financials.termYears,
          monthlyPayment: financials.monthlyPayment,
          loanAmount: financials.loanAmount,
          downPaymentAmount: financials.downPaymentAmount,
          downPaymentPercent: financials.downPaymentPercent,
          updatedAt: new Date().toISOString(),
        });

        console.log(`✅ Updated ${address}`);
        console.log(`   Price: $${property.listPrice?.toLocaleString()}`);
        console.log(`   Old Term: ${oldTermYears} years → New Term: ${newTermYears} years`);
        console.log(`   Old Payment: $${property.monthlyPayment?.toLocaleString()} → New Payment: $${financials.monthlyPayment.toLocaleString()}`);
        console.log('');

        updated++;

      } catch (error) {
        console.error(`❌ Error updating ${address}:`, error);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the update
updatePropertyTerms()
  .then(() => {
    console.log('\n✅ Update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
