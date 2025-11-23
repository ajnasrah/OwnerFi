/**
 * DELETE OLD REALTOR PROFILES
 *
 * This script deletes all realtor profiles from the old system:
 * - Deletes all documents in the 'realtors' collection (old separate collection)
 * - Removes realtorData from users with role='realtor' who have passwords (old email/password accounts)
 * - Keeps phone-auth realtor accounts (no password)
 *
 * Run with: npx tsx scripts/delete-old-realtor-profiles.ts
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

async function deleteOldRealtorProfiles() {
  console.log('🗑️  Starting deletion of old realtor profiles...\n');

  let realtorsCollectionDeleted = 0;
  let realtorDataRemoved = 0;
  let phoneAuthRealtorsKept = 0;

  // Step 1: Delete all documents from the old 'realtors' collection
  console.log('📋 Step 1: Deleting old "realtors" collection...');
  const realtorsSnapshot = await db.collection('realtors').get();

  if (realtorsSnapshot.empty) {
    console.log('  ℹ️  No documents found in "realtors" collection');
  } else {
    console.log(`  Found ${realtorsSnapshot.size} documents in "realtors" collection`);

    const batch = db.batch();
    realtorsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      console.log(`  🗑️  Queued for deletion: ${doc.id}`);
    });

    await batch.commit();
    realtorsCollectionDeleted = realtorsSnapshot.size;
    console.log(`  ✅ Deleted ${realtorsCollectionDeleted} documents from "realtors" collection`);
  }

  // Step 2: Find and clean up old email/password realtor accounts
  console.log('\n📱 Step 2: Cleaning up old email/password realtor accounts...');
  const usersSnapshot = await db.collection('users')
    .where('role', '==', 'realtor')
    .get();

  console.log(`  Found ${usersSnapshot.size} users with role='realtor'`);

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const hasPassword = userData.password && userData.password.length > 0;
    const hasRealtorData = !!userData.realtorData;

    console.log(`\n  User: ${userDoc.id}`);
    console.log(`    Email: ${userData.email}`);
    console.log(`    Phone: ${userData.phone || 'none'}`);
    console.log(`    Has password: ${hasPassword}`);
    console.log(`    Has realtorData: ${hasRealtorData}`);

    // Old account = has password
    if (hasPassword) {
      console.log(`    🗑️  OLD ACCOUNT (has password) - removing realtorData and converting to buyer`);

      try {
        await userDoc.ref.update({
          role: 'buyer', // Convert to buyer
          realtorData: admin.firestore.FieldValue.delete(), // Remove realtor data
          migratedFromRealtor: true,
          migratedAt: admin.firestore.Timestamp.now()
        });
        realtorDataRemoved++;
        console.log(`    ✅ Converted to buyer and removed realtorData`);
      } catch (error) {
        console.error(`    ❌ Error updating user:`, error);
      }
    } else {
      // New phone-auth account = no password
      console.log(`    ✅ NEW PHONE-AUTH ACCOUNT (no password) - keeping as is`);
      phoneAuthRealtorsKept++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ CLEANUP COMPLETE');
  console.log('='.repeat(60));
  console.log(`Old "realtors" collection documents deleted: ${realtorsCollectionDeleted}`);
  console.log(`Old email/password realtor accounts converted to buyers: ${realtorDataRemoved}`);
  console.log(`New phone-auth realtor accounts kept: ${phoneAuthRealtorsKept}`);
  console.log('\n💡 Old realtor profiles have been cleaned up.');
  console.log('   New phone-auth realtor accounts are preserved.');

  process.exit(0);
}

// Run the cleanup
deleteOldRealtorProfiles().catch((error) => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});
