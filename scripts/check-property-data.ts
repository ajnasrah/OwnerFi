import { getAdminDb } from '../src/lib/firebase-admin';

async function checkProperties() {
  const db = await getAdminDb();
  if (!db) {
    console.log('❌ Failed to initialize Firebase Admin');
    return;
  }

  const propertiesSnapshot = await db.collection('properties').limit(5).get();

  console.log('📊 Properties in database:', propertiesSnapshot.size);

  propertiesSnapshot.forEach((doc) => {
    const data = doc.data();
    console.log('\n=== Property:', doc.id, '===');
    console.log('Address:', data.address);
    console.log('City:', data.city);
    console.log('Status:', data.status);
    console.log('isActive:', data.isActive);
    console.log('Images:', data.imageUrls?.length || 0);
    console.log('Required fields check:');
    console.log('  - listPrice:', data.listPrice);
    console.log('  - downPaymentAmount:', data.downPaymentAmount);
    console.log('  - downPaymentPercent:', data.downPaymentPercent);
    console.log('  - monthlyPayment:', data.monthlyPayment);
    console.log('  - interestRate:', data.interestRate);
    console.log('  - termYears:', data.termYears);
    console.log('  - bedrooms:', data.bedrooms);
    console.log('  - bathrooms:', data.bathrooms);
  });

  process.exit(0);
}

checkProperties();
