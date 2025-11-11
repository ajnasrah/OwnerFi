const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

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

async function checkAllProperties() {
  console.log('=== TOTAL PROPERTIES COUNT ===\n');

  try {
    // Get ALL properties
    const allPropertiesSnapshot = await db.collection('properties').get();
    console.log(`📊 Total Properties in Database: ${allPropertiesSnapshot.size}\n`);

    // Get active properties
    const activeSnapshot = await db.collection('properties')
      .where('isActive', '==', true)
      .get();
    console.log(`✅ Active Properties: ${activeSnapshot.size}`);

    // Get inactive properties
    const inactiveCount = allPropertiesSnapshot.size - activeSnapshot.size;
    console.log(`❌ Inactive Properties: ${inactiveCount}\n`);

    // Get properties with balloon years
    const withBalloonSnapshot = await db.collection('properties')
      .where('balloonYears', '>', 0)
      .get();
    console.log(`🎈 Properties with Balloon Years: ${withBalloonSnapshot.size}`);

    // Get properties WITHOUT balloon years
    const withoutBalloonCount = allPropertiesSnapshot.size - withBalloonSnapshot.size;
    console.log(`📝 Properties WITHOUT Balloon Years: ${withoutBalloonCount}`);

    // Calculate percentages
    const balloonPercentage = ((withBalloonSnapshot.size / allPropertiesSnapshot.size) * 100).toFixed(1);
    const noBalloonPercentage = ((withoutBalloonCount / allPropertiesSnapshot.size) * 100).toFixed(1);

    console.log(`\n📈 Balloon Distribution:`);
    console.log(`   - With Balloon: ${balloonPercentage}%`);
    console.log(`   - No Balloon: ${noBalloonPercentage}%`);

    console.log('\n=== SUMMARY ===');
    console.log(`Out of ${allPropertiesSnapshot.size} total properties:`);
    console.log(`  • ${withBalloonSnapshot.size} have balloon/refinance terms (${balloonPercentage}%)`);
    console.log(`  • ${withoutBalloonCount} are standard financing (${noBalloonPercentage}%)`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await admin.app().delete();
  }
}

checkAllProperties().catch(console.error);
