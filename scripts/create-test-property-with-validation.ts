/**
 * Create Test Property with Validation Issues
 * Creates a property with an extra zero in the price to test the review UI
 */

import admin from 'firebase-admin';
import { validatePropertyFinancials, type PropertyFinancialData } from '../src/lib/property-validation';

async function createTestProperty() {
  console.log('🧪 CREATING TEST PROPERTY WITH VALIDATION ISSUES\n');
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

    // Test property with extra zero in price
    const testPropertyData: PropertyFinancialData = {
      listPrice: 2500000,  // WRONG - should be $250,000
      monthlyPayment: 1800,
      downPaymentAmount: 25000,
      downPaymentPercent: 1,  // 25000/2500000 = 1%
      interestRate: 8,
      termYears: 20,
      address: '123 Test Street',
      city: 'Dallas',
      state: 'TX'
    };

    console.log('\n📝 Test Property Data:');
    console.log(JSON.stringify(testPropertyData, null, 2));

    // Run validation
    console.log('\n🔍 Running validation...\n');
    const validation = validatePropertyFinancials(testPropertyData);

    console.log('Validation Result:');
    console.log(`  Should Auto-Reject: ${validation.shouldAutoReject}`);
    console.log(`  Needs Review: ${validation.needsReview}`);
    console.log(`  Issues Found: ${validation.issues.length}`);

    if (validation.issues.length > 0) {
      console.log('\n  Issues:');
      validation.issues.forEach((issue, index) => {
        console.log(`    ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.field}`);
        console.log(`       ${issue.issue}`);
        if (issue.suggestion) {
          console.log(`       Suggestion: ${issue.suggestion}`);
        }
      });
    }

    // Create property document
    const propertyDoc = {
      // Core fields
      address: testPropertyData.address,
      city: testPropertyData.city,
      state: testPropertyData.state,
      zipCode: '75001',

      // Financial fields
      price: testPropertyData.listPrice,
      downPayment: testPropertyData.downPaymentAmount,
      downPaymentPercent: testPropertyData.downPaymentPercent,
      monthlyPayment: testPropertyData.monthlyPayment,
      interestRate: testPropertyData.interestRate,
      termYears: testPropertyData.termYears,

      // Property details
      bedrooms: 3,
      bathrooms: 2,
      sqft: 1500,
      description: 'TEST PROPERTY - Beautiful test property with extra zero in price - should be $250,000',

      // Validation fields
      needsReview: validation.needsReview,
      reviewReasons: validation.issues.map(issue => {
        const reason: any = {
          field: issue.field,
          issue: issue.issue,
          severity: issue.severity
        };
        if (issue.expectedRange) reason.expectedRange = issue.expectedRange;
        if (issue.actualValue !== undefined) reason.actualValue = issue.actualValue;
        if (issue.suggestion) reason.suggestion = issue.suggestion;
        return reason;
      }),

      // Status
      isActive: false,  // Don't make active until reviewed
      source: 'manual',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    console.log('\n💾 Creating property in database...');

    const docRef = await db.collection('properties').add(propertyDoc);

    console.log(`✅ Property created with ID: ${docRef.id}`);
    console.log(`\n🎯 Property Status:`);
    console.log(`   - Active: ${propertyDoc.isActive}`);
    console.log(`   - Needs Review: ${propertyDoc.needsReview}`);
    console.log(`   - Review Issues: ${propertyDoc.reviewReasons?.length || 0}`);

    console.log('\n✅ SUCCESS!');
    console.log('='.repeat(80));
    console.log('Test property created. You can now:');
    console.log('1. Start the dev server: npm run dev');
    console.log('2. Go to /admin');
    console.log('3. Check the "Review Required" or "Properties" tab');
    console.log(`4. Look for property ID: ${docRef.id}`);
    console.log('='.repeat(80));
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (admin.apps.length > 0) {
      await admin.app().delete();
    }
  }
}

createTestProperty();
