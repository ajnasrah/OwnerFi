import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function checkProperty() {
  try {
    const propertyId = 'V9Ief0n5cPPpB53JNo3F';

    console.log('\n🔍 Checking property in database...\n');
    console.log('='.repeat(80));

    const propertyDoc = await db.collection('properties').doc(propertyId).get();

    if (!propertyDoc.exists) {
      console.log('❌ Property NOT found in database');
      return;
    }

    const data = propertyDoc.data();

    console.log('✅ PROPERTY FOUND!\n');
    console.log('📋 Property Details:');
    console.log('='.repeat(80));
    console.log(`ID: ${propertyId}`);
    console.log(`Address: ${data?.address}`);
    console.log(`City: ${data?.city}`);
    console.log(`State: ${data?.state}`);
    console.log(`Zip: ${data?.zipCode}`);
    console.log(`Price: $${data?.price?.toLocaleString()}`);
    console.log(`Bedrooms: ${data?.bedrooms || 0}`);
    console.log(`Bathrooms: ${data?.bathrooms || 0}`);
    console.log(`Square Feet: ${data?.squareFeet || 0}`);
    console.log(`Status: ${data?.status}`);
    console.log(`Active: ${data?.isActive}`);
    console.log(`Description: ${data?.description?.substring(0, 100)}...`);
    console.log(`\nFinancial Details:`);
    console.log(`  Monthly Payment: $${data?.monthlyPayment || 0}`);
    console.log(`  Down Payment: $${data?.downPaymentAmount || 0} (${data?.downPaymentPercent || 0}%)`);
    console.log(`  Interest Rate: ${data?.interestRate || 0}%`);
    console.log(`  Term: ${data?.termYears || 0} years`);
    console.log(`\nImages: ${data?.imageUrls?.length || 0}`);
    if (data?.imageUrls?.length > 0) {
      console.log(`  ${data.imageUrls[0]}`);
    }
    console.log(`\nCreated: ${data?.createdAt?.toDate?.().toLocaleString() || data?.dateAdded}`);
    console.log(`Updated: ${data?.updatedAt?.toDate?.().toLocaleString() || data?.lastUpdated}`);

    console.log('\n' + '='.repeat(80));
    console.log('🌐 This property should now be visible on your website!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkProperty();
