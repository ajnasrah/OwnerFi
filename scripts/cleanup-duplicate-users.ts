/**
 * ONE-TIME CLEANUP: Merge duplicate user accounts
 *
 * For each phone number with duplicates:
 * 1. Keep the NEWEST account (most recent createdAt)
 * 2. Update all buyer profiles to use the kept account's userId
 * 3. Delete the old duplicate accounts
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

async function cleanupDuplicates() {
  console.log('🧹 Starting duplicate user cleanup...\n');

  const usersSnapshot = await db.collection('users').get();

  // Group users by phone
  const phoneMap = new Map<string, any[]>();

  usersSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.phone) {
      if (!phoneMap.has(data.phone)) {
        phoneMap.set(data.phone, []);
      }
      phoneMap.get(data.phone)!.push({
        id: doc.id,
        ref: doc.ref,
        ...data
      });
    }
  });

  let phonesProcessed = 0;
  let usersDeleted = 0;
  let profilesUpdated = 0;

  // Process each phone number with duplicates
  for (const [phone, users] of phoneMap.entries()) {
    if (users.length <= 1) continue; // Skip non-duplicates

    console.log(`\n📱 Phone: ${phone} (${users.length} accounts)`);

    // Sort by createdAt (newest first)
    users.sort((a, b) => {
      const aTime = a.createdAt?.toMillis() || 0;
      const bTime = b.createdAt?.toMillis() || 0;
      return bTime - aTime; // Newest first
    });

    const keepUser = users[0];
    const deleteUsers = users.slice(1);

    console.log(`  ✅ KEEPING: ${keepUser.id} (${keepUser.email})`);

    // Update all buyer profiles pointing to old userIds
    for (const oldUser of deleteUsers) {
      console.log(`  🗑️  DELETING: ${oldUser.id} (${oldUser.email})`);

      // Find buyer profiles with this old userId
      const buyerProfiles = await db.collection('buyerProfiles')
        .where('userId', '==', oldUser.id)
        .get();

      for (const profile of buyerProfiles.docs) {
        await profile.ref.update({
          userId: keepUser.id,
          updatedAt: admin.firestore.Timestamp.now()
        });
        console.log(`    ↳ Updated buyer profile ${profile.id} to use kept userId`);
        profilesUpdated++;
      }

      // Delete the old user account
      await oldUser.ref.delete();
      usersDeleted++;
    }

    phonesProcessed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ CLEANUP COMPLETE');
  console.log('='.repeat(60));
  console.log(`Phone numbers with duplicates: ${phonesProcessed}`);
  console.log(`Duplicate user accounts deleted: ${usersDeleted}`);
  console.log(`Buyer profiles updated: ${profilesUpdated}\n`);

  process.exit(0);
}

cleanupDuplicates().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
