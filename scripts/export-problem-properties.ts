/**
 * Export list of properties with issues
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

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

async function exportProblemProperties() {
  console.log('📋 Exporting Properties with Issues\n');

  const queueSnapshot = await getDocs(collection(db, 'property_rotation_queue'));

  const propertiesWithZeroDown: any[] = [];
  const propertiesMissingBedrooms: any[] = [];
  const validProperties: any[] = [];

  console.log('Processing properties...\n');

  for (const queueDoc of queueSnapshot.docs) {
    const queueItem = queueDoc.data();

    // Get full property
    const propertySnapshot = await getDocs(collection(db, 'properties'));
    const propertyDoc = propertySnapshot.docs.find(doc => doc.id === queueItem.propertyId);

    if (!propertyDoc) continue;

    const property = propertyDoc.data();

    // Check for beds field
    const hasBeds = property.beds !== undefined && property.beds !== null;
    const hasBedrooms = property.bedrooms !== undefined && property.bedrooms !== null;

    // Check down payment
    const hasDownPaymentAmount = property.downPaymentAmount !== undefined && property.downPaymentAmount !== null && property.downPaymentAmount > 0;
    const hasDownPaymentPercent = property.downPaymentPercent !== undefined && property.downPaymentPercent !== null && property.downPaymentPercent > 0;

    let calculatedDown = property.downPaymentAmount || 0;
    if (!hasDownPaymentAmount && hasDownPaymentPercent && property.listPrice) {
      calculatedDown = property.listPrice * (property.downPaymentPercent / 100);
    }

    const propertyInfo = {
      id: propertyDoc.id,
      address: property.address,
      city: property.city,
      state: property.state,
      listPrice: property.listPrice,
      downPaymentAmount: property.downPaymentAmount,
      downPaymentPercent: property.downPaymentPercent,
      calculatedDownPayment: calculatedDown,
      beds: property.beds,
      bedrooms: property.bedrooms,
      baths: property.baths,
      bathrooms: property.bathrooms,
      source: property.source,
      opportunityId: property.opportunityId
    };

    // Categorize
    if (calculatedDown === 0) {
      propertiesWithZeroDown.push(propertyInfo);
    } else if (!hasBedrooms && hasBeds) {
      propertiesMissingBedrooms.push(propertyInfo);
    } else {
      validProperties.push(propertyInfo);
    }
  }

  // Create reports
  const report = {
    summary: {
      total: queueSnapshot.size,
      zeroDownPayment: propertiesWithZeroDown.length,
      missingBedroomsField: propertiesMissingBedrooms.length,
      valid: validProperties.length
    },
    propertiesWithZeroDown,
    propertiesMissingBedroomsField: propertiesMissingBedrooms,
    validPropertiesSample: validProperties.slice(0, 10)
  };

  // Save to file
  fs.writeFileSync('property-issues-report.json', JSON.stringify(report, null, 2));

  console.log('📊 Summary:');
  console.log(`   Total properties: ${queueSnapshot.size}`);
  console.log(`   ❌ $0 down payment: ${propertiesWithZeroDown.length}`);
  console.log(`   ⚠️  Using 'beds' instead of 'bedrooms': ${propertiesMissingBedrooms.length}`);
  console.log(`   ✅ Valid: ${validProperties.length}`);

  console.log('\n❌ Properties with $0 Down Payment:\n');
  propertiesWithZeroDown.forEach((p, i) => {
    console.log(`${i + 1}. ${p.address}, ${p.city}, ${p.state}`);
    console.log(`   ID: ${p.id}`);
    console.log(`   List Price: $${p.listPrice?.toLocaleString()}`);
    console.log(`   Down Amount: $${p.downPaymentAmount}, Percent: ${p.downPaymentPercent}%`);
    console.log(`   Source: ${p.source}`);
    console.log('');
  });

  console.log('\n⚠️  Properties using "beds" field (sample - first 10):\n');
  propertiesMissingBedrooms.slice(0, 10).forEach((p, i) => {
    console.log(`${i + 1}. ${p.address}, ${p.city}, ${p.state}`);
    console.log(`   beds: ${p.beds}, bedrooms: ${p.bedrooms}`);
    console.log('');
  });

  console.log('\n💾 Full report saved to: property-issues-report.json');
}

exportProblemProperties().catch(console.error);
