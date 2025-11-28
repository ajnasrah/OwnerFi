/**
 * Grant admin access to specified phones
 * Also ensures buyer profile exists for admin access
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

// Admin phone numbers
const ADMIN_PHONES = ['+19018319661', '+19018319662'];

async function makeAdmin() {
  const phone = process.argv[2] || ADMIN_PHONES[0];

  console.log(`\n🔧 Granting admin access to ${phone}...\n`);

  // Find user
  const userSnapshot = await db.collection('users').where('phone', '==', phone).get();

  if (userSnapshot.empty) {
    console.log('❌ User not found with this phone');
    process.exit(1);
  }

  const userDoc = userSnapshot.docs[0];
  const userData = userDoc.data();

  console.log('✅ Found user:');
  console.log('  ID:', userDoc.id);
  console.log('  Email:', userData.email);
  console.log('  Current role:', userData.role);

  // Update to admin
  await userDoc.ref.update({
    role: 'admin',
    updatedAt: admin.firestore.Timestamp.now(),
    grantedAdminAt: admin.firestore.Timestamp.now()
  });

  console.log('\n✅ Updated user role to ADMIN');

  // Check if buyer profile exists
  const buyerSnapshot = await db.collection('buyerProfiles')
    .where('phone', '==', phone)
    .get();

  if (buyerSnapshot.empty) {
    console.log('\n⚠️  No buyer profile found - creating one for dashboard access...');

    const buyerId = `buyer_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    await db.collection('buyerProfiles').doc(buyerId).set({
      id: buyerId,
      userId: userDoc.id,
      firstName: userData.name?.split(' ')[0] || 'Admin',
      lastName: userData.name?.split(' ').slice(1).join(' ') || '',
      email: userData.email,
      phone: phone,

      // Empty location/budget (admin can set later)
      preferredCity: '',
      preferredState: '',
      city: '',
      state: '',
      searchRadius: 25,
      maxMonthlyPayment: 0,
      maxDownPayment: 0,

      // Default settings
      languages: ['English'],
      emailNotifications: true,
      smsNotifications: true,
      profileComplete: false,
      isActive: true,

      // Arrays
      matchedPropertyIds: [],
      likedPropertyIds: [],
      passedPropertyIds: [],

      // Lead selling
      isAvailableForPurchase: false,
      leadPrice: 1,

      // Timestamps
      lastActiveAt: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    console.log('✅ Created buyer profile:', buyerId);
  } else {
    console.log('\n✅ Buyer profile already exists:', buyerSnapshot.docs[0].id);

    // Update userId just in case
    await buyerSnapshot.docs[0].ref.update({
      userId: userDoc.id,
      updatedAt: admin.firestore.Timestamp.now()
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ ADMIN ACCESS GRANTED');
  console.log('='.repeat(60));
  console.log(`User: ${userData.email}`);
  console.log(`Phone: ${phone}`);
  console.log(`Role: admin`);
  console.log('\nYou now have access to:');
  console.log('  • /admin - Admin dashboard');
  console.log('  • /dashboard - Buyer dashboard');
  console.log('  • All admin, realtor, and buyer features\n');

  process.exit(0);
}

makeAdmin().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
