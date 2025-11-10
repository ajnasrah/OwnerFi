import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function cleanupOrphanedEntries() {
  console.log('🧹 Cleaning up orphaned queue entries...\n');

  // Get all queue entries
  const queueSnapshot = await db.collection('property_rotation_queue').get();
  console.log(`Found ${queueSnapshot.size} entries in rotation queue\n`);

  let deleted = 0;
  let kept = 0;
  const deletedEntries: any[] = [];

  for (const queueDoc of queueSnapshot.docs) {
    const queueData = queueDoc.data();
    const propertyId = queueData.propertyId;

    // Check if property exists
    const propertyDoc = await db.collection('properties').doc(propertyId).get();

    if (!propertyDoc.exists) {
      // Property deleted - remove from queue
      try {
        await queueDoc.ref.delete();
        deleted++;
        deletedEntries.push({
          queueId: queueDoc.id,
          propertyId: propertyId,
          address: queueData.address,
          city: queueData.city,
          state: queueData.state
        });
        console.log(`✅ Deleted: ${queueData.address || propertyId}`);
      } catch (error) {
        console.error(`❌ Failed to delete ${propertyId}:`, error);
      }
    } else {
      const propertyData = propertyDoc.data();

      // Check if property is inactive
      if (propertyData?.status !== 'active' || propertyData?.isActive !== true) {
        try {
          await queueDoc.ref.delete();
          deleted++;
          deletedEntries.push({
            queueId: queueDoc.id,
            propertyId: propertyId,
            address: queueData.address,
            city: queueData.city,
            state: queueData.state,
            reason: `Inactive (status: ${propertyData?.status}, isActive: ${propertyData?.isActive})`
          });
          console.log(`✅ Deleted: ${queueData.address || propertyId} (inactive)`);
        } catch (error) {
          console.error(`❌ Failed to delete ${propertyId}:`, error);
        }
      } else {
        kept++;
      }
    }
  }

  console.log('\n📊 CLEANUP SUMMARY:\n');
  console.log(`🗑️  Deleted: ${deleted} orphaned entries`);
  console.log(`✅ Kept: ${kept} valid entries`);
  console.log('━'.repeat(80));

  if (deletedEntries.length > 0) {
    console.log(`\n🗑️  DELETED ENTRIES:\n`);
    deletedEntries.forEach((entry, i) => {
      console.log(`${i + 1}. ${entry.address || 'Unknown Address'}`);
      console.log(`   Location: ${entry.city}, ${entry.state}`);
      console.log(`   Property ID: ${entry.propertyId}`);
      if (entry.reason) {
        console.log(`   Reason: ${entry.reason}`);
      }
    });
  }

  console.log('\n✅ Cleanup complete! Queue is now clean.');
}

cleanupOrphanedEntries()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
