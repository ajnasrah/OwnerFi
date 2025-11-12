/**
 * Check if the property was saved and if buyer matching happened
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkPropertyAndMatches() {
  console.log('🔍 Checking property and buyer matches');
  console.log('======================================\n');

  try {
    // Find properties with "Flowering Peach" in the address
    console.log('📊 Looking for Flowering Peach properties...\n');

    const propertiesQuery = query(
      collection(db, 'properties'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const propertiesSnapshot = await getDocs(propertiesQuery);
    let floweringPeachProperty: any = null;
    let floweringPeachId: string | null = null;

    for (const doc of propertiesSnapshot.docs) {
      const property = doc.data();
      if (property.address?.includes('Flowering Peach')) {
        floweringPeachProperty = property;
        floweringPeachId = doc.id;
        break;
      }
    }

    if (!floweringPeachProperty) {
      console.log('❌ No Flowering Peach property found in database!');
      console.log('   The webhook may not have saved it correctly.\n');
      return;
    }

    console.log('✅ Found Flowering Peach property!');
    console.log(`   ID: ${floweringPeachId}`);
    console.log(`   Address: ${floweringPeachProperty.address}`);
    console.log(`   City: ${floweringPeachProperty.city}, ${floweringPeachProperty.state}`);
    console.log(`   Price: $${floweringPeachProperty.price?.toLocaleString()}`);
    console.log(`   Monthly Payment: $${floweringPeachProperty.monthlyPayment}`);
    console.log(`   Down Payment: $${floweringPeachProperty.downPaymentAmount?.toLocaleString()}`);
    console.log(`   Status: ${floweringPeachProperty.status}`);
    console.log(`   Active: ${floweringPeachProperty.isActive}\n`);

    // Check if any buyers have this property in their matchedPropertyIds
    console.log('🔍 Checking if buyers were matched...\n');

    const buyersQuery = query(
      collection(db, 'buyerProfiles'),
      where('matchedPropertyIds', 'array-contains', floweringPeachId)
    );

    const buyersSnapshot = await getDocs(buyersQuery);

    if (buyersSnapshot.empty) {
      console.log('❌ No buyers have this property in their matchedPropertyIds!');
      console.log('   This means the buyer matching endpoint was NOT called or failed.\n');
      console.log('💡 Possible reasons:');
      console.log('   1. The fetch() call in save-property webhook failed silently');
      console.log('   2. The sync-matches endpoint returned an error');
      console.log('   3. The property status or isActive flag prevented matching');
      console.log('   4. Network issue prevented the fetch from completing\n');

      // Check if property is active
      if (floweringPeachProperty.status !== 'active' || !floweringPeachProperty.isActive) {
        console.log('⚠️  Property is NOT active!');
        console.log(`   status: ${floweringPeachProperty.status}`);
        console.log(`   isActive: ${floweringPeachProperty.isActive}`);
        console.log('   Buyer matching is only triggered for active properties.\n');
      }

      return;
    }

    console.log(`✅ Found ${buyersSnapshot.size} buyers matched to this property:\n`);

    for (const doc of buyersSnapshot.docs) {
      const buyer = doc.data();
      console.log(`   • ${buyer.firstName} ${buyer.lastName}`);
      console.log(`     Phone: ${buyer.phone}`);
      console.log(`     Email: ${buyer.email}`);
      console.log(`     SMS Enabled: ${buyer.smsNotifications !== false ? 'YES' : 'NO'}`);
      console.log('');
    }

    console.log('======================================');
    console.log('✅ Buyer matching WAS triggered successfully!');
    console.log(`   ${buyersSnapshot.size} buyers were matched.`);
    console.log('\n📱 Next: Check if SMS notifications were sent to these buyers.');
    console.log('   Run: npx tsx scripts/check-notification-logs.ts');

  } catch (error) {
    console.error('❌ Error:');
    console.error(error);
  }
}

// Run the check
checkPropertyAndMatches().catch(console.error);
