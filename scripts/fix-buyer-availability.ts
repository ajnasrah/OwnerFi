// Fix existing buyers to be available for purchase
import { getDb } from '../src/lib/firebase-admin-init';

async function fixBuyerAvailability() {
  console.log('\n🔧 Fixing Buyer Availability\n');
  console.log('='.repeat(60));

  const db = await getDb();

  // Get all buyer profiles that are NOT available for purchase
  const buyersSnapshot = await db
    .collection('buyerProfiles')
    .where('isAvailableForPurchase', '==', false)
    .get();

  console.log(`\n📊 Found ${buyersSnapshot.size} buyers with isAvailableForPurchase=false`);

  if (buyersSnapshot.empty) {
    console.log('✅ All buyers are already available for purchase!');
    return;
  }

  let updated = 0;
  const batch = db.batch();

  for (const doc of buyersSnapshot.docs) {
    const buyer = doc.data();
    console.log(`\n🔧 Updating: ${buyer.firstName} ${buyer.lastName} (${buyer.email})`);
    console.log(`   City: ${buyer.preferredCity}, ${buyer.preferredState}`);

    batch.update(doc.ref, {
      isAvailableForPurchase: true,
      updatedAt: new Date()
    });
    updated++;
  }

  await batch.commit();

  console.log(`\n✅ Updated ${updated} buyers to be available for purchase`);
  console.log('='.repeat(60));
}

fixBuyerAvailability()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
