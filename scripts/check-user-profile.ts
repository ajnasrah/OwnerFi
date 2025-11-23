/**
 * Check if a specific user has a buyer profile
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

// Get phone from command line arg
const phoneArg = process.argv[2];

if (!phoneArg) {
  console.log('Usage: npx tsx scripts/check-user-profile.ts <phone>');
  console.log('Example: npx tsx scripts/check-user-profile.ts +19018319661');
  process.exit(1);
}

async function checkUserProfile(phone: string) {
  console.log(`\n🔍 Checking user and buyer profile for phone: ${phone}\n`);

  // Normalize phone
  const cleaned = phone.replace(/\D/g, '');
  const last10 = cleaned.slice(-10);

  const formats = [
    phone,
    last10,
    `+1${last10}`,
    `(${last10.slice(0,3)}) ${last10.slice(3,6)}-${last10.slice(6)}`,
  ];

  console.log('Trying formats:', formats);

  // Find user
  let userDoc: any = null;
  let userFormat = '';

  for (const fmt of formats) {
    const snapshot = await db.collection('users').where('phone', '==', fmt).get();
    if (!snapshot.empty) {
      userDoc = snapshot.docs[0];
      userFormat = fmt;
      break;
    }
  }

  if (!userDoc) {
    console.log('❌ NO USER FOUND with this phone number\n');
    return;
  }

  const userData = userDoc.data();
  console.log('✅ USER FOUND:');
  console.log('  ID:', userDoc.id);
  console.log('  Email:', userData.email);
  console.log('  Phone (stored):', userData.phone);
  console.log('  Phone (found with):', userFormat);
  console.log('  Role:', userData.role);
  console.log('  Has password:', !!userData.password);
  console.log('  Has realtorData:', !!userData.realtorData);

  // Find buyer profile
  console.log('\n🔍 Searching for buyer profile...');

  // Try by userId
  let buyerSnapshot = await db.collection('buyerProfiles').where('userId', '==', userDoc.id).get();

  if (buyerSnapshot.empty) {
    console.log('  ❌ Not found by userId, trying by phone...');

    // Try by phone
    for (const fmt of formats) {
      buyerSnapshot = await db.collection('buyerProfiles').where('phone', '==', fmt).get();
      if (!buyerSnapshot.empty) {
        console.log(`  ✅ Found by phone: ${fmt}`);
        break;
      }
    }
  } else {
    console.log('  ✅ Found by userId');
  }

  if (buyerSnapshot.empty) {
    console.log('\n❌ NO BUYER PROFILE FOUND');
    console.log('This is why you\'re being redirected to setup!\n');
    return;
  }

  const buyerData = buyerSnapshot.docs[0].data();
  console.log('\n✅ BUYER PROFILE FOUND:');
  console.log('  ID:', buyerSnapshot.docs[0].id);
  console.log('  User ID:', buyerData.userId);
  console.log('  Phone:', buyerData.phone);
  console.log('  Email:', buyerData.email);
  console.log('  City:', buyerData.preferredCity || buyerData.city);
  console.log('  Profile complete:', buyerData.profileComplete);
  console.log('\nThis should work! Check the API logs to see what\'s happening.\n');

  process.exit(0);
}

checkUserProfile(phoneArg).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
