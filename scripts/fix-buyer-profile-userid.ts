/**
 * Fix buyer profile userId mismatch for phone 9018319661
 *
 * Updates buyer profile to use the correct userId from the user account
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

async function fixBuyerProfileUserId() {
  const phone = '+19018319661';

  console.log(`\n🔧 Fixing buyer profile userId for phone: ${phone}\n`);

  // Find the user account
  const userSnapshot = await db.collection('users').where('phone', '==', phone).get();

  if (userSnapshot.empty) {
    console.log('❌ No user found with this phone');
    process.exit(1);
  }

  const userDoc = userSnapshot.docs[0];
  const correctUserId = userDoc.id;

  console.log('✅ Found user:');
  console.log('  User ID:', correctUserId);
  console.log('  Email:', userDoc.data().email);
  console.log('  Role:', userDoc.data().role);

  // Find the buyer profile
  const buyerSnapshot = await db.collection('buyerProfiles').where('phone', '==', phone).get();

  if (buyerSnapshot.empty) {
    console.log('❌ No buyer profile found with this phone');
    process.exit(1);
  }

  const buyerDoc = buyerSnapshot.docs[0];
  const buyerData = buyerDoc.data();
  const oldUserId = buyerData.userId;

  console.log('\n✅ Found buyer profile:');
  console.log('  Buyer ID:', buyerDoc.id);
  console.log('  Current userId:', oldUserId);
  console.log('  Email:', buyerData.email);

  if (oldUserId === correctUserId) {
    console.log('\n✅ userId is already correct! No changes needed.');
    process.exit(0);
  }

  console.log(`\n🔧 Updating buyer profile userId: ${oldUserId} → ${correctUserId}`);

  await buyerDoc.ref.update({
    userId: correctUserId,
    updatedAt: admin.firestore.Timestamp.now()
  });

  console.log('✅ FIXED! Buyer profile now has correct userId.\n');
  process.exit(0);
}

fixBuyerProfileUserId().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
