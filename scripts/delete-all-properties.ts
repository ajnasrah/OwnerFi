/**
 * DELETE ALL PROPERTIES FROM DATABASE
 * WARNING: This will permanently delete all properties from the 'properties' collection
 */

import admin from 'firebase-admin';

async function deleteAllProperties() {
  console.log('⚠️  DELETE ALL PROPERTIES');
  console.log('='.repeat(80));
  console.log('WARNING: This will PERMANENTLY DELETE all properties from the database!');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Initialize Firebase Admin
    if (admin.apps.length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

      if (!projectId || !privateKey || !clientEmail) {
        console.error('❌ Missing Firebase credentials');
        return;
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey,
          clientEmail,
        })
      });
    }

    const db = admin.firestore();
    const propertiesRef = db.collection('properties');

    // Get count first
    console.log('📊 Counting properties...');
    const snapshot = await propertiesRef.count().get();
    const totalCount = snapshot.data().count;

    console.log(`\n📦 Found ${totalCount} properties to delete\n`);

    if (totalCount === 0) {
      console.log('✅ No properties to delete');
      return;
    }

    console.log('🗑️  Starting deletion...\n');

    // Delete in batches of 500 (Firestore limit)
    const batchSize = 500;
    let deletedCount = 0;

    while (deletedCount < totalCount) {
      const batch = db.batch();
      const querySnapshot = await propertiesRef.limit(batchSize).get();

      if (querySnapshot.empty) {
        break;
      }

      querySnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      deletedCount += querySnapshot.size;

      console.log(`   Deleted ${deletedCount} / ${totalCount} properties...`);
    }

    console.log('\n✅ SUCCESS!');
    console.log('='.repeat(80));
    console.log(`All ${totalCount} properties have been deleted from the database.`);
    console.log('='.repeat(80));
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (admin.apps.length > 0) {
      await admin.app().delete();
    }
  }
}

deleteAllProperties();
