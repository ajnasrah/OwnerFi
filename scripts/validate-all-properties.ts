/**
 * Validate all properties in queue have required data
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function validateAllProperties() {
  console.log('🔍 Validating All Properties in Queue\n');
  console.log('='.repeat(70));

  // Get all properties from queue
  const queueSnapshot = await getDocs(collection(db, 'property_rotation_queue'));
  console.log(`\n📊 Found ${queueSnapshot.size} properties in queue\n`);

  let validCount = 0;
  let missingDownPayment = 0;
  let missingData = 0;
  const issues: string[] = [];

  for (const queueDoc of queueSnapshot.docs) {
    const queueItem = queueDoc.data();

    // Get full property document
    const propertySnapshot = await getDocs(collection(db, 'properties'));
    const propertyDoc = propertySnapshot.docs.find(doc => doc.id === queueItem.propertyId);

    if (!propertyDoc) {
      issues.push(`❌ Queue item ${queueItem.address} - property document not found`);
      missingData++;
      continue;
    }

    const property = propertyDoc.data();

    // Check down payment
    const hasDownPaymentAmount = property.downPaymentAmount !== undefined && property.downPaymentAmount !== null;
    const hasDownPaymentPercent = property.downPaymentPercent !== undefined && property.downPaymentPercent !== null;

    if (!hasDownPaymentAmount && !hasDownPaymentPercent) {
      issues.push(`❌ ${property.address} - NO down payment data (amount: ${property.downPaymentAmount}, percent: ${property.downPaymentPercent})`);
      missingDownPayment++;
      continue;
    }

    // Calculate down payment if using percentage
    let calculatedDown = property.downPaymentAmount || 0;
    if (!hasDownPaymentAmount && hasDownPaymentPercent && property.listPrice) {
      calculatedDown = property.listPrice * (property.downPaymentPercent / 100);
    }

    // Check for $0 down payment
    if (calculatedDown === 0) {
      issues.push(`⚠️  ${property.address} - Down payment is $0 (amount: ${property.downPaymentAmount}, percent: ${property.downPaymentPercent}%, listPrice: $${property.listPrice?.toLocaleString()})`);
      missingDownPayment++;
      continue;
    }

    // Check required fields
    const requiredFields = ['address', 'city', 'state', 'listPrice', 'monthlyPayment', 'interestRate', 'termYears', 'imageUrls'];
    const missing = requiredFields.filter(field => {
      if (field === 'imageUrls') {
        return !property[field] || property[field].length === 0;
      }
      return property[field] === undefined || property[field] === null;
    });

    if (missing.length > 0) {
      issues.push(`⚠️  ${property.address} - Missing fields: ${missing.join(', ')}`);
      missingData++;
      continue;
    }

    validCount++;
  }

  console.log('='.repeat(70));
  console.log('\n📊 Validation Summary:');
  console.log(`   ✅ Valid properties: ${validCount}`);
  console.log(`   ❌ Missing down payment: ${missingDownPayment}`);
  console.log(`   ⚠️  Missing other data: ${missingData}`);
  console.log(`   📋 Total in queue: ${queueSnapshot.size}`);

  if (issues.length > 0) {
    console.log(`\n⚠️  Issues found (showing first 20):\n`);
    issues.slice(0, 20).forEach(issue => console.log(`   ${issue}`));

    if (issues.length > 20) {
      console.log(`\n   ... and ${issues.length - 20} more issues`);
    }
  } else {
    console.log('\n✅ All properties have required data!');
  }

  console.log('\n' + '='.repeat(70));
}

validateAllProperties().catch(console.error);
