/**
 * Populate Property Rotation Queue
 * Adds all active properties that are missing from the rotation queue
 *
 * Run with: npx tsx scripts/populate-property-queue.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function populateQueue() {
  console.log('🔄 Populating Property Rotation Queue\n');
  console.log('='.repeat(80));

  try {
    // Get all active properties
    const propertiesSnapshot = await db.collection('properties')
      .where('isActive', '==', true)
      .get();

    console.log(`\n📊 Found ${propertiesSnapshot.size} active properties`);

    // Get existing queue items
    const queueSnapshot = await db.collection('property_rotation_queue').get();
    const existingPropertyIds = new Set(queueSnapshot.docs.map(doc => doc.data().propertyId));

    console.log(`   ${existingPropertyIds.size} already in queue`);

    // Find missing properties
    const missingProperties = propertiesSnapshot.docs.filter(doc =>
      !existingPropertyIds.has(doc.id)
    );

    console.log(`   ${missingProperties.length} missing from queue`);

    if (missingProperties.length === 0) {
      console.log('\n✅ Queue is up to date! No properties to add.');
      return;
    }

    console.log(`\n➕ Adding ${missingProperties.length} properties to queue...`);

    // Get next position number
    let maxPosition = 0;
    queueSnapshot.docs.forEach(doc => {
      const pos = doc.data().position || 0;
      if (pos > maxPosition) maxPosition = pos;
    });

    // Add missing properties in batches
    const BATCH_SIZE = 500;
    let added = 0;

    for (let i = 0; i < missingProperties.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = missingProperties.slice(i, i + BATCH_SIZE);

      chunk.forEach((propDoc, idx) => {
        const data = propDoc.data();
        const queueDoc = db.collection('property_rotation_queue').doc();

        batch.set(queueDoc, {
          propertyId: propDoc.id,
          address: data.address || 'Unknown',
          city: data.city || '',
          state: data.state || '',
          downPayment: data.downPaymentAmount || 0,
          monthlyPayment: data.monthlyPayment || 0,
          videoCount: 0,
          status: 'queued',
          position: maxPosition + i + idx + 1,
          currentCycleCount: 0,
          addedAt: Date.now()
        });
      });

      await batch.commit();
      added += chunk.length;
      console.log(`   Added ${added}/${missingProperties.length}...`);
    }

    console.log(`\n✅ Successfully added ${added} properties to rotation queue!`);

    // Final stats
    const finalSnapshot = await db.collection('property_rotation_queue').get();
    console.log(`\n📊 Final Queue Stats:`);
    console.log(`   Total in queue: ${finalSnapshot.size}`);
    console.log(`   Total active properties: ${propertiesSnapshot.size}`);
    console.log(`   Coverage: ${Math.round((finalSnapshot.size / propertiesSnapshot.size) * 100)}%`);

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Queue population complete!');
    console.log('\n💡 Next: Run property video cron to start generating videos');
    console.log('');

  } catch (error) {
    console.error('❌ Error populating queue:', error);
    throw error;
  }
}

populateQueue().catch(console.error);
