// Check which leads are showing up and identify realtors
import { getDb } from '../src/lib/firebase-admin-init';

async function checkRealtorLeads() {
  console.log('\n🔍 Checking Realtor Leads Issue\n');
  console.log('='.repeat(60));

  const db = await getDb();

  // Get all users with realtor role
  const realtorsSnapshot = await db
    .collection('users')
    .where('role', '==', 'realtor')
    .get();

  console.log(`\n👔 Total realtors in users collection: ${realtorsSnapshot.size}`);

  const realtorUserIds = new Set<string>();
  const realtorEmails = new Map<string, string>();

  realtorsSnapshot.forEach(doc => {
    const data = doc.data();
    realtorUserIds.add(doc.id);
    realtorEmails.set(doc.id, data.email);
    console.log(`   - ${data.email} (userId: ${doc.id})`);
  });

  // Get all available buyer profiles
  const buyersSnapshot = await db
    .collection('buyerProfiles')
    .where('isAvailableForPurchase', '==', true)
    .where('isActive', '==', true)
    .where('profileComplete', '==', true)
    .get();

  console.log(`\n\n📊 Total available buyer profiles: ${buyersSnapshot.size}`);
  console.log('\n📋 Breakdown:');
  console.log('='.repeat(60));

  let actualBuyers = 0;
  let realtorProfiles = 0;

  buyersSnapshot.forEach(doc => {
    const buyer = doc.data();
    const isRealtor = buyer.userId && realtorUserIds.has(buyer.userId);

    if (isRealtor) {
      realtorProfiles++;
      console.log(`\n❌ REALTOR PROFILE (should be filtered):`);
      console.log(`   Buyer Profile ID: ${doc.id}`);
      console.log(`   User ID: ${buyer.userId}`);
      console.log(`   Name: ${buyer.firstName} ${buyer.lastName}`);
      console.log(`   Email: ${buyer.email}`);
      console.log(`   City: ${buyer.preferredCity}, ${buyer.preferredState}`);
      console.log(`   Linked User Email: ${realtorEmails.get(buyer.userId)}`);
    } else {
      actualBuyers++;
      console.log(`\n✅ ACTUAL BUYER:`);
      console.log(`   Buyer Profile ID: ${doc.id}`);
      console.log(`   User ID: ${buyer.userId || 'Not set'}`);
      console.log(`   Name: ${buyer.firstName} ${buyer.lastName}`);
      console.log(`   Email: ${buyer.email}`);
      console.log(`   City: ${buyer.preferredCity}, ${buyer.preferredState}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`\n📈 Summary:`);
  console.log(`   Actual Buyers: ${actualBuyers}`);
  console.log(`   Realtor Profiles: ${realtorProfiles}`);
  console.log(`   Total Available: ${buyersSnapshot.size}`);

  if (realtorProfiles > 0) {
    console.log(`\n⚠️  WARNING: ${realtorProfiles} realtor profiles are marked as available!`);
    console.log(`   These should be filtered out in the lead matching system.`);
  } else {
    console.log(`\n✅ No realtor profiles in available leads!`);
  }
}

checkRealtorLeads()
  .then(() => {
    console.log('\n✅ Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
