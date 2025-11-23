/**
 * Create buyer profile for existing user
 * Usage: npx tsx scripts/create-buyer-profile.ts <userId>
 */

import * as admin from 'firebase-admin';

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

const userId = process.argv[2];

if (!userId) {
  console.log('Usage: npx tsx scripts/create-buyer-profile.ts <userId>');
  process.exit(1);
}

async function createBuyerProfile(uid: string) {
  console.log(`\n🔧 Creating buyer profile for user: ${uid}\n`);

  // Get user
  const userDoc = await db.collection('users').doc(uid).get();

  if (!userDoc.exists) {
    console.log('❌ User not found');
    process.exit(1);
  }

  const userData = userDoc.data()!;

  console.log('✅ User found:');
  console.log(`  Email: ${userData.email}`);
  console.log(`  Phone: ${userData.phone}`);
  console.log(`  Role: ${userData.role}`);

  // Check if profile already exists
  const existingQuery = await db.collection('buyerProfiles')
    .where('userId', '==', uid)
    .get();

  if (!existingQuery.empty) {
    console.log('\n✅ Buyer profile already exists:', existingQuery.docs[0].id);
    process.exit(0);
  }

  // Create buyer profile
  const buyerId = `buyer_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  await db.collection('buyerProfiles').doc(buyerId).set({
    id: buyerId,
    userId: uid,
    firstName: userData.name?.split(' ')[0] || '',
    lastName: userData.name?.split(' ').slice(1).join(' ') || '',
    email: userData.email,
    phone: userData.phone || '',

    // Empty location/budget - user can set in settings
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

  console.log('\n✅ BUYER PROFILE CREATED:', buyerId);
  console.log('\nUser can now:');
  console.log('  1. Sign in successfully');
  console.log('  2. Access /dashboard');
  console.log('  3. Set location/budget in /dashboard/settings\n');

  process.exit(0);
}

createBuyerProfile(userId).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
