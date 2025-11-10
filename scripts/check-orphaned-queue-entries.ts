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

async function checkOrphanedEntries() {
  console.log('🔍 Checking for orphaned queue entries...\n');

  // Get all queue entries
  const queueSnapshot = await db.collection('property_rotation_queue').get();
  console.log(`Found ${queueSnapshot.size} entries in rotation queue\n`);

  let valid = 0;
  let orphaned = 0;
  const orphanedEntries: any[] = [];

  for (const queueDoc of queueSnapshot.docs) {
    const queueData = queueDoc.data();
    const propertyId = queueData.propertyId;

    // Check if property exists
    const propertyDoc = await db.collection('properties').doc(propertyId).get();

    if (!propertyDoc.exists) {
      orphaned++;
      orphanedEntries.push({
        queueId: queueDoc.id,
        propertyId: propertyId,
        address: queueData.address,
        city: queueData.city,
        state: queueData.state
      });
    } else {
      const propertyData = propertyDoc.data();

      // Check if property is active
      if (propertyData?.status !== 'active' || propertyData?.isActive !== true) {
        orphaned++;
        orphanedEntries.push({
          queueId: queueDoc.id,
          propertyId: propertyId,
          address: queueData.address,
          city: queueData.city,
          state: queueData.state,
          reason: `Property exists but inactive (status: ${propertyData?.status}, isActive: ${propertyData?.isActive})`
        });
      } else {
        valid++;
      }
    }
  }

  console.log('📊 SUMMARY:\n');
  console.log(`✅ Valid entries: ${valid}`);
  console.log(`❌ Orphaned entries: ${orphaned}`);
  console.log('━'.repeat(80));

  if (orphanedEntries.length > 0) {
    console.log(`\n❌ ORPHANED QUEUE ENTRIES:\n`);
    orphanedEntries.forEach((entry, i) => {
      console.log(`${i + 1}. ${entry.address || 'Unknown Address'}`);
      console.log(`   Location: ${entry.city}, ${entry.state}`);
      console.log(`   Queue ID: ${entry.queueId}`);
      console.log(`   Property ID: ${entry.propertyId}`);
      if (entry.reason) {
        console.log(`   Reason: ${entry.reason}`);
      } else {
        console.log(`   Reason: Property deleted from database`);
      }
      console.log('');
    });

    console.log(`\n💡 To clean up these ${orphanedEntries.length} orphaned entries, you can:`);
    console.log(`   1. Manually delete them from property_rotation_queue collection`);
    console.log(`   2. Or run a cleanup script to remove them automatically\n`);
  } else {
    console.log('\n✅ No orphaned entries found! Queue is clean.');
  }
}

checkOrphanedEntries()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
