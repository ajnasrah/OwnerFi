#!/usr/bin/env npx tsx

/**
 * Check what's actually stored in Firebase
 */

import * as dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

const app = initializeApp({
  credential: cert(serviceAccount as any),
});

const db = getFirestore(app);

async function checkData() {
  console.log(`\n🔍 Checking Firebase Data\n`);
  console.log('='.repeat(80));

  const snapshot = await db.collection('zillow_imports').limit(5).get();

  console.log(`Found ${snapshot.size} documents (showing first 5)\n`);

  snapshot.docs.forEach((doc, index) => {
    const data = doc.data();
    console.log(`\n${index + 1}. Document ID: ${doc.id}`);
    console.log('   ' + '-'.repeat(70));
    console.log(`   address: ${data.streetAddress || data.property_address || 'MISSING'}`);
    console.log(`   zpid: ${data.zpid || 'MISSING'}`);
    console.log(`   agentName: ${data.agentName || 'MISSING'}`);
    console.log(`   agentPhoneNumber: ${data.agentPhoneNumber || 'MISSING'}`);
    console.log(`   brokerName: ${data.brokerName || 'MISSING'}`);
    console.log(`   brokerPhoneNumber: ${data.brokerPhoneNumber || 'MISSING'}`);
    console.log(`   propertyImages: ${Array.isArray(data.propertyImages) ? data.propertyImages.length + ' images' : 'MISSING'}`);
    console.log(`   annualTaxAmount: ${data.annualTaxAmount || 'MISSING'}`);
    console.log(`   importedAt: ${data.importedAt?.toDate?.() || data.importedAt || 'MISSING'}`);

    // Show ALL field names
    console.log(`\n   All fields in this document:`);
    console.log(`   ${Object.keys(data).join(', ')}`);
  });

  console.log('\n');
  process.exit(0);
}

checkData().catch(console.error);
