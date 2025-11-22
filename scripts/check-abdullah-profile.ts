import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function checkAbdullahProfile() {
  const testPhone = '9018319661';

  try {
    console.log('\n🔍 Checking Abdullah\'s buyer profile structure...\n');

    const buyersSnapshot = await db.collection('buyerProfiles')
      .where('phone', '==', testPhone)
      .get();

    if (buyersSnapshot.empty) {
      console.log('❌ Buyer not found');
      return;
    }

    const buyerDoc = buyersSnapshot.docs[0];
    const buyer = buyerDoc.data();

    console.log('📋 Full Buyer Profile:');
    console.log(JSON.stringify(buyer, null, 2));

    console.log('\n\n📊 Key Fields for Matching:');
    console.log('─'.repeat(60));
    console.log(`ID: ${buyerDoc.id}`);
    console.log(`Phone: ${buyer.phone}`);
    console.log(`\nLocation Fields:`);
    console.log(`  city: ${buyer.city || 'not set'}`);
    console.log(`  state: ${buyer.state || 'not set'}`);
    console.log(`  preferredCity: ${buyer.preferredCity || 'not set'}`);
    console.log(`  preferredState: ${buyer.preferredState || 'not set'}`);
    console.log(`  searchCriteria.city: ${buyer.searchCriteria?.city || 'not set'}`);
    console.log(`  searchCriteria.state: ${buyer.searchCriteria?.state || 'not set'}`);

    console.log(`\nBudget Fields:`);
    console.log(`  maxMonthlyPayment: ${buyer.maxMonthlyPayment || 'not set'}`);
    console.log(`  maxDownPayment: ${buyer.maxDownPayment || 'not set'}`);
    console.log(`  searchCriteria.maxMonthlyPayment: ${buyer.searchCriteria?.maxMonthlyPayment || 'not set'}`);
    console.log(`  searchCriteria.maxDownPayment: ${buyer.searchCriteria?.maxDownPayment || 'not set'}`);

    console.log(`\nOther Matching Fields:`);
    console.log(`  minBedrooms: ${buyer.minBedrooms || 'not set'}`);
    console.log(`  minBathrooms: ${buyer.minBathrooms || 'not set'}`);
    console.log(`  minPrice: ${buyer.minPrice || 'not set'}`);
    console.log(`  maxPrice: ${buyer.maxPrice || 'not set'}`);
    console.log(`  searchRadius: ${buyer.searchRadius || 'not set'}`);
    console.log(`  searchCriteria.searchRadius: ${buyer.searchCriteria?.searchRadius || 'not set'}`);

    console.log(`\nStatus Fields:`);
    console.log(`  isActive: ${buyer.isActive}`);
    console.log(`  smsNotifications: ${buyer.smsNotifications}`);

    console.log(`\nMatched Properties:`);
    console.log(`  matchedPropertyIds: ${buyer.matchedPropertyIds?.length || 0} properties`);
    console.log(`  notifiedPropertyIds: ${buyer.notifiedPropertyIds?.length || 0} properties`);
    console.log(`  likedPropertyIds: ${buyer.likedPropertyIds?.length || 0} properties`);
    console.log(`  passedPropertyIds: ${buyer.passedPropertyIds?.length || 0} properties`);

    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAbdullahProfile();
