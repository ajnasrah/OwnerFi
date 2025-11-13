import * as dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

const app = initializeApp({ credential: cert(serviceAccount as any) });
const db = getFirestore(app);

async function debugFultonBuyer() {
  try {
    console.log('🔍 Finding buyers who should see this property...\n');

    // Get the Fulton property
    const propertyDoc = await db.collection('properties').doc('feMN1TbH8JR5ENTUV0Se').get();
    const property = propertyDoc.data();

    console.log('📍 Property Details:');
    console.log(`   Address: ${property?.address}`);
    console.log(`   City: ${property?.city}`);
    console.log(`   State: ${property?.state}`);
    console.log(`   Monthly Payment: $${property?.monthlyPayment}`);
    console.log(`   Down Payment: $${property?.downPaymentAmount}`);
    console.log(`   Images: ${property?.imageUrls?.length || 0} URLs`);
    console.log(`   Legacy imageUrl: ${property?.imageUrl ? '✅ YES' : '❌ NO'}`);
    console.log('\n');

    // Find buyers in Houston
    const buyersSnapshot = await db.collection('buyerProfiles')
      .where('preferredCity', '==', 'Houston')
      .get();

    console.log(`👥 Found ${buyersSnapshot.size} buyers searching in Houston\n`);

    // Check each buyer's budget
    buyersSnapshot.forEach(doc => {
      const buyer = doc.data();
      const canAffordMonthly = buyer.maxMonthlyPayment >= (property?.monthlyPayment || 0);
      const canAffordDown = buyer.maxDownPayment >= (property?.downPaymentAmount || 0);

      console.log(`Buyer: ${buyer.firstName} ${buyer.lastName}`);
      console.log(`  Max Monthly: $${buyer.maxMonthlyPayment} ${canAffordMonthly ? '✅' : '❌ TOO LOW'}`);
      console.log(`  Max Down: $${buyer.maxDownPayment} ${canAffordDown ? '✅' : '❌ TOO LOW'}`);
      console.log(`  Would see property: ${canAffordMonthly || canAffordDown ? '✅ YES' : '❌ NO'}`);
      console.log('');
    });

    // Also check if any buyer has this in their liked properties
    const allBuyersSnapshot = await db.collection('buyerProfiles').get();
    let foundInLiked = false;

    allBuyersSnapshot.forEach(doc => {
      const buyer = doc.data();
      if (buyer.likedProperties?.includes('feMN1TbH8JR5ENTUV0Se')) {
        foundInLiked = true;
        console.log(`❤️ Buyer ${buyer.firstName} ${buyer.lastName} has liked this property!`);
      }
    });

    if (!foundInLiked) {
      console.log('No buyers have liked this property yet.');
    }

    console.log('\n✅ Debug complete');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugFultonBuyer();
