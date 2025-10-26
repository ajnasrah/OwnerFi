/**
 * Detailed check of what fields are missing for problem properties
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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

const problemPropertyIds = [
  'CuU8IggxD1SYIspn7kWX',
  'EEXIzQCPYAJps3UGdoia',
  'QRoxZpEx7A42U1CZOtpH',
  'R8ZC6Ji816O6z3pdZAnI',
  'RTCH6CQMNYH4FZq0zx6P',
  'Zf9nx0TpmZifZLozaF28',
  'kML20ieI2skHBz3b7dNt',
  'kNBgq2vOHsVCCD3ateMe',
  'lVPmmPVRy6RogKK5Njwp',
  'rcuP9y5jXJe58nk6I7Vt',
  'vEFlRn2dib2RRmu6D6Py'
];

async function checkDetailedFields() {
  console.log('🔍 Detailed Field Analysis for Problem Properties\n');
  console.log('='.repeat(80));

  const requiredFields = [
    'address',
    'city',
    'state',
    'listPrice',
    'downPaymentAmount',
    'downPaymentPercent',
    'monthlyPayment',
    'interestRate',
    'termYears',
    'bedrooms',
    'beds',
    'bathrooms',
    'baths',
    'imageUrls',
    'status',
    'isActive'
  ];

  for (const propertyId of problemPropertyIds) {
    const docRef = doc(db, 'properties', propertyId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.log(`\n❌ Property ${propertyId} not found`);
      continue;
    }

    const property = docSnap.data();

    console.log(`\n📋 ${property.address}, ${property.city}, ${property.state}`);
    console.log(`   ID: ${propertyId}`);
    console.log('   -'.repeat(40));

    const missing: string[] = [];
    const hasZeroValue: string[] = [];
    const present: string[] = [];

    for (const field of requiredFields) {
      const value = property[field];

      if (value === undefined || value === null) {
        missing.push(field);
      } else if (value === 0) {
        hasZeroValue.push(field);
      } else if (field === 'imageUrls' && Array.isArray(value) && value.length === 0) {
        missing.push(field + ' (empty array)');
      } else {
        present.push(field);
      }
    }

    // Show critical financial fields
    console.log('   💰 Financial Fields:');
    console.log(`      listPrice: ${property.listPrice ? '$' + property.listPrice.toLocaleString() : '❌ MISSING'}`);
    console.log(`      downPaymentAmount: ${property.downPaymentAmount !== undefined ? '$' + property.downPaymentAmount : '❌ MISSING'}`);
    console.log(`      downPaymentPercent: ${property.downPaymentPercent !== undefined ? property.downPaymentPercent + '%' : '❌ MISSING'}`);
    console.log(`      monthlyPayment: ${property.monthlyPayment ? '$' + property.monthlyPayment.toLocaleString() : '❌ MISSING'}`);
    console.log(`      interestRate: ${property.interestRate !== undefined ? property.interestRate + '%' : '❌ MISSING'}`);
    console.log(`      termYears: ${property.termYears || '❌ MISSING'}`);

    console.log('   🏠 Property Fields:');
    console.log(`      bedrooms: ${property.bedrooms !== undefined ? property.bedrooms : '❌ MISSING'}`);
    console.log(`      beds: ${property.beds !== undefined ? property.beds : '❌ MISSING'}`);
    console.log(`      bathrooms: ${property.bathrooms !== undefined ? property.bathrooms : '❌ MISSING'}`);
    console.log(`      baths: ${property.baths !== undefined ? property.baths : '❌ MISSING'}`);
    console.log(`      imageUrls: ${property.imageUrls ? property.imageUrls.length + ' images' : '❌ MISSING'}`);

    console.log('   📊 Status:');
    console.log(`      status: ${property.status || '❌ MISSING'}`);
    console.log(`      isActive: ${property.isActive !== undefined ? property.isActive : '❌ MISSING'}`);

    if (hasZeroValue.length > 0) {
      console.log(`   ⚠️  Fields with value = 0: ${hasZeroValue.join(', ')}`);
    }

    if (missing.length > 0) {
      console.log(`   ❌ Missing/null fields: ${missing.join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Analysis complete!\n');
}

checkDetailedFields().catch(console.error);
