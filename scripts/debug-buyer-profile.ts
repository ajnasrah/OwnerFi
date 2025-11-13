/**
 * Debug script to check buyer profiles and their userId fields
 *
 * Usage: npx tsx scripts/debug-buyer-profile.ts <email>
 */

import { getAdminDb } from '../src/lib/firebase-admin';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function debugBuyerProfile(email?: string) {
  const db = getAdminDb();

  if (email) {
    console.log(`\n🔍 Searching for buyer with email: ${email}\n`);

    // Find user by email
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', email)
    );
    const userSnapshot = await getDocs(usersQuery);

    if (userSnapshot.empty) {
      console.log('❌ No user found with that email');
      return;
    }

    const user = userSnapshot.docs[0];
    const userData = user.data();

    console.log('✅ User found:');
    console.log(`  - ID: ${user.id}`);
    console.log(`  - Email: ${userData.email}`);
    console.log(`  - Name: ${userData.name || 'N/A'}`);
    console.log(`  - Role: ${userData.role}`);
    console.log();

    // Find buyer profile by userId
    console.log(`🔍 Searching for buyer profile with userId=${user.id}`);
    const profileByUserIdQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', user.id)
    );
    const profileByUserId = await getDocs(profileByUserIdQuery);

    if (!profileByUserId.empty) {
      const profile = profileByUserId.docs[0];
      const profileData = profile.data();
      console.log('✅ Profile found by userId:');
      console.log(`  - Profile ID: ${profile.id}`);
      console.log(`  - UserId: ${profileData.userId}`);
      console.log(`  - City: ${profileData.preferredCity || profileData.city}`);
      console.log(`  - State: ${profileData.preferredState || profileData.state}`);
      console.log(`  - Max Monthly: $${profileData.maxMonthlyPayment || 0}`);
      console.log(`  - Max Down: $${profileData.maxDownPayment || 0}`);
      console.log(`  - Profile Complete: ${profileData.profileComplete}`);
    } else {
      console.log('❌ No profile found by userId, trying by email...');

      // Try by email
      const profileByEmailQuery = query(
        collection(db, 'buyerProfiles'),
        where('email', '==', email)
      );
      const profileByEmail = await getDocs(profileByEmailQuery);

      if (!profileByEmail.empty) {
        const profile = profileByEmail.docs[0];
        const profileData = profile.data();
        console.log('⚠️  Profile found by EMAIL (userId mismatch!):');
        console.log(`  - Profile ID: ${profile.id}`);
        console.log(`  - UserId in profile: ${profileData.userId}`);
        console.log(`  - UserId from user: ${user.id}`);
        console.log(`  - EMAIL MATCH: ${profileData.email}`);
        console.log(`  - City: ${profileData.preferredCity || profileData.city}`);
        console.log(`  - State: ${profileData.preferredState || profileData.state}`);
        console.log();
        console.log('🔧 FIX: The profile exists but has wrong userId!');
        console.log(`   Run this in Firebase Console or use the API endpoint to fix it.`);
      } else {
        console.log('❌ No profile found by email either');
      }
    }
  } else {
    // List all buyer profiles
    console.log('📊 Listing all buyer profiles:\n');
    const profilesSnapshot = await getDocs(collection(db, 'buyerProfiles'));

    console.log(`Total profiles: ${profilesSnapshot.docs.length}\n`);

    for (const doc of profilesSnapshot.docs) {
      const data = doc.data();
      console.log(`Profile: ${doc.id}`);
      console.log(`  - Email: ${data.email}`);
      console.log(`  - UserId: ${data.userId || 'MISSING'}`);
      console.log(`  - City: ${data.preferredCity || data.city || 'N/A'}`);
      console.log(`  - State: ${data.preferredState || data.state || 'N/A'}`);
      console.log();
    }
  }
}

// Run
const email = process.argv[2];
debugBuyerProfile(email)
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
