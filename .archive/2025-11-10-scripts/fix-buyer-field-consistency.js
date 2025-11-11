// Script to fix buyer field consistency issues
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function fixBuyerFieldConsistency() {
  try {
    console.log('Fixing buyer field consistency...\n');

    // Get all buyer profiles
    const buyersSnapshot = await db.collection('buyerProfiles').get();
    console.log(`Total buyer profiles: ${buyersSnapshot.size}\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    const batch = db.batch();
    let batchCount = 0;

    for (const doc of buyersSnapshot.docs) {
      const buyer = doc.data();
      const updates = {};
      let needsUpdate = false;

      // Fix state fields
      if (buyer.state && !buyer.preferredState) {
        updates.preferredState = buyer.state;
        needsUpdate = true;
        console.log(`${buyer.firstName} ${buyer.lastName}: Adding preferredState = ${buyer.state}`);
      }

      // Fix city fields
      if (buyer.city && !buyer.preferredCity) {
        updates.preferredCity = buyer.city;
        needsUpdate = true;
        console.log(`${buyer.firstName} ${buyer.lastName}: Adding preferredCity = ${buyer.city}`);
      } else if (!buyer.preferredCity && !buyer.city) {
        // If no city at all, mark as incomplete
        updates.profileComplete = false;
        needsUpdate = true;
        console.log(`${buyer.firstName} ${buyer.lastName}: No city found, marking profile incomplete`);
      }

      // Make sure Dallas buyers have correct state
      if ((buyer.preferredCity || buyer.city || '').toLowerCase() === 'dallas' && !buyer.preferredState) {
        updates.preferredState = 'TX';
        needsUpdate = true;
        console.log(`${buyer.firstName} ${buyer.lastName}: Setting preferredState = TX for Dallas buyer`);
      }

      // Apply updates
      if (needsUpdate) {
        batch.update(doc.ref, updates);
        updatedCount++;
        batchCount++;

        // Commit batch every 500 operations
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`Committed batch of ${batchCount} updates`);
          batchCount = 0;
        }
      } else {
        skippedCount++;
      }
    }

    // Commit remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`Committed final batch of ${batchCount} updates`);
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Updated: ${updatedCount} profiles`);
    console.log(`Skipped: ${skippedCount} profiles (no changes needed)`);

    // Verify the fix
    console.log('\n=== VERIFICATION ===');
    const verifySnapshot = await db.collection('buyerProfiles').get();

    let missingPreferredState = 0;
    let missingPreferredCity = 0;
    let dallasWithState = 0;

    verifySnapshot.forEach(doc => {
      const buyer = doc.data();
      if (!buyer.preferredState) missingPreferredState++;
      if (!buyer.preferredCity) missingPreferredCity++;
      if ((buyer.preferredCity || '').toLowerCase() === 'dallas' && buyer.preferredState) {
        dallasWithState++;
      }
    });

    console.log(`Buyers missing preferredState: ${missingPreferredState}`);
    console.log(`Buyers missing preferredCity: ${missingPreferredCity}`);
    console.log(`Dallas buyers with state set: ${dallasWithState}`);

  } catch (error) {
    console.error('Error fixing buyer fields:', error);
  } finally {
    await admin.app().delete();
  }
}

// Run the script
fixBuyerFieldConsistency();