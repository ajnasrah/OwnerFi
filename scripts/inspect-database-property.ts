/**
 * Inspect a sample property from the database to see what fields are actually saved
 */

import admin from 'firebase-admin';

async function inspectProperty() {
  console.log('🔍 INSPECT DATABASE PROPERTY');
  console.log('='.repeat(80));

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

    // Get a few sample properties
    const snapshot = await db.collection('properties').limit(3).get();

    console.log(`\n📊 Found ${snapshot.size} properties to inspect\n`);

    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n--- Property ${index + 1} (${doc.id}) ---`);
      console.log(JSON.stringify(data, null, 2));
      console.log('\n' + '='.repeat(80));
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (admin.apps.length > 0) {
      await admin.app().delete();
    }
  }
}

inspectProperty();
