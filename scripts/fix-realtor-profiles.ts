// Set realtor buyer profiles to NOT be available for purchase
import { getDb } from '../src/lib/firebase-admin-init';

async function fixRealtorProfiles() {
  console.log('\n🔧 Fixing Realtor Buyer Profiles\n');
  console.log('='.repeat(60));

  const db = await getDb();

  // Get all users with realtor role
  const realtorsSnapshot = await db
    .collection('users')
    .where('role', '==', 'realtor')
    .get();

  const realtorUserIds = new Set<string>();
  realtorsSnapshot.forEach(doc => {
    realtorUserIds.add(doc.id);
  });

  console.log(`\n👔 Found ${realtorUserIds.size} realtors`);

  // Get all buyer profiles that belong to realtors
  const buyersSnapshot = await db
    .collection('buyerProfiles')
    .get();

  let fixed = 0;
  const batch = db.batch();

  buyersSnapshot.forEach(doc => {
    const buyer = doc.data();
    const isRealtor = buyer.userId && realtorUserIds.has(buyer.userId);

    if (isRealtor && buyer.isAvailableForPurchase === true) {
      console.log(`\n🔧 Fixing: ${buyer.firstName} ${buyer.lastName} (${buyer.email})`);
      console.log(`   Setting isAvailableForPurchase = false`);

      batch.update(doc.ref, {
        isAvailableForPurchase: false,
        updatedAt: new Date()
      });
      fixed++;
    }
  });

  if (fixed > 0) {
    await batch.commit();
    console.log(`\n✅ Fixed ${fixed} realtor profiles`);
  } else {
    console.log(`\n✅ No realtor profiles needed fixing`);
  }

  console.log('='.repeat(60));
}

fixRealtorProfiles()
  .then(() => {
    console.log('\n✅ Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
