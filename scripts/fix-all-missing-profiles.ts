/**
 * Find ALL users with missing buyer profiles and create them
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

async function fixAllMissingProfiles() {
  console.log('🔍 Finding users with missing buyer profiles...\n');

  // Get all buyer/realtor users (admins don't need profiles)
  const usersSnapshot = await db.collection('users').get();

  let fixed = 0;
  let skipped = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();

    // Skip admins
    if (userData.role === 'admin') {
      continue;
    }

    // Check if buyer profile exists
    const buyerQuery = await db.collection('buyerProfiles')
      .where('userId', '==', userDoc.id)
      .get();

    if (buyerQuery.empty) {
      // Skip users with no email (invalid data)
      if (!userData.email) {
        console.log(`⚠️  User ${userDoc.id} has no email - skipping`);
        skipped++;
        continue;
      }

      console.log(`❌ User ${userDoc.id} (${userData.email}) has NO buyer profile`);
      console.log(`   Creating profile...`);

      const buyerId = `buyer_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      await db.collection('buyerProfiles').doc(buyerId).set({
        id: buyerId,
        userId: userDoc.id,
        firstName: userData.name?.split(' ')[0] || '',
        lastName: userData.name?.split(' ').slice(1).join(' ') || '',
        email: userData.email,
        phone: userData.phone || '',

        // Empty location/budget
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

      console.log(`   ✅ Created: ${buyerId}\n`);
      fixed++;

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      skipped++;
    }
  }

  console.log('='.repeat(60));
  console.log('✅ COMPLETE');
  console.log('='.repeat(60));
  console.log(`Profiles created: ${fixed}`);
  console.log(`Users already had profiles: ${skipped}`);
  console.log(`\nAll users can now sign in successfully!\n`);

  process.exit(0);
}

fixAllMissingProfiles().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
