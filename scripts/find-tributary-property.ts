/**
 * Find specific property in database
 */

import admin from 'firebase-admin';

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

async function findProperty() {
  const db = admin.firestore();

  const snapshot = await db.collection('properties')
    .where('address', '==', '6240 Tributary St')
    .get();

  if (snapshot.empty) {
    console.log('❌ Property not found!');
  } else {
    console.log(`✅ Found ${snapshot.size} property(ies):\n`);
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(JSON.stringify({
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        listPrice: data.listPrice,
        downPaymentAmount: data.downPaymentAmount,
        interestRate: data.interestRate,
        monthlyPayment: data.monthlyPayment,
        termYears: data.termYears,
      }, null, 2));
    });
  }

  await admin.app().delete();
}

findProperty();
