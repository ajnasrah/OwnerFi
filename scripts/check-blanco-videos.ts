/**
 * Check if 6710 Blanco St has videos in the queue
 */

import admin from 'firebase-admin';

async function checkBlancoVideos() {
  console.log('🎥 CHECKING VIDEOS FOR 6710 BLANCO ST\n');
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

    const propertyId = 'A9XiyfXzyTx6uYliVQW7';

    console.log('\n🔍 Searching for videos related to property A9XiyfXzyTx6uYliVQW7...\n');

    // Check different collections for videos
    const collections = [
      'propertyVideos',
      'videos',
      'socialMediaQueue',
      'videoQueue',
      'workflows',
      'propertyWorkflows'
    ];

    for (const collectionName of collections) {
      console.log(`\n📁 Checking collection: ${collectionName}`);
      console.log('-'.repeat(80));

      try {
        // Try to find by propertyId
        const snapshot = await db.collection(collectionName)
          .where('propertyId', '==', propertyId)
          .get();

        if (!snapshot.empty) {
          console.log(`✅ Found ${snapshot.size} record(s) in ${collectionName}\n`);

          snapshot.forEach((doc) => {
            const data = doc.data();
            console.log(`   Document ID: ${doc.id}`);
            console.log(`   Status: ${data.status || 'unknown'}`);
            console.log(`   Created: ${data.createdAt?.toDate?.()?.toLocaleString() || 'unknown'}`);
            console.log(`   Updated: ${data.updatedAt?.toDate?.()?.toLocaleString() || 'unknown'}`);

            if (data.videoUrl) console.log(`   Video URL: ${data.videoUrl}`);
            if (data.heygenVideoId) console.log(`   HeyGen ID: ${data.heygenVideoId}`);
            if (data.videoStatus) console.log(`   Video Status: ${data.videoStatus}`);
            if (data.workflow) console.log(`   Workflow: ${data.workflow}`);
            if (data.step) console.log(`   Step: ${data.step}`);
            console.log('');
          });
        } else {
          console.log(`   No records found in ${collectionName}`);
        }
      } catch (error: any) {
        console.log(`   ⚠️  Cannot query ${collectionName}: ${error.message}`);
      }
    }

    // Also search by address in workflows
    console.log('\n📁 Checking workflows by address/property reference');
    console.log('-'.repeat(80));

    try {
      const workflowSnapshot = await db.collection('propertyWorkflows').get();

      const blancoWorkflows = workflowSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.propertyId === propertyId ||
               data.address?.includes('6710 Blanco') ||
               data.address?.includes('Blanco St') ||
               (data.property?.address && data.property.address.includes('6710 Blanco'));
      });

      if (blancoWorkflows.length > 0) {
        console.log(`✅ Found ${blancoWorkflows.length} workflow(s) for 6710 Blanco St\n`);

        blancoWorkflows.forEach((doc) => {
          const data = doc.data();
          console.log(`   Workflow ID: ${doc.id}`);
          console.log(`   Property ID: ${data.propertyId}`);
          console.log(`   Address: ${data.address || data.property?.address || 'unknown'}`);
          console.log(`   Status: ${data.status || 'unknown'}`);
          console.log(`   Step: ${data.currentStep || data.step || 'unknown'}`);
          console.log(`   Created: ${data.createdAt?.toDate?.()?.toLocaleString() || 'unknown'}`);
          console.log(`   Updated: ${data.updatedAt?.toDate?.()?.toLocaleString() || 'unknown'}`);

          if (data.videoUrl) console.log(`   Video URL: ${data.videoUrl}`);
          if (data.heygenVideoId) console.log(`   HeyGen ID: ${data.heygenVideoId}`);
          if (data.error) console.log(`   Error: ${data.error}`);

          console.log('');
        });
      } else {
        console.log('   No workflows found for 6710 Blanco St');
      }
    } catch (error: any) {
      console.log(`   ⚠️  Error searching workflows: ${error.message}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (admin.apps.length > 0) {
      await admin.app().delete();
    }
  }
}

checkBlancoVideos();
