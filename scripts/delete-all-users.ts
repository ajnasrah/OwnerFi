#!/usr/bin/env tsx
/**
 * DELETE ALL USERS SCRIPT
 *
 * ⚠️ WARNING: This will permanently delete ALL users and related data
 * Use this to reset the database for testing signup flows
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();
const auth = getAuth();

async function deleteCollection(collectionName: string) {
  console.log(`\n🗑️  Deleting all documents from ${collectionName}...`);

  const snapshot = await db.collection(collectionName).get();

  if (snapshot.empty) {
    console.log(`   ℹ️  No documents found in ${collectionName}`);
    return 0;
  }

  const batchSize = 500;
  let deletedCount = 0;

  // Delete in batches
  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = db.batch();
    const batchDocs = snapshot.docs.slice(i, i + batchSize);

    batchDocs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    deletedCount += batchDocs.length;
    console.log(`   ✅ Deleted ${deletedCount}/${snapshot.docs.length} documents`);
  }

  return deletedCount;
}

async function deleteAllAuthUsers() {
  console.log(`\n🗑️  Deleting all Firebase Auth users...`);

  let deletedCount = 0;
  let pageToken: string | undefined;

  do {
    const listUsersResult = await auth.listUsers(1000, pageToken);

    if (listUsersResult.users.length === 0) {
      console.log(`   ℹ️  No auth users found`);
      break;
    }

    // Delete users in batches
    const deletePromises = listUsersResult.users.map(user =>
      auth.deleteUser(user.uid)
        .then(() => {
          deletedCount++;
          if (deletedCount % 100 === 0) {
            console.log(`   ✅ Deleted ${deletedCount} auth users...`);
          }
        })
        .catch(error => {
          console.error(`   ❌ Error deleting user ${user.uid}:`, error.message);
        })
    );

    await Promise.all(deletePromises);
    pageToken = listUsersResult.pageToken;
  } while (pageToken);

  console.log(`   ✅ Total auth users deleted: ${deletedCount}`);
  return deletedCount;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('⚠️  DELETE ALL USERS - DESTRUCTIVE OPERATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('This will delete:');
  console.log('  - All Firebase Auth users');
  console.log('  - All user documents');
  console.log('  - All buyer profiles');
  console.log('  - All realtor profiles');
  console.log('  - All transactions');
  console.log('  - All subscriptions');
  console.log('═══════════════════════════════════════════════════════════\n');

  const startTime = Date.now();

  try {
    // Delete Firebase Auth users
    const authCount = await deleteAllAuthUsers();

    // Delete Firestore collections
    const usersCount = await deleteCollection('users');
    const buyersCount = await deleteCollection('buyerProfiles');
    const realtorsCount = await deleteCollection('realtors');
    const subscriptionsCount = await deleteCollection('realtorSubscriptions');
    const transactionsCount = await deleteCollection('transactions');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ DELETION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Firebase Auth users:     ${authCount}`);
    console.log(`User documents:          ${usersCount}`);
    console.log(`Buyer profiles:          ${buyersCount}`);
    console.log(`Realtor profiles:        ${realtorsCount}`);
    console.log(`Subscriptions:           ${subscriptionsCount}`);
    console.log(`Transactions:            ${transactionsCount}`);
    console.log(`\nTotal time: ${duration}s`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Error during deletion:', error);
    process.exit(1);
  }
}

main();
