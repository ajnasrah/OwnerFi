import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function verifyRentalEstimateSaved() {
  console.log('🔍 Verifying Rental Estimate Data in Database\n');
  console.log('='.repeat(60));

  // Query for properties with rentZestimate
  const snapshot = await db.collection('properties')
    .where('rentZestimate', '>', 0)
    .orderBy('rentZestimate', 'desc')
    .limit(10)
    .get();

  console.log(`\n✅ Found ${snapshot.size} properties with rental estimates\n`);

  if (snapshot.empty) {
    console.log('❌ No properties found with rentZestimate field');
    return;
  }

  snapshot.forEach((doc, index) => {
    const data = doc.data();
    console.log(`${index + 1}. ${data.address || 'No address'}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   City: ${data.city}, ${data.state} ${data.zipCode}`);
    console.log(`   List Price: $${data.listPrice?.toLocaleString() || 'N/A'}`);
    console.log(`   Zestimate: $${data.estimatedValue?.toLocaleString() || 'N/A'}`);
    console.log(`   Rent Zestimate: $${data.rentZestimate?.toLocaleString()}/mo`);
    console.log(`   Monthly Payment: $${data.monthlyPayment?.toLocaleString() || 'N/A'}/mo`);

    if (data.monthlyPayment && data.rentZestimate > data.monthlyPayment) {
      const cashFlow = data.rentZestimate - data.monthlyPayment;
      console.log(`   💰 Positive Cash Flow: +$${cashFlow.toLocaleString()}/mo`);
    }

    console.log(`   Created: ${data.createdAt?.toDate?.() || data.createdAt || 'Unknown'}`);
    console.log('');
  });

  console.log('='.repeat(60));
  console.log('✅ VERIFICATION COMPLETE');
  console.log('='.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`   Total properties with rental estimates: ${snapshot.size}`);
  console.log('\n🌐 View on website: http://localhost:3000');
  console.log('   Look for the purple/pink "Investment Potential" section');
  console.log('');
}

verifyRentalEstimateSaved()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
