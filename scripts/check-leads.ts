import { FirebaseDB } from '../src/lib/firebase-db';

async function checkLeads() {
  console.log('\n🔍 Checking Buyer Leads and Realtor Data\n');
  console.log('='.repeat(60));

  // Get all buyer profiles
  const buyers = await FirebaseDB.getCollection('buyerProfiles');
  console.log(`\n📊 Total buyer profiles: ${buyers.length}`);

  // Get recent buyers (last 10)
  const recentBuyers = buyers
    .sort((a: any, b: any) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    })
    .slice(0, 10);

  console.log('\n📋 Recent 10 Buyers:');
  console.log('='.repeat(60));
  recentBuyers.forEach((buyer: any, i: number) => {
    const isActive = buyer.isActive !== false;
    console.log(`\n${i + 1}. Buyer ID: ${buyer.id}`);
    console.log(`   Name: ${buyer.firstName} ${buyer.lastName}`);
    console.log(`   Email: ${buyer.email}`);
    console.log(`   Phone: ${buyer.phone}`);
    console.log(`   City: ${buyer.preferredCity}, ${buyer.preferredState}`);
    console.log(`   Created: ${buyer.createdAt?.toDate?.() || 'Unknown'}`);
    console.log(`   Is Active: ${isActive ? 'Yes' : 'No'}`);
  });

  // Get all realtors
  const users = await FirebaseDB.getCollection('users');
  const realtors = users.filter((u: any) => u.role === 'realtor');
  console.log(`\n\n👔 Total realtors: ${realtors.length}`);

  console.log('\n📋 Realtor Service Areas:');
  console.log('='.repeat(60));
  for (const realtor of realtors) {
    // Get realtor's buyer profile to see service area
    const profiles = await FirebaseDB.queryDocuments('buyerProfiles', [
      { field: 'userId', operator: '==', value: realtor.id }
    ]);

    const profile = profiles[0];
    console.log(`\nRealtor: ${realtor.email}`);
    console.log(`  User ID: ${realtor.id}`);
    console.log(`  Credits: ${realtor.realtorData?.credits || 0}`);
    if (profile) {
      console.log(`  Service City: ${profile.preferredCity || 'Not set'}, ${profile.preferredState || 'Not set'}`);
      console.log(`  Has Filter: ${profile.filter ? 'Yes' : 'No'}`);
      if (profile.filter?.cities) {
        console.log(`  Filter Cities: ${profile.filter.cities.length} cities`);
        console.log(`  First 5 cities: ${profile.filter.cities.slice(0, 5).join(', ')}`);
      }
    } else {
      console.log(`  ⚠️  No buyer profile found`);
    }
  }

  // Check lead purchases
  const purchases = await FirebaseDB.getCollection('leadPurchases');
  console.log(`\n\n💰 Total lead purchases: ${purchases.length}`);
}

checkLeads().catch(console.error);
